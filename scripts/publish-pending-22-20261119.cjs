'use strict';
// Manual source audit only: 22 originally observed pending Epic-backed results.
// No missing-page inference, no Round1 prizes, no reclassification of existing cash.
const fs=require('node:fs'),path=require('node:path');
const {loadReviewDb,writeReviewDb,upsertPublicationLog}=require('./reviewed-publication-core.cjs');
const {validateOriginal,collision}=require('./manual-approval-core.cjs');
const {sameScannedCandidate}=require('./verified-partial-page.cjs');
const {validateData,personalCents,roster}=require('./data-checks.cjs');
const {audit}=require('./validate-approvals.cjs');
const {validateUpdateLog}=require('./validate-updates.cjs');
const V=require('./verified-pending-22-20261119.cjs');
const ROOT=path.resolve(__dirname,'..'),dry=process.argv.includes('--dry-run');
const must=(ok,why)=>{if(!ok)throw Error('PUBLISH_PENDING22 '+why)};
function publish({dryRun=dry}={}){
 must(V.validateProof()===true,'frozen leaderboard proof changed');
 const db=loadReviewDb(ROOT);
 db.reviewed=JSON.parse(fs.readFileSync(path.join(ROOT,'history-sync-reviewed.json'),'utf8'));
 const calendar=[...JSON.parse(fs.readFileSync(path.join(ROOT,'calendar-history/2024-07.json'),'utf8')).sessions,
 ...JSON.parse(fs.readFileSync(path.join(ROOT,'calendar-history/2024-08.json'),'utf8')).sessions,
 ...JSON.parse(fs.readFileSync(path.join(ROOT,'calendar-history/2025-09.json'),'utf8')).sessions];
 const existingIds=new Set(db.results.map(x=>x.id)),names=new Set(db.players.candidates.map(x=>x.name));
 const pending=new Map(db.reviews.history.proposals.map(x=>[x.id,x]));
 const reviewedIds=new Set(db.reviewed.entries.map(x=>x.id));
 const before={rows:db.results.length,team:db.results.reduce((n,x)=>n+Math.round((x.prize||0)*100),0),
  individual:db.results.reduce((n,x)=>n+personalCents(x)*roster(x).length,0)};
 const added=[],already=[],cleared=[];
 const now=new Date().toISOString();
 for(let i=0;i<V.CONFIG.length;i++){
  const c=V.CONFIG[i],g=V.SNAP.groups[i];
  const scanned=db.scans.history.windows[g.key];
  const cat=db.tournaments.catalog.find(x=>x.id===c.tournament);
  const rule=JSON.parse(fs.readFileSync(path.join(ROOT,'tournament-rules.json'),'utf8')).rules.find(x=>x.id===c.tournament);
  const session=calendar.find(x=>x.dateJst===c.date&&x.region===c.region&&x.sourceWindowId===c.window&&
   x.eventId===c.event&&x.tournamentId===c.tournament);
  must(cat&&cat.seasonId===c.season&&cat.team===(c.team===2?'duo':'solo')&&
   cat.sourceEventIds.includes(c.event)&&rule&&rule.source===V.RULES[c.season]&&
   rule.matchCaps['予選']===7&&rule.matchCaps['賞金決勝']===3&&session,
   'event calendar or official rule not confirmed '+g.key);
  if(c.season==='S37')must(rule.advance[c.region]===250&&rule.teamPrizePerVictory===200&&
   rule.prizePerVictory===100,'duo finals official payout/cutoff changed');
  else must(rule.seasonId==='S30'&&rule.team==='solo'&&rule.eventIds.includes(c.event)&&c.region==='NAC'&&
   !Object.prototype.hasOwnProperty.call(rule.advance||{},'NAC'),
   'legacy NA top5000 is verified against the 2024 Epic rule itself, not an invented NAC master field');
  must(scanned&&scanned.rankingOrderValid===true&&scanned.pages>=g.checkpoint.pages&&
   scanned.lastSeenRank>=g.checkpoint.lastSeenRank&&Array.isArray(scanned.proposals)&&
   (c.complete?scanned.complete===true&&scanned.pages===scanned.totalPages:true),
   'source checkpoint no longer contains the audited original pages '+g.key);
  for(const original of g.targetRows){
   const pre=db.results.filter(x=>x.id===original.id),entries=db.ledger.entries.filter(x=>x.id===original.id);
   const pendingRow=pending.get(original.id),scannedRows=scanned.proposals.filter(x=>x.id===original.id);
   // If a newer scanner no longer includes the original identity, hold for manual review.
   must(scannedRows.length===1&&sameScannedCandidate(scannedRows[0],original),
    'latest observed Epic scoreboard changed '+original.id);
   if(pre.length){
    must(pre.length===1&&entries.length===1&&V.verifyPublished(pre[0],entries[0])&&
     reviewedIds.has(original.id),'already published score was mutated '+original.id);
    if(pendingRow){
     must(sameScannedCandidate(pendingRow,original),'stale pending record differs '+original.id);
     cleared.push(original.id);
    }
    already.push(original.id);continue;
   }
   must(!existingIds.has(original.id)&&entries.length===0&&!reviewedIds.has(original.id)&&
    pendingRow&&sameScannedCandidate(pendingRow,original),'unapproved or missing pending candidate '+original.id);
   must((original.players||[original.player]).every(name=>names.has(name)),'unverified existing player '+original.id);
   validateOriginal(original,scanned,session,cat,db.players);
   const row=V.publish(original),approval=V.approval(original);
   must(V.verifyPublished(row,approval),'frozen result audit failed '+original.id);
   must(!db.results.some(x=>collision(x,row,db.players.confirmedAliases||{})),
    'same player same event and round already published '+original.id);
   db.results.push(row);db.ledger.entries.push(approval);
   db.reviewed.entries.push({id:original.id,decision:'published',recordId:original.id,policy:V.POLICY,
    source:original.source,rule:V.RULES[c.season],reviewedAt:now});
   existingIds.add(original.id);added.push(row);cleared.push(original.id);
  }
 }
 must(added.length+already.length===22&&(added.length===0||added.length===22),
  'batch must be all 22 or already fully published');
 must(db.results.length===before.rows+added.length&&
  db.results.reduce((n,x)=>n+Math.round((x.prize||0)*100),0)===before.team&&
  db.results.reduce((n,x)=>n+personalCents(x)*roster(x).length,0)===before.individual,
  'existing or new cash changed');
 if(cleared.length){
  const resolved=new Set(cleared);
  db.reviews.history.proposals=db.reviews.history.proposals.filter(x=>!resolved.has(x.id));
  db.reviews.history.manualReviewedAt=now;
  db.statuses.history.found=db.reviews.history.proposals.length;
  db.statuses.history.manualReviewCandidates=db.reviews.history.proposals.length;
  db.statuses.history.reviewOnlyCandidates=db.reviews.history.proposals.filter(x=>x.reviewOnly===true).length;
  db.statuses.history.manuallyPublished=(db.statuses.history.manuallyPublished||0)+added.length;
  db.statuses.history.lastReviewedBatchAt=now;
  db.ledger.reviewedAt=now;db.reviewed.reviewedAt=now;
 }
 if(added.length){
  upsertPublicationLog(db.updates,{
   id:'manual-source-observed-pending22-20261119',date:'2026-11-19',
   title:'元のEpic順位表で確認したConsole決勝7件・NACソロ予選15件を掲載',
   description:'2025 S37 NAW/OCE Console Duos決勝の全3ページ取得済み7チーム0VR/チーム賞金$0。2024 S30 NACソロの取得済み連続順位表ページに載る15名を登録。Epic公式NA上位5000位突破条件でZB 12名が予選突破、ZB 1名・通常BR 2名は参加確認。未取得ページと他大会賞金は推定せず、既存決勝戦績・個人賞金は不変。',
   recordIds:added.map(x=>x.id)
  });
  // Old competition evidence can be newly published after later-dated reports.
  db.updates.entries.sort((a,b)=>b.date.localeCompare(a.date));
 }
 must(validateData({results:db.results,players:db.players,tournaments:db.tournaments}).errors.length===0,
  'schema and count validation failed');
 const approvalErrors=audit(db.results,db.ledger,db.players);
 must(!approvalErrors.length,'approved result audit '+JSON.stringify(approvalErrors.slice(0,5)));
 const updateErrors=validateUpdateLog(db.results,db.updates);
 must(!updateErrors.length,'publication history audit '+JSON.stringify(updateErrors.slice(0,5)));
 if(!dryRun&&cleared.length){
  writeReviewDb(ROOT,db);
  fs.writeFileSync(path.join(ROOT,'history-sync-reviewed.json'),JSON.stringify(db.reviewed,null,2)+'\n');
 }
 const summary={dryRun,selected:22,added:added.length,already:already.length,cleared:cleared.length,
  prior:before.rows,now:db.results.length,newCash:0,qualifiers:added.filter(x=>x.kind==='予選').length,
  attendance:added.filter(x=>x.kind==='参加確認').length,finalZero:added.filter(x=>x.kind==='賞金決勝').length,
  pendingBefore:pending.size,pendingAfter:db.reviews.history.proposals.length,
  ids:added.map(x=>x.id)};
 console.log('PUBLISH_PENDING22 '+JSON.stringify(summary));
 return summary;
}
if(require.main===module)try{
 const args=process.argv.slice(2);must(args.length===0||(args.length===1&&args[0]==='--dry-run'),
  'usage: [--dry-run]');
 publish({dryRun:args.includes('--dry-run')});
}catch(e){console.error(e.stack);process.exitCode=1;}
module.exports={publish};
