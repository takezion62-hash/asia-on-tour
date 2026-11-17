'use strict';
// Diagnostic-only replay: reads existing proof files; never edits or publishes results.
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const load=x=>JSON.parse(fs.readFileSync(path.join(root,x),'utf8'));
const hash=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
const {readResults}=require('./source-results-store.cjs');
const {linkedAccounts}=require('./osirion-sync.cjs');
const cash=require('./promote-published-cash.cjs');
const reload=require('./participation-promotion.cjs');
const results=readResults(root).rows,players=load('players.json');
const tournaments=load('tournaments.json'),schedule=load('schedule.json');
const scanDocs=['auto-sync-scan.json','history-sync-scan.json'].map(name=>({name,data:load(name)}));
const proofs=load('data/manual-approvals/20261115-naw-trios-cash-fifth-proof.json').proofs;
const accountInfo=linkedAccounts({results,players});
const context={results,players,tournaments,schedule,scanDocs,
  verifiedAccounts:accountInfo.accounts,rules:load('tournament-rules.json')};
const cashHist=load('cash-promotion-history.json'),reloadHist=load('participation-promotion-history.json');
const ids=['auto-s43-d4e4db0f245a','auto-s43-5bc1cca43d3e','auto-s43-83ec104c8e6f','auto-s43-3bc1ddc1b7c7'];
for(const id of ids){
 const after=results.find(r=>r.id===id),h=cashHist.entries.find(h=>h.id===id)||reloadHist.entries.find(h=>h.id===id);
 if(!after||!h){console.log('PROMO_DIAG',JSON.stringify({id,missing:!after?'row':'history'}));continue;}
 const before=h.beforeRow,rule=context.rules.rules.find(r=>r.id===before.tournamentId);
 const source=new URL(before.source),eventId=source.pathname.split('/')[3],windowId=source.searchParams.get('round');
 const key='epicgames_'+eventId+'_'+before.region+'/'+windowId;
 const matches=scanDocs.map(d=>({file:d.name,cp:d.data.windows?.[key]})).filter(x=>x.cp);
 const details={id,event:before.tournamentId,rank:after.rank,amount:after.prize,
  originalHash:hash(before)===h.beforeSha256,
  publishedHash:hash(after)===h.afterSha256,
  ruleHash:hash(rule)===(h.evidence?.ruleSha256||h.proof?.ruleSha256),
  proofs:matches.map(x=>({file:x.file,complete:x.cp.complete,order:x.cp.rankingOrderValid,
    count:x.cp.proposals?.length,contains:x.cp.proposals?.some(p=>p.id===id),
    scannedAt:x.cp.lastSuccessAt})),
  cashReplay:null,reloadReplay:null};
 if(cashHist.entries.some(x=>x.id===id)){
  const originalLedger=load('approval-history.json').entries.find(x=>x.recordId===id);
  details.cashVerify=cash.verifyHistoricalPromotion(after,originalLedger,context,h,proofs);
  const index=cash.indexedProposals(...scanDocs.map(x=>x.data)),found=index.get(id);
  const win=found?cash.sourceWindow(before,rule,schedule):null;
  const cashAuto=require('./automatic-cash-approval.cjs');
  let verdict=null;
  if(win&&found){
   const candidate=found.candidate,roster=candidate.players||[candidate.player];
   verdict=cashAuto.decide(candidate,win,found.cp,{
    results:results.filter(x=>x.id!==id),players,tournaments,schedule,
    verifiedAccounts:roster.map((player,i)=>({player,epicAccountId:candidate.teamAccountIds?.[i],confirmed:true}))
   });
  }
  details.cashStages={originalMatchesCandidate:found?cash.matchPublished(before,found.candidate):null,
   found:!!found,checkpointKey:found?.key,win:!!win,
   winKey:win?.key,cutoff:win?cashAuto.cashLimitForWindow(win):null,
   verdict:verdict?.approved,reason:verdict?.reason||null,
   verdictAmt:verdict?.record?.prize,
   ledgerPolicy:originalLedger?.policy,ledgerSourceMatches:originalLedger?.source===after.source};
  try{
   const replay=cash.plan({...context,results:[before,...results.filter(x=>x.id!==id)],
    proofs:proofs.filter(p=>p.recordId===id),limit:1});
   details.cashReplay={changes:replay.changes.map(x=>({id:x.id,rank:x.rank,amount:x.teamPrize})),
    outputMatches:JSON.stringify(replay.updated[0])===JSON.stringify(after)};
  }catch(e){details.cashReplay={exception:e.message};}
 }else{
  const sourceIdentity=reload.sourceWindow(before),hits=reload.checkpointsFor(before,scanDocs);
  const official=sourceIdentity?reload.officialSlot(before,sourceIdentity,schedule):null;
  const inspected=reload.inspect(before,context,hits,official,Date.parse(h.approvedAt));
  const originalLedger=load('approval-history.json').entries.find(x=>x.recordId===id);
  details.reloadLedger={policy:originalLedger?.policy,recordId:originalLedger?.recordId,
   sourceMatches:originalLedger?.source===after.source,
   windowMatches:h.proof?.key===sourceIdentity?.key,
   ruleHashMatches:h.proof?.ruleSha256===hash(rule)};
  details.reloadReplay={hits:hits.map(x=>x.file),hasSlot:!!official,
   recordMatches:inspected.record?JSON.stringify(inspected.record)===JSON.stringify(after):false,
   reason:inspected.reason||null};
 }
 console.log('PROMO_DIAG '+JSON.stringify(details));
}
