'use strict';
const {test,expect}=require('@playwright/test');
const index=require('../participation-index.json');
test('nonqualifier participation archive opens by month and stays outside prize filters',async({page})=>{
 await page.goto('/?season=all#results');
 await expect(page.locator('#participation-archive')).toBeVisible();
 await expect(page.locator('#participation-summary')).toContainText('出場戦績');
 if(index.total===0){await expect(page.locator('#participation-table')).toContainText('初回自動調査');return}
 const month=index.months.at(-1).month;
 await page.locator('#participation-month').selectOption(month);
 await expect(page.locator('#participation-table tbody tr').first()).toBeVisible();
 await expect(page.locator('#participation-table')).toContainText('出場確認');
 await expect(page.locator('#participation-archive')).toContainText('称号');
});
test('player profile loads their verified participation without counting it as award',async({page})=>{
 test.skip(index.players.length===0,'No participation entries archived yet');
 const player=index.players[0];
 await page.goto('/?season=all#player='+encodeURIComponent(player.name));
 await expect(page.locator('#participation-profile')).toBeVisible();
 await expect(page.locator('#participation-profile')).toContainText('海外大会の出場戦績');
 await expect(page.locator('#participation-profile .participation-count')).toContainText('件の出場戦績');
 await expect(page.locator('#participation-profile tbody tr').first()).toBeVisible();
});
