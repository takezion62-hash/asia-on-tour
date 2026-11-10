'use strict';
const {test,expect}=require('@playwright/test');
const index=require('../participation-index.json');
test('nonqualifier participation archive opens by month and stays outside prize filters',async({page})=>{
 await page.goto('/?season=all#results');
 await expect(page.locator('#participation-archive')).toBeVisible();
 await expect(page.locator('#participation-summary')).toContainText('出場戦績');
 if(index.total===0){await expect(page.locator('#participation-table')).toContainText('初回自動調査');return}
 const latestPopulated=index.months.filter(month=>month.count>0).sort((a,b)=>b.month.localeCompare(a.month))[0];
 if(!latestPopulated){await expect(page.locator('#participation-table')).toContainText('まだありません');return}
 const month=latestPopulated.month;
 await expect(page.locator('#participation-month')).toHaveValue(month);
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
 await expect(page.locator('#participation-profile')).toContainText('通過圏外');
 await page.getByRole('button',{name:'← 戻る'}).first().click();
 const publishedRow=page.locator('#aot-pr-leaders .aot-pr-item').filter({has:page.getByRole('link',{name:names[1],exact:true})});
 await expect(publishedRow).toContainText('出場記録から 0.0');
 await expect(page.locator('#player-earnings-sum')).toHaveText('$0');
});


test('NAW Reload Oct 17 is searchable with unconfirmed stats clearly distinguished',async({page})=>{
 await page.goto('/?season=all#results');
 const search=page.locator('#search-results'),results=page.locator('#result-table');
 const archive=page.locator('#participation-main-search');
 for(const [name,rank] of [['RyoIT','341'],['ろず','339'],['シルス',null]]){
  await search.fill(name);
  await expect(results).toContainText(name);
  await expect(archive).toBeHidden();
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
