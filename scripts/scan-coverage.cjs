'use strict';
// A coverage count describes scanned tournament windows, not verified player completeness.
const stamp=x=>typeof x==='string'&&Number.isFinite(Date.parse(x));
function classifyWindow(w,cp={},now=Date.now()){
 if(cp.complete===true&&(w.series!=='unreal-cup'||cp.epicIdsRetained===true))return 'completed';
 if(stamp(cp.retryAfter))return Date.parse(cp.retryAfter)>now?'retryWaiting':'retryDue';
 return Number.isSafeInteger(cp.nextPage)&&cp.nextPage>0?'partial':'notStarted';
}
function scanCoverage(windows,state,now=Date.now()){
 if(!Array.isArray(windows)||!state||!state.windows||typeof state.windows!=='object')throw Error('Invalid scan coverage input');
 const counts={completed:0,notStarted:0,partial:0,retryWaiting:0,retryDue:0},byRegion={},byYear={};
 const keys=new Set(),missing=[];
 for(const w of windows){
  if(!w?.key||keys.has(w.key))throw Error('Duplicate/missing discovered scan window');
  keys.add(w.key);
  const cp=state.windows[w.key]||{},status=classifyWindow(w,cp,now);
  counts[status]++;
  for(const [map,key] of [[byRegion,w.region||'unknown'],[byYear,String(w.dateJst||'unknown').slice(0,4)]]){
   const bucket=map[key]||(map[key]={total:0,completed:0,pending:0});
   bucket.total++;bucket[status==='completed'?'completed':'pending']++;
  }
  if(status==='completed')continue;
  missing.push({window:w.key,date:w.dateJst||'—',region:w.region||'—',series:w.series||'unknown',status,
   nextPage:Number.isSafeInteger(cp.nextPage)?cp.nextPage:0,
   totalPages:Number.isSafeInteger(cp.totalPages)?cp.totalPages:null,
   retryAfter:stamp(cp.retryAfter)?cp.retryAfter:null,errorCode:cp.lastErrorCode||null});
 }
 const priority={retryDue:0,retryWaiting:1,partial:2,notStarted:3};
 missing.sort((a,b)=>priority[a.status]-priority[b.status]||
  (a.retryAfter||'').localeCompare(b.retryAfter||'')||
  a.date.localeCompare(b.date)||a.window.localeCompare(b.window));
 return {total:windows.length,...counts,remaining:windows.length-counts.completed,
  retryCount:counts.retryWaiting+counts.retryDue,
  completionPercent:windows.length?Math.round(counts.completed*1000/windows.length)/10:100,
  byRegion,byYear,outsideScopeCheckpoints:Object.keys(state.windows).filter(k=>!keys.has(k)).length,
  samples:missing.slice(0,12)};
}
module.exports={classifyWindow,scanCoverage};
