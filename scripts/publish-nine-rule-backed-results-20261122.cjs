'use strict';
// Approve only nine owner-requested, Epic-ID-verified source rows. Keep the
// source leaderboard's exact season/event/window; do not turn a participation
// label into a Grand Final or a VR into automatic cash. Partial leaderboard
// observations require mature, complete-in-order prefixes and zero API errors.
const fs=require('node:fs'),path=require('node:path');
const {loadReviewDb,writeReviewDb,upsertPublicationLog}=require('./reviewed-publication-core.cjs');
const {validateOriginal,collision}=require('./manual-approval-core.cjs');
const {sameScannedCandidate,verifiedPartialPage}=require('./verified-partial-page.cjs');
const {validateData,personalCents,roster}=require('./data-checks.cjs');
const {audit}=require('./validate-approvals.cjs');
const {validateUpdateLog}=require('./validate-updates.cjs');
const V=require('./verified-nine-rule-backed-results-20261122.cjs');
const ROOT=path.resolve(__dirname,'..');
const must=(v,reason)=>{if(!v)throw Error('PUBLISH_NINE_RULES_20261122 '+reason)};
function apply({dryRun=false}={}){
 must(V.validateProof(),'locked original snapshot or rules altered');
 const db=loadReviewDb(ROOT);
 db.reviewed=JSON.parse(fs.readFileSync(path.join(ROOT,'history-sync-reviewed.json'),'utf8'));
 const pending=new Map(db.reviews.history.proposals.map(x=>[x.id,x]));
 must(pending.size===db.reviews.history.proposals.length,'duplicate pending source IDs');
 const existingIds=new Set(db.results.map(x=>x.id));
 must(existingIds.size===db.results.length,'duplicate public IDs before update');
 const reviewed=new Set(db.reviewed.entries.map(x=>x.id));
 const initialLen=db.results.length,ledgerLen=db.ledger.entries.length;
 const initialCash=db.results.reduce((n,x)=>n+Math.round((x.prize||0)*100),0);
 const initialPersonal=db.results.reduce((n,x)=>n+personalCents(x)*roster(x).length,0);
 const months=new Map(),added=[],already=[],held=[],resolved=[];
 const verifiedAt='2026-11-22T02:24:43Z';
 for(const item of V.DOC.batch.entries){
  const r=item.source,d=item.decision;
  const duplicate=db.results.filter(x=>x.id===r.id);
  must(duplicate.length<=1,'duplicate result id '+r.id);
  if(duplicate.length){
   const previous=db.ledger.entries.filter(x=>x.recordId===r.id);
   must(previous.length===1&&V.verifyRow(duplicate[0],previous[0]),
    'previously published row not equal to evidence '+r.id);
   already.push(r.id);
   if(pending.has(r.id)){
    must(sameScannedCandidate(pending.get(r.id),r),'stale pending source changed '+r.id);
    resolved.push(r.id);
   }
   continue;
  }
  must(!reviewed.has(r.id)&&!db.ledger.entries.some(x=>x.recordId===r.id),
   'orphan approval or already reviewed candidate '+r.id);
  must(pending.has(r.id)&&sameScannedCandidate(pending.get(r.id),r),
   'source row changed or disappeared from review '+r.id);
  const u=new URL(r.source),win=u.searchParams.get('round');
  const eventId=u.pathname.match(/^\/competitive\/events\/([^/]+)\/$/u)?.[1];
  const key='epicgames_'+eventId+'_'+r.region+'/'+win;
  const cp=db.scans.history.windows[key];
  const month=r.date.slice(0,7);
  if(!months.has(month)){
   months.set(month,JSON.parse(fs.readFileSync(path.join(ROOT,'calendar-history/'+month+'.json'),'utf8')).sessions);
  }
  const matches=months.get(month).filter(s=>s.dateJst===r.date&&
   s.region===r.region&&s.eventId===eventId&&s.sourceWindowId===win&&
   s.tournamentId===r.tournamentId&&s.seasonId===r.seasonId&&s.url===r.source);
  must(matches.length===1,'official Epic archived session differs '+r.id);
  const session=matches[0],cat=db.tournaments.catalog.find(x=>x.id===r.tournamentId);
  const observed=cp?.proposals?.filter(x=>x.id===r.id&&sameScannedCandidate(x,r))||[];
  if(!cp||cp.rankingOrderValid!==true||observed.length!==1||
    !Number.isSafeInteger(cp.lastSeenRank)||cp.lastSeenRank<r.rank){
   held.push({id:r.id,reason:'original exact Epic account rank not in valid source checkpoint'});
   continue;
  }
  const complete=cp.complete===true&&
   cp.pages>=1&&cp.pages===cp.nextPage&&cp.lastSeenRank>=r.rank&&
   !cp.lastError&&!cp.lastErrorCode&&!cp.retryAfter&&!(cp.emptyAttempts>0);
  const cleanPartial=verifiedPartialPage(r,{end:Date.parse(session.endUtc)},cp);
  if(!complete&&!cleanPartial){
   held.push({id:r.id,reason:'ranking scan incomplete or error/recency makes prefix unsafe'});
   continue;
  }
  validateOriginal(r,cp,session,cat,db.players);
  const conflicts=db.results.filter(x=>collision(x,r,db.players.confirmedAliases||{}));
  if(conflicts.length){
   held.push({id:r.id,reason:'potential existing same-player event: '+conflicts.slice(0,3).map(x=>x.id).join(',')});
   continue;
  }
  must(d.prize===0,'unverified monetary payout '+r.id);
  const prefix=(cp.pages||cp.nextPage)+'/'+(cp.totalPages||cp.pages);
  const row=V.project(item,prefix),approval=V.approval(item,row);
  must(V.verifyRow(row,approval),'projection, award or exact source failed audit '+r.id);
  db.results.push(row);db.ledger.entries.push(approval);
  db.reviewed.entries.push({id:r.id,decision:'published',recordId:r.id,
   policy:V.POLICY,source:r.source,rule:d.rule,reviewedAt:verifiedAt});
  reviewed.add(r.id);added.push(row);resolved.push(r.id);
 }
 must(added.length+already.length+held.length===9,'nine-source accounting is inconsistent');
 const afterCash=db.results.reduce((n,x)=>n+Math.round((x.prize||0)*100),0);
 const afterPersonal=db.results.reduce((n,x)=>n+personalCents(x)*roster(x).length,0);
 must(db.results.length===initialLen+added.length&&
  db.ledger.entries.length===ledgerLen+added.length&&
  afterCash===initialCash&&afterPersonal===initialPersonal&&
  added.every(x=>x.prize===0),
  'published result money or previous data changed');
 if(resolved.length){
  const set=new Set(resolved);
  must(db.reviews.history.proposals.filter(x=>set.has(x.id)).length===resolved.length,
   'review list missing approved source');
  db.reviews.history.proposals=db.reviews.history.proposals.filter(x=>!set.has(x.id));
  db.reviews.history.manualReviewedAt=verifiedAt;
  db.statuses.history.found=db.reviews.history.proposals.length;
  db.statuses.history.manualReviewCandidates=db.reviews.history.proposals.length;
  db.statuses.history.reviewOnlyCandidates=db.reviews.history.proposals.filter(x=>x.reviewOnly===true).length;
  db.statuses.history.manuallyPublished=(db.statuses.history.manuallyPublished||0)+added.length;
  db.statuses.history.lastReviewedBatchAt=verifiedAt;
  db.ledger.reviewedAt=verifiedAt;db.reviewed.reviewedAt=verifiedAt;
  if(added.length){
   upsertPublicationLog(db.updates,{
    id:'review-nine-real-rounds-20261122',date:'2026-11-22',
    title:'確認待ち9件のFNCS・PS・NVIDIA・ZB Solo大会ラウンドを調査',
    description:'Epic公式の大会ID/開催枠と本人IDが一致する参加成績だけ追加。Zero Build Solo予選の地域別通過、PlayStation予選285位、FNCS Week3 Weekly Finals45位、NVIDIA単一ラウンドの賞金圏外を混同しない。今回の追加現金賞金は$0。全取得済みではない順位表は正常な連続先頭ページのみ認定。',
    recordIds:added.map(x=>x.id)});
  }
  db.updates.entries.sort((a,b)=>b.date.localeCompare(a.date));
  const errors=validateData({results:db.results,players:db.players,tournaments:db.tournaments}).errors;
  must(!errors.length,'data integrity '+JSON.stringify(errors.slice(0,5)));
  const auditErrors=audit(db.results,db.ledger,db.players);
  must(!auditErrors.length,'approval audit '+JSON.stringify(auditErrors.slice(0,5)));
  const updateErrors=validateUpdateLog(db.results,db.updates);
  must(!updateErrors.length,'update history '+JSON.stringify(updateErrors.slice(0,5)));
  if(!dryRun){
   writeReviewDb(ROOT,db);
   fs.writeFileSync(path.join(ROOT,'history-sync-reviewed.json'),JSON.stringify(db.reviewed,null,2)+'\n');
  }
 }
 const out={mode:dryRun?'dry-run':'apply',selected:9,added:added.length,existing:already.length,
  held,removedFromPending:resolved.length,pending:db.reviews.history.proposals.length,
  addedPrizeUSD:0,qualifiers:added.filter(x=>x.kind==='予選').length,
  finals:added.filter(x=>x.kind==='賞金決勝').length,
  advanced:added.filter(x=>x.round.endsWith('/ 予選突破')).length,ids:added.map(x=>x.id)};
 console.log('REVIEW_NINE_RULES_20261122 '+JSON.stringify(out));
 return out;
}
if(require.main===module)try{
 const args=process.argv.slice(2);
 must(args.length===0||(args.length===1&&args[0]==='--dry-run'),'only --dry-run is allowed');
 apply({dryRun:args.includes('--dry-run')});
}catch(e){console.error(e.stack);process.exitCode=1}
module.exports={apply};
