'use strict';
// Fail-closed PR change classification. Run this file from the BASE commit,
// not from pull-request code, so a PR cannot rewrite its own classification.
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');

const DIRECT_DATA = new Set(['results.json', 'players.json', 'tournaments.json', 'updates.json']);
const SEASON_DATA = /^season-data\/(?:S[0-9]+|unknown|manifest|ranking-(?:S[0-9]+|unknown|all))\.json$/;

function classify(files) {
  if (!Array.isArray(files) || files.length === 0) return {mode:'full',reason:'no-changes'};
  if (files.length > 3000) return {mode:'full',reason:'too-many-changes'};
  for (const item of files) {
    if (!item || !['A','M'].includes(item.status))
      return {mode:'full',reason:'unsafe-change-type'};
    const p = item.path;
    if (typeof p !== 'string' || p.includes('\0') ||
        !(DIRECT_DATA.has(p) || SEASON_DATA.test(p)))
      return {mode:'full',reason:'code-or-unknown-change'};
  }
  return {mode:'data',reason:'allowlisted-json-only'};
}

function parseNameStatus(buffer) {
  if (!Buffer.isBuffer(buffer) || !buffer.length || buffer[buffer.length - 1] !== 0)
    throw new Error('Incomplete Git name/status output');
  const fields = buffer.toString('utf8').split('\0');
  if (fields.pop() !== '' || fields.length % 2 !== 0)
    throw new Error('Malformed Git name/status output');
  const changed=[];
  for (let i=0;i<fields.length;i+=2)
    changed.push({status:fields[i],path:fields[i+1]});
  return changed;
}

function safeSha(sha) {
  return typeof sha === 'string' && /^[0-9a-f]{40}$/i.test(sha);
}

function detect(env=process.env, git=execFileSync) {
  // Pushes, manual dispatch, unknown event types and missing SHAs are full.
  if (env.GITHUB_EVENT_NAME !== 'pull_request')
    return {mode:'full',reason:'non-pr-event'};
  if (!safeSha(env.PR_BASE_SHA) || !safeSha(env.PR_HEAD_SHA))
    return {mode:'full',reason:'invalid-commit-ids'};
  try {
    // No renames: a rename becomes a deletion + addition and is always full.
    const output=git('git', [
      'diff', '--no-ext-diff', '--no-textconv', '--no-renames',
      '--name-status', '-z', env.PR_BASE_SHA, env.PR_HEAD_SHA, '--'
    ], {maxBuffer: 8 * 1024 * 1024});
    return classify(parseNameStatus(output));
  } catch {
    return {mode:'full',reason:'git-diff-failed'};
  }
}

if (require.main===module) {
  const result=detect();
  if (process.env.GITHUB_OUTPUT)
    fs.appendFileSync(process.env.GITHUB_OUTPUT,
      'mode=' + result.mode + '\nreason=' + result.reason + '\n');
  console.log('Change-aware CI: ' + result.mode + ' (' + result.reason + ')');
}
module.exports={classify,parseNameStatus,detect,safeSha};
