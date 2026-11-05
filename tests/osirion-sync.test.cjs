'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {identity,linkedAccounts,parseStage,discover,discoverUnmapped,selectHistoricalWindows,advancementLimit,normalizeRow}=require('../scripts/osirion-sync.cjs');
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

test('canonicalizes only explicitly confirmed player aliases',()=>{
 const id='8a57ac58-f937-4de2-81b7-9abd070c7ae8',url='https://fortnitetracker.com/profile/all/name/events?id='+id;
 const data={players:{candidates:[{name:'Hazy'}],confirmedAliases:{Hazy:['CLD hazyǃ']}},results:[{player:'Hazy',profileUrl:url},{player:'CLD hazyǃ',profileUrl:url}]};
 const out=linkedAccounts(data);
 assert.equal(out.accounts.length,1);
 assert.equal(out.accounts[0].player,'Hazy');
 assert.equal(out.conflicts.length,0);
});
test('ambiguous aliases or inconsistent canonical names remain excluded',()=>{
 const url='https://fortnitetracker.com/?id=8a57ac58-f937-4de2-81b7-9abd070c7ae8';
 const ambiguous={players:{candidates:[{name:'A'},{name:'B'}],confirmedAliases:{A:['shared'],B:['shared']}},results:[{player:'shared',profileUrl:url}]};
 const collision={players:{candidates:[{name:'A'},{name:'B'}],confirmedAliases:{A:['old A']}},results:[{player:'old A',profileUrl:url},{player:'B',profileUrl:url}]};
 for(const data of [ambiguous,collision]){
  const out=linkedAccounts(data);
  assert.equal(out.accounts.length,0);
  assert.equal(out.conflicts.length,1);
 }
});

test('reports upcoming unmapped Victory Cups without inventing catalog entries',()=>{
 const now=Date.parse('2026-11-05T05:00:00Z');
 const events=[{
  eventId:'epicgames_S43_SoloVictoryCup_NAW',
  eventWindows:[{eventWindowId:'S43_SoloVictoryCup_Event1Round1_NAW',beginTime:'2026-11-06T20:00:00Z',endTime:'2026-11-06T22:00:00Z'}]
 },{
  eventId:'epicgames_S43_FNCSDivisionalCup_Division1_NAW',
  eventWindows:[{eventWindowId:'S43_FNCS_Event1Round1_NAW',endTime:'2026-11-06T22:00:00Z'}]
 }];
 const older=[{id:'old',series:'victory-cup',seasonId:'S42',sourceEventIds:['S42_SoloVictoryCup']}];
 assert.deepEqual(discoverUnmapped(events,older,{lookbackDays:7},now),['S43_SoloVictoryCup']);
 const registered=[...older,{id:'new',series:'victory-cup',seasonId:'S43',sourceEventIds:['S43_SoloVictoryCup']}];
 assert.deepEqual(discoverUnmapped(events,registered,{lookbackDays:7},now),[]);
});

test('S43 Squads Victory Cup windows with underscores are detected correctly',()=>{
 const catalog=[{id:'ch7s5-squads-victory-cup',name:'Squads Victory Cup Battle Royale',series:'victory-cup',team:'squad',seasonId:'S43',sourceEventIds:['S43_SquadsVictoryCup']}];
 const event={eventId:'epicgames_S43_SquadsVictoryCup_NAW',eventWindows:[{eventWindowId:'S43_SquadsVictoryCup_Event1_Round1_NAW',beginTime:'2026-11-10T02:00:00Z',endTime:'2026-11-10T04:00:00Z'},{eventWindowId:'S43_SquadsVictoryCup_Event1_Round2_NAW',beginTime:'2026-11-10T05:00:00Z',endTime:'2026-11-10T06:00:00Z'}]};
 const wins=discover([event],catalog,{lookbackDays:7,minLagMinutes:240},Date.parse('2026-11-11T12:00:00Z'));
 assert.equal(wins.length,2);
 assert.equal(wins[0].kind,'予選');
 assert.equal(wins[1].kind,'賞金決勝');
 assert.equal(wins[1].tournamentId,'ch7s5-squads-victory-cup');
 assert.equal(parseStage('S42_SoloVictoryCup_Event3Round1_NAW').kind,'予選');
});

test('historical S41 Day rounds and explicit date ranges are supported',()=>{
 const catalog=[{id:'ch7s3-solo-reload-victory-cup',name:'Solo Reload Victory Cup',series:'victory-cup',team:'solo',seasonId:'S41',sourceEventIds:['S41_ReloadSoloVictoryCup']}];
 const data=[{eventId:'epicgames_S41_ReloadSoloVictoryCup_NAW',eventWindows:[
  {eventWindowId:'S41_ReloadSoloVictoryCup_Round2_Day3_NAW',beginTime:'2026-08-15T02:00:00Z',endTime:'2026-08-15T04:00:00Z'},
  {eventWindowId:'S41_ReloadSoloVictoryCup_Round2_Day4_NAW',beginTime:'2026-08-16T02:00:00Z',endTime:'2026-08-16T04:00:00Z'}
 ]}];
 assert.equal(parseStage('S41_ReloadSoloVictoryCup_Round2_Day3_NAW').round,'Day 3 · Round 2 / 賞金決勝');
 const matches=discover(data,catalog,{fromDate:'2026-08-15',toDate:'2026-08-15',regions:['NAW'],minLagMinutes:240},Date.parse('2026-11-05T05:00:00Z'));
 assert.equal(matches.length,1);
 assert.equal(matches[0].windowId,'S41_ReloadSoloVictoryCup_Round2_Day3_NAW');
 assert.equal(discover(data,catalog,{fromDate:'2026-08-15',toDate:'2026-08-15',regions:['ME']},Date.parse('2026-11-05T05:00:00Z')).length,0);
});

test('official S41/S42 cutoffs are region and mode specific, never guessed for other seasons',()=>{
 const w=(seasonId,tournamentId,region,kind='予選')=>({seasonId,tournamentId,region,kind});
 assert.equal(advancementLimit(w('S42','ch7s4-solo-victory-cup','NAW')),800);
 assert.equal(advancementLimit(w('S42','ch7s4-solo-victory-cup','NAC')),2000);
 assert.equal(advancementLimit(w('S42','ch7s4-console-zero-build-solo-victory-cup','NAW')),1000);
 assert.equal(advancementLimit(w('S42','ch7s4-console-zero-build-solo-victory-cup','EU')),2000);
 assert.equal(advancementLimit(w('S41','ch7s3-solo-reload-victory-cup','NAW')),320);
 assert.equal(advancementLimit(w('S42','ch7s4-reload-duos-victory-cup','ME')),120);
 assert.equal(advancementLimit(w('S43','ch7s5-squads-victory-cup','NAW')),null);
 assert.equal(advancementLimit(w('S42','ch7s4-solo-victory-cup','NAW','賞金決勝')),null);
});

test('historical scans distribute limited slots across years and event series',()=>{
 const rows=['2024','2025','2026'].flatMap(y=>['victory-cup','cash-cup'].map(series=>({key:y+series,dateJst:y+'-06-01',end:Date.parse(y+'-06-01T01:00:00Z'),series})));
 const chosen=selectHistoricalWindows(rows,{windows:{}},{maxWindowsPerRun:6},Date.parse('2026-11-05'));
 assert.equal(chosen.length,6);
 assert.deepEqual(new Set(chosen.map(x=>x.dateJst.slice(0,4))),new Set(['2024','2025','2026']));
 assert.equal(chosen.filter(x=>x.series==='cash-cup').length,3);
});
test('historical scans honor finished and retry-delayed windows',()=>{
 const rows=[{key:'a',dateJst:'2024-07-01',series:'victory-cup',end:1},{key:'b',dateJst:'2024-07-02',series:'victory-cup',end:2},{key:'c',dateJst:'2024-07-03',series:'victory-cup',end:3}];
 const state={windows:{a:{complete:true},b:{nextPage:3},c:{retryAfter:'2030-01-01T00:00:00Z'}}};
 assert.deepEqual(selectHistoricalWindows(rows,state,{maxWindowsPerRun:3},Date.parse('2026-11-05')).map(x=>x.key),['b']);
});

test('2024 official solo Victory brackets do not invent NAC/NAW qualification',()=>{
 const w=(sid,id,region)=>({seasonId:sid,tournamentId:id,region,kind:'予選'});
 assert.equal(advancementLimit(w('S30','ch5s3-solo-victory-cup','EU')),7000);
 assert.equal(advancementLimit(w('S30','ch5s3-zb-solo-victory','OCE')),2000);
 assert.equal(advancementLimit(w('S31','ch5s4-solo-victory-cup','BR')),2500);
 assert.equal(advancementLimit(w('S31','ch5s4-zb-solo-victory','OCE')),600);
 assert.equal(advancementLimit(w('S31','ch5s4-solo-victory-cup','NAC')),null);
 assert.equal(advancementLimit(w('S30','ch5s3-zb-solo-victory','NAW')),null);
});
