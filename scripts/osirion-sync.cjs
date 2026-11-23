'use strict';
// Osirion data provider. The regular workflow is review-only; the historical workflow
// may auto-approve only narrowly allow-listed Victory Cup rows with official rules.
// Operations: a source change here triggers both recent and historical review workflows;
// continue enforcing identity, official-rule, and duplicate checks before publication.
const fs=require('node:fs'),path=require('node:path');
const {readResults,publishResults}=require('./source-results-store.cjs');
const {prepare,maximumMatches,applyProposals}=require('./auto-sync-core.cjs');
const {evaluate,RULES}=require('./verified-history-approval.cjs');
const {evaluate:evaluateCosmetics,cutoffForWindow}=require('./automatic-cosmetic-approval.cjs');
const {evaluate:evaluateCash,cashLimitForWindow}=require('./automatic-cash-approval.cjs');
const {evaluate:evaluatePerformance,qualifierCutoff,evaluationStage}=require('./automatic-performance-approval.cjs');
const {evaluate:evaluateUnreal,unrealWindow}=require('./automatic-unreal-approval.cjs');
const {evaluate:evaluateNvidia,nvidiaWindow}=require('./automatic-nvidia-approval.cjs');
const {evaluate:evaluateDuoQualifier}=require('./automatic-duo-qualifier-approval.cjs');
const {evaluate:evaluatePlayStation,stageFor:playstationStageFor}=require('./automatic-playstation-approval.cjs');
const {scanCoverage}=require('./scan-coverage.cjs');
const {finishableWindows,remainingPages,windowPageAllowance,leastCoveredBucket}=require('./scan-efficiency.cjs');
const {recoveryShortlist}=require('./review-recovery-priority.cjs');
const {runDelta:runNewPlayerDelta}=require('./new-player-history-delta.cjs');
const {trafficPlan,createPacer}=require('./osirion-traffic-policy.cjs');
const root=path.resolve(__dirname,'..');
const read=name=>name==='results.json'?readResults(root).rows:JSON.parse(fs.readFileSync(path.join(root,name),'utf8'));
const write=(name,obj)=>name==='results.json'?publishResults(root,obj):fs.writeFileSync(path.join(root,name),JSON.stringify(obj,null,2)+'\n');
const regions=['ME','EU','NAC','NAW','OCE','BR'];
let providerPacer=null;
function configureProviderPacing(intervalMs){
 providerPacer=createPacer({intervalMs});
 return providerPacer;
}
const REVIEW_SERIES=new Set(['victory-cup','cash-cup','fncs','performance-evaluation','skin-cup','icon-cup','playstation-cup','unreal-cup','nvidia-cup','test-cup']);
const nowJst=utc=>new Date(new Date(utc).getTime()+9*3600000).toISOString().slice(0,10);
// The history window must follow new competitions after the initial 2024-2026 backfill.
function resolveHistoricalScope(config,time=Date.now()){
 if(config.toDate!=='rolling')return config;
 const lag=Math.max(0,config.minLagMinutes||240)*60000;
 return {...config,toDate:nowJst(time-lag)};
}
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
 // New players without any published results can opt into historical tracing
 // only with an owner-verified exact Epic ID or confirmed Fortnite Tracker URL.
 // Never infer an identity from a name, alias or unconfirmed profile page.
 for(const p of data.players.candidates){
  if(p.epicAccountVerified!==true)continue;
  const direct=typeof p.epicAccountId==='string'&&/^[0-9a-f]{32}$/i.test(p.epicAccountId)?
   p.epicAccountId.toLowerCase():null;
  let fromTracker=null;
  if(typeof p.trackerProfileUrl==='string'){
   try{
    const uri=new URL(p.trackerProfileUrl);
    if(['fortnitetracker.com','www.fortnitetracker.com'].includes(uri.hostname.toLowerCase())&&
       uri.pathname.startsWith('/profile/all/'))
     fromTracker=identity(p.trackerProfileUrl);
   }catch{}
  }
  // If both identifiers were supplied, they must be identical.
  if((p.epicAccountId&&!direct)||(p.trackerProfileUrl&&!fromTracker)||
    (direct&&fromTracker&&direct!==fromTracker)||(!direct&&!fromTracker)){
   conflicts.push({name:p.name,reason:'本人Epic IDまたはTracker URLを安全に照合できない'});
   continue;
  }
  const id=direct||fromTracker;
  if(!map.has(id))map.set(id,new Set());
  map.get(id).add(p.name);
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
   // Allow a shorter lag only for an explicitly targeted review-only series.
   // Rule-backed Victory Cup approvals always retain the standard safety lag.
   const focus=opts.priorityReview;
   const focusEligible=focus&&t.series!=='victory-cup'&&t.series===focus.series&&region===focus.region&&(!focus.fromDate||dateJst>=focus.fromDate);
   const targetLag=focusEligible&&Number.isInteger(focus.minLagMinutes)?Math.min(Math.max(focus.minLagMinutes,0),opts.minLagMinutes||240):opts.minLagMinutes||240;
   if(end>time-targetLag*60000)continue;
   if(opts.fromDate&&opts.toDate){
    if(dateJst<opts.fromDate||dateJst>opts.toDate)continue;
   }else if(end<time-recentDays*86400000)continue;
   const key=full+'/'+windowId;
   selected.set(key,{key,fullEventId:full,eventId:base,windowId,region,dateJst,startUtc:new Date(begin).toISOString(),seasonId:t.seasonId,tournamentId:t.id,series:t.series,round:stage.round,kind:stage.kind,end});
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
  const knownType=/(VictoryCup|VictoryCashCup|ConsoleVCC|CashCup|FNCSDivisionalCup_Division1|PerformanceEvaluation|PerfEval|IconCup|TestCup)/i.test(base)||/\b(?:Cash Cup|Victory Cup|Performance Evaluation|Icon Cup|Test Cup)\b/i.test(title);
  const cosmeticCup=/\bCup\b/i.test(title)&&!/Ranked Cup|Test Cup/i.test(title)&&!/^S\d+_FNCS(?:Reload|Solos|Major)/i.test(base);
  if(!knownType&&!cosmeticCup)continue;
  const tracked=reviewSeries(opts);
  const isVictory=/(VictoryCup|VictoryCashCup|ConsoleVCC)/i.test(base);
  const isFncsDiv1=/^S\d+_FNCSDivisionalCup_Division1$/.test(base);
  if(isVictory&&!tracked.has('victory-cup'))continue;
  if(isFncsDiv1&&!tracked.has('fncs'))continue;
  if(!isVictory&&!isFncsDiv1&&![...tracked].some(s=>s!=='victory-cup'&&s!=='fncs'))continue;
  if(/^S\d+_FNCS/i.test(base)&&!isFncsDiv1&&!cosmeticCup)continue;
  if(catalog.some(x=>x.seasonId===base.split('_')[0]&&x.sourceEventIds?.includes(base)))continue;
  const relevant=(tournament.eventWindows||[]).some(w=>{
   const end=Date.parse(w.endTime),begin=Date.parse(w.beginTime);
   if(typeof w.eventWindowId!=='string'||!w.eventWindowId.endsWith('_'+region)||!Number.isFinite(end)||!Number.isFinite(begin))return false;
   // Historic catalog gaps must also be visible; never publish an unmapped event.
   if(opts.fromDate&&opts.toDate)return nowJst(w.beginTime)>=opts.fromDate&&nowJst(w.beginTime)<=opts.toDate&&end<=time;
   return end>=time-days*86400000&&end<=time+14*86400000;
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
 // 2024 Epic rules had a unified NA region. Never convert this cutoff to NAC/NAW.
 // The verified region-specific qualifying cutoffs are held in the same
 // official rules registry displayed in the Sources tab.
 const documented=RULES[type];
 if(documented?.autoApproval==='verified-duo-qualifier-only')return null; // Preserve prize-free participation below cutoff.
 if(documented&&documented.seasonId===win.seasonId&&
    (!win.eventId||documented.eventIds.includes(win.eventId)))
  return documented.advance?.[win.region]||null;
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
async function fetchJson(url,opts={}){
 const attempts=Number.isInteger(opts.attempts)?Math.min(Math.max(opts.attempts,1),3):2;
 const retryDelayMs=Number.isFinite(opts.retryDelayMs)?Math.max(opts.retryDelayMs,0):800;
 for(let attempt=0;attempt<attempts;attempt++){
  try{
   if(providerPacer)await providerPacer.beforeRequest();
   const response=await fetch(url,{headers:{accept:'application/json'},signal:AbortSignal.timeout(25000)});
   if(!response.ok)throw Error('Osirion API HTTP '+response.status+' '+new URL(url).pathname);
   const body=await response.json();
   if(body?.success===false)throw Error('Osirion API error');
   return body;
  }catch(error){
   if(attempt===attempts-1||(opts.stopOnRateLimit&&providerRateLimitFailure(error))||!transientLeaderboardFailure(error))throw error;
   if(retryDelayMs)await new Promise(resolve=>setTimeout(resolve,retryDelayMs*(attempt+1)));
  }
 }
}
async function getTournaments(historical=false){
 const all=new Map();
 for(const region of regions){
  const response=await fetchJson('https://fnapi.osirion.gg/v1/tournaments?'+new URLSearchParams({region,includeHistoricData:historical?'true':'false'}),{stopOnRateLimit:true});
  if(!Array.isArray(response.tournaments))throw Error('大会一覧の形式が変わりました');
  for(const item of response.tournaments)if(typeof item.eventId==='string')all.set(item.eventId,item);
 }
 return [...all.values()];
}
function providerRateLimitFailure(error){
 const message=String(error?.message||error);
 return /Osirion API HTTP 429\b/i.test(message);
}
function transientLeaderboardFailure(error){
 const msg=String(error?.message||error);
 return /TimeoutError|time.?out|aborted|ECONNRESET|fetch failed|HTTP (?:429|50[0-9]|52[0-9])/i.test(msg);
}
// Keep strict event/window ID matching, but do not confuse valid large historical
// standings (not just Unreal Cup) with an invalid payload. Per-run page budgets
// still cap requests independently from this provider response metadata.
const MAX_LEADERBOARD_PAGES=2000;
function leaderboardResponseError(win,page,leaderboard){
 const l=leaderboard,problems=[];
 if(!l||typeof l!=='object'||Array.isArray(l))problems.push('leaderboard=missing');
 else{
  if(l.leaderboardEventId!==win.fullEventId)
   problems.push('eventId='+String(l.leaderboardEventId??'missing').slice(0,110)+
    ' expected='+String(win.fullEventId).slice(0,110));
  if(l.leaderboardEventWindowId!==win.windowId)
   problems.push('windowId='+String(l.leaderboardEventWindowId??'missing').slice(0,130)+
    ' expected='+String(win.windowId).slice(0,130));
  if(!Array.isArray(l.entries))problems.push('entries=not-array');
  if(!Number.isSafeInteger(l.totalPages)||l.totalPages<1||l.totalPages>MAX_LEADERBOARD_PAGES)
   problems.push('totalPages='+String(l.totalPages??'missing').slice(0,32));
 }
 if(!problems.length)return null;
 const error=new Error('大会順位表のID/形式が不正 ['+
  String(win.key||win.fullEventId+'/'+win.windowId).slice(0,180)+' page='+page+
  ']: '+problems.join('; '));
 error.code='OSIRION_INVALID_LEADERBOARD';
 return error;
}
function recoverableLeaderboardFailure(error){
 // Only provider/network/known page anomalies are window-local. Programming
 // errors and auth/permission failures must remain visible to the operator.
 const message=String(error?.message||error);
 return transientLeaderboardFailure(error)||
  error?.code==='OSIRION_INVALID_LEADERBOARD'||
  error?.code==='OSIRION_EMPTY_MIDDLE_PAGE'||
  /大会順位表のID\/形式が不正|順位表に未期待の空ページ|Osirion API error|Osirion API HTTP (?:400|404|410|422)\b/i.test(message)||
  error instanceof SyntaxError;
}
function holdEmptyFirstPage(checkpoint,win,time=Date.now()){
 const attempts=(Number.isSafeInteger(checkpoint.emptyAttempts)?checkpoint.emptyAttempts:0)+1;
 checkpoint.emptyAttempts=attempts;checkpoint.complete=false;
 checkpoint.retryAfter=new Date(time+Math.min(48,6*2**Math.min(attempts-1,3))*3600000).toISOString();
 checkpoint.lastError='先頭ページが空のため未完了・再試行待ち';
 checkpoint.lastErrorCode='OSIRION_EMPTY_FIRST_PAGE';checkpoint.lastErrorPage=0;
 return {window:win.key,page:0,attempt:attempts,code:checkpoint.lastErrorCode,reason:checkpoint.lastError,retryAfter:checkpoint.retryAfter};
}
function holdLeaderboardWindow(checkpoint,error,win,page,time=Date.now()){
 const attempt=(Number.isSafeInteger(checkpoint.errorAttempts)&&checkpoint.errorAttempts>=0?
   checkpoint.errorAttempts:0)+1;
 const transient=transientLeaderboardFailure(error);
 // Start at 6h. Persistent malformed/unsupported windows back off up to 48h;
 // do not mark complete or skip permanently. Never remove prior valid pages.
 const delayHours=transient?6:Math.min(48,6*Math.pow(2,Math.min(attempt-1,3)));
 checkpoint.errorAttempts=attempt;
 checkpoint.complete=false;
 checkpoint.retryAfter=new Date(time+delayHours*3600000).toISOString();
 checkpoint.lastError=String(error?.message||error).slice(0,350);
 checkpoint.lastErrorPage=page;
 checkpoint.lastErrorCode=transient?'OSIRION_TRANSIENT':
  (error?.code||'OSIRION_BAD_PAGE');
 const report={window:win.key,page,attempt,code:checkpoint.lastErrorCode,
  reason:checkpoint.lastError,retryAfter:checkpoint.retryAfter};
 return report;
}
async function getLeaderboard(win,page){
 const params=new URLSearchParams({leaderboardEventId:win.fullEventId,leaderboardEventWindowId:win.windowId,page:String(page)});
 // Do not immediately retry a quota-denied scoreboard. Preserve its checkpoint
 // for a later scheduled run instead.
 const result=await fetchJson('https://fnapi.osirion.gg/v1/tournaments/leaderboard?'+params,{stopOnRateLimit:true});
 const l=result?.leaderboard;
 const issue=leaderboardResponseError(win,page,l);
 if(issue)throw issue;
 return l;
}
// Balance existing Victory Cups and safely matched review-only series in the same
// run; never let a large FNCS leaderboard starve known cash records (or vice versa).
function selectActiveWindows(windows,state,config,time=Date.now()){
 const pending=windows.filter(w=>{
  const item=state.windows[w.key];
  return (!item?.complete||(['unreal-cup','nvidia-cup'].includes(w.series)&&item?.epicIdsRetained!==true))&&(!item?.retryAfter||Date.parse(item.retryAfter)<=time);
 });
 const limit=Math.max(1,config.maxWindowsPerRun||2),selected=[],seen=new Set();
 const due=w=>{const t=Date.parse(state.windows[w.key]?.retryAfter||'');return Number.isFinite(t)&&t<=time};
 const priority=(a,b)=>{
  if(due(a)!==due(b))return due(a)?-1:1;
  const progress=w=>{const cp=state.windows[w.key];return cp?.totalPages>0?cp.nextPage/cp.totalPages:0};
  const finishable=w=>{const cp=state.windows[w.key];const pages=cp?.complete?null:remainingPages(cp);return pages!==null&&pages<=Math.max(1,config.maxPagesPerWindowPerRun||12)};
  if(finishable(a)!==finishable(b))return finishable(a)?-1:1;
  const progressDiff=progress(b)-progress(a);
  // Finish completable scanned rounds first; then pick newest competitions.
  return progressDiff||b.end-a.end;
 };
 const add=pool=>{
  for(const win of pool.slice().sort(priority)){
   if(selected.length>=limit)break;
   if(!seen.has(win.key)){selected.push(win);seen.add(win.key)}
  }
 };
 const victory=pending.filter(w=>w.series==='victory-cup');
 const review=pending.filter(w=>w.series!=='victory-cup');
 if(victory.length&&review.length){
  add(victory.slice().sort(priority).slice(0,Math.ceil(limit/2)));
  add(review.slice().sort(priority).slice(0,Math.floor(limit/2)));
 }
 add(pending);
 return selected;
}
// Historical scans must fairly cover every year and tournament series.
// Only documented results seed the scan priority; names are never inferred from historical leaderboards.
function historicalEvidenceScore(win,records){
 let best=0;
 for(const r of records){
  if(r.tournamentId!==win.tournamentId||r.region!==win.region)continue;
  if(typeof r.source==='string'&&r.source.includes(encodeURIComponent(win.windowId)))return 100;
  if(r.date===win.dateJst)best=Math.max(best,70);
  else if(typeof r.date==='string'&&r.date.slice(0,7)===win.dateJst.slice(0,7))best=Math.max(best,25);
  else if(typeof r.date==='string'&&r.date.slice(0,4)===win.dateJst.slice(0,4))best=Math.max(best,5);
 }
 return best;
}
// Index historical proof once per scan. Previously sorting compared each window
// by rescanning every archived result on every comparator invocation.
function historicalEvidenceIndex(records){
 const groups=new Map();
 const groupKey=(id,region)=>JSON.stringify([id,region]);
 for(const r of records){
  const key=groupKey(r.tournamentId,r.region);
  if(!groups.has(key))groups.set(key,{sources:[],dates:new Set(),months:new Set(),years:new Set()});
  const group=groups.get(key);
  if(typeof r.source==='string')group.sources.push(r.source);
  if(typeof r.date==='string'){
   group.dates.add(r.date);
   group.months.add(r.date.slice(0,7));
   group.years.add(r.date.slice(0,4));
  }
 }
 const memo=new WeakMap();
 return win=>{
  if(memo.has(win))return memo.get(win);
  const group=groups.get(groupKey(win.tournamentId,win.region));
  let evidence=0;
  if(group){
   const id=encodeURIComponent(win.windowId);
   if(group.sources.some(source=>source.includes(id)))evidence=100;
   else if(group.dates.has(win.dateJst))evidence=70;
   else if(group.months.has(win.dateJst.slice(0,7)))evidence=25;
   else if(group.years.has(win.dateJst.slice(0,4)))evidence=5;
  }
  memo.set(win,evidence);
  return evidence;
 };
}
// Explain ranking without changing publication eligibility or scan checkpoints.
function historicalPriorityAudit(windows,state,records,{limit=100,now=Date.now()}={}){
 const evidence=historicalEvidenceIndex(records);
 const ranked=windows.filter(w=>{
  const cp=state.windows?.[w.key];
  return (!cp?.complete||(['unreal-cup','nvidia-cup'].includes(w.series)&&cp?.epicIdsRetained!==true))&&
   (!cp?.retryAfter||Date.parse(cp.retryAfter)<=now);
 }).map(w=>{
  const cp=state.windows?.[w.key]||{};
  const approvedRule=(Object.hasOwn(RULES,w.tournamentId)&&w.series==='victory-cup')||
   cutoffForWindow(w)!==null||cashLimitForWindow(w)!==null||
   evaluationStage(w)!==null||unrealWindow(w)!==null||nvidiaWindow(w)!==null;
  const progress=cp.totalPages>0?Math.round(Math.min(1,(cp.nextPage||0)/cp.totalPages)*90):0;
  const proof=evidence(w);
  return {key:w.key,date:w.dateJst,region:w.region,series:w.series,
   score:(approvedRule?150:0)+progress+proof+(w.kind==='賞金決勝'?12:0)+(w.kind==='参加確認'?3:0),
   reasons:{officialRule:approvedRule?150:0,progress,existingEvidence:proof,
    round:w.kind==='賞金決勝'?12:w.kind==='参加確認'?3:0}};
 });
 ranked.sort((a,b)=>b.score-a.score||a.date.localeCompare(b.date)||a.key.localeCompare(b.key));
 return {eligible:ranked.length,top:ranked.slice(0,Math.max(0,Math.min(500,Number.isSafeInteger(limit)?limit:100)))};
}
function historicalPriority(state,records,evidence=historicalEvidenceIndex(records)){
 const scores=new WeakMap();
 const score=w=>{
  if(scores.has(w))return scores.get(w);
  const cp=state.windows[w.key];
  const fraction=cp?.totalPages>0?Math.min(1,(cp.nextPage||0)/cp.totalPages):0;
  // Keep the same rank rules and ordering; only avoid repeated computation.
  const approvedRule=(Object.hasOwn(RULES,w.tournamentId)&&w.series==='victory-cup')||cutoffForWindow(w)!==null||cashLimitForWindow(w)!==null||evaluationStage(w)!==null||unrealWindow(w)!==null||nvidiaWindow(w)!==null;
  const value=(approvedRule?150:0)+Math.round(fraction*90)+evidence(w)+(w.kind==='賞金決勝'?12:0)+(w.kind==='参加確認'?3:0);
  scores.set(w,value);
  return value;
 };
 return (a,b)=>score(b)-score(a)||a.end-b.end;
}
function selectHistoricalWindows(windows,state,config,time=Date.now(),records=[],reviewRows=[]){
 const pending=windows.filter(w=>{
  const cp=state.windows[w.key];
  return (!cp?.complete||(['unreal-cup','nvidia-cup'].includes(w.series)&&cp?.epicIdsRetained!==true))&&(!cp?.retryAfter||Date.parse(cp.retryAfter)<=time);
 });
 const years=[...new Set(pending.map(w=>w.dateJst.slice(0,4)))].sort((a,b)=>a.localeCompare(b));
 const limit=Math.max(1,config.maxWindowsPerRun||6),selected=[],seen=new Set();
 const evidence=historicalEvidenceIndex(records);
 const priority=historicalPriority(state,records,evidence);
 const add=pool=>{for(const w of pool.slice().sort(priority))if(!seen.has(w.key)){selected.push(w);seen.add(w.key);break}};
 // Resume at least one expired retry per run, preserving the original page.
 const dueRetries=pending.filter(w=>{const t=Date.parse(state.windows[w.key]?.retryAfter||'');return Number.isFinite(t)&&t<=time})
  .sort((a,b)=>Date.parse(state.windows[a.key].retryAfter)-Date.parse(state.windows[b.key].retryAfter));
 if(dueRetries.length&&selected.length<limit)add(dueRetries.slice(0,1));
 // Bounded focus from config: keep other historical regions and series running.
 // Non-Victory series remain review-only; this only changes scan order.
 const focus=config.priorityReview;
 if(focus&&typeof focus==='object'&&typeof focus.series==='string'&&typeof focus.region==='string'){
  const cap=Math.min(3,Math.max(0,Number.isInteger(focus.maxWindows)?focus.maxWindows:2));
  const choices=pending.filter(w=>w.series===focus.series&&w.region===focus.region&&(!focus.fromDate||w.dateJst>=focus.fromDate));
  for(const w of choices.sort((a,b)=>b.end-a.end).slice(0,cap)){
   if(selected.length>=limit)break;
   if(!seen.has(w.key)){selected.push(w);seen.add(w.key)}
  }
 }
 // Prioritize one eligible ranked cosmetic session without starving the backfill.
 if(selected.length<limit)add(pending.filter(w=>cutoffForWindow(w)!==null));
 // Prioritize a previously reviewed $1M Unreal region to complete a full final leaderboard.
 if(selected.length<limit)add(pending.filter(w=>unrealWindow(w)!==null||nvidiaWindow(w)!==null));
 // One Victory and one other-series slot per year; remaining slots target known historical evidence.
 for(const series of ['victory-cup','other']){
  for(const year of years){
   if(selected.length>=limit)break;
   add(pending.filter(w=>w.dateJst.startsWith(year)&&(series==='victory-cup'?w.series==='victory-cup':w.series!=='victory-cup')));
  }
 }
 // Stage 2: recover exact checkpoint-matched pending reviews. Protect the
 // previously selected retry, official-rule and year/series quotas. Preserve
 // at least minUnstartedWindowsPerRun new discoveries for geographic coverage.
 if(config.reviewRecovery?.enabled===true){
  const cap=Math.max(0,Math.min(4,Number.isInteger(config.reviewRecovery.maxWindows)?
    config.reviewRecovery.maxWindows:3));
  const queue=recoveryShortlist(pending,state,reviewRows,records,
   {now:time,perWindowCap:config.maxPagesPerWindowPerRun||12});
  const chosen=queue.filter(x=>seen.has(x.windowKey)).length;
  const minimum=Math.min(limit,Math.max(0,Number.isInteger(config.minUnstartedWindowsPerRun)?
    config.minUnstartedWindowsPerRun:0));
  const unstarted=selected.filter(w=>!state.windows[w.key]?.nextPage).length;
  // Reserve a future recent window and an unstarted slice when possible.
  const room=Math.max(0,limit-selected.length-Math.max(0,minimum-unstarted)-1);
  let added=0;
  for(const item of queue){
   if(added>=Math.max(0,cap-chosen)||added>=room)break;
   if(!seen.has(item.windowKey)){
    selected.push(item.window);seen.add(item.windowKey);added++;
   }
  }
 }else{
  // Legacy candidate follow-up remains unchanged until the flag is enabled.
  if(selected.length<limit){
   const alreadyPublished=new Set(records.map(x=>x.id));
   const candidateWindows=pending.filter(w=>{
    const cp=state.windows[w.key];
    return cp&&!cp.complete&&cp.nextPage>0&&Array.isArray(cp.proposals)&&
     cp.proposals.some(x=>x.verified===true&&!alreadyPublished.has(x.id));
   });
   if(candidateWindows.length)add(candidateWindows);
  }
 }
 // Safely finish up to two already scanned leaderboards within one per-window page limit.
 // Year/series quotas and due retries above remain protected.
 for(const win of finishableWindows(pending,state,config.maxPagesPerWindowPerRun||10,time,2)){
  if(selected.length>=limit)break;
  if(!seen.has(win.key)){selected.push(win);seen.add(win.key)}
 }
 // Reserve a slot for recent completed rounds so fast publication does not wait
 // behind the much larger multi-year backlog.
 if(selected.length<limit){
  const fresh=pending.filter(w=>w.end>=time-7*86400000&&w.end<=time);
  const ruleBacked=fresh.filter(w=>w.series==='victory-cup'&&Object.hasOwn(RULES,w.tournamentId));
  add(ruleBacked.length?ruleBacked:fresh);
 }
 // Add at most two slots for the least-covered historical YEAR and REGION.
 // Previously protected retries, focus, year/series quotas, candidate evidence
 // and near-finish checkpoints are selected first. Smaller batches are unchanged.
 if(limit>=18&&selected.length<limit){
  const coverage=scanCoverage(windows,state,time);
  const year=leastCoveredBucket(coverage.byYear);
  if(year)add(pending.filter(w=>w.dateJst.slice(0,4)===year));
  if(selected.length<limit){
   const region=leastCoveredBucket(coverage.byRegion);
   if(region)add(pending.filter(w=>w.region===region));
  }
 }
 // Give previously unscanned windows a protected share of the history budget.
 // This complements the year quotas, due retries, finishable boards and recent
 // rounds above; do not starve them to chase all 2,000+ unseen windows at once.
 const minUnstarted=Math.min(limit,Math.max(0,Number.isInteger(config.minUnstartedWindowsPerRun)?
   config.minUnstartedWindowsPerRun:0));
 const unstarted=w=>{
  const cp=state.windows[w.key];
  return !cp||(!cp.complete&&(!Number.isSafeInteger(cp.nextPage)||cp.nextPage===0));
 };
 while(selected.length<limit&&selected.filter(unstarted).length<minUnstarted){
  const candidates=pending.filter(w=>unstarted(w)&&!seen.has(w.key));
  if(!candidates.length)break;
  const novelty=w=>
   (selected.some(x=>x.region===w.region)?0:60)+
   (selected.some(x=>x.series===w.series)?0:40)+
   (selected.some(x=>x.dateJst.slice(0,4)===w.dateJst.slice(0,4))?0:20)+
   (evidence(w)>0?5:0);
  candidates.sort((a,b)=>novelty(b)-novelty(a)||a.end-b.end||a.key.localeCompare(b.key));
  add([candidates[0]]);
 }
 // Backfill the six overseas regions evenly before filling the remaining slots.
 // Completed windows naturally leave the queue; a region with no eligible rounds is skipped.
 for(const region of regions){
  if(selected.length>=limit)break;
  if(!selected.some(w=>w.region===region))add(pending.filter(w=>w.region===region));
 }
 // Rotate across supported tournament series, including review-only cups.
 // Never infer cash, advancement or rewards from series membership.
 for(const series of [...new Set(pending.map(w=>w.series))].sort()){
  if(selected.length>=limit)break;
  if(!selected.some(w=>w.series===series))add(pending.filter(w=>w.series===series));
 }
 // Use the remaining slots on resumable checkpoints before opening more large boards.
 // Protected year/region/series and unstarted quotas above are unaffected.
 const resumable=pending.filter(w=>{
  const cp=state.windows[w.key];
  return !seen.has(w.key)&&Number.isSafeInteger(cp?.nextPage)&&cp.nextPage>0;
 }).sort((a,b)=>{
  const pagesA=remainingPages(state.windows[a.key]);
  const pagesB=remainingPages(state.windows[b.key]);
  const boundedA=pagesA!==null&&pagesA<=Math.max(1,config.maxPagesPerWindowPerRun||12);
  const boundedB=pagesB!==null&&pagesB<=Math.max(1,config.maxPagesPerWindowPerRun||12);
  if(boundedA!==boundedB)return boundedA?-1:1;
  if(boundedA&&pagesA!==pagesB)return pagesA-pagesB;
  return priority(a,b);
 });
 for(const w of resumable){
  if(selected.length>=limit)break;
  selected.push(w);seen.add(w.key);
 }
 for(const w of pending.slice().sort(priority)){
  if(selected.length>=limit)break;
  if(!seen.has(w.key)){selected.push(w);seen.add(w.key)}
 }
 return selected;
}
async function main(){
 const historical=process.argv.includes('--history');
 const prefix=historical?'history-sync':'auto-sync';
 const storedConfig=read(prefix+'-config.json');
 const config=historical?resolveHistoricalScope(storedConfig):storedConfig;
 if(historical){
  const validDate=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&!Number.isNaN(Date.parse(x))&&new Date(x).toISOString().slice(0,10)===x;
  if(!validDate(config.fromDate)||!validDate(config.toDate)||config.fromDate>config.toDate||!Array.isArray(config.regions)||!config.regions.length||config.regions.some(x=>!regions.includes(x)))throw Error('過去大会の期間または地域設定が不正');
 }
 if(!config.enabled||config.provider!=='osirion'){console.log('OSIRION_SYNC_DISABLED');return}
 if(config.mode!=='review')throw Error('Osirionの自動公開は安全性検証が完了するまで無効です');
 // Jobs share GitHub concurrency. Their committed 429 cooldowns must be checked
 // BEFORE querying Osirion so scheduled runs cannot create another quota spike.
 const traffic=trafficPlan({historical,config,
   historyStatus:read('history-sync-status.json'),
   recentStatus:read('auto-sync-status.json'),
   participationStatus:read('participation-status.json')});
 console.log('OSIRION_TRAFFIC_PLAN '+JSON.stringify(traffic));
 if(traffic.skip){
  console.warn('OSIRION_SHARED_COOLDOWN_SKIP '+JSON.stringify({
   scope:historical?'history':'recent',retryAfter:traffic.retryAfter,
   reason:traffic.reason,action:'preserve checkpoints; retry on next scheduled run'
  }));
  return;
 }
 configureProviderPacing(traffic.minRequestIntervalMs);
 const data={results:read('results.json'),players:read('players.json'),tournaments:read('tournaments.json'),schedule:read('schedule.json'),updates:read('updates.json')};
 const {accounts,conflicts}=linkedAccounts(data);
 data.verifiedAccounts=accounts;
 if(!accounts.length)throw Error('追跡対象のIDがありません');
 let all;
 try{all=await getTournaments(historical)}
 catch(error){
  // Discovery is also an Osirion request. An HTTP429 here must establish the
  // same persisted cross-workflow cooldown as a leaderboard HTTP429.
  if(!providerRateLimitFailure(error))throw error;
  const retryAfter=new Date(Date.now()+6*3600000).toISOString();
  const oldStatus=read(prefix+'-status.json');
  write(prefix+'-status.json',{...oldStatus,checkedAt:new Date().toISOString(),
   scannedPages:0,processedWindows:0,imported:0,newlyCompletedWindows:0,
   providerRateLimitPaused:true,providerRateLimitRetryAfter:retryAfter,
   providerTraffic:{...traffic,...providerPacer.metrics(),discoveryRateLimited:true}});
  console.warn('OSIRION_DISCOVERY_RATE_LIMIT '+JSON.stringify({retryAfter,
   scope:historical?'history':'recent',action:'persist shared cooldown; retain scan checkpoint'}));
  return;
 }
 const windows=discover(all,data.tournaments.catalog,config);
 const unmapped=discoverUnmapped(all,data.tournaments.catalog,config);
 const state=read(prefix+'-scan.json');
 if(state.version!==1||!state.windows||typeof state.windows!=='object')throw Error('checkpoint invalid');
 const pendingReviews=historical?read('history-sync-review.json').proposals:[];
 const previousHistoricalStatus=historical?read('history-sync-status.json'):null;
 const active=historical?selectHistoricalWindows(windows,state,config,Date.now(),data.results,pendingReviews):selectActiveWindows(windows,state,config);
 // Capture ranking before checkpoint mutations; reporting does not affect selection.
 const priorityAudit=historical?historicalPriorityAudit(windows,state,data.results,{limit:50}):null;
 const selectedPriority=historical?active.map(w=>({key:w.key,date:w.dateJst,region:w.region,series:w.series,kind:w.kind})):null;
 const previewConfig={version:1,accounts,windows:active.map(w=>({eventId:w.eventId,windowId:w.windowId,dateJst:w.dateJst,region:w.region,seasonId:w.seasonId,tournamentId:w.tournamentId,kind:w.kind,round:w.round}))};
 // Historical backfill can inspect more pages, but always yields before the Actions job limit.
 let budget=Math.min(traffic.pageBudget,historical?96:50),scanned=0,invalidRows=0,transientFailures=0,malformedFailures=0;
 const skippedLeaderboards=[];
 const maxRunMinutes=historical?Math.min(14,Math.max(2,Number.isFinite(config.maxRunMinutes)?config.maxRunMinutes:12)):14;
 const scanDeadline=Date.now()+maxRunMinutes*60000;
 let reviewRecoverySummary=null;
 let timeLimitReached=false,rateLimited=false,rateLimitRetryAfter=null,processedWindows=0;
 let playerBackfill=null;
 if(historical){
  const deltaConfig=config.newPlayerBackfill||{};
  if(deltaConfig.enabled!==false){
   const stats=await runNewPlayerDelta({
    scan:state,accounts,windows,
    fetchPage:getLeaderboard,normalize:normalizeRow,
    prepare:(feed,preview)=>prepare(feed,preview,data),
    previewFor:win=>({version:1,accounts,windows:[{
     eventId:win.eventId,windowId:win.windowId,dateJst:win.dateJst,
     region:win.region,seasonId:win.seasonId,tournamentId:win.tournamentId,
     kind:win.kind,round:win.round
    }]}),
    holdFailure:holdLeaderboardWindow,rateLimitFailure:providerRateLimitFailure,
    recoverableFailure:recoverableLeaderboardFailure,
    now:Date.now(),latestSeasons:Math.min(2,Math.max(1,deltaConfig.priorityRecentSeasons??2)),
    // Share the existing 96-page historical API budget.
    pageBudget:Math.min(4,Math.max(0,deltaConfig.maxPagesPerRun??4),budget),
    windowBudget:Math.min(2,Math.max(0,deltaConfig.maxWindowsPerRun??2)),
    pagesPerWindow:Math.min(2,Math.max(1,deltaConfig.maxPagesPerWindowPerRun??2))
   });
   playerBackfill=stats;
   budget-=stats.pagesScanned;scanned+=stats.pagesScanned;
   if(stats.rateLimited){rateLimited=true;rateLimitRetryAfter=stats.retryAfter;transientFailures++;}
   console.log('OSIRION_NEW_PLAYER_BACKFILL '+JSON.stringify(stats));
  }
 }
 if(historical){
  const byYear={},byRegion={};
  let resumed=0,finishable=0,unstarted=0;
  for(const w of active){
   const cp=state.windows[w.key],pages=cp?.complete?null:remainingPages(cp);
   const year=w.dateJst.slice(0,4);
   byYear[year]=(byYear[year]||0)+1;
   byRegion[w.region]=(byRegion[w.region]||0)+1;
   if(Number.isSafeInteger(cp?.nextPage)&&cp.nextPage>0)resumed++;
   else unstarted++;
   if(pages!==null&&pages<=Math.min(Math.max(config.maxPagesPerWindowPerRun||budget,1),50))finishable++;
  }
  const recoveryCandidates=recoveryShortlist(active,state,pendingReviews,data.results,
   {perWindowCap:config.maxPagesPerWindowPerRun||12});
  reviewRecoverySummary={selectedWindows:recoveryCandidates.length,
   candidateCount:recoveryCandidates.reduce((n,x)=>n+x.candidateCount,0),
   cashUnconfirmedCount:recoveryCandidates.reduce((n,x)=>n+x.cashCandidates,0),
   selected:recoveryCandidates.slice(0,6).map(x=>({window:x.windowKey,
    remainingPages:x.remainingPages,candidateCount:x.candidateCount,
    cashUnconfirmedCount:x.cashCandidates}))};
  console.log('OSIRION_HISTORY_SCAN_PLAN '+JSON.stringify({
   selected:active.length,pageBudget:budget,byYear,byRegion,
   resumed,unstarted,finishable,
   recoveryWindows:recoveryCandidates.length,
   recoveryCandidates:recoveryCandidates.reduce((n,x)=>n+x.candidateCount,0),
   unknownCashCandidates:recoveryCandidates.reduce((n,x)=>n+x.cashCandidates,0),
   recovery:recoveryCandidates.slice(0,6).map(x=>({window:x.windowKey,
    remainingPages:x.remainingPages,candidateCount:x.candidateCount,
    unknownCashCandidates:x.cashCandidates,finishable:x.finishable}))
  }));
 }
 for(let windowIndex=0;windowIndex<active.length;windowIndex++){
  if(rateLimited)break;
  if(Date.now()>=scanDeadline){timeLimitReached=true;break}
  const win=active[windowIndex];
  processedWindows++;
  const previous=state.windows[win.key];
  // Pre-2026 Unreal caches lack the original two Epic IDs. Re-fetch once; never
  // approve from a stale completed review-only checkpoint.
  const checkpoint=['unreal-cup','nvidia-cup'].includes(win.series)&&previous?.epicIdsRetained!==true?
   {nextPage:0,complete:false,proposals:[],pages:0,epicIdsRetained:true}:
   previous||{nextPage:0,complete:false,proposals:[],pages:0,...(['unreal-cup','nvidia-cup'].includes(win.series)?{epicIdsRetained:true}:{})};
  let pagesThisWindow=0;
  const limit=Math.min(Math.max(config.maxPagesPerWindowPerRun||budget,1),50);
  // Finish up to two near-complete historical leaderboards later in the
  // queue; preserve the minimum for every other window without expanding
  // the total page budget.
  const perWindowLimit=windowPageAllowance(active,state,windowIndex,budget,limit,historical);
  while(budget>0&&pagesThisWindow<perWindowLimit&&!checkpoint.complete){
   if(Date.now()>=scanDeadline){timeLimitReached=true;break}
   const page=checkpoint.nextPage;
   checkpoint.lastAttemptAt=new Date().toISOString();
   let l;
   try{
    l=await getLeaderboard(win,page);
    if(!l.entries.length&&page>0&&page<l.totalPages-1){
     const issue=new Error('順位表に未期待の空ページ: '+win.key+' page '+page);
     issue.code='OSIRION_EMPTY_MIDDLE_PAGE';
     throw issue;
    }
   }catch(error){
    if(!recoverableLeaderboardFailure(error))throw error;
    const skipped=holdLeaderboardWindow(checkpoint,error,win,page);
    skippedLeaderboards.push(skipped);
    if(skipped.code==='OSIRION_TRANSIENT')transientFailures++;
    else malformedFailures++;
    console.warn('OSIRION_LEADERBOARD_HELD '+JSON.stringify(skipped));
    if(providerRateLimitFailure(error)){
     rateLimited=true;
     rateLimitRetryAfter=skipped.retryAfter;
    }
    break; // On 429 pause provider scanning; otherwise continue to another window.
   }
   if(page===0&&l.entries.length===0){
    const held=holdEmptyFirstPage(checkpoint,win);
    skippedLeaderboards.push(held);
    console.warn('OSIRION_EMPTY_FIRST_PAGE_HELD '+JSON.stringify(held));
    break; // Preserve verified pages and retry this tournament later.
   }
   checkpoint.emptyAttempts=0;
   delete checkpoint.retryAfter;
   delete checkpoint.errorAttempts;
   delete checkpoint.lastError;
   delete checkpoint.lastErrorPage;
   delete checkpoint.lastErrorCode;
   // A malformed middle page was handled above with a per-window retry.
   // Only the first 100 visible PlayStation qualifier/final ranks are needed for
   // the official Top80 qualifying slots and payout tiers. Also retain 81-100
   // participant standings when source score and Epic UUID are confirmed.
   const psStage=playstationStageFor(win);
   const psCutoff=psStage?100:null;
   const cutoff=(historical?advancementLimit(win):null)??cutoffForWindow(win)??psCutoff??(config.autoApprovePerformance===true?qualifierCutoff(win):null);
   const pageRanks=l.entries.map(e=>e.rank);
   const ordered=pageRanks.every((rank,i)=>Number.isSafeInteger(rank)&&rank>=1&&(i===0||rank>=pageRanks[i-1]));
   const followsPrevious=checkpoint.lastSeenRank==null||pageRanks.length===0||pageRanks[0]>=checkpoint.lastSeenRank;
   checkpoint.rankingOrderValid=checkpoint.rankingOrderValid!==false&&ordered&&followsPrevious;
   if(pageRanks.length)checkpoint.lastSeenRank=pageRanks[pageRanks.length-1];
   const crossed=checkpoint.rankingOrderValid&&cutoff!==null&&pageRanks.some(rank=>rank>cutoff);
   const eligibleRows=cutoff===null?l.entries:l.entries.filter(e=>!Number.isSafeInteger(e.rank)||e.rank<=cutoff);
   const entries=eligibleRows.map(e=>normalizeRow(e,win));
   invalidRows+=entries.filter(x=>!x).length;
   const found=prepare({entries:entries.filter(Boolean)},previewConfig,data).proposals;
   const already=new Set(checkpoint.proposals.map(x=>x.id));
   for(const row of found)if(!already.has(row.id)){checkpoint.proposals.push(row);already.add(row.id)}
   checkpoint.nextPage=page+1;checkpoint.pages++;scanned++;budget--;pagesThisWindow++;
   checkpoint.lastSuccessAt=new Date().toISOString();
   checkpoint.totalPages=l.totalPages;
   checkpoint.complete=checkpoint.nextPage>=l.totalPages||crossed;
  }
  state.windows[win.key]=checkpoint;
  if(rateLimited){
   console.warn('OSIRION_PROVIDER_RATE_LIMIT_PAUSE '+JSON.stringify({
    window:win.key,page:checkpoint.nextPage,processedWindows,scannedPages:scanned,
    retryAfter:rateLimitRetryAfter,savedPages:checkpoint.pages,
    action:'checkpoint saved; defer further provider calls until a later run'
   }));
   break;
  }
  if(budget<=0)break;
 }
 const coverage=scanCoverage(windows,state,Date.now());
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
 const reviewedPath=path.join(root,'history-sync-reviewed.json');
 // A manually adjudicated duplicate must stay suppressed in BOTH recent and historical syncs.
 const reviewed=fs.existsSync(reviewedPath)?read('history-sync-reviewed.json'):{version:1,entries:[]};
 if(reviewed.version!==1||!Array.isArray(reviewed.entries))throw Error('invalid historical review ledger');
 const reviewedIds=new Set(reviewed.entries.map(x=>x.id));
 const pending=validHistory.filter(x=>!recordedIds.has(x.id)&&!reviewedIds.has(x.id));
 const stamp=new Date().toISOString();
 let imported=0,manuallyHeld=0,importedCosmetics=0;
 const importedIds=new Set(),reasons=new Map();
 const verified=(historical&&config.autoApproveVerified===true)?
  evaluate(pending,windows,state.windows,data):{approved:[],held:[]};
 // Rule-backed cosmetics can be published in both recent and historical scans.
 // A positive-VR cash prize remains excluded without an independent verified payout.
 const cosmetic=(config.autoApproveCosmetic===true)?
  evaluateCosmetics(pending,windows,state.windows,{...data,results:[...data.results,...verified.approved]}):{approved:[],held:[]};
 const cash=(config.autoApproveCash===true)?
  evaluateCash(pending,windows,state.windows,{...data,results:[...data.results,...verified.approved,...cosmetic.approved]}):{approved:[],held:[]};
 const performance=(config.autoApprovePerformance===true)?
  evaluatePerformance(pending,windows,state.windows,{...data,results:[...data.results,...verified.approved,...cosmetic.approved,...cash.approved]}):{approved:[],held:[]};
 const unreal=(config.autoApproveUnreal===true)?
  evaluateUnreal(pending,windows,state.windows,{...data,results:[...data.results,...verified.approved,...cosmetic.approved,...cash.approved,...performance.approved]}):{approved:[],held:[]};
 const nvidia=(config.autoApproveNvidia===true)?
  evaluateNvidia(pending,windows,state.windows,{...data,results:[...data.results,...verified.approved,
   ...cosmetic.approved,...cash.approved,...performance.approved,...unreal.approved]}):{approved:[],held:[]};
 const duo=(config.autoApproveDuoQualifier===true)?
  evaluateDuoQualifier(pending,windows,state.windows,{...data,results:[...data.results,...verified.approved,
   ...cosmetic.approved,...cash.approved,...performance.approved,...unreal.approved,...nvidia.approved]}):{approved:[],held:[]};
 const playstation=(config.autoApprovePlayStation===true)?
  evaluatePlayStation(pending,windows,state.windows,{...data,results:[...data.results,...verified.approved,
   ...cosmetic.approved,...cash.approved,...performance.approved,...unreal.approved,...nvidia.approved,...duo.approved]}):{approved:[],held:[],participationIds:[]};
 const approved=[...verified.approved,...cosmetic.approved,...cash.approved,...performance.approved,...unreal.approved,...nvidia.approved,...duo.approved,...playstation.approved];
 // Only the narrow historical Victory Cup rule evaluator can authorize
 // out-of-cutoff participation. Never extend this grant to review-only series.
 const verifiedParticipationIds=new Set(verified.approved.filter(x=>
  x.kind==='参加確認'&&x.reviewOnly!==true&&x.verified===true&&x.prize===0).map(x=>x.id));
 for(const id of playstation.participationIds)verifiedParticipationIds.add(id);
 importedCosmetics=cosmetic.approved.length;
 for(const hold of verified.held)reasons.set(hold.id,hold.reason);
 for(const hold of cosmetic.held)if(!reasons.has(hold.id))reasons.set(hold.id,hold.reason);
 for(const hold of cash.held)reasons.set(hold.id,hold.reason);
 for(const hold of performance.held)reasons.set(hold.id,hold.reason);
 for(const hold of unreal.held)reasons.set(hold.id,hold.reason);
 for(const hold of nvidia.held)reasons.set(hold.id,hold.reason);
 for(const hold of duo.held)reasons.set(hold.id,hold.reason);
 for(const hold of playstation.held)reasons.set(hold.id,hold.reason);
 for(const row of approved)importedIds.add(row.id);
 manuallyHeld=pending.length-approved.length;
 imported=applyProposals(data,approved,stamp,{verifiedParticipationIds});
 if(imported){
  const entry=data.updates.entries[0];
  entry.title='公式規則で自動承認：'+(historical?'過去大会':'新着大会')+imported+'戦績';
  entry.description='公式規則・地域別順位・本人確認済みEpic ID・順位表・既存戦績を照合。予選突破・突破圏外の参加確認（'+verifiedParticipationIds.size+'件）、公式VR賞金、スキン（'+importedCosmetics+'件）、公式賞金表によるCash Cup（'+cash.approved.length+'件／賞金圏外$0含む）、S43 Performance Evaluation（'+performance.approved.length+'件）、S39 Unreal Cup（'+unreal.approved.length+'件／チーム・個人賞金、圏外$0）、公式デュオ予選（'+duo.approved.length+'件／突破と圏外参加を区別・$0）、S43 PlayStation BR/ZB（'+playstation.approved.length+'件／Top80・順位賞金・圏外$0を区別）を自動掲載。支払い完了や未確認の賞金は推定しない。';
  write('results.json',data.results);
  write('updates.json',data.updates);
 }
 const proposals=pending.filter(x=>!importedIds.has(x.id)).map(x=>reasons.has(x.id)?{...x,reviewReason:reasons.get(x.id)}:x);
 const unique=new Map(proposals.map(x=>[x.id,x]));
 const finished=Object.entries(state.windows).filter(([key,w])=>eligible.has(key)&&w.complete).length;
 const previousFinished=Number.isSafeInteger(previousHistoricalStatus?.completedWindows)?previousHistoricalStatus.completedWindows:0;
 const newlyCompletedWindows=historical?Math.max(0,finished-previousFinished):null;
 const reviewOnlyWindows=windows.filter(w=>w.series!=='victory-cup').length;
 const reviewOnlyCandidates=unique.size?Array.from(unique.values()).filter(p=>p.reviewOnly===true).length:0;
 const cumulativeApprovals=data.updates.entries.filter(x=>x.title?.startsWith('公式規則で自動承認：')).reduce((sum,x)=>sum+(x.recordIds?.length||0),0);
 const status={version:1,state:'checked',checkedAt:stamp,mode:'review',scope:historical?'history':'recent',dateMode:historical?(storedConfig.toDate==='rolling'?'rolling':'fixed'):null,selectedWindows:active.length,fromDate:historical?config.fromDate:null,toDate:historical?config.toDate:null,provider:'osirion',linkedPlayers:accounts.length,trackedWindows:windows.length,found:unique.size,skipped:invalidRows,imported,scannedPages:scanned,completedWindows:finished,identityConflicts:conflicts.length,alreadyRegistered:recordedFromReview,autoApprovedTotal:cumulativeApprovals,invalidCachedCandidates:invalidCached,manualReviewCandidates:manuallyHeld,autoApprovedParticipationThisRun:verifiedParticipationIds.size,autoApprovedCosmeticThisRun:importedCosmetics,autoApprovedCashThisRun:cash.approved.length,autoApprovedPerformanceThisRun:performance.approved.length,autoApprovedUnrealThisRun:unreal.approved.length,autoApprovedDuoQualifierThisRun:duo.approved.length,autoApprovedPlayStationThisRun:playstation.approved.length,timeLimitReached,processedWindows,providerRateLimitPaused:rateLimited,providerRateLimitRetryAfter:rateLimitRetryAfter,providerTraffic:{...traffic,...providerPacer.metrics()},
  ...(historical?{newlyCompletedWindows,newPlayerBackfill:playerBackfill}:{}),retryWindows:coverage.retryCount,coverage,...(historical?{reviewRecovery:reviewRecoverySummary,priorityAudit:{...priorityAudit,selected:selectedPriority}}:{}),transientFailures,malformedFailures,skippedLeaderboards:skippedLeaderboards.slice(0,15),reviewOnlyWindows,reviewOnlyCandidates,unmappedEvents:unmapped.length,unmappedEventIds:unmapped.slice(0,12),message:'Osirionで'+accounts.length+'アカウントIDを追跡。今回の公式規則による自動承認'+imported+'件、追加確認待ち'+unique.size+'件、名義照合保留'+conflicts.length+'件。'};
 state.checkedAt=stamp;
 write(prefix+'-scan.json',state);
 write(prefix+'-review.json',{version:1,status:'review',checkedAt:stamp,proposals:[...unique.values()]});
 write(prefix+'-status.json',status);
 console.log((historical?'OSIRION_HISTORY_REVIEW ':'OSIRION_REVIEW ')+JSON.stringify({scannedPages:scanned,linkedPlayers:accounts.length,identityConflicts:conflicts.length,windows:windows.length,unmappedEvents:unmapped.length,proposals:unique.size,imported,participation:verifiedParticipationIds.size,cosmetic:importedCosmetics,cash:cash.approved.length,performance:performance.approved.length,unreal:unreal.approved.length,duo:duo.approved.length,playstation:playstation.approved.length,finished,processedWindows,rateLimited,rateLimitRetryAfter,newlyCompletedWindows,
  transientFailures,malformedFailures,heldWindows:skippedLeaderboards.length}));
}
if(require.main===module)main().catch(e=>{console.error('OSIRION_SYNC_ERROR '+e.stack);process.exitCode=1});
module.exports={identity,linkedAccounts,parseStage,parseReviewStage,discover,discoverUnmapped,selectActiveWindows,selectHistoricalWindows,historicalEvidenceScore,historicalEvidenceIndex,historicalPriorityAudit,resolveHistoricalScope,fetchJson,advancementLimit,normalizeRow,getTournaments,getLeaderboard,leaderboardResponseError,recoverableLeaderboardFailure,holdLeaderboardWindow,holdEmptyFirstPage,transientLeaderboardFailure,providerRateLimitFailure,configureProviderPacing,main};
