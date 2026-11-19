'use strict';
// Independent exact snapshot validator: original user images 1936–1938,
// Tracker Epic-profile UUIDs, per-VR rewards and NAC event windows.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const ROOT=path.resolve(__dirname,'..');
const DOC=JSON.parse(fs.readFileSync(path.join(ROOT,'data/manual-approvals/20261119-s28-nac-zb-duos-three.json'),'utf8'));
const POLICY='verified-s28-nac-zb-duos-three-20261119';
const RULE='https://www.fortnite.com/news/victory-cash-cups-chapter-5-season-1-official-rules';
const EVENT='S28_DuosZBVictoryCashCup',TOURNAMENT='ch5s1-zero-build-duos-victory-cup';
const BASE='https://fortnitetracker.com/events/epicgames_'+EVENT+'_NAC?window=';
const TUPLES=Object.freeze([
 // Event #, JST date, rank, canonical roster, raw player names, matches, team elims, screenshot, Tracker IDs
 [7,'2024-02-10',25,['こいる','sena'],['こいる','sena'],3,19,1936,
 ['50ca67e7-87cd-415a-b266-92cac0e326c8','f4f0cf26-d8e1-4042-a9cc-8f731831d1f2']],
 [7,'2024-02-10',67,['たまふぃっしー2号だよーん','モバイル勢のまかろん'],
 ['たまふぃっしー2号だよーん','モバイル勢のまかろん'],3,10,1937,
 ['d7675744-7be2-4b32-8ca2-de65a82de514','facede25-f8fd-4f47-be4d-ecb0796abd33']],
 [6,'2024-01-22',81,['ろる','モバイル勢のまかろん'],['TsV ろるねぎ','モバイル勢のまかろん'],
 3,9,1938,['c3203f80-6aa5-4b67-ba1b-ab7899e19aa6','facede25-f8fd-4f47-be4d-ecb0796abd33']]
]);
const must=(condition,message)=>{if(!condition)throw Error('S28_NAC_ZB_DUOS_3 '+message)};
const hash=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const windowId=n=>EVENT+'_Event'+n+'Round2_NAC';
const sourceUrl=n=>BASE+windowId(n);
const round=n=>'Event '+n+' · Round 2 / 賞金決勝';
function uuid(link){
 try{
  const url=new URL(link);
  if(url.protocol!=='https:'||url.hostname!=='fortnitetracker.com'||
   !url.pathname.startsWith('/profile/all/')||url.searchParams.size!==1)return null;
  const id=url.searchParams.get('id');
  return /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(id||'')?id.toLowerCase():null;
 }catch{return null}
}
function validateProof(){
 const batch=DOC?.batch;
 must(DOC.version===1&&batch?.id==='owner-s28-nac-zb-duos-three-20261119'&&
  batch.reviewedOn==='2026-11-19'&&Array.isArray(batch.entries)&&batch.entries.length===3&&
  DOC.expected?.rows===3&&DOC.expected.newPlayers===2&&
  DOC.expected.teamPrize===600&&DOC.expected.personalPrize===600,'batch changed');
 const catalog=JSON.parse(fs.readFileSync(path.join(ROOT,'tournaments.json'),'utf8')).catalog;
 const item=catalog.filter(t=>t.id===TOURNAMENT&&t.name==='Zero Build Duos Victory Cup'&&
  t.seasonId==='S28'&&t.chapter===5&&t.season===1&&
  t.mode==='zero-build'&&t.team==='duo'&&t.sourceEventIds?.includes(EVENT));
 must(item.length===1,'wrong tournament catalog');
 const seen=new Set(),owners=new Map(),ranks=new Set();
 for(let i=0;i<TUPLES.length;i++){
  const x=batch.entries[i],t=TUPLES[i];
  const [eventNumber,date,rank,names,raw,matches,kills,screenshot,ids]=t;
  must(x&&x.id==='owner-s28-nac-zb-duos-final-'+date.replace(/-/g,'')+'-r'+rank&&
   x.date===date&&x.region==='NAC'&&x.seasonId==='S28'&&x.chapter===5&&x.season===1&&
   x.event==='Zero Build Duos Victory Cup'&&x.eventId===EVENT&&x.windowId===windowId(eventNumber)&&
   x.tournamentId===TOURNAMENT&&x.team==='duo'&&
   JSON.stringify(x.playerNames)===JSON.stringify(names)&&
   JSON.stringify(x.rawNames)===JSON.stringify(raw)&&
   x.rank===rank&&x.points===100&&x.matches===matches&&x.kills===kills&&x.vrs===1&&
   x.prize===200&&x.prizePerPlayer===100&&x.rule===RULE&&
   x.source===sourceUrl(eventNumber)&&x.screenshot===screenshot,
   'rank/score/date/event/payout differs from screenshot '+i);
  must(x.profileUrls?.length===2,'two original tracker profiles are necessary');
  for(let j=0;j<2;j++){
   const id=uuid(x.profileUrls[j]);
   must(id===ids[j],'Epic account identifier differs from supplied link '+i+'/'+j);
   must(!owners.has(id)||owners.get(id)===names[j],'one Epic ID assigned to different players');
   owners.set(id,names[j]);
  }
  must(!seen.has(x.id)&&!ranks.has(windowId(eventNumber)+'/'+rank),'duplicate original screenshot');
  seen.add(x.id);ranks.add(windowId(eventNumber)+'/'+rank);
 }
 must(DOC.batch.entries.reduce((sum,x)=>sum+x.prize,0)===600,
  'three $200 team prizes must total $600');
 return true;
}
function project(x){
 const eventNumber=Number(x.windowId.match(/_Event(\d+)Round2_NAC$/)?.[1]);
 const note='ユーザー提供Fortnite Tracker画像'+x.screenshot+'のNAC決勝結果を照合。'+
  '2024年'+x.date+' Zero Build Duos Victory Cup Event '+eventNumber+
  ' Round2 '+x.rank+'位、'+x.points+'pt、'+x.matches+'試合、'+x.kills+
  'チームキル、'+x.vrs+'VR。Epic Games公式規則により決勝1VRで個人各$100、'+
  'チーム賞金$200（実際の支払完了は未確認）。順位表: '+x.source+' 公式規則: '+RULE;
 return {id:x.id,date:x.date,region:'NAC',player:x.playerNames.join(' / '),
  players:x.playerNames.slice(),playerRaw:x.rawNames.join(' / '),
  event:'Zero Build Duos Victory Cup',round:round(eventNumber),rank:x.rank,points:100,
  matches:x.matches,kills:x.kills,vrs:1,prize:200,teamPrize:200,prizePerPlayer:100,
  kind:'賞金決勝',seasonId:'S28',chapter:5,season:1,tournamentId:TOURNAMENT,
  source:x.source,profiles:x.playerNames.map((name,i)=>({name,url:x.profileUrls[i]})),
  verified:true,note};
}
function approval(x){
 const row=project(x);
 return {id:x.id,recordId:x.id,decision:'published',policy:POLICY,
  approvedAt:'2026-11-19T13:47:21Z',
  approvedBy:'ChatGPT / owner-provided screenshot and Epic official S28 rulebook',
  source:x.source,rule:RULE,originalHash:hash(x),recordHash:hash(row),
  evidence:'Screenshots 1936–1938, exact S28 NAC Event6/7 Round2, two Epic IDs, $100 per player per VR'};
}
function verifyRow(row,e){
 const x=DOC.batch.entries.find(t=>t.id===row?.id);
 return Boolean(x&&e&&e.id===row.id&&e.recordId===row.id&&
  e.decision==='published'&&e.policy===POLICY&&e.source===row.source&&e.rule===RULE&&
  e.originalHash===hash(x)&&e.recordHash===hash(row)&&row.verified===true&&
  JSON.stringify(project(x))===JSON.stringify(row));
}
validateProof();
module.exports={DOC,POLICY,RULE,EVENT,TOURNAMENT,TUPLES,uuid,round,windowId,sourceUrl,project,approval,verifyRow,validateProof};
