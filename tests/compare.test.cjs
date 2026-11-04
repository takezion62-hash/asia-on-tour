'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const compare=require('../compare.js');

const playerNames=['Shiroka','かめてぃん','3peace','Extra'];
const sample=(id,extra={})=>({
 id,date:'2026-10-01',player:'Shiroka',players:['Shiroka'],region:'ME',
 event:'Solo Victory Cup Battle Royale',kind:'賞金決勝',
 rank:2,vrs:1,kills:3,prize:100,prizePerPlayer:null,
 seasonId:'S42',series:'victory-cup',mode:'battle-royale',verified:true,...extra
});
const personal=row=>{
 if(row.verified!==true||row.reported||row.partial||!['賞金決勝','決勝','Practice決勝','Performance決勝'].includes(row.kind)||
   typeof row.prize!=='number'||row.prize<=0)return 0;
 return row.players.length===1?row.prize:
   typeof row.prizePerPlayer==='number'&&row.prizePerPlayer>0
   &&row.prizePerPlayer*row.players.length<=row.prize?row.prizePerPlayer:0;
};
const helpers={
 available:playerNames,
 seasonOf:row=>row.seasonId,
 classify:row=>({series:row.series,mode:row.mode}),
 names:row=>row.players,
 individualPrize:personal,
 confirmedPrizeFinalRank:row=>row.kind==='賞金決勝'&&Number.isInteger(row.rank)&&row.rank>0?row.rank:null,
 prCalculate:rows=>{
  const byName=new Map();
  for(const row of rows)for(const name of row.players){
   const current=byName.get(name)?.score||0;byName.set(name,{score:current+10});
  }
  return {byName};
 },
 seasons:['S42','S43','unknown'],
 series:['cash-cup','victory-cup','fncs','performance-evaluation']
};
const go=(rows,selected=playerNames.slice(0,3),filter={})=>
 compare.build(rows,selected,filter,helpers);

test('comparison config: exactly 2 to 3 distinct known player identities',()=>{
 assert.equal(compare.VERSION,1);
 assert.equal(compare.MAX_PLAYERS,3);
 assert.equal(compare.METRICS.length,8);
 assert.deepEqual(compare.cleanPlayers(['Shiroka','Shiroka','3peace','かめてぃん','Extra','Unknown'],playerNames),
   ['Shiroka','3peace','かめてぃん']);
 assert.deepEqual(compare.cleanPlayers(['Unknown','Extra',null],playerNames),['Extra']);
 assert.deepEqual(compare.cleanPlayers(null,playerNames),[]);
});
test('all players receive identical season, region, series and mode filters',()=>{
 const rows=[
  sample('me-shiroka'),
  sample('me-3peace',{player:'3peace',players:['3peace']}),
  sample('eu-shiroka',{region:'EU',prize:200}),
  sample('me-old',{date:'2026-08-01',seasonId:'S41'}),
  sample('me-cash',{series:'cash-cup',event:'Solo Cash Cup'}),
  sample('me-zb',{mode:'zero-build',event:'Zero Build Cup'})
 ];
 const result=go(rows,['Shiroka','3peace'],{season:'S42',region:'ME',mode:'battle-royale',series:'victory-cup'});
 assert.equal(result.players.length,2);
 assert.deepEqual(result.players.map(row=>row.values.results),[1,1]);
 assert.deepEqual(result.players.map(row=>row.values.cash),[100,100]);
 assert.deepEqual(result.players.map(row=>row.values.pr),[10,10]);
 assert.equal(result.selectedRows,2);
 assert.equal(result.filters.series,'victory-cup');
 const reset=go(rows,['Shiroka','3peace'],{season:'all'});
 assert.equal(reset.players[0].values.results,5);
 assert.equal(reset.players[1].values.results,1);
});
test('individual prize is never inferred from duo/team total; award only explicit personal share',()=>{
 const team=sample('duo',{
  player:'Shiroka / 3peace',players:['Shiroka','3peace'],
  event:'Duos Cash Cup',series:'cash-cup',prize:600,prizePerPlayer:300
 });
 const unknown=sample('unknown',{
  player:'Shiroka / 3peace',players:['Shiroka','3peace'],
  event:'Duos Cash Cup',series:'cash-cup',prize:1000,prizePerPlayer:null
 });
 const invalid=sample('invalid',{
  player:'Shiroka / 3peace',players:['Shiroka','3peace'],
  event:'Duos Cash Cup',series:'cash-cup',prize:100,prizePerPlayer:80
 });
 const obj=go([team,unknown,invalid],['Shiroka','3peace']);
 for(const p of obj.players){
  assert.equal(p.values.cash,300);
  assert.equal(p.values.prizeCount,1);
  assert.equal(p.values.results,3);
 }
});
test('VRs report unknown rather than fabricating zero and count team VR per participant',()=>{
 const rowUnknown=sample('missing',{vrs:null,prize:0});
 const zero=sample('zero',{vrs:0,prize:0});
 const duo=sample('duo',{players:['Shiroka','3peace'],player:'Shiroka / 3peace',vrs:2});
 const result=go([rowUnknown,zero,duo],['Shiroka','3peace','かめてぃん']);
 assert.equal(result.players[0].values.vrs,2);
 assert.equal(result.players[0].knownVR,2);
 assert.equal(result.players[0].roundsWithoutVR,1);
 assert.equal(result.players[1].values.vrs,2);
 assert.equal(result.players[2].values.vrs,null);
 assert.equal(result.players[2].values.results,0);
});
test('finals, paid podiums and distinct overseas regions respect confirmed outcomes',()=>{
 const rows=[
  sample('final1',{region:'ME',rank:1}),
  sample('final2',{region:'EU',rank:3,prize:0}),
  sample('practice',{kind:'Practice決勝',region:'NAW',rank:1,prize:0}),
  sample('qual',{kind:'予選',rank:1,region:'OCE',prize:0}),
  sample('unknown-rank',{kind:'決勝',rank:null,region:'BR',prize:0}),
  sample('cosmetic',{kind:'スキン大会',rank:1,region:'ME',prize:0})
 ];
 const p=go(rows,['Shiroka']).players[0];
 assert.equal(p.values.finals,3);
 assert.equal(p.values.podiums,2);
 assert.equal(p.wins,1);
 assert.equal(p.values.regions,5);
 assert.deepEqual(p.regions,['ME','EU','NAW','OCE','BR']);
});
test('verified records only, exact roster names, repeated IDs and conflicting duplicates are handled',()=>{
 const first=sample('a');
 const row={...first};
 const inconsistent={...first,prize:999};
 const unverified=sample('unverified',{verified:false,prize:999});
 const reported=sample('reported',{reported:true,prize:999});
 const other=sample('other',{player:'NotShiroka',players:['NotShiroka']});
 const clean=go([first,row,unverified,reported,other],['Shiroka']);
 assert.equal(clean.players[0].values.results,1);
 assert.equal(clean.duplicateCount,1);
 const conflicting=go([first,inconsistent],['Shiroka']);
 assert.equal(conflicting.players[0].values.results,0);
 assert.equal(conflicting.conflictingDuplicateCount,1);
});
test('invalid series/mode/region filters cannot change comparison into unsupported classifications',()=>{
 assert.deepEqual(compare.sanitize({season:'wrong',region:'ASIA',mode:'unknown',series:'other'},
  ['fncs'],['S42']),{season:'all',region:'all',mode:'all',series:'all'});
 assert.equal(go([sample('a')],['Shiroka'],{series:'fncs'}).players[0].values.results,0);
 assert.equal(go([sample('a')],['Shiroka'],{region:'NAC'}).players[0].values.results,0);
 assert.equal(go([sample('a')],['Shiroka'],{mode:'reload'}).players[0].values.results,0);
});
test('comparison engine leaves source rows unchanged and emits region breakdown for empty players',()=>{
 const rows=[sample('a'),sample('b',{region:'NAC',prize:200})];
 const before=JSON.stringify(rows);
 const result=go(rows,['Shiroka','かめてぃん']);
 assert.equal(JSON.stringify(rows),before);
 assert.equal(result.players[0].byRegion.ME.cash,100);
 assert.equal(result.players[0].byRegion.NAC.cash,200);
 assert.equal(result.players[1].byRegion.ME.cash,0);
 assert.equal(result.players[1].values.pr,0);
});
