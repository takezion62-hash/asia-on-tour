'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const V=require('../scripts/verified-s30-clean-partial-38-20261121.cjs');
const {apply}=require('../scripts/publish-s30-clean-partial-38-20261121.cjs');
test('38 independent original Epic ID rows are locked to 5 official S30 ZB sessions',()=>{
 assert.equal(V.validateProof(),true);
 const e=V.DOC.batch.entries;
 assert.equal(e.length,38);
 assert.equal(new Set(e.map(x=>x.source.id)).size,38);
 assert.equal(new Set(e.map(x=>x.source.source)).size,5);
 assert.equal(e.filter(x=>x.expected.kind==='予選').length,35);
 assert.equal(e.filter(x=>x.expected.kind==='賞金決勝').length,3);
 assert.equal(e.filter(x=>x.expected.qualification==='advanced').length,29);
 assert.equal(e.reduce((n,x)=>n+x.expected.prize,0),300);
 for(const item of e){
  const s=item.source,r=V.project(item,'15/100'),a=V.approval(item,r);
  assert.ok(V.verifyRow(r,a),s.id);
  assert.equal(r.rank,s.rank);
  assert.equal(r.points,s.points);
  assert.equal(r.kills,s.kills);
  assert.equal(r.vrs,s.vrs);
  assert.equal(r.playerRaw,s.playerRaw);
  assert.equal(r.source,s.source);
  assert.equal(r.prize,item.expected.prize);
  assert.ok(!('reviewReason' in r));
 }
});
test('S30 finalist has $100 per real VR; an R1 VR never yields cash',()=>{
 const e=V.DOC.batch.entries;
 const finals=e.filter(x=>x.expected.kind==='賞金決勝');
 assert.equal(finals.length,3);
 assert.ok(finals.every(x=>x.source.region==='OCE'&&x.source.vrs===1&&
   x.expected.prize===100&&x.source.prize===null));
 const qualifiers=e.filter(x=>x.expected.kind==='予選');
 assert.ok(qualifiers.every(x=>x.expected.prize===0));
 assert.ok(qualifiers.some(x=>x.source.vrs===1));
 for(const q of qualifiers){
  const cutoff=V.CUTOFF[q.source.region];
  assert.equal(q.expected.qualification,q.source.rank<=cutoff?'advanced':'not-advanced');
 }
});
test('publication with mature clean source prefix is idempotent and keeps any unsafe rows pending',()=>{
 const x=apply({dryRun:true});
 assert.equal(x.mode,'dry-run');
 assert.equal(x.added+x.already+x.held.length,38);
 assert.equal(x.qualifiers+x.finals,x.added);
 assert.ok(x.addedCash>=0&&x.addedCash<=300);
 assert.ok(x.advanced<=29);
 assert.equal(x.remaining>=0,true);
});
