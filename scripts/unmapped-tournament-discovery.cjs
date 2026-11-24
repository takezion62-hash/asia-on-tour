'use strict';
// Advisory only. Provider listings are not official rules or payout evidence.
// Keep every distinct event ID, with bounded representative window samples.
const fs=require('node:fs'),path=require('node:path');
const {template,diagnose}=require('./tournament-registration-preview.cjs');
const REGION_ORDER=['ME','EU','NAC','NAW','OCE','BR'];
const EVENT=/^S[0-9]+_.+$/;
const MAX_SAMPLES_PER_REGION=3;
const sorted=x=>[...new Set(x)].sort();
const dateOK=x=>typeof x==='string'&&Number.isFinite(Date.parse(x));
const jst=utc=>new Date(Date.parse(utc)+9*3600000).toISOString().slice(0,10);
const windowKey=w=>JSON.stringify([w.fullEventId,w.windowId,w.startUtc,w.endUtc]);
function orderedWindows(rows){
 const unique=new Map();
 for(const w of rows)unique.set(windowKey(w),w);
 return [...unique.values()].sort((a,b)=>b.startUtc.localeCompare(a.startUtc)||a.windowId.localeCompare(b.windowId)||a.fullEventId.localeCompare(b.fullEventId)||a.endUtc.localeCompare(b.endUtc));
}
function samples(windows){
 return REGION_ORDER.flatMap(region=>windows.filter(w=>w.region===region).slice(0,MAX_SAMPLES_PER_REGION));
}
function draftFor(entry){
 const draft=template();
 draft.catalog.name=entry.titles.length===1?entry.titles[0]:null;
 draft.catalog.seasonId=draft.rule.seasonId=entry.seasonId;
 draft.catalog.sourceEventIds=[entry.eventId];draft.rule.eventIds=[entry.eventId];
 // Observed regions are NOT an official complete set of eligible regions.
 // Likewise, do not guess series, mode, team, source URL or prize values.
 return draft;
}
function diagnoseEntry(entry,db){
 const draft=draftFor(entry),result=diagnose(draft,db);
 return {draft,diagnostic:{status:result.status,missing:result.missing,errors:result.errors,review:result.review,suggested:result.suggested,automaticPublicationAuthorized:false},
  researchChecklist:['公式大会名・開催シーズン・大会分類・プラットフォーム・チーム人数を照合',
   'Epic公式規則URL・対象地域・ラウンド・開催日時を確認',
   '試合数上限、突破順位、報酬形式・地域別賞金表を公式資料で確認（該当するもののみ）',
   '対応承認方式と既存規則バリデーターを確認。本人ID・順位表・重複の照合を別途実施']};
}
function buildDiscoveryReport(observations,db,{scope,observedAt=new Date().toISOString()}={}){
 if(!['recent','history'].includes(scope)||!dateOK(observedAt))throw Error('invalid discovery report scope/timestamp');
 const groups=new Map();
 for(const o of observations){
  if(!o||typeof o.eventId!=='string'||!EVENT.test(o.eventId)||!REGION_ORDER.includes(o.region)||
   o.fullEventId!=='epicgames_'+o.eventId+'_'+o.region||typeof o.windowId!=='string'||!o.windowId.endsWith('_'+o.region)||
   !dateOK(o.startUtc)||!dateOK(o.endUtc))continue;
  if(!groups.has(o.eventId))groups.set(o.eventId,{titles:[],windows:[]});
  const g=groups.get(o.eventId);
  if(typeof o.title==='string'&&o.title.trim())g.titles.push(o.title.trim().slice(0,300));
  g.windows.push({fullEventId:o.fullEventId,windowId:o.windowId,region:o.region,startUtc:new Date(o.startUtc).toISOString(),endUtc:new Date(o.endUtc).toISOString(),dateJst:jst(o.startUtc)});
 }
 const entries=[];
 for(const [eventId,g] of groups){
  const windows=orderedWindows(g.windows),dates=sorted(windows.map(w=>w.dateJst));
  const identities=new Set(windows.map(w=>JSON.stringify([w.fullEventId,w.windowId])));
  const entry={eventId,seasonId:eventId.split('_')[0],titles:sorted(g.titles),
   observedRegions:REGION_ORDER.filter(r=>windows.some(w=>w.region===r)),
   firstDateJst:dates[0],lastDateJst:dates.at(-1),windowCount:identities.size,
   observationCount:windows.length,conflictingWindowTimes:windows.length>identities.size,
   invalidWindowTimes:windows.some(w=>Date.parse(w.endUtc)<=Date.parse(w.startUtc)),
   sampleWindows:samples(windows),sampleLimitPerRegion:MAX_SAMPLES_PER_REGION,
   lookupUrl:'https://www.fortnite.com/competitive/events/'+encodeURIComponent(eventId)+'/'};
  const {diagnostic}=diagnoseEntry(entry,db);
  entries.push({...entry,missingFields:sorted(diagnostic.missing.map(x=>x.field)),
   diagnosisStatus:diagnostic.status,automaticPublicationAuthorized:false});
 }
 entries.sort((a,b)=>a.eventId.localeCompare(b.eventId));
 return {version:1,provider:'osirion',scope,observedAt,totalEvents:entries.length,entries,
  automaticPublicationAuthorized:false};
}
function validReport(report){
 return report?.version===1&&report.provider==='osirion'&&['recent','history'].includes(report.scope)&&dateOK(report.observedAt)&&Array.isArray(report.entries);
}
// A manually refreshed status.checkedAt does not change the freshness of a
// successful provider discovery snapshot. On equal observation times prefer latest.
function newestDiscoveryReport(scanned,latest){
 if(!validReport(scanned))return validReport(latest)?latest:undefined;
 if(!validReport(latest))return scanned;
 return Date.parse(scanned.observedAt)>Date.parse(latest.observedAt)?scanned:latest;
}
// Merge the two latest scope snapshots by exact event ID, not title.
// Do not add scope window counts (recent and history can overlap).
function combineReports(statuses,tournaments){
 const registered=new Set(tournaments.catalog.flatMap(c=>(c.sourceEventIds||[]).map(id=>c.seasonId+'|'+id)));
 const groups=new Map(),scopes=[];
 for(const [scope,status] of Object.entries(statuses)){
  const report=status?.unmappedDiscovery;
  if(!validReport(report)||report.scope!==scope){
   scopes.push({scope,available:false,legacyCount:status?.unmappedEvents??null,legacyIdSample:status?.unmappedEventIds??[]});continue;
  }
  scopes.push({scope,available:true,observedAt:report.observedAt,totalEvents:report.totalEvents});
  for(const entry of report.entries){
   if(!entry||typeof entry.eventId!=='string'||!EVENT.test(entry.eventId)||entry.seasonId!==entry.eventId.split('_')[0]||
    registered.has(entry.seasonId+'|'+entry.eventId))continue;
   if(!groups.has(entry.eventId))groups.set(entry.eventId,[]);
   groups.get(entry.eventId).push({scope,observedAt:report.observedAt,entry});
  }
 }
 const entries=[];
 for(const [eventId,rows] of groups){
  const allWindows=orderedWindows(rows.flatMap(x=>x.entry.sampleWindows||[]));
  const dates=rows.flatMap(x=>[x.entry.firstDateJst,x.entry.lastDateJst]).filter(Boolean).sort();
  entries.push({eventId,seasonId:eventId.split('_')[0],titles:sorted(rows.flatMap(x=>x.entry.titles||[])),
   observedRegions:REGION_ORDER.filter(region=>rows.some(x=>x.entry.observedRegions?.includes(region))),
   firstDateJst:dates[0]??null,lastDateJst:dates.at(-1)??null,
   scopeCounts:rows.map(x=>({scope:x.scope,observedAt:x.observedAt,windowCount:x.entry.windowCount})),
   sampleWindows:samples(allWindows),sampleLimitPerRegion:MAX_SAMPLES_PER_REGION,
   conflictingWindowTimes:rows.some(x=>x.entry.conflictingWindowTimes)||allWindows.length>new Set(allWindows.map(w=>JSON.stringify([w.fullEventId,w.windowId]))).size,
   invalidWindowTimes:rows.some(x=>x.entry.invalidWindowTimes),
   lookupUrl:'https://www.fortnite.com/competitive/events/'+encodeURIComponent(eventId)+'/',
   missingFields:sorted(rows.flatMap(x=>x.entry.missingFields||[])),diagnosisStatus:'blocked',automaticPublicationAuthorized:false});
 }
 entries.sort((a,b)=>String(b.lastDateJst).localeCompare(String(a.lastDateJst))||a.eventId.localeCompare(b.eventId));
 return {version:1,totalEvents:entries.length,scopes,entries,automaticPublicationAuthorized:false,
  note:'最新の成功した新着・過去スキャンの候補。実際の公式ルール・開催時刻・報酬は未確認。未取得範囲は網羅しない。'};
}
function main(args=process.argv.slice(2)){
 const root=path.resolve(__dirname,'..'),read=n=>JSON.parse(fs.readFileSync(path.join(root,n),'utf8'));
 const db={registry:read('tournament-rules.json'),tournaments:read('tournaments.json'),recent:read('auto-sync-config.json'),history:read('history-sync-config.json')};
 const report=combineReports({recent:read('auto-sync-status.json'),history:read('history-sync-status.json')},db.tournaments);
 if(!args.length){console.log(JSON.stringify(report,null,2));return}
 if(args.length!==2||args[0]!=='--event')throw Error('使い方: npm run tournament:discover -- [--event <EpicイベントID>]');
 const entry=report.entries.find(x=>x.eventId===args[1]);
 if(!entry)throw Error('未登録候補の詳細がありません。次回の成功スキャン・既存カタログを確認してください: '+args[1]);
 console.log(JSON.stringify({entry,...diagnoseEntry(entry,db)},null,2));
}
if(require.main===module){try{main()}catch(e){console.error(e.message);process.exitCode=2}}
module.exports={buildDiscoveryReport,combineReports,newestDiscoveryReport,draftFor,diagnoseEntry};
