'use strict';
// Public competition-account evidence only; no personal identity inference.
const DAY=86400000,MAX_CANDIDATES=500,MAX_EVIDENCE=12,MAX_NEW=3;
const id=x=>typeof x==='string'&&/^[0-9a-f]{32}$/i.test(x)?x.toLowerCase():null;
const clean=x=>typeof x==='string'&&x===x.trim()&&x.length>0&&x.length<=64&&!/[\u0000-\u001f\u007f<>]/u.test(x)&&!['__proto__','constructor','prototype','非公開'].includes(x)?x:null;
const nameKey=x=>typeof x==='string'?x.normalize('NFKC').toLowerCase().trim():'';
const regions=new Set(['ASIA','ME','EU','NAC','NAW','OCE','BR']);
const dateOK=d=>typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&Number.isFinite(Date.parse(d))&&new Date(Date.parse(d)).toISOString().slice(0,10)===d;
const officialRules='https://www.fortnite.com/competitive/rules-guidelines/rules-library/fortnite-competitive-master-rules';
const soloRules='https://www.fortnite.com/competitive/rules-guidelines/rules-library/fortnite-championship-series-fncs-solos-2026-official-rules';
function fncsType(event){
 if(typeof event!=='string'||!/^(?:S39|S40|S41|S42|S43)_/.test(event)||/practice|test|summit|global|championship|scrim/i.test(event))return null;
 // Intentionally narrow. Unsupported event identifiers never confer ASIA status.
 if(/^S(?:39|40|41|42|43)_FNCS_?Major_?[12](?:_?(?:PlayIn|GroupStage|Finals?|LCQ|LCL|LastChance(?:Qualifier|Lobby)?|Qualifiers?|Round[123]|Day[123]))*$/i.test(event))return 'major';
 if(/^S43_FNCS_?Solos?(?:_?Reload)?(?:_?(?:Qualifiers?|Round[123]|FastTrack|Heats?|LCQ|LastChanceQualifier|Finals?|Day[123])\d*)*$/i.test(event))return 'solos';
 if(/^S(?:39|40|41)_FNCSDivisionalCup_Division1$/.test(event))return 'division';
 return null;
}
function occupied(data){
 const ids=new Set(),names=new Set();
 const take=x=>{const a=id(x);if(a)ids.add(a)};
 const url=x=>{const m=typeof x==='string'&&x.match(/[?&]id=([a-f0-9-]{36})(?:&|$)/i);if(m)take(m[1].replace(/-/g,''))};
 for(const p of data.players.candidates){names.add(nameKey(p.name));take(p.epicAccountId);url(p.trackerProfileUrl)}
 for(const [n,aliases] of Object.entries(data.players.confirmedAliases||{})){names.add(nameKey(n));for(const a of aliases||[])names.add(nameKey(a))}
 for(const r of data.results){for(const n of r.players||[r.player])names.add(nameKey(n));url(r.profileUrl);for(const p of r.profiles||[]){url(p.url);names.add(nameKey(p.name))}for(const a of r.teamAccountIds||[])take(a)}
 return {ids,names};
}
function init(previous,data,now){
 const used=occupied(data),old=previous?.version===1&&Array.isArray(previous.candidates)?previous.candidates:[];
 const candidates=old.filter(c=>id(c?.epicId)&&!used.ids.has(c.epicId)&&Number.isFinite(Date.parse(c.lastSeen))&&Date.parse(c.lastSeen)>=now-180*DAY)
  .map(c=>JSON.parse(JSON.stringify(c))).slice(0,MAX_CANDIDATES);
 return {version:1,candidates,boards:previous?.version===1&&previous.boards?JSON.parse(JSON.stringify(previous.boards)):{},checkedAt:new Date(now).toISOString(),attempts:0,scannedPages:0,lastError:null,...(previous?.lastRegistration?{lastRegistration:previous.lastRegistration}: {})};
}
function evidence(win,row,name,teammate=false){
 return {window:win.key,eventId:win.eventId,region:win.region,date:win.dateJst,rank:row.rank,name,
  knownTeammate:teammate,source:'https://www.fortnite.com/competitive/events/'+encodeURIComponent(win.eventId)+'/?region='+win.region+'&round='+encodeURIComponent(win.windowId)};
}
function put(list,e){
 if(!list.some(x=>x.window===e.window))list.push(e);
 list.sort((a,b)=>b.date.localeCompare(a.date)||a.window.localeCompare(b.window));
 if(list.length>MAX_EVIDENCE)list.length=MAX_EVIDENCE;
}
function observe(state,win,entries,normalize,accounts,blocked,{homeOnly=false,now=Date.now()}={}){
 const byId=new Map(state.candidates.map(c=>[c.epicId,c])),known=new Set(accounts.map(a=>a.epicAccountId));
 // Sample non-teammates only from the top 8 rows of each fetched page;
 // all actual mixed teams are inspected. No extra API for this discovery.
 for(let i=0;i<entries.length;i++){
  const entry=entries[i],row=normalize(entry,win);
  if(!row||row.vrs>row.matches||!Array.isArray(entry.players)||entry.players.length>4||new Set(row.teamAccountIds).size!==row.teamAccountIds.length)continue;
  const teammate=row.teamAccountIds.some(x=>known.has(x)),type=fncsType(win.eventId);
  for(const p of entry.players){
   const a=id(p.accountId),name=clean(p.username);
   if(!a||!name||known.has(a)||blocked.ids.has(a))continue;
   let c=byId.get(a);
   if(homeOnly||win.region==='ASIA'){
    if(!c||!type)continue;
   }else if(!c){
    if(!teammate&&i>=8)continue;
    if(state.candidates.length>=MAX_CANDIDATES){
     // Keep corroborated candidates, but rotate weak single sightings rather
     // than let early arbitrary rows permanently block mixed-team discovery.
     const victim=state.candidates.filter(x=>!x.home.length&&!x.conflicts.length&&x.foreign.length===1&&!x.foreign[0].knownTeammate&&
      (teammate||Date.parse(x.lastSeen)<now-7*DAY)).sort((a,b)=>a.lastSeen.localeCompare(b.lastSeen)||a.epicId.localeCompare(b.epicId))[0];
     if(!victim)continue;
     state.candidates.splice(state.candidates.indexOf(victim),1);byId.delete(victim.epicId);
    }
    c={epicId:a,lastSeen:new Date(now).toISOString(),foreign:[],home:[],conflicts:[]};byId.set(a,c);state.candidates.push(c);
   }
   const e=evidence(win,row,name,teammate);
   c.lastSeen=new Date(now).toISOString();
   if(win.region==='ASIA')put(c.home,e);
   else{
    if(!homeOnly)put(c.foreign,e);
    if(type)put(c.conflicts,e);
   }
  }
 }
}
function evidenceWindows(events,now){
 const out=new Map();
 for(const t of events||[]){
  const m=typeof t?.eventId==='string'&&t.eventId.match(/^epicgames_(S\d+_.+)_([A-Z]+)$/);
  if(!m||!regions.has(m[2])||!fncsType(m[1]))continue;
  for(const w of t.eventWindows||[]){
   const begin=Date.parse(w.beginTime),end=Date.parse(w.endTime),wid=w.eventWindowId;
   if(!Number.isFinite(begin)||!Number.isFinite(end)||end<=begin||end>now-4*3600000||end<now-180*DAY||
    typeof wid!=='string'||!wid.startsWith(m[1].split('_')[0]+'_')||!wid.endsWith('_'+m[2])||/practice|test|scrim/i.test(wid))continue;
   const key=t.eventId+'/'+wid;
   out.set(key,{key,fullEventId:t.eventId,eventId:m[1],windowId:wid,region:m[2],dateJst:new Date(begin+9*3600000).toISOString().slice(0,10),end});
  }
 }
 return [...out.values()];
}
function nextBoard(state,windows,region,now){
 const pool=windows.filter(w=>(region==='ASIA'?w.region==='ASIA':w.region!=='ASIA')&&
  !state.boards[w.key]?.complete&&!(Date.parse(state.boards[w.key]?.retryAfter||'')>now));
 pool.sort((a,b)=>String(state.boards[a.key]?.lastAttempt||'').localeCompare(String(state.boards[b.key]?.lastAttempt||''))||b.end-a.end||a.key.localeCompare(b.key));
 return pool[0]||null;
}
function pending(state){return state.candidates.some(c=>c.foreign?.some(x=>x.knownTeammate)||new Set((c.foreign||[]).map(x=>x.date)).size>=2)}
async function verify(state,events,{getAsia,getPage,normalize,accounts,blocked,now=Date.now(),budget=3,deadline=Infinity,rateLimit,recoverable}){
 if(budget<2||!pending(state)||Date.now()>=deadline)return {attempts:0,rateLimited:false};
 let asia,rateLimited=false;
 const failed=e=>{if(!recoverable(e))throw e;state.lastError=String(e.message||e).slice(0,240);rateLimited=rateLimit(e)};
 try{state.attempts++;asia=await getAsia()}catch(e){failed(e);return {attempts:state.attempts,rateLimited}}
 const windows=evidenceWindows([...asia,...events],now),allowed=new Set(windows.map(w=>w.key));
 for(const key of Object.keys(state.boards))if(!allowed.has(key))delete state.boards[key];
 // Always attempt an ASIA board first; second slot checks a foreign FNCS
 // board for contradictory evidence if available.
 for(const region of ['ASIA','foreign']){
  if(rateLimited||state.attempts>=budget||Date.now()>=deadline)break;
  const win=nextBoard(state,windows,region,now);if(!win)continue;
  const cp=state.boards[win.key]||{nextPage:0};
  cp.lastAttempt=new Date(now).toISOString();state.boards[win.key]=cp;
  try{
   state.attempts++;const l=await getPage(win,cp.nextPage);
   if(!Array.isArray(l.entries)||!l.entries.length){cp.retryAfter=new Date(now+6*3600000).toISOString();continue}
   observe(state,win,l.entries,normalize,accounts,blocked,{homeOnly:true,now});
   cp.nextPage++;cp.complete=cp.nextPage>=l.totalPages;delete cp.retryAfter;state.scannedPages++;
  }catch(e){failed(e);cp.retryAfter=new Date(now+6*3600000).toISOString()}
 }
 return {attempts:state.attempts,rateLimited};
}
function validEvidence(e,now,home=false){
 if(!e||!regions.has(e.region)||!dateOK(e.date)||!clean(e.name)||!Number.isSafeInteger(e.rank)||e.rank<1||typeof e.eventId!=='string'||typeof e.window!=='string'||Date.parse(e.date)>now)return false;
 const prefix='epicgames_'+e.eventId+'_'+e.region+'/',wid=e.window.slice(prefix.length);
 if(!e.window.startsWith(prefix)||!wid.endsWith('_'+e.region)||!wid.startsWith(e.eventId.split('_')[0]+'_'))return false;
 const source='https://www.fortnite.com/competitive/events/'+encodeURIComponent(e.eventId)+'/?region='+e.region+'&round='+encodeURIComponent(wid);
 return e.source===source&&(!home||(e.region==='ASIA'&&fncsType(e.eventId)&&Date.parse(e.date)>=now-180*DAY));
}
function classify(c,now){
 if(!id(c?.epicId)||!Array.isArray(c.foreign)||!Array.isArray(c.home)||!Array.isArray(c.conflicts))return {state:'invalid'};
 const foreign=c.foreign.filter(e=>validEvidence(e,now)&&e.region!=='ASIA');
 const home=c.home.filter(e=>validEvidence(e,now,true));
 const conflict=c.conflicts.some(e=>validEvidence(e,now)&&e.region!=='ASIA'&&fncsType(e.eventId)&&Date.parse(e.date)>=now-180*DAY);
 if(conflict)return {state:'region-conflict'};
 if(!foreign.some(e=>e.knownTeammate===true)&&new Set(foreign.map(e=>e.date)).size<2)return {state:'insufficient-foreign'};
 const locked=home.filter(e=>['major','solos'].includes(fncsType(e.eventId)));
 const dates=[...new Set(home.map(e=>e.date))].sort();
 if(dates.length<3||!locked.length||Date.parse(dates.at(-1))-Date.parse(dates[0])<14*DAY||Date.parse(dates.at(-1))<now-90*DAY)return {state:'insufficient-asia'};
 const names=home.filter(e=>e.date===dates.at(-1)).map(e=>e.name);
 if(new Set(names.map(nameKey)).size!==1)return {state:'name-conflict'};
 return {state:'ready',name:names[0],evidence:home,foreign,ruleSources:[officialRules,soloRules]};
}
function registrationPlan(state,data,now){
 const used=occupied(data),namesByCandidate=new Map(),additions=[],decisions=[];
 for(const c of state.candidates||[])for(const e of [...(c.home||[]),...(c.foreign||[])])if(clean(e.name)){
  const k=nameKey(e.name);if(!namesByCandidate.has(k))namesByCandidate.set(k,new Set());namesByCandidate.get(k).add(c.epicId);
 }
 for(const c of state.candidates||[]){
  const decision=classify(c,now);let reason=decision.state;
  if(used.ids.has(c.epicId))reason='already-known-id';
  else if(reason==='ready'&&([...c.home,...c.foreign].some(e=>used.names.has(nameKey(e.name)))||namesByCandidate.get(nameKey(decision.name))?.size!==1))reason='name-conflict';
  else if(reason==='ready'&&additions.length>=MAX_NEW)reason='ready-next-run';
  else if(reason==='ready'){
   const p={name:decision.name,initials:Array.from(decision.name).slice(0,2).join(''),accent:'cyan',
    desc:'海外大会出場とASIA FNCSの継続参加を同一Epic IDで照合（自動発掘・主戦場判定）。',
    epicAccountVerified:true,epicAccountId:c.epicId,autoDiscovery:{version:1,registeredAt:new Date(now).toISOString(),homeRegion:'ASIA',policy:'fncs-continuity-v1',homeEvidence:decision.evidence,foreignEvidence:decision.foreign,ruleSources:decision.ruleSources}};
   additions.push(p);used.ids.add(c.epicId);used.names.add(nameKey(p.name));reason='registered';
  }
  decisions.push({epicId:c.epicId,state:reason});
 }
 return {additions,decisions};
}
module.exports={init,observe,occupied,evidenceWindows,verify,pending,classify,registrationPlan,fncsType};
