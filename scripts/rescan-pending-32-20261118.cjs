'use strict';
(async()=>{
// Re-fetch only observed candidate pages from the original Osirion provider.
// This is a read-only research job: no results are published and no awards
// are inferred from a partial leaderboard.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const {readResults}=require('./source-results-store.cjs');
const {linkedAccounts,normalizeRow,getLeaderboard}=require('./osirion-sync.cjs');
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const ids=[
  "auto-s30-c84acc2ac9ff",
  "auto-s30-76be9ad0ebbe",
  "auto-s30-040dcc04c0b2",
  "auto-s30-b6d4e1402a37",
  "auto-s30-756a5ffaeb14",
  "auto-s30-161bcfac873f",
  "auto-s30-fbdce0282f26",
  "auto-s30-fe3a5e3ba5e0",
  "auto-s30-1817974baef5",
  "auto-s30-9e73de77745d",
  "auto-s30-5e8ea2768e51",
  "auto-s30-16cb81247877",
  "auto-s30-46b1837e398e",
  "auto-s30-87ebd653e6ac",
  "auto-s30-3bfbd8cb762b",
  "auto-s30-e2d6134b0036",
  "auto-s30-2ed4bd929279",
  "auto-s30-be0fda0c3a51",
  "auto-s37-c3c87ab3a2af",
  "auto-s37-46087ce48e12",
  "auto-s37-13871b65f3aa",
  "auto-s37-ad6bfb4e113b",
  "auto-s37-232d6ba9c3f2",
  "auto-s37-ada5fcd01cf8",
  "auto-s37-9c291b73fa44",
  "auto-s37-6f934070f0ae",
  "auto-s37-2124c353d60c",
  "auto-s37-8353469d7b88",
  "auto-s37-397c5764cb06",
  "auto-s37-9af2234758ec",
  "auto-s37-a571b7105e24",
  "auto-s37-767d34f8eb64"
];
const keys=[
 'epicgames_S30_SoloZBVictoryCashCup_NAC/S30_SoloZBVictoryCashCup_Event5Round1_NAC',
 'epicgames_S30_SoloZBVictoryCashCup_NAC/S30_SoloZBVictoryCashCup_Event7Round1_NAC',
 'epicgames_S37_ConsoleDuosCashCups_NAW/S37_ConsoleDuosCashCups_Event9Round1_NAW'
];
const resultRows=readResults(root).rows;
const data={results:resultRows,players:read('players.json'),tournaments:read('tournaments.json')};
const verified=linkedAccounts(data);
const lookup=new Map(verified.accounts.map(x=>[x.epicAccountId,x.player]));
const waiting=read('history-sync-review.json').proposals;
const checkpoints=read('history-sync-scan.json').windows;
const existing=new Set(resultRows.map(x=>x.id));
const seen=new Set(),verifiedRows=[],held=[],pagesFetched={},originalKeys=new Map();
for(const key of keys){
 const cp=checkpoints[key];
 if(!cp||cp.complete!==false||cp.rankingOrderValid!==true||
 !Number.isSafeInteger(cp.pages)||cp.pages<1||
 cp.nextPage!==cp.pages||!Number.isSafeInteger(cp.totalPages)||
 cp.lastSeenRank!==cp.pages*100||cp.lastError||cp.lastErrorCode||cp.retryAfter||
 cp.emptyAttempts||!Number.isFinite(Date.parse(cp.lastSuccessAt))||
 Date.now()-Date.parse(cp.lastSuccessAt)<14400000)
  throw Error('Checkpoint must have an error-free mature consecutive page prefix: '+key);
 originalKeys.set(key,{key,pages:cp.pages,totalPages:cp.totalPages,nextPage:cp.nextPage,
  lastSeenRank:cp.lastSeenRank,lastSuccessAt:cp.lastSuccessAt,
  rankingOrderValid:true,complete:false});
}
for(const id of ids){
 if(seen.has(id))throw Error('Duplicated requested ID: '+id);
 seen.add(id);
 const row=waiting.find(x=>x.id===id);
 if(!row||existing.has(id)){held.push({id,reason:row?'already published':'missing original review'});continue;}
 const url=new URL(row.source);
 const ev=url.pathname.match(/^\/competitive\/events\/([^/]+)\/$/)?.[1];
 const region=url.searchParams.get('region'),windowId=url.searchParams.get('round');
 const key='epicgames_'+ev+'_'+region+'/'+windowId,meta=originalKeys.get(key);
 if(!meta||!Number.isSafeInteger(row.rank)||row.rank<1||row.rank>meta.lastSeenRank||
 row.verified!==true||row.prize!==0||row.kind!=='予選'||
 url.protocol!=='https:'||url.hostname!=='www.fortnite.com'||
 url.searchParams.size!==2)
 {held.push({id,reason:'not a verified source-locked prefix candidate'});continue;}
 const cp=checkpoints[key];
 const saved=cp.proposals?.find(x=>x.id===id);
 if(!saved||['date','region','player','playerRaw','rank','points','kills','vrs','matches','tournamentId','source']
 .some(k=>JSON.stringify(saved[k])!==JSON.stringify(row[k])))
 {held.push({id,reason:'original checkpoint mismatch'});continue;}
 const page=Math.floor((row.rank-1)/100);
 if(page>=meta.pages){held.push({id,reason:'rank outside captured pages'});continue;}
 const pgKey=key+'#'+page;
 if(!pagesFetched[pgKey]){
  const win={fullEventId:'epicgames_'+ev+'_'+region,
   eventId:ev,windowId,region,key,dateJst:row.date};
  try{
   const pageData=await getLeaderboard(win,page);
   if(pageData.totalPages!==meta.totalPages||
    !Array.isArray(pageData.entries)||
    pageData.entries.some((z,i)=>!Number.isSafeInteger(z.rank)||z.rank<1||
      i>0&&z.rank<pageData.entries[i-1].rank))
    {pagesFetched[pgKey]={error:'rank order/pages changed'};}
   else pagesFetched[pgKey]={win,leaderboard:pageData.entries,totalPages:pageData.totalPages};
  }catch(e){pagesFetched[pgKey]={error:String(e?.message||e).slice(0,180)};}
 }
 const pageData=pagesFetched[pgKey];
 if(pageData.error){held.push({id,reason:'provider error: '+pageData.error});continue;}
 const rawHits=pageData.leaderboard.filter(e=>e.rank===row.rank);
 const normalized=rawHits.map(entry=>normalizeRow(entry,pageData.win)).filter(Boolean);
 const named=normalized.filter(x=>
  x.points===row.points&&x.kills===row.kills&&x.vrs===row.vrs&&x.matches===row.matches&&
  x.teamAccountIds.length===(Array.isArray(row.players)?row.players.length:1)&&
  x.teamAccountIds.map(accountId=>lookup.get(accountId)).join(' / ')===(row.players||[row.player]).join(' / '));
 if(named.length!==1){held.push({id,reason:'unverified Epic account or scoreboard stats, hits='+normalized.length});continue;}
 verifiedRows.push({original:row,teamAccountIds:named[0].teamAccountIds,
  originalRawFromProvider:named[0].rawName,observedPage:page,
  windowKey:key,providerTotalPages:pageData.totalPages});
}
const out={version:1,checkedOn:'2026-11-18',
 mode:'independent targeted original-account/score verification, no publishing',
 checkedIds:ids,groups:[...originalKeys.values()],verified:verifiedRows,
 held,apiPagesAttempted:Object.keys(pagesFetched).length,
 apiPageErrors:Object.values(pagesFetched).filter(x=>x.error).length};
const filename='data/manual-approvals/20261118-targeted-32-original-epic-proof.json';
fs.writeFileSync(path.join(root,filename),JSON.stringify(out,null,2)+'\n');
const reasons={};for(const h of held)reasons[h.reason]=(reasons[h.reason]||0)+1;
console.log('TARGETED_ORIGINAL_ACCOUNT_RESCAN '+JSON.stringify({checked:ids.length,
 verified:verifiedRows.length,held:held.length,byReason:reasons,
 pages:Object.keys(pagesFetched).length,pageErrors:out.apiPageErrors,
 byWindow:[...originalKeys.keys()].map(k=>({key:k,verified:verifiedRows.filter(x=>x.windowKey===k).length}))}));

})().catch(e=>{console.error('TARGETED_RESCAN_FAILURE '+e.stack);process.exitCode=1;});
