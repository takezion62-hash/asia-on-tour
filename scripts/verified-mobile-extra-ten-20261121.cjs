'use strict';
// Independent screenshot evidence for 2018–2027. Preserve original Tracker
// stage/window IDs, screenshot values, Epic UUIDs and published totals.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const ROOT=path.resolve(__dirname,'..');
const DOC=JSON.parse(fs.readFileSync(path.join(ROOT,'data/manual-approvals/20261121-mobile-jan-oct-extra-ten.json'),'utf8'));
const POLICY='verified-mobile-jan-oct-extra-ten-20261121';
const must=(ok,reason)=>{if(!ok)throw Error('MOBILE_EXTRA_TEN_PROOF '+reason)};
const digest=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
const json=p=>JSON.parse(fs.readFileSync(path.join(ROOT,p),'utf8'));
function epicId(uri){
 try{
  const u=new URL(uri),id=u.searchParams.get('id');
  if(u.protocol!=='https:'||u.hostname!=='fortnitetracker.com'||
   !u.pathname.startsWith('/profile/all/')||u.searchParams.size!==1)return null;
  return /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/iu.test(id||'')?id.toLowerCase():null;
 }catch{return null}
}
const OFFICIAL={
 first:'https://www.fortnite.com/competitive/rules-guidelines/rules-library/1-million-dollar-fortnite-mobile-series-battle-it-out-in-blitz',
 series:'https://www.fortnite.com/competitive/rules-guidelines/rules-library/fortnite-mobile-series-chapter-7-official-rules',
 mini:'https://www.fortnite.com/competitive/rules-guidelines/rules-library/fortnite-mobile-victory-cups-chapter-7-season-4-official-rules'
};
const M={
 febOce:{seasonId:'S39',season:1,date:'2026-02-22',region:'OCE',event:'Mobile Series',eventId:'S39_MobileSeriesCupFebQual',windowId:'S39_MobileSeriesCup_FebQualifier6_OCE',tournamentId:'ch7s1-mobile-series-february-qualifier',mode:'zero-build',round:'February Qualifier 6 / 賞金決勝',rule:OFFICIAL.first},
 janOce:{seasonId:'S39',season:1,date:'2026-01-12',region:'OCE',event:'Mobile Series',eventId:'S39_MobileSeriesCupJanQual',windowId:'S39_MobileSeriesCup_JanQualifier3_OCE',tournamentId:'ch7s1-mobile-series-january-qualifier',mode:'zero-build',round:'January Qualifier 3 / 賞金決勝',rule:OFFICIAL.first},
 mayBr:{seasonId:'S40',season:2,date:'2026-05-18',region:'BR',event:'Mobile Series',eventId:'S40_MobileSeriesCupQual',windowId:'S40_MobileSeriesCup_MarQualifier11_BR',tournamentId:'ch7s2-mobile-series-monthly-qualifier',mode:'zero-build',round:'MarQualifier 11 / 賞金決勝',rule:OFFICIAL.first},
 aprBr:{seasonId:'S40',season:2,date:'2026-04-20',region:'BR',event:'Mobile Series',eventId:'S40_MobileSeriesCupQual',windowId:'S40_MobileSeriesCup_MarQualifier9_BR',tournamentId:'ch7s2-mobile-series-monthly-qualifier',mode:'zero-build',round:'MarQualifier 9 / 賞金決勝',rule:OFFICIAL.first},
 octMe:{seasonId:'S42',season:4,date:'2026-10-11',region:'ME',event:'Mobile Reload (Mini Venture) Victory Cup',eventId:'S42_MobileVictoryCup_ReloadminiV',windowId:'S42_MobileVictoryCup_Event4_Round2_ME',tournamentId:'ch7s4-mobile-reload-mini-venture-victory-cup',mode:'reload-zero-build',round:'Event 4 · Round 2 / 賞金決勝',rule:OFFICIAL.mini},
 augMe:{seasonId:'S41',season:3,date:'2026-08-01',region:'ME',event:'Mobile Series',eventId:'S41_MobileSeriesCupQual',windowId:'S41_MobileSeriesCup_MarQualifier13_ME',tournamentId:'ch7s3-mobile-series-monthly-qualifier',mode:'zero-build',round:'MarQualifier 13 / 賞金決勝',rule:OFFICIAL.series}
};
// Screenshot, stage, rank, canonical name, immutable Epic UUID,
// points, matches, kills, victory royales, individual USD prize.
const GOLD=[
[2018,'febOce',9,'モバイル勢のまかろん','facede25-f8fd-4f47-be4d-ecb0796abd33',58,10,4,0,200],
[2019,'janOce',1,'モバイル勢のまかろん','facede25-f8fd-4f47-be4d-ecb0796abd33',128,10,11,2,700],
[2020,'janOce',2,'あくりあ','852a62b1-d38b-4072-b1c2-01460f27a9ca',90,10,3,2,600],
[2021,'janOce',5,'yotta guɿäʙöɴ-ɷ-','389794a1-6b87-4df9-b412-34d9da42f2a3',88,10,3,1,250],
[2022,'janOce',10,'klutzfnm','667d1c83-3242-4b44-9144-065a67e31401',62,9,8,2,200],
[2023,'mayBr',14,'モバイル勢のまかろん','facede25-f8fd-4f47-be4d-ecb0796abd33',66,10,3,0,100],
[2024,'aprBr',4,'モバイル勢のまかろん','facede25-f8fd-4f47-be4d-ecb0796abd33',151,10,11,1,400],
[2025,'octMe',10,'Reo','25945a39-f156-4a22-aab8-ea7808feac98',100,4,14,1,50],
[2026,'octMe',14,'モバイル勢のまかろん','facede25-f8fd-4f47-be4d-ecb0796abd33',100,4,12,1,50],
[2027,'augMe',1,'Reo','25945a39-f156-4a22-aab8-ea7808feac98',119,6,19,0,1200]
];
const idFor=(stage,rank)=>{const m=M[stage];return 'owner-'+m.seasonId.toLowerCase()+'-'+m.region.toLowerCase()+'-'+stage+'-'+m.date.replace(/-/g,'')+'-r'+rank};
const trackerFor=m=>'https://fortnitetracker.com/events/epicgames_'+m.eventId+'_'+m.region+'?window='+m.windowId;
function validateProof(){
 const b=DOC.batch,e=DOC.expected;
 must(DOC.version===1&&b.id==='owner-mobile-jan-oct-extra-ten-20261121'&&
 b.reviewedOn==='2026-11-21'&&b.entries.length===10&&e.rows===10&&
 e.personalPrize===3750&&e.teamPrize===3750&&e.vrTotal===10&&
 JSON.stringify(e.knownPlayers)===JSON.stringify(['モバイル勢のまかろん','あくりあ','yotta guɿäʙöɴ-ɷ-','Reo'])&&
 JSON.stringify(e.newPlayers)===JSON.stringify(['klutzfnm']),'batch metadata');
 const catalog=json('tournaments.json').catalog,rules=json('tournament-rules.json').rules;
 const ids=new Set(),ranks=new Set(),uidNames=new Map();
 for(let i=0;i<GOLD.length;i++){
  const [shot,stage,rank,name,uid,points,matches,kills,vrs,prize]=GOLD[i],m=M[stage],x=b.entries[i];
  must(x&&x.id===idFor(stage,rank)&&x.screenshot===shot&&x.stage===stage&&
   x.seasonId===m.seasonId&&x.chapter===7&&x.season===m.season&&
   x.date===m.date&&x.region===m.region&&x.event===m.event&&
   x.eventId===m.eventId&&x.windowId===m.windowId&&x.tournamentId===m.tournamentId&&
   x.mode===m.mode&&x.round===m.round&&x.kind==='賞金決勝'&&
   x.name===name&&x.rawName===name&&x.epicUUID===uid&&
   epicId(x.profileUrl)===uid&&
   decodeURIComponent(new URL(x.profileUrl).pathname.split('/').at(-2))===name&&
   x.rule===m.rule&&x.source===trackerFor(m)&&
   x.rank===rank&&x.points===points&&x.matches===matches&&
   x.kills===kills&&x.vrs===vrs&&x.prize===prize,'altered screenshot '+shot);
  must(!ids.has(x.id)&&!ranks.has(m.windowId+'/'+rank),'duplicate screenshot '+shot);
  ids.add(x.id);ranks.add(m.windowId+'/'+rank);
  must(!uidNames.has(uid)||uidNames.get(uid)===name,'Epic UUID identity conflict '+shot);
  uidNames.set(uid,name);
  const t=catalog.find(y=>y.id===m.tournamentId);
  must(t&&t.name===m.event&&t.seasonId===m.seasonId&&
   t.team==='solo'&&t.platform==='mobile'&&t.mode===m.mode&&
   t.sourceEventIds.includes(m.eventId)&&t.evidence?.some(ev=>ev.url===m.rule),
   'catalog or source-backed event mismatch '+shot);
  if(stage==='octMe')must(prize===50*vrs&&vrs===1&&
   rules.some(y=>y.id===m.tournamentId&&y.prizePerVictory===50&&
    y.eventIds.includes(m.eventId)),'Mobile Mini Venture $50 per VR');
  else{
   const award={febOce:{9:200},janOce:{1:700,2:600,5:250,10:200},mayBr:{14:100},aprBr:{4:400},augMe:{1:1200}}[stage];
   must(t.series==='mobile-series'&&award&&award[rank]===prize,
    'Mobile Series award is by placement, not VR or advancement '+shot);
  }
 }
 must(b.entries.reduce((n,x)=>n+x.prize,0)===3750&&
 b.entries.reduce((n,x)=>n+x.vrs,0)===10,'total cash or VR');
 return true;
}
function noteFor(x){
 const intro='ユーザー提供Tracker画像'+x.screenshot+'。'+x.rank+'位、'+x.points+'pt、'+x.matches+'試合、'+x.kills+'キル、'+x.vrs+'VR、個人賞金$'+x.prize+'。';
 const desc={
 febOce:'2026/02/22 OCE February Qualifier 6。既存のReo・あくりあ・yottaと同じ開催枠。9位は順位賞金でGroup Stage進出とは区別。',
 janOce:'2026/01/12 OCE January Qualifier 3。Mobile Blitz Royale solo。順位賞金は勝利回数ごとの報酬ではなく、Group Stage進出は原則地域1位のみ。',
 mayBr:'2026/05/18 BR。Tracker IDはMarQualifier11。窓名Marと実開催日を混同しない。14位順位賞金、進出扱いにしない。',
 aprBr:'2026/04/20 BR。Tracker IDはMarQualifier9。4位順位賞金、進出扱いにしない。',
 octMe:'2026/10/11 ME Mobile Reload Mini Venture Event4 Round2賞金決勝。ソロZero Build Reload、公式個人1VR=$50。順位賞金と二重計算しない。',
 augMe:'2026/08/01 ME Mobile Series。Tracker窓名MarQualifier13。1位$1,200は順位賞金。0VRでも賞金が発生しており、VRによる賞金ではない。'
 }[x.stage];
 return intro+desc+' 実際の振込完了は未確認。大会出典: '+x.source+' 公式規定: '+x.rule;
}
function project(x){return {
 id:x.id,date:x.date,region:x.region,player:x.name,players:[x.name],
 playerRaw:x.rawName,event:x.event,round:x.round,rank:x.rank,points:x.points,matches:x.matches,
 kills:x.kills,vrs:x.vrs,prize:x.prize,prizePerPlayer:x.prize,teamPrize:x.prize,kind:x.kind,
 seasonId:x.seasonId,chapter:x.chapter,season:x.season,tournamentId:x.tournamentId,
 source:x.source,profileUrl:x.profileUrl,profiles:[{name:x.name,url:x.profileUrl}],
 verified:true,note:noteFor(x)
}}
function approval(x){const row=project(x);return {
 id:x.id,recordId:x.id,decision:'published',policy:POLICY,
 approvedAt:'2026-11-21T07:18:39Z',
 approvedBy:'Owner screenshots 2018–2027, exact Epic Tracker UUID and official Epic prize rules',
 source:x.source,rule:x.rule,originalHash:digest(x),recordHash:digest(row),
 evidence:'2026 paid Mobile Series qualifier placement cash, same-day February OCE grouping, Mini Venture 1VR=$50'
}}
function verifyRow(row,entry){
 const x=DOC.batch.entries.find(y=>y.id===row?.id);
 return Boolean(x&&entry&&entry.id===row.id&&entry.recordId===row.id&&
 entry.decision==='published'&&entry.policy===POLICY&&
 entry.source===x.source&&entry.rule===x.rule&&
 entry.originalHash===digest(x)&&entry.recordHash===digest(row)&&
 row.verified===true&&JSON.stringify(row)===JSON.stringify(project(x)));
}
validateProof();
module.exports={DOC,POLICY,GOLD,M,OFFICIAL,idFor,epicId,validateProof,project,approval,verifyRow};
