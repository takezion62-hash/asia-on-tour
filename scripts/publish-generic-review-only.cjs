'use strict';
// A single event-neutral runner for *explicitly* reviewed candidate snapshots.
// No guessed rules, no amount inference and no publication from the queue alone.
const fs=require('node:fs'),path=require('node:path');
const {loadReviewDb,writeReviewDb}=require('./reviewed-publication-core.cjs');
const {publishResults}=require('./source-results-store.cjs');
const {apply,candidatesFor,equalCandidate}=require('./manual-approval-core.cjs');
const {checkpointIndex,checkpointFor}=require('./review-batch-index.cjs');
const {sameScannedCandidate}=require('./verified-partial-page.cjs');
const {validateData}=require('./data-checks.cjs');
const {audit}=require('./validate-approvals.cjs');
const {validateUpdateLog}=require('./validate-updates.cjs');
const {POLICY,MANIFEST,sha,approvals,pinnedRule,sameStoredEvidence,
 zeroNote,verifyPublishedZero}=require('./generic-review-only-core.cjs');
const ROOT=path.resolve(__dirname,'..');
function assert(ok,msg){if(!ok)throw Error('GENERIC_REVIEW '+msg)}
// Fail-closed reconciliation: a legacy broad reviewer mistakenly published
// an explicitly held candidate despite missing the original Epic UUID.
// Return ONLY the pinned, originally documented result IDs to the queue.
// Existing unrelated records, cash and audit entries must be untouched.
function reconcileHeld(db,{timestamp=new Date().toISOString()}={}){
 let restored=0;
 const ids=new Set();
 const checkpoints=checkpointIndex(db.scans);
 for(const hold of MANIFEST.held||[]){
  const original=hold.candidate,id=hold.id;
  assert(original&&original.id===id&&!original.teamAccountIds&&
   original.reviewOnly===true&&original.verified===true&&
   original.prize===null&&original.kind==='参加確認',
   'held snapshot not source-verifiable '+id);
  assert(!ids.has(id),'duplicated held candidate '+id);
  ids.add(id);
  const results=db.results.filter(r=>r.id===id);
  const pending=[...db.reviews.auto.proposals,...db.reviews.history.proposals]
   .filter(r=>r.id===id);
  assert(results.length<=1&&pending.length<=1&&!(results.length&&pending.length),
   'held candidate has conflicting published and pending copies '+id);
  if(!results.length){
   assert(pending.length===1&&sameStoredEvidence(pending[0],original),
    'held candidate missing and not queued '+id);
   continue;
  }
  const row=results[0],auditRows=db.ledger.entries.filter(e=>e.id===id),
   reviewed=db.reviewed.entries.filter(e=>e.id===id);
  assert(row.kind==='参加確認'&&row.prize===null&&row.verified===true&&
    row.source===original.source&&sameStoredEvidence(row,original),
   'cannot reverse verified or altered held entry '+id);
  assert(auditRows.length===1&&auditRows[0].policy==='attendance-only'&&
    auditRows[0].recordId===id&&auditRows[0].source===row.source&&
    Date.parse(auditRows[0].approvedAt)>=Date.parse('2026-11-16T05:20:00Z'),
   'held candidate was not recently published by fallback reviewer '+id);
  assert(reviewed.length<=1&&(!reviewed.length||
    (reviewed[0].decision==='published'&&reviewed[0].recordId===id)),
   'held candidate prior review conflicts '+id);
  const cp=checkpointFor(original,checkpoints,equalCandidate);
  assert(cp&&cp.checkpoint.rankingOrderValid===true&&
    cp.checkpoint.proposals?.some(x=>x.id===id&&
      sameScannedCandidate(x,original)),
   'original held Epic checkpoint is missing '+id);
  let seenLog=false;
  const changed=[];
  for(const update of db.updates.entries){
   if(!Array.isArray(update.recordIds)||!update.recordIds.includes(id)){
    changed.push(update);continue;
   }
   assert(update.type==='records'&&update.id?.startsWith('review-publication-'),
    'unknown update history entry references a held candidate '+id);
   seenLog=true;
   update.recordIds=update.recordIds.filter(x=>x!==id);
   if(update.recordIds.length){
    if(/^管理者確認済み戦績 \d+件を追加$/.test(update.title||''))
     update.title='管理者確認済み戦績 '+update.recordIds.length+'件を追加';
    changed.push(update);
   }
  }
  assert(seenLog,'held candidate update reference missing '+id);
  db.updates.entries=changed;
  db.results=db.results.filter(r=>r.id!==id);
  db.ledger.entries=db.ledger.entries.filter(e=>e.id!==id);
  db.reviewed.entries=db.reviewed.entries.filter(e=>e.id!==id);
  db.reviews.history.proposals.push(original);
  restored++;
 }
 if(restored){
  db.reviews.history.manualReviewedAt=timestamp;
  db.statuses.history.found=db.reviews.history.proposals.length;
  db.statuses.history.manualReviewCandidates=db.reviews.history.proposals.length;
  db.statuses.history.reviewOnlyCandidates=db.reviews.history.proposals
   .filter(r=>r.reviewOnly===true).length;
  db.statuses.history.manualReviewProcessed=Math.max(0,
   (db.statuses.history.manualReviewProcessed||0)-restored);
  db.statuses.history.manualReviewResolvedAt=timestamp;
  db.reviewed.reviewedAt=timestamp;
  db.ledger.reviewedAt=timestamp;
  assert(new Set(db.results.map(r=>r.id)).size===db.results.length,
   'duplicate results after held recovery');
 }
 return restored;
}

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
  const all=grouped[type];if(!all.length)continue;
  for(let start=0;start<all.length;start+=20){
  const group=all.slice(start,start+20),ids=group.map(x=>x.candidate.id);
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
 const db=loadReviewDb(ROOT),originalIds=new Set(db.results.map(r=>r.id));
 db.reviewed=JSON.parse(fs.readFileSync(path.join(ROOT,'history-sync-reviewed.json'),'utf8'));
 assert(Array.isArray(db.reviewed.entries),'reviewed ledger invalid');
 const all=approvals();
 const restored=reconcileHeld(db);
 const result=plan(db,all);
 if(!dry&&(result.changes.length||restored)){
  if(restored){
   const afterIds=new Set(result.next.results.map(r=>r.id));
   const dropped=[...originalIds].filter(id=>!afterIds.has(id));
   const allowed=new Set(MANIFEST.held?.map(x=>x.id)||[]);
   assert(dropped.length===restored&&dropped.every(id=>allowed.has(id)),
    'unexpected source-result deletion outside exact reviewed hold IDs');
   // The source store normally forbids EVERY deletion. Only this explicitly
   // verified, bounded two-ID reconciliation receives narrow opt-in.
   publishResults(ROOT,result.next.results,{allowRemoval:true});
  }
  writeReviewDb(ROOT,result.next);
  fs.writeFileSync(path.join(ROOT,'history-sync-reviewed.json'),
   JSON.stringify(result.next.reviewed,null,2)+'\n');
 }
 console.log('GENERIC_REVIEW_RESULT '+JSON.stringify({
  dry,manualApprovals:all.length,verified:result.verified,restoredHeld:restored,
  added:result.changes.length,alreadyPublished:result.already,
  cashAdded:0,resultsBefore:db.results.length,
  resultsAfter:result.next.results.length,
  changes:result.changes
 }));
}
if(require.main===module){try{main()}catch(err){console.error(err.stack||err);process.exitCode=1}}
module.exports={plan,reconcileHeld,main};
