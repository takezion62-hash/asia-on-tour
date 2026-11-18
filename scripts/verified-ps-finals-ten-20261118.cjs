'use strict';
// Frozen owner-provided ten Fortnite Tracker snapshots + official Epic reward tiers.
// This source oracle must reject a changed Epic UUID, format, final, score, rank
// or cash claim before any public row is constructed.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const ROOT=path.resolve(__dirname,'..');
const DOC=JSON.parse(fs.readFileSync(path.join(ROOT,'data/manual-approvals/20261118-ps-four-finals-ten.json'),'utf8'));
const POLICY='verified-oce-me-ps-four-finals-ten-20261118';
const RULES=Object.freeze({
 S30:'https://www.fortnite.com/news/fortnite-playstation-cup-chapter-5-season-3-official-rules',
 S33:'https://www.fortnite.com/news/playstation-cup-chapter-6-season-1-official-rules',
 S37:'https://www.fortnite.com/competitive/rules-guidelines/rules-library/playstation-cup-chapter-6-season-4-official-rules'
});
const SESSIONS=Object.freeze({
 S37OCE:{date:'2025-09-04',region:'OCE',seasonId:'S37',chapter:6,season:4,mode:'battle-royale',event:'PlayStation Cup',tournamentId:'ch6s4-playstation-cup',eventId:'S37_PlayStationCup',windowId:'S37_PlayStationCup_Final_OCE'},
 S30OCEBR:{date:'2024-06-29',region:'OCE',seasonId:'S30',chapter:5,season:3,mode:'battle-royale',event:'PlayStation Cup Battle Royale',tournamentId:'ch5s3-playstation-cup-br',eventId:'S30_PlaystationCupJune',windowId:'S30_PlaystationCupJune_Final_OCE'},
 S33MEBR:{date:'2024-12-08',region:'ME',seasonId:'S33',chapter:6,season:1,mode:'battle-royale',event:'PlayStation Cup',tournamentId:'ch6s1-playstation-cup',eventId:'S33_PlaystationCup',windowId:'S33_PlaystationCupFinal_ME'},
 S30OCEZB:{date:'2024-06-30',region:'OCE',seasonId:'S30',chapter:5,season:3,mode:'zero-build',event:'PlayStation Cup Zero Build',tournamentId:'ch5s3-playstation-cup-zb',eventId:'S30_PlaystationCupZBJune',windowId:'S30_PlaystationCupZBJune_Final_OCE'}
});
const ID='ps-';
const TARGETS=Object.freeze([
 // key, player, rank, points, kills, matches, VR, prize, screenshot, UUID
 ['S37OCE','Mofu',10,195,7,6,0,200,1,'b7863190-5b98-47c3-8d34-7af8ea94d4b5'],
 ['S37OCE','Saku',41,112,6,6,0,0,2,'556abff4-657c-4b25-b743-e70b2574f97a'],
 ['S37OCE','ごんた',84,9,3,6,0,0,3,'848254b0-e673-47d2-b5c2-d242eca99a2d'],
 ['S30OCEBR','Mofu',6,95,5,6,2,300,4,'b7863190-5b98-47c3-8d34-7af8ea94d4b5'],
 ['S33MEBR','Mofu',36,118,10,6,0,250,5,'b7863190-5b98-47c3-8d34-7af8ea94d4b5'],
 ['S33MEBR','xyxyxyxyxyxyzz',93,7,0,3,0,0,6,'2efa4bef-89c2-4bec-95aa-1f4041aa5aac'],
 ['S30OCEZB','とまと',25,59,9,6,0,100,7,'6e8019af-c259-4664-b5e1-7273c365d316'],
 ['S30OCEZB','VRS k3nz1xJR',41,35,2,5,0,100,8,'35ac3b8d-870d-40d5-b25d-aec767721188'],
 ['S30OCEZB','はるぱか',56,22,7,6,0,100,9,'e3837a9f-26f0-4f83-bd9e-08f101fbc107'],
 ['S30OCEZB','Mofu',83,5,1,4,0,100,10,'b7863190-5b98-47c3-8d34-7af8ea94d4b5']
]);
const ids=x=>ID+x.seasonId.toLowerCase()+'-'+x.region.toLowerCase()+'-'+
 Object.entries(SESSIONS).find(([,s])=>s.eventId===x.eventId)?.[0].toLowerCase()+
 '-final-'+x.date.replace(/-/g,'')+'-r'+x.rank;
const fail=msg=>{throw Error('PS_FOUR_FINALS_PROOF '+msg)};
const must=(condition,msg)=>{if(!condition)fail(msg)};
const hash=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
function uuid(link){
 try{
  const u=new URL(link);
  if(u.protocol!=='https:'||u.hostname!=='fortnitetracker.com'||!u.pathname.startsWith('/profile/all/')||u.searchParams.size!==1)return null;
  const value=u.searchParams.get('id');
  return /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(value||'')?value.toLowerCase():null;
 }catch{return null}
}
function prizeFor(x){
 if(x.seasonId==='S30'&&x.region==='OCE'){
  const top=[0,650,400,375,350,325,300,275,250,225,200];
  return x.rank<=10?top[x.rank]:x.rank<=100?100:0;
 }
 if(x.seasonId==='S33'&&x.region==='ME')
  return x.rank===1?1500:x.rank===2?875:x.rank===3?625:x.rank<=5?375:x.rank<=40?250:0;
 if(x.seasonId==='S37'&&x.region==='OCE')
  return x.rank===1?1250:x.rank===2?750:x.rank===3?500:x.rank<=5?250:x.rank<=40?200:0;
 return null;
}
function validateProof(){
 must(DOC?.version===1&&DOC.batch?.id==='owner-ps-finals-10-20261118'&&
  DOC.batch.reviewedOn==='2026-11-18'&&Array.isArray(DOC.batch.entries)&&
  DOC.batch.entries.length===TARGETS.length&&
  DOC.expected?.rows===10&&DOC.expected.newPlayers===3&&
  DOC.expected.teamPrize===1150,'wrong fixed batch');
 const seenIds=new Set(),seenUuidName=new Map();
 for(let i=0;i<TARGETS.length;i++){
  const [key,player,rank,points,kills,matches,vrs,prize,screenshot,expectedUuid]=TARGETS[i];
  const x=DOC.batch.entries[i],s=SESSIONS[key];
  must(x&&s,'missing expected scoreboard row');
  for(const [property,value] of Object.entries(s))
   must(x[property]===value,'session or mode changed '+i+' '+property);
  must(x.id===ids(x)&&x.player===player&&x.rank===rank&&
   x.points===points&&x.kills===kills&&x.matches===matches&&
   x.vrs===vrs&&x.prize===prize&&x.screenshot===screenshot&&
   x.rule===RULES[x.seasonId]&&
   x.source==='https://fortnitetracker.com/events/epicgames_'+
    x.eventId+'_'+x.region+'?window='+x.windowId,
   'original screenshot scores, IDs or rules changed '+i);
  must(uuid(x.profileUrl)===expectedUuid,'unexpected Epic ID or untrusted Tracker host '+i);
  must(prizeFor(x)===x.prize,'official Epic reward-tier conflict '+x.id);
  must(Number.isSafeInteger(matches)&&matches>=1&&matches<=6&&
   Number.isSafeInteger(kills)&&kills>=0&&Number.isSafeInteger(vrs)&&
   vrs>=0&&vrs<=matches,'invalid match, kill or win count '+x.id);
  must(!seenIds.has(x.id),'duplicate record identifier');
  seenIds.add(x.id);
  must(!seenUuidName.has(expectedUuid)||seenUuidName.get(expectedUuid)===player,
   'same Epic ID assigned to two different players');
  seenUuidName.set(expectedUuid,player);
  if(player==='とまと')must(x.playerRaw==='とまと','verified existing tomato raw identity mismatch');
  if(player==='ごんた')must(x.playerRaw==='GR go gonta go','confirmed Gonta alias mismatch');
  if(player==='はるぱか')must(x.playerRaw==='Lit どうみてもはるぱか','confirmed Harupaka display mismatch');
 }
 must(DOC.batch.entries.reduce((n,x)=>n+x.prize,0)===1150,'total reward mismatch');
 return true;
}
function project(x){
 const note='ユーザー提供Fortnite Tracker順位表画像'+x.screenshot+'枚目で本人Epic ID・'+
  x.date+' '+x.region+'決勝 '+x.rank+'位 / '+x.points+'pt / '+x.matches+
  '試合 / '+x.kills+'キル / '+x.vrs+'VRを確認。'+
  (x.prize===0?'公式順位別賞金範囲外につき現金$0。':
   'Epic公式順位別賞金$'+x.prize+'を確認（受領済みかは未確認）。')+
  ' 大会順位表: '+x.source+' 公式規則: '+x.rule+
  (x.player==='とまと'?' 2026年9月12日OCE Console ZB Solo VCの登録とEpic IDが一致。':'');
 return {id:x.id,date:x.date,region:x.region,player:x.player,playerRaw:x.playerRaw,
  event:x.event,round:'Final / 賞金決勝',rank:x.rank,points:x.points,
  matches:x.matches,kills:x.kills,vrs:x.vrs,prize:x.prize,
  kind:'賞金決勝',seasonId:x.seasonId,chapter:x.chapter,season:x.season,
  tournamentId:x.tournamentId,source:x.source,profileUrl:x.profileUrl,
  profiles:[{name:x.player,url:x.profileUrl}],verified:true,
  teamPrize:x.prize,prizePerPlayer:x.prize,note};
}
function approval(x){
 const row=project(x);
 return {id:x.id,recordId:x.id,decision:'published',policy:POLICY,
  approvedAt:'2026-11-18T11:53:08Z',
  approvedBy:'ChatGPT / owner screenshots + independent Epic Games official prize table',
  source:x.source,rule:x.rule,originalHash:hash(x),recordHash:hash(row),
  evidence:'Owner screenshots 1-10 (PlayStation Finals 2024/2025), fixed Tracker Epic account UUID, score and official placements'};
}
function verifyRow(row,entry){
 const x=DOC.batch.entries.find(item=>item.id===row?.id);
 if(!x||!entry||entry.policy!==POLICY||entry.id!==row.id||
  entry.recordId!==row.id||entry.decision!=='published'||
  entry.source!==row.source||entry.rule!==x.rule||
  entry.originalHash!==hash(x)||entry.recordHash!==hash(row)||
  row.verified!==true)return false;
 return JSON.stringify(project(x))===JSON.stringify(row);
}
validateProof();
module.exports={POLICY,RULES,SESSIONS,TARGETS,DOC,uuid,prizeFor,validateProof,project,approval,verifyRow};
