'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const style=require('../player-style.js'),view=require('../player-style-view.js');
const solo={id:'solo',team:'solo',mode:'battle-royale',series:'victory-cup'};
const duo={id:'duo',team:'duo',mode:'battle-royale',series:'cash-cup'};
const srcFor=(region,index)=>'https://www.fortnite.com/competitive/events/S42_Demo/?region='+region+
  '&round=S42_Demo_Event'+index+'Round2_'+region;
const row=(id,n=1,extra={})=>({
  id,verified:true,date:'2026-10-'+String(n).padStart(2,'0'),region:'ME',
  event:'Solo Victory Cup',tournamentId:'solo',seasonId:'S42',
  players:['A'],player:'A',kind:'賞金決勝',round:'Event '+n+' · Round 2 / 賞金決勝',
  rank:100,points:50,kills:12,vrs:1,matches:4,prize:0,source:srcFor('ME',n),...extra
});
const helpers={classify:r=>r._class||solo,seasonOf:r=>r.seasonId};
const analyze=(rows,filters={})=>style.analyze(rows,'A',
  {season:'all',team:'all',mode:'all',series:'all',region:'all',...filters},helpers);

test('1件の成績だけでも基本分析・VR・決勝・最多参戦地域を表示',()=>{
  const report=analyze([row('one',1)]);
  assert.equal(report.insights.stage,'basic');
  assert.equal(report.insights.progress,1);
  assert.equal(report.quality.level,'insufficient');
  assert.ok(report.insights.tags.some(t=>t.key==='victory'));
  assert.ok(report.insights.tags.some(t=>t.key==='final'));
  assert.equal(report.regionHighlights.active.region,'ME');
  assert.equal(report.regionHighlights.active.windows,1);
  assert.equal(report.style.key,'unrated');
  const html=view.profile(report,{seasons:[{id:'S42',label:'S42'}],modes:[{id:'battle-royale',label:'BR'}],series:[{id:'victory-cup',label:'VC'}]});
  assert.match(html,/現在の分析：基本分析/);
  assert.match(html,/VR実績あり/);
  assert.match(html,/最多参加地域/);
  assert.match(html,/data-style-filter="team"/);
  assert.match(html,/<option value="all" selected>全チーム形式<\/option>/);
  assert.match(html,/data-style-scope-pick/);
  assert.match(html,/記録されたキル合計/);
  assert.doesNotMatch(html,/個人キル \/ 試合/);
});

test('3開催枠・計12試合で暫定、5開催枠・30試合で詳細になる',()=>{
  const three=Array.from({length:3},(_,i)=>row('r'+i,i+1));
  const provisional=analyze(three);
  assert.equal(provisional.insights.stage,'provisional');
  assert.equal(provisional.quality.level,'provisional');
  assert.equal(provisional.insights.matches,12);
  assert.equal(analyze(three.slice(0,2)).insights.stage,'basic');
  const detailed=analyze(Array.from({length:5},(_,i)=>
    row('d'+i,i+1,{matches:6})));
  assert.equal(detailed.insights.stage,'detailed');
  assert.equal(detailed.insights.progress,3);
  assert.equal(detailed.style.key,'unrated'); // still no matched 20-player cohort
});

test('全形式では形式混在のK/試合をタグ化・グラフ化しない',()=>{
  const rows=[row('solo-one',1),row('duo-one',2,{
    players:['A','B'],player:'A / B',_class:duo,tournamentId:'duo',
    kills:88,matches:8,source:srcFor('ME',2)
  })];
  const mixed=analyze(rows);
  assert.equal(mixed.stats.records,2);
  assert.equal(mixed.stats.kills,100);
  assert.ok(mixed.insights.tags.every(t=>t.key!=='kill-rate'));
  const html=view.profile(mixed,{modes:[{id:'battle-royale',label:'BR'}],series:[{id:'cash-cup',label:'CC'}]});
  assert.match(html,/形式混在のため効率比較なし/);
  assert.match(html,/記録されたキル合計/);
  assert.doesNotMatch(html,/class="style-trend-plot"/);
  const duoOnly=analyze(rows,{team:'duo'});
  assert.equal(duoOnly.stats.kpm,11);
  assert.ok(view.profile(duoOnly).includes('チームキル / 試合'));
});

test('賞金のある地域・VR最多地域を実測で表示し、同数の最多地域は断定しない',()=>{
  const rows=[
    row('cash',1,{region:'EU',source:srcFor('EU',1),prize:200}),
    row('ME',2,{vrs:3}),
    row('other',3,{region:'NAW',source:srcFor('NAW',3),vrs:0,prize:0})
  ];
  const report=analyze(rows);
  assert.equal(report.regionHighlights.cash.region,'EU');
  assert.equal(report.regionHighlights.victory.region,'ME');
  assert.equal(report.regionHighlights.active.region,'ME'); // deterministic tie
  assert.ok(report.insights.tags.some(t=>t.key==='multi-region'));
  assert.ok(report.insights.tags.some(t=>t.key==='cash'));
  const tied=analyze([rows[0],row('second-paid',4,{region:'NAW',source:srcFor('NAW',4),prize:200})]);
  assert.equal(tied.regionHighlights.cash,null);
  assert.equal(tied.affinity.region,null);
});

test('推薦条件は実績が多い形式を選び、参加未確認・矛盾データは混ぜない',()=>{
  const rows=[row('solo-one',1),...Array.from({length:3},(_,i)=>row('duo-'+i,i+2,{
    players:['A','B'],player:'A / B',_class:duo,tournamentId:'duo',matches:6
  }))];
  const report=analyze([...rows,row('bad',5,{verified:false}),
    row('review',6,{reviewOnly:true})]);
  assert.equal(report.stats.records,4);
  assert.equal(report.recommendedScope.team,'duo');
  assert.equal(report.recommendedScope.series,'cash-cup');
  assert.equal(report.recommendedScope.windows,3);
  assert.equal(report.insights.stage,'provisional');
});

test('対象データが0件でも描画でき、XSSとなるタグ文字列はエスケープする',()=>{
  const empty=analyze([row('bad',1,{verified:false})]);
  assert.equal(empty.insights.stage,'none');
  assert.equal(empty.regionHighlights.active,null);
  assert.match(view.profile(empty),/現在の分析：対象データなし/);
  const a=analyze([row('html',1,{region:'ME',player:'A',players:['A']})]);
  a.insights.tags.push({key:'evil',label:'<img src=x onerror=alert(1)>',detail:'a" onmouseover="alert(1)'});
  const rendered=view.profile(a);
  assert.doesNotMatch(rendered,/<img src=x onerror=/);
  assert.match(rendered,/&lt;img src=x/);
});


test('1〜2開催枠でも観測タイプを表示し、相対順位と混同しない',()=>{
  const one=analyze([row('early-one',1,{matches:4,kills:10,vrs:1})]);
  assert.equal(one.style.key,'unrated');
  assert.equal(one.observedTendency.stage,'early');
  assert.equal(one.observedTendency.label,'キル・VRの両方を記録');
  assert.equal(one.observedTendency.kpm,2.5);
  assert.equal(one.observedTendency.vrRate,.25);
  assert.equal(one.observedTendency.windows,1);
  let html=view.profile(one);
  assert.match(html,/少ない戦績からわかる特徴/);
  assert.match(html,/キル・VRの両方を記録/);
  assert.match(html,/少数記録・参考/);
  assert.match(html,/厳密な相対タイプの判定条件を見る/);
  assert.doesNotMatch(html,/相対タイプ：比較保留/);
  const two=analyze([row('early-one',1),row('early-two',2,{kills:20,vrs:0})]);
  assert.equal(two.observedTendency.windows,2);
  assert.equal(two.observedTendency.records,2);
  html=view.profile(two);
  assert.match(html,/2開催枠/);
  assert.match(html,/実測からわかる特徴/);
});

test('混在形式の数値を比較せず、欠損値をゼロと断言しない',()=>{
  const combined=analyze([row('solo-one',1),row('duo-one',2,{
    players:['A','B'],player:'A / B',_class:duo,tournamentId:'duo',
    kills:88,matches:8,vrs:0
  })]);
  assert.equal(combined.observedTendency.mixed,true);
  assert.equal(combined.observedTendency.kpm,null);
  assert.equal(combined.observedTendency.vrRate,null);
  assert.match(view.profile(combined),/形式別に確認/);
  const missing=analyze([row('missing',1,{matches:null,kills:null,vrs:null})]);
  assert.equal(missing.observedTendency.label,'大会参加を確認');
  assert.equal(missing.observedTendency.kpm,null);
  assert.match(view.profile(missing),/キル未入力/);
  assert.doesNotMatch(view.profile(missing),/記録上は0キル・0VR/);
});

test('1地域の実測値は見せるが得意地域と判定しない',()=>{
  const single=analyze([row('one',1)]);
  assert.equal(single.affinity.region,null);
  const html=view.profile(single);
  assert.match(html,/キルを記録した地域/);
  assert.match(html,/VRを記録した地域/);
  assert.match(html,/地域間の優劣は未比較/);
  assert.match(html,/得意地域は比較準備中/);
});
