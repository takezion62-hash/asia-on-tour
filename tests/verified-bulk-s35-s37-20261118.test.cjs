'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),load=x=>JSON.parse(fs.readFileSync(path.join(root,x),'utf8'));
const {readResults}=require('../scripts/source-results-store.cjs');
const {audit}=require('../scripts/validate-approvals.cjs');
const source=require('../scripts/verified-bulk-s35-s37-20261118.cjs');
test('S35/S37 38 source-locked candidates have exact 19 qualifiers / 18 zero-VR / 1 winner',()=>{
 assert.equal(source.validateManifest(),true);
 const xs=source.manifest.rows;
 assert.equal(xs.length,38);
 assert.equal(xs.filter(x=>x.kind==='予選').length,19);
 assert.equal(xs.filter(x=>x.kind==='賞金決勝'&&x.vrs===0).length,18);
 assert.equal(xs.filter(x=>x.kind==='賞金決勝'&&x.vrs===1).length,1);
 assert.equal(xs.filter(x=>x.kind==='予選'&&x.rank>250).length,2);
});
test('all 38 records are published, no duplicate UUID/source identity and audit never guesses cash',()=>{
 const rows=readResults(root).rows,ledger=load('approval-history.json'),players=load('players.json');
 const filtered=ledger.entries.filter(x=>x.policy===source.POLICY);
 assert.equal(filtered.length,38);
 assert.equal(new Set(filtered.map(x=>x.id)).size,38);
 let total=0;
 for(const p of source.manifest.rows){
  const r=rows.find(x=>x.id===p.id),entry=filtered.find(x=>x.id===p.id);
  assert.ok(r&&entry,p.id);
  assert.equal(source.verifyPublished(r,entry),true);
  assert.deepEqual(r,source.scoreRecord(p,load('tournament-rules.json'),load('tournaments.json')));
  for(const [name,v] of [['rank',r.rank+1],['kills',r.kills+1],['prize',r.prize+100],
   ['points',r.points+1],['source','https://example.com'],['vrs',r.vrs+1]]){
   assert.equal(source.verifyPublished({...r,[name]:v},entry),false,p.id+' '+name);
  }
  total+=r.prize||0;
 }
 assert.equal(total,200);
 assert.equal(audit(rows,ledger,players).length,0);
});
test('all 38 candidates remain published and absent from current pending triage',()=>{
 const pending=load('history-sync-review.json').proposals;
 assert.equal(pending.filter(x=>source.manifest.rows.some(y=>y.id===x.id)).length,0);
 const held=load('candidate-triage.json').queue;
 assert.equal(held.filter(x=>source.manifest.rows.some(y=>y.id===x.id)).length,0);
});
