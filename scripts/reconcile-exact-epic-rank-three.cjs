'use strict';
// Three original Epic-ID rows whose scores agree with manually published Tracker
// skin results. Adopt the canonical saved Epic leaderboard rank only; do not
// duplicate the record, change reward eligibility or infer cash.
const path=require('node:path');
const {createPublicationFiles}=require('./reviewed-publication-core.cjs');
const {sameScannedCandidate,verifiedPartialPage}=require('./verified-partial-page.cjs');
const {read,write}=createPublicationFiles(path.resolve(__dirname,'..'));
const dry=process.argv.includes('--dry-run'),now=new Date().toISOString();
const IDS=new Map([
 ['auto-s42-74820aab699d',{published:'s42-nac-lady-liberty-br-skin-20261018-60059306',old:133,rank:132}],
 ['auto-s42-22627d16c413',{published:'s42-nac-slenderman-reload-skin-20261021-riani-maroa',old:92,rank:91}],
 ['auto-s42-f390ef958f95',{published:'s42-nac-slenderman-reload-skin-20261021-mgavariety-kuro',old:326,rank:321}]
]);
const d={
 results:read('results.json'),review:read('history-sync-review.json'),
 reviewed:read('history-sync-reviewed.json'),status:read('history-sync-status.json'),
 scan:read('history-sync-scan.json'),updates:read('updates.json'),
 players:read('players.json'),tournaments:read('tournaments.json')
};
const calendar={},known=new Set(d.players.candidates.map(x=>x.name));
const catalog=new Map(d.tournaments.catalog.map(x=>[x.id,x]));
const assert=(ok,msg)=>{if(!ok)throw Error('EPIC_RANK_RECONCILE: '+msg)};
const corrected=[],held=[];
for(const r of [...d.review.proposals]){
 const spec=IDS.get(r.id);if(!spec)continue;
 try{
  const existing=d.results.filter(x=>x.id===spec.published);
  assert(existing.length===1&&!d.results.some(x=>x.id===r.id),'existing cosmetic record missing or candidate already present');
  const old=existing[0],cat=catalog.get(r.tournamentId),members=Array.isArray(r.players)&&r.players.length?r.players:[r.player];
  assert(cat&&cat.sourceEventIds.length&&cat.name===r.event&&cat.seasonId===r.seasonId,'catalog mismatch');
  assert(members.length===({solo:1,duo:2,trio:3,squad:4}[cat.team])&&
   members.every(x=>known.has(x))&&members.join(' / ')===r.player,'Epic roster not verified');
  assert(r.verified===true&&r.reviewOnly===true&&r.kind==='参加確認'&&r.prize===null
   &&old.verified===true&&old.kind==='スキン大会'&&old.prize===0&&
   old.rank===spec.old&&r.rank===spec.rank&&r.rank!==old.rank
   &&r.date===old.date&&r.region===old.region&&r.tournamentId===old.tournamentId
   &&r.event===old.event&&r.player===old.player,'different results or unsupported reward change');
  assert(['points','kills','vrs','matches'].every(k=>old[k]===r[k]),'other score stats differ');
  const u=new URL(r.source),event=u.pathname.match(/^\/competitive\/events\/([^/]+)\/$/)?.[1],
    window=u.searchParams.get('round');
  assert(u.protocol==='https:'&&u.hostname==='www.fortnite.com'&&
   u.searchParams.get('region')===r.region&&cat.sourceEventIds.includes(event)&&
   window&&window.endsWith('_'+r.region),'official Epic source mismatch');
  const month=r.date.slice(0,7);
  if(!calendar[month])calendar[month]=read('calendar-history/'+month+'.json').sessions;
  const session=calendar[month].find(x=>x.eventId===event&&x.sourceWindowId===window&&
    x.dateJst===r.date&&x.region===r.region&&x.tournamentId===r.tournamentId&&x.seasonId===r.seasonId);
  assert(session&&session.url===r.source,'official schedule mismatch');
  const cp=d.scan.windows['epicgames_'+event+'_'+r.region+'/'+window];
  assert(cp&&cp.rankingOrderValid===true&&cp.lastSeenRank>=r.rank&&
    cp.proposals.filter(x=>x.id===r.id&&sameScannedCandidate(x,r)).length===1,'original Epic ID/rank/score mismatch');
  assert((cp.complete===true&&cp.nextPage>=cp.totalPages)||
    verifiedPartialPage(r,{end:Date.parse(session.endUtc)},cp),'unsettled score page');
  assert(!d.reviewed.entries.some(x=>x.id===r.id),'candidate already resolved');
  const trackerSource=old.source;
  old.rank=r.rank;
  old.source=r.source;
  old.note=String(old.note||'')+' 【順位の出典統一】保存済みEpic公式の本人ID・開催枠・順位表を再照合。'
   +'元のTracker画像では'+spec.old+'位、Epic公式順位表では'+r.rank+
   '位。順位のみEpic側へ統一し、'+r.points+'pt・'+r.kills+'K・'+r.vrs+
   'VR・'+r.matches+'試合・スキン扱い・賞金$0は変更なし。元のTracker出典: '+trackerSource;
  d.review.proposals=d.review.proposals.filter(x=>x.id!==r.id);
  d.reviewed.entries.push({id:r.id,decision:'already-published',existingId:old.id,
    verifiedAt:now,source:r.source,note:'Same Epic roster and stats; only official rank reconciled, no duplicate record'});
  corrected.push({candidateId:r.id,recordId:old.id,player:r.player,from:spec.old,to:spec.rank});
 }catch(e){held.push({id:r.id,reason:String(e.message||e)})}
}
if(corrected.length){
 const key='epic-rank-reconcile-20261111-three';
 assert(!d.updates.entries.some(x=>x.id===key),'already recorded rank update');
 d.updates.entries.unshift({id:key,date:new Date(Date.parse(now)+9*3600000).toISOString().slice(0,10),
  type:'records',title:'同一スキン大会のTracker/Epic順位差3件を統一',
  description:'公式Epic ID・開催枠と成熟した保存順位表で最終採用順位を確認。旧Tracker順位も各戦績の注記に保存。キル・VR・ポイント・スキン報酬・賞金は変更せず、二重掲載なし。',
  recordIds:corrected.map(x=>x.recordId)});
 d.review.manualReviewedAt=now;d.reviewed.reviewedAt=now;
 d.status.found=d.review.proposals.length;
 d.status.manualReviewCandidates=d.review.proposals.length;
 d.status.reviewOnlyCandidates=d.review.proposals.filter(x=>x.reviewOnly===true).length;
 d.status.manuallyCorrected=(d.status.manuallyCorrected||0)+corrected.length;
 d.status.manuallyResolvedDuplicates=(d.status.manuallyResolvedDuplicates||0)+corrected.length;
 d.status.lastReviewedBatchAt=now;
 d.status.message='Epic本人IDの保存済み順位表で3件の順位差を統一。重複登録せず、残り確認待ち'+d.review.proposals.length+'件。';
}
console.log('AOT_EPIC_RANK_RECONCILIATION '+JSON.stringify({dry,corrected,held,remaining:d.review.proposals.length}));
if(!dry&&corrected.length){
 for(const [name,val] of [['results.json',d.results],['history-sync-review.json',d.review],
  ['history-sync-reviewed.json',d.reviewed],['history-sync-status.json',d.status],['updates.json',d.updates]])
 write(name,val);
}
