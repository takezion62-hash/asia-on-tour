'use strict';
// Seven exact one-VR NAC ZB Solo Victory Cash Cup Round2 players, each $100.
const fs=require('node:fs'),path=require('node:path');
const {loadReviewDb,writeReviewDb,upsertPublicationLog}=require('./reviewed-publication-core.cjs');
const {validateOriginal,collision}=require('./manual-approval-core.cjs');
const {sameScannedCandidate}=require('./verified-partial-page.cjs');
const {validateData}=require('./data-checks.cjs');
const {audit:approvalAudit}=require('./validate-approvals.cjs');
const {validateUpdateLog}=require('./validate-updates.cjs');
const {isExplicitlyHeld}=require('./generic-review-only-core.cjs');
const proof=require('./verified-s30-nac-zb-solo-round2-seven-wins.cjs');
const ROOT=path.resolve(__dirname,'..'),dry=process.argv.includes('--dry-run');
const must=(ok,why)=>{if(!ok)throw Error('S30_NAC_ZB_R2_SEVEN '+why)};
must(process.argv.length===2||(process.argv.length===3&&dry),'only --dry-run accepted');
const db=loadReviewDb(ROOT);
db.reviewed=JSON.parse(fs.readFileSync(path.join(ROOT,'history-sync-reviewed.json'),'utf8'));
const archive=JSON.parse(fs.readFileSync(path.join(ROOT,
 'data/manual-approvals/s30-nac-zb-solo-round2-seven-verified-45-page-wins-20261117.json'),'utf8'));
must(archive.version===1&&archive.source?.repo==='takezion62-hash/asia-on-tour'&&
 archive.source.scanBlob===proof.SCAN_BLOB&&Array.isArray(archive.windows)&&
 archive.windows.length===3&&proof.SPECS.length===7&&
 new Set(proof.SPECS.map(s=>s.id)).size===7&&proof.SPECS.every(s=>s.vrs===1&&s.points===100),
 'archived full leaderboards or immutable prize specs missing');
const catalogs=new Map(db.tournaments.catalog.map(x=>[x.id,x]));
const catalog=catalogs.get('ch5s3-zb-solo-victory');
must(catalog&&catalog.team==='solo'&&catalog.mode==='zero-build'&&
 catalog.seasonId==='S30'&&catalog.chapter===5&&catalog.season===3&&
 catalog.name==='ZB Solo Victory Cup'&&catalog.sourceEventIds?.includes(proof.EVENT),
 'source tournament master or zero-build mode changed');
const calendars={
 '2024-06':JSON.parse(fs.readFileSync(path.join(ROOT,'calendar-history/2024-06.json'),'utf8')).sessions,
 '2024-07':JSON.parse(fs.readFileSync(path.join(ROOT,'calendar-history/2024-07.json'),'utf8')).sessions
};
const contexts=new Map();
for(const g of proof.GROUPS){
 const checkpoints=archive.windows.filter(x=>x.key===g.key);
 const sessions=(calendars[g.date.slice(0,7)]||[]).filter(x=>x.dateJst===g.date&&
  x.region==='NAC'&&x.sourceWindowId===g.window&&x.eventId===proof.EVENT&&
  x.tournamentId==='ch5s3-zb-solo-victory');
 must(checkpoints.length===1&&sessions.length===1,
  'original leaderboard or official event window missing: '+g.date);
 const cp=checkpoints[0].checkpoint,live=db.scans.history.windows[g.key];
 const end=Date.parse(sessions[0].endUtc),seen=Date.parse(cp?.lastSuccessAt||'');
 must(cp&&cp.complete===true&&cp.pages===45&&cp.nextPage===45&&
  cp.totalPages===45&&cp.rankingOrderValid===true&&
  cp.lastSeenRank===g.lastSeenRank&&cp.lastSuccessAt===g.lastSuccessAt&&
  cp.proposals.length===g.candidateCount&&cp.emptyAttempts===0&&
  !cp.lastError&&!cp.lastErrorCode&&!cp.retryAfter&&
  Number.isFinite(end)&&Number.isFinite(seen)&&seen-end>4*3600e3,
  'original 45-page snapshot must be mature and error-free: '+g.date);
 must(live&&live.complete===true&&live.rankingOrderValid===true&&
  live.pages>=cp.pages&&live.pages===live.totalPages&&
  live.nextPage===live.pages&&live.lastSeenRank>=cp.lastSeenRank&&
  live.emptyAttempts===0&&!live.lastError&&!live.lastErrorCode&&!live.retryAfter&&
  Array.isArray(live.proposals)&&Date.parse(live.lastSuccessAt)>=seen,
  'current scoreboard no longer agrees with original complete source: '+g.date);
 must(proof.SPECS.filter(s=>s.date===g.date).length===g.n,
  'selected date source count changed: '+g.date);
 contexts.set(g.date,{g,cp,live,session:sessions[0]});
}
const queue=db.reviews.history.proposals,pending=new Map(queue.map(x=>[x.id,x]));
const reviewed=new Set(db.reviewed.entries.map(x=>x.id));
const now=new Date().toISOString(),added=[],already=[],stale=[];
for(const s of proof.SPECS){
 const {g,cp,live,session}=contexts.get(s.date);
 must(!isExplicitlyHeld(s.id),'manual hold overrides publication: '+s.id);
 const proofRow=cp.proposals.filter(x=>x.id===s.id),liveRow=live.proposals.filter(x=>x.id===s.id);
 must(proofRow.length===1&&liveRow.length===1&&
  sameScannedCandidate(proofRow[0],liveRow[0])&&proof.matchesOriginal(proofRow[0],s),
  'current and original exact Epic scoreboard mismatch: '+s.id);
 const prev=db.results.filter(x=>x.id===s.id),oldLed=db.ledger.entries.filter(x=>x.id===s.id);
 if(prev.length){
  must(prev.length===1&&oldLed.length===1&&reviewed.has(s.id)&&
   proof.validateRecord(prev[0],oldLed[0]),
   'previous approved 1VR record changed: '+s.id);
  if(pending.has(s.id)){
   must(proof.matchesOriginal(pending.get(s.id),s)&&
    sameScannedCandidate(proofRow[0],pending.get(s.id)),
    'already published entry left pending with different evidence: '+s.id);
   stale.push(s.id);
  }
  already.push(s.id);continue;
 }
 must(oldLed.length===0&&!reviewed.has(s.id),'orphan approval without result: '+s.id);
 const x=pending.get(s.id);
 must(proof.matchesOriginal(x,s)&&sameScannedCandidate(proofRow[0],x),
  'unpublished player, rank, original VR or scores changed: '+s.id);
 validateOriginal(x,cp,session,catalog,db.players);
 must(!db.results.some(r=>collision(r,x,db.players.confirmedAliases||{})),
  'conflicting same-round result: '+s.id);
 const {reviewOnly,reviewReason,...clean}=x;
 const prize=100;
 const record={...clean,kind:'賞金決勝',prize,teamPrize:prize,prizePerPlayer:prize,
  note:g.date+' NAC Zero Build Solo Victory Cash Cup Event '+g.eventNum+
   ' Round2決勝。Epic順位表45/45ページ取得済みで本人Epic ID・順位・キル・1VRを確認。'+
   '公式Chapter 5 Season 3ルールによりRound2の1VRにつき個人賞金$100。'+
   '出場選手の賞金$100、決済完了状況は別途未確認。'+
   '公式規則: '+proof.RULE+' 順位表: '+proof.sourceFor(g)+
   ' Git保存証拠: '+proof.SCAN_BLOB};
 const entry={id:s.id,recordId:s.id,decision:'published',policy:proof.POLICY,
  source:proof.sourceFor(g),rule:proof.RULE,
  evidence:'all 45 original ranked pages, pinned Git blob '+proof.SCAN_BLOB+
   ', exact 1VR and $100 individual payout under Epic S30 rules',
  approvedAt:now,approvedBy:'ChatGPT / owner-authorized verified source publication'};
 must(proof.validateRecord(record,entry),'pinned 1VR $100 award proof failed: '+s.id);
 db.results.push(record);db.ledger.entries.push(entry);
 db.reviewed.entries.push({id:s.id,recordId:s.id,decision:'published',
  policy:proof.POLICY,reviewedAt:now,source:proof.sourceFor(g),rule:proof.RULE});
 added.push({id:s.id,player:s.player,date:s.date,rank:s.rank,prize:100});
}
const resolved=[...added.map(x=>x.id),...stale];
if(resolved.length){
 db.reviews.history.proposals=proof.removeExact(queue,resolved);
 db.reviews.history.manualReviewedAt=now;
 db.statuses.history.found=db.reviews.history.proposals.length;
 db.statuses.history.manualReviewCandidates=db.reviews.history.proposals.length;
 db.statuses.history.reviewOnlyCandidates=db.reviews.history.proposals.filter(x=>x.reviewOnly===true).length;
 db.statuses.history.manuallyPublished=(db.statuses.history.manuallyPublished||0)+added.length;
 db.statuses.history.lastReviewedBatchAt=now;
 db.ledger.reviewedAt=now;db.reviewed.reviewedAt=now;
 if(added.length)upsertPublicationLog(db.updates,{
  id:'verified-s30-nac-zb-solo-round2-seven-wins-20261117',
  date:new Date(Date.parse(now)+9*3600e3).toISOString().slice(0,10),
  title:'2024 NAC Zero Build Solo決勝7選手の1VR賞金を掲載',
  description:'2024年6月4日2人・7月16日2人・7月30日3人。3大会全45ページ・Epic個人照合、1VR各$100、合計個人賞金$700。',
  recordIds:added.map(x=>x.id)
 });
 must(validateData({results:db.results,players:db.players,tournaments:db.tournaments}).errors.length===0,
  'source results validation failed');
 must(approvalAudit(db.results,db.ledger,db.players).length===0,
  'approval history validation failed');
 must(validateUpdateLog(db.results,db.updates).length===0,
  'update history validation failed');
 if(!dry){
  writeReviewDb(ROOT,db);
  fs.writeFileSync(path.join(ROOT,'history-sync-reviewed.json'),JSON.stringify(db.reviewed,null,2)+'\n');
 }
}
console.log('S30_NAC_ZB_R2_SEVEN '+JSON.stringify({
 mode:dry?'dry-run':'apply',selected:proof.SPECS.length,
 added:added.length,already:already.length,staleRemoved:stale.length,
 cashAdded:added.reduce((t,r)=>t+r.prize,0),pending:db.reviews.history.proposals.length,
 results:db.results.length,ids:added.map(x=>x.id)}));
