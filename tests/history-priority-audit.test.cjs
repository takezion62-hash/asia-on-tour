'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {historicalPriorityAudit,selectHistoricalWindows}=require('../scripts/osirion-sync.cjs');
const win=(key,date)=>({key,dateJst:date,region:'ME',series:'cash-cup',kind:'予選',tournamentId:'test',windowId:key,end:Date.parse(date)});
test('audit ranks known evidence ahead of unknown windows without changing checkpoints',()=>{
 const windows=[win('a','2024-01-01'),win('b','2024-02-01')];
 const state={windows:{a:{nextPage:0},b:{nextPage:0}}};
 const before=JSON.stringify(state);
 const records=[{tournamentId:'test',region:'ME',date:'2024-02-01'}];
 const result=historicalPriorityAudit(windows,state,records);
 assert.equal(result.eligible,2);
 assert.equal(result.top[0].key,'b');
 assert.equal(result.top[0].reasons.existingEvidence,70);
 assert.equal(JSON.stringify(state),before);
});
test('audit excludes completed and retry-waiting windows',()=>{
 const windows=[win('done','2024-01-01'),win('wait','2024-02-01'),win('ready','2024-03-01')];
 const state={windows:{done:{complete:true},wait:{retryAfter:'2099-01-01T00:00:00Z'},ready:{}}};
 const result=historicalPriorityAudit(windows,state,[],{now:Date.parse('2026-11-16T00:00:00Z')});
 assert.equal(result.eligible,1);
 assert.equal(result.top[0].key,'ready');
});

test('history selection uses remaining slots for resumable checkpoints without starving new windows',()=>{
 const windows=Array.from({length:35},(_,i)=>({...win('new-'+i,'2024-02-01'),end:Date.parse('2024-02-01')+i*1000}));
 const partial={...win('partial','2024-01-01'),end:Date.parse('2024-01-01')};
 windows.push(partial);
 const state={windows:{partial:{nextPage:40,totalPages:100}}};
 const config={maxWindowsPerRun:12,minUnstartedWindowsPerRun:6,maxPagesPerWindowPerRun:12};
 const chosen=selectHistoricalWindows(windows,state,config,Date.parse('2026-11-16'),[],[]);
 assert.equal(chosen.length,12);
 assert.ok(chosen.some(w=>w.key==='partial'));
 assert.ok(chosen.filter(w=>w.key!=='partial').length>=6);
});
