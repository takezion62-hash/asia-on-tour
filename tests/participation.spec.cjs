'use strict';
const {test,expect}=require('@playwright/test');

test('reviewed squad results appear in the normal overseas results without a separate archive',async({page})=>{
 await page.goto('/?season=all#results');
 await expect(page.locator('#participation-archive')).toHaveCount(0);
 await expect(page.locator('#participation-recent-batch')).toHaveCount(0);
 const search=page.locator('#search-results');
 await page.locator('#region-filter').selectOption('NAW');
 await search.fill('りあにー / ひろ / そみー / Plank');
 await expect(page.locator('#result-table')).toContainText('りあにー');
 await expect(page.locator('#result-table')).toContainText('32');
 await expect(page.locator('#result-table')).toContainText('予選突破');
 await page.locator('#prize-only').check();
 await expect(page.locator('#result-table')).not.toContainText('りあにー');
});
test('confirmed ranked player profiles do not add a duplicate attendance-only section',async({page})=>{
 await page.goto('/?season=all#player='+encodeURIComponent('かめてぃん'));
 await expect(page.locator('#profile-content')).toBeVisible();
 await expect(page.locator('#participation-profile')).toHaveCount(0);
});

test('AOT PR credits lower-ranked verified participation once, without breakthrough, money or achievement claims',async({page})=>{
 const catalog=require('../tournaments.json');
 const cup=catalog.catalog.find(t=>t.seasonId==='S42'&&t.subtype==='console-solo-victory-cup');
 expect(cup).toBeTruthy();
 const source=(windowId)=>'https://www.fortnite.com/competitive/events/S42_ConsoleVCC_SolosZB/?region=NAW&round='+windowId;
 const names=['Archive Player','Published Player'];
 const published={id:'pr-published',date:'2026-10-25',region:'NAW',player:'Published Player',
  event:cup.name,tournamentId:cup.id,seasonId:'S42',chapter:7,season:4,
  round:'Event 8 · Round 2 / 賞金決勝',kind:'賞金決勝',
  rank:10,points:100,kills:5,vrs:0,prize:0,verified:true,note:'Confirmed competition.',
  source:source('S42_ConsoleVCC_SolosZB_Event8Round2_NAW')};
 const make=(id,name,rank)=>({
  id,date:'2026-10-25',region:'NAW',player:name,
  event:cup.name,tournamentId:cup.id,seasonId:'S42',
  round:'Event 8 · Round 1 / 予選',stage:'予選',
  rank,points:187,kills:16,vrs:0,matches:8,
  status:'通過圏外',qualification:'outside-cutoff',prize:null,verified:true,
  source:source('S42_ConsoleVCC_SolosZB_Event8Round1_NAW')});
 const entries=[make('participation-0123456789abcdefabcd',names[0],1044),
  make('participation-aaaaaaaaaaaaaaaaaaaa',names[1],1100)];
 for(const [file,body] of Object.entries({
   'results.json':[published],
   'players.json':{candidates:names.map((name,i)=>({name,initials:'P'+i,desc:'Confirmed player',accent:'cyan'})),confirmedAliases:{}},
   'participation-index.json':{version:1,total:2,months:[{month:'2026-10',count:2}],
    players:names.map(name=>({name,count:1,months:['2026-10'],latestDate:'2026-10-25'}))},
   'participation/2026-10.json':{version:1,month:'2026-10',entries}
 })){
   await page.route('**/'+file,route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)}));
 }
 await page.goto('/?season=all#players');
 await expect(page.locator('#aot-pr-status')).toContainText('出場アーカイブ 1件');
 const row=page.locator('#aot-pr-leaders .aot-pr-item').filter({has:page.getByRole('link',{name:names[0],exact:true})});
 await expect(row).toContainText('出場記録から');
 await expect(row).toContainText('予選突破 0.0');
 await expect(row).toContainText('賞金ボーナス 0.0');
 await row.getByRole('link').click();
 await expect(page.locator('.aot-pr-overview')).toContainText('出場記録からのPR');
 await expect(page.locator('.aot-pr-overview')).toContainText('予選突破ボーナス');
 await page.locator('.aot-pr-breakdown summary').click();
 await expect(page.locator('.aot-pr-breakdown')).toContainText('通過圏外（基本PRのみ）');
 await expect(page.locator('#participation-profile')).toHaveCount(0);
 await page.getByRole('button',{name:'← 戻る'}).first().click();
 const publishedRow=page.locator('#aot-pr-leaders .aot-pr-item').filter({has:page.getByRole('link',{name:names[1],exact:true})});
 await expect(publishedRow).toContainText('出場記録から 0.0');
 await expect(page.locator('#player-earnings-sum')).toHaveText('$0');
});



test('NAW Reload Oct 17 searchable evidence remains in the canonical results only',async({page})=>{
 await page.goto('/?season=all#results');
 const search=page.locator('#search-results'),results=page.locator('#result-table');
 for(const [name,rank] of [['RyoIT','341'],['ろず','339'],['シルス',null]]){
  await search.fill(name);
  await expect(results).toContainText(name);
  await expect(page.locator('#participation-main-search')).toHaveCount(0);
  if(rank)await expect(results).toContainText('#'+rank);
  else await expect(results).toContainText('報告あり・詳細未確認');
 }
 await search.fill('RyoIT');
 await page.locator('#region-filter').selectOption('NAW');
 await expect(results).toContainText('RyoIT');
 await page.locator('#prize-only').check();
 await expect(results).not.toContainText('RyoIT');
 await page.locator('#prize-only').uncheck();
 await expect(results).toContainText('RyoIT');
});
test('2026 squad teams have qualification evidence in normal results, not a special batch',async({page})=>{
 await page.goto('/?season=all#results');
 await page.locator('#region-filter').selectOption('NAW');
 const search=page.locator('#search-results');
 await search.fill('R1ze / かめてぃん / Zagouの弟 / らむ');
 await expect(page.locator('#result-table')).toContainText('149');
 await expect(page.locator('#result-table')).toContainText('予選敗退');
 await expect(page.locator('#participation-recent-batch')).toHaveCount(0);
 await expect(page.locator('#participation-archive')).toHaveCount(0);
 await expect(page.locator('#stage-filter').locator('option[value="参加確認"]')).toHaveCount(1);
});
