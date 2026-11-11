'use strict';
// Shared I/O and audit-log lifecycle for manually reviewed tournament publishers.
// Award, advancement, player identity and cosmetic rules remain in their existing validators.
const fs=require('node:fs');
const path=require('node:path');
const readJson=(root,name)=>JSON.parse(fs.readFileSync(path.join(root,name),'utf8'));
function loadReviewDb(root){
 return {
  results:readJson(root,'results.json'),
  players:readJson(root,'players.json'),
  tournaments:readJson(root,'tournaments.json'),
  reviews:{auto:readJson(root,'auto-sync-review.json'),history:readJson(root,'history-sync-review.json')},
  statuses:{auto:readJson(root,'auto-sync-status.json'),history:readJson(root,'history-sync-status.json')},
  scans:{auto:readJson(root,'auto-sync-scan.json'),history:readJson(root,'history-sync-scan.json')},
  ledger:readJson(root,'approval-history.json'),
  updates:readJson(root,'updates.json'),
  calendar:{}
 };
}
function upsertPublicationLog(updates,{id,date,title,description,recordIds,existingDescription}){
 if(!Array.isArray(updates?.entries)||typeof id!=='string'||!id||
  !Array.isArray(recordIds)||recordIds.length===0||
  recordIds.some(x=>typeof x!=='string'||!x)||
  new Set(recordIds).size!==recordIds.length){
  throw Error('REVIEWED_PUBLICATION invalid marker or result IDs');
 }
 const matching=updates.entries.filter(x=>x.id===id);
 if(matching.length>1)throw Error('REVIEWED_PUBLICATION duplicate update marker: '+id);
 if(matching.length){
  const existing=matching[0];
  existing.recordIds=[...new Set([...(existing.recordIds||[]),...recordIds])];
  if(typeof existingDescription==='function')existing.description=existingDescription(existing.recordIds.length);
  return existing;
 }
 const row={id,date,type:'records',title,description,recordIds:[...recordIds]};
 updates.entries.unshift(row);
 return row;
}
function writeReviewDb(root,db){
 const files=[
  ['results.json',db.results],
  ['history-sync-review.json',db.reviews.history],
  ['auto-sync-review.json',db.reviews.auto],
  ['history-sync-status.json',db.statuses.history],
  ['auto-sync-status.json',db.statuses.auto],
  ['approval-history.json',db.ledger],
  ['updates.json',db.updates]
 ];
 for(const [name,value] of files)
  fs.writeFileSync(path.join(root,name),JSON.stringify(value,null,2)+'\n');
}
module.exports={loadReviewDb,upsertPublicationLog,writeReviewDb};
