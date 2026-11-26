'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {validateAttendanceRequest:validate,REQUEST_FILE,PREFIX}=require('../scripts/published-attendance-request.cjs');
const base='a'.repeat(40),head='b'.repeat(40),id='r20261126-abc123';
const now=Date.parse('2026-11-26T07:30:00.000Z');
const req={version:1,action:'prepare-attendance-corrections',id,confirmation:'CONFIRM',baseSha:base,requestedAt:'2026-11-26T07:29:00.000Z'};
const ctx={ref:PREFIX+id,headSha:head,mainSha:base,parents:[base],changedFiles:[REQUEST_FILE],fileMode:'100644',now};
test('accept only the explicit single-commit direct correction request',()=>{
 assert.deepEqual(validate(req,ctx),{id,baseSha:base});
});
test('reject arbitrary data, commands, extra keys, missing confirmation and invalid request schema',()=>{
 for(const bad of [null,[],{...req,confirmation:'NO'},{...req,action:'shell'},{...req,version:2},{...req,script:'evil'},
  {...req,prize:100},{...req,id:'../../main'},{...req,requestedAt:'2026-11-26'}]){
  assert.throws(()=>validate(bad,ctx),/ATTENDANCE_REQUEST/);
 }
 const {confirmation,...missing}=req;
 assert.throws(()=>validate(missing,ctx),/ATTENDANCE_REQUEST/);
});
test('reject stale main, multiple parents, wrong branch, executable or symlink request, code changes and expired requests',()=>{
 for(const patch of [{ref:'refs/heads/main'},{headSha:base},{headSha:'0'.repeat(40)},{mainSha:'c'.repeat(40)},
  {parents:[base,head]},{parents:[head]},{parents:[]},{changedFiles:[]},
  {changedFiles:[REQUEST_FILE,'scripts/published-attendance-phase5.cjs']},
  {changedFiles:[REQUEST_FILE,'.github/workflows/published-attendance-recheck.yml']},
  {fileMode:'120000'},{fileMode:'100755'},{now:now+4*3600000},{now:now-600000}]){
  assert.throws(()=>validate(req,{...ctx,...patch}),/ATTENDANCE_REQUEST/);
 }
});
test('workflow reuses the trusted correction pipeline and never publishes to main',()=>{
 const w=fs.readFileSync(path.join(__dirname,'../.github/workflows/published-attendance-recheck.yml'),'utf8');
 assert.ok(w.includes("'ops/attendance-recheck/**'"));
 assert.ok(w.includes("'"+REQUEST_FILE+"'"));
 const p=w.slice(w.indexOf('  prepare:'));
 assert.ok(p.includes('ref: main'));
 assert.ok(p.includes("github.event_name == 'push'"));
 assert.ok(p.indexOf('node scripts/published-attendance-request.cjs')<p.indexOf('node scripts/published-attendance-phase5.cjs --apply'));
 assert.ok(p.includes('npm run validate'));
 assert.ok(p.includes("steps.correction.outputs.has_changes == 'true'"));
 assert.ok(p.includes('git rev-parse origin/main'));
 assert.ok(p.includes('git push -u origin "$BRANCH"'));
 assert.ok(p.includes('gh workflow run tests.yml'));
 assert.ok(p.includes('AOT_ATTENDANCE_REQUEST app-pr-needed=$BRANCH'));
 assert.doesNotMatch(p,/\bgh pr merge\b|git push[^\n]*HEAD:main/);
});
