'use strict';
// A completed leaderboard remains the gold standard. In narrowly allowed cases,
// a *record already observed on a continuous, mature, verified set of pages*
// can be published before the rest of a large event leaderboard is fetched.
// This never supplies a rule, a missing Epic identity, a cutoff, or cash evidence.
const FOUR_HOURS=4*60*60*1000;
const valid=n=>Number.isSafeInteger(n)&&n>=0;
// The queue adds/rewords the adjudication reason after the immutable scan is saved.
// Only that non-evidence field may vary; rank, Epic IDs, source, scores,
// verified state and every other field must match the scanned candidate.
function sameScannedCandidate(a,b){
 if(!a||!b||typeof a!=='object'||typeof b!=='object')return false;
 const {reviewReason:_a,...left}=a;
 const {reviewReason:_b,...right}=b;
 return JSON.stringify(left)===JSON.stringify(right);
}
// Classify only the saved scan's structural and time evidence. Never grant an
// award, choose a rule, or infer completion from the presence of one player.
// "cutoff-complete" is a scanner stop marker, NOT a fully fetched board and
// NOT proof of any particular cutoff unless a caller supplies that cutoff.
const invalid=reason=>({kind:'invalid',reason});
function leaderboardCoverage(row,win,cp,now=Date.now()){
 if(!row||!win||!cp)return invalid('missing-input');
 if(cp.rankingOrderValid!==true)return invalid('rank-order');
 if(!valid(cp.nextPage)||cp.nextPage<1||!valid(cp.pages)||cp.pages!==cp.nextPage||
  !valid(cp.totalPages)||cp.totalPages<cp.nextPage)return invalid('page-continuity');
 if(!valid(cp.lastSeenRank)||!valid(row.rank)||row.rank<1||row.rank>cp.lastSeenRank)
  return invalid('rank-not-covered');
 if(cp.lastErrorCode||cp.lastError||cp.retryAfter||cp.emptyAttempts>0)
  return invalid('retry-or-error');
 const observed=Date.parse(cp.lastSuccessAt||'');
 if(!Number.isFinite(win.end)||!Number.isFinite(observed)||!Number.isFinite(now)||
  now-win.end<FOUR_HOURS||observed-win.end<FOUR_HOURS||observed>now+300000)
  return invalid('not-mature');
 if(cp.nextPage===cp.totalPages&&cp.complete!==true)return invalid('completion-mismatch');
 // Legacy checkpoints without a completion flag could already pass the
 // observed-row gate. Preserve that compatibility, not the full-board claim.
 if(cp.complete!==true&&cp.complete!==false&&cp.complete!==undefined)
  return invalid('completion-mismatch');
 const kind=cp.nextPage===cp.totalPages?'full':cp.complete===true?'cutoff-complete':'partial';
 return {kind,reason:null,pages:cp.pages,totalPages:cp.totalPages,lastSeenRank:cp.lastSeenRank};
}
function candidateObserved(row,cp,{unique=false}={}){
 if(!Array.isArray(cp?.proposals))return false;
 if(unique&&(!row?.id||cp.proposals.filter(x=>x?.id===row.id).length!==1))return false;
 return cp.proposals.some(x=>sameScannedCandidate(x,row));
}
// Public compatibility helpers retain their original roles. Full coverage
// does not itself check candidate identity: callers already do so separately.
function matureFullLeaderboard(row,win,cp,now=Date.now()){
 return leaderboardCoverage(row,win,cp,now).kind==='full';
}
function verifiedPartialPage(row,win,cp,now=Date.now()){
 return leaderboardCoverage(row,win,cp,now).kind==='partial'&&candidateObserved(row,cp);
}
// Use only an explicitly supplied, verified regional cutoff. Crossing it
// means lastSeenRank > cutoff, not merely observing a prize-winning rank.
function coversRankBoundary(coverage,cutoff,{inclusive=false}={}){
 return !!coverage&&['full','partial','cutoff-complete'].includes(coverage.kind)&&
  Number.isSafeInteger(cutoff)&&cutoff>0&&
  (inclusive?coverage.lastSeenRank>=cutoff:coverage.lastSeenRank>cutoff);
}
function verifiedRankBoundary(row,win,cp,cutoff,{now=Date.now(),allowCutoffComplete=false,
 requireEpicIds=false,unique=false}={}){
 const coverage=leaderboardCoverage(row,win,cp,now);
 if(coverage.kind!=='partial'&&!(allowCutoffComplete&&coverage.kind==='cutoff-complete'))return false;
 return (!requireEpicIds||cp.epicIdsRetained===true)&&candidateObserved(row,cp,{unique})&&
  coversRankBoundary(coverage,cutoff);
}
// Existing Console Duos/Squads qualifiers accept an observed ordinary
// partial row; legacy cutoff-stopped scans additionally need the actual
// qualification boundary and an in-cutoff row. No final-policy opt-in here.
function verifiedQualifierPrefix(row,win,cp,cutoff,now=Date.now()){
 if(verifiedPartialPage(row,win,cp,now))return true;
 return cp?.complete===true&&Number.isSafeInteger(cutoff)&&row?.rank<=cutoff&&
  verifiedRankBoundary(row,win,cp,cutoff,{now,allowCutoffComplete:true});
}
// VR awards depend on the observed final record, not a payout rank boundary.
// The adapter supplies documented rules and validates identity and window.
function verifiedVrFinal(row,win,cp,rule,{now=Date.now(),stage='賞金決勝',requirePoints=false}={}){
 const cap=rule?.matchCaps?.[stage],price=rule?.prizePerVictory;
 if(!row||!win||!rule||row.verified!==true||row.prize!==null||cp?.complete!==false||
  row.tournamentId!==rule.id||win.tournamentId!==rule.id||row.seasonId!==rule.seasonId||
  win.seasonId!==rule.seasonId||row.region!==win.region||row.date!==win.dateJst||
  row.kind!==win.kind||row.round!==win.round||!rule.eventIds?.includes(win.eventId)||
  !Number.isSafeInteger(price)||price<=0||!Number.isSafeInteger(cap)||cap<1||
  !Number.isSafeInteger(row.matches)||row.matches<1||row.matches>cap||
  !valid(row.vrs)||row.vrs>row.matches||!valid(row.points)||!valid(row.kills))return false;
 if(requirePoints&&(!Number.isSafeInteger(rule.finalWinPoints)||rule.finalWinPoints<=0))return false;
 if(Number.isSafeInteger(rule.finalWinPoints)&&rule.finalWinPoints>0&&
  row.points!==row.vrs*rule.finalWinPoints)return false;
 return leaderboardCoverage(row,win,cp,now).kind==='partial'&&candidateObserved(row,cp,{unique:true});
}
module.exports={verifiedVrFinal,verifiedPartialPage,FOUR_HOURS,sameScannedCandidate,leaderboardCoverage,
 matureFullLeaderboard,candidateObserved,coversRankBoundary,verifiedRankBoundary,verifiedQualifierPrefix};
