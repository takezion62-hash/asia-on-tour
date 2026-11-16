'use strict';
// Publish exactly four NAW S37 qualifier records corroborated by existing finals.
// Keep the partial scoreboard partial; no inferred Round 1 cash payout.
const fs=require('node:fs'),path=require('node:path');
const {loadReviewDb,writeReviewDb,upsertPublicationLog}=require('./reviewed-publication-core.cjs');
const {validateOriginal,equalCandidate,collision}=require('./manual-approval-core.cjs');
const {validateData}=require('./data-checks.cjs');
const {audit:approvalAudit}=require('./validate-approvals.cjs');
const {validateUpdateLog}=require('./validate-updates.cjs');
const {isExplicitlyHeld}=require('./generic-review-only-core.cjs');
const proof=require('./verified-s37-naw-console-event6-round1-four.cjs');
const ROOT=path.resolve(__dirname,'..');
const dry=process.argv.includes('--dry-run');
if(process.argv.length>3||process.argv.length===3&&!dry)
 throw Error('S37_NAW_ROUND1 --dry-run or no arguments only');
const requireValid=(ok,why)=>{if(!ok)throw Error('S37_NAW_ROUND1 '+why)};
const db=loadReviewDb(ROOT);
db.reviewed=JSON.parse(fs.readFileSync(path.join(ROOT,'history-sync-reviewed.json'),'utf8'));
const sessions=JSON.parse(fs.readFileSync(path.join(ROOT,'calendar-history/2025-09.json'),'utf8')).sessions;
const session=sessions.find(x=>x.sourceWindowId===proof.WINDOW&&x.eventId===proof.EVENT&&
 x.region==='NAW'&&x.dateJst==='2025-09-28'&&x.tournamentId==='ch6s4-console-duos-victory');
requireValid(!!session,'official event session missing');
const checkpoint=db.scans.history.windows[proof.KEY];
requireValid(!!checkpoint&&checkpoint.rankingOrderValid===true&&
 Number.isSafeInteger(checkpoint.nextPage)&&checkpoint.nextPage>=1&&
 Number.isSafeInteger(checkpoint.lastSeenRank)&&checkpoint.lastSeenRank>=220&&
 Array.isArray(checkpoint.proposals),
 'saved partial leaderboard checkpoint insufficient for selected ranks');
requireValid(Date.parse(checkpoint.lastSuccessAt)>Date.parse(session.endUtc)+4*3600000,
 'original leaderboard snapshot not mature');
requireValid(db.tournaments.catalog.some(x=>x.id==='ch6s4-console-duos-victory'&&
 x.team==='duo'&&x.seasonId==='S37'&&x.sourceEventIds?.includes(proof.EVENT)),
 'official tournament catalog changed');
const history=db.reviews.history.proposals;
const pending=new Map(history.map(x=>[x.id,x]));
const existingReviews=new Set(db.reviewed.entries.map(x=>x.id));
const now=new Date().toISOString(),added=[],already=[];
for(const spec of proof.SPECS){
 requireValid(!isExplicitlyHeld(spec.id),'explicit manual hold overrides this batch: '+spec.id);
 requireValid(proof.verifiedFinal(spec,db.results),
  'separate verified Round 2 finalist evidence missing or changed: '+spec.id);
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
  'unique exact stored leaderboard candidate not found: '+spec.id);
 validateOriginal(row,checkpoint,session,db.tournaments.catalog.find(x=>x.id===row.tournamentId),db.players);
 requireValid(!db.results.some(x=>collision(x,row,db.players.confirmedAliases||{})),
  'a conflicting record already exists: '+spec.id);
 const {reviewOnly,reviewReason,...clean}=row;
 const record={...clean,kind:proof.expectedKind(),round:proof.expectedRound(),prize:0,
  note:'2025/9/28 NAW Duos Console Victory Cash Cup Event 6 Round 1。保存済み順位表の対象行、Epic本人・ペア・開催枠を照合。'+
   '順位表全ページ取得は未完了のため完全性は主張しない。公式規則ではNAW上位250が決勝進出。'+
   '同日Round 2の本人同一チームの確認済み決勝戦績 '+spec.finalId+
   ' が別途掲載されており予選突破を独立に裏付ける。Round 1現金賞金$0。'+
   '公式規則: '+proof.RULE+' 元の順位表: '+proof.SOURCE};
 const evidence='Saved mature partial Epic leaderboard and exact rank/score, matched existing verified Round 2 final '+spec.finalId+
  ', official NAW top-250; no inferred Round 1 cash';
 requireValid(proof.validatedRecord(record,{id:spec.id,recordId:spec.id,decision:'published',
  policy:proof.POLICY,rule:proof.RULE,source:proof.SOURCE,evidence}),
  'result proof failure: '+spec.id);
 db.results.push(record);
 db.ledger.entries.push({id:spec.id,decision:'published',recordId:spec.id,policy:proof.POLICY,
  approvedAt:now,approvedBy:'ChatGPT / owner authorized third verified batch',
  source:proof.SOURCE,rule:proof.RULE,evidence});
 db.reviewed.entries.push({id:spec.id,decision:'published',recordId:spec.id,
  reviewedAt:now,policy:proof.POLICY,rule:proof.RULE,source:proof.SOURCE});
 added.push({id:spec.id,player:record.player,rank:record.rank,kind:record.kind,prize:record.prize});
}
if(added.length){
 const ids=new Set(added.map(x=>x.id));
 db.reviews.history.proposals=history.filter(x=>!ids.has(x.id));
 db.reviews.history.manualReviewedAt=now;
 db.statuses.history.found=db.reviews.history.proposals.length;
 db.statuses.history.manualReviewCandidates=db.reviews.history.proposals.length;
 db.statuses.history.reviewOnlyCandidates=db.reviews.history.proposals.filter(x=>x.reviewOnly===true).length;
 db.statuses.history.manuallyPublished=(db.statuses.history.manuallyPublished||0)+added.length;
 db.statuses.history.lastReviewedBatchAt=now;
 db.ledger.reviewedAt=now;db.reviewed.reviewedAt=now;
 const jst=new Date(Date.parse(now)+9*3600000).toISOString().slice(0,10);
 upsertPublicationLog(db.updates,{
  id:'verified-s37-naw-console-event6-round1-four-20261116',date:jst,
  title:'NAW 2025 Console Duos予選突破4チームを掲載',
  description:'Epic保存順位表と同日の既存賞金決勝4チームで予選突破を相互照合。予選現金賞金$0。決勝成績・賞金は維持。',
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
console.log('S37_NAW_CONSOLE_ROUND1 '+JSON.stringify({mode:dry?'dry-run':'apply',
 selected:proof.SPECS.length,published:added.length,already:already.length,
 added,remainingPending:db.reviews.history.proposals.length,
 originalCount:db.results.length-added.length,afterCount:db.results.length,
 addedPersonalPrize:0,addedTeamPrize:0}));
