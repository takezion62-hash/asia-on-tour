'use strict';
// A single event-neutral runner for *explicitly* reviewed candidate snapshots.
// No guessed rules, no amount inference and no publication from the queue alone.
const fs=require('node:fs'),path=require('node:path');
const {loadReviewDb,writeReviewDb}=require('./reviewed-publication-core.cjs');
const {apply,candidatesFor,equalCandidate}=require('./manual-approval-core.cjs');
const {checkpointIndex,checkpointFor}=require('./review-batch-index.cjs');
const {sameScannedCandidate}=require('./verified-partial-page.cjs');
const {validateData}=require('./data-checks.cjs');
const {audit}=require('./validate-approvals.cjs');
const {validateUpdateLog}=require('./validate-updates.cjs');
const {POLICY,sha,approvals,pinnedRule,sameStoredEvidence,
 zeroNote,verifyPublishedZero}=require('./generic-review-only-core.cjs');
const ROOT=path.resolve(__dirname,'..');
function assert(ok,msg){if(!ok)throw Error('GENERIC_REVIEW '+msg)}
function plan(db,decisions,{timestamp=new Date().toISOString()}={}){
 const pending=candidatesFor(db),index=checkpointIndex(db.scans),
  existing=new Map(db.results.map(r=>[r.id,r])),
  ledger=new Map(db.ledger.entries.map(e=>[e.id,e]));
 let next={...db},verified=0,skipped=0;
 const grouped={ 'zero-round1':[], 'attendance-only':[] };
 const used=new Set();
 for(const decision of decisions){
  const snapshot=decision.candidate;
  assert(!used.has(snapshot.id),'duplicate approval '+snapshot.id);
  used.add(snapshot.id);
  const item=pending.get(snapshot.id),old=existing.get(snapshot.id);
  if(!item){
   assert(old,'review ID disappeared before publication '+snapshot.id);
   const entry=ledger.get(snapshot.id);
   assert(entry&&entry.source===snapshot.source&&
     entry.recordId===snapshot.id,'prior publication missing audit '+snapshot.id);
   if(decision.decision==='zero-round1')
    assert(verifyPublishedZero(old,entry,decision),'previous zero-cash approval changed '+snapshot.id);
   else
    assert(entry.policy==='attendance-only'&&old.kind==='参加確認'&&
      old.prize===null&&old.verified===true&&
      sameStoredEvidence(old,snapshot),
      'previous attendance-only proof changed '+snapshot.id);
   skipped++;
   continue;
  }
  const row=item.row;
  assert(row.reviewOnly===true&&row.verified===true&&
    sameStoredEvidence(row,snapshot)&&row.kind===snapshot.kind&&
    row.prize===snapshot.prize,'approved candidate changed '+snapshot.id);
  const matched=checkpointFor(row,index,equalCandidate);
  assert(matched&&matched.checkpoint.rankingOrderValid===true&&
   Number.isSafeInteger(matched.checkpoint.nextPage)&&
   matched.checkpoint.nextPage>0&&
   Number.isSafeInteger(matched.checkpoint.lastSeenRank)&&
   row.rank<=matched.checkpoint.lastSeenRank&&
   Array.isArray(matched.checkpoint.proposals)&&
   matched.checkpoint.proposals.filter(x=>x.id===snapshot.id&&
    sameScannedCandidate(x,row)&&
    sameStoredEvidence(x,snapshot)).length===1,
   'original Epic leaderboard not verified '+snapshot.id);
  assert(!matched.checkpoint.lastErrorCode&&!matched.checkpoint.lastError&&
   !matched.checkpoint.retryAfter&&!matched.checkpoint.emptyAttempts,
   'unresolved source scan error '+snapshot.id);
  const month=row.date.slice(0,7);
  if(!next.calendar[month]){
   const file=path.join(ROOT,'calendar-history',month+'.json');
   assert(fs.existsSync(file),'official calendar missing '+month);
   const raw=JSON.parse(fs.readFileSync(file,'utf8'));
   assert(Array.isArray(raw.sessions),'invalid official calendar '+month);
   next.calendar[month]=raw.sessions;
  }
  if(decision.decision==='zero-round1')
   assert(pinnedRule(snapshot,decision.ruleId),'unsupported awardless event/rule '+snapshot.id);
  grouped[decision.decision].push(decision);
  verified++;
 }
 const changes=[];
 for(const type of ['attendance-only','zero-round1']){
  const group=grouped[type];if(!group.length)continue;
  const ids=group.map(x=>x.candidate.id);
  assert(ids.length<=20,'bounded maximum 20 approvals per policy batch');
  const runId='generic-review-'+type+'-'+sha(ids.slice().sort()).slice(0,16);
  const result=apply(next,{ids,confirmation:'CONFIRM',
   policy:'attendance-only',runId,timestamp,
   actor:'ChatGPT / explicit source-reviewed approval manifest'});
  assert(result.changes.length===group.length&&!result.skipped.length,
   'original manual planner held an approval');
  next={...next,results:result.next.results,reviews:result.next.reviews,
   statuses:result.next.statuses,ledger:result.next.ledger,updates:result.next.updates};
  for(const approval of group){
   const id=approval.candidate.id;
   const record=next.results.find(r=>r.id===id);
   const entry=next.ledger.entries.find(e=>e.id===id);
   assert(record&&entry,'manual approval omitted verified candidate '+id);
   if(type==='zero-round1'){
    const rule=pinnedRule(approval.candidate,approval.ruleId);
    record.prize=0;
    record.note=zeroNote(approval.candidate,rule);
    entry.policy=POLICY;
    entry.rule=rule.url;
    entry.candidateHash=sha(approval.candidate);
    entry.recordHash=sha(record);
    entry.evidence='Exact original Epic UUID, score, event window and official zero-cash Round 1 cutoff. Rule-backed non-qualification, no inferred cash.';
    assert(verifyPublishedZero(record,entry,approval),'zero-cash audit failed '+id);
   }else{
    assert(record.prize===null&&record.kind==='参加確認'&&
      sameStoredEvidence(record,approval.candidate),
      'attendance-only approval unexpectedly inferred a reward '+id);
   }
   assert(!next.reviewed.entries.some(e=>e.id===id),'repeated reviewed entry '+id);
   next.reviewed.entries.push({
    id,decision:'published',recordId:id,
    reviewedAt:timestamp,source:record.source,policy:entry.policy,rule:entry.rule
   });
   changes.push({id,kind:record.kind,prize:record.prize,decision:type});
  }
 }
 if(changes.length){
  next.reviewed.reviewedAt=timestamp;
  next.statuses.history.manualReviewProcessed=
   (next.statuses.history.manualReviewProcessed||0)+changes.filter(x=>
    db.reviews.history.proposals.some(r=>r.id===x.id)).length;
  next.statuses.history.manualReviewResolvedAt=timestamp;
  next.ledger.reviewedAt=timestamp;
  assert(new Set(next.results.map(r=>r.id)).size===next.results.length,
   'duplicate result ID after approval');
  assert(new Set(next.reviewed.entries.map(e=>e.id)).size===next.reviewed.entries.length,
   'duplicate reviewed ID after approval');
  const valid=validateData({results:next.results,players:next.players,tournaments:next.tournaments});
  assert(valid.errors.length===0,'data validation failed '+valid.errors.slice(0,3));
  const problems=audit(next.results,next.ledger,next.players);
  assert(problems.length===0,'approval audit failed '+problems.slice(0,3));
  const errors=validateUpdateLog(next.results,next.updates);
  assert(errors.length===0,'update history failed '+errors.slice(0,3));
  const cents=x=>x.reduce((n,r)=>n+Math.round((r.prize||0)*100),0);
  assert(cents(db.results)===cents(next.results),'cash was changed by review-only publication');
 }
 return {next,changes,verified,already:skipped};
}
function main(){
 const argv=process.argv.slice(2),dry=argv.includes('--dry-run');
 assert(argv.length===0||(argv.length===1&&dry),'only --dry-run supported');
 const db=loadReviewDb(ROOT);
 db.reviewed=JSON.parse(fs.readFileSync(path.join(ROOT,'history-sync-reviewed.json'),'utf8'));
 assert(Array.isArray(db.reviewed.entries),'reviewed ledger invalid');
 const all=approvals();
 const result=plan(db,all);
 if(!dry&&result.changes.length){
  writeReviewDb(ROOT,result.next);
  fs.writeFileSync(path.join(ROOT,'history-sync-reviewed.json'),
   JSON.stringify(result.next.reviewed,null,2)+'\n');
 }
 console.log('GENERIC_REVIEW_RESULT '+JSON.stringify({
  dry,manualApprovals:all.length,verified:result.verified,
  added:result.changes.length,alreadyPublished:result.already,
  cashAdded:0,resultsBefore:db.results.length,
  resultsAfter:result.next.results.length,
  changes:result.changes
 }));
}
if(require.main===module){try{main()}catch(err){console.error(err.stack||err);process.exitCode=1}}
module.exports={plan,main};
