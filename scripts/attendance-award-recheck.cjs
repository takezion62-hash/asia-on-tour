'use strict';
// Correct previously published attendance-only records in place using the
// original verified candidate, official archived session and strict adapter.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {readResults,publishResults}=require('./source-results-store.cjs');
const {validateData}=require('./data-checks.cjs');
const {linkedAccounts}=require('./osirion-sync.cjs');
const ps=require('./automatic-playstation-approval.cjs');
const nv=require('./automatic-nvidia-approval.cjs');
const cash=require('./automatic-cash-approval.cjs');
const {leaderboardCoverage,coversRankBoundary}=require('./verified-partial-page.cjs');
const {individualRankPrize}=require('./tournament-rule-engine.cjs');
const ROOT=path.resolve(__dirname,'..'),HISTORY='attendance-award-recheck-history.json';
const SCANS=['auto-sync-scan.json','history-sync-scan.json'];
const json=JSON.stringify,hash=x=>crypto.createHash('sha256').update(json(x)).digest('hex');
const read=(root,name)=>JSON.parse(fs.readFileSync(path.join(root,name),'utf8'));
const roster=r=>r.players||[r.player];
const fields=['id','date','region','player','playerRaw','event','round','rank','points','kills','vrs','prize','kind','matches','seasonId','chapter','season','tournamentId','source','verified','players'];
function route(row){
 if(row?.kind!=='参加確認'||row.prize!==null||row.verified!==true||row.reviewOnly===true)return null;
 const p=ps.RULES[row.tournamentId],n=nv.RULES[row.tournamentId],c=cash.RULES[row.tournamentId];
 if(p&&row.round==='Qualifier / 参加確認'&&Number.isSafeInteger(row.rank)&&row.rank>=1&&row.rank<=p.advance?.[row.region])return {adapter:ps,rule:p,kind:'qualifier'};
 if(p&&row.round==='Final / 参加確認'&&individualRankPrize(p,row.region,row.rank)>0)return {adapter:ps,rule:p,kind:'cash'};
 if(n&&individualRankPrize(n,row.region,row.rank)>0)return {adapter:nv,rule:n,kind:'cash'};
 if(c?.id==='ch7s5-trios-cash-cup'&&individualRankPrize(c,row.region,row.rank)>0)return {adapter:cash,rule:c,kind:'cash'};
 return null;
}
function identity(row,rule){
 try{
  const u=new URL(row.source),m=u.pathname.match(/^\/competitive\/events\/([A-Za-z0-9_]+)\/$/);
  if(u.origin!=='https://www.fortnite.com'||u.username||u.password||u.hash||u.searchParams.size!==2||
   !m||!rule.eventIds.includes(m[1])||u.searchParams.get('region')!==row.region)return null;
  const windowId=u.searchParams.get('round');
  if(!windowId||!windowId.endsWith('_'+row.region))return null;
  return {eventId:m[1],windowId,key:'epicgames_'+m[1]+'_'+row.region+'/'+windowId};
 }catch{return null}
}
function exact(row,candidate){
 return Boolean(candidate?.reviewOnly===true&&candidate.verified===true&&
  fields.every(k=>json(row[k])===json(candidate[k]))&&
  (!row.teamAccountIds||json(row.teamAccountIds)===json(candidate.teamAccountIds)));
}
function approvedEntry(row,entry){
 return entry?.policy==='attendance-only'&&entry.decision==='published'&&entry.id===row.id&&
  entry.recordId===row.id&&entry.source===row.source;
}
function officialSlot(row,rule,context){
 const ident=identity(row,rule);
 if(!ident)return null;
 const matches=context.sessions(row.date.slice(0,7)).filter(s=>s.eventId===ident.eventId&&s.sourceWindowId===ident.windowId&&
  s.dateJst===row.date&&s.region===row.region&&s.seasonId===row.seasonId&&s.tournamentId===row.tournamentId&&
  s.name===row.event&&s.url===row.source&&Number.isFinite(Date.parse(s.startUtc))&&
  Number.isFinite(Date.parse(s.endUtc))&&Date.parse(s.endUtc)>Date.parse(s.startUtc));
 return matches.length===1?{...ident,slot:matches[0]}:null;
}
function checkpointProof(cp,row,kind,rule,slot,now){
 const end=Date.parse(slot.endUtc),coverage=leaderboardCoverage(row,{end},cp,now);
 if(coverage.kind==='invalid'||!Array.isArray(cp.proposals))return null;
 const hits=cp.proposals.filter(c=>c.id===row.id);
 if(hits.length!==1||!exact(row,hits[0]))return null;
 // Only the dedicated NVIDIA adapter can grant positive cash from a mature
 // partial leaderboard. Never fake complete=true in the frozen audit proof.
 const nvidiaPrefix=kind==='cash'&&rule.id==='ch7s1-nvidia-geforce-rtx-cup'&&
  nv.prizePrefixEvidence(hits[0],{eventId:slot.eventId,windowId:slot.sourceWindowId,
   tournamentId:row.tournamentId,seasonId:row.seasonId,region:row.region,
   dateJst:row.date,series:rule.series,round:row.round,kind:row.kind,end},cp,now);
 const qualifierCapped=coverage.kind==='cutoff-complete'&&kind==='qualifier'&&
  coversRankBoundary(coverage,rule.advance[row.region],{inclusive:true});
 if(!nvidiaPrefix&&coverage.kind!=='full'&&!qualifierCapped)return null;
 return {...Object.fromEntries(['complete','rankingOrderValid','epicIdsRetained','nextPage','pages','totalPages','lastSeenRank','lastSuccessAt','emptyAttempts'].filter(k=>cp[k]!==undefined).map(k=>[k,cp[k]])),proposals:[hits[0]]};
}
function inspect(row,entry,context,proof,now){
 const target=route(row);
 if(!target||!approvedEntry(row,entry))return null;
 const place=officialSlot(row,target.rule,context);
 if(!place||proof.key!==place.key||!SCANS.includes(proof.file)||proof.ruleSha256!==hash(target.rule))return null;
 const cp=checkpointProof(proof.checkpoint,row,target.kind,target.rule,place.slot,now);
 if(!cp||json(cp)!==json(proof.checkpoint))return null;
 const candidate=cp.proposals[0],names=roster(candidate),ids=candidate.teamAccountIds;
 if(!Array.isArray(ids)||ids.length!==names.length||new Set(ids).size!==ids.length||
  ids.some((id,i)=>context.verifiedAccounts.filter(a=>a.confirmed===true&&a.epicAccountId===id).length!==1||
   !context.verifiedAccounts.some(a=>a.confirmed===true&&a.epicAccountId===id&&a.player===names[i])))return null;
 const expectedId='auto-'+row.seasonId.toLowerCase()+'-'+hash([place.eventId+'/'+place.windowId,ids]).slice(0,12);
 if(expectedId!==row.id)return null;
 const others=context.results.filter(x=>x.id!==row.id);
 if(context.results.filter(x=>x.id===row.id).length!==1||
  others.some(x=>x.tournamentId===row.tournamentId&&x.date===row.date&&x.region===row.region&&
   identity(x,target.rule)?.key===place.key&&(x.rank===row.rank||roster(x).some(n=>names.includes(n)))))return null;
 const win={key:place.key,eventId:place.eventId,windowId:place.windowId,series:target.rule.series,
  tournamentId:row.tournamentId,seasonId:row.seasonId,region:row.region,dateJst:row.date,
  kind:row.kind,round:row.round,startUtc:place.slot.startUtc,end:Date.parse(place.slot.endUtc)};
 const verdict=target.adapter.decide(candidate,win,cp,{...context,results:others,
  schedule:{sessions:[place.slot]}},now);
 if(!verdict.approved)return null;
 const v=verdict.record;
 if(v.id!==row.id||(target.kind==='qualifier'?(v.kind!=='予選'||v.prize!==0):(v.kind!=='賞金決勝'||!(v.prize>0))))return null;
 const corrected={...row,kind:v.kind,round:v.round,prize:v.prize,
  ...(v.prizePerPlayer!==undefined?{prizePerPlayer:v.prizePerPlayer}:{}),note:v.note};
 if(!Number.isSafeInteger(corrected.prize)||corrected.prize<0||
  (names.length>1&&corrected.prize!==corrected.prizePerPlayer*names.length))return null;
 return corrected;
}
function loadContext(root=ROOT,{results,players,withScans=true}={}){
 results=results||readResults(root).rows;players=players||read(root,'players.json');
 const cache=new Map();
 return {results,players,tournaments:read(root,'tournaments.json'),
  verifiedAccounts:linkedAccounts({results,players}).accounts,
  sessions:month=>{
   if(!/^\d{4}-\d{2}$/.test(month))return [];
   if(!cache.has(month)){const file='calendar-history/'+month+'.json';
    cache.set(month,fs.existsSync(path.join(root,file))?read(root,file).sessions||[]:[]);}
   return cache.get(month);
  },scanDocs:withScans?SCANS.map(file=>({file,doc:read(root,file)})):[]};
}
function plan(context,ledger,history={version:1,entries:[]},{now=Date.now()}={}){
 if(ledger?.version!==1||!Array.isArray(ledger.entries)||history?.version!==1||!Array.isArray(history.entries))
  throw Error('ATTENDANCE_RECHECK invalid ledger or history');
 const byId=new Map(ledger.entries.map(e=>[e.recordId,e])),seen=new Set(history.entries.map(e=>e.id));
 const results=context.results.slice(),changes=[],held=[];
 for(let i=0;i<results.length;i++){
  const row=results[i],target=route(row);
  if(!target)continue;
  const entry=byId.get(row.id),place=officialSlot(row,target.rule,context);
  if(!approvedEntry(row,entry)||!place||seen.has(row.id)){held.push({id:row.id,reason:'元承認・公式日程・履歴不一致'});continue}
  let found=null;
  for(const {file,doc} of context.scanDocs){
   const checkpoint=checkpointProof(doc.windows?.[place.key],row,target.kind,target.rule,place.slot,now);
   if(!checkpoint)continue;
   const proof={file,key:place.key,ruleSha256:hash(target.rule),checkpoint};
   const record=inspect(row,entry,{...context,results},proof,now);
   if(record){found={proof,record};break}
  }
  if(!found){held.push({id:row.id,reason:'確定済み順位表・本人ID・公式承認条件の追加確認が必要'});continue}
  results[i]=found.record;
  changes.push({id:row.id,beforeRow:row,beforeSha256:hash(row),afterSha256:hash(found.record),
   proof:found.proof,proofSha256:hash(found.proof),approvedAt:new Date(now).toISOString()});
 }
 if(results.length!==context.results.length||results.some((r,i)=>r.id!==context.results[i].id))throw Error('ATTENDANCE_RECHECK ID changed');
 return {results,changes,held,history:{version:1,entries:[...changes,...history.entries]}};
}
function verifyPromotion(row,entry,context,history){
 try{
  if(history?.version!==1||!Array.isArray(history.entries))return false;
  const matches=history.entries.filter(x=>x.id===row.id);
  if(matches.length!==1)return false;
  const h=matches[0],before=h.beforeRow,now=Date.parse(h.approvedAt);
  if(!Number.isFinite(now)||!before||before.id!==row.id||!approvedEntry(before,entry)||
   h.beforeSha256!==hash(before)||h.afterSha256!==hash(row)||h.proofSha256!==hash(h.proof))return false;
  const results=context.results.map(r=>r.id===row.id?before:r);
  const expected=inspect(before,entry,{...context,results},h.proof,now);
  return !!expected&&json(expected)===json(row);
 }catch{return false}
}
function run(root=ROOT,{dryRun=true,now=Date.now()}={}){
 const context=loadContext(root),ledger=read(root,'approval-history.json');
 const history=fs.existsSync(path.join(root,HISTORY))?read(root,HISTORY):{version:1,entries:[]};
 const output=plan(context,ledger,history,{now});
 if(output.changes.length){
  const errors=validateData({results:output.results,players:context.players,tournaments:context.tournaments}).errors;
  if(errors.length)throw Error('ATTENDANCE_RECHECK invalid corrected data '+json(errors.slice(0,5)));
  const byId=new Map(ledger.entries.map(e=>[e.recordId,e])),rowsById=new Map(output.results.map(r=>[r.id,r]));
  for(const h of output.changes)if(!verifyPromotion(rowsById.get(h.id),byId.get(h.id),{...context,results:output.results},output.history))
   throw Error('ATTENDANCE_RECHECK replay failed '+h.id);
  if(!dryRun){
   publishResults(root,output.results);
   fs.writeFileSync(path.join(root,HISTORY),JSON.stringify(output.history,null,2)+'\n');
  }
 }
 const byId=new Map(output.results.map(r=>[r.id,r]));
 console.log('ATTENDANCE_RECHECK '+json({dryRun,qualified:output.changes.filter(h=>byId.get(h.id).kind==='予選').length,
  cash:output.changes.filter(h=>byId.get(h.id).kind==='賞金決勝').length,
  totalPrize:output.changes.reduce((n,h)=>n+byId.get(h.id).prize,0),changes:output.changes.map(h=>{const r=byId.get(h.id);return {id:r.id,player:r.player,rank:r.rank,kind:r.kind,region:r.region,prize:r.prize}}),held:output.held}));
 return output;
}
if(require.main===module){
 try{const args=process.argv.slice(2);if(args.length!==1||!['--dry-run','--apply'].includes(args[0]))throw Error('Usage: --dry-run or --apply');
  run(ROOT,{dryRun:args[0]==='--dry-run'});
 }catch(e){console.error(e.stack);process.exitCode=1}
}
module.exports={HISTORY,route,identity,exact,checkpointProof,inspect,loadContext,plan,verifyPromotion,run};
