'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const V=require('../scripts/verified-s30-zb-review-eleven-20261121.cjs');
const {apply}=require('../scripts/publish-s30-zb-review-eleven-20261121.cjs');
test('2024 S30 NA zero-build Victory Cup: Round1 qualifier and OCE Round2 award are distinct',()=>{
 assert.equal(V.validateProof(),true);
 const e=V.DOC.batch.entries;
 assert.equal(e.length,11);
 assert.equal(e.filter(x=>x.expected.kind==='予選').length,10);
 assert.equal(e.filter(x=>x.expected.kind==='賞金決勝').length,1);
 assert.equal(e.reduce((n,x)=>n+x.expected.prize,0),100);
 assert.equal(new Set(e.map(x=>x.source.id)).size,11);
 for(const item of e){
  const r=V.project(item),approval=V.approval(item);
  assert.ok(V.verifyRow(r,approval),item.source.id);
  assert.equal(r.rank,item.source.rank);
  assert.equal(r.kills,item.source.kills);
  assert.equal(r.vrs,item.source.vrs);
  assert.equal(r.playerRaw,item.source.playerRaw);
  assert.equal(r.source,item.source.source);
  assert.equal(r.verified,true);
 }
 const adv=e.filter(x=>x.expected.qualification==='advanced');
 assert.equal(adv.length,1);
 assert.equal(adv[0].source.rank,4639);
 assert.match(V.project(adv[0]).note,/上位5,000位以内/);
 assert.equal(e.filter(x=>x.expected.qualification==='not-advanced').length,9);
 const final=e.find(x=>x.expected.kind==='賞金決勝');
 assert.equal(final.source.region,'OCE');
 assert.equal(final.source.rank,33);
 assert.equal(final.source.vrs,1);
 assert.equal(V.project(final).prize,100);
});
test('source-verified eleven review candidates replay only once with all original data unchanged',()=>{
 const r=apply({dryRun:true});
 assert.equal(r.mode,'dry-run');
 assert.equal(r.added+r.already,11);
 assert.equal(r.qualifiers+r.finals,r.added);
 assert.ok(r.addedCash===0||r.addedCash===100);
 assert.ok(r.removedFromReview===0||r.removedFromReview===r.added);
});
