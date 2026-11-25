'use strict';
// Build an offline snapshot directly from the same checked-in sources used by
// scheduled sync and the existing attendance-only approval correction path.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {readResults,publishResults}=require('./source-results-store.cjs');
const {linkedAccounts,parseStage,parseReviewStage}=require('./osirion-sync.cjs');
const {sourceWindow}=require('./review-recovery-priority.cjs');
const {planPublishedAttendance}=require('./published-attendance-recheck.cjs');
const {validateData}=require('./data-checks.cjs');
const {validateUpdateLog}=require('./validate-updates.cjs');
const manual=require('./attendance-award-recheck.cjs');
const ROOT=path.resolve(__dirname,'..'),AUDIT='published-attendance-phase5-history.json';
const read=(root,name)=>JSON.parse(fs.readFileSync(path.join(root,name),'utf8'));
const write=(root,name,value)=>fs.writeFileSync(path.join(root,name),JSON.stringify(value,null,2)+'\n');
const hash=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
function buildWindows(results,catalog,sessions){
 const byId=new Map(catalog.map(t=>[t.id,t])),wanted=new Set(results.filter(r=>r.kind==='参加確認').map(sourceWindow).filter(Boolean));
 const windows=[];
 for(const s of sessions){
  const t=byId.get(s.tournamentId);
  if(!t||t.name!==s.name||t.seasonId!==s.seasonId||t.series!==s.series||
   !t.sourceEventIds?.includes(s.eventId)||!s.sourceWindowId||
   !s.sourceWindowId.endsWith('_'+s.region))continue;
  const key='epicgames_'+s.eventId+'_'+s.region+'/'+s.sourceWindowId;
  if(!wanted.has(key)||s.url!== 'https://www.fortnite.com/competitive/events/'+s.eventId+'/?region='+s.region+'&round='+s.sourceWindowId)continue;
  const start=Date.parse(s.startUtc),end=Date.parse(s.endUtc);
  if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start||
   new Date(start+9*3600000).toISOString().slice(0,10)!==s.dateJst)continue;
  const stage=t.series==='victory-cup'?parseStage(s.sourceWindowId):parseReviewStage(s.sourceWindowId);
  if(!stage)continue;
  windows.push({key,eventId:s.eventId,windowId:s.sourceWindowId,region:s.region,dateJst:s.dateJst,
   tournamentId:t.id,seasonId:t.seasonId,series:t.series,startUtc:s.startUtc,end,...stage});
 }
 return windows;
}
function loadSnapshot(root=ROOT,now=Date.now()){
 const results=readResults(root).rows,players=read(root,'players.json'),tournaments=read(root,'tournaments.json');
 const scans={auto:read(root,'auto-sync-scan.json'),history:read(root,'history-sync-scan.json')};
 const ledger=read(root,'approval-history.json'),reviewed=read(root,'history-sync-reviewed.json');
 if(!Array.isArray(ledger.entries)||!Array.isArray(reviewed.entries))throw Error('Invalid review history');
 const config=read(root,'history-sync-config.json'),schedule=read(root,'schedule.json');
 const months=[...new Set(results.filter(r=>r.kind==='参加確認').map(r=>r.date?.slice(0,7)).filter(x=>/^\d{4}-\d{2}$/.test(x)))];
 const sessions=months.flatMap(month=>{
  const file='calendar-history/'+month+'.json';
  if(!fs.existsSync(path.join(root,file)))return [];
  const doc=read(root,file);if(!Array.isArray(doc.sessions))throw Error('Invalid official calendar '+month);return doc.sessions;
 });
 const oldAudit=fs.existsSync(path.join(root,AUDIT))?read(root,AUDIT):{version:1,entries:[]};
 if(oldAudit.version!==1||!Array.isArray(oldAudit.entries))throw Error('Invalid Phase 5 audit');
 return {data:{results,players,tournaments,schedule,verifiedAccounts:linkedAccounts({results,players}).accounts},
  scans,windows:buildWindows(results,tournaments.catalog,sessions),config,ledger,
  reviewedIds:[...reviewed.entries.map(x=>x.id),...oldAudit.entries.map(x=>x.id)],
  otherQueue:[...read(root,'auto-sync-review.json').proposals,...read(root,'history-sync-review.json').proposals],
  now,oldAudit,updates:read(root,'updates.json')};
}
function applyPreview(snapshot,report){
 // The caller cannot supply a stale or forged report. Replay the entire plan.
 const expected=planPublishedAttendance(snapshot);
 if(hash(expected)!==hash(report))throw Error('Phase 5 report differs from current verified evidence');
 const changes=new Map(report.proposals.map(p=>[p.id,p]));
 const ids=new Set(snapshot.oldAudit.entries.map(e=>e.id)),entries=[];
 const results=snapshot.data.results.map(old=>{
  const p=changes.get(old.id);if(!p)return old;
  if(ids.has(old.id)||old.kind!=='参加確認'||hash(p.before)!==hash({kind:old.kind,round:old.round,prize:old.prize}))
   throw Error('Phase 5 protected or stale ID '+old.id);
  const {prizePerPlayer,teamPrize,...base}=old;
  const next={...base,...p.after,note:p.note};
  if(next.id!==old.id)throw Error('Phase 5 ID changed');
  if(Array.isArray(next.players)&&next.players.length>1&&next.prize>0&&
   (!Number.isSafeInteger(next.prizePerPlayer)||next.prizePerPlayer*next.players.length!==next.prize))
   throw Error('Phase 5 missing exact personal cash allocation '+old.id);
  entries.push({id:old.id,source:old.source,before:p.before,after:p.after,
   beforeSha256:hash(old),afterSha256:hash(next),approvedAt:new Date(snapshot.now).toISOString()});
  return next;
 });
 if(entries.length!==changes.size||results.length!==snapshot.data.results.length)throw Error('Phase 5 lost results');
 return {results,entries,audit:{version:1,entries:[...entries,...snapshot.oldAudit.entries]}};
}
function run(root=ROOT,{apply=false,now=Date.now()}={}){
 const s=loadSnapshot(root,now),preview=planPublishedAttendance(s),planned=applyPreview(s,preview);
 // Manual attendance-only ledger records are handled exclusively by the existing
 // immutable proof verifier. Do not bypass or rewrite the original ledger.
 const context=manual.loadContext(root,{results:planned.results,players:s.data.players});
 const oldManual=fs.existsSync(path.join(root,manual.HISTORY))?read(root,manual.HISTORY):{version:1,entries:[]};
 const corrections=manual.plan(context,s.ledger,oldManual,{now});
 const correctedById=new Map(corrections.results.map(r=>[r.id,r]));
 for(const h of corrections.changes){
  if(!manual.verifyPromotion(correctedById.get(h.id),s.ledger.entries.find(e=>e.recordId===h.id),
    {...context,results:corrections.results},corrections.history))throw Error('Manual correction replay failed '+h.id);
 }
 const count=planned.entries.length+corrections.changes.length;
 const updates={...s.updates,entries:[...s.updates.entries]};
 if(count){
  // A correction is not a new registration: preserve the original recordIds.
  const date=new Date(now+9*3600000).toISOString().slice(0,10),id='phase5-attendance-'+hash([...planned.entries,...corrections.changes].map(e=>e.id)).slice(0,16);
  if(updates.entries.some(e=>e.id===id))throw Error('Phase 5 duplicate update');
  updates.entries.unshift({id,date,type:'site',title:'既掲載参加確認 '+count+'件を公式規則で再分類',
    description:'保存済み順位表・本人ID・開催枠・公式規則による訂正。元の戦績IDと登録履歴を維持。',recordIds:[]});
 }
 const check=validateData({results:corrections.results,players:s.data.players,tournaments:s.data.tournaments});
 const errors=[...check.errors,...validateUpdateLog(corrections.results,updates)];
 if(errors.length)throw Error('Phase 5 validation failed '+JSON.stringify(errors.slice(0,5)));
 const manualChanges=corrections.changes.map(h=>{const r=correctedById.get(h.id);return {id:h.id,player:r.player,source:r.source,kind:r.kind,round:r.round,prize:r.prize,prizePerPlayer:r.prizePerPlayer}});
 const report={...preview,manualChanges,manualHeld:corrections.held,totalChanges:count,
  publishedBefore:s.data.results.length,publishedAfter:corrections.results.length,additionalProviderRequests:0};
 if(apply&&count){
  publishResults(root,corrections.results);
  if(planned.entries.length)write(root,AUDIT,planned.audit);
  if(corrections.changes.length)write(root,manual.HISTORY,corrections.history);
  write(root,'updates.json',updates);
 }
 return report;
}
if(require.main===module){
 try{
  const mode=process.argv[2];
  if(process.argv.length!==3||!['--dry-run','--apply'].includes(mode))throw Error('Usage: --dry-run or --apply');
  if(mode==='--apply'&&process.env.AOT_PHASE5_CONFIRMATION!=='CONFIRM')throw Error('Explicit CONFIRM required');
  const report=run(ROOT,{apply:mode==='--apply'});
  process.stdout.write(JSON.stringify(report,null,2)+'\n');
 }catch(e){console.error(e.stack);process.exitCode=1}
}
module.exports={buildWindows,loadSnapshot,applyPreview,run};
