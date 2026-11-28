'use strict';
// Bounded, positive-only priority signal from committed regular-history observations.
// No API, mutation, approval authority, or fallback across unrelated tournaments.
const DAY=86400000,MIN_RUNS=3,MIN_WINDOWS=3,MIN_ATTEMPTS=20,MIN_SCANNED=10,MAX_BONUS=30,SHRINK_PAGES=12,MAX_SLOTS=3;
const count=n=>Number.isSafeInteger(n)&&n>=0;
const key=(id,region)=>JSON.stringify([id,region]);
function buildYieldPriority(metrics,{enabled=false,now=Date.now()}={}){
 const groups=new Map(),seenRuns=new Set();
 const empty={bonus:0,attemptedPages:0,scannedPages:0,runs:0,windows:0,newCandidates:0,newPublished:0};
 const neutral=reason=>({enabled,reason,observedRuns:0,eligibleGroups:0,maxSlots:MAX_SLOTS,detail:()=>({...empty})});
 if(!enabled)return neutral('disabled');
 if(metrics?.version!==1||metrics.scope!=='regular-history-leaderboards'||!Array.isArray(metrics.runs))return neutral('no-measurements');
 for(const run of metrics.runs.slice(-30)){
  const at=Date.parse(run?.measuredAt||'');
  if(!Number.isFinite(at)||at>now||at<now-30*DAY||typeof run.runId!=='string'||!run.runId||seenRuns.has(run.runId)||!Array.isArray(run.windows))continue;
  const seenWindows=new Set(),rows=[];
  for(const r of run.windows){
   if(!r||typeof r.window!=='string'||seenWindows.has(r.window)||typeof r.tournamentId!=='string'||typeof r.region!=='string'||
    !count(r.attemptedPages)||!count(r.scannedPages)||!count(r.newCandidates)||!count(r.newPublished)||
    r.scannedPages>r.attemptedPages||r.newPublished>r.newCandidates||(!r.scannedPages&&r.newCandidates)){
     rows.length=0;break;
   }
   seenWindows.add(r.window);if(r.attemptedPages>0)rows.push(r);
  }
  if(!rows.length)continue;
  seenRuns.add(run.runId);
  for(const r of rows){
   const k=key(r.tournamentId,r.region);
   if(!groups.has(k))groups.set(k,{attemptedPages:0,scannedPages:0,newCandidates:0,newPublished:0,runs:new Set(),windows:new Set()});
   const g=groups.get(k);
   g.runs.add(run.runId);g.windows.add(r.window);
   for(const f of ['attemptedPages','scannedPages','newCandidates','newPublished'])g[f]+=r[f];
  }
 }
 const eligible=g=>g&&g.runs.size>=MIN_RUNS&&g.windows.size>=MIN_WINDOWS&&g.attemptedPages>=MIN_ATTEMPTS&&g.scannedPages>=MIN_SCANNED;
 const eligibleGroups=[...groups.values()].filter(eligible).length;
 function detail(w){
  const g=groups.get(key(w.tournamentId,w.region));
  if(!g)return {...empty};
  const bonus=eligible(g)?Math.min(MAX_BONUS,Math.round((10*g.newCandidates+20*g.newPublished)/(g.attemptedPages+SHRINK_PAGES))):0;
  return {bonus,attemptedPages:g.attemptedPages,scannedPages:g.scannedPages,runs:g.runs.size,windows:g.windows.size,newCandidates:g.newCandidates,newPublished:g.newPublished};
 }
 return {enabled:true,reason:eligibleGroups?'ready':'insufficient-samples',observedRuns:seenRuns.size,eligibleGroups,maxSlots:MAX_SLOTS,detail};
}
// Select only from a caller's already eligible residual pool. Keep one final
// slot for the original comparator; never affect protected selection phases.
function fillResidual(pool,selected,seen,limit,baseline,adaptive,learning,learnedSelections){
 const ordinary=pool.filter(w=>!seen.has(w.key)).sort(baseline);
 const learned=learning?.eligibleGroups?ordinary.slice().sort(adaptive):[];
 let i=0,j=0;
 while(selected.length<limit){
  while(i<ordinary.length&&seen.has(ordinary[i].key))i++;
  if(i===ordinary.length)break;
  let win=ordinary[i];
  if(learning?.eligibleGroups&&learnedSelections.length<learning.maxSlots&&limit-selected.length>1){
   while(j<learned.length&&seen.has(learned[j].key))j++;
   const candidate=learned[j];
   if(candidate&&candidate.key!==win.key&&learning.detail(candidate).bonus>0){
    learnedSelections.push({key:candidate.key,replacedBaseline:win.key,...learning.detail(candidate)});
    win=candidate;
   }
  }
  selected.push(win);seen.add(win.key);
 }
}
module.exports={buildYieldPriority,fillResidual};
