'use strict';
// Deterministic read-only triage of unfinished overseas results.
// A queue classification is NEVER authority to award cash, advancement, or cosmetics.
const {sameScannedCandidate}=require('./verified-partial-page.cjs');
const {collision}=require('./manual-approval-core.cjs');
const REGIONS=new Set(['ME','EU','NAC','NAW','OCE','BR']);
const safeString=x=>typeof x==='string'?x:'';
const roster=r=>Array.isArray(r?.players)&&r.players.length?r.players:[r?.player].filter(Boolean);
const summarize=(rows,key)=>Object.entries(rows.reduce((map,x)=>{
 const label=safeString(key(x))||'unknown';
 map[label]=(map[label]||0)+1;
 return map;
},{})).sort(([a],[b])=>a.localeCompare(b,'ja')).map(([name,count])=>({name,count}));
const reviewRows=(review,origin)=>Array.isArray(review?.proposals)?
 review.proposals.map(x=>({origin,row:x})):[];
function sourceWindow(row){
 try{
  const u=new URL(row.source);
  if(u.protocol!=='https:'||u.hostname!=='www.fortnite.com'||u.username||u.password||
    u.hash||u.searchParams.get('region')!==row.region)return null;
  const event=u.pathname.match(/^\/competitive\/events\/([^/]+)\/$/);
  const window=u.searchParams.get('round');
  if(!event||!window||!window.startsWith(row.seasonId+'_')||!window.endsWith('_'+row.region))return null;
  return 'epicgames_'+decodeURIComponent(event[1])+'_'+row.region+'/'+window;
 }catch{return null}
}
function checkpointIndex(scans){
 const index=new Map();
 for(const scope of ['recent','history']){
  const windows=scans?.[scope]?.windows||{};
  for(const [key,cp] of Object.entries(windows)){
   if(!Array.isArray(cp?.proposals))continue;
   for(const row of cp.proposals){
    if(!row?.id)continue;
    if(!index.has(row.id))index.set(row.id,[]);
    index.get(row.id).push({key,cp,row});
   }
  }
 }
 return index;
}
function classify(row,ctx){
 const proofKey=sourceWindow(row);
 const sourceVerified=Boolean(proofKey);
 const scanned=ctx.index.get(row.id)||[];
 const same=scanned.filter(x=>x.key===proofKey&&sameScannedCandidate(x.row,row));
 const mismatched=scanned.length>0&&(same.length!==scanned.length);
 const complete=same.some(x=>x.cp.complete===true&&x.cp.rankingOrderValid===true);
 const matchingPartial=same.some(x=>x.cp.complete!==true&&x.cp.rankingOrderValid===true&&
   Number.isSafeInteger(x.cp.nextPage)&&x.cp.nextPage>0&&
   Number.isSafeInteger(x.cp.lastSeenRank)&&x.cp.lastSeenRank>=row.rank&&!x.cp.lastErrorCode);
 const scannedExact=Boolean(same.length)&&row.verified===true;
 const record=ctx.ids.get(row.id),old=record||ctx.reviewed.has(row.id);
 let conflicting=null;
 if(!old){
  // A matched player/event with a different ID is a review hint, not a proven duplicate.
  for(const x of ctx.results){
   if(x.date!==row.date||x.region!==row.region)continue;
   const reason=collision(x,row,ctx.aliases);
   if(reason){conflicting={id:x.id,reason};break}
  }
 }
 let status,action;
 if(old){status='resolved';action='処理済み。再掲載しない';}
 else if(!sourceVerified||!REGIONS.has(row.region)||row.verified!==true||mismatched||!scannedExact){
  status='evidence-conflict';action='元のEpic ID・公式開催枠・保存済み順位表を再照合';
 }else if(conflicting){status='duplicate-risk';action='既存の同一選手・ラウンドと突合（自動統合しない）';}
 else if(complete){status='rules-review';action='公式規則・賞金・突破・スキン条件を個別確認';}
 else if(matchingPartial){status='partial-scan';action='残り順位表を調査。未完了のまま賞金を確定しない';}
 else{status='evidence-conflict';action='順位表の順序・途中ページ・出典を再確認';}
 const best=same.find(x=>x.cp.complete&&x.cp.rankingOrderValid===true)||same[0];
 return {
  id:row.id,origin:ctx.origins.get(row.id).sort().join('+'),
  date:row.date,year:safeString(row.date).slice(0,4),region:row.region,
  tournamentId:row.tournamentId,event:row.event,round:row.round,
  player:row.player,kind:row.kind,rank:row.rank,points:row.points,
  kills:row.kills,vrs:row.vrs,prize:row.prize,source:row.source,
  status,action,reason:row.reviewReason||'追加確認が必要',
  evidence:{
   officialSource:sourceVerified,exactCheckpoint:scannedExact,
   rankingOrderValid:best?.cp?.rankingOrderValid===true,
   scanComplete:complete,observedPartial:matchingPartial,
   seenPages:Number.isSafeInteger(best?.cp?.nextPage)?best.cp.nextPage:0,
   totalPages:Number.isSafeInteger(best?.cp?.totalPages)?best.cp.totalPages:null,
   sourceKey:proofKey,possibleExistingId:conflicting?.id||null
  },
  // Source data is never silently corrected by this report.
  rewardState:row.prize===null?'cash-unconfirmed':
   Number.isFinite(row.prize)?'source-amount-present-not-verified-by-triage':'unknown'
 };
}
function buildTriage({autoReview,historyReview,autoScan,historyScan,results,historyReviewed,players}){
 if(!Array.isArray(results)||!Array.isArray(autoReview?.proposals)||!Array.isArray(historyReview?.proposals))
  throw Error('TRIAGE invalid public/review input');
 const reviewed=new Set(Array.isArray(historyReviewed?.entries)?historyReviewed.entries.map(x=>x.id):[]);
 const byId=new Map(),origins=new Map(),conflicts=new Set();
 for(const {origin,row} of [...reviewRows(autoReview,'recent'),...reviewRows(historyReview,'history')]){
  if(!row?.id||typeof row.id!=='string')continue;
  if(!byId.has(row.id)){byId.set(row.id,row);origins.set(row.id,[origin]);}
  else {
   if(!sameScannedCandidate(byId.get(row.id),row))conflicts.add(row.id);
   origins.get(row.id).push(origin);
  }
 }
 const ctx={ids:new Map(results.map(x=>[x.id,x])),results,reviewed,
  aliases:players?.confirmedAliases||{},origins,index:checkpointIndex({recent:autoScan,history:historyScan})};
 const queue=[...byId.values()].map(row=>{
  const x=classify(row,ctx);
  if(conflicts.has(row.id)){x.status='evidence-conflict';x.action='直近と過去の同一候補IDに内容の相違。公開を保留';}
  return x;
 }).sort((a,b)=>{
  const score={'evidence-conflict':0,'duplicate-risk':1,'rules-review':2,'partial-scan':3,'resolved':4};
  return score[a.status]-score[b.status]||a.date.localeCompare(b.date)||a.region.localeCompare(b.region)||a.id.localeCompare(b.id);
 });
 const pending=queue.filter(x=>x.status!=='resolved');
 return {
  version:1,
  // Input checkpoint timestamps are recorded; no artificial "verification at" time.
  sourceCheckedAt:[autoReview.checkedAt,historyReview.checkedAt].filter(Boolean).sort().at(-1)||null,
  total:pending.length,alreadyResolved:queue.length-pending.length,
  byYear:summarize(pending,x=>x.year),
  byRegion:summarize(pending,x=>x.region),
  byTournament:summarize(pending,x=>x.event+' / '+x.region+' / '+x.year),
  byStatus:summarize(pending,x=>x.status),
  queue:pending,
  // No ranking, prize, eligibility, or published achievement can be changed here.
  policy:'read-only queue; awards require existing official rule-backed validators and identity/collision proof'
 };
}
module.exports={sourceWindow,checkpointIndex,classify,buildTriage};
