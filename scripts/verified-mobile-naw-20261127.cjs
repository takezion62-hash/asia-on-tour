'use strict';
// Owner-provided Tracker screenshots, exact dates, ranks and original Epic UUIDs.
const crypto=require('node:crypto');
const POLICY='verified-mobile-naw-20261127';
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
  "hazerita_FNM": [
    "hazerita_FNM",
    "fc9b92b9-91d6-4cb0-a4a3-688fc4d2ac03"
  ],
  "Grape": [
    "שًٍَِّ今際の際שًٍَِّ",
    "7a19efe1-b04c-47b1-9963-a30a95276437"
  ]
};
// Image order (1–10), JST date, season, region, event suffix, window suffix,
// stage, canonical name, rank, points, matches, eliminations, VR, USD.
const GOLD=[
 [1,"2026-10-04",42,"NAW","MobileVictoryCup_ReloadminiV","MobileVictoryCup_Event3_Round2","Event 3 · Round 2","Reo",1,400,6,26,4,200],
 [2,"2026-09-27",42,"NAW","MobileVictoryCup_ReloadminiV","MobileVictoryCup_Event2_Round2","Event 2 · Round 2","Reo",3,200,6,40,2,100],
 [3,"2026-09-20",42,"NAW","MobileVictoryCup_ReloadminiV","MobileVictoryCup_Event1_Round2","Event 1 · Round 2","Reo",10,100,6,23,1,50],
 [4,"2026-09-20",42,"NAW","MobileVictoryCup_ReloadminiV","MobileVictoryCup_Event1_Round2","Event 1 · Round 2","あくりあ",18,100,6,14,1,50],
 [5,"2026-09-20",42,"NAW","MobileVictoryCup_ReloadminiV","MobileVictoryCup_Event1_Round2","Event 1 · Round 2","hazerita_FNM",22,100,6,11,1,50],
 [6,"2026-08-17",41,"NAW","MobileSeriesCupQual","MobileSeriesCup_MarQualifier14","MarQualifier 14","Reo",6,111,6,20,0,600],
 [7,"2026-08-02",41,"NAW","MobileSeriesCupQual","MobileSeriesCup_MarQualifier13","MarQualifier 13","Reo",4,121,6,15,1,700],
 [8,"2026-06-21",41,"NAW","MobileSeriesHeat1","MobileSeriesHeat1June","Heat 1 · June","Reo",5,124,6,22,1,150],
 [9,"2026-06-21",41,"NAW","MobileSeriesHeat1","MobileSeriesHeat1June","Heat 1 · June","Grape",14,47,6,7,0,100],
 [10,"2026-05-18",40,"NAW","MobileSeriesCupQual","MobileSeriesCup_MarQualifier11","MarQualifier 11","Reo",5,157,10,11,1,250]
];
const hash=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
const uuid=url=>{try{const u=new URL(url);const id=u.searchParams.get('id');return u.protocol==='https:'&&u.hostname==='fortnitetracker.com'&&u.pathname.startsWith('/profile/all/')&&/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id||'')?id.toLowerCase():null}catch{return null}};
const ruleFor=x=>x[2]===42?MINI:x[2]<=40?EARLY:SERIES;
function project(x){
 const [shot,date,s,region,eventSuffix,windowSuffix,stage,player,rank,points,matches,kills,vrs,prize]=x;
 const seasonId='S'+s,season=s-38,eventId=seasonId+'_'+eventSuffix,windowId=seasonId+'_'+windowSuffix+'_'+region;
 const isMini=s===42,isHeat=eventSuffix.startsWith('MobileSeriesHeat');
 const event=isMini?'Mobile Reload (Mini Venture) Victory Cup':isHeat?'Mobile Series Heats':'Mobile Series';
 const tournamentId='ch7s'+season+'-'+(isMini?'mobile-reload-mini-venture-victory-cup':isHeat?'mobile-series-heats':s===39?'mobile-series-january-qualifier':'mobile-series-monthly-qualifier');
 const [raw,id]=profiles[player],profileUrl='https://fortnitetracker.com/profile/all/'+encodeURIComponent(raw)+'/events?id='+id;
 const source='https://fortnitetracker.com/events/epicgames_'+eventId+'_'+region+'?window='+windowId;
 const note='2026/11/27ユーザー提供NAW Tracker画像'+shot+'・本人Epic ID・開催枠照合。'+rank+'位、'+points+'pt、'+matches+'試合、'+kills+'キル、'+vrs+'VR、個人賞金$'+prize+'。'+(isMini?'公式1VR=$50。':isHeat?'Heatsの順位賞金。上位4名のQualifier進出とは別で、当該順位は未突破。サイト賞金決勝カテゴリは本戦決勝を意味しない。':'賞金付きQualifierの順位賞金。Group Stage進出とは区別。')+' 実際の支払完了は未確認。公式根拠: '+ruleFor(x);
 return {id:'owner-mobile-naw-20261127-'+String(shot).padStart(2,'0'),date,region,player,players:[player],playerRaw:raw,event,round:stage+' / 賞金決勝',rank,points,matches,kills,vrs,prize,prizePerPlayer:prize,teamPrize:prize,kind:'賞金決勝',seasonId,chapter:7,season,tournamentId,source,profileUrl,profiles:[{name:player,url:profileUrl}],verified:true,note};
}
function awardValid(x){
 const r=project(x);
 if(x[2]===42)return r.prize===50*r.vrs&&r.points===100*r.vrs&&r.matches<=6;
 if(r.event==='Mobile Series Heats')return r.region==='NAW'&&r.prize===(r.rank>=5&&r.rank<=8?150:r.rank>=9&&r.rank<=16?100:-1);
 return r.region==='NAW'&&r.prize===(x[2]===41?({4:700,6:600})[r.rank]:({5:250})[r.rank]);
}
function approval(x){const r=project(x);return {id:r.id,recordId:r.id,decision:'published',policy:POLICY,approvedAt:'2026-11-27T13:24:16Z',approvedBy:'Owner screenshots and supplied Tracker Epic UUIDs',source:r.source,rule:ruleFor(x),originalHash:hash(x),recordHash:hash(r),evidence:'Exact screenshot rank, points, kills, matches, wins and award; official session and prize rules'};}
function verifyRow(r,e){const x=GOLD.find(x=>r?.id===project(x).id);return Boolean(x&&awardValid(x)&&e&&JSON.stringify(e)===JSON.stringify(approval(x))&&JSON.stringify(r)===JSON.stringify(project(x)));}
module.exports={GOLD,profiles,POLICY,project,approval,verifyRow,uuid,awardValid};
