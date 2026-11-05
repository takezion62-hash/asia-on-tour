'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {identity,linkedAccounts,parseStage,discover,discoverUnmapped,selectHistoricalWindows,historicalEvidenceScore,resolveHistoricalScope,selectActiveWindows,fetchJson,advancementLimit,transientLeaderboardFailure,normalizeRow}=require('../scripts/osirion-sync.cjs');
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

test('historical evidence prioritizes previously verified regions and rounds without expanding identity rules',()=>{
 const date='2024-10-15',base={dateJst:date,region:'ME',tournamentId:'ch5s4-solo-victory-cup',series:'victory-cup',end:1};
 const seeded={...base,key:'seed',windowId:'S31_SoloVictoryCashCup_Event7Round2_ME',kind:'賞金決勝'};
 const unseeded={...base,key:'other',windowId:'S31_SoloVictoryCashCup_Event8Round1_ME',kind:'予選'};
 const records=[{date,region:'ME',tournamentId:base.tournamentId,source:'https://fortnitetracker.com/events/epicgames_S31_SoloVictoryCashCup_ME?window='+seeded.windowId}];
 assert.equal(historicalEvidenceScore(seeded,records),100);
 assert.equal(historicalEvidenceScore({...seeded,region:'EU'},records),0);
 assert.deepEqual(selectHistoricalWindows([unseeded,seeded],{windows:{}},{maxWindowsPerRun:1},Date.parse('2026-11-05'),records).map(w=>w.key),['seed']);
});
test('2025 Unreal Cup from the existing catalog is scanned for verification only',()=>{
 const c=JSON.parse(require('node:fs').readFileSync(require('node:path').join(__dirname,'../tournaments.json'),'utf8')).catalog;
 const item=c.find(x=>x.id==='ch7s1-one-million-unreal-cup');
 const w='S39_1MillionUnrealCup_NAW';
 const event={eventId:'epicgames_S39_1MillionUnrealCup_NAW',eventWindows:[{eventWindowId:w,beginTime:'2025-12-21T03:00:00Z',endTime:'2025-12-21T05:00:00Z'}]};
 const found=discover([event],c,{reviewSeries:['unreal-cup'],fromDate:'2024-05-29',toDate:'2026-11-04',regions:['NAW'],minLagMinutes:240},Date.parse('2026-11-05'));
 assert.equal(found.length,1);
 assert.equal(found[0].kind,'参加確認');
});

test('historical scan prioritizes oldest documented year before 2026 while still choosing distinct series',()=>{
 const rows=['2024','2025','2026'].flatMap(year=>['victory-cup','cash-cup'].map(series=>({key:year+series,dateJst:year+'-07-01',end:Date.parse(year+'-07-01T12:00:00Z'),series})));
 const chosen=selectHistoricalWindows(rows,{windows:{}},{maxWindowsPerRun:6},Date.parse('2026-11-05'));
 assert.equal(chosen[0].dateJst.slice(0,4),'2024');
 assert.equal(chosen.length,6);
 assert.equal(chosen.filter(v=>v.series==='cash-cup').length,3);
});

test('transient API failures preserve history checkpoints instead of publishing partial results',()=>{
 assert.equal(transientLeaderboardFailure(new Error('TimeoutError: The operation was aborted due to timeout')),true);
 assert.equal(transientLeaderboardFailure(new Error('Osirion API HTTP 429 /v1/tournaments/leaderboard')),true);
 assert.equal(transientLeaderboardFailure(new Error('Osirion API HTTP 503 /v1/tournaments/leaderboard')),true);
 assert.equal(transientLeaderboardFailure(new Error('大会順位表のID/形式が不正')),false);
});

test('rolling historical date expands every day with a completion lag, and fixed dates remain supported',()=>{
 const config={fromDate:'2024-05-29',toDate:'rolling',minLagMinutes:240};
 assert.equal(resolveHistoricalScope(config,Date.parse('2026-11-05T03:00:00Z')).toDate,'2026-11-05');
 assert.equal(resolveHistoricalScope(config,Date.parse('2026-11-04T16:00:00Z')).toDate,'2026-11-04');
 assert.equal(config.toDate,'rolling');
 const fixed={...config,toDate:'2026-10-31'};
 assert.strictEqual(resolveHistoricalScope(fixed,Date.parse('2026-11-05T00:00:00Z')),fixed);
});
test('recent scan prioritizes partial rounds and new events while reserving other-series slots',()=>{
 const make=(key,series,end)=>({key,series,end:Date.parse(end)});
 const a=make('old','victory-cup','2026-11-01T01:00:00Z');
 const b=make('fresh','victory-cup','2026-11-04T01:00:00Z');
 const c=make('progress','victory-cup','2026-11-02T01:00:00Z');
 const d=make('skin','skin-cup','2026-11-03T01:00:00Z');
 const e=make('cash','cash-cup','2026-11-04T01:00:00Z');
 const state={windows:{progress:{nextPage:8,totalPages:10},old:{nextPage:0}}};
 const chosen=selectActiveWindows([a,b,c,d,e],state,{maxWindowsPerRun:4},Date.parse('2026-11-05T00:00:00Z'));
 assert.equal(chosen.length,4);
 assert.equal(chosen[0].key,'progress');
 assert.ok(chosen.some(w=>w.key==='fresh'));
 assert.ok(chosen.some(w=>w.key==='cash'));
 assert.ok(chosen.some(w=>w.key==='skin'));
});
test('provider retries temporary 429 and never retries malformed responses',async()=>{
 const saved=globalThis.fetch;let calls=0;
 try{
  globalThis.fetch=async()=>{calls++;if(calls===1)return {ok:false,status:429};return {ok:true,json:async()=>({success:true,tournaments:[]})}};
  const ok=await fetchJson('https://fnapi.osirion.gg/v1/tournaments',{attempts:2,retryDelayMs:0});
  assert.deepEqual(ok.tournaments,[]);assert.equal(calls,2);
  calls=0;
  globalThis.fetch=async()=>{calls++;return {ok:true,json:async()=>({success:false})}};
  await assert.rejects(fetchJson('https://fnapi.osirion.gg/v1/tournaments',{attempts:3,retryDelayMs:0}),/Osirion API error/);
  assert.equal(calls,1);
 }finally{globalThis.fetch=saved}
});
test('historical picker prioritizes verified rule-backed finals near completion without removing year quotas',()=>{
 const make=(key,year,id,series,nextPage,totalPages)=>({key,dateJst:year+'-07-01',end:Date.parse(year+'-07-01'),tournamentId:id,kind:'賞金決勝',series});
 const a=make('a','2024','ch5s3-solo-victory-cup','victory-cup');
 const b=make('b','2024','unverified-duos-cup','victory-cup');
 const c=make('c','2025','unverified-duos-cup','cash-cup');
 const state={windows:{a:{nextPage:12,totalPages:15},b:{nextPage:2,totalPages:20}}};
 const chosen=selectHistoricalWindows([b,a,c],state,{maxWindowsPerRun:2},Date.parse('2026-11-05'));
 assert.equal(chosen[0].key,'a');
});

test('extra historical slot reaches recently completed official events despite a 3-year backlog',()=>{
 const make=(key,year,series,days)=>({key,seasonId:'S42',tournamentId:series==='victory-cup'?'ch7s4-solo-victory-cup':'unverified-cash',dateJst:year+'-11-01',kind:series==='victory-cup'?'賞金決勝':'参加確認',series,end:Date.parse(days)});
 const rows=['2024','2025','2026'].flatMap(y=>['victory-cup','cash-cup'].map(s=>make(y+s,y,s,y+'-07-01T00:00:00Z')));
 rows.push(make('recent2026','2026','victory-cup','2026-11-04T23:00:00Z'));
 const selected=selectHistoricalWindows(rows,{windows:{}},{maxWindowsPerRun:7},Date.parse('2026-11-05T14:00:00Z'));
 assert.equal(selected.length,7);
 assert.ok(selected.some(w=>w.key==='recent2026'));
 assert.equal(selected.filter(w=>w.dateJst.startsWith('2024')).length,2);
 assert.equal(selected.filter(w=>w.dateJst.startsWith('2025')).length,2);
});

test('reviewed candidates are uniquely resolved and all approved IDs are in public results',()=>{
 const fs=require('node:fs'),path=require('node:path'),folder=path.join(__dirname,'..');
 const data=JSON.parse(fs.readFileSync(path.join(folder,'history-sync-reviewed.json'),'utf8'));
 const ids=data.entries.map(x=>x.id);
 assert.ok(ids.length>=72);
 assert.equal(new Set(ids).size,ids.length);
 assert.ok(data.entries.filter(x=>x.decision==='published').length>=56);
 assert.ok(data.entries.filter(x=>x.decision==='participation').length>=8);
 assert.ok(data.entries.filter(x=>x.decision==='already-published').length>=8);
 const existing=new Set(JSON.parse(fs.readFileSync(path.join(folder,'results.json'),'utf8')).map(x=>x.id));
 for(const row of data.entries.filter(x=>x.decision==='published'))assert.ok(existing.has(row.recordId),row.id);
});
