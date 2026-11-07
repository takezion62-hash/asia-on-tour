'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
test('ランキング画面の母数と入力充実度は実際の選択条件から毎回生成される',()=>{
 const html=read('index.html'),app=read('app.js');
 assert.match(html,/id="ranking-data-quality"/);
 assert.match(html,/id="ranking-data-quality-body"/);
 assert.ok(app.includes("const q=report.quality;"));
 assert.ok(app.includes("const qHost=$('#ranking-data-quality-body');"));
 assert.match(app,/掲載済み戦績の入力充実度/);
});
test('選手比較で母数・欠損とPR追加参加データの扱いを明示する',()=>{
 const app=read('app.js'),css=read('compare.css');
 assert.ok(app.includes('data-compare-quality='));
 assert.ok(app.includes('本人照合済みの追加参加アーカイブ'));
 assert.ok(css.includes('.compare-quality-grid'));
 assert.doesNotThrow(()=>new Function(read('compare.js')));
});
