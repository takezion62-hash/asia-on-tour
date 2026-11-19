'use strict';
// Independent pinned owner screenshots 1936–1938, two-player Epic IDs and Epic official $100/VR/player.
// Older Jan/Feb S28 calendar-history windows are not yet archived locally: use exact source window ID.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const ROOT=path.resolve(__dirname,'..'),read=file=>JSON.parse(fs.readFileSync(path.join(ROOT,file),'utf8'));
const DOC=read('data/manual-approvals/20261119-s28-nac-zb-duos-three.json');
const POLICY='verified-s28-nac-zb-duos-three-20261119';
const RULE='https://www.fortnite.com/news/victory-cash-cups-chapter-5-season-1-official-rules';
const EVENT='S28_DuosZBVictoryCashCup',TOURNAMENT='ch5s1-zero-build-duos-victory-cup';
const PINNED=Object.freeze([
 // local date, Event, rank, canonical names, tracker raws, score, games, elims, VR, screenshot, profile UUIDs
 ['2024-02-10',7,25,['こいる','sena'],['こいる','sena'],100,3,19,1,1936,['50ca67e7-87cd-415a-b266-92cac0e326c8','f4f0cf26-d8e1-4042-a9cc-8f731831d1f2']],
 ['2024-02-10',7,67,['たまふぃっしー2号だよーん','モバイル勢のまかろん'],['たまふぃっしー2号だよーん','モバイル勢のまかろん'],100,3,10,1,1937,['d7675744-7be2-4b32-8ca2-de65a82de514','facede25-f8fd-4f47-be4d-ecb0796abd33']],
 ['2024-01-22',6,81,['ろる','モバイル勢のまかろん'],['TsV ろるねぎ','モバイル勢のまかろん'],100,3,9,1,1938,['c3203f80-6aa5-4b67-ba1b-ab7899e19aa6','facede25-f8fd-4f47-be4d-ecb0796abd33']]
]);
const hash=o=>crypto.createHash('sha256').update(JSON.stringify(o)).digest('hex');
const must=(p,message)=>{if(!p)throw Error('S28_NAC_ZB_DUOS_THREE '+message)};
function uuid(profile){
 try{const url=new URL(profile);
  if(url.protocol!=='https:'||url.hostname!=='fortnitetracker.com'||
   !url.pathname.startsWith('/profile/all/')||url.searchParams.size!==1)return null;
  const id=url.searchParams.get('id');
  return /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id||'')?id.toLowerCase():null;
 }catch{return null}
}
function validateProof(){
 must(DOC.version===1&&DOC.batch?.id==='owner-s28-nac-zb-duos-three-20261119'&&
  DOC.batch.reviewedOn==='2026-11-19'&&DOC.batch.entries?.length===3&&
  DOC.expected?.rows===3&&DOC.expected.newPlayers===2&&
  DOC.expected.teamPrize===600&&DOC.expected.personalPrize===600,'batch metadata changed');
 const catalog=read('tournaments.json').catalog.filter(x=>x.id===TOURNAMENT);
 must(catalog.length===1&&catalog[0].seasonId==='S28'&&catalog[0].team==='duo'&&
  catalog[0].mode==='zero-build'&&catalog[0].sourceEventIds?.includes(EVENT)&&
  catalog[0].evidence?.some(e=>e.url===RULE),'season, mode, or official rule link invalid');
 const seen=new Set(),owners=new Map();
 for(let i=0;i<3;i++){
  const x=DOC.batch.entries[i],p=PINNED[i];
  const [date,eventNum,rank,names,raw,points,matches,kills,vrs,screenshot,ids]=p;
  const window=EVENT+'_Event'+eventNum+'Round2_NAC';
  const url='https://fortnitetracker.com/events/epicgames_'+EVENT+'_NAC?window='+window;
  must(x?.id==='owner-s28-nac-zb-duos-final-'+date.replace(/-/g,'')+'-r'+rank&&
   x.date===date&&x.region==='NAC'&&x.seasonId==='S28'&&x.chapter===5&&x.season===1&&
   x.event===catalog[0].name&&x.eventId===EVENT&&x.windowId===window&&
   x.tournamentId===TOURNAMENT&&x.team==='duo'&&
   JSON.stringify(x.playerNames)===JSON.stringify(names)&&
   x.playerRaw===raw.join(' / ')&&x.rank===rank&&x.points===points&&
   x.matches===matches&&x.kills===kills&&x.vrs===vrs&&x.screenshot===screenshot&&
   x.prize===200&&x.teamPrize===200&&x.prizePerPlayer===100&&
   x.rule===RULE&&x.source===url,'score / source / payout mismatch #'+i);
  must(Array.isArray(x.profileUrls)&&x.profileUrls.length===2&&
   x.profileUrls.every((url,j)=>uuid(url)===ids[j]),'Epic profile mismatch #'+i);
  for(let j=0;j<2;j++){
   must(!owners.has(ids[j])||owners.get(ids[j])===names[j],'Epic ID maps to two players');
   owners.set(ids[j],names[j]);
  }
  must(!seen.has(window+'/'+rank),'repeated event rank');
  seen.add(window+'/'+rank);
 }
 must(DOC.batch.entries.reduce((a,x)=>a+x.prize,0)===600,'total team prize changed');
 return true;
}
function project(x){
 const event=Number(x.windowId.match(/_Event(\d+)Round2_NAC$/)?.[1]);
 const note='ユーザー提供Fortnite Tracker画像'+x.screenshot+'、Epic IDと順位表を照合。'+
  x.date+'(JST) NAC Zero Build Duos Victory Cup Event '+event+' Round2。'+
  x.rank+'位・100pt・'+x.matches+'試合・'+x.kills+'チームキル・1VR。'+
  'Epic公式Chapter 5 Season 1賞金規則の1VR=各選手$100（チーム$200）。本人への支払完了は未確認。'+
  ' 順位表: '+x.source+' 公式規則: '+x.rule;
 return {id:x.id,date:x.date,region:'NAC',player:x.playerNames.join(' / '),
  players:[...x.playerNames],playerRaw:x.playerRaw,event:x.event,
  round:'Event '+event+' · Round 2 / 賞金決勝',rank:x.rank,
  points:x.points,matches:x.matches,kills:x.kills,vrs:x.vrs,
  prize:200,teamPrize:200,prizePerPlayer:100,kind:'賞金決勝',
  seasonId:'S28',chapter:5,season:1,tournamentId:TOURNAMENT,
  source:x.source,profiles:x.playerNames.map((name,i)=>({name,url:x.profileUrls[i]})),
  verified:true,note};
}
function approval(x){
 const row=project(x);
 return {id:x.id,recordId:x.id,decision:'published',policy:POLICY,
  approvedAt:'2026-11-19T13:47:33Z',
  approvedBy:'ChatGPT / supplied screenshots and Epic official Chapter 5 Season 1 rules',
  source:x.source,rule:RULE,originalHash:hash(x),recordHash:hash(row),
  evidence:'Screenshots 1936–1938, two valid Epic Tracker UUIDs per team, source Event6/7 Round2 NAC, official per-player $100 per VR'};
}
function verifyRow(row,entry){
 const x=DOC.batch.entries.find(y=>y.id===row?.id);
 return !!(x&&entry&&entry.id===row.id&&entry.recordId===row.id&&
  entry.decision==='published'&&entry.policy===POLICY&&
  entry.source===row.source&&entry.rule===RULE&&entry.originalHash===hash(x)&&
  entry.recordHash===hash(row)&&row.verified===true&&
  JSON.stringify(project(x))===JSON.stringify(row));
}
validateProof();
module.exports={DOC,POLICY,PINNED,RULE,EVENT,TOURNAMENT,uuid,validateProof,project,approval,verifyRow};
