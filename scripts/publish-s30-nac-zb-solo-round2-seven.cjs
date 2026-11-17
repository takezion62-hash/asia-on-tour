'use strict';
// Verify 7 original S30 NAC ZB Solo Round2 wins; reject partial/held/drifted scores.
const fs=require('node:fs'),path=require('node:path');
const {loadReviewDb,writeReviewDb,upsertPublicationLog}=require('./reviewed-publication-core.cjs');
const {validateOriginal,collision}=require('./manual-approval-core.cjs');
const {sameScannedCandidate}=require('./verified-partial-page.cjs');
const {validateData}=require('./data-checks.cjs');
const {audit:approvalAudit}=require('./validate-approvals.cjs');
const {validateUpdateLog}=require('./validate-updates.cjs');
const {isExplicitlyHeld}=require('./generic-review-only-core.cjs');
const proof=require('./verified-s30-nac-zb-solo-round2-seven.cjs');
const ROOT=path.resolve(__dirname,'..'),dry=process.argv.includes('--dry-run');
const must=(v,s)=>{if(!v)throw Error('S30_NAC_R2_SEVEN '+s)};
must(process.argv.length===2||(process.argv.length===3&&dry),'only --dry-run permitted');
const db=loadReviewDb(ROOT);
db.reviewed=JSON.parse(fs.readFileSync(path.join(ROOT,'history-sync-reviewed.json'),'utf8'));
const snap=JSON.parse(fs.readFileSync(path.join(ROOT,proof.SNAPSHOT_PATH),'utf8'));
must(snap.version===1&&snap.source?.repository==='takezion62-hash/asia-on-tour'&&snap.source.scanBlob===proof.SCAN_BLOB&&snap.officialRule===proof.RULE&&snap.groups.length===3&&snap.specs.length===7,'archived original scan proof is missing');
must(JSON.stringify(snap.specs)===JSON.stringify(proof.SPECS)&&JSON.stringify(snap.groups)===JSON.stringify(proof.GROUPS),'pinned source specs changed');
must(proof.SPECS.length===7&&new Set(proof.SPECS.map(s=>s.id)).size===7&&proof.SPECS.every(s=>s.vrs===1&&s.points===100),'not seven 1VR original scores');
const cat=db.tournaments.catalog.find(x=>x.id==='ch5s3-zb-solo-victory');
must(cat&&cat.seasonId==='S30'&&cat.chapter===5&&cat.season===3&&cat.team==='solo'&&cat.mode==='zero-build'&&cat.sourceEventIds?.includes('S30_SoloZBVictoryCashCup'),'official S30 Zero Build event changed');
const groupData=new Map();
for(const g of proof.GROUPS){
 const list=JSON.parse(fs.readFileSync(path.join(ROOT,'calendar-history/'+g.date.slice(0,7)+'.json'),'utf8')).sessions;
 const matches=list.filter(s=>s.dateJst===g.date&&s.region==='NAC'&&s.tournamentId===cat.id&&s.eventId==='S30_SoloZBVictoryCashCup'&&s.sourceWindowId===g.window);
 const cp=db.scans.history.windows[g.key];
 must(matches.length===1&&cp&&cp.complete===true&&cp.rankingOrderValid===true&&cp.pages===45&&cp.nextPage===45&&cp.totalPages===45&&cp.lastSeenRank>=g.rankMax&&cp.emptyAttempts===0&&!cp.lastError&&!cp.lastErrorCode&&!cp.retryAfter&&Array.isArray(cp.proposals),'complete clean 45/45 original scoreboard not retained: '+g.eventNo);
 const end=Date.parse(matches[0].endUtc), observed=Date.parse(cp.lastSuccessAt||'');
 must(Number.isFinite(end)&&Number.isFinite(observed)&&observed-end>4*3600e3,'leaderboard not mature: '+g.eventNo);
 groupData.set(g.eventNo,{cp,session:matches[0]});
}
const original=db.reviews.history.proposals,pending=new Map(original.map(x=>[x.id,x]));
const reviewed=new Set(db.reviewed.entries.map(x=>x.id));
const now=new Date().toISOString(),added=[],already=[],stale=[];
for(const s of proof.SPECS){
 must(!isExplicitlyHeld(s.id),'protected hold: '+s.id);
 const gd=groupData.get(s.eventNo),found=gd?.cp.proposals.filter(x=>x.id===s.id);
 must(found?.length===1&&proof.matchOriginal(found[0],s),'complete ranking row or identity changed: '+s.id);
 const prior=db.results.filter(x=>x.id===s.id),entries=db.ledger.entries.filter(x=>x.id===s.id);
 if(prior.length){
  must(prior.length===1&&entries.length===1&&reviewed.has(s.id)&&proof.validateRecord(prior[0],entries[0]),'previous payout tampered: '+s.id);
  if(pending.has(s.id)){must(proof.matchOriginal(pending.get(s.id),s)&&sameScannedCandidate(found[0],pending.get(s.id)),'stale pending mismatched');stale.push(s.id);}
  already.push(s.id);continue;
 }
 must(entries.length===0&&!reviewed.has(s.id),'orphan approval: '+s.id);
 const row=pending.get(s.id);
 must(proof.matchOriginal(row,s)&&sameScannedCandidate(found[0],row),'pending identity/VR disagrees with complete ranking: '+s.id);
 validateOriginal(row,gd.cp,gd.session,cat,db.players);
 must(!db.results.some(x=>collision(x,row,db.players.confirmedAliases||{})),'duplicate same-event identity: '+s.id);
 const {reviewOnly,reviewReason,...clean}=row;
 const out={...clean,kind:'賞金決勝',prize:100,teamPrize:100,prizePerPlayer:100,
  note:'2024年NAC Zero Build Solo Victory Cup Event'+s.eventNo+' Round2。Epic順位表45/45ページを取得、Epic本人名・順位・キル・VRを照合。公式規則ではRound2の1VRにつき個人賞金$100。1VR=賞金$100。支払完了は未確認。公式規則: '+proof.RULE+' 順位表: '+s.source+' 証拠Git blob: '+proof.SCAN_BLOB};
 const entry={id:s.id,recordId:s.id,decision:'published',policy:proof.POLICY,approvedAt:now,
  approvedBy:'ChatGPT / owner-authorized source-verified approval',source:s.source,rule:proof.RULE,
  evidence:'45-page complete S30 NAC Zero Build Solo R2 Epic source, pinned original Git blob '+proof.SCAN_BLOB+', exact 1VR $100'};
 must(proof.validateRecord(out,entry),'fixed official prize or record failed: '+s.id);
 db.results.push(out);db.ledger.entries.push(entry);
 db.reviewed.entries.push({id:s.id,recordId:s.id,decision:'published',reviewedAt:now,policy:proof.POLICY,source:s.source,rule:proof.RULE});
 added.push({id:s.id,player:s.player,rank:s.rank,prize:100});
}
const ids=[...added.map(s=>s.id),...stale];
if(ids.length){
 db.reviews.history.proposals=proof.removeExact(original,ids);
 db.reviews.history.manualReviewedAt=now;
 db.statuses.history.found=db.reviews.history.proposals.length;
 db.statuses.history.manualReviewCandidates=db.reviews.history.proposals.length;
 db.statuses.history.reviewOnlyCandidates=db.reviews.history.proposals.filter(x=>x.reviewOnly===true).length;
 db.statuses.history.manuallyPublished=(db.statuses.history.manuallyPublished||0)+added.length;
 db.statuses.history.lastReviewedBatchAt=now;db.ledger.reviewedAt=now;db.reviewed.reviewedAt=now;
 if(added.length)upsertPublicationLog(db.updates,{id:'verified-s30-nac-zb-solo-round2-seven-20261117',
  date:new Date(Date.parse(now)+9*3600e3).toISOString().slice(0,10),
  title:'2024 NAC Zero Build Solo決勝7人の各1VR賞金を確認',
  description:'2024年6月4日・7月16日・7月30日の3大会。45/45ページの完全順位表とEpic名を確認、7名それぞれ個人賞金$100。',
  recordIds:added.map(s=>s.id)});
 must(validateData({results:db.results,players:db.players,tournaments:db.tournaments}).errors.length===0,'data audit failed');
 must(approvalAudit(db.results,db.ledger,db.players).length===0,'ledger audit failed');
 must(validateUpdateLog(db.results,db.updates).length===0,'update history audit failed');
 if(!dry){writeReviewDb(ROOT,db);fs.writeFileSync(path.join(ROOT,'history-sync-reviewed.json'),JSON.stringify(db.reviewed,null,2)+'\n');}
}
console.log('S30_NAC_R2_SEVEN '+JSON.stringify({mode:dry?'dry-run':'apply',selected:7,added:added.length,already:already.length,stale:stale.length,newCash:added.length*100,pending:db.reviews.history.proposals.length,addedIds:added.map(x=>x.id)}));
