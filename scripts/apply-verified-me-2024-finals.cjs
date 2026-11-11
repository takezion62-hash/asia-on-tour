'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const write = (file, data) => fs.writeFileSync(path.join(root, file), JSON.stringify(data, null, 2) + '\n');
const manifest = read('data/verified-me-2024-finals-20261111.json');
const results = read('results.json');
const players = read('players.json');
const tournaments = read('tournaments.json');
const updates = read('updates.json');
if (manifest.entries.length !== 7) throw Error('Expected exactly 7 screenshot-verified entries');
const added = [], skipped = [], profilesSeen = new Map();
for (const item of manifest.entries) {
  const trio = item.names.length === 3, squad = item.names.length === 4;
  if (!trio && !squad) throw Error('Invalid team size');
  if (!item.profiles || item.profiles.length !== item.names.length || item.profiles.some((p, i) => p.name !== item.names[i] || !p.url.startsWith('https://fortnitetracker.com/profile/all/'))) throw Error('Invalid profile set');
  const seasonId = trio ? 'S32' : 'S30';
  const eventKey = trio ? 'TriosCashCup' : 'SquadsVictoryCashCup';
  const tournamentId = trio ? 'ch5s5-trios-cash' : 'ch5s3-squads-victory-cup';
  const event = trio ? 'Trios Cash Cup' : 'Squads Victory Cup Battle Royale';
  const round = 'Event ' + item.eventNum + ' · Round 2 / 賞金決勝';
  const id = 'manual-' + seasonId.toLowerCase() + '-me-' + (trio ? 'trios' : 'squads') + '-final-' + item.date.replace(/-/g, '') + '-rank' + item.rank;
  const existing = results.filter(r => r.id === id || (r.date === item.date && r.region === 'ME' && r.tournamentId === tournamentId && /Round 2|決勝/.test(r.round || '') && Array.isArray(r.players) && r.players.length === item.names.length && item.names.every(n => r.players.includes(n))));
  if (existing.length > 1) throw Error('Ambiguous duplicate: ' + id);
  if (existing.length === 1) {
    const r = existing[0];
    if (r.rank !== item.rank || r.points !== item.points || r.kills !== item.kills || r.vrs !== item.vrs || r.prize !== item.prize) throw Error('Conflicting result: ' + id);
    skipped.push(id);
    continue;
  }
  if (results.some(r => r.date === item.date && r.region === 'ME' && r.tournamentId === tournamentId && /Round 2|決勝/.test(r.round || '') && r.rank === item.rank)) throw Error('Rank already occupied for ' + id);
  if (!Number.isInteger(item.prize) || item.prize < 0 || (item.prize && item.prize % item.names.length !== 0)) throw Error('Invalid cash amount: ' + id);
  const source = 'https://fortnitetracker.com/events/epicgames_' + seasonId + '_' + eventKey + '_ME?window=' + seasonId + '_' + eventKey + '_Event' + item.eventNum + 'Round2_ME';
  const aliases = { 'こう修行中': 'やってやんよJP', 'ぷろぼこ': 'Puroboko' };
  const note = item.date + ' ME ' + event + ' Event ' + item.eventNum + ' Round 2決勝。2026-11-11にユーザー提供のFortnite Trackerチーム詳細画像で' + item.rank + '位・' + item.points + 'pt・' + item.matches + '試合・チーム' + item.kills + 'キル・' + item.vrs + 'VRを確認。' + (item.prize ? 'チーム賞金$' + item.prize + '（各選手$' + (item.prize / item.names.length) + '）。' + (trio ? 'Cash Cup順位賞金のため0VRでも獲得。' : 'Squads VR賞金。') : '0VRのため賞金$0。') + '選手の本人TrackerプロフィールIDはprofilesで保持。';
  const rec = { id, date: item.date, region: 'ME', player: item.names.join(' / '), players: item.names, playerRaw: item.names.map(n => aliases[n] || n).join(' / '), event, round, rank: item.rank, points: item.points, kills: item.kills, vrs: item.vrs, prize: item.prize, ...(item.prize ? { prizePerPlayer: item.prize / item.names.length } : {}), kind: '賞金決勝', matches: item.matches, seasonId, chapter: 5, season: trio ? 5 : 3, tournamentId, source, verified: true, note, profiles: item.profiles };
  results.push(rec);
  added.push(id);
  for (const p of item.profiles) profilesSeen.set(p.name, { ...p, rec });
}
if (added.length + skipped.length !== 7) throw Error('Unexpected merge count');
const known = new Set(players.candidates.map(p => p.name));
let playerAdded = 0;
for (const [name, { rec }] of profilesSeen) {
  if (known.has(name)) continue;
  players.candidates.push({ name, initials: /^[\x00-\x7f]/.test(name) ? name.slice(0, 2).toUpperCase() : name.slice(0, 2), accent: 'violet', desc: rec.date + ' ME ' + rec.event + '決勝' + rec.rank + '位・' + rec.points + 'pt・' + rec.kills + 'K・' + rec.vrs + 'VR・個人賞金$' + (rec.prize / rec.players.length) + '。ユーザー提供Tracker結果・本人プロフィールIDで確認。' });
  known.add(name);
  playerAdded++;
}
const category = tournaments.catalog.find(t => t.id === 'ch5s5-trios-cash');
if (!category) throw Error('S32 Trios Cash Cup missing from catalog');
if (category.mode === 'unknown') {
  category.mode = 'battle-royale';
  category.unknownFields = (category.unknownFields || []).filter(x => x !== 'mode');
  category.evidence.push({ text: '2024年11月17日および24日MEのTrios Cash Cup通常バトルロイヤル（S32_TriosCashCup）決勝をTrackerの固有イベントIDと提供画像で確認。ゼロビルドは別ID S32_TriosCashCup_ZB。', url: 'https://fortnitetracker.com/events/epicgames_S32_TriosCashCup_ME?window=S32_TriosCashCup_Event6Round2_ME' });
}
if (added.length) updates.entries.unshift({ id: 'manual-verified-2024-me-finals-20261111', date: '2026-11-11', type: 'records', title: 'ユーザー提供画像で検証：2024年ME Trios/Squads決勝7件', description: '2024-11-24/11-17 ME Trios Cash Cup決勝、2024-08-12 ME Squads Victory Cup決勝。全件Tracker順位・ポイント・試合・K・VRと本人IDを確認、Cash Cup順位賞金およびSquads 1VR=$100/人を別方式で記録。0VRで賞金なしの2組は$0。重複防止付きで登録。', recordIds: added });
write('results.json', results);
write('players.json', players);
write('tournaments.json', tournaments);
if (added.length) write('updates.json', updates);
console.log(JSON.stringify({ added, skipped, playerAdded, total: results.length, prizeAdded: manifest.entries.filter(x => added.includes('manual-' + (x.names.length === 3 ? 's32-me-trios' : 's30-me-squads') + '-final-' + x.date.replace(/-/g, '') + '-rank' + x.rank)).reduce((s, x) => s + x.prize, 0) }, null, 2));
