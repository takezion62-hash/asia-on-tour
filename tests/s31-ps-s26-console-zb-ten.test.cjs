'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {readResults}=require('../scripts/source-results-store.cjs');
const V=require('../scripts/verified-s31-ps-s26-console-zb-ten.cjs');
const root=path.resolve(__dirname,'..');
const proof=JSON.parse(fs.readFileSync(path.join(root,'data/manual-approvals/20261115-me-s31-ps-s26-console-zb-ten-proof.json'),'utf8'));
const players=JSON.parse(fs.readFileSync(path.join(root,'players.json'),'utf8'));
const catalog=JSON.parse(fs.readFileSync(path.join(root,'tournaments.json'),'utf8'));
test('10 original ME Tracker screenshots have fixed event windows, Epic IDs, stats, cash',()=>{
 assert.deepEqual(proof.batch.targets,V.TARGETS);
 assert.equal(V.TARGETS.length,10);
 assert.deepEqual(V.TARGETS.map(t=>[t.date,t.rank,t.points,t.matches,t.kills,t.vrs,t.prize]),[
  ['2024-09-02',92,4,4,0,0,200],['2024-09-02',94,2,4,1,0,200],
  ['2023-10-30',2,320,6,29,1,550],['2023-10-30',4,273,6,26,0,400],
  ['2023-10-30',5,241,6,29,0,350],['2023-10-30',7,221,6,19,1,300],
  ['2023-10-30',24,138,6,14,0,0],['2023-10-30',33,72,6,6,0,0],
  ['2023-10-30',35,69,6,5,0,0],['2023-10-30',46,38,6,4,0,0]]);
 assert.equal(V.TARGETS.reduce((n,t)=>n+t.prize,0),2000);
 assert.equal(V.TARGETS.filter(x=>x.prize===0).length,4);
 assert.equal(V.TARGETS.reduce((n,t)=>n+t.players.length,0),18);
 assert.equal(new Set(V.TARGETS.map(x=>x.id)).size,10);
 for(const t of V.TARGETS){
  assert.equal(V.payout(t),t.prize,t.id);
  assert.equal(t.prizePerPlayer*t.players.length,t.prize);
  assert.equal(t.profiles.length,t.players.length);
  assert.ok(catalog.catalog.some(x=>x.id===t.tournamentId&&x.sourceEventIds.includes(t.eventId)));
  assert.equal(t.sourceTracker,'https://fortnitetracker.com/events/epicgames_'+t.eventId+'_ME?window='+t.windowId);
  t.profiles.forEach((p,i)=>{assert.equal(V.uuid(p.url),p.id);assert.equal(t.players[i],p.name);});
 }
 assert.equal(V.payout({...V.TARGETS[0],rank:101}),null);
 assert.equal(V.payout({...V.TARGETS[2],rank:7}),300);
 assert.equal(V.payout({...V.TARGETS[2],rank:16}),0);
 assert.equal(V.payout({...V.TARGETS[2],region:'EU'}),null);
 assert.equal(V.payout({...V.TARGETS[2],windowId:'S26_ConsoleChampionsCupZB_OCE_Final'}),null);
});
test('approval audit rejects changed rank, individual/team payout, Epic ID or event',()=>{
 for(const t of V.TARGETS){
  const row={id:t.id,date:t.date,region:t.region,seasonId:t.seasonId,chapter:t.chapter,
    season:t.season,tournamentId:t.tournamentId,event:t.event,round:t.round,
    rank:t.rank,points:t.points,matches:t.matches,kills:t.kills,vrs:t.vrs,
    prize:t.prize,teamPrize:t.prize,prizePerPlayer:t.prizePerPlayer,
    player:t.players.join(' / '),playerRaw:t.playerRaw,players:[...t.players],
    profiles:t.profiles.map(p=>({name:p.name,url:p.url})),
    teamAccountIds:t.profiles.map(p=>p.id.replace(/-/g,'')),
    source:t.sourceTracker,verified:true,kind:'賞金決勝',
    note:'各選手$'+t.prizePerPlayer+' '+t.sourceTracker+' '+t.rule};
  const e={id:t.id,recordId:t.id,policy:V.POLICY,decision:'published',source:t.sourceTracker,rule:t.rule};
  assert.equal(V.verifyRow(row,e),true,t.id);
  for(const [k,v] of [['rank',t.rank+1],['points',-1],['kills',99],
    ['prize',t.prize+200],['prizePerPlayer',-1],['source','https://invalid.example/']])
   assert.equal(V.verifyRow({...row,[k]:v},e),false,t.id+' '+k);
  assert.equal(V.verifyRow({...row,teamAccountIds:row.teamAccountIds.map(()=> '00000000000000000000000000000000')},e),false);
  assert.equal(V.verifyRow(row,{...e,policy:'attendance-only'}),false);
  assert.equal(V.verifyRow({...row,kind:'決勝'},e),false);
 }
});
test('one ZB Console final keeps cash and zero-cash teams together, without merging player identities',()=>{
 const cat=catalog.catalog.find(x=>x.id==='ch4s4-zero-build-console-champions-cup');
 assert.equal(cat.mode,'zero-build');
 assert.equal(cat.team,'duo');
 assert.equal(cat.platform,'console');
 assert.equal(cat.series,'console-champions-cup');
 assert.ok(catalog.axes.find(x=>x.key==='series').options.some(x=>x.id===cat.series));
 assert.ok(catalog.axes.find(x=>x.key==='subtype').options.some(x=>x.id===cat.subtype));
 const console=V.TARGETS.filter(x=>x.seasonId==='S26');
 assert.equal(new Set(console.map(x=>x.round)).size,1);
 assert.equal(new Set(console.map(x=>x.windowId)).size,1);
 assert.equal(console.filter(x=>x.prize===0).length,4);
 const names=new Set(players.candidates.map(p=>p.name));
 for(const name of ['TakoBeL','Solary Kurаmа','Asuka','KanA','りんたろう','Meip','ultrxMarin','らる','p1ng','RGN p1ng'])assert.ok(names.has(name));
 assert.ok(players.confirmedAliases['らる'].includes('はあちゃまっちゃまーwwǃǃӜ'));
 assert.equal(V.TARGETS[8].profiles[0].raw,'はあちゃまっちゃまーwwǃǃӜ');
 assert.equal(V.TARGETS[9].profiles[0].raw,'Wcr oco');
 assert.equal(V.TARGETS[9].players[1],'p1ng');
 const rows=readResults(root).rows;
 assert.ok(rows.some(x=>x.id==='s31-me-ps-sypherpk-final-20240902-rintaro'));
 assert.ok(rows.some(x=>x.id==='s26-me-zb-duos-vc-final-20231023-r4'));
 for(const t of V.TARGETS){
  const same=rows.filter(x=>x.id===t.id);
  assert.ok(same.length<=1);
  if(same.length)assert.deepEqual([same[0].rank,same[0].prize],[t.rank,t.prize]);
 }
});
