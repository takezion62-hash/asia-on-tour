'use strict';
// Idempotent owner-supplied screenshot importer for 2024-05-06 ME S29
// Zero Build Duos Victory Cup Event7 Round2 cash-winning teams.
// Existing 2024-05-06 NAC teams and all previously saved awards are preserved.
const fs=require('node:fs'),path=require('node:path');
const {readResults,publishResults}=require('./source-results-store.cjs');
const {validateData,personalCents,roster}=require('./data-checks.cjs');
const {audit}=require('./validate-approvals.cjs');
const {validateUpdateLog}=require('./validate-updates.cjs');
const {upsertPublicationLog}=require('./reviewed-publication-core.cjs');
const V=require('./verified-s29-me-zb-duos-20240506.cjs');
const ROOT=path.resolve(__dirname,'..');
const read=name=>JSON.parse(fs.readFileSync(path.join(ROOT,name),'utf8'));
const write=(name,data)=>fs.writeFileSync(path.join(ROOT,name),JSON.stringify(data,null,2)+'\n');
const assert=(p,msg)=>{if(!p)throw Error('S29_ME_ZB_DUOS_VC_20240506: '+msg)};
const args=process.argv.slice(2),dry=args.includes('--dry-run');
assert(args.length===0||(args.length===1&&dry),'unexpected CLI options');
const doc=read('data/manual-approvals/20240506-me-zb-duos-vcup-proof.json'),b=doc.batch;
assert(doc.version===1&&b?.id==='tracker-s29-me-zb-duos-vcup-final-20240506'&&
 b.date===V.DATE&&b.region===V.REGION&&b.seasonId===V.SEASON&&
 b.tournamentId===V.TOURNAMENT&&b.eventId===V.EVENT&&
 b.windowId===V.WINDOW&&b.source===V.TRACKER&&b.ruleUrl===V.RULE&&
 Array.isArray(b.teams)&&b.teams.length===5,'wrong uploaded event, season, or identity batch');
const results=readResults(ROOT).rows,players=read('players.json'),
 tournaments=read('tournaments.json'),ledger=read('approval-history.json'),
 updates=read('updates.json');
const cat=tournaments.catalog.find(t=>t.id===V.TOURNAMENT);
assert(cat&&cat.name==='Zero Build Duos Victory Cup'&&
 cat.seasonId===V.SEASON&&cat.chapter===5&&cat.season===2&&
 cat.mode==='zero-build'&&cat.team==='duo'&&
 cat.sourceEventIds.includes(V.EVENT),'catalog mismatch');
const names=new Set(players.candidates.map(x=>x.name));
const aliasOwner=new Map([...names].map(name=>[name,name]));
for(const [canonical,aliases] of Object.entries(players.confirmedAliases||{})){
 assert(names.has(canonical)&&Array.isArray(aliases),'preexisting alias owner missing');
 for(const alias of aliases){
  assert(!aliasOwner.has(alias)||aliasOwner.get(alias)===canonical,
   'ambiguous preexisting alias '+alias);
  aliasOwner.set(alias,canonical);
 }
}
assert(aliasOwner.get('Αθηνά.')==='るいぼっと',
 'the established Athena / るいぼっと identity must not be separated');
const uuidOwner=new Map();
for(const r of results)for(const p of r.profiles||[]){
 const id=V.uuid(p.url);
 if(!id)continue;
 const canonical=aliasOwner.get(p.name)||p.name;
 assert(!uuidOwner.has(id)||uuidOwner.get(id)===canonical,
  'preexisting UUID owned by different player '+id);
 uuidOwner.set(id,canonical);
}
const initial={count:results.length,
 totalTeam:results.reduce((n,r)=>n+Math.round((r.prize||0)*100),0),
 totalPersonal:results.reduce((n,r)=>n+personalCents(r)*roster(r).length,0)};
const newPlayers=[],newAliases=[],newRows=[],already=[],foundRanks=new Set();
for(const team of b.teams){
 const target=V.TARGETS.find(t=>t.rank===team.rank);
 assert(target&&!foundRanks.has(team.rank)&&
  target.points===team.points&&target.kills===team.kills&&
  target.vrs===team.vrs&&target.matches===team.matches&&
  target.teamPrize===team.teamPrize&&team.points===100&&team.vrs===1&&
  team.matches===3&&team.teamPrize===200&&
  Array.isArray(team.members)&&team.members.length===2&&
  team.members.map(m=>m.name).join(' / ')===target.player,
  'scoreboard points/elims/VR/matches/cash diverged at rank '+team.rank);
 foundRanks.add(team.rank);
 const profiles=[];
 for(let i=0;i<team.members.length;i++){
  const p=team.members[i],id=V.uuid(p.url);
  assert(id===target.uuids[i]&&typeof p.name==='string'&&p.name&&p.name===p.name.trim()&&
   typeof p.raw==='string'&&p.raw&&p.raw===p.raw.trim()&&
   (!aliasOwner.has(p.name)||aliasOwner.get(p.name)===p.name)&&
   (!uuidOwner.has(id)||uuidOwner.get(id)===p.name),
   'player Epic ID or owner cannot be verified at '+team.rank+' / '+p.name);
  uuidOwner.set(id,p.name);
  if(!names.has(p.name)){
   assert(['mask off420','ruporupo','僕の番だ','ふりすく'].includes(p.name),
    'unreviewed new canonical player '+p.name);
   players.candidates.push({name:p.name,
    initials:/^[a-z]/i.test(p.name)?p.name.slice(0,2).toUpperCase():p.name.slice(0,2),
    accent:players.candidates.length%2?'cyan':'violet',
    desc:'2024/5/6 ME Zero Build Duos Victory Cup Event7決勝'+team.rank+
     '位・1VR・個人賞金$100。本人Tracker UUIDとユーザー提供画像で確認。'});
   names.add(p.name);aliasOwner.set(p.name,p.name);
   newPlayers.push(p.name);
  }
  if(p.raw!==p.name&&aliasOwner.get(p.raw)!==p.name){
   assert(!aliasOwner.has(p.raw),'alias owned by different player '+p.raw);
   if(!players.confirmedAliases[p.name])players.confirmedAliases[p.name]=[];
   players.confirmedAliases[p.name].push(p.raw);
   aliasOwner.set(p.raw,p.name);
   newAliases.push({name:p.name,raw:p.raw});
  }
  profiles.push({name:p.name,url:p.url});
 }
 const members=team.members.map(p=>p.name);
 const matches=results.filter(r=>r.date===V.DATE&&r.region===V.REGION&&
  r.tournamentId===V.TOURNAMENT&&
  (r.id===target.id||r.rank===team.rank||
   (Array.isArray(r.players)&&r.players.slice().sort().join('|')===members.slice().sort().join('|'))));
 assert(matches.length<=1,'potential duplicate rank, roster or ID at '+team.rank);
 if(matches.length){
  const row=matches[0],entry=ledger.entries.find(x=>x.recordId===row.id);
  assert(row.id===target.id&&V.verifyCashRow(row,entry),
   'existing row differs from pinned screenshot: '+team.rank);
  already.push(row.id);continue;
 }
 assert(!results.some(r=>r.id===target.id),'record ID already used elsewhere');
 const playerRaw=team.members.map(p=>p.raw).join(' / ');
 const note='ユーザー提供Fortnite Tracker最終順位スクショと両選手の本人UUIDで'+
  '2024/5/6 ME Zero Build Duos Victory Cup Event7 Round2を照合。'+
  team.rank+'位・100pt・'+team.kills+'チームキル・3試合・1VR。'+
  'Epic公式Chapter 5 Season 2 Victory Cash Cup規則では決勝1VRごとに'+
  '選手各$100＝チーム$200（支払完了は断定しない）。'+
  '大会順位表: '+V.TRACKER+'。公式規則: '+V.RULE;
 const row={id:target.id,date:V.DATE,region:V.REGION,
  player:target.player,players:members,playerRaw,
  event:cat.name,round:V.ROUND,rank:target.rank,points:team.points,
  kills:team.kills,vrs:team.vrs,matches:team.matches,
  prize:200,teamPrize:200,prizePerPlayer:100,kind:'賞金決勝',
  seasonId:V.SEASON,chapter:5,season:2,tournamentId:V.TOURNAMENT,
  source:V.TRACKER,profiles,verified:true,note};
 const entry={id:target.id,recordId:target.id,decision:'published',
  policy:V.POLICY,approvedAt:new Date().toISOString(),
  approvedBy:'ChatGPT / user-authorized screenshot-backed GitHub publication',
  source:V.TRACKER,rule:V.RULE,
  evidence:'User-provided ME 2024-05-06 tracker rank '+team.rank+
   ' = 100pts, 1VR, team $200, each $100; two unique official Tracker Epic IDs'};
 assert(V.verifyCashRow(row,entry),'post-import verification failed: '+team.rank);
 results.push(row);ledger.entries.push(entry);newRows.push(row);
}
assert(foundRanks.size===V.TARGETS.length&&
 V.TARGETS.every(t=>foundRanks.has(t.rank)),'missing reviewed screenshot rank');
const afterTeam=results.reduce((n,r)=>n+Math.round((r.prize||0)*100),0);
const afterPersonal=results.reduce((n,r)=>n+personalCents(r)*roster(r).length,0);
assert(results.length===initial.count+newRows.length&&
 afterTeam===initial.totalTeam+newRows.length*20000&&
 afterPersonal===initial.totalPersonal+newRows.length*20000,
 'existing prizes or ranking totals changed unexpectedly');
if(newRows.length)upsertPublicationLog(updates,{
 id:b.id,date:'2026-11-14',
 title:'2024/5/6 ME ZB Duos Victory Cup：決勝1VRの5チーム賞金を掲載',
 description:'Fraymy/RyoIT、るいぼっと/mask off420、ねふぁ/ruporupo、僕の番だ/ふりすく、Aim/ZAZIの5組。スクショと10選手のEpic IDで照合し、チーム各$200・個人各$100。NACの既存記録は保持。',
 recordIds:newRows.map(r=>r.id)
});
const errs=validateData({results,players,tournaments}).errors;
assert(!errs.length,'results validation failed: '+JSON.stringify(errs.slice(0,5)));
const approvals=audit(results,ledger,players);
assert(!approvals.length,'approval audit failed: '+JSON.stringify(approvals.slice(0,5)));
const logErrors=validateUpdateLog(results,updates);
assert(!logErrors.length,'updates audit failed: '+JSON.stringify(logErrors.slice(0,5)));
if(!dry&&newRows.length){
 publishResults(ROOT,results);write('players.json',players);
 write('approval-history.json',ledger);write('updates.json',updates);
}
console.log('S29_ME_ZB_DUOS_20240506 '+JSON.stringify({mode:dry?'dry-run':'apply',
 published:newRows.length,alreadyPublished:already.length,
 names:newRows.map(x=>x.player),newPlayers,newAliases,
 before:initial.count,after:results.length,
 addedTeamCash:newRows.length*200,addedPersonalCash:newRows.length*200}));
