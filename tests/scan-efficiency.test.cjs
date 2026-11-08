'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {remainingPages,finishableWindows}=require('../scripts/scan-efficiency.cjs');
const now=Date.parse('2026-11-08T08:00:00Z');
const w=key=>({key,series:'cash-cup',dateJst:'2025-01-01'});
test('finishable partial windows are prioritized by actual pages remaining, not volume scanned',()=>{
 const wins=['long','near','nearest','new'].map(w);
 const state={windows:{long:{nextPage:90,totalPages:200},near:{nextPage:47,totalPages:50},
  nearest:{nextPage:9,totalPages:10},new:{nextPage:0,totalPages:3}}};
 assert.deepEqual(finishableWindows(wins,state,10,now).map(x=>x.key),['nearest','near']);
 assert.equal(remainingPages(state.windows.new),null);
});
test('skips completed and future retry windows, preserves checkpoint immutability',()=>{
 const wins=['done','delay','due','unreal'].map(w);
 wins[3].series='unreal-cup';
 const state={windows:{done:{complete:true,nextPage:9,totalPages:10},
  delay:{retryAfter:'2026-11-09T00:00:00Z',nextPage:9,totalPages:10},
  due:{retryAfter:'2026-11-07T00:00:00Z',nextPage:9,totalPages:10},
  unreal:{complete:true,epicIdsRetained:false,nextPage:9,totalPages:10}}};
 const old=JSON.stringify(state);
 assert.deepEqual(finishableWindows(wins,state,10,now).map(x=>x.key),['due']);
 assert.equal(JSON.stringify(state),old);
});
test('safety cap prevents a large backlog from monopolizing a run',()=>{
 const state={windows:{}},wins=Array.from({length:12},(_,i)=>w('w'+i));
 for(const x of wins)state.windows[x.key]={nextPage:1,totalPages:2};
 assert.equal(finishableWindows(wins,state,10,now,3).length,3);
 assert.equal(finishableWindows(wins,state,10,now,999).length,4);
 assert.equal(remainingPages({nextPage:4,totalPages:4}),null);
});
