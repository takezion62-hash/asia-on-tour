'use strict';
// Owner screenshots 1928–1935, independent canonical Epic profile UUIDs, exact
// Chapter 5 Season 3 EU Zero Build Solo Victory Cup Round2 window and payout.
// DO NOT use Tracker's known $0 display glitch for Aug 13 rank 36/91.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const ROOT=path.resolve(__dirname,'..');
const DOC=JSON.parse(fs.readFileSync(path.join(ROOT,'data/manual-approvals/20261119-s30-eu-zb-solo-eight.json'),'utf8'));
const POLICY='verified-s30-eu-zb-solo-eight-20261119';
const RULE='https://www.fortnite.com/news/fortnite-victory-cash-cups-chapter-5-season-3-official-rules';
const EVENT='S30_SoloZBVictoryCashCup',TOURNAMENT='ch5s3-zb-solo-victory';
const TUPLES=Object.freeze([
 // event, dateJST, rank, canonical name, source raw name, matches, kills, screenshot, Tracker shown cash, Epic ID
 [9,'2024-08-13',36,'あーうw','あーうw',3,15,1928,0,'26ad13ec-491a-4a9c-bedf-1a954fcc04a0'],
 [9,'2024-08-13',91,'モバイル勢のまかろん','モバイル勢のまかろん',3,9,1929,0,'facede25-f8fd-4f47-be4d-ecb0796abd33'],
 [9,'2024-08-13',167,'TakoBeL','TakoBeL',3,3,1930,100,'7e1ee343-4f90-465f-8d17-09b76e5820dd'],
 [9,'2024-08-13',176,'ちゃる','charufn',3,2,1931,100,'e3d0bd7d-4b8c-4e60-ac46-564918e3e3a1'],
 [4,'2024-06-25',37,'モバイル勢のまかろん','モバイル勢のまかろん',2,11,1932,100,'facede25-f8fd-4f47-be4d-ecb0796abd33'],
 [4,'2024-06-25',130,'TakoBeL','TakoBeL',3,6,1933,100,'7e1ee343-4f90-465f-8d17-09b76e5820dd'],
 [3,'2024-06-18',128,'MMC KAAN BABA','MMC KAAN BABA',3,6,1934,100,'2bf3a503-80fa-49ff-a655-2c23c2e384cf'],
 [3,'2024-06-18',169,'モバイル勢のまかろん','モバイル勢のまかろん',3,4,1935,100,'facede25-f8fd-4f47-be4d-ecb0796abd33']
]);
const must=(ok,why)=>{if(!ok)throw Error('S30_EU_ZB_EIGHT '+why)};
const hash=v=>crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex');
function uuid(link){
 try{
  const u=new URL(link);
  if(u.protocol!=='https:'||u.hostname!=='fortnitetracker.com'||
   !u.pathname.startsWith('/profile/all/')||u.searchParams.size!==1)return null;
  const id=u.searchParams.get('id');
  return /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id||'')?id.toLowerCase():null;
 }catch{return null}
}
function validateProof(){
 const batch=DOC?.batch;
 must(DOC.version===1&&batch?.id==='owner-s30-eu-zb-solo-eight-20261119'&&
  batch.reviewedOn==='2026-11-19'&&Array.isArray(batch.entries)&&batch.entries.length===8&&
  DOC.expected?.rows===8&&DOC.expected.newPlayers===1&&
  DOC.expected.teamPrize===800&&DOC.expected.personalPrize===800,'batch count/identity changed');
 const catalog=JSON.parse(fs.readFileSync(path.join(ROOT,'tournaments.json'),'utf8')).catalog;
 const def=catalog.filter(x=>x.id===TOURNAMENT&&x.seasonId==='S30'&&
   x.team==='solo'&&x.mode==='zero-build'&&x.sourceEventIds.includes(EVENT));
 must(def.length===1,'tournament catalog mismatch');
 const rulebook=JSON.parse(fs.readFileSync(path.join(ROOT,'tournament-rules.json'),'utf8'));
 const rule=rulebook.rules.find(x=>x.id===TOURNAMENT);
 must(rule&&rule.source===RULE&&rule.matchCaps?.['賞金決勝']===3,'official rule/match limit changed');
 const archive=[...JSON.parse(fs.readFileSync(path.join(ROOT,'calendar-history/2024-06.json'),'utf8')).sessions,
  ...JSON.parse(fs.readFileSync(path.join(ROOT,'calendar-history/2024-08.json'),'utf8')).sessions];
 const ids=new Set(),ranks=new Set(),owner=new Map();
 for(let i=0;i<8;i++){
  const x=batch.entries[i],p=TUPLES[i];
  const [n,date,rank,name,raw,matches,kills,screenshot,display,account]=p;
  const window=EVENT+'_Event'+n+'Round2_EU';
  const src='https://fortnitetracker.com/events/epicgames_'+EVENT+'_EU?window='+window;
  must(x&&x.id==='owner-s30-eu-zb-solo-final-'+date.replace(/-/g,'')+'-r'+rank&&
   x.date===date&&x.region==='EU'&&x.seasonId==='S30'&&x.chapter===5&&x.season===3&&
   x.event===def[0].name&&x.eventId===EVENT&&x.windowId===window&&
   x.tournamentId===TOURNAMENT&&x.team==='solo'&&x.playerRaw===raw&&
   JSON.stringify(x.playerNames)===JSON.stringify([name])&&
   x.rank===rank&&x.points===100&&x.matches===matches&&x.kills===kills&&
   x.vrs===1&&x.prize===100&&x.prizePerPlayer===100&&
   x.screenshot===screenshot&&x.trackerDisplayedPrize===display&&
   x.ownerCorrection===(display===0)&&x.rule===RULE&&x.source===src,
   'user screenshot / rule / original cash correction changed at '+i);
  must(x.profileUrls?.length===1&&uuid(x.profileUrls[0])===account,'Epic account mismatch at '+i);
  must(!owner.has(account)||owner.get(account)===name,'one Epic ID cannot belong to two players');
  owner.set(account,name);
  must(!ids.has(x.id)&&!ranks.has(window+'/'+rank),'duplicate source result at '+i);
  ids.add(x.id);ranks.add(window+'/'+rank);
  must(archive.filter(a=>a.eventId===EVENT&&a.sourceWindowId===window&&
   a.dateJst===date&&a.region==='EU'&&a.seasonId==='S30'&&a.stage==='決勝'&&
   a.tournamentId===TOURNAMENT&&a.name===def[0].name).length===1,'archived Epic window missing '+window);
 }
 must(batch.entries.reduce((n,x)=>n+x.prize,0)===800,'eight prize totals inconsistent');
 return true;
}
function project(x){
 const name=x.playerNames[0],win=Number(x.windowId.match(/_Event(\d+)Round2_EU$/)?.[1]);
 const correction=x.ownerCorrection?' Tracker画面の$0は表示不具合として採用せず、':' ';
 const note='提供されたFortnite Tracker画像'+x.screenshot+'のオリジナル成績。'+
  '2024年EU ZB Solo Victory Cup Event '+win+' Round2：'+x.rank+'位・'+
  x.points+'pt・'+x.matches+'試合・'+x.kills+'キル・'+x.vrs+'VR。'+
  correction+'Epic公式規則のRound2 1VR=$100により個人賞金$100（支払完了は未確認）。'+
  '順位表: '+x.source+' 公式規則: '+x.rule;
 return {id:x.id,date:x.date,region:x.region,player:name,players:[name],playerRaw:x.playerRaw,
  event:x.event,round:'Event '+win+' · Round 2 / 賞金決勝',rank:x.rank,points:x.points,
  matches:x.matches,kills:x.kills,vrs:x.vrs,prize:100,prizePerPlayer:100,teamPrize:100,
  kind:'賞金決勝',seasonId:'S30',chapter:5,season:3,tournamentId:TOURNAMENT,
  source:x.source,profiles:[{name,url:x.profileUrls[0]}],profileUrl:x.profileUrls[0],
  verified:true,note};
}
function approval(x){
 const row=project(x);
 return {id:x.id,recordId:x.id,decision:'published',policy:POLICY,approvedAt:'2026-11-19T13:19:27Z',
  approvedBy:'ChatGPT / user-provided screenshots and Epic official Rule Attachment C',
  source:x.source,rule:RULE,originalHash:hash(x),recordHash:hash(row),
  evidence:'Images 1928–1935, exact Epic UUID, archived EU Round2 windows, $100 per Victory Royale; owner correction for Aug13 shown $0'};
}
function verifyRow(row,entry){
 const x=DOC.batch.entries.find(t=>t.id===row?.id);
 return !!(x&&entry&&entry.id===row.id&&entry.recordId===row.id&&
  entry.decision==='published'&&entry.policy===POLICY&&
  entry.source===row.source&&entry.rule===RULE&&entry.originalHash===hash(x)&&
  entry.recordHash===hash(row)&&row.verified===true&&
  JSON.stringify(project(x))===JSON.stringify(row));
}
validateProof();
module.exports={DOC,POLICY,TUPLES,RULE,EVENT,TOURNAMENT,uuid,validateProof,project,approval,verifyRow};
