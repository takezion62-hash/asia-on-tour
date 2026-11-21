'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const path=require('node:path');
const ROOT=path.resolve(__dirname,'..');
const V=require('../scripts/verified-mobile-extra-ten-20261121.cjs');
const {apply}=require('../scripts/apply-mobile-extra-ten-20261121.cjs');
const {readResults}=require('../scripts/source-results-store.cjs');
const {loadData,tournamentKey}=require('../scripts/data-checks.cjs');

test('ten mobile screenshot receipts preserve exact values, official event IDs and player UUIDs',()=>{
 assert.equal(V.validateProof(),true);
 const b=V.DOC.batch.entries;
 assert.equal(b.length,10);
 assert.equal(new Set(b.map(x=>x.id)).size,10);
 assert.equal(b.reduce((s,r)=>s+r.prize,0),3750);
 assert.equal(b.reduce((s,r)=>s+r.vrs,0),10);
 assert.deepEqual(V.DOC.expected.newPlayers,['klutzfnm']);
 for(const x of b){
  assert.equal(V.epicId(x.profileUrl),x.epicUUID);
  const r=V.project(x);
  assert.equal(r.player,x.name);
  assert.equal(r.prize,x.prize);
  assert.equal(r.kills,x.kills);
  assert.equal(r.vrs,x.vrs);
  assert.equal(r.round,x.round);
  assert.match(r.note,/振込完了は未確認/);
 }
 const paid= b.filter(x=>x.stage==='octMe');
 assert.equal(paid.length,2);
 assert.ok(paid.every(x=>x.prize===x.vrs*50));
 const aug=b.find(x=>x.stage==='augMe');
 assert.equal(aug.rank,1);
 assert.equal(aug.prize,1200);
 assert.equal(aug.vrs,0);
});

test('February OCE adds to the existing published qualifier session instead of splitting it',()=>{
 const rows=readResults(ROOT).rows;
 const prior=rows.find(x=>x.id==='owner-s39-oce-oceFeb-20260222-r1');
 assert.ok(prior,'previous 2026-02-22 OCE qualifier was published');
 const incoming=V.project(V.DOC.batch.entries.find(x=>x.stage==='febOce'));
 const data=loadData(ROOT).data;
 assert.equal(tournamentKey(prior,data),tournamentKey(incoming,data));
 assert.equal(prior.date,incoming.date);
 assert.equal(prior.region,incoming.region);
 assert.equal(prior.round,incoming.round);
 assert.equal(prior.kind,incoming.kind);
 assert.equal(prior.source,incoming.source);
});

test('mobile publisher is idempotent, atomic and does not mutate prior records in dry-run',()=>{
 const r=apply({dryRun:true});
 assert.equal(r.mode,'dry-run');
 assert.equal(r.added+r.existing,10);
 assert.ok(r.added===0||r.added===10);
 assert.equal(r.prize,r.added?3750:0);
 assert.equal(r.vr,r.added?10:0);
});
