'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const V=require('../scripts/verified-mobile-naw-20261127.cjs');
test('Nov27 NAW ten locked mobile rows, original UUID, cash, match and stage totals',()=>{
 const rows=V.GOLD.map(V.project);
 assert.equal(rows.length,10);
 assert.equal(new Set(rows.map(r=>r.id)).size,10);
 assert.equal(rows.reduce((n,r)=>n+r.prize,0),2250);
 assert.equal(rows.filter(r=>r.player==='Reo').reduce((n,r)=>n+r.prize,0),2050);
 assert.equal(rows.filter(r=>r.player==='Grape').reduce((n,r)=>n+r.prize,0),100);
 assert.equal(rows.filter(r=>r.player==='あくりあ'||r.player==='hazerita_FNM').reduce((n,r)=>n+r.prize,0),100);
 assert.equal(rows.reduce((n,r)=>n+r.kills,0),189);
 assert.equal(rows.filter(r=>r.region==='NAW').length,10);
 assert.equal(rows.filter(r=>r.player==='Reo').length,7);
 assert.equal(new Set(rows.map(r=>r.source)).size,7);
 assert.equal(rows.reduce((n,r)=>n+r.vrs,0),12);
 assert.equal(rows.filter(r=>r.event==='Mobile Series Heats').length,2);
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
