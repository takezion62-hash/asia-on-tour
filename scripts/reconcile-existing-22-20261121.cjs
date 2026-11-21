'use strict';
// Remove only 22 verified duplicate candidates whose full score is identical
// to a previously published official Final/Nvidia prize record. No publication,
// awarding, or modification of existing player achievements.
const fs=require('node:fs'),path=require('node:path');
const {loadReviewDb,writeReviewDb}=require('./reviewed-publication-core.cjs');
const {validateOriginal}=require('./manual-approval-core.cjs');
const {sameScannedCandidate}=require('./verified-partial-page.cjs');
const {validateData,personalCents,roster}=require('./data-checks.cjs');
const {audit}=require('./validate-approvals.cjs');
const {validateUpdateLog}=require('./validate-updates.cjs');
const V=require('./verified-existing-22-20261121.cjs');
const ROOT=path.resolve(__dirname,'..');
const fail=(ok,message)=>{if(!ok)throw Error('RECONCILE_EXISTING_22 '+message)};
function apply({dryRun=false}={}){
 fail(V.validateProof(),'original exact-pair proof changed');
 const db=loadReviewDb(ROOT);
 db.reviewed=JSON.parse(fs.readFileSync(path.join(ROOT,'history-sync-reviewed.json'),'utf8'));
 const originals=new Map(db.results.map(x=>[x.id,x]));
 fail(originals.size===db.results.length,'existing result ID conflict');
 const reviews=new Map(db.reviews.history.proposals.map(x=>[x.id,x]));
 fail(reviews.size===db.reviews.history.proposals.length,'duplicate historical review ID');
 const examined=new Map(db.reviewed.entries.map(x=>[x.id,x]));
 fail(examined.size===db.reviewed.entries.length,'duplicate reviewed ledger ID');
 const ledgerLen=db.ledger.entries.length,oldLen=db.results.length;
 const cash=db.results.reduce((n,r)=>Math.round(n+Math.round((r.prize||0)*100)),0);
 const personal=db.results.reduce((n,r)=>n+personalCents(r)*roster(r).length,0);
 const months=new Map(),resolved=[],already=[];
 for(const item of V.DOC.batch.records){
  const candidate=item.candidate,oldProof=item.existing,old=originals.get(oldProof.id);
  fail(V.matchPublished(old,item),'existing publication stats or cash changed '+candidate.id);
  fail(!originals.has(candidate.id)&&!db.ledger.entries.some(x=>x.id===candidate.id),
   'the candidate has already been published as separate result '+candidate.id);
  const looked=examined.get(candidate.id),row=reviews.get(candidate.id);
  if(!row){
   fail(looked&&looked.decision==='already-published'&&
     looked.existingId===old.id&&looked.source===candidate.source,
     'resolved candidate with different decision '+candidate.id);
   already.push(candidate.id);
   continue;
  }
  fail(!looked&&V.matchCandidate(row,item),'pending original Epic candidate differs '+candidate.id);
  const u=new URL(row.source);
  const eventId=u.pathname.split('/')[3],windowId=u.searchParams.get('round');
  const key='epicgames_'+eventId+'_'+row.region+'/'+windowId;
  const cp=db.scans.history.windows[key];
  fail(cp&&cp.rankingOrderValid===true&&cp.nextPage>=1&&
    cp.lastSeenRank>=row.rank&&Array.isArray(cp.proposals)&&
    cp.proposals.filter(x=>x.id===row.id&&sameScannedCandidate(x,row)).length===1,
    'saved original Epic-ID/score leaderboard not found '+row.id);
  const month=row.date.slice(0,7);
  if(!months.has(month))
   months.set(month,JSON.parse(fs.readFileSync(path.join(ROOT,'calendar-history/'+month+'.json'),'utf8')).sessions);
  const sessions=months.get(month).filter(s=>s.dateJst===row.date&&
   s.region===row.region&&s.eventId===eventId&&s.sourceWindowId===windowId&&
   s.tournamentId===row.tournamentId&&s.seasonId===row.seasonId);
  fail(sessions.length===1&&sessions[0].url===row.source,
   'official session date/region mismatched '+row.id);
  const cat=db.tournaments.catalog.find(t=>t.id===row.tournamentId);
  validateOriginal(row,cp,sessions[0],cat,db.players);
  // Rank+score and EXACT tournament window prove it is the same record.
  // '参加確認' is an importer label, not a reason to double-count a final.
  fail(V.matchCandidate(row,item)&&V.matchPublished(old,item),
   'original candidate and published row do not match '+row.id);
  db.reviewed.entries.push({id:row.id,decision:'already-published',existingId:old.id,
   source:row.source,verifiedAt:'2026-11-21T14:31:52Z',
   note:'Exact previously published player, official Epic event window, rank, points, kills, VR and matches; payout and existing final stage unchanged'});
  resolved.push(row.id);
 }
 fail(resolved.length+already.length===22,'target duplication count changed');
 fail(db.results.length===oldLen&&db.ledger.entries.length===ledgerLen&&
  db.results.reduce((n,r)=>n+Math.round((r.prize||0)*100),0)===cash&&
  db.results.reduce((n,r)=>n+personalCents(r)*roster(r).length,0)===personal,
  'results/prize/approval ledger changed');
 if(resolved.length){
  const ids=new Set(resolved);
  fail(db.reviews.history.proposals.filter(x=>ids.has(x.id)).length===resolved.length,
   'pending IDs missing before deletion');
  db.reviews.history.proposals=db.reviews.history.proposals.filter(x=>!ids.has(x.id));
  db.reviews.history.manualReviewedAt='2026-11-21T14:31:52Z';
  db.statuses.history.found=db.reviews.history.proposals.length;
  db.statuses.history.manualReviewCandidates=db.reviews.history.proposals.length;
  db.statuses.history.reviewOnlyCandidates=db.reviews.history.proposals.filter(x=>x.reviewOnly===true).length;
  db.statuses.history.manuallyResolvedDuplicates=(db.statuses.history.manuallyResolvedDuplicates||0)+resolved.length;
  db.statuses.history.lastReviewedBatchAt='2026-11-21T14:31:52Z';
  db.reviewed.reviewedAt='2026-11-21T14:31:52Z';
  fail(!validateData({results:db.results,players:db.players,tournaments:db.tournaments}).errors.length,
   'invalid prior result data');
  fail(!audit(db.results,db.ledger,db.players).length,'prior approval audit failed');
  fail(!validateUpdateLog(db.results,db.updates).length,'prior update log failed');
  if(!dryRun){
   writeReviewDb(ROOT,db);
   fs.writeFileSync(path.join(ROOT,'history-sync-reviewed.json'),
    JSON.stringify(db.reviewed,null,2)+'\n');
  }
 }
 const result={mode:dryRun?'dry-run':'apply',reconciled:resolved.length,
  alreadyReconciled:already.length,addedResults:0,addedCash:0,
  pendingAfter:db.reviews.history.proposals.length,ids:resolved};
 console.log('EXACT_EXISTING_22 '+JSON.stringify(result));
 return result;
}
if(require.main===module)try{
 const args=process.argv.slice(2);
 fail(args.length===0||(args.length===1&&args[0]==='--dry-run'),'only --dry-run');
 apply({dryRun:args.includes('--dry-run')});
}catch(e){console.error(e.stack);process.exitCode=1}
module.exports={apply};
