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
 'reviewed-candidate-publication.yml','tests.yml','safe-sync-merge-tests.yml',
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
