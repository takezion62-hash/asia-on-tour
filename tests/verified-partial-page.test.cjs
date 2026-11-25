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

const {leaderboardCoverage,matureFullLeaderboard,verifiedRankBoundary,verifiedQualifierPrefix,coversRankBoundary}=require('../scripts/verified-partial-page.cjs');
test('classifies actual full, partial, and cutoff-stopped coverage without mutating the scan',()=>{
 const partial=cp(),capped={...partial,complete:true},full={...capped,totalPages:2};
 const before=JSON.stringify([partial,capped,full]);
 assert.equal(leaderboardCoverage(row,win,partial,stamp).kind,'partial');
 assert.equal(leaderboardCoverage(row,win,capped,stamp).kind,'cutoff-complete');
 assert.equal(leaderboardCoverage(row,win,full,stamp).kind,'full');
 assert.equal(matureFullLeaderboard(row,win,partial,stamp),false);
 assert.equal(matureFullLeaderboard(row,win,capped,stamp),false);
 assert.equal(matureFullLeaderboard(row,win,full,stamp),true);
 assert.equal(verifiedPartialPage(row,win,capped,stamp),false);
 assert.equal(JSON.stringify([partial,capped,full]),before);
});
test('rank boundary is explicit, strictly crossed by default, and cannot be inferred from one observed winner',()=>{
 const partial={...cp(),epicIdsRetained:true};
 const opts={now:stamp,requireEpicIds:true,unique:true};
 assert.equal(verifiedRankBoundary(row,win,partial,100,opts),true);
 for(const cutoff of [200,201,0,null,undefined,'100'])assert.equal(verifiedRankBoundary(row,win,partial,cutoff,opts),false);
 const coverage=leaderboardCoverage(row,win,partial,stamp);
 assert.equal(coversRankBoundary(coverage,200,{inclusive:true}),true);
 assert.equal(coversRankBoundary(coverage,200),false);
 assert.equal(verifiedRankBoundary(row,win,{...partial,epicIdsRetained:false},100,opts),false);
 assert.equal(verifiedRankBoundary(row,win,{...partial,proposals:[row,{...row,rank:51}]},100,opts),false);
 assert.equal(verifiedRankBoundary({...row,points:123},win,partial,100,opts),false);
 assert.equal(verifiedRankBoundary(row,win,{...partial,complete:true},100,opts),false);
 assert.equal(verifiedRankBoundary(row,win,{...partial,complete:true},100,{...opts,allowCutoffComplete:true}),true);
});
test('shared coverage rejects invalid page counts, contradictory completion, immature evidence, and retries',()=>{
 for(const patch of [{pages:1},{nextPage:0,pages:0},{totalPages:1},{totalPages:2},
  {complete:'true'},{rankingOrderValid:false},{lastSeenRank:49},{lastErrorCode:'429'},
  {retryAfter:'2026-11-09T00:00:00Z'},{emptyAttempts:1},{lastSuccessAt:null},
  {lastSuccessAt:new Date(win.end+3600000).toISOString()},
  {lastSuccessAt:new Date(stamp+3600000).toISOString()}]){
  const invalid={...cp(),...patch},proof=leaderboardCoverage(row,win,invalid,stamp);
  assert.equal(proof.kind,'invalid',JSON.stringify(patch));assert.ok(proof.reason);
  assert.equal(verifiedRankBoundary(row,win,invalid,100,{now:stamp}),false);
  assert.equal(matureFullLeaderboard(row,win,invalid,stamp),false);
 }
 assert.equal(leaderboardCoverage(row,win,cp(),NaN).kind,'invalid');
 assert.equal(leaderboardCoverage({...row,rank:0},win,cp(),stamp).kind,'invalid');
});
test('qualifier compatibility keeps observed partials but never treats a cutoff stop as a full scan',()=>{
 const partial=cp(),capped={...partial,complete:true};
 assert.equal(verifiedQualifierPrefix(row,win,partial,250,stamp),true);
 assert.equal(verifiedQualifierPrefix(row,win,capped,250,stamp),false);
 assert.equal(verifiedQualifierPrefix(row,win,capped,100,stamp),true);
 assert.equal(verifiedQualifierPrefix(row,win,capped,40,stamp),false);
 assert.equal(matureFullLeaderboard(row,win,capped,stamp),false);
});
