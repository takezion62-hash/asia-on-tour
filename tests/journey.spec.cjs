'use strict';
const { test, expect } = require('@playwright/test');
const path = require('node:path');
const { loadData, roster, seasonFor } = require('../scripts/data-checks.cjs');
const data = loadData(path.join(__dirname, '..')).data;
const rows = data.results;
const money = value => '$' + value.toLocaleString('ja-JP');
const byDate = (a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id);
const ids = page => page.locator('#journey-list [data-journey-record]').evaluateAll(es => es.map(e => e.dataset.journeyRecord));
// Independent cash oracle: neither qualifying VR nor cosmetic rewards are cash.
const cash = row => {
  if (row.verified !== true || !Number.isFinite(row.prize) || row.prize <= 0 || ['予選', 'コスメ大会', 'スキン大会'].includes(row.kind)) return 0;
  const people = roster(row);
  if (people.length === 1) return row.prize;
  return Number.isFinite(row.prizePerPlayer) && row.prizePerPlayer > 0 && row.prizePerPlayer * people.length <= row.prize + 0.001 ? row.prizePerPlayer : 0;
};
const total = list => list.reduce((sum, row) => sum + Math.round(cash(row) * 100), 0) / 100;
const playerRows = name => rows.filter(row => roster(row).includes(name)).sort(byDate);
const profileURL = (name, season = 'all') => '/?season=' + season + '#player=' + encodeURIComponent(name);
const allButton = page => page.locator('[data-journey-mode="all"]');
async function openProfile(page, name, season = 'all') {
  await page.goto(profileURL(name, season));
  await expect(page.locator('#profile-title')).toHaveText(name);
  await expect(page.locator('#profile-journey')).toBeVisible();
}
async function revealAll(page) {
  while (await page.locator('#journey-more:visible').count()) await page.locator('#journey-more').click();
}
async function fixture(page, list) {
  await page.route('**/results.json', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(list) }));
}
const sample = rows.find(row => roster(row).length === 1 && seasonFor(row, data) === 'S42' && /^https:\/\/fortnitetracker\.com\//.test(row.source)) || rows.find(row => roster(row).length === 1);
function synthetic(id, overrides = {}) {
  const name = roster(sample)[0];
  const row = { ...sample, id, player: name, date: '2026-09-01', region: 'NAW', round: 'Round 1', kind: '予選', rank: 20, points: 100, kills: 5, vrs: 0, prize: 0, verified: true, note: 'ブラウザーテスト専用の合成データ', chapter: 7, season: 4, seasonId: 'S42', ...overrides };
  delete row.players; delete row.profiles; delete row.profileUrl; delete row.prizePerPlayer; delete row.playerRaw;
  return row;
}

test('年表は選手の全戦績を日付順で表示し、表示モードから独立して個人累計賞金を示す', async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  const counts = new Map();
  for (const row of rows) for (const name of roster(row)) counts.set(name, (counts.get(name) || 0) + 1);
  const name = [...counts].sort((a, b) => b[1] - a[1])[0][0];
  const expected = playerRows(name);
  await openProfile(page, name);
  await expect(allButton(page)).toHaveAttribute('aria-pressed', 'true');
  await revealAll(page);
  expect(await ids(page)).toEqual(expected.map(row => row.id));
  expect(await page.locator('#journey-list time[datetime]').evaluateAll(es => es.map(e => e.dateTime))).toEqual(expected.map(row => row.date));
  await expect(page.locator('[data-journey-total]')).toHaveText(money(total(expected)));
  await expect(page.locator('#journey-chart svg')).toHaveCount(1);
  const chart = await page.locator('#journey-chart svg').innerHTML();
  await page.locator('[data-journey-mode="prize"]').click();
  await expect(page.locator('[data-journey-mode="prize"]')).toHaveAttribute('aria-pressed', 'true');
  await revealAll(page);
  expect(await ids(page)).toEqual(expected.filter(row => cash(row) > 0).map(row => row.id));
  await expect(page.locator('[data-journey-total]')).toHaveText(money(total(expected)));
  expect(await page.locator('#journey-chart svg').innerHTML()).toBe(chart);
  await page.locator('[data-journey-mode="highlights"]').click();
  await revealAll(page);
  const highlights = await ids(page);
  const firstCashDate = expected.find(row => cash(row) > 0)?.date;
  if (firstCashDate) for (const row of expected.filter(row => row.date === firstCashDate && cash(row) > 0)) expect(highlights).toContain(row.id);
  expect(highlights).toEqual(expected.filter(row => highlights.includes(row.id)).map(row => row.id));
  await expect(page.locator('#profile-journey')).toContainText('サイト掲載記録上');
  expect(errors).toEqual([]);
});

test('デュオは個人賞金・相方・出典・大会詳細を維持し、同名別人の記録を混ぜない', async ({ page }) => {
  const duo = rows.find(row => roster(row).length === 2 && cash(row) > 0 && row.source.includes('fortnitetracker.com')) || rows.find(row => roster(row).length === 2 && cash(row) > 0);
  expect(duo, '確認済み個人配分を持つ既存のデュオ記録').toBeTruthy();
  const [name, partner] = roster(duo);
  await openProfile(page, name);
  await revealAll(page);
  // An event/date may contain both qualifying and final records; select by its immutable ID.
  // CSS.escape runs in the browser so special characters in IDs remain literal.
  const selector = await page.evaluate(id => '[data-journey-record="' + CSS.escape(id) + '"]', duo.id);
  const selected = page.locator(selector);
  await expect(selected.locator('[data-journey-metric="prize"]')).toContainText(money(cash(duo)));
  await expect(selected.locator(`[data-open-profile="${partner}"]`)).toHaveText(partner);
  await expect(selected.locator(`a[href="${duo.source}"]`).first()).toHaveAttribute('target', '_blank');
  await selected.locator('[data-open-tournament]').first().click();
  await expect(page.locator('#page-tournament')).toBeVisible();
  await expect(page.locator('[data-tournament-record]').filter({ hasText: name }).first()).toBeVisible();
  await page.goBack();
  await expect(page.locator('#profile-title')).toHaveText(name);
  for (const distinct of ['p1ng', 'RGN p1ng', 'miru']) {
    if (!playerRows(distinct).length) continue;
    await openProfile(page, distinct);
    await revealAll(page);
    expect(await ids(page)).toEqual(playerRows(distinct).map(row => row.id));
  }
});

test('シーズン切り替え・共有URL・予選と決勝の独立記録が年表と累計に反映される', async ({ page }) => {
  const name = roster(sample)[0];
  const current = synthetic('journey-season-current-qualifying', { date: '2026-10-16', vrs: 3 });
  const final = synthetic('journey-season-current-final', { date: '2026-10-16', kind: '賞金決勝', round: 'Round 2', rank: 5, prize: 200 });
  const past = synthetic('journey-season-past', { date: '2026-08-01', seasonId: 'S41', chapter: 7, season: 3, kind: '賞金決勝', round: 'Round 2', prize: 50, source: sample.source.replaceAll('S42', 'S41') });
  const list = [final, current, past];
  await fixture(page, list);
  await openProfile(page, name);
  expect(await ids(page)).toEqual(list.slice().sort(byDate).map(row => row.id));
  await expect(page.locator('[data-journey-total]')).toHaveText('$250');
  await page.locator('#season-select').selectOption('S42');
  expect(await ids(page)).toEqual([current, final].sort(byDate).map(row => row.id));
  await expect(page.locator('#profile-journey')).toContainText('予選');
  await expect(page.locator('#profile-journey')).toContainText('賞金決勝');
  await expect(page.locator('[data-journey-total]')).toHaveText('$200');
  await page.locator('#season-select').selectOption('S41');
  expect(await ids(page)).toEqual([past.id]);
  await expect(page.locator('[data-journey-total]')).toHaveText('$50');
  await expect(page).toHaveURL(/season=S41/);
  await page.reload();
  await expect(page.locator('#profile-title')).toHaveText(name);
  expect(await ids(page)).toEqual([past.id]);
  await page.locator('#season-select').selectOption('all');
  expect(await ids(page)).toEqual(list.slice().sort(byDate).map(row => row.id));
});

test('ハイライトは初賞金・賞金決勝TOP3・賞金節目・初スキン報酬を1記録にまとめる', async ({ page }) => {
  const name = roster(sample)[0];
  const first = synthetic('journey-highlight-first', { date: '2026-09-01' });
  const worse = synthetic('journey-highlight-no-change', { date: '2026-09-02', rank: 30 });
  const firstCash = synthetic('journey-highlight-first-cash', { date: '2026-09-03', kind: '賞金決勝', round: 'Round 2', rank: 1, prize: 1000 });
  const region = synthetic('journey-highlight-region', { date: '2026-09-04', region: 'EU', rank: 30, source: sample.source.replaceAll('_NAW', '_EU') });
  const vr = synthetic('journey-highlight-vr', { date: '2026-09-05', rank: 30, vrs: 1 });
  // Deliberately invalid claimed cash must not turn a cosmetic reward into cash.
  const skin = synthetic('journey-highlight-skin', { date: '2026-09-06', kind: 'スキン大会', round: 'スキン獲得', prize: 999, rank: 10, vrs: 2 });
  const unverified = synthetic('journey-highlight-unverified', { date: '2026-09-07', kind: '賞金決勝', verified: false, prize: 999 });
  const top3 = synthetic('journey-highlight-top3', { date: '2026-09-08', kind: '賞金決勝', round: 'Round 2', rank: 3, prize: 100 });
  const secondSkin = synthetic('journey-highlight-second-skin', { date: '2026-09-09', kind: 'スキン大会', round: 'スキン獲得', prize: 0, rank: 3 });
  const list = [secondSkin, top3, unverified, skin, vr, region, firstCash, worse, first];
  await fixture(page, list);
  await openProfile(page, name);
  await expect(page.locator('[data-journey-total]')).toHaveText('$1,100');
  await expect(page.locator('[data-journey-record="' + skin.id + '"]')).toContainText('現金加算なし');
  await page.locator('[data-journey-mode="highlights"]').click();
  expect(await ids(page)).toEqual([firstCash.id, skin.id, top3.id]);
  const winner = page.locator('[data-journey-record="' + firstCash.id + '"]');
  await expect(winner).toHaveCount(1);
  await expect(winner).toContainText('サイト掲載初の賞金獲得日');
  await expect(winner).toContainText('賞金決勝で総合優勝');
  await expect(winner).toContainText('掲載記録の累計個人賞金 $1,000到達');
  await expect(page.locator('[data-journey-record="' + top3.id + '"]')).toContainText('賞金決勝で総合TOP3');
  await expect(page.locator('[data-journey-record="' + skin.id + '"]')).toContainText('サイト掲載初のスキン報酬獲得日');
  await expect(page.locator('#profile-journey')).toContainText('サイト掲載記録上');
  await page.locator('[data-journey-mode="prize"]').click();
  expect(await ids(page)).toEqual([firstCash.id, top3.id]);
  await expect(page.locator('[data-journey-total]')).toHaveText('$1,100');
  await allButton(page).click();
  expect(await ids(page)).toEqual(list.slice().sort(byDate).map(row => row.id));
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
});

test('VR・予選通過・初地域・小幅順位更新・Practice上位だけならハイライト0件で表示できる', async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  const first = synthetic('journey-empty-first', { date: '2026-09-01', rank: 50 });
  const region = synthetic('journey-empty-region', { date: '2026-09-02', region: 'EU', rank: 49, source: sample.source.replaceAll('_NAW', '_EU') });
  const vr = synthetic('journey-empty-vr', { date: '2026-09-03', rank: 48, vrs: 1 });
  const moreVR = synthetic('journey-empty-more-vr', { date: '2026-09-04', rank: 47, vrs: 4, round: '予選通過' });
  const practice = synthetic('journey-empty-practice', { date: '2026-09-05', event: 'FNCS Division 1 Practice', kind: 'Practice', round: 'Practice', rank: 1, vrs: 3 });
  const unknownRank = synthetic('journey-empty-unknown-rank', { date: '2026-09-06', kind: '賞金決勝', round: 'Round 2', rank: null });
  const qualifying = synthetic('journey-empty-qualifying', { date: '2026-09-07', rank: 1, prize: 5000, vrs: 5 });
  const unconfirmedSkin = synthetic('journey-empty-unconfirmed-skin', { date: '2026-09-08', kind: 'スキン大会', round: 'スキン獲得', verified: false, rank: 1 });
  const skinParticipation = synthetic('journey-empty-skin-participation', { date: '2026-09-09', kind: 'スキン大会', round: '予選', rank: 1 });
  const list = [first, region, vr, moreVR, practice, unknownRank, qualifying, unconfirmedSkin, skinParticipation];
  await fixture(page, list);
  await openProfile(page, roster(sample)[0]);
  await page.locator('[data-journey-mode="highlights"]').click();
  expect(await ids(page)).toEqual([]);
  await expect(page.locator('#journey-count')).toContainText('0件中 0件');
  await expect(page.locator('#journey-list')).toContainText('この表示条件に一致する掲載記録はありません');
  await expect(page.locator('#journey-more')).not.toBeVisible();
  await expect(page.locator('[data-journey-total]')).toHaveText('$0');
  await page.locator('[data-journey-mode="prize"]').click();
  expect(await ids(page)).toEqual([]);
  await allButton(page).click();
  expect(await ids(page)).toEqual(list.map(row => row.id));
  expect(errors).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
});

test('賞金節目と掲載初は全期間で判定し、選択シーズンには該当記録だけ表示する', async ({ page }) => {
  const name = roster(sample)[0];
  const past = synthetic('journey-lifetime-past', { date: '2026-08-01', seasonId: 'S41', chapter: 7, season: 3, kind: '賞金決勝', round: 'Round 2', rank: 20, prize: 900, source: sample.source.replaceAll('S42', 'S41') });
  const current = synthetic('journey-lifetime-current', { date: '2026-09-01', kind: '賞金決勝', round: 'Round 2', rank: 20, prize: 100 });
  const following = synthetic('journey-lifetime-following', { date: '2026-09-02', kind: '賞金決勝', round: 'Round 2', rank: 20, prize: 100 });
  await fixture(page, [following, current, past]);
  await openProfile(page, name, 'S42');
  await page.locator('[data-journey-mode="highlights"]').click();
  expect(await ids(page)).toEqual([current.id]);
  await expect(page.locator('#journey-list')).toContainText('掲載記録の累計個人賞金 $1,000到達');
  await expect(page.locator('#journey-list')).not.toContainText('サイト掲載初の賞金獲得日');
  // The displayed chart remains scoped to the chosen season, not the lifetime milestone base.
  await expect(page.locator('[data-journey-total]')).toHaveText('$200');
  await page.locator('#season-select').selectOption('S41');
  expect(await ids(page)).toEqual([past.id]);
  await expect(page.locator('#journey-list')).toContainText('サイト掲載初の賞金獲得日');
  await expect(page.locator('[data-journey-total]')).toHaveText('$900');
  await page.locator('#season-select').selectOption('all');
  expect(await ids(page)).toEqual([past.id, current.id]);
  await expect(page.locator('[data-journey-total]')).toHaveText('$1,100');
});

test('未確認の数値・出典・大会分類でも安全に年表を表示する', async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  const unknown = synthetic('journey-unconfirmed', { event: '未分類のテスト大会', rank: null, points: null, kills: null, vrs: null, prize: null, source: '', round: '', verified: false, seasonId: undefined, chapter: undefined, season: undefined });
  await fixture(page, [unknown]);
  await openProfile(page, roster(sample)[0]);
  expect(await ids(page)).toEqual([unknown.id]);
  await expect(page.locator('#journey-list')).toContainText('未確認');
  for (const metric of ['rank', 'points', 'kills', 'vrs', 'prize']) await expect(page.locator('[data-journey-metric="' + metric + '"]')).toHaveText('未確認');
  await expect(page.locator('[data-journey-total]')).toHaveText('$0');
  await expect(page.locator('#journey-list a[href=""], #journey-list a[href="undefined"], #journey-list a[href="null"]')).toHaveCount(0);
  expect(errors).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
});

test('大量の戦績は30件ずつ追加でき、モード切替後も件数と横幅が正しい', async ({ page }) => {
  const list = Array.from({ length: 35 }, (_, i) => synthetic('journey-pagination-' + String(i).padStart(2, '0'), { date: new Date(Date.UTC(2026, 8, 1 + i)).toISOString().slice(0, 10), event: i === 0 ? '長い大会名を持つ海外大会 '.repeat(8) : sample.event }));
  await fixture(page, list.slice().reverse());
  await openProfile(page, roster(sample)[0]);
  await expect(page.locator('#journey-list [data-journey-record]')).toHaveCount(30);
  await expect(page.locator('#journey-count')).toContainText('35');
  await page.locator('#journey-more').click();
  expect(await ids(page)).toEqual(list.map(row => row.id));
  await expect(page.locator('#journey-more')).not.toBeVisible();
  await page.locator('[data-journey-mode="prize"]').click();
  await expect(page.locator('#journey-list [data-journey-record]')).toHaveCount(0);
  await expect(page.locator('#journey-more')).not.toBeVisible();
  await allButton(page).click();
  await expect(page.locator('#journey-list [data-journey-record]')).toHaveCount(30);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
  await expect(page.getByRole('alert')).toHaveCount(0);
});
