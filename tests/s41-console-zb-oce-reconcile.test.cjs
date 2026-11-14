'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const {readResults}=require('../scripts/source-results-store.cjs');
const V=require('../scripts/verified-s41-console-zb-oce-reconcile.cjs');
const proof=JSON.parse(fs.readFileSync(path.join(root,'data/manual-approvals/20261114-s41-console-zb-oce-reconcile-proof.json'),'utf8'));
const data=()=>readResults(root).rows;
function record(t){
 return {id:t.id,date:t.date,region:t.region,round:t.round,event:t.event,rank:t.rank,
 points:t.points,matches:t.matches,kills:t.kills,vrs:t.vrs,prize:t.prize,
 seasonId:t.seasonId,chapter:t.chapter,season:t.season,tournamentId:t.tournamentId,
 source:t.sourceTracker,kind:'賞金決勝',verified:true,
 teamPrize:100,prizePerPlayer:100,player:t.member.player,playerRaw:t.member.raw,players:[t.member.player],
 profileUrl:t.member.url,profiles:[{name:t.member.player,url:t.member.url}],
 teamAccountIds:[t.member.id.replace(/-/g,'')],
 trackerStats:{verified:true,source:t.sourceTracker,avgPlace:t.avgPlace,avgTimeAliveSeconds:t.avgTimeAliveSeconds,kdRatio:t.kdRatio},
 note:'個人賞金$100; Tracker: '+t.sourceTracker+' Rule: '+t.rule};
}
test('four independent user screenshots have correct exact dates, event windows, wins and Epic UUIDs',()=>{
 assert.equal(proof.version,1);
 assert.deepEqual(proof.batch.targets,V.TARGETS);
 assert.equal(V.TARGETS.length,4);
 assert.deepEqual(V.TARGETS.map(t=>[t.date,t.region,t.rank,t.kills,t.vrs,t.prize]),
  [['2026-06-22','EU',41,7,1,100],['2026-07-26','ME',7,14,1,100],
   ['2026-07-26','ME',19,4,1,100],['2026-07-26','ME',20,5,1,100]]);
 assert.deepEqual(V.TARGETS.map(t=>t.matches),[3,3,2,3]);
 for(const t of V.TARGETS){
  assert.equal(V.uuid(t.member.url),t.member.id);
  assert.ok(t.sourceTracker.endsWith(t.windowId));
  assert.ok(t.windowId.endsWith('Round2_'+t.region));
  assert.equal(t.eventId,'S41_ConsoleVCC_SolosZB');
  assert.equal(t.tournamentId,'ch7s3-console-zb-solo-victory');
  assert.equal(t.points,t.vrs*100);
  assert.equal(t.rule,V.RULE);
 }
});
test('independent cash approval rejects tampering with score, identity, date or source',()=>{
 for(const t of V.TARGETS){
  const r=record(t),entry={id:t.id,recordId:t.id,decision:'published',policy:V.POLICY,source:t.sourceTracker,rule:V.RULE};
  assert.ok(V.verifyCashRow(r,entry));
  for(const [key,value] of [['rank',t.rank+1],['kills',999],['prize',0],['points',0],['vrs',0],['prizePerPlayer',0],['source','https://evil.invalid/']]){
   assert.equal(V.verifyCashRow({...r,[key]:value},entry),false,'must reject changed '+key);
  }
  assert.equal(V.verifyCashRow({...r,profiles:[{...r.profiles[0],url:'https://fortnitetracker.com/profile/all/X/events?id=aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'}]},entry),false);
  assert.equal(V.verifyCashRow(r,{...entry,policy:'attendance-only'}),false);
 }
});
test('OCE exact three duplicates map onto three unchanged official Epic Event 7 rows',()=>{
 assert.deepEqual(proof.batch.duplicates,V.DUPLICATES);
 assert.equal(V.DUPLICATES.length,3);
 const rows=data(),ids=new Map(rows.map(x=>[x.id,x]));
 const target=rows.filter(x=>x.date==='2026-10-17'&&x.region==='OCE'&&
  x.tournamentId==='ch7s4-console-zero-build-solo-victory-cup'&&x.kind==='賞金決勝');
 assert.ok([22,25].includes(target.length),'one fully merged 22-record event or 22+3 unmerged event');
 for(const pair of V.DUPLICATES){
  const winner=ids.get(pair.retainId);
  assert.ok(winner,'official row must exist');
  assert.deepEqual([winner.player,winner.rank,winner.kills,winner.matches,winner.vrs,winner.prize],
   [pair.player,pair.rank,pair.kills,pair.matches,1,100]);
  assert.equal(winner.round,'Event 7 · Round 2 / 賞金決勝');
  assert.equal(winner.source,'https://www.fortnite.com/competitive/events/S42_ConsoleVCC_SolosZB/?region=OCE&round='+pair.officialWindowId);
  const old=ids.get(pair.removeId);
  if(old){
   assert.deepEqual([old.player,old.rank,old.kills,old.matches,old.vrs,old.prize],
    [winner.player,winner.rank,winner.kills,winner.matches,winner.vrs,winner.prize]);
   assert.equal(old.round,'決勝 / 賞金獲得');
  }
 }
});
