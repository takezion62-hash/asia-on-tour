'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {trafficPlan,validLimitReport,createPacer}=require('../scripts/osirion-traffic-policy.cjs');
const NOW=Date.parse('2026-11-20T00:00:00Z');
const hours=n=>n*60*60*1000;
const report=({start=NOW-hours(1),retry=NOW+hours(5),paused=true}={})=>({
 checkedAt:new Date(start).toISOString(),
 providerRateLimitPaused:paused,
 providerRateLimitRetryAfter:new Date(retry).toISOString()
});
test('history HTTP429 pauses BOTH the historical and recent workers without provider access',()=>{
 const past=report();
 for(const historical of [true,false]){
  const plan=trafficPlan({historical,config:{maxPagesPerRun:96},
   historyStatus:past,recentStatus:{providerRateLimitPaused:false},now:NOW});
  assert.equal(plan.skip,true);
  assert.equal(plan.retryAfter,new Date(NOW+hours(5)).toISOString());
  assert.equal(plan.reason,'shared-provider-429-cooldown');
 }
});
test('recent HTTP429 also pauses historical discovery, selecting the longest valid cooldown',()=>{
 const h=report({retry:NOW+hours(2)}),r=report({retry:NOW+hours(4)});
 const plan=trafficPlan({historical:true,config:{maxPagesPerRun:96},
  historyStatus:h,recentStatus:r,now:NOW});
 assert.equal(plan.skip,true);
 assert.equal(plan.retryAfter,r.providerRateLimitRetryAfter);
});
test('cooldown expiry restarts with a smaller probe, then returns to capped steady budget',()=>{
 const h=report({start:NOW-hours(7),retry:NOW-hours(1)});
 for(const [historical,expected] of [[true,24],[false,12]]){
  const plan=trafficPlan({historical,config:{maxPagesPerRun:96},
   historyStatus:h,recentStatus:null,now:NOW});
  assert.equal(plan.skip,false);
  assert.equal(plan.recovering,true);
  assert.equal(plan.pageBudget,expected);
 }
 const later=trafficPlan({historical:true,config:{maxPagesPerRun:96},
  historyStatus:h,recentStatus:{providerRateLimitPaused:false},now:NOW+hours(14)});
 assert.equal(later.skip,false);
 assert.equal(later.recovering,false);
 assert.equal(later.pageBudget,48);
});
test('normal provider scan stays within configured limits and uses slower historical pacing',()=>{
 const regular=trafficPlan({historical:false,config:{maxPagesPerRun:50},
  historyStatus:null,recentStatus:null,now:NOW});
 const history=trafficPlan({historical:true,config:{maxPagesPerRun:22},
  historyStatus:null,recentStatus:null,now:NOW});
 assert.equal(regular.pageBudget,30);
 assert.equal(history.pageBudget,22);
 assert.ok(history.minRequestIntervalMs>=regular.minRequestIntervalMs);
});
test('invalid, impossible or disabled cooldowns never block a healthy workflow',()=>{
 const bad=[
  {providerRateLimitPaused:true,checkedAt:'not a date',providerRateLimitRetryAfter:'2030-01-01'},
  {providerRateLimitPaused:true,checkedAt:new Date(NOW).toISOString(),providerRateLimitRetryAfter:new Date(NOW+hours(500)).toISOString()},
  report({paused:false})
 ];
 for(const item of bad){
  assert.equal(validLimitReport(item),null);
  assert.equal(trafficPlan({historical:false,config:{maxPagesPerRun:25},
   historyStatus:item,recentStatus:null,now:NOW}).skip,false);
 }
 assert.throws(()=>trafficPlan({historical:true,config:{maxPagesPerRun:0},now:NOW}),
  /positive integer/);
});
test('pacer spaces requests without parallel burst and counts actual throttle time',async()=>{
 let clock=1000;const waits=[];
 const pacer=createPacer({intervalMs:800,now:()=>clock,
  sleep:async ms=>{waits.push(ms);clock+=ms}});
 await pacer.beforeRequest();
 clock+=100;
 await pacer.beforeRequest();
 clock+=1200;
 await pacer.beforeRequest();
 assert.deepEqual(waits,[700]);
 assert.deepEqual(pacer.metrics(),{requests:3,waitedMs:700,intervalMs:800});
});
test('no mandatory sleeping between requests when a test disables pacing',async()=>{
 let clock=0;let slept=0;
 const pacer=createPacer({intervalMs:0,now:()=>clock,
  sleep:async()=>{slept++}});
 await pacer.beforeRequest();await pacer.beforeRequest();
 assert.equal(slept,0);
 assert.equal(pacer.metrics().requests,2);
});
