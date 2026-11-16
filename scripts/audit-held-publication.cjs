'use strict';
// Independent read-only audit of manual-held results, public season indexes and
// publication metadata. Runs in CI even when no publication script is invoked.
const fs=require('node:fs');
const path=require('node:path');
const {readResults}=require('./source-results-store.cjs');
const ROOT=path.resolve(__dirname,'..');
const read=(root,file)=>JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));

function inspect({manifest,sourceRows,seasonShards,updates,ledger,reviewed,autoReview,historyReview}){
 const errors=[],ids=new Set();
 const issue=(file,id,message)=>errors.push({file,id,message});
 if(!manifest||!Array.isArray(manifest.held))
  throw Error('HELD_PUBLICATION_AUDIT invalid held manifest');
 const collections=[
  ['source-results/manifest.json',sourceRows,'id'],
  ...seasonShards.map(s=>[s.file,s.rows,'id']),
  ['updates.json',updates.entries,'recordIds'],
  ['approval-history.json',ledger.entries,'approval'],
  ['history-sync-reviewed.json',reviewed.entries,'approval']
 ];
 for(const [file,rows] of collections)
  if(!Array.isArray(rows))throw Error('HELD_PUBLICATION_AUDIT malformed records in '+file);
 if(!Array.isArray(autoReview.proposals)||!Array.isArray(historyReview.proposals))
  throw Error('HELD_PUBLICATION_AUDIT invalid pending review queues');
 for(const hold of manifest.held){
  const id=hold?.id;
  if(typeof id!=='string'||!id||ids.has(id)||hold.candidate?.id!==id||
     hold.candidate?.reviewOnly!==true||hold.candidate?.prize!==null)
   throw Error('HELD_PUBLICATION_AUDIT malformed or duplicate pinned hold '+String(id));
  ids.add(id);
  for(const [file,rows,kind] of collections){
   const matches=rows.filter(row=>kind==='recordIds'
    ? row?.recordIds?.includes(id)
    : kind==='approval' ? row?.id===id||row?.recordId===id : row?.id===id);
   if(matches.length)issue(file,id,'保留中の戦績IDが公開または承認済みデータに存在 ('+matches.length+'件)');
  }
  const pending=[
   ...autoReview.proposals.filter(row=>row?.id===id),
   ...historyReview.proposals.filter(row=>row?.id===id)
  ];
  if(pending.length!==1)
   issue('history-sync-review.json',id,'保留IDの確認待ち登録が'+pending.length+'件（必要:1件）');
  else if(pending[0].reviewOnly!==true||pending[0].source!==hold.source)
   issue('history-sync-review.json',id,'確認待ち候補の保留状態または公式出典が変更された');
 }
 return {held:ids.size,checkedSeasonShards:seasonShards.length,errors};
}
function audit(root=ROOT){
 const seasonDir=path.join(root,'season-data');
 if(!fs.existsSync(seasonDir))
  throw Error('HELD_PUBLICATION_AUDIT season-data directory missing');
 const seasonFiles=fs.readdirSync(seasonDir).filter(name=>/^(?:S\d+|unknown)\.json$/.test(name));
 if(!seasonFiles.length)throw Error('HELD_PUBLICATION_AUDIT no public season shards');
 return inspect({
  manifest:read(root,'data/manual-approvals/review-only-generic-v1.json'),
  sourceRows:readResults(root).rows,
  seasonShards:seasonFiles.map(file=>({file:'season-data/'+file,rows:read(root,'season-data/'+file)})),
  updates:read(root,'updates.json'),
  ledger:read(root,'approval-history.json'),
  reviewed:read(root,'history-sync-reviewed.json'),
  autoReview:read(root,'auto-sync-review.json'),
  historyReview:read(root,'history-sync-review.json')
 });
}
function main(){
 const result=audit();
 for(const entry of result.errors){
  console.error('HELD_PUBLICATION_AUDIT ERROR '+entry.file+' '+entry.id+': '+entry.message);
  if(process.env.GITHUB_ACTIONS){
   const message=(entry.id+': '+entry.message).replace(/%/g,'%25').replace(/\r/g,'%0D').replace(/\n/g,'%0A');
   console.log('::error file='+entry.file+'::'+message);
  }
 }
 console.log('HELD_PUBLICATION_AUDIT '+JSON.stringify({
  held:result.held,checkedSeasonShards:result.checkedSeasonShards,violations:result.errors.length
 }));
 if(result.errors.length)process.exitCode=1;
}
if(require.main===module){
 try{main()}catch(e){
  console.error(e.stack||e);
  if(process.env.GITHUB_ACTIONS)console.log('::error::HELD_PUBLICATION_AUDIT failed to inspect public data');
  process.exitCode=1;
 }
}
module.exports={inspect,audit};
