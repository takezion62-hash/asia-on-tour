'use strict';
const {readResults}=require('./source-results-store.cjs');
// 2026-11-08 inspection of historical candidates on the Actions runner.
// Read-only diagnostics, never publish an unverified team or a prize.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=f=>f==='results.json'?readResults(root).rows:JSON.parse(fs.readFileSync(path.join(root,f),'utf8'));
const {collision}=require('./manual-approval-core.cjs');
const queue=read('history-sync-review.json').proposals;
const scan=read('history-sync-scan.json').windows;
const results=read('results.json');
const reviewed=new Set(read('history-sync-reviewed.json').entries.map(x=>x.id));
const aliases=read('players.json').confirmedAliases||{};
const targets=queue.filter(x=>x.kind==='賞金決勝'||x.tournamentId==='ch7s1-one-million-unreal-cup');
const checkpointLookup=new Map();
for(const [key,cp] of Object.entries(scan)){
 for(const row of cp.proposals||[]){
  if(!checkpointLookup.has(row.id))checkpointLookup.set(row.id,[]);
  checkpointLookup.get(row.id).push({key,cp,row});
 }
}
for(const candidate of targets){
 const cp=checkpointLookup.get(candidate.id)||[];
 const clashes=results.filter(row=>collision(row,candidate,aliases))
  .map(row=>({id:row.id,rank:row.rank,kind:row.kind,kills:row.kills,vrs:row.vrs,prize:row.prize,
    round:row.round,reason:collision(row,candidate,aliases)}));
 console.log('HISTORY_REVIEW_AUDIT '+JSON.stringify({
  id:candidate.id,name:candidate.player,rank:candidate.rank,
  event:candidate.tournamentId,region:candidate.region,kind:candidate.kind,
  vrs:candidate.vrs,kills:candidate.kills,points:candidate.points,matches:candidate.matches,
  reason:candidate.reviewReason,reviewed:reviewed.has(candidate.id),
  checkpoints:cp.map(c=>({key:c.key,complete:c.cp.complete,nextPage:c.cp.nextPage,
   totalPages:c.cp.totalPages,pages:c.cp.pages,rankingOrderValid:c.cp.rankingOrderValid,
   epicIdsRetained:c.cp.epicIdsRetained,sourceMatches:JSON.stringify(c.row)===JSON.stringify(candidate)})),
  clashes
 }));
}
console.log('HISTORY_REVIEW_AUDIT_TOTAL '+JSON.stringify({pending:queue.length,
 finalCandidates:queue.filter(r=>r.kind==='賞金決勝').length,unreal:queue.filter(r=>r.tournamentId==='ch7s1-one-million-unreal-cup').length,
 tracked:targets.length,available:checkpointLookup.size,existing:results.length}));
