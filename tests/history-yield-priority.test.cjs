'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {buildYieldPriority,fillResidual}=require('../scripts/history-yield-priority.cjs');
const {selectHistoricalWindows}=require('../scripts/osirion-sync.cjs');
const now=Date.parse('2026-11-28T06:00:00Z');
const row=(i,over={})=>({window:'observed-'+i,tournamentId:'high',region:'ME',attemptedPages:8,scannedPages:7,newCandidates:8,newPublished:4,...over});
const metrics=(n=3,over={})=>({version:1,scope:'regular-history-leaderboards',runs:Array.from({length:n},(_,i)=>({runId:'run-'+i,measuredAt:new Date(now-(i+1)*3600000).toISOString(),windows:[row(i,over)]}))});
const w=(id='high',region='ME')=>({tournamentId:id,region});
test('exact cohort needs enough separate runs, windows, pages and successful scans',()=>{
 const p=buildYieldPriority(metrics(),{enabled:true,now});
 assert.equal(p.reason,'ready');assert.equal(p.eligibleGroups,1);
 assert.equal(p.detail(w()).bonus,13);
 assert.equal(p.detail(w('high','EU')).bonus,0);
 assert.equal(p.detail(w('other')).bonus,0);
 for(const m of [null,metrics(2),metrics(3,{window:'same'}),metrics(3,{attemptedPages:6,scannedPages:6}),metrics(3,{scannedPages:3}),metrics(3,{scannedPages:9}),metrics(3,{newPublished:9})]){
  assert.equal(buildYieldPriority(m,{enabled:true,now}).detail(w()).bonus,0);
 }
 assert.equal(buildYieldPriority(metrics(),{enabled:false,now}).reason,'disabled');
 assert.equal(buildYieldPriority(metrics(),{enabled:true,now:now+31*86400000}).detail(w()).bonus,0);
 assert.equal(buildYieldPriority(metrics(3,{newCandidates:1000,newPublished:1000}),{enabled:true,now}).detail(w()).bonus,30);
 assert.equal(buildYieldPriority(metrics(3,{newCandidates:0,newPublished:0}),{enabled:true,now}).detail(w()).bonus,0);
});
test('residual changes limited to three, preserves a final baseline slot and no mutation',()=>{
 const learning=buildYieldPriority(metrics(),{enabled:true,now});
 const pool=Array.from({length:12},(_,i)=>({key:'k'+i,end:i,...w(i<6?'low':'high')}));
 const normal=(a,b)=>a.end-b.end,learned=(a,b)=>learning.detail(b).bonus-learning.detail(a).bonus||normal(a,b);
 const selected=[],seen=new Set(),changes=[],before=JSON.stringify(pool);
 fillResidual(pool,selected,seen,5,normal,learned,learning,changes);
 assert.deepEqual(selected.map(x=>x.key),['k6','k7','k8','k0','k1']);
 assert.equal(changes.length,3);assert.equal(JSON.stringify(pool),before);
 const one=[],oneChanges=[];
 fillResidual(pool,one,new Set(),1,normal,learned,learning,oneChanges);
 assert.equal(one[0].key,'k0');assert.equal(oneChanges.length,0);
});
test('selector keeps protected choices, near completion, delayed retry exclusion and fallback',()=>{
 const mk=(key,i,id='low')=>({key,windowId:key,dateJst:'2024-02-01',end:Date.parse('2024-02-01')+i*1000,region:'ME',series:'cash-cup',kind:'参加確認',tournamentId:id});
 const windows=[mk('due',0),mk('wait',1,'high'),mk('near',2),...Array.from({length:12},(_,i)=>mk('fresh'+i,3+i)),
  ...Array.from({length:8},(_,i)=>mk('low'+i,20+i)),...Array.from({length:8},(_,i)=>mk('high'+i,40+i,'high'))];
 const state={windows:{due:{nextPage:1,totalPages:100,retryAfter:'2026-11-27T00:00:00Z'},wait:{nextPage:1,totalPages:100,retryAfter:'2099-01-01T00:00:00Z'},near:{nextPage:98,totalPages:100}}};
 for(const x of windows.filter(x=>/^(low|high)/.test(x.key)))state.windows[x.key]={nextPage:10,totalPages:100};
 const config={maxWindowsPerRun:12,minUnstartedWindowsPerRun:6,maxPagesPerWindowPerRun:12};
 const baseline=selectHistoricalWindows(windows,state,config,now,[],[]);
 const changes=[],learning=buildYieldPriority(metrics(),{enabled:true,now});
 const adaptive=selectHistoricalWindows(windows,state,config,now,[],[],{learning,learnedSelections:changes});
 assert.equal(adaptive.length,12);assert.equal(new Set(adaptive.map(x=>x.key)).size,12);
 assert.equal(adaptive[0].key,'due');assert.ok(adaptive.some(x=>x.key==='near'));assert.ok(!adaptive.some(x=>x.key==='wait'));
 assert.ok(adaptive.filter(x=>x.key.startsWith('fresh')).length>=6);
 assert.ok(changes.length>0&&changes.length<=3);assert.ok(adaptive.some(x=>x.key.startsWith('low')));
 const first=baseline.findIndex(x=>x.key.startsWith('low'));assert.ok(first>0);
 assert.deepEqual(adaptive.slice(0,first),baseline.slice(0,first));
 const cold=selectHistoricalWindows(windows,state,config,now,[],[],{learning:buildYieldPriority(metrics(1),{enabled:true,now})});
 assert.deepEqual(cold,baseline);
});
