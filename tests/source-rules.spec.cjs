'use strict';
const {test,expect}=require('@playwright/test');
test('参照ソース内で公式大会ルールが検索でき、地域別通過順位・報酬条件を切り替えられる',async({page})=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('/?season=all#about');
 const root=page.locator('#source-rules');
 await expect(root).toBeVisible();
 await expect(page.getByRole('heading',{name:'🏆 大会ルール'})).toBeVisible();
 await expect(page.locator('#source-rule-overview')).toContainText('公式規則登録 9');
 await expect(root.locator('.source-rule-card')).toHaveCount(9);
 await expect(root.locator('.source-rule-card a[href*="fortnite.com"]')).not.toHaveCount(0);
 await page.locator('#source-rule-search').fill('zoro');
 await expect(root.locator('.source-rule-card')).toHaveCount(2);
 await page.locator('#source-rule-region').selectOption('EU');
 await expect(root).toContainText('上位525');
 await expect(root).toContainText('上位200');
 await page.locator('#source-rule-search').fill('S42');
 await expect(root).toContainText('決勝1VRにつき$100');
 await expect(root).toContainText('EU');
 expect(errors).toEqual([]);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+2)).toBe(true);
});

test('未登録大会は誤って賞金やスキンを表示せず、検索・追加表示が可能',async({page})=>{
 await page.goto('/?season=all#about');
 await expect(page.locator('#source-rule-overview')).toContainText('公式規則登録 9');
 await page.locator('#source-rule-filter').selectOption('pending');
 const cards=page.locator('#source-rule-results .source-rule-card');
 await expect(cards).toHaveCount(12);
 await expect(cards.first()).toContainText('ルール未登録');
 await expect(cards.first()).not.toContainText('決勝1VRにつき');
 await page.locator('#source-rule-more').click();
 await expect(cards).toHaveCount(24);
 await page.locator('#source-rule-region').selectOption('BR');
 await expect(cards).toHaveCount(12);
 await expect(page.locator('#source-rule-status')).toContainText('公式ルール登録済み 9大会');
});
