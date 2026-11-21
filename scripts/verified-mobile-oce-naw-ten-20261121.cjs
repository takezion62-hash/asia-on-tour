'use strict';
// Immutable audit of the user's screenshots 2008–2017 and exact Tracker account IDs.
// A placement cash award in Mobile Series does not prove qualifier advancement.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const ROOT=path.resolve(__dirname,'..');
const DOC=JSON.parse(fs.readFileSync(path.join(ROOT,'data/manual-approvals/20261121-mobile-oce-naw-ten.json'),'utf8'));
const POLICY='verified-mobile-oce-naw-ten-20261121';
const must=(ok,why)=>{if(!ok)throw Error('MOBILE_OCE_NAW_TEN_PROOF '+why)};
const digest=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const json=p=>JSON.parse(fs.readFileSync(path.join(ROOT,p),'utf8'));
function epicId(uri){
 try{const u=new URL(uri);
  if(u.protocol!=='https:'||u.hostname!=='fortnitetracker.com'||!u.pathname.startsWith('/profile/all/')||u.searchParams.size!==1)return null;
  const id=u.searchParams.get('id');
  return /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/iu.test(id||'')?id.toLowerCase():null;
 }catch{return null}
}
const OFFICIAL={
 series:'https://www.fortnite.com/competitive/rules-guidelines/rules-library/fortnite-mobile-series-chapter-7-official-rules',
 first:'https://www.fortnite.com/competitive/rules-guidelines/rules-library/1-million-dollar-fortnite-mobile-series-battle-it-out-in-blitz',
 mini:'https://www.fortnite.com/competitive/rules-guidelines/rules-library/fortnite-mobile-victory-cups-chapter-7-season-3-official-rules'
};
const M={
 nawFeb:{seasonId:'S39',chapter:7,season:1,date:'2026-02-23',region:'NAW',event:'Mobile Series',eventId:'S39_MobileSeriesCupFebQual',windowId:'S39_MobileSeriesCup_FebQualifier6_NAW',tournamentId:'ch7s1-mobile-series-february-qualifier',mode:'zero-build',round:'February Qualifier 6 / 賞金決勝',rule:OFFICIAL.first},
 oceFeb:{seasonId:'S39',chapter:7,season:1,date:'2026-02-22',region:'OCE',event:'Mobile Series',eventId:'S39_MobileSeriesCupFebQual',windowId:'S39_MobileSeriesCup_FebQualifier6_OCE',tournamentId:'ch7s1-mobile-series-february-qualifier',mode:'zero-build',round:'February Qualifier 6 / 賞金決勝',rule:OFFICIAL.first},
 julyHeat:{seasonId:'S41',chapter:7,season:3,date:'2026-07-25',region:'OCE',event:'Mobile Series Heats',eventId:'S41_MobileSeriesHeat2',windowId:'S41_MobileSeriesHeat2July_OCE',tournamentId:'ch7s3-mobile-series-heats',mode:'zero-build',round:'Heat 2 · July / 賞金決勝',rule:OFFICIAL.series},
 juneMini:{seasonId:'S41',chapter:7,season:3,date:'2026-06-21',region:'OCE',event:'Mobile Reload (Mini Venture) Victory Cup',eventId:'S41_MobileVictoryCup_ReloadminiV',windowId:'S41_MobileVictoryCup_Day1_Round2_ReloadminiV_OCE',tournamentId:'ch7s3-mobile-reload-mini-venture-victory-cup',mode:'reload-zero-build',round:'Day 1 · Round 2 / 賞金決勝',rule:OFFICIAL.mini},
 juneHeat:{seasonId:'S41',chapter:7,season:3,date:'2026-06-20',region:'OCE',event:'Mobile Series Heats',eventId:'S41_MobileSeriesHeat1',windowId:'S41_MobileSeriesHeat1June_OCE',tournamentId:'ch7s3-mobile-series-heats',mode:'zero-build',round:'Heat 1 · June / 賞金決勝',rule:OFFICIAL.series}
};
// Screenshot, stage, rank, canonical player, Tracker name, exact Epic UUID,
// points, matches, kills, victory royales, personal prize in USD.
const GOLD=[
[2008,'nawFeb',2,'Grape','שًٍَِّ今際の際שًٍَِّ','7a19efe1-b04c-47b1-9963-a30a95276437',103,10,8,1,600],
[2009,'nawFeb',6,'Reo','Reo','25945a39-f156-4a22-aab8-ea7808feac98',71,10,8,1,250],
[2010,'nawFeb',13,'モバイル勢のまかろん','モバイル勢のまかろん','facede25-f8fd-4f47-be4d-ecb0796abd33',54,10,2,0,100],
[2011,'julyHeat',11,'モバイル勢のまかろん','モバイル勢のまかろん','facede25-f8fd-4f47-be4d-ecb0796abd33',64,3,10,1,100],
[2012,'julyHeat',13,'MMC KAAN BABA','MMC KAAN BABA','2bf3a503-80fa-49ff-a655-2c23c2e384cf',53,4,8,0,100],
[2013,'juneMini',9,'モバイル勢のまかろん','モバイル勢のまかろん','facede25-f8fd-4f47-be4d-ecb0796abd33',100,6,19,1,50],
[2014,'juneHeat',8,'モバイル勢のまかろん','モバイル勢のまかろん','facede25-f8fd-4f47-be4d-ecb0796abd33',84,6,9,0,150],
[2015,'oceFeb',1,'Reo','Reo','25945a39-f156-4a22-aab8-ea7808feac98',134,10,17,4,700],
[2016,'oceFeb',6,'あくりあ','あくりあ','852a62b1-d38b-4072-b1c2-01460f27a9ca',85,10,7,0,250],
[2017,'oceFeb',7,'yotta guɿäʙöɴ-ɷ-','yotta guɿäʙöɴ-ɷ-','389794a1-6b87-4df9-b412-34d9da42f2a3',79,10,4,1,250]
];
const idFor=(stage,rank)=>{const m=M[stage];return 'owner-'+m.seasonId.toLowerCase()+'-'+m.region.toLowerCase()+'-'+stage+'-'+m.date.replace(/-/g,'')+'-r'+rank};
const trackerFor=m=>'https://fortnitetracker.com/events/epicgames_'+m.eventId+'_'+m.region+'?window='+m.windowId;
function validateProof(){
 const expected=DOC.expected,b=DOC.batch;
 must(DOC.version===1&&b.id==='owner-s39-s41-mobile-oce-naw-ten-20261121'&&
  b.reviewedOn==='2026-11-21'&&b.entries.length===10&&expected.rows===10&&
  expected.personalPrize===2550&&expected.teamPrize===2550&&expected.vrTotal===9&&
  JSON.stringify(expected.knownPlayers)===JSON.stringify(['Grape','Reo','モバイル勢のまかろん','MMC KAAN BABA','あくりあ','yotta guɿäʙöɴ-ɷ-'])&&JSON.stringify(expected.newPlayers)===JSON.stringify([]),
  'source metadata');
 const catalog=json('tournaments.json').catalog,rules=json('tournament-rules.json').rules;
 const ids=new Set(),places=new Set(),uids=new Map();
 for(let i=0;i<GOLD.length;i++){
  const [shot,stage,rank,name,rawName,uid,points,matches,kills,vrs,prize]=GOLD[i];
  const m=M[stage],x=b.entries[i];
  must(x&&x.id===idFor(stage,rank)&&x.screenshot===shot&&x.stage===stage&&
   x.seasonId===m.seasonId&&x.chapter===m.chapter&&x.season===m.season&&
   x.date===m.date&&x.region===m.region&&x.event===m.event&&
   x.eventId===m.eventId&&x.windowId===m.windowId&&
   x.tournamentId===m.tournamentId&&x.mode===m.mode&&x.round===m.round&&
   x.kind==='賞金決勝'&&x.rule===m.rule&&x.source===trackerFor(m)&&
   x.name===name&&x.rawName===rawName&&x.epicUUID===uid&&epicId(x.profileUrl)===uid&&
   decodeURIComponent(new URL(x.profileUrl).pathname.split('/').at(-2))===rawName&&
   x.rank===rank&&x.points===points&&x.matches===matches&&
   x.kills===kills&&x.vrs===vrs&&x.prize===prize,
   'altered screenshot '+shot);
  must(!ids.has(x.id)&&!places.has(m.windowId+'/'+rank),'duplicate rank/record '+shot);
  ids.add(x.id);places.add(m.windowId+'/'+rank);
  must(!uids.has(uid)||uids.get(uid)===name,'account identity conflict '+shot);
  uids.set(uid,name);
  const t=catalog.find(y=>y.id===m.tournamentId);
  must(t&&t.name===m.event&&t.seasonId===m.seasonId&&t.mode===m.mode&&
   t.platform==='mobile'&&t.team==='solo'&&t.sourceEventIds.includes(m.eventId)&&
   t.evidence?.some(y=>y.url===m.rule),'catalog / rule mismatch '+shot);
  if(stage==='juneMini')must(prize===50*vrs&&vrs===1&&
    rules.some(y=>y.id===m.tournamentId&&y.prizePerVictory===50&&
      y.eventIds.includes(m.eventId)),'June Mini Venture $50 per VR');
  if(stage==='juneHeat'||stage==='julyHeat')
    must(rank>4&&prize===(rank<=8?150:100),
      'OCE Heat prize is not top-four advancement');
  if(stage==='nawFeb'||stage==='oceFeb')
    must(
      (stage==='nawFeb'&&((rank===2&&prize===600)||(rank===6&&prize===250)||(rank===13&&prize===100)))||
      (stage==='oceFeb'&&((rank===1&&prize===700)||(rank===6&&prize===250)||(rank===7&&prize===250))),
      'February qualifier placement prizes are not VR prizes');
 }
 must(b.entries.reduce((n,x)=>n+x.prize,0)===2550&&
  b.entries.reduce((n,x)=>n+x.vrs,0)===9,'total cash and VR');
 return true;
}
function noteFor(x){
 const base='ユーザー提供Tracker画像'+x.screenshot+'。'+x.rank+'位、'+x.points+
  'pt、'+x.matches+'試合、'+x.kills+'キル、'+x.vrs+'VR、個人賞金$'+x.prize+'。';
 const detail={
 nawFeb:'2026年2月NAW Mobile Series February Qualifier 6。モバイルBlitz Royaleソロ（サイトのZero Build分類）。賞金は順位に基づくもので、1VRの単価ではない。6月以前のGroup Stage進出は原則地域1位のみ。',
 oceFeb:'2026年2月OCE Mobile Series February Qualifier 6。モバイルBlitz Royaleソロ（サイトのZero Build分類）。賞金は順位に基づき、優勝の順位とVR数の賞金を二重計算しない。6月以前のGroup Stage進出は原則地域1位のみ。',
 juneHeat:'2026年6月OCE Mobile Series Heat 1。上位4名のみ次のQualifierへ進出。8位は$150の順位賞金対象だがHeats突破とは扱わない。',
 julyHeat:'2026年7月OCE Mobile Series Heat 2。上位4名のみ次のQualifierへ進出。11位・13位は$100の順位賞金対象だがHeats突破とは扱わない。',
 juneMini:'2026年6月OCE Mobile Reload (Mini Venture) Victory Cup Day1 Round2決勝。Solo Zero Build Reload・公式1VR=$50。順位賞金ではない。'
 }[x.stage];
 return base+detail+' 受領/振込完了は未確認。Leaderboard: '+x.source+' 公式規定: '+x.rule;
}
function project(x){return {id:x.id,date:x.date,region:x.region,player:x.name,players:[x.name],
 playerRaw:x.rawName,event:x.event,round:x.round,rank:x.rank,points:x.points,matches:x.matches,
 kills:x.kills,vrs:x.vrs,prize:x.prize,prizePerPlayer:x.prize,teamPrize:x.prize,kind:x.kind,
 seasonId:x.seasonId,chapter:x.chapter,season:x.season,tournamentId:x.tournamentId,
 source:x.source,profileUrl:x.profileUrl,profiles:[{name:x.name,url:x.profileUrl}],
 verified:true,note:noteFor(x)}}
function approval(x){const row=project(x);return {id:x.id,recordId:x.id,decision:'published',
 policy:POLICY,approvedAt:'2026-11-21T05:57:28Z',
 approvedBy:'Owner screenshots 2008–2017, exact Tracker Epic UUID and Epic official rules',
 source:x.source,rule:x.rule,originalHash:digest(x),recordHash:digest(row),
 evidence:'Mobile Series Feb qualifier placement prizes; OCE paid Heats nonadvancement; June Mini Venture final 1VR=$50'};}
function verifyRow(row,a){
 const x=DOC.batch.entries.find(y=>y.id===row?.id);
 return Boolean(x&&a&&a.id===row.id&&a.recordId===row.id&&a.decision==='published'&&
  a.policy===POLICY&&a.source===x.source&&a.rule===x.rule&&
  a.originalHash===digest(x)&&a.recordHash===digest(row)&&row.verified===true&&
  JSON.stringify(row)===JSON.stringify(project(x)));}
validateProof();
module.exports={DOC,POLICY,GOLD,M,OFFICIAL,idFor,epicId,validateProof,project,approval,verifyRow};
