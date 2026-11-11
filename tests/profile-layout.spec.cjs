'use strict';
const { test, expect } = require('@playwright/test');

const player = 'Shiroka';
const profile = '/?season=all#player=' + encodeURIComponent(player);

test('4セクションを必要なときだけ表示し、既存の戦績・称号・分析を残す', async ({ page, request }) => {
  for (const path of ['/profile-layout.js', '/profile-layout.css']) {
    const response = await request.get(path);
    expect(response.status()).toBe(200);
  }
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(profile);
  await expect(page.locator('#profile-title')).toHaveText(player);
  const tabs = page.locator('#profile-section-nav [role="tab"]');
  await expect(tabs).toHaveCount(4);
  await expect(page.locator('#profile-panel-overview')).toBeVisible();
  await expect(page.locator('#profile-panel-season')).toBeHidden();
  await expect(page.locator('#profile-panel-history')).toBeHidden();
  await expect(page.locator('#profile-panel-analysis')).toBeHidden();
  await expect(page.locator('#profile-panel-overview .profile-stat')).toHaveCount(4);
  await expect(page.locator('#profile-panel-overview .profile-quick-fact')).toHaveCount(2);

  await page.locator('[data-profile-tab="season"]').click();
  await expect(page.locator('#profile-panel-season')).toBeVisible();
  await expect(page.locator('#profile-panel-season .profile-snapshot')).toBeVisible();
  await expect(page.locator('#profile-panel-season .aot-pr-profile')).toHaveCount(1);
  await expect(page.locator('#profile-panel-overview')).toBeHidden();

  await page.locator('[data-profile-tab="history"]').click();
  await expect(page.locator('#profile-journey')).toBeVisible();
  await expect(page.locator('.profile-records-fold')).not.toHaveAttribute('open', '');
  await expect(page.locator('.profile-history-row').first()).toBeHidden();
  await page.locator('.profile-records-fold > summary').click();
  await expect(page.locator('.profile-history-row').first()).toBeVisible();

  await page.locator('[data-profile-tab="analysis"]').click();
  await expect(page.locator('[data-analysis-fold="awards"]')).not.toHaveAttribute('open', '');
  await expect(page.locator('#profile-achievements')).toBeHidden();
  await page.locator('[data-analysis-fold="awards"] > summary').click();
  await expect(page.locator('#profile-achievements')).toBeVisible();
  await page.locator('[data-analysis-fold="growth"] > summary').click();
  await expect(page.locator('#profile-growth .growth-svg')).toBeVisible();

  await page.locator('[data-profile-tab="overview"]').click();
  await page.locator('[data-style-jump]').click();
  await expect(page.locator('[data-profile-tab="analysis"]')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#profile-style-fold')).toHaveAttribute('open', '');
  await expect(page.locator('#profile-style')).toBeVisible();
  expect(errors).toEqual([]);
});

test('スマホの横スクロールタブ・キーボード操作・シーズン切替を確認', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(profile);
  await expect(page.locator('#profile-panel-overview')).toBeVisible();
  await page.locator('[data-profile-tab="season"]').click();
  await page.locator('#season-select').selectOption('S42');
  await expect(page.locator('[data-profile-tab="season"]')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#profile-panel-season')).toBeVisible();

  const tab = page.locator('[data-profile-tab="season"]');
  await tab.focus();
  await tab.press('ArrowRight');
  await expect(page.locator('[data-profile-tab="history"]')).toHaveAttribute('aria-selected', 'true');
  await page.locator('[data-profile-tab="overview"]').click();
  await page.locator('[data-journey-jump]').click();
  await expect(page.locator('#profile-panel-history')).toBeVisible();
  expect(await page.evaluate(() =>
    document.documentElement.scrollWidth <= document.documentElement.clientWidth + 2
  )).toBe(true);
});
