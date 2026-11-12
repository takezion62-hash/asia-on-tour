'use strict';
/**
 * Phase 2: source-results/*.json is the authoritative writable store.
 * results.json remains a verified compatibility projection for the site and
 * historical scripts, never a source from which changes are silently imported.
 * A complete manifest, content hashes and the original ID order are required.
 */
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {personalCents,roster,sourceInfo}=require('./data-checks.cjs');
const ROOT=path.resolve(__dirname,'..');
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const cents=x=>{
 if(x==null)return null;
 if(typeof x!=='number'||!Number.isFinite(x)||x<0||
    !Number.isSafeInteger(Math.round(x*100))||Math.abs(x*100-Math.round(x*100))>0.000001)
  throw Error('SOURCE_RESULTS invalid cash amount: '+x);
 return Math.round(x*100);
};
const fileName=id=>/^(?:S[1-9]\d*|unknown)$/.test(id)?id+'.json':null;
const readJson=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const formatted=rows=>JSON.stringify(rows,null,2)+'\n';
const stockPath=root=>path.join(root,'source-results','manifest.json');
const isProductionRoot=root=>path.resolve(root)===ROOT;

function readResults(root=ROOT,{verifyProjection=true}={}){
 const manifestFile=stockPath(root);
 if(!fs.existsSync(manifestFile)){
  if(!isProductionRoot(root) && fs.existsSync(path.join(root,'results.json')))
   return {rows:readJson(path.join(root,'results.json')),fixture:true,manifest:null};
  throw Error('SOURCE_RESULTS missing manifest; refusing legacy fallback');
 }
 const manifest=readJson(manifestFile);
 if(manifest.version!==1||!Array.isArray(manifest.shards)||!Array.isArray(manifest.recordOrder)||
    !Number.isSafeInteger(manifest.count)||!Number.isSafeInteger(manifest.teamPrizeCents)||
    !Number.isSafeInteger(manifest.personalPrizeCents))
  throw Error('SOURCE_RESULTS invalid manifest');
 const actual=new Map(),seenSeasons=new Set();
 let sumTeam=0,sumPersonal=0,sumUnknown=0;
 for(const entry of manifest.shards){
  if(!entry||!fileName(entry.seasonId)||seenSeasons.has(entry.seasonId)||
     entry.file!=='source-results/'+fileName(entry.seasonId))
   throw Error('SOURCE_RESULTS invalid or duplicate shard name');
  seenSeasons.add(entry.seasonId);
  const file=path.join(root,entry.file),bytes=fs.readFileSync(file,'utf8');
  if(sha(bytes)!==entry.sha256)throw Error('SOURCE_RESULTS shard checksum mismatch: '+entry.file);
  const rows=JSON.parse(bytes);
  if(!Array.isArray(rows)||rows.length!==entry.count)
   throw Error('SOURCE_RESULTS shard count mismatch: '+entry.file);
  let team=0,personal=0,unknown=0;
  for(const row of rows){
   if(!row||typeof row.id!=='string'||!row.id||actual.has(row.id))
    throw Error('SOURCE_RESULTS missing or duplicate ID: '+row?.id);
   actual.set(row.id,row);
   const prize=cents(row.prize);
   if(prize===null)unknown++;else team+=prize;
   personal+=personalCents(row)*roster(row).length;
  }
  if(team!==entry.teamPrizeCents||personal!==entry.personalPrizeCents||
     unknown!==entry.unconfirmedPrizeRecords)
   throw Error('SOURCE_RESULTS shard cash mismatch: '+entry.file);
  sumTeam+=team;sumPersonal+=personal;sumUnknown+=unknown;
 }
 for(const name of fs.readdirSync(path.join(root,'source-results'))){
  if(/^(?:S[1-9]\d*|unknown)\.json$/.test(name) && !seenSeasons.has(name.slice(0,-5)))
   throw Error('SOURCE_RESULTS unindexed shard on disk: '+name);
 }
 if(actual.size!==manifest.count||manifest.recordOrder.length!==manifest.count||
    sumTeam!==manifest.teamPrizeCents||sumPersonal!==manifest.personalPrizeCents||
    sumUnknown!==manifest.unconfirmedPrizeRecords)
  throw Error('SOURCE_RESULTS global ID/count/prize mismatch');
 const orderSeen=new Set();
 const rows=manifest.recordOrder.map(id=>{
  if(typeof id!=='string'||orderSeen.has(id)||!actual.has(id))
   throw Error('SOURCE_RESULTS missing/duplicate record in canonical order: '+id);
  orderSeen.add(id);
  return actual.get(id);
 });
 if(verifyProjection){
  const projection=fs.readFileSync(path.join(root,'results.json'),'utf8');
  if(sha(projection)!==manifest.canonicalSha256 ||
     JSON.stringify(JSON.parse(projection))!==JSON.stringify(rows))
   throw Error('SOURCE_RESULTS results.json projection differs from authoritative shards');
 }
 return {rows,manifest,fixture:false};
}

function seasonSelector(rows,root){
 const catalog=readJson(path.join(root,'tournaments.json')).catalog;
 if(!Array.isArray(catalog))throw Error('SOURCE_RESULTS invalid tournament catalog');
 const definitions=new Map(),conflicts=new Set();
 for(const row of [...catalog,...rows]){
  if(!/^S\d+$/.test(row?.seasonId||'')||
     !Number.isInteger(row.chapter)||row.chapter<1||
     !Number.isInteger(row.season)||row.season<1)continue;
  const old=definitions.get(row.seasonId);
  if(old&&(old.chapter!==row.chapter||old.season!==row.season))
   conflicts.add(row.seasonId);
  else definitions.set(row.seasonId,{chapter:row.chapter,season:row.season});
 }
 for(const id of conflicts)definitions.delete(id);
 return row=>{
  const source=sourceInfo(row),explicit=row.seasonId;
  if(source.conflict||(explicit!=null&&!/^S\d+$/.test(explicit))||
     (explicit&&source.seasonId!=='unknown'&&explicit!==source.seasonId))
   return 'unknown';
  const id=explicit||source.seasonId,definition=definitions.get(id);
  if(!definition||(row.chapter!=null&&row.chapter!==definition.chapter)||
     (row.season!=null&&row.season!==definition.season))return 'unknown';
  return id;
 };
}
function atomicallyWrite(file,contents){
 const tmp=file+'.aot-source-tmp';
 fs.writeFileSync(tmp,contents,'utf8');
 fs.renameSync(tmp,file);
}
function publishResults(root,rows,{legacyWriter=false,allowRemoval=false}={}){
 if(!Array.isArray(rows))throw Error('SOURCE_RESULTS expected array');
 const current=readResults(root,{verifyProjection:!legacyWriter});
 if(current.fixture){
  // Isolated unit-test fixtures created without source-results are not migrated.
  atomicallyWrite(path.join(root,'results.json'),formatted(rows));
  return {fixture:true,count:rows.length};
 }
 const oldIds=new Set(current.rows.map(x=>x.id)),newIds=new Set(rows.map(x=>x.id));
 if(newIds.size!==rows.length||newIds.has(undefined))
  throw Error('SOURCE_RESULTS invalid or duplicate next result ID');
 const missing=[...oldIds].filter(x=>!newIds.has(x));
 if(missing.length&&!allowRemoval)
  throw Error('SOURCE_RESULTS refused unexpected deletion of '+missing.length+' records');
 if(JSON.stringify(current.rows)===JSON.stringify(rows)){
  if(legacyWriter){
   const projectedFile=path.join(root,'results.json');
   const existingBytes=fs.readFileSync(projectedFile,'utf8');
   if(sha(existingBytes)!==current.manifest.canonicalSha256){
    const restored=formatted(rows);
    if(sha(restored)!==current.manifest.canonicalSha256)
     throw Error('SOURCE_RESULTS legacy reformat cannot restore original projection');
    atomicallyWrite(projectedFile,restored);
   }
  }
  return {unchanged:true,count:rows.length};
 }
 // Import only explicitly verified in-process writes; public corrections still
 // pass through their existing validators and duplicate-identity policies.
 const {buildSnapshot}=require('./build-source-results.cjs');
 const projected=formatted(rows);
 const next=buildSnapshot(rows,projected,seasonSelector(rows,root));
 const directory=path.join(root,'source-results');
 const currentNames=new Set(current.manifest.shards.map(x=>fileName(x.seasonId)));
 // Write only changed season files. Git's commit remains atomic; manifest is
 // published after all shards, and the compatibility projection is last.
 for(const [name,bytes] of next.files){
  if(name==='manifest.json')continue;
  const file=path.join(directory,name);
  if(!fs.existsSync(file)||fs.readFileSync(file,'utf8')!==bytes)
   atomicallyWrite(file,bytes);
 }
 atomicallyWrite(path.join(directory,'manifest.json'),next.files.get('manifest.json'));
 atomicallyWrite(path.join(root,'results.json'),projected);
 for(const name of currentNames)
  if(!next.files.has(name))fs.rmSync(path.join(directory,name),{force:true});
 const checked=readResults(root);
 if(checked.rows.length!==rows.length)
  throw Error('SOURCE_RESULTS post-publish count mismatch');
 return {count:checked.rows.length,shards:next.manifest.shards.length,added:rows.length-oldIds.size,
  changedShards:next.manifest.shards.filter(x=>
   current.manifest.shards.find(y=>y.seasonId===x.seasonId)?.sha256!==x.sha256)
  .map(x=>x.seasonId)};
}
function importLegacy(root=ROOT){
 const rows=readJson(path.join(root,'results.json'));
 return publishResults(root,rows,{legacyWriter:true});
}
if(require.main===module){
 try{
  const command=process.argv[2]||'verify';
  if(command==='verify'){
   const {rows,manifest}=readResults();
   if(!manifest)throw Error('No source manifest');
   console.log('SOURCE_RESULTS_VERIFIED '+JSON.stringify({count:rows.length,shards:manifest.shards.length,
    teamPrizeCents:manifest.teamPrizeCents,personalPrizeCents:manifest.personalPrizeCents}));
  }else if(command==='import-legacy'){
   console.log('SOURCE_RESULTS_IMPORTED '+JSON.stringify(importLegacy()));
  }else throw Error('Use verify or import-legacy');
 }catch(error){console.error(error.stack);process.exitCode=1}
}
module.exports={readResults,publishResults,importLegacy,seasonSelector};
