'use strict';
// Pure allocation only. No API, result publication or checkpoint mutation.
const {remainingPages}=require('./scan-efficiency.cjs');
const {requiresCheckpointEpicIds}=require('./tournament-approval-policy.cjs');
const int=n=>Number.isSafeInteger(n)&&n>=0;
function capacity(w,cp,cap){
 if(requiresCheckpointEpicIds(w.series)&&cp?.epicIdsRetained!==true)return cap;
 if(cp?.complete===true)return 0;
 return Math.min(cap,remainingPages(cp)??cap);
}
function isNew(cp){return !cp||(!cp.complete&&(!int(cp.nextPage)||cp.nextPage===0)&&!cp.retryAfter)}
function planBudget(active,state,recovery,{budget,perWindowCap=12,minUnstarted=6,maxRecoveryPercent=60,now=Date.now()}={}){
 if(!Array.isArray(active)||!state?.windows||!Array.isArray(recovery)||!int(budget)||
  !int(perWindowCap)||perWindowCap<1||perWindowCap>50||!int(minUnstarted)||
  !int(maxRecoveryPercent)||maxRecoveryPercent<0||maxRecoveryPercent>80)
  throw Error('Invalid dynamic history budget inputs');
 const groups=new Map(recovery.map(x=>[x.windowKey,x]));
 const seen=new Set(),items=[];
 for(const w of active){
  if(!w?.key||seen.has(w.key))throw Error('Duplicate or invalid historical window');
  seen.add(w.key);
  const cp=state.windows[w.key],retry=Date.parse(cp?.retryAfter||'');
  const blocked=Boolean(cp?.retryAfter)&&(!Number.isFinite(retry)||retry>now);
  const group=groups.get(w.key);
  const cap=blocked?0:capacity(w,cp,perWindowCap);
  items.push({key:w.key,category:group?'recovery':cp?.retryAfter?'retry':isNew(cp)?'unstarted':'other',
   cap,pages:0,candidateCount:group?.candidateCount||0,cashCandidates:group?.cashCandidates||0,
   remaining:remainingPages(cp)});
 }
 let left=budget;
 const grant=(item,target)=>{const n=Math.max(0,Math.min(left,item.cap-item.pages,target-item.pages));item.pages+=n;left-=n;return n};
 // One page per protected selected window whenever possible. When the traffic
 // policy shrinks a run, reserve due retry and unstarted windows first.
 const fresh=items.filter(x=>x.category==='unstarted'&&x.cap>0).slice(0,minUnstarted);
 const baseline=[...items.filter(x=>x.category==='retry'&&x.cap>0).slice(0,1),...fresh,...items];
 for(const item of baseline)grant(item,1);
 // Preserve up to two pages in the protected unstarted slice.
 for(const item of fresh)grant(item,2);
 const target=Math.floor(budget*maxRecoveryPercent/100);
 let recoveryPages=items.filter(x=>x.category==='recovery').reduce((n,x)=>n+x.pages,0);
 const byKey=new Map(items.map(x=>[x.key,x]));
 const ordered=recovery.map(x=>byKey.get(x.windowKey)).filter(Boolean);
 // Complete affordable candidate boards before investing in long scans.
 for(const item of ordered){
  if(item.remaining===null||item.remaining>item.cap||item.remaining<=item.pages)continue;
  const need=item.remaining-item.pages;
  if(need<=left&&need<=target-recoveryPages)recoveryPages+=grant(item,item.remaining);
 }
 for(const item of ordered)recoveryPages+=grant(item,Math.min(item.cap,item.pages+Math.max(0,target-recoveryPages)));
 // Do not strand ordinary near-complete boards or unused candidate budget.
 const ordinary=items.filter(x=>x.category!=='recovery');
 const near=ordinary.filter(x=>x.remaining!==null&&x.remaining<=x.cap&&x.remaining>x.pages)
  .sort((a,b)=>a.remaining-b.remaining||a.key.localeCompare(b.key));
 for(const item of near.slice(0,2))if(item.remaining-item.pages<=left)grant(item,item.remaining);
 // Allocate the rest across ordinary work, then candidate work only up to
 // the recovery target. Unneeded pages are never forced into extra requests.
 for(const item of ordinary)grant(item,2);
 for(const item of ordinary)grant(item,item.cap);
 for(const item of ordered)recoveryPages+=grant(item,Math.min(item.cap,item.pages+Math.max(0,target-recoveryPages)));
 const planned=items.reduce((n,x)=>n+x.pages,0);
 return {budget,planned,unallocated:budget-planned,maxRecoveryPercent,items};
}
function allowance(plan,index,budget,observed=null){
 if(!plan?.items||!int(index)||index>=plan.items.length||!int(budget))throw Error('Invalid dynamic allowance');
 const item=plan.items[index],future=plan.items.slice(index+1);
 const reserved=future.reduce((n,x)=>n+x.pages,0);
 const available=Math.max(0,budget-reserved);
 const baseline=Math.min(item.pages,item.cap,available);
 // Without runtime observations retain the original static allowance.
 if(observed===null||!item.cap)return baseline;
 // Only forward redistribution: never reopen a processed or blocked window.
 // Remaining budget already charges failed requests, not just scanned pages.
 const prior=plan.items.slice(0,index);
 const reclaimed=prior.reduce((n,x)=>{
  const used=observed[x.key]?.attempted??0;
  if(!int(used)||used>x.cap)throw Error('Invalid historical attempted pages');
  return n+x.pages-used;
 },0);
 const surplus=Math.max(0,Math.min(available-baseline,reclaimed));
 let extra=Math.min(item.cap-baseline,surplus);
 if(item.category==='recovery'){
  const used=prior.filter(x=>x.category==='recovery').reduce((n,x)=>n+(observed[x.key]?.attempted??0),0);
  const futureRecovery=future.filter(x=>x.category==='recovery').reduce((n,x)=>n+x.pages,0);
  const target=Math.floor(plan.budget*plan.maxRecoveryPercent/100);
  // Do not add recovery requests above the original percentage limit.
  // Existing protected baseline allocation is not reduced.
  extra=Math.min(extra,Math.max(0,target-used-futureRecovery-baseline));
 }
 return baseline+extra;
}
function summary(plan,observed={}){
 const groups={};
 for(const item of plan.items){
  const g=groups[item.category]||={windows:0,plannedPages:0,attemptedPages:0,scannedPages:0,candidateCount:0,cashCandidates:0};
  const use=observed[item.key]||{};
  g.windows++;g.plannedPages+=item.pages;g.attemptedPages+=use.attempted||0;g.scannedPages+=use.scanned||0;
  g.candidateCount+=item.candidateCount;g.cashCandidates+=item.cashCandidates;
 }
 const reallocatedPages=plan.items.reduce((n,x)=>n+Math.max(0,(observed[x.key]?.attempted||0)-x.pages),0);
 const unusedPlannedPages=plan.items.reduce((n,x)=>n+Math.max(0,x.pages-(observed[x.key]?.attempted||0)),0);
 return {pageBudget:plan.budget,plannedPages:plan.planned,unallocatedPages:plan.unallocated,reallocatedPages,unusedPlannedPages,groups,
  windows:plan.items.filter(x=>x.category==='recovery').map(x=>({window:x.key,remainingPages:x.remaining,plannedPages:x.pages,
   attemptedPages:observed[x.key]?.attempted||0,scannedPages:observed[x.key]?.scanned||0,candidateCount:x.candidateCount,cashCandidates:x.cashCandidates}))};
}
// A zero-length recovery shortlist is ordinary historical work, not a reason
// to abandon protected allocations. Disabled mode and provider pause are unchanged.
function planActiveBudget(active,state,recovery,{enabled=false,rateLimited=false,...options}={}){
 return enabled&&!rateLimited?planBudget(active,state,recovery,options):null;
}
module.exports={planBudget,planActiveBudget,allowance,summary};
