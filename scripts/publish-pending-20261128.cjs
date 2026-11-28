'use strict';
const fs=require('node:fs'),path=require('node:path');
const {loadReviewDb,writeReviewDb,upsertPublicationLog}=require('./reviewed-publication-core.cjs');
const {validateOriginal,collision}=require('./manual-approval-core.cjs');
const {leaderboardCoverage,candidateObserved,sameScannedCandidate}=require('./verified-partial-page.cjs');
const {identityProof}=require('./saved-candidate-recheck.cjs');
const {linkedAccounts}=require('./osirion-sync.cjs');
const {validateData,personalCents,roster}=require('./data-checks.cjs');
const {audit}=require('./validate-approvals.cjs');
const {validateUpdateLog}=require('./validate-updates.cjs');
const {MANIFEST}=require('./generic-review-only-core.cjs');
const mobile=require('./verified-mobile-eu-nac-20261126.cjs');
const V=require('./verified-pending-20261128.cjs');
const root=path.resolve(__dirname,'..'),read=f=>JSON.parse(fs.readFileSync(path.join(root,f),'utf8'));
const must=(x,m)=>{if(!x)throw Error(m)};
const fields=['rank','points','kills','vrs','matches','date','region','player','tournamentId','seasonId'];
function run(dryRun=process.argv.includes('--dry-run')){
 const db=loadReviewDb(root);db.reviewed=read('history-sync-reviewed.json');
 const accounts=linkedAccounts(db).accounts,registry=read('tournament-rules.json').rules;
 const pinned=new Set(MANIFEST.held.map(x=>x.id)),resolved=[],published=[],duplicates=[],held=[],already=[];
 const now=new Date().toISOString(),cash=rs=>rs.reduce((n,r)=>n+Math.round((r.prize||0)*100),0),personal=rs=>rs.reduce((n,r)=>n+personalCents(r)*roster(r).length,0);
 const before=db.results.length,beforeCash=cash(db.results),beforePersonal=personal(db.results);
 for(const item of V.ITEMS){
  const r=item.row,id=r.id;
  try{
   const pending=Object.entries(db.reviews).flatMap(([scope,doc])=>doc.proposals.filter(x=>x.id===id).map(row=>({scope,row})));
   if(!pending.length){already.push(id);continue}
   must(!pinned.has(id)&&!db.ledger.entries.some(x=>x.id===id)&&!db.reviewed.entries.some(x=>x.id===id)&&!db.results.some(x=>x.id===id),'explicit hold or already adjudicated');
   must(pending.every(x=>sameScannedCandidate(x.row,r)),'pending evidence changed');
   const u=new URL(r.source),eventId=decodeURIComponent(u.pathname.split('/')[3]),windowId=u.searchParams.get('round'),key='epicgames_'+eventId+'_'+r.region+'/'+windowId;
   const cat=db.tournaments.catalog.find(x=>x.id===r.tournamentId);
   const sessions=read('calendar-history/'+r.date.slice(0,7)+'.json').sessions.filter(x=>x.eventId===eventId&&x.sourceWindowId===windowId&&x.dateJst===r.date&&x.region===r.region&&x.tournamentId===r.tournamentId&&x.seasonId===r.seasonId&&x.url===r.source);
   must(sessions.length===1,'official calendar not unique');
   const session=sessions[0],win={eventId,windowId,end:Date.parse(session.endUtc)};
   const cp=db.scans[item.scope].windows[key];
   validateOriginal(r,cp,session,cat,db.players);
   const coverage=leaderboardCoverage(r,win,cp,Date.parse(now));
   must(['full','partial','cutoff-complete'].includes(coverage.kind)&&cp.pages>=item.pages&&candidateObserved(r,cp,{unique:true}),'mature original continuous page unavailable');
   must(identityProof(r,win,accounts,cat.team),'deterministic Epic ID / roster not confirmed');
   if(item.decision==='duplicate'){
    const old=db.results.filter(x=>x.id===item.duplicateId),entries=db.ledger.entries.filter(x=>x.recordId===item.duplicateId);
    must(old.length===1&&entries.length===1&&mobile.verifyRow(old[0],entries[0]),'immutable Tracker screenshot publication does not match');
    must(fields.every(f=>old[0][f]===r[f])&&old[0].verified===true&&coverage.kind==='full'&&new URL(old[0].source).searchParams.get('window')===windowId,'same event or performance not confirmed');
    must(accounts.filter(a=>a.player===r.player&&a.confirmed===true&&a.epicAccountId===String(old[0].profileUrl).match(/[?&]id=([a-f0-9-]{36})/i)?.[1]?.replace(/-/g,'').toLowerCase()).length===1,'existing screenshot account mismatch');
    db.reviewed.entries.push({id,decision:'already-published',existingId:old[0].id,source:r.source,reviewedAt:now,note:'Complete exact Epic row and original Tracker screenshot match; preserve existing prize.'});
    duplicates.push({id,player:r.player,existingId:old[0].id,prize:old[0].prize});
   }else{
    const rule=registry.find(x=>x.id===r.tournamentId);
    if(r.seasonId==='S30'||r.seasonId==='S32'){
     const legacy=[rule?.verifiedLegacyNacWindow,...(rule?.verifiedLegacyNacExtraWindows||[])].find(x=>x?.dateJst===r.date&&x.windowId===windowId);
     must(rule?.source===item.rule&&rule.team==='solo'&&legacy?.cutoff===item.cutoff&&legacy.source===item.tracker&&r.matches<=rule.matchCaps['予選']&&r.prize===0&&r.kind==='予選'&&item.decision===(r.rank<=item.cutoff?'advance':'attendance'),'round1 rule mismatch');
    }else if(r.tournamentId==='ch7s1-nvidia-geforce-rtx-cup'){
     const tiers=rule?.cashPrizes?.tiers?.[r.region];
     must(rule?.source===item.rule&&tiers?.at(-1)?.through===40&&r.rank>40&&r.matches<=rule.matchCaps['単一ラウンド']&&r.prize===null&&r.kind==='参加確認'&&Array.isArray(r.teamAccountIds)&&cp.lastSeenRank>40&&item.decision==='final-zero','NVIDIA cash boundary not confirmed');
    }else if(r.tournamentId==='ch7s1-fncs-division-1'){
     must(r.date==='2026-02-10'&&r.region==='NAW'&&windowId==='S39_FNCSDivisionalCup_Division1_Week2Day1_NAW'&&cat.team==='duo'&&coverage.kind==='full'&&r.prize===null&&r.matches<=10&&item.decision==='attendance','FNCS Day1 not confirmed');
    }else if(r.tournamentId==='ch7s5-squads-victory-cup'){
     must(rule?.source===item.rule&&rule.advance[r.region]===120&&r.rank>120&&r.matches<=8&&r.prize===0&&r.kind==='予選'&&coverage.kind==='full'&&item.decision==='attendance','Squad Round1 rule mismatch');
     // Missing original team IDs are not guessed, even if all names exist.
     must(Array.isArray(r.teamAccountIds)&&r.teamAccountIds.length===4,'original squad IDs not retained');
     const overlaps=db.results.filter(x=>x.date===r.date&&x.region===r.region&&x.tournamentId===r.tournamentId&&(x.rank===r.rank||roster(x).some(n=>roster(r).includes(n))));
     must(!overlaps.length,'squad overlapping team or rank');
    }else throw Error('unsupported rule');
    const rec=V.project(item),entry=V.approval(item,now);
    must(!db.results.some(x=>collision(x,rec,db.players.confirmedAliases||{})||collision(x,r,db.players.confirmedAliases||{})),'existing overlapping result');
    must(V.verifyPublished(rec,entry),'immutable evidence changed');
    db.results.push(rec);db.ledger.entries.push(entry);
    db.reviewed.entries.push({id,decision:'published',recordId:id,policy:V.POLICY,source:r.source,rule:item.rule,reviewedAt:now});
    published.push(rec);
   }
   resolved.push(id);
  }catch(e){held.push({id,player:r.player,reason:String(e.message||e)});}
 }
 if(resolved.length){
  const ids=new Set(resolved);
  for(const scope of ['auto','history']){
   const review=db.reviews[scope],status=db.statuses[scope],old=review.proposals;
   review.proposals=old.filter(x=>!ids.has(x.id));if(review.proposals.length===old.length)continue;
   review.manualReviewedAt=now;status.lastReviewedBatchAt=now;
   status.found=status.manualReviewCandidates=review.proposals.length;
   status.reviewOnlyCandidates=review.proposals.filter(x=>x.reviewOnly===true).length;
   status.manuallyPublished=(status.manuallyPublished||0)+published.filter(r=>old.some(x=>x.id===r.id)).length;
   status.manuallyResolvedDuplicates=(status.manuallyResolvedDuplicates||0)+duplicates.filter(r=>old.some(x=>x.id===r.id)).length;
  }
  db.reviewed.reviewedAt=now;db.ledger.reviewedAt=now;
  if(published.length)upsertPublicationLog(db.updates,{id:'verified-pending-20261128',date:'2026-11-28',title:'確認待ち候補の原本再照合・賞金なし戦績の掲載',description:'保存済みEpic IDと連続順位表、公式開催枠・地域別進出/賞金条件で照合。予選突破・参加・賞金圏外決勝を区別。未取得順位や賞金は推定せず、既存賞金は保持。',recordIds:published.map(x=>x.id)});
  db.updates.entries.sort((a,b)=>b.date.localeCompare(a.date));
  must(db.results.length===before+published.length&&cash(db.results)===beforeCash&&personal(db.results)===beforePersonal,'cash or count changed');
  must(!validateData(db).errors.length,'data validation');
  const errors=audit(db.results,db.ledger,db.players);must(!errors.length,'approval validation '+JSON.stringify(errors.slice(0,3)));
  const logs=validateUpdateLog(db.results,db.updates);must(!logs.length,'update validation '+JSON.stringify(logs.slice(0,3)));
  if(!dryRun){writeReviewDb(root,db);fs.writeFileSync(path.join(root,'history-sync-reviewed.json'),JSON.stringify(db.reviewed,null,2)+'\n')}
 }
 const report={dryRun,selected:V.ITEMS.length,published:published.map(r=>({id:r.id,player:r.player,kind:r.kind,rank:r.rank,prize:r.prize})),duplicates,held,already,remaining:db.reviews.history.proposals.length+db.reviews.auto.proposals.length};
 console.log('VERIFIED_PENDING_20261128 '+JSON.stringify(report));return report;
}
if(require.main===module)run();
module.exports={run};
