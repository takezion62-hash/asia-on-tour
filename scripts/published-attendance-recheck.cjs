'use strict';
// Phase 5: read-only planning for already published attendance. No network or
// writes. Reuse the Phase 1–4 proof gate and existing official award adapters.
const {recheckSaved}=require('./saved-candidate-recheck.cjs');
const {sourceWindow}=require('./review-recovery-priority.cjs');
const {collision,collisionKey}=require('./manual-approval-core.cjs');
const {checkpointIndex}=require('./review-batch-index.cjs');
const {sameScannedCandidate}=require('./verified-partial-page.cjs');
const fields=['id','date','region','player','event','rank','points','kills','vrs','matches','seasonId','tournamentId','source','verified'];
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const roster=r=>Array.isArray(r.players)?r.players:[r.player];
const exact=(a,b)=>fields.every(k=>same(a[k],b[k]))&&same(roster(a),roster(b));
const nonnegative=n=>Number.isSafeInteger(n)&&n>=0;
// Some existing award adapters preserve a blank/absent candidate note.
function promotionNote(old,next){
 if(typeof next.note==='string'&&next.note.trim())return next.note;
 const previous=typeof old.note==='string'&&old.note.trim()?old.note.trim()+' ':'';
 return previous+'保存済み順位表・本人Epic ID・公式開催枠と既存承認規則を再照合し、'+next.kind+'・賞金USD '+next.prize+'に再分類。出典: '+old.source;
}
const awardKinds=new Set(['予選','賞金決勝','Performance決勝']);
function planPublishedAttendance({data,scans,windows,config,ledger,reviewedIds,otherQueue=[],now=Date.now()}){
 if(!Array.isArray(data?.results)||!Array.isArray(data?.verifiedAccounts)||
 !Array.isArray(data?.tournaments?.catalog)||!Array.isArray(windows)||
 !Array.isArray(ledger?.entries)||!Array.isArray(reviewedIds)||!Array.isArray(otherQueue)||
 !scans||!config)throw Error('Incomplete published attendance evidence inputs');
 const results=data.results,protectedIds=new Set([...reviewedIds,...ledger.entries.flatMap(x=>[x.id,x.recordId])]);
 const index=checkpointIndex(scans),counts=new Map(),windowIndex=new Map(),buckets=new Map();
 const aliases=data.players?.confirmedAliases;
 for(const r of results){
  counts.set(r.id,(counts.get(r.id)||0)+1);
  const k=collisionKey(r,aliases);if(!buckets.has(k))buckets.set(k,[]);buckets.get(k).push(r);
 }
 for(const w of windows){if(!windowIndex.has(w.key))windowIndex.set(w.key,[]);windowIndex.get(w.key).push(w)}
 const held=[],proposals=[],eligible=[],byId=new Map(),checkpoints=Object.create(null);
 const hold=(r,reason)=>held.push({id:r.id,reason});
 const attendance=results.filter(r=>r.kind==='参加確認');
 for(const old of attendance){
  if(protectedIds.has(old.id)){hold(old,'protected-review');continue}
  if(counts.get(old.id)!==1||old.verified!==true||old.reviewOnly===true||
   (old.prize!==null&&old.prize!==0)||!nonnegative(old.rank)||old.rank<1||
   !['points','kills','vrs','matches'].every(k=>nonnegative(old[k]))||
   old.matches<1||old.vrs>old.matches){hold(old,'invalid-published-record');continue}
  const key=sourceWindow(old),wins=windowIndex.get(key)||[],proof=index.get(old.id)||[];
  if(!key||wins.length!==1||proof.length!==1||proof[0].key!==key||
   !exact(old,proof[0].row)){hold(old,'missing-or-conflicting-saved-proof');continue}
  const row=proof[0].row,cp=proof[0].checkpoint,win=wins[0];
  if(otherQueue.some(q=>q.id===old.id&&!sameScannedCandidate(q,row))){
   hold(old,'conflicting-queue');continue
  }
  // Check against ALL published records, not just the temporary replay view.
  if((buckets.get(collisionKey(old,aliases))||[]).some(r=>r.id!==old.id&&collision(r,old,aliases))){
   hold(old,'published-collision');continue
  }
  if(checkpoints[key]&&checkpoints[key]!==cp){hold(old,'conflicting-checkpoint');continue}
  checkpoints[key]=cp;eligible.push(row);byId.set(old.id,old);
 }
 const replay=recheckSaved({queue:{proposals:eligible},checkpoints,windows,
  data:{...data,results:results.filter(r=>!byId.has(r.id))},config,reviewedIds,otherQueue,now});
 const approvedById=new Map(replay.approved.map(r=>[r.id,r]));
 const pendingById=new Map(replay.next.map(r=>[r.id,r]));
 for(const row of eligible){
  const old=byId.get(row.id),next=approvedById.get(row.id);
  if(!next){hold(old,pendingById.get(row.id)?.reviewReason||'official-proof-insufficient');continue}
  if(!exact(old,next)||!awardKinds.has(next.kind)||next.reviewOnly===true||
    !nonnegative(next.prize)||(next.kind==='予選'&&next.prize!==0)||
    (old.prize===0&&next.prize>0)){
   hold(old,'classification-or-prize-conflict');continue
  }
  if((buckets.get(collisionKey(next,aliases))||[]).some(r=>r.id!==old.id&&collision(r,next,aliases))){
   hold(old,'proposed-collision');continue
  }
  // The report intentionally contains no Epic account IDs.
  proposals.push({id:old.id,player:old.player,date:old.date,region:old.region,
   source:old.source,before:{kind:old.kind,round:old.round,prize:old.prize},
   after:{kind:next.kind,round:next.round,prize:next.prize,
   ...(next.teamPrize!==undefined?{teamPrize:next.teamPrize}:{}),
   ...(next.prizePerPlayer!==undefined?{prizePerPlayer:next.prizePerPlayer}:{}),note:promotionNote(old,next)}});
 }
 return {version:1,dryRun:true,attendance:attendance.length,checked:eligible.length,
  proposed:proposals.length,held:held.length,proposals,holds:held};
}
if(require.main===module){
 const fs=require('node:fs');
 if(process.argv.length!==3)throw Error('Usage: node scripts/published-attendance-recheck.cjs snapshot.json');
 const input=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
 process.stdout.write(JSON.stringify(planPublishedAttendance(input),null,2)+'\n');
}
module.exports={planPublishedAttendance,promotionNote};
