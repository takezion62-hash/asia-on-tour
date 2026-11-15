'use strict';
// One-use screenshot-backed ingestion. Delete script + temporary workflow after
// committing canonical source data and generated indexes to the PR branch.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {readResults,publishResults}=require('./source-results-store.cjs');
const ROOT=path.resolve(__dirname,'..');
const read=name=>JSON.parse(fs.readFileSync(path.join(ROOT,name),'utf8'));
const write=(name,data)=>fs.writeFileSync(path.join(ROOT,name),JSON.stringify(data,null,2)+'\n');
const source={
 S26:'https://fortnitetracker.com/events/epicgames_S26_DuosZBVictoryCashCup_ME?window=S26_DuosZBVictoryCashCup_Event5Round2_ME',
 S39:'https://fortnitetracker.com/events/epicgames_S39_ReloadCashVictoryCup_Dec_NAW?window=S39_ReloadCashVictoryCup_Event6Round2_NAW'
};
const sessions={
 S26:{date:'2023-10-09',region:'ME',event:'Zero Build Duos Victory Cup',
      round:'Event 5 · Round 2 / 賞金決勝',seasonId:'S26',chapter:4,season:4,
      tournamentId:'ch4s4-zero-build-duos-victory-cup'},
 S39:{date:'2025-12-21',region:'NAW',event:'Reload Duos Victory Cup',
      round:'Event 6 · Round 2 / 賞金決勝',seasonId:'S39',chapter:7,season:1,
      tournamentId:'ch7s1-reload-duos-victory'}
};
const profiles={
 'favsie':['https://fortnitetracker.com/profile/all/favsie/events?id=4d91273f-56bd-4e8c-811c-8a76f89c18b8','4d91273f-56bd-4e8c-811c-8a76f89c18b8'],
 'meah':['https://fortnitetracker.com/profile/all/meah/events?id=51942f08-b9c3-4f3e-bb12-5dd3e13fafa6','51942f08-b9c3-4f3e-bb12-5dd3e13fafa6'],
 'SnowFake796437':['https://fortnitetracker.com/profile/all/SnowFake796437/events?id=25c9ed91-d04f-40e5-b164-e297278f8958','25c9ed91-d04f-40e5-b164-e297278f8958'],
 'ちゃる':['https://fortnitetracker.com/profile/all/charufn/events?id=e3d0bd7d-4b8c-4e60-ac46-564918e3e3a1','e3d0bd7d-4b8c-4e60-ac46-564918e3e3a1'],
 'rakua':['https://fortnitetracker.com/profile/all/FPG%20rakua%207/events?id=25bcf8f3-70b8-42cf-8c1f-214420cfc594','25bcf8f3-70b8-42cf-8c1f-214420cfc594'],
 'ばなお':['https://fortnitetracker.com/profile/all/%E3%81%B0%E3%81%AA%E3%81%8A/events?id=9250f678-9c13-4522-b78f-c165e16b638c','9250f678-9c13-4522-b78f-c165e16b638c'],
 'rara':['https://fortnitetracker.com/profile/all/rara/events?id=3f961b08-6225-468a-acaa-8b6ba77cfb69','3f961b08-6225-468a-acaa-8b6ba77cfb69'],
 'ふぐ':['https://fortnitetracker.com/profile/all/Nana/events?id=d4f68975-28db-4438-b9f4-f67ae8f259b1','d4f68975-28db-4438-b9f4-f67ae8f259b1'],
 'asvaswgernb':['https://fortnitetracker.com/profile/all/asvaswgernb/events?id=34db6afd-2ce0-46be-8554-a813face02df','34db6afd-2ce0-46be-8554-a813face02df'],
 'Rura':['https://fortnitetracker.com/profile/all/Rura/events?id=d5e9dc74-c49e-4825-bd81-a9d69056c683','d5e9dc74-c49e-4825-bd81-a9d69056c683']
};
// Screenshots 1877/1878, 1880/1881/1882: ranks and total kills are
// independent, fixed checks; e.g. 3.33 avg elims across 3 games -> 10 kills.
const FIXED=Object.freeze([
 ['s26-me-zb-duos-vc-final-20231009-favsie-meah','S26',21,['favsie','meah'],['favsie','meah'],3,10,'1877'],
 ['s26-me-zb-duos-vc-final-20231009-snowfake-charufn','S26',25,['SnowFake796437','ちゃる'],['SnowFake796437','charufn'],2,5,'1878'],
 ['s39-naw-reload-duos-vc-final-20251221-rakua-banao','S39',11,['rakua','ばなお'],['FPG rakua 7','ばなお'],3,8,'1880'],
 ['s39-naw-reload-duos-vc-final-20251221-rara-fugu','S39',14,['rara','ふぐ'],['rara','Nana'],3,5,'1881'],
 ['s39-naw-reload-duos-vc-final-20251221-asvas-rura','S39',15,['asvaswgernb','Rura'],['asvaswgernb','Rura'],3,4,'1882']
]);
function makeRow(t){
 const [id,season,rank,players,raw,matches,kills,ss]=t,s=sessions[season];
 const urls=players.map(n=>({name:n,url:profiles[n][0]}));
 const ids=players.map(n=>profiles[n][1].replace(/-/g,''));
 return {
  id,date:s.date,region:s.region,player:players.join(' / '),players,
  playerRaw:raw.join(' / '),event:s.event,round:s.round,
  rank,points:100,matches,kills,vrs:1,prize:200,teamPrize:200,
  prizePerPlayer:100,kind:'賞金決勝',
  profiles:urls,teamAccountIds:ids,source:source[season],verified:true,
  seasonId:season,chapter:s.chapter,season:s.season,tournamentId:s.tournamentId,
  note:'2026-11-15ユーザー提供スクリーンショット ('+ss+').png をTrackerとEpic IDで確認。'+
       s.date+' '+s.region+' '+s.event+' '+s.round+'：'+rank+
       '位・100pt・'+matches+'試合・チーム'+kills+'キル・1VR・チーム賞金$200（各$100）。'+
       (id.includes('rakua-banao')?'「ばなお」の別Trackerプロフィールは本人申告に基づき同一選手へ統合。別アカウントのEpic IDは区別して保持。':'')+
       ' 出典 '+source[season]
 };
}
function apply(dryRun=false){
 const previous=readResults(ROOT),rows=previous.rows,roster=read('players.json'),catalog=read('tournaments.json');
 assert.equal(FIXED.length,5);
 const known=new Set(roster.candidates.map(r=>r.name));
 const newcomers=['SnowFake796437','rakua','ふぐ'];
 for(const n of newcomers)if(!known.has(n)){
  roster.candidates.push({
   name:n,initials:n==='SnowFake796437'?'SF':n==='rakua'?'RA':'ふぐ',accent:'cyan',
   desc:n==='SnowFake796437'?'2023/10/9 ME Zero Build Duos Victory Cup決勝25位・5チームK・1VR・個人賞金$100':
     n==='rakua'?'2025/12/21 NAW Reload Duos Victory Cup決勝11位・8チームK・1VR・個人賞金$100':
                '2025/12/21 NAW Reload Duos Victory Cup決勝14位・5チームK・1VR・個人賞金$100。Tracker名「Nana」'
  });
  known.add(n);
 }
 for(const [name,[url,id]] of Object.entries(profiles)){
  assert(known.has(name),'Missing canonical player '+name);
  const u=new URL(url);
  assert.equal(u.hostname,'fortnitetracker.com');
  assert.equal(u.searchParams.get('id'),id,'Incorrect exact Epic account UUID: '+name);
 }
 const owner=new Map([...known].map(n=>[n,n]));
 for(const [n,nicks] of Object.entries(roster.confirmedAliases)){
  assert(known.has(n),'Alias owner not present: '+n);
  for(const nick of nicks){assert(!owner.has(nick)||owner.get(nick)===n,
    'Existing alias collision '+nick);owner.set(nick,n);}
 }
 for(const [n,alias] of [['ちゃる','charufn'],['rakua','FPG rakua 7'],['ふぐ','Nana']]){
  assert(!owner.has(alias)||owner.get(alias)===n,'Alias claimed by another canonical: '+alias);
  if(!roster.confirmedAliases[n])roster.confirmedAliases[n]=[];
  if(!roster.confirmedAliases[n].includes(alias))roster.confirmedAliases[n].push(alias);
  owner.set(alias,n);
 }
 for(const row of rows){
  const existing=Array.isArray(row.profiles)?row.profiles:
    (row.profileUrl?[{name:row.player,url:row.profileUrl}]:[]);
  for(const old of existing){
   let uuid;try{uuid=new URL(old.url).searchParams.get('id')?.toLowerCase()}catch{continue}
   for(const [name,profile] of Object.entries(profiles)){
    if(uuid===profile[1]){
     assert(owner.get(old.name)===name||old.name===name,
       'Known Epic ID already assigned to different canonical: '+profile[1]+'/'+old.name+'/'+name);
    }
   }
  }
 }
 const proposal=FIXED.map(makeRow);
 const originalIds=new Set(rows.map(r=>r.id));
 for(const row of proposal){
  assert(!originalIds.has(row.id),'Duplicate source record ID: '+row.id);
  assert(catalog.catalog.some(t=>t.id===row.tournamentId),'Missing established tournament: '+row.tournamentId);
  assert.equal(row.prizePerPlayer*row.players.length,row.prize);
  assert(row.profiles.every((p,i)=>new URL(p.url).searchParams.get('id')?.replace(/-/g,'')===row.teamAccountIds[i]));
  const same=rows.filter(r=>r.date===row.date&&r.region===row.region&&
    r.event===row.event&&r.round===row.round&&
    (r.rank===row.rank||
     (Array.isArray(r.teamAccountIds)&&r.teamAccountIds.some(id=>row.teamAccountIds.includes(id)))||
     (Array.isArray(r.players)&&r.players.some(name=>row.players.includes(name)))));
  assert.equal(same.length,0,'Potential duplicate result or Epic identity on event: '+row.id);
 }
 assert.equal(new Set(proposal.map(r=>r.id)).size,5);
 const next=[...rows,...proposal];
 assert.equal(next.length,previous.manifest.count+5);
 const money=proposal.reduce((n,r)=>n+r.prizePerPlayer*r.players.length,0);
 assert.equal(money,1000);
 const report={mode:dryRun?'DRY_RUN':'APPLY',originalCount:previous.manifest.count,
  nextCount:next.length,addedPrizeUSD:money,added:proposal.map(x=>({id:x.id,rank:x.rank,players:x.players,kills:x.kills})),
  newCandidates:newcomers.filter(n=>!read('players.json').candidates.some(c=>c.name===n)),
  banaoAccount:profiles['ばなお'][1],banaoExistingAlias:roster.confirmedAliases['ばなお']};
 if(!dryRun){
  write('players.json',roster);
  const result=publishResults(ROOT,next);
  assert.equal(result.count,next.length);
  assert.deepEqual([...result.changedShards].sort(),['S26','S39']);
  console.log('SOURCE_PUBLICATION',JSON.stringify(result));
 }
 console.log('FIVE_ME_NAW_PROOF',JSON.stringify(report));
}
if(require.main===module){try{apply(process.argv.includes('--dry-run'))}catch(e){console.error(e.stack);process.exitCode=1}}
module.exports={apply,makeRow,FIXED};
