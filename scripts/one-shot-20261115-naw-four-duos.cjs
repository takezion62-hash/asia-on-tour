'use strict';
// One-shot 2026-11-15 user screenshot ingest. Remove script and workflow before PR.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {readResults,publishResults}=require('./source-results-store.cjs');
const ROOT=path.resolve(__dirname,'..');
const load=p=>JSON.parse(fs.readFileSync(path.join(ROOT,p),'utf8'));
const save=(p,obj)=>fs.writeFileSync(path.join(ROOT,p),JSON.stringify(obj,null,2)+'\n');
const season={
 S39:{date:'2025-12-14',region:'NAW',event:'Reload Duos Victory Cup',
  round:'Event 3 · Round 2 / 賞金決勝',seasonId:'S39',chapter:7,season:1,
  tournamentId:'ch7s1-reload-duos-victory',
  source:'https://fortnitetracker.com/events/epicgames_S39_ReloadCashVictoryCup_Dec_NAW?window=S39_ReloadCashVictoryCup_Event3Round2_NAW'},
 S36:{date:'2025-06-28',region:'NAW',event:'Duos Console Victory Cash Cup',
  round:'Event 3 · Round 2 / 賞金決勝',seasonId:'S36',chapter:6,season:3,
  tournamentId:'ch6s3-console-duos-victory',
  source:'https://fortnitetracker.com/events/epicgames_S36_VictoryDuosCup_NAW?window=S36_VictoryDuosCup_Event3Round2_NAW'}
};
const known={
 'ぼんばーずべいび': ['https://fortnitetracker.com/profile/all/%E3%81%BC%E3%82%93%E3%81%B0%E3%83%BC%E3%81%9A%E3%81%B9%E3%81%84%E3%81%B3/events?id=a0ed2b15-f365-481a-9e99-d30eba5ab0d7','a0ed2b15-f365-481a-9e99-d30eba5ab0d7'],
 'Teddy':['https://fortnitetracker.com/profile/all/Teddy/events?id=bc21ab3c-0a5f-4da8-b83c-7b085084aae0','bc21ab3c-0a5f-4da8-b83c-7b085084aae0'],
 'Pegu':['https://fortnitetracker.com/profile/all/pegu/events?id=4988cefe-843f-4a6b-b6a8-6f8c3b1daafa','4988cefe-843f-4a6b-b6a8-6f8c3b1daafa'],
 'Rura':['https://fortnitetracker.com/profile/all/Rura/events?id=d5e9dc74-c49e-4825-bd81-a9d69056c683','d5e9dc74-c49e-4825-bd81-a9d69056c683'],
 'おこっとふー':['https://fortnitetracker.com/profile/all/%E3%81%8A%E3%81%93%E3%81%A3%E3%81%A8%E3%81%B5%E3%83%BC/events?id=027c5e96-3b4b-4c2c-8e82-3070b1638de4','027c5e96-3b4b-4c2c-8e82-3070b1638de4'],
 'あすふぁろず':['https://fortnitetracker.com/profile/all/%E3%81%82%E3%81%99%E3%81%B5%E3%81%81%E3%82%8D%E3%81%9A/events?id=de58135a-20f2-4516-8875-431fd8dd9fc3','de58135a-20f2-4516-8875-431fd8dd9fc3']
};
// id, season, rank, canonical names, raw tracker names, points, matches, kills, VR, individual prize, screenshot
const PROOFS=[
 ['s39-naw-reload-duos-vc-final-20251214-bonbaby-teddy','S39',11,['ぼんばーずべいび','Teddy'],['ぼんばーずべいび','Teddy'],100,3,8,1,100,'1883'],
 ['s39-naw-reload-duos-vc-final-20251214-pegu-rura','S39',15,['Pegu','Rura'],['pegu','Rura'],100,3,4,1,100,'1884'],
 ['s36-naw-console-duos-vc-final-20250628-pegu-rura','S36',2,['Pegu','Rura'],['pegu','Rura'],200,3,8,2,200,'1885'],
 ['s36-naw-console-duos-vc-final-20250628-okotto-asufaro','S36',7,['おこっとふー','あすふぁろず'],['おこっとふー','あすふぁろず'],100,3,12,1,100,'1886']
];
function row(proof){
 const [id,seasonId,rank,players,raw,points,matches,kills,vrs,prizePerPlayer,screenshot]=proof,s=season[seasonId];
 assert(s);
 const profiles=players.map(name=>({name,url:known[name][0]}));
 const teamAccountIds=players.map(name=>known[name][1].replace(/-/g,''));
 const prize=prizePerPlayer*2;
 return {id,date:s.date,region:s.region,player:players.join(' / '),players,
  playerRaw:raw.join(' / '),event:s.event,round:s.round,
  rank,points,matches,kills,vrs,prize,teamPrize:prize,prizePerPlayer,
  kind:'賞金決勝',profiles,teamAccountIds,source:s.source,verified:true,
  seasonId:s.seasonId,chapter:s.chapter,season:s.season,tournamentId:s.tournamentId,
  note:'2026-11-15ユーザー提供スクリーンショット ('+screenshot+
   ').png と各Epic UUIDを照合。'+s.date+' NAW '+s.event+' '+s.round+
   '：'+rank+'位、'+points+'pt、'+matches+'試合、チーム'+kills+
   'K、'+vrs+'VR、チーム$'+prize+'・各選手$'+prizePerPlayer+
   '。既存「Pegu」とTracker名「pegu」は同じ登録名義。出典: '+s.source};
}
function run(dry){
 assert.equal(PROOFS.length,4);
 const original=readResults(ROOT);
 const players=load('players.json');
 const tournament=load('tournaments.json');
 const knownNames=new Set(players.candidates.map(p=>p.name));
 assert(knownNames.has('Pegu'));
 assert(Array.isArray(players.confirmedAliases['Pegu'])&&
   players.confirmedAliases['Pegu'].includes('pegu'),
   'Existing canonical Pegu nickname association changed');
 for(const [name,[url,id]] of Object.entries(known)){
  assert.equal(new URL(url).searchParams.get('id'),id,'Epic UUID: '+name);
  assert.equal(new URL(url).hostname,'fortnitetracker.com');
 }
 for(const name of ['ぼんばーずべいび','おこっとふー','あすふぁろず'])
  if(!knownNames.has(name)){
   players.candidates.push({name,initials:name==='ぼんばーずべいび'?'BB':name==='おこっとふー'?'OF':'AF',
    accent:'cyan',desc:name==='ぼんばーずべいび'?
     '2025/12/14 NAW Reload Duos Victory Cup決勝11位・8チームK・1VR・個人賞金$100（相方 Teddy）':
     '2025/6/28 NAW Duos Console Victory Cash Cup決勝7位・12チームK・1VR・個人賞金$100'});
   knownNames.add(name);
  }
 for(const [owner,aliases] of Object.entries(players.confirmedAliases)){
  assert(knownNames.has(owner),'Missing existing alias owner: '+owner);
  assert(Array.isArray(aliases));
 }
 const baselineIds=new Set(original.rows.map(r=>r.id));
 assert.equal(baselineIds.size,original.rows.length);
 const additions=PROOFS.map(row);
 for(const newRow of additions){
  assert(!baselineIds.has(newRow.id),'Duplicate record ID '+newRow.id);
  assert(tournament.catalog.some(t=>t.id===newRow.tournamentId),'Unknown tournament '+newRow.tournamentId);
  assert.equal(newRow.players.length,2);
  assert.equal(newRow.prize,2*newRow.prizePerPlayer);
  assert(newRow.teamAccountIds.every((id,i)=>
    id===new URL(newRow.profiles[i].url).searchParams.get('id')?.replace(/-/g,'')));
  const duplicate=original.rows.some(r=>{
   if(r.seasonId!==newRow.seasonId||r.region!==newRow.region||
      r.date!==newRow.date||r.event!==newRow.event||r.round!==newRow.round)return false;
   return r.rank===newRow.rank||
      (Array.isArray(r.players)&&r.players.some(n=>newRow.players.includes(n)))||
      (Array.isArray(r.teamAccountIds)&&r.teamAccountIds.some(id=>newRow.teamAccountIds.includes(id)));
  });
  assert(!duplicate,'Potential duplicate event/rank/identity: '+newRow.id);
 }
 assert.equal(new Set(additions.map(r=>r.id)).size,4);
 const next=[...original.rows,...additions];
 assert.equal(next.length,original.manifest.count+4);
 const cash=additions.reduce((sum,r)=>sum+r.prize,0);
 assert.equal(cash,1000);
 const report={dryRun:dry,previous:original.manifest.count,next:next.length,
  addedPrizeUSD:cash,records:additions.map(r=>({id:r.id,rank:r.rank,players:r.players,
   kills:r.kills,vrs:r.vrs,teamPrize:r.prize})),
  newPlayers:['ぼんばーずべいび','おこっとふー','あすふぁろず'].filter(n=>
   !load('players.json').candidates.some(p=>p.name===n))};
 if(!dry){
  save('players.json',players);
  const result=publishResults(ROOT,next);
  assert.equal(result.count,next.length);
  assert.deepEqual([...result.changedShards].sort(),['S36','S39']);
  console.log('SOURCE_PUBLISH',JSON.stringify(result));
 }
 console.log('FOUR_DUOS_AUDIT',JSON.stringify(report));
}
if(require.main===module){try{run(process.argv.includes('--dry-run'))}catch(e){console.error(e.stack);process.exitCode=1}}
module.exports={run,row,PROOFS};
