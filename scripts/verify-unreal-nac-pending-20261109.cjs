'use strict';
// One-off, source-authoritative full leaderboard scan. It must fetch ALL 100
// pages for this cash event before any team award can be published.
const fs=require('node:fs'),path=require('node:path');
const {linkedAccounts,getLeaderboard,normalizeRow}=require('./osirion-sync.cjs');
const {decide,payout,RULES}=require('./automatic-unreal-approval.cjs');
const {sameScannedCandidate}=require('./verified-partial-page.cjs');
const root=path.resolve(__dirname,'..');
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const write=(p,x)=>fs.writeFileSync(path.join(root,p),JSON.stringify(x,null,2)+'\n');
const assert=(condition,msg)=>{if(!condition)throw Error('UNREAL_20261109_UNVERIFIED '+msg)};
const EVENT='S39_1MillionUnrealCup',REGION='NAC',WINDOW=EVENT+'_'+REGION;
const KEY='epicgames_'+EVENT+'_'+REGION+'/'+WINDOW,TID='ch7s1-one-million-unreal-cup';
const expected=new Set(['auto-s39-c71a2ed8749f','auto-s39-6080516837cb','auto-s39-04061d8fd305','auto-s39-3919abca3a94']);
async function fullScan(rows){
 const mappedIds=new Map(rows.map(x=>[x.teamAccountIds.slice().sort().join('|'),x.id]));
 assert(mappedIds.size===rows.length,'duplicate Epic roster');
 const win={fullEventId:'epicgames_'+EVENT+'_'+REGION,eventId:EVENT,windowId:WINDOW,region:REGION,key:KEY};
 const found=new Map(),seenTeams=new Set();let total=null,lastRank=0,seen=0;
 for(let page=0;page<120;page++){
  const l=await getLeaderboard(win,page);
  if(total===null){total=l.totalPages;assert(total===100,'unexpected original totalPages '+total)}
  assert(l.totalPages===total,'totalPages changed during continuous scan on page '+page);
  assert(page<total,'page index outside leaderboard');
  assert(Array.isArray(l.entries)&&l.entries.length>0,'empty or missing page '+page);
  const first=l.entries[0].rank,finish=l.entries[l.entries.length-1].rank;
  assert(Number.isSafeInteger(first)&&first>=lastRank,'rank order across pages '+page);
  let local=lastRank;
  for(const e of l.entries){
   assert(Number.isSafeInteger(e.rank)&&e.rank>=1&&e.rank>=local,'unsorted official ranks page '+page);
   local=e.rank;
   const ids=e.players?.map(x=>typeof x.accountId==='string'?x.accountId.toLowerCase():null);
   if(!Array.isArray(ids)||ids.length!==2||ids.some(x=>!x))continue;
   const roster=ids.slice().sort().join('|');
   const match=mappedIds.get(roster);
   if(!match)continue;
   const candidate=rows.find(x=>x.id===match),data=normalizeRow(e,win);
   assert(data&&candidate&&candidate.points===data.points&&candidate.kills===data.kills&&
    candidate.vrs===data.vrs&&candidate.matches===data.matches,
    'identity matches but score changed '+match);
   assert(!found.has(match),'same verified duo appeared twice '+match);
   found.set(match,{page,rank:e.rank,points:data.points,kills:data.kills,
    vrs:data.vrs,matches:data.matches,accountCount:ids.length});
   seenTeams.add(roster);
  }
  lastRank=finish;seen+=l.entries.length;
  if(page+1===total)break;
 }
 assert(total===100&&seen>5000&&found.size===rows.length,
   'full 100-page snapshot incomplete; matches='+found.size+' pages='+total+' rows='+seen);
 return {totalPages:total,rowsScanned:seen,lastRank,found};
}
async function main(){
 const db={results:read('results.json'),players:read('players.json'),
  tournaments:read('tournaments.json'),updates:read('updates.json'),
  review:read('history-sync-review.json'),status:read('history-sync-status.json'),
  reviewed:read('history-sync-reviewed.json'),scan:read('history-sync-scan.json')};
 const rows=db.review.proposals.filter(x=>expected.has(x.id));
 if(rows.length!==expected.size||new Set(rows.map(x=>x.id)).size!==expected.size){
  console.log('UNREAL_FULL_REVIEW '+JSON.stringify({state:'deferred',reason:'exact original queue changed',
   remaining:rows.map(x=>x.id)}));return;
 }
 const catalog=db.tournaments.catalog.find(t=>t.id===TID);
 assert(catalog&&catalog.sourceEventIds.includes(EVENT)&&catalog.team==='duo','official catalog');
 const cp=db.scan.windows[KEY];
 assert(cp&&!cp.complete&&cp.rankingOrderValid===true&&cp.epicIdsRetained===true&&
  cp.nextPage>=1&&cp.totalPages===100&&!cp.lastError&&!cp.lastErrorCode&&!cp.retryAfter,
  'stored original checkpoint invalid or already fully published');
 const copies=[];
 for(const r of rows){
  assert(r.verified===true&&r.reviewOnly===true&&r.prize===null&&
   r.kind==='参加確認'&&r.region===REGION&&r.seasonId==='S39'&&r.date==='2025-12-21',
   'review candidate has unsafe state '+r.id);
  assert(!db.results.some(x=>x.id===r.id)&&!db.reviewed.entries.some(x=>x.id===r.id),
   'already resolved candidate '+r.id);
  const original=cp.proposals.find(x=>x.id===r.id);
  assert(original&&sameScannedCandidate(original,r)&&
   Array.isArray(original.teamAccountIds)&&original.teamAccountIds.length===2,
   'incomplete Epic roster or conflicting saved candidate '+r.id);
  copies.push(original);
 }
 let summary;
 try{summary=await fullScan(copies)}
 catch(e){console.log('UNREAL_FULL_REVIEW '+JSON.stringify({state:'deferred',
  reason:String(e.message||e).slice(0,400),originalCheckpointPages:cp.nextPage,
  now:new Date().toISOString()}));return}
 const session=read('calendar-history/2025-12.json').sessions.filter(s=>
  s.sourceWindowId===WINDOW&&s.eventId===EVENT&&s.tournamentId===TID&&
  s.seasonId==='S39'&&s.region===REGION&&s.dateJst==='2025-12-21');
 assert(session.length===1,'official event session duplicate/missing');
 const s=session[0],start=Date.parse(s.startUtc),end=Date.parse(s.endUtc);
 assert(Number.isFinite(start)&&Number.isFinite(end),'official session times');
 const win={key:KEY,fullEventId:'epicgames_'+EVENT+'_'+REGION,eventId:EVENT,
  windowId:WINDOW,dateJst:s.dateJst,seasonId:s.seasonId,tournamentId:TID,region:REGION,
  series:'unreal-cup',kind:'参加確認',round:'単一開催枠 / 参加確認',startUtc:s.startUtc,end};
 const accounts=linkedAccounts({results:db.results,players:db.players}).accounts;
 const rule=RULES[TID];
 assert(rule&&rule.cashPrizes?.basis==='per-team'&&rule.cashPrizes.teamSize===2,'verified official prize ladder');
 const full={...cp,complete:true,nextPage:100,totalPages:100,rankingOrderValid:true,
  epicIdsRetained:true,proposals:[]};
 const newResults=[],items=[],now=new Date().toISOString();
 for(const original of copies){
  const live=summary.found.get(original.id);
  assert(live&&live.accountCount===2,'unmatched live Epic IDs '+original.id);
  // Adopt current official rank if the historical API rank has moved.
  const current={...original,rank:live.rank};
  full.proposals.push(current);
  const official=decide(current,win,full,{
   results:[...db.results,...newResults],players:db.players,tournaments:db.tournaments,
   verifiedAccounts:accounts
  });
  assert(official.approved&&official.record?.verified===true,
   'official payout validation refused '+original.id+': '+official.reason);
  const cash=payout(rule,REGION,live.rank);
  assert(cash?.team===official.record.prize&&cash.perPlayer===official.record.prizePerPlayer,
   'payout mismatch '+original.id);
  newResults.push(official.record);
  items.push({id:original.id,player:official.record.player,
   formerRank:original.rank,rank:live.rank,prize:cash.team,prizePerPlayer:cash.perPlayer});
 }
 const prev=db.results.length;
 const report={state:'verified',pages:summary.totalPages,rowsChecked:summary.rowsScanned,
  before:prev,after:prev+newResults.length,candidates:items,teamCashAdded:items.reduce((t,x)=>t+x.prize,0),
  verifiedAt:now,source:'https://www.fortnite.com/competitive/events/'+EVENT+'/?region=NAC&round='+WINDOW};
 console.log('UNREAL_FULL_REVIEW '+JSON.stringify(report));
 if(process.argv.includes('--dry-run'))return;
 db.results.push(...newResults);
 for(const r of newResults)db.reviewed.entries.push({id:r.id,recordId:r.id,decision:'published',
  reviewedAt:now,approvedBy:'ChatGPT full 100-page official provider audit 2026-11-09',
  policy:'complete-leaderboard-verified-team-rank',officialRules:rule.source,source:r.source,
  evidence:'All 100 Epic-window Osirion ranking pages continuous and complete; both players Epic IDs, source, score, current rank, and official per-team payout verified'});
 db.reviewed.reviewedAt=now;
 db.review.proposals=db.review.proposals.filter(x=>!expected.has(x.id));
 db.review.manualReviewedAt=now;
 db.status.found=db.review.proposals.length;
 db.status.manualReviewCandidates=db.review.proposals.length;
 db.status.reviewOnlyCandidates=db.review.proposals.filter(x=>x.reviewOnly===true).length;
 db.status.lastReviewedBatchAt=now;
 db.status.message='2025 NAC Unreal Cupの100ページ全順位表を再取得。対象'+items.length+
  'チームを本人Epic ID・公式賞金表で照合し掲載。確認待ち'+db.review.proposals.length+'件。';
 const id='assistant-verified-nac-unreal-full-20261109';
 assert(!db.updates.entries.some(x=>x.id===id),'duplicate update ID');
 db.updates.entries.unshift({id,date:new Date(Date.now()+9*3600000).toISOString().slice(0,10),
  type:'records',title:'$1 Million Unreal Cup NAC 全100ページ照合で'+items.length+'組の戦績を掲載',
  description:'保存順位表に加え、公式イベントIDの順位表100ページを再取得。両者の本人Epic ID・全成績・順位・公式チーム/個人賞金表を照合し、新規'+items.length+
   '組を重複なし掲載。支払完了は確認していない。',
  recordIds:newResults.map(x=>x.id)});
 for(const [file,obj] of Object.entries({
  'results.json':db.results,'updates.json':db.updates,'history-sync-review.json':db.review,
  'history-sync-status.json':db.status,'history-sync-reviewed.json':db.reviewed
 }))write(file,obj);
}
if(require.main===module)main().catch(e=>{console.error(e.stack);process.exitCode=1});
module.exports={main,fullScan};
