'use strict';
// Publish only 20 complete-scoreboard Round2 results with 0 Victory Royales.
// Prize rule: only Round2 VR winners earn $200 per duo, so 0VR == $0.
const fs=require('node:fs'),path=require('node:path');
const {loadReviewDb,writeReviewDb,upsertPublicationLog}=require('./reviewed-publication-core.cjs');
const {validateOriginal,collision}=require('./manual-approval-core.cjs');
const {sameScannedCandidate}=require('./verified-partial-page.cjs');
const {validateData}=require('./data-checks.cjs');
const {audit:approvalAudit}=require('./validate-approvals.cjs');
const {validateUpdateLog}=require('./validate-updates.cjs');
const {isExplicitlyHeld}=require('./generic-review-only-core.cjs');
const proof=require('./verified-s37-console-duos-round2-20-zerovr.cjs');
const ROOT=path.resolve(__dirname,'..'),dry=process.argv.includes('--dry-run');
const must=(okay,why)=>{if(!okay)throw Error('S37_ROUND2_ZERO20 '+why)};
must(process.argv.length===2||(process.argv.length===3&&dry),'unexpected args');
const db=loadReviewDb(ROOT);
db.reviewed=JSON.parse(fs.readFileSync(path.join(ROOT,'history-sync-reviewed.json'),'utf8'));
const archive=JSON.parse(fs.readFileSync(path.join(ROOT,
 'data/manual-approvals/s37-console-duos-round2-20-zerovr-checkpoints-20261117.json'),'utf8'));
must(archive.version===1&&archive.source?.repo==='takezion62-hash/asia-on-tour'&&
 archive.source.scanBlob===proof.SCAN_BLOB&&archive.source.commit===proof.SOURCE_COMMIT&&
 Array.isArray(archive.windows)&&archive.windows.length===3,
 'pinned source provenance or window count changed');
must(proof.GROUPS.length===3&&proof.SPECS.length===20&&
 new Set(proof.SPECS.map(x=>x.id)).size===20&&
 proof.SPECS.every(x=>x.vrs===0),'not exactly 20 zero-VR finals');
const calendars={
 '2025-09':JSON.parse(fs.readFileSync(path.join(ROOT,'calendar-history/2025-09.json'),'utf8')).sessions,
 '2025-10':JSON.parse(fs.readFileSync(path.join(ROOT,'calendar-history/2025-10.json'),'utf8')).sessions
};
const cat=db.tournaments.catalog.find(x=>x.id==='ch6s4-console-duos-victory');
must(cat&&cat.seasonId==='S37'&&cat.chapter===6&&cat.season===4&&
 cat.name==='Duos Console Victory Cash Cup'&&cat.team==='duo'&&
 cat.sourceEventIds?.includes(proof.EVENT),'incorrect official tournament catalog');
const contexts=new Map();
for(const g of proof.GROUPS){
 const entries=archive.windows.filter(x=>x.key===g.key);
 const cs=calendars[g.date.slice(0,7)]||[];
 const sessions=cs.filter(x=>x.dateJst===g.date&&x.region===g.region&&
  x.sourceWindowId===g.window&&x.eventId===proof.EVENT&&x.tournamentId===cat.id);
 must(entries.length===1&&sessions.length===1,'missing or duplicate official source window: '+g.window);
 const cp=entries[0].checkpoint,live=db.scans.history.windows[g.key];
 const end=Date.parse(sessions[0].endUtc),seen=Date.parse(cp?.lastSuccessAt||'');
 must(cp&&cp.complete===true&&cp.rankingOrderValid===true&&
  cp.pages===g.pages&&cp.totalPages===g.totalPages&&cp.pages===cp.nextPage&&
  cp.pages===cp.totalPages&&cp.lastSeenRank===g.lastSeenRank&&
  !cp.lastError&&!cp.lastErrorCode&&!cp.retryAfter&&cp.emptyAttempts===0&&
  Array.isArray(cp.proposals)&&cp.proposals.length===g.count&&
  g.sessionEndUtc===sessions[0].endUtc&&
  Number.isFinite(seen)&&Number.isFinite(end)&&seen-end>4*3600e3,
  'archived 100% complete results missing or malformed: '+g.window);
 must(live&&live.complete===true&&live.rankingOrderValid===true&&
  live.pages>=cp.pages&&live.pages===live.nextPage&&
  live.totalPages===live.pages&&live.lastSeenRank>=cp.lastSeenRank&&
  live.emptyAttempts===0&&!live.lastError&&!live.lastErrorCode&&!live.retryAfter&&
  Array.isArray(live.proposals)&&Date.parse(live.lastSuccessAt)>=seen,
  'live scoreboard no longer confirms pinned complete ranking: '+g.window);
 must(proof.SPECS.filter(x=>proof.groupFor(x)===g).length===g.count,
  'event group frozen candidate count changed: '+g.window);
 contexts.set(g.key,{g,cp,live,session:sessions[0]});
}
const candidates=db.reviews.history.proposals,pending=new Map(candidates.map(x=>[x.id,x]));
const reviewed=new Set(db.reviewed.entries.map(x=>x.id));
const now=new Date().toISOString(),added=[],already=[],stale=[];
for(const s of proof.SPECS){
 const g=proof.groupFor(s),ctx=contexts.get(g.key),{cp,live,session}=ctx;
 must(!isExplicitlyHeld(s.id),'explicit hold overrides this result: '+s.id);
 const old=db.results.filter(x=>x.id===s.id),ledger=db.ledger.entries.filter(x=>x.id===s.id);
 if(old.length){
  must(old.length===1&&ledger.length===1&&reviewed.has(s.id)&&proof.validateRecord(old[0],ledger[0]),
   'previous published row or approval proof changed: '+s.id);
  if(pending.has(s.id)){
   const x=pending.get(s.id);
   must(proof.matchesOriginal(x,s)&&cp.proposals.filter(y=>sameScannedCandidate(y,x)).length===1&&
    live.proposals.filter(y=>sameScannedCandidate(y,x)).length===1,
    'stale published candidate does not match frozen original: '+s.id);
   stale.push(s.id);
  }
  already.push(s.id);
  continue;
 }
 must(ledger.length===0&&!reviewed.has(s.id),'candidate already approved without result: '+s.id);
 const x=pending.get(s.id);
 must(proof.matchesOriginal(x,s),'frozen 0VR final rank, team or score changed: '+s.id);
 must(cp.proposals.filter(y=>sameScannedCandidate(y,x)).length===1&&
  live.proposals.filter(y=>sameScannedCandidate(y,x)).length===1,
  'original and current leaderboard rows no longer match: '+s.id);
 validateOriginal(x,cp,session,cat,db.players);
 must(!db.results.some(y=>collision(y,x,db.players.confirmedAliases||{})),
  'conflicting existing same-round finalist record: '+s.id);
 const {reviewOnly,reviewReason,...clean}=x;
 const row={...clean,prize:0,kind:'賞金決勝',
  note:'2025年'+g.date+' '+g.region+' Duos Console Victory Cash Cup Event '+g.eventNo+
   ' Round2賞金決勝。公式Epic順位表の全'+g.pages+'/'+g.pages+'ページ取得後、'+
   '本人Epic名・チーム・順位・得点・キル・試合・0VRを照合。'+
   'この大会ではRound2でVictory Royaleを取ったチームのみ賞金対象のため、'+
   '0VRの本チームは賞金$0（決勝出場を記録）。'+
   '公式規則: '+proof.RULE+' 順位表: '+proof.sourceFor(g)+
   ' 証拠Git blob: '+proof.SCAN_BLOB};
 const evidence='0VR from complete original Epic Round2; pinned Git blob '+proof.SCAN_BLOB+
  '; 0 cash from official Round2 Victory Royale award rule';
 const entry={id:s.id,decision:'published',recordId:s.id,policy:proof.POLICY,
  source:proof.sourceFor(g),rule:proof.RULE,evidence,
  approvedAt:now,approvedBy:'ChatGPT / owner authorized verified cash-free finals'};
 must(proof.validateRecord(row,entry),'record did not pass strict zero-VR proof: '+s.id);
 db.results.push(row);db.ledger.entries.push(entry);
 db.reviewed.entries.push({id:s.id,decision:'published',recordId:s.id,policy:proof.POLICY,
  source:proof.sourceFor(g),rule:proof.RULE,reviewedAt:now});
 added.push({id:s.id,date:s.date,region:s.region,player:s.player,rank:s.rank,kind:'賞金決勝',prize:0});
}
const resolved=[...added.map(x=>x.id),...stale];
if(resolved.length){
 db.reviews.history.proposals=proof.removeExact(candidates,resolved);
 db.reviews.history.manualReviewedAt=now;
 db.statuses.history.found=db.reviews.history.proposals.length;
 db.statuses.history.manualReviewCandidates=db.reviews.history.proposals.length;
 db.statuses.history.reviewOnlyCandidates=db.reviews.history.proposals.filter(x=>x.reviewOnly===true).length;
 db.statuses.history.manuallyPublished=(db.statuses.history.manuallyPublished||0)+added.length;
 db.statuses.history.lastReviewedBatchAt=now;
 db.ledger.reviewedAt=now;db.reviewed.reviewedAt=now;
 if(added.length)upsertPublicationLog(db.updates,{
  id:'verified-s37-console-duos-round2-20-zero-vr-20261117',
  date:new Date(Date.parse(now)+9*3600e3).toISOString().slice(0,10),
  title:'S37 Console Duos賞金決勝・0VRの20チームを記録',
  description:'NAW 2025/9/28 8件、OCE 2025/10/4 3件、NAW 2025/10/26 9件。全ページ確認済み、0VRで現金賞金$0。過去の賞金獲得記録は維持。',
  recordIds:added.map(x=>x.id)
 });
 must(validateData({results:db.results,players:db.players,tournaments:db.tournaments}).errors.length===0,
  'data integrity errors');
 must(approvalAudit(db.results,db.ledger,db.players).length===0,
  'approval ledger integrity errors');
 must(validateUpdateLog(db.results,db.updates).length===0,
  'updates log integrity errors');
 if(!dry){
  writeReviewDb(ROOT,db);
  fs.writeFileSync(path.join(ROOT,'history-sync-reviewed.json'),JSON.stringify(db.reviewed,null,2)+'\n');
 }
}
console.log('S37_ROUND2_ZERO20 '+JSON.stringify({mode:dry?'dry-run':'apply',selected:proof.SPECS.length,
 added:added.length,already:already.length,staleResolved:stale.length,
 cashAdded:0,results:db.results.length,pending:db.reviews.history.proposals.length}));
