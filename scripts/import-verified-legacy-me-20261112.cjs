'use strict';
/** One-time, idempotent manual import. Source: user-provided 8 Fortnite Tracker screenshots on 2026-11-12. */
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const read = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const write = (file, data) => fs.writeFileSync(path.join(root, file), JSON.stringify(data, null, 2) + '\n');
const results = read('results.json');
const players = read('players.json');
const tournaments = read('tournaments.json');
const sources = {
 S30:'https://fortnitetracker.com/events/epicgames_S30_SoloVictoryCashCup_ME?window=S30_SoloVictoryCashCup_Event4Round2_ME',
 S22:'https://fortnitetracker.com/events/epicgames_S22_DivisionalCups_Elite_Finals_ME?window=S22_DivisionalCups_Elite_Finals_ME_Week5_v2',
 S21:'https://fortnitetracker.com/events/epicgames_S21_SoloCashCup_ME?window=S21_SoloCashCup_ME_Event1_Round2'
};
const profiles = {
 '隠れもふ':'https://fortnitetracker.com/profile/all/%E9%9A%A0%E3%82%8C%E3%82%82%E3%81%B5/events?id=008df4c8-31c8-4e18-a9f1-2b65afd89b0c',
 'Solary Kurаmа':'https://fortnitetracker.com/profile/all/Solary%20Kur%D0%B0m%D0%B0/events?id=1872812e-3050-4d6f-89bc-bd652b1d38d4',
 'NqRu':'https://fortnitetracker.com/profile/all/NqRu/events?id=06632311-fb45-4e9b-993c-a2472f3712db',
 'Aim':'https://fortnitetracker.com/profile/all/Aim/events?id=8baf28ea-b515-48e6-9232-d03509c13382',
 'Kame':'https://fortnitetracker.com/profile/all/Kame%20/events?id=20be8b17-b7eb-4b7d-b2b4-69004da9abaa',
 'ZAZI':'https://fortnitetracker.com/profile/all/ZAZI/events?id=f08aad62-9bf0-40d6-beb7-8c7aea8e0a1f',
 'ITACHI':'https://fortnitetracker.com/profile/all/ITACHI/events?id=b0ab13c3-5ad0-4493-a6be-dedfa83a5ddc',
 'raru':'https://fortnitetracker.com/profile/all/raru/events?id=8810f7b4-9b48-4bc3-992e-78e4cda05d76',
 'Ehre そーだむ':'https://fortnitetracker.com/profile/all/Ehre%20%E3%81%9D%E3%83%BC%E3%81%A0%E3%82%80/events?id=f7b24f1a-6a9a-43d7-b1fc-9ad8b431883d'
};
const pid = name => new URL(profiles[name]).searchParams.get('id');
function row(s,id,date,names,event,round,rank,points,matches,kills,vrs,prize,avgPlace,alive,kd) {
 const duo = names.length===2;
 return {
  id,date,region:'ME',player:names.join(' / '),
  ...(duo?{players:names,profiles:names.map(name=>({name,url:profiles[name]})),teamPrize:prize,prizePerPlayer:prize/2}:{profileUrl:profiles[names[0]]}),
  playerRaw:duo?names.join(' / '):names[0]==='Solary Kurаmа'?'Solary Kurama':names[0],
  event,round,rank,points,kills,vrs,prize,kind:'賞金決勝',matches,seasonId:s,
  chapter:s==='S30'?5:3,season:s==='S22'?4:3,
  tournamentId:s==='S30'?'ch5s3-solo-victory-cup':s==='S22'?'ch3s4-elite-cup-weekly-finals':'ch3s3-solo-cash-cup',
  source:sources[s],verified:true,
  note:'ユーザー提供2026-11-12 Fortnite Tracker画像で'+date+' ME '+event+' '+round+' '+rank+'位・'+points+'pt・'+matches+'試合・'+kills+(duo?'チーム':'')+'キル・'+vrs+'VR・'+(prize===0?'賞金なし':duo?'チーム賞金$'+prize+'（各$'+(prize/2)+'）':'個人賞金$'+prize)+'を確認。本人Tracker ID: '+names.map(n=>n+'='+pid(n)).join(' / ')+'。'+(s==='S21'?'順位制賞金のためVR獲得数から賞金を算出しない。':s==='S30'?'1VRにつき$100。':'Elite Cup Week 5 決勝。')+(names.includes('Kame')?'KameとKAMEは別プレイヤー。':'')+'支払完了は未確認。',
  trackerStats:{verified:true,source:sources[s],avgPlace,avgTimeAliveSeconds:alive,kdRatio:kd}
 };
}
const added=[
 row('S30','s30-me-solo-vc-final-20240625-kakuremofu','2024-06-25',['隠れもふ'],'Solo Victory Cup Battle Royale','Event 4 · Round 2 / 賞金決勝',18,100,2,6,1,100,3,1587,6),
 row('S30','s30-me-solo-vc-final-20240625-solary-kurama','2024-06-25',['Solary Kurаmа'],'Solo Victory Cup Battle Royale','Event 4 · Round 2 / 賞金決勝',28,100,3,5,1,100,30.67,1085,2.5),
 row('S22','s22-me-elite-weekly-finals-20221030-nqru-aim','2022-10-30',['NqRu','Aim'],'Elite Cup Weekly Finals','Week 5 · Finals / 賞金決勝',30,100,6,9,0,400,30.33,750,1.5),
 row('S22','s22-me-elite-weekly-finals-20221030-kame-zazi','2022-10-30',['Kame','ZAZI'],'Elite Cup Weekly Finals','Week 5 · Finals / 賞金決勝',47,20,6,3,0,0,39.5,525,0.5),
 row('S21','s21-me-solo-cash-final-20220630-aim','2022-06-30',['Aim'],'Solo Cash Cup','Event 1 · Round 2 / 賞金決勝',6,89,6,10,1,200,31.33,1190,2),
 row('S21','s21-me-solo-cash-final-20220630-itachi','2022-06-30',['ITACHI'],'Solo Cash Cup','Event 1 · Round 2 / 賞金決勝',55,27,5,2,0,0,46,1027,0.4),
 row('S21','s21-me-solo-cash-final-20220630-raru','2022-06-30',['raru'],'Solo Cash Cup','Event 1 · Round 2 / 賞金決勝',71,21,6,6,0,0,75.67,304,1),
 row('S21','s21-me-solo-cash-final-20220630-ehre-sodamu','2022-06-30',['Ehre そーだむ'],'Solo Cash Cup','Event 1 · Round 2 / 賞金決勝',99,1,2,0,0,0,74.5,559,0)
];
const asRoster=x=>x.players||[x.player];
const sameRoster=(a,b)=>JSON.stringify(asRoster(a).slice().sort())===JSON.stringify(asRoster(b).slice().sort());
let changes=0;
for(const record of added){
 const existing=results.find(x=>x.id===record.id);
 if(existing){
  if(['date','region','event','round','rank','points','matches','kills','vrs','prize','player'].some(k=>existing[k]!==record[k])||!sameRoster(existing,record))
   throw new Error('Existing ID conflicts: '+record.id);
  continue;
 }
 const overlap=results.find(x=>x.date===record.date&&x.region===record.region&&x.event===record.event&&sameRoster(x,record)&&x.rank===record.rank);
 if(overlap)throw new Error('Possible duplicate under different ID: '+overlap.id+' vs '+record.id);
 results.push(record);changes++;
}
const names=['隠れもふ','NqRu','Kame','ITACHI','raru','Ehre そーだむ'];
const accents=['pink','cyan','violet'];
for(const [i,name] of names.entries()){
 if(players.candidates.some(x=>x.name===name))continue;
 const record=added.find(x=>asRoster(x).includes(name));
 players.candidates.push({
  name,initials:name==='隠れもふ'?'隠れ':name==='Ehre そーだむ'?'そー':name.slice(0,2).toUpperCase(),
  accent:accents[i%3],desc:record.date+' ME '+record.event+' '+record.rank+'位・'+record.kills+(record.players?'チーム':'')+'キル・'+record.vrs+'VR・個人賞金$'+(record.players?record.prizePerPlayer:record.prize)+'。本人Tracker ID '+pid(name)+'で照合。'+(name==='Kame'?'KAMEとは別人。':'')
 });changes++;
}
if((players.confirmedAliases.KAME||[]).includes('Kame'))throw new Error('Kame must not be merged with KAME');
const axis=(key)=>tournaments.axes.find(x=>x.key===key).options;
if(!axis('series').some(x=>x.id==='elite-cup')){axis('series').push({id:'elite-cup',label:'Elite Cup'});changes++;}
if(!axis('subtype').some(x=>x.id==='elite-cup-weekly-finals')){axis('subtype').push({id:'elite-cup-weekly-finals',label:'Elite Cup Weekly Finals'});changes++;}
if(!tournaments.catalog.some(x=>x.id==='ch3s4-elite-cup-weekly-finals')){
 tournaments.catalog.push({id:'ch3s4-elite-cup-weekly-finals',name:'Elite Cup Weekly Finals',chapter:3,season:4,seasonId:'S22',sourceEventIds:['S22_DivisionalCups_Elite_Finals'],series:'elite-cup',mode:'battle-royale',subtype:'elite-cup-weekly-finals',team:'duo',platform:'cross-platform',unknownFields:[],evidence:[{text:'2022/10/30 JST ME Week5 Finals：NqRu/Aim 30位・100pt・9チームキル・賞金$400（各$200）、Kame/ZAZI 47位・20pt・3チームキル・賞金なし。ユーザー提供Tracker画像と各本人IDで確認。',url:sources.S22}]});
 changes++;
}
for(const [id,token,evidence] of [
 ['ch3s3-solo-cash-cup','2022/6/30 JST ME Event1','2022/6/30 JST ME Event1 Round2：Aim 6位・10キル・1VR・賞金$200、ITACHI 55位、raru 71位、Ehre そーだむ99位（後3名賞金なし）。'],
 ['ch5s3-solo-victory-cup','2024/6/25 JST ME Event4','2024/6/25 JST ME Event4 Round2：隠れもふ18位・6K・1VR・$100、Solary Kurаmа28位・5K・1VR・$100。']
]){
 const entry=tournaments.catalog.find(x=>x.id===id);
 if(!entry)throw new Error('Missing catalog '+id);
 if(!entry.evidence.some(x=>x.text.startsWith(token))){entry.evidence.push({text:evidence+'ユーザー提供Tracker画像で確認。',url:sources[id.includes('s3-solo-cash')?'S21':'S30']});changes++;}
}
if(changes){
 write('results.json',results);write('players.json',players);write('tournaments.json',tournaments);
}
console.log('Legacy ME import: '+changes+' changes; records='+results.length+', added snapshots='+added.length);
