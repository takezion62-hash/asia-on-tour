'use strict';
// Read-only evidence planner. No API calls, no new rules. Only exact evidence
// admitted by the existing scheduled approval adapters may create records.
const crypto=require('node:crypto');
const {sameScannedCandidate,matureFullLeaderboard}=require('./verified-partial-page.cjs');
const {sourceWindow}=require('./review-recovery-priority.cjs');
const {runApprovals}=require('./tournament-approval-router.cjs');
const {MANIFEST}=require('./generic-review-only-core.cjs');
const {maximumMatches}=require('./auto-sync-core.cjs');
const roster=r=>Array.isArray(r.players)&&r.players.length?r.players:[r.player];
function identityProof(row,win,accounts,team){
 const names=roster(row),size={solo:1,duo:2,trio:3,squad:4}[team];
 if(!size||names.length!==size||new Set(names).size!==size||names.join(' / ')!==row.player)return false;
 const byId=new Map(),byName=new Map();
 for(const a of accounts){
  if(a.confirmed!==true||typeof a.epicAccountId!=='string'||!/^[a-f0-9]{32}$/.test(a.epicAccountId))continue;
  if(!byId.has(a.epicAccountId))byId.set(a.epicAccountId,new Set());
  byId.get(a.epicAccountId).add(a.player);
  if(!byName.has(a.player))byName.set(a.player,new Set());
  byName.get(a.player).add(a.epicAccountId);
 }
 // Legacy solo/team rows may lack the IDs. Reconstruct only if each name has
 // exactly one verified ID and the original deterministic candidate hash agrees.
 const ids=row.teamAccountIds??names.map(n=>byName.get(n)?.size===1?[...byName.get(n)][0]:null);
 if(!Array.isArray(ids)||ids.length!==size||new Set(ids).size!==size||
  ids.some((id,i)=>byId.get(id)?.size!==1||!byId.get(id).has(names[i])))return false;
 const hash=crypto.createHash('sha256').update(JSON.stringify([win.eventId+'/'+win.windowId,ids])).digest('hex').slice(0,12);
 return row.id==='auto-'+row.seasonId.toLowerCase()+'-'+hash;
}
function mature(cp,win,row,now){
 return matureFullLeaderboard(row,win,cp,now);
}
function recheckSaved({queue,checkpoints,windows,data,config,reviewedIds=[],otherQueue=[],now=Date.now()}){
 const pending=queue.proposals,done=new Set([...data.results.map(x=>x.id),...reviewedIds]);
 const pinned=new Set((MANIFEST.held||[]).map(x=>x.id)),catalog=new Map(data.tournaments.catalog.map(x=>[x.id,x]));
 const byKey=new Map(windows.map(w=>[w.key,w])),byId=new Map(),queueById=new Map();
 const reasons=new Map(),eligible=[],held=[];
 for(const row of [...pending,...otherQueue]){
  if(!queueById.has(row.id))queueById.set(row.id,[]);
  queueById.get(row.id).push(row);
 }
 for(const [key,cp] of Object.entries(checkpoints)){
  for(const row of cp.proposals||[]){
   if(!queueById.has(row.id))continue;
   if(!byId.has(row.id))byId.set(row.id,[]);
   byId.get(row.id).push({key,cp,row});
  }
 }
 const originalIds=new Set();
 for(const row of pending){
  if(originalIds.has(row.id))continue;
  originalIds.add(row.id);
  if(done.has(row.id)||pinned.has(row.id))continue;
  const proof=byId.get(row.id)||[],key=sourceWindow(row),win=byKey.get(key),cat=catalog.get(row.tournamentId);
  if(!win||!cat||proof.length!==1||proof[0].key!==key||
   !sameScannedCandidate(proof[0].row,row)||!queueById.get(row.id).every(x=>sameScannedCandidate(x,row))||
   pending.filter(x=>x.id===row.id).length!==1||
   row.verified!==true||win.dateJst!==row.date||win.region!==row.region||win.seasonId!==row.seasonId||
   win.tournamentId!==row.tournamentId||win.kind!==row.kind||win.round!==row.round||cat.name!==row.event){
   held.push({id:row.id,reason:'公式開催枠・保存済み候補の一致を確認できない'});continue;
  }
  // Allow the dedicated Console Duos adapter's exact mature qualifier prefix,
  // including legacy cutoff-complete snapshots; never relax final evidence.
  const consolePrefix=config.autoApproveConsoleDuos===true&&row.kind==='予選'&&
   require('./automatic-console-duos-approval.cjs').qualifierEvidence(row,win,proof[0].cp,now);
  const nvidiaPrefix=config.autoApproveNvidia===true&&
   require('./automatic-nvidia-approval.cjs').prizePrefixEvidence(proof[0].row,win,proof[0].cp,now);
  if(!mature(proof[0].cp,win,row,now)&&!consolePrefix&&!nvidiaPrefix){
   held.push({id:row.id,reason:'成熟済み完全順位表が未確認'});continue;
  }
  if(!identityProof(row,win,data.verifiedAccounts||[],cat.team)){
   held.push({id:row.id,reason:'元の本人Epic IDと候補IDを再確認'});continue;
  }
  const cap=maximumMatches({...row,catalog:cat});
  if(cap!==null&&row.matches>cap)continue;
  eligible.push(proof[0].row);
 }
 const outcome=runApprovals(eligible,windows,checkpoints,data,config,{historical:true});
 // Participation grants require a different replay verifier; do not expand
 // offline publication to those or unknown prize/unsupported result kinds.
 const approved=outcome.approved.filter(r=>r.verified===true&&r.reviewOnly!==true&&
  ['予選','賞金決勝','スキン大会'].includes(r.kind)&&Number.isFinite(r.prize)&&r.prize>=0);
 const ids=new Set(approved.map(x=>x.id));
 if(ids.size!==approved.length)throw Error('duplicate offline approval IDs');
 for(const row of eligible){
  if(ids.has(row.id))continue;
  if(outcome.reasons.has(row.id))reasons.set(row.id,outcome.reasons.get(row.id));
 }
 const next=pending.filter(x=>!ids.has(x.id)).map(x=>reasons.has(x.id)&&reasons.get(x.id)!==x.reviewReason?{...x,reviewReason:reasons.get(x.id)}:x);
 return {approved,next,checked:eligible.length,held:held.length,reasonUpdates:next.filter(x=>reasons.has(x.id)&&pending.find(p=>p.id===x.id)?.reviewReason!==x.reviewReason).length};
}
module.exports={recheckSaved,identityProof,mature};
