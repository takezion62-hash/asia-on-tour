'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {spawnSync}=require('node:child_process');
const {readResults}=require('../scripts/source-results-store.cjs');
const V=require('../scripts/verified-nov15-nac-ps-naw-nine.cjs');
const root=path.resolve(__dirname,'..');
const proof=JSON.parse(fs.readFileSync(path.join(root,'data/manual-approvals/20261115-nac-s29-ps-s36-naw-s37-nine-proof.json'),'utf8'));
const catalog=JSON.parse(fs.readFileSync(path.join(root,'tournaments.json'),'utf8')).catalog;
test('nine screenshot proofs have immutable score, Epic UUID, team/personal award and official event window',()=>{
 assert.equal(proof.version,1);
 assert.equal(proof.batch.id,'tracker-20261115-nac-s29-ps-s36-naw-s37-nine');
 assert.equal(V.TARGETS.length,9);
 assert.equal(V.FIXED.length,9);
 assert.equal(new Set(V.TARGETS.map(x=>x.id)).size,9);
 assert.equal(V.TARGETS.reduce((s,t)=>s+t.prize,0),1840);
 const linked=V.TARGETS.find(t=>t.id==='s37-naw-console-duos-final-20251026-kumafv-chromeret');
 assert.equal(linked.players[0],'Cue.Ganondorf');
 assert.equal(linked.confirmedDisplayAlias,'くまえふぶい');
 assert.equal(linked.profiles[0].id,'5aa76ea4-2a16-4e4e-ac2a-e3da5a0d8ed2');
 assert.equal(V.expected({...linked,confirmedDisplayAlias:'someone else'}),false);
 assert.deepEqual(V.TARGETS.map(t=>[t.seasonId,t.date,t.region,t.rank,t.kills,t.vrs,t.prize]),[
  ['S29','2024-04-04','NAC',20,21,1,200],
  ['S29','2024-04-04','NAC',67,12,1,200],
  ['S29','2024-04-04','NAC',84,10,1,200],
  ['S29','2024-04-04','NAC',91,8,1,200],
  ['S36','2025-07-27','NAC',88,0,0,240],
  ['S37','2025-10-26','NAW',10,5,1,200],
  ['S37','2025-10-26','NAW',12,3,1,200],
  ['S37','2025-10-26','NAW',13,4,1,200],
  ['S37','2025-10-26','NAW',14,3,1,200]
 ]);
 for(const t of V.TARGETS){
  assert.equal(V.expected(t),true,t.id);
  assert.equal(t.prizePerPlayer*t.players.length,t.prize,t.id);
  assert.ok(catalog.some(x=>x.id===t.tournamentId&&x.sourceEventIds.includes(t.eventId)));
  assert.equal(t.profiles.length,t.players.length);
  for(const p of t.profiles)assert.equal(V.uuid(p.url),p.id);
  assert.equal(V.expected({...t,kills:t.kills+1}),false);
  assert.equal(V.expected({...t,prize:t.prize+100}),false);
  assert.equal(V.expected({...t,windowId:'wrong'}),false);
 }
});
test('verified publication rejects cash/VR/roster/account tampering, including PlayStation award upgrade',()=>{
 for(const t of V.TARGETS){
  const row={
   id:t.id,date:t.date,region:t.region,seasonId:t.seasonId,chapter:t.chapter,season:t.season,
   tournamentId:t.tournamentId,event:t.event,round:t.round,rank:t.rank,points:t.points,
   matches:t.matches,kills:t.kills,vrs:t.vrs,prize:t.prize,teamPrize:t.prize,
   prizePerPlayer:t.prizePerPlayer,player:t.players.join(' / '),players:[...t.players],
   playerRaw:t.playerRaw,profiles:t.profiles.map(p=>({name:p.name,url:p.url})),
   teamAccountIds:t.profiles.map(p=>p.id.replace(/-/g,'')),
   source:t.originalSource||t.sourceTracker,verified:true,kind:'賞金決勝',
   note:t.screenshot+' '+t.sourceTracker+' '+t.rule+' '+(t.players.length===1?'個人$240':'各選手$100')
  };
  if(t.players.length===1)row.profileUrl=t.profiles[0].url;
  const e={id:t.id,recordId:t.id,policy:V.POLICY,decision:'published',
   source:row.source,rule:t.rule};
  assert.equal(V.verifyRow(row,e),true,t.id);
  for(const [k,val] of [['rank',t.rank+1],['kills',t.kills+2],['points',t.points+1],
    ['vrs',t.vrs+1],['prize',t.prize+100],['prizePerPlayer',0]])
   assert.equal(V.verifyRow({...row,[k]:val},e),false,t.id+':'+k);
  assert.equal(V.verifyRow(row,{...e,policy:'attendance-only'}),false);
  assert.equal(V.verifyRow({...row,source:'https://invalid.example/'},e),false);
  assert.equal(V.verifyRow({...row,teamAccountIds:row.teamAccountIds.map(()=> '0'.repeat(32))},e),false);
 }
});
test('existing p1ng NAC final keeps one canonical record ID while awaiting verified $240 correction',()=>{
 const rows=readResults(root).rows;
 const id='auto-s36-05defadba950',matches=rows.filter(x=>x.id===id);
 assert.equal(matches.length,1);
 const r=matches[0];
 assert.equal(r.date,'2025-07-27');
 assert.equal(r.region,'NAC');
 assert.equal(r.rank,88);
 assert.equal(r.points,19);
 assert.equal(r.kills,0);
 assert.equal(r.matches,5);
 assert.equal(r.vrs,0);
 assert.equal(r.player,'p1ng');
 if(r.prize===null){
  assert.equal(r.kind,'参加確認');
  assert.equal(r.round,'Final / 参加確認');
 }else{
  assert.equal(r.prize,240);
  assert.equal(r.kind,'賞金決勝');
  assert.equal(r.round,'Final / 賞金決勝');
 }
});
test('Nov15 source publisher passes dry run without changing live authoritative results', {timeout:120000},()=>{
 const {rows:before}=readResults(root);
 const res=spawnSync(process.execPath,['scripts/apply-nov15-nac-ps-naw-nine.cjs','--dry-run'],
  {cwd:root,encoding:'utf8',timeout:110000,maxBuffer:3*1024*1024});
 assert.equal(res.status,0,[
  'Nov15 proof promotion dry-run rejected',
  res.stdout?.slice(-1800),res.stderr?.slice(-4200)
 ].join('\n'));
 assert.match(res.stdout,/NOV15_VERIFIED_FINAL9/);
 assert.equal(readResults(root).rows.length,before.length,'dry-run must never publish');
});
