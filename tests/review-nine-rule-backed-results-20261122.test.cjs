'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const V=require('../scripts/verified-nine-rule-backed-results-20261122.cjs');
const {apply}=require('../scripts/publish-nine-rule-backed-results-20261122.cjs');
test('all nine Epic account/result identities have source-locked prizes and actual rounds',()=>{
 assert.equal(V.validateProof(),true);
 const e=V.DOC.batch.entries;
 assert.equal(e.length,9);
 assert.equal(new Set(e.map(x=>x.source.id)).size,9);
 assert.equal(new Set(e.map(x=>x.source.source)).size,6);
 assert.equal(e.filter(x=>x.decision.kind==='予選').length,6);
 assert.equal(e.filter(x=>x.decision.stage==='weekly-final').length,1);
 assert.equal(e.filter(x=>x.decision.stage==='single-round-cash').length,2);
 assert.equal(e.filter(x=>x.decision.advance===true).length,4);
 assert.equal(e.reduce((n,x)=>n+x.decision.prize,0),0);
 for(const item of e){
  const row=V.project(item,'2/100'),ap=V.approval(item,row);
  assert.ok(V.verifyRow(row,ap),item.source.id);
  assert.equal(row.id,item.source.id);
  assert.equal(row.rank,item.source.rank);
  assert.equal(row.points,item.source.points);
  assert.equal(row.kills,item.source.kills);
  assert.equal(row.vrs,item.source.vrs);
  assert.equal(row.prize,0);
  assert.equal(row.round,item.decision.round);
  assert.equal(row.kind,item.decision.kind);
  assert.ok(!('reviewOnly' in row));
  assert.ok(!('reviewReason' in row));
 }
});
test('2024 OCE and NAC Zero Build Round1, PS ME Qualifier1 advance only at official cutoffs',()=>{
 const e=V.DOC.batch.entries;
 const zb=e.filter(x=>x.source.tournamentId==='ch5s3-zb-solo-victory');
 assert.equal(zb.length,5);
 assert.equal(zb.filter(x=>x.decision.advance).length,4);
 assert.equal(zb.filter(x=>!x.decision.advance).length,1);
 assert.ok(zb.every(x=>x.decision.stage==='qualifier'&&x.decision.prize===0));
 assert.ok(zb.some(x=>x.source.vrs===1&&x.decision.prize===0));
 const ps=e.find(x=>x.source.tournamentId==='ch5s3-playstation-cup-br');
 assert.equal(ps.source.rank,285);
 assert.equal(ps.decision.cutoff,50);
 assert.equal(ps.decision.advance,false);
});
test('2025 NVIDIA single-round and 2026 FNCS Week 3 Final remain prize-free without claiming Grand Final',()=>{
 const e=V.DOC.batch.entries;
 const nv=e.filter(x=>x.decision.stage==='single-round-cash');
 assert.equal(nv.length,2);
 assert.ok(nv.every(x=>x.source.rank>40&&x.decision.prize===0));
 const fncs=e.find(x=>x.decision.stage==='weekly-final');
 assert.equal(fncs.source.rank,45);
 assert.deepEqual(fncs.source.players,['LBworks','Jaemon']);
 assert.equal(fncs.decision.prize,0);
 assert.match(fncs.decision.round,/Week 3 Final/);
 assert.doesNotMatch(V.project(fncs,'1/1').round,/Grand Final/i);
});
test('safe publisher dry run makes no award or source changes and holds unverified pages',()=>{
 const x=apply({dryRun:true});
 assert.equal(x.mode,'dry-run');
 assert.equal(x.selected,9);
 assert.equal(x.added+x.existing+x.held.length,9);
 assert.equal(x.addedPrizeUSD,0);
 assert.equal(x.qualifiers+x.finals,x.added);
 assert.ok(x.advanced<=4);
});
