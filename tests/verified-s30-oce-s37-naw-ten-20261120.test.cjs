'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const ROOT=path.resolve(__dirname,'..');
const read=file=>JSON.parse(fs.readFileSync(path.join(ROOT,file),'utf8'));
const {readResults}=require('../scripts/source-results-store.cjs');
const V=require('../scripts/verified-s30-oce-s37-naw-ten-20261120.cjs');
const {apply}=require('../scripts/apply-s30-oce-s37-naw-ten-20261120.cjs');
test('ten screenshot entries have immutable ranks, dates, wins, kills, matches and $2,300 totals',()=>{
 assert.equal(V.validateProof(),true);
 const x=V.DOC.batch.entries;
 assert.deepEqual(x.map(e=>e.screenshot),[1939,1940,1941,1943,1944,1945,1946,1947,1948,1949]);
 assert.deepEqual(x.map(e=>e.rank),[3,16,23,30,42,49,11,33,36,37]);
 assert.deepEqual(x.map(e=>e.points),[200,100,100,100,100,100,173,124,121,117]);
 assert.deepEqual(x.map(e=>e.matches),[3,3,3,3,3,3,6,6,6,6]);
 assert.deepEqual(x.map(e=>e.kills),[8,11,9,8,6,3,4,8,5,9]);
 assert.deepEqual(x.map(e=>e.vrs),[2,1,1,1,1,1,0,0,0,0]);
 assert.deepEqual(x.map(e=>e.prize),[200,100,100,100,100,100,400,400,400,400]);
 assert.equal(x.reduce((n,e)=>n+e.prize,0),2300);
 assert.equal(x.reduce((n,e)=>n+e.vrs,0),7);
 assert.equal(new Set(x.map(e=>e.id)).size,10);
});
test('ten provided tracker Epic accounts and original player aliases are preserved',()=>{
 const x=V.DOC.batch.entries;
 assert.deepEqual(x.map(e=>V.uuid(e.profileUrls[0])),V.TUPLES.map(t=>t[11]));
 assert.deepEqual(x.map(e=>e.playerNames[0]),[
  'CRT koyful','かわあと','モバイル勢のまかろん','おかっぱがふ子','りむた',
  'グラッセパルフェ','Jaemon','モバイル勢のまかろん','sena','ちからV2'
 ]);
 assert.equal(x[1].playerRaw,'Blue_P かわあと');
 assert.equal(x[4].playerRaw,'A_α Rimuta');
 assert.equal(x[9].playerRaw,'ちからv2');
 assert.deepEqual(x.map(e=>e.windowId),[
  ...Array(6).fill('S30_SoloZBVictoryCashCup_Event4Round2_OCE'),
  ...Array(4).fill('S37_PlayStationCup_Final_NAW')
 ]);
 assert.deepEqual(x.map(e=>e.date),[...Array(6).fill('2024-06-24'),...Array(4).fill('2025-09-05')]);
});
test('OCE Victory Cup pays by wins but PlayStation Cup pays $400 at zero wins',()=>{
 const x=V.DOC.batch.entries;
 for(let i=0;i<x.length;i++){
  const original=x[i],result=V.project(original);
  assert.equal(result.kind,'賞金決勝');
  assert.equal(result.prize,original.prize);
  assert.equal(result.prizePerPlayer,original.prize);
  assert.equal(result.teamPrize,original.prize);
  assert.equal(result.kills,original.kills);
  assert.equal(result.rank,original.rank);
  assert.equal(result.points,original.points);
  assert.equal(result.matches,original.matches);
  if(i<6){
   assert.equal(result.prize,100*result.vrs);
   assert.match(result.round,/Event 4.*Round 2/);
   assert.equal(result.tournamentId,'ch5s3-zb-solo-victory');
  }else{
   assert.equal(result.vrs,0);
   assert.equal(result.prize,400);
   assert.match(result.round,/Final/);
   assert.match(result.note,/順位賞金/);
   assert.equal(result.tournamentId,'ch6s4-playstation-cup');
  }
 }
});
test('per-row official approval is exact and rejects rank, prize, VR or identity drift',()=>{
 for(const x of V.DOC.batch.entries){
  const row=V.project(x),a=V.approval(x);
  assert.equal(V.verifyRow(row,a),true);
  for(const [key,value] of [['rank',x.rank+1],['kills',x.kills+1],
   ['vrs',x.vrs+1],['matches',x.matches+1],['points',x.points+1],
   ['prize',x.prize+100],['prizePerPlayer',0],['teamPrize',0],
   ['player','別の人'],['profiles',[]],['profileUrl','https://wrong.site'],
   ['source','https://example.com'],['round','別のラウンド']]){
   assert.equal(V.verifyRow({...row,[key]:value},a),false,x.id+':'+key);
  }
  assert.equal(V.verifyRow(row,{...a,originalHash:'forged'}),false);
 }
});
test('previous canonical players and already verified screenshot IDs cannot change',()=>{
 const p=read('players.json');
 for(const name of ['かわあと','りむた','モバイル勢のまかろん','Jaemon','sena','ちからV2'])
  assert.ok(p.candidates.some(x=>x.name===name));
 assert.ok(p.confirmedAliases['かわあと'].includes('Blue_P かわあと'));
 assert.ok(p.confirmedAliases['ちからV2'].includes('ちからv2'));
 assert.ok(p.confirmedAliases['モバイル勢のまかろん'].includes('BRN 916GonLuck'));
 const rows=readResults(ROOT).rows,ids=new Set(V.DOC.batch.entries.map(x=>x.id));
 const present=rows.filter(x=>ids.has(x.id));
 assert.equal(new Set(rows.map(x=>x.id)).size,rows.length);
 assert.ok(present.length===0||present.length===10);
 for(const row of present){
  const entries=read('approval-history.json').entries.filter(x=>x.recordId===row.id);
  assert.equal(entries.length,1);
  assert.equal(V.verifyRow(row,entries[0]),true);
 }
});
test('replayable dry-run never mutates players, results, approvals or update history',()=>{
 const paths=['source-results/manifest.json','source-results/S30.json','source-results/S37.json',
   'players.json','approval-history.json','updates.json'];
 const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT,file))).digest('hex');
 const before=paths.map(sha);
 const run=apply({dryRun:true});
 assert.equal(run.added+run.existing,10);
 assert.ok(run.added===0||run.added===10);
 assert.equal(run.addedCash,run.added?2300:0);
 assert.equal(run.addedWins,run.added?7:0);
 assert.deepEqual(run.newPlayers,run.added?['CRT koyful','おかっぱがふ子','グラッセパルフェ']:[]);
 assert.deepEqual(run.newAliases,run.added?[{name:'りむた',raw:'A_α Rimuta'}]:[]);
 assert.deepEqual(paths.map(sha),before);
});
