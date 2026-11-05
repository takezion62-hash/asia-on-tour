'use strict';
// Read-only Osirion provider. For now this script ONLY produces review proposals, never results.json.
const fs=require('node:fs'),path=require('node:path');
const {prepare}=require('./auto-sync-core.cjs');
const root=path.resolve(__dirname,'..');
const read=name=>JSON.parse(fs.readFileSync(path.join(root,name),'utf8'));
const write=(name,obj)=>fs.writeFileSync(path.join(root,name),JSON.stringify(obj,null,2)+'\n');
const regions=['ME','EU','NAC','NAW','OCE','BR'];
const nowJst=utc=>new Date(new Date(utc).getTime()+9*3600000).toISOString().slice(0,10);
const identity=url=>{
 const token=typeof url==='string'?url.match(/[?&]id=([0-9a-f-]{36})(?:&|$)/i)?.[1]:null;
 return token&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token)?token.replace(/-/g,'').toLowerCase():null;
};
function linkedAccounts(data){
 const known=new Set(data.players.candidates.map(p=>p.name)),map=new Map(),conflicts=[];
 for(const result of data.results){
  const source=[...(result.profileUrl?[{name:result.player,url:result.profileUrl}]:[]),...(result.profiles||[])];
  for(const entry of source){
   const id=identity(entry.url);if(!id||typeof entry.name!=='string')continue;
   if(!map.has(id))map.set(id,new Set());map.get(id).add(entry.name);
  }
 }
 const accounts=[];
 for(const [id,names] of map){
  const match=[...names];
  if(match.length===1&&known.has(match[0]))accounts.push({player:match[0],epicAccountId:id,confirmed:true});
  else conflicts.push({idPrefix:id.slice(0,8),names:match});
 }
 return {accounts,conflicts};
}
function parseStage(windowId){
 const match=windowId.match(/Event(\d+)Round([12])_(ME|EU|NAC|NAW|OCE|BR)$/);
 if(!match)return null;
 return {round:'Event '+Number(match[1])+' · Round '+Number(match[2])+' / '+(match[2]==='1'?'予選':'賞金決勝'),kind:match[2]==='1'?'予選':'賞金決勝'};
}
function discover(all,catalog,opts,time=Date.now()){
 const selected=new Map(),recentDays=Number.isInteger(opts.lookbackDays)?opts.lookbackDays:7,delay=(opts.minLagMinutes||240)*60000;
 for(const tournament of all){
  const full=typeof tournament.eventId==='string'?tournament.eventId:'';
  const match=full.match(/^epicgames_(S\d+_.+)_([A-Z]{2,4})$/);
  if(!match||!regions.includes(match[2]))continue;
  const [_,base,region]=match;
  const t=catalog.find(x=>x.series==='victory-cup'&&x.seasonId===base.split('_')[0]&&x.sourceEventIds?.includes(base));
  if(!t||!['solo','duo','trio','squad'].includes(t.team))continue;
  for(const window of tournament.eventWindows||[]){
   const windowId=window.eventWindowId,stage=typeof windowId==='string'?parseStage(windowId):null;
   const end=Date.parse(window.endTime),begin=Date.parse(window.beginTime);
   if(!stage||!windowId.endsWith('_'+region)||!Number.isFinite(end)||!Number.isFinite(begin))continue;
   if(end>time-delay||end<time-recentDays*86400000)continue;
   const key=full+'/'+windowId;
   selected.set(key,{key,fullEventId:full,eventId:base,windowId,region,dateJst:nowJst(window.beginTime),seasonId:t.seasonId,tournamentId:t.id,round:stage.round,kind:stage.kind,end});
  }
 }
 return [...selected.values()].sort((a,b)=>a.end-b.end);
}
function normalizeRow(entry,win){
 if(!entry||!Array.isArray(entry.players)||entry.players.length<1||entry.unscoredSessions?.length)return null;
 if(!Array.isArray(entry.sessionHistory)||!entry.sessionHistory.length)return null;
 const ids=entry.players.map(p=>p.accountId);
 if(ids.some(x=>typeof x!=='string'||!/^[0-9a-f]{32}$/i.test(x)))return null;
 const sums={matches:0,kills:0,vrs:0};
 for(const h of entry.sessionHistory){
  const s=h.trackedStats;
  if(!s||!Number.isSafeInteger(s.MATCH_PLAYED_STAT)||s.MATCH_PLAYED_STAT<0||!Number.isSafeInteger(s.TEAM_ELIMS_STAT_INDEX)||s.TEAM_ELIMS_STAT_INDEX<0||!Number.isSafeInteger(s.VICTORY_ROYALE_STAT)||s.VICTORY_ROYALE_STAT<0)return null;
  sums.matches+=s.MATCH_PLAYED_STAT;sums.kills+=s.TEAM_ELIMS_STAT_INDEX;sums.vrs+=s.VICTORY_ROYALE_STAT;
 }
 if(!sums.matches||!Number.isSafeInteger(entry.rank)||entry.rank<1||!Number.isSafeInteger(entry.pointsEarned)||entry.pointsEarned<0)return null;
 return {eventId:win.eventId,windowId:win.windowId,teamAccountIds:ids.map(x=>x.toLowerCase()),rank:entry.rank,points:entry.pointsEarned,kills:sums.kills,vrs:sums.vrs,matches:sums.matches,rawName:entry.players.map(x=>x.username||'非公開').join(' / '),cashVerified:false};
}
async function fetchJson(url){
 const response=await fetch(url,{headers:{accept:'application/json'},signal:AbortSignal.timeout(25000)});
 if(!response.ok)throw Error('Osirion API HTTP '+response.status+' '+new URL(url).pathname);
 const body=await response.json();
 if(body?.success===false)throw Error('Osirion API error');
 return body;
}
async function getTournaments(){
 const all=new Map();
 for(const region of regions){
  const response=await fetchJson('https://fnapi.osirion.gg/v1/tournaments?'+new URLSearchParams({region,includeHistoricData:'false'}));
  if(!Array.isArray(response.tournaments))throw Error('大会一覧の形式が変わりました');
  for(const item of response.tournaments)if(typeof item.eventId==='string')all.set(item.eventId,item);
 }
 return [...all.values()];
}
async function getLeaderboard(win,page){
 const params=new URLSearchParams({leaderboardEventId:win.fullEventId,leaderboardEventWindowId:win.windowId,page:String(page)});
 const result=await fetchJson('https://fnapi.osirion.gg/v1/tournaments/leaderboard?'+params);
 const l=result.leaderboard;
 if(!l||l.leaderboardEventId!==win.fullEventId||l.leaderboardEventWindowId!==win.windowId||!Array.isArray(l.entries)||!Number.isInteger(l.totalPages)||l.totalPages<1||l.totalPages>100)throw Error('大会順位表のID/形式が不正');
 return l;
}
async function main(){
 const config=read('auto-sync-config.json');
 if(!config.enabled||config.provider!=='osirion'){console.log('OSIRION_SYNC_DISABLED');return}
 if(config.mode!=='review')throw Error('Osirionの自動公開は安全性検証が完了するまで無効です');
 const data={results:read('results.json'),players:read('players.json'),tournaments:read('tournaments.json'),updates:read('updates.json')};
 const {accounts,conflicts}=linkedAccounts(data);
 if(!accounts.length)throw Error('追跡対象のIDがありません');
 const all=await getTournaments();
 const windows=discover(all,data.tournaments.catalog,config);
 const state=read('auto-sync-scan.json');
 if(state.version!==1||!state.windows||typeof state.windows!=='object')throw Error('checkpoint invalid');
 const active=windows.filter(w=>!state.windows[w.key]?.complete).slice(0,config.maxWindowsPerRun||2);
 const previewConfig={version:1,accounts,windows:active.map(w=>({eventId:w.eventId,windowId:w.windowId,dateJst:w.dateJst,region:w.region,seasonId:w.seasonId,tournamentId:w.tournamentId,kind:w.kind,round:w.round}))};
 let budget=Math.min(Math.max(config.maxPagesPerRun||30,1),50),scanned=0,invalidRows=0;
 for(const win of active){
  const checkpoint=state.windows[win.key]||{nextPage:0,complete:false,proposals:[],pages:0};
  while(budget>0&&!checkpoint.complete){
   const page=checkpoint.nextPage,l=await getLeaderboard(win,page);
   if(page===0&&l.entries.length===0)break; // Empty success responses must not be treated as complete.
   if(!l.entries.length&&page<l.totalPages-1)throw Error('順位表に未期待の空ページ: '+win.key+' page '+page);
   const entries=l.entries.map(e=>normalizeRow(e,win));
   invalidRows+=entries.filter(x=>!x).length;
   const found=prepare({entries:entries.filter(Boolean)},previewConfig,data).proposals;
   const already=new Set(checkpoint.proposals.map(x=>x.id));
   for(const row of found)if(!already.has(row.id)){checkpoint.proposals.push(row);already.add(row.id)}
   checkpoint.nextPage=page+1;checkpoint.pages++;scanned++;budget--;
   checkpoint.totalPages=l.totalPages;
   checkpoint.complete=checkpoint.nextPage>=l.totalPages;
  }
  state.windows[win.key]=checkpoint;
  if(budget<=0)break;
 }
 const proposals=Object.values(state.windows).flatMap(w=>w.proposals||[]);
 const unique=new Map(proposals.map(x=>[x.id,x]));
 const finished=Object.values(state.windows).filter(w=>w.complete).length;
 const stamp=new Date().toISOString();
 const status={version:1,state:'checked',checkedAt:stamp,mode:'review',provider:'osirion',linkedPlayers:accounts.length,trackedWindows:windows.length,found:unique.size,skipped:invalidRows,imported:0,scannedPages:scanned,completedWindows:finished,identityConflicts:conflicts.length,message:'Osirionに接続済み。既存プロフィールのうちIDが一意な'+accounts.length+'名を追跡。'+scanned+'ページを検査、'+unique.size+'件が確認待ち。名前の競合'+conflicts.length+'件は対象外。'};
 state.checkedAt=stamp;
 write('auto-sync-scan.json',state);
 write('auto-sync-review.json',{version:1,status:'review',checkedAt:stamp,proposals:[...unique.values()]});
 write('auto-sync-status.json',status);
 console.log('OSIRION_REVIEW '+JSON.stringify({scannedPages:scanned,linkedPlayers:accounts.length,identityConflicts:conflicts.length,windows:windows.length,proposals:unique.size,finished}));
}
if(require.main===module)main().catch(e=>{console.error('OSIRION_SYNC_ERROR '+e.stack);process.exitCode=1});
module.exports={identity,linkedAccounts,parseStage,discover,normalizeRow,main};
