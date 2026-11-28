'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const V=require('../scripts/verified-mobile-oce-20261129.cjs');
test('Nov29 ten OCE Mini Venture screenshot results retain exact evidence and five windows',()=>{
 const rows=V.GOLD.map(V.project);
 assert.equal(rows.length,10);assert.equal(new Set(rows.map(r=>r.id)).size,10);
 assert.equal(new Set(rows.map(r=>r.source)).size,5);
 for(const [key,total] of Object.entries({prize:700,kills:195,matches:47,vrs:14,points:1400}))assert.equal(rows.reduce((n,r)=>n+r[key],0),total,key);
 assert.equal(rows.filter(r=>r.player==='Reo').reduce((n,r)=>n+r.prize,0),350);
 assert.equal(rows.filter(r=>r.player==='MMC KAAN BABA').reduce((n,r)=>n+r.prize,0),150);
 assert.equal(rows.filter(r=>r.player==='gurabon').reduce((n,r)=>n+r.prize,0),100);
 assert.ok(rows.every(r=>r.region==='OCE'&&r.tournamentId==='ch7s4-mobile-reload-mini-venture-victory-cup'));
 for(const x of V.GOLD){
  const r=V.project(x),a=V.approval(x);
  assert.equal(V.uuid(r.profileUrl),V.profiles[r.player][1]);assert.ok(V.awardValid(x));assert.ok(V.verifyRow(r,a));
  for(const patch of [{rank:r.rank+1},{prize:r.prize+50},{kills:r.kills+1},{player:'different'},{date:'2026-01-01'},{source:r.source+'_mg'}])assert.equal(V.verifyRow({...r,...patch},a),false);
 }
});
