'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const style=require('../player-style.js'),view=require('../player-style-view.js');
const solo={id:'solo',team:'solo',mode:'battle-royale',series:'victory-cup'};
const duo={id:'duo',team:'duo',mode:'battle-royale',series:'victory-cup'};
const scope={season:'S42',team:'solo',mode:'battle-royale',series:'victory-cup',region:'ME'};
const helpers={classify:r=>r._class||solo,seasonOf:r=>r.seasonId};
const row=(id,n=1,extra={})=>{
 const region=extra.region||'ME';
 return {
  id,verified:true,date:'2026-10-'+String(n).padStart(2,'0'),
  seasonId:'S42',region,tournamentId:'solo',event:'Victory Cup',
  player:'A',players:['A'],kind:'賞金決勝',
  round:'Event '+n+' · Round 2 / 賞金決勝',
  rank:10,points:0,kills:10,vrs:1,matches:5,prize:0,
  source:'https://www.fortnite.com/competitive/events/S42_Test/?region='+region+
   '&round=S42_Test_Event'+n+'Round2_'+region,
  ...extra
 };
};
const analyze=(rows,opts={})=>style.analyze(rows,'A',{...scope,...opts},helpers);
test('4軸は掲載済みの本人確認済み戦績だけを使い、信頼度を試合数・枠数・入力率で表示',()=>{
 const rows=Array.from({length:3},(_,i)=>row('a'+i,i+1));
 const report=analyze(rows);
 assert.equal(report.axes.version,1);
 assert.equal(report.axes.finalStrength.confidence.level,'medium');
 assert.equal(report.axes.finalStrength.confidence.windows,3);
 assert.equal(report.axes.finalStrength.confidence.matches,15);
 assert.equal(report.axes.finalStrength.confidence.coverage,1);
 const low=analyze([row('one')]);
 assert.equal(low.axes.finalStrength.confidence.level,'low');
 assert.equal(low.axes.growth.ready,false);
 assert.equal(analyze([row('bad',1,{verified:false})]).axes.finalStrength.recorded,0);
});
test('地域のスコアは同一形式・同一シーズンの2地域だけで比較する',()=>{
 const rows=[];
 for(const region of ['ME','EU'])for(let i=1;i<=3;i++)
  rows.push(row(region+i,i,{region,
   kills:region==='ME'?20:5,vrs:region==='ME'?2:0}));
 const report=analyze(rows,{region:'all'});
 assert.equal(report.axes.regional.leader,'ME');
 assert.equal(report.axes.regional.compared,2);
 assert.equal(report.axes.regional.confidence.level,'medium');
 assert.equal(report.axes.regional.score,100);
 assert.ok(report.axes.regional.runnerScore<100);
 const wide=analyze(rows,{region:'all',season:'all'});
 assert.equal(wide.axes.regional.leader,null);
 assert.equal(wide.axes.regional.score,null);
});
test('ソロとデュオは個人KとチームKを比較せず同条件のVR率のみ表示',()=>{
 const rows=[];
 for(let i=1;i<=3;i++){
  rows.push(row('solo-'+i,i,{vrs:1,kills:2}));
  rows.push(row('duo-'+i,i,{tournamentId:'duo',_class:duo,
   player:'A / B',players:['A','B'],vrs:0,kills:95}));
 }
 const report=analyze(rows);
 const axis=report.axes.format;
 assert.equal(axis.leader,'solo');
 assert.equal(axis.deltaVrPp,20);
 assert.equal(axis.comparable,true);
 assert.equal(axis.teams.find(x=>x.team==='duo').kpm,19);
 assert.equal(axis.teams[0].confidence.level,'medium');
 assert.equal(axis.teams[1].confidence.level,'medium');
 assert.match(view.profile(report),/ソロ 20.0% \/ デュオ 0.0%/);
 const mixed=analyze(rows,{region:'all',season:'all'});
 assert.equal(mixed.axes.format.leader,null);
 assert.equal(mixed.axes.format.comparable,false);
});
test('決勝のTOP10率には予選の高順位を混ぜない',()=>{
 const rows=[row('f1',1,{rank:5}),row('f2',2,{rank:15,vrs:0}),
  row('f3',3,{rank:8}),row('q',4,{rank:1,kind:'予選',round:'Event 4 · Round 1 / 予選',vrs:0})];
 const report=analyze(rows);
 assert.equal(report.axes.finalStrength.recorded,3);
 assert.equal(report.axes.finalStrength.top10,2);
 assert.equal(report.axes.finalStrength.top10Rate,2/3);
 assert.equal(report.axes.finalStrength.vrRate,2/15);
 assert.equal(report.axes.finalStrength.confidence.level,'medium');
 assert.equal(analyze(rows,{team:'all'}).axes.finalStrength.vrRate,null);
});
test('成長は直近3開催枠と前3開催枠を実測で比較し、欠損があれば保留',()=>{
 const rows=Array.from({length:6},(_,i)=>row('e'+i,i+1,
  {kills:i>=3?15:5,vrs:i>=3?1:0}));
 const r=analyze(rows);
 assert.equal(r.axes.growth.ready,true);
 assert.equal(r.axes.growth.windowsCompared,6);
 assert.equal(r.axes.growth.deltaKpm,2);
 assert.equal(r.axes.growth.deltaVrPp,20);
 assert.equal(r.axes.growth.confidence.level,'medium');
 const bad=rows.map((x,i)=>i<3?{...x,matches:null,kills:null,vrs:null}:x);
 assert.equal(analyze(bad).axes.growth.ready,false);
 assert.equal(analyze(rows,{season:'all'}).axes.growth.ready,false);
 const abroad=rows.map((x,i)=>i<3?{...x,region:'EU'}:x);
 assert.equal(analyze(abroad,{region:'all'}).axes.growth.ready,false);
});
test('少数記録や形式混在の実力点数は作らず、スマホ向け4軸に理由を表示',()=>{
 const report=analyze([row('single')],{team:'all',season:'all'});
 assert.equal(report.axes.regional.leader,null);
 assert.equal(report.axes.format.leader,null);
 const html=view.profile(report);
 assert.equal((html.match(/data-style-axis="/g)||[]).length,4);
 for(const word of ['得意地域','ソロ・デュオ適性','決勝での強さ','成長傾向','信頼度 低','集計条件','信頼度・比較条件の説明'])
  if(word!=='集計条件')assert.ok(html.includes(word),word);
 assert.match(html,/4軸の数値比較/);
 assert.doesNotMatch(html,/NaN|undefined/);
});
test('4軸説明は危険なイベント名・選手名をHTMLとして実行しない',()=>{
 const report=analyze([row('x',1,{event:'<img src=x onerror=alert(1)>'})]);
 const html=view.profile(report);
 assert.doesNotMatch(html,/<img src=x onerror=/);
 assert.match(html,/&lt;img src=x/);
});
