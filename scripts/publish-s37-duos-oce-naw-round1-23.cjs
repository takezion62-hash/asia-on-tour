'use strict';
// Exactly 23 frozen Round 1 duo results, each proven by saved Epic ranking.
// OCE: 21/21 complete. NAW: verified mature first 2/52 pages. Cash: $0.
// Safe under newer scans, duplicate runs and earlier-source API transient failures.
const fs=require('node:fs'),path=require('node:path');
const {loadReviewDb,writeReviewDb,upsertPublicationLog}=require('./reviewed-publication-core.cjs');
const {validateOriginal,collision}=require('./manual-approval-core.cjs');
const {verifiedPartialPage,sameScannedCandidate}=require('./verified-partial-page.cjs');
const {validateData}=require('./data-checks.cjs');
const {audit:approvalAudit}=require('./validate-approvals.cjs');
const {validateUpdateLog}=require('./validate-updates.cjs');
const {isExplicitlyHeld}=require('./generic-review-only-core.cjs');
const proof=require('./verified-s37-duos-oce-naw-round1-23.cjs');
const ROOT=path.resolve(__dirname,'..');
const dry=process.argv.includes('--dry-run');
if(process.argv.length>3||(process.argv.length===3&&!dry))
 throw Error('S37_DUOS_ROUND1_23 --dry-run or no arguments only');
function requireValid(ok,reason){if(!ok)throw Error('S37_DUOS_ROUND1_23 '+reason)}
const db=loadReviewDb(ROOT);
db.reviewed=JSON.parse(fs.readFileSync(path.join(ROOT,'history-sync-reviewed.json'),'utf8'));
const archive=JSON.parse(fs.readFileSync(path.join(ROOT,
 'data/manual-approvals/s37-oce-event7-naw-event9-round1-23-checkpoints-20261117.json'),'utf8'));
requireValid(archive.version===1&&archive.provenance?.repo==='takezion62-hash/asia-on-tour'&&
 archive.provenance.commit===proof.SCAN_COMMIT&&archive.provenance.scanBlob===proof.SCAN_BLOB&&
 Array.isArray(archive.checkpoints)&&archive.checkpoints.length===2,
 'snapshot provenance is not original frozen Git scan');
requireValid(proof.SPECS.length===23&&new Set(proof.SPECS.map(x=>x.id)).size===23&&
 proof.GROUPS.length===2,'unexpected batch proof manifest');
const sessions=JSON.parse(fs.readFileSync(path.join(ROOT,'calendar-history/2025-10.json'),'utf8')).sessions;
const catalogs=new Map(db.tournaments.catalog.map(x=>[x.id,x]));
const catalog=catalogs.get('ch6s4-console-duos-victory');
requireValid(!!catalog&&catalog.seasonId==='S37'&&catalog.name==='Duos Console Victory Cash Cup'&&
 catalog.team==='duo'&&catalog.sourceEventIds?.includes(proof.EVENT),
 'official tournament catalog changed');
const checkpoints=new Map();
for(const g of proof.GROUPS){
 const list=archive.checkpoints.filter(x=>x.key===g.key);
 requireValid(list.length===1,'missing or duplicated original scan checkpoint: '+g.region);
 const cp=list[0].checkpoint, live=db.scans.history.windows[g.key];
 const sessionList=sessions.filter(x=>x.sourceWindowId===g.win&&x.region===g.region&&
  x.eventId===proof.EVENT&&x.dateJst===g.date&&x.tournamentId===catalog.id);
 requireValid(sessionList.length===1,'official event session missing or duplicated: '+g.region);
 const session=sessionList[0],end=Date.parse(session.endUtc),observed=Date.parse(cp?.lastSuccessAt||'');
 requireValid(cp&&cp.rankingOrderValid===true&&cp.complete===(g.mode==='complete')&&
  cp.pages===g.pages&&cp.totalPages===g.totalPages&&cp.nextPage===cp.pages&&
  cp.lastSeenRank===g.lastSeenRank&&cp.lastSuccessAt===g.lastSuccessAt&&
  cp.emptyAttempts===0&&!cp.lastError&&!cp.lastErrorCode&&!cp.retryAfter&&
  Array.isArray(cp.proposals)&&Number.isFinite(end)&&Number.isFinite(observed)&&
  observed-end>4*3600000,
  'archived proof pages not mature, contiguous, complete/partial as declared: '+g.region);
 requireValid(g.mode==='complete'?cp.pages===cp.totalPages:cp.totalPages>cp.pages,
  'archived page count contradicts completeness: '+g.region);
 const specs=proof.SPECS.filter(x=>x.region===g.region);
 requireValid(specs.length===g.expected&&specs.every(x=>x.date===g.date&&x.rank<=cp.lastSeenRank),
  'proof manifest exceeds originally scanned ranks: '+g.region);
 requireValid(live&&live.rankingOrderValid===true&&
  Number.isSafeInteger(live.pages)&&live.pages>=cp.pages&&
  live.nextPage===live.pages&&live.totalPages>=live.pages&&
  live.lastSeenRank>=cp.lastSeenRank&&live.emptyAttempts===0&&
  Array.isArray(live.proposals)&&Date.parse(live.lastSuccessAt)>=observed,
  'live checkpoint no longer preserves original verified rows: '+g.region);
 if(live.lastError||live.lastErrorCode||live.retryAfter){
  requireValid(live.complete===false&&live.lastErrorCode==='OSIRION_TRANSIENT'&&
   Number.isSafeInteger(live.lastErrorPage)&&live.lastErrorPage===live.nextPage&&
   live.lastErrorPage>=cp.pages,
   'only API error on unscanned later page may be ignored: '+g.region);
 }
 // Final scoreboard is a separate phase; a prior Round 2 result never
 // proves Round 1 cash, and none is invented here.
 checkpoints.set(g.region,{cp,live,session,end,g});
}
const pendingHistory=db.reviews.history.proposals;
const pending=new Map(pendingHistory.map(x=>[x.id,x]));
const reviewed=new Set(db.reviewed.entries.map(x=>x.id));
const now=new Date().toISOString(),added=[],already=[],stale=[];
for(const spec of proof.SPECS){
 const ctx=checkpoints.get(spec.region),{cp,live,session,end,g}=ctx;
 requireValid(!isExplicitlyHeld(spec.id),'manually held candidate excluded: '+spec.id);
 const old=db.results.filter(x=>x.id===spec.id);
 const approvals=db.ledger.entries.filter(x=>x.id===spec.id);
 if(old.length){
  requireValid(old.length===1&&approvals.length===1&&reviewed.has(spec.id)&&
   proof.validatedRecord(old[0],approvals[0]),
   'published result or approval proof changed: '+spec.id);
  if(pending.has(spec.id)){
   const row=pending.get(spec.id);
   requireValid(proof.matchesOriginal(row,spec)&&
    cp.proposals.filter(x=>sameScannedCandidate(x,row)).length===1&&
    live.proposals.filter(x=>sameScannedCandidate(x,row)).length===1,
    'stale review entry conflicts with published original proof: '+spec.id);
   stale.push(spec.id);
  }
  already.push(spec.id);
  continue;
 }
 requireValid(approvals.length===0&&!reviewed.has(spec.id),
  'unpublished candidate has an approval already: '+spec.id);
 const row=pending.get(spec.id);
 requireValid(proof.matchesOriginal(row,spec),'frozen candidate identity, rank or stats changed: '+spec.id);
 requireValid(cp.proposals.filter(x=>sameScannedCandidate(x,row)).length===1&&
  live.proposals.filter(x=>sameScannedCandidate(x,row)).length===1,
  'original/live Epic rankings do not exactly match: '+spec.id);
 if(cp.complete!==true)requireValid(verifiedPartialPage(row,{end},cp),
  'partial page evidence not mature or contiguous: '+spec.id);
 validateOriginal(row,cp,session,catalog,db.players);
 requireValid(!db.results.some(x=>collision(x,row,db.players.confirmedAliases||{})),
  'record collision with existing result: '+spec.id);
 const {reviewOnly,reviewReason,...clean}=row;
 const record={...clean,kind:proof.expectedKind(spec),round:proof.expectedRound(spec),
  prize:0,note:g.date+' '+g.region+' Duos Console Victory Cash Cup Event '+g.eventNum+
   ' Round 1。保存済みEpic順位表で本人・チーム・順位・キル・VR・試合数を一致確認。'+
   (g.mode==='complete'?'順位表21/21ページ取得済み。':'正常取得済み2/52ページの対象順位を照合（残り未取得）。')+
   '公式ルールではOCEとNAWの上位250チームがRound 2へ進出。'+
   (spec.rank<=proof.CUTOFF?'上位250の予選突破。':'上位250外の参加確認。')+
   'Round 1現金賞金$0。決勝の賞金は推定しない。'+
   '公式規則: '+proof.RULE+' 順位表: '+proof.sourceFor(g)+
   ' 保存証拠Git blob: '+proof.SCAN_BLOB};
 const evidence='verified contiguous original pages, saved scan blob '+proof.SCAN_BLOB+
  '; exact Epic pair identity, rank and scores; '+g.pages+'/'+g.totalPages+
  ' pages; top 250 official rules, no Round1 cash';
 const approval={id:spec.id,decision:'published',recordId:spec.id,policy:proof.POLICY,
  approvedAt:now,approvedBy:'ChatGPT / owner authorized verified large review batch',
  source:proof.sourceFor(g),rule:proof.RULE,evidence};
 requireValid(proof.validatedRecord(record,approval),'publication proof check failed: '+spec.id);
 db.results.push(record);
 db.ledger.entries.push(approval);
 db.reviewed.entries.push({id:spec.id,decision:'published',recordId:spec.id,
  reviewedAt:now,policy:proof.POLICY,rule:proof.RULE,source:proof.sourceFor(g)});
 added.push({id:spec.id,rank:spec.rank,player:spec.player,region:spec.region,kind:record.kind,prize:0});
}
const ids=[...added.map(x=>x.id),...stale];
if(ids.length){
 db.reviews.history.proposals=proof.removeResolvedPending(pendingHistory,ids);
 db.reviews.history.manualReviewedAt=now;
 db.statuses.history.found=db.reviews.history.proposals.length;
 db.statuses.history.manualReviewCandidates=db.reviews.history.proposals.length;
 db.statuses.history.reviewOnlyCandidates=db.reviews.history.proposals.filter(x=>x.reviewOnly===true).length;
 db.statuses.history.manuallyPublished=(db.statuses.history.manuallyPublished||0)+added.length;
 db.statuses.history.lastReviewedBatchAt=now;
 db.ledger.reviewedAt=now;db.reviewed.reviewedAt=now;
 if(added.length){
  const date=new Date(Date.parse(now)+9*3600000).toISOString().slice(0,10);
  upsertPublicationLog(db.updates,{
   id:'verified-s37-duos-oce-naw-round1-23-20261117',date,
   title:'S37 Console Duos OCE/NAW予選23件を確認掲載',
   description:'2025-10-04 OCE 13件（全21ページ確認）、2025-10-19 NAW 10件（取得済み2ページ確認）。予選突破14件・参加確認9件、賞金追加$0。',
   recordIds:added.map(x=>x.id)
  });
 }
 requireValid(validateData({results:db.results,players:db.players,tournaments:db.tournaments}).errors.length===0,
  'data audit errors after reviewed publication');
 requireValid(approvalAudit(db.results,db.ledger,db.players).length===0,
  'approval ledger audit errors after reviewed publication');
 requireValid(validateUpdateLog(db.results,db.updates).length===0,
  'update history audit errors after reviewed publication');
 if(!dry){
  writeReviewDb(ROOT,db);
  fs.writeFileSync(path.join(ROOT,'history-sync-reviewed.json'),JSON.stringify(db.reviewed,null,2)+'\n');
 }
}
console.log('S37_DUOS_ROUND1_23 '+JSON.stringify({mode:dry?'dry-run':'apply',selected:proof.SPECS.length,
 added:added.length,already:already.length,staleResolved:stale.length,
 qualifiers:added.filter(x=>x.kind==='予選').length,attendees:added.filter(x=>x.kind==='参加確認').length,
 afterResults:db.results.length,remainingPending:db.reviews.history.proposals.length,
 newCash:0,recordIds:added.map(x=>x.id)}));
