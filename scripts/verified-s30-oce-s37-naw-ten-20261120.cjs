'use strict';
// Locked against the 10 original user screenshots (1939-41 and 1943-49).
// OCE ZB VC: 1VR=$100, including two wins at #3; NAW PS cup: placement cash,
// NOT a Victory Royale award (all four players show zero wins).
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const ROOT=path.resolve(__dirname,'..');
const DOC=JSON.parse(fs.readFileSync(path.join(ROOT,'data/manual-approvals/20261120-s30-oce-s37-naw-ten.json'),'utf8'));
const POLICY='verified-s30-oce-zb-s37-naw-ps-ten-20261120';
const OCE='S30_SoloZBVictoryCashCup',NAW='S37_PlayStationCup';
const OCE_T='ch5s3-zb-solo-victory',NAW_T='ch6s4-playstation-cup';
const OCE_RULE='https://www.fortnite.com/news/fortnite-victory-cash-cups-chapter-5-season-3-official-rules';
const PS_RULE='https://www.fortnite.com/competitive/rules-guidelines/rules-library/playstation-cup-chapter-6-season-4-official-rules';
const TUPLES=Object.freeze([
 // region,date,rank,canonical,original tracker name,points,matches,kills,wins,cash,image,immutable Epic UUID
 ['OCE','2024-06-24',3,'CRT koyful','CRT koyful',200,3,8,2,200,1939,'326d0836-83bb-45b7-a0e6-3acadeda18e4'],
 ['OCE','2024-06-24',16,'かわあと','Blue_P かわあと',100,3,11,1,100,1940,'af2b53e2-556f-4fa3-9330-38f439bee18a'],
 ['OCE','2024-06-24',23,'モバイル勢のまかろん','モバイル勢のまかろん',100,3,9,1,100,1941,'facede25-f8fd-4f47-be4d-ecb0796abd33'],
 ['OCE','2024-06-24',30,'おかっぱがふ子','おかっぱがふ子',100,3,8,1,100,1943,'cb9d78f3-9cc5-4a83-9f56-d2afc0c56d3b'],
 ['OCE','2024-06-24',42,'りむた','A_α Rimuta',100,3,6,1,100,1944,'2b08f991-9df1-4bbd-90ae-95db167db8cf'],
 ['OCE','2024-06-24',49,'グラッセパルフェ','グラッセパルフェ',100,3,3,1,100,1945,'b12ccea1-0ea0-482e-b63b-65004f5bdf9b'],
 ['NAW','2025-09-05',11,'Jaemon','Jaemon',173,6,4,0,400,1946,'dcc5f4df-088a-4bca-b405-8b9b0fb2f97c'],
 ['NAW','2025-09-05',33,'モバイル勢のまかろん','モバイル勢のまかろん',124,6,8,0,400,1947,'facede25-f8fd-4f47-be4d-ecb0796abd33'],
 ['NAW','2025-09-05',36,'sena','sena',121,6,5,0,400,1948,'f4f0cf26-d8e1-4042-a9cc-8f731831d1f2'],
 ['NAW','2025-09-05',37,'ちからV2','ちからv2',117,6,9,0,400,1949,'2512ed08-9c99-409f-b69d-2cc3de7c35c6']
]);
const must=(condition,message)=>{if(!condition)throw Error('S30_OCE_S37_NAW_TEN '+message)};
const hash=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
function uuid(link){
 try{const u=new URL(link);
  if(u.protocol!=='https:'||u.hostname!=='fortnitetracker.com'||
     !u.pathname.startsWith('/profile/all/')||u.searchParams.size!==1)return null;
  const s=u.searchParams.get('id');
  return /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(s||'')?s.toLowerCase():null;
 }catch{return null;}
}
const info=x=>x.region==='OCE'?{
  eventId:OCE,tournamentId:OCE_T,event:'ZB Solo Victory Cup',window:OCE+'_Event4Round2_OCE',
  date:'2024-06-24',seasonId:'S30',chapter:5,season:3,rule:OCE_RULE,round:'Event 4 · Round 2 / 賞金決勝'
 }:{
  eventId:NAW,tournamentId:NAW_T,event:'PlayStation Cup',window:NAW+'_Final_NAW',
  date:'2025-09-05',seasonId:'S37',chapter:6,season:4,rule:PS_RULE,round:'Final / 賞金決勝'
 };
function validateProof(){
 must(DOC?.version===1&&DOC.batch?.id==='owner-s30-oce-zb-s37-naw-ps-ten-20261120'&&
  DOC.batch.reviewedOn==='2026-11-20'&&Array.isArray(DOC.batch.entries)&&
  DOC.batch.entries.length===10&&DOC.expected?.rows===10&&DOC.expected.newPlayers===3&&
  DOC.expected.personalPrize===2300&&DOC.expected.totalPrize===2300&&
  DOC.expected.soloVictoryRoyales===7&&DOC.expected.oceRows===6&&DOC.expected.psRows===4,
  'screenshot batch identity or totals changed');
 const catalog=JSON.parse(fs.readFileSync(path.join(ROOT,'tournaments.json'),'utf8')).catalog;
 const rulebook=JSON.parse(fs.readFileSync(path.join(ROOT,'tournament-rules.json'),'utf8')).rules;
 const historic=[
 ...JSON.parse(fs.readFileSync(path.join(ROOT,'calendar-history/2024-06.json'),'utf8')).sessions,
 ...JSON.parse(fs.readFileSync(path.join(ROOT,'calendar-history/2025-09.json'),'utf8')).sessions
 ];
 const s30=rulebook.find(r=>r.id===OCE_T);
 must(s30?.source===OCE_RULE&&s30.matchCaps?.['賞金決勝']===3,
  'OCE official $100/VR and 3-match rule missing');
 const playstation=catalog.find(t=>t.id===NAW_T);
 must(playstation?.evidence?.some(e=>e.url===PS_RULE),
  '2025 PlayStation Cup official prize rule provenance missing');
 const seen=new Set(),ranks=new Set(),owners=new Map();
 for(let i=0;i<TUPLES.length;i++){
  const [region,date,rank,name,raw,points,matches,kills,vrs,prize,shot,epic]=TUPLES[i],x=DOC.batch.entries[i],v=info({region});
  const source='https://fortnitetracker.com/events/epicgames_'+v.eventId+'_'+region+'?window='+v.window;
  const expectedId='owner-'+(region==='OCE'?'s30-oce-zb-solo-final':'s37-naw-playstation-final')+'-'+date.replace(/-/g,'')+'-r'+rank;
  const t=catalog.filter(t=>t.id===v.tournamentId&&t.name===v.event&&t.team==='solo'&&
    t.mode===(region==='OCE'?'zero-build':'battle-royale')&&t.seasonId===v.seasonId&&
    t.sourceEventIds.includes(v.eventId));
  must(t.length===1,'tournament type not independently verified '+i);
  must(x&&x.id===expectedId&&x.region===region&&x.date===date&&
   x.seasonId===v.seasonId&&x.chapter===v.chapter&&x.season===v.season&&
   x.event===v.event&&x.eventId===v.eventId&&x.windowId===v.window&&
   x.tournamentId===v.tournamentId&&x.team==='solo'&&x.playerRaw===raw&&
   JSON.stringify(x.playerNames)===JSON.stringify([name])&&x.rank===rank&&
   x.points===points&&x.matches===matches&&x.kills===kills&&
   x.vrs===vrs&&x.prize===prize&&x.prizePerPlayer===prize&&
   x.teamPrize===prize&&x.screenshot===shot&&x.rule===v.rule&&x.source===source,
   'user screenshot amount/round/score mismatch '+i);
  must(x.profileUrls?.length===1&&uuid(x.profileUrls[0])===epic,
   'user-supplied Epic account mismatch '+i);
  must(!owners.has(epic)||owners.get(epic)===name,
   'Epic account assigned to different canonical player '+i);
  owners.set(epic,name);
  must(!seen.has(x.id)&&!ranks.has(v.window+'/'+rank),'duplicate screenshot entry '+i);
  seen.add(x.id);ranks.add(v.window+'/'+rank);
  must(historic.filter(s=>s.eventId===v.eventId&&s.sourceWindowId===v.window&&
    s.dateJst===date&&s.region===region&&s.seasonId===v.seasonId&&
    s.tournamentId===v.tournamentId&&
    s.stage===(region==='OCE'?'決勝':'単一ラウンド')).length===1,
    'exact OCE Round2/NAW Final archived window not found '+i);
  if(region==='OCE')must(points===vrs*100&&prize===vrs*100&&vrs>=1,
    'OCE Victory Royale cash must match actual wins '+i);
  else must(vrs===0&&prize===400&&matches===6,
    'PlayStation placement award incorrectly interpreted as VR '+i);
 }
 must(DOC.batch.entries.reduce((n,x)=>n+x.prize,0)===2300&&
  DOC.batch.entries.reduce((n,x)=>n+x.vrs,0)===7,'batch total mismatch');
 return true;
}
function project(x){
 const v=info(x),name=x.playerNames[0],oce=x.region==='OCE';
 const note='ユーザー提供Tracker画像'+x.screenshot+'：'+x.date+' '+x.region+' '+v.event+
  ' '+v.round+' '+x.rank+'位、'+x.points+'pt、'+x.matches+'試合、'+x.kills+
  'キル、'+x.vrs+'VR。'+
  (oce?'公式VCup決勝1VR=$100・個人'+x.vrs+'VRで$'+x.prize:
    'PlayStation Cupの順位賞金$'+x.prize+'（0VRでも賞金対象）')+
  '。賞金支払完了は未確認。順位表: '+x.source+' 公式ルール: '+x.rule;
 return {id:x.id,date:x.date,region:x.region,player:name,players:[name],playerRaw:x.playerRaw,
  event:x.event,round:v.round,rank:x.rank,points:x.points,matches:x.matches,
  kills:x.kills,vrs:x.vrs,prize:x.prize,prizePerPlayer:x.prize,
  teamPrize:x.prize,kind:'賞金決勝',seasonId:x.seasonId,chapter:x.chapter,
  season:x.season,tournamentId:x.tournamentId,source:x.source,
  profiles:[{name,url:x.profileUrls[0]}],profileUrl:x.profileUrls[0],
  verified:true,note};
}
function approval(x){
 const row=project(x);
 return {id:x.id,recordId:x.id,decision:'published',policy:POLICY,
  approvedAt:'2026-11-20T10:00:22Z',approvedBy:'ChatGPT / user screenshots, Epic account profiles and official cup rules',
  source:x.source,rule:x.rule,originalHash:hash(x),recordHash:hash(row),
  evidence:'Screenshots 1939–1941,1943–1949; 10 original Epic UUIDs; S30 OCE Event4 Round2 (7VR=$700); S37 NAW PlayStation Final (4 place prizes=$1,600, zero wins)'};
}
function verifyRow(row,approvalEntry){
 const x=DOC.batch.entries.find(e=>e.id===row?.id);
 return Boolean(x&&approvalEntry&&approvalEntry.id===row.id&&approvalEntry.recordId===row.id&&
  approvalEntry.decision==='published'&&approvalEntry.policy===POLICY&&
  approvalEntry.source===row.source&&approvalEntry.rule===x.rule&&
  approvalEntry.originalHash===hash(x)&&approvalEntry.recordHash===hash(row)&&row.verified===true&&
  JSON.stringify(project(x))===JSON.stringify(row));
}
validateProof();
module.exports={DOC,TUPLES,POLICY,uuid,info,validateProof,project,approval,verifyRow};
