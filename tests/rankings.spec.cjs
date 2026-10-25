'use strict';
const { test, expect } = require('@playwright/test');
const path = require('node:path');
const { loadData, roster, personalCents, seasonFor, tournamentFor } = require('../scripts/data-checks.cjs');
const data = loadData(path.join(__dirname, '..')).data;
const regions = ['ME', 'EU', 'NAC', 'NAW', 'OCE', 'BR'];
const modes = ['battle-royale', 'zero-build', 'reload', 'reload-zero-build'];
const money = value => '$' + value.toLocaleString('ja-JP');

// This suite deliberately does not waive or replace the separate data validator.
// Its independent oracles also let ranking behavior be checked when an unrelated
// source-profile mapping in the published JSON still needs human correction.
function cashRanking(records) {
  const totals = new Map();
  for (const record of records) {
    const amount = personalCents(record) / 100;
    if (!amount) continue;
    for (const name of new Set(roster(record))) {
      const item = totals.get(name) || { name, value: 0, events: 0 };
      item.value += amount; item.events++;
      totals.set(name, item);
    }
  }
  const rows = [...totals.values()].sort((a, b) => b.value - a.value || b.events - a.events || a.name.localeCompare(b.name, 'ja'));
  return rows.map((row, index) => ({ name: row.name, value: row.value, rank: rows.filter(other => other.value > row.value).length + 1 }));
}
const rankingRows = page => page.locator('#player-earnings-leaders [data-ranking-player]').evaluateAll(elements => elements.map(element => ({
  name: element.dataset.rankingPlayer,
  value: Number(element.dataset.rankingValue),
  rank: Number(element.dataset.rankingRank)
})));
async function revealAll(page) {
  while (await page.locator('#ranking-more').isVisible()) await page.locator('#ranking-more').click();
}
async function openRankings(page, query = '', season = 'all') {
  await page.goto('/?season=' + season + '#players' + (query ? '?' + query : ''));
  await expect(page.locator('#ranking-metric')).toBeVisible();
}
async function expectCash(page, records) {
  const expected = cashRanking(records);
  await expect(page.locator('#player-earnings-sum')).toHaveText(money(expected.reduce((sum, row) => sum + row.value, 0)));
  await revealAll(page);
  expect(await rankingRows(page)).toEqual(expected);
}
const catalogFor = (mode, series = 'victory-cup') => data.tournaments.catalog.find(item => item.seasonId === 'S42' && item.mode === mode && item.series === series);
const br = catalogFor('battle-royale');
const zb = catalogFor('zero-build');
const reload = data.tournaments.catalog.find(item => item.seasonId === 'S42' && item.subtype === 'solo-reload-victory-cup');
const reloadZB = catalogFor('reload-zero-build', 'cash-cup');
const practice = data.tournaments.catalog.find(item => item.seasonId === 'S42' && item.subtype === 'fncs-division-1-practice');
const performance = data.tournaments.catalog.find(item => item.seasonId === 'S42' && item.series === 'performance-evaluation');
const skin = data.tournaments.catalog.find(item => item.seasonId === 'S42' && item.series === 'skin-cup');
const unknownMode = { ...br, id: 'fixture-ranking-unknown-mode', name: 'ランキング形式未確認大会', mode: 'unknown', sourceEventIds: ['S42_RankingUnknownMode'] };
const past = { ...br, id: 'fixture-ranking-past-season', name: '過去シーズンのランキング検証大会', seasonId: 'S41', season: 3, sourceEventIds: ['S41_RankingPast'] };
function record(id, fields = {}) {
  const { catalog = br, ...overrides } = fields;
  const region = overrides.region || 'ME';
  const row = {
    id, date: catalog.seasonId === 'S41' ? '2026-08-01' : '2026-09-01', region,
    player: 'Ranking A', event: catalog.name, chapter: catalog.chapter, season: catalog.season, seasonId: catalog.seasonId,
    kind: '賞金決勝', round: 'Event 1 · Round 2 / 賞金決勝', rank: 10, points: 100, kills: 2, vrs: 0,
    prize: 0, verified: true, note: 'ランキングのブラウザーテスト専用。公開データには保存しません。',
    source: 'https://fortnitetracker.com/events/epicgames_' + catalog.sourceEventIds[0] + '_' + region + '?window=' + catalog.seasonId + '_RankingFixture_' + id + '_Round2_' + region,
    ...overrides
  };
  if (row.players) row.player = row.players.join(' / ');
  return row;
}
async function fixture(page, records) {
  for (const [filename, value] of Object.entries({
    'results.json': records,
    'players.json': { candidates: [], confirmedAliases: {} },
    'tournaments.json': { ...data.tournaments, catalog: [...data.tournaments.catalog, unknownMode, past] }
  })) await page.route('**/' + filename, route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(value) }));
}

test('既存の個人賞金ランキングと全地域・地域別の独立集計が一致する', async ({ page }) => {
  await openRankings(page);
  await expectCash(page, data.results);
  for (const region of regions) {
    await page.locator('[data-ranking-region="' + region + '"]').click();
    await expect(page.locator('[data-ranking-region="' + region + '"]')).toHaveAttribute('aria-pressed', 'true');
    await expectCash(page, data.results.filter(row => row.region === region));
    await expect(page.locator('#ranking-scope')).toContainText(region);
  }
  await page.locator('[data-ranking-region="all"]').click();
  await expectCash(page, data.results);
});

test('シーズン・4形式・大会シリーズが組み合わさり、未確認形式は全形式だけに含まれる', async ({ page }) => {
  await openRankings(page);
  for (const season of ['S42', 'S41', 'all']) {
    await page.locator('#season-select').selectOption(season);
    const selected = data.results.filter(row => season === 'all' || seasonFor(row, data) === season);
    await expectCash(page, selected);
  }
  for (const mode of modes) {
    await page.locator('#ranking-mode').selectOption(mode);
    await expectCash(page, data.results.filter(row => tournamentFor(row, data)?.mode === mode));
    await expect(page.locator('#ranking-mode')).toHaveValue(mode);
  }
  await page.locator('#ranking-mode').selectOption('all');
  for (const series of ['victory-cup', 'cash-cup', 'fncs']) {
    await page.locator('#ranking-series').selectOption(series);
    await expectCash(page, data.results.filter(row => tournamentFor(row, data)?.series === series));
  }
  await page.locator('#ranking-series').selectOption('all');
  await expectCash(page, data.results);
});

test('デュオは個人配分で1位・1位・3位となり、プロフィール往復と共有URLで条件を復元する', async ({ page }) => {
  const list = [
    record('duo-ab', { catalog: reloadZB, players: ['Ranking A', 'Ranking B'], prize: 400, prizePerPlayer: 200, rank: 3, vrs: 2 }),
    record('duo-cd', { catalog: reloadZB, players: ['Ranking C', 'Ranking D'], prize: 200, prizePerPlayer: 100, rank: 10 }),
    record('other-region', { catalog: reloadZB, region: 'EU', players: ['Ranking A', 'Ranking B'], prize: 1000, prizePerPlayer: 500 }),
    record('other-mode', { player: 'Ranking C', prize: 1000 }),
    record('unknown-mode', { catalog: unknownMode, player: 'Ranking C', prize: 3000 }),
    record('unknown-share', { catalog: reloadZB, players: ['Ranking E', 'Ranking F'], prize: 10000, prizePerPlayer: null }),
    record('unverified', { catalog: reloadZB, player: 'Ranking U', prize: 10000, verified: false }),
    record('cosmetic', { catalog: reloadZB, player: 'Ranking S', prize: 10000, kind: 'スキン大会', round: 'スキン獲得' })
  ];
  await fixture(page, list);
  const query = 'metric=prize&region=ME&mode=reload-zero-build&series=cash-cup';
  await openRankings(page, query);
  expect(await rankingRows(page)).toEqual([
    { name: 'Ranking A', value: 200, rank: 1 }, { name: 'Ranking B', value: 200, rank: 1 },
    { name: 'Ranking C', value: 100, rank: 3 }, { name: 'Ranking D', value: 100, rank: 3 }
  ]);
  await expect(page.locator('#player-earnings-sum')).toHaveText('$600');
  const url = page.url();
  await page.locator('[data-ranking-player="Ranking A"]').click();
  await expect(page.locator('#profile-title')).toHaveText('Ranking A');
  await page.locator('#profile-back').click();
  await expect(page).toHaveURL(url);
  await expect(page.locator('#ranking-mode')).toHaveValue('reload-zero-build');
  await expect(page.locator('#ranking-series')).toHaveValue('cash-cup');
  await page.reload();
  await expect(page.locator('[data-ranking-region="ME"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#player-earnings-sum')).toHaveText('$600');
  await page.locator('[data-ranking-region="EU"]').press('Enter');
  await expect(page.locator('[data-ranking-region="EU"]')).toHaveAttribute('aria-pressed', 'true');
});

test('賞金決勝・Practice・Performance・その他の決勝を分け、予選VRを総合優勝へ転用しない', async ({ page }) => {
  const list = [
    record('winner', { player: 'Winner', rank: 1, prize: 100, vrs: 0 }),
    record('runnerup', { player: 'Runner Up', rank: 2, prize: 100, vrs: 1 }),
    record('third', { player: 'Third', rank: 3, prize: 100, vrs: 0 }),
    record('qualifying', { player: 'Qualifier', kind: '予選', rank: 1, prize: 9999, vrs: 10 }),
    record('practice', { catalog: practice, player: 'Practice Player', kind: 'Practice決勝', rank: 1, vrs: 3 }),
    record('performance', { catalog: performance, player: 'Performance Player', kind: 'Performance決勝', rank: 1, vrs: 2 }),
    record('generic-final', { player: 'Generic Final Player', kind: '決勝', rank: 1, vrs: 4 }),
    record('reported-only', { player: 'Reported Only', reported: true, rank: null, points: null, kills: null, vrs: null }),
    record('unverified-final', { player: 'Unverified Final', verified: false, rank: 1, vrs: 50 }),
    record('unknown-rank', { player: 'Unknown Rank', rank: null, points: 5, kills: null, vrs: null })
  ];
  await fixture(page, list);
  await openRankings(page, 'metric=wins');
  expect(await rankingRows(page)).toEqual([{ name: 'Winner', value: 1, rank: 1 }]);
  await page.locator('#ranking-metric').selectOption('podiums');
  expect((await rankingRows(page)).map(row => row.name).sort()).toEqual(['Runner Up', 'Third', 'Winner'].sort());
  await page.locator('#ranking-metric').selectOption('finals');
  const expected = ['Generic Final Player', 'Performance Player', 'Practice Player', 'Runner Up', 'Third', 'Unknown Rank', 'Winner'];
  expect((await rankingRows(page)).map(row => row.name).sort()).toEqual(expected.sort());
  await expect(page.locator('#ranking-title')).toContainText('掲載済み決勝出場記録');
  for (const [kind, names] of [
    ['賞金決勝', ['Runner Up', 'Third', 'Unknown Rank', 'Winner']],
    ['Practice決勝', ['Practice Player']], ['Performance決勝', ['Performance Player']], ['決勝', ['Generic Final Player']]
  ]) {
    await page.locator('#ranking-final-kind').selectOption(kind);
    expect((await rankingRows(page)).map(row => row.name).sort()).toEqual(names.sort());
  }
  await page.locator('#ranking-metric').selectOption('prizeCount');
  expect((await rankingRows(page)).map(row => row.name).sort()).toEqual(['Runner Up', 'Third', 'Winner'].sort());
});

test('確認済みVRの0と未確認を区別し、デュオのチームVRとして表示する', async ({ page }) => {
  const list = [
    record('known-zero', { player: 'Known Zero', kind: '予選', vrs: 0 }),
    record('unknown-only', { player: 'Unknown Only', kind: '予選', vrs: null }),
    record('team-vr', { catalog: reloadZB, players: ['Team A', 'Team B'], kind: '予選', vrs: 4 }),
    record('mixed-known', { player: 'Mixed Player', kind: '予選', vrs: 2 }),
    record('mixed-unknown', { player: 'Mixed Player', kind: '予選', vrs: null }),
    record('unverified-vr', { player: 'Unverified VR', kind: '予選', vrs: 99, verified: false })
  ];
  await fixture(page, list);
  await openRankings(page, 'metric=vrs');
  const shown = await rankingRows(page);
  expect(shown.find(row => row.name === 'Known Zero')).toEqual({ name: 'Known Zero', value: 0, rank: 4 });
  expect(shown.find(row => row.name === 'Mixed Player')).toEqual({ name: 'Mixed Player', value: 2, rank: 3 });
  for (const name of ['Team A', 'Team B']) expect(shown.find(row => row.name === name)).toEqual({ name, value: 4, rank: 1 });
  expect(shown.some(row => ['Unknown Only', 'Unverified VR'].includes(row.name))).toBe(false);
  await page.locator('#ranking-unknown summary').click();
  await expect(page.locator('[data-ranking-unknown-player="Unknown Only"]')).toBeVisible();
  await expect(page.locator('#ranking-unknown')).toContainText('未確認');
  await expect(page.locator('[data-ranking-player="Mixed Player"]')).toContainText('未確認');
  await expect(page.locator('#page-players')).toContainText('チーム');
  await expect(page.locator('#page-players')).toContainText('予選');
});

test('スキン報酬の獲得だけを数え、地域数は全地域でのみ選択できる', async ({ page }) => {
  const list = [
    record('skin-earned-a', { catalog: skin, player: 'Skin Earner', kind: 'スキン大会', round: 'Session 1 / スキン獲得', prize: 9999, rank: 10 }),
    record('skin-earned-b', { catalog: skin, player: 'Skin Earner', region: 'EU', kind: 'コスメ大会', round: 'Session 1 / スキン報酬獲得', prize: 9999, rank: 10 }),
    record('skin-participant', { catalog: skin, player: 'Skin Participant', kind: 'スキン大会', round: 'Session 1', rank: 1 }),
    record('skin-unverified', { catalog: skin, player: 'Skin Unverified', kind: 'スキン大会', round: 'スキン獲得', rank: 1, verified: false }),
    record('skin-rule-only', { catalog: skin, player: 'Skin Rules Only', kind: 'コスメ大会', round: 'Session 1', note: 'スキン獲得対象は上位100名', rank: 1 })
  ];
  await fixture(page, list);
  await openRankings(page, 'metric=skins');
  expect(await rankingRows(page)).toEqual([{ name: 'Skin Earner', value: 2, rank: 1 }]);
  await expect(page.locator('#player-earnings-sum')).toHaveText('$0');
  await page.locator('#ranking-metric').selectOption('regions');
  expect((await rankingRows(page)).find(row => row.name === 'Skin Earner').value).toBe(2);
  await page.locator('[data-ranking-region="ME"]').click();
  await expect(page.locator('#ranking-metric')).toHaveValue('prize');
  // Native hidden <option> elements are not actionable form controls in
  // Playwright's enabled matcher. Verify the actual selection guards instead.
  await expect(page.locator('#ranking-metric option[value="regions"]')).toHaveAttribute('disabled', '');
  await expect(page.locator('#ranking-metric option[value="regions"]')).toHaveAttribute('hidden', '');
  await expect(page.locator('#player-earnings-leaders [data-ranking-player]')).toHaveCount(0);
  await expect(page.locator('#ranking-count')).toContainText('0');
  await expect(page.locator('#ranking-more')).toBeHidden();
});

test('過去シーズンをURLと共通選択で復元し、形式未確認を既知形式へ混ぜない', async ({ page }) => {
  const list = [
    record('current-reload', { catalog: reload, player: 'Current Player', prize: 100 }),
    record('current-br', { player: 'Current Player', prize: 200 }),
    record('current-zb', { catalog: zb, player: 'ZB Player', prize: 300 }),
    record('unknown-format', { catalog: unknownMode, player: 'Unknown Format', prize: 900 }),
    record('past-br', { catalog: past, player: 'Past Player', prize: 400 })
  ];
  await fixture(page, list);
  await openRankings(page, 'metric=prize&mode=battle-royale', 'S41');
  expect(await rankingRows(page)).toEqual([{ name: 'Past Player', value: 400, rank: 1 }]);
  await expect(page.locator('#ranking-scope')).toContainText('CH7 S3');
  await page.locator('#season-select').selectOption('S42');
  expect(await rankingRows(page)).toEqual([{ name: 'Current Player', value: 200, rank: 1 }]);
  await page.locator('#ranking-mode').selectOption('reload');
  expect(await rankingRows(page)).toEqual([{ name: 'Current Player', value: 100, rank: 1 }]);
  await page.locator('#ranking-mode').selectOption('zero-build');
  expect(await rankingRows(page)).toEqual([{ name: 'ZB Player', value: 300, rank: 1 }]);
  await page.locator('#ranking-mode').selectOption('all');
  expect((await rankingRows(page)).some(row => row.name === 'Unknown Format')).toBe(true);
  await expect(page).toHaveURL(/season=S42/);
  await page.reload();
  await expect(page.locator('#ranking-mode')).toHaveValue('all');
  await expect(page.locator('#player-earnings-sum')).toHaveText('$1,500');
});

test('30件の段階表示・同一ID重複の除外・異なるセッションの保持・空状態が機能する', async ({ page }) => {
  const list = Array.from({ length: 35 }, (_, index) => record('pagination-' + index, {
    catalog: reload, player: 'Ranking Player ' + String(index).padStart(2, '0'), prize: 100
  }));
  list.push({ ...list[0] }); // Exact duplicate must not award the player twice.
  list.push(record('another-session', { catalog: reload, player: list[0].player, prize: 100, round: 'Event 2 · Round 2 / 賞金決勝' }));
  await fixture(page, list);
  await openRankings(page);
  await expect(page.locator('#player-earnings-leaders [data-ranking-player]')).toHaveCount(30);
  await expect(page.locator('#ranking-more')).toBeVisible();
  await page.locator('#ranking-more').click();
  const shown = await rankingRows(page);
  expect(shown).toHaveLength(35);
  expect(shown[0]).toEqual({ name: 'Ranking Player 00', value: 200, rank: 1 });
  expect(shown.slice(1).every(row => row.value === 100 && row.rank === 2)).toBe(true);
  await expect(page.locator('#player-earnings-sum')).toHaveText('$3,600');
  await expect(page.locator('#ranking-more')).toBeHidden();
  await page.locator('[data-ranking-region="BR"]').click();
  await expect(page.locator('#player-earnings-leaders [data-ranking-player]')).toHaveCount(0);
  await expect(page.locator('#ranking-count')).toContainText('0');
  await page.locator('[data-ranking-region="all"]').click();
  await expect(page.locator('#player-earnings-leaders [data-ranking-player]')).toHaveCount(30);
  await page.locator('#ranking-metric').scrollIntoViewIfNeeded();
  const before = await page.evaluate(() => window.scrollY);
  await page.locator('#ranking-metric').selectOption('prizeCount');
  expect(Math.abs((await page.evaluate(() => window.scrollY)) - before)).toBeLessThan(120);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
  await expect(page.locator('input[type="file"], form, [contenteditable="true"], [data-add], [data-delete]')).toHaveCount(0);
  await expect(page.getByRole('alert')).toHaveCount(0);
});
