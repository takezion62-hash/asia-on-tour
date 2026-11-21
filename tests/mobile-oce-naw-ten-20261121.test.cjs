'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const V=require('../scripts/verified-mobile-oce-naw-ten-20261121.cjs');
const {apply}=require('../scripts/apply-mobile-oce-naw-ten-20261121.cjs');

test('2026 S39 NAW/OCE and S41 OCE mobile screenshots retain exact Epic IDs, rank, cash and VR evidence',()=>{
 assert.equal(V.validateProof(),true);
 const items=V.DOC.batch.entries;
 assert.equal(items.length,10);
 assert.equal(new Set(items.map(x=>x.id)).size,10);
 assert.equal(items.reduce((n,x)=>n+x.prize,0),2550);
 assert.equal(items.reduce((n,x)=>n+x.vrs,0),9);
 for(const x of items){
  assert.equal(V.epicId(x.profileUrl),x.epicUUID);
  const projected=V.project(x);
  assert.equal(projected.player,x.name);
  assert.equal(projected.kills,x.kills);
  assert.equal(projected.vrs,x.vrs);
  assert.equal(projected.prize,x.prize);
  assert.match(projected.note,/振込完了は未確認|受領\/振込完了は未確認/u);
 }
 const heats=items.filter(x=>x.stage==='juneHeat'||x.stage==='julyHeat');
 assert.equal(heats.length,3);
 assert.ok(heats.every(x=>x.rank>4),'cash-paying Heats must not be considered advanced');
 const mini=items.find(x=>x.stage==='juneMini');
 assert.equal(mini.prize,50*mini.vrs);
 assert.equal(mini.round,'Day 1 · Round 2 / 賞金決勝');
});

test('replay-safe publication dry-run preserves old records and validates zero / ten atomic additions',()=>{
 const r=apply({dryRun:true});
 assert.equal(r.mode,'dry-run');
 assert.equal(r.added+r.existing,10);
 assert.ok(r.added===0||r.added===10);
 assert.equal(r.prize,r.added===10?2550:0);
 assert.equal(r.vr,r.added===10?9:0);
});
