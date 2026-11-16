'use strict';
// Publish only 14 independently proof-pinned NAW S37 event 6 Round 1 records.
// Mature *observed* prefix is allowed; never infer missing rankings or Round2 cash.
const fs=require('node:fs'),path=require('node:path');
const {loadReviewDb,writeReviewDb,upsertPublicationLog}=require('./reviewed-publication-core.cjs');
const {validateOriginal,collision}=require('./manual-approval-core.cjs');
const {verifiedPartialPage,sameScannedCandidate}=require('./verified-partial-page.cjs');
const {validateData}=require('./data-checks.cjs');
const {audit:approvalAudit}=require('./validate-approvals.cjs');
const {validateUpdateLog}=require('./validate-updates.cjs');
const {isExplicitlyHeld}=require('./generic-review-only-core.cjs');
const proof=require('./verified-s37-naw-event6-round1-remaining14.cjs');
const ROOT=path.resolve(__dirname,'..');
const dry=process.argv.includes('--dry-run');
if(process.argv.length>3||(process.argv.length===3&&!dry))
 throw Error('S37_NAW_EVENT6_REMAINING14 --dry-run or no arguments only');
const requireValid=(ok,why)=>{if(!ok)throw Error('S37_NAW_EVENT6_REMAINING14 '+why)};
const db=loadReviewDb(ROOT);
db.reviewed=JSON.parse(fs.readFileSync(path.join(ROOT,'history-sync-reviewed.json'),'utf8'));
const sessions=JSON.parse(fs.readFileSync(path.join(ROOT,'calendar-history/2025-09.json'),'utf8')).sessions;
const session=sessions.find(x=>x.sourceWindowId===proof.WINDOW&&x.eventId===proof.EVENT&&
 x.region==='NAW'&&x.dateJst==='2025-09-28'&&x.tournamentId==='ch6s4-console-duos-victory');
requireValid(!!session,'official event session missing');
const liveCheckpoint=db.scans.history.windows[proof.KEY];
// Pin the earlier pristine 12/62-page checkpoint by an immutable Git blob.
// A later HTTP 500 on an unscanned page must not erase already verified rows.
const archive=JSON.parse(fs.readFileSync(path.join(ROOT,'data/manual-approvals/s37-naw-event6-round1-mature-checkpoint-20261116.json'),'utf8'));
requireValid(archive.version===1&&archive.source?.repository==='takezion62-hash/asia-on-tour'&&
 archive.source.commit===proof.ARCHIVE_COMMIT&&archive.source.blobSha===proof.ARCHIVE_BLOB&&
 archive.source.key===proof.KEY,
 'locked original Git evidence provenance mismatch');
const checkpoint=archive.checkpoint;
const end=Date.parse(session.endUtc),observed=Date.parse(checkpoint?.lastSuccessAt||'');
requireValid(checkpoint&&checkpoint.complete===false&&
 checkpoint.rankingOrderValid===true&&checkpoint.pages===12&&
 checkpoint.nextPage===12&&checkpoint.totalPages===62&&
 checkpoint.lastSeenRank>=Math.max(...proof.SPECS.map(x=>x.rank))&&
 checkpoint.emptyAttempts===0&&!checkpoint.lastError&&!checkpoint.lastErrorCode&&!checkpoint.retryAfter&&
 Array.isArray(checkpoint.proposals)&&checkpoint.proposals.length===18&&
 Number.isFinite(observed)&&Number.isFinite(end)&&observed-end>4*3600000,
 'immutable 12-page source evidence must be pristine, mature and contiguous');
// The live scan may have continued beyond the archived prefix. It must still
// contain the same verified rows. Only an error on the NEXT unscanned page is
// tolerated; changed rows, malformed scans or gaps always stop publication.
requireValid(liveCheckpoint&&liveCheckpoint.rankingOrderValid===true&&
 Number.isSafeInteger(liveCheckpoint.pages)&&liveCheckpoint.pages>=checkpoint.pages&&
 liveCheckpoint.nextPage===liveCheckpoint.pages&&
 Number.isSafeInteger(liveCheckpoint.totalPages)&&liveCheckpoint.totalPages>=liveCheckpoint.pages&&
 Number.isSafeInteger(liveCheckpoint.lastSeenRank)&&
 liveCheckpoint.lastSeenRank>=checkpoint.lastSeenRank&&
 liveCheckpoint.emptyAttempts===0&&Array.isArray(liveCheckpoint.proposals)&&
 Date.parse(liveCheckpoint.lastSuccessAt)>=observed,
 'current leaderboard does not preserve the locked clean prefix');
if(liveCheckpoint.lastError||liveCheckpoint.lastErrorCode||liveCheckpoint.retryAfter){
 requireValid(liveCheckpoint.complete===false&&
  liveCheckpoint.lastErrorCode==='OSIRION_TRANSIENT'&&
  Number.isSafeInteger(liveCheckpoint.lastErrorPage)&&
  liveCheckpoint.lastErrorPage===liveCheckpoint.nextPage&&
  liveCheckpoint.lastErrorPage>=checkpoint.pages,
  'only a transient error on a later unscanned page can be tolerated');
}
console.log('S37_NAW_EVENT6_LOCKED_EVIDENCE '+JSON.stringify({
 archivedBlob:proof.ARCHIVE_BLOB,archivedPages:checkpoint.pages,
 livePages:liveCheckpoint.pages,liveLastSeenRank:liveCheckpoint.lastSeenRank,
 liveDeferredPage:liveCheckpoint.lastErrorPage||null,
 liveErrorCode:liveCheckpoint.lastErrorCode||null,
 selected:proof.SPECS.length
}));
requireValid(db.tournaments.catalog.some(x=>x.id==='ch6s4-console-duos-victory'&&
 x.team==='duo'&&x.seasonId==='S37'&&x.sourceEventIds?.includes(proof.EVENT)),
 'official tournament catalog changed');
const history=db.reviews.history.proposals,pending=new Map(history.map(x=>[x.id,x]));
const existingReviews=new Set(db.reviewed.entries.map(x=>x.id));
const now=new Date().toISOString(),added=[],already=[],stalePending=[];
for(const spec of proof.SPECS){
 requireValid(!isExplicitlyHeld(spec.id),'an explicit hold overrides batch: '+spec.id);
 const old=db.results.filter(x=>x.id===spec.id);
 const ledger=db.ledger.entries.filter(x=>x.id===spec.id);
 if(old.length){
  requireValid(old.length===1&&ledger.length===1&&proof.validatedRecord(old[0],ledger[0])&&
   existingReviews.has(spec.id),'existing published data mismatch: '+spec.id);
  // Repair the historical bug where the publisher compared an ID Set with
  // whole objects, leaving an already-published candidate in the raw queue.
  // Never remove an entry whose original identity or rank has changed.
  if(pending.has(spec.id)){
   const row=pending.get(spec.id);
   requireValid(proof.matchesOriginal(row,spec)&&
    checkpoint.proposals.filter(x=>sameScannedCandidate(x,row)).length===1&&
    liveCheckpoint.proposals.filter(x=>sameScannedCandidate(x,row)).length===1,
    'published candidate still pending but its original proof differs: '+spec.id);
   stalePending.push(spec.id);
  }
  already.push(spec.id);
  continue;
 }
 requireValid(ledger.length===0&&!existingReviews.has(spec.id),'unpublished approval already exists: '+spec.id);
 const row=pending.get(spec.id);
 requireValid(proof.matchesOriginal(row,spec),'pinned candidate rank, Epic names or values changed: '+spec.id);
 requireValid(checkpoint.proposals.filter(x=>sameScannedCandidate(x,row)).length===1&&
  liveCheckpoint.proposals.filter(x=>sameScannedCandidate(x,row)).length===1,
  'unique exact saved Epic leaderboard candidate missing: '+spec.id);
 if(checkpoint.complete!==true)requireValid(verifiedPartialPage(row,{end},checkpoint),
  'observed leaderboard pages are not mature, contiguous and error-free: '+spec.id);
 validateOriginal(row,checkpoint,session,db.tournaments.catalog.find(x=>x.id===row.tournamentId),db.players);
 requireValid(!db.results.some(x=>collision(x,row,db.players.confirmedAliases||{})),
  'conflicting result exists: '+spec.id);
 const {reviewOnly,reviewReason,...clean}=row;
 const record={...clean,kind:proof.expectedKind(spec),round:proof.expectedRound(spec),prize:0,
  note:'2025/9/28 NAW Duos Console Victory Cash Cup Event6 Round1。'+
   'Epic保存済みの連続順位表と本人Epic名・ペア・順位・キル・VR・試合数・公式開催枠を照合。'+
   '全ページの取得は未完了でも、当該チームの成熟した順位表ページを個別確認。'+
   '公式規則ではNAW上位250チームがRound2進出。'+
   (spec.rank<=proof.CUTOFF?'上位250の予選突破を確認。':'上位250外なので参加確認のみ。')+
   'Round1賞金$0（決勝の賞金は別の成績で判断）。'+
   '公式規則: '+proof.RULE+' 順位表: '+proof.SOURCE+
   ' 保存済み正常取得ページのGit blob: '+proof.ARCHIVE_BLOB};
 const evidence='mature contiguous observed leaderboard from pinned original Git blob '+proof.ARCHIVE_BLOB+'; verified exact Epic duo/rank/stats; official NAW top250; no inferred Round1 cash';
 requireValid(proof.validatedRecord(record,{id:spec.id,recordId:spec.id,decision:'published',
  policy:proof.POLICY,rule:proof.RULE,source:proof.SOURCE,evidence}),
  'result proof failure: '+spec.id);
 db.results.push(record);
 db.ledger.entries.push({id:spec.id,decision:'published',recordId:spec.id,policy:proof.POLICY,
  approvedAt:now,approvedBy:'ChatGPT / owner authorized larger 14-record batch',
  source:proof.SOURCE,rule:proof.RULE,evidence});
 db.reviewed.entries.push({id:spec.id,decision:'published',recordId:spec.id,
  reviewedAt:now,policy:proof.POLICY,rule:proof.RULE,source:proof.SOURCE});
 added.push({id:spec.id,player:record.player,rank:record.rank,kind:record.kind,prize:record.prize});
}
const resolvedIds=[...added.map(x=>x.id),...stalePending];
if(resolvedIds.length){
 db.reviews.history.proposals=proof.removeResolvedPending(history,resolvedIds);
 db.reviews.history.manualReviewedAt=now;
 db.statuses.history.found=db.reviews.history.proposals.length;
 db.statuses.history.manualReviewCandidates=db.reviews.history.proposals.length;
 db.statuses.history.reviewOnlyCandidates=db.reviews.history.proposals.filter(x=>x.reviewOnly===true).length;
 db.statuses.history.manuallyPublished=(db.statuses.history.manuallyPublished||0)+added.length;
 db.statuses.history.lastReviewedBatchAt=now;
 db.ledger.reviewedAt=now;db.reviewed.reviewedAt=now;
 const jst=new Date(Date.parse(now)+9*3600000).toISOString().slice(0,10);
 if(added.length)upsertPublicationLog(db.updates,{
  id:'verified-s37-naw-event6-round1-remaining14-20261116',date:jst,
  title:'NAW 2025 Console Duos予選成績14件を追加',
  description:'保存済み成熟・連続順位表とEpic本人情報、NAW上位250の公式規則を個別照合。予選突破8件、参加確認6件、予選賞金$0。',
  recordIds:added.map(x=>x.id)
 });
 requireValid(validateData({results:db.results,players:db.players,tournaments:db.tournaments}).errors.length===0,
  'published result data validation failed');
 requireValid(approvalAudit(db.results,db.ledger,db.players).length===0,
  'published approval history validation failed');
 requireValid(validateUpdateLog(db.results,db.updates).length===0,
  'published update history validation failed');
 if(!dry){
  writeReviewDb(ROOT,db);
  fs.writeFileSync(path.join(ROOT,'history-sync-reviewed.json'),JSON.stringify(db.reviewed,null,2)+'\n');
 }
}
console.log('S37_NAW_EVENT6_REMAINING14 '+JSON.stringify({mode:dry?'dry-run':'apply',
 selected:proof.SPECS.length,published:added.length,already:already.length,stalePendingResolved:stalePending.length,added,
 remainingPending:db.reviews.history.proposals.length,
 originalCount:db.results.length-added.length,afterCount:db.results.length,
 addedPersonalPrize:0,addedTeamPrize:0}));
