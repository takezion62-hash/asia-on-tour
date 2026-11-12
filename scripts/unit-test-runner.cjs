'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const report = path.join(root, 'test-results', 'unit-last-failed.json');

function listedUnitFiles() {
  return fs.readdirSync(path.join(root, 'tests'))
    .filter(f => /^[a-z0-9._-]+\.test\.cjs$/i.test(f))
    .map(f => 'tests/' + f).sort();
}

function failureFiles(data, allowedFiles = listedUnitFiles()) {
  if (!data || data.version !== 1 || !Array.isArray(data.failedTests))
    throw new Error('Invalid unit failure report; run the full unit suite first');
  const allowed = new Set(allowedFiles);
  const chosen = new Set();
  for (const failure of data.failedTests) {
    if (!failure || typeof failure.file !== 'string' || !allowed.has(failure.file))
      throw new Error('Unrecognized failed test file in report; full test run needed: ' +
        JSON.stringify(failure));
    chosen.add(failure.file);
  }
  return [...chosen].sort();
}

async function main(mode = process.argv[2] || 'all') {
  if (!['all', 'failed'].includes(mode))
    throw new Error('Usage: node scripts/unit-test-runner.cjs [all|failed]');
  fs.mkdirSync(path.dirname(report), {recursive: true});
  const files = mode === 'all' ? listedUnitFiles() :
    failureFiles(JSON.parse(fs.readFileSync(report, 'utf8')));
  if (!files.length) {
    if (mode === 'failed') {
      console.log('No previously failed unit tests: focused rerun skipped (NOT a full-suite approval)');
      return;
    }
    throw new Error('No unit test files were found');
  }
  console.log((mode === 'all' ? 'Full unit suite: ' : 'Focused failed unit files: ') +
    files.length + ' file(s)');
  const args = [
    '--test',
    '--test-reporter=spec', '--test-reporter-destination=stdout',
    '--test-reporter=./scripts/unit-failure-reporter.cjs',
    '--test-reporter-destination=test-results/unit-last-failed.json',
    ...files
  ];
  // Discard stale results only after reading the previous failure manifest.
  fs.rmSync(report, {force: true});
  const exitCode = await new Promise((resolve, reject) => {
    const proc = spawn(process.execPath, args, {cwd: root, stdio: 'inherit'});
    proc.once('error', reject);
    proc.once('close', (code, signal) => resolve(code ?? (signal ? 1 : 1)));
  });
  // A crash or custom-reporter error must not become an empty "success" file.
  if (!fs.existsSync(report))
    throw new Error('Unit runner did not produce a failure report; cannot trust result');
  failureFiles(JSON.parse(fs.readFileSync(report, 'utf8')));
  if (exitCode !== 0) process.exitCode = exitCode;
}

if (require.main === module) {
  main().catch(err => { console.error(err.message); process.exitCode = 1; });
}
module.exports = { listedUnitFiles, failureFiles, main };
