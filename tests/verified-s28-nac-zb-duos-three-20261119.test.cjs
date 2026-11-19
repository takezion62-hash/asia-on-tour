'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const ROOT=path.resolve(__dirname,'..'),read=p=>JSON.parse(fs.readFileSync(path.join(ROOT,p),'utf8'));
const V=require('../scripts/verified-s28-nac-zb-duos-three-20261119.cjs');
const {apply}=require('../scripts/apply-s28-nac-zb-duos-three-20261119.cjs');
const {readResults}=require('../scripts/source-results-store.cjs');
test('three screenshot-based NAC ZB Duo finals preserve exact date/window, rank, kills and cash',()=>{
 assert.equal(V.validateProof(),true);
 const rows=V.DOC.batch.entries;
 assert.deepEqual(rows.map(x=>x.date),['2024-02-10','2024-02-10','2024-01-22']);
 assert.deepEqual(rows.map(x=>x.rank),[25,67,81]);
 assert.deepEqual(rows.map(x=>x.kills),[19,10,9]);
 assert.deepEqual(rows.map(x=>x.points),[100,100,100]);
 assert.deepEqual(rows.map(x=>x.matches),[3,3,3]);
 assert.deepEqual(rows.map(x=>x.vrs),[1,1,1]);
 assert.deepEqual(rows.map(x=>x.prize),[200,200,200]);
 assert.deepEqual(rows.map(x=>x.prizePerPlayer),[100,100,100]);
 assert.deepEqual(rows.map(x=>x.screenshot),[1936,1937,1938]);
 assert.deepEqual(rows.map(x=>x.windowId),[7,7,6].map(n=>
  'S28_DuosZBVictoryCashCup_Event'+n+'Round2_NAC'));
 assert.equal(new Set(rows.map(x=>x.id)).size,3);
 assert.equal(rows.reduce((total,x)=>total+x.prize,0),600);
});
test('both players keep their pinned Epic UUIDs and canonical identity',()=>{
 const rows=V.DOC.batch.entries;
 assert.deepEqual(rows.map(x=>x.playerNames),[
  ['こいる','sena'],['たまふぃっしー2号だよーん','モバイル勢のまかろん'],
  ['ろる','モバイル勢のまかろん']
 ]);
 assert.deepEqual(rows.map(x=>x.playerRaw),[
  'こいる / sena','たまふぃっしー2号だよーん / モバイル勢のまかろん',
  'TsV ろるねぎ / モバイル勢のまかろん'
 ]);
 assert.deepEqual(rows.map(x=>x.profileUrls.map(V.uuid)),V.PINNED.map(p=>p[10]));
 assert.equal(new Set(rows.flatMap(x=>x.profileUrls.map(V.uuid))).size,5);
});
test('each registered team cash $200 means exactly $100 per person',()=>{
 for(const x of V.DOC.batch.entries){
  const r=V.project(x);
  assert.equal(r.kind,'賞金決勝');
  assert.equal(r.event,'Zero Build Duos Victory Cup');
  assert.equal(r.tournamentId,V.TOURNAMENT);
  assert.equal(r.region,'NAC');assert.equal(r.seasonId,'S28');
  assert.equal(r.prize,200);assert.equal(r.teamPrize,200);
  assert.equal(r.prizePerPlayer,100);
  assert.equal(r.vrs,1);assert.equal(r.kills,x.kills);
  assert.equal(r.points,100);assert.equal(r.matches,3);
  assert.equal(r.players.length,2);assert.equal(r.profiles.length,2);
  assert.equal(r.prizePerPlayer*r.players.length,r.teamPrize);
 }
});
test('approval audit rejects changed rank, team, UUID, kills, payout, round or source',()=>{
 for(const x of V.DOC.batch.entries){
  const row=V.project(x),a=V.approval(x);
  assert.equal(V.verifyRow(row,a),true);
  const variants=[
   ['rank',row.rank+1],['kills',row.kills+1],['points',0],['matches',1],
   ['vrs',0],['prize',100],['teamPrize',100],['prizePerPlayer',200],
   ['player','another'],['players',row.players.slice(0,1)],
   ['source','https://example.com/scoreboard'],['profiles',[]],
   ['round','Event 1 · Round 2 / 賞金決勝'],['note','unverified']
  ];
  for(const [key,v] of variants){
   assert.equal(V.verifyRow({...row,[key]:v},a),false,x.id+' '+key);
  }
  assert.equal(V.verifyRow(row,{...a,recordHash:'tampered'}),false);
 }
});
test('original user identities and previous historical S28 records remain intact',()=>{
 const players=read('players.json'),results=readResults(ROOT).rows;
 for(const name of ['こいる','sena','モバイル勢のまかろん'])
  assert.ok(players.candidates.some(p=>p.name===name));
 assert.ok(players.confirmedAliases['モバイル勢のまかろん'].includes('BRN 916GonLuck'));
 assert.equal(new Set(results.map(x=>x.id)).size,results.length);
 const ids=new Set(V.DOC.batch.entries.map(x=>x.id));
 const published=results.filter(x=>ids.has(x.id));
 assert.ok(published.length===0||published.length===3,'no partial snapshot');
 for(const r of published){
  const ledger=read('approval-history.json').entries.filter(a=>a.recordId===r.id);
  assert.equal(ledger.length,1);assert.equal(V.verifyRow(r,ledger[0]),true);
 }
});
test('dry-run does not mutate original results, player registry, ledger or update notices',()=>{
 const targets=['source-results/manifest.json','source-results/S28.json','players.json','approval-history.json','updates.json'];
 const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT,file))).digest('hex');
 const before=targets.map(sha);
 const status=apply({dryRun:true});
 assert.ok(status.added===0||status.added===3);
 assert.equal(status.added+status.alreadyPublished,3);
 assert.equal(status.addedCash,status.added?600:0);
 assert.deepEqual(status.newPlayers,status.added?['たまふぃっしー2号だよーん','ろる']:[]);
 assert.deepEqual(targets.map(sha),before);
});
