'use strict';
// Osirion data provider. The regular workflow is review-only; the historical workflow
// may auto-approve only narrowly allow-listed Victory Cup rows with official rules.
const fs=require('node:fs'),path=require('node:path');
const {prepare,maximumMatches,applyProposals}=require('./auto-sync-core.cjs');
const {evaluate}=require('./verified-history-approval.cjs');
const root=path.resolve(__dirname,'..');
const read=name=>JSON.parse(fs.readFileSync(path.join(root,name),'utf8'));
const write=(name,obj)=>fs.writeFileSync(path.join(root,name),JSON.stringify(obj,null,2)+'\n');
const regions=['ME','EU','NAC','NAW','OCE','BR'];
const REVIEW_SERIES=new Set(['victory-cup','cash-cup','fncs','performance-evaluation','skin-cup','icon-cup','playstation-cup']);
const nowJst=utc=>new Date(new Date(utc).getTime()+9*3600000).toISOString().slice(0,10);
const identity=url=>{
 const token=typeof url==='string'?url.match(/[?&]id=([0-9a-f-]{36})(?:&|$)/i)?.[1]:null;
 return token&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token)?token.replace(/-/g,'').toLowerCase():null;
};
function linkedAccounts(data){
 const known=new Set(data.players.candidates.map(p=>p.name)),aliases=new Map(),map=new Map(),conflicts=[];
 // Only names already explicitly confirmed in players.json may resolve to a canonical player.
 // Never use fuzzy matching or assign a single alias that maps to multiple candidates.
 for(const [canonical,list] of Object.entries(data.players.confirmedAliases||{})){
  if(!known.has(canonical)||!Array.isArray(list))continue;
  for(const alias of list){
   if(typeof alias!=='string'||!alias.trim())continue;
   if(!aliases.has(alias))aliases.set(alias,new Set());
   aliases.get(alias).add(canonical);
  }
 }
 const canonicalName=name=>{
  const matches=new Set([...(known.has(name)?[name]:[]),...(aliases.get(name)||[])]);
  return matches.size===1?[...matches][0]:null;
 };
 for(const result of data.results){
  const source=[...(result.profileUrl?[{name:result.player,url:result.profileUrl}]:[]),...(result.profiles||[])];
  for(const entry of source){
   const id=identity(entry.url);if(!id||typeof entry.name!=='string')continue;
   if(!map.has(id))map.set(id,new Set());map.get(id).add(entry.name);
  }
 }
 const accounts=[];
 for(const [id,names] of map){
  const raw=[...names],resolved=raw.map(canonicalName);
  if(resolved.every(Boolean)&&new Set(resolved).size===1)accounts.push({player:resolved[0],epicAccountId:id,confirmed:true});
  else conflicts.push({idPrefix:id.slice(0,8),names:raw});
 }
 return {accounts,conflicts};
}
function parseStage(windowId){
 if(typeof windowId!=='string')return null;
 const event=windowId.match(/Event(\d+)_?Round([12])_(ME|EU|NAC|NAW|OCE|BR)$/);
 const day=windowId.match(/_Round([12])_Day(\d+)_(ME|EU|NAC|NAW|OCE|BR)$/);
 if(!event&&!day)return null;
 const stage=Number(event?event[2]:day[1]);
 const label=event?'Event '+Number(event[1]):'Day '+Number(day[2]);
 return {round:label+' · Round '+stage+' / '+(stage===1?'予選':'賞金決勝'),kind:stage===1?'予選':'賞金決勝'};
}
// Never infer qualification, cash prizes or cosmetic rewards from a leaderboard.
// Other series carry a neutral stage label and remain review-only.
function parseReviewStage(windowId){
 if(typeof windowId!=='string'||!/_?(ME|EU|NAC|NAW|OCE|BR)$/.test(windowId))return null;
 const event=windowId.match(/(?:^|_)Event(\d+)_?Round(\d+)(?:_|$)/i);
 const day=windowId.match(/(?:^|_)Round(\d+)_Day(\d+)(?:_|$)/i);
 const generic=windowId.match(/(?:^|_)Event(\d+)(?:_|$)/i);
 const special=windowId.match(/(?:^|_)(Qualifier|Qualifiers|SemiFinal|Final|GrandFinal|Heat\d+)(?:_|$)/i);
 const label=event?'Event '+Number(event[1])+' · Round '+Number(event[2]):day?'Day '+Number(day[2])+' · Round '+Number(day[1]):generic?'Event '+Number(generic[1]):special?special[1]:'単一開催枠';
 return {round:label+' / 参加確認',kind:'参加確認'};
}
function reviewSeries(opts){
 const list=opts?.reviewSeries;
 return new Set(Array.isArray(list)?list.filter(s=>REVIEW_SERIES.has(s)):['victory-cup']);
}
function catalogMatches(catalog,base,series){
 return catalog.filter(x=>series.has(x.series)&&x.seasonId===base.split('_')[0]&&x.sourceEventIds?.includes(base)&&['solo','duo','trio','squad'].includes(x.team)&&
   (x.series!=='fncs'||(/^S\d+_FNCSDivisionalCup_Division1$/.test(base)&&/^fncs-division-1(?:-practice)?$/.test(x.subtype||''))));
}
function discover(all,catalog,opts,time=Date.now()){
 const selected=new Map(),recentDays=Number.isInteger(opts.lookbackDays)?opts.lookbackDays:7,delay=(opts.minLagMinutes||240)*60000;
 for(const tournament of all){
  const full=typeof tournament.eventId==='string'?tournament.eventId:'';
  const match=full.match(/^epicgames_(S\d+_.+)_([A-Z]{2,4})$/);
  if(!match||!regions.includes(match[2]))continue;
  const [_,base,region]=match;
  if(Array.isArray(opts.regions)&&!opts.regions.includes(region))continue;
  const mapped=catalogMatches(catalog,base,reviewSeries(opts));
  // Ambiguous event mappings and uncatalogued series are never guessed.
  if(mapped.length!==1)continue;
  const t=mapped[0];
  for(const window of tournament.eventWindows||[]){
   const windowId=window.eventWindowId,stage=typeof windowId==='string'?(t.series==='victory-cup'?parseStage(windowId):parseReviewStage(windowId)):null;
   const end=Date.parse(window.endTime),begin=Date.parse(window.beginTime);
   if(!stage||!windowId.endsWith('_'+region)||!Number.isFinite(end)||!Number.isFinite(begin))continue;
   const dateJst=nowJst(window.beginTime);
   if(end>time-delay)continue;
   if(opts.fromDate&&opts.toDate){
    if(dateJst<opts.fromDate||dateJst>opts.toDate)continue;
   }else if(end<time-recentDays*86400000)continue;
   const key=full+'/'+windowId;
   selected.set(key,{key,fullEventId:full,eventId:base,windowId,region,dateJst,seasonId:t.seasonId,tournamentId:t.id,series:t.series,round:stage.round,kind:stage.kind,end});
  }
 }
 return [...selected.values()].sort((a,b)=>a.end-b.end);
}
// Report uncatalogued eligible tournament IDs rather than guessing their formats.
function discoverUnmapped(all,catalog,opts,time=Date.now()){
 const days=Number.isInteger(opts.lookbackDays)?opts.lookbackDays:7,missing=new Set();
 for(const tournament of all){
  const full=typeof tournament.eventId==='string'?tournament.eventId:'',match=full.match(/^epicgames_(S[0-9]+_.+)_([A-Z]{2,4})$/);
  if(!match||!regions.includes(match[2]))continue;
  const [,base,region]=match;
  const title=String(tournament.displayData?.longFormatTitle||tournament.displayData?.shortFormatTitle||'');
  const knownType=/(VictoryCup|VictoryCashCup|ConsoleVCC|CashCup|FNCSDivisionalCup_Division1|PerformanceEvaluation|PerfEval|IconCup)/i.test(base)||/\b(?:Cash Cup|Victory Cup|Performance Evaluation|Icon Cup)\b/i.test(title);
  const cosmeticCup=/\bCup\b/i.test(title)&&!/Ranked Cup|Test Cup/i.test(title)&&!/^S\d+_FNCS(?:Reload|Solos|Major)/i.test(base);
  if(!knownType&&!cosmeticCup)continue;
  if(/^S\d+_FNCS/i.test(base)&&!/^S\d+_FNCSDivisionalCup_Division1$/.test(base)&&!cosmeticCup)continue;
  if(catalog.some(x=>x.seasonId===base.split('_')[0]&&x.sourceEventIds?.includes(base)))continue;
  const relevant=(tournament.eventWindows||[]).some(w=>{
   const end=Date.parse(w.endTime);
   return typeof w.eventWindowId==='string'&&w.eventWindowId.endsWith('_'+region)&&Number.isFinite(end)&&end>=time-days*86400000&&end<=time+14*86400000;
  });
  if(relevant)missing.add(base);
 }
 return [...missing].sort();
}
// Only official, season-specific Round 1 advancement cutoffs are trusted.
// Unmapped seasons/types remain review-only without an inferred cutoff.
function advancementLimit(win){
 if(win.kind!=='予選')return null;
 const isEU=win.region==='EU',isNAC=win.region==='NAC';
 const type=win.tournamentId;
 if((type==='ch7s3-solo-victory-cup'||type==='ch7s4-solo-victory-cup')&&['S41','S42'].includes(win.seasonId))return isEU?4000:isNAC?2000:800;
 if(['S41','S42'].includes(win.seasonId)&&type.endsWith('-solo-reload-victory-cup'))return isEU?1600:isNAC?800:320;
 if(win.seasonId==='S42'&&type.endsWith('-console-zero-build-solo-victory-cup'))return isEU||isNAC?2000:1000;
 if(win.seasonId==='S42'&&type.endsWith('-reload-duos-victory-cup'))return isEU||isNAC?300:120;
 return null;
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
async function getTournaments(historical=false){
 const all=new Map();
 for(const region of regions){
  const response=await fetchJson('https://fnapi.osirion.gg/v1/tournaments?'+new URLSearchParams({region,includeHistoricData:historical?'true':'false'}));
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
// Balance existing Victory Cups and safely matched review-only series in the same
// run; never let a large FNCS leaderboard starve known cash records (or vice versa).
function selectActiveWindows(windows,state,config){
 const pending=windows.filter(w=>{
  const item=state.windows[w.key];
  return !item?.complete&&(!item?.retryAfter||Date.parse(item.retryAfter)<=Date.now());
 });
 const limit=Math.max(1,config.maxWindowsPerRun||2);
 const victory=pending.filter(w=>w.series==='victory-cup');
 const review=pending.filter(w=>w.series!=='victory-cup');
 if(!victory.length||!review.length)return pending.slice(0,limit);
 const vQuota=Math.ceil(limit/2),chosen=[...victory.slice(0,vQuota),...review.slice(0,limit-vQuota)];
 const seen=new Set(chosen.map(w=>w.key));
 for(const win of pending){if(chosen.length>=limit)break;if(!seen.has(win.key)){chosen.push(win);seen.add(win.key)}}
 return chosen;
}
async function main(){
 const historical=process.argv.includes('--history');
 const prefix=historical?'history-sync':'auto-sync';
 const config=read(prefix+'-config.json');
 if(historical){
  const validDate=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&!Number.isNaN(Date.parse(x))&&new Date(x).toISOString().slice(0,10)===x;
  if(!validDate(config.fromDate)||!validDate(config.toDate)||config.fromDate>config.toDate||!Array.isArray(config.regions)||!config.regions.length||config.regions.some(x=>!regions.includes(x)))throw Error('過去大会の期間または地域設定が不正');
 }
 if(!config.enabled||config.provider!=='osirion'){console.log('OSIRION_SYNC_DISABLED');return}
 if(config.mode!=='review')throw Error('Osirionの自動公開は安全性検証が完了するまで無効です');
 const data={results:read('results.json'),players:read('players.json'),tournaments:read('tournaments.json'),updates:read('updates.json')};
 const {accounts,conflicts}=linkedAccounts(data);
 if(!accounts.length)throw Error('追跡対象のIDがありません');
 const all=await getTournaments(historical);
 const windows=discover(all,data.tournaments.catalog,config);
 const unmapped=historical?[]:discoverUnmapped(all,data.tournaments.catalog,config);
 const state=read(prefix+'-scan.json');
 if(state.version!==1||!state.windows||typeof state.windows!=='object')throw Error('checkpoint invalid');
 const active=selectActiveWindows(windows,state,config);
 const previewConfig={version:1,accounts,windows:active.map(w=>({eventId:w.eventId,windowId:w.windowId,dateJst:w.dateJst,region:w.region,seasonId:w.seasonId,tournamentId:w.tournamentId,kind:w.kind,round:w.round}))};
 let budget=Math.min(Math.max(config.maxPagesPerRun||30,1),50),scanned=0,invalidRows=0;
 for(const win of active){
  const checkpoint=state.windows[win.key]||{nextPage:0,complete:false,proposals:[],pages:0};
  let pagesThisWindow=0;
  const perWindowLimit=Math.min(Math.max(config.maxPagesPerWindowPerRun||budget,1),50);
  while(budget>0&&pagesThisWindow<perWindowLimit&&!checkpoint.complete){
   const page=checkpoint.nextPage,l=await getLeaderboard(win,page);
   if(page===0&&l.entries.length===0){
    checkpoint.emptyAttempts=(checkpoint.emptyAttempts||0)+1;
    checkpoint.retryAfter=new Date(Date.now()+Math.min(checkpoint.emptyAttempts,7)*86400000).toISOString();
    break; // Unavailable historic page: retry later, without blocking other windows.
   }
   checkpoint.emptyAttempts=0;
   delete checkpoint.retryAfter;
   if(!l.entries.length&&page<l.totalPages-1)throw Error('順位表に未期待の空ページ: '+win.key+' page '+page);
   const cutoff=historical?advancementLimit(win):null;
   const pageRanks=l.entries.map(e=>e.rank);
   const ordered=pageRanks.every((rank,i)=>Number.isSafeInteger(rank)&&rank>=1&&(i===0||rank>=pageRanks[i-1]));
   const crossed=ordered&&cutoff!==null&&pageRanks.some(rank=>rank>cutoff);
   const eligibleRows=cutoff===null?l.entries:l.entries.filter(e=>!Number.isSafeInteger(e.rank)||e.rank<=cutoff);
   const entries=eligibleRows.map(e=>normalizeRow(e,win));
   invalidRows+=entries.filter(x=>!x).length;
   const found=prepare({entries:entries.filter(Boolean)},previewConfig,data).proposals;
   const already=new Set(checkpoint.proposals.map(x=>x.id));
   for(const row of found)if(!already.has(row.id)){checkpoint.proposals.push(row);already.add(row.id)}
   checkpoint.nextPage=page+1;checkpoint.pages++;scanned++;budget--;pagesThisWindow++;
   checkpoint.totalPages=l.totalPages;
   checkpoint.complete=checkpoint.nextPage>=l.totalPages||crossed;
  }
  state.windows[win.key]=checkpoint;
  if(budget<=0)break;
 }
 const eligible=new Set(windows.map(w=>w.key));
 const recordedIds=new Set(data.results.map(x=>x.id));
 const foundInScope=Object.entries(state.windows).filter(([key])=>eligible.has(key)).flatMap(([,w])=>w.proposals||[]);
 const catalogById=new Map(data.tournaments.catalog.map(t=>[t.id,t]));
 const validHistory=foundInScope.filter(p=>{
  const tournament=catalogById.get(p.tournamentId);
  const cap=tournament?maximumMatches({...p,catalog:tournament}):null;
  return cap===null||p.matches<=cap;
 });
 const invalidCached=foundInScope.length-validHistory.length;
 const recordedFromReview=validHistory.filter(x=>recordedIds.has(x.id)).length;
 const pending=validHistory.filter(x=>!recordedIds.has(x.id));
 const stamp=new Date().toISOString();
 let imported=0,manuallyHeld=0;
 const importedIds=new Set(),reasons=new Map();
 if(historical&&config.autoApproveVerified===true){
  const decisions=evaluate(pending,windows,state.windows,data);
  manuallyHeld=decisions.held.length;
  for(const hold of decisions.held)reasons.set(hold.id,hold.reason);
  for(const row of decisions.approved)importedIds.add(row.id);
  imported=applyProposals(data,decisions.approved,stamp);
  if(imported){
   const entry=data.updates.entries[0];
   entry.title='公式規則で自動承認：過去大会'+imported+'戦績';
   entry.description='Epic公式規則とOsirion順位表、確認済み選手ID・既存戦績を照合。予選突破と決勝0VR（賞金$0）のみ自動承認。既存登録を保持。';
   write('results.json',data.results);
   write('updates.json',data.updates);
  }
 }
 const proposals=pending.filter(x=>!importedIds.has(x.id)).map(x=>reasons.has(x.id)?{...x,reviewReason:reasons.get(x.id)}:x);
 const unique=new Map(proposals.map(x=>[x.id,x]));
 const finished=Object.entries(state.windows).filter(([key,w])=>eligible.has(key)&&w.complete).length;
 const reviewOnlyWindows=windows.filter(w=>w.series!=='victory-cup').length;
 const reviewOnlyCandidates=unique.size?Array.from(unique.values()).filter(p=>p.reviewOnly===true).length:0;
 const cumulativeApprovals=data.updates.entries.filter(x=>x.title?.startsWith('公式規則で自動承認：')).reduce((sum,x)=>sum+(x.recordIds?.length||0),0);
 const status={version:1,state:'checked',checkedAt:stamp,mode:'review',scope:historical?'history':'recent',fromDate:historical?config.fromDate:null,toDate:historical?config.toDate:null,provider:'osirion',linkedPlayers:accounts.length,trackedWindows:windows.length,found:unique.size,skipped:invalidRows,imported,scannedPages:scanned,completedWindows:finished,identityConflicts:conflicts.length,alreadyRegistered:recordedFromReview,autoApprovedTotal:cumulativeApprovals,invalidCachedCandidates:invalidCached,manualReviewCandidates:manuallyHeld,retryWindows:Object.entries(state.windows).filter(([key,w])=>eligible.has(key)&&!w.complete&&w.retryAfter).length,reviewOnlyWindows,reviewOnlyCandidates,unmappedEvents:unmapped.length,unmappedEventIds:unmapped.slice(0,12),message:'Osirionで'+accounts.length+'アカウントIDを追跡。今回の公式規則による自動承認'+imported+'件、追加確認待ち'+unique.size+'件、名義照合保留'+conflicts.length+'件。'};
 state.checkedAt=stamp;
 write(prefix+'-scan.json',state);
 write(prefix+'-review.json',{version:1,status:'review',checkedAt:stamp,proposals:[...unique.values()]});
 write(prefix+'-status.json',status);
 console.log((historical?'OSIRION_HISTORY_REVIEW ':'OSIRION_REVIEW ')+JSON.stringify({scannedPages:scanned,linkedPlayers:accounts.length,identityConflicts:conflicts.length,windows:windows.length,unmappedEvents:unmapped.length,proposals:unique.size,imported,finished}));
}
if(require.main===module)main().catch(e=>{console.error('OSIRION_SYNC_ERROR '+e.stack);process.exitCode=1});
module.exports={identity,linkedAccounts,parseStage,parseReviewStage,discover,discoverUnmapped,selectActiveWindows,advancementLimit,normalizeRow,getTournaments,main};
