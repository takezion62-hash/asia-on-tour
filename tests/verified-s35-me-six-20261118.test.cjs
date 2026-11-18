'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),root=path.resolve(__dirname,'..');
const read=n=>JSON.parse(fs.readFileSync(path.join(root,n),'utf8'));
const {readResults}=require('../scripts/source-results-store.cjs');
const proof=require('../scripts/verified-s35-me-six-20261118.cjs');
test('exact six originally observed S35 ME Round1 player pairs and rules',()=>{
 assert.equal(proof.validate(),true);assert.equal(proof.manifest.rows.length,6);
 const rows=readResults(root).rows,ledgers=read('approval-history.json').entries;
 for(const o of proof.manifest.rows){
  const r=rows.find(x=>x.id===o.id),entry=ledgers.find(x=>x.id===o.id);
  assert.ok(r&&entry,o.id);assert.equal(proof.verifyRow(r,entry),true);
  assert.equal(r.prize,0);assert.equal(r.rank,o.rank);
  assert.equal(r.kind,o.rank<=250?'予選':'参加確認');
  assert.equal(proof.verifyRow({...r,rank:r.rank+1},entry),false);
  assert.equal(proof.verifyRow({...r,kills:r.kills+1},entry),false);
  assert.equal(proof.verifyRow({...r,prize:100},entry),false);
  assert.equal(proof.verifyRow({...r,players:[...r.players].reverse()},entry),false);
 }
 assert.equal(rows.filter(x=>proof.manifest.rows.some(a=>a.id===x.id)).length,6);
});
test('one top250 duo qualified, no cash or duplicate remains',()=>{
 const rows=readResults(root).rows.filter(x=>proof.manifest.rows.some(y=>y.id===x.id));
 assert.deepEqual(rows.filter(x=>x.kind==='予選').map(x=>x.player),['kaf / Rura']);
 assert.equal(rows.reduce((n,x)=>n+x.prize,0),0);
 const pending=read('history-sync-review.json').proposals;
 for(const r of rows)assert.ok(!pending.some(x=>x.id===r.id));
});
