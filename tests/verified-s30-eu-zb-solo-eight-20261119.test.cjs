'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const ROOT=path.resolve(__dirname,'..');
const read=name=>JSON.parse(fs.readFileSync(path.join(ROOT,name),'utf8'));
const {readResults}=require('../scripts/source-results-store.cjs');
const V=require('../scripts/verified-s30-eu-zb-solo-eight-20261119.cjs');
const {apply}=require('../scripts/apply-s30-eu-zb-solo-eight-20261119.cjs');
test('eight independent screenshot ranks, kills, unique UUID and $100/VR are fixed',()=>{
 assert.equal(V.validateProof(),true);
 const entries=V.DOC.batch.entries;
 assert.deepEqual(entries.map(x=>x.rank),[36,91,167,176,37,130,128,169]);
 assert.deepEqual(entries.map(x=>x.matches),[3,3,3,3,2,3,3,3]);
 assert.deepEqual(entries.map(x=>x.kills),[15,9,3,2,11,6,6,4]);
 assert.deepEqual(entries.map(x=>x.vrs),Array(8).fill(1));
 assert.deepEqual(entries.map(x=>x.prize),Array(8).fill(100));
 assert.deepEqual(entries.map(x=>x.trackerDisplayedPrize),[0,0,100,100,100,100,100,100]);
 assert.deepEqual(entries.map(x=>x.ownerCorrection),[true,true,false,false,false,false,false,false]);
 assert.deepEqual(entries.map(x=>x.screenshot),[1928,1929,1930,1931,1932,1933,1934,1935]);
 assert.equal(new Set(entries.map(x=>x.id)).size,8);
 assert.equal(entries.reduce((a,x)=>a+x.prize,0),800);
});
test('user-supplied Epic identities remain stable across three distinct sessions',()=>{
 const p=V.DOC.batch.entries;
 assert.deepEqual(p.map(x=>V.uuid(x.profileUrls[0])),V.TUPLES.map(x=>x[9]));
 assert.equal(new Set(p.map(x=>x.profileUrls[0])).size,5);
 assert.deepEqual(p.map(x=>x.windowId),[9,9,9,9,4,4,3,3].map(n=>V.EVENT+'_Event'+n+'Round2_EU'));
 assert.deepEqual(p.map(x=>x.date),['2024-08-13','2024-08-13','2024-08-13','2024-08-13',
  '2024-06-25','2024-06-25','2024-06-18','2024-06-18']);
});
test('official cash overrides the Tracker display glitch without changing VR or score',()=>{
 const a=V.DOC.batch.entries;
 for(const x of a){
  const row=V.project(x);
  assert.equal(row.kind,'賞金決勝');
  assert.equal(row.prize,row.vrs*100);
  assert.equal(row.points,row.vrs*100);
  assert.equal(row.matches,x.matches);
  assert.equal(row.kills,x.kills);
  assert.equal(row.rank,x.rank);
  assert.equal(row.teamPrize,100);
  assert.equal(row.prizePerPlayer,100);
  assert.equal(row.seasonId,'S30');
  assert.equal(row.region,'EU');
  assert.ok(row.round.includes('Round 2 / 賞金決勝'));
  if(x.ownerCorrection)assert.match(row.note,/表示不具合/);
 }
});
test('screenshot proof approval locks cash, source, profile, round and every stat',()=>{
 for(const x of V.DOC.batch.entries){
  const row=V.project(x),approval=V.approval(x);
  assert.equal(V.verifyRow(row,approval),true);
  for(const [field,next] of [['rank',x.rank+1],['kills',x.kills+1],
   ['vrs',2],['points',200],['matches',x.matches===3?2:3],
   ['prize',0],['prizePerPlayer',0],['teamPrize',0],
   ['player','偽選手'],['source','https://example.org'],
   ['profileUrl','https://example.org'],['profiles',[]],['round','Event 1 · Round 2 / 賞金決勝']]){
   assert.equal(V.verifyRow({...row,[field]:next},approval),false,x.id+':'+field);
  }
  assert.equal(V.verifyRow(row,{...approval,recordHash:'changed'}),false);
 }
});
test('original player aliases and different Round1 are never rewritten',()=>{
 const p=read('players.json');
 for(const n of ['モバイル勢のまかろん','TakoBeL','ちゃる','MMC KAAN BABA'])
  assert.ok(p.candidates.some(x=>x.name===n));
 assert.ok(p.confirmedAliases['ちゃる'].includes('charufn'));
 assert.ok(p.confirmedAliases['モバイル勢のまかろん'].includes('BRN 916GonLuck'));
 const rows=readResults(ROOT).rows;
 const originalIds=new Set(rows.map(x=>x.id));
 const targetIds=new Set(V.DOC.batch.entries.map(x=>x.id));
 const present=rows.filter(x=>targetIds.has(x.id));
 assert.ok(present.length===0||present.length===8);
 assert.equal(new Set(rows.map(x=>x.id)).size,rows.length);
 for(const row of present){
  const approval=read('approval-history.json').entries.find(x=>x.recordId===row.id);
  assert.ok(approval);
  assert.equal(V.verifyRow(row,approval),true);
 }
 assert.equal(originalIds.size,rows.length);
});
test('dry-run cannot change canonical shards, approvals, player aliases or update history',()=>{
 const paths=['source-results/manifest.json','source-results/S30.json','players.json','approval-history.json','updates.json'];
 const sha=f=>crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT,f))).digest('hex');
 const before=paths.map(sha);
 const result=apply({dryRun:true});
 assert.ok(result.added===0||result.added===8);
 assert.equal(result.added+result.alreadyPublished,8);
 assert.equal(result.addedCash,result.added?800:0);
 assert.deepEqual(result.newPlayers,result.added?['あーうw']:[]);
 assert.deepEqual(paths.map(sha),before);
});
