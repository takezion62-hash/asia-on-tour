'use strict';
const {test,expect}=require('@playwright/test');
test('Tracker-like nine-field event details render in regular results on PC and mobile',async({page,request})=>{
 for(const asset of ['/tracker-summary.js','/tracker-summary.css']){
  const response=await request.get(asset);
  expect(response.status()).toBe(200);
 }
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/?season=all#results');
 const first=page.locator('#result-table .archive-row').first();
 await expect(first).toBeVisible();
 await first.locator('.result-details > summary').click();
 const summary=first.locator('[data-detail="tracker-summary"] .tracker-summary');
 await expect(summary).toBeVisible();
 await expect(summary.locator('[data-tracker-metric]')).toHaveCount(9);
 await expect(summary.locator('[data-tracker-metric="points"]')).toBeVisible();
 await expect(summary.locator('[data-tracker-metric="avg-elims"]')).toBeVisible();
 await expect(summary.locator('[data-tracker-metric="kd"]')).toBeVisible();
 await expect(summary).toContainText('未取得は「—」');
 expect(errors).toEqual([]);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+2)).toBe(true);
});
