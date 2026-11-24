'use strict';
// Prioritize incomplete, *exactly checkpoint-matched* review candidates for
// additional scanning. This module never publishes or verifies any award.
const {sameScannedCandidate}=require('./verified-partial-page.cjs');
const {remainingPages}=require('./scan-efficiency.cjs');
const nonnegative=n=>Number.isSafeInteger(n)&&n>=0;
const REVIEW_REASON='順位表の取得が完了していません';
const {rules}=require('../tournament-rules.json');
const {POLICIES,policyIds,requiresCheckpointEpicIds}=require('./tournament-approval-policy.cjs');
const {MANIFEST}=require('./generic-review-only-core.cjs');
const ruleById=new Map(rules.map(r=>[r.id,r]));
const evidenceReasons={
 nvidia:new Set(['全ページ連続の順位表・Epic ID付完全スナップショットが未確認']),
 playstation:new Set(['完了した保存済み順位表・本人Epic IDの連続性が未確認']),
 cash:new Set(['決勝の完全な公式順位表が確認できません','順位表の連続した上位順位の取得が完了していません']),
 squads:new Set(['成熟した連続順位表の取得が完了していません']),
 consoleDuos:new Set(['成熟した連続順位表の取得が完了していません']),
 duo:new Set(['順位表の連続性・取得済みページ・終了後の成熟期間が確認できません'])
};
function evidenceReason(row,win,cp,config){
 if(!config)return row.reviewReason===REVIEW_REASON;
 const rule=ruleById.get(row.tournamentId);
 if(!rule||rule.seasonId!==row.seasonId||rule.series!==win.series||!rule.eventIds.includes(win.eventId)||
  row.tournamentId!==win.tournamentId||row.date!==win.dateJst||row.kind!==win.kind||row.round!==win.round||
  cp.pages!==cp.nextPage||cp.proposals.filter(x=>x.id===row.id).length!==1||
  (requiresCheckpointEpicIds(win.series)&&cp.epicIdsRetained!==true))return false;
 const routes=policyIds(rule).filter(id=>POLICIES.some(p=>p.id===id&&config[p.flag]===true));
 // More pages cannot create a missing regional cutoff or a new approval rule.
 if(row.kind==='予選'&&!Number.isSafeInteger(rule.advance?.[row.region]))return false;
 if(row.reviewReason===REVIEW_REASON)return routes.includes('verified')&&row.kind!=='参加確認';
 return routes.some(id=>evidenceReasons[id]?.has(row.reviewReason));
}
function sourceWindow(row){
 try{
  if(typeof row?.source!=='string')return null;
  const url=new URL(row.source);
  if(url.protocol!=='https:'||url.hostname!=='www.fortnite.com'||
   url.username||url.password||url.hash)return null;
  const event=url.pathname.match(/^\/competitive\/events\/(S[1-9]\d*_[A-Za-z0-9_]+)\/$/);
  const region=url.searchParams.get('region'),round=url.searchParams.get('round');
  if(!event||!['ME','EU','NAC','NAW','OCE','BR'].includes(region)||
   row.region!==region||!round||!round.startsWith(row.seasonId+'_')||
   !round.endsWith('_'+region)||[...url.searchParams.keys()].sort().join(',')!=='region,round'||
   url.searchParams.size!==2)return null;
  return 'epicgames_'+event[1]+'_'+region+'/'+round;
 }catch{return null}
}
function recoveryShortlist(windows,state,reviewRows,records,{now=Date.now(),perWindowCap=12,config=null,reviewedIds=[]}={}){
 if(!Array.isArray(windows)||!Array.isArray(reviewRows)||!Array.isArray(records)||
  !state||typeof state.windows!=='object')throw Error('Invalid review recovery plan inputs');
 const cap=Math.max(1,Math.min(50,nonnegative(perWindowCap)?perWindowCap:12));
 const published=new Set([...records.map(row=>row.id),...reviewedIds,...(config?(MANIFEST.held||[]).map(x=>x.id):[])]);
 const byKey=new Map(windows.map(w=>[w.key,w]));
 const found=new Map();
 for(const row of reviewRows){
  if(row?.verified!==true||
   published.has(row.id)||typeof row.id!=='string')continue;
  const key=sourceWindow(row);
  if(!key||!byKey.has(key))continue;
  const cp=state.windows[key];
  const remaining=remainingPages(cp);
  if(remaining===null||cp.complete===true||cp.rankingOrderValid!==true||
   !nonnegative(cp.lastSeenRank)||!nonnegative(row.rank)||
   row.rank<1||row.rank>cp.lastSeenRank||
   !Array.isArray(cp.proposals)||
   !cp.proposals.some(candidate=>candidate.id===row.id&&sameScannedCandidate(candidate,row)))continue;
  // A delayed error is not an authorization to bypass backoff. Due retries
  // are protected independently by the existing historical scheduler.
  if(cp.retryAfter||cp.lastErrorCode||cp.lastError||
   cp.emptyAttempts>0)continue;
  if(!evidenceReason(row,byKey.get(key),cp,config))continue;
  if(!found.has(key))found.set(key,{remainingPages:remaining,ids:new Set(),cashIds:new Set()});
  const group=found.get(key);
  group.ids.add(row.id);
  if(row.prize==null&&(row.kind==='賞金決勝'||(config&&['cash-cup','nvidia-cup','playstation-cup'].includes(byKey.get(key).series))))group.cashIds.add(row.id);
 }
 const list=[];
 for(const win of windows){
  const group=found.get(win?.key);
  const cp=state.windows[win?.key];
  if(!group||!win||cp?.complete===true||
   (cp?.retryAfter&&Date.parse(cp.retryAfter)>now))continue;
  const candidateCount=group.ids.size,cashCandidates=group.cashIds.size;
  const remaining=group.remainingPages;
  const finishable=remaining<=cap;
  // Optimizes *evidence collection*, never assumes an award. Known partials
  // with unconfirmed final payouts are valuable, but no cash is inferred.
  const score=(finishable?500:0)+Math.min(5,cashCandidates)*85+
   Math.min(8,candidateCount)*22-
   Math.min(120,remaining*3)+Math.round(100*(cp.nextPage/cp.totalPages));
  list.push({window:win,windowKey:win.key,remainingPages:remaining,
   candidateCount,cashCandidates,finishable,score});
 }
 list.sort((a,b)=>b.score-a.score||a.remainingPages-b.remainingPages||
  a.windowKey.localeCompare(b.windowKey));
 return list;
}
module.exports={REVIEW_REASON,sourceWindow,recoveryShortlist};
