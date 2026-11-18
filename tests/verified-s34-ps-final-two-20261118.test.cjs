'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const {readResults}=require('../scripts/source-results-store.cjs');
const proof=require('../scripts/verified-s34-ps-final-two-20261118.cjs');
test('S34 ME Finals original Epic account recheck has exactly two matched scores and zero API errors',()=>{
 assert.equal(proof.validateProof(),true);
 assert.equal(proof.proof.providerTotalPages,1);
 assert.equal(proof.proof.pageErrors,0);
 assert.equal(proof.proof.verified.length,2);
 assert.equal(proof.proof.held.length,0);
 assert.deepEqual(proof.proof.verified.map(x=>x.original.id),proof.IDS);
});
test('Both historic ME final attendance rows remain proof-locked, prize unknown and double-count free',()=>{
 const rows=readResults(root).rows,ledger=read('approval-history.json').entries;
 const reviewed=read('history-sync-reviewed.json').entries;
 for(const p of proof.proof.verified){
  const r=rows.find(x=>x.id===p.original.id),e=ledger.find(x=>x.id===p.original.id);
  assert.ok(r&&e,p.original.id);
  assert.equal(proof.verifyPublished(r,e),true,r.id);
  assert.deepEqual(r,proof.published(p,read('tournaments.json')));
  assert.equal(r.kind,'参加確認');assert.equal(r.prize,null);
  assert.equal(r.teamAccountIds,undefined);
  assert.equal(r.vrs,0);
  assert.equal(reviewed.filter(x=>x.id===r.id&&x.decision==='published').length,1);
  for(const [field,wrong] of [['rank',r.rank+1],['points',r.points+1],
   ['kills',r.kills+1],['matches',r.matches+1],['vrs',1],
   ['prize',0],['source','https://example.com'],
   ['player',r.player+' fake']]){
   assert.equal(proof.verifyPublished({...r,[field]:wrong},e),false,r.id+' '+field);
  }
 }
});
test('The last two candidates leave the review queue, cash total unchanged and update log complete',()=>{
 assert.equal(read('history-sync-review.json').proposals.length,0);
 const rows=readResults(root).rows.filter(x=>proof.IDS.includes(x.id));
 assert.equal(rows.length,2);
 assert.deepEqual(rows.map(x=>[x.player,x.rank,x.points,x.kills,x.vrs,x.matches]),[
  ['モバイル勢のまかろん',56,63,6,0,6],['くりたる',64,47,2,0,6]]);
 assert.ok(rows.every(x=>x.prize===null));
 assert.equal(read('updates.json').entries.find(x=>x.id==='verified-s34-me-playstation-two-20261118').recordIds.length,2);
});