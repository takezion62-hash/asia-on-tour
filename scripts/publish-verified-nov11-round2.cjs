'use strict';
// ASIA ON TOUR — source-verified 2026-11-11 follow-up batch, 9 exact sessions.
// Idempotent, fail-closed, no inferred prize or duplicated team/solo result.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {collision,equalCandidate}=require('./manual-approval-core.cjs');
const ROOT=path.resolve(__dirname,'..');
const read=n=>JSON.parse(fs.readFileSync(path.join(ROOT,n),'utf8'));
const write=(n,x)=>fs.writeFileSync(path.join(ROOT,n),JSON.stringify(x,null,2)+'\n');
const dry=process.argv.includes('--dry-run'),now=new Date().toISOString();
const S30='https://www.fortnite.com/news/fortnite-victory-cash-cups-chapter-5-season-3-official-rules';
const S31='https://www.fortnite.com/news/duos-cash-cups-chapter-5-season-4-official-rules';
const S33='https://www.fortnite.com/news/solo-cash-cups-chapter-6-season-1-official-rules';
const S42='https://www.fortnite.com/competitive/rules-guidelines/rules-library/fortnite-victory-cups-chapter-7-season-4-official-rules';
const S43='https://www.fortnite.com/competitive/rules-guidelines/rules-library/fortnite-squads-victory-cup-chapter-7-mini-season-official-rules';
const CONFIG=[
 ['2024-08-13','NAC','S30_SoloVictoryCashCup','Event9Round1','ch5s3-solo-victory-cup','qual',S30],
 ['2024-07-23','ME','S30_SoloZBVictoryCashCup','Event6Round1','ch5s3-zb-solo-victory','qual',S30],
 ['2024-10-24','ME','S31_DuosCashCup','Event8Round1','ch5s4-duos-cash-cup','cash-qual',S31],
 ['2025-01-11','NAW','S33_SoloCashCup','Event3Round1','ch6s1-solo-cash','cash-qual',S33],
 ['2026-05-13','ME','S40_FNCSDivisionalCup_Division1','Week4Day2','ch7s2-fncs-division-1','fncs',null],
 ['2026-08-25','NAW','S42_ReloadDuosVictoryCup','Event1_Round2','ch7s4-reload-duos-victory-cup','duo-zero',S42],
 ['2026-08-29','OCE','S42_ConsoleVCC_SolosZB','Event1Round2','ch7s4-console-zero-build-solo-victory-cup','console-final',S42],
 ['2026-11-10','ME','S43_SquadsVictoryCup','Event1_Round2','ch7s5-squads-victory-cup','squad-zero',S43],
 ['2026-11-02','ME','S43_SoloReloadTestCup','', 'ch7s5-solo-reload-test-cup','test',null]
].map(([date,region,event,fragment,tournamentId,type,rule])=>{
 const season=event.split('_')[0],window=event+(fragment?'_'+fragment:'')+'_'+region;
 return{date,region,event,window,tournamentId,type,season,rule};
});
const d={
 results:read('results.json'),
 reviews:{history:read('history-sync-review.json'),auto:read('auto-sync-review.json')},
 reviewed:read('history-sync-reviewed.json'),
 statuses:{history:read('history-sync-status.json'),auto:read('auto-sync-status.json')},
 approval:read('approval-history.json'),updates:read('updates.json'),
 scans:{history:read('history-sync-scan.json'),auto:read('auto-sync-scan.json')},
 players:read('players.json'),tournaments:read('tournaments.json'),calendar:{}
};
const catalog=new Map(d.tournaments.catalog.map(x=>[x.id,x]));
const known=new Set(d.players.candidates.map(x=>x.name));
const reviewIds=new Set(d.reviewed.entries.map(x=>x.id));
const resultIds=new Set(d.results.map(x=>x.id));
const approvedIds=new Set(d.approval.entries.map(x=>x.id));
const changed=[],held=[],outOfScope=[];
function requireValid(ok,msg){if(!ok)throw Error(msg)}
function getEvidence(r,spec){
 requireValid(r.date===spec.date&&r.region===spec.region&&r.tournamentId===spec.tournamentId&&
  r.seasonId===spec.season&&r.verified===true,'official session differs');
 const url=new URL(r.source);
 requireValid(url.protocol==='https:'&&url.hostname==='www.fortnite.com'&&
  url.pathname==='/competitive/events/'+spec.event+'/'&&
  url.searchParams.get('region')===spec.region&&url.searchParams.get('round')===spec.window&&
  !url.username&&!url.password&&!url.hash,'Epic official event URL differs');
 const cat=catalog.get(r.tournamentId);
 const members={solo:1,duo:2,trio:3,squad:4}[cat?.team];
 requireValid(cat&&cat.name===r.event&&cat.seasonId===spec.season&&
  cat.sourceEventIds?.includes(spec.event)&&members,'event master mismatch');
 const team=Array.isArray(r.players)&&r.players.length?r.players:[r.player];
 requireValid(team.length===members&&team.every(x=>known.has(x))&&
  new Set(team).size===members&&r.player===team.join(' / '),'team Epic ID roster unverified');
 requireValid(Number.isSafeInteger(r.rank)&&r.rank>0&&
  Number.isSafeInteger(r.points)&&r.points>=0&&
  Number.isSafeInteger(r.kills)&&r.kills>=0&&
  Number.isSafeInteger(r.vrs)&&r.vrs>=0&&
  Number.isSafeInteger(r.matches)&&r.matches>0&&r.vrs<=r.matches,
  'rank or scored values invalid');
 const key='epicgames_'+spec.event+'_'+spec.region+'/'+spec.window;
 const candidates=[];
 for(const scan of Object.values(d.scans)){
  if(!scan?.windows)continue;
  const cp=scan.windows[key];
  if(cp)candidates.push(cp);
 }
 requireValid(candidates.length>0,'original Epic scoreboard was not saved');
 const matching=candidates.filter(cp=>cp.rankingOrderValid===true&&cp.nextPage>0&&
  Number.isSafeInteger(cp.lastSeenRank)&&cp.lastSeenRank>=r.rank&&
  Array.isArray(cp.proposals)&&
  cp.proposals.filter(x=>x.id===r.id&&equalCandidate(x,r)).length===1);
 requireValid(matching.length>0,'original Epic-ID leaderboard rank/score did not match saved checkpoint');
 const month=r.date.slice(0,7);
 if(!d.calendar[month])d.calendar[month]=read('calendar-history/'+month+'.json').sessions;
 requireValid(d.calendar[month]?.some(x=>x.eventId===spec.event&&x.sourceWindowId===spec.window&&
  x.dateJst===r.date&&x.region===r.region&&x.tournamentId===r.tournamentId&&
  x.seasonId===r.seasonId),'official calendar date or region mismatch');
 requireValid(!resultIds.has(r.id)&&!approvedIds.has(r.id),'previously approved ID');
 requireValid(!d.results.some(x=>collision(x,r,d.players.confirmedAliases||{})),
  'overlapping existing achievement, manual reconciliation required');
}
function classify(r,spec){
 const zeroFinal=spec.type==='duo-zero'||spec.type==='console-final'||spec.type==='squad-zero';
 const q=spec.type==='qual'||spec.type==='cash-qual';
 if(q){
  const cutoff=spec.type==='cash-qual'?(spec.season==='S31'?50:600):(spec.region==='NAC'?5000:2000);
  const inTop=r.rank<=cutoff;
  requireValid(spec.type==='qual'?
   (r.kind==='予選'&&r.prize===0&&inTop&&r.round.includes('Round 1 / 予選')&&r.matches<=7):
   (r.kind==='参加確認'&&r.reviewOnly===true&&r.prize===null&&
    !inTop&&r.round.includes('Round 1 / 参加確認')&&r.matches<=10),
   'rank is outside source-verified qualifying category');
  return{
   policy:'verified-rule',kind:'予選',round:r.round.replace(/\/ (予選|参加確認)$/,'/ '+(inTop?'予選突破':'予選')),prize:0,
   note:'本人Epic ID・保存済み公式順位表の'+r.rank+'位、'+r.points+'pt、'+r.kills+'K、'+r.vrs+'VRを確認。'+
    (inTop?'公式の地域別上位'+cutoff+'名（組）で予選突破。':'公式の進出条件は上位'+cutoff+'名（組）。突破扱いには加算せず予選順位として掲載。')+
    ' Round1の現金賞金$0。公式規則: '+spec.rule
  };
 }
 if(zeroFinal){
  const team=spec.type==='duo-zero'?2:spec.type==='squad-zero'?4:1;
  const allowedVR=spec.type==='console-final'?1:0;
  requireValid(r.kind==='賞金決勝'&&r.prize===null&&r.matches<=3&&r.vrs<=allowedVR&&
   r.points===r.vrs*100&&r.round.includes('Round 2 / 賞金決勝'),
   'final VR, match cap or original points not verified');
  const award=spec.type==='console-final'?r.vrs*100:r.vrs*200;
  const note='本人Epic ID・公式開催枠・保存済み決勝順位表の'+r.rank+'位 / '+r.vrs+
   'VR / '+r.kills+'K を照合。'+
   (team===1?'公式1VR=$100、個人賞金$'+award:
    '公式1VR=チーム$200、チーム賞金$'+award+' / 各選手$'+(award/team))+
   '。支払完了とは区別。公式規則: '+spec.rule;
  return{
   policy:award>0?'official-final-vr-award':'verified-rule',
   kind:'賞金決勝',round:r.round,prize:award,note,
   ...(team>1?{teamPrize:award,prizePerPlayer:award/team}:{})
  };
 }
 if(spec.type==='fncs'){
  requireValid(r.kind==='参加確認'&&r.prize===null&&r.reviewOnly===true&&
   r.matches<=12,'unverified FNCS participation candidate');
  return{policy:'attendance-only',kind:'参加確認',round:r.round,prize:null,
   note:'FNCS Division 1の'+r.rank+'位、'+r.points+'pt、'+r.kills+'チームK、'+r.vrs+
    'VRをEpic本人IDと保存済み順位表で確認。進出資格・現金賞金は推定しない。通常結果に統合。出典: '+r.source};
 }
 if(spec.type==='test'){
  requireValid(r.kind==='参加確認'&&r.prize===null&&r.reviewOnly===true&&
   r.matches<=8,'unexpected test-only candidate');
  return{policy:'attendance-only',kind:'参加確認',round:r.round,prize:null,
   note:'Epic公式のSolo Reload Test Cup。順位'+r.rank+'位・'+r.points+'pt・'+r.kills+'K・'+r.vrs+
    'VRを本人Epic IDと保存済み順位表で確認。テスト大会で賞品授与なし。予選突破や賞金実績には加算しない。出典: '+r.source};
 }
 throw Error('unknown rule category');
}
const selected=[...d.reviews.history.proposals.map(x=>({r:x,origin:'history'})),
 ...d.reviews.auto.proposals.map(x=>({r:x,origin:'auto'}))];
for(const {r,origin} of selected){
 const spec=CONFIG.find(x=>x.date===r.date&&x.region===r.region&&x.tournamentId===r.tournamentId&&
  r.source?.includes('round='+x.window));
 if(!spec){outOfScope.push(r.id);continue}
 try{
  getEvidence(r,spec);
  const resolution=classify(r,spec);
  const {reviewOnly,reviewReason,teamAccountIds,...record}=r;
  Object.assign(record,{
   kind:resolution.kind,round:resolution.round,prize:resolution.prize,note:resolution.note,
   ...(resolution.teamPrize!==undefined?{teamPrize:resolution.teamPrize,prizePerPlayer:resolution.prizePerPlayer}:{})
  });
  requireValid(!record.round.includes('予選敗退')&&record.verified===true,'unsafe result label or record');
  d.results.push(record);resultIds.add(record.id);approvedIds.add(record.id);
  d.reviews[origin].proposals=d.reviews[origin].proposals.filter(x=>x.id!==r.id);
  d.approval.entries.push({
   id:r.id,decision:'published',recordId:r.id,policy:resolution.policy,source:r.source,
   rule:spec.rule||null,approvedAt:now,approvedBy:'ChatGPT / owner-authorized verified historical review',
   evidence:'Exact saved Epic account+team IDs, event, official session calendar, original ranking/VR score and tournament-specific payout/advancement rules'
  });
  if(!reviewIds.has(r.id)){
   d.reviewed.entries.push({id:r.id,decision:'published',recordId:r.id,
    reviewedAt:now,source:r.source,policy:resolution.policy,rule:spec.rule||null});
   reviewIds.add(r.id);
  }
  changed.push({id:r.id,player:r.player,region:r.region,date:r.date,event:r.event,rank:r.rank,
   kind:record.kind,round:record.round,prize:record.prize,personalPrize:record.prizePerPlayer??record.prize});
 }catch(e){held.push({id:r.id,player:r.player,reason:String(e.message||e)})}
}
if(changed.length){
 const id='verified-history-nov11-round2-'+crypto.createHash('sha256').update(changed.map(x=>x.id).sort().join('|')).digest('hex').slice(0,14);
 requireValid(!d.updates.entries.some(x=>x.id===id),'reused update id');
 const jst=new Date(Date.parse(now)+9*3600000).toISOString().slice(0,10);
 const categories={};
 for(const x of changed)categories[x.event]=(categories[x.event]||0)+1;
 d.updates.entries.unshift({id,date:jst,type:'records',
  title:'海外大会の公式順位・VR・予選突破 '+changed.length+'戦績を追加',
  description:'Epic本人ID、開催枠と順位表を検証。Squads/Reload Duos/Console ZBの決勝賞金、2024/2025予選、FNCS Div1、賞品なしのTest Cupを正確に区別。未確認の賞金を推定せず通常遠征結果へ統合。',
  recordIds:changed.map(x=>x.id)});
 d.reviewed.reviewedAt=now;d.approval.reviewedAt=now;
 for(const origin of ['history','auto']){
  d.reviews[origin].manualReviewedAt=now;
  d.statuses[origin].found=d.reviews[origin].proposals.length;
  d.statuses[origin].manualReviewCandidates=d.reviews[origin].proposals.length;
  d.statuses[origin].reviewOnlyCandidates=d.reviews[origin].proposals.filter(x=>x.reviewOnly===true).length;
  d.statuses[origin].lastReviewedBatchAt=now;
  d.statuses[origin].manuallyPublished=(d.statuses[origin].manuallyPublished||0)+changed.filter(x=>selected.some(y=>y.origin===origin&&y.r.id===x.id)).length;
  d.statuses[origin].message='Epic公式順位表と開催枠で'+changed.length+'件を通常結果へ掲載。残り'+d.reviews[origin].proposals.length+'件。';
 }
}
const report={dry,selected:selected.length,added:changed.length,
 publishedBy:Object.entries(Object.groupBy(changed,x=>x.event)).map(([k,x])=>({event:k,count:x.length})),
 cashRecords:changed.filter(x=>x.prize>0),held,heldCount:held.length,
 outOfScope,remainingHistory:d.reviews.history.proposals.length,
 remainingAuto:d.reviews.auto.proposals.length};
console.log('AOT_VERIFIED_NOV11_ROUND2 '+JSON.stringify(report));
if(!dry&&changed.length){
 const names={results:'results.json',history:'history-sync-review.json',auto:'auto-sync-review.json',
  reviewed:'history-sync-reviewed.json',historyStatus:'history-sync-status.json',
  autoStatus:'auto-sync-status.json',approval:'approval-history.json',updates:'updates.json'};
 for(const [k,n] of Object.entries(names)){
  const value=k==='history'?d.reviews.history:k==='auto'?d.reviews.auto:
   k==='historyStatus'?d.statuses.history:k==='autoStatus'?d.statuses.auto:d[k];
  write(n,value);
 }
}
