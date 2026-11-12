'use strict';
const {test,expect}=require('@playwright/test');
const manifest=require('../season-data/manifest.json');
const results=require('../results.json');

test('data-only: all seasons load, total record count matches and archive opens',async({page})=>{
 const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/?season=all#home');
 await expect(page.locator('#stat-results')).toHaveText(String(results.length));
 await expect(page.locator('#stat-results')).toHaveText(String(manifest.scopes.all.count));
 await page.locator('.nav button[data-page="results"]').click();
 await expect(page.locator('#page-results')).toBeVisible();
 await expect(page.locator('#result-count')).toHaveText(results.length.toLocaleString('ja-JP')+'件');
 await expect(page.locator('#result-table .archive-row').first()).toBeVisible();
 expect(errors).toEqual([]);
});

test('data-only: seasonal results and player rankings render on both device projects',async({page})=>{
 const current=manifest.seasonOrder[0];
 const earliest=manifest.seasonOrder.at(-1);
 const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/?season='+current+'#home');
 await expect(page.locator('#stat-results')).toHaveText(String(manifest.scopes[current].count));
 await page.locator('#season-select').selectOption(earliest);
 await expect(page.locator('#stat-results')).toHaveText(String(manifest.scopes[earliest].count));
 await page.locator('.nav button[data-page="players"]').click();
 await expect(page.locator('#page-players')).toBeVisible();
 await expect(page.locator('#player-earnings-sum')).toHaveText(
   '$'+manifest.scopes[earliest].prizeTotal.toLocaleString('ja-JP'));
 expect(errors).toEqual([]);
});
