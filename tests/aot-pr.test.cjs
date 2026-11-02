'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const PR = require('../aot-pr.js');
let next = 0;
const event = (other={}) => ({id:'e'+(++next), date:'2026-10-24', region:'NAW', event:'Solo Reload Victory Cup',
  round:'Event 5 · Round 2 / 賞金決勝', rank:1, kills:0, vrs:0, points:100,
  kind:'賞金決勝', source:'https://fortnitetracker.com/events/epicgames_S42_ReloadSoloVictoryCup_NAW?window=S42_ReloadSoloVictoryCup_Event5_Round2_NAW',
  verified:true, player:'P1', players:['P1'], ...other});
const catalog = (other={})=>({id:'s42-reload-vc', series:'victory-cup', subtype:'solo-reload-victory-cup',mode:'reload',team:'solo',...other});
const score=(records, cat=catalog(),options={})=>PR.calculate(records,{names:e=>e.players?.length?e.players:[e.player],classify:()=>cat,...options});
const approx=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-8,`${actual} != ${expected}`);

test('All six regional travel multipliers apply to the full score',()=>{
  for(const [region,multiplier] of Object.entries(PR.REGIONS)) {
    const row=event({region,source:`https://fortnitetracker.com/events/epicgames_S42_ReloadSoloVictoryCup_${region}?window=S42_ReloadSoloVictoryCup_Event5_Round2_${region}`,kills:10,rank:4});
    approx(score([row]).ranked[0].score,(10+50+7)*multiplier);
  }
});
test('Qualifying and final both count, attendance is exactly once per event',()=>{
  const qual=event({kind:'予選',round:'Event 5 · Round 1 / 予選',rank:4,kills:20,
    source:'https://fortnitetracker.com/events/epicgames_S42_ReloadSoloVictoryCup_NAW?window=S42_ReloadSoloVictoryCup_Event5_Round1_NAW'});
  const fin=event({rank:1,kills:10});
  const player=score([qual,fin]).ranked[0];
  assert.equal(player.appearances,1);assert.equal(player.roundRecords,2);
  approx(player.attendance,10);approx(player.placement,50*.35+100);approx(player.eliminations,14*.35+7);
});
test('Different event sessions on one date earn distinct attendance',()=>{
  const one=event({rank:null,kills:null,kind:'予選',round:'Event 4 · Round 1 / 予選',source:'https://fortnitetracker.com/events/epicgames_S42_ReloadSoloVictoryCup_NAW?window=S42_ReloadSoloVictoryCup_Event4_Round1_NAW'});
  const two=event({rank:null,kills:null,kind:'予選',round:'Event 5 · Round 1 / 予選',source:'https://fortnitetracker.com/events/epicgames_S42_ReloadSoloVictoryCup_NAW?window=S42_ReloadSoloVictoryCup_Event5_Round1_NAW'});
  assert.equal(score([one,two]).ranked[0].appearances,2);
  approx(score([one,two]).ranked[0].score,20);
});
test('Missing rank and kills are not fabricated; confirmed participation remains',()=>{
  const report=score([event({rank:null,kills:null})]);
  assert.equal(report.missingRanks,1);assert.equal(report.missingKills,1);approx(report.ranked[0].score,10);
});
test('Solo BR 1.5 points per elimination; Reload 0.7 points',()=>{
  approx(score([event({kills:10,rank:4})],catalog({mode:'battle-royale'})).ranked[0].score,75);
  approx(score([event({kills:10,rank:4})]).ranked[0].score,67);
});
test('Squads split team kills by team size; all members get the same team result',()=>{
  const row=event({players:['A','B','C'],player:'A',kills:30,rank:4});
  const report=score([row],catalog({mode:'battle-royale',team:'trio'}));
  assert.equal(report.playerCount,3);
  report.ranked.forEach(p=>{approx(p.score,75);approx(p.eliminations,15);});
});
test('Elimination base points capped at 25 before tournament/region multipliers',()=>{
  approx(score([event({rank:1,kills:300,region:'EU'})],catalog({mode:'reload'})).ranked[0].score,(10+100+25)*1.4);
});
test('FNCS Division 1 and practice have equal x1.2 weights',()=>{
  const row=event({rank:4,kills:0,kind:'Practice決勝'});
  approx(score([row],catalog({series:'fncs',subtype:'fncs-division-1-practice'})).ranked[0].score,72);
  approx(score([row],catalog({series:'fncs',subtype:'fncs-division-1'})).ranked[0].score,72);
});
test('Performance x1.4 and major x1.6',()=>{
  const row=event({rank:4,kills:0,kind:'Performance決勝'});
  approx(score([row],catalog({series:'performance-evaluation'})).ranked[0].score,84);
  approx(score([row],catalog({series:'fncs',subtype:'fncs-major'})).ranked[0].score,96);
});
test('Skin and legacy cosmetic competitions x0.50, separate Icon and Override remain x0.35',()=>{
  for(const kind of ['スキン大会','コスメ大会'])
    approx(score([event({kind,rank:1,kills:0})],catalog({series:'fncs'})).ranked[0].score,55);
  approx(score([event({kind:'スキン大会',rank:1,kills:0})],catalog({series:'skin-cup'})).ranked[0].score,55);
  for(const series of ['icon-cup','override-series'])
    approx(score([event({kind:'スキン大会',rank:1,kills:0})],catalog({series})).ranked[0].score,38.5);
});
test('Solo Reload Test Cup x0.25 credits verified overseas participation and scores rank/kills',()=>{
  const row=event({date:'2026-11-02',event:'Solo Reload Test Cup',kind:'Test Cup',rank:10,kills:8,region:'ME',
    source:'https://fortnitetracker.com/events/epicgames_S43_ReloadTestCup_ME?window=S43_ReloadTestCup_Event1_Round1_ME'});
  const testCatalog=catalog({id:'s43-reload-test-cup',series:'test-cup',subtype:'solo-reload-test-cup'});
  const report=score([row],testCatalog),player=report.ranked[0];
  assert.equal(report.recordCount,1);
  approx(player.attendance,10*0.25*1.1);
  approx(player.placement,100/Math.sqrt(10)*0.25*1.1);
  approx(player.eliminations,8*0.7*0.25*1.1);
  approx(player.score,(10+100/Math.sqrt(10)+8*0.7)*0.25*1.1);
  assert.equal(score([{...row,verified:false}],testCatalog).ranked.length,0);
  assert.equal(score([row],catalog({series:'unknown'})).ranked.length,0);
  assert.equal(score([row],catalog({series:'victory-cup'})).ranked.length,0);
});
test('Unsupported modes receive no assumed elimination points',()=>{
  const report=score([event({rank:4,kills:100})],catalog({mode:'unknown'}));
  approx(report.ranked[0].score,60);assert.equal(report.unknownModeKills,1);
});
test('Unverified, invalid stage, unknown classification are not scored',()=>{
  assert.equal(score([event({verified:false})]).ranked.length,0);
  assert.equal(score([event({kind:'不明'})]).ranked.length,0);
  assert.equal(score([event({})],catalog({series:'unknown',subtype:'unknown'})).ranked.length,0);
});
test('Identical ID repeats are removed, conflicting IDs are withheld',()=>{
  const base=event({id:'dupe',kills:10});
  assert.equal(score([base,{...base}]).duplicateCount,1);
  approx(score([base,{...base}]).ranked[0].score,117);
  const conflict=score([base,{...base,kills:11}]);
  assert.equal(conflict.conflictingDuplicateCount,1);assert.equal(conflict.ranked.length,0);
});
test('Two distinct IDs with the same documented source round/result do not double score',()=>{
  const base=event({id:'A',kills:10});const report=score([base,{...base,id:'B'}]);
  assert.equal(report.recordCount,1);assert.equal(report.duplicateCount,1);
});
test('Region filtering preserves global and regional consistency',()=>{
  const base=event({region:'NAW',rank:4,kills:10});
  const eu=event({region:'EU',rank:4,kills:10,source:'https://fortnitetracker.com/events/epicgames_S42_ReloadSoloVictoryCup_EU?window=S42_ReloadSoloVictoryCup_Event5_Round2_EU'});
  const global=score([base,eu]).ranked[0];const naw=score([base,eu],catalog(),{region:'NAW'}).ranked[0];const abroad=score([base,eu],catalog(),{region:'EU'}).ranked[0];
  approx(global.score,naw.score+abroad.score);assert.equal(global.appearances,2);
});
test('Equal PR points share competition rank (1, 1, 3)',()=>{
  const a=event({player:'A',players:['A'],rank:1,kills:0});
  const b=event({player:'B',players:['B'],rank:1,kills:0});
  const c=event({player:'C',players:['C'],rank:4,kills:0});
  assert.deepEqual(score([a,b,c]).ranked.map(x=>x.rank),[1,1,3]);
});

test('Compound Event, Session, Week and Day identifiers preserve separate appearances',()=>{
  for(const [first,second] of [
    ['Event5_Session1','Event5_Session2'],
    ['Week2_Day1','Week2_Day2'],
    ['Event5_Week1_Day1','Event5_Week2_Day1']
  ]) {
    const rows=[first,second].map(session=>event({rank:null,kills:null,
      source:`https://fortnitetracker.com/events/epicgames_S42_ReloadSoloVictoryCup_NAW?window=S42_ReloadSoloVictoryCup_${session}_Round1_NAW`}));
    assert.equal(score(rows).ranked[0].appearances,2);
    approx(score(rows).ranked[0].attendance,20);
  }
});

test('Qualifying and final in the same compound session share attendance',()=>{
  const rows=[1,2].map(round=>event({rank:null,kills:null,kind:round===1?'予選':'賞金決勝',
    round:`Event 5 · Session 2 · Round ${round}`,
    source:`https://fortnitetracker.com/events/epicgames_S42_ReloadSoloVictoryCup_NAW?window=S42_ReloadSoloVictoryCup_Event5_Session2_Round${round}_NAW`}));
  const player=score(rows).ranked[0];
  assert.equal(player.appearances,1);assert.equal(player.roundRecords,2);
  approx(player.attendance,10);
});

test('Recorded session information fills scheduling details absent from the source round',()=>{
  const rows=[1,2].map(session=>event({rank:null,kills:null,round:`Event 5 · Session ${session} · Round 1`,
    source:'https://fortnitetracker.com/events/epicgames_S42_ReloadSoloVictoryCup_NAW?window=S42_ReloadSoloVictoryCup_Event5_Round1_NAW'}));
  // The source/standings match, but explicit recorded sessions are distinct records.
  assert.notEqual(PR.sessionKey(rows[0]),PR.sessionKey(rows[1]));
  const report=score(rows);
  assert.equal(report.recordCount,2);assert.equal(report.ranked[0].appearances,2);
  approx(report.ranked[0].attendance,20);
});

test('An unverified import cannot discard a confirmed result with another ID',()=>{
  const confirmed=event({id:'confirmed-import',rank:4,kills:10});
  const unverified={...confirmed,id:'unverified-import',verified:false};
  for(const records of [[unverified,confirmed],[confirmed,unverified]]) {
    const report=score(records);
    assert.equal(report.recordCount,1);assert.equal(report.playerCount,1);
    approx(report.ranked[0].score,67);
  }
});

test('Skin and legacy cosmetic kinds do not override an unconfirmed tournament classification',()=>{
  for(const kind of ['スキン大会','コスメ大会']) {
    const report=score([event({kind,rank:1,kills:10})],catalog({id:'unconfirmed-skin',series:'unknown',subtype:'unknown'}));
    assert.equal(report.recordCount,0);assert.equal(report.ranked.length,0);
    assert.equal(report.ignored,1);
  }
});
