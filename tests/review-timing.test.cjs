'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {duration,fmt,summary}=require('../scripts/review-timing-core.cjs');
test('queue, execution and all job durations are nonnegative and deterministic',()=>{
 assert.equal(duration('2026-11-13T03:00:00Z','2026-11-13T03:01:40Z'),100000);
 assert.equal(duration('2026-11-13T03:01:40Z','2026-11-13T03:00:00Z'),null);
 assert.equal(duration('',null),null);
 assert.equal(fmt(1500),'1.50 秒');assert.equal(fmt(null),'未計測');
});
test('timing summary renders browser and deploy job metrics without inventing missing times',()=>{
 const report={workflow:'Data and site tests',event:'pull_request',
  url:'https://github.com/example/repo/actions/runs/42',branch:'test',conclusion:'success',
  durations:{queueMs:5000,executionMs:118000,totalMs:123000},
  jobs:[{name:'データ専用PRのPC・スマホ軽量表示確認',conclusion:'success',durationMs:36000},
    {name:'全画面テスト',conclusion:'skipped',durationMs:null}]
 };
 const s=summary(report);
 assert.match(s,/123\.00 秒/);
 assert.match(s,/36\.00 秒/);
 assert.match(s,/未計測/);
 assert.match(s,/PC・スマホ/);
});
