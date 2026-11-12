'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {classify,parseNameStatus,detect,safeSha}=require('../scripts/ci-change-scope.cjs');
const change=(status,path)=>({status,path});
const sha='a'.repeat(40),other='b'.repeat(40);

test('only narrowly allowlisted canonical and season-scoped JSON changes qualify',()=>{
 for(const path of [
   'results.json','players.json','tournaments.json','updates.json'
 ]) assert.equal(classify([change('M',path)]).mode,'data',path);
 assert.equal(classify([
   change('M','results.json'),change('M','updates.json'),
   change('M','players.json')
 ]).mode,'data');
});

test('UI, scripts, tests, workflows, mixed and unfamiliar paths always need full browser suite',()=>{
 for(const path of [
   'index.html','app.js','main.css','site-theme.css','discovery-ui.js',
   'scripts/build-season-data.cjs','tests/site.spec.cjs','tests/data-validation.test.cjs',
   '.github/workflows/tests.yml','package.json','package-lock.json',
   'calendar-history/2026-11.json','participation/2026-11.json',
   'data/manual-approvals/new.json','season-data/new-schema.json', 'season-data/S30.json',
   'season-data/manifest.json', 'season-data/ranking-S43.json',
   'season-data/assets/S43.json','docs/README.md'
 ]) {
   assert.equal(classify([change('M',path)]).mode,'full',path);
   assert.equal(classify([change('M','results.json'),change('M',path)]).mode,'full','mixed: '+path);
 }
});

test('renames, deletions, type changes, no changes and abnormal records are full',()=>{
 assert.equal(classify([]).mode,'full');
 for(const status of ['D','R100','T','C100','U','X',null]) {
   assert.equal(classify([change(status,'results.json')]).mode,'full',String(status));
 }
 assert.equal(classify([change('M','results.json'),null]).mode,'full');
 assert.equal(classify(Array(3001).fill(change('M','results.json'))).mode,'full');
});

test('zero-delimited Git diff is parsed exactly without losing spaces or punctuation',()=>{
 const changes=parseNameStatus(Buffer.from('M\0results.json\0A\0season-data/S43.json\0'));
 assert.deepEqual(changes,[change('M','results.json'),change('A','season-data/S43.json')]);
 for(const bytes of [Buffer.from(''),Buffer.from('M\0results.json'),Buffer.from('R100\0old\0new\0')])
   assert.throws(()=>parseNameStatus(bytes));
});

test('untrusted or missing context, missing commits, and Git failures fall back to full',()=>{
 assert.equal(safeSha(sha),true);
 assert.equal(safeSha('HEAD~1'),false);
 const pr={GITHUB_EVENT_NAME:'pull_request',PR_BASE_SHA:sha,PR_HEAD_SHA:other};
 const git=()=>Buffer.from('M\0results.json\0');
 assert.deepEqual(detect(pr,git),{mode:'data',reason:'allowlisted-json-only'});
 assert.equal(detect({...pr,GITHUB_EVENT_NAME:'push'},git).mode,'full');
 assert.equal(detect({...pr,PR_BASE_SHA:'HEAD'},git).mode,'full');
 assert.equal(detect(pr,()=>{throw new Error('git error')} ).mode,'full');
 assert.equal(detect(pr,()=>Buffer.from('M\0results.json')).mode,'full');
});
