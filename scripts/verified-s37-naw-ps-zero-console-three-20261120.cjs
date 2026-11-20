'use strict';
// Owner screenshot evidence 1950–1959: zero-cash PlayStation final participants
// and three NAW Console Duo Victory Cash teams. No inferred foreign Epic UUID.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const ROOT=path.resolve(__dirname,'..');
const DOC=JSON.parse(fs.readFileSync(path.join(ROOT,'data/manual-approvals/20261120-s37-naw-ps-zero-console-three.json'),'utf8'));
const POLICY='verified-s37-naw-ps-zero-console-three-20261120';
const PS='S37_PlayStationCup',DUOS='S37_ConsoleDuosCashCups';
const PS_T='ch6s4-playstation-cup',DUOS_T='ch6s4-console-duos-victory';
const PS_RULE='https://www.fortnite.com/competitive/rules-guidelines/rules-library/playstation-cup-chapter-6-season-4-official-rules';
const DUOS_RULE='https://www.fortnite.com/competitive/rules-guidelines/rules-library/fortnite-duos-console-victory-cash-cups-chapter-6-season-4-official-rules';
const strict=(ok,reason)=>{if(!ok)throw Error('S37_NAW_ZERO_AND_CONSOLE '+reason)};
const hash=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
function epicId(link){
 if(!link)return null;
 try{const x=new URL(link);if(x.protocol!=='https:'||x.hostname!=='fortnitetracker.com'||
    !x.pathname.startsWith('/profile/all/')||x.searchParams.size!==1)return null;
  const uid=x.searchParams.get('id');
  return /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(uid||'')?uid.toLowerCase():null;
 }catch{return null}
}
const EXPECTED=Object.freeze([
 // kind,rank,names,rawNames,UUIDs,points,matches,kills,VR,teamPrize,shot
 ['PS',48,['きみが死ぬまで恋をしたいɞ'],['きみが死ぬまで恋をしたいɞ'],['ba97155e-4742-4ecf-9405-57e0a6fe9aa1'],92,6,1,0,0,1950],
 ['PS',67,['えありー'],['Airy'],['bf6b915c-60d9-4e09-a7e1-55165440e01b'],56,4,4,0,0,1951],
 ['PS',68,['ちゃる'],['charufn'],['e3d0bd7d-4b8c-4e60-ac46-564918e3e3a1'],56,6,3,0,0,1952],
 ['PS',74,['ちゃんおに'],['DYD チー牛ウン子漏らし滅ǃǃ'],['b57bfd8c-3233-4276-afef-571eaf768f1a'],41,6,4,0,0,1953],
 ['PS',81,['3peace'],['3peace'],['bc21e86c-c3cf-4761-a529-06a8e4fd910b'],22,6,0,0,0,1954],
 ['PS',84,['きおらび'],['きおらび'],['7dcdf989-faa3-47fb-bab8-c2228abb4142'],15,5,2,0,0,1955],
 ['PS',96,['躯中の細胞に火を熾すように'],['躯中の細胞に火を熾すように'],['f4546aed-29dc-42f3-b110-e86565d076d3'],0,6,0,0,0,1956],
 ['DUO',4,['AUR t3eny 19ǃ','あぶやちぇ'],['AUR t3eny 19ǃ','あぶやちぇ'],['047f53cb-6435-4354-abe8-dc8e75fbfb75','3555d4b5-13ba-4633-914f-bf7c995c43cf'],100,3,7,1,200,1957],
 ['DUO',8,['Shipski','モバイル勢のまかろん'],['Shipski','モバイル勢のまかろん'],[null,'facede25-f8fd-4f47-be4d-ecb0796abd33'],100,3,6,1,200,1958],
 ['DUO',9,['Rio_ando09','開業ニキわら'],['Rio_ando09','開業ニキわら'],['3d2820ff-6b6b-46ec-86ad-d622794004e7','bbeda5cf-9426-488f-8965-e2cda1546202'],100,3,5,1,200,1959]
]);
const props=kind=>kind==='PS'?{
 date:'2025-09-05',event:'PlayStation Cup',eventId:PS,
 windowId:PS+'_Final_NAW',tournamentId:PS_T,team:'solo',rule:PS_RULE,
 round:'Final / 賞金決勝'
}:{
 date:'2025-08-25',event:'Duos Console Victory Cash Cup',eventId:DUOS,
 windowId:DUOS+'_Event2Round2_NAW',tournamentId:DUOS_T,team:'duo',
 rule:DUOS_RULE,round:'Event 2 · Round 2 / 賞金決勝'
};
function validateProof(){
 strict(DOC.version===1&&DOC.batch?.id==='owner-s37-naw-ps-zero-console-three-20261120'&&
  DOC.batch?.reviewedOn==='2026-11-20'&&DOC.batch?.entries?.length===10&&
  DOC.expected?.rows===10&&DOC.expected.playstationRows===7&&DOC.expected.consoleRows===3&&
  DOC.expected.teamPrize===600&&DOC.expected.playstationPrize===0&&
  DOC.expected.consoleVictoryRoyales===3,'original evidence batch changed');
 const cat=JSON.parse(fs.readFileSync(path.join(ROOT,'tournaments.json'),'utf8')).catalog;
 const rules=JSON.parse(fs.readFileSync(path.join(ROOT,'tournament-rules.json'),'utf8')).rules;
 const windows=[
 ...JSON.parse(fs.readFileSync(path.join(ROOT,'calendar-history/2025-08.json'),'utf8')).sessions,
 ...JSON.parse(fs.readFileSync(path.join(ROOT,'calendar-history/2025-09.json'),'utf8')).sessions
 ];
 const consoleRule=rules.find(x=>x.id===DUOS_T);
 strict(consoleRule?.source===DUOS_RULE&&consoleRule.prizePerVictory===100&&
   consoleRule.matchCaps?.['賞金決勝']===3,'console official 1VR = $200/team ($100/player) not verified');
 const psCatalog=cat.find(x=>x.id===PS_T);
 strict(psCatalog?.evidence?.some(x=>x.url===PS_RULE),
  'official PS NAW award cutoff (max rank 40) not sourced');
 const ids=new Set(),ranks=new Set(),accounts=new Map();
 for(let i=0;i<EXPECTED.length;i++){
  const [kind,rank,names,raw,epics,points,matches,kills,vrs,prize,shot]=EXPECTED[i];
  const x=DOC.batch.entries[i],meta=props(kind);
  const prefix=kind==='PS'?'owner-s37-naw-playstation-final-20250905-r':'owner-s37-naw-console-duos-final-20250825-r';
  const source='https://fortnitetracker.com/events/epicgames_'+meta.eventId+'_NAW?window='+meta.windowId;
  strict(x?.id===prefix+rank&&x.date===meta.date&&x.region==='NAW'&&x.seasonId==='S37'&&
   x.chapter===6&&x.season===4&&x.event===meta.event&&x.eventId===meta.eventId&&
   x.windowId===meta.windowId&&x.tournamentId===meta.tournamentId&&x.team===meta.team&&
   JSON.stringify(x.playerNames)===JSON.stringify(names)&&
   JSON.stringify(x.rawNames)===JSON.stringify(raw)&&
   x.rank===rank&&x.points===points&&x.matches===matches&&x.kills===kills&&
   x.vrs===vrs&&x.prize===prize&&x.teamPrize===prize&&
   x.prizePerPlayer===(kind==='PS'?0:100)&&x.screenshot===shot&&
   x.source===source&&x.rule===meta.rule,'screenshot stats/event/prize mismatch '+i);
  strict(cat.filter(y=>y.id===meta.tournamentId&&y.seasonId==='S37'&&
   y.sourceEventIds.includes(meta.eventId)&&y.team===meta.team&&
   y.mode==='battle-royale').length===1,'tournament mode or team not mapped '+i);
  strict(windows.filter(y=>y.eventId===meta.eventId&&y.sourceWindowId===meta.windowId&&
   y.dateJst===meta.date&&y.region==='NAW'&&y.tournamentId===meta.tournamentId&&
   y.stage===(kind==='PS'?'単一ラウンド':'決勝')).length===1,
   'official archived round not found '+i);
  strict(x.profileUrls?.length===names.length,'profile count/unknown partner slot changed '+i);
  for(let j=0;j<names.length;j++){
   const id=epicId(x.profileUrls[j]);
   strict(id===epics[j],'supplied Epic UUID mismatch '+i+'/'+j);
   if(id){strict(!accounts.has(id)||accounts.get(id)===names[j],'Epic account collision '+id);
    accounts.set(id,names[j]);}
  }
  strict(!ids.has(x.id)&&!ranks.has(meta.windowId+'/'+rank),'duplicate screenshot rank '+i);
  ids.add(x.id);ranks.add(meta.windowId+'/'+rank);
  if(kind==='PS')strict(rank>40&&matches<=6&&prize===0&&vrs===0,
   'NAW PS Cup prizes extend only to rank 40 (final attendance only)');
  else strict(points===100&&matches<=3&&matches>=vrs&&vrs===1&&prize===200,
   'NAW Duo Victory Royale payout mismatch');
 }
 strict(DOC.batch.entries.reduce((n,x)=>n+x.prize,0)===600&&
  DOC.batch.entries.reduce((n,x)=>n+x.vrs,0)===3,
  'wrong batch winnings or VR total');
 strict(DOC.batch.entries[8].externalTeammates?.[0]==='Shipski'&&
  DOC.batch.entries[8].profileUrls[0]===null,
  'unverified NAW partner must remain unidentified as an Epic account');
 return true;
}
function project(x){
 const isPS=x.team==='solo',meta=props(isPS?'PS':'DUO');
 const people=x.playerNames.slice();
 const original=x.rawNames.join(' / ');
 const note='ユーザー提供Fortnite Tracker画像'+x.screenshot+
  '、NAW '+x.date+' '+x.event+' '+meta.round+' '+x.rank+'位・'+
  x.points+'pt・'+x.matches+'試合・'+x.kills+'K・'+x.vrs+'VR。'+
  (isPS?'公式NAW決勝賞金は40位以内、今回は賞金圏外で$0（決勝出場は確認）。':
   'Epic公式の決勝1VRでチーム$200、各選手$100。')+
  (x.externalTeammates?.length?'Shipskiはユーザー確認のNAW相方。ASIA選手として新規登録せず、EpicプロフィールIDは未提供。':'')+
  '賞金の支払い完了は未確認。出典: '+x.source+' / 規則: '+x.rule;
 return {id:x.id,date:x.date,region:'NAW',player:people.join(' / '),players:people,
  playerRaw:original,event:x.event,round:meta.round,rank:x.rank,points:x.points,
  matches:x.matches,kills:x.kills,vrs:x.vrs,prize:x.prize,
  prizePerPlayer:x.prizePerPlayer,teamPrize:x.teamPrize,
  kind:'賞金決勝',seasonId:'S37',chapter:6,season:4,
  tournamentId:x.tournamentId,source:x.source,
  profiles:people.map((name,i)=>({name,url:x.profileUrls[i]})).filter(p=>Boolean(p.url)),
  ...(isPS?{profileUrl:x.profileUrls[0]}:{}),
  ...(x.externalTeammates?{externalTeammates:x.externalTeammates}:{}),
  verified:true,note};
}
function approval(x){
 const row=project(x);
 return {id:x.id,recordId:x.id,decision:'published',policy:POLICY,
  approvedAt:'2026-11-20T10:52:46Z',
  approvedBy:'ChatGPT / original user 10 screenshots and Epic account profile ID links',
  source:x.source,rule:x.rule,originalHash:hash(x),recordHash:hash(row),
  evidence:'Screenshots 1950–1959; PS NAW 48–96 = 7 verified $0 finals; three Console Event2 Round2 NAW = $600 teams, 3VR; Shipski NAW profile not guessed'};
}
function verifyRow(row,entry){
 const x=DOC.batch.entries.find(z=>z.id===row?.id);
 return Boolean(x&&entry&&entry.id===row.id&&entry.recordId===row.id&&
  entry.policy===POLICY&&entry.decision==='published'&&entry.source===row.source&&
  entry.rule===x.rule&&entry.originalHash===hash(x)&&
  entry.recordHash===hash(row)&&row.verified===true&&
  JSON.stringify(project(x))===JSON.stringify(row));
}
validateProof();
module.exports={DOC,POLICY,EXPECTED,PS,DUOS,PS_T,DUOS_T,PS_RULE,DUOS_RULE,
 epicId,props,validateProof,project,approval,verifyRow};
