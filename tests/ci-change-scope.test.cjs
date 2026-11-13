'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {classify,parseNameStatus,detect,safeSha}=require('../scripts/ci-change-scope.cjs');
const c=(status,path)=>({status,path});
const sha='a'.repeat(40),other='b'.repeat(40);
const store=[c('M','source-results/S30.json'),c('M','source-results/manifest.json')];
const safePaths=[
 'players.json','tournaments.json','updates.json','approval-history.json',
 'auto-sync-review.json','auto-sync-status.json',
 'history-sync-review.json','history-sync-reviewed.json','history-sync-status.json',
 'candidate-triage.json','participation-index.json','participation-status.json',
 'participation/2024-09.json','review-reports/2026-11-13-resolve-15.md',
 'season-data/S30.json','season-data/unknown.json','season-data/ranking-S30.json',
 'season-data/ranking-unknown.json','season-data/ranking-all.json','season-data/manifest.json'
];
test('review-approval and generated read models are safe only with updated canonical store',()=>{
 for(const path of safePaths){
  assert.deepEqual(classify([...store,c('M',path)]),{mode:'data',reason:'verified-records-paths-only'},path);
  assert.equal(classify([c('M',path)]).mode,'full',path);
 }
 assert.equal(classify(store).mode,'data');
 assert.equal(classify([...store,c('A','source-results/S44.json')]).mode,'data');
});
test('real-world review-publication file combinations use the fast path',()=>{
 const changes=[
  'approval-history.json','candidate-triage.json','history-sync-review.json',
  'history-sync-reviewed.json','history-sync-status.json',
  'review-reports/2026-11-13-resolve-15.md',
  'season-data/S30.json','season-data/S31.json','season-data/S41.json',
  'season-data/manifest.json','season-data/ranking-S30.json',
  'season-data/ranking-S31.json','season-data/ranking-S41.json',
  'season-data/ranking-all.json','source-results/S30.json','source-results/S31.json',
  'source-results/S41.json','source-results/manifest.json','updates.json'
 ];
 assert.equal(classify(changes.map(path=>c(path.startsWith('review-reports/')?'A':'M',path))).mode,'data');
});
test('scripts, CSS, tests, workflows and unknown files always require full suite',()=>{
 for(const path of [
  'results.json','index.html','app.js','main.css','site-theme.css','discovery-ui.js',
  'scripts/build-season-data.cjs','scripts/ci-change-scope.cjs',
  'tests/site.spec.cjs','tests/ci-data-smoke.spec.cjs',
  '.github/workflows/tests.yml','package.json','package-lock.json',
  'auto-sync-scan.json','history-sync-scan.json',
  'calendar-history/2026-11.json','data/manual-approvals/new.json',
  'season-data/new-schema.json','season-data/assets/S30.json',
  'source-results/../../other.json','source-results/S0.json',
  'review-reports/../other.md','docs/README.md','README.md'
 ])assert.equal(classify([...store,c('M',path)]).mode,'full',path);
});
test('deletions, renames, malformed, empty and duplicate records fail closed',()=>{
 assert.equal(classify([]).mode,'full');
 for(const status of ['D','R100','T','C100','U','X',null])
  assert.equal(classify([...store,c(status,'source-results/S40.json')]).mode,'full',String(status));
 assert.equal(classify([...store,null]).mode,'full');
 assert.equal(classify([...store,c('M','season-data/S30.json'),c('M','season-data/S30.json')]).mode,'full');
 assert.equal(classify([...store,c('M','bad\0path')]).mode,'full');
 assert.equal(classify([...store,c('M','bad\\path')]).mode,'full');
 assert.equal(classify(Array(3001).fill(c('M','source-results/S30.json'))).mode,'full');
});
test('Git name/status parser keeps exact NUL-terminated changed paths',()=>{
 assert.deepEqual(parseNameStatus(Buffer.from('M\0source-results/S30.json\0A\0review-reports/2026-11-13-resolve-15.md\0')),
  [c('M','source-results/S30.json'),c('A','review-reports/2026-11-13-resolve-15.md')]);
 for(const bytes of [Buffer.from(''),Buffer.from('M\0source-results/S30.json'),Buffer.from('R100\0old\0new\0')])
  assert.throws(()=>parseNameStatus(bytes));
});
test('PR and main-only push detect trusted SHAs and unknown events fall back to full',()=>{
 assert.equal(safeSha(sha),true);
 assert.equal(safeSha('0'.repeat(40)),false);
 assert.equal(safeSha('HEAD~1'),false);
 const git=(program,args)=>{
  assert.equal(program,'git');
  assert.deepEqual(args.slice(0,5),['diff','--no-ext-diff','--no-textconv','--no-renames','--name-status']);
  return Buffer.from('M\0source-results/S30.json\0M\0source-results/manifest.json\0');
 };
 const pr={GITHUB_EVENT_NAME:'pull_request',PR_BASE_SHA:sha,PR_HEAD_SHA:other};
 const push={GITHUB_EVENT_NAME:'push',GITHUB_REF:'refs/heads/main',PUSH_BEFORE_SHA:sha,PUSH_AFTER_SHA:other};
 assert.equal(detect(pr,git).mode,'data');
 assert.equal(detect(push,git).mode,'data');
 for(const env of [
  {...push,GITHUB_REF:'refs/heads/feature/unsafe'},
  {...push,GITHUB_REF:'refs/tags/v1'},
  {...pr,GITHUB_EVENT_NAME:'workflow_dispatch'}
 ])assert.equal(detect(env,git).mode,'full');
 assert.equal(detect({...pr,PR_BASE_SHA:'HEAD'},git).mode,'full');
 assert.equal(detect({...push,PUSH_BEFORE_SHA:'0'.repeat(40)},git).mode,'full');
 assert.equal(detect(pr,()=>{throw Error('Git failed')}).mode,'full');
 assert.equal(detect(pr,()=>Buffer.from('M\0source-results/S30.json')).mode,'full');
});
