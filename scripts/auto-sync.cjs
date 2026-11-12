'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {prepare,applyProposals}=require('./auto-sync-core.cjs');
const {validateData}=require('./data-checks.cjs');
const {readResults,publishResults}=require('./source-results-store.cjs');
const root=path.resolve(__dirname,'..');
const read=f=>f==='results.json'?readResults(root).rows:JSON.parse(fs.readFileSync(path.join(root,f),'utf8'));
const save=(f,v)=>f==='results.json'?publishResults(root,v):fs.writeFileSync(path.join(root,f),JSON.stringify(v,null,2)+'\n');
const config=read('auto-sync-config.json');
const data={results:read('results.json'),players:read('players.json'),tournaments:read('tournaments.json'),updates:read('updates.json')};
const feedFlag=process.argv.indexOf('--feed'),dry=process.argv.includes('--dry-run');
function normalize(payload,eventId,windowId){
 const body=payload?.data??payload;
 const rows=Array.isArray(body?.entries)?body.entries:Array.isArray(body?.leaderboard)?body.leaderboard:Array.isArray(body?.results)?body.results:null;
 if(!rows)throw Error('API形式が不明。登録を中止: '+windowId);
 return rows.map(x=>({eventId,windowId,teamAccountIds:Array.isArray(x.teamAccountIds)?x.teamAccountIds:Array.isArray(x.teamPlayers)?x.teamPlayers.map(p=>p.accountId):Array.isArray(x.players)?x.players.map(p=>p.accountId):typeof x.accountId==='string'?[x.accountId]:[],rank:x.rank,points:x.points??x.score,kills:x.kills??x.eliminations,vrs:x.vrs??x.wins,matches:x.matches??x.gamesPlayed,rawName:x.displayName,cashVerified:false}));
}
async function fetchFeed(){
 const key=process.env.AOT_FORTNITE_API_KEY;
 if(!key)throw Error('GitHub Secret AOT_FORTNITE_API_KEYが未設定');
 if(!config.windows.length||!config.accounts.length)throw Error('Epic IDか大会ウィンドウ未設定');
 const entries=[],limit=Math.min(config.maxPages||120,150);
 for(const win of config.windows){
  if(win.ready!==true)continue;
  let page=0;
  while(page<limit){
   const url='https://prod.api-fortnite.com/api/v2/events/'+encodeURIComponent(win.eventId)+'/windows/'+encodeURIComponent(win.windowId)+'/leaderboard?page='+page;
   const response=await fetch(url,{headers:{'x-api-key':key,accept:'application/json'},signal:AbortSignal.timeout(20000)});
   if(!response.ok)throw Error('大会API HTTP '+response.status+': '+win.windowId+' page '+page);
   const body=await response.json(),rows=normalize(body,win.eventId,win.windowId);
   entries.push(...rows);
   if(!rows.length||body?.hasMore===false||body?.data?.hasMore===false||body?.nextPage===null||body?.data?.nextPage===null)break;
   page++;
  }
  if(page>=limit)throw Error('順位表ページの上限に到達したので登録停止: '+win.windowId);
 }
 return {entries};
}
async function run(){
 if(config.enabled!==true&&feedFlag<0){console.log('AUTO_SYNC_DISABLED: 本人照合/APIキー設定待ち');return}
 const feed=feedFlag>=0?JSON.parse(fs.readFileSync(path.resolve(process.argv[feedFlag+1]),'utf8')):await fetchFeed();
 const x=prepare(feed,config,data),now=new Date().toISOString(),mode=config.mode==='publish'?'publish':'review';
 const status={version:1,state:'checked',checkedAt:now,mode,linkedPlayers:x.linkedPlayers,trackedWindows:x.windows,found:x.proposals.length,skipped:x.skipped.length,imported:0,message:x.proposals.length?'新規候補あり':'新規候補なし'};
 if(mode==='publish'&&!dry){
  applyProposals(data,x.proposals,now);
  const v=validateData(data);
  if(v.errors.length)throw Error('JSON検証に失敗。保存しません: '+JSON.stringify(v.errors.slice(0,3)));
  save('results.json',data.results);save('updates.json',data.updates);status.imported=x.proposals.length;
  status.message=x.proposals.length+'件を検証後に追記';
 }
 if(!dry){save('auto-sync-review.json',{version:1,checkedAt:now,status:'review',proposals:x.proposals});save('auto-sync-status.json',status)}
 console.log(JSON.stringify(status));
}
run().catch(e=>{console.error('AUTO_SYNC_ERROR: '+e.message);process.exitCode=1});
