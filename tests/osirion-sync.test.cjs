'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {identity,linkedAccounts,parseStage,discover,normalizeRow}=require('../scripts/osirion-sync.cjs');
const f='https://fortnitetracker.com/profile/all/Alpha/events?id=8a57ac58-f937-4de2-81b7-9abd070c7ae8';
test('Tracker UUID can map to the same 32-char account ID after strict validation',()=>{
 assert.equal(identity(f),'8a57ac58f9374de281b79abd070c7ae8');
 assert.equal(identity('https://example.invalid/?id=abc'),null);
});
test('uncertain and conflicting player identities are excluded',()=>{
 const same='https://fortnitetracker.com/?id=8a57ac58-f937-4de2-81b7-9abd070c7ae8';
 const data={players:{candidates:[{name:'A'},{name:'B'}]},results:[{player:'A',profileUrl:same},{player:'B',profileUrl:same},{player:'A',profileUrl:'https://fortnitetracker.com/?id=b7863190-5b98-47c3-8d34-7af8ea94d4b5'}]};
 const out=linkedAccounts(data);assert.equal(out.accounts.length,1);assert.equal(out.conflicts.length,1);
});
test('only recently finished catalogued Victory Cup windows are eligible',()=>{
 const catalog=[{id:'solo',name:'Solo Victory Cup',series:'victory-cup',team:'solo',seasonId:'S42',sourceEventIds:['S42_SoloVictoryCup']}];
 const now=Date.parse('2026-11-05T05:00:00Z');
 const windows=discover([{eventId:'epicgames_S42_SoloVictoryCup_NAW',eventWindows:[{eventWindowId:'S42_SoloVictoryCup_Event3Round1_NAW',beginTime:'2026-11-04T22:00:00Z',endTime:'2026-11-04T23:00:00Z'}]}],catalog,{lookbackDays:7,minLagMinutes:240},now);
 assert.equal(windows.length,1);assert.equal(windows[0].kind,'予選');assert.equal(windows[0].dateJst,'2026-11-05');
 assert.equal(parseStage('S42_SoloVictoryCup_Event3Round2_NAW').kind,'賞金決勝');
});
test('derive kills/VR/matches only from explicit tracked stats',()=>{
 const w={eventId:'S42_SoloVictoryCup',windowId:'S42_SoloVictoryCup_Event3Round1_NAW'};
 const e={rank:9,pointsEarned:268,players:[{accountId:'a'.repeat(32),username:'Test'}],sessionHistory:[{trackedStats:{MATCH_PLAYED_STAT:1,TEAM_ELIMS_STAT_INDEX:6,VICTORY_ROYALE_STAT:0}},{trackedStats:{MATCH_PLAYED_STAT:1,TEAM_ELIMS_STAT_INDEX:8,VICTORY_ROYALE_STAT:1}}],unscoredSessions:[]};
 const n=normalizeRow(e,w);assert.equal(n.kills,14);assert.equal(n.vrs,1);assert.equal(n.matches,2);assert.equal(n.points,268);
 assert.equal(normalizeRow({...e,unscoredSessions:['missing']},w),null);
});

test('S43 approved cash, evaluation, and Victory Cup stages are discovered without inventing prizes',()=>{
 const catalog=[
  {id:'cash',series:'cash-cup',team:'trio',seasonId:'S43',sourceEventIds:['S43_TriosCashCup']},
  {id:'evaluation',series:'performance-evaluation',team:'trio',seasonId:'S43',sourceEventIds:['S43_PerformanceEvaluationTrios']},
  {id:'squads',series:'victory-cup',team:'squad',seasonId:'S43',sourceEventIds:['S43_SquadsVictoryCup']}
 ];
 const now=Date.parse('2026-11-12T18:00:00Z');
 const w=(base,region,stage)=>({eventId:'epicgames_'+base+'_'+region,eventWindows:[{
  eventWindowId:base+'_'+stage+'_'+region,beginTime:'2026-11-11T13:00:00Z',endTime:'2026-11-11T16:00:00Z'
 }]});
 const all=[
  w('S43_TriosCashCup','ME','Event1'),
  w('S43_PerformanceEvaluationTrios','EU','Event1Round2'),
  w('S43_SquadsVictoryCup','NAW','Event1Round2'),
  w('S43_FNCSReloadQualifiers','EU','Event1Round1')
 ];
 const discovered=discover(all,catalog,{lookbackDays:7,minLagMinutes:240},now);
 assert.equal(discovered.length,3);
 assert.equal(discovered.find(x=>x.tournamentId==='cash').kind,'決勝');
 assert.equal(discovered.find(x=>x.tournamentId==='cash').round,'Event 1 / 単一ラウンド');
 assert.equal(discovered.find(x=>x.tournamentId==='evaluation').kind,'決勝');
 assert.equal(discovered.find(x=>x.tournamentId==='squads').kind,'賞金決勝');
 assert.ok(discovered.every(x=>!x.fullEventId.includes('FNCS')));
});
test('unknown, future, and mismatched-region windows are never tracked',()=>{
 const c=[{id:'squad',series:'victory-cup',team:'squad',seasonId:'S43',sourceEventIds:['S43_SquadsVictoryCup']}];
 const now=Date.parse('2026-11-10T00:00:00Z');
 const window={eventWindowId:'S43_SquadsVictoryCup_Event1Round1_NAW',beginTime:'2026-11-09T21:00:00Z',endTime:'2026-11-09T23:00:00Z'};
 assert.deepEqual(discover([{eventId:'epicgames_S43_SquadsVictoryCup_NAW',eventWindows:[window]}],c,{lookbackDays:7,minLagMinutes:240},now),[]);
 assert.deepEqual(discover([{eventId:'epicgames_S43_SquadsVictoryCup_ME',eventWindows:[window]}],c,{lookbackDays:7,minLagMinutes:0},now),[]);
 assert.equal(parseStage('S43_SquadsVictoryCup_Event1Round3_NAW'),null);
});
