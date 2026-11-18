'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {describe,report}=require('../scripts/history-sync-health.cjs');
test('historical health summary exposes provider rate limiting without treating 429 as successful recovery',()=>{
 const now=Date.parse('2026-11-18T01:30:00Z');
 const status={checkedAt:'2026-11-18T01:00:00Z',
  trackedWindows:3177,completedWindows:676,scannedPages:48,
  processedWindows:7,newlyCompletedWindows:4,imported:16,
  providerRateLimitPaused:true,providerRateLimitRetryAfter:'2026-11-18T07:20:00.000Z',
  transientFailures:1,coverage:{counts:{retryWaiting:9,retryDue:1}}};
 const x=describe(status,now);
 assert.equal(x.ageMinutes,30);
 assert.equal(x.stale,false);
 assert.equal(x.unfinishedWindows,2501);
 assert.equal(x.scannedPages,48);
 assert.equal(x.completedThisRun,4);
 assert.equal(x.rateLimited,true);
 assert.equal(x.retryAfter,'2026-11-18T07:20:00.000Z');
 assert.equal(x.retryWaiting,9);
 assert.match(report(x),/取得先の429制限による中断 \| あり/);
 assert.match(report(x),/確認済みページを保持/);
});
test('scan freshness warns only after eight hours and accepts older checkpoints without new fields',()=>{
 const s={checkedAt:'2026-11-17T12:00:00Z',trackedWindows:200,completedWindows:50,scannedPages:7};
 const fresh=describe(s,Date.parse('2026-11-17T19:59:00Z'));
 const stale=describe(s,Date.parse('2026-11-17T20:00:00Z'));
 assert.equal(fresh.stale,false);
 assert.equal(stale.stale,true);
 assert.equal(stale.rateLimited,false);
 assert.equal(stale.completedThisRun,0);
 assert.match(report(stale),/8時間以上/);
 assert.throws(()=>describe({checkedAt:'invalid'}),/valid scan checkpoint/);
});
