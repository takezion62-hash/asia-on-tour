'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {scanCoverage,classifyWindow}=require('../scripts/scan-coverage.cjs');
const now=Date.parse('2026-11-07T12:00:00Z');
const w=(key,region,date,series='victory-cup')=>({key,region,dateJst:date,series});
test('discovered scan windows are partitioned into completed, untouched, partial and deferred retries',()=>{
 const wins=[w('done','ME','2024-01-01'),w('new','NAW','2026-11-06'),w('part','EU','2025-01-01'),
  w('sleep','OCE','2025-09-01'),w('due','BR','2026-11-01')];
 const cp={windows:{done:{complete:true},part:{nextPage:2,totalPages:8},
   sleep:{nextPage:0,retryAfter:'2026-11-09T12:00:00Z',lastErrorCode:'OSIRION_EMPTY_FIRST_PAGE'},
   due:{nextPage:4,retryAfter:'2026-11-06T12:00:00Z'},archived:{complete:false,nextPage:3}}};
 const original=JSON.stringify(cp),c=scanCoverage(wins,cp,now);
 assert.equal(c.total,5);assert.equal(c.completed,1);assert.equal(c.remaining,4);
 assert.equal(c.notStarted,1);assert.equal(c.partial,1);
 assert.equal(c.retryWaiting,1);assert.equal(c.retryDue,1);
 assert.equal(c.outsideScopeCheckpoints,1);assert.equal(c.samples[0].window,'due');
 assert.equal(c.byRegion.ME.completed,1);assert.equal(c.byYear['2026'].pending,2);
 assert.equal(JSON.stringify(cp),original,'report must not mutate saved data');
});
test('completed Unreal Cup without original Epic IDs remains pending',()=>{
 const win=w('unreal','NAW','2025-12-21','unreal-cup');
 assert.equal(classifyWindow(win,{complete:true,nextPage:3},now),'partial');
 assert.equal(classifyWindow(win,{complete:true,nextPage:3,epicIdsRetained:true},now),'completed');
});
test('empty scope has zero missing windows and duplicate identities are refused',()=>{
 const c=scanCoverage([],{windows:{}},now);assert.equal(c.remaining,0);assert.equal(c.total,0);
 const a=w('same','NAC','2026-11-07');
 assert.throws(()=>scanCoverage([a,a],{windows:{}},now),/Duplicate/);
});
