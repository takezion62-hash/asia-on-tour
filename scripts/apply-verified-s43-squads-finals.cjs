'use strict';
// Idempotently publish manually screenshot-verified ASIA squad members in NAW.
// All 4 teammate names are preserved as screenshot evidence, but a mixed
// region squad only publishes the qualifying ASIA player and their personal $.
const fs=require('node:fs'),path=require('node:path');
const {validateData}=require('./data-checks.cjs');
const {upsertPublicationLog}=require('./reviewed-publication-core.cjs');
const root=path.resolve(__dirname,'..');
const read=file=>JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
const save=(file,data)=>fs.writeFileSync(path.join(root,file),JSON.stringify(data,null,2)+'\n');
const assert=(ok,message)=>{if(!ok)throw Error('S43_NAW_SQUADS_IMPORT: '+message);};
const dryRun=process.argv.includes('--dry-run');
const doc=read('data/manual-approvals/20261110-naw-squads-tracker.json');
const b=doc.batch;
assert(doc.version===1 && b && b.id==='tracker-s43-naw-squads-final-20261110' &&
 b.date==='2026-11-10' && b.region==='NAW' &&
 b.eventId==='S43_SquadsVictoryCup' &&
 b.windowId==='S43_SquadsVictoryCup_Event1_Round2_NAW' &&
 b.tournamentId==='ch7s5-squads-victory-cup' &&
 b.ruleUrl==='https://www.fortnite.com/competitive/rules-guidelines/rules-library/fortnite-squads-victory-cup-chapter-7-mini-season-official-rules' &&
 b.source==='https://fortnitetracker.com/events/epicgames_S43_SquadsVictoryCup_NAW?window='+b.windowId,
 'unsupported event, rules or final round');
const results=read('results.json'),players=read('players.json'),updates=read('updates.json');
const catalog=read('tournaments.json').catalog.find(x=>x.id===b.tournamentId);
assert(catalog && catalog.seasonId==='S43' && catalog.chapter===7 &&
 catalog.season===5 && catalog.team==='squad' &&
 catalog.mode==='battle-royale' && catalog.sourceEventIds.includes(b.eventId),
 'mismatch with existing tournament catalog');
assert(Array.isArray(b.teams)&&b.teams.length===3 &&
 [11,61,100].every(rank=>b.teams.some(team=>team.rank===rank)),
 'unexpected screenshot team ranks');
const aliases=players.confirmedAliases;
const known=new Set(players.candidates.map(x=>x.name));
const owner=new Map();
for(const x of known)owner.set(x,x);
for(const [key,values] of Object.entries(aliases))
 for(const raw of values){
  assert(!owner.has(raw)||owner.get(raw)===key,'existing alias belongs to multiple players: '+raw);
  owner.set(raw,key);
 }
const accountId=u=>{try{return new URL(u).searchParams.get('id');}catch{return null;}};
const roster=x=>Array.isArray(x.players)&&x.players.length?x.players:[x.player];
const imported=[],skipped=[],createdPlayers=[];
for(const t of b.teams){
 assert(Number.isSafeInteger(t.rank)&&[11,61,100].includes(t.rank) &&
  Number.isSafeInteger(t.points)&&t.points===t.vrs*100 &&
  Number.isSafeInteger(t.kills)&&t.kills>=0 &&
  Number.isSafeInteger(t.matches)&&t.matches===3 &&
  Number.isSafeInteger(t.vrs)&&t.vrs>=0&&t.vrs<=t.matches &&
  t.teamPrize===t.vrs*200 &&
  Array.isArray(t.rawRoster)&&t.rawRoster.length===4 &&
  new Set(t.rawRoster).size===4 &&
  t.rawRoster.every(x=>typeof x==='string'&&x.trim()===x&&x.length>0) &&
  Array.isArray(t.members)&&t.members.length===(t.rank===11?1:4),
  'invalid screenshot scoreboard, prize or team membership at rank '+t.rank);
 assert(t.rank!==11||t.members[0].name==='Teddy',
  'only Teddy may be recorded from mixed-region 11th squad');
 const id='manual-s43-naw-squads-final-20261110-r'+t.rank;
 const matching=results.filter(x=>x.id===id ||
  x.date===b.date&&x.region===b.region&&x.tournamentId===b.tournamentId &&
  x.rank===t.rank&&x.kind==='賞金決勝');
 const named=t.members.map(x=>x.name);
 assert(new Set(named).size===named.length,'duplicate tracked player name '+t.rank);
 const prize=t.members.length===1?t.vrs*50:t.teamPrize;
 if(matching.length){
  assert(matching.length===1 &&
   matching[0].rank===t.rank && matching[0].points===t.points &&
   matching[0].kills===t.kills && matching[0].vrs===t.vrs &&
   matching[0].matches===t.matches && matching[0].prize===prize &&
   roster(matching[0]).slice().sort().join('\0')===named.slice().sort().join('\0'),
   'existing team result conflicts with screenshot at rank '+t.rank);
  skipped.push(matching[0].id);
  continue;
 }
 const profiles=[];
 for(const m of t.members){
  const url=new URL(m.url);
  const uuid=accountId(m.url);
  assert(typeof m.name==='string' && m.name.trim()===m.name && m.name.length>0 &&
   typeof m.raw==='string' && t.rawRoster.includes(m.raw) &&
   url.protocol==='https:' && url.hostname==='fortnitetracker.com' &&
   url.pathname.startsWith('/profile/all/') &&
   /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uuid||''),
   'bad player identity at rank '+t.rank);
  assert(!owner.has(m.name)||owner.get(m.name)===m.name,
   'player name collides with another alias '+m.name);
  assert(!owner.has(m.raw)||owner.get(m.raw)===m.name,
   'Tracker name belongs to another profile: '+m.raw);
  for(const old of results)
   for(const oldProfile of old.profiles||[])
    if(accountId(oldProfile.url)===uuid)
     assert((owner.get(oldProfile.name)||oldProfile.name)===m.name,
      'existing Tracker ID maps to another player: '+m.name);
  if(!known.has(m.name)){
   players.candidates.push({
    name:m.name,
    initials:/^[a-z]/i.test(m.name)?m.name.slice(0,2).toUpperCase():m.name.slice(0,2),
    accent:players.candidates.length%2?'cyan':'violet',
    desc:'2026/11/10 NAW Squads Victory Cup Battle Royale決勝'+t.rank+
      '位・チーム'+t.kills+'キル・'+t.vrs+'VR・個人賞金$'+(t.vrs*50)+
      '。ユーザー提供Tracker決勝画像と本人IDで確認。'
   });
   known.add(m.name);owner.set(m.name,m.name);createdPlayers.push(m.name);
  }
  if(m.raw!==m.name){
   if(!Array.isArray(aliases[m.name]))aliases[m.name]=[];
   if(!aliases[m.name].includes(m.raw))aliases[m.name].push(m.raw);
   owner.set(m.raw,m.name);
  }
  profiles.push({name:m.name,url:m.url});
 }
 // A solitary ASIA member gets only their own 1/4 share; the NAW teammates
 // are not mistaken for ASIA players and $200 is never credited to Teddy.
 const note='ユーザー提供Fortnite Tracker画像・各選手のEpic本人IDで照合。'+
  'NAW 2026/11/10 Event1 Round2：'+t.rank+'位・3試合・チーム'+t.kills+
  'キル・'+t.vrs+'VR。チーム賞金$'+t.teamPrize+
  '（各選手$'+(t.vrs*50)+'、受取完了は未確認）。'+
  (t.rank===11?'NAW主戦場の他3名はASIA成績に含めず、Teddy個人$50のみ集計。':'');
 const record={
  id,date:b.date,region:b.region,player:named.join(' / '),players:named,
  playerRaw:t.rawRoster.join(' / '),event:catalog.name,
  round:'Event 1 · Round 2 / 賞金決勝',rank:t.rank,points:t.points,
  kills:t.kills,vrs:t.vrs,matches:t.matches,prize,
  prizePerPlayer:t.vrs*50,kind:'賞金決勝',source:b.source,
  profiles,verified:true,tournamentId:catalog.id,
  seasonId:catalog.seasonId,chapter:catalog.chapter,season:catalog.season,note
 };
 results.push(record);
 imported.push(record);
}
const validation=validateData({results,players,tournaments:{catalog:read('tournaments.json').catalog,axes:read('tournaments.json').axes}});
assert(validation.errors.length===0,'data validation failed: '+JSON.stringify(validation.errors.slice(0,8)));
if(imported.length){
 upsertPublicationLog(updates,{
  id:b.id,date:'2026-11-12',
  title:'2026/11/10 NAW Squads Victory Cup決勝：11・61・100位の3組を追加',
  description:'ユーザー提供Tracker画像・本人ID・Epic公式1VRあたりチーム$200の規則を照合。Teddyのみ他の3名がNAW主戦場なので、ASIA個人賞金$50を集計。残る2組は0VR・賞金$0。既存大会枠に統合。',
  recordIds:imported.map(x=>x.id)
 });
}
if(!dryRun&&imported.length){
 save('results.json',results);
 save('players.json',players);
 save('updates.json',updates);
}
console.log(JSON.stringify({mode:dryRun?'dry-run':'apply',
 imported:imported.length,skipped:skipped.length,newPlayers:createdPlayers,
 recordIds:imported.map(x=>x.id),trackedPrizeTotal:imported.reduce((n,x)=>n+x.prizePerPlayer*x.players.length,0)}));
