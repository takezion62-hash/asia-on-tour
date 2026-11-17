'use strict';
// Exactly two verified S37 Round 1 windows, fixed 23 original duo results.
// Published cash and non-cash finals in other rounds must never be modified.
const fs=require('node:fs'),path=require('node:path');
const {loadReviewDb,writeReviewDb,upsertPublicationLog}=require('./reviewed-publication-core.cjs');
const {validateOriginal,collision}=require('./manual-approval-core.cjs');
const {verifiedPartialPage,sameScannedCandidate}=require('./verified-partial-page.cjs');
const {validateData}=require('./data-checks.cjs');
const {audit:approvalAudit}=require('./validate-approvals.cjs');
const {validateUpdateLog}=require('./validate-updates.cjs');
const {isExplicitlyHeld}=require('./generic-review-only-core.cjs');
const proof=require('./verified-s37-console-round1-oce7-naw9-23.cjs');
const ROOT=path.resolve(__dirname,'..');
const dry=process.argv.includes('--dry-run');
const need=(ok,why)=>{if(!ok)throw Error('S37_ROUND1_BULK23 '+why)};
need(process.argv.length===2||process.argv.length===3&&dry,'only --dry-run allowed');
const db=loadReviewDb(ROOT);
db.reviewed=JSON.parse(fs.readFileSync(path.join(ROOT,'history-sync-reviewed.json'),'utf8'));
const snap=JSON.parse(fs.readFileSync(path.join(ROOT,proof.SNAPSHOT_PATH),'utf8'));
need(snap.version===1&&snap.source?.repo==='takezion62-hash/asia-on-tour'&&
 snap.source.commit===proof.SOURCE_COMMIT&&snap.source.blobSha===proof.SOURCE_BLOB&&
 Array.isArray(snap.windows)&&snap.windows.length===proof.GROUPS.length,
 'pinned immutable snapshot provenance changed');
const cal=JSON.parse(fs.readFileSync(path.join(ROOT,'calendar-history/2025-10.json'),'utf8')).sessions;
const catalog=db.tournaments.catalog.find(x=>x.id==='ch6s4-console-duos-victory');
need(catalog?.team==='duo'&&catalog.seasonId==='S37'&&
 catalog.sourceEventIds?.includes('S37_ConsoleDuosCashCups'),'official tournament catalog mismatch');
const snapshots=new Map();
for(const group of proof.GROUPS){
 const s=snap.windows.find(x=>x.key===group.key);
 const session=cal.find(x=>x.dateJst===group.date&&x.region===group.region&&
  x.sourceWindowId===group.window&&x.eventId==='S37_ConsoleDuosCashCups'&&
  x.tournamentId===catalog.id);
 const cp=s?.checkpoint,live=db.scans.history.windows[group.key];
 need(s&&session&&cp&&live&&
  s.date===group.date&&s.region===group.region&&s.eventNo===group.eventNo&&
  s.window===group.window&&s.complete===group.complete&&s.count===group.count&&
  s.rankMax===group.rankMax&&s.sessionEndUtc===session.endUtc,
  'archived official session differs: '+group.key);
 const observed=Date.parse(cp.lastSuccessAt||''),end=Date.parse(session.endUtc||'');
 need(cp.rankingOrderValid===true&&cp.complete===group.complete&&
  Number.isSafeInteger(cp.pages)&&cp.pages>0&&cp.nextPage===cp.pages&&
  Number.isSafeInteger(cp.totalPages)&&cp.totalPages>=cp.pages&&
  (cp.complete===true?cp.totalPages===cp.pages:cp.totalPages>cp.pages)&&
  cp.emptyAttempts===0&&!cp.lastError&&!cp.lastErrorCode&&!cp.retryAfter&&
  cp.lastSeenRank>=group.rankMax&&Array.isArray(cp.proposals)&&cp.proposals.length===group.count&&
  Number.isFinite(observed)&&Number.isFinite(end)&&observed-end>4*3600e3,
  'fixed mature source pages not clean: '+group.key);
 need(live.rankingOrderValid===true&&Number.isSafeInteger(live.pages)&&
  live.pages>=cp.pages&&live.nextPage===live.pages&&
  Number.isSafeInteger(live.totalPages)&&live.totalPages>=live.pages&&
  live.lastSeenRank>=cp.lastSeenRank&&live.emptyAttempts===0&&
  Array.isArray(live.proposals)&&Date.parse(live.lastSuccessAt)>=observed,
  'live scan no longer preserves pinned pages: '+group.key);
 if(live.lastError||live.lastErrorCode||live.retryAfter)
  need(live.complete===false&&live.lastErrorCode==='OSIRION_TRANSIENT'&&
   Number.isSafeInteger(live.lastErrorPage)&&live.lastErrorPage===live.nextPage&&
   live.lastErrorPage>=cp.pages,
   'live scan reports an unsafe failure, not a future transient page: '+group.key);
 snapshots.set(group.key,{cp,live,session,end});
}
need(proof.SPECS.length===23&&new Set(proof.SPECS.map(x=>x.id)).size===23,
 '23 immutable proofs required');
const previous=db.reviews.history.proposals,pending=new Map(previous.map(x=>[x.id,x]));
const reviewedIds=new Set(db.reviewed.entries.map(x=>x.id));
const now=new Date().toISOString(),added=[],already=[],stale=[];
for(const spec of proof.SPECS){
 need(!isExplicitlyHeld(spec.id),'held candidate was selected: '+spec.id);
 const group=proof.findGroup(spec),store=snapshots.get(group?.key);
 need(group&&store,'missing event snapshot: '+spec.id);
 const originals=store.cp.proposals.filter(x=>x.id===spec.id);
 const live=store.live.proposals.filter(x=>x.id===spec.id);
 need(originals.length===1&&live.length===1&&sameScannedCandidate(originals[0],live[0])&&
  proof.matchOriginal(originals[0],spec),
  'original and live Epic observations conflict: '+spec.id);
 const prior=db.results.filter(x=>x.id===spec.id),ledger=db.ledger.entries.filter(x=>x.id===spec.id);
 if(prior.length){
  need(prior.length===1&&ledger.length===1&&reviewedIds.has(spec.id)&&
   proof.validateRecord(prior[0],ledger[0]),'published record altered: '+spec.id);
  if(pending.has(spec.id)){
   need(proof.matchOriginal(pending.get(spec.id),spec)&&
    sameScannedCandidate(originals[0],pending.get(spec.id)),
    'stale pending candidate identity differs: '+spec.id);
   stale.push(spec.id);
  }
  already.push(spec.id);continue;
 }
 need(ledger.length===0&&!reviewedIds.has(spec.id),'previously approved but unpublished: '+spec.id);
 const row=pending.get(spec.id);
 need(proof.matchOriginal(row,spec)&&sameScannedCandidate(originals[0],row),
  'pending candidate original score or Epic identity differs: '+spec.id);
 validateOriginal(row,store.cp,store.session,catalog,db.players);
 if(!group.complete)need(verifiedPartialPage(row,{end:store.end},store.cp),
  'partial observed page is not mature and contiguous: '+spec.id);
 need(!db.results.some(x=>collision(x,row,db.players.confirmedAliases||{})),
  'possible duplicate in published data: '+spec.id);
 const {reviewOnly,reviewReason,...clean}=row;
 const newRow={...clean,kind:proof.expectedKind(spec),round:proof.expectedRound(spec),prize:0,
  note:group.date+' '+group.region+' Duos Console Victory Cash Cup Round 1。'+
   'Epic/Osirionの保存済み'+(group.complete?'全ページ':'正常連続ページ')+
   'からチームEpic名・順位・ポイント・キル・VR・試合を照合。'+
   '公式規則はOCE・NAWとも上位250チームがRound 2進出。'+
   (spec.rank<=proof.CUTOFF?'上位250の予選突破を確認。':'予選突破圏外の参加確認。')+
   'Round 1賞金$0。公式規則: '+proof.RULE+
   ' 元順位表: '+spec.source+' 検証済みGit blob: '+proof.SOURCE_BLOB};
 const evidence='source-verified 23; clean mature full/partial Epic scoreboard pinned blob '+proof.SOURCE_BLOB+
  '; exact player aliases, ranks and stats, top250 rule, Round1 cash $0';
 const approval={id:spec.id,recordId:spec.id,decision:'published',policy:proof.POLICY,
  approvedAt:now,approvedBy:'ChatGPT / owner authorized verified bulk review',
  source:spec.source,rule:proof.RULE,evidence};
 need(proof.validateRecord(newRow,approval),'immutable record validation failed: '+spec.id);
 db.results.push(newRow);db.ledger.entries.push(approval);
 db.reviewed.entries.push({id:spec.id,decision:'published',recordId:spec.id,
  reviewedAt:now,policy:proof.POLICY,rule:proof.RULE,source:spec.source});
 added.push({id:spec.id,region:spec.region,player:spec.player,rank:spec.rank,kind:newRow.kind,prize:0});
}
const resolved=[...added.map(x=>x.id),...stale];
if(resolved.length){
 db.reviews.history.proposals=proof.removeResolved(previous,resolved);
 db.reviews.history.manualReviewedAt=now;
 db.statuses.history.found=db.reviews.history.proposals.length;
 db.statuses.history.manualReviewCandidates=db.reviews.history.proposals.length;
 db.statuses.history.reviewOnlyCandidates=db.reviews.history.proposals.filter(x=>x.reviewOnly===true).length;
 db.statuses.history.manuallyPublished=(db.statuses.history.manuallyPublished||0)+added.length;
 db.statuses.history.lastReviewedBatchAt=now;
 db.ledger.reviewedAt=now;db.reviewed.reviewedAt=now;
 if(added.length)upsertPublicationLog(db.updates,{
  id:'verified-s37-console-round1-oce7-naw9-23-20261117',
  date:new Date(Date.parse(now)+9*3600000).toISOString().slice(0,10),
  title:'OCE/NAW 2025 Console Duos予選23件を掲載',
  description:'成熟した公式順位表からOCE 13件・NAW 10件、通過上位250/参加確認、予選賞金$0を確定。',
  recordIds:added.map(x=>x.id)
 });
 need(validateData({results:db.results,players:db.players,tournaments:db.tournaments}).errors.length===0,
  'result schema or tournament data audit failed');
 need(approvalAudit(db.results,db.ledger,db.players).length===0,
  'approval ledger audit failed');
 need(validateUpdateLog(db.results,db.updates).length===0,
  'update history audit failed');
 if(!dry){
  writeReviewDb(ROOT,db);
  fs.writeFileSync(path.join(ROOT,'history-sync-reviewed.json'),JSON.stringify(db.reviewed,null,2)+'\n');
 }
}
console.log('S37_CONSOLE_OCE_NAW_BULK23 '+JSON.stringify({
 mode:dry?'dry-run':'apply',selected:proof.SPECS.length,
 published:added.length,already:already.length,staleResolved:stale.length,
 pending:db.reviews.history.proposals.length,records:db.results.length,
 prizeAdded:0,added
}));
