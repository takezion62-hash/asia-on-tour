'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const V=require('../scripts/verified-existing-22-20261121.cjs');
const {apply}=require('../scripts/reconcile-existing-22-20261121.cjs');
test('22 exact PlayStation/Nvidia official Epic candidates are already represented by published results',()=>{
 assert.equal(V.validateProof(),true);
 assert.equal(V.DOC.batch.records.length,22);
 assert.equal(new Set(V.DOC.batch.records.map(x=>x.candidate.id)).size,22);
 assert.equal(new Set(V.DOC.batch.records.map(x=>x.existing.id)).size,22);
 for(const item of V.DOC.batch.records){
  assert.ok(V.matchCandidate(item.candidate,item));
  assert.ok(V.matchPublished(item.existing,item));
  assert.equal(item.candidate.kind,'参加確認');
  assert.equal(item.existing.kind,'賞金決勝');
  assert.equal(item.candidate.prize,null);
  assert.ok(item.existing.prize>=0);
  assert.equal(item.candidate.rank,item.existing.rank);
  assert.equal(item.candidate.points,item.existing.points);
  assert.equal(item.candidate.kills,item.existing.kills);
  assert.equal(item.candidate.vrs,item.existing.vrs);
 }
});
test('exact duplicates never add cash or results and are handled idempotently',()=>{
 const result=apply({dryRun:true});
 assert.equal(result.mode,'dry-run');
 assert.equal(result.addedResults,0);
 assert.equal(result.addedCash,0);
 assert.equal(result.reconciled+result.alreadyReconciled,22);
});
test('source window mismatch and cash modification are not accepted',()=>{
 const sample=V.DOC.batch.records[0];
 assert.equal(V.parseSources(sample.candidate,sample.existing),true);
 assert.equal(V.matchPublished({...sample.existing,prize:sample.existing.prize+100},sample),false);
 assert.equal(V.parseSources({...sample.candidate,source:sample.candidate.source.replace('Final','Qualifier')},sample.existing),false);
});
