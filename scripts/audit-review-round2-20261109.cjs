'use strict';
const {readResults}=require('./source-results-store.cjs');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),read=p=>p==='results.json'?readResults(root).rows:JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const {collision}=require('./manual-approval-core.cjs');
const {sameScannedCandidate}=require('./verified-partial-page.cjs');
const {linkedAccounts,getLeaderboard,normalizeRow}=require('./osirion-sync.cjs');
const local=['auto','history'],data={
 results:read('results.json'),players:read('players.json'),
 tournaments:read('tournaments.json'),review:{auto:read('auto-sync-review.json'),history:read('history-sync-review.json')},
 scans:{auto:read('auto-sync-scan.json'),history:read('history-sync-scan.json')}
};
const all=new Map(),mismatched=[];
for(const scope of local)for(const r of data.review[scope].proposals){
 const old=all.get(r.id);
 if(old&&!sameScannedCandidate(old,r))mismatched.push(r.id);
 else if(!old)all.set(r.id,r);
}
const people=r=>Array.isArray(r.players)&&r.players.length?r.players:[r.player];
const sameTeam=(a,b)=>a.date===b.date&&a.region===b.region&&a.tournamentId===b.tournamentId&&
 people(a).slice().sort().join('|')===people(b).slice().sort().join('|');
const reports=[];
const months={};
for(const r of all.values()){
 let url=null,win=null,cp=null,winKey=null,stored=false,cpScope='';
 try{url=new URL(r.source);win=url.searchParams.get('round');
 winKey='epicgames_'+decodeURIComponent(url.pathname.split('/')[3])+'_'+r.region+'/'+win;
 for(const scope of local){const candidate=data.scans[scope].windows?.[winKey];
  if(candidate?.proposals?.some(x=>x.id===r.id&&sameScannedCandidate(x,r)) &&
   (!cp||Number(candidate.complete)>Number(cp.complete)||Number(candidate.pages)>Number(cp.pages))){
    cp=candidate;cpScope=scope;
  }
 }
 stored=!!cp;
 }catch{}
 const existing=data.results.filter(x=>sameTeam(x,r)||collision(x,r,data.players.confirmedAliases));
 const month=r.date.slice(0,7);
 if(!months[month]){try{months[month]=read('calendar-history/'+month+'.json').sessions}catch{months[month]=[]}}
 const sessions=months[month].filter(s=>s.sourceWindowId===win&&s.region===r.region&&s.dateJst===r.date&&
  s.tournamentId===r.tournamentId);
 const info={id:r.id,player:r.player,rank:r.rank,points:r.points,kills:r.kills,vrs:r.vrs,matches:r.matches,
  event:r.event,region:r.region,date:r.date,kind:r.kind,tournamentId:r.tournamentId,round:r.round,
  reviewOnly:r.reviewOnly===true,prize:r.prize,
  source:r.source,checkpoint:stored?{scope:cpScope,complete:cp.complete,pages:cp.pages,nextPage:cp.nextPage,totalPages:cp.totalPages,
   lastSeenRank:cp.lastSeenRank,rankValid:cp.rankingOrderValid,epicIdsRetained:cp.epicIdsRetained,lastError:cp.lastErrorCode||cp.lastError||null,
   retryAfter:cp.retryAfter||null,matching:true}:null,calendarMatches:sessions.length,existing:existing.map(x=>({
   id:x.id,player:x.player,rank:x.rank,points:x.points,kills:x.kills,vrs:x.vrs,matches:x.matches,
   prize:x.prize,kind:x.kind,round:x.round,source:x.source,note:x.note?.slice(0,250)
  }))};
 reports.push(info);
}
async function zoroLive(){
 const targets=reports.filter(x=>x.tournamentId==='ch7s5-one-piece-zoro-cup-zero-build');
 if(targets.length!==2)return {skipped:'not exactly two Zoro candidates'};
 const win={fullEventId:'epicgames_S43_OnePieceZoroCup_ZB_EU',
   eventId:'S43_OnePieceZoroCup_ZB',windowId:'S43_OnePieceZoroCup_ZB_EU',
   region:'EU',key:'epicgames_S43_OnePieceZoroCup_ZB_EU/S43_OnePieceZoroCup_ZB_EU'};
 const {accounts}=linkedAccounts({results:data.results,players:data.players});
 const knownIds=new Map(accounts.map(x=>[x.epicAccountId,x.player]));
 const sig=x=>people(x).slice().sort().join('|');
 const required=new Map(targets.map(x=>[sig(x),x]));
 const located=[],samples=[],errors=[];
 for(let page=0;page<20;page++){
  let l;
  try{l=await getLeaderboard(win,page)}catch(e){errors.push({page,error:String(e).slice(0,200)});break}
  if(!Array.isArray(l.entries)||!l.entries.length)break;
  const rankStart=l.entries[0].rank,rankEnd=l.entries[l.entries.length-1].rank;
  for(const e of l.entries){
   const ids=e?.players?.map(p=>p.accountId?.toLowerCase())||[];
   const names=ids.map(id=>knownIds.get(id)||'not-mapped');
   const row=normalizeRow(e,win);
   const exactScore=targets.filter(t=>row&&t.points===row.points&&t.kills===row.kills&&
     t.vrs===row.vrs&&t.matches===row.matches);
   const match=required.get(names.slice().sort().join('|'))||
     (exactScore.length===1?exactScore[0]:null);
   if(!match)continue;
   located.push({id:match.id,page,rank:e.rank,points:e.pointsEarned,
    kills:row?.kills,vrs:row?.vrs,matches:row?.matches,matchedEpicIdCount:names.filter(x=>x!=='not-mapped').length,
    names,rawNames:e.players?.map(x=>x.username),rankStart,rankEnd,
    matchedBy:required.has(names.slice().sort().join('|'))?'confirmed-id':'unique-exact-performance'});
  }
  samples.push({page,count:l.entries.length,from:rankStart,to:rankEnd,totalPages:l.totalPages});
  if(located.length===targets.length||rankEnd>Math.max(...targets.map(x=>x.rank))+80)break;
 }
 return {located,samples,errors};
}
async function inoxtagLive(){
 const targets=reports.filter(x=>x.tournamentId==='ch7s4-inoxtag-icon-cup-battle-royale');
 const win={fullEventId:'epicgames_S42_InoxtagIconCup_NAW',eventId:'S42_InoxtagIconCup',
  windowId:'S42_InoxtagIconCup_NAW',region:'NAW',
  key:'epicgames_S42_InoxtagIconCup_NAW/S42_InoxtagIconCup_NAW'};
 try{
  const l=await getLeaderboard(win,0);
  const located=[];
  for(const e of l.entries||[]){
   const row=normalizeRow(e,win);
   if(!row)continue;
   const matches=targets.filter(t=>t.points===row.points&&t.kills===row.kills&&
    t.vrs===row.vrs&&t.matches===row.matches);
   if(matches.length!==1)continue;
   located.push({id:matches[0].id,rank:e.rank,points:e.pointsEarned,
    kills:row.kills,vrs:row.vrs,matches:row.matches,
    names:e.players?.map(p=>p.username),source:'exact score uniquely matched on live page 0'});
  }
  return {located,entries:l.entries?.length,totalPages:l.totalPages};
 }catch(e){return {error:String(e).slice(0,250)}}
}
async function main(){
 const zoro=await zoroLive(),inoxtag=await inoxtagLive();
 const categories=Object.entries(reports.reduce((a,x)=>(a[x.tournamentId]=(a[x.tournamentId]||0)+1,a),{}));
 const conflict=reports.filter(x=>x.existing.length);
 const status={totalPending:reports.length,historyQueue:data.review.history.proposals.length,autoQueue:data.review.auto.proposals.length,
  mismatched,groups:categories,existingConflicts:conflict,
  noCheckpoint:reports.filter(x=>!x.checkpoint).map(x=>x.id),
  badCheckpoint:reports.filter(x=>x.checkpoint&&(x.checkpoint.rankValid!==true||
    x.checkpoint.lastError||x.checkpoint.retryAfter||x.checkpoint.lastSeenRank<x.rank)).map(x=>x.id),
  missingCalendar:reports.filter(x=>x.calendarMatches!==1).map(x=>({id:x.id,count:x.calendarMatches,group:x.tournamentId})),
  other:reports.filter(x=>!x.existing.length).map(x=>({...x,existing:undefined,source:undefined})),
  zoroLive:zoro,inoxtagLive:inoxtag};
 console.log('AOT_AUDIT_ROUND2 '+JSON.stringify(status));
}
if(require.main===module)main().catch(e=>{console.error(e.stack);process.exitCode=1});
module.exports={main};
