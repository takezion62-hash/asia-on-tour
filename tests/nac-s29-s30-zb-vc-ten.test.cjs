'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const V=require('../scripts/verified-nac-s29-s30-zb-vc-ten.cjs');
const {readResults}=require('../scripts/source-results-store.cjs');
const root=path.resolve(__dirname,'..');
const proof=JSON.parse(fs.readFileSync(path.join(root,'data/manual-approvals/20261114-nac-s29-s30-zb-vc-ten-proof.json'),'utf8'));
const players=JSON.parse(fs.readFileSync(path.join(root,'players.json'),'utf8'));
const tournaments=JSON.parse(fs.readFileSync(path.join(root,'tournaments.json'),'utf8'));

test('ten original Tracker screenshots have locked dates/ranks/kills/VRs and prize totals',()=>{
 assert.equal(proof.version,1);
 assert.deepEqual(proof.batch.targets,V.TARGETS);
 assert.equal(V.TARGETS.length,10);
 assert.deepEqual(V.TARGETS.map(t=>[t.date,t.rank,t.matches,t.kills,t.vrs,t.prize]),
 [['2024-06-25',70,3,7,1,100],['2024-06-25',72,3,7,1,100],
  ['2024-06-25',75,3,7,1,100],['2024-06-25',77,3,7,1,100],
  ['2024-06-25',114,3,3,1,100],['2024-06-18',78,3,8,1,100],
  ['2024-06-18',108,3,5,1,100],['2024-04-25',4,3,19,2,400],
  ['2024-04-25',54,3,15,1,200],['2024-04-25',93,3,6,1,200]]);
 assert.equal(V.TARGETS.reduce((n,t)=>n+t.prize,0),1500);
 assert.equal(V.TARGETS.reduce((n,t)=>n+t.profiles.length,0),13);
 assert.equal(new Set(V.TARGETS.map(t=>t.id)).size,10);
 for(const t of V.TARGETS){
  assert.equal(V.payout(t),t.prize);
  assert.equal(t.prize,t.profiles.length*t.prizePerPlayer);
  assert.equal(t.points,t.vrs*100);
  assert.equal(t.sourceTracker,'https://fortnitetracker.com/events/epicgames_'+t.eventId+'_NAC?window='+t.windowId);
  for(const [i,p] of t.profiles.entries()){
   assert.equal(V.uuid(p.url),p.id);
   assert.equal(p.name,t.players[i]);
  }
  assert.ok(tournaments.catalog.some(x=>x.id===t.tournamentId&&x.sourceEventIds.includes(t.eventId)));
 }
 assert.equal(V.payout({...V.TARGETS[0],region:'ME'}),null);
 assert.equal(V.payout({...V.TARGETS[0],vrs:0}),null);
 assert.equal(V.payout({...V.TARGETS[7],windowId:'S29_DuosZBVictoryCashCup_Event7Round2_NAC'}),null);
});
test('independent cash audit rejects altered original rank, payout, kills, event or Epic account',()=>{
 for(const t of V.TARGETS){
  const row={id:t.id,date:t.date,region:t.region,seasonId:t.seasonId,chapter:t.chapter,
   season:t.season,tournamentId:t.tournamentId,event:t.event,round:t.round,
   rank:t.rank,points:t.points,matches:t.matches,kills:t.kills,vrs:t.vrs,prize:t.prize,
   teamPrize:t.prize,prizePerPlayer:t.prizePerPlayer,
   player:t.players.join(' / '),playerRaw:t.playerRaw,players:[...t.players],
   profiles:t.profiles.map(x=>({name:x.name,url:x.url})),
   teamAccountIds:t.profiles.map(x=>x.id.replace(/-/g,'')),
   source:t.sourceTracker,verified:true,kind:'賞金決勝',
   note:'各選手$'+t.prizePerPlayer+' '+t.sourceTracker+' '+t.rule};
  const ledger={id:t.id,recordId:t.id,decision:'published',policy:V.POLICY,source:t.sourceTracker,rule:t.rule};
  assert.equal(V.verifyCashRow(row,ledger),true,t.id);
  for(const [k,v] of [['rank',t.rank+1],['kills',999],['vrs',0],['prize',0],
    ['points',999],['prizePerPlayer',0],['source','https://example.invalid/']])
   assert.equal(V.verifyCashRow({...row,[k]:v},ledger),false,k+' must fail '+t.id);
  assert.equal(V.verifyCashRow({...row,teamAccountIds:row.teamAccountIds.map(()=>'ffffffffffffffffffffffffffffffff')},ledger),false);
  assert.equal(V.verifyCashRow(row,{...ledger,policy:'attendance-only'}),false);
 }
});
test('preserve existing players and other competition results, split p1ng and RGN p1ng',()=>{
 const names=players.candidates.map(x=>x.name);
 for(const n of ['りんたろう','Lnano','TEITEI','KanA','favsie','seljuny','たら','p1ng','RGN p1ng'])
  assert.ok(names.includes(n),'missing original canonical player '+n);
 assert.notEqual(names.indexOf('p1ng'),names.indexOf('RGN p1ng'));
 const rs=readResults(root).rows;
 assert.ok(rs.some(x=>x.id==='s29-nac-zb-duos-vc-final-20240506-lily-meah'));
 assert.ok(rs.some(x=>x.id==='auto-s30-8cc481348018'&&x.event==='Solo Victory Cup Battle Royale'));
 for(const t of V.TARGETS){
  const same=rs.filter(x=>x.id===t.id);
  assert.ok(same.length<=1);
  if(same.length)assert.deepEqual([same[0].rank,same[0].prize],[t.rank,t.prize]);
 }
});
