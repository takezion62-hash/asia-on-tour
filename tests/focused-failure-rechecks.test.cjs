'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const unitReporter = require('../scripts/unit-failure-reporter.cjs');
const {failureFiles} = require('../scripts/unit-test-runner.cjs');
const {readReport, mergeReports} = require('../scripts/browser-failure-recheck.cjs');

test('Node reporter records failed tests and their portable test file paths', async () => {
  async function* events() {
    yield { type:'test:pass', data:{file:'/build/tests/a.test.cjs',name:'passes'} };
    yield { type:'test:fail', data:{file:'/build/tests/a.test.cjs',name:'broken behavior'} };
    yield { type:'test:fail', data:{file:'C:\\work\\tests\\b.test.cjs',name:'wrong state'} };
  }
  let json = '';
  for await (const result of unitReporter(events())) json += result;
  const report = JSON.parse(json);
  assert.deepEqual(report.failedTests.map(f=>f.file),
    ['tests/a.test.cjs','tests/b.test.cjs']);
  assert.deepEqual(failureFiles(report,['tests/a.test.cjs','tests/b.test.cjs']),
    ['tests/a.test.cjs','tests/b.test.cjs']);
});

test('focused Node runner reruns only failed files, not all tests, and deduplicates them', () => {
  const report = {version:1,failedTests:[
    {file:'tests/a.test.cjs',name:'failure 1'},
    {file:'tests/a.test.cjs',name:'failure 2'},
    {file:'tests/b.test.cjs',name:'failure 3'}
  ]};
  assert.deepEqual(failureFiles(report,['tests/a.test.cjs','tests/b.test.cjs','tests/c.test.cjs']),
    ['tests/a.test.cjs','tests/b.test.cjs']);
  assert.deepEqual(failureFiles({version:1,failedTests:[]},['tests/a.test.cjs']),[]);
});

test('invalid or unrecognized unit report entries fail closed, never executing arbitrary files', () => {
  const allowed=['tests/known.test.cjs'];
  for (const input of [
    {},{version:3,failedTests:[]},{version:1,failedTests:[{file:'../private.js'}]},
    {version:1,failedTests:[{file:'tests/removed.test.cjs'}]},
    {version:1,failedTests:[{file:null,name:'missing file name'}]}
  ]) assert.throws(()=>failureFiles(input,allowed));
});

test('four Playwright shards merge ONLY failed test IDs, including PC and smartphone IDs', t => {
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'aot-failed-shards-'));
  t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));
  const failed=['1234567890abc123','fedcba0987654321'];
  for(let shard=1;shard<=4;shard++){
    const dest=path.join(directory,'site-test-report-'+shard,'test-results');
    fs.mkdirSync(dest,{recursive:true});
    fs.writeFileSync(path.join(dest,'last-run.json'),JSON.stringify({
      status:shard<3?'failed':'passed',
      failedTests:shard===1?[failed[0]]:shard===2?[failed[1],failed[0]]:[]
    }));
  }
  const merged=path.join(directory,'combined','.last-run.json');
  assert.equal(mergeReports(directory,merged),2);
  assert.deepEqual(readReport(merged).failedTests,failed);
  fs.rmSync(path.join(directory,'site-test-report-3','test-results','last-run.json'));
  assert.throws(()=>mergeReports(directory,merged),/Missing Playwright report from shard 3/);
});

test('Playwright failure reports reject malformed IDs and never execute a shell command', t => {
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'aot-failed-id-'));
  t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));
  const file=path.join(directory,'last-run.json');
  fs.writeFileSync(file,JSON.stringify({failedTests:['; rm -rf /']}));
  assert.throws(()=>readReport(file),/Invalid Playwright/);
});
