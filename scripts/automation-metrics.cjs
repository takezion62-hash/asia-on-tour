'use strict';
// Observation only: counters describe the exact conflict-safe merge, never
// speculative approvals, raw queue shrinkage or an external API request.
const crypto=require('node:crypto');
const MAX_RUNS=120;
const count=(n)=>Number.isSafeInteger(n)&&n>=0?n:null;
const rate=(n,d)=>d?Math.round(10000*n/d)/100:null;
const ids=rows=>new Set(rows.map(r=>r.id));
const validTime=x=>typeof x==='string'&&Number.isFinite(Date.parse(x));
const fields=['date','region','tournamentId','seasonId','round','kind','rank','points','kills','vrs','matches','prize','prizePerPlayer','teamPrize','source'];
function exactPublished(candidate,row){
 return Boolean(candidate?.verified===true&&row?.verified===true&&
  candidate.id===row.id&&typeof candidate.source==='string'&&candidate.source.length&&
  Number.isFinite(candidate.prize)&&Number.isFinite(row.prize)&&
  fields.every(k=>candidate[k]===row[k])&&
  JSON.stringify(candidate.players||[candidate.player])===JSON.stringify(row.players||[row.player]));
}
function rates(c){
 return {...c,autoResolutionRate:rate(c.oldPublished+c.oldDuplicateResolved,c.pendingAtStart),
  autoPublicationRate:rate(c.published,c.observedCandidates),
  newCandidatePublicationRate:rate(c.newPublished,c.newCandidates)};
}
const sumKeys=['pendingAtStart','newCandidates','observedCandidates','oldPublished','oldDuplicateResolved',
 'oldPendingAfter','oldOtherRemoved','published','newPublished','newPendingAfter','newOtherNotPublished'];
function aggregate(runs){
 const c={};for(const k of sumKeys)c[k]=runs.reduce((n,r)=>n+r[k],0);
 return {runs:runs.length,...rates(c)};
}
function measure({scope,base,scanned,latest,review,appended,reviewedIds,conflicts,duplicates}){
 const p=scope==='history'?'history-sync':'auto-sync',q=p+'-review.json',s=p+'-status.json',k=p+'-scan.json';
 const b=base.docs,c=scanned.docs,n=latest.docs;
 const prior=n[s].automationMetrics;
 const full=validTime(c[k].checkedAt)&&c[k].checkedAt!==b[k].checkedAt;
 const saved=scope==='history'&&validTime(c[s].savedRecheck?.checkedAt)&&
  c[s].savedRecheck.checkedAt!==b[s].savedRecheck?.checkedAt;
 // A skipped scan or a discovery failure must not reuse old provider counters.
 if(!full&&!saved)return prior;
 const measuredAt=full?c[k].checkedAt:c[s].savedRecheck.checkedAt;
 const runId=crypto.createHash('sha256').update(JSON.stringify([scope,b[k].checkedAt,
  full?c[k].checkedAt:null,saved?c[s].savedRecheck.checkedAt:null])).digest('hex').slice(0,24);
 const oldRuns=prior?.version===1&&Array.isArray(prior.runs)?prior.runs:[];
 if(oldRuns.some(x=>x.runId===runId))return prior;
 const start=new Map(b[q].proposals.map(r=>[r.id,r])),basePublished=new Map(b['results.json'].map(r=>[r.id,r]));
 const latestPublished=ids(n['results.json']),latestPending=ids(n[q].proposals),after=ids(review.proposals);
 const actual=ids(appended),newIds=new Set();
 // The scanned queue plus actual scanner proposals covers new IDs without
 // counting candidates already public before the scan. Unobserved rows are excluded.
 for(const row of [...c[q].proposals,...c['results.json']]){
  if(!start.has(row.id)&&!basePublished.has(row.id))newIds.add(row.id);
 }
 let oldPublished=0,oldDuplicateResolved=0,oldPendingAfter=0,oldOtherRemoved=0;
 for(const [id,row] of start){
  if(actual.has(id))oldPublished++;
  else if(after.has(id))oldPendingAfter++;
  else if(latestPending.has(id)&&!reviewedIds.has(id)&&exactPublished(row,basePublished.get(id)))oldDuplicateResolved++;
  else oldOtherRemoved++;
 }
 let newPublished=0,newPendingAfter=0,newOtherNotPublished=0;
 for(const id of newIds){
  if(actual.has(id))newPublished++;
  else if(after.has(id))newPendingAfter++;
  else newOtherNotPublished++;
 }
 const observedCandidates=start.size+newIds.size;
 const run={runId,measuredAt,mode:full?'provider-scan':'saved-recheck',
  ...rates({pendingAtStart:start.size,newCandidates:newIds.size,observedCandidates,
   oldPublished,oldDuplicateResolved,oldPendingAfter,oldOtherRemoved,published:actual.size,
   newPublished,newPendingAfter,newOtherNotPublished}),
  pendingAtEnd:after.size,concurrentPublishedOrReviewed:[...start.keys(),...newIds].filter(id=>
   !actual.has(id)&&(reviewedIds.has(id)||(!basePublished.has(id)&&latestPublished.has(id)))).length,
  skippedApprovalDuplicates:new Set(duplicates).size,conflicts:new Set(conflicts.map(x=>x.id)).size,
  scannedPages:full?count(c[s].scannedPages):null,
  providerRequests:full?count(c[s].providerTraffic?.requests):null,
  savedRecheck:saved?{checked:count(c[s].savedRecheck.checked),reasonUpdates:count(c[s].savedRecheck.reasonUpdates),
   heldEvidence:count(c[s].savedRecheck.heldEvidence)}:null};
 const runs=[...oldRuns,run].sort((a,b)=>a.measuredAt.localeCompare(b.measuredAt)||a.runId.localeCompare(b.runId)).slice(-MAX_RUNS);
 return {version:1,scope,latest:runs.at(-1),runs,rolling:{last7Runs:aggregate(runs.slice(-7)),last30Runs:aggregate(runs.slice(-30))}};
}
module.exports={measure,exactPublished,aggregate};
