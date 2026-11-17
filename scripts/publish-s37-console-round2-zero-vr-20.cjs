'use strict';
// Publish 20 full-board validated duo finals with exactly 0 VR / $0 prize.
// Never reinterpret Round 1 VRs as finalist cash or overwrite cash-winning teams.
const fs=require('node:fs'),path=require('node:path');
const {loadReviewDb,writeReviewDb,upsertPublicationLog}=require('./reviewed-publication-core.cjs');
const {validateOriginal,collision}=require('./manual-approval-core.cjs');
const {sameScannedCandidate}=require('./verified-partial-page.cjs');
const {validateData}=require('./data-checks.cjs');
const {audit:approvalAudit}=require('./validate-approvals.cjs');
const {validateUpdateLog}=require('./validate-updates.cjs');
const {isExplicitlyHeld}=require('./generic-review-only-core.cjs');
const proof=require('./verified-s37-console-round2-zero-vr-20.cjs');
const ROOT=path.resolve(__dirname,'..'),dry=process.argv.includes('--dry-run');
const must=(v,reason)=>{if(!v)throw Error('S37_ROUND2_ZERO20 '+reason)};
must(process.argv.length===2||process.argv.length===3&&dry,'only --dry-run accepted');
const db=loadReviewDb(ROOT),archive=JSON.parse(fs.readFileSync(path.join(ROOT,proof.SNAPSHOT_PATH),'utf8'));
db.reviewed=JSON.parse(fs.readFileSync(path.join(ROOT,'history-sync-reviewed.json'),'utf8'));
const cal=[
 ...JSON.parse(fs.readFileSync(path.join(ROOT,'calendar-history/2025-09.json'),'utf8')).sessions,
 ...JSON.parse(fs.readFileSync(path.join(ROOT,'calendar-history/2025-10.json'),'utf8')).sessions
];
const cat=db.tournaments.catalog.find(x=>x.id==='ch6s4-console-duos-victory');
must(cat?.seasonId==='S37'&&cat.team==='duo'&&
 cat.sourceEventIds?.includes('S37_ConsoleDuosCashCups'),'official console event not confirmed');
must(archive.version===1&&archive.source?.blobSha===proof.SOURCE_BLOB&&
 archive.source?.repository==='takezion62-hash/asia-on-tour'&&
 Array.isArray(archive.windows)&&archive.windows.length===3,
 'frozen original complete scoreboard not found');
const groups=new Map();
for(const g of proof.GROUPS){
 const original=archive.windows.find(x=>x.key===g.key),cp=original?.checkpoint;
 const live=db.scans.history.windows[g.key];
 const session=cal.find(x=>x.dateJst===g.date&&x.region===g.region&&
  x.sourceWindowId===g.window&&x.eventId==='S37_ConsoleDuosCashCups'&&
  x.tournamentId===cat.id);
 must(original&&cp&&live&&session&&
  original.eventNo===g.eventNo&&original.region===g.region&&
  original.date===g.date&&original.sessionEndUtc===session.endUtc&&
  cp.complete===true&&cp.rankingOrderValid===true&&
  cp.pages===cp.totalPages&&cp.pages===g.pages&&cp.nextPage===cp.pages&&
  cp.emptyAttempts===0&&!cp.lastError&&!cp.lastErrorCode&&!cp.retryAfter&&
  Array.isArray(cp.proposals)&&cp.proposals.length>=g.count&&
  Date.parse(cp.lastSuccessAt)-Date.parse(session.endUtc)>=4*3600e3,
  'original complete published finale scoreboard changed '+g.key);
 must(live.complete===true&&live.rankingOrderValid===true&&
  live.pages===live.totalPages&&live.pages===cp.pages&&
  live.lastSeenRank===cp.lastSeenRank&&live.emptyAttempts===0&&
  !live.lastError&&!live.lastErrorCode&&!live.retryAfter&&
  Array.isArray(live.proposals),
  'latest complete final board changed '+g.key);
 groups.set(g.key,{cp,live,session});
}
must(proof.SPECS.length===20&&new Set(proof.SPECS.map(s=>s.id)).size===20,
 'must be 20 unique zero-VR finalists');
const before=db.reviews.history.proposals,pending=new Map(before.map(x=>[x.id,x]));
const reviewed=new Set(db.reviewed.entries.map(x=>x.id)),now=new Date().toISOString();
const added=[],already=[],stale=[];
for(const s of proof.SPECS){
 must(!isExplicitlyHeld(s.id),'manually held candidate '+s.id);
 const g=proof.groupOf(s),r=groups.get(g?.key);
 must(g&&r,'final event missing '+s.id);
 const original=r.cp.proposals.filter(x=>x.id===s.id);
 const latest=r.live.proposals.filter(x=>x.id===s.id);
 must(original.length===1&&latest.length===1&&
  sameScannedCandidate(original[0],latest[0])&&
  proof.matchOriginal(original[0],s),
  'complete original and latest finale rows differ '+s.id);
 const old=db.results.filter(x=>x.id===s.id),entries=db.ledger.entries.filter(x=>x.id===s.id);
 if(old.length){
  must(old.length===1&&entries.length===1&&reviewed.has(s.id)&&
   proof.validateRecord(old[0],entries[0]),'previous cash or row was modified '+s.id);
  if(pending.has(s.id)){
   must(proof.matchOriginal(pending.get(s.id),s)&&
    sameScannedCandidate(original[0],pending.get(s.id)),
    'stale final pending identity differs '+s.id);
   stale.push(s.id);
  }
  already.push(s.id);continue;
 }
 must(entries.length===0&&!reviewed.has(s.id),'original award was approved already '+s.id);
 const row=pending.get(s.id);
 must(proof.matchOriginal(row,s)&&sameScannedCandidate(original[0],row),
  'unverified zero-VR final candidate '+s.id);
 validateOriginal(row,r.cp,r.session,cat,db.players);
 must(!db.results.some(x=>collision(x,row,db.players.confirmedAliases||{})),
  'duplicate final or unidentifiable event stage '+s.id);
 const {reviewOnly,reviewReason,...clean}=row;
 const record={...clean,prize:0,kind:'賞金決勝',round:proof.roundName(s),
  note:s.date+' '+s.region+' Duos Console Victory Cash Cup Round2決勝。'+
   '公式全順位表3/3ページで本人Epic名・2人の組み合わせ・順位・キル・試合数を確認。'+
   '決勝0VRのためチーム賞金$0、各選手$0。賞金は公式規則のRound2 VRのみ。'+
   '公式規則: '+proof.RULE+' 元順位表: '+s.source+
   ' 完全取得のGit blob: '+proof.SOURCE_BLOB};
 const evidence='complete Round2 0VR source-verified original Epic roster/rank/stats, full 3-page Git blob '+
  proof.SOURCE_BLOB+'; official $200/team/VR, therefore $0';
 const approval={id:s.id,recordId:s.id,decision:'published',policy:proof.POLICY,
  source:s.source,rule:proof.RULE,evidence,approvedAt:now,
  approvedBy:'ChatGPT / owner authorized verified zero-VR finals'};
 must(proof.validateRecord(record,approval),'new zero-VR final fails immutable audit '+s.id);
 db.results.push(record);db.ledger.entries.push(approval);
 db.reviewed.entries.push({id:s.id,decision:'published',recordId:s.id,policy:proof.POLICY,
  source:s.source,rule:proof.RULE,reviewedAt:now});
 added.push({id:s.id,date:s.date,region:s.region,rank:s.rank,player:s.player,vrs:0,prize:0});
}
const resolved=[...added.map(x=>x.id),...stale];
if(resolved.length){
 db.reviews.history.proposals=proof.removeExact(before,resolved);
 db.reviews.history.manualReviewedAt=now;
 db.statuses.history.found=db.reviews.history.proposals.length;
 db.statuses.history.manualReviewCandidates=db.reviews.history.proposals.length;
 db.statuses.history.reviewOnlyCandidates=db.reviews.history.proposals.filter(x=>x.reviewOnly===true).length;
 db.statuses.history.manuallyPublished=(db.statuses.history.manuallyPublished||0)+added.length;
 db.statuses.history.lastReviewedBatchAt=now;
 db.ledger.reviewedAt=now;db.reviewed.reviewedAt=now;
 if(added.length)upsertPublicationLog(db.updates,{
  id:'verified-s37-console-round2-zero-vr-20-20261117',
  date:new Date(Date.parse(now)+9*3600e3).toISOString().slice(0,10),
  title:'2025年Console Duos賞金決勝0VR・賞金0の20チームを掲載',
  description:'全ページ取得済みのOCE/NAW賞金決勝3大会。全20チーム0VR・$0と確認。既存VR賞金を変更しない。',
  recordIds:added.map(x=>x.id)
 });
 must(validateData({results:db.results,players:db.players,tournaments:db.tournaments}).errors.length===0,
  'result schema audit failed');
 must(approvalAudit(db.results,db.ledger,db.players).length===0,
  'approval ledger audit failed');
 must(validateUpdateLog(db.results,db.updates).length===0,
  'update history audit failed');
 if(!dry){
  writeReviewDb(ROOT,db);
  fs.writeFileSync(path.join(ROOT,'history-sync-reviewed.json'),JSON.stringify(db.reviewed,null,2)+'\n');
 }
}
console.log('S37_ROUND2_ZERO20 '+JSON.stringify({mode:dry?'dry-run':'apply',
 selected:proof.SPECS.length,published:added.length,already:already.length,
 staleResolved:stale.length,pending:db.reviews.history.proposals.length,
 total:db.results.length,awardsAdded:0,added}));
