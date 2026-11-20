'use strict';
// Shared read-only planning for recent and historical Osirion jobs.
// Both workflow types already share a GitHub concurrency group; this module
// coordinates their persisted cooldowns and bounds demand without changing data.
const HOUR=60*60*1000;
const MAX_VALID_COOLDOWN=24*HOUR;
function validLimitReport(status){
 if(!status||status.providerRateLimitPaused!==true)return null;
 const checked=Date.parse(status.checkedAt||'');
 const until=Date.parse(status.providerRateLimitRetryAfter||'');
 if(!Number.isFinite(checked)||!Number.isFinite(until)||
    until<checked||until-checked>MAX_VALID_COOLDOWN)return null;
 return {checked,until};
}
function trafficPlan({historical,config,historyStatus,recentStatus,now=Date.now()}){
 if(typeof historical!=='boolean'||!config||!Number.isFinite(now))
   throw new Error('Invalid Osirion traffic-plan input');
 const configured=Number(config.maxPagesPerRun);
 if(!Number.isSafeInteger(configured)||configured<1)
   throw new Error('Provider maxPagesPerRun must be a positive integer');
 const reports=[validLimitReport(historyStatus),validLimitReport(recentStatus)]
   .filter(Boolean).filter(x=>x.checked<=now+5*60*1000);
 const until=Math.max(0,...reports.map(x=>x.until).filter(x=>x>now));
 const recovering=reports.some(x=>x.until<=now&&now-x.until<=12*HOUR);
 const pageCap=historical?(recovering?24:48):(recovering?12:30);
 return {
  skip:until>now,
  retryAfter:until>now?new Date(until).toISOString():null,
  recovering,
  historical,
  configuredPages:configured,
  pageBudget:Math.min(configured,pageCap),
  // Sequential API calls are deliberately spaced; no parallel probe bursts.
  minRequestIntervalMs:historical?1500:1200,
  reason:until>now?'shared-provider-429-cooldown':recovering?'cautious-recovery':'steady-state'
 };
}
function createPacer({intervalMs,now=()=>Date.now(),sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms))}){
 if(!Number.isSafeInteger(intervalMs)||intervalMs<0||typeof now!=='function'||typeof sleep!=='function')
   throw new Error('Invalid Osirion request pacer');
 let previous=null,requests=0,waitedMs=0;
 return {
  async beforeRequest(){
   if(previous!==null){
    const wait=Math.max(0,previous+intervalMs-now());
    if(wait){await sleep(wait);waitedMs+=wait}
   }
   previous=now();
   requests++;
  },
  metrics(){return {requests,waitedMs,intervalMs}}
 };
}
module.exports={trafficPlan,validLimitReport,createPacer};
