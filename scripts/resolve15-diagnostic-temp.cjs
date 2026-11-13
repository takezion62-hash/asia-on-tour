'use strict';
const fs=require('node:fs'), path=require('node:path');
const {readResults}=require('./source-results-store.cjs');
const root=path.resolve(__dirname,'..');
const read=file=>JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
const q=read('history-sync-review.json').proposals;
const d=readResults(root).rows;
const tri=read('candidate-triage.json').queue;
const scans=read('history-sync-scan.json').windows;
const cal=new Map();
const output=[];
for(const r of q){
  const source=new URL(r.source);
  const event=decodeURIComponent(source.pathname.split('/')[3]);
  const round=source.searchParams.get('round');
  const key='epicgames_'+event+'_'+r.region+'/'+round;
  const cp=scans[key]||null;
  const month=r.date.slice(0,7);
  if(!cal.has(month))cal.set(month,read('calendar-history/'+month+'.json').sessions);
  const session=cal.get(month).find(x=>x.sourceWindowId===round&&x.region===r.region&&x.tournamentId===r.tournamentId);
  const old=tri.find(x=>x.id===r.id)?.evidence.possibleExistingId;
  const existing=old?d.find(x=>x.id===old):null;
  const other=d.filter(x=>x.date===r.date&&x.region===r.region&&x.tournamentId===r.tournamentId&&x.player===r.player);
  output.push({id:r.id,player:r.player,raw:r.playerRaw,round:r.round,date:r.date,rank:r.rank,points:r.points,kills:r.kills,vrs:r.vrs,matches:r.matches,prize:r.prize,kind:r.kind,event,
    cp:cp?{complete:cp.complete,pages:cp.pages,nextPage:cp.nextPage,totalPages:cp.totalPages,lastSeenRank:cp.lastSeenRank,
      lastSuccessAt:cp.lastSuccessAt,lastErrorCode:cp.lastErrorCode,lastError:cp.lastError,retryAfter:cp.retryAfter,
      rankingOrderValid:cp.rankingOrderValid,emptyAttempts:cp.emptyAttempts,
      hasRow:cp.proposals?.some(x=>x.id===r.id),equals:cp.proposals?.find(x=>x.id===r.id)||null}:null,
    session:session?{endUtc:session.endUtc,kind:session.kind,series:session.series}:null,
    existing:existing?{id:existing.id,player:existing.player,raw:existing.playerRaw,rank:existing.rank,points:existing.points,kills:existing.kills,vrs:existing.vrs,matches:existing.matches,prize:existing.prize,kind:existing.kind,round:existing.round,source:existing.source}:null,
    other:other.slice(0,4).map(x=>({id:x.id,rank:x.rank,points:x.points,kills:x.kills,vrs:x.vrs,matches:x.matches,prize:x.prize,kind:x.kind,round:x.round}))});
}
console.log('REMAINING_15_DIAGNOSTIC '+JSON.stringify({total:q.length,items:output}));
