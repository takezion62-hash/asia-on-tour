'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const ROOT=path.resolve(__dirname,'..');
const read=f=>JSON.parse(fs.readFileSync(path.join(ROOT,f),'utf8'));
const {readResults}=require('../scripts/source-results-store.cjs');
const V=require('../scripts/verified-s28-nac-zb-duos-three-20261119.cjs');
const {apply}=require('../scripts/apply-s28-nac-zb-duos-three-20261119.cjs');
test('three screenshot-verified NAC finals preserve exact ranking, kills and prizes',()=>{
 assert.equal(V.validateProof(),true);
 const x=V.DOC.batch.entries;
 assert.deepEqual(x.map(t=>t.date),['2024-02-10','2024-02-10','2024-01-22']);
 assert.deepEqual(x.map(t=>t.rank),[25,67,81]);
 assert.deepEqual(x.map(t=>t.kills),[19,10,9]);
 assert.deepEqual(x.map(t=>t.matches),[3,3,3]);
 assert.deepEqual(x.map(t=>t.points),[100,100,100]);
 assert.deepEqual(x.map(t=>t.vrs),[1,1,1]);
 assert.deepEqual(x.map(t=>t.prize),[200,200,200]);
 assert.deepEqual(x.map(t=>t.prizePerPlayer),[100,100,100]);
 assert.deepEqual(x.map(t=>t.screenshot),[1936,1937,1938]);
 assert.equal(x.reduce((n,a)=>n+a.prize,0),600);
});
test('exact profiles, original named identity and event round are linked',()=>{
 const x=V.DOC.batch.entries;
 assert.deepEqual(x.map(t=>t.playerNames),[
  ['こいる','sena'],
  ['たまふぃっしー2号だよーん','モバイル勢のまかろん'],
  ['ろる','モバイル勢のまかろん']]);
 assert.deepEqual(x.map(t=>t.rawNames),[
  ['こいる','sena'],
  ['たまふぃっしー2号だよーん','モバイル勢のまかろん'],
  ['TsV ろるねぎ','モバイル勢のまかろん']]);
 assert.deepEqual(x.map(t=>t.windowId),[7,7,6].map(n=>V.windowId(n)));
 for(let i=0;i<x.length;i++){
  assert.deepEqual(x[i].profileUrls.map(V.uuid),V.TUPLES[i][8]);
  assert.equal(x[i].source,V.sourceUrl(V.TUPLES[i][0]));
 }
});
test('the exact verified results preserve $200 per team and $100 per player',()=>{
 for(const x of V.DOC.batch.entries){
  const r=V.project(x),a=V.approval(x);
  assert.equal(r.kind,'賞金決勝');
  assert.equal(r.teamPrize,200);
  assert.equal(r.prize,200);
  assert.equal(r.prizePerPlayer,100);
  assert.equal(r.players.length,2);
  assert.equal(r.vrs,1);
  assert.equal(r.points,100);
  assert.equal(r.kills,x.kills);
  assert.equal(r.rank,x.rank);
  assert.equal(r.tournamentId,V.TOURNAMENT);
  assert.ok(r.round.includes('Round 2 / 賞金決勝'));
  assert.equal(V.verifyRow(r,a),true);
  for(const [key,next] of [['rank',x.rank+1],['kills',x.kills+1],['matches',2],
   ['vrs',0],['points',0],['prize',100],['teamPrize',100],
   ['prizePerPlayer',200],['player','someone else'],['source','https://example.net'],
   ['profiles',[]],['players',[]],['round','Event 5 · Round 2 / 賞金決勝']]){
   assert.equal(V.verifyRow({...r,[key]:next},a),false,key);
  }
  assert.equal(V.verifyRow(r,{...a,recordHash:'bad'}),false);
 }
});
test('existing canonical roster and earlier results are never replaced',()=>{
 const players=read('players.json'),rows=readResults(ROOT).rows;
 for(const name of ['こいる','sena','モバイル勢のまかろん'])
  assert.ok(players.candidates.some(p=>p.name===name));
 assert.ok(players.confirmedAliases['モバイル勢のまかろん'].includes('BRN 916GonLuck'));
 assert.equal(new Set(rows.map(r=>r.id)).size,rows.length);
 const targetIds=new Set(V.DOC.batch.entries.map(x=>x.id));
 const present=rows.filter(r=>targetIds.has(r.id));
 assert.ok(present.length===0||present.length===3);
 for(const row of present){
  const entries=read('approval-history.json').entries.filter(x=>x.recordId===row.id);
  assert.equal(entries.length,1);
  assert.equal(V.verifyRow(row,entries[0]),true);
 }
});
test('dry-run is repeatable, does not mutate source shards, player list, awards or approval ledger',()=>{
 const paths=['source-results/manifest.json','source-results/S28.json',
  'players.json','approval-history.json','updates.json'];
 const hash=f=>crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT,f))).digest('hex');
 const before=paths.map(hash);
 const result=apply({dryRun:true});
 assert.ok(result.added===0||result.added===3);
 assert.equal(result.added+result.alreadyPublished,3);
 assert.equal(result.addedCash,result.added?600:0);
 assert.deepEqual(result.newPlayers,result.added?['たまふぃっしー2号だよーん','ろる']:[]);
 assert.deepEqual(result.newAliases,result.added?[{name:'ろる',raw:'TsV ろるねぎ'}]:[]);
 assert.deepEqual(paths.map(hash),before);
});
