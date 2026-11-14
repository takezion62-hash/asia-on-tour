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
  if(!w?.key||cp?.complete===true)return false; // Stale Unreal checkpoints restart at page zero.
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
// Protect enough page budget to FINISH up to two resumed short leaderboards
// later in the same run, rather than leaving every selected window with only
// the two-page minimum. The total request budget and per-window cap do not grow.
function windowPageAllowance(active,state,index,budget,perWindowCap,historical=false){
 if(!Array.isArray(active)||!state?.windows||!Number.isSafeInteger(index)||index<0||
    index>=active.length||!nonnegative(budget)||!nonnegative(perWindowCap))
  throw Error('Invalid leaderboard page budget inputs');
 const minimum=historical?2:1,future=active.slice(index+1);
 let reserved=minimum*future.length;
 if(historical){
  const extra=future.map(win=>{
   const checkpoint=state.windows[win.key];
   if(!checkpoint||checkpoint.complete===true||
      (win.series==='unreal-cup'&&checkpoint.epicIdsRetained!==true))return null;
   return remainingPages(checkpoint);
  }).filter(pages=>pages!==null&&pages>minimum&&pages<=perWindowCap)
   .sort((a,b)=>a-b).slice(0,2);
  reserved+=extra.reduce((total,pages)=>total+pages-minimum,0);
 }
 return Math.max(0,Math.min(perWindowCap,budget-reserved));
}

// Explicitly compare completion RATES, not raw counts. A large year or region
// with thousands of pending rounds should not be mistaken for one with poor
// coverage merely because of its size. Never changes award/approval rules.
function leastCoveredBucket(counts){
 const entries=Object.entries(counts||{}).filter(([,v])=>
  Number.isSafeInteger(v?.total)&&v.total>0&&
  Number.isSafeInteger(v?.completed)&&v.completed>=0&&v.completed<=v.total);
 entries.sort((a,b)=>a[1].completed*b[1].total-b[1].completed*a[1].total||
  b[1].total-a[1].total||a[0].localeCompare(b[0]));
 return entries[0]?.[0]||null;
}
module.exports={remainingPages,finishableWindows,windowPageAllowance,leastCoveredBucket};
