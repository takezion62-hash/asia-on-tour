'use strict';
// Owner screenshots 1986–1994, independent Epic award tables and exact account UUIDs.
// A cash-paying "Heats" is not a final qualifier or confirmed advancement.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const ROOT=path.resolve(__dirname,'..');
const DOC=JSON.parse(fs.readFileSync(path.join(ROOT,'data/manual-approvals/20261121-mobile-series-nine.json'),'utf8'));
const POLICY='verified-mobile-series-nine-20261121';
const must=(yes,why)=>{if(!yes)throw Error('MOBILE_NINE_PROOF '+why)};
const digest=v=>crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex');
const json=p=>JSON.parse(fs.readFileSync(path.join(ROOT,p),'utf8'));
function epicId(uri){
 try{const u=new URL(uri);if(u.protocol!=='https:'||u.hostname!=='fortnitetracker.com'||
  !u.pathname.startsWith('/profile/all/')||u.searchParams.size!==1)return null;
  const val=u.searchParams.get('id');return /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/iu.test(val||'')?val.toLowerCase():null;
 }catch{return null}
}
const OFFICIAL={
 series:'https://www.fortnite.com/competitive/rules-guidelines/rules-library/fortnite-mobile-series-chapter-7-official-rules',
 first:'https://www.fortnite.com/competitive/rules-guidelines/rules-library/1-million-dollar-fortnite-mobile-series-battle-it-out-in-blitz',
 br:'https://www.fortnite.com/competitive/rules-guidelines/rules-library/fortnite-mobile-victory-cups-chapter-7-season-3-official-rules',
 mini:'https://www.fortnite.com/competitive/rules-guidelines/rules-library/fortnite-mobile-victory-cups-chapter-7-season-4-official-rules'
};
const M={
 br:{seasonId:'S41',chapter:7,season:3,date:'2026-06-29',region:'EU',
  event:'Mobile Battle Royale Victory Cup',eventId:'S41_MobileVictoryCup_BR',
  windowId:'S41_MobileVictoryCup_Day2_Round2_BR_EU',
  tournamentId:'ch7s3-mobile-battle-royale-victory-cup',mode:'battle-royale',
  round:'Day 2 · Round 2 / 賞金決勝',rule:OFFICIAL.br},
 heat:{seasonId:'S41',chapter:7,season:3,date:'2026-06-21',region:'EU',
  event:'Mobile Series Heats',eventId:'S41_MobileSeriesHeat3',
  windowId:'S41_MobileSeriesHeat3June_EU',
  tournamentId:'ch7s3-mobile-series-heats',mode:'zero-build',
  round:'Heat 3 · June / 賞金決勝',rule:OFFICIAL.series},
 feb:{seasonId:'S39',chapter:7,season:1,date:'2026-02-23',region:'EU',
  event:'Mobile Series',eventId:'S39_MobileSeriesCupFebQual',
  windowId:'S39_MobileSeriesCup_FebQualifier6_EU',
  tournamentId:'ch7s1-mobile-series-february-qualifier',mode:'zero-build',
  round:'February Qualifier 6 / 賞金決勝',rule:OFFICIAL.first},
 jan:{seasonId:'S39',chapter:7,season:1,date:'2026-01-13',region:'EU',
  event:'Mobile Series',eventId:'S39_MobileSeriesCupJanQual',
  windowId:'S39_MobileSeriesCup_JanQualifier3_EU',
  tournamentId:'ch7s1-mobile-series-january-qualifier',mode:'zero-build',
  round:'January Qualifier 3 / 賞金決勝',rule:OFFICIAL.first},
 mini:{seasonId:'S42',chapter:7,season:4,date:'2026-09-27',region:'NAC',
  event:'Mobile Reload (Mini Venture) Victory Cup',eventId:'S42_MobileVictoryCup_ReloadminiV',
  windowId:'S42_MobileVictoryCup_Event2_Round2_NAC',
  tournamentId:'ch7s4-mobile-reload-mini-venture-victory-cup',mode:'reload-zero-build',
  round:'Event 2 · Round 2 / 賞金決勝',rule:OFFICIAL.mini}
};
// Screenshot #, exact stage/window, rank, canonical account, immutable Epic UUID,
// points, matches, eliminations, Victory Royales, individual dollars.
const GOLD=[
 [1986,'br',22,'モバイル勢のまかろん','facede25-f8fd-4f47-be4d-ecb0796abd33',100,3,5,1,100],
 [1987,'heat',10,'モバイル勢のまかろん','facede25-f8fd-4f47-be4d-ecb0796abd33',78,5,9,0,150],
 [1988,'feb',9,'Reo','25945a39-f156-4a22-aab8-ea7808feac98',69,10,11,0,200],
 [1989,'feb',12,'モバイル勢のまかろん','facede25-f8fd-4f47-be4d-ecb0796abd33',50,10,2,0,200],
 [1990,'jan',4,'あくりあ','852a62b1-d38b-4072-b1c2-01460f27a9ca',97,10,4,0,700],
 [1991,'jan',12,'モバイル勢のまかろん','facede25-f8fd-4f47-be4d-ecb0796abd33',46,8,3,1,200],
 [1992,'mini',8,'あくりあ','852a62b1-d38b-4072-b1c2-01460f27a9ca',200,6,13,2,100],
 [1993,'mini',26,'モバイル勢のまかろん','facede25-f8fd-4f47-be4d-ecb0796abd33',100,3,9,1,50],
 [1994,'mini',34,'yotta guɿäʙöɴ-ɷ-','389794a1-6b87-4df9-b412-34d9da42f2a3',100,6,15,1,50]
];
const idFor=(stage,rank)=>{
 const m=M[stage];return 'owner-'+m.seasonId.toLowerCase()+'-'+m.region.toLowerCase()+
  '-'+stage+'-'+m.date.replace(/-/g,'')+'-r'+rank;
};
const trackerFor=m=>'https://fortnitetracker.com/events/epicgames_'+m.eventId+
  '_'+m.region+'?window='+m.windowId;
function validateProof(){
 const b=DOC.batch,e=DOC.expected;
 must(DOC.version===1&&b?.id==='owner-s39-s41-s42-mobile-nine-20261121'&&
  b.reviewedOn==='2026-11-21'&&b.entries?.length===9&&e.rows===9&&
  e.personalPrize===1750&&e.teamPrize===1750&&e.vrTotal===6&&
  JSON.stringify(e.knownPlayers)===JSON.stringify(['モバイル勢のまかろん','Reo','あくりあ','yotta guɿäʙöɴ-ɷ-'])&&
  JSON.stringify(e.newPlayers)===JSON.stringify([]),'source metadata');
 const cat=json('tournaments.json').catalog,rules=json('tournament-rules.json').rules;
 const used=new Set(),ranked=new Set(),uids=new Map();
 for(let i=0;i<GOLD.length;i++){
  const [shot,stage,rank,name,uid,points,matches,kills,vrs,prize]=GOLD[i],
   m=M[stage],x=b.entries[i];
  must(x&&x.id===idFor(stage,rank)&&x.screenshot===shot&&x.stage===stage&&
   x.seasonId===m.seasonId&&x.chapter===m.chapter&&x.season===m.season&&
   x.date===m.date&&x.region===m.region&&x.event===m.event&&
   x.eventId===m.eventId&&x.windowId===m.windowId&&
   x.tournamentId===m.tournamentId&&x.mode===m.mode&&x.round===m.round&&
   x.kind==='賞金決勝'&&x.rule===m.rule&&x.source===trackerFor(m)&&
   x.name===name&&x.rawName===name&&x.epicUUID===uid&&
   epicId(x.profileUrl)===uid&&
   decodeURIComponent(new URL(x.profileUrl).pathname.split('/').at(-2))===name&&
   x.rank===rank&&x.points===points&&x.matches===matches&&
   x.kills===kills&&x.vrs===vrs&&x.prize===prize,
   'altered screenshot '+shot);
  must(!used.has(x.id)&&!ranked.has(m.windowId+'/'+rank),'duplicate screenshot '+shot);
  used.add(x.id);ranked.add(m.windowId+'/'+rank);
  must(!uids.has(uid)||uids.get(uid)===name,'Epic UUID ownership conflict '+shot);
  uids.set(uid,name);
  const t=cat.find(y=>y.id===m.tournamentId);
  must(t&&t.name===m.event&&t.seasonId===m.seasonId&&
   t.team==='solo'&&t.platform==='mobile'&&t.mode===m.mode&&
   t.sourceEventIds.includes(m.eventId)&&t.evidence?.some(q=>q.url===m.rule),
   'wrong event classification/rule '+shot);
  switch(stage){
   case 'jan':case 'feb':
    must((rank===4&&prize===700)||(rank===9&&prize===200)||
       (rank===12&&prize===200),'2026 pre-June EU qualifier placement award');
    must(prize!==vrs*100,'qualifier incorrectly awarded by VR '+shot);
    break;
   case 'heat':
    must(rank===10&&prize===150&&vrs===0&&
     t.series==='mobile-series'&&t.mode==='zero-build',
     'EU Heats 9th-12th cash award, nonadvancement');
    break;
   case 'br':
    must(vrs===1&&prize===100&&
     t.series==='victory-cup'&&m.mode==='battle-royale',
     'EU Mobile BR Round2 is $100 per VR');break;
   case 'mini':
    must(prize===50*vrs&&vrs>=1&&matches<=6&&
     t.series==='victory-cup'&&t.mode==='reload-zero-build'&&
     rules.some(y=>y.id===m.tournamentId&&y.prizePerVictory===50),
     'NAC Mini Venture Round2 is $50 per VR');break;
   default:throw Error('unknown stage');
  }
 }
 must(b.entries.reduce((n,x)=>n+x.prize,0)===1750&&
  b.entries.reduce((n,x)=>n+x.vrs,0)===6,'cash/VR totals');
 return true;
}
function noteFor(x){
 const common='ユーザー提供Tracker画像'+x.screenshot+'。'+x.rank+'位、'+x.points+
  'pt、'+x.matches+'試合、'+x.kills+'キル、'+x.vrs+'VR、個人賞金$'+x.prize+'。';
 const specific={
  jan:'2026年1月Mobile SeriesのBlitz Royaleソロ（Tracker分類：Zero Build）・January Qualifier 3。Epic発表のEU4位$700/12位$200。2026年6月以前のGroup Stage原則進出枠は各地域1位のみ。入賞＝本戦進出ではない。',
  feb:'2026年2月Mobile SeriesのBlitz Royaleソロ（Tracker分類：Zero Build）・February Qualifier 6。Epic発表のEU9～12位$200。Group Stage進出と順位賞金を混同しない。',
  heat:'2026年6月Mobile Series Heat 3。EU Heats 9～12位$150。各Heat上位4名のみ次のQualifierへ進出するため10位はHeats未突破。大会区分の「賞金決勝」はサイトの賞金付きラウンド表示上の分類で、実際のステージはHeatsであり最終予選ではない。',
  br:'Mobile Battle Royale Victory Cup Day 2 Round 2。Epic公式1VRにつき個人$100。順位22位による順位賞金ではない。',
  mini:'Mobile Reload (Mini Venture) Victory Cup Event 2 Round 2。Mini Venture Zero Build Reloadソロ。Epic公式1VRにつき個人$50。順位賞金ではない。'
 }[x.stage];
 return common+specific+' 実際の賞金送金完了は未確認。Leaderboard: '+
   x.source+' 公式根拠: '+x.rule;
}
function project(x){
 return {id:x.id,date:x.date,region:x.region,player:x.name,players:[x.name],
  playerRaw:x.rawName,event:x.event,round:x.round,rank:x.rank,
  points:x.points,matches:x.matches,kills:x.kills,vrs:x.vrs,prize:x.prize,
  prizePerPlayer:x.prize,teamPrize:x.prize,kind:x.kind,seasonId:x.seasonId,
  chapter:x.chapter,season:x.season,tournamentId:x.tournamentId,
  source:x.source,profileUrl:x.profileUrl,
  profiles:[{name:x.name,url:x.profileUrl}],verified:true,note:noteFor(x)};
}
function approval(x){
 const row=project(x);
 return {id:x.id,recordId:x.id,decision:'published',policy:POLICY,
  approvedAt:'2026-11-21T02:34:23Z',
  approvedBy:'Owner screenshots 1986-1994, Tracker Epic UUID and Epic cash rules',
  source:x.source,rule:x.rule,originalHash:digest(x),recordHash:digest(row),
  evidence:'Mobile Series placement-based January/February qualifiers, paid EU Heat3 (no advancement), and per-VR Mobile Battle Royale and Mini Venture finals'};
}
function verifyRow(row,a){
 const x=DOC.batch.entries.find(y=>y.id===row?.id);
 return Boolean(x&&a&&a.id===row.id&&a.recordId===row.id&&
  a.decision==='published'&&a.policy===POLICY&&
  a.source===x.source&&a.rule===x.rule&&
  a.originalHash===digest(x)&&a.recordHash===digest(row)&&
  row.verified===true&&JSON.stringify(row)===JSON.stringify(project(x)));
}
validateProof();
module.exports={DOC,POLICY,GOLD,M,OFFICIAL,idFor,epicId,validateProof,project,approval,verifyRow};
