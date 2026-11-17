'use strict';
// Recover ONLY six observed source rows ahead of a later HTTP429 page.
// A partial-scan error is not a payment or rank verifier: original full row,
// precise event, team Epic IDs and published official rules are still required.
const fs=require('node:fs'),path=require('node:path');
const {loadReviewDb,writeReviewDb,upsertPublicationLog}=require('./reviewed-publication-core.cjs');
const {validateOriginal,collision}=require('./manual-approval-core.cjs');
const {sameScannedCandidate}=require('./verified-partial-page.cjs');
const {isExplicitlyHeld}=require('./generic-review-only-core.cjs');
const {validateData,personalCents,roster}=require('./data-checks.cjs');
const {audit:approvalAudit}=require('./validate-approvals.cjs');
const {validateUpdateLog}=require('./validate-updates.cjs');
const proof=require('./verified-deferred-page-six.cjs');
const ROOT=path.resolve(__dirname,'..'),dry=process.argv.includes('--dry-run');
const must=(yes,reason)=>{if(!yes)throw Error('DEFERRED_SIX '+reason)};
must(process.argv.length===2||(process.argv.length===3&&dry),'only --dry-run');
const db=loadReviewDb(ROOT);
db.reviewed=JSON.parse(fs.readFileSync(path.join(ROOT,'history-sync-reviewed.json'),'utf8'));
must(proof.GROUPS.length===3&&proof.SPECS.length===6,'expected 3 groups and 6 IDs');
const groups=new Map();
for(const group of proof.GROUPS){
 must(group.sourceScanBlob==='43d4af41369f1e3fc30baf60c84de9b8062ff47b',
  'source must be known original historical scan Git blob');
 const cp=group.checkpoint,rows=proof.SPECS.filter(s=>s.group===group.tag);
 must(rows.length===2&&group.ids.length===2&&
   new Set(group.ids).size===2&&rows.every(s=>group.ids.includes(s.id)),
   'event original whitelist changed: '+group.tag);
 const high=Math.max(...rows.map(s=>s.rank));
 // The recorded *next* page failed (HTTP transient). Every selected row was
 // already observed in the earlier contiguous, ordered, uncorrupted pages.
 must(cp&&cp.complete===false&&cp.rankingOrderValid===true&&
   cp.pages>=1&&cp.nextPage===cp.pages&&cp.totalPages>cp.pages&&
   cp.lastSeenRank>=high&&cp.emptyAttempts===0&&
   cp.lastErrorCode==='OSIRION_TRANSIENT'&&
   Number.isSafeInteger(cp.lastErrorPage)&&
   cp.lastErrorPage===cp.nextPage&&
   Array.isArray(cp.proposals),
   'saved error is not strictly after the verified prefix: '+group.tag);
 const live=db.scans.history.windows[group.key];
 must(live&&live.rankingOrderValid===true&&live.pages>=cp.pages&&
   live.nextPage===live.pages&&live.totalPages>=live.pages&&
   live.lastSeenRank>=cp.lastSeenRank&&live.emptyAttempts===0&&
   Array.isArray(live.proposals)&&
   Date.parse(live.lastSuccessAt)>=Date.parse(cp.lastSuccessAt),
   'latest source scan no longer preserves observed prefix: '+group.tag);
 if(live.lastError||live.lastErrorCode||live.retryAfter)
  must(live.complete===false&&live.lastErrorCode==='OSIRION_TRANSIENT'&&
    live.lastErrorPage===live.nextPage&&live.lastErrorPage>=cp.pages,
    'live error must only be on a later unscanned page: '+group.tag);
 const first=rows[0];
 const calendar=JSON.parse(fs.readFileSync(path.join(ROOT,'calendar-history/'+first.date.slice(0,7)+'.json'),'utf8')).sessions;
 const sessions=calendar.filter(s=>s.sourceWindowId===first.windowId&&
   s.eventId===first.eventId&&s.dateJst===first.date&&s.region===first.region&&
   s.tournamentId===first.tournamentId&&s.seasonId===first.seasonId);
 must(sessions.length===1,'source event-calendar match not unique: '+group.tag);
 const end=Date.parse(sessions[0].endUtc),seen=Date.parse(cp.lastSuccessAt);
 must(Number.isFinite(end)&&Number.isFinite(seen)&&seen-end>=4*3600000&&seen<=Date.now()+300000,
  'saved rank snapshot not mature: '+group.tag);
 groups.set(group.tag,{cp,live,session:sessions[0]});
}
const pendingRows=db.reviews.history.proposals,pending=new Map(pendingRows.map(r=>[r.id,r]));
const reviewed=new Set(db.reviewed.entries.map(x=>x.id));
const oldPersonal=db.results.reduce((sum,r)=>sum+personalCents(r)*roster(r).length,0);
const now=new Date().toISOString(),added=[],already=[],stale=[];
for(const spec of proof.SPECS){
 must(!isExplicitlyHeld(spec.id),'explicitly held Epic ID must not be published: '+spec.id);
 const group=groups.get(spec.group),evidence=proof.GROUPS.find(x=>x.tag===spec.group);
 must(group&&evidence,'event group missing: '+spec.id);
 const old=group.cp.proposals.filter(x=>x.id===spec.id);
 const live=group.live.proposals.filter(x=>x.id===spec.id);
 must(old.length===1&&live.length===1&&proof.matchOriginal(old[0],spec)&&
   sameScannedCandidate(old[0],live[0]),
   'saved source Epic names, team IDs or score changed: '+spec.id);
 const cat=db.tournaments.catalog.find(c=>c.id===spec.tournamentId);
 must(cat&&cat.name===spec.event&&cat.seasonId===spec.seasonId&&
  cat.sourceEventIds?.includes(spec.eventId),'tournament catalog changed: '+spec.id);
 if(spec.seasonId==='S30')
   must(cat.team==='solo'&&cat.mode==='zero-build'&&
    spec.kind==='賞金決勝'&&spec.vrs===0&&spec.points===0&&
    spec.prize===null&&spec.matches<=3,
    'S30 Round2 0VR must be cash zero: '+spec.id);
 else if(spec.seasonId==='S37')
   must(cat.team==='duo'&&spec.kind==='予選'&&
    spec.rank>250&&spec.prize===0&&spec.matches<=7,
    'S37 NAW Round1 top250 cutoff mismatch: '+spec.id);
 else if(spec.seasonId==='S31')
   must(cat.team==='trio'&&spec.kind==='参加確認'&&
    spec.reviewOnly===true&&spec.prize===null&&
    spec.matches<=10&&spec.teamAccountIds.length===3&&
    spec.teamAccountIds.every(x=>/^[a-f0-9]{32}$/.test(x)),
    'S31 Trios Epic roster / qualification evidence incomplete: '+spec.id);
 else throw Error('DEFERRED_SIX unapproved season: '+spec.seasonId);
 const previous=db.results.filter(r=>r.id===spec.id),led=db.ledger.entries.filter(e=>e.id===spec.id);
 if(previous.length){
  must(previous.length===1&&led.length===1&&reviewed.has(spec.id)&&
   proof.validateRecord(previous[0],led[0]),'already published row/payout changed: '+spec.id);
  if(pending.has(spec.id)){
   must(proof.matchOriginal(pending.get(spec.id),spec)&&
    sameScannedCandidate(old[0],pending.get(spec.id)),'stale candidate differs');
   stale.push(spec.id);
  }
  already.push(spec.id);continue;
 }
 must(led.length===0&&!reviewed.has(spec.id),'orphan approval: '+spec.id);
 const row=pending.get(spec.id);
 must(proof.matchOriginal(row,spec)&&sameScannedCandidate(old[0],row),
  'pending candidate original snapshot changed: '+spec.id);
 validateOriginal(row,group.cp,group.session,cat,db.players);
 must(!db.results.some(x=>collision(x,row,db.players.confirmedAliases||{})),
  'same-event same-player duplicate: '+spec.id);
 const target=proof.expected(spec),rule=proof.RULES[spec.seasonId];
 const {reviewOnly,reviewReason,...clean}=row;
 const description=spec.seasonId==='S30'?
  '決勝0VRなので賞金$0。順位が3,000位台でも大会参加成績として記録。':
  spec.seasonId==='S37'?
  'NAW公式上位250チームの圏外なので予選参加のみ、賞金$0。':
  spec.rank<=198?
  '2024年ME Trios Cash Cup上位198チームのため予選突破。Round1賞金$0、決勝賞金とは分ける。':
  '2024年ME Trios Cash Cup上位198チームの圏外なので参加確認のみ。Round1賞金$0。';
 const record={...clean,kind:target.kind,round:target.round,prize:0,
  note:'Epic/Osirion順位表の正常に取得済み'+group.cp.pages+'/'+group.cp.totalPages+
   'ページの本人ID・順位・得点・キル・VRを照合。後続ページにHTTP一時エラーがあるため全順位表の取得済みとはしない。'+
   description+(spec.seasonId==='S31'?' 上位198の基準を公式規則で確認。':'')+
   ' 公式規則: '+rule+' 元順位表: '+spec.source+
   ' 固定された旧順位表Git blob: '+evidence.sourceScanBlob+
   ' 証拠: '+proof.SNAPSHOT_BLOB};
 if(spec.seasonId==='S31'){record.teamPrize=0;record.prizePerPlayer=0;}
 const approval={id:spec.id,recordId:spec.id,decision:'published',policy:proof.POLICY,
  approvedAt:now,approvedBy:'ChatGPT / owner-authorized source-backed held recovery',
  source:spec.source,rule,
  evidence:'original verified Epic ID, mature ordered prefix and later page HTTP429; '+
   proof.SNAPSHOT_BLOB+' source scan '+evidence.sourceScanBlob};
 must(proof.validateRecord(record,approval),'verified result or payout check failed: '+spec.id);
 db.results.push(record);db.ledger.entries.push(approval);
 db.reviewed.entries.push({id:spec.id,recordId:spec.id,decision:'published',reviewedAt:now,
  policy:proof.POLICY,rule,source:spec.source});
 added.push({id:spec.id,player:spec.player,kind:target.kind,prize:0});
}
const resolved=[...added.map(x=>x.id),...stale];
if(resolved.length){
 db.reviews.history.proposals=proof.removeExact(pendingRows,resolved);
 db.reviews.history.manualReviewedAt=now;
 db.statuses.history.found=db.reviews.history.proposals.length;
 db.statuses.history.manualReviewCandidates=db.reviews.history.proposals.length;
 db.statuses.history.reviewOnlyCandidates=db.reviews.history.proposals.filter(x=>x.reviewOnly===true).length;
 db.statuses.history.manuallyPublished=(db.statuses.history.manuallyPublished||0)+added.length;
 db.statuses.history.lastReviewedBatchAt=now;
 db.ledger.reviewedAt=now;db.reviewed.reviewedAt=now;
 if(added.length)upsertPublicationLog(db.updates,{
  id:'verified-six-later-page-transient-20261117',
  date:new Date(Date.parse(now)+9*3600e3).toISOString().slice(0,10),
  title:'後続ページAPIエラーから本人確認済み6成績を回復',
  description:'NAC決勝0VRの2名、NAW Console Duos予選参加2チーム、ME Trios予選1チーム・参加1チーム、賞金加算なし。',
  recordIds:added.map(x=>x.id)});
 must(validateData({results:db.results,players:db.players,tournaments:db.tournaments}).errors.length===0,
  'canonical results audit failed');
 must(approvalAudit(db.results,db.ledger,db.players).length===0,'approval audit failed');
 must(validateUpdateLog(db.results,db.updates).length===0,'updates audit failed');
 must(db.results.reduce((sum,r)=>sum+personalCents(r)*roster(r).length,0)===oldPersonal,
  'award total changed on a zero-cash batch');
 if(!dry){writeReviewDb(ROOT,db);
  fs.writeFileSync(path.join(ROOT,'history-sync-reviewed.json'),JSON.stringify(db.reviewed,null,2)+'\n');}
}
console.log('DEFERRED_SIX '+JSON.stringify({mode:dry?'dry-run':'apply',
 selected:6,added:added.length,already:already.length,stale:stale.length,
 addedCash:0,remaining:db.reviews.history.proposals.length,
 addedIds:added.map(x=>x.id)}));
