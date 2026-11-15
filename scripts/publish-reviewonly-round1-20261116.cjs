'use strict';
// User-requested verification and publication for exactly the nine original
// Round 1 non-prize candidates, plus reconciliation of one existing FNCS final.
// Uses the existing explicit manual approval planner, never auto-approves cash.
const fs=require('node:fs'),path=require('node:path');
const {loadReviewDb,writeReviewDb}=require('./reviewed-publication-core.cjs');
const {apply,equalCandidate,collision}=require('./manual-approval-core.cjs');
const {checkpointIndex,checkpointFor}=require('./review-batch-index.cjs');
const {validateData}=require('./data-checks.cjs');
const {audit}=require('./validate-approvals.cjs');
const {validateUpdateLog}=require('./validate-updates.cjs');
const {TARGETS,POLICY,byId,validateCandidate,verifiedNonprizeRow}=
 require('./verified-reviewonly-round1-20261116.cjs');
const PROOF=require('../data/manual-approvals/20261116-reviewonly-10.json');
const ROOT=path.resolve(__dirname,'..'),dry=process.argv.includes('--dry-run');
const args=process.argv.slice(2);
if(!(args.length===0||(args.length===1&&dry)))throw Error('REVIEW_ONLY_10 --dry-run or no flags');
const assert=(v,msg)=>{if(!v)throw Error('REVIEW_ONLY_10: '+msg)};
const now=new Date().toISOString();
const db=loadReviewDb(ROOT);
const reviewedFile=path.join(ROOT,'history-sync-reviewed.json');
db.reviewed=JSON.parse(fs.readFileSync(reviewedFile,'utf8'));
assert(Array.isArray(db.reviewed.entries),'reviewed history invalid');
const history=new Set(db.reviewed.entries.map(x=>x.id));
assert(history.size===db.reviewed.entries.length,'duplicated review decisions');
assert(TARGETS.length===9&&new Set(TARGETS.map(x=>x.id)).size===9,'invalid fixed target scope');
const entries=db.reviews.history.proposals.filter(r=>byId.has(r.id));
const candidateIds=new Set(entries.map(r=>r.id));
const already=TARGETS.filter(x=>!candidateIds.has(x.id));
for(const x of already){
 const record=db.results.filter(r=>r.id===x.id);
 assert(record.length===1,'target no longer pending, but is not published exactly once '+x.id);
 const ledger=db.ledger.entries.filter(e=>e.id===x.id);
 assert(ledger.length===1&&verifiedNonprizeRow(record[0],ledger[0]),
  'existing nonprize entry changed '+x.id);
}
const cpIndex=checkpointIndex(db.scans);
for(const row of entries){
 const proof=byId.get(row.id);
 assert(validateCandidate(row,proof),'candidate changed from verified original '+row.id);
 const cp=checkpointFor(row,cpIndex,equalCandidate)?.checkpoint;
 assert(cp&&cp.rankingOrderValid===true&&Number.isSafeInteger(cp.nextPage)&&cp.nextPage>0&&
  Number.isSafeInteger(cp.lastSeenRank)&&cp.lastSeenRank>=row.rank&&
  Array.isArray(cp.proposals)&&cp.proposals.filter(p=>p.id===row.id&&
   equalCandidate(p,row)&&JSON.stringify(p.teamAccountIds)===JSON.stringify(row.teamAccountIds)).length===1,
  'no saved exact Epic/Osirion leaderboard record '+row.id);
}
const seen=new Set(db.results.map(r=>r.id));
const duplicate=PROOF.existing;
const proposed=db.reviews.history.proposals.filter(x=>x.id===duplicate.candidateId);
assert(proposed.length<=1,'duplicate FNCS candidate queue');
const previouslyReviewed=db.reviewed.entries.some(x=>x.id===duplicate.candidateId);
let resolvedDuplicate=0;
if(proposed.length){
 assert(!previouslyReviewed,'FNCS was reviewed but remains queued');
 const r=proposed[0],orig=db.results.filter(x=>x.id===duplicate.existingId);
 assert(orig.length===1&&!seen.has(duplicate.candidateId),'original FNCS cash achievement must be unique');
 const o=orig[0];
 for(const key of ['date','region','tournamentId','player','rank','points','kills','vrs','matches'])
  assert(o[key]===duplicate[key]&&r[key]===duplicate[key],'FNCS candidate score or identity mismatch: '+key);
 assert(o.prize===200&&o.prizePerPlayer===100&&o.kind==='賞金決勝'&&
  Array.isArray(o.players)&&JSON.stringify(o.players)===JSON.stringify(r.players)&&
  o.teamAccountIds?.length===2&&o.verified===true,
  'original FNCS payment/team not independently confirmed');
 const u=new URL(o.source),v=new URL(r.source);
 assert(u.hostname==='fortnitetracker.com'&&v.hostname==='www.fortnite.com'&&
  u.searchParams.get('window')===v.searchParams.get('round')&&
  r.source===duplicate.source,'FNCS official event identity mismatch');
 const cp=checkpointFor(r,cpIndex,equalCandidate)?.checkpoint;
 assert(cp?.rankingOrderValid===true&&cp.nextPage>0&&cp.lastSeenRank>=r.rank&&
  cp.proposals?.some(x=>x.id===r.id&&equalCandidate(x,r)),'FNCS saved official rank not found');
 resolvedDuplicate=1;
}else if(previouslyReviewed){
 const entry=db.reviewed.entries.find(x=>x.id===duplicate.candidateId);
 assert(entry?.decision==='already-published'&&entry.existingId===duplicate.existingId,
  'FNCS original duplicate resolution changed');
}else{
 assert(db.results.some(x=>x.id===duplicate.existingId),'FNCS original result disappeared');
}
for(const row of entries){
 const month=row.date.slice(0,7);
 if(!db.calendar[month]){
  db.calendar[month]=JSON.parse(fs.readFileSync(path.join(ROOT,'calendar-history',month+'.json'),'utf8')).sessions;
  assert(Array.isArray(db.calendar[month]),'official calendar missing for '+month);
 }
}
let next=db,changes=[];
if(entries.length){
 const plan=apply(db,{ids:entries.map(x=>x.id),confirmation:'CONFIRM',
  policy:'attendance-only',runId:'review-only-round1-20261116',timestamp:now,
  actor:'ChatGPT / user-authorized exact Epic leaderboard review'});
 next={...db,...plan.next};
 changes=plan.changes;
 assert(changes.length===entries.length,'not all verified Round 1 candidates published');
 for(const x of changes){
  const p=byId.get(x.id),r=x.record;
  assert(p&&r.id===p.id&&r.reviewOnly===undefined,'approval modified source identity');
  r.prize=0;
  r.note='管理者がEpic本人ID・公式大会ウィンドウ・保存順位表を照合。'+
   p.event+' Round 1 '+p.rank+'位は決勝進出上位'+p.cutoff+
   'の圏外。Round 1は現金賞金対象外、賞金$0。突破や決勝成績を追加認定しない。'+
   '公式規則: '+p.rule+' 出典: '+p.source;
  const auditEntry=next.ledger.entries.find(e=>e.id===x.id);
  assert(auditEntry&&auditEntry.policy==='attendance-only','missing original ledger entry');
  auditEntry.policy=POLICY;
  auditEntry.rule=p.rule;
  auditEntry.evidence='Exact original Epic account IDs, leaderboard rank/score/matches, official region/event session; separately checked top-'+p.cutoff+' advancement and Round 1 no cash';
  assert(verifiedNonprizeRow(r,auditEntry),'official non-prize audit failed '+x.id);
  assert(!history.has(x.id),'already manually resolved '+x.id);
  next.reviewed.entries.push({id:x.id,decision:'published',recordId:x.id,
   reviewedAt:now,source:r.source,policy:POLICY,rule:p.rule});
 }
}
if(resolvedDuplicate){
 next.reviews.history.proposals=next.reviews.history.proposals.filter(x=>x.id!==duplicate.candidateId);
 next.reviews.history.manualReviewedAt=now;
 next.reviewed.entries.push({id:duplicate.candidateId,decision:'already-published',
  existingId:duplicate.existingId,reviewedAt:now,source:proposed[0].source,
  note:'Same verified Epic duo, original S39 ME FNCS Week5 Final rank17 132pt 9K 0VR 6 matches; keep original team $200 (each $100), do not add second award'});
}
if(changes.length||resolvedDuplicate){
 const review=next.reviews.history.proposals;
 next.statuses.history.found=review.length;
 next.statuses.history.manualReviewCandidates=review.length;
 next.statuses.history.reviewOnlyCandidates=review.filter(x=>x.reviewOnly===true).length;
 next.statuses.history.manualReviewProcessed=(next.statuses.history.manualReviewProcessed||0)+changes.length+resolvedDuplicate;
 next.statuses.history.manualReviewResolvedAt=now;
 next.reviewed.reviewedAt=now;
 next.ledger.reviewedAt=now;
 assert(new Set(next.reviewed.entries.map(x=>x.id)).size===next.reviewed.entries.length,
  'duplicate review resolution');
 assert(new Set(next.results.map(x=>x.id)).size===next.results.length,
  'duplicate published achievement');
 const v=validateData({results:next.results,players:next.players,tournaments:next.tournaments});
 assert(v.errors.length===0,'site validation failed: '+v.errors.slice(0,4));
 const a=audit(next.results,next.ledger,next.players);
 assert(a.length===0,'approval audit failed: '+a.slice(0,5));
 const u=validateUpdateLog(next.results,next.updates);
 assert(u.length===0,'update history failed: '+u.slice(0,4));
 if(!dry){
  writeReviewDb(ROOT,next);
  fs.writeFileSync(reviewedFile,JSON.stringify(next.reviewed,null,2)+'\n');
 }
}
console.log('REVIEW_ONLY_10 '+JSON.stringify({mode:dry?'dry-run':'apply',
 selected:TARGETS.length+1,added:changes.length,already:already.length,
 duplicateFNCS:resolvedDuplicate,remainingReviewOnly:next.reviews.history.proposals.filter(r=>r.reviewReason===PROOF.reviewReason).length,
 resultsBefore:db.results.length,resultsAfter:next.results.length,
 cashAdded:0,ids:changes.map(x=>x.id)}));
