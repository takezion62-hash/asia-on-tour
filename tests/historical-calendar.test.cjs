'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {stageLabel,buildHistory}=require('../scripts/historical-calendar.cjs');
const catalog=[
{id:'s42-vc',name:'Solo Victory Cup Battle Royale',seasonId:'S42',sourceEventIds:['S42_SoloVictoryCup'],series:'victory-cup',mode:'battle-royale'},
{id:'s42-fncs',name:'FNCS Solos Reload Qualifiers',seasonId:'S42',sourceEventIds:['S42_FNCSReload'],series:'fncs',mode:'reload'},
{id:'s42-div1',name:'FNCS Division 1',seasonId:'S42',sourceEventIds:['S42_FNCSDivisionalCup_Division1'],series:'fncs',mode:'battle-royale'}
];
const evt=(base,region,windows)=>({eventId:'epicgames_'+base+'_'+region,eventWindows:windows});
const win=(windowId,start,end)=>({eventWindowId:windowId,beginTime:start,endTime:end});
test('past S42 NAW event is archived with verified JST start, no implied participant or prize',()=>{
 const source=[evt('S42_SoloVictoryCup','NAW',[win('S42_SoloVictoryCup_Event3Round1_NAW','2026-09-22T01:00:00Z','2026-09-22T04:00:00Z')])];
 const r=buildHistory(source,catalog,{now:Date.parse('2026-11-05T00:00:00Z')});
 assert.equal(r.sessions.length,1);
 assert.equal(r.sessions[0].dateJst,'2026-09-22');
 assert.equal(r.sessions[0].timeJst,'10:00');
 assert.equal(r.sessions[0].round,'Event 3 · Round 1');
 assert.equal(r.sessions[0].stage,'予選');
 assert.equal(r.sessions[0].region,'NAW');
 assert.equal('prize' in r.sessions[0],false);
 assert.equal('players' in r.sessions[0],false);
});
test('excludes future, malformed, non-overseas and region-locked FNCS, but includes Division 1',()=>{
 const source=[
 evt('S42_FNCSReload','NAW',[win('S42_FNCSReload_Event1Round1_NAW','2026-09-22T01:00:00Z','2026-09-22T04:00:00Z')]),
 evt('S42_FNCSDivisionalCup_Division1','ME',[win('S42_FNCSDivisionalCup_Division1_Event1Round1_ME','2026-09-22T01:00:00Z','2026-09-22T04:00:00Z')]),
 evt('S42_SoloVictoryCup','ASIA',[win('S42_SoloVictoryCup_Event1Round1_ASIA','2026-09-22T01:00:00Z','2026-09-22T04:00:00Z')]),
 evt('S42_SoloVictoryCup','NAW',[win('S42_SoloVictoryCup_Event4Round1_NAW','2026-12-22T01:00:00Z','2026-12-22T04:00:00Z')])
 ];
 const r=buildHistory(source,catalog,{now:Date.parse('2026-11-05T00:00:00Z')});
 assert.equal(r.sessions.length,1);
 assert.equal(r.sessions[0].name,'FNCS Division 1');
});
test('stage label accepts historic day windows and solo event windows without invented rounds',()=>{
 assert.deepEqual(stageLabel('S41_ReloadSoloVictoryCup_Round2_Day1_ME'),{round:'Day 1 · Round 2',stage:'決勝'});
 assert.deepEqual(stageLabel('S42_SoloVictoryCup_Event3Round1_NAW'),{round:'Event 3 · Round 1',stage:'予選'});
 assert.deepEqual(stageLabel('S42_SoloVictoryCup_Event6_NAW'),{round:'Event 6',stage:'単一ラウンド'});
 assert.deepEqual(stageLabel('S42_Unknown_Mystery_NAW'),{round:'ラウンド詳細未確認',stage:'単一ラウンド'});
});
