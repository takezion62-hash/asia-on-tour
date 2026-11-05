'use strict';
// A separate participation ledger. These rows NEVER enter results.json, AOT PR,
// prize totals, achievement badges or the verified qualification archive.
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const REGIONS=new Set(['ME','EU','NAC','NAW','OCE','BR']);
const members=r=>Array.isArray(r.players)&&r.players.length?r.players:[r.player];
const rosterKey=r=>members(r).slice().sort((a,b)=>a.localeCompare(b,'ja')).join('|');
const validDate=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s));
const recordId=p=>'participation-'+crypto.createHash('sha256').update(JSON.stringify([p.source,rosterKey(p)])).digest('hex').slice(0,20);
function publishedEquivalent(p,published){
 return published.some(r=>r.date===p.date&&r.region===p.region&&r.tournamentId===p.tournamentId&&rosterKey(r)===rosterKey(p)&&
   (r.source===p.source||r.round===p.round||(!r.source?.includes('round=')&&!r.source?.includes('window='))));
}
function toParticipation(p,win,cutoff=null){
 if(!p||p.verified!==true||!validDate(p.date)||!REGIONS.has(p.region)||p.date!==win.dateJst||p.region!==win.region||p.tournamentId!==win.tournamentId)return null;
 if(!Number.isSafeInteger(p.rank)||p.rank<1||!Number.isSafeInteger(p.points)||p.points<0||!Number.isSafeInteger(p.kills)||p.kills<0||!Number.isSafeInteger(p.vrs)||p.vrs<0||!Number.isSafeInteger(p.matches)||p.matches<1||p.vrs>p.matches)return null;
 const lineup=members(p);
 if(lineup.length<1||lineup.length>4||lineup.some(n=>typeof n!=='string'||!n.trim())||new Set(lineup).size!==lineup.length)return null;
 const verifiedUrl='https://www.fortnite.com/competitive/events/'+encodeURIComponent(win.eventId)+'/?region='+encodeURIComponent(win.region)+'&round='+encodeURIComponent(win.windowId);
 if(p.source!==verifiedUrl)return null;
 // A known cutoff proves the rank is outside the qualification bracket.
 // Otherwise do not assert either qualification or elimination.
 const outside=win.kind==='予選'&&win.series==='victory-cup'&&Number.isSafeInteger(cutoff)&&cutoff>0&&p.rank>cutoff;
 return {
  id:recordId(p),date:p.date,region:p.region,player:p.player,
  ...(lineup.length>1?{players:lineup}:{}),
  event:p.event,tournamentId:p.tournamentId,seasonId:p.seasonId,
  round:win.round,stage:win.kind,rank:p.rank,points:p.points,kills:p.kills,vrs:p.vrs,matches:p.matches,
  status:outside?'通過圏外':'出場確認',qualification:outside?'outside-cutoff':'unverified',
  ...(outside?{officialCutoff:cutoff}:{}),
  prize:null,source:verifiedUrl,verified:true,
  note:outside?'公式地域別予選通過順位より下位。賞金・実際の受賞資格は未確認。':'順位表と本人Epic IDで出場を確認。通過・賞金・スキン報酬は未確認。'
 };
}
const monthFile=(root,month)=>path.join(root,'participation',month+'.json');
function appendArchive(root,proposalsByWindow,published,opts={}){
 const changed=new Map(),seen=new Set(),rejected=[];
 const indexPath=path.join(root,'participation-index.json');
 const previous=fs.existsSync(indexPath)?JSON.parse(fs.readFileSync(indexPath,'utf8')):{version:1,months:[],total:0};
 if(previous.version!==1)throw Error('participation index version mismatch');
 const old=new Map(),dir=path.join(root,'participation');
 if(fs.existsSync(dir)){
  for(const name of fs.readdirSync(dir)){
   if(!/^\d{4}-\d{2}\.json$/.test(name))continue;
   const month=name.slice(0,7),document=JSON.parse(fs.readFileSync(monthFile(root,month),'utf8'));
   if(document.version!==1||document.month!==month||!Array.isArray(document.entries))throw Error('invalid participation month '+month);
   for(const record of document.entries){
    if(seen.has(record.id))throw Error('duplicate participation ID '+record.id);
    seen.add(record.id);
   }
   old.set(month,document.entries);
  }
 }
 let added=0,skippedPublished=0,duplicates=0;
 for(const item of proposalsByWindow){
  const {win,proposals,cutoff}=item;
  for(const proposal of proposals){
   const record=toParticipation(proposal,win,cutoff);
   if(!record){rejected.push(proposal?.id||'unknown');continue}
   if(publishedEquivalent(record,published)){skippedPublished++;continue}
   if(seen.has(record.id)){duplicates++;continue}
   const month=record.date.slice(0,7),rows=changed.get(month)||[...(old.get(month)||[])];
   if(rows.length>=50000)throw Error('participation month exceeds safe size');
   rows.push(record);changed.set(month,rows);seen.add(record.id);added++;
  }
 }
 if(!added)return {added:0,skippedPublished,duplicates,rejected:rejected.length,total:previous.total,months:old.size};
 fs.mkdirSync(dir,{recursive:true});
 for(const [month,rows] of changed){
  rows.sort((a,b)=>b.date.localeCompare(a.date)||a.region.localeCompare(b.region)||a.rank-b.rank||a.id.localeCompare(b.id));
  fs.writeFileSync(monthFile(root,month),JSON.stringify({version:1,month,entries:rows})+'\n');
  old.set(month,rows);
 }
 const players=new Map(),months=[];
 for(const [month,rows] of [...old].sort(([a],[b])=>a.localeCompare(b))){
  months.push({month,count:rows.length});
  for(const row of rows){
   for(const name of members(row)){
    const value=players.get(name)||{name,count:0,months:new Set(),latestDate:''};
    value.count++;value.months.add(month);
    if(row.date>value.latestDate)value.latestDate=row.date;
    players.set(name,value);
   }
  }
 }
 const next={
  version:1,description:'Epic ID verified participation records only; excluded from achievements, cash totals and AOT PR',
  checkedAt:opts.checkedAt||new Date().toISOString(),
  total:months.reduce((sum,m)=>sum+m.count,0),months,
  players:[...players.values()].map(p=>({...p,months:[...p.months].sort().reverse()})).sort((a,b)=>a.name.localeCompare(b.name,'ja'))
 };
 fs.writeFileSync(indexPath,JSON.stringify(next)+'\n');
 return {added,skippedPublished,duplicates,rejected:rejected.length,total:next.total,months:months.length};
}
module.exports={recordId,toParticipation,publishedEquivalent,appendArchive};
