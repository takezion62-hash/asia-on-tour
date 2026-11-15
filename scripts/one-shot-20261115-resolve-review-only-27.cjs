'use strict';
// One-off manual, evidence-first resolution of 27 historical "review-only" rows.
// Temporary publisher. Removed before opening the final data-only PR.
// Strictly preserve all existing published cash and player records.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ROOT=path.resolve(__dirname,'..');
const {readResults,publishResults}=require('./source-results-store.cjs');
const {apply}=require('./manual-approval-core.cjs');
const {eventWindow}=require('./review-batch-index.cjs');
const {sameScannedCandidate}=require('./verified-partial-page.cjs');
const {validateData}=require('./data-checks.cjs');
const read=name=>JSON.parse(fs.readFileSync(path.join(ROOT,name),'utf8'));
const write=(name,value)=>fs.writeFileSync(path.join(ROOT,name),JSON.stringify(value,null,2)+'\n');
const TARGET_REASON='確認専用大会は自動承認不可';
// Duplicate assignments were inspected individually in source-results/S31 and S34.
// The comparison below requires exact rank, stats, event, date, region, session
// and canonical player before any candidate is resolved without adding a record.
const DUP=Object.freeze({
 'auto-s31-ca588e9bcf28':'s31-nac-playstation-sypherpk-final-20240902-r69',
 'auto-s31-cc77950b5816':'s31-nac-playstation-sypherpk-final-20240902-r89',
 'auto-s31-d771271e942c':'s31-me-ps-sypherpk-final-20240902-rintaro',
 'auto-s31-908a6928edc6':'s31-me-ps-sypherpk-final-20240902-progon',
 'auto-s31-3a54382f1663':'s31-me-ps-sypherpk-final-20240902-asuka',
 'auto-s31-f566422a6a10':'s31-me-ps-sypherpk-final-20240902-chikara',
 'auto-s31-38e85e446412':'s31-me-ps-sypherpk-final-20240902-nagase',
 'auto-s31-d3b3a69081b3':'s31-me-ps-sypherpk-final-20240902-takobel',
 'auto-s31-b4ffbd718345':'s31-me-ps-sypherpk-final-20240902-solary-kurama',
 'auto-s34-fdc778a68aa0':'s34-naw-playstation-cup-final-20250501-rintaro',
 'auto-s34-a35b5bf38e14':'s34-naw-playstation-cup-final-20250501-p1ng',
 'auto-s34-66e0df5744d1':'s34-naw-playstation-cup-final-20250501-redwing'
});
const VERIFIED_NEW=Object.freeze([
 'auto-s40-74c32db7d8cc','auto-s40-3ba93124edb1',
 'auto-s33-04d828b06777','auto-s33-2c90a3198b58',
 'auto-s33-d54f808f97ee','auto-s33-c7a7710475a2',
 'auto-s33-e3795269140e','auto-s33-1daded7e03a3',
 'auto-s33-d3dd3a0bfd30','auto-s33-87522da43720',
 'auto-s33-0ac02bc3a48e','auto-s33-565644c9b5f5',
 'auto-s33-9b2799c7103a','auto-s33-cd6321c43359',
 'auto-s33-84f6b474909b'
]);
function existingSourceWindow(row){
 try{
  const u=new URL(row.source);
  if(u.hostname==='fortnitetracker.com'){
   const hit=u.pathname.match(/^\/events\/epicgames_(.+)_(NAW|NAC|ME|EU|BR|OCE|ASIA)$/);
   return hit&&hit[2]===row.region?{eventId:hit[1],round:u.searchParams.get('window')}:null;
  }
  if(u.hostname==='www.fortnite.com'){
   const hit=u.pathname.match(/^\/competitive\/events\/([^/]+)\/$/);
   return hit?{eventId:decodeURIComponent(hit[1]),round:u.searchParams.get('round')}:null;
  }
 }catch{}
 return null;
}
function sourceProof(r,scan,tours,cal,known){
 assert.equal(r.verified,true,'candidate must have confirmed Epic identity flag');
 assert.equal(r.reviewOnly,true);
 assert.equal(r.reviewReason,TARGET_REASON);
 assert.equal(r.kind,'参加確認');
 assert.equal(r.prize,null,'no inferred prize');
 const w=eventWindow(r);assert(w,'invalid official source '+r.id);
 const key=w.key,cp=scan.windows[key];
 assert(cp&&cp.rankingOrderValid===true,'missing ordered leaderboard checkpoint '+r.id);
 assert(Array.isArray(cp.proposals)&&cp.proposals.filter(x=>x.id===r.id).length===1,
  'candidate not uniquely present in saved source '+r.id);
 assert(sameScannedCandidate(r,cp.proposals.find(x=>x.id===r.id)),'saved API row differs '+r.id);
 assert(Number.isSafeInteger(cp.nextPage)&&cp.nextPage>0&&
    Number.isSafeInteger(cp.lastSeenRank)&&cp.lastSeenRank>=r.rank,
    'candidate rank outside saved leaderboard '+r.id);
 assert(!cp.lastError&&!cp.lastErrorCode&&!cp.retryAfter&&!cp.emptyAttempts,
   'API checkpoint contains partial/retry error '+r.id);
 const date=r.date,cat=tours.get(r.tournamentId);
 assert(cat&&cat.seasonId===r.seasonId&&cat.name===r.event&&
   cat.sourceEventIds.includes(w.event),'wrong tournament master '+r.id);
 assert(cal[date.slice(0,7)]?.some(s=>s.sourceWindowId===w.round&&
   s.dateJst===date&&s.region===r.region&&s.eventId===w.event&&
   s.tournamentId===r.tournamentId&&s.seasonId===r.seasonId),
   'official calendar mismatch '+r.id);
 const names=Array.isArray(r.players)?r.players:[r.player];
 assert(names.length===({solo:1,duo:2,trio:3,squad:4})[cat.team]&&
   names.every(n=>known.has(n))&&r.player===names.join(' / '),
   'unknown player or team structure '+r.id);
 for(const k of ['rank','points','kills','vrs','matches'])
   assert(Number.isSafeInteger(r[k])&&r[k]>=(k==='rank'||k==='matches'?1:0),
    'invalid scoreboard field '+r.id+'/'+k);
 assert(r.vrs<=r.matches);
 return {w,cp};
}
function main(dryRun){
 const previous=readResults(ROOT),results=previous.rows;
 const players=read('players.json'),tournaments=read('tournaments.json');
 const history=read('history-sync-review.json'),auto=read('auto-sync-review.json');
 const historyStatus=read('history-sync-status.json'),autoStatus=read('auto-sync-status.json');
 const historyScan=read('history-sync-scan.json'),autoScan=read('auto-sync-scan.json');
 const reviewed=read('history-sync-reviewed.json'),ledger=read('approval-history.json');
 const updates=read('updates.json');
 const target=history.proposals.filter(x=>x.reviewReason===TARGET_REASON);
 const targets=new Map(target.map(r=>[r.id,r]));
 assert.equal(target.length,27,'expected exactly 27 review-only cases');
 assert.equal(targets.size,27,'duplicate candidate id');
 assert.equal(Object.keys(DUP).length,12);assert.equal(VERIFIED_NEW.length,15);
 const ids=[...Object.keys(DUP),...VERIFIED_NEW];
 assert.equal(new Set(ids).size,27);
 assert(ids.every(id=>targets.has(id)),'expected review-only ID disappeared');
 assert(target.every(r=>ids.includes(r.id)),'unrecognized review-only candidate');
 const alreadyPublished=new Map(results.map(r=>[r.id,r]));
 const priorReviewed=new Set(reviewed.entries.map(x=>x.id));
 const priorApproved=new Set(ledger.entries.map(x=>x.id));
 assert(ids.every(id=>!alreadyPublished.has(id)&&!priorReviewed.has(id)&&!priorApproved.has(id)),
   'candidate already resolved or directly published: refresh before changing');
 const cal={};
 for(const month of new Set(target.map(x=>x.date.slice(0,7)))){
  const obj=read('calendar-history/'+month+'.json');
  assert(Array.isArray(obj.sessions),'missing month '+month);
  cal[month]=obj.sessions;
 }
 const tours=new Map(tournaments.catalog.map(x=>[x.id,x]));
 const known=new Set(players.candidates.map(x=>x.name));
 const proof=new Map();
 for(const r of target){
  const x=sourceProof(r,historyScan,tours,cal,known);
  proof.set(r.id,x);
  if(Object.prototype.hasOwnProperty.call(DUP,r.id))
   assert(x.cp.complete===true,'duplicate final cannot be resolved from incomplete API scan');
  else if(r.seasonId==='S40'){
   assert(r.date==='2026-04-01'&&r.region==='NAW'&&r.event==='FNCS Division 1'&&
     x.cp.complete===true&&[312,375].includes(r.rank),
     'wrong fully saved FNCS check '+r.id);
  }else{
   assert(r.seasonId==='S33'&&r.date==='2025-02-02'&&r.region==='NAW'&&
     r.event==='Solo Cash Cup'&&r.round==='Event 6 · Round 1 / 参加確認'&&
     x.cp.complete===false&&x.cp.rankingOrderValid===true&&
     x.cp.pages===x.cp.nextPage&&x.cp.lastSeenRank>=r.rank,
     'not the saved S33 Round1 observed partial leaderboard '+r.id);
  }
 }
 const aliases=players.confirmedAliases||{};
 const canonical=n=>{
  const x=Object.entries(aliases).filter(([owner,list])=>
    owner===n||Array.isArray(list)&&list.includes(n)).map(([owner])=>owner);
  return x.length===1?x[0]:n;
 };
 const existingMatches=[];
 for(const [candidateId,recordId] of Object.entries(DUP)){
  const r=targets.get(candidateId),existing=alreadyPublished.get(recordId);
  assert(existing,'missing prepublished record '+recordId);
  assert(existing.kind==='賞金決勝'&&existing.verified===true&&
     Number.isInteger(existing.prize)&&existing.prize>=0,
     'prepublished cash was not verified '+recordId);
  assert(existing.date===r.date&&existing.region===r.region&&
     existing.event===r.event&&existing.tournamentId===r.tournamentId&&
     existing.seasonId===r.seasonId,
     'duplicate event metadata does not match '+recordId);
  for(const k of ['rank','points','kills','vrs','matches'])
   assert.equal(existing[k],r[k],'duplicate score mismatch '+recordId+'/'+k);
  assert.equal(canonical(existing.player),canonical(r.player),'duplicate identity mismatch '+recordId);
  const before=existingSourceWindow(existing),w=proof.get(candidateId).w;
  assert(before&&before.eventId===w.event&&before.round===w.round,
    'previous published event window differs '+recordId);
  existingMatches.push({id:candidateId,existingId:recordId,
    rank:r.rank,player:r.player,cashPreviouslyVerified:existing.prize});
 }
 const now=new Date().toISOString();
 // Use the existing strict, tested manual publication planner rather than
 // disabling the auto-approval policy or fabricating an award.
 const plan=apply({
  results,players,tournaments,
  reviews:{auto,history},
  statuses:{auto:autoStatus,history:historyStatus},
  scans:{auto:autoScan,history:historyScan},ledger,updates,calendar:cal
 },{
  ids:[...VERIFIED_NEW],policy:'attendance-only',confirmation:'CONFIRM',
  timestamp:now,runId:(process.env.GITHUB_RUN_ID||'manual')+'-'+(process.env.GITHUB_RUN_ATTEMPT||'1'),
  actor:'user-authorized ChatGPT manual review'
 });
 assert.equal(plan.changes.length,15,'wrong number of published attendance rows');
 assert.equal(plan.next.results.length,results.length+15);
 assert(plan.changes.every(x=>x.record.kind==='参加確認'&&x.record.prize===null&&
  !('reviewOnly' in x.record)&&!('reviewReason' in x.record)));
 const remaining=plan.next.reviews.history.proposals.filter(r=>!Object.hasOwn(DUP,r.id));
 assert.equal(remaining.length,history.proposals.length-27);
 assert(remaining.every(x=>!ids.includes(x.id)));
 const resultIds=new Set(plan.next.results.map(r=>r.id));
 assert.equal(resultIds.size,plan.next.results.length);
 assert(results.every(x=>plan.next.results.find(r=>r.id===x.id)===x),
  'prepublished records changed unexpectedly');
 const status={...plan.next.statuses.history,
  found:remaining.length,manualReviewCandidates:remaining.length,
  reviewOnlyCandidates:remaining.filter(r=>r.reviewOnly===true).length,
  manualReviewProcessed:27,manualReviewResolvedAt:now,
  message:'確認専用候補27件を保存済みEpic順位表・公式開催枠・大会マスターで再照合：参加記録15件を追加、既存賞金記録12件は再掲載せず重複解消。未確認賞金・スキン・通過は認定しない。'
 };
 const reviewedEntries=[
  ...Object.entries(DUP).map(([id,existingId])=>({id,decision:'already-published',
   existingId,evidence:'same saved official tournament window, canonical player, rank, points, kills, VRs and matches; existing verified cash preserved',reviewedAt:now})),
  ...VERIFIED_NEW.map(id=>({id,decision:'published',recordId:id,policy:'attendance-only',
   evidence:'saved Epic scoreboard row and exact official calendar window, no invented award; incomplete overall scan explicitly noted',reviewedAt:now}))
 ];
 const reviewedNext={...reviewed,reviewedAt:now,entries:[...reviewed.entries,...reviewedEntries]};
 assert.equal(new Set(reviewedNext.entries.map(x=>x.id)).size,reviewedNext.entries.length,
  'history-reviewed ledger duplicate');
 const log=plan.next.updates.entries.find(x=>x.id.startsWith('review-publication-')&&
  Array.isArray(x.recordIds)&&VERIFIED_NEW.every(id=>x.recordIds.includes(id)));
 assert(log,'manual publication update entry missing');
 log.title='確認専用大会27候補を精査：参加記録15件を追加・既存賞金12件を照合';
 log.description='Epic公式大会日程・保存済み本人順位表・選手名鑑の本人IDを個別確認。2025/2/2 NAW Solo Cash Cup Round 1の参加13件と2026/4/1 NAW FNCS Division 1参加2件を、賞金・通過・スキンは未確定の参加記録として掲載。2024/9 PlayStation SypherPK Cupと2025/5 PlayStation Cupの12件は既存の同選手・同ラウンド・同順位の賞金戦績を保持して重複解消。Solo Cash Cupの全ページ取得は未完了だが、15人分の順位は保存済みページで個別に照合済み。';
 const check=validateData({results:plan.next.results,players,tournaments});
 assert.equal(check.errors.length,0,'invalid projected site results '+JSON.stringify(check.errors.slice(0,3)));
 const report={date:now,dryRun,originReview:27,existingDuplicates:12,
  publishAttendance:15,publishedBefore:results.length,publishedAfter:plan.next.results.length,
  personalPrizeDifferenceUSD:0,remainingQueue:remaining.length,
  existing:existingMatches,
  newRows:plan.changes.map(x=>({id:x.id,player:x.record.player,region:x.record.region,
   date:x.record.date,rank:x.record.rank,points:x.record.points,kills:x.record.kills,
   matches:x.record.matches,source:x.record.source,fullScanComplete:proof.get(x.id).cp.complete===true}))};
 console.log('REVIEW_ONLY_RESOLUTION',JSON.stringify(report));
 if(dryRun)return;
 // Write only allowlisted data+ledger files. All executable workflow/script
 // files are subsequently removed before PR, preserving fast but strict CI.
 const published=publishResults(ROOT,plan.next.results);
 assert.deepEqual([...published.changedShards].sort(),['S33','S40']);
 write('history-sync-review.json',{...plan.next.reviews.history,proposals:remaining,manualReviewedAt:now});
 write('history-sync-status.json',status);
 write('history-sync-reviewed.json',reviewedNext);
 write('approval-history.json',plan.next.ledger);
 write('updates.json',plan.next.updates);
 console.log('CANONICAL_RESULTS',JSON.stringify(published));
}
if(require.main===module){try{main(process.argv.includes('--dry-run'))}catch(e){console.error(e.stack);process.exitCode=1}}
module.exports={main,DUP,VERIFIED_NEW};
