'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const V=require('../scripts/verified-mobile-eu-nac-20261126.cjs');
test('nine exact screenshot rows with preserved original UUID and award totals',()=>{
 assert.equal(V.GOLD.length,9);
 const rows=V.GOLD.map(V.project);
 assert.equal(rows.reduce((a,r)=>a+r.prize,0),4350);
 assert.equal(rows.filter(r=>r.player==='Reo').reduce((a,r)=>a+r.prize,0),3600);
 assert.equal(new Set(rows.map(r=>r.id)).size,9);
 assert.equal(rows.find(r=>r.player==='gurabon').playerRaw,V.profiles.gurabon[0]);
 assert.equal(rows.find(r=>r.player==='hazerita_FNM').rank,32);
 assert.ok(!rows.some(r=>r.date==='2026-02-20'||r.id.endsWith('2078')));
 for(const x of V.GOLD){
  const r=V.project(x),a=V.approval(x);
  assert.equal(V.uuid(r.profileUrl),V.profiles[r.player][1]);
  assert.equal(V.verifyRow(r,a),true);
  for(const patch of [{rank:r.rank+1},{prize:r.prize+50},{player:'someone else'},{profileUrl:'https://example.com'},{kills:r.kills+1}]){
   assert.equal(V.verifyRow({...r,...patch},a),false);
  }
 }
});
