'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('runtime report watches PR CI, season rebuild and deployment without duplicate subscriptions', () => {
  const workflow = read('.github/workflows/review-timing.yml');
  assert.match(workflow, /^  workflow_run:\s*$/m);
  const subscriptions = workflow.match(/^    workflows:\r?\n([\s\S]*?)(?=^    types:)/m)?.[1];
  assert.ok(subscriptions, 'Expected workflow_run subscriptions');
  const names = subscriptions.split(/\r?\n/).filter(x => /^      - /.test(x))
    .map(x => x.trim().slice(2));
  assert.deepEqual(names, [
    'Data and site tests',
    'Rebuild lightweight season data',
    'pages build and deployment'
  ]);
  assert.equal(new Set(names).size, names.length);
  assert.match(workflow, /^    types: \[completed\]$/m);
});

test('runtime metrics are collected read-only from trusted main and retained as artifacts', () => {
  const workflow = read('.github/workflows/review-timing.yml');
  assert.match(workflow, /permissions:\s*\n  actions: read\s*\n  contents: read/);
  assert.match(workflow, /ref: main\s*\n\s*persist-credentials: false/);
  assert.match(workflow, /run: node scripts\/review-timing\.cjs/);
  assert.match(workflow, /path: timing-reports\//);
  assert.match(workflow, /retention-days: 30/);
  const script = read('scripts/review-timing.cjs');
  assert.match(script, /fetch\(base\+'\/actions\/runs\/'\+run\.id\+'\/jobs\?per_page=100'/);
  assert.match(script, /fs\.writeFileSync\(path\.join\(destination,'run-'\+run\.id\+'\.json'\)/);
});

test('rebuild still validates source, approvals, money and generated indexes before publishing', () => {
  const workflow = read('.github/workflows/build-season-data.yml');
  for (const command of [
    'git fetch origin main',
    'git reset --hard origin/main',
    'node scripts/source-results-store.cjs verify',
    'node scripts/validate-data.cjs',
    'node scripts/validate-approvals.cjs',
    'node scripts/validate-updates.cjs',
    'node scripts/build-source-results.cjs --check',
    'node scripts/build-season-data.cjs --check',
    'node scripts/build-candidate-triage.cjs --check',
    'git push origin HEAD:main'
  ]) assert.ok(workflow.includes(command), command);
  assert.match(workflow, /for attempt in 1 2 3 4 5; do/);
  assert.match(workflow, /if git diff --cached --quiet; then/);
  assert.doesNotMatch(workflow, /git push[^\n]*--force/);
});

test('historical dry-run check name stays accurate as more scripts are registered', () => {
  const workflow = read('.github/workflows/tests.yml');
  const runner = read('scripts/run-historical-dry-runs.cjs');
  assert.match(workflow, /run: node scripts\/run-historical-dry-runs\.cjs/);
  assert.doesNotMatch(workflow, /過去大会\d+本の検証/);
  assert.match(runner, /child = spawn\(process\.execPath, \[script, '--dry-run'\]/);
  assert.match(runner, /if \(failed\.length\) process\.exitCode = 1/);
});
