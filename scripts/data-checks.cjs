'use strict';
const fs = require('node:fs');
const path = require('node:path');
const regions = ['ME', 'EU', 'NAC', 'NAW', 'OCE', 'BR'];
const axes = ['series', 'mode', 'subtype', 'team', 'platform'];
const object = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const text = x => typeof x === 'string' && x.trim().length > 0 && x === x.trim();
const money = x => typeof x === 'number' && Number.isFinite(x) && x >= 0 && Number.isSafeInteger(Math.round(x * 100)) && Math.abs(x * 100 - Math.round(x * 100)) < 1e-6;
const roster = e => Array.isArray(e.players) && e.players.length ? e.players : [e.player];
const webURL = value => { try { const u = new URL(value); return ['https:', 'http:'].includes(u.protocol) && !u.username && !u.password ? u : null; } catch { return null; } };
function sourceInfo(record) {
  const u = webURL(record.source);
  if (!u || !['fortnite.com', 'www.fortnite.com', 'fortnitetracker.com', 'www.fortnitetracker.com'].includes(u.hostname)) return { seasonId: 'unknown', eventId: null, roundId: null };
  const parts = u.pathname.split('/');
  let eventId = parts.find(p => /^(?:epicgames_)?S\d+_/i.test(p))?.replace(/^epicgames_/i, '') || null;
  const eventRegion = eventId?.split('_').at(-1);
  if (regions.includes(eventRegion)) eventId = eventId.slice(0, -eventRegion.length - 1);
  const roundId = u.searchParams.get('window') || u.searchParams.get('round');
  const eventSeason = eventId?.match(/^S\d+/i)?.[0].toUpperCase();
  const roundSeason = roundId?.match(/^S\d+/i)?.[0].toUpperCase();
  return { eventId, roundId, seasonId: eventSeason || roundSeason || 'unknown', conflict: !!(eventSeason && roundSeason && eventSeason !== roundSeason), region: regions.includes(roundId?.split('_').at(-1)) ? roundId.split('_').at(-1) : regions.includes(eventRegion) ? eventRegion : null };
}
function seasonDefinitions(data) {
  const definitions = new Map();
  for (const row of [...(data.tournaments?.catalog || []), ...(data.results || [])]) {
    if (/^S\d+$/.test(row?.seasonId) && Number.isInteger(row.chapter) && row.chapter > 0 && Number.isInteger(row.season) && row.season > 0) definitions.set(row.seasonId, { chapter: row.chapter, season: row.season });
  }
  return definitions;
}
function seasonFor(record, data) {
  const source = sourceInfo(record), id = record.seasonId || source.seasonId;
  const definition = seasonDefinitions(data).get(id);
  if (!definition || source.conflict || (record.seasonId && source.seasonId !== 'unknown' && record.seasonId !== source.seasonId) || (record.chapter != null && record.chapter !== definition.chapter) || (record.season != null && record.season !== definition.season)) return 'unknown';
  return id;
}
function tournamentFor(record, data) {
  const source = sourceInfo(record), period = seasonFor(record, data);
  return data.tournaments.catalog.find(t => t.name === record.event && t.seasonId === period && t.sourceEventIds.includes(source.eventId)) || null;
}
function tournamentKey(record, data) {
  const known = tournamentFor(record, data);
  if (known) return known.id;
  const source = sourceInfo(record), period = seasonFor(record, data);
  return 'unconfirmed-' + encodeURIComponent([period === 'unknown' ? source.seasonId : period, record.event, source.eventId || record.id].join('|'));
}
// An independent test oracle. No aliases, display-name similarity, VR or cosmetic
// rewards participate in cash aggregation. Integer cents avoid rounding drift.
function personalCents(e) {
  if (e.verified !== true || !money(e.prize) || e.prize <= 0 || ['予選', 'コスメ大会'].includes(e.kind)) return 0;
  const people = roster(e);
  if (new Set(people).size !== people.length) return 0;
  const total = Math.round(e.prize * 100);
  if (people.length === 1) return total;
  const share = e.prizePerPlayer;
  return money(share) && share > 0 && Math.round(share * 100) * people.length <= total ? Math.round(share * 100) : 0;
}
function summarize(data, season = 'all') {
  const rows = data.results.filter(e => season === 'all' || seasonFor(e, data) === season);
  const amounts = new Map();
  for (const row of rows) {
    const cents = personalCents(row);
    if (!cents) continue;
    for (const name of roster(row)) {
      const value = amounts.get(name) || { name, cents: 0, events: 0 };
      value.cents += cents; value.events++; amounts.set(name, value);
    }
  }
  const ranking = [...amounts.values()].map(p => ({ name: p.name, total: p.cents / 100, events: p.events })).sort((a, b) => b.total - a.total || b.events - a.events || a.name.localeCompare(b.name, 'ja'));
  return { records: rows.length, players: new Set(rows.flatMap(roster)).size, regions: new Set(rows.map(e => e.region)).size, total: ranking.reduce((sum, p) => sum + Math.round(p.total * 100), 0) / 100, ranking };
}
function loadData(directory) {
  const data = {}, errors = [];
  for (const name of ['results', 'players', 'tournaments']) {
    try { data[name] = JSON.parse(fs.readFileSync(path.join(directory, name + '.json'), 'utf8')); }
    catch (error) { errors.push({ file: name + '.json', id: 'ファイル全体', field: 'JSON', message: `読み込み／構文エラー：${error.message}` }); }
  }
  return { data, errors };
}
function validateData(data) {
  const errors = [], warnings = [];
  const issue = (file, id, field, message, warning = false) => (warning ? warnings : errors).push({ file, id, field, message });
  const check = (ok, file, id, field, message) => { if (!ok) issue(file, id, field, message); };
  const r = data.results, p = data.players, t = data.tournaments;
  check(Array.isArray(r), 'results.json', 'ファイル全体', 'results', '戦績は配列で指定してください。');
  if (Array.isArray(r)) check(r.length > 0, 'results.json', 'ファイル全体', 'results', '戦績が空です。誤って空のファイルを上書きしていないか確認してください。');
  check(object(p) && Array.isArray(p.candidates) && object(p.confirmedAliases), 'players.json', 'ファイル全体', 'players', 'candidates配列とconfirmedAliasesオブジェクトが必要です。');
  check(object(t) && Array.isArray(t.axes) && Array.isArray(t.catalog), 'tournaments.json', 'ファイル全体', 'tournaments', 'axes配列とcatalog配列が必要です。');
  if (errors.length) return { errors, warnings };
  const identities = new Set(r.filter(object).flatMap(e => roster(e).filter(text)));
  const candidateNames = new Set(), optionSets = new Map(), catalogIds = new Set(), seasons = new Map();
  for (const [i, candidate] of p.candidates.entries()) {
    const name = candidate?.name || `候補#${i + 1}`;
    for (const field of ['name', 'initials', 'desc', 'accent']) check(text(candidate?.[field]), 'players.json', name, field, '空でない文字列が必要です（前後の空白は除いてください）。');
    check(!candidateNames.has(name), 'players.json', name, 'name', '選手名が重複しています。'); candidateNames.add(name); identities.add(name);
  }
  const aliasOwners = new Map();
  for (const [owner, aliases] of Object.entries(p.confirmedAliases)) {
    check(identities.has(owner), 'players.json', owner, 'confirmedAliases', '対応先の選手が名鑑にも戦績にも存在しません。');
    if (!Array.isArray(aliases)) { issue('players.json', owner, 'confirmedAliases', '別名義は配列で指定してください。'); continue; }
    const seen = new Set();
    for (const alias of aliases) {
      check(text(alias), 'players.json', owner, 'confirmedAliases', '別名義は空でない文字列にしてください。');
      check(!seen.has(alias), 'players.json', owner, 'confirmedAliases', `別名義「${alias}」が重複しています。`); seen.add(alias);
      check(alias === owner || !identities.has(alias), 'players.json', owner, 'confirmedAliases', `「${alias}」は別の掲載選手です。同名別人を別名義で統合しないでください。`);
      check(!aliasOwners.has(alias) || aliasOwners.get(alias) === owner, 'players.json', owner, 'confirmedAliases', `別名義「${alias}」が複数の選手へ対応しています。`); aliasOwners.set(alias, owner);
    }
  }
  for (const axis of t.axes) {
    if (!object(axis) || !axes.includes(axis.key) || !Array.isArray(axis.options)) { issue('tournaments.json', axis?.key || 'axes', 'axes', '5分類軸とoptions配列を確認してください。'); continue; }
    check(!optionSets.has(axis.key), 'tournaments.json', axis.key, 'axes', '分類軸が重複しています。');
    const ids = new Set();
    for (const option of axis.options) { check(text(option?.id) && text(option?.label) && !ids.has(option.id), 'tournaments.json', axis.key, 'options', 'タグID・ラベルの不足、またはタグIDの重複があります。'); ids.add(option?.id); }
    check(ids.has('unknown'), 'tournaments.json', axis.key, 'options', '未確認用のunknownタグが必要です。'); optionSets.set(axis.key, ids);
  }
  for (const axis of axes) check(optionSets.has(axis), 'tournaments.json', axis, 'axes', '必須の分類軸がありません。');
  const mappings = new Map();
  function registerSeason(row, file, id) {
    if (row.seasonId == null) return;
    check(/^S\d+$/.test(row.seasonId), file, id, 'seasonId', 'S42のような明示的な識別子が必要です。');
    if (row.chapter == null || row.season == null) return;
    check(Number.isInteger(row.chapter) && row.chapter > 0 && Number.isInteger(row.season) && row.season > 0, file, id, 'chapter/season', 'チャプター・シーズンは正の整数にしてください。');
    const key = JSON.stringify([row.chapter, row.season]);
    check(!seasons.has(row.seasonId) || seasons.get(row.seasonId) === key, file, id, 'seasonId', '同じシーズンIDに異なるチャプター・シーズンが対応しています。'); seasons.set(row.seasonId, key);
  }
  for (const [i, entry] of t.catalog.entries()) {
    const id = entry?.id || `大会#${i + 1}`;
    if (!object(entry)) { issue('tournaments.json', id, 'catalog', '大会はオブジェクトで指定してください。'); continue; }
    for (const field of ['id', 'name', 'seasonId']) check(text(entry[field]), 'tournaments.json', id, field, '必須の文字列がありません。');
    check(!catalogIds.has(id), 'tournaments.json', id, 'id', '大会IDが重複しています。'); catalogIds.add(id);
    registerSeason(entry, 'tournaments.json', id);
    check(Number.isInteger(entry.chapter) && entry.chapter > 0 && Number.isInteger(entry.season) && entry.season > 0, 'tournaments.json', id, 'chapter/season', '確認済みの正の整数が必要です。');
    for (const axis of axes) check(optionSets.get(axis)?.has(entry[axis]), 'tournaments.json', id, axis, `存在しないタグ「${entry[axis]}」を参照しています。`);
    if (!Array.isArray(entry.sourceEventIds) || !entry.sourceEventIds.length) issue('tournaments.json', id, 'sourceEventIds', '出典の大会識別子の配列が必要です。');
    else for (const source of entry.sourceEventIds) {
      check(text(source) && source.startsWith(entry.seasonId + '_'), 'tournaments.json', id, 'sourceEventIds', '出典大会IDとシーズンIDが一致しません。');
      const key = JSON.stringify([entry.seasonId, entry.name, source]); check(!mappings.has(key), 'tournaments.json', id, 'sourceEventIds', '同じ出典・大会名に複数の分類が対応しています。'); mappings.set(key, id);
    }
    if (entry.evidence != null) {
      check(Array.isArray(entry.evidence), 'tournaments.json', id, 'evidence', '確認根拠は配列にしてください。');
      if (Array.isArray(entry.evidence)) for (const evidence of entry.evidence) check(text(evidence?.text) && (!evidence.url || !!webURL(evidence.url)), 'tournaments.json', id, 'evidence', '確認根拠の文章・URLを確認してください。');
    }
  }
  for (const [i, row] of r.entries()) if (object(row)) registerSeason(row, 'results.json', row.id || `行#${i + 1}`);
  const ids = new Set(), accounts = new Map();
  for (const [i, row] of r.entries()) {
    const id = row?.id || `行#${i + 1}`;
    if (!object(row)) { issue('results.json', id, 'record', '戦績はオブジェクトで指定してください。'); continue; }
    for (const field of ['id', 'date', 'region', 'player', 'event', 'round', 'kind', 'source', 'note']) check(text(row[field]), 'results.json', id, field, '必須の空でない文字列がありません。');
    check(!ids.has(id), 'results.json', id, 'id', '戦績IDが重複しています。'); ids.add(id);
    check(/^\d{4}-\d{2}-\d{2}$/.test(row.date) && !Number.isNaN(Date.parse(row.date)) && new Date(row.date).toISOString().slice(0, 10) === row.date, 'results.json', id, 'date', '実在する日付をYYYY-MM-DD形式で指定してください。');
    check(regions.includes(row.region), 'results.json', id, 'region', '地域はME・EU・NAC・NAW・OCE・BRのいずれかです。');
    for (const field of ['rank', 'points', 'kills', 'vrs', 'prize']) {
      check(Object.hasOwn(row, field), 'results.json', id, field, '必須フィールドがありません。不明な値はnullにしてください。');
      if (row[field] === null) continue;
      check(field === 'prize' ? money(row[field]) : Number.isSafeInteger(row[field]) && row[field] >= (field === 'rank' ? 1 : 0), 'results.json', id, field, field === 'prize' ? '賞金は0以上・小数2桁以内の数値、またはnullにしてください。' : '0以上の整数（順位は1以上）、またはnullにしてください。');
    }
    check(typeof row.verified === 'boolean', 'results.json', id, 'verified', '確認済みフラグはtrue／falseで指定してください。');
    for (const flag of ['partial', 'reported']) if (row[flag] != null) check(typeof row[flag] === 'boolean', 'results.json', id, flag, 'フラグはtrue／falseで指定してください。');
    const people = roster(row);
    check(!Object.hasOwn(row, 'players') || Array.isArray(row.players) && row.players.length > 0, 'results.json', id, 'players', 'チームの選手名は空でない配列にしてください。');
    check(people.every(text) && new Set(people).size === people.length, 'results.json', id, 'players', 'チーム内の選手名が空、または重複しています。');
    if (Array.isArray(row.players)) check(row.player === people.join(' / '), 'results.json', id, 'player', '表示用の掲載名とplayersの選手・順序が一致しません。Tracker上の別表記はplayerRawに保存してください。');
    for (const name of people) check(!aliasOwners.has(name) || aliasOwners.get(name) === name, 'results.json', id, 'players', `別名義「${name}」ではなく確認済みの掲載名「${aliasOwners.get(name)}」を使用してください。`);
    if (row.prizePerPlayer != null) {
      check(money(row.prizePerPlayer), 'results.json', id, 'prizePerPlayer', '個人配分は0以上・小数2桁以内の数値にしてください。');
      check(money(row.prize) && Math.round(row.prizePerPlayer * 100) * people.length <= Math.round(row.prize * 100), 'results.json', id, 'prizePerPlayer', '個人配分の人数分がチーム賞金を超えています（チーム賞金の未設定も確認してください）。');
    }
    if (row.prize > 0 && row.verified === true && ['予選', 'コスメ大会'].includes(row.kind)) issue('results.json', id, 'prize', '予選VR・コスメ報酬を確認済み現金賞金へ設定しないでください。');
    if (row.prize > 0 && row.verified === true && people.length > 1 && !(row.prizePerPlayer > 0)) issue('results.json', id, 'prizePerPlayer', '個人配分が未確認のため、個人賞金には加算しません。', true);
    const source = sourceInfo(row);
    check(!!webURL(row.source), 'results.json', id, 'source', '出典は認証情報を含まないhttp／https URLにしてください。');
    check(!source.conflict, 'results.json', id, 'source', '出典の大会IDとラウンドIDのシーズンが矛盾しています。');
    check(!source.region || source.region === row.region, 'results.json', id, 'region', '出典の明示的な開催地域と登録地域が一致しません。汎用regionクエリは判定に使用していません。');
    check(!row.seasonId || source.seasonId === 'unknown' || source.seasonId === row.seasonId, 'results.json', id, 'seasonId', '出典と明示したシーズンIDが一致しません。');
    if (row.tournamentId != null) {
      const referenced = t.catalog.find(c => c?.id === row.tournamentId);
      check(catalogIds.has(row.tournamentId), 'results.json', id, 'tournamentId', '存在しない大会IDを参照しています。');
      if (referenced) check(referenced.name === row.event && referenced.seasonId === (row.seasonId || source.seasonId) && Array.isArray(referenced.sourceEventIds) && referenced.sourceEventIds.includes(source.eventId), 'results.json', id, 'tournamentId', '参照した大会の名前・シーズン・出典IDが戦績と一致しません。');
    }
    if (source.seasonId !== 'unknown' && !seasons.has(row.seasonId || source.seasonId)) issue('results.json', id, 'seasonId', 'チャプター・シーズンの対応が未確認です。特定シーズンへ推測で分類しません。', true);
    const catalog = t.catalog.find(c => object(c) && c.name === row.event && c.seasonId === (row.seasonId || source.seasonId) && Array.isArray(c.sourceEventIds) && c.sourceEventIds.includes(source.eventId));
    if (!catalog) issue('results.json', id, 'event', '一致する大会カタログがないためタグは未確認です。必要なら根拠を確認してカタログを追加してください。', true);
    else if (catalog.team === 'duo') check(people.length === 2, 'results.json', id, 'players', 'デュオ大会の選手は2名で指定してください。');
    else if (catalog.team === 'solo') check(people.length === 1, 'results.json', id, 'players', 'ソロ大会の選手は1名で指定してください。');
    for (const axis of axes) if (row[axis] != null) check(optionSets.get(axis)?.has(row[axis]) && (!catalog || row[axis] === catalog[axis]), 'results.json', id, axis, 'タグが存在しないか、大会カタログと一致しません。');
    const links = [...(row.profileUrl != null ? [{ name: people[0], url: row.profileUrl }] : []), ...(Array.isArray(row.profiles) ? row.profiles : [])];
    if (row.profiles != null) check(Array.isArray(row.profiles), 'results.json', id, 'profiles', 'プロフィールは配列にしてください。');
    for (const link of links) {
      const url = webURL(link?.url), named = aliasOwners.get(link?.name) || link?.name;
      const owner = people.length === 1 && link?.name === row.playerRaw ? people[0] : named;
      check(!!url && people.includes(owner), 'results.json', id, 'profiles', 'プロフィールURLまたは選手との対応関係が不正です。');
      const account = ['fortnitetracker.com', 'www.fortnitetracker.com'].includes(url?.hostname) && url.pathname.startsWith('/profile/') ? url.searchParams.get('id')?.toLowerCase() : null;
      if (account) { check(!accounts.has(account) || accounts.get(account) === owner, 'results.json', id, 'profiles', `同じTrackerアカウントIDが別の掲載選手「${accounts.get(account)}」と重複しています。人間が対応関係を確認してください。`); accounts.set(account, owner); }
    }
  }
  return { errors, warnings };
}
module.exports = { regions, axes, roster, sourceInfo, seasonFor, tournamentFor, tournamentKey, personalCents, summarize, loadData, validateData };
