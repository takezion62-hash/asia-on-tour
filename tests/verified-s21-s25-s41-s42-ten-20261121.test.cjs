'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),
 fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const ROOT=path.resolve(__dirname,'..');
const V=require('../scripts/verified-s21-s25-s41-s42-ten-20261121.cjs');
const {apply}=require('../scripts/apply-s21-s25-s41-s42-ten-20261121.cjs');
const {readResults}=require('../scripts/source-results-store.cjs');
const read=f=>JSON.parse(fs.readFileSync(path.join(ROOT,f),'utf8'));
test('1970-1979 original player, exact rank, points, matches, eliminations and cash are locked',()=>{
 assert.equal(V.validateProof(),true);
 const x=V.DOC.batch.entries;
 assert.deepEqual(x.map(z=>z.screenshot),[1970,1971,1972,1973,1974,1975,1976,1977,1978,1979]);
 assert.deepEqual(x.map(z=>z.rank),[62,67,91,94,95,1,53,17,42,47]);
 assert.deepEqual(x.map(z=>z.points),[25,22,10,8,7,253,29,100,100,100]);
 assert.deepEqual(x.map(z=>z.matches),[5,3,6,6,6,6,6,6,5,6]);
 assert.deepEqual(x.map(z=>z.kills),[1,2,3,1,3,13,5,25,10,10]);
 assert.deepEqual(x.map(z=>z.vrs),[0,0,0,0,0,2,0,1,1,1]);
 assert.deepEqual(x.map(z=>z.prize),[200,200,0,0,0,1000,150,50,50,50]);
 assert.equal(x.reduce((a,y)=>a+y.prize,0),1700);
 assert.equal(x.reduce((a,y)=>a+y.vrs,0),5);
 assert.equal(new Set(x.map(z=>z.id)).size,10);
});
test('ten immutable Epic UUIDs, correct season and tournament window',()=>{
 const x=V.DOC.batch.entries,p=read('players.json');
 for(let i=0;i<x.length;i++){
  const [shot,s,rank,name,raw,id,pts,games,kills,vrs,cash]=V.GOLD[i];
  const z=x[i],m=V.META[s];
  assert.equal(z.id,V.makeId(s,m,rank));
  assert.equal(z.name,name);assert.equal(z.rawName,raw);
  assert.equal(z.epicUUID,id);assert.equal(V.epicId(z.profileUrl),id);
  assert.equal(z.windowId,m.windowId);assert.equal(z.tournamentId,m.tournamentId);
  assert.equal(z.round,s==='S42'?'Event 1 · Round 2 / 賞金決勝':cash?'Final / 賞金決勝':'Final / 決勝');
 }
 for(const name of ['KENTAch','KanA','モバイル勢のまかろん','Reo','れぼりゅーしょん'])
  assert.ok(p.candidates.some(z=>z.name===name),name);
 assert.ok(p.confirmedAliases['れぼりゅーしょん'].includes('YOTTAれぼりゅーしゅん'));
});
test('2022 OCE ranks 91, 94, 95 are recorded as noncash final attendance',()=>{
 for(const z of V.DOC.batch.entries.filter(x=>x.seasonId==='S21'&&x.rank>90)){
  const r=V.project(z);
  assert.equal(r.kind,'決勝');assert.equal(r.vrs,0);assert.equal(r.prize,0);
 }
 for(const z of V.DOC.batch.entries.filter(x=>x.seasonId==='S21'&&x.rank<=90)){
  const r=V.project(z);
  assert.equal(r.kind,'賞金決勝');assert.equal(r.prize,200);
 }
});
test('OCE Days of Play victory is paid by placement, EU Mobile mini venture by VR',()=>{
 const [d]=V.DOC.batch.entries.filter(x=>x.seasonId==='S41');
 assert.equal(d.rank,1);assert.equal(d.prize,1000);assert.equal(d.vrs,2);
 const t=read('tournaments.json').catalog,rules=read('tournament-rules.json').rules;
 assert.equal(t.find(z=>z.id===d.tournamentId).mode,'zero-build');
 assert.ok(t.find(z=>z.id===d.tournamentId).evidence.some(z=>z.url===V.META.S41.rule));
 for(const z of V.DOC.batch.entries.filter(x=>x.seasonId==='S42')){
  assert.equal(z.vrs,1);assert.equal(z.prize,50);
  assert.equal(V.project(z).prizePerPlayer,50);
  assert.equal(t.find(y=>y.id===z.tournamentId).mode,'reload-zero-build');
 }
});
test('source and payout tampering cannot pass approvals',()=>{
 for(const z of V.DOC.batch.entries){
  const r=V.project(z),a=V.approval(z);
  assert.equal(V.verifyRow(r,a),true);
  for(const [key,val] of [['prize',r.prize+1],['rank',r.rank+1],['vrs',r.vrs+1],
   ['points',r.points+1],['kills',r.kills+1],['matches',r.matches+1],
   ['round','wrong'],['source','https://example.org/'],['profileUrl','https://example.org/']]){
   assert.equal(V.verifyRow({...r,[key]:val},a),false,key+' '+r.id);
  }
  assert.equal(V.verifyRow(r,{...a,recordHash:'tampered'}),false);
 }
});
test('historical publisher is replay safe, all or none and dry run never writes data',()=>{
 const files=['source-results/manifest.json','source-results/S21.json','source-results/S25.json',
  'source-results/S41.json','source-results/S42.json','players.json','approval-history.json','updates.json'];
 const checksum=f=>{const p=path.join(ROOT,f);return fs.existsSync(p)?
  crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'):null};
 const before=files.map(checksum);
 const result=apply({dryRun:true});
 assert.equal(result.added+result.existing,10);
 assert.ok(result.added===0||result.added===10);
 assert.equal(result.prize,result.added?1700:0);
 assert.equal(result.vr,result.added?5:0);
 assert.deepEqual(result.newPlayers,result.added?V.DOC.expected.newPlayers:[]);
 assert.deepEqual(files.map(checksum),before);
 const rows=readResults(ROOT).rows,ids=new Set(V.DOC.batch.entries.map(z=>z.id));
 assert.ok([0,10].includes(rows.filter(r=>ids.has(r.id)).length));
 assert.equal(new Set(rows.map(x=>x.id)).size,rows.length);
});
