'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {readResults}=require('../scripts/source-results-store.cjs');
const proof=require('../scripts/verified-tracker-eight-20261117.cjs');
const catalog=require('../tournaments.json').catalog;
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=x=>JSON.parse(fs.readFileSync(path.join(root,x),'utf8'));
const roster=x=>x.players||[x.player];
test('Nov17 screenshot batch is exactly six new duos + two existing solo award promotions',()=>{
 assert.equal(proof.verifyProof(proof.proof),true);
 assert.equal(proof.proof.newResults.length,6);
 assert.equal(proof.proof.corrections.length,2);
 assert.equal(proof.proof.newResults.reduce((n,x)=>n+x.teamUSD,0),1100);
 assert.equal(proof.proof.corrections.reduce((n,x)=>n+x.prizeUSD,0),100);
 for(const s of proof.proof.newResults){
  assert.equal(s.players.length,2);
  assert.equal(s.teamUSD/2,s.eachUSD);
  assert.equal(new Set(s.players.map(p=>proof.profileId(p))).size,2);
 }
});
test('published six exact Tracker finals survive tampered kills, cash, identities, windows and source URLs',()=>{
 const results=readResults(root).rows,ledger=read('approval-history.json').entries;
 for(const s of proof.proof.newResults){
  const actual=results.find(x=>x.id===s.id),entry=ledger.find(x=>x.id===s.id);
  assert.ok(actual&&entry,s.id);
  assert.equal(proof.verifyNewRow(actual,entry),true,s.id);
  assert.deepEqual(actual,proof.expectedNew(s,catalog.find(x=>x.id===s.tournamentId)));
  for(const [field,value] of [
   ['points',actual.points+1],['kills',actual.kills+1],['rank',actual.rank+1],
   ['vrs',actual.vrs+1],['prize',actual.prize+100],
   ['prizePerPlayer',actual.prizePerPlayer+50],['source','https://example.org']
  ])assert.equal(proof.verifyNewRow({...actual,[field]:value},entry),false,s.id+' / '+field);
  assert.equal(proof.verifyNewRow({...actual,players:[...actual.players].reverse()},entry),false);
 }
});
test('two S41 NAC solo 76-100th are $50, preserving original attendance-only ledger and scores',()=>{
 const results=readResults(root).rows,ledger=read('approval-history.json').entries;
 const history=read(proof.HISTORY);
 assert.equal(history.entries.length,2);
 for(const s of proof.proof.corrections){
  const actual=results.find(x=>x.id===s.id),entry=ledger.find(x=>x.id===s.id);
  assert.ok(actual&&entry);
  assert.equal(entry.policy,'attendance-only');
  assert.equal(actual.prize,50);
  assert.equal(actual.kind,'賞金決勝');
  assert.equal(actual.rank,s.rank);
  assert.equal(actual.kills,s.kills);
  assert.equal(actual.vrs,0);
  assert.equal(proof.verifyS41Promotion(actual,entry),true);
  assert.equal(proof.verifyS41Promotion({...actual,prize:100},entry),false);
  assert.equal(proof.verifyS41Promotion({...actual,rank:actual.rank+1},entry),false);
  assert.equal(proof.verifyS41Promotion({...actual,player:'different'},entry),false);
 }
});
test('existing Minipiyo/ちからV2 NAW Unreal rank213 remains singular',()=>{
 const rows=readResults(root).rows.filter(x=>x.date==='2025-12-21'&&
   x.region==='NAW'&&x.tournamentId==='ch7s1-one-million-unreal-cup'&&
   x.rank===213&&roster(x).includes('Minipiyo')&&roster(x).includes('ちからV2'));
 assert.equal(rows.length,1);
 assert.equal(rows[0].prize,100);
});
