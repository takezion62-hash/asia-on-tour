'use strict';
// Independent immutable owner screenshot proof; series award and advancement are separate.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const ROOT=path.resolve(__dirname,'..');
const DOC=JSON.parse(fs.readFileSync(path.join(ROOT,'data/manual-approvals/20261121-mobile-series-ten.json'),'utf8'));
const POLICY='verified-mobile-series-ten-20261121';
const must=(x,m)=>{if(!x)throw Error('MOBILE_TEN_PROOF '+m)};
const digest=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
const json=p=>JSON.parse(fs.readFileSync(path.join(ROOT,p),'utf8'));
function epicId(uri){try{let u=new URL(uri);if(u.protocol!=='https:'||u.hostname!=='fortnitetracker.com'||!u.pathname.startsWith('/profile/all/')||u.searchParams.size!==1)return null;let id=u.searchParams.get('id');return /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/iu.test(id||'')?id.toLowerCase():null}catch{return null}}
const OFFICIAL={
 series:'https://www.fortnite.com/competitive/rules-guidelines/rules-library/fortnite-mobile-series-chapter-7-official-rules',
 first:'https://www.fortnite.com/competitive/rules-guidelines/rules-library/1-million-dollar-fortnite-mobile-series-battle-it-out-in-blitz',
 season3:'https://www.fortnite.com/competitive/rules-guidelines/rules-library/fortnite-mobile-victory-cups-chapter-7-season-3-official-rules',
 season4:'https://www.fortnite.com/competitive/rules-guidelines/rules-library/fortnite-mobile-victory-cups-chapter-7-season-4-official-rules'
};
const M={
 nacHeat:{seasonId:'S41',season:3,date:'2026-08-16',region:'NAC',event:'Mobile Series Heats',eventId:'S41_MobileSeriesHeat4',windowId:'S41_MobileSeriesHeat4Aug_NAC',tournamentId:'ch7s3-mobile-series-heats',mode:'zero-build',round:'Heat 4 · August / 賞金決勝',rule:OFFICIAL.series},
 nawMini:{seasonId:'S42',season:4,date:'2026-10-18',region:'NAW',event:'Mobile Reload (Mini Venture) Victory Cup',eventId:'S42_MobileVictoryCup_ReloadminiV',windowId:'S42_MobileVictoryCup_Event5_Round2_NAW',tournamentId:'ch7s4-mobile-reload-mini-venture-victory-cup',mode:'reload-zero-build',round:'Event 5 · Round 2 / 賞金決勝',rule:OFFICIAL.season4},
 elite:{seasonId:'S41',season:3,date:'2026-08-18',region:'NAW',event:'Mobile Reload (Elite Stronghold) Victory Cup',eventId:'S41_MobileVictoryCup_RES',windowId:'S41_MobileVictoryCup_Day5_Round2_RES_NAW',tournamentId:'ch7s3-mobile-reload-elite-stronghold-victory-cup',mode:'reload',round:'Day 5 · Round 2 / 賞金決勝',rule:OFFICIAL.season3},
 nawHeat:{seasonId:'S41',season:3,date:'2026-08-16',region:'NAW',event:'Mobile Series Heats',eventId:'S41_MobileSeriesHeat4',windowId:'S41_MobileSeriesHeat4Aug_NAW',tournamentId:'ch7s3-mobile-series-heats',mode:'zero-build',round:'Heat 4 · August / 賞金決勝',rule:OFFICIAL.series},
 may:{seasonId:'S40',season:2,date:'2026-05-04',region:'NAW',event:'Mobile Series',eventId:'S40_MobileSeriesCupQual',windowId:'S40_MobileSeriesCup_MarQualifier10_NAW',tournamentId:'ch7s2-mobile-series-monthly-qualifier',mode:'zero-build',round:'MarQualifier 10 / 賞金決勝',rule:OFFICIAL.first},
 apr:{seasonId:'S40',season:2,date:'2026-04-06',region:'NAW',event:'Mobile Series',eventId:'S40_MobileSeriesCupQual',windowId:'S40_MobileSeriesCup_MarQualifier8_NAW',tournamentId:'ch7s2-mobile-series-monthly-qualifier',mode:'zero-build',round:'MarQualifier 8 / 賞金決勝',rule:OFFICIAL.first}
};
// Screenshot order, stage, rank, canonical identity, original Tracker name,
// exact Epic UUID, points, matches, eliminations, VRs, individual USD.
const GOLD=[
[1,'nacHeat',10,'モバイル勢のまかろん','モバイル勢のまかろん','facede25-f8fd-4f47-be4d-ecb0796abd33',79,6,16,0,150],
[2,'nawMini',14,'yotta guɿäʙöɴ-ɷ-','yotta guɿäʙöɴ-ɷ-','389794a1-6b87-4df9-b412-34d9da42f2a3',100,5,14,1,50],
[3,'nawMini',16,'Grape','שًٍَِّ今際の際שًٍَِّ','7a19efe1-b04c-47b1-9963-a30a95276437',100,6,16,1,50],
[4,'nawMini',17,'モバイル勢のまかろん','モバイル勢のまかろん','facede25-f8fd-4f47-be4d-ecb0796abd33',100,6,15,1,50],
[5,'nawMini',18,'MMC KAAN BABA','MMC KAAN BABA','2bf3a503-80fa-49ff-a655-2c23c2e384cf',100,6,14,1,50],
[6,'elite',10,'モバイル勢のまかろん','モバイル勢のまかろん','facede25-f8fd-4f47-be4d-ecb0796abd33',100,2,4,1,100],
[7,'nawHeat',13,'モバイル勢のまかろん','モバイル勢のまかろん','facede25-f8fd-4f47-be4d-ecb0796abd33',48,6,7,0,100],
[8,'may',10,'yotta guɿäʙöɴ-ɷ-','yotta guɿäʙöɴ-ɷ-','389794a1-6b87-4df9-b412-34d9da42f2a3',100,10,4,0,200],
[9,'may',11,'モバイル勢のまかろん','モバイル勢のまかろん','facede25-f8fd-4f47-be4d-ecb0796abd33',98,10,3,1,200],
[10,'apr',6,'モバイル勢のまかろん','モバイル勢のまかろん','facede25-f8fd-4f47-be4d-ecb0796abd33',134,10,3,0,250]
];
const idFor=(stage,rank)=>{const m=M[stage];return 'owner-'+m.seasonId.toLowerCase()+'-'+m.region.toLowerCase()+'-'+stage+'-'+m.date.replace(/-/g,'')+'-r'+rank};
const trackerFor=m=>'https://fortnitetracker.com/events/epicgames_'+m.eventId+'_'+m.region+'?window='+m.windowId;
function validateProof(){
 const e=DOC.expected,b=DOC.batch;
 must(DOC.version===1&&b.id==='owner-s40-s41-s42-mobile-ten-20261121'&&b.reviewedOn==='2026-11-21'&&b.entries.length===10&&e.rows===10&&e.personalPrize===1200&&e.teamPrize===1200&&e.vrTotal===6&&JSON.stringify(e.knownPlayers)===JSON.stringify(['モバイル勢のまかろん','yotta guɿäʙöɴ-ɷ-','Grape','MMC KAAN BABA'])&&JSON.stringify(e.newPlayers)===JSON.stringify([]),'source metadata');
 const catalog=json('tournaments.json').catalog,rules=json('tournament-rules.json').rules,seen=new Set(),places=new Set(),uids=new Map();
 for(let i=0;i<GOLD.length;i++){
  const [shot,stage,rank,name,rawName,uid,points,matches,kills,vrs,prize]=GOLD[i],m=M[stage],x=b.entries[i];
  must(x&&x.id===idFor(stage,rank)&&x.screenshot===shot&&x.stage===stage&&x.seasonId===m.seasonId&&x.chapter===7&&x.season===m.season&&x.date===m.date&&x.region===m.region&&x.event===m.event&&x.eventId===m.eventId&&x.windowId===m.windowId&&x.tournamentId===m.tournamentId&&x.mode===m.mode&&x.round===m.round&&x.kind==='賞金決勝'&&x.rule===m.rule&&x.source===trackerFor(m)&&x.name===name&&x.rawName===rawName&&x.epicUUID===uid&&epicId(x.profileUrl)===uid&&decodeURIComponent(new URL(x.profileUrl).pathname.split('/').at(-2))===rawName&&x.rank===rank&&x.points===points&&x.matches===matches&&x.kills===kills&&x.vrs===vrs&&x.prize===prize,'altered screenshot '+shot);
  must(!seen.has(x.id)&&!places.has(m.windowId+'/'+rank),'duplicate rank/record '+shot);seen.add(x.id);places.add(m.windowId+'/'+rank);
  must(!uids.has(uid)||uids.get(uid)===name,'Epic UUID identity mismatch '+shot);uids.set(uid,name);
  const t=catalog.find(y=>y.id===m.tournamentId);
  must(t&&t.name===m.event&&t.seasonId===m.seasonId&&t.mode===m.mode&&t.team==='solo'&&t.platform==='mobile'&&t.sourceEventIds.includes(m.eventId)&&t.evidence?.some(y=>y.url===m.rule),'catalog/official rule conflict '+shot);
  switch(stage){
   case 'nacHeat':must(rank===10&&prize===150&&vrs===0&&t.series==='mobile-series','NAC Heat prize/top4');break;
   case 'nawHeat':must(rank===13&&prize===100&&vrs===0&&t.series==='mobile-series','NAW Heat prize/top4');break;
   case 'nawMini':must(prize===vrs*50&&vrs===1&&matches<=6&&t.mode==='reload-zero-build'&&rules.some(y=>y.id===t.id&&y.prizePerVictory===50),'Mini Venture $50/VR');break;
   case 'elite':must(prize===vrs*100&&vrs===1&&matches<=3&&t.mode==='reload','Elite Stronghold BUILD reload $100/VR');break;
   case 'may':must(((rank===10||rank===11)&&prize===200)&&t.series==='mobile-series','May NAW S40 official placement prizes');break;
   case 'apr':must(rank===6&&prize===250&&t.series==='mobile-series','April NAW S40 official placement prize');break;
   default:throw Error('unknown stage');
  }
 }
 must(b.entries.reduce((n,x)=>n+x.prize,0)===1200&&b.entries.reduce((n,x)=>n+x.vrs,0)===6,'total payout / VR');
 return true;
}
function noteFor(x){
 const p='ユーザー提供Tracker画像'+x.screenshot+'。'+x.rank+'位、'+x.points+'pt、'+x.matches+'試合、'+x.kills+'キル、'+x.vrs+'VR、個人賞金$'+x.prize+'。';
 const detail={
 nacHeat:'Mobile Series August Heat 4 NAC。NAC9〜12位$150、各Heat上位4名だけがQualifierへ進出。10位は賞金獲得、Heats突破なし。賞金付きHeatsをサイトの賞金決勝カテゴリに格納しているが、本戦決勝ではない。',
 nawHeat:'Mobile Series August Heat 4 NAW。NAW9〜16位$100、各Heat上位4名だけがQualifierへ進出。13位は賞金獲得、Heats突破なし。賞金付きHeatsカテゴリ表示で本戦決勝ではない。',
 nawMini:'Mobile Reload (Mini Venture) Event 5 Round 2、ソロMini Venture Zero Build Reload。1VRごと個人$50。順位賞金ではない。',
 elite:'Mobile Reload (Elite Stronghold) Day 5 Round 2、ソロ通常Reload（建築あり）。1VRごと個人$100。Zero Build版とは別大会。順位賞金ではない。',
 may:'2026年5月4日NAW Mobile Series（Blitz Royale、サイト形式分類Zero Build）。Trackerウィンドウ名はMarQualifier10。NAW10〜11位$200、6月1日以前のGroup Stage原則進出は各地域1位だけ。順位賞金は進出証拠ではない。',
 apr:'2026年4月6日NAW Mobile Series（Blitz Royale、サイト形式分類Zero Build）。Trackerウィンドウ名はMarQualifier8。NAW6位$250、6月1日以前のGroup Stage原則進出は各地域1位だけ。順位賞金は進出証拠ではない。'
 }[x.stage];
 return p+detail+' 実際の賞金振込完了は未確認。大会出典: '+x.source+' 公式ルール: '+x.rule;
}
function project(x){
 return {id:x.id,date:x.date,region:x.region,player:x.name,players:[x.name],playerRaw:x.rawName,event:x.event,round:x.round,rank:x.rank,points:x.points,matches:x.matches,kills:x.kills,vrs:x.vrs,prize:x.prize,prizePerPlayer:x.prize,teamPrize:x.prize,kind:x.kind,seasonId:x.seasonId,chapter:x.chapter,season:x.season,tournamentId:x.tournamentId,source:x.source,profileUrl:x.profileUrl,profiles:[{name:x.name,url:x.profileUrl}],verified:true,note:noteFor(x)};
}
function approval(x){const r=project(x);return {id:x.id,recordId:x.id,decision:'published',policy:POLICY,approvedAt:'2026-11-21T03:18:36Z',approvedBy:'Owner ten screenshots, Tracker Epic ID and Epic rules',source:x.source,rule:x.rule,originalHash:digest(x),recordHash:digest(r),evidence:'Mobile Series Heat 4 cash without top-four advancement; S40 NAW Qualifier placement awards; Elite Stronghold Reload $100/VR; Mini Venture Reload ZB $50/VR'};}
function verifyRow(row,a){const x=DOC.batch.entries.find(y=>y.id===row?.id);return Boolean(x&&a&&a.id===row.id&&a.recordId===row.id&&a.decision==='published'&&a.policy===POLICY&&a.source===x.source&&a.rule===x.rule&&a.originalHash===digest(x)&&a.recordHash===digest(row)&&row.verified===true&&JSON.stringify(row)===JSON.stringify(project(x)));}
validateProof();
module.exports={DOC,POLICY,GOLD,M,OFFICIAL,idFor,epicId,validateProof,project,approval,verifyRow};
