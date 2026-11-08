'use strict';
// A completed leaderboard remains the gold standard. In narrowly allowed cases,
// a *record already observed on a continuous, mature, verified set of pages*
// can be published before the rest of a large event leaderboard is fetched.
// This never supplies a rule, a missing Epic identity, a cutoff, or cash evidence.
const FOUR_HOURS=4*60*60*1000;
const valid=n=>Number.isSafeInteger(n)&&n>=0;
function verifiedPartialPage(row,win,checkpoint,now=Date.now()){
 if(!row||!win||!checkpoint||checkpoint.complete===true||
  checkpoint.rankingOrderValid!==true||!Array.isArray(checkpoint.proposals)||
  !checkpoint.proposals.some(x=>JSON.stringify(x)===JSON.stringify(row)))return false;
 if(!valid(checkpoint.nextPage)||checkpoint.nextPage<1||
  !valid(checkpoint.pages)||checkpoint.pages!==checkpoint.nextPage||
  !valid(checkpoint.totalPages)||checkpoint.totalPages<=checkpoint.nextPage||
  !valid(checkpoint.lastSeenRank)||!valid(row.rank)||row.rank<1||
  row.rank>checkpoint.lastSeenRank)return false;
 // An empty/malformed API page or a pending retry must not be bypassed.
 if(checkpoint.lastErrorCode||checkpoint.lastError||checkpoint.retryAfter||
  checkpoint.emptyAttempts>0||checkpoint.rankingOrderValid===false)return false;
 const observedAt=Date.parse(checkpoint.lastSuccessAt||'');
 if(!Number.isFinite(win.end)||!Number.isFinite(observedAt)||
  !Number.isFinite(now)||now-win.end<FOUR_HOURS||
  observedAt-win.end<FOUR_HOURS||observedAt>now+5*60*1000)return false;
 // Source, payout rules, verified Epic roster, rank limits and duplicate checks
 // remain the responsibility of the appropriate rule-specific approver.
 return true;
}
module.exports={verifiedPartialPage,FOUR_HOURS};
