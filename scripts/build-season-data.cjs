'use strict';
/**
 * Build self-contained, season-scoped published results and compact read models.
 * results.json stays canonical: never infer a season from a record's date.
 * Usage: node scripts/build-season-data.cjs [--check]
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const AsiaRankings = require('../rankings.js');
const AsiaAchievements = require('../achievements.js');

const root = path.resolve(__dirname, '..');
const output = path.join(root, 'season-data');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const source = read('results.json');
const records = JSON.parse(source);
const tournaments = JSON.parse(read('tournaments.json')).catalog;
const players = JSON.parse(read('players.json')).candidates;
const REGIONS = ['ME', 'EU', 'NAC', 'NAW', 'OCE', 'BR'];
if (!Array.isArray(records) || !Array.isArray(tournaments) || !Array.isArray(players))
  throw new Error('Unexpected canonical data format');
const roster = row => Array.isArray(row.players) && row.players.length ? row.players : [row.player];

function buildDefinitions() {
  const definitions = new Map(), conflicts = new Set();
  for (const row of [...tournaments, ...records]) {
    if (!/^S\d+$/.test(row.seasonId || '') || !Number.isInteger(row.chapter) || row.chapter < 1 ||
        !Number.isInteger(row.season) || row.season < 1) continue;
    const item = {id:row.seasonId,seasonId:row.seasonId,chapter:row.chapter,season:row.season,
      label:'CH'+row.chapter+' S'+row.season};
    const old = definitions.get(item.id);
    if (old && (old.chapter !== item.chapter || old.season !== item.season)) conflicts.add(item.id);
    else definitions.set(item.id, item);
  }
  for (const id of conflicts) definitions.delete(id);
  return definitions;
}
const definitions = buildDefinitions();
const unknown = {id:'unknown',seasonId:'unknown',chapter:null,season:null,label:'未確認'};

function tournamentSource(row) {
  try {
    const u = new URL(row.source), parts = u.pathname.split('/').filter(Boolean);
    if (!['https:','http:'].includes(u.protocol) ||
        !['fortnite.com','www.fortnite.com','fortnitetracker.com','www.fortnitetracker.com'].includes(u.hostname.toLowerCase()))
      return {eventId:null,roundId:null,seasonId:'unknown'};
    let eventId = parts.find(p=>/^S\d+_/i.test(p)) ||
      parts.find(p=>/^epicgames_S\d+_/i.test(p))?.replace(/^epicgames_/i,'') || null;
    if (eventId) {
      const suffix=eventId.split('_').at(-1);
      if (REGIONS.includes(suffix)) eventId=eventId.slice(0,-suffix.length-1);
    }
    const roundId=u.searchParams.get('window')||u.searchParams.get('round')||null;
    const eventSeason=eventId?.match(/^S\d+/i)?.[0]?.toUpperCase();
    const roundSeason=roundId?.match(/^S\d+/i)?.[0]?.toUpperCase();
    if(eventSeason&&roundSeason&&eventSeason!==roundSeason)
      return {eventId:null,roundId:null,seasonId:'unknown',seasonConflict:true};
    return {eventId,roundId,seasonId:(eventId||roundId||'').match(/^S\d+/i)?.[0]?.toUpperCase()||'unknown'};
  } catch { return {eventId:null,roundId:null,seasonId:'unknown'}; }
}
const sources = new WeakMap();
function sourceOf(row) {
  if (!sources.has(row)) sources.set(row,tournamentSource(row));
  return sources.get(row);
}
function seasonOf(row) {
  const from=sourceOf(row);
  if(from.seasonConflict) return unknown;
  const explicit=row.seasonId;
  if(explicit!=null&&!/^S\d+$/.test(explicit))return unknown;
  if(explicit&&from.seasonId!=='unknown'&&explicit!==from.seasonId)return unknown;
  const def=definitions.get(explicit||from.seasonId);
  if(!def||(row.chapter!=null&&row.chapter!==def.chapter)||(row.season!=null&&row.season!==def.season))
    return unknown;
  return def;
}
const seasons=new Map();
for(const [index,row] of records.entries()){
  const id=seasonOf(row).id;
  if(!seasons.has(id)) seasons.set(id,[]);
  seasons.get(id).push({__aotOrder:index,...row});
}
const identifiers=[...seasons.keys()].filter(id=>id!=='unknown').sort((a,b)=>{
  const x=definitions.get(a),y=definitions.get(b);
  return (y?.chapter||0)-(x?.chapter||0)||(y?.season||0)-(x?.season||0)||a.localeCompare(b);
});
if(seasons.has('unknown'))identifiers.push('unknown');

function classify(row) {
  const src=sourceOf(row), period=seasonOf(row);
  const known=tournaments.find(t=>t.seasonId===src.seasonId&&t.name===row.event&&t.sourceEventIds.includes(src.eventId));
  if(known&&period.id===known.seasonId)return known;
  return {id:'unconfirmed-'+encodeURIComponent([(period.id==='unknown'?src.seasonId:period.seasonId),row.event,src.eventId||row.id].join('|')),
    series:'unknown',subtype:'unknown',mode:'unknown',team:'unknown'};
}
function confirmedFinalRank(row) {
  if(row.verified!==true||row.kind!=='賞金決勝'||!Number.isInteger(row.rank)||row.rank<1)return null;
  const t=classify(row);
  return /practice/i.test(t.subtype||'')||t.series==='skin-cup'?null:row.rank;
}
function rankingFor(rows) {
  return AsiaRankings.buildRankings(rows,{metric:'prize'},{
    names:roster,individualPrize:AsiaAchievements.individualCash,
    classifyTournamentRecord:classify,confirmedPrizeFinalRank:confirmedFinalRank,
    confirmedSkinReward:AsiaAchievements.confirmedSkin,
    series:[...new Set(tournaments.map(t=>t.series))]
  });
}
const byPlayer=new Map(), known=new Set(players.map(x=>x.name)), everyName=new Set();
for(const row of records){
  for(const name of new Set(roster(row))) {
    if(!name||typeof name!=='string')continue;
    everyName.add(name);
    if(!byPlayer.has(name))byPlayer.set(name,[]);
    byPlayer.get(name).push(row);
  }
}
const previews={};
for(const [name,rows] of byPlayer) {
  const result=AsiaAchievements.calculate(rows,name,{catalog:tournaments});
  const ev=result.evolution, featured=ev.featured;
  previews[name]={
    featured:featured?{id:featured.id,icon:featured.icon,current:featured.current?{
      tier:featured.current.tier,title:featured.current.title}:null}:null,
    earnedStages:ev.earnedStages,totalStages:ev.totalStages
  };
}
const scopes={};
const generated=new Map();
function addScope(id,rows){
  const s=id==='all'?{id:'all',label:'全期間',seasonId:'all',chapter:null,season:null}:
    (definitions.get(id)||unknown);
  const ranking=rankingFor(rows);
  const amounts=new Map();
  for(const row of rows){
    const amount=AsiaAchievements.individualCash(row);
    if(amount<=0)continue;
    for(const n of new Set(roster(row))){
      const total=amounts.get(n)||{name:n,total:0,events:0};
      total.total+=amount; total.events++;
      amounts.set(n,total);
    }
  }
  const earners=[...amounts.values()].sort((a,b)=>b.total-a.total||b.events-a.events||a.name.localeCompare(b.name,'ja'));
  const regions=Object.fromEntries(REGIONS.map(region=>[region,0]));
  for(const row of rows)if(Object.hasOwn(regions,row.region))regions[row.region]++;
  scopes[id]={
    id:s.id,label:s.label,chapter:s.chapter,season:s.season,
    file:id==='all'?null:'season-data/'+id+'.json',
    rankingFile:'season-data/ranking-'+id+'.json',
    count:rows.length,players:new Set(rows.flatMap(roster)).size,
    regions:Object.values(regions).filter(Boolean).length,top10:rows.filter(x=>x.rank<=10).length,
    regionCounts:regions,prizeTotal:earners.reduce((sum,p)=>sum+p.total,0),
    earners:earners.slice(0,5)
  };
  generated.set('ranking-'+id+'.json',JSON.stringify(ranking));
  if(id!=='all')generated.set(id+'.json',JSON.stringify(rows));
}
for(const id of identifiers)addScope(id,seasons.get(id));
addScope('all',records);
const manifest={
  format:1,sourceSha256:crypto.createHash('sha256').update(source).digest('hex'),
  total:records.length,scopes,seasonOrder:identifiers,
  names:[...everyName].sort((a,b)=>a.localeCompare(b,'ja')),previews
};
generated.set('manifest.json',JSON.stringify(manifest)+'\n');

function main(){
  const check=process.argv.includes('--check');
  if(!check)fs.mkdirSync(output,{recursive:true});
  for(const [file,contents] of generated){
    const location=path.join(output,file);
    if(check){
      if(!fs.existsSync(location)||fs.readFileSync(location,'utf8')!==contents)
        throw new Error('Stale generated season data: '+file+' (run node scripts/build-season-data.cjs)');
    }else if(!fs.existsSync(location)||fs.readFileSync(location,'utf8')!==contents){
      fs.writeFileSync(location,contents);
    }
  }
  const expected=new Set(generated.keys());
  if(fs.existsSync(output))for(const filename of fs.readdirSync(output)){
    if(!/^(?:S\d+|unknown|ranking-(?:S\d+|unknown|all)|manifest)\.json$/.test(filename)||expected.has(filename))continue;
    if(check)throw new Error('Obsolete season-data file: '+filename);
    fs.rmSync(path.join(output,filename));
  }
  const bytes=[...generated.values()].reduce((n,s)=>n+Buffer.byteLength(s),0);
  console.log('Season data '+(check?'verified':'generated')+': '+records.length+' records, '+
    identifiers.length+' season files, '+bytes+' bytes total; manifest '+Buffer.byteLength(generated.get('manifest.json'))+' bytes');
}
if(require.main===module)main();
module.exports={seasonOf,rankings:rankingFor};
