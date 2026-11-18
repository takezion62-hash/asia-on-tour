'use strict';
const crypto=require('node:crypto'),fs=require('node:fs'),path=require('node:path');
const ROOT=path.resolve(__dirname,'..'),DOC=JSON.parse(fs.readFileSync(path.join(ROOT,'data/manual-approvals/20261118-unreal-nvidia-six.json'),'utf8'));
const POLICY='verified-s39-unreal-nvidia-six-20261118';
const RULES={unreal:'https://www.fortnite.com/competitive/rules-guidelines/rules-library/1-million-dollar-unreal-cup-chapter-7-season-1-official-rules',nvidia:'https://www.fortnite.com/competitive/rules-guidelines/rules-library/nvidia-geforce-rtx-cup-official-rules'};
const SOURCE={unreal:'https://fortnitetracker.com/events/epicgames_S39_1MillionUnrealCup_NAC?window=S39_1MillionUnrealCup_NAC',nvidia:'https://fortnitetracker.com/events/epicgames_S39_NvidiaCup_NAW?window=S39_NvidiaCup_NAW'};
const PINNED=[{"rank":1093,"points":260,"matches":10,"kills":23,"vrs":1,"prize":100,"prizePerPlayer":50,"screenshot":1916,"playerNames":["さんげん","モバイル勢のまかろん"],"playerRaw":"今さんげんええ感じやねん / BRN 916GonLuck","ids":["6ea598e4-52f9-4352-8133-e74b0155fd06","facede25-f8fd-4f47-be4d-ecb0796abd33"]},{"rank":33,"points":345,"matches":9,"kills":7,"vrs":0,"prize":100,"prizePerPlayer":100,"screenshot":1920,"playerNames":["テルハルル"],"playerRaw":"BoF てるはるるの相方popo","ids":["4ca4fb7d-0e20-494a-8eec-fe03bb15e331"]},{"rank":36,"points":342,"matches":9,"kills":9,"vrs":1,"prize":100,"prizePerPlayer":100,"screenshot":1921,"playerNames":["モバイル勢のまかろん"],"playerRaw":"モバイル勢のまかろん","ids":["facede25-f8fd-4f47-be4d-ecb0796abd33"]},{"rank":53,"points":322,"matches":8,"kills":6,"vrs":1,"prize":0,"prizePerPlayer":0,"screenshot":1922,"playerNames":["PONY"],"playerRaw":"PONY","ids":["0facf8d6-aaf5-4962-b80c-5d2f5e10e828"]},{"rank":69,"points":312,"matches":10,"kills":10,"vrs":0,"prize":0,"prizePerPlayer":0,"screenshot":1923,"playerNames":["ふぃる"],"playerRaw":"ポルターガイストǃ","ids":["b8ee0fe8-a574-4c3c-a37b-b746388064ec"]},{"rank":71,"points":310,"matches":10,"kills":16,"vrs":1,"prize":0,"prizePerPlayer":0,"screenshot":1924,"playerNames":["Rise"],"playerRaw":"Rise","ids":["635ed9f3-69cf-4720-b1ec-25e0575fd76b"]}];
const must=(ok,message)=>{if(!ok)throw Error('UNREAL_NVIDIA_SIX_PROOF '+message)};
const hash=obj=>crypto.createHash('sha256').update(JSON.stringify(obj)).digest('hex');
function uuid(link){try{const u=new URL(link);if(u.protocol!=='https:'||u.hostname!=='fortnitetracker.com'||!u.pathname.startsWith('/profile/all/')||u.searchParams.size!==1)return null;
const id=u.searchParams.get('id');return /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id||'')?id.toLowerCase():null}catch{return null}}
function prizeFor(x){
 const tiers=x.region==='NAC'&&x.eventId==='S39_1MillionUnrealCup'?
 [[1,16000],[2,8000],[3,4000],[4,3000],[5,2000],[10,1600],[50,800],[100,400],[600,200],[1200,100]]:
 x.region==='NAW'&&x.eventId==='S39_NvidiaCup'?
 [[1,1000],[2,750],[3,600],[4,500],[5,450],[6,400],[7,350],[8,300],[9,250],[10,200],[25,150],[40,100]]:null;
 return tiers?tiers.find(([rank])=>x.rank<=rank)?.[1]??0:null;
}
function validateProof(){
 must(DOC.version===1&&DOC.batch?.id==='owner-s39-unreal-nvidia-six-20261118'&&DOC.batch.reviewedOn==='2026-11-18'&&
 Array.isArray(DOC.batch.entries)&&DOC.batch.entries.length===6&&DOC.expected.rows===6&&DOC.expected.newPlayers===2&&
 DOC.expected.teamPrize===300&&DOC.expected.personalPrize===300,'batch changed');
 const o=DOC.nvidiaOverview;must(o.dateJST==='2025-12-22'&&o.region==='NAW'&&o.mode==='Solo · Build'&&
 o.rounds===1&&o.maxMatches===10&&o.durationMinutes===180&&o.cashTopRank===40&&o.rtx5080FirstPlace===true&&
 o.rustBucketPoints===8&&o.officialRule===RULES.nvidia&&o.leaderboard===SOURCE.nvidia,'NVIDIA overview changed');
 const ranks=new Set(),ids=new Set(),owners=new Map();
 for(let i=0;i<6;i++){
  const x=DOC.batch.entries[i],p=PINNED[i],unreal=i===0,type=unreal?'unreal':'nvidia',region=unreal?'NAC':'NAW';
  must(x&&['rank','points','matches','kills','vrs','prize','prizePerPlayer','screenshot','playerRaw'].every(k=>x[k]===p[k])&&
  JSON.stringify(x.playerNames)===JSON.stringify(p.playerNames),'source score changed '+i);
  must(x.event===(unreal?'$1 Million Unreal Cup':'NVIDIA GeForce RTX Cup')&&x.date===(unreal?'2025-12-21':'2025-12-22')&&x.region===region&&
  x.seasonId==='S39'&&x.chapter===7&&x.season===1&&x.eventId===(unreal?'S39_1MillionUnrealCup':'S39_NvidiaCup')&&
  x.windowId===x.eventId+'_'+region&&x.team===(unreal?'duo':'solo')&&
  x.tournamentId===(unreal?'ch7s1-one-million-unreal-cup':'ch7s1-nvidia-geforce-rtx-cup')&&
  x.id===(unreal?'owner-s39-nac-unreal-20251221-r1093':'owner-s39-naw-nvidia-20251222-r'+x.rank)&&
  x.source===SOURCE[type]&&x.rule===RULES[type],'event/date/region/source changed '+i);
  must(Array.isArray(x.profileUrls)&&x.profileUrls.length===p.ids.length,'invalid profile count');
  for(let j=0;j<p.ids.length;j++){const id=uuid(x.profileUrls[j]);must(id===p.ids[j],'Epic account changed '+i+'/'+j);
   must(!owners.has(id)||owners.get(id)===x.playerNames[j],'UUID assigned to two players');owners.set(id,x.playerNames[j]);}
  must(x.matches>=1&&x.matches<=10&&x.vrs>=0&&x.vrs<=x.matches&&x.kills>=0&&x.points>=0&&
   prizeFor(x)===x.prize&&x.prizePerPlayer*x.playerNames.length===x.prize,'cash mismatch '+i);
  must(!ids.has(x.id)&&!ranks.has(x.eventId+'/'+region+'/'+x.rank),'duplicate screenshot');
  ids.add(x.id);ranks.add(x.eventId+'/'+region+'/'+x.rank);
 }
 must(DOC.batch.entries.reduce((n,x)=>n+x.prize,0)===300,'total prize changed');return true;
}
function project(x){
 const n=x.playerNames,solo=n.length===1;
 const note='ユーザー提供Tracker画像'+x.screenshot+'枚目・Epic UUID照合。'+x.region+' '+x.rank+'位、'+x.points+'pt、'+x.matches+'試合、'+x.kills+'キル、'+x.vrs+'VR。'+
 (x.prize?'Epic公式賞金'+(solo?'個人':'チーム')+'$'+x.prize+' / 個人各$'+x.prizePerPlayer+'（実受領は未確認）。':'公式順位賞金対象外、現金$0。')+
 (x.eventId==='S39_NvidiaCup'?' NAWソロ通常BR単一ラウンド、10試合・3時間、上位40位まで現金賞金。8pt Rust Bucket報酬条件達成（受領未確認）、RTX 5080はNAW優勝者。':'')+
 ' 順位表: '+x.source+' 公式ルール: '+x.rule;
 const row={id:x.id,date:x.date,region:x.region,player:n.join(' / '),players:n.slice(),playerRaw:x.playerRaw,
  event:x.event,round:'Session 1 / 賞金決勝',rank:x.rank,points:x.points,matches:x.matches,kills:x.kills,vrs:x.vrs,
  prize:x.prize,prizePerPlayer:x.prizePerPlayer,teamPrize:x.prize,kind:'賞金決勝',seasonId:'S39',chapter:7,season:1,
  tournamentId:x.tournamentId,source:x.source,profiles:n.map((name,i)=>({name,url:x.profileUrls[i]})),verified:true,note};
 if(solo)row.profileUrl=x.profileUrls[0];return row;
}
function approval(x){const row=project(x);return {id:x.id,recordId:x.id,decision:'published',policy:POLICY,approvedAt:'2026-11-18T13:50:03Z',
 approvedBy:'ChatGPT / owner screenshots and official Epic Games rules',source:x.source,rule:x.rule,
 originalHash:hash(x),recordHash:hash(row),evidence:'Owner images 1916–1924 with exact source, rank, Epic identity, official NAW/NAC prize tiers'};}
function verifyRow(row,entry){
 const x=DOC.batch.entries.find(t=>t.id===row?.id);
 return !!(x&&entry&&entry.policy===POLICY&&entry.id===row.id&&entry.recordId===row.id&&entry.decision==='published'&&
 entry.source===row.source&&entry.rule===x.rule&&entry.originalHash===hash(x)&&entry.recordHash===hash(row)&&
 row.verified===true&&JSON.stringify(project(x))===JSON.stringify(row));
}
validateProof();
module.exports={POLICY,DOC,PINNED,RULES,SOURCE,uuid,prizeFor,project,approval,verifyRow,validateProof};
