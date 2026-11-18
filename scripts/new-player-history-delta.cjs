'use strict';
// Incremental backfill for newly confirmed Epic accounts, using the original
// historical event windows. No new prize or publication path is introduced:
// discovered candidates flow through existing identity/rules/approval checks.
const VERSION=1,MAX_PAGES=4,MAX_WINDOWS=2,MAX_PER_WINDOW=2,MAX_PROVIDER_PAGES=2000;
const UUID=/^[0-9a-f]{32}$/;
const must=(test,why)=>{if(!test)throw Error('NEW_PLAYER_DELTA '+why)};
const seasonNumber=s=>/^S\d+$/.test(String(s))?Number(s.slice(1)):-1;
function orderWindows(windows,latestSeasons=2){
 const seasons=[...new Set(windows.map(x=>x.seasonId))].sort((a,b)=>seasonNumber(b)-seasonNumber(a));
 const recent=new Set(seasons.slice(0,Math.max(1,latestSeasons)));
 return windows.slice().sort((a,b)=>
   Number(!recent.has(a.seasonId))-Number(!recent.has(b.seasonId))||
   seasonNumber(b.seasonId)-seasonNumber(a.seasonId)||
   String(b.dateJst).localeCompare(String(a.dateJst))||
   String(a.key).localeCompare(String(b.key)));
}
function validateState(state){
 must(state.version===VERSION&&Array.isArray(state.knownAccountIds)&&
  state.knownAccountIds.every(x=>typeof x==='string'&&UUID.test(x))&&
  new Set(state.knownAccountIds).size===state.knownAccountIds.length&&
  state.work&&typeof state.work==='object'&&!Array.isArray(state.work),
  'invalid persisted delta checkpoint');
 for(const [key,w] of Object.entries(state.work)){
  must(key&&w&&Number.isSafeInteger(w.nextPage)&&w.nextPage>=0&&
    Number.isSafeInteger(w.pages)&&w.pages>=0&&
    Array.isArray(w.accountIds)&&w.accountIds.length>=1&&
    new Set(w.accountIds).size===w.accountIds.length&&w.accountIds.every(x=>UUID.test(x)),
    'invalid in-progress window '+key);
 }
 return state;
}
function enrollDelta(scan,accounts,windows,now=new Date().toISOString(),latestSeasons=2){
 must(scan&&scan.windows&&typeof scan.windows==='object','history checkpoints missing');
 const current=new Map();
 for(const a of accounts){
  must(a.confirmed===true&&typeof a.player==='string'&&
   typeof a.epicAccountId==='string'&&UUID.test(a.epicAccountId),
   'ambiguous or unverified Epic account');
  must(!current.has(a.epicAccountId),'duplicate confirmed Epic account');
  current.set(a.epicAccountId,a.player);
 }
 const currentIds=[...current.keys()].sort();
 // Fail-safe first deployment: baseline existing registered accounts rather
 // than blindly replaying thousands of already-completed old scoreboards.
 // Subsequent additions are detected permanently via the saved account set.
 if(!scan.newPlayerBackfill){
  scan.newPlayerBackfill={version:VERSION,initializedAt:now,
   knownAccountIds:currentIds,work:{},enrolledCount:0};
  return {initialized:true,newAccounts:[],queuedWindows:0,work:scan.newPlayerBackfill};
 }
 const state=validateState(scan.newPlayerBackfill);
 const previous=new Set(state.knownAccountIds);
 const newlyAdded=currentIds.filter(x=>!previous.has(x));
 for(const id of newlyAdded)state.knownAccountIds.push(id);
 state.knownAccountIds.sort();
 const eligible=orderWindows(windows,latestSeasons)
   .filter(win=>scan.windows[win.key]?.complete===true&&
    (win.series!=='unreal-cup'||scan.windows[win.key].epicIdsRetained===true));
 for(const win of eligible){
  if(!newlyAdded.length)break;
  const task=state.work[win.key]||{nextPage:0,pages:0,accountIds:[]};
  const old=new Set(task.accountIds);
  const additions=newlyAdded.filter(id=>!old.has(id));
  if(!additions.length)continue;
  // A later registrant must also be checked against the already-scanned pages.
  task.accountIds=[...old,...additions].sort();
  if(old.size>0){task.nextPage=0;task.pages=0;delete task.lastSeenRank;}
  delete task.retryAfter;delete task.lastError;delete task.lastErrorCode;
  state.work[win.key]=task;
 }
 state.enrolledCount=(Number.isSafeInteger(state.enrolledCount)?state.enrolledCount:0)+newlyAdded.length;
 if(newlyAdded.length)state.lastEnrolledAt=now;
 return {initialized:false,newAccounts:newlyAdded.map(id=>({id,player:current.get(id)})),
  queuedWindows:eligible.length,work:state};
}
async function runDelta({
 scan,accounts,windows,fetchPage,normalize,prepare,previewFor,holdFailure,
 rateLimitFailure,recoverableFailure,now=Date.now(),latestSeasons=2,
 pageBudget=MAX_PAGES,windowBudget=MAX_WINDOWS,pagesPerWindow=MAX_PER_WINDOW
}){
 for(const [name,fn] of Object.entries({fetchPage,normalize,prepare,previewFor,holdFailure,rateLimitFailure,recoverableFailure}))
  must(typeof fn==='function','missing callback '+name);
 must(Number.isSafeInteger(pageBudget)&&pageBudget>=0&&pageBudget<=MAX_PAGES&&
  Number.isSafeInteger(windowBudget)&&windowBudget>=0&&windowBudget<=MAX_WINDOWS&&
  Number.isSafeInteger(pagesPerWindow)&&pagesPerWindow>=1&&pagesPerWindow<=MAX_PER_WINDOW,
  'unsafe backfill request budget');
 const enrolled=enrollDelta(scan,accounts,windows,new Date(now).toISOString(),latestSeasons);
 const result={initialized:enrolled.initialized,newAccounts:enrolled.newAccounts.length,
  pendingWindows:Object.keys(enrolled.work.work).length,
  pagesScanned:0,windowsVisited:0,windowsCompleted:0,proposalsFound:0,
  duplicates:0,rateLimited:false,retryAfter:null,heldWindows:0};
 if(enrolled.initialized||pageBudget===0||windowBudget===0)return result;
 const roster=new Map(accounts.map(x=>[x.epicAccountId,x.player]));
 const ordered=orderWindows(windows,latestSeasons)
  .filter(win=>Boolean(enrolled.work.work[win.key])&&scan.windows[win.key]?.complete===true&&
    (!enrolled.work.work[win.key].retryAfter||
      Date.parse(enrolled.work.work[win.key].retryAfter)<=now));
 for(const win of ordered){
  if(result.windowsVisited>=windowBudget||result.pagesScanned>=pageBudget||result.rateLimited)break;
  const task=enrolled.work.work[win.key],checkpoint=scan.windows[win.key];
  // Ignore accounts since removed or rendered ambiguous; never infer an alias.
  const targets=task.accountIds.filter(x=>roster.has(x));
  if(!targets.length){delete enrolled.work.work[win.key];continue}
  const targetSet=new Set(targets);
  let processed=0;
  result.windowsVisited++;
  while(processed<pagesPerWindow&&result.pagesScanned<pageBudget){
   const page=task.nextPage;
   let board;
   try{
    board=await fetchPage(win,page);
    if(!board||!Number.isSafeInteger(board.totalPages)||board.totalPages<1||
      board.totalPages>MAX_PROVIDER_PAGES||!Array.isArray(board.entries)||
      (board.entries.length===0&&page<board.totalPages-1))
      throw Object.assign(new Error('Malformed original Epic scoreboard page'),{code:'OSIRION_INVALID_LEADERBOARD'});
    if(page>=board.totalPages)throw Object.assign(new Error('Original leaderboard page beyond total'),{code:'OSIRION_INVALID_LEADERBOARD'});
    const ranks=board.entries.map(row=>row.rank);
    if(ranks.some((rank,i)=>!Number.isSafeInteger(rank)||rank<1||
      (i>0&&rank<ranks[i-1])||(i===0&&task.lastSeenRank!=null&&rank<task.lastSeenRank)))
      throw Object.assign(new Error('Unordered Epic scoreboard in player backfill'),{code:'OSIRION_INVALID_LEADERBOARD'});
    if(board.entries.length)task.lastSeenRank=ranks[ranks.length-1];
    const hits=board.entries.map(row=>normalize(row,win)).filter(row=>
      row&&row.eventId===win.eventId&&row.windowId===win.windowId&&
      Array.isArray(row.teamAccountIds)&&
      row.teamAccountIds.some(id=>targetSet.has(id)));
    if(hits.length){
     const built=prepare({entries:hits},previewFor(win));
     must(Array.isArray(built?.proposals),'source candidate normalization failed');
     if(!Array.isArray(checkpoint.proposals))checkpoint.proposals=[];
     const seen=new Set(checkpoint.proposals.map(x=>x.id));
     for(const row of built.proposals){
      must(row?.verified===true&&typeof row.id==='string'&&row.source&&row.tournamentId,
       'new candidate lacks original Epic identity/official window');
      if(seen.has(row.id)){result.duplicates++;continue}
      checkpoint.proposals.push(row);seen.add(row.id);result.proposalsFound++;
     }
    }
    task.nextPage++;task.pages++;processed++;result.pagesScanned++;
    task.totalPages=board.totalPages;task.lastSuccessAt=new Date(now).toISOString();
    delete task.retryAfter;delete task.lastError;delete task.lastErrorCode;
    if(task.nextPage>=board.totalPages){
     delete enrolled.work.work[win.key];result.windowsCompleted++;break;
    }
   }catch(error){
    if(!recoverableFailure(error))throw error;
    const held=holdFailure(task,error,win,page,now);
    result.heldWindows++;
    if(rateLimitFailure(error)){
     result.rateLimited=true;result.retryAfter=held.retryAfter;
    }
    break;
   }
  }
 }
 result.pendingWindows=Object.keys(enrolled.work.work).length;
 return result;
}
module.exports={VERSION,MAX_PAGES,MAX_WINDOWS,MAX_PER_WINDOW,orderWindows,
 validateState,enrollDelta,runDelta};
