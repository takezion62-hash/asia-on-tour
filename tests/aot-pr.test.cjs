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
test('FNCS Division 1 and Practice use x1.4, above Performance Evaluation x1.2',()=>{
  const row=event({rank:4,kills:0,kind:'Practice決勝'});
  for (const subtype of ['fncs-division-1','fncs-division-1-practice'])
    approx(score([row],catalog({series:'fncs',subtype})).ranked[0].score,84);
  approx(score([row],catalog({series:'performance-evaluation',subtype:'performance-evaluation'})).ranked[0].score,72);
});
test('FNCS Major, Heats and LCQ use x1.6, higher than Division 1 and Performance',()=>{
  const row=event({rank:4,kills:0,kind:'Performance決勝'});
  for (const subtype of ['fncs-major','fncs-heats','fncs-lcq'])
    approx(score([row],catalog({series:'fncs',subtype})).ranked[0].score,96);
  approx(score([row],catalog({series:'fncs',subtype:'fncs-division-1'})).ranked[0].score,84);
  approx(score([row],catalog({series:'performance-evaluation'})).ranked[0].score,72);
});
test('Merged Override and dual-tag cosmetic Icon use skin x0.50, regular Icon stays x0.35',()=>{
  for(const kind of ['スキン大会','コスメ大会'])approx(score([event({kind,rank:1,kills:0})],catalog({series:'fncs'})).ranked[0].score,55);
  for(const series of ['skin-cup','override-series'])approx(score([event({kind:'スキン大会',rank:1,kills:0})],catalog({series})).ranked[0].score,55);
  approx(score([event({kind:'スキン大会',rank:1,kills:0})],catalog({series:'icon-cup',additionalSeries:['skin-cup']})).ranked[0].score,55);
  approx(score([event({kind:'スキン大会',rank:1,kills:0})],catalog({series:'icon-cup'})).ranked[0].score,38.5);
  approx(score([event({kind:'賞金決勝',rank:1,kills:0,prize:500,vrs:1})],catalog({series:'icon-cup'})).ranked[0].bonus,0);
});
test('PlayStation NickEh30 dual-tag Icon Cup scores cosmetic qualifiers x0.50, cash finals x1.20',()=>{
  const t=catalog({id:'ch7s4-playstation-nickeh30-icon-cup',series:'icon-cup',
    subtype:'nickeh30-icon-cup',additionalSeries:['skin-cup'],mode:'battle-royale',
    seasonId:'S42',sourceEventIds:['S42_PSNickEh30']});
  const qual=event({id:'nick-qual',kind:'予選',rank:4,kills:10,prize:null,vrs:1,
    round:'Session 1 / 決勝進出予選',source:'https://www.fortnite.com/competitive/events/S42_PSNickEh30?round=S42_PSNickEh30_Qualifier_NAW'});
  const fin=event({id:'nick-final',kind:'決勝',rank:4,kills:10,prize:null,vrs:0,
    round:'Session 1 / 決勝',source:'https://www.fortnite.com/competitive/events/S42_PSNickEh30?round=S42_PSNickEh30_Final_NAW'});
  approx(PR.eventMultiplier(qual,t),0.5);
  approx(PR.eventMultiplier(fin,t),1.20);
  const q=score([qual],t).ranked[0],f=score([fin],t).ranked[0];
  approx(q.score,(10+50*.35+15*.35)*0.50+10);
  approx(f.score,(10+50+15)*1.20+10);
  approx(q.bonus,0);approx(f.bonus,0);
  approx(q.qualificationBonus,10);approx(f.qualificationBonus,10);
  const paid={...fin,id:'paid-final',vrs:1,prize:500};
  const paidResult=score([paid],t).ranked[0];
  approx(paidResult.bonus,0); // No Icon Cup prize bonus policy yet.
  approx(paidResult.score,(10+50+15)*1.20+10);
  const both=score([qual,fin],t).ranked[0];
  assert.equal(both.roundRecords,2);
  approx(both.bonus,0);approx(both.qualificationBonus,10);
  assert.ok(both.score>0);
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

test('Victory Cups award 20pt for each confirmed paid final VR, with region factor only',()=>{
  const row=event({rank:4,kills:10,prize:200,vrs:2,region:'EU'});
  const original=structuredClone(row);
  const result=score([row]),p=result.ranked[0];
  approx(p.attendance,14);approx(p.placement,70);approx(p.eliminations,9.8);
  approx(p.bonus,20*2*1.4);approx(p.score,(10+50+7+40)*1.4);
  assert.equal(p.rows[0].bonusUnits,2);
  assert.deepEqual(row,original);
});

test('FNCS Major/Heats/LCQ get one 80pt prize bonus per session; Div1/Practice one 60pt even at 0VR',()=>{
  const duo=event({kind:'Practice決勝',rank:19,kills:3,vrs:0,prize:100,prizePerPlayer:50,players:['Arim','Maguro'],player:'Arim'});
  for(const subtype of ['fncs-division-1','fncs-division-1-practice']){
    const p=score([duo],catalog({series:'fncs',subtype,team:'duo'})).ranked;
    assert.equal(p.length,2);p.forEach(x=>approx(x.bonus,60));
  }
  for(const subtype of ['fncs-major','fncs-heats','fncs-lcq']){
    const p=score([duo],catalog({series:'fncs',subtype,team:'duo'})).ranked;
    p.forEach(x=>approx(x.bonus,80));
  }
});

test('Performance Evaluation awards 40pt for each paid VR and never for its qualifier wins',()=>{
  const cat=catalog({series:'performance-evaluation',subtype:'performance-evaluation',team:'duo',mode:'battle-royale'});
  const qual=event({kind:'予選',round:'Session 3 · Round 1 / 予選',vrs:2,prize:null,players:['A','B'],
    source:'https://fortnitetracker.com/events/epicgames_S42_PerformanceEvaluation_EU?window=S42_PerformanceEvaluation_Session3_Round1_EU',region:'EU'});
  const fin=event({kind:'Performance決勝',round:'Session 3 · Round 2 / Performance決勝',vrs:2,prize:1600,prizePerPlayer:800,players:['A','B'],
    source:'https://fortnitetracker.com/events/epicgames_S42_PerformanceEvaluation_EU?window=S42_PerformanceEvaluation_Session3_Round2_EU',region:'EU'});
  const players=score([qual,fin],cat).ranked;
  players.forEach(p=>{approx(p.bonus,40*2*1.4);assert.equal(p.appearances,1);});
});

test('Cash Cups use 30pt for placement payouts at 0VR; explicit Victory Cash Cups use paid VR',()=>{
  const row=event({prize:400,prizePerPlayer:200,vrs:0,players:['A','B'],player:'A'});
  const ordinary=catalog({series:'cash-cup',subtype:'reload-zb-duos-cash-cup',team:'duo'});
  score([row],ordinary).ranked.forEach(p=>approx(p.bonus,30));
  const victory=catalog({series:'cash-cup',subtype:'solo-victory-cash-cup',team:'solo'});
  approx(score([event({prize:200,vrs:2})],victory).ranked[0].bonus,40);
  approx(score([event({prize:100,vrs:0})],victory).ranked[0].bonus,0);
});

test('No bonus for uncertain prize, unpaid qualifier, missing paid VR count, or unconfirmed duo shares',()=>{
  for(const fields of [
    {prize:null,vrs:2},{prize:0,vrs:2},{prize:100,vrs:null},
    {prize:100,vrs:2,verified:false},{prize:100,vrs:2,reported:true},
    {prize:100,vrs:2,partial:true},{prize:100,vrs:2,kind:'予選'},
    {prize:100,vrs:2,kind:'Test Cup'},{prize:100,vrs:2,kind:'スキン大会'},
    {prize:200,vrs:2,players:['A','B'],prizePerPlayer:null},
    {prize:200,vrs:2,players:['A','B'],prizePerPlayer:150}
  ]) {
    const report=score([event(fields)]),p=report.ranked[0];
    if(p) approx(p.bonus,0);
  }
  const fakePrize=score([event({prize:100,vrs:1})],catalog({series:'unknown'}));
  assert.equal(fakePrize.playerCount,0);
});

test('One cash bonus per event/session, maximum confirmed paid VRs on duplicate standings, other sessions distinct',()=>{
  const base=event({id:'vr-a',prize:100,vrs:1});
  const second={...base,id:'vr-b',prize:200,vrs:2,rank:3,source:'https://fortnitetracker.com/events/epicgames_S42_ReloadSoloVictoryCup_NAW?window=S42_ReloadSoloVictoryCup_Event5_Round3_NAW'};
  const p=score([base,second]).ranked[0];
  approx(p.bonus,40);assert.equal(p.appearances,1);
  const other={...base,id:'vr-c',round:'Event 6 · Round 2 / 賞金決勝',
    source:'https://fortnitetracker.com/events/epicgames_S42_ReloadSoloVictoryCup_NAW?window=S42_ReloadSoloVictoryCup_Event6_Round2_NAW'};
  approx(score([base,second,other]).ranked[0].bonus,60);
  const fncs=catalog({series:'fncs',subtype:'fncs-division-1-practice'});
  approx(score([base,second],fncs).ranked[0].bonus,60);
});

test('Cash bonus is preserved across all-region and per-region aggregation',()=>{
  const a=event({region:'NAW',prize:100,vrs:1});
  const b=event({region:'EU',prize:200,vrs:2,source:'https://fortnitetracker.com/events/epicgames_S42_ReloadSoloVictoryCup_EU?window=S42_ReloadSoloVictoryCup_Event5_Round2_EU'});
  const all=score([a,b]).ranked[0],naw=score([a,b],catalog(),{region:'NAW'}).ranked[0],eu=score([a,b],catalog(),{region:'EU'}).ranked[0];
  approx(all.bonus,naw.bonus+eu.bonus);
  approx(all.score,naw.score+eu.score);
});

test('Configured individualPrize helper prevents uncertain or inflated payouts',()=>{
  const x=event({prize:200,prizePerPlayer:100,vrs:2,players:['A','B']});
  assert.equal(score([x],catalog({team:'duo'}),{individualPrize:()=>0}).ranked[0].bonus,0);
  assert.equal(score([x],catalog({team:'duo'}),{individualPrize:()=>250}).ranked[0].bonus,0);
  assert.equal(score([x],catalog({team:'duo'}),{individualPrize:()=>100}).ranked[0].bonus,40);
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

test('AOT PR v1.10: explicitly verified qualification earns 10pt, less than paid Victory VR (20pt)',()=>{
  assert.equal(PR.QUALIFICATION_BASE,10);
  assert.ok(PR.QUALIFICATION_BASE<20);
  const qual=event({id:'qual-one',kind:'予選',round:'Event 5 · Round 1 / 予選突破',rank:319,
    prize:0,vrs:0,source:'https://fortnitetracker.com/events/epicgames_S42_ReloadSoloVictoryCup_NAW?window=S42_ReloadSoloVictoryCup_Event5_Round1_NAW'});
  const player=score([qual]).ranked[0];
  approx(player.qualificationBonus,10);
  assert.equal(player.qualificationCount,1);
  approx(player.bonus,0);
  approx(player.rows[0].qualificationBonus,10);
  assert.equal(player.rows[0].qualificationEvidence,'explicit');
  approx(player.score,player.attendance+player.placement+player.eliminations+player.bonus+player.qualificationBonus);
  const bare=score([{...qual,id:'qual-not-confirmed',round:'Event 5 · Round 1 / 予選',rank:321}]).ranked[0];
  approx(bare.qualificationBonus,0);
  assert.equal(bare.qualificationCount,0);
});
test('explicit qualification plus separately listed final gets one qualification bonus and unchanged cash VR bonus',()=>{
  const q=event({id:'one-qual',kind:'予選',round:'Event 5 · Round 1 / 予選通過',rank:300,prize:0,vrs:0,
    source:'https://fortnitetracker.com/events/epicgames_S42_ReloadSoloVictoryCup_NAW?window=S42_ReloadSoloVictoryCup_Event5_Round1_NAW'});
  const f=event({id:'one-final',rank:10,vrs:2,prize:200,kind:'賞金決勝'});
  const result=score([f,q]).ranked[0];
  approx(result.qualificationBonus,10);
  assert.equal(result.qualificationCount,1);
  approx(result.bonus,40);
  assert.equal(result.appearances,1);
  assert.equal(result.rows.filter(r=>r.qualificationBonus>0).length,1);
  const finalOnly=score([f]).ranked[0];
  approx(finalOnly.qualificationBonus,0); // a final without documented qualifier is not itself a published breakthrough record
  approx(finalOnly.bonus,40);
});
test('same verified qualifier appearing twice can never earn two bonuses; distinct event sessions can',()=>{
  const a=event({id:'qa',kind:'予選',round:'Event 5 · Round 1 / 予選突破',rank:300,prize:0,
    source:'https://fortnitetracker.com/events/epicgames_S42_ReloadSoloVictoryCup_NAW?window=S42_ReloadSoloVictoryCup_Event5_Round1_NAW'});
  const duplicate={...a,id:'qb',rank:301,points:79};
  const second={...a,id:'qc',round:'Event 6 · Round 1 / 予選突破',
    source:'https://fortnitetracker.com/events/epicgames_S42_ReloadSoloVictoryCup_NAW?window=S42_ReloadSoloVictoryCup_Event6_Round1_NAW'};
  approx(score([a,duplicate]).ranked[0].qualificationBonus,10);
  approx(score([duplicate,a]).ranked[0].qualificationBonus,10);
  approx(score([a,duplicate,second]).ranked[0].qualificationBonus,20);
});
test('bonus uses region multiplier only and remains below minimum regional paid VR bonus',()=>{
  for (const [region,factor] of Object.entries(PR.REGIONS)) {
    const row=event({id:'regional-qual-'+region,kind:'予選',round:'Event 8 · Round 1 / 予選突破',
      region,prize:0,source:'https://www.fortnite.com/competitive/events/S42_ReloadSoloVictoryCup/?region='+region+'&round=S42_ReloadSoloVictoryCup_Event8_Round1_'+region});
    const scoreRow=score([row]).ranked[0];
    approx(scoreRow.qualificationBonus,10*factor);
    assert.ok(scoreRow.qualificationBonus<20*factor);
  }
});
test('no qualification reward for outside cutoff, review-only, unverified or unsupported test cups',()=>{
  const base=event({id:'qual-safe',kind:'予選',rank:1,prize:0,
    round:'Event 3 · Round 1 / 予選突破',
    source:'https://www.fortnite.com/competitive/events/S42_ReloadSoloVictoryCup/?region=NAW&round=S42_ReloadSoloVictoryCup_Event3_Round1_NAW'});
  for(const attrs of [
    {round:'Event 3 · Round 1 / 予選',rank:321},
    {round:'Event 3 · Round 1 / 参加確認',rank:321},
    {qualification:'outside-cutoff'},
    {status:'通過圏外'},
    {reported:true},
    {reviewOnly:true},
    {verified:false},
    {kind:'賞金決勝'},
    {kind:'参加確認'}
  ]) {
    const p=score([{...base,...attrs}]).ranked[0];
    if(p)approx(p.qualificationBonus,0);
  }
  approx(score([{...base,partial:true}]).ranked[0].qualificationBonus,10); // breakthrough explicit despite missing stats
  const testCup=score([base],catalog({series:'test-cup',subtype:'solo-reload-test-cup'}));
  assert.equal(testCup.ranked.length,0); // a fake qualifier cannot convert a Test Cup into a paid round
});


test('official S42 Solo Reload cutoff recovers missing advance labels at 320 NAW / 800 NAC / 1600 EU',()=>{
 const c=catalog({id:'ch7s4-solo-reload-victory-cup',series:'victory-cup',
   name:'Solo Reload Victory Cup',seasonId:'S42',
   sourceEventIds:['S42_ReloadReloadSoloVictoryCup','S42_ReloadSoloVictoryCup']});
 const src=region=>'https://fortnitetracker.com/events/epicgames_S42_ReloadReloadSoloVictoryCup_'+region+
   '?window=S42_ReloadSoloVictoryCup_Event4_Round1_'+region;
 const cutoff={NAW:320,NAC:800,EU:1600,ME:320,BR:320,OCE:320};
 for(const [region,limit] of Object.entries(cutoff)){
  const q=event({kind:'予選',round:'Event 4 · Round 1 / 予選',date:'2026-10-17',
    region,rank:limit,source:src(region),prize:0});
  const p=score([q],c).ranked[0];
  approx(p.qualificationBonus,10*PR.REGIONS[region]);
  assert.equal(p.rows[0].qualificationEvidence,'official-cutoff');
  approx(score([{...q,id:'outside-'+region,rank:limit+1}],c).ranked[0].qualificationBonus,0);
 }
});
test('official S42 BR, console ZB and Reload Duos cutoffs are category and region specific',()=>{
 const cases=[
  {id:'ch7s4-solo-victory-cup',event:'Solo Victory Cup Battle Royale',seasonId:'S42',region:'NAC',
   sourceId:'S42_SoloVictoryCup',subtype:'solo-victory-cup',rank:2000,limit:2000},
  {id:'ch7s4-console-zero-build-solo-victory-cup',event:'Console Zero Build Solo Victory Cup',seasonId:'S42',region:'NAW',
   sourceId:'S42_ConsoleVCC_SolosZB',subtype:'console-solo-victory-cup',rank:1000,limit:1000},
  {id:'ch7s4-reload-duos-victory-cup',event:'Reload Duos Victory Cup',seasonId:'S42',region:'ME',
   sourceId:'S42_ReloadDuosVictoryCup',subtype:'reload-duos-victory-cup',rank:120,limit:120}
 ];
 for(const [i,x] of cases.entries()){
  const c=catalog({id:x.id,name:x.event,series:'victory-cup',seasonId:x.seasonId,
    sourceEventIds:[x.sourceId],subtype:x.subtype,team:x.id.includes('duos')?'duo':'solo'});
  const p=event({id:'verified-'+i,kind:'予選',round:'Event 1 · Round 1 / 予選',rank:x.rank,region:x.region,prize:0,
    ...(x.id.includes('duos')?{players:['A','B'],player:'A / B'}:{}),
    source:'https://www.fortnite.com/competitive/events/'+x.sourceId+
    '/?region='+x.region+'&round='+x.sourceId+'_Event1_Round1_'+x.region});
  assert.equal(PR.officialQualificationCutoff(p,c),x.limit);
  score([p],c).ranked.forEach(row=>approx(row.qualificationBonus,10*PR.REGIONS[x.region]));
  score([{...p,id:'outside-'+i,rank:x.limit+1}],c).ranked.forEach(row=>approx(row.qualificationBonus,0));
 }
});
test('PlayStation NickEh30 qualifier top-100 official rule resolves unnamed qualification for NAW',()=>{
 const c=catalog({id:'ch7s4-playstation-nickeh30-icon-cup',series:'icon-cup',mode:'battle-royale',
  subtype:'nickeh30-icon-cup',seasonId:'S42',sourceEventIds:['S42_PSNickEh30'],additionalSeries:['skin-cup']});
 const q=event({kind:'予選',rank:84,region:'NAW',round:'Session 1 / 決勝進出予選',
  source:'https://fortnitetracker.com/events/epicgames_S42_PSNickEh30_NAW?window=S42_PSNickEh30_Qualifier_NAW'});
 approx(score([q],c).ranked[0].qualificationBonus,10);
 assert.equal(score([q],c).ranked[0].rows[0].qualificationEvidence,'official-cutoff');
 approx(score([{...q,id:'nick-101',rank:101}],c).ranked[0].qualificationBonus,0);
});
test('verified progression notes recover FNCS Practice and Performance Evaluation without invented cutoffs',()=>{
 const fncs=catalog({id:'ch7s4-fncs-division-1-practice',series:'fncs',subtype:'fncs-division-1-practice',
  seasonId:'S42',sourceEventIds:['S42_FNCSDivisionalCup_Division1'],mode:'battle-royale',team:'duo'});
 const q=event({id:'fncs-note',kind:'予選',date:'2026-09-08',rank:29,region:'NAW',prize:0,
  players:['Asuka','huggyfv'],player:'Asuka / huggyfv',round:'Week 3 · Round 1 / 予選',
  note:'9/8 NAW予選29位。決勝進出。',
  source:'https://fortnitetracker.com/events/epicgames_S42_FNCSDivisionalCup_Division1_NAW?window=S42_FNCSDivisionalCup_Division1_Event3_NAW'});
 score([q],fncs).ranked.forEach(p=>{
  approx(p.qualificationBonus,10);
  assert.equal(p.rows[0].qualificationEvidence,'verified-note');
 });
 score([{...q,id:'fncs-no-claim',rank:51,note:'予選順位を確認。決勝進出の有無は不明。'}],fncs).ranked.forEach(p=>approx(p.qualificationBonus,0));
 const perf=catalog({id:'ch7s4-performance-evaluation',series:'performance-evaluation',
  seasonId:'S42',sourceEventIds:['S42_PerformanceEvaluation'],subtype:'performance-evaluation',team:'duo'});
 const p=event({id:'perf-note',kind:'予選',region:'NAC',players:['meath','3peace'],player:'meath / 3peace',
  round:'Session 3 · Round 1 / 予選',note:'47位・273pt。決勝46位へ進出。',
  source:'https://fortnitetracker.com/events/epicgames_S42_PerformanceEvaluation_NAC?window=S42_PerformanceEvaluation_Event3Round1_NAC'});
 score([p],perf).ranked.forEach(row=>approx(row.qualificationBonus,12));
});
test('a partially reported but VERIFIED explicit advance still earns its once-only bonus',()=>{
 const c=catalog({id:'ch7s4-solo-victory-cup',series:'victory-cup',seasonId:'S42',
   sourceEventIds:['S42_SoloVictoryCup'],subtype:'solo-victory-cup'});
 const p=event({id:'qual-partial',kind:'予選',rank:null,points:null,kills:null,partial:true,
  round:'Event 1 · Round 1 / 予選通過',date:'2026-09-06',region:'NAW',
  source:'https://fortnitetracker.com/events/epicgames_S42_SoloVictoryCup_NAW?window=S42_SoloVictoryCup_Event1Round1_NAW'});
 const result=score([p],c).ranked[0];
 approx(result.qualificationBonus,10);
 assert.equal(result.rows[0].qualificationEvidence,'explicit');
 assert.equal(result.rows[0].rank,null);
});
test('never award for contradictory outside-cutoff, unverified, wrong source or falsely claimed progress',()=>{
 const c=catalog({id:'ch7s4-solo-victory-cup',series:'victory-cup',seasonId:'S42',
   sourceEventIds:['S42_SoloVictoryCup'],subtype:'solo-victory-cup'});
 const q=event({kind:'予選',region:'NAW',rank:459,round:'Event 2 · Round 1 / 予選',prize:0,
  source:'https://fortnitetracker.com/events/epicgames_S42_SoloVictoryCup_NAW?window=S42_SoloVictoryCup_Event2Round1_NAW'});
 for(const change of [
   {rank:801},{verified:false},{reviewOnly:true},{qualification:'outside-cutoff'},
   {status:'通過圏外'},{partial:true},{reported:true},
   {source:'https://example.com/forged-round'},
   {source:'https://fortnitetracker.com/events/epicgames_S42_SoloVictoryCup_EU?window=S42_SoloVictoryCup_Event2Round1_EU'},
   {source:'https://fortnitetracker.com/events/epicgames_S42_SoloVictoryCup_NAW?window=S42_SoloVictoryCup_Event2Round2_NAW'},
   {source:'https://fortnitetracker.com/events/epicgames_S42_DifferentCup_NAW?window=S42_DifferentCup_Event2Round1_NAW'}
 ]){
  const blocked=score([{...q,...change,id:'blocked-'+Object.keys(change)[0]}],c).ranked[0];
  if(blocked)approx(blocked.qualificationBonus,0);
 }
 approx(score([{...q,note:'決勝進出ではなく予選結果。',id:'no-false-note',
   source:'https://fortnitetracker.com/events/epicgames_S42_DifferentCup_NAW?window=S42_DifferentCup_Event2Round1_NAW'}],c).ranked[0].qualificationBonus,0);
});
test('different dates for the same event label remain separate qualified sessions, never merge awards',()=>{
 const c=catalog({id:'ch7s4-solo-victory-cup',series:'victory-cup',seasonId:'S42',
   sourceEventIds:['S42_SoloVictoryCup'],subtype:'solo-victory-cup'});
 const base=event({id:'qa-11',kind:'予選',region:'NAW',rank:30,
  round:'Event 1 · Round 1 / 予選突破',
  source:'https://fortnitetracker.com/events/epicgames_S42_SoloVictoryCup_NAW?window=S42_SoloVictoryCup_Event1Round1_NAW'});
 const second={...base,id:'qa-12',date:'2026-09-08'};
 const report=score([base,second],c).ranked[0];
 approx(report.qualificationBonus,20);
 assert.equal(report.qualificationCount,2);
});

test('FNCS Division 1 Practice verified top-50 weekly finals cutoff includes unlabeled NAW rank 15',()=>{
 const c=catalog({id:'ch7s4-fncs-division-1-practice',series:'fncs',
   subtype:'fncs-division-1-practice',team:'duo',mode:'battle-royale',
   seasonId:'S42',sourceEventIds:['S42_FNCSDivisionalCup_Division1']});
 const base=event({id:'fncs-week3-15',kind:'予選',date:'2026-09-08',region:'NAW',rank:15,
   players:['まぐろいち','arim'],player:'まぐろいち / arim',
   round:'Week 3 · Round 1 / 予選',prize:0,note:'予選順位のみを確認',
   source:'https://fortnitetracker.com/events/epicgames_S42_FNCSDivisionalCup_Division1_NAW?window=S42_FNCSDivisionalCup_Division1_Event3_NAW'});
 score([base],c).ranked.forEach(p=>{approx(p.qualificationBonus,10);assert.equal(p.rows[0].qualificationEvidence,'official-cutoff')});
 score([{...base,id:'fncs-week3-51',rank:51}],c).ranked.forEach(p=>approx(p.qualificationBonus,0));
 const mismatched={...base,id:'fncs-week2-invalid',round:'Week 2 · Round 1 / 予選'};
 score([mismatched],c).ranked.forEach(p=>approx(p.qualificationBonus,0));
});
test('S42 Performance Evaluation Trios top-33 and Duos top-50 cutoffs reject observed ranks 144 and 701',()=>{
 const trios=catalog({id:'ch7s4-performance-evaluation-trios',series:'performance-evaluation',
  subtype:'performance-evaluation-trios',seasonId:'S42',sourceEventIds:['S42_PerformanceEvaluationTrios'],team:'trio'});
 const base=event({id:'perf-trios',kind:'予選',event:'Fortnite Performance Evaluation',rank:144,region:'EU',
  round:'Event 6 · Round 1 / 予選',source:'https://fortnitetracker.com/events/epicgames_S42_PerformanceEvaluationTrios_EU?window=S42_PerformanceEvaluation_Event6Round1_EU'});
 assert.equal(PR.officialQualificationCutoff(base,trios),33);
 approx(score([base],trios).ranked[0].qualificationBonus,0);
 const qualifying=score([{...base,id:'perf-qualifies',rank:33}],trios).ranked[0];
 approx(qualifying.qualificationBonus,14);
 assert.equal(qualifying.rows[0].qualificationEvidence,'official-cutoff');
 const duos=catalog({id:'ch7s4-performance-evaluation',series:'performance-evaluation',
  subtype:'performance-evaluation',seasonId:'S42',sourceEventIds:['S42_PerformanceEvaluation'],team:'duo'});
 const p=event({id:'perf-duos',kind:'予選',event:'Fortnite Performance Evaluation',rank:701,region:'NAC',
  round:'Session 4 · Round 1 / 予選',
  source:'https://fortnitetracker.com/events/epicgames_S42_PerformanceEvaluation_NAC?window=S42_PerformanceEvaluation_Event4Round1_NAC'});
 assert.equal(PR.officialQualificationCutoff(p,duos),50);
 approx(score([p],duos).ranked[0].qualificationBonus,0);
});
test('only two reviewed OCE Reload ZB Duos screenshot records qualify by official top-20 rule without round URLs',()=>{
 const c=catalog({id:'ch7s4-reload-zero-build-duos-cash-cup',series:'cash-cup',
   subtype:'reload-zb-duos-cash-cup',team:'duo',mode:'reload-zero-build',seasonId:'S42',
   sourceEventIds:['S42_ReloadCashCup_DuosZB']});
 const samples=[
  {id:'s42-oce-reload-zb-duos-qual-20261018-reo-romii',players:['Reo','ろみぃ'],rank:4,points:559,kills:107,vrs:3},
  {id:'s42-oce-reload-zb-duos-qual-20261018-uptemp-vuradd0',players:['uptemp','vurаdd0'],rank:14,points:539,kills:71,vrs:3}
 ];
 for(const sample of samples){
  const row=event({id:sample.id,date:'2026-10-18',region:'OCE',kind:'予選',
    players:sample.players,player:sample.players.join(' / '),rank:sample.rank,points:sample.points,kills:sample.kills,vrs:sample.vrs,prize:0,
    round:'予選 / Event・Round番号未確認',
    note:'ユーザー提供の2026/10/18 OCE Reload ZB Duos Cash Cup予選のFortnite Tracker画像で'+sample.rank+'位を確認。',
    source:'https://fortnitetracker.com/events/epicgames_S42_ReloadCashCup_DuosZB_OCE'});
  assert.equal(PR.officialQualificationCutoff(row,c),20);
  score([row],c).ranked.forEach(p=>{
    approx(p.qualificationBonus,11);
    assert.equal(p.rows[0].qualificationEvidence,'verified-screenshot');
  });
  for(const bad of [
    {id:'other-user-row'},{rank:21},{date:'2026-10-19'},
    {note:'順位表を確認しましたが予選か決勝か不明'},
    {source:'https://fortnitetracker.com/events/epicgames_S42_ReloadCashCup_DuosZB_NAC'}
  ]){
    score([{...row,...bad,id:bad.id||row.id}],c).ranked.forEach(p=>approx(p.qualificationBonus,0));
  }
 }
});


test('final-only published Round 2 proves advancement for rules-backed S42 Victory Cup without inventing Round 1 results',()=>{
  const c=catalog({id:'ch7s4-solo-victory-cup',name:'Solo Victory Cup Battle Royale',
    series:'victory-cup',subtype:'solo-victory-cup',seasonId:'S42',sourceEventIds:['S42_SoloVictoryCup']});
  const fin=event({id:'only-final',date:'2026-09-22',region:'NAW',
    kind:'賞金決勝',round:'Event 3 · Round 2 / 賞金決勝',rank:17,kills:6,vrs:0,prize:0,
    source:'https://fortnitetracker.com/events/epicgames_S42_SoloVictoryCup_NAW?window=S42_SoloVictoryCup_Event3Round2_NAW'});
  const solo=score([fin],c).ranked[0];
  approx(solo.qualificationBonus,10);
  assert.equal(solo.rows[0].qualificationEvidence,'verified-final');
  assert.equal(solo.appearances,1);
  assert.equal(solo.roundRecords,1);
  const qual=event({id:'prior-round',date:'2026-09-21',region:'NAW',
    kind:'予選',round:'Event 3 · Round 1 / 予選',rank:210,kills:5,vrs:0,prize:0,
    source:'https://fortnitetracker.com/events/epicgames_S42_SoloVictoryCup_NAW?window=S42_SoloVictoryCup_Event3Round1_NAW'});
  const combined=score([fin,qual],c).ranked[0];
  approx(combined.qualificationBonus,10);
  assert.equal(combined.qualificationCount,1);
  assert.equal(combined.roundRecords,2);
  assert.equal(combined.rows.filter(r=>r.qualificationBonus>0)[0].qualificationEvidence,'official-cutoff');
  const reversed=score([qual,fin],c).ranked[0];
  approx(reversed.qualificationBonus,10);
});
test('finals-only Week 3 FNCS Practice and NickEh30 proof do not double-count qualifiers held days earlier',()=>{
 const fncs=catalog({id:'ch7s4-fncs-division-1-practice',name:'FNCS Division 1 Practice',
   series:'fncs',subtype:'fncs-division-1-practice',seasonId:'S42',
   team:'duo',sourceEventIds:['S42_FNCSDivisionalCup_Division1']});
 const f=event({id:'week3-final',kind:'Practice決勝',region:'NAW',date:'2026-09-13',
   round:'Week 3 · Round 2 / Practice決勝',player:'Asuka / huggyfv',players:['Asuka','huggyfv'],
   rank:38,source:'https://fortnitetracker.com/events/epicgames_S42_FNCSDivisionalCup_Division1_NAW?window=S42_FNCSDivisionalCup_Division1_Week3Final_NAW'});
 const q=event({id:'week3-qual',kind:'予選',region:'NAW',date:'2026-09-08',
   round:'Week 3 · Round 1 / 予選',player:'Asuka / huggyfv',players:['Asuka','huggyfv'],
   rank:29,source:'https://fortnitetracker.com/events/epicgames_S42_FNCSDivisionalCup_Division1_NAW?window=S42_FNCSDivisionalCup_Division1_Event3_NAW'});
 for(const person of score([f],fncs).ranked){
   approx(person.qualificationBonus,10);
   assert.equal(person.rows[0].qualificationEvidence,'verified-final');
 }
 for(const person of score([q,f],fncs).ranked) {
   approx(person.qualificationBonus,10);
   assert.equal(person.qualificationCount,1);
 }
 const nick=catalog({id:'ch7s4-playstation-nickeh30-icon-cup',name:'PlayStation NickEh30 Icon Cup',
  series:'icon-cup',subtype:'nickeh30-icon-cup',additionalSeries:['skin-cup'],
  seasonId:'S42',sourceEventIds:['S42_PSNickEh30']});
 const ns='https://www.fortnite.com/competitive/events/S42_PSNickEh30/';
 const nfinal=event({id:'nick-only',kind:'決勝',date:'2026-10-08',round:'Session 1 / 決勝',
  source:ns+'?region=NAW&round=S42_PSNickEh30_Final_NAW'});
 const nqual=event({id:'nick-qual-week',kind:'予選',date:'2026-10-01',rank:84,
  round:'Session 1 / 決勝進出予選',source:ns+'?region=NAW&round=S42_PSNickEh30_Qualifier_NAW'});
 approx(score([nfinal],nick).ranked[0].qualificationBonus,10);
 const both=score([nqual,nfinal],nick).ranked[0];
 approx(both.qualificationBonus,10);
 assert.equal(both.qualificationCount,1);
});
test('source-verified S41 Reload Day3 and S42 Zero Build Reload Round2 finals qualify; blank or wrong URL cannot',()=>{
 const s41=catalog({id:'ch7s3-solo-reload-victory-cup',name:'Solo Reload Victory Cup',
   series:'victory-cup',subtype:'solo-reload-victory-cup',seasonId:'S41',
   sourceEventIds:['S41_ReloadSoloVictoryCup']});
 const day3=event({id:'s41-final-only',date:'2026-08-16',kind:'賞金決勝',round:'Day 3 · Round 2 / 賞金決勝',
   rank:19,source:'https://fortnitetracker.com/events/epicgames_S41_ReloadSoloVictoryCup_NAW?window=S41_ReloadSoloVictoryCup_Round2_Day3_NAW'});
 approx(score([day3],s41).ranked[0].qualificationBonus,10);
 const cash=catalog({id:'ch7s4-reload-zero-build-duos-cash-cup',name:'Reload ZB Duos Cash Cup',
   series:'cash-cup',subtype:'reload-zero-build-duos-cash-cup',team:'duo',
   seasonId:'S42',sourceEventIds:['S42_ReloadCashCup_DuosZB']});
 const cashFinal=event({id:'cash-final-only',kind:'賞金決勝',date:'2026-10-23',region:'OCE',
   player:'Reo / ろみぃ',players:['Reo','ろみぃ'],
   round:'Event 6 · Round 2 / 決勝（賞金なし）',rank:16,prize:0,
   source:'https://fortnitetracker.com/events/epicgames_S42_ReloadCashCup_DuosZB_OCE?window=S42_ReloadCashCup_DuosZB_Event6Round2_OCE'});
 const rows=score([cashFinal],cash).ranked;
 assert.equal(rows.length,2);
 rows.forEach(row=>{approx(row.qualificationBonus,11);assert.equal(row.qualificationCount,1)});
 for(const change of [
   {partial:true},{verified:false},{reviewOnly:true},{rank:null},
   {source:'https://fortnitetracker.com/events/epicgames_S42_ReloadCashCup_DuosZB_OCE'},
   {source:'https://fortnitetracker.com/events/epicgames_S42_ReloadCashCup_DuosZB_OCE?window=S42_ReloadCashCup_DuosZB_Event6Round1_OCE'},
   {source:'https://fortnitetracker.com/events/epicgames_S42_AnotherCup_OCE?window=S42_AnotherCup_Event6Round2_OCE'}
 ]){
   const result=score([{...cashFinal,id:'bad-'+Object.keys(change)[0],...change}],cash);
   for(const player of result.ranked)approx(player.qualificationBonus,0);
 }
});
test('repeated identical final sessions never earn two qualification bonuses',()=>{
 const c=catalog({id:'ch7s4-solo-victory-cup',name:'Solo Victory Cup Battle Royale',
  series:'victory-cup',seasonId:'S42',sourceEventIds:['S42_SoloVictoryCup']});
 const fin=event({id:'final-a',kind:'賞金決勝',date:'2026-09-22',rank:18,
  round:'Event 3 · Round 2 / 賞金決勝',
  source:'https://fortnitetracker.com/events/epicgames_S42_SoloVictoryCup_NAW?window=S42_SoloVictoryCup_Event3Round2_NAW'});
 const same={...fin,id:'final-b',date:'2026-09-23',rank:19,points:44};
 const p=score([fin,same],c).ranked[0];
 approx(p.qualificationBonus,10);
 assert.equal(p.qualificationCount,1);
});
