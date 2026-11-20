'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),
 fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const ROOT=path.resolve(__dirname,'..'),V=require('../scripts/verified-s21-s22-s35-s36-s37-ten-20261121.cjs');
const {readResults}=require('../scripts/source-results-store.cjs');
const {apply}=require('../scripts/apply-s21-s22-s35-s36-s37-ten-20261121.cjs');
const read=name=>JSON.parse(fs.readFileSync(path.join(ROOT,name),'utf8'));
test('screenshots 1960–1969 preserve every rank, kills, games, prizes and VR',()=>{
 assert.equal(V.validateProof(),true);
 const e=V.DOC.batch.entries;
 assert.equal(e.length,10);
 assert.deepEqual(e.map(x=>x.screenshot),[1960,1961,1962,1963,1964,1965,1966,1967,1968,1969]);
 assert.deepEqual(e.map(x=>x.rank),[10,13,6,10,12,14,78,96,42,51]);
 assert.deepEqual(e.map(x=>x.points),[100,100,100,100,100,100,15,4,34,28]);
 assert.deepEqual(e.map(x=>x.matches),[3,3,3,3,3,2,6,6,6,6]);
 assert.deepEqual(e.map(x=>x.kills),[4,5,19,11,10,2,4,1,1,5]);
 assert.deepEqual(e.map(x=>x.vrs),[1,1,1,1,1,1,0,0,0,0]);
 assert.deepEqual(e.map(x=>x.prize),Array(10).fill(200));
 assert.deepEqual(e.map(x=>x.prizePerPlayer),[100,100,100,100,100,100,200,200,200,200]);
 assert.equal(new Set(e.map(x=>x.id)).size,10);
 assert.equal(e.reduce((n,x)=>n+x.prize,0),2000);
});
test('the exact original Epic UUIDs map to the right sixteen account links',()=>{
 for(let i=0;i<V.GOLD.length;i++){
  const expected=V.GOLD[i],entry=V.DOC.batch.entries[i];
  assert.deepEqual(entry.playerNames,expected[3]);
  assert.deepEqual(entry.rawNames,expected[4]);
  assert.deepEqual(entry.profileUrls.map(V.epicId),expected[5]);
  assert.equal(entry.id,V.originalId(entry.seasonId,V.META[entry.seasonId],entry.rank));
  assert.match(entry.source,/fortnitetracker.com\/events\/epicgames_/);
 }
 assert.equal(V.DOC.batch.entries.flatMap(x=>x.profileUrls).length,16);
 const p=read('players.json');
 for(const name of ['Hakkun','TEITEI','Asuka','あおねこ','モバイル勢のまかろん'])
  assert.ok(p.candidates.some(x=>x.name===name));
 assert.ok(p.confirmedAliases['Hakkun'].includes('RAGE Hakkun'));
 assert.ok(p.confirmedAliases['あおねこ'].includes('Celis あおねこ416'));
});
test('six duo Victory Royale results earn team $200 but only $100 per player',()=>{
 for(const x of V.DOC.batch.entries.slice(0,6)){
  const r=V.project(x);
  assert.equal(r.players.length,2);assert.equal(r.vrs,1);
  assert.equal(r.teamPrize,200);assert.equal(r.prizePerPlayer,100);
  assert.equal(r.prize,200);assert.equal(r.teamPrize,100*r.players.length);
  assert.match(r.note,/1VRチーム賞金\$200・各選手\$100/);
  assert.equal(r.round,V.META[x.seasonId].round);
  assert.ok(r.matches<=3);
 }
});
test('2022 OCE and NAW PlayStation cash is a placement prize at 0VR',()=>{
 for(const x of V.DOC.batch.entries.slice(6)){
  const r=V.project(x);
  assert.equal(r.players.length,1);
  assert.equal(r.vrs,0);assert.equal(r.prize,200);
  assert.equal(r.prizePerPlayer,200);
  assert.equal(r.teamPrize,200);
  assert.match(r.note,/順位別個人賞金\$200（0VR）/);
  assert.equal(r.tournamentId,x.seasonId==='S21'?
   'ch3s3-playstation-cup-july':'ch3s4-playstation-cup-november');
  assert.ok(x.seasonId==='S21'?(x.rank>=11&&x.rank<=90):(x.rank>=51&&x.rank<=100));
 }
});
test('record approval freezes the original identity and all source fields',()=>{
 for(const x of V.DOC.batch.entries){
  const row=V.project(x),a=V.approval(x);
  assert.equal(V.verifyRow(row,a),true);
  for(const [key,value] of [['rank',x.rank+1],['vrs',x.vrs+1],
   ['kills',x.kills+1],['points',x.points+1],['matches',x.matches+1],
   ['prize',x.prize+100],['prizePerPlayer',x.prizePerPlayer+100],
   ['teamPrize',x.teamPrize+100],['players',['別人']],
   ['profiles',[]],['source','https://example.org/'],['round','Other']]){
   assert.equal(V.verifyRow({...row,[key]:value},a),false,key+' '+x.id);
  }
  assert.equal(V.verifyRow(row,{...a,originalHash:'tamper'}),false);
 }
});
test('publisher dry run is all-or-none, idempotent and does not alter old results',()=>{
 const files=['source-results/manifest.json','source-results/S21.json','source-results/S22.json',
  'source-results/S35.json','source-results/S36.json','source-results/S37.json',
  'players.json','approval-history.json','updates.json'];
 const sha=file=>{const p=path.join(ROOT,file);return fs.existsSync(p)?
  crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'):null;};
 const before=files.map(sha);
 const status=apply({dryRun:true});
 assert.equal(status.added+status.existing,10);
 assert.ok(status.added===0||status.added===10);
 assert.equal(status.prize,status.added?2000:0);
 assert.equal(status.vr,status.added?6:0);
 assert.deepEqual(status.newPlayers,status.added?V.DOC.expected.newPlayers:[]);
 assert.deepEqual(status.newAliases,status.added?
   [{name:'Hakkun',raw:'TGR はっくん'},{name:'irodori',raw:'FA irodori'}]:[]);
 assert.deepEqual(files.map(sha),before);
 const rows=readResults(ROOT).rows,ids=new Set(V.DOC.batch.entries.map(x=>x.id));
 const present=rows.filter(x=>ids.has(x.id));
 assert.ok(present.length===0||present.length===10);
 assert.equal(new Set(rows.map(x=>x.id)).size,rows.length);
});
