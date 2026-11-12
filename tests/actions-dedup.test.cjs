'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const dir=path.resolve(__dirname,'../.github/workflows');
const load=name=>fs.readFileSync(path.join(dir,name),'utf8');
const triggers=name=>{
 const yaml=load(name);
 const start=yaml.search(/^on:\s*$/m),end=yaml.search(/^permissions:\s*$/m);
 assert.ok(start>=0&&end>start,'action triggers not found: '+name);
 return yaml.slice(start,end);
};
const focused=[
 'safe-sync-merge-tests.yml',
 'scan-coverage-tests.yml',
 'calendar.yml',
 'special-achievements.yml',
 'tournament-rules-check.yml',
 'unreal-auto-check.yml'
];
test('6種類の専用回帰チェックは手動実行可能、push/PRではメインの全件テストに集約',()=>{
 for(const name of focused){
  const trigger=triggers(name);
  assert.match(trigger,/^\s+workflow_dispatch:\s*$/m,name);
  assert.doesNotMatch(trigger,/^\s+(?:push|pull_request|schedule):/m,name+' must not duplicate main CI');
  assert.match(load(name),/^jobs:\s*$/m,name+' diagnostic job must remain available');
 }
});
test('唯一の自動フルCIはPR必須チェック、JSON/単体/全PCスマホを維持しdocsだけのpushを省く',()=>{
 const main=load('tests.yml'),on=triggers('tests.yml');
 assert.match(on,/^\s+push:\s*$/m);
 assert.match(on,/^\s+pull_request:\s*$/m);
 assert.match(on,/^\s+workflow_dispatch:\s*$/m);
 assert.match(on,/paths-ignore:\s*\n\s+- '\*\*\/\*\.md'/);
 assert.match(main,/run: npm run validate/);
 assert.match(main,/run: npm run test:unit/);
 assert.match(main,/run: npm run test:e2e -- --shard=\$\{\{ matrix\.shard \}\}\/4/);
 assert.match(main,/needs: \[unit, browser\]/);
 assert.match(main,/UNIT_RESULT: \$\{\{ needs\.unit\.result \}\}/);
 assert.match(main,/BROWSER_RESULT: \$\{\{ needs\.browser\.result \}\}/);
 assert.match(main,/cancel-in-progress: true/);
 const pkg=require('../package.json');
 assert.equal(pkg.scripts['test:unit'],'node scripts/unit-test-runner.cjs all');
 const { listedUnitFiles } = require('../scripts/unit-test-runner.cjs');
 const allTests = listedUnitFiles();
 assert.ok(allTests.length > 20,'full suite must still include every unit test file');
 assert.ok(allTests.includes('tests/actions-dedup.test.cjs'));
 assert.ok(allTests.every(file => file.startsWith('tests/') && file.endsWith('.test.cjs')));
 assert.match(pkg.scripts['test:e2e'],/playwright test/);
 const config=fs.readFileSync(path.resolve(__dirname,'../playwright.config.cjs'),'utf8');
 assert.match(config,/\*\.spec\.cjs/);
});
const writers={
 'auto-sync.yml':{cron:'17 0,4,8,12,16,20 * * *',code:'scripts/osirion-sync.cjs'},
 'history-sync.yml':{cron:'41 1,5,9,13,17,21 * * *',code:'scripts/osirion-sync.cjs'},
 'calendar-history.yml':{cron:'29 2 * * *',code:'scripts/historical-calendar.cjs'},
 'participation-sync.yml':{cron:'53 2,8,14,20 * * *',code:'scripts/participation-sync.cjs'}
};
test('4つの定期スキャナーはスケジュールとmanualを保持、テスト変更だけではAPIを再走査しない',()=>{
 for(const [name,{cron,code}] of Object.entries(writers)){
  const on=triggers(name),yaml=load(name);
  assert.ok(on.includes("cron: '"+cron+"'"),name+' schedule must remain untouched');
  assert.match(on,/^\s+workflow_dispatch:\s*$/m,name);
  assert.match(on,/^\s+push:\s*$/m,name+' still reacts to operational code changes');
  assert.ok(on.includes(code),name+' must watch real implementation changes');
  assert.doesNotMatch(on,/^\s+-\s*["']?tests\//m,name+' should not run an API scan only for test files');
  assert.match(yaml,/cancel-in-progress:\s*false/,name+' must serialize data writers safely');
  assert.match(yaml,/contents:\s*write/,name+' must retain publication permissions');
 }
});
test('管理者の承認PRはvalidate・全unit・PCスマホを各1回だけ通し、手動承認を保持',()=>{
 const content=load('reviewed-candidate-publication.yml');
 assert.match(content,/preview_only:/);
 assert.match(content,/NOT_CONFIRMED/);
 assert.match(content,/CONFIRM/);
 assert.match(content,/gh pr create/);
 assert.match(content,/npm run validate/);
 assert.match(content,/npm run test:unit/);
 assert.match(content,/npm run test:e2e/);
 assert.doesNotMatch(content,/run: npm test\s*$/m,'nested npm test duplicates earlier validation/unit jobs');
 assert.doesNotMatch(content,/node --test tests\/manual-approval\.test\.cjs/,
  'explicit single tests repeat full unit suite');
 assert.doesNotMatch(content,/git push origin HEAD:main/,'manually reviewed results still require PR');
});
test('provider APIの互換性プローブはフルCIにはない外部チェックとして保持',()=>{
 const yaml=load('osirion-probe.yml'),on=triggers('osirion-probe.yml');
 assert.match(on,/^\s+workflow_dispatch:\s*$/m);
 assert.match(on,/^\s+push:\s*$/m);
 assert.match(yaml,/node scripts\/osirion-probe\.cjs/);
});
