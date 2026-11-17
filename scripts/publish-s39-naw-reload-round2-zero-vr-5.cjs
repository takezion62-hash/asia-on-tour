'use strict';
// Five original, full-source-verified Chapter 7 Season 1 Reload Duo finals.
// No VR in Round2 => no award. Leave all other event awards unchanged.
const fs=require('node:fs'),path=require('node:path');
const {loadReviewDb,writeReviewDb,upsertPublicationLog}=require('./reviewed-publication-core.cjs');
const {validateOriginal,collision}=require('./manual-approval-core.cjs');
const {sameScannedCandidate}=require('./verified-partial-page.cjs');
const {validateData}=require('./data-checks.cjs');
const {audit:approvalAudit}=require('./validate-approvals.cjs');
const {validateUpdateLog}=require('./validate-updates.cjs');
const {isExplicitlyHeld}=require('./generic-review-only-core.cjs');
const proof=require('./verified-s39-naw-reload-round2-zero-vr-5.cjs');
const ROOT=path.resolve(__dirname,'..'),dry=process.argv.includes('--dry-run');
const need=(v,why)=>{if(!v)throw Error('S39_RELOAD_ZERO5 '+why)};
need(process.argv.length===2||process.argv.length===3&&dry,'only --dry-run allowed');
const db=loadReviewDb(ROOT),snapshot=JSON.parse(fs.readFileSync(path.join(ROOT,proof.SNAPSHOT_PATH),'utf8'));
db.reviewed=JSON.parse(fs.readFileSync(path.join(ROOT,'history-sync-reviewed.json'),'utf8'));
const catalog=db.tournaments.catalog.find(x=>x.id==='ch7s1-reload-duos-victory');
need(catalog&&catalog.seasonId==='S39'&&catalog.chapter===7&&catalog.season===1&&
 catalog.team==='duo'&&catalog.mode==='reload'&&
 catalog.sourceEventIds?.includes('S39_ReloadCashVictoryCup_Dec'),'Reload tournament master differs');
const sessions=JSON.parse(fs.readFileSync(path.join(ROOT,'calendar-history/2025-12.json'),'utf8')).sessions;
need(snapshot.version===1&&snapshot.source?.blobSha===proof.SOURCE_BLOB&&
 snapshot.source.repository==='takezion62-hash/asia-on-tour'&&
 Array.isArray(snapshot.windows)&&snapshot.windows.length===2,'saved full ranking provenance missing');
const groups=new Map();
for(const g of proof.GROUPS){
 const archived=snapshot.windows.find(x=>x.key===g.key),cp=archived?.checkpoint,
 live=db.scans.history.windows[g.key],session=sessions.find(x=>x.sourceWindowId===g.window&&
  x.dateJst===g.date&&x.region==='NAW'&&x.tournamentId===catalog.id&&
  x.eventId==='S39_ReloadCashVictoryCup_Dec');
 need(archived&&cp&&live&&session&&archived.date===g.date&&archived.eventNo===g.eventNo&&
  archived.sessionEndUtc===session.endUtc&&
  cp.complete===true&&cp.rankingOrderValid===true&&cp.pages===cp.totalPages&&
  cp.nextPage===cp.pages&&cp.pages===g.pages&&cp.emptyAttempts===0&&
  !cp.lastError&&!cp.lastErrorCode&&!cp.retryAfter&&
  Array.isArray(cp.proposals)&&cp.proposals.length>=g.count&&
  Date.parse(cp.lastSuccessAt)-Date.parse(session.endUtc)>4*3600e3,
  'saved complete Reload rank not mature: '+g.key);
 need(live.complete===true&&live.rankingOrderValid===true&&
  live.pages===live.totalPages&&live.pages===cp.pages&&live.nextPage===live.pages&&
  live.lastSeenRank===cp.lastSeenRank&&live.emptyAttempts===0&&
  !live.lastError&&!live.lastErrorCode&&!live.retryAfter&&
  Array.isArray(live.proposals),'latest Reload full board differs: '+g.key);
 groups.set(g.key,{cp,live,session});
}
need(proof.SPECS.length===5&&new Set(proof.SPECS.map(x=>x.id)).size===5,'five unique 0VR finals required');
const original=db.reviews.history.proposals,pending=new Map(original.map(x=>[x.id,x]));
const reviewed=new Set(db.reviewed.entries.map(x=>x.id));
const now=new Date().toISOString(),added=[],already=[],stale=[];
for(const s of proof.SPECS){
 need(!isExplicitlyHeld(s.id),'explicit hold overrides this batch: '+s.id);
 const g=proof.groupOf(s),store=groups.get(g?.key);
 need(g&&store,'saved verified original missing: '+s.id);
 const cp=store.cp.proposals.filter(x=>x.id===s.id),live=store.live.proposals.filter(x=>x.id===s.id);
 need(cp.length===1&&live.length===1&&sameScannedCandidate(cp[0],live[0])&&
  proof.matchOriginal(cp[0],s),'original Epic finalist data changed: '+s.id);
 const old=db.results.filter(x=>x.id===s.id),entries=db.ledger.entries.filter(x=>x.id===s.id);
 if(old.length){
  need(old.length===1&&entries.length===1&&reviewed.has(s.id)&&
   proof.validateRecord(old[0],entries[0]),'existing published Replay result conflicts: '+s.id);
  if(pending.has(s.id)){
   need(proof.matchOriginal(pending.get(s.id),s)&&sameScannedCandidate(cp[0],pending.get(s.id)),
    'published but pending rank or pair no longer matches: '+s.id);
   stale.push(s.id);
  }
  already.push(s.id);continue;
 }
 need(entries.length===0&&!reviewed.has(s.id),'unpublished approval exists: '+s.id);
 const row=pending.get(s.id);
 need(proof.matchOriginal(row,s)&&sameScannedCandidate(cp[0],row),'source candidate changed: '+s.id);
 validateOriginal(row,store.cp,store.session,catalog,db.players);
 need(!db.results.some(x=>collision(x,row,db.players.confirmedAliases||{})),
  'duplicate / unresolved event stage: '+s.id);
 const {reviewReason,reviewOnly,...clean}=row;
 const record={...clean,prize:0,kind:'賞金決勝',round:proof.originalRound(s),
  note:s.date+' NAW Reload Duos Victory Cup Round2決勝。公式Osirion/Epic全2ページで'+
   '本人Epic名・ペア・順位・試合・キル・0VRを確認。公式Ch7S1規則では'+
   '決勝VRにつき各選手$100のため0VRの賞金$0。'+
   '公式規則: '+proof.RULE+' 公式順位表: '+s.source+
   ' 検証済みGit blob: '+proof.SOURCE_BLOB};
 const evidence='S39 Reload verified 5 source full 2/2 leaderboard, original zero-VR pairs, blob '+proof.SOURCE_BLOB+
  ' and Round2 award $0 under Epic official rules';
 const entry={id:s.id,recordId:s.id,policy:proof.POLICY,decision:'published',
  approvedAt:now,approvedBy:'ChatGPT / user authorized source-verified 0VR batch',
  source:s.source,rule:proof.RULE,evidence};
 need(proof.validateRecord(record,entry),'S39 zero-VR immutable proof mismatch '+s.id);
 db.results.push(record);db.ledger.entries.push(entry);
 db.reviewed.entries.push({id:s.id,decision:'published',recordId:s.id,policy:proof.POLICY,
  source:s.source,rule:proof.RULE,reviewedAt:now});
 added.push({id:s.id,date:s.date,player:s.player,rank:s.rank,vrs:0,prize:0});
}
const resolved=[...added.map(x=>x.id),...stale];
if(resolved.length){
 db.reviews.history.proposals=proof.removeExact(original,resolved);
 db.reviews.history.manualReviewedAt=now;
 db.statuses.history.found=db.reviews.history.proposals.length;
 db.statuses.history.manualReviewCandidates=db.reviews.history.proposals.length;
 db.statuses.history.reviewOnlyCandidates=db.reviews.history.proposals.filter(x=>x.reviewOnly===true).length;
 db.statuses.history.manuallyPublished=(db.statuses.history.manuallyPublished||0)+added.length;
 db.statuses.history.lastReviewedBatchAt=now;db.ledger.reviewedAt=now;db.reviewed.reviewedAt=now;
 if(added.length)upsertPublicationLog(db.updates,{
  id:'verified-s39-naw-reload-duos-zero-vr-5-20261117',
  date:new Date(Date.parse(now)+9*3600e3).toISOString().slice(0,10),
  title:'2025年12月NAW Reload Duos賞金決勝0VRの5チームを掲載',
  description:'全ページ取得済みのNAW Reload Duos決勝2開催枠、公式規則と本人を照合し5組0VR・賞金$0と確認。',
  recordIds:added.map(x=>x.id)
 });
 need(validateData({results:db.results,players:db.players,tournaments:db.tournaments}).errors.length===0,'data audit failed');
 need(approvalAudit(db.results,db.ledger,db.players).length===0,'approval audit failed');
 need(validateUpdateLog(db.results,db.updates).length===0,'update history audit failed');
 if(!dry){
  writeReviewDb(ROOT,db);
  fs.writeFileSync(path.join(ROOT,'history-sync-reviewed.json'),JSON.stringify(db.reviewed,null,2)+'\n');
 }
}
console.log('S39_RELOAD_ZERO5 '+JSON.stringify({mode:dry?'dry-run':'apply',selected:5,published:added.length,already:already.length,staleResolved:stale.length,pending:db.reviews.history.proposals.length,results:db.results.length,extraCash:0,added}));
