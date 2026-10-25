'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { buildRankings, sanitizeFilters, METRICS, MODES, FINAL_KINDS } = require('../rankings.js');
const { loadData, summarize, seasonFor } = require('../scripts/data-checks.cjs');

const directory = path.join(__dirname, '..');
const published = loadData(directory).data;
// Use the production money, identity and tournament helpers, not copies of their
// implementation. The pure ranking module receives these same helpers in app.js.
const source = fs.readFileSync(path.join(directory, 'app.js'), 'utf8');
const prefixStart = source.indexOf('    // CH7S4');
const prefixEnd = source.indexOf('    function selectedSeasonPlayers');
assert.ok(prefixStart >= 0 && prefixEnd > prefixStart, 'Production helper boundary changed');
const categories = [
  ['br', 'battle-royale', 'victory-cup', 'solo-victory-cup'],
  ['zb', 'zero-build', 'victory-cup', 'console-solo-victory-cup'],
  ['reload', 'reload', 'victory-cup', 'solo-reload-victory-cup'],
  ['reload-zb', 'reload-zero-build', 'cash-cup', 'reload-zb-duos-cash-cup'],
  ['practice', 'battle-royale', 'fncs', 'fncs-division-1-practice'],
  ['performance', 'battle-royale', 'performance-evaluation', 'performance-evaluation'],
  ['skin', 'battle-royale', 'skin-cup', 'champion-aphrodite-fncs-cup-battle-royale']
].map(([key, mode, series, subtype]) => ({
  id: 'ranking-fixture-' + key, name: 'Ranking fixture ' + key,
  chapter: 7, season: 4, seasonId: 'S42', sourceEventIds: ['S42_RankingFixture_' + key],
  mode, series, subtype, team: key === 'reload-zb' ? 'duo' : 'solo', platform: 'cross-platform'
}));
const fixtureData = {
  results: [], players: { candidates: [], confirmedAliases: {} },
  tournaments: { axes: published.tournaments.axes, catalog: categories }
};
function productionHelpers(data) {
  const context = vm.createContext({ URL, URLSearchParams, siteData: data });
  vm.runInContext(source.slice(prefixStart, prefixEnd) +
    '\nglobalThis.rankingHelpers = { names, individualPrize, classifyTournamentRecord, confirmedPrizeFinalRank, confirmedSkinReward };',
  context, { timeout: 5000 });
  return { ...context.rankingHelpers, series: data.tournaments.axes.find(axis => axis.key === 'series').options.map(option => option.id) };
}
const helpers = () => productionHelpers(fixtureData);
function record(id, fields = {}, category = 'br') {
  return {
    id, date: '2026-10-01', region: 'ME', player: 'Alpha',
    event: 'Ranking fixture ' + category,
    source: 'https://fortnitetracker.com/events/epicgames_S42_RankingFixture_' + category + '_ME?window=S42_RankingFixture_' + id + '_Round2_ME',
    chapter: 7, season: 4, seasonId: 'S42', round: 'Event 1 · Round 2 / 賞金決勝',
    kind: '賞金決勝', rank: 10, points: 100, kills: 5, vrs: 1,
    prize: 100, verified: true, note: 'Ranking regression fixture', ...fields
  };
}
const build = (records, filters = {}, overrides = {}) => buildRankings(records, filters, { ...helpers(), ...overrides });
const values = report => Object.fromEntries(report.rows.map(row => [row.name, row.value]));

test('8種類の実績と4形式を定義し、不正なURL条件を既存の選択肢へ正規化する', () => {
  assert.deepEqual(METRICS.map(metric => metric.id).sort(), ['prize', 'prizeCount', 'finals', 'wins', 'podiums', 'vrs', 'regions', 'skins'].sort());
  assert.deepEqual([...MODES].sort(), ['battle-royale', 'zero-build', 'reload', 'reload-zero-build'].sort());
  assert.deepEqual([...FINAL_KINDS].sort(), ['賞金決勝', 'Practice決勝', 'Performance決勝', '決勝'].sort());
  const normalized = sanitizeFilters({ metric: 'evil', region: 'ASIA', mode: 'unknown', series: 'unregistered', finalKind: '予選' }, { series: ['victory-cup'] });
  assert.deepEqual(normalized, { metric: 'prize', region: 'all', mode: 'all', series: 'all', finalKind: 'all' });
});

test('開催地域6地域を独立に絞り込み、国籍やプロフィール文字列から判定しない', () => {
  const regions = ['ME', 'EU', 'NAC', 'NAW', 'OCE', 'BR'];
  const rows = regions.map((region, index) => record(region, { region, player: 'Japan ' + region, prize: (index + 1) * 100 }));
  for (const [index, region] of regions.entries()) {
    const report = build(rows, { region });
    assert.deepEqual(values(report), { ['Japan ' + region]: (index + 1) * 100 });
    assert.equal(report.recordCount, 1);
    assert.equal(report.totalPrize, (index + 1) * 100);
  }
  assert.equal(build(rows).recordCount, 6);
});

test('通常BR・ZB・Reload・Reload ZBを混同せず、未確認形式は全形式だけに含める', () => {
  const inputs = ['br', 'zb', 'reload', 'reload-zb'].map((category, index) => record(category, { player: category, prize: (index + 1) * 100 }, category));
  const unknown = record('unknown-mode', { player: 'Unknown', event: 'Unknown tournament', prize: 50 });
  inputs.push(unknown);
  for (const [category, mode] of [['br', 'battle-royale'], ['zb', 'zero-build'], ['reload', 'reload'], ['reload-zb', 'reload-zero-build']]) {
    assert.deepEqual(build(inputs, { mode }).rows.map(row => row.name), [category]);
  }
  assert.equal(build(inputs).rows.length, 5);
  assert.equal(build(inputs, { mode: 'zero-build' }).recordCount, 1);
});

test('大会シリーズ・開催地域・形式はANDで絞り込む', () => {
  const inputs = [record('victory'), record('practice', { player: 'Practice', prize: 0, kind: 'Practice決勝' }, 'practice'),
    record('cash', { player: 'Cash', region: 'NAW', prize: 200 }, 'reload-zb')];
  assert.deepEqual(values(build(inputs, { series: 'cash-cup', region: 'NAW', mode: 'reload-zero-build' })), { Cash: 200 });
  assert.deepEqual(build(inputs, { series: 'cash-cup', region: 'ME' }).rows, []);
});

test('既存のindividualPrizeを呼び出して集計し、別の賞金計算を内蔵しない', () => {
  let calls = 0;
  const report = build([record('shared-helper')], {}, { individualPrize: () => { calls++; return 17.23; } });
  assert.ok(calls > 0);
  assert.equal(report.rows[0].value, 17.23);
  assert.equal(report.totalPrize, 17.23);
});

test('デュオのチーム賞金を二重計上せず、確認済み個人分を各選手へ付与する', () => {
  const duo = record('duo', { player: 'Alpha / Beta', players: ['Alpha', 'Beta'], prize: 400, prizePerPlayer: 200 });
  assert.deepEqual(values(build([duo])), { Alpha: 200, Beta: 200 });
  assert.equal(build([duo]).totalPrize, 400);
  assert.deepEqual(values(build([duo], { metric: 'prizeCount' })), { Alpha: 1, Beta: 1 });
  for (const prizePerPlayer of [null, 0, 300, NaN, Infinity]) {
    assert.deepEqual(build([{ ...duo, prizePerPlayer }]).rows, []);
  }
});

test('予選・スキン・コスメ・未確認現金は賞金額と賞金獲得回数の対象外', () => {
  const excluded = [record('qualifier', { kind: '予選', prize: 9999, vrs: 10 }),
    record('skin', { kind: 'スキン大会', round: 'スキン獲得', prize: 9999 }, 'skin'),
    record('cosmetic', { kind: 'コスメ大会', round: 'スキン獲得', prize: 9999 }, 'skin'),
    record('unverified', { verified: false, prize: 9999 }), record('unknown-prize', { prize: null }), record('zero-prize', { prize: 0 })];
  for (const metric of ['prize', 'prizeCount']) {
    assert.deepEqual(build(excluded, { metric }).rows, []);
    assert.equal(build(excluded, { metric }).totalPrize, 0);
  }
});

test('決勝出場は掲載済みの実戦績を数え、賞金・Practice・Performance・その他を分離する', () => {
  const inputs = [record('cash-final', { prize: 0 }),
    record('practice-final', { kind: 'Practice決勝', prize: 0 }, 'practice'),
    record('performance-final', { kind: 'Performance決勝', prize: 0 }, 'performance'),
    record('other-final', { kind: '決勝', prize: null }),
    record('qualifying', { kind: '予選', round: '予選突破', prize: null }),
    record('reported', { reported: true, verified: false, rank: null, points: null, kills: null, vrs: null, prize: null }),
    record('partial', { partial: true, prize: null }), record('no-final-stats', { rank: null, points: null, kills: null, vrs: null, prize: null })];
  const report = build(inputs, { metric: 'finals' });
  assert.deepEqual(values(report), { Alpha: 4 });
  assert.deepEqual(report.rows[0].finalKinds, { '賞金決勝': 1, 'Practice決勝': 1, 'Performance決勝': 1, '決勝': 1 });
  for (const finalKind of FINAL_KINDS) assert.deepEqual(values(build(inputs, { metric: 'finals', finalKind })), { Alpha: 1 });
});

test('最終順位未確認を除外し、総合優勝・TOP3と試合単位のVRを混同しない', () => {
  const inputs = [record('winner', { player: 'Winner', rank: 1, vrs: 0 }),
    record('second', { player: 'Second', rank: 2, vrs: 0 }), record('third', { player: 'Third', rank: 3, vrs: 0 }),
    record('fourth', { player: 'Fourth', rank: 4, vrs: 10 }), record('null', { player: 'Null', rank: null, vrs: 5 }),
    record('qualifier-win', { player: 'Qual', kind: '予選', rank: 1, vrs: 8 }),
    record('practice-win', { player: 'Practice', kind: 'Practice決勝', rank: 1, prize: 0 }, 'practice'),
    record('skin-win', { player: 'Skin', kind: 'スキン大会', rank: 1, prize: 0 }, 'skin'),
    record('reported-win', { player: 'Reported', verified: false, rank: 1 })];
  assert.deepEqual(values(build(inputs, { metric: 'wins' })), { Winner: 1 });
  assert.deepEqual(values(build(inputs, { metric: 'podiums' })), { Second: 1, Third: 1, Winner: 1 });
});

test('不正な総合順位は優勝・TOP3へ補完せず、Practiceの誤った賞金決勝表記も転用しない', () => {
  const inputs = [null, undefined, 0, -1, 1.5, '1', NaN, Infinity].map((rank, index) => record('bad-rank-' + index, { rank, prize: null }));
  inputs.push(record('mislabelled-practice', { rank: 1, kind: '賞金決勝', prize: 0 }, 'practice'));
  inputs.push(record('mislabelled-skin', { rank: 1, kind: '賞金決勝', prize: 0 }, 'skin'));
  for (const metric of ['wins', 'podiums']) assert.deepEqual(build(inputs, { metric }).rows, []);
});

test('海外VRは確認済みの予選・決勝を合計し、デュオはチームVRとして各選手へ付与する', () => {
  const inputs = [record('solo-vr', { kind: '予選', player: 'Alpha', prize: null, vrs: 2 }),
    record('duo-vr', { player: 'Alpha / Beta', players: ['Alpha', 'Beta'], prize: 0, vrs: 3 })];
  const report = build(inputs, { metric: 'vrs' });
  assert.deepEqual(values(report), { Alpha: 5, Beta: 3 });
  assert.equal(report.rows.find(row => row.name === 'Alpha').teamRecords, 1);
  assert.equal(report.rows.find(row => row.name === 'Beta').teamRecords, 1);
});

test('VRの未確認・null・不正値を0と断定せず、確認済み0VRとは表示用データを分ける', () => {
  const inputs = [record('known-zero', { player: 'Zero', vrs: 0 }),
    record('unknown-null', { player: 'Unknown', vrs: null }), record('unknown-unverified', { player: 'Unknown', verified: false, vrs: 7 }),
    record('mixed-known', { player: 'Mixed', vrs: 2 }), record('mixed-missing', { player: 'Mixed', vrs: null }),
    ...[-1, 1.5, '4', NaN, Infinity].map((vrs, i) => record('invalid-vr-' + i, { player: 'Invalid', vrs }))];
  const report = build(inputs, { metric: 'vrs' });
  assert.deepEqual(values(report), { Mixed: 2, Zero: 0 });
  assert.equal(report.rows.find(row => row.name === 'Mixed').unknownRecords, 1);
  for (const name of ['Unknown', 'Invalid']) {
    const row = report.unranked.find(row => row.name === name);
    assert.equal(row.value, null);
    assert.equal(row.rank, null);
    assert.ok(row.unknownRecords > 0);
  }
});

test('遠征地域数は異なる開催サーバー数を数え、同一地域の反復は加算しない', () => {
  const inputs = [record('ME1'), record('ME2'), record('EU', { region: 'EU' }), record('NAW', { region: 'NAW' }),
    record('not-overseas', { region: 'ASIA' })];
  assert.deepEqual(values(build(inputs, { metric: 'regions' })), { Alpha: 3 });
  const scoped = build(inputs, { metric: 'regions', region: 'ME' });
  assert.ok(scoped.filters.metric !== 'regions' || scoped.filters.region === 'all', 'Region-count ranking cannot be a misleading one-region comparison');
});

test('スキン獲得は明示的な確認済み報酬のみで、旧コスメ表記にも対応する', () => {
  const inputs = [record('skin-earned', { kind: 'スキン大会', round: 'Session 1 / スキン獲得', prize: 0 }, 'skin'),
    record('old-cosmetic-earned', { kind: 'コスメ大会', round: 'Session 1 / スキン報酬獲得済み', prize: 0 }, 'skin'),
    record('skin-participation', { kind: 'スキン大会', round: 'Session 1', prize: 0 }, 'skin'),
    record('skin-unverified', { kind: 'スキン大会', round: 'スキン獲得', verified: false, prize: 0 }, 'skin'),
    ...['スキン獲得対象外', 'スキン未獲得', 'スキン獲得未確認', 'スキン獲得条件'].map((round, i) => record('skin-condition-' + i, { kind: 'スキン大会', round, prize: 0 }, 'skin'))];
  assert.deepEqual(values(build(inputs, { metric: 'skins' })), { Alpha: 2 });
  assert.equal(build(inputs).totalPrize, 0);
});

test('同値は値だけを基準に競技順位1位・1位・3位とし、金額同値を回数で別順位にしない', () => {
  const inputs = [record('alpha1', { player: 'Alpha', prize: 50 }), record('alpha2', { player: 'Alpha', prize: 50 }),
    record('beta', { player: 'Beta', prize: 100 }), record('gamma', { player: 'Gamma', prize: 50 })];
  const report = build(inputs);
  assert.deepEqual(report.rows.map(row => [row.name, row.value, row.rank]), [['Alpha', 100, 1], ['Beta', 100, 1], ['Gamma', 50, 3]]);
  const counts = build(inputs, { metric: 'prizeCount' });
  assert.deepEqual(counts.rows.map(row => [row.value, row.rank]), [[2, 1], [1, 2], [1, 2]]);
});

test('掲載名の完全一致を維持し、p1ngとRGN p1ngやTracker表示名から別人を統合しない', () => {
  const inputs = [record('p1ng', { player: 'p1ng', playerRaw: 'RGN p1ng', prize: 100 }),
    record('rgn', { player: 'RGN p1ng', prize: 200 }), record('miru', { player: 'miru', playerRaw: 'ᵗᶻᵈ 否定から入ります〆', prize: 300 })];
  assert.deepEqual(values(build(inputs)), { miru: 300, 'RGN p1ng': 200, p1ng: 100 });
});

test('同じ戦績IDの重複を1回に制限し、ID衝突で内容が異なる場合は全コピーを保留する', () => {
  const original = record('same-id');
  const exact = build([original, structuredClone(original)]);
  assert.deepEqual(values(exact), { Alpha: 100 });
  assert.equal(exact.duplicateCount, 1);
  const conflict = build([original, { ...original, prize: 200 }]);
  assert.deepEqual(conflict.rows, []);
  assert.equal(conflict.conflictingDuplicateCount, 1);
});

test('明示された同一ラウンド・同一結果だけを重複除外し、異なる予選・決勝・セッションは維持する', () => {
  const original = record('semantic-original');
  const duplicate = { ...original, id: 'semantic-copy' };
  assert.equal(build([original, duplicate]).rows[0].value, 100);
  const otherSession = record('other-session', { round: 'Event 2 · Round 2 / 賞金決勝' });
  const qualifying = record('qualifier', { kind: '予選', prize: null, round: 'Event 1 · Round 1 / 予選' });
  assert.equal(build([original, otherSession, qualifying]).recordCount, 3);
  assert.equal(build([original, otherSession, qualifying]).rows[0].value, 200);
  const withoutRound = record('unknown-round', { source: original.source.split('?')[0] });
  assert.equal(build([withoutRound, { ...withoutRound, id: 'another-unknown-session' }]).rows[0].value, 200);
  const untrusted = record('untrusted-round', { source: original.source.replace('fortnitetracker.com', 'example.com') });
  assert.equal(build([untrusted, { ...untrusted, id: 'untrusted-copy' }]).rows[0].value, 200);
});

test('入力データを変更せず、全てのランキングで空配列を安全に表示用集計へ変換する', () => {
  const inputs = [record('frozen')];
  const before = structuredClone(inputs);
  for (const metric of METRICS.map(item => item.id)) {
    const empty = build([], { metric });
    assert.deepEqual(empty.rows, []);
    assert.deepEqual(empty.unranked, []);
    assert.equal(empty.totalPrize, 0);
    assert.equal(empty.recordCount, 0);
    build(inputs, { metric });
  }
  assert.deepEqual(inputs, before);
});

test('実データの全期間と各シーズンで既存賞金ランキングの個人額・件数・並び順と一致する', () => {
  const helpers = productionHelpers(published);
  const before = JSON.stringify(published);
  const seasons = ['all', ...new Set(published.results.map(row => seasonFor(row, published)))];
  for (const season of seasons) {
    const records = published.results.filter(row => season === 'all' || seasonFor(row, published) === season);
    const report = buildRankings(records, { metric: 'prize' }, helpers);
    const old = summarize(published, season);
    assert.deepEqual(report.rows.map(row => ({ name: row.name, total: row.value, events: row.prizeEvents })), old.ranking, season);
    assert.equal(report.totalPrize, old.total, season);
    assert.equal(report.recordCount, records.length, season);
  }
  assert.equal(JSON.stringify(published), before, 'Published JSON data must remain unchanged');
});
