'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const ROOT=path.resolve(__dirname,'..'),read=f=>JSON.parse(fs.readFileSync(path.join(ROOT,f),'utf8'));
const {readResults}=require('../scripts/source-results-store.cjs');
const V=require('../scripts/verified-unreal-nvidia-six-20261118.cjs');
test('six user screenshots preserve exact raw player names, Epic UUIDs, score, rank and official cash',()=>{
 assert.equal(V.validateProof(),true);
 assert.deepEqual(V.DOC.batch.entries.map(x=>x.rank),[1093,33,36,53,69,71]);
 assert.deepEqual(V.DOC.batch.entries.map(x=>x.points),[260,345,342,322,312,310]);
 assert.deepEqual(V.DOC.batch.entries.map(x=>x.matches),[10,9,9,8,10,10]);
 assert.deepEqual(V.DOC.batch.entries.map(x=>x.kills),[23,7,9,6,10,16]);
 assert.deepEqual(V.DOC.batch.entries.map(x=>x.vrs),[1,0,1,1,0,1]);
 assert.deepEqual(V.DOC.batch.entries.map(x=>x.prize),[100,100,100,0,0,0]);
 assert.equal(V.DOC.batch.entries.reduce((n,x)=>n+x.prize,0),300);
});
test('Unreal NAC and NVIDIA NAW payout boundaries, cosmetic vs cash and first-place GPU',()=>{
 const [unreal,nvidia]=V.DOC.batch.entries;
 for(const [rank,cash] of [[600,200],[601,100],[1093,100],[1200,100],[1201,0]])
  assert.equal(V.prizeFor({...unreal,rank}),cash);
 for(const [rank,cash] of [[1,1000],[10,200],[25,150],[26,100],[33,100],[36,100],[40,100],[41,0],[53,0],[71,0]])
  assert.equal(V.prizeFor({...nvidia,rank}),cash);
 const overview=V.DOC.nvidiaOverview;
 assert.equal(overview.cashTopRank,40);assert.equal(overview.rustBucketPoints,8);assert.equal(overview.rtx5080FirstPlace,true);
});
test('ledger locks score, roster, profile, date, rules and cash against changes',()=>{
 for(const x of V.DOC.batch.entries){
  const row=V.project(x),approval=V.approval(x);
  assert.equal(V.verifyRow(row,approval),true);
  for(const [field,value] of [['rank',row.rank+1],['points',row.points+1],['matches',row.matches+1],['kills',row.kills+1],
   ['vrs',row.vrs+1],['prize',row.prize+100],['player','another'],['source','https://example.org'],['profiles',[]]]){
   assert.equal(V.verifyRow({...row,[field]:value},approval),false,x.id+' '+field);
  }
  assert.equal(V.verifyRow(row,{...approval,recordHash:'tampered'}),false);
 }
});
test('existing canonical players and their confirmed aliases are never replaced',()=>{
 const players=read('players.json'),rows=readResults(ROOT).rows;
 for(const [name,alias] of [['テルハルル','BoF てるはるるの相方popo'],
  ['モバイル勢のまかろん','BRN 916GonLuck'],['ふぃる','ポルターガイストǃ']]){
  assert.ok(players.candidates.some(p=>p.name===name));
  assert.ok(players.confirmedAliases[name].includes(alias));
 }
 const rise=rows.find(r=>r.id==='s39-naw-1million-unreal-cup-20251221-qjac-rise');
 assert.ok(rise&&rise.profiles.some(p=>p.name==='Rise'&&V.uuid(p.url)==='635ed9f3-69cf-4720-b1ec-25e0575fd76b'));
 const mac=rows.find(r=>r.id==='s39-naw-solo-series-finals-20260126-macaron');
 assert.ok(mac&&mac.profiles.some(p=>p.name==='モバイル勢のまかろん'&&V.uuid(p.url)==='facede25-f8fd-4f47-be4d-ecb0796abd33'));
});
test('NVIDIA Solo Build is registered separately from Unreal Duos with official overview',()=>{
 const t=read('tournaments.json'),a=t.catalog.find(c=>c.id==='ch7s1-nvidia-geforce-rtx-cup');
 assert.ok(a);assert.equal(a.name,'NVIDIA GeForce RTX Cup');assert.equal(a.team,'solo');
 assert.equal(a.mode,'battle-royale');assert.equal(a.seasonId,'S39');
 assert.deepEqual(a.sourceEventIds,['S39_NvidiaCup']);
 assert.equal(a.overview.maxMatches,10);assert.equal(a.overview.durationMinutes,180);
 assert.equal(a.overview.cashTopRank,40);assert.equal(a.overview.rustBucketBackBlingPoints,8);
 assert.ok(a.evidence.some(e=>e.url===V.RULES.nvidia));
});
test('all six results are unpublished or published exactly once, with verified approval',()=>{
 const rows=readResults(ROOT).rows,ledger=read('approval-history.json').entries;
 const ids=new Set(V.DOC.batch.entries.map(x=>x.id)),found=rows.filter(x=>ids.has(x.id));
 assert.ok(found.length===0||found.length===6,'must not publish partial batch');
 for(const row of found){
  const e=ledger.filter(x=>x.recordId===row.id);
  assert.equal(e.length,1);assert.equal(V.verifyRow(row,e[0]),true);
 }
});
test('full snapshot dry-run passes and cannot mutate canonical source, player identity or cash',()=>{
 const paths=['source-results/manifest.json','players.json','approval-history.json','updates.json'];
 const sha=f=>crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT,f))).digest('hex');
 const before=paths.map(sha);
 const {apply}=require('../scripts/apply-unreal-nvidia-six-20261118.cjs');
 const status=apply({dryRun:true});
 assert.ok(status.added===0||status.added===6);
 assert.equal(status.added+status.alreadyPublished,6);
 assert.equal(status.newPlayers.length,status.added?2:0);
 assert.equal(status.addedCash,status.added?300:0);
 assert.deepEqual(paths.map(sha),before);
});
