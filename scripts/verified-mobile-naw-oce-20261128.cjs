'use strict';
// Owner-provided Tracker screenshots, exact dates, ranks and original Epic UUIDs.
const crypto=require('node:crypto');
const POLICY='verified-mobile-naw-oce-20261128';
const SERIES='https://www.fortnite.com/competitive/rules-guidelines/rules-library/fortnite-mobile-series-chapter-7-official-rules';
const EARLY='https://www.fortnite.com/competitive/rules-guidelines/rules-library/1-million-dollar-fortnite-mobile-series-battle-it-out-in-blitz';
const MINI='https://www.fortnite.com/competitive/rules-guidelines/rules-library/fortnite-mobile-victory-cups-chapter-7-season-4-official-rules';
const profiles={
  "Reo": [
    "Reo",
    "25945a39-f156-4a22-aab8-ea7808feac98"
  ],
  "あくりあ": [
    "あくりあ",
    "852a62b1-d38b-4072-b1c2-01460f27a9ca"
  ],
  "れぼりゅーしょん": [
    "YOTTAれぼりゅーしゅん",
    "34e9b17f-38a3-4b7a-a4a3-65eaab118c9a"
  ],
  "yoru": [
    "1750ドルプレイヤーシルスうお",
    "328560e7-639c-4516-af2d-07708715f675"
  ],
  "Grape": [
    "שًٍَِّ今際の際שًٍَِّ",
    "7a19efe1-b04c-47b1-9963-a30a95276437"
  ]
};
// Image order (1–10), JST date, season, region, event suffix, window suffix,
// stage, canonical name, rank, points, matches, eliminations, VR, USD.
const GOLD=[
 [1,"2026-03-09",39,"NAW","MobileSeriesCupMarQual","MobileSeriesCup_MarQualifier7","MarQualifier 7","Reo",16,23,7,5,0,100],
 [2,"2026-02-09",39,"NAW","MobileSeriesCupFebQual","MobileSeriesCup_FebQualifier5","FebQualifier 5","Reo",1,132,9,8,3,700],
 [3,"2026-02-09",39,"NAW","MobileSeriesCupFebQual","MobileSeriesCup_FebQualifier5","FebQualifier 5","あくりあ",2,117,10,3,0,600],
 [4,"2026-02-09",39,"NAW","MobileSeriesCupFebQual","MobileSeriesCup_FebQualifier5","FebQualifier 5","れぼりゅーしょん",10,46,10,3,0,200],
 [5,"2026-01-26",39,"NAW","MobileSeriesCupJanQual","MobileSeriesCup_JanQualifier4","JanQualifier 4","Reo",5,88,10,7,1,250],
 [6,"2026-01-26",39,"NAW","MobileSeriesCupJanQual","MobileSeriesCup_JanQualifier4","JanQualifier 4","yoru",7,77,10,1,0,250],
 [7,"2026-01-26",39,"NAW","MobileSeriesCupJanQual","MobileSeriesCup_JanQualifier4","JanQualifier 4","あくりあ",11,61,10,8,0,200],
 [8,"2026-10-23",42,"OCE","MobileVictoryCup_ReloadminiV","MobileVictoryCup_Event5_Round2","Event 5 · Round 2","Reo",1,200,4,21,2,100],
 [9,"2026-10-17",42,"OCE","MobileVictoryCup_ReloadminiV","MobileVictoryCup_Event5_Round2","Event 5 · Round 2","Reo",1,200,3,27,2,100],
 [10,"2026-10-17",42,"OCE","MobileVictoryCup_ReloadminiV","MobileVictoryCup_Event5_Round2","Event 5 · Round 2","Grape",10,100,4,11,1,50]
];
const hash=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
const uuid=url=>{try{const u=new URL(url);const id=u.searchParams.get('id');return u.protocol==='https:'&&u.hostname==='fortnitetracker.com'&&u.pathname.startsWith('/profile/all/')&&/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id||'')?id.toLowerCase():null}catch{return null}};
const ruleFor=x=>x[2]===42?MINI:x[2]<=40?EARLY:SERIES;
function project(x){
 const [shot,date,s,region,eventSuffix,windowSuffix,stage,player,rank,points,matches,kills,vrs,prize]=x;
 const seasonId='S'+s,season=s-38,eventId=seasonId+'_'+eventSuffix,windowId=seasonId+'_'+windowSuffix+'_'+region+(shot===8?'_mg':'');
 const isMini=s===42,isHeat=eventSuffix.startsWith('MobileSeriesHeat');
 const event=isMini?'Mobile Reload (Mini Venture) Victory Cup':isHeat?'Mobile Series Heats':'Mobile Series';
 const tournamentId='ch7s'+season+'-'+(isMini?'mobile-reload-mini-venture-victory-cup':isHeat?'mobile-series-heats':s===39&&eventSuffix.endsWith('JanQual')?'mobile-series-january-qualifier':s===39&&eventSuffix.endsWith('FebQual')?'mobile-series-february-qualifier':'mobile-series-monthly-qualifier');
 const [raw,id]=profiles[player],profileUrl='https://fortnitetracker.com/profile/all/'+encodeURIComponent(raw)+'/events?id='+id;
 const source='https://fortnitetracker.com/events/epicgames_'+eventId+'_'+region+'?window='+windowId;
 const note='2026/11/28ユーザー提供NAW/OCE Tracker画像'+shot+'・本人Epic ID・開催枠照合。'+rank+'位、'+points+'pt、'+matches+'試合、'+kills+'キル、'+vrs+'VR、個人賞金$'+prize+'。'+(isMini?'公式1VR=$50。':isHeat?'Heatsの順位賞金。上位4名のQualifier進出とは別で、当該順位は未突破。サイト賞金決勝カテゴリは本戦決勝を意味しない。':'賞金付きQualifierの順位賞金。Group Stage進出とは区別。')+ (shot===8?' Trackerの別開催枠（_mg、10/23）と提供画像の日付を照合。10/17の通常決勝とは別。':'')+' 実際の支払完了は未確認。公式根拠: '+ruleFor(x);
 return {id:'owner-mobile-naw-oce-20261128-'+String(shot).padStart(2,'0'),date,region,player,players:[player],playerRaw:raw,event,round:stage+' / 賞金決勝',rank,points,matches,kills,vrs,prize,prizePerPlayer:prize,teamPrize:prize,kind:'賞金決勝',seasonId,chapter:7,season,tournamentId,source,profileUrl,profiles:[{name:player,url:profileUrl}],verified:true,note};
}
function awardValid(x){
 const r=project(x);
 if(x[2]===42)return r.region==='OCE'&&r.prize===50*r.vrs&&r.points===100*r.vrs&&r.matches<=6;
 if(r.event==='Mobile Series Heats')return r.region==='NAW'&&r.prize===(r.rank>=5&&r.rank<=8?150:r.rank>=9&&r.rank<=16?100:-1);
 return r.region==='NAW'&&x[2]===39&&r.matches<=10&&r.prize===({1:700,2:600,5:250,7:250,10:200,11:200,16:100})[r.rank];
}
function approval(x){const r=project(x);return {id:r.id,recordId:r.id,decision:'published',policy:POLICY,approvedAt:'2026-11-28T14:39:08Z',approvedBy:'Owner screenshots and supplied Tracker Epic UUIDs',source:r.source,rule:ruleFor(x),originalHash:hash(x),recordHash:hash(r),evidence:'Exact screenshot rank, points, kills, matches, wins and award; official session and prize rules'};}
function verifyRow(r,e){const x=GOLD.find(x=>r?.id===project(x).id);return Boolean(x&&awardValid(x)&&e&&JSON.stringify(e)===JSON.stringify(approval(x))&&JSON.stringify(r)===JSON.stringify(project(x)));}
module.exports={GOLD,profiles,POLICY,project,approval,verifyRow,uuid,awardValid};
