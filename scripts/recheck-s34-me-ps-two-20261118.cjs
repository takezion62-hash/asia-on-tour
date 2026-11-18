'use strict';
// Research only. Re-fetch original S34 Middle East PlayStation Finals page 1.
// Never change public standings or infer prizes from a player-name match.
(async()=>{
 const fs=require('node:fs'),path=require('node:path');
 const root=path.resolve(__dirname,'..'),read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
 const {readResults}=require('./source-results-store.cjs');
 const {linkedAccounts,normalizeRow,getLeaderboard}=require('./osirion-sync.cjs');
 const ids=['auto-s34-74d1f337746f','auto-s34-04720ffe5218'];
 const review=read('history-sync-review.json').proposals;
 const data={results:readResults(root).rows,players:read('players.json'),tournaments:read('tournaments.json')};
 const linked=linkedAccounts(data),accounts=new Map(linked.accounts.map(a=>[a.epicAccountId,a.player]));
 const win={fullEventId:'epicgames_S34_PlaystationCup_ME',
  eventId:'S34_PlaystationCup',windowId:'S34_PlaystationCupFinal_ME',
  region:'ME',key:'epicgames_S34_PlaystationCup_ME/S34_PlaystationCupFinal_ME',
  dateJst:'2025-05-01'};
 const pending=ids.map(id=>review.find(x=>x.id===id));
 if(pending.some(x=>!x)||pending.some(x=>x.source!==
  'https://www.fortnite.com/competitive/events/S34_PlaystationCup/?region=ME&round=S34_PlaystationCupFinal_ME'||
  x.kind!=='参加確認'||x.prize!==null||x.verified!==true||
  x.date!=='2025-05-01'||x.region!=='ME'))
  throw Error('Original two S34 candidates no longer match reviewed source');
 const out={version:1,checkedOn:'2026-11-18',mode:'source-only original Epic identity research',
  event:win,checkedIds:ids,verified:[],held:[],providerTotalPages:null,pageErrors:0};
 try{
  const page=await getLeaderboard(win,0);
  if(!Number.isSafeInteger(page.totalPages)||page.totalPages<1||
   !Array.isArray(page.entries)||page.entries.length===0||
   page.entries.some((x,i)=>!Number.isSafeInteger(x.rank)||x.rank<1||
    i>0&&x.rank<page.entries[i-1].rank))
   throw Error('Provider returned invalid or unordered original scoreboard');
  out.providerTotalPages=page.totalPages;
  for(const row of pending){
   const raw=page.entries.filter(x=>x.rank===row.rank);
   const normalized=raw.map(x=>normalizeRow(x,win)).filter(Boolean);
   const hits=normalized.filter(x=>
    x.points===row.points&&x.kills===row.kills&&x.vrs===row.vrs&&x.matches===row.matches&&
    x.teamAccountIds.length===1&&accounts.get(x.teamAccountIds[0])===row.player);
   if(hits.length!==1){
    out.held.push({id:row.id,reason:'Exact Epic account ID or original score not confirmed',
     rank:row.rank,rawRankMatches:raw.length,scoreMatches:normalized.filter(x=>
      x.points===row.points&&x.kills===row.kills&&x.vrs===row.vrs&&x.matches===row.matches).length});
    continue;
   }
   out.verified.push({original:row,teamAccountIds:hits[0].teamAccountIds,
    providerName:hits[0].rawName,observedPage:0,windowKey:win.key});
  }
 }catch(e){
  out.pageErrors=1;
  for(const row of pending)out.held.push({id:row.id,reason:'Original API fetch failed: '+String(e?.message||e).slice(0,160)});
 }
 const filename='data/manual-approvals/20261118-s34-me-ps-final-two-recheck.json';
 fs.writeFileSync(path.join(root,filename),JSON.stringify(out,null,2)+'\n');
 console.log('S34_PS_ORIGINAL_RECHECK '+JSON.stringify({checked:2,verified:out.verified.length,
  held:out.held.length,pageErrors:out.pageErrors,totalPages:out.providerTotalPages,
  heldReasons:out.held.map(x=>x.reason)}));
})().catch(e=>{console.error('S34_ORIGINAL_SOURCE_ERROR '+e.stack);process.exitCode=1});