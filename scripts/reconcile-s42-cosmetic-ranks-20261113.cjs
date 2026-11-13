'use strict';
/**
 * Evidence-gated reconciliation of the 12 previously published S42 cosmetic
 * outcomes that Osirion also found in Epic's official leaderboard.
 * 9 legacy Tracker ranks differ by 1–3; 3 ranks already agree.
 *
 * - Preserve all existing record IDs, roster, Epic identities, points, elims,
 *   VRs, matches, original Tracker URLs, cosmetic status and cash ($0).
 * - Correct only the nine rank fields against the saved mature Epic prefix.
 * - Resolve all 12 review candidates as already published, never append a
 *   second participation record for the same performance.
 * - Fail closed on a changed leaderboard, incomplete original identity match,
 *   unmatched tournament/calendar session, or changed existing score.
 *
 * Usage: node scripts/reconcile-s42-cosmetic-ranks-20261113.cjs --dry-run
 *        node scripts/reconcile-s42-cosmetic-ranks-20261113.cjs --apply
 */
const fs=require('node:fs');
const path=require('node:path');
const {loadReviewDb,writeReviewDb,upsertPublicationLog}=require('./reviewed-publication-core.cjs');
const {equalCandidate}=require('./manual-approval-core.cjs');
const {validateData,personalCents,roster}=require('./data-checks.cjs');
const ROOT=path.resolve(__dirname,'..');
const args=process.argv.slice(2);
const dry=args.includes('--dry-run');
if(dry===args.includes('--apply'))throw Error('S42_RECONCILE choose exactly one of --dry-run or --apply');
const assert=(ok,msg)=>{if(!ok)throw Error('S42_RECONCILE '+msg)};
const read=name=>JSON.parse(fs.readFileSync(path.join(ROOT,name),'utf8'));
const TARGETS=[
 ['auto-s42-3c18c5cad756','s42-naw-teal-knight-fncs-cup-skin-20261019-rise',96,95],
 ['auto-s42-7565a2a6d314','s42-me-slenderman-reload-skin-20261021-acris-chacha',31,30],
 ['auto-s42-ca5a20ece8cd','s42-me-slenderman-reload-skin-20261021-yuragi-shirus',48,46],
 ['auto-s42-e433103f17ab','s42-me-slenderman-reload-skin-20261021-rad-celis',44,43],
 ['auto-s42-ff1c2ecd23e2','s42-me-slenderman-reload-skin-20261021-karf-alpha',19,18],
 ['auto-s42-303fd06e5e50','s42-naw-slenderman-reload-skin-20261021-yama-piyopiyo',78,76],
 ['auto-s42-3f2ae449ebe9','s42-naw-slenderman-reload-skin-20261021-menta-shiroka',18,18],
 ['auto-s42-595558a50431','s42-naw-slenderman-reload-skin-20261021-celisyanagisawa-plank',54,52],
 ['auto-s42-b9000678c370','s42-naw-slenderman-reload-skin-20261021-ozaki-tob',73,71],
 ['auto-s42-ba6bb8b52eb0','s42-naw-slenderman-reload-skin-20261021-yukinya-tanaka',93,90],
 ['auto-s42-d2d8c6beba04','s42-naw-slenderman-reload-skin-20261021-takaya-babucchi',15,15],
 ['auto-s42-eab7f89bedb5','s42-naw-slenderman-reload-skin-20261021-kol-guppafv',4,4]
];
const sumCash=rows=>rows.reduce((s,x)=>s+(typeof x.prize==='number'?Math.round(x.prize*100):0),0);
const sumPersonal=rows=>rows.reduce((s,x)=>s+personalCents(x)*roster(x).length,0);
function reconcile(db,reviewed,calendar,now){
 const byId=new Map(db.results.map(x=>[x.id,x]));
 const found=new Set(),resolved=[],corrected=[];
 const priorCash=sumCash(db.results),priorPersonal=sumPersonal(db.results);
 const originalLength=db.results.length,reviewIds=new Set((reviewed.entries||[]).map(x=>x.id));
 const names=new Set(db.players.candidates.map(x=>x.name));
 const catalogs=new Map(db.tournaments.catalog.map(x=>[x.id,x]));
 for(const [candidateId,existingId,fromRank,toRank] of TARGETS){
  const original=byId.get(existingId);
  assert(original&&original.rank>=1,'missing original result '+existingId);
  const pending=db.reviews.history.proposals.filter(x=>x.id===candidateId);
  assert(pending.length<=1,'duplicate candidate '+candidateId);
  if(!pending.length){
   assert(original.rank===toRank&&reviewIds.has(candidateId),
    'candidate absent without verified previous reconciliation '+candidateId);
   continue;
  }
  const candidate=pending[0];
  assert(original.rank===fromRank&&candidate.rank===toRank,
    'unexpected original or authoritative rank '+candidateId);
  assert(original.verified===true&&original.kind==='スキン大会'&&original.prize===0&&
    candidate.verified===true&&candidate.kind==='参加確認'&&
    candidate.reviewOnly===true&&candidate.prize===null,
    'cosmetic award or candidate status inconsistent '+candidateId);
  for(const field of ['date','region','event','tournamentId','seasonId','chapter','season','player',
    'points','kills','vrs','matches'])
   assert(JSON.stringify(original[field])===JSON.stringify(candidate[field]),
    'performance mismatch in '+field+' for '+candidateId);
  const oldMembers=Array.isArray(original.players)?original.players:[original.player];
  const newMembers=Array.isArray(candidate.players)?candidate.players:[candidate.player];
  assert(JSON.stringify(oldMembers)===JSON.stringify(newMembers)&&
    newMembers.every(n=>names.has(n)), 'team roster or known Epic ID mismatch '+candidateId);
  assert(original.round==='Session 1 / スキン獲得'&&
    original.source.startsWith('https://fortnitetracker.com/events/epicgames_')&&
    typeof original.note==='string'&&/Tracker/.test(original.note),
    'missing original screenshot-based award '+candidateId);
  const url=new URL(candidate.source);
  const event=/^\/competitive\/events\/(S42_[A-Za-z0-9_]+)\/$/.exec(url.pathname)?.[1];
  const window=url.searchParams.get('round'),region=candidate.region;
  assert(url.protocol==='https:'&&url.hostname==='www.fortnite.com'&&
    !url.username&&!url.password&&!url.hash&&url.searchParams.size===2&&
    url.searchParams.get('region')===region&&event&&window&&
    window.endsWith('_'+region),'invalid official Epic source '+candidateId);
  const allowed=(candidateId==='auto-s42-3c18c5cad756'?
    ['S42_ChampionTealKnightFNCSCup','ch7s4-champion-teal-knight-fncs-cup-battle-royale']:
    ['S42_SlenderManCup','ch7s4-slender-man-cup-reload']);
  assert(event===allowed[0]&&candidate.tournamentId===allowed[1],
    'official tournament mismatch '+candidateId);
  const catalog=catalogs.get(candidate.tournamentId);
  assert(catalog?.seasonId==='S42'&&catalog.sourceEventIds.includes(event)&&
    catalog.name===candidate.event,'event catalog mismatch '+candidateId);
  const session=calendar.find(x=>x.dateJst===candidate.date&&x.region===region&&
    x.eventId===event&&x.sourceWindowId===window&&
    x.tournamentId===candidate.tournamentId&&x.seasonId==='S42');
  assert(session,'official session/date/region missing '+candidateId);
  const key='epicgames_'+event+'_'+region+'/'+window,checkpoint=db.scans.history.windows?.[key];
  assert(checkpoint?.rankingOrderValid===true&&checkpoint.nextPage>=1&&
    checkpoint.lastSeenRank>=toRank&&checkpoint.emptyAttempts===0&&
    !checkpoint.lastErrorCode&&!checkpoint.lastError&&!checkpoint.retryAfter&&
    Date.parse(checkpoint.lastSuccessAt)-Date.parse(session.endUtc)>4*60*60*1000,
    'saved official leaderboard not mature and clean '+candidateId);
  const match=checkpoint.proposals.filter(x=>x.id===candidateId&&equalCandidate(x,candidate));
  assert(match.length===1,'saved Epic account and score differs '+candidateId);
  assert(!reviewIds.has(candidateId)&&!found.has(candidateId),
    'review marker already published '+candidateId);
  if(fromRank!==toRank){
   original.rank=toRank;
   original.note+=' 【2026/11/13順位再照合】当初のFortnite Tracker画像では'+
    fromRank+'位。保存済みEpic公式順位表の同一Epic ID・同一スコアを優先し'+toRank+
    '位に統一。公式順位表: '+candidate.source+'。現金賞金$0・スキン獲得は変更なし。';
   corrected.push({existingId,player:original.player,fromRank,toRank});
  }
  resolved.push({candidateId,existingId,player:original.player,fromRank,toRank,
   officialSource:candidate.source,status:fromRank===toRank?'exact-duplicate':'corrected-original-rank'});
  found.add(candidateId);
  reviewed.entries.push({id:candidateId,decision:'already-published',existingId,
   reviewedAt:now,source:candidate.source,originalRank:fromRank,
   officialRank:toRank,policy:'verified-duplicate-with-official-rank',
   note:'Original screenshot-confirmed cosmetic outcome retained; saved Epic-ID rank and all score fields matched. Cash kept at $0.'});
  reviewIds.add(candidateId);
 }
 if(resolved.length){
  const done=new Set(resolved.map(x=>x.candidateId));
  db.reviews.history.proposals=db.reviews.history.proposals.filter(x=>!done.has(x.id));
  db.reviews.history.manualReviewedAt=now;
  reviewed.reviewedAt=now;
  db.statuses.history.found=db.reviews.history.proposals.length;
  db.statuses.history.manualReviewCandidates=db.reviews.history.proposals.length;
  db.statuses.history.reviewOnlyCandidates=db.reviews.history.proposals.filter(x=>x.reviewOnly===true).length;
  db.statuses.history.manuallyResolvedDuplicates=(db.statuses.history.manuallyResolvedDuplicates||0)+resolved.length;
  db.statuses.history.manuallyCorrected=(db.statuses.history.manuallyCorrected||0)+corrected.length;
  db.statuses.history.lastCorrectedReviewAt=now;
  db.statuses.history.lastReviewedBatchAt=now;
  db.statuses.history.latestManualReview={reviewedAt:now,reviewedCandidates:resolved.length,
   published:0,duplicatesResolved:resolved.length,rankCorrections:corrected.length,
   remainingPending:db.reviews.history.proposals.length,
   policy:'Original screenshot-confirmed cosmetics protected; canonical Epic rank reconciled'};
  db.statuses.history.message='同一Epic ID・大会・全スコア一致の確認候補'+resolved.length+
   '件を重複整理し、元のスキン獲得記録の順位'+corrected.length+
   '件を公式順位に訂正。賞金と掲載件数は不変。';
  if(corrected.length)upsertPublicationLog(db.updates,{
   id:'s42-cosmetic-rank-reconcile-20261113',date:'2026-11-13',
   title:'S42のスキン大会：既掲載9件を公式順位に訂正、重複候補12件を整理',
   description:'2026/10/19 NAW Teal Knight、10/21 ME/NAW Slender Man Cup。保存済みEpic公式順位・同一Epic ID・ポイント/キル/VR/試合数を照合。Tracker画像由来の順位のみ9件訂正し、3件は完全一致。12件とも重複掲載せず、既存のスキン獲得・個人ID・賞金$0を保持。',
   recordIds:corrected.map(x=>x.existingId)
  });
 }
 assert(db.results.length===originalLength&&new Set(db.results.map(x=>x.id)).size===originalLength,
  'result count or unique IDs changed');
 assert(sumCash(db.results)===priorCash&&sumPersonal(db.results)===priorPersonal,
  'cash or individual payout changed');
 const valid=validateData({results:db.results,players:db.players,tournaments:db.tournaments});
 assert(valid.errors.length===0,'data validation failed: '+valid.errors.slice(0,3).join('; '));
 return {resolved,corrected,pending:db.reviews.history.proposals.length,
  results:db.results.length,teamCashCents:sumCash(db.results)};
}
function main(){
 const db=loadReviewDb(ROOT),reviewed=read('history-sync-reviewed.json');
 const calendar=read('calendar-history/2026-10.json').sessions;
 assert(Array.isArray(reviewed.entries)&&Array.isArray(calendar),
  'archive metadata missing');
 const now=new Date().toISOString();
 const out=reconcile(db,reviewed,calendar,now);
 if(!dry&&out.resolved.length){
  writeReviewDb(ROOT,db);
  fs.writeFileSync(path.join(ROOT,'history-sync-reviewed.json'),
   JSON.stringify(reviewed,null,2)+'\n');
  const report=[
   '# 2026-11-13 S42スキン大会の順位矛盾・重複整理',
   '',
   '- 保存済みEpic公式開催枠の順位を優先',
   '- 同一選手・開催枠・ポイント・キル・VR・試合数を照合',
   '- スキン獲得・現金賞金$0・元のTracker URLと本人名義を保持',
   '- 追加戦績0件、順位修正'+out.corrected.length+'件、重複候補解決'+out.resolved.length+'件',
   '',
   '| 選手 | 元Tracker順位 | Epic順位 | 対応 |',
   '|---|---:|---:|---|',
   ...out.resolved.map(x=>'| '+x.player+' | '+x.fromRank+' | '+x.toRank+
    ' | '+(x.fromRank===x.toRank?'既存と一致':'順位訂正')+' |'),
   '',
   'Epic順位の出典は history-sync-scan.json の保存済み同一開催枠と各候補のsource欄。',
   '未確認賞金・プロフィールIDは推定せず、従来の検証済み記録を保持。'
  ].join('\n')+'\n';
  fs.mkdirSync(path.join(ROOT,'review-reports'),{recursive:true});
  fs.writeFileSync(path.join(ROOT,'review-reports/2026-11-13-s42-cosmetic-rank-reconciliation.md'),report);
 }
 console.log('S42_COSMETIC_RECONCILE '+JSON.stringify({dry,
  resolved:out.resolved.length,corrected:out.corrected.length,
  pending:out.pending,results:out.results,
  rankChanges:out.corrected.map(x=>({name:x.player,from:x.fromRank,to:x.toRank}))}));
}
if(require.main===module)main();
module.exports={reconcile,TARGETS};
