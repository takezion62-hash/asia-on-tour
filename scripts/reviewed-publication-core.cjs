'use strict';
// Shared I/O and audit-log lifecycle for manually reviewed tournament publishers.
// Award, advancement, player identity and cosmetic rules remain in their existing validators.
const fs=require('node:fs');
const path=require('node:path');
const {readResults,publishResults}=require('./source-results-store.cjs');
const readJson=(root,name)=>name==='results.json'?readResults(root).rows:JSON.parse(fs.readFileSync(path.join(root,name),'utf8'));
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
function upsertPublicationLog(updates,{id,date,title,description,recordIds,existingDescription,existingTitle}){
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
  if(typeof existingTitle==='function')existing.title=existingTitle(existing.recordIds.length);
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
 for(const [name,value] of files){
  if(name==='results.json')publishResults(root,value);
  else fs.writeFileSync(path.join(root,name),JSON.stringify(value,null,2)+'\n');
 }
}

/**
 * Filesystem adapter shared by historical event publishers. Exact JSON format
 * and per-file writes are unchanged; dry-run decisions stay with the callers.
 */
function createPublicationFiles(root){
 return {
  read:name=>readJson(root,name),
  write:(name,value)=>name==='results.json'?publishResults(root,value):fs.writeFileSync(path.join(root,name),JSON.stringify(value,null,2)+'\n')
 };
}
/**
 * Identical Epic-ID, authoritative session and saved-ranking verification
 * used by the two 2026-11-11 round publishers. No award or qualification
 * decision is made here: their event-specific classifiers remain separate.
 */
function verifyEpicReviewEvidence(r,spec,context){
 const {requireValid,catalog,known,d,read,resultIds,approvedIds,equalCandidate,collision}=context;
 requireValid(r.date===spec.date&&r.region===spec.region&&r.tournamentId===spec.tournamentId&&
  r.seasonId===spec.season&&r.verified===true,'official session differs');
 const url=new URL(r.source);
 requireValid(url.protocol==='https:'&&url.hostname==='www.fortnite.com'&&
  url.pathname==='/competitive/events/'+spec.event+'/'&&
  url.searchParams.get('region')===spec.region&&url.searchParams.get('round')===spec.window&&
  !url.username&&!url.password&&!url.hash,'Epic official event URL differs');
 const cat=catalog.get(r.tournamentId);
 const members={solo:1,duo:2,trio:3,squad:4}[cat?.team];
 requireValid(cat&&cat.name===r.event&&cat.seasonId===spec.season&&
  cat.sourceEventIds?.includes(spec.event)&&members,'event master mismatch');
 const team=Array.isArray(r.players)&&r.players.length?r.players:[r.player];
 requireValid(team.length===members&&team.every(x=>known.has(x))&&
  new Set(team).size===members&&r.player===team.join(' / '),'team Epic ID roster unverified');
 requireValid(Number.isSafeInteger(r.rank)&&r.rank>0&&
  Number.isSafeInteger(r.points)&&r.points>=0&&
  Number.isSafeInteger(r.kills)&&r.kills>=0&&
  Number.isSafeInteger(r.vrs)&&r.vrs>=0&&
  Number.isSafeInteger(r.matches)&&r.matches>0&&r.vrs<=r.matches,
  'rank or scored values invalid');
 const key='epicgames_'+spec.event+'_'+spec.region+'/'+spec.window;
 const candidates=[];
 for(const scan of Object.values(d.scans)){
  if(!scan?.windows)continue;
  const cp=scan.windows[key];
  if(cp)candidates.push(cp);
 }
 requireValid(candidates.length>0,'original Epic scoreboard was not saved');
 const matching=candidates.filter(cp=>cp.rankingOrderValid===true&&cp.nextPage>0&&
  Number.isSafeInteger(cp.lastSeenRank)&&cp.lastSeenRank>=r.rank&&
  Array.isArray(cp.proposals)&&
  cp.proposals.filter(x=>x.id===r.id&&equalCandidate(x,r)).length===1);
 requireValid(matching.length>0,'original Epic-ID leaderboard rank/score did not match saved checkpoint');
 const month=r.date.slice(0,7);
 if(!d.calendar[month])d.calendar[month]=read('calendar-history/'+month+'.json').sessions;
 requireValid(d.calendar[month]?.some(x=>x.eventId===spec.event&&x.sourceWindowId===spec.window&&
  x.dateJst===r.date&&x.region===r.region&&x.tournamentId===r.tournamentId&&
  x.seasonId===r.seasonId),'official calendar date or region mismatch');
 requireValid(!resultIds.has(r.id)&&!approvedIds.has(r.id),'previously approved ID');
 requireValid(!d.results.some(x=>collision(x,r,d.players.confirmedAliases||{})),
  'overlapping existing achievement, manual reconciliation required');
}
module.exports={loadReviewDb,upsertPublicationLog,writeReviewDb,createPublicationFiles,verifyEpicReviewEvidence};

