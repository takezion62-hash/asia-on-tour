'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const view=require('../player-style-view.js');
const regions=['ME','EU','NAC','NAW','OCE','BR'];
const report=(name='テスト選手')=>({
 player:name,filters:{season:'S42',team:'solo',mode:'battle-royale',series:'victory-cup',region:'all'},
 recommendedSeason:'S42',
 stats:{records:4,knownMatchRecords:3,unknownMatchRecords:1,matchTotal:18,kpm:2.5,vrRate:1/18,kills:45,vrs:1,
  killMatches:18,vrMatches:18,killRecords:3,vrRecords:3},
 quality:{windows:4},
 coverage:{killCoverage:.75,vrCoverage:.75,missingMatches:1,missingKillRecords:1,missingVrRecords:1,overlappingIds:[]},
 style:{key:'unrated',label:'分析データ不足',reason:'比較対象が少ない'},
 affinity:{region:null,reason:'2地域以上の比較が必要',adaptation:null},
 specialties:{attack:'ME',victory:'EU',attackReason:'実測キル効率',victoryReason:'実測VR率'},
 regions:regions.map(region=>({region,records:region==='ME'?4:0,windows:region==='ME'?4:0,
   matchTotal:region==='ME'?18:0,killMatches:region==='ME'?18:0,vrMatches:region==='ME'?18:0,
   kpm:region==='ME'?2.5:null,vrRate:region==='ME'?1/18:null,level:'insufficient'})),
 trend:[{month:'2026-09',kpm:2,vrRate:0},{month:'2026-10',kpm:3,vrRate:1/10}],
 momentum:{ready:false,reason:'実測データが不足'},
 evidence:[{id:'proof',date:'2026-10-08',region:'ME',event:'Solo Victory Cup',
   round:'Event 1',kills:10,matches:6,vrs:0,rank:100,
   source:'https://www.fortnite.com/competitive/events/Example/?region=ME'}]
});
test('プロフィールに根拠・2種の得意地域・データ品質・月別グラフを表示する',()=>{
 const html=view.profile(report());
 assert.match(html,/class="style-specialties"/);
 assert.match(html,/攻撃効率が高い地域/);
 assert.match(html,/勝ち切り効率が高い地域/);
 assert.match(html,/入力の充実度/);
 assert.match(html,/データの充実度/);
 assert.match(html,/style-evidence/);
 assert.match(html,/Solo Victory Cup/);
 assert.match(html,/style-trend-plot/);
 assert.match(html,/出典 ↗/);
});
test('全期間はおすすめシーズン絞り込みを表示するが、結果を勝手に変えない',()=>{
 const r=report();r.filters.season='all';
 const html=view.profile(r);
 assert.match(html,/data-style-season-pick="S42"/);
 assert.equal(r.filters.season,'all');
});
test('比較テーブルは6地域×2選手で統一条件の実測と欠損を表示する',()=>{
 const html=view.comparison([report('A'),report('B')],{team:'solo'});
 assert.equal((html.match(/data-style-compare-region=/g)||[]).length,6);
 assert.equal((html.match(/data-style-matrix-player=/g)||[]).length,12);
 assert.match(html,/キル集計の試合数/);
 assert.match(html,/VR集計の試合数/);
 assert.match(html,/攻撃効率の地域/);
 assert.match(html,/勝ち切り効率の地域/);
});
test('出典が外部の無許可ドメインやjavascriptならリンク化せず、選手名もエスケープする',()=>{
 const r=report('<script>alert("oops")</script>');
 r.evidence[0].event='<img src=x onerror=alert(1)>';
 r.evidence[0].source='javascript:alert(1)';
 const html=view.profile(r);
 const comparison=view.comparison([r,report('B')]);
 assert.doesNotMatch(html,/<img src=x onerror=/);
 assert.doesNotMatch(html,/href="javascript:/);
 assert.doesNotMatch(comparison,/<script>alert/);
 assert.match(comparison,/&lt;script&gt;/);
});

test('分析と選手比較の折りたたみは初期状態で閉じており、見出しで開ける',()=>{
 const profile=view.profile(report());
 const compare=view.comparison([report('A'),report('B')]);
 assert.match(profile,/<details class="style-fold" id="profile-style-fold">/);
 assert.match(profile,/<summary class="style-fold-summary">/);
 assert.match(profile,/詳細を見る ⌄/);
 assert.doesNotMatch(profile,/<details class="style-fold" id="profile-style-fold" open/);
 assert.match(compare,/<details class="style-fold" id="compare-style-fold">/);
 assert.match(compare,/閉じる ⌃/);
 assert.match(compare,/id="compare-style-title"/);
});
