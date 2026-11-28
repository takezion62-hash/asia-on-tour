'use strict';
// Observation only. No provider requests, selection changes or publication rights.
const crypto=require('node:crypto');
const {sourceWindow}=require('./review-recovery-priority.cjs');
const MAX_RUNS=30;
const fields=['attemptedPages','scannedPages','failedPages','newCandidates','newPublished','oldPendingPublished','published','newPending'];
const validCount=x=>Number.isSafeInteger(x)&&x>=0;
const validTime=x=>typeof x==='string'&&Number.isFinite(Date.parse(x));
const ids=rows=>new Set((rows||[]).map(x=>x.id));
const rate=(n,d)=>d?Math.round(n/d*10000)/10000:null;
function aggregate(rows,group){
 const map=new Map();
 for(const row of rows){
  const key=group(row);
  if(!map.has(key))map.set(key,{key,observations:0,...Object.fromEntries(fields.map(k=>[k,0]))});
  const r=map.get(key);r.observations++;
  for(const k of fields)r[k]+=row[k];
 }
 return [...map.values()].map(r=>({...r,candidatesPerAttempt:rate(r.newCandidates,r.attemptedPages),
  candidatesPerScannedPage:rate(r.newCandidates,r.scannedPages),
  newPublishedPerAttempt:rate(r.newPublished,r.attemptedPages)})).sort((a,b)=>a.key.localeCompare(b.key));
}
function measure({scope,base,scanned,latest,review,appended,reviewedIds=new Set()}){
 if(scope!=='history')return undefined;
 const s='history-sync-status.json',k='history-sync-scan.json',q='history-sync-review.json';
 const b=base.docs,c=scanned.docs,n=latest.docs,prior=n[s].historyYield;
 const at=c[k].checkedAt,observation=c[s].historyYieldObservation;
 // Saved-only rechecks, old scanner versions, and rate-limited discovery do not
 // produce a fresh page observation. Keep the last actual measurements.
 if(!validTime(at)||at===b[k].checkedAt||observation?.measuredAt!==at||!Array.isArray(observation.windows))return prior;
 const runId=crypto.createHash('sha256').update(JSON.stringify([b[k].checkedAt,at])).digest('hex').slice(0,24);
 const old=prior?.version===1&&Array.isArray(prior.runs)?prior.runs:[];
 if(old.some(r=>r.runId===runId))return prior;
 const start=ids(b[q].proposals),known=ids(b['results.json']);
 for(const id of start)known.add(id);
 for(const cp of Object.values(b[k].windows))for(const row of cp.proposals||[])known.add(row.id);
 for(const id of reviewedIds)known.add(id);
 const actual=ids(appended),after=ids(review.proposals);
 const beforePublished=ids(n['results.json']),seenWindows=new Set(),seenNew=new Set(),attributed=new Set(),rows=[];
 for(const w of observation.windows){
  if(typeof w.key!=='string'||seenWindows.has(w.key)||typeof w.tournamentId!=='string'||
   typeof w.region!=='string'||typeof w.series!=='string'||typeof w.seasonId!=='string'||
   !validCount(w.attempted)||!validCount(w.scanned)||w.scanned>w.attempted||!Array.isArray(w.candidateIds))
   throw Error('Invalid historical yield observation');
  seenWindows.add(w.key);
  if(!w.attempted)continue;
  const cp=c[k].windows[w.key];
  if(!cp)throw Error('Missing historical yield checkpoint');
  const exact=new Set((cp.proposals||[]).filter(r=>sourceWindow(r)===w.key&&r.tournamentId===w.tournamentId&&r.region===w.region&&r.seasonId===w.seasonId).map(r=>r.id));
  const fresh=new Set();
  for(const id of w.candidateIds){
   if(!exact.has(id))throw Error('Historical yield candidate outside checkpoint');
   if(!known.has(id)&&!beforePublished.has(id)&&!seenNew.has(id)){
    fresh.add(id);seenNew.add(id);
   }
  }
  // Use only final merge additions. Never count speculative scanner approvals.
  const published=appended.filter(r=>sourceWindow(r)===w.key&&r.tournamentId===w.tournamentId&&r.region===w.region&&r.seasonId===w.seasonId);
  for(const r of published)attributed.add(r.id);
  rows.push({window:w.key,tournamentId:w.tournamentId,region:w.region,series:w.series,seasonId:w.seasonId,
   attemptedPages:w.attempted,scannedPages:w.scanned,failedPages:w.attempted-w.scanned,
   newCandidates:fresh.size,newPublished:[...fresh].filter(id=>actual.has(id)).length,
   oldPendingPublished:published.filter(r=>start.has(r.id)).length,published:published.length,
   newPending:[...fresh].filter(id=>after.has(id)).length});
 }
 const run={runId,measuredAt:at,windows:rows,
  unattributedPublished:appended.filter(r=>!attributed.has(r.id)).length};
 const runs=[...old,run].sort((a,b)=>a.measuredAt.localeCompare(b.measuredAt)||a.runId.localeCompare(b.runId)).slice(-MAX_RUNS);
 const all=runs.flatMap(r=>r.windows);
 return {version:1,scope:'regular-history-leaderboards',latest:runs.at(-1),runs,
  rolling:{runs:runs.length,byTournament:aggregate(all,r=>r.tournamentId),bySeries:aggregate(all,r=>r.series),
   byRegion:aggregate(all,r=>r.region),byTournamentRegion:aggregate(all,r=>r.tournamentId+'/'+r.region)}};
}
module.exports={measure,aggregate};
