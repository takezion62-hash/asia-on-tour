'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const V=require('../scripts/verified-mobile-nac-naw-20261127.cjs');
test('Nov27 ten locked mobile rows, original UUID, cash, match and stage totals',()=>{
 const rows=V.GOLD.map(V.project);
 assert.equal(rows.length,10);
 assert.equal(new Set(rows.map(r=>r.id)).size,10);
 assert.equal(rows.reduce((n,r)=>n+r.prize,0),3050);
 assert.equal(rows.filter(r=>r.player==='Reo').reduce((n,r)=>n+r.prize,0),2900);
 assert.equal(rows.filter(r=>r.player==='gurabon').reduce((n,r)=>n+r.prize,0),150);
 assert.equal(rows.reduce((n,r)=>n+r.vrs,0),9);
 assert.equal(rows.filter(r=>r.event==='Mobile Series Heats').length,3);
 for(const x of V.GOLD){
  const r=V.project(x),a=V.approval(x);
  assert.equal(V.uuid(r.profileUrl),V.profiles[r.player][1]);
  assert.equal(V.awardValid(x),true);
  assert.equal(V.verifyRow(r,a),true);
  for(const patch of [{rank:r.rank+1},{prize:r.prize+50},{kills:r.kills+1},{player:'someone else'},{date:'2026-01-01'},{source:'https://example.com'}])
   assert.equal(V.verifyRow({...r,...patch},a),false);
  assert.equal(V.verifyRow(r,{...a,recordHash:'fake'}),false);
 }
});
