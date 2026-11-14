'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {windowPageAllowance,leastCoveredBucket,remainingPages}=require('../scripts/scan-efficiency.cjs');
const {selectHistoricalWindows}=require('../scripts/osirion-sync.cjs');

test('history budget reserves enough for two finishable checkpoints without extra API pages',()=>{
 const active=['early','near3','near5'].map(key=>({key,series:'victory-cup'}));
 const state={windows:{early:{nextPage:0},near3:{nextPage:7,totalPages:10},
  near5:{nextPage:25,totalPages:30}}};
 const before=JSON.stringify(state);
 // A naïve two-page reservation gives early 8 and leaves both incomplete.
 // Protect the exact 3+5 pages for the two known nearly finished boards.
 assert.equal(windowPageAllowance(active,state,0,12,8,true),4);
 assert.equal(windowPageAllowance(active,state,1,8,8,true),3);
 assert.equal(windowPageAllowance(active,state,2,5,8,true),5);
 assert.equal(JSON.stringify(state),before,'planning must not mutate checkpoints');
 assert.equal(remainingPages(state.windows.near3),3);
});

test('recent scans retain their prior minimum page reservation behavior',()=>{
 const active=['first','second','third'].map(key=>({key}));
 const state={windows:{second:{nextPage:7,totalPages:10},third:{nextPage:25,totalPages:30}}};
 assert.equal(windowPageAllowance(active,state,0,12,8,false),8);
 assert.equal(windowPageAllowance(active,state,1,4,8,false),3);
 assert.equal(windowPageAllowance(active,state,2,1,8,false),1);
});

test('unfinished historical Unreal caches never receive false near-finish credit',()=>{
 const active=[{key:'first'},{key:'unreal',series:'unreal-cup'}];
 const state={windows:{unreal:{complete:true,epicIdsRetained:false,nextPage:97,totalPages:100}}};
 assert.equal(windowPageAllowance(active,state,0,10,8,true),8);
 assert.equal(windowPageAllowance(active,state,1,2,8,true),2);
});

test('page allowance never exceeds per-window or global budget and rejects invalid plans',()=>{
 const active=[{key:'first'},{key:'later'}],state={windows:{}};
 assert.equal(windowPageAllowance(active,state,0,1,12,true),0);
 assert.equal(windowPageAllowance(active,state,1,1,12,true),1);
 assert.equal(windowPageAllowance(active,state,1,100,12,true),12);
 assert.throws(()=>windowPageAllowance(active,state,-1,10,12,true),/Invalid/);
 assert.throws(()=>windowPageAllowance(active,state,0,-1,12,true),/Invalid/);
});

test('least-covered cohort uses percentages, not raw number of incomplete rounds',()=>{
 assert.equal(leastCoveredBucket({
  '2024':{total:984,completed:144},
  '2025':{total:702,completed:68},
  '2026':{total:1323,completed:331}
 }), '2025');
 assert.equal(leastCoveredBucket({
  'BR':{total:525,completed:52},'ME':{total:527,completed:170},
  'EU':{total:547,completed:73}
 }), 'BR');
 assert.equal(leastCoveredBucket({}),null);
});

test('historical selection adds bounded slots for the least covered year and region',()=>{
 const regions=['ME','EU','NAC','NAW','OCE','BR'],years=['2024','2025','2026'];
 const series=['victory-cup','cash-cup','performance-evaluation'];
 const all=[],state={windows:{}};
 for(const year of years)for(const region of regions)for(const kind of series){
  const key=year+'-'+region+'-'+kind;
  all.push({key,dateJst:year+'-06-01',end:Date.parse(year+'-06-01T12:00:00Z'),
   region,series:kind,tournamentId:'synthetic-cup',kind:'参加確認'});
  if(year!=='2025'&&region!=='BR'&&kind==='performance-evaluation')
   state.windows[key]={complete:true};
 }
 const before=JSON.stringify(state);
 const chosen=selectHistoricalWindows(all,state,{maxWindowsPerRun:24,minUnstartedWindowsPerRun:6},
  Date.parse('2026-11-15T00:00:00Z'));
 assert.equal(chosen.length,24);
 assert.equal(new Set(chosen.map(w=>w.key)).size,chosen.length);
 assert.equal(chosen[6].dateJst.slice(0,4),'2025','Extra slot for least-covered year');
 assert.equal(chosen[7].region,'BR','Extra slot for least-covered region');
 assert.deepEqual(new Set(chosen.map(w=>w.dateJst.slice(0,4))),new Set(years));
 assert.deepEqual(new Set(chosen.map(w=>w.region)),new Set(regions));
 assert.equal(JSON.stringify(state),before,'selector cannot change saved scan state');
});

test('selected retry and already scanned identity candidates keep their safeguards',()=>{
 const now=Date.parse('2026-11-15T00:00:00Z');
 const mk=(key,days)=>({key,dateJst:'2025-03-01',region:'NAW',series:'cash-cup',
  tournamentId:'cash',kind:'参加確認',end:now-days*86400000});
 const wins=[mk('delay',1),mk('due',2),mk('near',3),mk('new',4)];
 const state={windows:{
  delay:{nextPage:3,totalPages:5,retryAfter:'2026-11-16T00:00:00Z'},
  due:{nextPage:3,totalPages:5,retryAfter:'2026-11-14T00:00:00Z'},
  near:{nextPage:8,totalPages:10,proposals:[{id:'verified-candidate',verified:true}]}
 }};
 const picked=selectHistoricalWindows(wins,state,{maxWindowsPerRun:4},now);
 assert.ok(picked.some(w=>w.key==='due'));
 assert.ok(picked.some(w=>w.key==='near'));
 assert.ok(!picked.some(w=>w.key==='delay'));
});
