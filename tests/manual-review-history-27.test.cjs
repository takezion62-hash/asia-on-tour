'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {GROUPS,RULES,source,win,sameStored}=require('../scripts/manual-review-history-27.cjs');
test('27 IDs are unique and fixed into exact payout categories',()=>{
 const all=Object.values(GROUPS).flat();
 assert.equal(all.length,27);
 assert.equal(new Set(all).size,27);
 for(const id of all)assert.match(id,/^auto-s\d+-[a-z0-9]{12}$/);
 assert.equal(GROUPS.finals.length,12);
 assert.equal(GROUPS.qualifiers.length,6);
 assert.equal(GROUPS.attendance.length,8);
 assert.equal(GROUPS.cash.length,1);
});
test('source requires official HTTPS Epic session, never spoofed domains',()=>{
 const valid={source:'https://www.fortnite.com/competitive/events/S42_SoloVictoryCup/?region=NAW&round=S42_SoloVictoryCup_Event1Round2_NAW'};
 assert.deepEqual(source(valid),{eventId:'S42_SoloVictoryCup',region:'NAW',win:'S42_SoloVictoryCup_Event1Round2_NAW'});
 assert.equal(source({source:'https://www.fortnite.com.evil.example/competitive/events/S42_SoloVictoryCup/?region=NAW&round=fake'}),null);
 assert.equal(source({source:'http://www.fortnite.com/competitive/events/S42_SoloVictoryCup/?region=NAW&round=fake'}),null);
 assert.equal(win(valid),'S42_SoloVictoryCup_Event1Round2_NAW');
 assert.equal(win({source:'https://fortnitetracker.com/events/demo?window=S42_SoloVictoryCup_Event1Round1_NAW'}),'S42_SoloVictoryCup_Event1Round1_NAW');
});
test('only reviewer-added metadata can differ from saved Osirion row',()=>{
 const saved={id:GROUPS.finals[0],rank:216,points:0,kills:3,matches:3,verified:true,reviewOnly:null};
 assert.equal(sameStored(saved,{...saved,reviewReason:'scan not fully completed'}),true);
 assert.equal(sameStored(saved,{...saved,kills:4}),false);
 assert.equal(sameStored(saved,{...saved,rank:999}),false);
 assert.equal(sameStored(saved,{...saved,verified:false}),false);
});
test('official rules are pinned to correct season and include required payout references',()=>{
 assert.match(RULES.vc,/chapter-7-season-4-official-rules/);
 assert.match(RULES.duo,/chapter-5-season-4-official-rules/);
});
