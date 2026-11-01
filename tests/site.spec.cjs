'use strict';
const { test, expect } = require('@playwright/test');
const fs = require('node:fs/promises');
const path = require('node:path');
const { loadData, validateData, summarize, roster, personalCents, seasonFor, tournamentFor, tournamentKey } = require('../scripts/data-checks.cjs');
const data = loadData(path.join(__dirname, '..')).data;
const rows = data.results;
const money = value => '$' + value.toLocaleString('ja-JP');
const totalFor = name => rows.filter(row => roster(row).includes(name)).reduce((sum, row) => sum + personalCents(row), 0) / 100;
const resultIDs = page => page.locator('#page-results [data-result-id]').evaluateAll(elements => elements.map(e => e.dataset.resultId));
const historyIDs = page => page.locator('#page-profile .profile-history-row').evaluateAll(elements => elements.map(e => e.dataset.resultId));

test.beforeAll(() => expect(validateData(data).errors, 'ブラウザーテストの前提となるJSON検証').toEqual([]));
test.beforeEach(async ({ page }) => {
  await page.goto('/?season=all#home');
  await expect(page.locator('#stat-results')).toHaveText(String(rows.length));
});

test('ダッシュボード・全賞金ランキングをJSONの独立集計と照合する', async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  const report = summarize(data);
  await expect(page.locator('#stat-players')).toHaveText(String(report.players));
  await expect(page.locator('#stat-regions')).toHaveText(String(report.regions));
  await expect(page.locator('#home-earnings-sum')).toHaveText(money(report.total));
  await page.getByRole('button', { name: 'プレイヤー名鑑', exact: true }).click();
  await expect(page.locator('#player-earnings-sum')).toHaveText(money(report.total));
  while (await page.locator('#ranking-more').isVisible()) await page.locator('#ranking-more').click();
  const ranking = await page.locator('#player-earnings-leaders .earner').evaluateAll(elements => elements.map(e => ({ name: e.dataset.openProfile, amount: e.querySelector('.amount').textContent, events: Number(e.textContent.match(/賞金獲得 (\d+)件/)[1]) })));
  expect(ranking).toEqual(report.ranking.map(p => ({ name: p.name, amount: money(p.total), events: p.events })));
  await expect(page.getByRole('alert')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('遠征結果の検索・複合フィルター・詳細・CSVが同じ戦績を表示する', async ({ page }) => {
  test.slow(); // Preserve exhaustive comparisons as the published archive grows.
  await page.getByRole('button', { name: '遠征結果', exact: true }).click();
  expect((await resultIDs(page)).sort()).toEqual(rows.map(r => r.id).sort());
  const sample = rows.find(r => r.verified && r.prize > 0) || rows[0];
  const search = roster(sample)[0];
  await page.locator('#search-results').fill(search);
  await page.locator('#region-filter').selectOption(sample.region);
  await page.locator('#stage-filter').selectOption(sample.kind);
  const expected = rows.filter(r => r.region === sample.region && r.kind === sample.kind && [r.player, ...roster(r), r.playerRaw, r.event, r.region, r.round, r.note].some(x => String(x || '').toLowerCase().includes(search.toLowerCase())));
  await expect(page.locator('#result-count')).toHaveText(expected.length + '件');
  expect((await resultIDs(page)).sort()).toEqual(expected.map(r => r.id).sort());
  await page.locator('#page-results details summary').first().click();
  await expect(page.locator('#page-results details[open] [data-detail="source"] a')).toBeVisible();
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#export-csv').click();
  const download = await downloadPromise;
  const csv = await fs.readFile(await download.path(), 'utf8');
  expect(csv).toContain('chapter,season,seasonId');
  for (const row of expected) expect(csv).toContain('"' + row.source.replace(/"/g, '""') + '"');
  // Each date starts a CSV row; quoted notes may contain arbitrary newlines.
  expect((csv.match(/(?:^|\r\n)"\d{4}-\d{2}-\d{2}",/g) || []).length).toBe(expected.length);
  await page.locator('#prize-only').check();
  expect((await resultIDs(page)).sort()).toEqual(expected.filter(r => r.verified && r.prize > 0).map(r => r.id).sort());
});

test('プロフィール・地域グラフ・別名義・同名別人・共有URLを確認する', async ({ page }) => {
  test.slow(); // Visit multiple real profiles and compare their complete published histories.
  const report = summarize(data), name = report.ranking[0]?.name || roster(rows[0])[0];
  await page.goto('/?season=all#player=' + encodeURIComponent(name));
  await expect(page.locator('#profile-title')).toHaveText(name);
  await expect(page.locator('[data-profile="total"]')).toHaveText(money(totalFor(name)));
  await expect(page.locator('[data-profile="lifetime-total"]')).toHaveText(money(totalFor(name)));
  const expected = rows.filter(r => roster(r).includes(name));
  expect((await historyIDs(page)).sort()).toEqual(expected.map(r => r.id).sort());
  for (const region of ['ME', 'EU', 'NAC', 'NAW', 'OCE', 'BR']) {
    const regional = expected.filter(r => r.region === region);
    await expect(page.locator(`[data-profile-region="${region}"] [data-region-stat="count"]`)).toHaveText(regional.length + '件');
    await expect(page.locator(`[data-profile-region="${region}"] [data-region-stat="prize"]`)).toHaveText(money(regional.reduce((sum, r) => sum + personalCents(r), 0) / 100));
  }
  await page.reload(); await expect(page.locator('#profile-title')).toHaveText(name);
  for (const distinct of ['p1ng', 'RGN p1ng']) if (rows.some(r => roster(r).includes(distinct))) {
    await page.goto('/?season=all#player=' + encodeURIComponent(distinct));
    await expect(page.locator('#profile-title')).toHaveText(distinct);
    expect((await historyIDs(page)).sort()).toEqual(rows.filter(r => roster(r).includes(distinct)).map(r => r.id).sort());
  }
  const alias = Object.entries(data.players.confirmedAliases).find(([, aliases]) => aliases.length);
  if (alias) {
    await page.getByRole('button', { name: 'プレイヤー名鑑', exact: true }).click();
    await page.locator('#search-players').fill(alias[1][0]);
    await expect(page.locator('#all-players [data-open-profile]').filter({ hasText: alias[0] }).first()).toBeVisible();
  }
});

test('大会タグ検索・大会URL・期間切り替えをデータから照合する', async ({ page }) => {
  test.slow(); // Check the complete catalog and every facet against the current JSON.
  await page.getByRole('button', { name: '大会を探す', exact: true }).click();
  const ids = [...new Set(rows.map(r => tournamentKey(r, data)))];
  await expect(page.locator('#tournament-count')).toHaveText(ids.length + '大会 · ' + rows.length + '戦績');
  for (const mode of [...new Set(rows.map(r => tournamentFor(r, data)?.mode || 'unknown'))]) {
    await page.locator('#tournament-mode').selectOption(mode);
    const matching = rows.filter(r => (tournamentFor(r, data)?.mode || 'unknown') === mode);
    await expect(page.locator('#tournament-count')).toHaveText(new Set(matching.map(r => tournamentKey(r, data))).size + '大会 · ' + matching.length + '戦績');
  }
  await page.locator('#tournament-mode').selectOption('all');
  const id = ids[0];
  await page.locator(`[data-open-tournament="${id}"]`).click();
  await page.reload();
  expect((await page.locator('#page-tournament [data-tournament-record]').evaluateAll(es => es.map(e => e.dataset.tournamentRecord))).sort()).toEqual(rows.filter(r => tournamentKey(r, data) === id).map(r => r.id).sort());
  for (const season of [...new Set(rows.map(r => seasonFor(r, data))), 'all']) {
    await page.locator('#season-select').selectOption(season);
    await page.getByRole('button', { name: 'ダッシュボード', exact: true }).click();
    await expect(page.locator('#stat-results')).toHaveText(String(summarize(data, season).records));
    await expect(page.locator('#home-earnings-sum')).toHaveText(money(summarize(data, season).total));
  }
});

test('主要画面で横はみ出しと閲覧者向け編集機能の復活がない', async ({ page }) => {
  test.slow(); // Render all data-heavy views before checking layout and read-only controls.
  for (const button of ['ダッシュボード', '遠征結果', 'プレイヤー名鑑', '大会を探す', '参照ソース']) {
    await page.getByRole('button', { name: button, exact: true }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1), button + 'の横はみ出し').toBe(true);
    await expect(page.locator('input[type="file"], form, [contenteditable="true"], [data-add], [data-delete]')).toHaveCount(0);
    await expect(page.getByRole('alert')).toHaveCount(0);
  }
});

test('JSON読み込み失敗を画面上で通知し、正常表示に見せかけない', async ({ page }) => {
  await page.route('**/results.json', route => route.fulfill({ status: 200, contentType: 'application/json', body: '{broken-json' }));
  await page.reload();
  await expect(page.getByRole('alert')).toContainText('サイトデータを読み込めませんでした');
});


test('更新履歴と新着登録がPC・スマホで閲覧できる', async ({ page }) => {
  const log = JSON.parse(await fs.readFile(path.join(__dirname, '..', 'updates.json'), 'utf8'));
  const expected = log.entries.filter(e => e.type === 'records').flatMap(e => e.recordIds);
  await expect(page.locator('#home-new-registrations [data-registration-id]')).toHaveCount(Math.min(expected.length, 4));
  await page.getByRole('button', { name: '更新履歴', exact: true }).click();
  await expect(page).toHaveURL(/#updates$/);
  await expect(page.locator('#updates-feed [data-update-id]')).toHaveCount(log.entries.length);
  await expect(page.locator('#new-entries-list [data-registration-id]')).toHaveCount(Math.min(20, expected.length));
  await expect(page.locator('#new-registration-count')).toContainText('登録日を確認できた');
  if (expected.length > 20) {
    await page.locator('#registration-more').click();
    await expect(page.locator('#new-entries-list [data-registration-id]')).toHaveCount(Math.min(40, expected.length));
  }
  const meta = page.locator('#new-entries-list .registration-meta').first();
  await expect(meta).toContainText('登録日');
  await expect(meta).toContainText('大会開催日');
  const details = page.locator('#updates-feed details').first();
  await details.locator('summary').click();
  await expect(details.locator('[data-open-profile]').first()).toBeVisible();
  await details.locator('[data-open-profile]').first().click();
  await expect(page).toHaveURL(/#player=/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
});


test('選手プロフィールの競技スタッツは確認済み戦績だけを集計し相方と形式を表示する', async ({ page }) => {
  const teamRow = rows.find(row => Array.isArray(row.players) && row.players.length > 1 && row.verified === true);
  expect(teamRow, 'チーム戦の検証用実データ').toBeTruthy();
  const name = teamRow.players[0];
  const own = rows.filter(row => roster(row).includes(name));
  const verified = own.filter(row => row.verified === true);
  const knownKills = verified.filter(row => Number.isInteger(row.kills) && row.kills >= 0);
  const knownVR = verified.filter(row => Number.isInteger(row.vrs) && row.vrs >= 0);
  const finals = verified.filter(row => ['賞金決勝', 'Practice決勝', 'Performance決勝', '決勝'].includes(row.kind) && Number.isInteger(row.rank) && row.rank > 0);
  await page.goto('/?season=all#player=' + encodeURIComponent(name));
  const snapshot = page.locator('#page-profile .profile-snapshot');
  await expect(snapshot).toBeVisible();
  const killsText = knownKills.length ? knownKills.reduce((sum, row) => sum + row.kills, 0).toLocaleString('ja-JP') : '—';
  const vrText = knownVR.length ? knownVR.reduce((sum, row) => sum + row.vrs, 0).toLocaleString('ja-JP') : '—';
  await expect(snapshot.locator('[data-profile-snapshot="kills"] strong')).toHaveText(killsText);
  await expect(snapshot.locator('[data-profile-snapshot="vrs"] strong')).toHaveText(vrText);
  await expect(snapshot.locator('[data-profile-snapshot="finals"] strong')).toHaveText(finals.length.toLocaleString('ja-JP'));
  const modeTotal = await snapshot.locator('[data-profile-mode]').evaluateAll(elements =>
    elements.reduce((sum, element) => sum + Number(element.querySelector('strong').textContent.replace(/[^0-9]/g, '')), 0));
  expect(modeTotal).toBe(own.length);
  const teammate = teamRow.players[1];
  const partnerLink = snapshot.locator('[data-profile-partners] [data-open-profile="' + teammate + '"]').first();
  await expect(partnerLink).toBeVisible();
  await partnerLink.click();
  await expect(page.locator('#profile-title')).toHaveText(teammate);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
});


test('ホームの注目選手・記録は掲載された確認済み戦績から選ばれ、プロフィールと大会へ移動できる', async ({ page }) => {
  const report=summarize(data),leader=report.ranking[0];
  expect(leader?.total).toBeGreaterThan(0);
  const featured=page.locator('#home-showcase-players');
  const prize=featured.locator('[data-home-feature="prize"]');
  await expect(prize).toContainText(leader.name);
  await expect(prize).toContainText(money(leader.total));
  await expect(featured.locator('[data-home-feature="pr"]')).toBeVisible();
  await expect(featured.locator('[data-home-feature="vrs"]')).toBeVisible();
  const moments=page.locator('#home-showcase-records');
  const best=rows.filter(row=>personalCents(row)>0).sort((a,b)=>personalCents(b)-personalCents(a)||b.date.localeCompare(a.date))[0];
  await expect(moments.locator('[data-home-record="payout"]')).toHaveAttribute('data-result-id',best.id);
  await expect(moments.locator('[data-home-record="payout"] .home-record-value')).toHaveText(money(personalCents(best)/100));
  await expect(moments.locator('[data-home-record="payout"] .home-record-source')).toHaveAttribute('href',best.source);
  await prize.click();
  await expect(page.locator('#profile-title')).toHaveText(leader.name);
  await page.goto('/?season=all#home');
  await moments.locator('[data-home-record="payout"] [data-open-tournament]').click();
  await expect(page.locator('#page-tournament')).toBeVisible();
  await page.goto('/?season=S41#home');
  await expect(page.locator('#stat-results')).not.toHaveText(String(rows.length));
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1)).toBe(true);
});
