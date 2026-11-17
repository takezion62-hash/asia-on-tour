'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {BATCHES, PARALLEL, runBatches, failedChecks} =
  require('../scripts/run-historical-dry-runs.cjs');

test('all 30 historical evidence checks remain registered exactly once', () => {
  assert.equal(BATCHES.length, 30);
  assert.equal(new Set(BATCHES).size, BATCHES.length);
  for (const script of BATCHES) {
    assert.match(script, /^scripts\/[a-z0-9-]+\.cjs$/);
    assert.ok(fs.existsSync(path.resolve(__dirname, '..', script)), script);
  }
  assert.equal(PARALLEL, 3);
});

test('bounded runner processes every check once with no more than three in flight', async () => {
  let active = 0, maximum = 0;
  const entries = ['one', 'two', 'three', 'four', 'five', 'six', 'seven'];
  const seen = new Map();
  const result = await runBatches({
    entries, parallel: PARALLEL,
    run: async script => {
      active++;
      maximum = Math.max(maximum, active);
      seen.set(script, (seen.get(script) || 0) + 1);
      await new Promise(resolve => setImmediate(resolve));
      active--;
      return {script, code: 0};
    }
  });
  assert.equal(maximum, PARALLEL);
  assert.deepEqual(result.map(x => x.script), entries);
  assert.ok(entries.every(script => seen.get(script) === 1));
  assert.deepEqual(failedChecks(result), []);
});

test('one failed historical check fails the aggregate, even if others pass', async () => {
  const results = await runBatches({
    entries: ['ok', 'bad', 'ok2'], parallel: 2,
    run: async script => ({script, code: script === 'bad' ? 1 : 0})
  });
  assert.deepEqual(failedChecks(results).map(x => x.script), ['bad']);
});

test('a child runner exception does not skip remaining checks or pass silently', async () => {
  const results = await runBatches({
    entries: ['bad', 'good'], parallel: 1,
    run: async script => {
      if (script === 'bad') throw Error('simulated child failure');
      return {script, code: 0};
    }
  });
  assert.equal(results.length, 2);
  assert.deepEqual(failedChecks(results).map(x => x.script), ['bad']);
  assert.equal(results[1].code, 0);
});
