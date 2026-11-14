'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const path=require('node:path'),fs=require('node:fs');
const V=require('../scripts/verified-boter-s31-s38-nine.cjs');
const {readResults}=require('../scripts/source-results-store.cjs');
const root=path.resolve(__dirname,'..');
const proof=JSON.parse(fs.readFileSync(path.join(root,'data/manual-approvals/20261114-boter7-me-duos-s38-squad-nine-proof.json'),'utf8'));
const players=JSON.parse(fs.readFileSync(path.join(root,'players.json'),'utf8'));
const catalog=JSON.parse(fs.readFileSync(path.join(root,'tournaments.json'),'utf8'));

test('all nine screenshot results, team members and official cash formulas are locked',()=>{
 assert.equal(proof.version,1);
 assert.deepEqual(proof.batch.targets,V.TARGETS);
 assert.equal(V.TARGETS.length,9);
 assert.deepEqual(V.TARGETS.map(t=>[t.date,t.region,t.rank,t.matches,t.kills,t.vrs,t.prize]),
 [
 ['2025-11-10','NAW',12,3,4,1,400],
 ['2024-09-13','ME',22,6,10,0,200],
 ['2024-09-07','ME',28,2,9,1,200],
 ['2024-09-07','ME',37,3,9,1,200],
 ['2024-09-07','ME',40,3,8,1,200],
 ['2024-09-07','ME',43,3,6,1,200],
 ['2024-09-07','ME',46,2,3,1,200],
 ['2024-09-07','ME',47,3,4,1,200],
 ['2024-09-07','ME',48,2,2,1,200]
 ]);
 assert.equal(V.TARGETS.reduce((n,t)=>n+t.prize,0),2000);
 assert.equal(new Set(V.TARGETS.map(t=>t.id)).size,9);
 assert.equal(V.TARGETS.reduce((n,t)=>n+t.profiles.length,0),20);
 for(const t of V.TARGETS){
  assert.equal(V.payout(t),t.prize);
  assert.equal(t.prizePerPlayer*t.players.length,t.prize);
  assert.equal(t.profiles.length,t.players.length);
  for(let i=0;i<t.profiles.length;i++){
   assert.equal(t.profiles[i].name,t.players[i]);
   assert.equal(V.uuid(t.profiles[i].url),t.profiles[i].id);
  }
  assert.equal(t.sourceTracker,'https://fortnitetracker.com/events/epicgames_'+t.eventId+'_'+t.region+'?window='+t.windowId);
  assert.ok(catalog.catalog.some(x=>x.id===t.tournamentId&&x.sourceEventIds.includes(t.eventId)));
 }
 assert.equal(V.payout({...V.TARGETS[1],rank:41}),null);
 assert.equal(V.payout({...V.TARGETS[2],vrs:0}),null);
 assert.equal(V.payout({...V.TARGETS[0],vrs:0}),null);
});

test('9 reviewed rows refuse edited rank, VR cash, original team UUID or source',()=>{
 for(const t of V.TARGETS){
 const row={id:t.id,date:t.date,region:t.region,seasonId:t.seasonId,chapter:t.chapter,season:t.season,
  tournamentId:t.tournamentId,event:t.event,round:t.round,rank:t.rank,points:t.points,matches:t.matches,
  kills:t.kills,vrs:t.vrs,prize:t.prize,teamPrize:t.prize,prizePerPlayer:t.prizePerPlayer,
  player:t.players.join(' / '),playerRaw:t.playerRaw,players:[...t.players],source:t.sourceTracker,
  profiles:t.profiles.map(p=>({name:p.name,url:p.url})),
  teamAccountIds:t.profiles.map(p=>p.id.replace(/-/g,'')),
  kind:'賞金決勝',verified:true,note:'各選手$'+t.prizePerPlayer+' '+t.sourceTracker+' '+t.rule};
 const entry={id:t.id,recordId:t.id,decision:'published',policy:V.POLICY,source:t.sourceTracker,rule:t.rule};
 assert.equal(V.verifyCashRow(row,entry),true);
 for(const [key,value] of [['rank',t.rank+1],['kills',999],['vrs',t.vrs+1],['prize',0],
  ['points',999],['prizePerPlayer',0],['source','https://bad.invalid/']]){
  assert.equal(V.verifyCashRow({...row,[key]:value},entry),false,key+' must reject '+t.id);
 }
 assert.equal(V.verifyCashRow({...row,teamAccountIds:[...row.teamAccountIds].reverse().map(x=>'ffffffffffffffffffffffffffffffff')},entry),false);
 assert.equal(V.verifyCashRow(row,{...entry,policy:'attendance-only'}),false);
 }
});

test('new ME Boter region label is distinct from same generic influencer event in other regions',()=>{
 const boter=catalog.catalog.find(x=>x.id==='ch5s4-boter-fncs-cup');
 assert.equal(boter.name,'Boter FNCS Cup');
 assert.equal(boter.team,'duo');
 assert.deepEqual(boter.additionalSeries,['fncs']);
 assert.equal(boter.mode,'battle-royale');
 const other=catalog.catalog.filter(x=>x.sourceEventIds.includes('S31_InfluencerCup')&&x.id!==boter.id);
 assert.ok(other.some(x=>x.name==='ThePeachCobbler FNCS Cup'));
 assert.ok(other.some(x=>x.name==='AussieAntics FNCS Cup'));
});

test('UC.Yama 橘 belongs to Yama not lowercase yama; pegu and Puroboko aliases retained',()=>{
 assert.ok(players.candidates.some(p=>p.name==='Yama'));
 assert.ok(players.candidates.some(p=>p.name==='yama'));
 assert.ok(players.confirmedAliases.Yama.includes('UC.Yama 橘'));
 assert.ok(players.confirmedAliases.Pegu.includes('pegu'));
 assert.ok(players.confirmedAliases['ぷろぼこ'].includes('Puroboko'));
 assert.equal(V.TARGETS[7].players[1],'Yama');
 assert.equal(V.TARGETS[0].players[1],'Pegu');
});

test('already published separate events must not be overwritten',()=>{
 const rows=readResults(root).rows;
 assert.ok(rows.some(x=>x.id==='auto-s31-727a67581880'&&x.rank===17));
 assert.ok(rows.some(x=>x.id==='s38-naw-squads-vc-final-20251124-aster-tara-3peace-miyaguraru'&&x.rank===12));
 for(const t of V.TARGETS){
 const sameId=rows.filter(x=>x.id===t.id);
 assert.ok(sameId.length<=1);
 if(sameId.length)assert.deepEqual([sameId[0].rank,sameId[0].prize],[t.rank,t.prize]);
 }
});
