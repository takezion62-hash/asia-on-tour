'use strict';
// Screenshot-locked, account-verified historical Fortnite results, 1960–1969.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const ROOT=path.resolve(__dirname,'..');
const DOC=JSON.parse(fs.readFileSync(path.join(ROOT,'data/manual-approvals/20261121-s21-s22-s35-s36-s37-ten.json'),'utf8'));
const POLICY='verified-s21-s22-s35-s36-s37-ten-20261121';
const fail=(ok,msg)=>{if(!ok)throw Error('TEN_HISTORICAL_FINALS '+msg)};
const digest=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
const get=filename=>JSON.parse(fs.readFileSync(path.join(ROOT,filename),'utf8'));
function epicId(url){try{const u=new URL(url);if(u.protocol!=='https:'||
  u.hostname!=='fortnitetracker.com'||!u.pathname.startsWith('/profile/all/')||
  u.searchParams.size!==1)return null;
  const n=u.searchParams.get('id');return /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(n||'')?n.toLowerCase():null;
 }catch{return null}}
const GOLD=Object.freeze([
 // screenshot, season, rank, exact canonical team, raw names, Epic UUIDs, points, matches, team kills, VR, team prize
 [1960,'S37',10,['Hakkun','かなとˢˢʳ'],['TGR はっくん','かなとˢˢʳ'],['63826005-a9c2-4444-b113-589813cde1d8','81a7e88c-c001-418a-aeda-bcba98c54304'],100,3,4,1,200],
 [1961,'S36',13,['宇宙に行く兄弟募集','モバイル勢のまかろん'],['宇宙に行く兄弟募集','モバイル勢のまかろん'],['d49c5aba-1a4b-416f-8d10-ea56c4871ec5','facede25-f8fd-4f47-be4d-ecb0796abd33'],100,3,5,1,200],
 [1962,'S35',6,['TEITEI','Asuka'],['TEITEI','Asuka'],['b410ecc8-6342-4e7b-96a1-43815cbd2a0d','c34fb8f4-e6da-4345-a26c-d5bf33847f52'],100,3,19,1,200],
 [1963,'S35',10,['あおねこ','irodori'],['Celis あおねこ416','FA irodori'],['32fab8de-7cd0-41a1-aa87-fabf285e40f0','d9ff98ed-cdcb-461e-b818-0a7b2ce594c4'],100,3,11,1,200],
 [1964,'S35',12,['Pollo 17 ǃ ǃ','YAKOTA6x'],['Pollo 17 ǃ ǃ','YAKOTA6x'],['10a89ca8-d9c1-4036-8cc3-f4eac47bcc40','d02e4ebd-1504-4724-bbcc-81263cee3779'],100,3,10,1,200],
 [1965,'S35',14,['Shirochan on PS4','モバイル勢のまかろん'],['Shirochan on PS4','モバイル勢のまかろん'],['6727836a-4b40-44f6-b699-960c0d9c993d','facede25-f8fd-4f47-be4d-ecb0796abd33'],100,2,2,1,200],
 [1966,'S22',78,['まなくん'],['まなくん'],['ef76081c-71fa-42f7-a03a-6bf1e036213b'],15,6,4,0,200],
 [1967,'S22',96,['モバイル勢のまかろん'],['モバイル勢のまかろん'],['facede25-f8fd-4f47-be4d-ecb0796abd33'],4,6,1,0,200],
 [1968,'S21',42,['まなくん'],['まなくん'],['ef76081c-71fa-42f7-a03a-6bf1e036213b'],34,6,1,0,200],
 [1969,'S21',51,['モバイル勢のまかろん'],['モバイル勢のまかろん'],['facede25-f8fd-4f47-be4d-ecb0796abd33'],28,6,5,0,200]
]);
const META=Object.freeze({
 S37:{date:'2025-08-25',region:'NAW',event:'Duos Console Victory Cash Cup',eventId:'S37_ConsoleDuosCashCups',windowId:'S37_ConsoleDuosCashCups_Event2Round2_NAW',tournamentId:'ch6s4-console-duos-victory',team:'duo',round:'Event 2 · Round 2 / 賞金決勝',chapter:6,season:4,rule:'https://www.fortnite.com/competitive/rules-guidelines/rules-library/fortnite-duos-console-victory-cash-cups-chapter-6-season-4-official-rules'},
 S36:{date:'2025-07-26',region:'NAW',event:'Squid Grounds Cash Cup',eventId:'S36_SquidGroundVictoryDuosCup',windowId:'S36_VictoryDuosCup_Event5Round2_NAW',tournamentId:'ch6s3-squid-grounds-cash-cup',team:'duo',round:'Event 5 · Round 2 / 賞金決勝',chapter:6,season:3,rule:'https://www.fortnite.com/competitive/events/S36_SquidGroundVictoryDuosCup/?region=NAW'},
 S35:{date:'2025-05-18',region:'NAW',event:'Duos Console Victory Cash Cup',eventId:'S35_VictoryDuosCup',windowId:'S35_VictoryDuosCup_Event1Round2_NAW',tournamentId:'ch6s2-console-duos-victory',team:'duo',round:'Event 1 · Round 2 / 賞金決勝',chapter:6,season:2,rule:'https://www.fortnite.com/news/fortnite-duos-console-victory-cash-cups-may-2025-official-rules'},
 S22:{date:'2022-11-30',region:'NAW',event:'PlayStation Cup',eventId:'S22_PlaystationCupNov',windowId:'S22_PlaystationCupNov_NAW_Final',tournamentId:'ch3s4-playstation-cup-november',team:'solo',round:'Final / 賞金決勝',chapter:3,season:4,rule:'https://www.fortnite.com/news/fortnite-playstation-cup-chapter-3-season-4-official-rules-november-2022'},
 S21:{date:'2022-07-24',region:'OCE',event:'PlayStation Cup',eventId:'S21_PlaystationCupJuly',windowId:'S21_PlaystationCupJuly_OCE_Final',tournamentId:'ch3s3-playstation-cup-july',team:'solo',round:'Final / 賞金決勝',chapter:3,season:3,rule:'https://www.fortnite.com/news/fortnite-playstation-cup-chapter-3-season-3-official-rules-july-2022'}
});
const originalId=(s,meta,rank)=>'owner-'+s.toLowerCase()+'-'+meta.region.toLowerCase()+'-'+(meta.team==='duo'?'duo':'ps')+'-'+meta.date.replace(/-/g,'')+'-r'+rank;
function validateProof(){
 const b=DOC.batch,e=DOC.expected;
 fail(DOC.version===1&&b?.id==='owner-s21-s22-s35-s36-s37-ten-20261121'&&
  b.reviewedOn==='2026-11-21'&&b.entries?.length===10&&e?.rows===10&&
  e.duoRows===6&&e.soloRows===4&&e.duoVRs===6&&e.teamPrize===2000&&
  e.personalPrize===2000&&e.newPlayers?.length===7&&e.newAliases?.length===2,'batch data changed');
 const catalog=get('tournaments.json').catalog,rules=get('tournament-rules.json').rules;
 const checkS35=rules.find(x=>x.id==='ch6s2-console-duos-victory');
 const checkS37=rules.find(x=>x.id==='ch6s4-console-duos-victory');
 fail(checkS35?.source===META.S35.rule&&checkS35.prizePerVictory===100&&
  checkS35.matchCaps?.['賞金決勝']===3&&checkS37?.source===META.S37.rule&&
  checkS37.prizePerVictory===100,'official duo VR rules changed');
 const accounts=new Map(),ranks=new Set(),ids=new Set();
 for(let i=0;i<GOLD.length;i++){
  const [shot,seasonId,rank,names,raw,uuids,points,matches,kills,vr,prize]=GOLD[i];
  const x=b.entries[i],meta=META[seasonId],solo=meta.team==='solo';
  const src='https://fortnitetracker.com/events/epicgames_'+meta.eventId+'_'+meta.region+'?window='+meta.windowId;
  fail(x&&x.id===originalId(seasonId,meta,rank)&&x.screenshot===shot&&
   x.date===meta.date&&x.region===meta.region&&x.seasonId===seasonId&&
   x.chapter===meta.chapter&&x.season===meta.season&&x.event===meta.event&&
   x.eventId===meta.eventId&&x.windowId===meta.windowId&&x.tournamentId===meta.tournamentId&&
   x.round===meta.round&&x.rule===meta.rule&&x.source===src&&
   x.team===meta.team&&JSON.stringify(x.playerNames)===JSON.stringify(names)&&
   JSON.stringify(x.rawNames)===JSON.stringify(raw)&&x.rank===rank&&
   x.points===points&&x.matches===matches&&x.kills===kills&&
   x.vrs===vr&&x.prize===prize&&x.teamPrize===prize&&
   x.prizePerPlayer===(solo?200:100),'screenshot or prize changed: '+shot);
  fail(x.profileUrls?.length===names.length,'missing original player links: '+shot);
  for(let p=0;p<names.length;p++){
   const uid=epicId(x.profileUrls[p]);
   fail(uid===uuids[p],'wrong Epic account: '+shot+'/'+p);
   fail(!accounts.has(uid)||accounts.get(uid)===names[p],'multiple player owners: '+uid);
   accounts.set(uid,names[p]);
  }
  const t=catalog.filter(y=>y.id===meta.tournamentId&&y.seasonId===seasonId&&
   y.sourceEventIds.includes(meta.eventId)&&y.team===meta.team&&
   y.mode==='battle-royale'&&y.name===meta.event);
  fail(t.length===1,'invalid tournament type: '+shot);
  fail(t[0].evidence?.some(z=>z.url===meta.rule)||rules.some(z=>z.id===meta.tournamentId&&z.source===meta.rule),
   'official tournament or rulebook payout source missing: '+shot);
  const month=get('calendar-history/'+meta.date.slice(0,7)+'.json');
  fail(month.month===meta.date.slice(0,7)&&month.sessions.filter(z=>z.eventId===meta.eventId&&
   z.sourceWindowId===meta.windowId&&z.dateJst===meta.date&&z.region===meta.region&&
   z.seasonId===seasonId&&z.tournamentId===meta.tournamentId&&
   z.stage===(solo?'単一ラウンド':'決勝')).length===1,'archive window missing: '+shot);
  fail(!ids.has(x.id)&&!ranks.has(meta.windowId+'/'+rank),'duplicate rank: '+shot);
  ids.add(x.id);ranks.add(meta.windowId+'/'+rank);
  if(solo)fail(vr===0&&prize===200&&matches<=6&&
   (seasonId==='S21'?rank>=11&&rank<=90:rank>=51&&rank<=100),
   'PlayStation award based on position, not Victory Royale: '+shot);
  else fail(vr===1&&prize===200&&matches<=3&&matches>=vr&&points===100,
   'Duo 1VR = team $200 = each $100: '+shot);
 }
 fail(b.entries.reduce((n,x)=>n+x.prize,0)===2000&&
  b.entries.reduce((n,x)=>n+x.vrs,0)===6,'wrong total money or wins');
 return true;
}
function project(x){
 const meta=META[x.seasonId],solo=x.team==='solo',people=x.playerNames.slice();
 const note='ユーザー提供Tracker画像'+x.screenshot+'・'+x.date+' '+x.region+' '+meta.event+' '+meta.round+
  ' '+x.rank+'位、'+x.points+'pt、'+x.matches+'試合、'+x.kills+(solo?'キル':'チームK')+
  '、'+x.vrs+'VR。'+(solo?'Epic公式の順位別個人賞金$200（0VR）':
   'Epic公式の1VRチーム賞金$200・各選手$100')+
  '。実際の送金完了は未確認。順位表: '+x.source+'、公式根拠: '+x.rule;
 return {id:x.id,date:x.date,region:x.region,player:people.join(' / '),players:people,
  playerRaw:x.rawNames.join(' / '),event:x.event,round:x.round,rank:x.rank,
  points:x.points,matches:x.matches,kills:x.kills,vrs:x.vrs,prize:x.prize,
  prizePerPlayer:x.prizePerPlayer,teamPrize:x.teamPrize,kind:'賞金決勝',
  seasonId:x.seasonId,chapter:x.chapter,season:x.season,tournamentId:x.tournamentId,
  source:x.source,profiles:people.map((name,i)=>({name,url:x.profileUrls[i]})),
  ...(solo?{profileUrl:x.profileUrls[0]}:{}),verified:true,note};
}
function approval(x){
 const row=project(x);return {id:x.id,recordId:x.id,decision:'published',policy:POLICY,
  approvedAt:'2026-11-20T16:05:27Z',
  approvedBy:'ChatGPT / user-provided tracker screenshot and profile UUID + official prize rules',
  source:x.source,rule:x.rule,originalHash:digest(x),recordHash:digest(row),
  evidence:'10 original Fortnite Tracker screenshots 1960–1969; 6 NAW duo Victory Royales ($100/player) + 4 NAW/OCE 2022 PlayStation rank prizes ($200/player, 0VR)'};
}
function verifyRow(row,approved){
 const x=DOC.batch.entries.find(e=>e.id===row?.id);
 return Boolean(x&&approved&&approved.id===row.id&&approved.recordId===row.id&&
  approved.decision==='published'&&approved.policy===POLICY&&
  approved.rule===x.rule&&approved.source===row.source&&
  approved.originalHash===digest(x)&&approved.recordHash===digest(row)&&
  row.verified===true&&JSON.stringify(project(x))===JSON.stringify(row));
}
validateProof();
module.exports={DOC,POLICY,GOLD,META,originalId,epicId,validateProof,project,approval,verifyRow};
