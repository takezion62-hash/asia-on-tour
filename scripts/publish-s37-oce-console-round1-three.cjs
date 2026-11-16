'use strict';
// Safely publish only three proof-pinned 2025-08-24 OCE Console Duos Round 1
// achievements. S37 official top-250 is explicitly checked; prize is always $0.
const fs=require('node:fs'),path=require('node:path');
const {loadReviewDb,writeReviewDb,upsertPublicationLog}=require('./reviewed-publication-core.cjs');
const {validateOriginal,equalCandidate,collision}=require('./manual-approval-core.cjs');
const {validateData}=require('./data-checks.cjs');
const {audit:approvalAudit}=require('./validate-approvals.cjs');
const {validateUpdateLog}=require('./validate-updates.cjs');
const {isExplicitlyHeld}=require('./generic-review-only-core.cjs');
const proof=require('./verified-s37-oce-console-round1-three.cjs');
const ROOT=path.resolve(__dirname,'..');
const dry=process.argv.includes('--dry-run');
if(process.argv.length>3||process.argv.length===3&&!dry)
 throw Error('S37_OCE_ROUND1 --dry-run or no arguments only');
const requireValid=(ok,why)=>{if(!ok)throw Error('S37_OCE_ROUND1 '+why)};
const db=loadReviewDb(ROOT);
db.reviewed=JSON.parse(fs.readFileSync(path.join(ROOT,'history-sync-reviewed.json'),'utf8'));
const sessions=JSON.parse(fs.readFileSync(path.join(ROOT,'calendar-history/2025-08.json'),'utf8')).sessions;
const session=sessions.find(x=>x.sourceWindowId===proof.WINDOW&&x.eventId===proof.EVENT&&
 x.region==='OCE'&&x.dateJst==='2025-08-24'&&x.tournamentId==='ch6s4-console-duos-victory');
requireValid(!!session,'official event session missing');
const checkpoint=db.scans.history.windows[proof.KEY];
requireValid(!!checkpoint&&checkpoint.complete===true&&checkpoint.rankingOrderValid===true&&
 checkpoint.pages===26&&checkpoint.nextPage===26&&checkpoint.totalPages===26&&
 checkpoint.lastSeenRank>=1570&&checkpoint.emptyAttempts===0&&
 !checkpoint.lastError&&!checkpoint.lastErrorCode&&!checkpoint.retryAfter,
 'original full 26-page Epic leaderboard not intact');
requireValid(Date.parse(checkpoint.lastSuccessAt)>Date.parse(session.endUtc)+4*3600*1000,
 'leaderboard snapshot not mature');
requireValid(db.tournaments.catalog.some(x=>x.id==='ch6s4-console-duos-victory'&&
 x.team==='duo'&&x.seasonId==='S37'&&x.sourceEventIds?.includes(proof.EVENT)),
 'official tournament catalog changed');
const history=db.reviews.history.proposals;
const pending=new Map(history.map(x=>[x.id,x]));
const oldIDs=new Set(db.results.map(x=>x.id));
const existingReviews=new Set(db.reviewed.entries.map(x=>x.id));
const now=new Date().toISOString(),added=[],already=[];
for(const spec of proof.SPECS){
 requireValid(!isExplicitlyHeld(spec.id),'an explicit manual hold overrides this batch: '+spec.id);
 const old=db.results.filter(x=>x.id===spec.id);
 const ledger=db.ledger.entries.filter(x=>x.id===spec.id);
 if(old.length){
  requireValid(old.length===1&&ledger.length===1&&proof.validatedRecord(old[0],ledger[0])&&
   !pending.has(spec.id)&&existingReviews.has(spec.id),'previously published proof mismatch: '+spec.id);
  already.push(spec.id);
  continue;
 }
 requireValid(ledger.length===0&&!existingReviews.has(spec.id),'unpublished approval already exists: '+spec.id);
 const row=pending.get(spec.id);
 requireValid(proof.matchesOriginal(row,spec),'pinned original Epic result changed: '+spec.id);
 requireValid(checkpoint.proposals.filter(x=>equalCandidate(x,row)).length===1,
  'unique exact Epic leaderboard candidate not found: '+spec.id);
 validateOriginal(row,checkpoint,session,db.tournaments.catalog.find(x=>x.id===row.tournamentId),db.players);
 requireValid(!db.results.some(x=>collision(x,row,db.players.confirmedAliases||{})),
  'a conflicting record already exists: '+spec.id);
 const {reviewOnly,reviewReason,...clean}=row;
 const record={...clean,kind:proof.expectedKind(spec),round:proof.expectedRound(spec),prize:0,
  note:'2025/8/24 OCE Duos Console Victory Cash Cup Event 2 Round 1。Epic公式ウィンドウと保存済み全26/26ページの順位表で本人・チーム・順位・成績を照合。'+
    '公式規則はOCE上位250チームがRound 2進出、Round 1の現金賞金$0。'+
    (spec.rank<=proof.CUTOFF?'上位250内につき予選突破（決勝の賞金は別途判定）。':'上位250外につき参加確認のみ（予選突破・決勝成績は認定しない）。')+
    '公式規則: '+proof.RULE+' 元の順位表: '+proof.SOURCE};
 requireValid(proof.validatedRecord(record,{id:spec.id,recordId:spec.id,decision:'published',
  policy:proof.POLICY,rule:proof.RULE,source:proof.SOURCE,evidence:'complete 26/26'}),'result proof failure: '+spec.id);
 db.results.push(record);
 db.ledger.entries.push({id:spec.id,decision:'published',recordId:spec.id,policy:proof.POLICY,
  approvedAt:now,approvedBy:'ChatGPT / owner authorized exact three-team review',
  source:proof.SOURCE,rule:proof.RULE,
  evidence:'Fully scanned mature Epic leaderboard 26/26; official region/date/session and original named duo result; S37 OCE top-250 rule; no inferred cash'});
 db.reviewed.entries.push({id:spec.id,decision:'published',recordId:spec.id,
  reviewedAt:now,policy:proof.POLICY,rule:proof.RULE,source:proof.SOURCE});
 added.push({id:spec.id,player:record.player,rank:record.rank,kind:record.kind,prize:record.prize});
}
if(added.length){
 const addedIds=new Set(added.map(x=>x.id));
 db.reviews.history.proposals=history.filter(x=>!addedIds.has(x.id));
 db.reviews.history.manualReviewedAt=now;
 db.statuses.history.found=db.reviews.history.proposals.length;
 db.statuses.history.manualReviewCandidates=db.reviews.history.proposals.length;
 db.statuses.history.reviewOnlyCandidates=db.reviews.history.proposals.filter(x=>x.reviewOnly===true).length;
 db.statuses.history.manuallyPublished=(db.statuses.history.manuallyPublished||0)+added.length;
 db.statuses.history.lastReviewedBatchAt=now;
 db.ledger.reviewedAt=now;db.reviewed.reviewedAt=now;
 const jst=new Date(Date.parse(now)+9*3600000).toISOString().slice(0,10);
 upsertPublicationLog(db.updates,{
  id:'verified-s37-oce-console-duos-round1-20261116-three',date:jst,
  title:'OCE 2025 Console Duos予選の確認済み成績3件を掲載',
  description:'Epic公式順位表26/26ページ・本人/ペア・開催日・OCE上位250の規則を個別照合。1チームは予選突破、2チームは参加確認。予選現金賞金$0。',
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
console.log('S37_OCE_CONSOLE_ROUND1 '+JSON.stringify({mode:dry?'dry-run':'apply',
 selected:proof.SPECS.length,published:added.length,already:already.length,
 added,remainingPending:db.reviews.history.proposals.length,
 originalCount:db.results.length-added.length,afterCount:db.results.length,
 addedPersonalPrize:0,addedTeamPrize:0}));
