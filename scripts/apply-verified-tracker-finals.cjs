'use strict';
// Safe, repeatable import of screenshot-confirmed, zero-prize Tracker finals.
// Source season shards remain authoritative; duplicate teams are skipped,
// and conflicting ranks, identities or prize amounts fail closed.
const fs = require('node:fs');
const path = require('node:path');
const { sourceInfo, validateData } = require('./data-checks.cjs');
const { upsertPublicationLog } = require('./reviewed-publication-core.cjs');
const {readResults,publishResults}=require('./source-results-store.cjs');
const root = path.resolve(__dirname, '..');
const directory = path.join(root, 'data', 'manual-approvals');
const read = file => file==='results.json'?readResults(root).rows:JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const save = (file, obj) => file==='results.json'?publishResults(root,obj):fs.writeFileSync(path.join(root, file), JSON.stringify(obj, null, 2) + '\n');
const fail = (ok, message) => { if (!ok) throw Error('TRACKER_FINALS_IMPORT: ' + message); };
const dryRun = process.argv.includes('--dry-run');
const results = read('results.json');
const players = read('players.json');
const tournaments = read('tournaments.json');
const updates = read('updates.json');
const known = new Set(players.candidates.map(p => p.name));
const aliases = players.confirmedAliases;
const normalized = new Map();
for (const p of players.candidates) normalized.set(p.name, p.name);
for (const [name, names] of Object.entries(aliases))
  for (const other of names) {
    fail(!normalized.has(other) || normalized.get(other) === name, 'alias conflict: ' + other);
    normalized.set(other, name);
  }
const canonical = name => normalized.get(name) || name;
const roster = row => Array.isArray(row.players) && row.players.length ? row.players : [row.player];
const accountId = url => { try { return new URL(url).searchParams.get('id'); } catch { return null; } };
const cutoffs = { 'S30_DuosCashCupZB:ME':25 };
const imported = [];
const skipped = [];
const changedProfiles = [];
const patchFiles = fs.readdirSync(directory).filter(f => /^[0-9]{8}-.*-tracker\.json$/.test(f)).sort();
fail(patchFiles.length > 0, 'no verified Tracker patch files');
for (const file of patchFiles) {
  const doc = read(path.join('data', 'manual-approvals', file));
  fail(doc.version === 1 && Array.isArray(doc.batches), 'bad patch format: ' + file);
  for (const b of doc.batches) {
    fail(b.date === '2024-06-13' && b.region === 'ME' &&
      b.eventId === 'S30_DuosCashCupZB' &&
      b.windowId === 'S30_DuosCashCupZB_Event2Round2_ME' &&
      b.tournamentId === 'ch5s3-zb-duos-cash' &&
      b.cashCutoff === cutoffs[b.eventId + ':' + b.region] &&
      b.ruleUrl === 'https://www.fortnite.com/news/duos-cash-cups-chapter-5-season-3-official-rules' &&
      b.source === 'https://fortnitetracker.com/events/epicgames_S30_DuosCashCupZB_ME?window=' + b.windowId,
      'unsupported event/rule/window: ' + file);
    const catalog = tournaments.catalog.find(t => t.id === b.tournamentId);
    fail(catalog && catalog.seasonId === 'S30' && catalog.chapter === 5 &&
      catalog.season === 3 && catalog.team === 'duo' && catalog.mode === 'zero-build' &&
      catalog.name === 'ZB Duos Cash Cup' && catalog.sourceEventIds.includes(b.eventId),
      'tournament catalog mismatch');
    const eventRows = results.filter(r => r.date === b.date && r.region === b.region &&
      r.tournamentId === b.tournamentId && 
      (sourceInfo(r).roundId === b.windowId ||
        (String(r.round).includes('Event 2') && String(r.round).includes('Round 2'))));
    const observedRounds = [...new Set(eventRows.filter(r => r.kind === '賞金決勝')
      .map(r => r.round))];
    fail(observedRounds.length <= 1, 'pre-existing inconsistent event rounds');
    const round = observedRounds[0] || b.roundFallback;
    fail(/Round\s*2.*\/\s*賞金決勝$/u.test(round), 'unexpected finals round label');
    fail(Array.isArray(b.teams) && b.teams.length > 0, 'no teams');
    for (const team of b.teams) {
      fail(Number.isSafeInteger(team.rank) && team.rank > b.cashCutoff &&
        Number.isSafeInteger(team.points) && team.points >= 0 &&
        Number.isSafeInteger(team.kills) && team.kills >= 0 &&
        Number.isSafeInteger(team.vrs) && team.vrs >= 0 &&
        Number.isSafeInteger(team.matches) && team.matches >= 1 &&
        team.matches <= 6 && team.vrs <= team.matches &&
        Array.isArray(team.members) && team.members.length === 2,
        'invalid team data or unverified payout rank: ' + team.rank);
      const names = team.members.map(m => m.name);
      fail(new Set(names).size === 2, 'duplicate member in rank ' + team.rank);
      for (const m of team.members) {
        const uri = new URL(m.url);
        fail(typeof m.name === 'string' && m.name.trim() === m.name && m.name.length > 0 &&
          typeof m.raw === 'string' && m.raw.trim() === m.raw && m.raw.length > 0 &&
          uri.protocol === 'https:' && uri.hostname === 'fortnitetracker.com' &&
          uri.pathname.startsWith('/profile/all/') &&
          /^[0-9a-f-]{36}$/i.test(uri.searchParams.get('id') || ''),
          'unverified Epic profile identity at rank ' + team.rank);
        fail(!normalized.has(m.name) || canonical(m.name) === m.name,
          'proposed name is an alias of a different published player: ' + m.name);
      }
      const signature = names.map(canonical).sort().join('\u0000');
      const same = eventRows.find(r => roster(r).map(canonical).sort().join('\u0000') === signature);
      if (same) {
        fail(['rank','points','kills','vrs','matches'].every(k => same[k] === team[k]) &&
          same.prize === 0, 'published result disagrees with screenshot at rank ' + team.rank);
        skipped.push(same.id);
        continue;
      }
      // A profile ID may not be imported twice under another player identity.
      for (const m of team.members) {
        const id = accountId(m.url);
        for (const row of results) {
          for (const profile of row.profiles || []) {
            if (accountId(profile.url) === id)
              fail(canonical(profile.name) === canonical(m.name),
                'Tracker account already belongs to another player: ' + m.name);
          }
        }
        if (!known.has(m.name)) {
          const initials = /^[a-z]/i.test(m.name) ? m.name.slice(0,2).toUpperCase() : m.name.slice(0,2);
          const palette = ['cyan','pink','violet'];
          players.candidates.push({
            name:m.name, initials, accent:palette[players.candidates.length % 3],
            desc:b.date + ' ME ZB Duos Cash Cup決勝' + team.rank + '位・' +
              team.points + 'pt・チーム' + team.kills + 'キル・' + team.vrs +
              'VR・個人賞金$0。ユーザー提供Tracker画像と本人プロフィールIDで確認。'
          });
          known.add(m.name);
          normalized.set(m.name,m.name);
          changedProfiles.push(m.name);
        }
        if (m.raw !== m.name) {
          fail(!known.has(m.raw) || m.raw === m.name, 'alias is already a separate player: ' + m.raw);
          fail(!normalized.has(m.raw) || canonical(m.raw) === m.name,
            'ambiguous Tracker alias: ' + m.raw);
          if (!Array.isArray(aliases[m.name])) aliases[m.name] = [];
          if (!aliases[m.name].includes(m.raw)) aliases[m.name].push(m.raw);
          normalized.set(m.raw,m.name);
        }
      }
      const id = 'manual-s30-me-zbduos-20240613-r' + team.rank;
      fail(!results.some(r => r.id === id), 'id collision: ' + id);
      const record = {
        id,date:b.date,region:b.region,player:names.join(' / '),players:names,
        playerRaw:team.members.map(m => m.raw).join(' / '),
        event:catalog.name,round,rank:team.rank,points:team.points,
        kills:team.kills,vrs:team.vrs,matches:team.matches,prize:0,prizePerPlayer:0,
        kind:'賞金決勝',source:b.source,
        profiles:team.members.map(m => ({name:m.name,url:m.url})),
        verified:true,tournamentId:catalog.id,seasonId:catalog.seasonId,
        chapter:catalog.chapter,season:catalog.season,
        note:'ユーザー提供Fortnite Tracker決勝結果画像・本人プロフィールIDで確認。' +
          'MEのZB Duos Cash Cup 2024年公式規則は25位まで賞金、' +
          team.rank + '位は賞金圏外（チーム/個人とも$0）。キルはチーム合計。'
      };
      results.push(record);
      eventRows.push(record);
      imported.push(record);
    }
    const batchIds = imported.filter(r => r.date === b.date && r.region === b.region &&
      r.tournamentId === b.tournamentId).map(r => r.id);
    if (batchIds.length) upsertPublicationLog(updates,{
      id:b.id,date:'2026-11-12',title:'2024/6/13 ME ZB Duos Cash Cup決勝：5組の追加',
      description:'ユーザー提供Tracker画像・10名の本人プロフィール・Epic公式25位賞金規則を照合。26位以下の決勝結果を賞金$0で掲載。既存決勝枠と同一ラウンドに統合。',
      recordIds:batchIds
    });
  }
}
const validation = validateData({results,players,tournaments});
fail(validation.errors.length === 0, 'data validation: ' + JSON.stringify(validation.errors.slice(0,6)));
if (!dryRun && imported.length) {
  save('results.json',results);
  save('players.json',players);
  save('updates.json',updates);
}
console.log(JSON.stringify({mode:dryRun?'dry-run':'apply',imported:imported.length,
  skipped:skipped.length,newPlayers:changedProfiles.length,recordIds:imported.map(r=>r.id)}));
