'use strict';
/**
 * Phase 1: create a lossless, season-scoped canonical-source snapshot from the
 * original results.json. In phase 2, source-results is the sole writable authority.
 * This script never writes results.json, players.json or tournaments.json.
 *
 * Usage:
 *   node scripts/build-source-results.cjs
 *   node scripts/build-source-results.cjs --check
 *
 * All source-results/*.json files are generated, not edited by hand.
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { personalCents, roster } = require('./data-checks.cjs');
const ROOT = path.resolve(__dirname, '..');
const TARGET = path.join(ROOT, 'source-results');
const sha = data => crypto.createHash('sha256').update(data).digest('hex');
const currencyCents = value => {
  // Missing payout is unconfirmed, not confirmed $0; preserve it losslessly.
  if (value == null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 ||
      !Number.isSafeInteger(Math.round(value * 100)) ||
      Math.abs(value * 100 - Math.round(value * 100)) > 0.000001)
    throw new Error('Invalid prize in canonical record: ' + value);
  return Math.round(value * 100);
};
const seasonName = name => /^(?:S[1-9]\d*|unknown)$/.test(name);
const stableJson = value => JSON.stringify(value, null, 2) + '\n';
// Personal payout is one player's share; multiply by the real squad size.
const personalAwardCents = record => personalCents(record) * roster(record).length;

function buildSnapshot(records, sourceText, determineSeason = row => require('./build-season-data.cjs').seasonOf(row).id) {
  if (!Array.isArray(records)) throw new Error('Canonical results must be an array');
  if (typeof sourceText !== 'string' || !sourceText.length)
    throw new Error('Canonical source bytes are required');
  const groups = new Map(), ids = new Set(), order = [];
  let totalPrizeCents = 0, totalPersonalCents = 0, unconfirmedPrizeRecords = 0;
  for (const record of records) {
    if (!record || typeof record !== 'object' || Array.isArray(record) ||
        typeof record.id !== 'string' || !record.id ||
        ids.has(record.id))
      throw new Error('Missing or duplicate canonical record ID: ' + record?.id);
    ids.add(record.id);
    order.push(record.id);
    const name = determineSeason(record);
    if (!seasonName(name)) throw new Error('Invalid season bucket: ' + name);
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name).push(record);
    const prize = currencyCents(record.prize);
    if (prize == null) unconfirmedPrizeRecords++;
    else totalPrizeCents += prize;
    totalPersonalCents += personalAwardCents(record);
  }
  if (!groups.has('unknown')) groups.set('unknown', []);
  const seasons = [...groups.keys()].sort((a,b) => {
    if (a === 'unknown') return 1;
    if (b === 'unknown') return -1;
    return Number(a.slice(1)) - Number(b.slice(1));
  });
  const files = new Map(), shards = [];
  for (const name of seasons) {
    const content = stableJson(groups.get(name));
    files.set(name + '.json', content);
    const array = groups.get(name);
    shards.push({
      seasonId:name, file:'source-results/' + name + '.json',
      count:array.length,
      teamPrizeCents:array.reduce((sum,r) => sum + (currencyCents(r.prize) ?? 0),0),
      unconfirmedPrizeRecords:array.filter(r=>r.prize == null).length,
      personalPrizeCents:array.reduce((sum,r) => sum + personalAwardCents(r),0),
      sha256:sha(content)
    });
  }
  const manifest={
    version:1,
    role:'generated canonical-source snapshot; results.json remains authoritative in phase 1',
    canonicalFile:'results.json',
    canonicalSha256:sha(sourceText),
    count:records.length,
    teamPrizeCents:totalPrizeCents,
    unconfirmedPrizeRecords,
    personalPrizeCents:totalPersonalCents,
    // Needed to reconstruct exact original ordering without changing a record.
    recordOrder:order,
    shards
  };
  files.set('manifest.json',stableJson(manifest));
  return {files,manifest};
}

function checkContents(directory, files) {
  const expected = new Set(files.keys());
  for (const [file,content] of files) {
    const at = path.join(directory,file);
    if (!fs.existsSync(at) || fs.readFileSync(at,'utf8') !== content)
      throw new Error('Source shard missing or stale: ' + file);
  }
  if (!fs.existsSync(directory)) throw new Error('Source snapshot directory missing');
  for (const name of fs.readdirSync(directory)) {
    if (/^(?:S[1-9]\d*|unknown|manifest)\.json$/.test(name) && !expected.has(name))
      throw new Error('Obsolete source shard: ' + name);
  }
}

function verifyRoundTrip(directory, original, expected) {
  const manifest = JSON.parse(fs.readFileSync(path.join(directory,'manifest.json'),'utf8'));
  if (JSON.stringify(manifest) !== JSON.stringify(expected.manifest))
    throw new Error('Snapshot manifest differs from source');
  const found = new Map(), ids = new Set();
  let teamPrizeCents = 0, personalPrizeCents = 0, unconfirmedPrizeRecords = 0;
  for (const entry of manifest.shards) {
    const file = path.join(directory,path.basename(entry.file));
    const contents = fs.readFileSync(file,'utf8');
    if (sha(contents) !== entry.sha256)
      throw new Error('Shard checksum mismatch: ' + entry.file);
    const rows = JSON.parse(contents);
    if (!Array.isArray(rows) || rows.length !== entry.count)
      throw new Error('Shard count mismatch: ' + entry.file);
    let prize = 0, personal = 0, unknown = 0;
    for (const row of rows) {
      if (!row || typeof row.id !== 'string' || ids.has(row.id))
        throw new Error('Lost or duplicate record during reconstruction: ' + row?.id);
      ids.add(row.id);
      found.set(row.id,row);
      const amount = currencyCents(row.prize);
      if (amount == null) unknown++;
      else prize += amount;
      personal += personalAwardCents(row);
    }
    if (prize !== entry.teamPrizeCents || personal !== entry.personalPrizeCents ||
        unknown !== entry.unconfirmedPrizeRecords)
      throw new Error('Shard prize mismatch: ' + entry.file);
    teamPrizeCents += prize;
    personalPrizeCents += personal;
    unconfirmedPrizeRecords += unknown;
  }
  if (ids.size !== original.length || ids.size !== manifest.count ||
      teamPrizeCents !== manifest.teamPrizeCents ||
      unconfirmedPrizeRecords !== manifest.unconfirmedPrizeRecords ||
      personalPrizeCents !== manifest.personalPrizeCents ||
      manifest.recordOrder.length !== original.length)
    throw new Error('Global count, ID or prize total differs from canonical results');
  for (let i=0;i<original.length;i++) {
    const id=manifest.recordOrder[i];
    if (id !== original[i].id || JSON.stringify(found.get(id)) !== JSON.stringify(original[i]))
      throw new Error('Lossless reconstruction failed at canonical index ' + i + ' / ' + id);
  }
  return {records:ids.size,teamPrizeCents,personalPrizeCents,unconfirmedPrizeRecords,
    seasons:manifest.shards.length};
}

function syncSnapshot({
  root=ROOT, out=TARGET, check=false, seasonSelector=record => require('./build-season-data.cjs').seasonOf(record).id
}={}) {
  const original=fs.readFileSync(path.join(root,'results.json'),'utf8');
  const records=JSON.parse(original);
  const expected=buildSnapshot(records,original,seasonSelector);
  if (check) checkContents(out,expected.files);
  else {
    fs.mkdirSync(out,{recursive:true});
    for (const [name,content] of expected.files) {
      const target=path.join(out,name);
      if (!fs.existsSync(target) || fs.readFileSync(target,'utf8') !== content)
        fs.writeFileSync(target,content);
    }
    for(const name of fs.readdirSync(out)){
      if (/^(?:S[1-9]\d*|unknown|manifest)\.json$/.test(name) &&
          !expected.files.has(name))
        fs.rmSync(path.join(out,name));
    }
    checkContents(out,expected.files);
  }
  return verifyRoundTrip(out,records,expected);
}

if (require.main === module) {
  const check=process.argv.includes('--check');
  if(!check && fs.existsSync(path.join(TARGET,'manifest.json')) &&
     !process.argv.includes('--explicit-bootstrap'))
    throw Error('SOURCE_RESULTS is authoritative: normal runs must use --check; bootstrap requires --explicit-bootstrap');
  const result=syncSnapshot({check});
  console.log('Canonical source snapshot '+(check?'verified':'generated')+': '+
    result.records+' records, '+result.seasons+' shards, team prize cents '+
    result.teamPrizeCents+', unconfirmed prize records '+result.unconfirmedPrizeRecords+
    ', personal prize cents '+result.personalPrizeCents+
    ' (results.json unchanged)');
}
module.exports={buildSnapshot,checkContents,verifyRoundTrip,syncSnapshot,currencyCents};
