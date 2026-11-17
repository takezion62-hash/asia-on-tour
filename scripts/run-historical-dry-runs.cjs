'use strict';
// Run the existing historical evidence checks unchanged, in a small bounded pool.
// Every command remains its own isolated Node process, with --dry-run enforced.
// A failed command fails the entire pool: no historical check is waived.
const {spawn} = require('node:child_process');
const {performance} = require('node:perf_hooks');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const PARALLEL = 3;
const MAX_LOG_CHARS = 65536;
const BATCHES = Object.freeze([
  'scripts/apply-verified-tracker-finals.cjs',
  'scripts/apply-verified-s43-squads-finals.cjs',
  'scripts/apply-s30-me-zb-duos-cash-20240607.cjs',
  'scripts/apply-s30-me-zb-duos-nonprize-20240607.cjs',
  'scripts/apply-s30-me-zb-duos-20240621.cjs',
  'scripts/apply-s29-me-zb-duos-20240506.cjs',
  'scripts/apply-s28-me-zb-duos-20240120-20240212.cjs',
  'scripts/apply-s26-s28-me-zb-duos-2023.cjs',
  'scripts/apply-s25-me-zb-duos-2023.cjs',
  'scripts/apply-ps-cups-2022-2024-nov14.cjs',
  'scripts/apply-s37-s39-s40-awards7.cjs',
  'scripts/apply-s37-s41-oce-five.cjs',
  'scripts/apply-eu-unreal-me-trios-four.cjs',
  'scripts/apply-kame-me-duos-two.cjs',
  'scripts/apply-s41-console-zb-oce-reconcile.cjs',
  'scripts/apply-boter-s31-s38-nine.cjs',
  'scripts/apply-nac-s29-s30-zb-vc-ten.cjs',
  'scripts/apply-s27-s34-s31-ps-zb-ten.cjs',
  'scripts/apply-s31-ps-s26-console-zb-ten.cjs',
  'scripts/publish-nov14-pending-cash.cjs',
  'scripts/reconcile-pending-hamikuma-20261114.cjs',
  'scripts/publish-s37-oce-console-round1-three.cjs',
  'scripts/publish-s37-oce-console-round1-second-three.cjs',
  'scripts/publish-s37-naw-console-event6-round1-four.cjs',
  'scripts/publish-s37-naw-event6-round1-remaining14.cjs',
  'scripts/publish-s37-console-round1-oce7-naw9-23.cjs',
  'scripts/publish-s37-console-duos-round2-20-zerovr.cjs',
  'scripts/publish-pending-review-20261114.cjs',
  'scripts/publish-verified-s32-me-vcup-20241116.cjs',
  'scripts/publish-verified-2024-me-nac-last11.cjs',
  'scripts/reconcile-s42-cosmetic-ranks-20261113.cjs',
]);

function runOne(script) {
  return new Promise(resolve => {
    const start = performance.now();
    let stdout = '', stderr = '', finished = false;
    const append = (existing, chunk) =>
      (existing + chunk.toString('utf8')).slice(0, MAX_LOG_CHARS);
    const finish = (code, signal, error) => {
      if (finished) return;
      finished = true;
      resolve({script, code: code == null ? 1 : code, signal,
        error: error ? String(error) : '',
        durationMs: Math.round(performance.now() - start), stdout, stderr});
    };
    let child;
    try {
      child = spawn(process.execPath, [script, '--dry-run'], {
        cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe']
      });
    } catch (error) {
      finish(1, null, error);
      return;
    }
    child.stdout.on('data', chunk => { stdout = append(stdout, chunk); });
    child.stderr.on('data', chunk => { stderr = append(stderr, chunk); });
    child.once('error', error => finish(1, null, error));
    child.once('close', (code, signal) => finish(code, signal, null));
  });
}

async function runBatches({entries = BATCHES, parallel = PARALLEL, run = runOne} = {}) {
  if (!Array.isArray(entries) || entries.length === 0 || !Number.isInteger(parallel) ||
      parallel < 1 || parallel > 8 || typeof run !== 'function')
    throw Error('Invalid historical check runner configuration');
  const results = Array(entries.length);
  let cursor = 0;
  const worker = async () => {
    while (cursor < entries.length) {
      const i = cursor++;
      try {
        results[i] = await run(entries[i]);
      } catch (error) {
        results[i] = {script: entries[i], code: 1, error: String(error),
          durationMs: 0, stdout: '', stderr: ''};
      }
    }
  };
  await Promise.all(Array.from({length: Math.min(parallel, entries.length)}, worker));
  return results;
}

function failedChecks(results) {
  return results.filter(result => !result || result.code !== 0);
}

async function main() {
  if (process.argv.length !== 2) throw Error('This runner takes no CLI arguments');
  const start = performance.now();
  const results = await runBatches();
  for (const result of results) {
    const ok = result.code === 0;
    console.log((ok ? 'PASS' : 'FAIL') + ' historical dry-run ' +
      result.script + ' (' + (result.durationMs / 1000).toFixed(2) + 's)');
    if (result.stdout.trim()) console.log(result.stdout.trim());
    if (result.stderr.trim()) console.error(result.stderr.trim());
    if (result.error) console.error(result.error);
    if (result.signal) console.error('Exited by signal: ' + result.signal);
  }
  const failed = failedChecks(results);
  console.log('Historical dry-runs: ' + (results.length - failed.length) + '/' +
    results.length + ' passed; elapsed ' +
    ((performance.now() - start) / 1000).toFixed(2) + 's; parallel=' + PARALLEL);
  if (failed.length) process.exitCode = 1;
}

if (require.main === module)
  main().catch(error => { console.error(error); process.exitCode = 1; });
module.exports = {BATCHES, PARALLEL, runOne, runBatches, failedChecks};
