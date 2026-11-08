'use strict';
// Pure, bounded shortlist: finishing a known partial leaderboard saves API calls,
// without bypassing retries, historical year quotas or official result checks.
const nonnegative=n=>Number.isSafeInteger(n)&&n>=0;
function remainingPages(checkpoint){
 if(!checkpoint||!nonnegative(checkpoint.nextPage)||checkpoint.nextPage===0||
    !nonnegative(checkpoint.totalPages)||checkpoint.totalPages<=checkpoint.nextPage)return null;
 return checkpoint.totalPages-checkpoint.nextPage;
}
function finishableWindows(windows,state,perWindowLimit,now=Date.now(),limit=2){
 const cap=Math.max(1,Math.min(50,nonnegative(perWindowLimit)?perWindowLimit:10));
 const all=(Array.isArray(windows)?windows:[]).filter(w=>{
  const cp=state?.windows?.[w.key];
  if(!w?.key||cp?.complete===true&&!((w.series==='unreal-cup')&&cp.epicIdsRetained!==true))return false;
  const retry=Date.parse(cp?.retryAfter||'');
  if(Number.isFinite(retry)&&retry>now)return false;
  const remaining=remainingPages(cp);
  return remaining!==null&&remaining<=cap;
 });
 all.sort((a,b)=>remainingPages(state.windows[a.key])-remainingPages(state.windows[b.key])||
  String(state.windows[a.key].lastSuccessAt||state.windows[a.key].lastScanned||'').localeCompare(
   String(state.windows[b.key].lastSuccessAt||state.windows[b.key].lastScanned||''))||
  String(a.dateJst||'').localeCompare(String(b.dateJst||''))||
  a.key.localeCompare(b.key));
 return all.slice(0,Math.max(0,Math.min(4,nonnegative(limit)?limit:2)));
}
module.exports={remainingPages,finishableWindows};
