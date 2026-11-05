'use strict';
// Discover verified historical tournament session dates via the public Osirion beta API.
// These are schedule facts, NOT participation, achievement or prize records.
const fs=require('node:fs'),path=require('node:path');
const {getTournaments}=require('./osirion-sync.cjs');
const root=path.resolve(__dirname,'..');
const regions=new Set(['ME','EU','NAC','NAW','OCE','BR']);
const jst=stamp=>new Date(new Date(stamp).getTime()+9*3600000).toISOString();
const officialUrl=(id,region,round)=>'https://www.fortnite.com/competitive/events/'+encodeURIComponent(id)+'/?region='+encodeURIComponent(region)+'&round='+encodeURIComponent(round);
function stageLabel(windowId){
 const s=String(windowId);
 const event=s.match(/(?:^|_)Event(\d+)_?Round(\d+)(?:_|$)/i);
 const day=s.match(/(?:^|_)Round(\d+)_Day(\d+)(?:_|$)/i);
 const week=s.match(/(?:^|_)Week(\d+)_?Round(\d+)(?:_|$)/i);
 const session=s.match(/(?:^|_)Session(\d+)(?:_|$)/i);
 const eventOnly=s.match(/(?:^|_)Event(\d+)(?:_|$)/i);
 const round=event?Number(event[2]):day?Number(day[1]):week?Number(week[2]):null;
 let label=event?'Event '+Number(event[1])+' · Round '+round:day?'Day '+Number(day[2])+' · Round '+round:week?'Week '+Number(week[1])+' · Round '+round:session?'Session '+Number(session[1]):eventOnly?'Event '+Number(eventOnly[1]):'ラウンド詳細未確認';
 return {round:label,stage:round===1?'予選':round===2?'決勝':'単一ラウンド'};
}
// Untagged tournaments are allowed only when Fortnite's own displayData supplies
// an explicit non-empty title; raw codes never masquerade as a verified title.
function classifyUntyped(title){
 const value=String(title).toLowerCase();
 const series=/victory(?: cash)? cup/.test(value)?'victory-cup':/cash cup/.test(value)?'cash-cup':/ranked cup/.test(value)?'unknown':/performance evaluation/.test(value)?'performance-evaluation':/icon cup/.test(value)?'icon-cup':/playstation/.test(value)?'playstation-cup':/test cup/.test(value)?'test-cup':'unknown';
 const mode=/zero.build.*reload|reload.*zero.build|\bzb\b.*reload|reload.*\bzb\b/i.test(title)?'reload-zero-build':/zero.build|\bzb\b/i.test(title)?'zero-build':/reload/i.test(title)?'reload':/battle.royale/i.test(title)?'battle-royale':'unknown';
 return {series,mode};
}
function buildHistory(all,catalog,opts={}){
 const now=opts.now??Date.now(),fromDate=opts.fromDate||'2024-01-01';
 const catalogIndex=new Map();
 for(const t of catalog){
  if(!t.seasonId||!Array.isArray(t.sourceEventIds))continue;
  for(const raw of t.sourceEventIds){
   if(raw.includes('_ME')||raw.includes('_NAW')||raw.includes('_NAC')||raw.includes('_OCE')||raw.includes('_EU')||raw.includes('_BR'))continue;
   catalogIndex.set(raw,t);
  }
 }
 const selected=new Map(),missing=new Set(),missingDetails=[],ignored={};
 const skip=why=>ignored[why]=(ignored[why]||0)+1;
 for(const tournament of all){
  const matched=String(tournament.eventId||'').match(/^epicgames_(S\d+_.+)_([A-Z]{2,4})$/);
  if(!matched||!regions.has(matched[2])){skip('outside supported regions');continue}
  const [,base,region]=matched,seasonId=base.split('_')[0],catalogued=catalogIndex.get(base);
  const title=tournament.displayData?.longFormatTitle||tournament.displayData?.shortFormatTitle;
  const hasTitle=typeof title==='string'&&title.trim().length>=3&&title.trim().length<=140;
  if((catalogued?.series==='fncs'&&!/^FNCS Division 1(?: |$)/i.test(catalogued.name))
     ||(!catalogued&&/^S\d+_FNCS/i.test(base)&&!/^S\d+_FNCSDivisionalCup_Division1/i.test(base)&&!/FNCSCommunityCup/i.test(base))){
   skip('region-locked FNCS');continue;
  }
  if(!catalogued&&!hasTitle){
   if(!missing.has(base)&&missingDetails.length<14){
    missingDetails.push({id:base,reason:'missing verified displayData title'});
   }
   missing.add(base);skip('no official display title');continue;
  }
  const inferred=!catalogued?classifyUntyped(title):null;
  const entry=catalogued||{id:base,name:title.trim(),seasonId,series:inferred.series,mode:inferred.mode};
  for(const win of tournament.eventWindows||[]){
   const windowId=win.eventWindowId;
   if(typeof windowId!=='string'||!windowId.endsWith('_'+region)){skip('invalid region window');continue}
   const start=Date.parse(win.beginTime),end=Date.parse(win.endTime);
   if(!Number.isFinite(start)||!Number.isFinite(end)||start>end||end>now){skip('future or invalid timestamps');continue}
   const startUtc=new Date(start).toISOString(),iso=jst(startUtc),dateJst=iso.slice(0,10);
   if(dateJst<fromDate){skip('outside historical range');continue}
   const key=tournament.eventId+'/'+windowId;
   const labels=stageLabel(windowId);
   selected.set(key,{
    id:key,seasonId, name:entry.name,eventId:base,region,
    tournamentId:entry.id,series:entry.series,mode:entry.mode,
    round:labels.round,stage:labels.stage,
    sourceWindowId:windowId,startUtc,endUtc:new Date(end).toISOString(),
    dateJst,timeJst:iso.slice(11,16),url:officialUrl(base,region,windowId)
   });
  }
 }
 const sessions=[...selected.values()].sort((a,b)=>a.startUtc.localeCompare(b.startUtc)||a.region.localeCompare(b.region)||a.eventId.localeCompare(b.eventId));
 return {version:1,source:'Osirion public beta / Epic tournament IDs',checkedAt:new Date(now).toISOString(),fromDate,timezone:'Asia/Tokyo',
  note:'These entries confirm historical tournament windows only, not AOT player participation, prizes or eligibility. FNCS outside Division 1 is excluded.',
  sessions,unmappedCount:missing.size,unmappedSample:[...missing].slice(0,30),unmappedDetails:missingDetails,ignored};
}
async function main(){
 const catalog=JSON.parse(fs.readFileSync(path.join(root,'tournaments.json'),'utf8')).catalog;
 const all=await getTournaments(true);
 const output=buildHistory(all,catalog);
 if(!output.sessions.length)throw Error('No historical tournament windows found: preserving the prior archive');
 const fullPath=path.join(root,'calendar-history.json');
 let prior=null;
 if(fs.existsSync(fullPath)){try{prior=JSON.parse(fs.readFileSync(fullPath,'utf8'))}catch{}}
 const changed=JSON.stringify(prior?.sessions)!==JSON.stringify(output.sessions);
 const byMonth=new Map();
 for(const session of output.sessions){
  const month=session.dateJst.slice(0,7);
  if(!byMonth.has(month))byMonth.set(month,[]);
  byMonth.get(month).push(session);
 }
 if(changed){
  // Preserve the full archive as durable evidence; browsers load month-sized files.
  fs.writeFileSync(fullPath,JSON.stringify(output)+'\n');
  const archiveDir=path.join(root,'calendar-history');
  fs.mkdirSync(archiveDir,{recursive:true});
  for(const [month,sessions] of byMonth){
   fs.writeFileSync(path.join(archiveDir,month+'.json'),JSON.stringify({version:1,month,sessions})+'\n');
  }
  const index={version:1,source:output.source,builtAt:output.checkedAt,fromDate:output.sessions[0].dateJst,toDate:output.sessions.at(-1).dateJst,
   total:output.sessions.length,months:[...byMonth].map(([month,sessions])=>({month,count:sessions.length}))};
  fs.writeFileSync(path.join(root,'calendar-history-index.json'),JSON.stringify(index)+'\n');
 }
 fs.writeFileSync(path.join(root,'calendar-history-status.json'),JSON.stringify({version:1,checkedAt:output.checkedAt,source:output.source,count:output.sessions.length,dates:[output.sessions[0].dateJst,output.sessions.at(-1).dateJst],months:byMonth.size,changed,unmappedCount:output.unmappedCount,unmappedSample:output.unmappedSample,unmappedDetails:output.unmappedDetails,ignored:output.ignored},null,2)+'\n');
 console.log('HISTORICAL_CALENDAR '+JSON.stringify({events:output.sessions.length,months:byMonth.size,unmapped:output.unmappedCount,changed}));
}
if(require.main===module)main().catch(err=>{console.error(err);process.exitCode=1});
module.exports={stageLabel,buildHistory};
