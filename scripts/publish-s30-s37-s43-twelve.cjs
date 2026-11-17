'use strict';
// A locked twelve-row recovery from six mature, contiguous, previously CLEAN
// historical Epic leaderboards. Later HTTP429 on UNSCANNED pages is not a
// reason to discard the archived prefix; changed names, scores or VRs fail.
const fs=require('node:fs'),path=require('node:path');
const {loadReviewDb,writeReviewDb,upsertPublicationLog}=require('./reviewed-publication-core.cjs');
const {validateOriginal,collision}=require('./manual-approval-core.cjs');
const {sameScannedCandidate}=require('./verified-partial-page.cjs');
const {isExplicitlyHeld}=require('./generic-review-only-core.cjs');
const {validateData,personalCents,roster}=require('./data-checks.cjs');
const {audit:approvalAudit}=require('./validate-approvals.cjs');
const {validateUpdateLog}=require('./validate-updates.cjs');
const proof=require('./verified-s30-s37-s43-twelve.cjs');
const ROOT=path.resolve(__dirname,'..'),dry=process.argv.includes('--dry-run');
const must=(ok,why)=>{if(!ok)throw Error('TWELVE_RECOVERY '+why);};
must(process.argv.length===2||(process.argv.length===3&&dry),'only --dry-run');
const db=loadReviewDb(ROOT);
db.reviewed=JSON.parse(fs.readFileSync(path.join(ROOT,'history-sync-reviewed.json'),'utf8'));
const cats=new Map(db.tournaments.catalog.map(x=>[x.id,x]));
const byTag=new Map();
for(const g of proof.GROUPS){
 const cp=g.checkpoint,related=proof.SPECS.filter(x=>x.group===g.tag);
 must(related.length===g.ids.length&&related.every(x=>g.ids.includes(x.id))&&
   related.every(x=>x.source.includes(g.key.split('/')[1]))&&
   new Set(g.ids).size===g.ids.length,'group source whitelist mismatch: '+g.tag);
 must(cp&&Number.isSafeInteger(cp.pages)&&cp.pages>=2&&
  cp.nextPage===cp.pages&&Number.isSafeInteger(cp.totalPages)&&cp.totalPages>cp.pages&&
  cp.lastSeenRank>=Math.max(...related.map(x=>x.rank))&&
  cp.rankingOrderValid===true&&cp.emptyAttempts===0&&
  !cp.lastError&&!cp.lastErrorCode&&!cp.retryAfter&&
  Array.isArray(cp.proposals),'archived original leaderboard is not a clean prefix: '+g.tag);
 // S43 provider marks a coverage-limited 2/43-page scan as complete.
 // This is NOT a full leaderboard. Require its exact saved first two pages.
 if(g.tag==='S43R1')must(cp.complete===true&&cp.pages===2&&cp.totalPages===43&&
  cp.lastSeenRank===200&&g.mode==='qualifier'&&g.cutoff===120,
  'S43 must be the exact original observed top200 source, not an assumed complete scan');
 else must(cp.complete===false,'non-S43 archive wrongly claims full scan: '+g.tag);
 const live=db.scans.history.windows[g.key];
 must(live&&live.rankingOrderValid===true&&live.pages>=cp.pages&&
   live.nextPage===live.pages&&live.totalPages>=live.pages&&
   live.lastSeenRank>=cp.lastSeenRank&&live.emptyAttempts===0&&
   Array.isArray(live.proposals)&&
   Date.parse(live.lastSuccessAt)>=Date.parse(cp.lastSuccessAt),
   'latest leaderboard does not preserve archived observed prefix: '+g.tag);
 if(live.lastError||live.lastErrorCode||live.retryAfter)
   must(live.complete===false&&live.lastErrorCode==='OSIRION_TRANSIENT'&&
     Number.isSafeInteger(live.lastErrorPage)&&live.lastErrorPage===live.nextPage&&
     live.lastErrorPage>=cp.pages,
     'only an HTTP transient on a LATER unscanned page can be tolerated: '+g.tag);
 const item=related[0];
 const calendar=JSON.parse(fs.readFileSync(path.join(ROOT,'calendar-history/'+item.date.slice(0,7)+'.json'),'utf8')).sessions;
 const sessions=calendar.filter(x=>x.dateJst===item.date&&x.region===item.region&&
   x.sourceWindowId===item.windowId&&x.eventId===item.eventId&&x.tournamentId===item.tournamentId&&
   x.seasonId===item.seasonId);
 must(sessions.length===1,'official calendar window missing: '+g.tag);
 const end=Date.parse(sessions[0].endUtc),observed=Date.parse(cp.lastSuccessAt);
 must(Number.isFinite(end)&&Number.isFinite(observed)&&observed-end>=4*3600*1000&&
   observed<=Date.now()+5*60000,'source scan not mature or from the future: '+g.tag);
 byTag.set(g.tag,{cp,live,session:sessions[0],end});
}
const pendingRows=db.reviews.history.proposals,pending=new Map(pendingRows.map(x=>[x.id,x]));
const reviewed=new Set(db.reviewed.entries.map(x=>x.id));
const oldPersonal=db.results.reduce((sum,r)=>sum+personalCents(r)*roster(r).length,0);
const now=new Date().toISOString(),added=[],stale=[],already=[];
for(const s of proof.SPECS){
 must(!isExplicitlyHeld(s.id),'explicitly held record cannot publish: '+s.id);
 const g=proof.GROUPS.find(x=>x.tag===s.group), ctx=byTag.get(s.group);
 must(g&&ctx,'group evidence missing: '+s.id);
 const old=ctx.cp.proposals.filter(x=>x.id===s.id),live=ctx.live.proposals.filter(x=>x.id===s.id);
 must(old.length===1&&live.length===1&&proof.matchesOriginal(old[0],s)&&
  sameScannedCandidate(old[0],live[0]),'original Epic identity/rank/VR not preserved: '+s.id);
 const cat=cats.get(s.tournamentId);
 must(cat&&cat.name===s.event&&cat.seasonId===s.seasonId&&
  cat.sourceEventIds?.includes(s.eventId),'tournament catalog changed: '+s.id);
 if(s.seasonId==='S30')must(cat.team==='solo'&&cat.mode==='zero-build'&&
  (s.mode==='cash'?(s.kind==='賞金決勝'&&s.vrs===1&&s.points===100&&s.matches<=3):
   (s.mode==='qualifier'&&s.kind==='予選'&&s.rank<=5000&&s.prize===0&&s.matches<=7)),
  'S30 cash/qualifier source contract changed: '+s.id);
 else if(s.seasonId==='S37')must(cat.team==='duo'&&s.mode==='participation'&&
  s.kind==='予選'&&s.rank>250&&s.prize===0&&s.matches<=7,
  'S37 NAW duo above top250 cutoff is attendance only: '+s.id);
 else if(s.seasonId==='S43')must(cat.team==='squad'&&s.mode==='qualifier'&&
  s.kind==='予選'&&s.rank<=120&&s.prize===0&&s.matches<=8&&
  s.players.length===4,'S43 NAW top120 squad qualifier invalid: '+s.id);
 else throw Error('TWELVE_RECOVERY unknown season: '+s.seasonId);
 const before=db.results.filter(x=>x.id===s.id),ledger=db.ledger.entries.filter(x=>x.id===s.id);
 if(before.length){
  must(before.length===1&&ledger.length===1&&reviewed.has(s.id)&&
    proof.validateRecord(before[0],ledger[0]),'published result/prize mutated: '+s.id);
  if(pending.has(s.id)){
   must(proof.matchesOriginal(pending.get(s.id),s)&&
    sameScannedCandidate(old[0],pending.get(s.id)),
    'pending duplicate no longer matches source: '+s.id);
   stale.push(s.id);
  }
  already.push(s.id);continue;
 }
 must(ledger.length===0&&!reviewed.has(s.id),'unpublished approval exists: '+s.id);
 const row=pending.get(s.id);
 must(proof.matchesOriginal(row,s)&&sameScannedCandidate(old[0],row),
  'unpublished candidate differs from original Epic evidence: '+s.id);
 validateOriginal(row,ctx.cp,ctx.session,cat,db.players);
 must(!db.results.some(r=>collision(r,row,db.players.confirmedAliases||{})),
  'same-event/same-player duplicate detected: '+s.id);
 const target=proof.expected(s),rule=proof.RULES[s.seasonId];
 const {reviewReason,reviewOnly,...clean}=row;
 const msg=s.mode==='cash'?
  'Epic決勝の1VRを確認し公式規則により個人賞金$100。支払いの完了は未確認。':
  s.seasonId==='S37'?
  'NAW公式上位250チームの突破圏外。予選参加確認のみ、賞金$0。':
  '公式予選通過基準の上位'+g.cutoff+'位以内。予選突破を確認、賞金$0。';
 const record={...clean,kind:target.kind,round:target.round,prize:target.prize,
  note:'元の正常な連続順位表'+ctx.cp.pages+'/'+ctx.cp.totalPages+
   'ページのEpic本人名・順位・キル・VR・試合数を照合。'+msg+
   (s.seasonId==='S43'?' S43は上位200位までの取得済み2/43ページのみ確認、全順位表確認済みとは扱わない。':'')+
   ' 公式規則: '+rule+' 出典: '+s.source+
   ' 旧Git順位表blob: '+g.sourceBlob+' 保存証拠: '+proof.SNAPSHOT_BLOB};
 if(s.mode==='cash'){record.teamPrize=target.prize;record.prizePerPlayer=target.prize;}
 if(s.seasonId==='S43'){record.teamPrize=0;record.prizePerPlayer=0;}
 const entry={id:s.id,recordId:s.id,decision:'published',policy:proof.POLICY,
  approvedAt:now,approvedBy:'ChatGPT / owner authorized historical source recovery',
  source:s.source,rule,evidence:'locked clean historical Epic leaderboard '+
  g.sourceBlob+' snapshot '+proof.SNAPSHOT_BLOB+
  ' / exact alias, rank, VR, archived clean prefix, latest unchanged row'};
 must(proof.validateRecord(record,entry),'record violates source-locked official rule: '+s.id);
 db.results.push(record);db.ledger.entries.push(entry);
 db.reviewed.entries.push({id:s.id,recordId:s.id,decision:'published',
  reviewedAt:now,policy:proof.POLICY,rule,source:s.source});
 added.push({id:s.id,player:s.player,mode:s.mode,prize:target.prize});
}
const resolved=[...added.map(x=>x.id),...stale];
if(resolved.length){
 db.reviews.history.proposals=proof.removeExact(pendingRows,resolved);
 db.reviews.history.manualReviewedAt=now;
 db.statuses.history.found=db.reviews.history.proposals.length;
 db.statuses.history.manualReviewCandidates=db.reviews.history.proposals.length;
 db.statuses.history.reviewOnlyCandidates=db.reviews.history.proposals.filter(r=>r.reviewOnly===true).length;
 db.statuses.history.manuallyPublished=(db.statuses.history.manuallyPublished||0)+added.length;
 db.statuses.history.lastReviewedBatchAt=now;
 db.ledger.reviewedAt=now;db.reviewed.reviewedAt=now;
 if(added.length)upsertPublicationLog(db.updates,{
  id:'verified-s30-s37-s43-recovered-twelve-20261117',
  date:new Date(Date.parse(now)+9*3600e3).toISOString().slice(0,10),
  title:'旧Git正常順位表からNAC・NAWの12成績を安全に復元',
  description:'S30決勝7名各$100、S30予選1名、S37 Console Duos予選参加3チーム、S43 Squads予選突破1チーム。旧正常順位表を照合。',
  recordIds:added.map(x=>x.id)
 });
 must(validateData({results:db.results,players:db.players,tournaments:db.tournaments}).errors.length===0,
  'data audit failed');
 must(approvalAudit(db.results,db.ledger,db.players).length===0,'manual approval audit failed');
 must(validateUpdateLog(db.results,db.updates).length===0,'update log audit failed');
 const personal=db.results.reduce((sum,r)=>sum+personalCents(r)*roster(r).length,0);
 const delta=added.reduce((sum,x)=>{
  const s=proof.getSpec(x.id);return sum+proof.expected(s).prize*100*s.players.length;
 },0);
 must(personal-oldPersonal===delta,'historical personal award total changed unexpectedly');
 if(!dry){
  writeReviewDb(ROOT,db);
  fs.writeFileSync(path.join(ROOT,'history-sync-reviewed.json'),JSON.stringify(db.reviewed,null,2)+'\n');
 }
}
console.log('TWELVE_RECOVERY '+JSON.stringify({
 mode:dry?'dry-run':'apply',selected:12,added:added.length,already:already.length,
 stale:stale.length,addedCash:added.reduce((sum,x)=>sum+x.prize,0),
 remaining:db.reviews.history.proposals.length,addedIds:added.map(x=>x.id)
}));
