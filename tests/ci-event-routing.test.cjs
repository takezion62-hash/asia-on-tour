'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const workflow = fs.readFileSync(
  path.join(__dirname, '..', '.github', 'workflows', 'tests.yml'), 'utf8'
);
const trigger = workflow.match(/^on:\r?\n([\s\S]*?)(?=^permissions:)/m)?.[1];
const lines = trigger?.split(/\r?\n/) ?? [];
const at = name => lines.findIndex(line => line === '  ' + name + ':');

test('test workflow triggers push checks on main only, not feature branches', () => {
  assert.ok(trigger, 'Expected a readable workflow trigger section');
  const push = at('push');
  assert.ok(push >= 0, 'push trigger must remain enabled for main');
  assert.equal(lines[push + 1]?.trim(), 'branches: [main]');
  assert.ok(at('pull_request') > push,
    'Pull requests must continue to run required checks for feature branches');
  assert.ok(at('workflow_dispatch') > push,
    'Trusted reviewed-results workflows still need manual dispatch');
});

test('trigger changes keep documentation exclusions and explicit review base input', () => {
  assert.match(trigger, /^    paths-ignore:\s*$/m);
  assert.match(trigger, /^      - '\*\*\/\*\.md'\s*$/m);
  assert.match(trigger, /^      - 'review-requests\/launch\.json'\s*$/m);
  assert.match(trigger, /^      review_base_sha:\s*$/m);
});

test('required unit, PC/mobile and smoke verification gate stays mandatory', () => {
  assert.match(workflow, /run: node scripts\/run-historical-dry-runs\.cjs/);
  assert.match(workflow, /run: npm run test:unit/);
  assert.match(workflow, /run: npm run test:e2e -- --shard=/);
  assert.match(workflow, /run: npm run test:e2e -- tests\/ci-data-smoke\.spec\.cjs/);
  assert.match(workflow, /run: node scripts\/ci-required-gate\.cjs/);
});
