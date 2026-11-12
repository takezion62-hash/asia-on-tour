'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const lastRun = path.join(root, 'test-results', '.last-run.json');

function readReport(file) {
  const report = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!report || !Array.isArray(report.failedTests) ||
      !report.failedTests.every(id => typeof id === 'string' &&
         /^[a-z0-9_-]{8,128}$/i.test(id))) {
    throw new Error('Invalid Playwright last-run report: ' + file);
  }
  return report;
}

function mergeReports(runRoot = root) {
  const ids = new Set();
  for (let shard = 1; shard <= 4; shard++) {
    const file = path.join(runRoot, 'site-test-report-' + shard,
      'test-results', '.last-run.json');
    if (!fs.existsSync(file))
      throw new Error('Missing Playwright report from shard ' + shard +
        '; re-run the full suite if the browser job never started');
    for (const id of readReport(file).failedTests) ids.add(id);
  }
  fs.mkdirSync(path.dirname(lastRun), {recursive: true});
  fs.writeFileSync(lastRun,
    JSON.stringify({status: ids.size ? 'failed' : 'passed',
      failedTests: [...ids]}, null, 2) + '\n');
  console.log('Combined Playwright failures: ' + ids.size +
    ' test IDs across both device projects');
  return ids.size;
}

async function rerunFailed(args = process.argv.slice(3)) {
  if (!fs.existsSync(lastRun))
    throw new Error('Missing test-results/.last-run.json; run the full browser tests first');
  const state = readReport(lastRun);
  if (!state.failedTests.length) {
    console.log('No previously failed PC/mobile tests: focused rerun skipped (NOT full approval)');
    return;
  }
  // --last-failed matches stored Playwright test IDs, including device project;
  // no grep string / user data is ever evaluated by a shell.
  const command = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const code = await new Promise((resolve, reject) => {
    const child = spawn(command, ['playwright', 'test', '--last-failed', ...args],
      {cwd: root, stdio: 'inherit'});
    child.once('error', reject);
    child.once('close', (exit, signal) => resolve(exit ?? (signal ? 1 : 1)));
  });
  if (code !== 0) process.exitCode = code;
}
if (require.main === module) {
  const mode = process.argv[2];
  const task = mode === 'merge' ? Promise.resolve().then(() => mergeReports()) :
    mode === 'run' ? rerunFailed() :
    Promise.reject(new Error('Usage: node scripts/browser-failure-recheck.cjs [merge|run]'));
  task.catch(error => {console.error(error.message);process.exitCode = 1;});
}
module.exports = { readReport, mergeReports, rerunFailed };
