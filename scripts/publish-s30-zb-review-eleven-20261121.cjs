'use strict';
// Owner-authorized selective candidate publisher; verifies the original
// Osirion Epic-ID rows and official event sessions before mutating shards.
// Never promotes a 2024 NA out-of-top5000 Round1 result to a finalist.
const fs=require('node:fs'),path=require('node:path');
const {loadReviewDb,writeReviewDb,upsertPublicationLog}=require('./reviewed-publication-core.cjs');
const {validateOriginal,collision}=require('./manual-approval-core.cjs');
const {verifiedPartialPage,sameScannedCandidate}=require('./verified-partial-page.cjs');
const {validateData,personalCents,roster}=require('./data-checks.cjs');
const {audit}=require('./validate-approvals.cjs');
const {validateUpdateLog}=require('./validate-updates.cjs');
const V=require('./verified-s30-zb-review-eleven-20261121.cjs');
const ROOT=path.resolve(__dirname,'..');
const must=(ok,why)=>{if(!ok)throw Error('PUBLISH_S30_ZB_REVIEW_ELEVEN '+why)};
function apply({dryRun=false}={}){
 must(V.validateProof()===true,'proof changed');
 const db=loadReviewDb(ROOT);
 db.reviewed=JSON.parse(fs.readFileSync(path.join(ROOT,'history-sync-reviewed.json'),'utf8'));
 const catalog=db.tournaments.catalog.find(x=>x.id===V.TOURNAMENT);
 must(catalog&&catalog.team==='solo'&&catalog.seasonId==='S30'&&
  catalog.sourceEventIds.includes(V.EVENT),'catalog changed');
 const pending=new Map(db.reviews.history.proposals.map(r=>[r.id,r]));
 must(pending.size===db.reviews.history.proposals.length,'duplicate pending IDs');
 const approvedIds=new Set(db.reviewed.entries.map(x=>x.id));
 const months={};
 const originalRows=db.results.length;
 const beforeCash=db.results.reduce((n,r)=>n+Math.round((r.prize||0)*100),0);
 const beforePersonal=db.results.reduce((n,r)=>n+personalCents(r)*roster(r).length,0);
 const published=[],existing=[],cleaned=[];
 const checkedAt='2026-11-21T10:19:59Z';
 for(const item of V.DOC.batch.entries){
  const r=item.source,decision=item.expected;
  const eventNo=Number(r.round.match(/^Event (\d+)/iu)?.[1]);
  const roundNumber=decision.kind==='賞金決勝'?2:1;
  const windowId=V.EVENT+'_Event'+eventNo+'Round'+roundNumber+'_'+r.region;
  const key='epicgames_'+V.EVENT+'_'+r.region+'/'+windowId;
  const checkpoint=db.scans.history.windows[key];
  const month=r.date.slice(0,7);
  if(!months[month]){
   months[month]=JSON.parse(fs.readFileSync(path.join(ROOT,'calendar-history/'+month+'.json'),'utf8')).sessions;
  }
  const sessions=months[month].filter(x=>x.sourceWindowId===windowId&&
   x.eventId===V.EVENT&&x.region===r.region&&x.dateJst===r.date&&
   x.seasonId==='S30'&&x.tournamentId===V.TOURNAMENT);
  must(sessions.length===1,'missing/ambiguous archived Epic session '+r.id);
  const session=sessions[0];
  const existingRecord=db.results.filter(x=>x.id===r.id);
  must(existingRecord.length<=1,'duplicate result IDs '+r.id);
  if(existingRecord.length){
   const approvals=db.ledger.entries.filter(x=>x.recordId===r.id);
   must(approvals.length===1&&V.verifyRow(existingRecord[0],approvals[0]),
    'previously published row does not match immutable proof '+r.id);
   existing.push(r.id);
   if(pending.has(r.id)){
    must(sameScannedCandidate(pending.get(r.id),r),'stale review changed '+r.id);
    cleaned.push(r.id);
   }
   continue;
  }
  must(pending.has(r.id)&&sameScannedCandidate(pending.get(r.id),r),
   'original pending row changed or disappeared '+r.id);
  must(!approvedIds.has(r.id)&&!db.ledger.entries.some(x=>x.recordId===r.id),
   'stale approval or reviewed decision before publication '+r.id);
  must(checkpoint?.rankingOrderValid===true&&
   Array.isArray(checkpoint.proposals)&&
   checkpoint.proposals.filter(x=>x.id===r.id&&sameScannedCandidate(x,r)).length===1,
   'original Epic-ID scan row not reproduced '+r.id);
  must(Number.isSafeInteger(checkpoint.lastSeenRank)&&checkpoint.lastSeenRank>=r.rank,
   'source scan does not reach original rank '+r.id);
  must(!checkpoint.lastError&&!checkpoint.lastErrorCode&&!checkpoint.retryAfter&&
   !checkpoint.emptyAttempts,'source scan reported unresolved failure '+r.id);
  must(checkpoint.complete===true&&
   checkpoint.pages>=1&&checkpoint.nextPage===checkpoint.pages
   ||verifiedPartialPage(r,{end:Date.parse(session.endUtc)},checkpoint),
   'leaderboard not complete or mature clean prefix '+r.id);
  validateOriginal(r,checkpoint,session,catalog,db.players);
  // Explicitly non-colliding with any already published rank, player or
  // official session. An unrecognized legacy record blocks rather than merges.
  const collisions=db.results.filter(x=>collision(x,r,db.players.confirmedAliases||{}));
  must(!collisions.length,'existing same-identity event conflict: '+r.id+
   ' ['+collisions.slice(0,2).map(x=>x.id).join(',')+']');
  if(decision.kind==='予選'){
   must(r.region==='NAC'&&r.prize===0&&decision.prize===0&&
     decision.qualification===(r.rank<=V.CUTOFF?'advanced':'not-advanced'),
    'invalid NA top5000 qualifier class '+r.id);
  }else{
   must(r.region==='OCE'&&r.vrs===1&&r.prize===null&&
    decision.prize===100&&r.matches<=3,
    'OCE Round2 official one-VR $100 prize not confirmed '+r.id);
  }
  const row=V.project(item),approval=V.approval(item);
  must(V.verifyRow(row,approval),'new verified output violates immutable proof '+r.id);
  db.results.push(row);db.ledger.entries.push(approval);
  db.reviewed.entries.push({id:r.id,decision:'published',recordId:r.id,policy:V.POLICY,
   source:r.source,rule:V.RULE,reviewedAt:checkedAt});
  approvedIds.add(r.id);
  published.push(row);cleaned.push(r.id);
 }
 must(published.length+existing.length===11,
  'not all selected eleven reviews accounted for');
 const cashDelta=published.reduce((n,x)=>n+Math.round(x.prize*100),0);
 const personalDelta=published.reduce((n,x)=>n+personalCents(x)*roster(x).length,0);
 must(cashDelta===personalDelta&&
   (published.length?cashDelta<=10000:true)&&
   db.results.length===originalRows+published.length&&
   db.results.reduce((n,r)=>n+Math.round((r.prize||0)*100),0)===beforeCash+cashDelta&&
   db.results.reduce((n,r)=>n+personalCents(r)*roster(r).length,0)===beforePersonal+personalDelta,
   'old rows or awards affected');
 if(cleaned.length){
  const set=new Set(cleaned);
  must(db.reviews.history.proposals.filter(x=>set.has(x.id)).length===set.size,
   'selected pending ids are missing from review queue');
  db.reviews.history.proposals=db.reviews.history.proposals.filter(x=>!set.has(x.id));
  db.reviews.history.manualReviewedAt=checkedAt;
  db.statuses.history.found=db.reviews.history.proposals.length;
  db.statuses.history.manualReviewCandidates=db.reviews.history.proposals.length;
  db.statuses.history.reviewOnlyCandidates=db.reviews.history.proposals.filter(x=>x.reviewOnly===true).length;
  db.statuses.history.manuallyPublished=(db.statuses.history.manuallyPublished||0)+published.length;
  db.statuses.history.lastReviewedBatchAt=checkedAt;
  db.ledger.reviewedAt=checkedAt;
  db.reviewed.reviewedAt=checkedAt;
  if(published.length)upsertPublicationLog(db.updates,{
   id:'source-reviewed-s30-zb-11-20261121',date:'2026-11-21',
   title:'2024 NAC ZB Solo予選10件・OCE決勝$100の追加調査掲載',
   description:'Osirion保存済みEpic本人IDと公式開催枠により、NAC 2024/7/16・8/6 Round1 10成績（上位5000進出は1名のみ、賞金$0）とOCE 2024/6/3 Round2 1VR=$100 1成績を照合。参加確認・予選・賞金決勝を分離し、同じ開催枠・選手の重複を防止。賞金受領完了は未確認。',
   recordIds:published.map(x=>x.id)});
  db.updates.entries.sort((a,b)=>b.date.localeCompare(a.date));
  const errs=validateData({results:db.results,players:db.players,tournaments:db.tournaments}).errors;
  must(!errs.length,'data integrity '+JSON.stringify(errs.slice(0,5)));
  const auditErrors=audit(db.results,db.ledger,db.players);
  must(!auditErrors.length,'approval audit '+JSON.stringify(auditErrors.slice(0,5)));
  const updates=validateUpdateLog(db.results,db.updates);
  must(!updates.length,'update history '+JSON.stringify(updates.slice(0,5)));
  if(!dryRun){
   writeReviewDb(ROOT,db);
   fs.writeFileSync(path.join(ROOT,'history-sync-reviewed.json'),
    JSON.stringify(db.reviewed,null,2)+'\n');
  }
 }
 const result={mode:dryRun?'dry-run':'apply',added:published.length,already:existing.length,
  removedFromReview:cleaned.length,addedCash:cashDelta/100,
  qualifiers:published.filter(x=>x.kind==='予選').length,
  finals:published.filter(x=>x.kind==='賞金決勝').length,
  pending:db.reviews.history.proposals.length,ids:published.map(x=>x.id)};
 console.log('PUBLISH_S30_ZB_REVIEW_ELEVEN '+JSON.stringify(result));
 return result;
}
if(require.main===module)try{
 const args=process.argv.slice(2);
 must(args.length===0||(args.length===1&&args[0]==='--dry-run'),
 'only --dry-run accepted');
 apply({dryRun:args.includes('--dry-run')});
}catch(e){console.error(e.stack);process.exitCode=1}
module.exports={apply};
