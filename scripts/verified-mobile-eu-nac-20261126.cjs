'use strict';
// Exact owner-provided screenshot rows and original Tracker profile IDs.
const crypto=require('node:crypto');
const POLICY='verified-mobile-eu-nac-20261126';
const SERIES='https://www.fortnite.com/competitive/rules-guidelines/rules-library/fortnite-mobile-series-chapter-7-official-rules';
const TEST='https://www.fortnite.com/competitive/rules-guidelines/rules-library/fortnite-mobile-cups-november-2025-official-rules';
const MINI='https://www.fortnite.com/competitive/rules-guidelines/rules-library/fortnite-mobile-victory-cups-chapter-7-season-4-official-rules';
const profiles={
 gurabon:['yotta guɿäʙöɴ-ɷ-','389794a1-6b87-4df9-b412-34d9da42f2a3'],
 Reo:['Reo','25945a39-f156-4a22-aab8-ea7808feac98'],
 Grape:['שًٍَِّ今際の際שًٍَِّ','7a19efe1-b04c-47b1-9963-a30a95276437'],
 hazerita_FNM:['hazerita_FNM','fc9b92b9-91d6-4cb0-a4a3-688fc4d2ac03']
};
// Screenshot, date (JST), season, region, exact event/window, stage,
// canonical player, rank, points, matches, eliminations, VR, USD.
const GOLD=[
 [2061,'2026-08-17',41,'EU','MobileSeriesCupQual','MobileSeriesCup_MarQualifier14','MarQualifier 14','gurabon',12,76,6,10,0,500],
 [2073,'2026-06-28',41,'EU','MobileSeriesCupQual','MobileSeriesCup_MarQualifier12','MarQualifier 12','Reo',2,129,6,13,1,1200],
 [2074,'2026-05-04',40,'EU','MobileSeriesCupQual','MobileSeriesCup_MarQualifier10','MarQualifier 10','Reo',4,148,10,12,0,700],
 [2075,'2026-04-06',40,'EU','MobileSeriesCupQual','MobileSeriesCup_MarQualifier8','MarQualifier 8','Reo',8,119,10,9,0,500],
 [2076,'2026-03-09',39,'EU','MobileSeriesCupMarQual','MobileSeriesCup_MarQualifier7','MarQualifier 7','Reo',2,91,10,10,1,900],
 [2079,'2026-02-06',39,'EU','MobileTestCup','MobileTestCup_Final','Final','Reo',2,89,6,9,1,250],
 [2080,'2026-02-06',39,'EU','MobileTestCup','MobileTestCup_Final','Final','Grape',3,82,6,2,1,200],
 [2081,'2026-10-11',42,'NAC','MobileVictoryCup_ReloadminiV','MobileVictoryCup_Event4_Round2','Event 4 · Round 2','Reo',9,100,4,21,1,50],
 [2082,'2026-10-11',42,'NAC','MobileVictoryCup_ReloadminiV','MobileVictoryCup_Event4_Round2','Event 4 · Round 2','hazerita_FNM',32,100,6,8,1,50]
];
const hash=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
const uuid=url=>{try{return new URL(url).searchParams.get('id')?.toLowerCase()}catch{return null}};
function project(x){
 const [shot,date,s,region,eventSuffix,windowSuffix,stage,player,rank,points,matches,kills,vrs,prize]=x;
 const seasonId='S'+s,season=s-38,eventId=seasonId+'_'+eventSuffix,windowId=seasonId+'_'+windowSuffix+'_'+region;
 const isTest=eventSuffix==='MobileTestCup',isMini=s===42;
 const event=isTest?'Touch-Only Test Cup':isMini?'Mobile Reload (Mini Venture) Victory Cup':'Mobile Series';
 const tournamentId='ch7s'+season+'-'+(isTest?'touch-only-test-cup':isMini?'mobile-reload-mini-venture-victory-cup':'mobile-series-monthly-qualifier');
 const [raw,id]=profiles[player],profileUrl='https://fortnitetracker.com/profile/all/'+encodeURIComponent(raw)+'/events?id='+id;
 const source='https://fortnitetracker.com/events/epicgames_'+eventId+'_'+region+'?window='+windowId;
 const rule=isTest?TEST:isMini?MINI:SERIES;
 const note='ユーザー提供Tracker画像'+shot+'・本人Epic ID・開催枠照合。'+rank+'位、'+points+'pt、'+matches+'試合、'+kills+'キル、'+vrs+'VR、個人賞金$'+prize+'。'+(isMini?'公式1VR=$50。':isTest?'公式順位賞金。':'賞金付きQualifierの順位賞金。Group Stage進出とは区別。')+' 実際の支払完了は未確認。公式根拠: '+rule;
 return {id:'owner-mobile-20261126-'+shot,date,region,player,players:[player],playerRaw:raw,event,round:stage+' / 賞金決勝',rank,points,matches,kills,vrs,prize,prizePerPlayer:prize,teamPrize:prize,kind:'賞金決勝',seasonId,chapter:7,season,tournamentId,source,profileUrl,profiles:[{name:player,url:profileUrl}],verified:true,note};
}
function approval(x){const r=project(x);return {id:r.id,recordId:r.id,decision:'published',policy:POLICY,approvedAt:'2026-11-26T10:21:01Z',approvedBy:'Owner screenshots and supplied Tracker Epic UUIDs',source:r.source,rule:r.event==='Mobile Series'?SERIES:r.event==='Touch-Only Test Cup'?TEST:MINI,originalHash:hash(x),recordHash:hash(r),evidence:'Exact screenshot rank, points, kills, matches, wins and award; official session and prize rules'};}
function verifyRow(r,e){const x=GOLD.find(x=>r?.id==='owner-mobile-20261126-'+x[0]);return Boolean(x&&e&&JSON.stringify(e)===JSON.stringify(approval(x))&&JSON.stringify(r)===JSON.stringify(project(x)));}
module.exports={GOLD,profiles,POLICY,project,approval,verifyRow,uuid};
