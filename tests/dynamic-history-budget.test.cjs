'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {planBudget,planActiveBudget,allowance,summary}=require('../scripts/dynamic-history-budget.cjs');
const {windowPageAllowance}=require('../scripts/scan-efficiency.cjs');
const {recoveryShortlist,REVIEW_REASON}=require('../scripts/review-recovery-priority.cjs');
const now=Date.parse('2026-11-24T13:00:00Z');
const w=(key,series='victory-cup')=>({key,series});
function fixture(){
 const active=Array.from({length:24},(_,i)=>w('w'+i)),state={windows:{}};
 for(let i=6;i<24;i++)state.windows['w'+i]={complete:false,nextPage:10,totalPages:100};
 state.windows.w6.totalPages=21;state.windows.w7.totalPages=25;
 state.windows.w8.totalPages=14;
 const recovery=[{windowKey:'w6',candidateCount:2,cashCandidates:2},{windowKey:'w7',candidateCount:12,cashCandidates:0},{windowKey:'w8',candidateCount:3,cashCandidates:0}];
 return {active,state,recovery};
}
test('48-page steady state completes an 11-page and a 4-page candidate board, preserves six fresh slots',()=>{
 const x=fixture(),before=JSON.stringify(x);
 const p=planBudget(x.active,x.state,x.recovery,{budget:48,minUnstarted:6,now});
 const by=Object.fromEntries(p.items.map(i=>[i.key,i.pages]));
 assert.equal(by.w6,11);assert.equal(by.w8,4);
 assert.ok(by.w7>2);assert.equal(p.planned,48);
 for(let i=0;i<6;i++)assert.ok(by['w'+i]>=2);
 assert.ok(p.items.every(i=>i.pages<=12));assert.equal(JSON.stringify(x),before);
 assert.ok(summary(p).groups.recovery.plannedPages<=Math.floor(48*.6));
});
test('low budget, due retry, delayed retry, completed and stale Epic ID checkpoints',()=>{
 const x=fixture();x.state.windows.w9={nextPage:0,retryAfter:'2026-11-23T00:00:00Z'};
 x.state.windows.w10={nextPage:1,totalPages:5,retryAfter:'2026-11-25T00:00:00Z'};
 x.state.windows.w11={complete:true,nextPage:4,totalPages:4};
 x.active[12].series='nvidia-cup';x.state.windows.w12={complete:true,epicIdsRetained:false};
 for(const budget of [0,1,6,12,20,24,44,48,96]){
  const p=planBudget(x.active,x.state,x.recovery,{budget,minUnstarted:6,now});
  assert.ok(p.planned<=budget);assert.equal(p.items[10].pages,0);assert.equal(p.items[11].pages,0);
  if(budget)assert.ok(p.items[9].pages>=1);
  assert.equal(p.items[12].cap,12);
  let left=budget;
  for(let i=0;i<p.items.length;i++){const n=allowance(p,i,left);assert.ok(n>=0&&n<=p.items[i].cap);left-=n}
  assert.ok(left>=0);
 }
});
test('allocation cap and future reservation survive early completion and zero budget',()=>{
 const x=fixture(),p=planBudget(x.active,x.state,x.recovery,{budget:44,now});
 let left=44;
 for(let i=0;i<p.items.length;i++){
  const n=allowance(p,i,left);assert.ok(n<=p.items[i].pages);
  left-=i===0?0:n;
 }
 assert.ok(left>=0);assert.equal(allowance(p,0,0),0);
 assert.throws(()=>planBudget([x.active[0],x.active[0]],x.state,[],{budget:4}));
});
test('additional recovery reasons require configured route, exact source and intact page chain',()=>{
 const event='S39_NvidiaCup',windowId=event+'_OCE',key='epicgames_'+event+'_OCE/'+windowId;
 const win={key,eventId:event,windowId,seasonId:'S39',dateJst:'2025-12-21',region:'OCE',series:'nvidia-cup',tournamentId:'ch7s1-nvidia-geforce-rtx-cup',kind:'参加確認',round:'単一ラウンド / 参加確認'};
 const row={id:'test-nvidia',seasonId:win.seasonId,date:win.dateJst,region:win.region,tournamentId:win.tournamentId,kind:win.kind,round:win.round,rank:40,verified:true,prize:null,source:'https://www.fortnite.com/competitive/events/'+event+'/?region=OCE&round='+windowId,reviewReason:'全ページ連続の順位表・Epic ID付完全スナップショットが未確認'};
 const cp={complete:false,nextPage:3,pages:3,totalPages:6,lastSeenRank:300,rankingOrderValid:true,epicIdsRetained:true,proposals:[{...row}]};
 const config={autoApproveNvidia:true};
 const plan=(r=row,c=cp,cfg=config,reviewedIds=[])=>recoveryShortlist([win],{windows:{[key]:c}},[r],[],{config:cfg,now,reviewedIds});
 assert.equal(plan().length,1);assert.equal(plan()[0].cashCandidates,1);
 assert.equal(plan(row,cp,{}).length,0);
 assert.equal(plan({...row,reviewReason:'本人ID不一致'}).length,0);
 assert.equal(plan(row,{...cp,pages:2}).length,0);
 assert.equal(plan(row,{...cp,epicIdsRetained:false}).length,0);
 assert.equal(plan(row,{...cp,retryAfter:'2026-11-25T00:00:00Z'}).length,0);
 assert.equal(plan(row,cp,config,[row.id]).length,0);
 assert.equal(plan({...row,rank:41}).length,0);
});

test('empty recovery queue keeps the due retry and six selected fresh windows funded after the delta scan',()=>{
 const active=Array.from({length:24},(_,i)=>w('w'+i)),state={windows:{}};
 state.windows.w0={nextPage:0,retryAfter:'2026-11-23T00:00:00Z'};
 for(let i=7;i<24;i++)state.windows['w'+i]={complete:false,nextPage:10,totalPages:100};
 state.windows.w22.totalPages=13;state.windows.w23.totalPages=15;
 const before=JSON.stringify({active,state});
 // Reproduces the old fallback: 48 steady-state pages, four already spent.
 assert.equal(windowPageAllowance(active,state,0,44,12,true),0);
 const p=planActiveBudget(active,state,[],{enabled:true,budget:44,minUnstarted:6,now});
 assert.ok(p);
 assert.equal(p.planned,44);
 assert.ok(p.items[0].pages>=1,'due retry must get a page');
 assert.ok(p.items.every(i=>i.pages>=1&&i.pages<=12));
 for(let i=1;i<=6;i++)assert.ok(p.items[i].pages>=2);
 assert.equal(p.items[22].pages,3);assert.equal(p.items[23].pages,5);
 let left=44;
 for(let i=0;i<active.length;i++){
  const n=allowance(p,i,left);assert.equal(n,p.items[i].pages);left-=n;
 }
 assert.equal(left,0);assert.equal(JSON.stringify({active,state}),before);
 assert.equal(summary(p).groups.retry.plannedPages,p.items[0].pages);
 assert.equal(summary(p).windows.length,0);
});
test('ordinary historical allocation remains bounded during a reduced budget or provider pause',()=>{
 const active=Array.from({length:20},(_,i)=>w('w'+i)),state={windows:{w0:{nextPage:0,retryAfter:'2026-11-23T00:00:00Z'}}};
 const options={enabled:true,budget:20,minUnstarted:6,now};
 const p=planActiveBudget(active,state,[],options);
 assert.equal(p.planned,20);assert.ok(p.items.every(i=>i.pages===1));
 assert.equal(planActiveBudget(active,state,[],{...options,rateLimited:true}),null);
 assert.equal(planActiveBudget(active,state,[],{...options,enabled:false}),null);
 const zero=planActiveBudget(active,state,[],{...options,budget:0});
 assert.equal(zero.planned,0);
 for(let i=0;i<active.length;i++)assert.equal(allowance(zero,i,0),0);
});

test('early finish releases only unused attempts to later windows while preserving future allocations',()=>{
 const active=[w('a'),w('b'),w('c')],state={windows:{}};
 const plan={budget:12,planned:12,unallocated:0,maxRecoveryPercent:60,items:[
  {key:'a',category:'other',pages:5,cap:12},
  {key:'b',category:'other',pages:3,cap:12},
  {key:'c',category:'unstarted',pages:4,cap:12}]};
 const before=JSON.stringify(plan);
 const seen={a:{attempted:2,scanned:2}};
 assert.equal(allowance(plan,1,10,seen),6);
 seen.b={attempted:6,scanned:5}; // one failed request still consumes a page
 assert.equal(allowance(plan,2,4,seen),4);
 seen.c={attempted:4,scanned:4};
 assert.equal(summary(plan,seen).reallocatedPages,3);
 assert.equal(summary(plan,seen).unusedPlannedPages,3);
 assert.equal(JSON.stringify(plan),before);
 assert.equal(allowance(plan,1,10,{a:{attempted:5,scanned:2}}),3);
});
test('reallocation cannot exceed per-window cap, recovery percentage, or remaining budget',()=>{
 const plan={budget:20,planned:20,unallocated:0,maxRecoveryPercent:60,items:[
  {key:'a',category:'other',pages:6,cap:12},
  {key:'b',category:'recovery',pages:5,cap:12},
  {key:'c',category:'recovery',pages:5,cap:12},
  {key:'d',category:'other',pages:4,cap:5},
  {key:'blocked',category:'retry',pages:0,cap:0}]};
 const obs={a:{attempted:1,scanned:1}};
 assert.equal(allowance(plan,1,19,obs),7);
 obs.b={attempted:7,scanned:7};
 assert.equal(allowance(plan,2,12,obs),5);
 obs.c={attempted:5,scanned:5};
 assert.equal(allowance(plan,3,7,obs),5);
 assert.equal(allowance(plan,3,2,obs),2);
 assert.equal(allowance(plan,4,2,obs),0);
 assert.equal(allowance(plan,4,0,obs),0);
});
test('real planner forward redistribution consumes at most budget for simulated early completions and errors',()=>{
 const x=fixture();
 for(const n of [0,1,6,12,20,24,44,48,96]){
  const p=planBudget(x.active,x.state,x.recovery,{budget:n,minUnstarted:6,now});
  let left=n;const observed={};
  for(let i=0;i<p.items.length;i++){
   const item=p.items[i],grant=allowance(p,i,left,observed);
   assert.ok(grant>=0&&grant<=item.cap&&grant<=left);
   const attempted=i%3===0?Math.min(1,grant):grant;
   observed[item.key]={attempted,scanned:Math.max(0,attempted-(i%4===0?1:0))};
   left-=attempted;
  }
  assert.ok(left>=0);
  assert.equal(Object.values(observed).reduce((s,x)=>s+x.attempted,0)+left,n);
  assert.ok(summary(p,observed).reallocatedPages>=0);
 }
});
