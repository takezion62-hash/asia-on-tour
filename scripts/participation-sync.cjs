'use strict';
// Independent best-effort, bounded scanner for players already linked to an Epic ID.
// It never writes results.json, updates.json, PR data or achievement data.
const fs=require('node:fs'),path=require('node:path');
const {linkedAccounts,discover,normalizeRow,getTournaments,getLeaderboard,advancementLimit,historicalEvidenceScore}=require('./osirion-sync.cjs');
const {prepare}=require('./auto-sync-core.cjs');
const {appendArchive}=require('./participation-archive.cjs');
const root=path.resolve(__dirname,'..');
const read=f=>JSON.parse(fs.readFileSync(path.join(root,f),'utf8'));
const write=(f,obj)=>fs.writeFileSync(path.join(root,f),JSON.stringify(obj,null,2)+'\n');
const nowJst=()=>new Date(Date.now()+9*3600000).toISOString().slice(0,10);
function chooseWindows(windows,state,config,now=Date.now(),records=[]){
 const available=windows.filter(w=>{
  const item=state.windows[w.key];
  if(item?.complete&&!item.coverageLimited)return false;
  if(item?.coverageLimited&&item.nextPage>=(config.maxPagesPerWindowTotal||40))return false;
  return !item?.retryAfter||Date.parse(item.retryAfter)<=now;
 });
 const fresh=available.filter(w=>now-w.end<14*86400000).sort((a,b)=>b.end-a.end);
 const progressing=available.filter(w=>state.windows[w.key]?.nextPage>0).sort((a,b)=>
   String(state.windows[a.key]?.lastScanned||'').localeCompare(String(state.windows[b.key]?.lastScanned||''))||a.end-b.end);
 const qualifiers=available.filter(w=>w.series==='victory-cup'&&w.kind==='予選').sort((a,b)=>b.end-a.end);
 const older=available.filter(w=>!state.windows[w.key]?.nextPage).sort((a,b)=>a.end-b.end);
 const byEvidence=(a,b)=>historicalEvidenceScore(b,records)-historicalEvidenceScore(a,records)||a.end-b.end;
 const legacy2024=available.filter(w=>w.dateJst?.startsWith('2024')).sort(byEvidence);
 const legacy2025=available.filter(w=>w.dateJst?.startsWith('2025')).sort(byEvidence);
 const limit=Math.max(1,config.maxWindowsPerRun||5),chosen=[],seen=new Set();
 const add=(pool,max)=>{for(const w of pool){if(chosen.length>=limit||max<=0)break;if(seen.has(w.key))continue;chosen.push(w);seen.add(w.key);max--}};
 add(fresh,1);
 add(progressing,1);
 // Reserve separate 2024 and 2025 slots before recent qualifying rounds take over.
 add(legacy2024,1);
 add(legacy2025,1);
 add(older,Math.min(1,limit-chosen.length));
 add(qualifiers,limit-chosen.length);
 add(available.sort((a,b)=>b.end-a.end),limit-chosen.length);
 return chosen;
}
async function main(){
 const config=read('participation-config.json');
 if(!config.enabled){console.log('PARTICIPATION_DISABLED');return}
 if(config.version!==1||config.provider!=='osirion'||!/^(?:20)\d{2}-\d{2}-\d{2}$/.test(config.fromDate))throw Error('invalid participation config');
 if(!Number.isSafeInteger(config.maxPagesPerRun)||config.maxPagesPerRun<1||config.maxPagesPerRun>40
  ||!Number.isSafeInteger(config.maxPagesPerWindowTotal)||config.maxPagesPerWindowTotal<1||config.maxPagesPerWindowTotal>100)throw Error('unsafe page limits');
 const data={results:read('results.json'),players:read('players.json'),tournaments:read('tournaments.json')};
 const {accounts,conflicts}=linkedAccounts(data);
 if(!accounts.length)throw Error('No linked Epic accounts; refusing empty sync');
 const state=read('participation-scan.json');
 if(state.version!==1||!state.windows||typeof state.windows!=='object')throw Error('invalid participation scan state');
 const all=await getTournaments(true);
 const found=discover(all,data.tournaments.catalog,{...config,toDate:nowJst()},Date.now());
 const selected=chooseWindows(found,state,config,Date.now(),data.results);
 let remaining=config.maxPagesPerRun,pagesScanned=0,invalid=0,empty=0,failed=0;
 const items=[];
 for(const win of selected){
  const checkpoint=state.windows[win.key]||{nextPage:0,pages:0,complete:false,coverageLimited:false};
  if(checkpoint.coverageLimited&&checkpoint.nextPage<(config.maxPagesPerWindowTotal||40)){checkpoint.complete=false;checkpoint.coverageLimited=false}
  if(checkpoint.nextPage>=(config.maxPagesPerWindowTotal||40))continue;
  const preview={version:1,accounts,windows:[{
   eventId:win.eventId,windowId:win.windowId,dateJst:win.dateJst,region:win.region,
   seasonId:win.seasonId,tournamentId:win.tournamentId,kind:win.kind,round:win.round
  }]};
  const cutoff=advancementLimit(win);
  let perWin=0;
  const limit=Math.max(1,Math.min(config.maxPagesPerWindowPerRun||8,config.maxPagesPerWindowTotal));
  while(remaining>0&&perWin<limit&&!checkpoint.complete){
   const page=checkpoint.nextPage;
   try {
    const board=await getLeaderboard(win,page);
    if(board.totalPages<=page){checkpoint.complete=true;break}
    if(!board.entries.length){
     checkpoint.emptyAttempts=(checkpoint.emptyAttempts||0)+1;
     checkpoint.retryAfter=new Date(Date.now()+Math.min(checkpoint.emptyAttempts,7)*86400000).toISOString();
     empty++;break;
    }
    const rows=board.entries.map(e=>normalizeRow(e,win));
    invalid+=rows.filter(e=>!e).length;
    const proposals=prepare({entries:rows.filter(Boolean)},preview,data).proposals;
    // No rank cutoff here: even below the qualifying line, verified players
    // may be archived as participation. No record goes into results.json.
    items.push({win,cutoff,proposals});
    checkpoint.nextPage=page+1;checkpoint.pages++;checkpoint.totalPages=board.totalPages;
    checkpoint.lastScanned=new Date().toISOString();
    checkpoint.emptyAttempts=0;delete checkpoint.retryAfter;
    perWin++;remaining--;pagesScanned++;
    if(checkpoint.nextPage>=board.totalPages)checkpoint.complete=true;
    else if(checkpoint.nextPage>=config.maxPagesPerWindowTotal){checkpoint.complete=true;checkpoint.coverageLimited=true}
   }catch(error){
    checkpoint.retryAfter=new Date(Date.now()+6*3600000).toISOString();
    checkpoint.lastError=String(error.message).slice(0,200);
    failed++;break;
   }
  }
  state.windows[win.key]=checkpoint;
  if(!remaining)break;
 }
 const stamp=new Date().toISOString();
 const saved=appendArchive(root,items,data.results,{checkedAt:stamp});
 const eligible=new Set(found.map(w=>w.key)),entries=Object.entries(state.windows).filter(([key])=>eligible.has(key));
 const status={version:1,state:'checked',checkedAt:stamp,scope:'participation',provider:'osirion',
  fromDate:config.fromDate,toDate:nowJst(),linkedPlayers:accounts.length,identityConflicts:conflicts.length,
  trackedWindows:found.length,completedWindows:entries.filter(([,x])=>x.complete).length,
  partialWindows:entries.filter(([,x])=>x.coverageLimited).length,
  pagesScanned,invalidRows:invalid,emptyPages:empty,failedWindows:failed,
  newRecords:saved.added,prunedPublished:saved.prunedPublished||0,total:saved.total,months:saved.months,skippedPublished:saved.skippedPublished,
  message:'Epic IDで本人照合した出場戦績を月別に保存。公式通過枠外の判定以外は通過未確認。賞金・AOT PR・称号には加算しません。全順位表を無制限には調査しません。'};
 state.checkedAt=stamp;
 write('participation-scan.json',state);
 write('participation-status.json',status);
 console.log('PARTICIPATION_SYNC '+JSON.stringify({tracked:found.length,windows:selected.length,pages:pagesScanned,added:saved.added,total:saved.total,failed,partial:status.partialWindows}));
}
if(require.main===module)main().catch(e=>{console.error('PARTICIPATION_SYNC_ERROR '+(e.stack||e));process.exitCode=1});
module.exports={chooseWindows,main};
