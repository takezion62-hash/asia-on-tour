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
