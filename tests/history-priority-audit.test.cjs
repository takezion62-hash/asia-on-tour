'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {historicalPriorityAudit}=require('../scripts/osirion-sync.cjs');
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
