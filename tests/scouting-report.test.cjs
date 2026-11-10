'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const style=require('../player-style.js'),view=require('../player-style-view.js');
const catalog={id:'solo-vc',series:'victory-cup',team:'solo',mode:'battle-royale'};
const src=i=>'https://www.fortnite.com/competitive/events/Demo/?region=ME&round=S42_Demo_Event'+i+'Round2_ME';
const row=(i,extra={})=>({id:'scout-'+i,verified:true,player:'A',players:['A'],seasonId:'S42',
 date:'2026-10-'+String(i+1).padStart(2,'0'),region:'ME',event:'Solo Victory Cup',
 round:'Event '+i+' · Round 2',tournamentId:'solo-vc',kind:'決勝',
 matches:6,kills:i<5?6:18,vrs:i<5?0:1,points:40,rank:10,prize:0,source:src(i),...extra});
const filters={season:'S42',team:'solo',mode:'battle-royale',series:'victory-cup',region:'all'};
const helpers={classify:r=>r._class||catalog,seasonOf:r=>r.seasonId};
const analyze=rows=>style.analyze(rows,'A',filters,helpers);
test('scouting reports only observed efficiencies, stability and two five-window changes',()=>{
 const r=analyze(Array.from({length:10},(_,i)=>row(i)));
 assert.equal(r.scouting.windows,10);
 assert.equal(r.scouting.regions,1);
 assert.equal(r.scouting.attack.level,'評価可能');
 assert.equal(r.scouting.attack.value,2);
 assert.equal(r.scouting.victory.value,5/60);
 assert.ok(r.scouting.stability.spread>0);
 assert.equal(r.scouting.momentum.ready,true);
 assert.equal(r.scouting.documentedFinals,10);
 assert.equal(r.scouting.relative,null,'without 20 qualified peers no invented player type');
 assert.match(view.profile(r),/スカウティングレポート/);
 assert.match(view.profile(r),/キル効率のばらつき/);
});
test('missing matches or kills are unknown and cannot be interpreted as zero consistency',()=>{
 const r=analyze([row(0,{matches:null,kills:null,vrs:null})]);
 assert.equal(r.scouting.attack.value,null);
 assert.equal(r.scouting.victory.value,null);
 assert.equal(r.scouting.stability.spread,null);
 assert.equal(r.scouting.attack.level,'データ不足');
 assert.equal(r.scouting.windows,1);
 assert.equal(r.scouting.momentum.ready,false);
 assert.match(view.profile(r),/比較による強弱は未判定/);
});
test('duplicate, conflicting and unverified records do not inflate scouting counts',()=>{
 const a=row(0),duplicate={...a},conflict={...a,kills:999};
 const r=analyze([a,duplicate,row(1,{verified:false}),row(2)]);
 assert.equal(r.scouting.windows,2);
 const c=analyze([a,conflict,row(2)]);
 assert.equal(c.scouting.windows,1);
 assert.equal(c.stats.kills,6);
});
test('duo kills are never treated as individual kills and unsafe event text is escaped',()=>{
 const r=style.analyze([row(0,{_class:{...catalog,id:'duo',team:'duo'},players:['A','B'],player:'A / B',
    kills:36,matches:6,event:'<img src=x onerror=alert(1)>',
    source:'javascript:alert(1)'})],'A',{...filters,team:'duo'},helpers);
 assert.equal(r.scouting.attack.value,6,'team total is not divided as personal eliminations');
 const html=view.profile(r);
 assert.doesNotMatch(html,/<img src=x/);
 assert.doesNotMatch(html,/href="javascript:/);
 assert.match(html,/&lt;img/);
});

test('metric confidence depends on records with observed values, not unrelated recorded windows',()=>{
 const rows=Array.from({length:6},(_,i)=>row(i,{kills:i<4?null:36,vrs:i<4?null:1}));
 const r=analyze(rows);
 assert.equal(r.scouting.attack.records,2);
 assert.equal(r.scouting.attack.level,'データ不足');
 assert.equal(r.scouting.victory.level,'データ不足');
 assert.equal(r.scouting.stability.spread,null);
});
