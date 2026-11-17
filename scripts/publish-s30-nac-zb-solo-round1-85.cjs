'use strict';
// Publish only 85 immutable S30 NA / NAC Zero Build Solo Round 1 results.
// Explicitly exclude the 8/6 rank 829 after a late provider HTTP 429.
const fs=require('node:fs'),path=require('node:path');
const {loadReviewDb,writeReviewDb,upsertPublicationLog}=require('./reviewed-publication-core.cjs');
const {validateOriginal,collision}=require('./manual-approval-core.cjs');
const {verifiedPartialPage,sameScannedCandidate}=require('./verified-partial-page.cjs');
const {validateData}=require('./data-checks.cjs');
const {audit:approvalAudit}=require('./validate-approvals.cjs');
const {validateUpdateLog}=require('./validate-updates.cjs');
const {isExplicitlyHeld}=require('./generic-review-only-core.cjs');
const proof=require('./verified-s30-nac-zb-solo-round1-85.cjs');
const ROOT=path.resolve(__dirname,'..'),dry=process.argv.includes('--dry-run');
const must=(v,msg)=>{if(!v)throw Error('S30_NAC_ZB_SOLO85 '+msg)};
must(process.argv.length===2||process.argv.length===3&&dry,'only --dry-run accepted');
const db=loadReviewDb(ROOT),snap=JSON.parse(fs.readFileSync(path.join(ROOT,proof.SNAPSHOT_PATH),'utf8'));
db.reviewed=JSON.parse(fs.readFileSync(path.join(ROOT,'history-sync-reviewed.json'),'utf8'));
const calendars={};
for(const mon of ['2024-06','2024-07','2024-08'])
 calendars[mon]=JSON.parse(fs.readFileSync(path.join(ROOT,'calendar-history/'+mon+'.json'),'utf8')).sessions;
const cat=db.tournaments.catalog.find(x=>x.id==='ch5s3-zb-solo-victory');
must(cat&&cat.seasonId==='S30'&&cat.chapter===5&&cat.season===3&&
 cat.team==='solo'&&cat.mode==='zero-build'&&
 cat.sourceEventIds?.includes('S30_SoloZBVictoryCashCup'),
 'source catalog does not match original NA Zero Build solo event');
must(snap.version===1&&snap.source?.repository==='takezion62-hash/asia-on-tour'&&
 Array.isArray(snap.windows)&&snap.windows.length===9,
 'archived source proof not found');
const groupSource=new Map();
for(const g of proof.GROUPS){
 const arch=snap.windows.find(x=>x.key===g.key);
 const session=(calendars[g.date.slice(0,7)]||[]).find(x=>x.sourceWindowId===g.window&&
  x.dateJst===g.date&&x.region==='NAC'&&x.tournamentId===cat.id&&
  x.eventId==='S30_SoloZBVictoryCashCup');
 const cp=arch?.checkpoint,live=db.scans.history.windows[g.key];
 must(arch&&session&&cp&&live&&
  arch.date===g.date&&arch.eventNo===g.eventNo&&arch.oldCommit===g.oldCommit&&
  arch.oldBlob===g.oldBlob&&arch.count===g.count&&
  arch.rankMax===g.rankMax&&arch.sessionEndUtc===session.endUtc&&
  cp.complete===false&&cp.rankingOrderValid===true&&cp.pages===g.oldPages&&
  cp.nextPage===cp.pages&&cp.totalPages>cp.pages&&cp.emptyAttempts===0&&
  !cp.lastError&&!cp.lastErrorCode&&!cp.retryAfter&&
  Array.isArray(cp.proposals)&&cp.lastSeenRank===g.oldLastSeenRank&&
  cp.lastSeenRank>=g.rankMax&&
  Date.parse(cp.lastSuccessAt)-Date.parse(session.endUtc)>4*3600e3,
  'archived clean page prefix proof invalid: '+g.eventNo);
 must(live.rankingOrderValid===true&&live.pages>=cp.pages&&
  live.nextPage===live.pages&&live.totalPages>=live.pages&&
  live.lastSeenRank>=cp.lastSeenRank&&live.emptyAttempts===0&&
  Array.isArray(live.proposals)&&
  Date.parse(live.lastSuccessAt)>=Date.parse(cp.lastSuccessAt),
  'live result no longer matches archived pages: '+g.eventNo);
 if(live.lastError||live.lastErrorCode||live.retryAfter)
  must(live.complete===false&&live.lastErrorCode==='OSIRION_TRANSIENT'&&
   Number.isSafeInteger(live.lastErrorPage)&&
   live.lastErrorPage===live.nextPage&&live.lastErrorPage>=cp.pages,
   'unexpected provider failure on scanned page: '+g.eventNo);
 groupSource.set(g.eventNo,{session,cp,live});
}
must(proof.SPECS.length===85&&new Set(proof.SPECS.map(x=>x.id)).size===85&&
 proof.SPECS.every(x=>x.rank>0&&x.rank<=proof.CUTOFF),
 'not 85 distinct proof-frozen NA top 5000 results');
const original=db.reviews.history.proposals,pending=new Map(original.map(x=>[x.id,x]));
const reviewed=new Set(db.reviewed.entries.map(x=>x.id));
const now=new Date().toISOString(),added=[],already=[],stale=[];
for(const s of proof.SPECS){
 must(!isExplicitlyHeld(s.id),'manual hold: '+s.id);
 const g=proof.groupOf(s),cs=groupSource.get(s.eventNo);
 must(g&&cs,'event proof unavailable: '+s.id);
 const a=cs.cp.proposals.filter(x=>x.id===s.id),b=cs.live.proposals.filter(x=>x.id===s.id);
 must(a.length===1&&b.length===1&&sameScannedCandidate(a[0],b[0])&&
  proof.matchOriginal(a[0],s),'original and latest solo scores differ: '+s.id);
 const before=db.results.filter(x=>x.id===s.id),ledger=db.ledger.entries.filter(x=>x.id===s.id);
 if(before.length){
  must(before.length===1&&ledger.length===1&&reviewed.has(s.id)&&
   proof.validateRecord(before[0],ledger[0]),
   'previously published result changed: '+s.id);
  if(pending.has(s.id)){
   must(proof.matchOriginal(pending.get(s.id),s)&&sameScannedCandidate(a[0],pending.get(s.id)),
    'pending record differs from published proof: '+s.id);
   stale.push(s.id);
  }
  already.push(s.id);continue;
 }
 must(ledger.length===0&&!reviewed.has(s.id),'unpublished approval exists: '+s.id);
 const row=pending.get(s.id);
 must(proof.matchOriginal(row,s)&&sameScannedCandidate(a[0],row),
  'pending solo identity or score no longer verified: '+s.id);
 validateOriginal(row,cs.cp,cs.session,cat,db.players);
 must(verifiedPartialPage(row,{end:Date.parse(cs.session.endUtc)},cs.cp),
  'source solo rank not mature and contiguous: '+s.id);
 must(!db.results.some(x=>collision(x,row,db.players.confirmedAliases||{})),
  'same-round or unidentifiable event conflict: '+s.id);
 const {reviewOnly,reviewReason,...clean}=row;
 const newRow={...clean,kind:'予選',round:proof.expectedRound(s),prize:0,
  note:'2024年'+s.date+' NAC Zero Build Solo Victory Cup Round1。'+
   'Epic/Osirionの取得済み連続順位表と本人Epic名・順位・得点・キル・VR・試合数を照合。'+
   '公式2024 NA規則は上位5000名がRound2へ進出（NAの記録はNAC扱い）。'+
   '上位5000の予選突破を確認。Round1賞金$0（Round2の賞金は別途確認）。'+
   '公式規則: '+proof.RULE+' 元順位表: '+s.source+
   ' 元の正常取得ページGit blob: '+g.oldBlob};
 const evidence='source-verified 85; official NA top5000 Zero Build 2024, pinned clean snapshot '+g.oldBlob+
  '; exact Epic solo rank / score, Round1 prize $0';
 const entry={id:s.id,recordId:s.id,policy:proof.POLICY,decision:'published',
  approvedAt:now,approvedBy:'ChatGPT / owner authorized verified bulk review',
  source:s.source,rule:proof.RULE,evidence};
 must(proof.validateRecord(newRow,entry),'new row failed immutable proof check: '+s.id);
 db.results.push(newRow);db.ledger.entries.push(entry);
 db.reviewed.entries.push({id:s.id,decision:'published',recordId:s.id,policy:proof.POLICY,
  source:s.source,rule:proof.RULE,reviewedAt:now});
 added.push({id:s.id,date:s.date,rank:s.rank,player:s.player,kind:'予選',prize:0});
}
const resolved=[...added.map(x=>x.id),...stale];
if(resolved.length){
 db.reviews.history.proposals=proof.removeExact(original,resolved);
 db.reviews.history.manualReviewedAt=now;
 db.statuses.history.found=db.reviews.history.proposals.length;
 db.statuses.history.manualReviewCandidates=db.reviews.history.proposals.length;
 db.statuses.history.reviewOnlyCandidates=db.reviews.history.proposals.filter(x=>x.reviewOnly===true).length;
 db.statuses.history.manuallyPublished=(db.statuses.history.manuallyPublished||0)+added.length;
 db.statuses.history.lastReviewedBatchAt=now;
 db.ledger.reviewedAt=now;db.reviewed.reviewedAt=now;
 if(added.length)upsertPublicationLog(db.updates,{
  id:'verified-s30-nac-zb-solo-round1-85-20261117',
  date:new Date(Date.parse(now)+9*3600e3).toISOString().slice(0,10),
  title:'2024 NAC Zero Build Solo予選の本人確認済み85件を掲載',
  description:'2024年6〜8月の9大会。NA上位5000予選突破のみ記録、予選賞金$0。8/6のAPI未取得順位829位は保留。',
  recordIds:added.map(x=>x.id)
 });
 must(validateData({results:db.results,players:db.players,tournaments:db.tournaments}).errors.length===0,
  'data audit rejected new results');
 must(approvalAudit(db.results,db.ledger,db.players).length===0,
  'approval audit rejected new results');
 must(validateUpdateLog(db.results,db.updates).length===0,
  'update history invalid');
 if(!dry){
  writeReviewDb(ROOT,db);
  fs.writeFileSync(path.join(ROOT,'history-sync-reviewed.json'),JSON.stringify(db.reviewed,null,2)+'\n');
 }
}
console.log('S30_NAC_ZB_SOLO85 '+JSON.stringify({
 mode:dry?'dry-run':'apply',selected:proof.SPECS.length,
 added:added.length,already:already.length,staleResolved:stale.length,
 pending:db.reviews.history.proposals.length,published:db.results.length,prizeAdded:0,
 byDate:Object.fromEntries(proof.GROUPS.map(g=>[g.date,added.filter(s=>s.date===g.date).length]))
}));
