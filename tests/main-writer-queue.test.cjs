'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const dir=path.join(__dirname,'../.github/workflows');
const read=f=>fs.readFileSync(path.join(dir,f),'utf8');
const writers=['auto-sync.yml','history-sync.yml','build-season-data.yml','calendar-history.yml','participation-sync.yml'].sort();
const group='aot-provider-results-main';
test('every direct main writer uses the same non-cancelling bounded queue',()=>{
 const actual=fs.readdirSync(dir).filter(f=>/\.ya?ml$/.test(f)&&/\bgit push origin HEAD:main\b/.test(read(f))).sort();
 assert.deepEqual(actual,writers,'new main writer must join the publication queue');
 for(const f of writers){
  const c=read(f),block=c.match(/^concurrency:\n((?:  [^\n]*\n)+)/m)?.[1]||'';
  assert.match(block,new RegExp('^  group: '+group+'$','m'),f);
  assert.match(block,/^  queue: max$/m,f);
  assert.match(block,/^  cancel-in-progress: false$/m,f);
  assert.doesNotMatch(c,/git push[^\n]*(?:--force|-f(?:\s|$)|\+HEAD:main)/,f);
 }
});
test('existing scan cadence and retries are preserved; review PRs are outside main writer queue',()=>{
 const crons={'auto-sync.yml':'17 0,4,8,12,16,20 * * *','history-sync.yml':'41 1,5,9,13,17,21 * * *',
 'participation-sync.yml':'53 2,8,14,20 * * *','calendar-history.yml':'29 2 * * *'};
 for(const [f,cron] of Object.entries(crons))assert.ok(read(f).includes("cron: '"+cron+"'"),f);
 for(const f of ['auto-sync.yml','history-sync.yml','build-season-data.yml']){
  assert.match(read(f),/git fetch origin main/);
  assert.match(read(f),/git reset --hard origin\/main/);
  assert.match(read(f),/for attempt in 1 2 3 4 5/);
 }
 for(const f of ['reviewed-candidate-publication.yml','published-attendance-recheck.yml']){
  assert.doesNotMatch(read(f),/group: aot-provider-results-main/);
  assert.doesNotMatch(read(f),/git push origin HEAD:main/);
 }
});
test('calendar retries against latest main, stops on stale inputs and validates before push',()=>{
 const c=read('calendar-history.yml');
 const base=c.indexOf('CALENDAR_BASE=$(git rev-parse HEAD)');
 const commit=c.indexOf('git commit -m "data: archive verified historical tournament sessions"');
 const retry=c.indexOf('for attempt in 1 2 3 4 5; do');
 const fetch=c.indexOf('git fetch origin main',retry);
 const guard=c.indexOf('git diff --quiet "$CALENDAR_BASE" origin/main -- scripts/ tournaments.json calendar-history.json calendar-history-index.json calendar-history-status.json calendar-history/',fetch);
 const rebase=c.indexOf('git rebase origin/main',guard);
 const validate=c.indexOf('npm run validate || exit 1',rebase);
 const push=c.indexOf('git push origin HEAD:main',validate);
 assert.ok(base>=0&&base<commit&&commit<retry&&retry<fetch&&fetch<guard&&guard<rebase&&rebase<validate&&validate<push);
 assert.match(c.slice(guard,rebase),/exit 1/);
 assert.match(c.slice(rebase,validate),/git rebase --abort/);
 assert.match(c.slice(push),/CALENDAR_RETRY/);
});
