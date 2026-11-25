'use strict';
// Read-only replay of pending legacy solo candidates, using the current
// checked-in evidence. No provider requests, no approval ledger edits.
const fs=require('node:fs'),path=require('node:path');
const {loadSnapshot,buildWindows}=require('./published-attendance-phase5.cjs');
const {checkpointIndex}=require('./review-batch-index.cjs');
const {sourceWindow}=require('./review-recovery-priority.cjs');
const {recheckSaved}=require('./saved-candidate-recheck.cjs');
const {sameScannedCandidate}=require('./verified-partial-page.cjs');
const ROOT=path.resolve(__dirname,'..');
const IDS=new Set(['ch5s3-solo-victory-cup','ch5s3-zb-solo-victory','ch5s4-solo-victory-cup','ch5s4-zb-solo-victory']);
function preview(root=ROOT,now=Date.now()){
 const snapshot=loadSnapshot(root,now),{data,scans,config}=snapshot;
 const rows=snapshot.otherQueue.filter(r=>IDS.has(r.tournamentId));
 const months=[...new Set(rows.map(r=>r.date?.slice(0,7)).filter(m=>/^\d{4}-\d{2}$/.test(m)))];
 const sessions=months.flatMap(m=>{
  const file=path.join(root,'calendar-history',m+'.json');
  if(!fs.existsSync(file))return [];
  const doc=JSON.parse(fs.readFileSync(file,'utf8'));
  if(!Array.isArray(doc.sessions))throw Error('Invalid archived calendar '+m);
  return doc.sessions;
 });
 const allWindows=buildWindows(rows,data.tournaments.catalog,sessions,{allKinds:true});
 const count=new Map();for(const w of allWindows)count.set(w.key,(count.get(w.key)||0)+1);
 const windows=allWindows.filter(w=>count.get(w.key)===1),validKeys=new Set(windows.map(w=>w.key));
 const index=checkpointIndex(scans),checkpoints=Object.create(null),conflicts=new Set(),eligible=[];
 const ids=new Set();
 for(const row of rows){
  if(ids.has(row.id)||rows.filter(r=>r.id===row.id).length!==1)continue;
  ids.add(row.id);
  const key=sourceWindow(row),proof=index.get(row.id)||[];
  if(!validKeys.has(key)||proof.length!==1||proof[0].key!==key||
   !sameScannedCandidate(proof[0].row,row))continue;
  if(checkpoints[key]&&checkpoints[key]!==proof[0].checkpoint)conflicts.add(key);
  checkpoints[key]=proof[0].checkpoint;eligible.push(row);
 }
 for(const key of conflicts)delete checkpoints[key];
 const protectedIds=[...snapshot.reviewedIds,...snapshot.ledger.entries.flatMap(e=>[e.id,e.recordId])];
 const outcome=recheckSaved({queue:{proposals:eligible.filter(r=>!conflicts.has(sourceWindow(r)))},
  checkpoints,windows,data,config,reviewedIds:protectedIds,otherQueue:snapshot.otherQueue,now});
 return {pending:rows.length,checked:outcome.checked,approved:outcome.approved.map(r=>({id:r.id,player:r.player,date:r.date,
  region:r.region,rank:r.rank,kind:r.kind,prize:r.prize,source:r.source})),
  additionalProviderRequests:0,dryRun:true};
}
if(require.main===module)console.log(JSON.stringify(preview(),null,2));
module.exports={preview};
