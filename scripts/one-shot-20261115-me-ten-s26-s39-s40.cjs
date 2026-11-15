'use strict';
// Temporary screenshot-backed ingest. Removed from branch after successful run.
// Strictly append ten new source records; never overwrite another published row.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ROOT=path.resolve(__dirname,'..');
const {readResults,publishResults}=require('./source-results-store.cjs');
const read=name=>JSON.parse(fs.readFileSync(path.join(ROOT,name),'utf8'));
const write=(name,obj)=>fs.writeFileSync(path.join(ROOT,name),JSON.stringify(obj,null,2)+'\n');
const TRACK='https://fortnitetracker.com/events/epicgames_';
const urls={
 'さばべる':'https://fortnitetracker.com/profile/all/N%C5%81T%20SVBL%20%E8%99%8E/events?id=469d92dc-f57e-46fc-b229-382e77bb6f4f',
 'meah':'https://fortnitetracker.com/profile/all/meah/events?id=51942f08-b9c3-4f3e-bb12-5dd3e13fafa6',
 'Jaemon':'https://fortnitetracker.com/profile/all/Jaemon/events?id=dcc5f4df-088a-4bca-b405-8b9b0fb2f97c',
 'Xeno':'https://fortnitetracker.com/profile/all/Xeno/events?id=0a00aafa-f3e4-4dce-b1e6-9de37908e040',
 'RiaM':'https://fortnitetracker.com/profile/all/RiaM/events?id=dbc01485-7ea8-438c-9fa0-9ecf7c649508',
 'なぬ':'https://fortnitetracker.com/profile/all/FPG%20Nanu%C7%83/events?id=f6a0d369-877e-4feb-86da-cb4b01af793e',
 'Emer4i':'https://fortnitetracker.com/profile/all/Emer4i/events?id=fb67efbb-dbd7-4fd5-9e8b-252e822b85d5',
 'MMC KAAN BABA':'https://fortnitetracker.com/profile/all/MMC%20KAAN%20BABA/events?id=2bf3a503-80fa-49ff-a655-2c23c2e384cf',
 'みるやちぇ':'https://fortnitetracker.com/profile/all/%E3%81%BF%E3%82%8B%E3%82%84%E3%81%A1%E3%81%87/events?id=dd786061-211a-46fb-b849-4687e32189b9',
 'きおらび':'https://fortnitetracker.com/profile/all/%E3%81%8D%E3%81%8A%E3%82%89%E3%81%B3/events?id=7dcdf989-faa3-47fb-bab8-c2228abb4142',
 'めろんなんばーわん':'https://fortnitetracker.com/profile/all/%E3%82%81%E3%82%8D%E3%82%93%E3%81%AA%E3%82%93%E3%81%B0%E3%83%BC%E3%82%8F%E3%82%93/events?id=9ad60a80-f89b-432f-a134-857d0077251a',
 'ばなお':'https://fortnitetracker.com/profile/all/%E3%81%B0%E3%81%AA%E3%81%8A%E3%81%95%E3%81%B6%EF%BD%B3%EF%BD%B7-%C7%83%C7%83/events?id=06029e26-8e21-4d07-855e-130a08f4675a',
 'とまと':'https://fortnitetracker.com/profile/all/HELIX%20BRN%20%E3%81%A8%E3%81%BE%E3%81%A8/events?id=59961cf9-8926-4124-85ee-18cd97290164'
};
const expected={
 'さばべる':'469d92dc-f57e-46fc-b229-382e77bb6f4f',
 'meah':'51942f08-b9c3-4f3e-bb12-5dd3e13fafa6',
 'Jaemon':'dcc5f4df-088a-4bca-b405-8b9b0fb2f97c',
 'Xeno':'0a00aafa-f3e4-4dce-b1e6-9de37908e040',
 'RiaM':'dbc01485-7ea8-438c-9fa0-9ecf7c649508',
 'なぬ':'f6a0d369-877e-4feb-86da-cb4b01af793e',
 'Emer4i':'fb67efbb-dbd7-4fd5-9e8b-252e822b85d5',
 'MMC KAAN BABA':'2bf3a503-80fa-49ff-a655-2c23c2e384cf',
 'みるやちぇ':'dd786061-211a-46fb-b849-4687e32189b9',
 'きおらび':'7dcdf989-faa3-47fb-bab8-c2228abb4142',
 'めろんなんばーわん':'9ad60a80-f89b-432f-a134-857d0077251a',
 'ばなお':'06029e26-8e21-4d07-855e-130a08f4675a',
 'とまと':'59961cf9-8926-4124-85ee-18cd97290164'
};
const sessions={
 S40:{date:'2026-04-06',event:'Solo Victory Cup',
  round:'Day 3 · Round 2 / 賞金決勝',source:TRACK+'S40_SoloVictoryCup_ME?window=S40_SoloVictoryCup_Round2_Day3_ME',
  tournamentId:'ch7s2-solo-victory',chapter:7,season:2},
 S39FNCS:{date:'2026-03-08',event:'FNCS Division 1',
  round:'Week 5 · Final / 賞金決勝',source:TRACK+'S39_FNCSDivisionalCup_Division1_ME?window=S39_FNCSDivisionalCup_Division1_Week5Final_ME',
  tournamentId:'ch7s1-fncs-division-1',chapter:7,season:1,seasonId:'S39'},
 S39DUO:{date:'2026-01-20',event:'Duos Victory Cup',
  round:'Day 3 · Round 2 / 賞金決勝',source:TRACK+'S39_DuosVictoryCup_ME?window=S39_DuosVictoryCup_Round2_Day3_January_ME',
  tournamentId:'ch7s1-duos-victory',chapter:7,season:1,seasonId:'S39'},
 S26:{date:'2023-10-09',event:'Zero Build Duos Victory Cup',
  round:'Event 5 · Round 2 / 賞金決勝',source:TRACK+'S26_DuosZBVictoryCashCup_ME?window=S26_DuosZBVictoryCashCup_Event5Round2_ME',
  tournamentId:'ch4s4-zero-build-duos-victory-cup',chapter:4,season:4}
};
const proof=[
 // [record suffix, session, canonical roster, raw roster, rank, pts, matches, kills, VR, source screenshot]
 ['s40-me-solo-vc-final-20260406-svbl','S40',['さばべる'],['NŁT SVBL 虎'],8,100,2,7,1,'1866'],
 ['s40-me-solo-vc-final-20260406-meah','S40',['meah'],['meah'],13,100,3,6,1,'1867'],
 ['s40-me-solo-vc-final-20260406-jaemon','S40',['Jaemon'],['Jaemon'],15,100,3,5,1,'1868'],
 ['s40-me-solo-vc-final-20260406-xeno','S40',['Xeno'],['Xeno'],19,100,3,1,1,'1869'],
 ['s39-me-fncs-div1-week5-final-20260308-meah-riam','S39FNCS',['meah','RiaM'],['meah','RiaM'],17,132,6,9,0,'1870'],
 ['s39-me-duos-vc-final-20260120-meah-riam','S39DUO',['meah','RiaM'],['meah','RiaM'],12,100,3,16,1,'1872'],
 ['s26-me-zb-duos-vc-final-20231009-nanu-emer4i','S26',['なぬ','Emer4i'],['FPG Nanuǃ','Emer4i'],10,100,3,19,1,'1873'],
 ['s26-me-zb-duos-vc-final-20231009-kaan-miru','S26',['MMC KAAN BABA','みるやちぇ'],['MMC KAAN BABA','みるやちぇ'],14,100,2,11,1,'1874'],
 ['s26-me-zb-duos-vc-final-20231009-kiorabi-melon','S26',['きおらび','めろんなんばーわん'],['きおらび','めろんなんばーわん'],18,100,3,12,1,'1875'],
 ['s26-me-zb-duos-vc-final-20231009-banao-tomato','S26',['ばなお','とまと'],['ばなおさぶｳｷ-ǃǃ','HELIX BRN とまと'],20,100,3,11,1,'1876']
];
function makeRow(tuple){
 const [id,key,players,raw,rank,points,matches,kills,vrs,screenshot]=tuple;
 const s=sessions[key];assert(s,'unsupported session '+key);
 const money=players.length===1?100:200;
 const profiles=players.map(name=>({name,url:urls[name]}));
 const uuids=players.map(name=>expected[name].replace(/-/g,''));
 const r={
  id,date:s.date,region:'ME',
  player:players.join(' / '),players,playerRaw:raw.join(' / '),
  event:s.event,round:s.round,rank,points,matches,kills,vrs,prize:money,
  teamPrize:money,prizePerPlayer:100,kind:'賞金決勝',
  profiles,teamAccountIds:uuids,source:s.source,verified:true,
  seasonId:s.seasonId||key,chapter:s.chapter,season:s.season,tournamentId:s.tournamentId,
  note:'ユーザー提供の2026-11-15スクリーンショット ('+screenshot+
   ').pngを本人Epic UUIDと照合。ME '+s.date+' '+s.event+' '+s.round+
   ' '+rank+'位、'+points+'pt、'+matches+'試合、'+kills+'チームキル、'+vrs+
   'VR、'+(players.length===2?'チーム賞金$200・各$100':'個人賞金$100')+
   '。出典: '+s.source+
   (id.endsWith('banao-tomato')?'。ばなおは現在のTrackerアカウントが別でもユーザーが同一人物と申告、既存「ばなお」に統合して別名を保持。':'')
 };
 return r;
}
function addAlias(players,owner,name){
 if(owner===name)return;
 if(!players.confirmedAliases[owner])players.confirmedAliases[owner]=[];
 if(!players.confirmedAliases[owner].includes(name))players.confirmedAliases[owner].push(name);
}
function main(dryRun){
 assert.equal(proof.length,10);
 const before=readResults(ROOT),catalog=read('tournaments.json'),players=read('players.json');
 const originals=before.rows, ids=new Set(originals.map(r=>r.id));
 assert.equal(ids.size,originals.length,'Source already has duplicate IDs');
 const known=new Set(players.candidates.map(c=>c.name));
 const newCandidates=['なぬ','Emer4i'];
 for(const name of newCandidates)if(!known.has(name)){
  players.candidates.push({name,initials:name==='なぬ'?'NN':'EM',accent:'cyan',
    desc:'2023/10/9 ME Zero Build Duos Victory Cup 決勝10位、1VR、個人賞金$100。ユーザー提供Tracker本人IDで照合。'});
  known.add(name);
 }
 for(const [name,id] of Object.entries(expected)){
  assert(known.has(name),'Missing canonical name: '+name);
  const parsed=new URL(urls[name]);
  assert.equal(parsed.hostname,'fortnitetracker.com');
  assert.equal(parsed.searchParams.get('id'),id,'Epic account UUID mismatch: '+name);
 }
 const owner=new Map();
 for(const n of known)owner.set(n,n);
 for(const [n,aliases] of Object.entries(players.confirmedAliases)){
  assert(known.has(n),'alias owner not canonical: '+n);
  for(const alias of aliases){
   assert(!owner.has(alias)||owner.get(alias)===n,'Preexisting nickname collision: '+alias);
   owner.set(alias,n);
  }
 }
 const aliasPairs=[
  ['なぬ','FPG Nanuǃ'],['さばべる','NŁT SVBL 虎'],
  ['ばなお','ばなおさぶｳｷ-ǃǃ'],['とまと','HELIX BRN とまと']
 ];
 for(const [n,a] of aliasPairs){
  assert(!owner.has(a)||owner.get(a)===n,'Nickname owned by different player: '+a);
  addAlias(players,n,a);owner.set(a,n);
 }
 const fncsId='ch7s1-fncs-division-1';
 if(!catalog.catalog.some(t=>t.id===fncsId)){
  catalog.catalog.push({
   id:fncsId,name:'FNCS Division 1',chapter:7,season:1,seasonId:'S39',
   sourceEventIds:['S39_FNCSDivisionalCup_Division1'],
   series:'fncs',mode:'battle-royale',subtype:'fncs-division-1',
   team:'duo',platform:'cross-platform',unknownFields:[],
   evidence:[{text:'ユーザー提供2026/3/8 ME Week5 Final。17位、132pt、6試合、9K、0VR、チーム賞金$200・各$100',url:sessions.S39FNCS.source}]
  });
 }
 const proposal=proof.map(makeRow);
 for(const row of proposal){
  assert(!ids.has(row.id),'Expected new ID already exists: '+row.id);
  assert(!originals.some(r=>r.seasonId===row.seasonId&&r.region===row.region&&
     r.source===row.source&&r.rank===row.rank),
    'Same tournament and rank may already be registered: '+row.id);
  assert(!originals.some(r=>r.seasonId===row.seasonId&&r.region===row.region&&
     r.date===row.date&&r.event===row.event&&r.rank===row.rank&&
     ((r.players||[r.player]).some(n=>row.players.includes(n)))),
    'Possible duplicate person and rank: '+row.id);
  assert.equal(row.prize, row.players.length*100);
  assert.equal(row.profiles.length, row.players.length);
  assert.equal(row.teamAccountIds.length,row.players.length);
  const u=new URL(row.source);
  assert(u.searchParams.get('window'),'Missing exact event round window');
  assert(catalog.catalog.some(t=>t.id===row.tournamentId),'Missing tournament '+row.tournamentId);
 }
 const proposed=[...originals,...proposal];
 assert.equal(new Set(proposed.map(r=>r.id)).size,proposed.length);
 const report={dryRun,addedRecords:proposal.length,
   countBefore:before.manifest.count,countAfter:proposed.length,
   newPlayers:newCandidates.filter(n=>!read('players.json').candidates.some(c=>c.name===n)),
   aliases:aliasPairs,teamPrizeAdded:proposal.reduce((s,r)=>s+r.prize,0),
   personPrizeAdded:proposal.reduce((s,r)=>s+r.prizePerPlayer*r.players.length,0),
   rows:proposal.map(r=>({id:r.id,rank:r.rank,players:r.players,kills:r.kills,prize:r.prize}))};
 if(!dryRun){
  write('players.json',players);
  write('tournaments.json',catalog);
  const result=publishResults(ROOT,proposed);
  assert.equal(result.count,proposed.length);
  assert.deepEqual([...result.changedShards].sort(),['S26','S39','S40']);
  console.log('SOURCE_SNAPSHOT_UPDATED',JSON.stringify(result));
 }
 console.log('VERIFIED_SCREENSHOT_BATCH',JSON.stringify(report));
}
if(require.main===module)try{main(process.argv.includes('--dry-run'))}catch(e){console.error(e.stack);process.exitCode=1}
module.exports={main,makeRow,proof};
