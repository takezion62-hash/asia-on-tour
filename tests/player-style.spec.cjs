'use strict';
const {test,expect}=require('@playwright/test');
const player='Shiroka';
const profile='/?season=all#player='+encodeURIComponent(player);
async function openStyleTab(page){
 await page.locator('[data-profile-tab="analysis"]').click();
}

test('プレイスタイル画面のJS/CSSが配信され、プロフィールで実測項目を表示',async({page,request})=>{
  for(const path of ['/player-style.js','/player-style-view.js','/player-style.css']){
    const response=await request.get(path);
    expect(response.status()).toBe(200);
    expect((await response.text()).length).toBeGreaterThan(300);
  }
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(profile);
 await openStyleTab(page);
  const section=page.locator('#profile-style');
  await expect(section).toBeVisible();
  const fold=section.locator('#profile-style-fold');
  await expect(fold).not.toHaveAttribute('open','');
  await expect(section.locator('.style-card').first()).toBeHidden();
  await fold.locator(':scope > summary').click();
  await expect(fold).toHaveAttribute('open','');
  await expect(section.locator('#profile-style-title')).toContainText('プレイスタイル');
  await expect(section.locator('[data-style-filter="team"]')).toHaveValue('all');
  await expect(section.locator('.style-card')).toHaveCount(4);
  await expect(section.locator('.style-region')).toHaveCount(6);
  await expect(section.locator('.style-quality')).toBeVisible();
  await expect(section.locator('.style-specialty')).toHaveCount(2);
  await expect(section.locator('.style-evidence')).toBeVisible();
  await expect(section.locator('.style-trend-plot')).toHaveCount(0);
  await expect(section.locator('.style-overview')).toBeVisible();
  await expect(section.locator('.style-region-facts')).toBeVisible();
  await expect(section).toContainText('現在の分析');
  await expect(section).toContainText('得意地域');
  await expect(section).toContainText('地域別パフォーマンス');
  expect(errors).toEqual([]);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+2)).toBe(true);
});
test('シーズン・形式・地域・チームのフィルターを変更して安全に再計算',async({page})=>{
  await page.goto(profile);
 await openStyleTab(page);
  const section=page.locator('#profile-style');
  await expect(section).toBeVisible();
  const fold=section.locator('#profile-style-fold');
  await fold.locator(':scope > summary').click();
  await expect(fold).toHaveAttribute('open','');
  await section.locator('[data-style-filter="team"]').selectOption('duo');
  await expect(fold).toHaveAttribute('open','');
  await expect(section.locator('[data-style-filter="team"]')).toHaveValue('duo');
  await expect(section).toContainText('チームキル / 試合');
  await expect(section.locator('.style-trend-plot')).toHaveCount(2);
  await section.locator('[data-style-filter="region"]').selectOption('EU');
  await expect(fold).toHaveAttribute('open','');
  await expect(section.locator('[data-style-filter="region"]')).toHaveValue('EU');
  await section.locator('[data-style-filter="series"]').selectOption('all');
  await expect(section).toContainText('判定');
  await section.locator('[data-style-filter="mode"]').selectOption('all');
  const evidence=section.locator('.style-evidence');
  await evidence.locator('summary').click();
  await expect(evidence).toHaveAttribute('open','');
  const preset=section.locator('[data-style-scope-pick]');
  if(await preset.count()){
    await preset.first().click();
    await expect(fold).toHaveAttribute('open','');
  }
  const suggested=section.locator('[data-style-season-pick]');
  if(await suggested.count()){
    const selected=await suggested.first().getAttribute('data-style-season-pick');
    await suggested.first().click();
    await expect(section.locator('[data-style-filter="season"]')).toHaveValue(selected);
  }
  await expect(section.locator('.style-region')).toHaveCount(6);
  await section.locator('[data-style-growth-jump]').click();
  await expect(page.locator('#profile-growth')).toBeVisible();
  await expect(page).toHaveURL(/#player=/);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+2)).toBe(true);
});
test('選手比較の条件を引き継ぎ、2選手のキル効率と得意地域を表示',async({page})=>{
  await page.goto('/?season=all#compare?player=Shiroka&player='+encodeURIComponent('かめてぃん'));
  await expect(page.locator('#compare-report')).toHaveAttribute('data-compare-selected','2');
  await expect(page.locator('#compare-style')).toBeVisible();
  const compareFold=page.locator('#compare-style-fold');
  await expect(compareFold).not.toHaveAttribute('open','');
  await compareFold.locator('summary').click();
  await expect(compareFold).toHaveAttribute('open','');
  await expect(page.locator('[data-compare-style-player]')).toHaveCount(2);
  await expect(page.locator('[data-style-compare-region]')).toHaveCount(6);
  await expect(page.locator('.style-region-matrix')).toBeVisible();
  await page.locator('#compare-style-team').selectOption('duo');
  await expect(compareFold).toHaveAttribute('open','');
  await expect(page.locator('#compare-style-team')).toHaveValue('duo');
  await expect(page.locator('#compare-style')).toContainText('チーム');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+2)).toBe(true);
});

test('分析パネルを折りたたみ、ショートカットから再び開ける',async({page})=>{
  await page.goto(profile);
 await openStyleTab(page);
  const fold=page.locator('#profile-style-fold');
  await expect(fold).not.toHaveAttribute('open','');
  await expect(page.locator('#profile-style-title')).toBeVisible();
  await fold.locator(':scope > summary').click();
  await expect(fold).toHaveAttribute('open','');
  await expect(page.locator('#profile-style .style-quality')).toBeVisible();
  await fold.locator(':scope > summary').click();
  await expect(fold).not.toHaveAttribute('open','');
  await expect(page.locator('#profile-style .style-quality')).toBeHidden();
  await page.locator('[data-style-jump]').click();
  await expect(fold).toHaveAttribute('open','');
  await expect(page.locator('#profile-style .style-quality')).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+2)).toBe(true);
});
