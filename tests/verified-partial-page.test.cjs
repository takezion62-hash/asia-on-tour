'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {verifiedPartialPage}=require('../scripts/verified-partial-page.cjs');
const stamp=Date.parse('2026-11-08T10:00:00Z');
const row={id:'auto-s43-example',rank:50,verified:true,source:'https://www.fortnite.com/competitive/events/S43_Test/'};
const win={end:stamp-6*3600000,region:'NAW',series:'skin-cup'};
const cp=()=>({complete:false,rankingOrderValid:true,nextPage:2,pages:2,totalPages:100,
 lastSeenRank:200,lastSuccessAt:new Date(stamp-60*1000).toISOString(),proposals:[row]});
test('a proven entry from continuous saved pages is usable without the full leaderboard',()=>{
 const state=cp(),old=JSON.stringify(state);
 assert.equal(verifiedPartialPage(row,win,state,stamp),true);
 assert.equal(JSON.stringify(state),old,'evidence gate never mutates checkpoint');
});
test('rejects missing ranks, false ordering, skipped pages and unobserved rows',()=>{
 const cases=[{rankingOrderValid:false},{rankingOrderValid:undefined},
  {nextPage:0,pages:0},{nextPage:3,pages:2},{totalPages:2},
  {lastSeenRank:49},{proposals:[]},{proposals:[{...row,rank:48}]},
  {complete:true},{lastSuccessAt:null}];
 for(const patch of cases)assert.equal(verifiedPartialPage(row,win,{...cp(),...patch},stamp),false,JSON.stringify(patch));
});
test('rejects blocked pages, pending retries and insufficient provider settle time',()=>{
 for(const patch of [{lastError:'bad page'},{lastErrorCode:'OSIRION_INVALID_PAGE'},
  {retryAfter:'2026-11-09T00:00:00Z'},{emptyAttempts:1}]){
  assert.equal(verifiedPartialPage(row,win,{...cp(),...patch},stamp),false,JSON.stringify(patch));
 }
 assert.equal(verifiedPartialPage(row,{...win,end:stamp-2*3600000},cp(),stamp),false);
 assert.equal(verifiedPartialPage(row,win,{...cp(),lastSuccessAt:new Date(win.end+3600000).toISOString()},stamp),false);
 assert.equal(verifiedPartialPage(row,win,{...cp(),lastSuccessAt:new Date(stamp+10*60000).toISOString()},stamp),false);
});

test('review reason may change after snapshot but measured scores and Epic IDs may not',()=>{
 const source=cp(),original=row;
 const queued={...original,reviewReason:'公式の地域別順位条件の登録待ち'};
 assert.equal(verifiedPartialPage(queued,win,{...source,proposals:[original]},stamp),true);
 assert.equal(verifiedPartialPage({...queued,points:111},win,{...source,proposals:[original]},stamp),false);
 assert.equal(verifiedPartialPage({...queued,rank:51},win,{...source,proposals:[original]},stamp),false);
});
