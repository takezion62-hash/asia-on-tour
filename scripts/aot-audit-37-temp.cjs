'use strict';
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),read=n=>JSON.parse(fs.readFileSync(path.join(root,n),'utf8'));
const {readResults}=require('./source-results-store.cjs');
const {sameScannedCandidate}=require('./verified-partial-page.cjs');
const q=read('history-sync-review.json').proposals,r=readResults(root).rows,scan=read('history-sync-scan.json').windows;
const cache=new Map();
const out=[];
for(const p of q){
 const u=new URL(p.source),e=u.pathname.split('/')[3],w=u.searchParams.get('round');
 const key='epicgames_'+e+'_'+p.region+'/'+w;
 const cp=scan[key];
 const month=p.date.slice(0,7);
 if(!cache.has(month))cache.set(month,read('calendar-history/'+month+'.json').sessions);
 const cal=cache.get(month).filter(x=>x.eventId===e&&x.sourceWindowId===w&&x.dateJst===p.date&&x.region===p.region&&x.tournamentId===p.tournamentId);
 const conflicts=r.filter(x=>x.date===p.date&&x.region===p.region&&x.tournamentId===p.tournamentId&&x.player===p.player);
 out.push({id:p.id,date:p.date,region:p.region,player:p.player,kind:p.kind,rank:p.rank,points:p.points,kills:p.kills,vrs:p.vrs,matches:p.matches,
   cp:cp?{complete:cp.complete,pages:cp.pages,nextPage:cp.nextPage,totalPages:cp.totalPages,rank:cp.lastSeenRank,
    lastSuccessAt:cp.lastSuccessAt,rankingOrderValid:cp.rankingOrderValid,errorCode:cp.lastErrorCode,error:cp.lastError,
    retryAfter:cp.retryAfter,emptyAttempts:cp.emptyAttempts,equal:cp.proposals?.filter(x=>x.id===p.id&&sameScannedCandidate(x,p)).length}:null,
   cal:cal.map(x=>({endUtc:x.endUtc})),conflicts:conflicts.map(x=>({id:x.id,rank:x.rank,points:x.points,kills:x.kills,vrs:x.vrs,matches:x.matches,prize:x.prize,kind:x.kind,playerRaw:x.playerRaw,source:x.source}))});
}
console.log('AOT37_AUDIT '+JSON.stringify({queue:q.length,manifestCount:r.length,records:out}));
