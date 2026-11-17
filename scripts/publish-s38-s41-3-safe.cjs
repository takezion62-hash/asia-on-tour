'use strict';
// Three individually checked zero-cash records; never alter existing cash totals.
const fs=require('node:fs'),path=require('node:path');
const {loadReviewDb,writeReviewDb,upsertPublicationLog}=require('./reviewed-publication-core.cjs');
const {validateOriginal,collision}=require('./manual-approval-core.cjs');
const {verifiedPartialPage,sameScannedCandidate}=require('./verified-partial-page.cjs');
const {isExplicitlyHeld}=require('./generic-review-only-core.cjs');
const {validateData,personalCents,roster}=require('./data-checks.cjs');
const {audit}=require('./validate-approvals.cjs');
const {validateUpdateLog}=require('./validate-updates.cjs');
const proof=require('./verified-s38-s41-3-safe.cjs');
const ROOT=path.resolve(__dirname,'..'),dry=process.argv.includes('--dry-run');
const must=(ok,why)=>{if(!ok)throw Error('S38_S41_SAFE3 '+why);};
must(process.argv.length===2||(process.argv.length===3&&dry),'only --dry-run accepted');
const db=loadReviewDb(ROOT);
db.reviewed=JSON.parse(fs.readFileSync(path.join(ROOT,'history-sync-reviewed.json'),'utf8'));
const snap=JSON.parse(fs.readFileSync(path.join(ROOT,proof.SNAPSHOT_PATH),'utf8'));
must(snap.version===1&&snap.source?.repo==='takezion62-hash/asia-on-tour'&&
 snap.source.scanBlob===proof.SCAN_BLOB&&
 JSON.stringify(snap.specs)===JSON.stringify(proof.SPECS)&&
 JSON.stringify(snap.rules)===JSON.stringify(proof.RULES),
 'archived original source/proof changed');
must(proof.SPECS.length===3&&new Set(proof.SPECS.map(x=>x.id)).size===3,'not 3 unique rows');
const oldPersonal=db.results.reduce((s,r)=>s+personalCents(r)*roster(r).length,0);
const oldReview=db.reviews.history.proposals,pending=new Map(oldReview.map(x=>[x.id,x]));
const reviewed=new Set(db.reviewed.entries.map(x=>x.id));
const now=new Date().toISOString(),added=[],already=[],stale=[];
for(const s of proof.SPECS){
 must(!isExplicitlyHeld(s.id),'held Epic identity cannot be approved: '+s.id);
 const cat=db.tournaments.catalog.find(x=>x.id===s.tournamentId);
 const list=JSON.parse(fs.readFileSync(path.join(ROOT,'calendar-history/'+s.date.slice(0,7)+'.json'),'utf8')).sessions;
 const sessions=list.filter(x=>x.dateJst===s.date&&x.region===s.region&&x.eventId===s.eventId&&
  x.sourceWindowId===s.window&&x.tournamentId===s.tournamentId&&x.seasonId===s.seasonId);
 must(sessions.length===1&&cat&&cat.name===s.event&&cat.seasonId===s.seasonId&&
  cat.sourceEventIds?.includes(s.eventId),'official tournament calendar identity changed: '+s.id);
 must(s.seasonId==='S38'?
  (cat.team==='squad'&&s.kind==='賞金決勝'&&s.vrs===0&&s.points===0&&s.prize===null&&s.matches<=3):
  (s.seasonId==='S41'&&cat.team==='solo'&&cat.mode==='zero-build'&&s.kind==='予選'&&
   s.prize===0&&s.rank>0&&s.rank<=2000&&s.matches<=8),
  'not permitted by official round-specific prize rules: '+s.id);
 const cp=db.scans.history.windows[s.key],end=Date.parse(sessions[0].endUtc);
 must(cp&&cp.rankingOrderValid===true&&cp.pages>=1&&cp.nextPage===cp.pages&&
  cp.totalPages>=cp.pages&&cp.lastSeenRank>=s.rank&&cp.emptyAttempts===0&&
  !cp.lastError&&!cp.lastErrorCode&&!cp.retryAfter&&Array.isArray(cp.proposals)&&
  Number.isFinite(end)&&Date.parse(cp.lastSuccessAt)-end>4*3600000,
  'mature leaderboard missing or corrupt: '+s.id);
 const src=cp.proposals.filter(x=>x.id===s.id);
 must(src.length===1&&proof.matchOriginal(src[0],s),'saved Epic name/stats mismatch: '+s.id);
 must(s.seasonId==='S38'?
  (cp.complete===true&&cp.pages===1&&cp.totalPages===1):
  (cp.complete===true||verifiedPartialPage(src[0],{end},cp)),
  'no complete/contiguous observed round evidence: '+s.id);
 const before=db.results.filter(x=>x.id===s.id), oldApprovals=db.ledger.entries.filter(x=>x.id===s.id);
 if(before.length){
  must(before.length===1&&oldApprovals.length===1&&reviewed.has(s.id)&&
   proof.validateRecord(before[0],oldApprovals[0]),'existing result or prize tampered: '+s.id);
  if(pending.has(s.id)){
   must(proof.matchOriginal(pending.get(s.id),s)&&sameScannedCandidate(src[0],pending.get(s.id)),
    'stale pending source changed: '+s.id);
   stale.push(s.id);
  }
  already.push(s.id);continue;
 }
 must(oldApprovals.length===0&&!reviewed.has(s.id),'orphan approval: '+s.id);
 const row=pending.get(s.id);
 must(proof.matchOriginal(row,s)&&sameScannedCandidate(src[0],row),
  'pending row differs from scanned original: '+s.id);
 validateOriginal(row,cp,sessions[0],cat,db.players);
 must(!db.results.some(x=>collision(x,row,db.players.confirmedAliases||{})),
  'duplicate record in this event: '+s.id);
 const {reviewReason,reviewOnly,...clean}=row, rule=proof.RULES[s.seasonId];
 const record={...clean,kind:s.kind,round:proof.outRound(s),prize:0,
  note:(s.seasonId==='S38'?
    '2025年11月10日 NAW Squad Victory Cash Cup決勝。Epic順位表1/1ページ取得、決勝0VRにつき個人賞金$0・チーム賞金$0。':
    '2026年EU Console Zero Build Solo Victory Cup予選。連続・成熟順位表でEpic本人名・順位を確認。EU上位2000人の予選突破、Round1賞金$0。')+
   '公式規則: '+rule+' 公式順位表: '+s.source+' 元データGit blob: '+proof.SCAN_BLOB};
 if(s.seasonId==='S38'){record.teamPrize=0;record.prizePerPlayer=0;}
 const entry={id:s.id,recordId:s.id,decision:'published',policy:proof.POLICY,
  approvedAt:now,approvedBy:'ChatGPT / owner-authorized verified zero-cash review',
  source:s.source,rule,evidence:'mature observed/complete Epic source and Git scan blob '+proof.SCAN_BLOB+
  '; exact Epic identity and scores; official zero cash classification'};
 must(proof.validateRecord(record,entry),'record not justified: '+s.id);
 db.results.push(record);db.ledger.entries.push(entry);
 db.reviewed.entries.push({id:s.id,recordId:s.id,decision:'published',reviewedAt:now,
  policy:proof.POLICY,source:s.source,rule});
 added.push(s.id);
}
const resolved=[...added,...stale];
if(resolved.length){
 db.reviews.history.proposals=proof.removeExact(oldReview,resolved);
 db.reviews.history.manualReviewedAt=now;db.statuses.history.found=db.reviews.history.proposals.length;
 db.statuses.history.manualReviewCandidates=db.reviews.history.proposals.length;
 db.statuses.history.reviewOnlyCandidates=db.reviews.history.proposals.filter(x=>x.reviewOnly===true).length;
 db.statuses.history.manuallyPublished=(db.statuses.history.manuallyPublished||0)+added.length;
 db.statuses.history.lastReviewedBatchAt=now;db.ledger.reviewedAt=now;db.reviewed.reviewedAt=now;
 if(added.length)upsertPublicationLog(db.updates,{
  id:'verified-s38-s41-safe3-20261117',
  date:new Date(Date.parse(now)+9*3600000).toISOString().slice(0,10),
  title:'NAW Squad決勝とEU Console Solo予選の3件を掲載',
  description:'NAW Squad決勝0VRの1件とEU Console Zero Build Solo予選突破2件。追加賞金なし。',
  recordIds:added});
 must(validateData({results:db.results,players:db.players,tournaments:db.tournaments}).errors.length===0,
  'canonical results invalid');
 must(audit(db.results,db.ledger,db.players).length===0,'ledger audit invalid');
 must(validateUpdateLog(db.results,db.updates).length===0,'update history invalid');
 must(db.results.reduce((s,r)=>s+personalCents(r)*roster(r).length,0)===oldPersonal,
  'previous awards changed');
 if(!dry){writeReviewDb(ROOT,db);
  fs.writeFileSync(path.join(ROOT,'history-sync-reviewed.json'),JSON.stringify(db.reviewed,null,2)+'\n');}
}
console.log('S38_S41_SAFE3 '+JSON.stringify({mode:dry?'dry-run':'apply',selected:3,
 added:added.length,already:already.length,stale:stale.length,
 pending:db.reviews.history.proposals.length,newCash:0,addedIds:added}));
