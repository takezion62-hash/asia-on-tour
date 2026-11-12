'use strict';
// Reconcile concurrent AOT result auto-writers without rebasing generated JSON.
// Runner captures immutable pre-scan and post-scan snapshots in RUNNER_TEMP.
// On EACH push attempt, start from the newest main and replay ONLY verified
// additions. Never replace public rows, updates, manual reviews, or source data.
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {readResults,publishResults}=require('./source-results-store.cjs');
const VALID_SCOPES=new Set(['history','auto']);
const SOURCE_FILES=[
  'players.json','tournaments.json','tournament-rules.json',
  'scripts/osirion-sync.cjs','scripts/auto-sync-core.cjs',
  'scripts/verified-history-approval.cjs',
  'scripts/automatic-cash-approval.cjs',
  'scripts/automatic-cosmetic-approval.cjs',
  'scripts/automatic-performance-approval.cjs',
  'scripts/automatic-unreal-approval.cjs'
];
const read=(root,file)=>file==='results.json'?readResults(root).rows:JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
const stringify=x=>JSON.stringify(x);
const clone=x=>JSON.parse(stringify(x));
const fail=reason=>{throw Error('AOT_SAFE_SYNC_MERGE: '+reason)};
const prefix=scope=>scope==='history'?'history-sync':'auto-sync';
const files=scope=>{
 if(!VALID_SCOPES.has(scope))fail('unknown scope: '+scope);
 return ['results.json','updates.json',prefix(scope)+'-scan.json',prefix(scope)+'-review.json',prefix(scope)+'-status.json'];
};
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
function sourceHashes(root,scope){
 const result={};
 for(const file of [...SOURCE_FILES,prefix(scope)+'-config.json'])
  result[file]=sha(fs.readFileSync(path.join(root,file)));
 return result;
}
// An in-flight scan is no longer authoritative when any approval input moved.
// The runner must refresh its snapshot and rescan; never relax the merge guard.
function changedSources(expected,current){
 if(!expected||!current||typeof expected!=='object'||typeof current!=='object'||
    Array.isArray(expected)||Array.isArray(current))fail('invalid approval source fingerprints');
 return [...new Set([...Object.keys(expected),...Object.keys(current)])]
  .filter(file=>expected[file]!==current[file]).sort();
}
function snapshot(scope,root=path.resolve(__dirname,'..')){
 const docs={};
 for(const file of files(scope))docs[file]=read(root,file);
 return {version:1,scope,docs,sources:sourceHashes(root,scope)};
}
function assertSnapshot(s,scope){
 if(!s||s.version!==1||s.scope!==scope||!s.docs||!s.sources)fail('invalid snapshot');
 for(const file of files(scope))if(!(file in s.docs))fail('missing snapshot '+file);
}
function assertOriginalsUnchanged(base,scanned,name,key){
 const b=base[name],s=scanned[name];
 if(!Array.isArray(b)||!Array.isArray(s))fail('invalid array '+name);
 const map=new Map(s.map(x=>[x[key],x]));
 if(map.size!==s.length)fail('duplicate '+name+' identifiers from scanner');
 for(const row of b){
  if(!map.has(row[key])||stringify(map.get(row[key]))!==stringify(row))
   fail('scanner changed/deleted existing '+name+' '+row[key]);
 }
}
const roster=r=>Array.isArray(r.players)&&r.players.length?r.players:[r.player];
function roundKey(r){
 const text=String(r.round||'');
 const event=text.match(/Event\s*(\d+)/i),day=text.match(/Day\s*(\d+)/i),round=text.match(/Round\s*([12])/i);
 if(round&&(event||day))return (event?'event'+Number(event[1]):'day'+Number(day[1]))+'/round'+round[1];
 try{
  const uri=new URL(r.source);
  const remote=uri.searchParams.get('window')||uri.searchParams.get('round');
  if(remote)return remote.toLowerCase();
 }catch{}
 return text.replace(/\/\s*(?:予選(?:突破|通過)?|賞金決勝|決勝|参加確認|スキン大会)$/u,'').trim();
}
function logicalKey(row){
 if(!row?.date||!row.region||!row.tournamentId||!roster(row).length)fail('missing publication identity');
 return [row.date,row.region,row.tournamentId,roundKey(row),
   roster(row).slice().sort((a,b)=>String(a).localeCompare(String(b),'ja')).join('|')].join('\u001f');
}
function mergeCheckpoint(base,scan,latest,conflicts,windowId){
 if(scan===undefined)return clone(latest);
 if(latest===undefined)return clone(scan);
 if(stringify(scan)===stringify(base))return clone(latest);
 if(stringify(latest)===stringify(base))return clone(scan);
 // A concurrent reset is deliberate, for example old Unreal windows without
 // original Epic IDs: do not resurrect pages that latest explicitly discarded.
 if(base&&Number(latest.nextPage)<Number(base.nextPage))return clone(latest);
 const scanPage=Number(scan.nextPage)||0,latestPage=Number(latest.nextPage)||0;
 const choice=latestPage>scanPage?latest:scan;
 const output=clone(choice);
 const entries=new Map();
 for(const row of latest.proposals||[])if(typeof row?.id==='string')entries.set(row.id,row);
 for(const row of scan.proposals||[]){
  if(typeof row?.id!=='string')continue;
  if(entries.has(row.id)&&stringify(entries.get(row.id))!==stringify(row)){
   conflicts.push({id:row.id,reason:'checkpoint candidate differs',window:windowId});
   continue;
  }
  entries.set(row.id,row);
 }
 output.proposals=[...entries.values()];
 output.nextPage=Math.max(scanPage,latestPage);
 output.pages=Math.max(Number(scan.pages)||0,Number(latest.pages)||0);
 output.complete=Boolean(scan.complete||latest.complete);
 if(output.complete){delete output.retryAfter;delete output.lastError}
 return output;
}
function mergeSnapshots(scope,base,scanned,latest,reviewed={version:1,entries:[]}){
 assertSnapshot(base,scope);assertSnapshot(scanned,scope);assertSnapshot(latest,scope);
 if(changedSources(base.sources,scanned.sources).length)fail('approval inputs changed during scan');
 if(changedSources(base.sources,latest.sources).length)
  fail('approval identity/rules/source changed on remote: fresh scan required');
 const p=prefix(scope),rFile='results.json',uFile='updates.json',
  qFile=p+'-review.json',sFile=p+'-status.json',cFile=p+'-scan.json';
 const b=base.docs,c=scanned.docs,n=latest.docs;
 if(!b[uFile]?.entries||!c[uFile]?.entries||!n[uFile]?.entries||
    !b[qFile]?.proposals||!c[qFile]?.proposals||!n[qFile]?.proposals||
    !b[cFile]?.windows||!c[cFile]?.windows||!n[cFile]?.windows||
    !n[sFile]||!c[sFile]||!Array.isArray(reviewed.entries))
  fail('invalid latest or scanned data shape');
 assertOriginalsUnchanged(b,c,rFile,'id');
 assertOriginalsUnchanged(b[uFile],c[uFile],'entries','id');
 const existing=new Map(),semantic=new Map();
 for(const row of n[rFile]){
  if(!row?.id||existing.has(row.id))fail('remote public results contains repeated ID');
  existing.set(row.id,row);
  const key=logicalKey(row);
  if(!semantic.has(key))semantic.set(key,row);
 }
 const reviewedIds=new Set(reviewed.entries.map(x=>x.id));
 const conflicts=[],appended=[],duplicates=[];
 const baseIds=new Set(b[rFile].map(x=>x.id));
 for(const candidate of c[rFile]){
  if(baseIds.has(candidate.id))continue;
  if(candidate.verified!==true||candidate.reviewOnly===true||
      candidate.kind==='参加確認'||candidate.prize===undefined)
   fail('scanner attempted an unverified publication: '+candidate.id);
  if(reviewedIds.has(candidate.id)){duplicates.push(candidate.id);continue}
  const same=existing.get(candidate.id);
  if(same){
   if(stringify(same)===stringify(candidate))duplicates.push(candidate.id);
   else conflicts.push({id:candidate.id,reason:'different score for existing ID',source:candidate.source});
   continue;
  }
  const logical=semantic.get(logicalKey(candidate));
  if(logical){
   const fields=['rank','points','kills','vrs','matches','prize','prizePerPlayer'];
   const equal=fields.every(k=>stringify(logical[k])===stringify(candidate[k]));
   if(equal)duplicates.push(candidate.id);
   else conflicts.push({id:candidate.id,existingId:logical.id,reason:'same player/round but conflicting score',source:candidate.source});
   continue;
  }
  existing.set(candidate.id,candidate);
  semantic.set(logicalKey(candidate),candidate);
  appended.push(candidate);
 }
 const results=[...n[rFile],...appended];
 const newResultIds=new Set(appended.map(x=>x.id));
 const updates=clone(n[uFile]);
 const latestUpdateIds=new Set(updates.entries.map(e=>e.id));
 const registered=new Set(updates.entries.flatMap(e=>Array.isArray(e.recordIds)?e.recordIds:[]));
 const baseUpdateIds=new Set(b[uFile].entries.map(e=>e.id));
 const newLogIds=new Set();
 for(const update of c[uFile].entries){
  if(baseUpdateIds.has(update.id))continue;
  if(update.type!=='records'||!Array.isArray(update.recordIds)||!update.recordIds.length)
   fail('scanner created an unexpected update entry');
  const ids=update.recordIds.filter(id=>newResultIds.has(id)&&!registered.has(id));
  if(!ids.length)continue;
  if(latestUpdateIds.has(update.id)||newLogIds.has(update.id))
   fail('generated update ID collision: '+update.id);
  const entry=clone(update);
  if(ids.length!==update.recordIds.length){
   entry.recordIds=ids;
   entry.title='公式規則で自動承認：'+(scope==='history'?'過去大会':'新着大会')+ids.length+'戦績（競合解消後）';
   entry.description='最新版と照合して既存戦績を保持し、未登録の公式規則検証済み戦績'+ids.length+'件のみ追記。重複候補は追加せず、元の賞金額と大会記録を変更しない。';
  }
  updates.entries.unshift(entry);
  latestUpdateIds.add(entry.id);newLogIds.add(entry.id);
  for(const id of entry.recordIds)registered.add(id);
 }
 if(appended.some(x=>!registered.has(x.id)))fail('approved record lacks update-log proof');
 updates.entries.sort((x,y)=>y.date.localeCompare(x.date));
 const review=clone(n[qFile]);
 const baseReviewIds=new Set(b[qFile].proposals.map(x=>x.id));
 const reviewIds=new Set(review.proposals.map(x=>x.id));
 const queueExtra=c[qFile].proposals.filter(x=>!baseReviewIds.has(x.id));
 const candidates=[...queueExtra,...conflicts.map(x=>{
  const row=c[rFile].find(r=>r.id===x.id);
  return row?{...row,reviewReason:'自動掲載を保留：競合 '+x.reason+(x.existingId?'（既存 '+x.existingId+'）':'')} :null;
 }).filter(Boolean)];
 for(const row of candidates){
  if(reviewIds.has(row.id)||existing.has(row.id)||reviewedIds.has(row.id))continue;
  reviewIds.add(row.id);review.proposals.push(row);
 }
 // Both snapshot and remote review lists may contain stale, now adjudicated IDs.
 review.proposals=review.proposals.filter(row=>!existing.has(row.id)&&!reviewedIds.has(row.id));
 const checkpoint=clone(n[cFile]);
 const baseWin=b[cFile].windows,scanWin=c[cFile].windows;
 for(const [key,value] of Object.entries(scanWin)){
  if(stringify(value)===stringify(baseWin[key]))continue;
  checkpoint.windows[key]=mergeCheckpoint(baseWin[key],value,checkpoint.windows[key],conflicts,key);
 }
 checkpoint.checkedAt=[checkpoint.checkedAt,c[cFile].checkedAt].filter(Boolean).sort().at(-1);
 const scanStatus=c[sFile],latestStatus=n[sFile],stamp=scanStatus.checkedAt||'';
 const status=stamp>String(latestStatus.checkedAt||'')?{...latestStatus,...scanStatus}:{...scanStatus,...latestStatus};
 // Manual adjudications performed while the scan ran ALWAYS take precedence.
 for(const [k,v] of Object.entries(latestStatus))
  if(/^manual|^lastCorrectedReviewAt$|^lastReviewedBatchAt$/.test(k))status[k]=v;
 status.found=review.proposals.length;
 status.reviewOnlyCandidates=review.proposals.filter(x=>x.reviewOnly===true).length;
 status.manualReviewCandidates=review.proposals.length;
 status.imported=appended.length;
 status.autoApprovedTotal=updates.entries.filter(x=>x.title?.startsWith('公式規則で自動承認：'))
  .reduce((total,x)=>total+(x.recordIds?.length||0),0);
 status.concurrentMerge={appended:appended.length,alreadyPublished:duplicates.length,
  reviewConflicts:conflicts.length,keptPending:review.proposals.length,
  reconciledAt:new Date().toISOString()};
 status.message='最新版と安全統合：新規掲載'+appended.length+'件、重複スキップ'+duplicates.length+
  '件、要確認の競合'+conflicts.length+'件、確認待ち'+review.proposals.length+'件。既存の戦績・賞金は保持。';
 return {docs:{[rFile]:results,[uFile]:updates,[qFile]:review,[cFile]:checkpoint,[sFile]:status},
  report:status.concurrentMerge};
}
function saveMerged(scope,data,root=path.resolve(__dirname,'..')){
 // Publish sharded results and their compatibility projection before logs.
 publishResults(root,data.docs['results.json']);
 for(const file of files(scope)){
  if(file==='results.json')continue;
  const original=path.join(root,file),temp=original+'.safe-sync-tmp';
  fs.writeFileSync(temp,JSON.stringify(data.docs[file],null,2)+'\n');
  fs.renameSync(temp,original);
 }
}
if(require.main===module){
 try{
  const [action,scope,...args]=process.argv.slice(2);
  if(!VALID_SCOPES.has(scope))fail('usage: snapshot|merge <history|auto> ...');
  if(action==='snapshot'){
   if(args.length!==1)fail('snapshot requires output path');
   const snap=snapshot(scope);fs.writeFileSync(args[0],JSON.stringify(snap));
   console.log('AOT_SAFE_SYNC_CAPTURE '+JSON.stringify({scope,rows:snap.docs['results.json'].length}));
  }else if(action==='check-sources'){
   if(args.length!==1)fail('check-sources requires a base snapshot path');
   const base=JSON.parse(fs.readFileSync(args[0],'utf8'));
   assertSnapshot(base,scope);
   const changed=changedSources(base.sources,sourceHashes(path.resolve(__dirname,'..'),scope));
   console.log('AOT_SAFE_SYNC_SOURCE_CHECK '+JSON.stringify({scope,changed,needsFreshScan:changed.length>0}));
   // Distinguish a valid stale snapshot from a programming or filesystem error.
   if(changed.length)process.exitCode=10;
  }else if(action==='merge'){
   if(args.length!==2)fail('merge requires base and scanned snapshot paths');
   const base=JSON.parse(fs.readFileSync(args[0],'utf8'));
   const scanned=JSON.parse(fs.readFileSync(args[1],'utf8'));
   const latest=snapshot(scope);
   const ledger=read(path.resolve(__dirname,'..'),'history-sync-reviewed.json');
   const output=mergeSnapshots(scope,base,scanned,latest,ledger);
   saveMerged(scope,output);
   console.log('AOT_SAFE_SYNC_MERGED '+JSON.stringify(output.report));
  }else fail('unknown action '+action);
 }catch(error){console.error('AOT_SAFE_SYNC_ERROR '+error.stack);process.exitCode=1}
}
module.exports={snapshot,mergeSnapshots,logicalKey,roundKey,mergeCheckpoint,changedSources};
