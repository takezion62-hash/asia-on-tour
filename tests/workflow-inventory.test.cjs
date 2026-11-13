'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const dir=path.resolve(__dirname,'../.github/workflows');
const read=name=>fs.readFileSync(path.join(dir,name),'utf8');
const names=fs.readdirSync(dir).filter(name=>/\.ya?ml$/.test(name)).sort();
const scheduled={
 'auto-sync.yml':"17 0,4,8,12,16,20 * * *",
 'history-sync.yml':"41 1,5,9,13,17,21 * * *",
 'participation-sync.yml':"53 2,8,14,20 * * *",
 'calendar-history.yml':"29 2 * * *"
};
const permitted=[
 'auto-sync.yml','history-sync.yml','participation-sync.yml','calendar-history.yml',
 'review-timing.yml',
 'reviewed-candidate-publication.yml','tests.yml','build-season-data.yml','safe-sync-merge-tests.yml',
 'focused-failure-recheck.yml',
 'scan-coverage-tests.yml','calendar.yml','special-achievements.yml',
 'tournament-rules-check.yml','unreal-auto-check.yml','osirion-probe.yml'
].sort();
test('Actions are consolidated to approved reusable workflows, with no one-off publisher',()=>{
 assert.deepEqual(names,permitted);
 for(const name of names){
  const workflow=read(name);
  assert.match(workflow,/^name:\s*\S+/m,name);
  assert.match(workflow,/^permissions:\s*$/m,name);
 }
});
test('critical scheduled scanners preserve their cadence and secure concurrency',()=>{
 for(const [name,cron] of Object.entries(scheduled)){
  const text=read(name);
  assert.ok(text.includes("cron: '"+cron+"'"),name+': original schedule must remain unchanged');
  assert.match(text,/cancel-in-progress:\s*false/,name);
  assert.match(text,/contents:\s*write/,name);
 }
});
test('unreviewed corrections cannot be replayed from old Actions menus',()=>{
 assert.ok(names.every(name=>!/manual-review-|manual-history-approval|publish-reviewed-|correct-20\d{6}|fix-unreal-oce|repair-session-dates|manual-unreal/.test(name)));
 const entry=read('reviewed-candidate-publication.yml');
 assert.match(entry,/preview_only:/);
 assert.match(entry,/NOT_CONFIRMED/);
 assert.match(entry,/CONFIRM/);
 assert.match(entry,/gh pr create/);
 assert.doesNotMatch(entry,/git push origin HEAD:main/);
});
test('full suite and focused safety checks remain registered',()=>{
 const main=read('tests.yml');
 assert.match(main,/npm run validate/);
 assert.match(main,/npm run test:unit/);
 assert.match(main,/npm run test:e2e/);
 assert.match(read('scan-coverage-tests.yml'),/tests\/scan-coverage\.test\.cjs/);
 assert.match(read('safe-sync-merge-tests.yml'),/tests\/safe-sync-merge\.test\.cjs/);
});

test('parallel checks keep the original required status fail-closed',()=>{
 const main=read('tests.yml');
 const block=name=>{
  const marker='\n  '+name+':\n';
  const start=main.indexOf(marker);
  assert.ok(start>=0,'missing job: '+name);
  const rest=main.slice(start+marker.length);
  const next=rest.search(/\n  [a-z][a-z0-9_-]*:\n/);
  return next<0?rest:rest.slice(0,next);
 };
 const unit=block('unit'),browser=block('browser'),gate=block('test');
 assert.match(unit,/run: npm run validate/);
 assert.match(unit,/run: npm run test:unit/);
 assert.match(browser,/run: npm run test:e2e/);
 assert.match(browser,/npx playwright install --with-deps chromium/);
 assert.match(browser,/if: always\(\)/);
 assert.match(browser,/name: site-test-report/);
 assert.match(gate,/name: JSON検証・単体テスト・PCスマホ回帰テスト/);
 assert.match(gate,/needs: \[classify, unit, browser, smoke\]/);
 assert.match(gate,/run: node scripts\/ci-required-gate\.cjs/);
 const classify=block('classify'),smoke=block('smoke');
 assert.match(classify,/fetch-depth: 0/);
 assert.match(classify,/git show/);
 assert.match(browser,/if: needs\.classify\.outputs\.mode == 'full'/);
 assert.match(smoke,/if: needs\.classify\.outputs\.mode == 'data'/);
 assert.match(smoke,/npm run test:e2e -- tests\/ci-data-smoke\.spec\.cjs/);
 assert.match(gate,/if: \$\{\{ always\(\) \}\}/);
 assert.match(gate,/UNIT_RESULT: \$\{\{ needs\.unit\.result \}\}/);
 assert.match(gate,/BROWSER_RESULT: \$\{\{ needs\.browser\.result \}\}/);
 assert.match(gate,/SCOPE_RESULT:/);
 assert.match(gate,/SMOKE_RESULT:/);
 assert.doesNotMatch(unit,/needs: \[browser\]/);
 assert.doesNotMatch(browser,/needs: \[unit\]/);
});

test('browser suite retains both device projects, bounded concurrency, retries and failure evidence',()=>{
 const config=fs.readFileSync(path.resolve(__dirname,'../playwright.config.cjs'),'utf8');
 assert.match(config,/workers:\s*2/);
 assert.match(config,/retries:\s*process\.env\.CI\s*\?\s*1\s*:\s*0/);
 assert.match(config,/name:\s*'PC'/);
 assert.match(config,/name:\s*'スマホ'/);
 assert.match(config,/trace:\s*'retain-on-failure'/);
 assert.match(config,/screenshot:\s*'only-on-failure'/);
 assert.match(config,/testMatch:\s*'\*\*\/\*\.spec\.cjs'/);
});


test('focused reruns are opt-in diagnostics; normal PR checks still require every unit/browser shard',()=>{
 const focused=read('focused-failure-recheck.yml'),main=read('tests.yml');
 assert.match(focused,/workflow_dispatch:/);
 assert.match(focused,/name: Failed tests only \(NOT full-suite approval\)/);
 assert.doesNotMatch(focused,/^  push:|^  pull_request:/m);
 assert.match(focused,/npm run test:failed:unit/);
 assert.match(focused,/npm run test:failed:e2e/);
 assert.match(main,/unit-failure-report/);
 assert.match(main,/test-results\/last-run.json/);
 assert.match(main,/needs: \[classify, unit, browser, smoke\]/);
 assert.match(main,/if: \$\{\{ always\(\) \}\}/);
});

test('records-only CI keeps semantic safety, generated-index checks and PC/mobile smoke',()=>{
 const main=read('tests.yml');
 assert.match(main,/PUSH_BEFORE_SHA:/);
 assert.match(main,/PUSH_AFTER_SHA:/);
 assert.match(main,/GITHUB_REF.*refs\/heads\/main/);
 assert.match(main,/git show "\$BASE_SHA:scripts\/ci-change-scope\.cjs"/);
 assert.match(main,/node scripts\/build-season-data\.cjs --check/);
 assert.match(main,/node scripts\/build-candidate-triage\.cjs --check/);
 assert.match(main,/tests\/source-results-store\.test\.cjs/);
 assert.match(main,/tests\/source-results-split\.test\.cjs/);
 assert.match(main,/tests\/candidate-triage\.test\.cjs/);
 assert.match(main,/npm run validate/);
 assert.match(main,/if: needs\.classify\.outputs\.mode == 'data'/);
 assert.match(main,/if: needs\.classify\.outputs\.mode == 'full'/);
 assert.match(main,/npm run test:e2e -- tests\/ci-data-smoke\.spec\.cjs/);
 assert.match(main,/run: node scripts\/ci-required-gate\.cjs/);
 const approval=read('reviewed-candidate-publication.yml');
 assert.match(approval,/npm run validate/);
 assert.match(approval,/node scripts\/build-season-data\.cjs --check/);
 assert.match(approval,/node scripts\/build-candidate-triage\.cjs --check/);
 assert.match(approval,/tests\/data-validation\.test\.cjs/);
 assert.doesNotMatch(approval,/npm run test:e2e/);
 assert.match(approval,/gh pr create/);
});

test('第2弾レビュー入口は従来の個別承認を残して安全な一括照合・監査を追加',()=>{
 const entry=read('reviewed-candidate-publication.yml');
 assert.match(entry,/batch-safe/);
 assert.match(entry,/manual-ids/);
 assert.match(entry,/batch_limit:/);
 assert.match(entry,/node scripts\/review-batch\.cjs/);
 assert.match(entry,/node scripts\/manual-approval\.cjs/);
 assert.match(entry,/NOT_CONFIRMED/);
 assert.match(entry,/CONFIRM/);
 assert.match(entry,/git add -A source-results season-data review-reports/);
 assert.match(entry,/gh pr create/);
 assert.doesNotMatch(entry,/git push origin HEAD:main/);
 assert.doesNotMatch(entry,/npm run test:e2e/);
 const timing=read('review-timing.yml');
 assert.match(timing,/workflow_run:/);
 assert.match(timing,/Data and site tests/);
 assert.match(timing,/pages build and deployment/);
 assert.match(timing,/ref: main/);
 assert.match(timing,/permissions:\s*\n\s*actions: read\s*\n\s*contents: read/);
 assert.match(timing,/node scripts\/review-timing\.cjs/);
 assert.doesNotMatch(timing,/contents: write/);
});

test('第3弾はワークフロー数を増やさず依頼ブランチを安全に受け付ける',()=>{
 const entry=read('reviewed-candidate-publication.yml');
 assert.match(entry,/ops\/review-request\/\*\*/);
 assert.match(entry,/review-requests\/launch\.json/);
 assert.match(entry,/ref: main/);
 assert.match(entry,/node scripts\/review-request\.cjs/);
 assert.match(entry,/node scripts\/review-batch\.cjs/);
 assert.match(entry,/actions: write/);
 assert.match(entry,/gh pr create/);
 assert.match(entry,/gh workflow run tests\.yml/);
 assert.match(entry,/review_base_sha=\$AOT_REQUEST_BASE/);
 assert.match(entry,/git diff --cached --check/);
 assert.match(entry,/No new evidence-backed results/);
 assert.doesNotMatch(entry,/git push origin HEAD:main/);
 const tests=read('tests.yml');
 assert.match(tests,/DISPATCH_BASE_SHA:/);
 assert.match(tests,/review_base_sha:/);
 assert.match(tests,/git merge-base --is-ancestor "\$BASE_SHA" refs\/remotes\/origin\/main/);
 assert.match(tests,/git show "\$BASE_SHA:scripts\/ci-change-scope\.cjs"/);
 assert.match(tests,/npm run test:e2e -- tests\/ci-data-smoke\.spec\.cjs/);
});
