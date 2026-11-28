'use strict';
// Owner-provided Tracker screenshots, exact dates, ranks and original Epic UUIDs.
const crypto=require('node:crypto');
const POLICY='verified-mobile-oce-20261129';
const SERIES='https://www.fortnite.com/competitive/rules-guidelines/rules-library/fortnite-mobile-series-chapter-7-official-rules';
const EARLY='https://www.fortnite.com/competitive/rules-guidelines/rules-library/1-million-dollar-fortnite-mobile-series-battle-it-out-in-blitz';
const MINI='https://www.fortnite.com/competitive/rules-guidelines/rules-library/fortnite-mobile-victory-cups-chapter-7-season-4-official-rules';
const profiles={
  "MMC KAAN BABA": [
    "KAAN BABA GOTY",
    "2bf3a503-80fa-49ff-a655-2c23c2e384cf"
  ],
  "gurabon": [
    "yotta guɿäʙöɴ-ɷ-",
    "389794a1-6b87-4df9-b412-34d9da42f2a3"
  ],
  "Reo": [
    "Reo",
    "25945a39-f156-4a22-aab8-ea7808feac98"
  ],
  "GR ここより世界に痛みを": [
    "GR ここより世界に痛みを",
    "3117887e-72f6-4a96-b05e-a97a49a9e251"
  ],
  "あくりあ": [
    "あくりあ",
    "852a62b1-d38b-4072-b1c2-01460f27a9ca"
  ]
};
// Image order (1–10), JST date, season, region, event suffix, window suffix,
// stage, canonical name, rank, points, matches, eliminations, VR, USD.
const GOLD=[
 [1,"2026-10-17",42,"OCE","MobileVictoryCup_ReloadminiV","MobileVictoryCup_Event5_Round2","Event 5 · Round 2","MMC KAAN BABA",11,100,4,9,1,50],
 [2,"2026-10-10",42,"OCE","MobileVictoryCup_ReloadminiV","MobileVictoryCup_Event4_Round2","Event 4 · Round 2","gurabon",5,100,1,6,1,50],
 [3,"2026-10-10",42,"OCE","MobileVictoryCup_ReloadminiV","MobileVictoryCup_Event4_Round2","Event 4 · Round 2","Reo",10,100,4,15,1,50],
 [4,"2026-10-03",42,"OCE","MobileVictoryCup_ReloadminiV","MobileVictoryCup_Event3_Round2","Event 3 · Round 2","gurabon",6,100,5,26,1,50],
 [5,"2026-10-03",42,"OCE","MobileVictoryCup_ReloadminiV","MobileVictoryCup_Event3_Round2","Event 3 · Round 2","Reo",7,100,6,31,1,50],
 [6,"2026-09-26",42,"OCE","MobileVictoryCup_ReloadminiV","MobileVictoryCup_Event2_Round2","Event 2 · Round 2","MMC KAAN BABA",4,200,5,16,2,100],
 [7,"2026-09-26",42,"OCE","MobileVictoryCup_ReloadminiV","MobileVictoryCup_Event2_Round2","Event 2 · Round 2","Reo",8,100,6,23,1,50],
 [8,"2026-09-26",42,"OCE","MobileVictoryCup_ReloadminiV","MobileVictoryCup_Event2_Round2","Event 2 · Round 2","GR ここより世界に痛みを",12,100,4,13,1,50],
 [9,"2026-09-26",42,"OCE","MobileVictoryCup_ReloadminiV","MobileVictoryCup_Event2_Round2","Event 2 · Round 2","あくりあ",22,100,6,11,1,50],
 [10,"2026-09-19",42,"OCE","MobileVictoryCup_ReloadminiV","MobileVictoryCup_Event1_Round2","Event 1 · Round 2","Reo",1,400,6,45,4,200]
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
 const note='2026/11/29ユーザー提供OCE Tracker画像'+shot+'・本人Epic ID・開催枠照合。'+rank+'位、'+points+'pt、'+matches+'試合、'+kills+'キル、'+vrs+'VR、個人賞金$'+prize+'。'+(isMini?'公式1VR=$50。':isHeat?'Heatsの順位賞金。上位4名のQualifier進出とは別で、当該順位は未突破。サイト賞金決勝カテゴリは本戦決勝を意味しない。':'賞金付きQualifierの順位賞金。Group Stage進出とは区別。')+' 実際の支払完了は未確認。公式根拠: '+ruleFor(x);
 return {id:'owner-mobile-oce-20261129-'+String(shot).padStart(2,'0'),date,region,player,players:[player],playerRaw:raw,event,round:stage+' / 賞金決勝',rank,points,matches,kills,vrs,prize,prizePerPlayer:prize,teamPrize:prize,kind:'賞金決勝',seasonId,chapter:7,season,tournamentId,source,profileUrl,profiles:[{name:player,url:profileUrl}],verified:true,note};
}
function awardValid(x){
 const r=project(x);
 return x[2]===42&&r.region==='OCE'&&r.prize===50*r.vrs&&r.points===100*r.vrs&&r.matches>=1&&r.matches<=6&&r.vrs<=r.matches;
}
function approval(x){const r=project(x);return {id:r.id,recordId:r.id,decision:'published',policy:POLICY,approvedAt:'2026-11-28T15:17:30Z',approvedBy:'Owner screenshots and supplied Tracker Epic UUIDs',source:r.source,rule:ruleFor(x),originalHash:hash(x),recordHash:hash(r),evidence:'Exact screenshot rank, points, kills, matches, wins and award; official session and prize rules'};}
function verifyRow(r,e){const x=GOLD.find(x=>r?.id===project(x).id);return Boolean(x&&awardValid(x)&&e&&JSON.stringify(e)===JSON.stringify(approval(x))&&JSON.stringify(r)===JSON.stringify(project(x)));}
module.exports={GOLD,profiles,POLICY,project,approval,verifyRow,uuid,awardValid};
