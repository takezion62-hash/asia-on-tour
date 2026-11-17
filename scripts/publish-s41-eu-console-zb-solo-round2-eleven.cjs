'use strict';
// Publish exactly 11 source-pinned S41 EU Console ZB Solo Round2 performances.
// Official $100 per Round2 VR; one 1VR=$100, ten 0VR=$0.
const fs=require('node:fs'),path=require('node:path');
const {loadReviewDb,writeReviewDb,upsertPublicationLog}=require('./reviewed-publication-core.cjs');
const {validateOriginal,collision}=require('./manual-approval-core.cjs');
const {sameScannedCandidate}=require('./verified-partial-page.cjs');
const {validateData}=require('./data-checks.cjs');
const {audit:approvalAudit}=require('./validate-approvals.cjs');
const {validateUpdateLog}=require('./validate-updates.cjs');
const {isExplicitlyHeld}=require('./generic-review-only-core.cjs');
const proof=require('./verified-s41-eu-console-zb-solo-round2-eleven.cjs');
const ROOT=path.resolve(__dirname,'..'),dry=process.argv.includes('--dry-run');
const must=(condition,reason)=>{if(!condition)throw Error('S41_EU_CONSOLE_ZB_R2_11 '+reason)};
must(process.argv.length===2||(process.argv.length===3&&dry),'only --dry-run accepted');
const db=loadReviewDb(ROOT);
db.reviewed=JSON.parse(fs.readFileSync(path.join(ROOT,'history-sync-reviewed.json'),'utf8'));
const archive=JSON.parse(fs.readFileSync(path.join(ROOT,
 'data/manual-approvals/s41-eu-console-zb-solo-round2-11-checkpoint-20261117.json'),'utf8'));
const cp=archive.checkpoint,live=db.scans.history.windows[proof.KEY];
const sessions=JSON.parse(fs.readFileSync(path.join(ROOT,'calendar-history/2026-06.json'),'utf8')).sessions;
const matches=sessions.filter(x=>x.dateJst===proof.DATE&&x.region===proof.REGION&&
 x.sourceWindowId===proof.WINDOW&&x.eventId===proof.EVENT&&
 x.tournamentId==='ch7s3-console-zb-solo-victory');
const catalog=db.tournaments.catalog.find(x=>x.id==='ch7s3-console-zb-solo-victory');
must(matches.length===1&&catalog&&catalog.name==='Console Solo Victory Cup (ZB)'&&
 catalog.seasonId==='S41'&&catalog.chapter===7&&catalog.season===3&&
 catalog.team==='solo'&&catalog.mode==='zero-build'&&
 catalog.sourceEventIds?.includes(proof.EVENT),
 'official event identity, rules or calendar window changed');
must(archive.version===1&&archive.source?.repo==='takezion62-hash/asia-on-tour'&&
 archive.source.scanBlob===proof.SCAN_BLOB&&
 proof.SPECS.length===11&&new Set(proof.SPECS.map(x=>x.id)).size===11,
 'frozen 11-source snapshot missing or changed');
const session=matches[0],end=Date.parse(session.endUtc),observed=Date.parse(cp?.lastSuccessAt||'');
must(cp&&cp.complete===true&&cp.rankingOrderValid===true&&
 cp.pages===20&&cp.totalPages===20&&cp.nextPage===20&&
 cp.lastSeenRank===1943&&cp.emptyAttempts===0&&
 !cp.lastError&&!cp.lastErrorCode&&!cp.retryAfter&&
 Array.isArray(cp.proposals)&&cp.proposals.length===11&&
 Number.isFinite(observed)&&Number.isFinite(end)&&observed-end>4*3600e3,
 'clean mature 20-page original leaderboard invalid');
must(live&&live.complete===true&&live.rankingOrderValid===true&&
 Number.isSafeInteger(live.pages)&&live.pages>=20&&
 live.nextPage===live.pages&&live.totalPages===live.pages&&
 live.lastSeenRank>=cp.lastSeenRank&&live.emptyAttempts===0&&
 !live.lastError&&!live.lastErrorCode&&!live.retryAfter&&
 Array.isArray(live.proposals)&&Date.parse(live.lastSuccessAt)>=observed,
 'updated leaderboard does not retain the complete original');
const original=db.reviews.history.proposals,pending=new Map(original.map(x=>[x.id,x]));
const reviewed=new Set(db.reviewed.entries.map(x=>x.id));
const now=new Date().toISOString(),added=[],already=[],stale=[];
for(const spec of proof.SPECS){
 must(!isExplicitlyHeld(spec.id),'explicitly held result cannot be published: '+spec.id);
 const scanned=cp.proposals.filter(x=>x.id===spec.id);
 const current=live.proposals.filter(x=>x.id===spec.id);
 must(scanned.length===1&&current.length===1&&
  sameScannedCandidate(scanned[0],current[0])&&
  proof.matchesOriginal(scanned[0],spec),
  'historical and newest Epic candidate row differs: '+spec.id);
 const prev=db.results.filter(x=>x.id===spec.id);
 const oldApproval=db.ledger.entries.filter(x=>x.id===spec.id);
 if(prev.length){
  must(prev.length===1&&oldApproval.length===1&&reviewed.has(spec.id)&&
   proof.validateRecord(prev[0],oldApproval[0]),
   'existing payout or approval does not match original evidence: '+spec.id);
  if(pending.has(spec.id)){
   must(proof.matchesOriginal(pending.get(spec.id),spec)&&
    sameScannedCandidate(scanned[0],pending.get(spec.id)),
    'stale pending candidate altered: '+spec.id);
   stale.push(spec.id);
  }
  already.push(spec.id);continue;
 }
 must(oldApproval.length===0&&!reviewed.has(spec.id),'orphan approval before publication: '+spec.id);
 const row=pending.get(spec.id);
 must(proof.matchesOriginal(row,spec)&&
  sameScannedCandidate(scanned[0],row),'unpublished Epic player identity or scores changed: '+spec.id);
 validateOriginal(row,cp,session,catalog,db.players);
 must(!db.results.some(x=>collision(x,row,db.players.confirmedAliases||{})),
  'conflicting same event/round/identity entry already published: '+spec.id);
 const {reviewOnly,reviewReason,...clean}=row,prize=proof.amount(spec);
 const published={...clean,kind:'賞金決勝',prize,teamPrize:prize,prizePerPlayer:prize,
  note:'2026年6月15日 EU Console Zero Build Solo Victory Cup Event1 Round2決勝。'+
   'Epic公式順位表20/20ページ全件取得済み。本人Epic名・順位・キル・試合数・VRを照合。'+
   '公式Chapter7 Season3規則ではRound2で個人1VRにつき賞金$100。'+
   spec.vrs+'VRなので個人賞金$'+prize+'。支払完了は未確認。'+
   '公式規則: '+proof.RULE+' 順位表: '+proof.SOURCE+
   ' 証拠Git blob: '+proof.SCAN_BLOB};
 const entry={id:spec.id,recordId:spec.id,decision:'published',policy:proof.POLICY,
  approvedAt:now,approvedBy:'ChatGPT / owner-authorized original-result review',
  source:proof.SOURCE,rule:proof.RULE,
  evidence:'20-page complete Epic source, pinned original Git blob '+proof.SCAN_BLOB+
   ', 1VR=$100 each in Round2, exact solo Epic identity and scores'};
 must(proof.validateRecord(published,entry),
  'record violates fixed original VR payout: '+spec.id);
 db.results.push(published);db.ledger.entries.push(entry);
 db.reviewed.entries.push({id:spec.id,recordId:spec.id,decision:'published',
  reviewedAt:now,policy:proof.POLICY,source:proof.SOURCE,rule:proof.RULE});
 added.push({id:spec.id,player:spec.player,rank:spec.rank,vrs:spec.vrs,prize});
}
const ids=[...added.map(x=>x.id),...stale];
if(ids.length){
 db.reviews.history.proposals=proof.removeExact(original,ids);
 db.reviews.history.manualReviewedAt=now;
 db.statuses.history.found=db.reviews.history.proposals.length;
 db.statuses.history.manualReviewCandidates=db.reviews.history.proposals.length;
 db.statuses.history.reviewOnlyCandidates=db.reviews.history.proposals.filter(x=>x.reviewOnly===true).length;
 db.statuses.history.manuallyPublished=(db.statuses.history.manuallyPublished||0)+added.length;
 db.statuses.history.lastReviewedBatchAt=now;
 db.ledger.reviewedAt=now;db.reviewed.reviewedAt=now;
 if(added.length)upsertPublicationLog(db.updates,{
  id:'verified-s41-eu-console-zb-solo-round2-11-20261117',
  date:new Date(Date.parse(now)+9*3600e3).toISOString().slice(0,10),
  title:'EU Console ZB Solo決勝11人のVR・賞金を確定掲載',
  description:'2026-06-15 EU Event1 Round2。完全順位表とEpic本人を照合、なずな1VR個人賞金$100・ほか10名0VR賞金$0。',
  recordIds:added.map(x=>x.id)
 });
 must(validateData({results:db.results,players:db.players,tournaments:db.tournaments}).errors.length===0,
  'canonical data audit failed');
 must(approvalAudit(db.results,db.ledger,db.players).length===0,
  'approval ledger audit failed');
 must(validateUpdateLog(db.results,db.updates).length===0,
  'publication update audit failed');
 if(!dry){
  writeReviewDb(ROOT,db);
  fs.writeFileSync(path.join(ROOT,'history-sync-reviewed.json'),JSON.stringify(db.reviewed,null,2)+'\n');
 }
}
console.log('S41_EU_CONSOLE_ZB_R2_11 '+JSON.stringify({
 mode:dry?'dry-run':'apply',selected:11,added:added.length,already:already.length,
 staleResolved:stale.length,newCash:added.reduce((s,x)=>s+x.prize,0),
 results:db.results.length,pending:db.reviews.history.proposals.length,
 addedIds:added.map(x=>x.id)}));
