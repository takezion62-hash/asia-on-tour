'use strict';
// Owner-provided Tracker screenshots, exact dates, ranks and original Epic UUIDs.
const crypto=require('node:crypto');
const POLICY='verified-mobile-nac-naw-20261127';
const SERIES='https://www.fortnite.com/competitive/rules-guidelines/rules-library/fortnite-mobile-series-chapter-7-official-rules';
const EARLY='https://www.fortnite.com/competitive/rules-guidelines/rules-library/1-million-dollar-fortnite-mobile-series-battle-it-out-in-blitz';
const MINI='https://www.fortnite.com/competitive/rules-guidelines/rules-library/fortnite-mobile-victory-cups-chapter-7-season-4-official-rules';
const profiles={
 Reo:['Reo','25945a39-f156-4a22-aab8-ea7808feac98'],
 gurabon:['yotta guɿäʙöɴ-ɷ-','389794a1-6b87-4df9-b412-34d9da42f2a3']
};
// Image order (1–10), JST date, season, region, event suffix, window suffix,
// stage, canonical name, rank, points, matches, eliminations, VR, USD.
const GOLD=[
 [1,'2026-10-04',42,'NAC','MobileVictoryCup_ReloadminiV','MobileVictoryCup_Event3_Round2','Event 3 · Round 2','Reo',12,100,4,17,1,50],
 [2,'2026-10-04',42,'NAC','MobileVictoryCup_ReloadminiV','MobileVictoryCup_Event3_Round2','Event 3 · Round 2','gurabon',30,100,6,14,1,50],
 [3,'2026-09-20',42,'NAC','MobileVictoryCup_ReloadminiV','MobileVictoryCup_Event1_Round2','Event 1 · Round 2','Reo',2,200,4,28,2,100],
 [4,'2026-08-16',41,'NAC','MobileSeriesHeat3','MobileSeriesHeat3Aug','Heat 3 · August','Reo',7,111,6,16,0,200],
 [5,'2026-08-02',41,'NAC','MobileSeriesCupQual','MobileSeriesCup_MarQualifier13','MarQualifier 13','Reo',4,115,6,22,1,900],
 [6,'2026-06-21',41,'NAC','MobileSeriesHeat1','MobileSeriesHeat1June','Heat 1 · June','Reo',8,85,6,14,0,200],
 [7,'2026-06-21',41,'NAC','MobileSeriesHeat1','MobileSeriesHeat1June','Heat 1 · June','gurabon',16,65,6,7,0,100],
 [8,'2026-04-20',40,'NAC','MobileSeriesCupQual','MobileSeriesCup_MarQualifier9','MarQualifier 9','Reo',2,152,10,12,2,900],
 [9,'2026-01-26',39,'NAC','MobileSeriesCupJanQual','MobileSeriesCup_JanQualifier4','January Qualifier 4','Reo',7,77,10,3,1,500],
 [10,'2026-10-11',42,'NAW','MobileVictoryCup_ReloadminiV','MobileVictoryCup_Event4_Round2','Event 4 · Round 2','Reo',14,100,6,22,1,50]
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
 const note='2026/11/27ユーザー提供Tracker画像'+shot+'・本人Epic ID・開催枠照合。'+rank+'位、'+points+'pt、'+matches+'試合、'+kills+'キル、'+vrs+'VR、個人賞金$'+prize+'。'+(isMini?'公式1VR=$50。':isHeat?'Heatsの順位賞金。上位4名のQualifier進出とは別で、当該順位は未突破。サイト賞金決勝カテゴリは本戦決勝を意味しない。':'賞金付きQualifierの順位賞金。Group Stage進出とは区別。')+' 実際の支払完了は未確認。公式根拠: '+ruleFor(x);
 return {id:'owner-mobile-20261127-'+String(shot).padStart(2,'0'),date,region,player,players:[player],playerRaw:raw,event,round:stage+' / 賞金決勝',rank,points,matches,kills,vrs,prize,prizePerPlayer:prize,teamPrize:prize,kind:'賞金決勝',seasonId,chapter:7,season,tournamentId,source,profileUrl,profiles:[{name:player,url:profileUrl}],verified:true,note};
}
function awardValid(x){
 const r=project(x);
 if(x[2]===42)return r.prize===50*r.vrs&&r.points===100*r.vrs&&r.matches<=6;
 if(r.event==='Mobile Series Heats')return r.region==='NAC'&&r.prize===(r.rank>=5&&r.rank<=8?200:r.rank>=9&&r.rank<=12?150:r.rank>=13&&r.rank<=16?100:-1);
 return r.region==='NAC'&&r.prize===(x[2]===41?({4:900})[r.rank]:({2:900,7:500})[r.rank]);
}
function approval(x){const r=project(x);return {id:r.id,recordId:r.id,decision:'published',policy:POLICY,approvedAt:'2026-11-27T12:53:29Z',approvedBy:'Owner screenshots and supplied Tracker Epic UUIDs',source:r.source,rule:ruleFor(x),originalHash:hash(x),recordHash:hash(r),evidence:'Exact screenshot rank, points, kills, matches, wins and award; official session and prize rules'};}
function verifyRow(r,e){const x=GOLD.find(x=>r?.id===project(x).id);return Boolean(x&&awardValid(x)&&e&&JSON.stringify(e)===JSON.stringify(approval(x))&&JSON.stringify(r)===JSON.stringify(project(x)));}
module.exports={GOLD,profiles,POLICY,project,approval,verifyRow,uuid,awardValid};
