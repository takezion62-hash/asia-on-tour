'use strict';
/**
 * Bounded, source-backed review planner. No network, filesystem or writes.
 * One Epic-window scan verifies all its candidate rows. Only an explicit
 * publish run may persist the returned plan via the existing source-store.
 * Unknown cash, cosmetics, ambiguous aliases and conflicting rows are held.
 */
const {apply,candidatesFor,validateOriginal,equalCandidate,collision,collisionKey}=
 require('./manual-approval-core.cjs');
const {decide:verifiedRuleDecide}=require('./verified-history-approval.cjs');
const {verifiedPartialPage}=require('./verified-partial-page.cjs');
const {checkpointIndex,checkpointFor,collisionIndex,eventWindow,groupCandidates}=
 require('./review-batch-index.cjs');
const {performance}=require('node:perf_hooks');

const elapsed=s=>Number((performance.now()-s).toFixed(3));
const entryList=(db)=>{
 const candidates=candidatesFor(db);
 return [...candidates.values()].map(x=>x.row).sort((a,b)=>
  a.date.localeCompare(b.date)||a.region.localeCompare(b.region)||
  a.tournamentId.localeCompare(b.tournamentId)||a.rank-b.rank||a.id.localeCompare(b.id));
};
function strictDuplicate(old,row){
 if(!old||old.verified!==true||old.kind!==row.kind||
  old.date!==row.date||old.region!==row.region||
  old.tournamentId!==row.tournamentId||old.event!==row.event||
  old.player!==row.player)return false;
 return ['rank','points','kills','vrs','matches'].every(k=>
  Number.isSafeInteger(row[k])&&old[k]===row[k]);
}
function reviewBatch(db,{limit=100,ids=null,runId='local-1',timestamp=new Date().toISOString(),
 actor='GitHub Actions / verified batch reviewer'}={}){
 const begin=performance.now(),stats={};
 if(!Number.isSafeInteger(limit)||limit<1||limit>100)
  throw Error('BATCH_REVIEW limit must be 1..100');
 if(!/^[A-Za-z0-9][A-Za-z0-9_.-]{0,80}$/.test(runId))
  throw Error('BATCH_REVIEW unsafe run ID');
 const all=entryList(db);
 const byId=new Map(all.map(r=>[r.id,r]));
 let selected=all;
 if(ids!==null){
  if(!Array.isArray(ids)||!ids.length||ids.length>100||new Set(ids).size!==ids.length)
   throw Error('BATCH_REVIEW invalid selected candidate IDs');
  for(const id of ids)if(!byId.has(id))throw Error('BATCH_REVIEW candidate no longer pending: '+id);
  selected=ids.map(id=>byId.get(id));
 }
 selected=selected.slice(0,limit);
 const groups=groupCandidates(selected),cpIndex=checkpointIndex(db.scans);
 const recordIds=new Set(db.results.map(r=>r.id));
 const ledgerIds=new Set(db.ledger.entries.map(x=>x.id));
 const reviewedIds=new Set((db.reviewed?.entries||[]).map(x=>x.id));
 const catalog=new Map(db.tournaments.catalog.map(x=>[x.id,x]));
 const existing=collisionIndex(db.results,collisionKey,collision,db.players.confirmedAliases||{});
 const accepted=collisionIndex([],collisionKey,collision,db.players.confirmedAliases||{});
 const allowed={ 'attendance-only':[], 'verified-rule':[] };
 const duplicates=[],held=[],checked=[];
 stats.indexMs=elapsed(begin);
 const evidenceStart=performance.now();
 let duplicateMs=0;
 // Each group is intentionally processed from the same event-window checkpoint
 // rather than rescanning all stored windows for every candidate.
 for(const group of groups){
  for(const row of group.items){
   try{
    if(recordIds.has(row.id)||ledgerIds.has(row.id)||reviewedIds.has(row.id))
     throw Error('既存ID・承認履歴と衝突');
    const win=eventWindow(row);
    if(!win||win.key!==group.key)throw Error('公式開催枠URLが不明');
    const cp=checkpointFor(row,cpIndex,equalCandidate);
    if(!cp||cp.key!==win.key)throw Error('元のEpicアカウント・順位表と不一致');
    const session=(db.calendar[row.date.slice(0,7)]||[]).find(x=>
     x.sourceWindowId===win.round&&x.eventId===win.event&&
     x.dateJst===row.date&&x.region===row.region&&
     x.tournamentId===row.tournamentId&&x.seasonId===row.seasonId);
    validateOriginal(row,cp.checkpoint,session,catalog.get(row.tournamentId),db.players);
    const checkpoint=cp.checkpoint;
    const end=Date.parse(session?.endUtc||''),seenAt=Date.parse(checkpoint.lastSuccessAt||'');
    if(!Number.isFinite(end)||!Number.isFinite(seenAt)||
      seenAt-end<4*3600*1000||seenAt>Date.now()+300000)
      throw Error('順位表の成熟時刻・取得記録が不十分');
    if(checkpoint.rankingOrderValid!==true||
      checkpoint.emptyAttempts>0||checkpoint.lastErrorCode||
      checkpoint.lastError||checkpoint.retryAfter)
      throw Error('順位表に未解決の取得エラー');
    const observedPrefix=verifiedPartialPage(row,{end},checkpoint);
    if(checkpoint.complete!==true&&!observedPrefix)
     throw Error('未取得順位があり、当該行の連続順位表を確認できない');
    const duplicateStart=performance.now();
    const found=existing.match(row);
    duplicateMs+=performance.now()-duplicateStart;
    if(found){
     if(!strictDuplicate(found.previous,row))
      throw Error('既存成績に数値差異・同定疑い: '+found.previous.id);
     duplicates.push({id:row.id,player:row.player,existingId:found.previous.id,
      rank:row.rank,oldPrize:found.previous.prize,origin:'verified-identical-score'});
     checked.push({id:row.id,decision:'already-published'});
     continue;
    }
    const pendingStart=performance.now();
    const pending=accepted.match(row);
    duplicateMs+=performance.now()-pendingStart;
    if(pending)throw Error('同一バッチ内の重複候補: '+pending.previous.id);
    let policy;
    if(row.reviewOnly===true&&row.kind==='参加確認'&&row.prize===null){
     policy='attendance-only';
    }else if(row.reviewOnly!==true&&
      ((row.kind==='予選'&&row.prize===0)||
       (row.kind==='賞金決勝'&&row.vrs===0&&row.prize===null))){
     const decision=verifiedRuleDecide(row,{
      eventId:win.event,windowId:win.round,key:win.key,seasonId:row.seasonId,
      tournamentId:row.tournamentId,dateJst:row.date,region:row.region,
      round:row.round,kind:row.kind,end,allowPartialQualifier:true
     },checkpoint,{results:db.results,players:db.players,tournaments:db.tournaments});
     if(!decision.approved)throw Error('公式規則では掲載不可: '+decision.reason);
     if(decision.record.prize!==0)
      throw Error('未確認賞金の自動確定は許可しない');
     policy='verified-rule';
    }else throw Error('現金賞金・スキン獲得などは個別根拠が必要');
    allowed[policy].push(row.id);
    accepted.add(row);
    checked.push({id:row.id,decision:policy});
   }catch(error){held.push({id:row.id,player:row.player,reason:error.message})}
  }
 }
 stats.duplicateMs=Number(duplicateMs.toFixed(3));
 stats.evidenceMs=Number((performance.now()-evidenceStart-duplicateMs).toFixed(3));
 const planStart=performance.now();
 let current={...db};
 const published=[];
 // Apply existing reviewed-publication semantics in bounded chunks. If one
 // corrupt candidate fails, binary isolation holds only that candidate.
 for(const policy of ['attendance-only','verified-rule']){
  const queue=allowed[policy];
  let chunkNumber=0;
  const applyChunk=(chunk)=>{
   if(!chunk.length)return;
   chunkNumber++;
   try{
    const plan=apply(current,{
     ids:chunk,policy,confirmation:'CONFIRM',timestamp,
     runId:runId+'-'+policy+'-'+chunkNumber,
     actor,allowPartialQualifier:true
    });
    current={...current,results:plan.next.results,reviews:plan.next.reviews,
     statuses:plan.next.statuses,ledger:plan.next.ledger,updates:plan.next.updates};
    for(const x of plan.changes)published.push({id:x.id,origin:x.origin,
      player:x.record.player,rank:x.record.rank,kind:x.record.kind,
      prize:x.record.prize,rule:x.rule,policy});
   }catch(error){
    if(chunk.length===1){
     const row=byId.get(chunk[0]);
     held.push({id:chunk[0],player:row?.player||'',reason:'公開処理: '+error.message});
    }else{
     const mid=Math.floor(chunk.length/2);
     applyChunk(chunk.slice(0,mid));
     applyChunk(chunk.slice(mid));
    }
   }
  };
  for(let n=0;n<queue.length;n+=20)applyChunk(queue.slice(n,n+20));
 }
 stats.publicationPlanningMs=elapsed(planStart);
 // Reject duplicates only after exact Epic evidence and existing original
 // verified score matching; preserve existing prize/identity and ID.
 const reallyDone=new Set(published.map(x=>x.id));
 const deduped=duplicates.filter(x=>!reallyDone.has(x.id));
 if(deduped.length){
  const rem=new Set(deduped.map(x=>x.id));
  for(const origin of ['auto','history']){
   const doc=current.reviews[origin],before=doc.proposals.length;
   doc.proposals=doc.proposals.filter(x=>!rem.has(x.id));
   if(doc.proposals.length!==before){
    doc.manualReviewedAt=timestamp;
    const status=current.statuses[origin];
    status.found=doc.proposals.length;
    status.manualReviewCandidates=doc.proposals.length;
    status.reviewOnlyCandidates=doc.proposals.filter(x=>x.reviewOnly===true).length;
    status.manuallyResolvedDuplicates=(status.manuallyResolvedDuplicates||0)+
      duplicates.filter(x=>db.reviews[origin].proposals.some(y=>y.id===x.id)).length;
   }
  }
  const prior=current.reviewed||{version:1,entries:[]};
  current.reviewed={...prior,reviewedAt:timestamp,entries:[...prior.entries,
   ...deduped.map(x=>({id:x.id,decision:'already-published',existingId:x.existingId,
    reviewedAt:timestamp,note:'Original Epic checkpoint performance equals the existing verified record, no cash added.'}))]};
 }
 const holdIds=new Set(held.map(x=>x.id)),seenHeld=new Set();
 const uniqueHeld=held.filter(x=>!reallyDone.has(x.id)&&!deduped.some(d=>d.id===x.id)&&
   !seenHeld.has(x.id)&&(seenHeld.add(x.id),true));
 stats.totalMs=elapsed(begin);
 return {next:current,selected:selected.length,windowGroups:groups.length,published,
  duplicates:deduped,held:uniqueHeld,
  preview:{sourceResults:db.results.length,nextResults:current.results.length,
   beforePending:all.length,selected:selected.length,
   resolved:published.length+deduped.length,
   remainingPending:current.reviews.auto.proposals.length+current.reviews.history.proposals.length,
   nextUnreviewed:Math.max(0,all.length-selected.length)},
  metrics:stats};
}
module.exports={entryList,strictDuplicate,reviewBatch};
