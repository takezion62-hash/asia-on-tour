'use strict';
// Explicitly approved clean-prefix historical batch. A source scanner that has
// not finished downloading 100 pages may still have trustworthy page 1..N.
// Hold *only* incomplete/mature-prefix failures, never guess source fields.
const fs=require('node:fs'),path=require('node:path');
const {loadReviewDb,writeReviewDb,upsertPublicationLog}=require('./reviewed-publication-core.cjs');
const {validateOriginal,collision}=require('./manual-approval-core.cjs');
const {sameScannedCandidate,verifiedPartialPage}=require('./verified-partial-page.cjs');
const {validateData,personalCents,roster}=require('./data-checks.cjs');
const {audit}=require('./validate-approvals.cjs');
const {verifyHistoricalRow}=require('./confirmed-player-renames-20261126.cjs');
const {validateUpdateLog}=require('./validate-updates.cjs');
const V=require('./verified-s30-clean-partial-38-20261121.cjs');
const ROOT=path.resolve(__dirname,'..');
const fail=(ok,why)=>{if(!ok)throw Error('PUBLISH_S30_CLEAN_PARTIAL_38 '+why)};
function apply({dryRun=false}={}){
 fail(V.validateProof(),'immutable proof changed');
 const db=loadReviewDb(ROOT);
 db.reviewed=JSON.parse(fs.readFileSync(path.join(ROOT,'history-sync-reviewed.json'),'utf8'));
 const catalog=db.tournaments.catalog.find(t=>t.id===V.TOURNAMENT);
 fail(catalog&&catalog.team==='solo'&&catalog.seasonId==='S30'&&
  catalog.sourceEventIds.includes(V.EVENT),'tournament master mismatch');
 const pending=new Map(db.reviews.history.proposals.map(x=>[x.id,x]));
 fail(pending.size===db.reviews.history.proposals.length,'duplicate pending IDs');
 const approved=new Set(db.reviewed.entries.map(x=>x.id));
 const priorResults=db.results.length;
 const priorCash=db.results.reduce((n,x)=>n+Math.round((x.prize||0)*100),0);
 const priorPersonal=db.results.reduce((n,x)=>n+personalCents(x)*roster(x).length,0);
 const months=new Map(),added=[],already=[],held=[],remove=[];
 const verifiedAt='2026-11-21T14:31:52Z';
 for(const item of V.DOC.batch.entries){
  const s=item.source,e=item.expected;
  const old=db.results.filter(x=>x.id===s.id);
  fail(old.length<=1,'result ID duplicate '+s.id);
  if(old.length){
   const approvals=db.ledger.entries.filter(x=>x.id===s.id);
   fail(approvals.length===1&&verifyHistoricalRow(V.verifyRow,old[0],approvals[0],db.players),
    'previously published candidate no longer matches locked evidence '+s.id);
   already.push(s.id);
   if(pending.has(s.id)){
    fail(sameScannedCandidate(pending.get(s.id),s),'stale pending evidence differs '+s.id);
    remove.push(s.id);
   }
   continue;
  }
  fail(pending.has(s.id)&&sameScannedCandidate(pending.get(s.id),s),
   'pending candidate missing or altered '+s.id);
  fail(!approved.has(s.id)&&!db.ledger.entries.some(x=>x.id===s.id),
   'candidate reviewed or orphan approved '+s.id);
  const u=new URL(s.source),windowId=u.searchParams.get('round'),eventNo=Number(s.round.match(/^Event (\d+)/u)?.[1]);
  const expectedId=V.EVENT+'_Event'+eventNo+'Round'+(e.kind==='賞金決勝'?2:1)+'_'+s.region;
  fail(windowId===expectedId&&u.searchParams.get('region')===s.region,
   'official window differs '+s.id);
  const month=s.date.slice(0,7);
  if(!months.has(month))months.set(month,JSON.parse(fs.readFileSync(
    path.join(ROOT,'calendar-history/'+month+'.json'),'utf8')).sessions);
  const sessions=months.get(month).filter(x=>x.sourceWindowId===windowId&&x.eventId===V.EVENT&&
   x.dateJst===s.date&&x.region===s.region&&x.tournamentId===V.TOURNAMENT&&
   x.seasonId==='S30');
  fail(sessions.length===1&&sessions[0].url===s.source,
   'official calendar ambiguous or changed '+s.id);
  const key='epicgames_'+V.EVENT+'_'+s.region+'/'+windowId;
  const cp=db.scans.history.windows[key];
  fail(cp&&cp.rankingOrderValid===true&&Array.isArray(cp.proposals)&&
   cp.proposals.filter(x=>x.id===s.id&&sameScannedCandidate(x,s)).length===1&&
   cp.nextPage>=1&&cp.pages===cp.nextPage&&cp.lastSeenRank>=s.rank,
   'original saved Epic account ID, score or rank cannot be validated '+s.id);
  // Genuine clean-prefix rules explicitly disallow 429/retries, empty pages,
  // and snapshots <4h after the end of the actual session.
  if(!verifiedPartialPage(s,{end:Date.parse(sessions[0].endUtc)},cp)){
   held.push({id:s.id,reason:'source leaderboard prefix not mature/clean/contiguous'});
   continue;
  }
  validateOriginal(s,cp,sessions[0],catalog,db.players);
  const overlaps=db.results.filter(x=>collision(x,s,db.players.confirmedAliases||{}));
  if(overlaps.length){
   held.push({id:s.id,reason:'same-player session collision: '+overlaps.map(x=>x.id).join(',')});
   continue;
  }
  if(e.kind==='賞金決勝')
   fail(s.region==='OCE'&&s.vrs===1&&s.points===100&&e.prize===100,
    'one VR cash wrong '+s.id);
  else{
   const cutoff=V.CUTOFF[s.region],adv=s.rank<=cutoff;
   fail((s.region==='NAC'||s.region==='BR')&&s.prize===0&&e.prize===0&&
    e.qualification===(adv?'advanced':'not-advanced'),'round 1 payout/advancement changed '+s.id);
  }
  const row=V.project(item,cp.pages+'/'+cp.totalPages);
  const approval=V.approval(item,row);
  fail(V.verifyRow(row,approval),'projected row failed immutable proof '+s.id);
  db.results.push(row);db.ledger.entries.push(approval);
  db.reviewed.entries.push({id:s.id,decision:'published',recordId:s.id,
   policy:V.POLICY,source:s.source,rule:V.RULE,reviewedAt:verifiedAt});
  approved.add(s.id);added.push(row);remove.push(s.id);
 }
 fail(added.length+already.length+held.length===38,
  'batch accounting lost a source ID');
 const deltaCash=added.reduce((n,r)=>n+Math.round(r.prize*100),0);
 const deltaPersonal=added.reduce((n,r)=>n+personalCents(r)*roster(r).length,0);
 fail(deltaCash===deltaPersonal&&deltaCash>=0&&deltaCash<=30000&&
  db.results.length===priorResults+added.length&&
  db.results.reduce((n,x)=>n+Math.round((x.prize||0)*100),0)===priorCash+deltaCash&&
  db.results.reduce((n,x)=>n+personalCents(x)*roster(x).length,0)===priorPersonal+deltaPersonal,
  'amounts of old results changed');
 if(remove.length){
  const ids=new Set(remove);
  fail(db.reviews.history.proposals.filter(x=>ids.has(x.id)).length===ids.size,
   'source review queue differs from decision list');
  db.reviews.history.proposals=db.reviews.history.proposals.filter(x=>!ids.has(x.id));
  db.reviews.history.manualReviewedAt=verifiedAt;
  db.statuses.history.found=db.reviews.history.proposals.length;
  db.statuses.history.manualReviewCandidates=db.reviews.history.proposals.length;
  db.statuses.history.reviewOnlyCandidates=db.reviews.history.proposals.filter(x=>x.reviewOnly===true).length;
  db.statuses.history.manuallyPublished=(db.statuses.history.manuallyPublished||0)+added.length;
  db.statuses.history.lastReviewedBatchAt=verifiedAt;
  db.ledger.reviewedAt=verifiedAt;db.reviewed.reviewedAt=verifiedAt;
  if(added.length){
   upsertPublicationLog(db.updates,{id:'s30-clean-partial-38-reviewed-20261121',
    date:'2026-11-21',title:'2024年ZB Soloの確認済み予選・決勝成績を追加',
    description:'Osirionの保存済み連続先頭順位表の本人ID・公式開催枠・順位・キル・VRを確認。NA/BR予選は地域別通過圏内と参加のみを区別。OCE Round2の1VRは個人$100。全ページの取得完了は主張せず、既存結果の重複・賞金を保持。',
    recordIds:added.map(x=>x.id)});
  }
  db.updates.entries.sort((a,b)=>b.date.localeCompare(a.date));
  const dataErrors=validateData({results:db.results,players:db.players,tournaments:db.tournaments}).errors;
  fail(!dataErrors.length,'data integrity '+JSON.stringify(dataErrors.slice(0,5)));
  const auditErrors=audit(db.results,db.ledger,db.players);
  fail(!auditErrors.length,'approval audit '+JSON.stringify(auditErrors.slice(0,5)));
  const updateErrors=validateUpdateLog(db.results,db.updates);
  fail(!updateErrors.length,'update history '+JSON.stringify(updateErrors.slice(0,5)));
  if(!dryRun){
   writeReviewDb(ROOT,db);
   fs.writeFileSync(path.join(ROOT,'history-sync-reviewed.json'),
    JSON.stringify(db.reviewed,null,2)+'\n');
  }
 }
 const out={mode:dryRun?'dry-run':'apply',selected:38,added:added.length,already:already.length,
  held,addedCash:deltaCash/100,
  qualifiers:added.filter(x=>x.kind==='予選').length,
  finals:added.filter(x=>x.kind==='賞金決勝').length,
  advanced:added.filter(x=>/\/ 予選突破$/u.test(x.round)).length,
  remaining:db.reviews.history.proposals.length,ids:added.map(x=>x.id)};
 console.log('S30_CLEAN_PREFIX_38 '+JSON.stringify(out));
 return out;
}
if(require.main===module)try{
 const argv=process.argv.slice(2);
 fail(argv.length===0||(argv.length===1&&argv[0]==='--dry-run'),'only --dry-run accepted');
 apply({dryRun:argv.includes('--dry-run')});
}catch(e){console.error(e.stack);process.exitCode=1}
module.exports={apply};
