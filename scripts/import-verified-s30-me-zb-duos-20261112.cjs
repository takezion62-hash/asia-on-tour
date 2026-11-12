'use strict';
/** One-time, idempotent publication from user's Fortnite Tracker screenshots on 2026-11-12. */
const fs=require('node:fs'), path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const write=(p,x)=>fs.writeFileSync(path.join(root,p),JSON.stringify(x,null,2)+'\n');
const data=read('results.json'),players=read('players.json'),tournaments=read('tournaments.json');
const source='https://fortnitetracker.com/events/epicgames_S30_DuosCashCupZB_ME?window=S30_DuosCashCupZB_Event2Round2_ME';
const profiles={
 Zerokun:'https://fortnitetracker.com/profile/all/Zerokun%20/events?id=a1d57f4a-c6fd-4aa6-bb58-2cc933677f9e',
 Fuukun:'https://fortnitetracker.com/profile/all/Fuukun/events?id=fd65e10f-657e-42f5-9fe1-5d3a9348004a',
 Aim:'https://fortnitetracker.com/profile/all/Aim/events?id=8baf28ea-b515-48e6-9232-d03509c13382',
 ZAZI:'https://fortnitetracker.com/profile/all/ZAZI/events?id=f08aad62-9bf0-40d6-beb7-8c7aea8e0a1f',
 Tayler:'https://fortnitetracker.com/profile/all/Tayler/events?id=31f184df-3e4e-4d20-b3cc-cd439d8ce705',
 Shelom:'https://fortnitetracker.com/profile/all/Shelom/events?id=c2688f57-2c94-4718-80df-e1573cff940b',
 Raito:'https://fortnitetracker.com/profile/all/Raito/events?id=83558d8a-3873-485d-a25c-7f0787ec70c6',
 Razl:'https://fortnitetracker.com/profile/all/Razl/events?id=aacd8650-a0de-4b90-8d70-0115f31df180',
 suisei_s:'https://fortnitetracker.com/profile/all/suisei_s/events?id=7f94dd2a-8fe5-4f57-9d15-b33d649880ee',
 'ちゃる':'https://fortnitetracker.com/profile/all/charufn/events?id=e3d0bd7d-4b8c-4e60-ac46-564918e3e3a1',
 'MMC KAAN BABA':'https://fortnitetracker.com/profile/all/MMC%20KAAN%20BABA/events?id=2bf3a503-80fa-49ff-a655-2c23c2e384cf',
 'みるやちぇ':'https://fortnitetracker.com/profile/all/%E3%81%BF%E3%82%8B%E3%82%84%E3%81%A1%E3%81%87/events?id=dd786061-211a-46fb-b849-4687e32189b9',
 favsie:'https://fortnitetracker.com/profile/all/favsie/events?id=4d91273f-56bd-4e8c-811c-8a76f89c18b8',
 meah:'https://fortnitetracker.com/profile/all/meah/events?id=51942f08-b9c3-4f3e-bb12-5dd3e13fafa6',
 Minipiyo:'https://fortnitetracker.com/profile/all/Minipiyo/events?id=022c1a1b-18ea-4c3e-a392-2a086b0b6dcf',
 KanA:'https://fortnitetracker.com/profile/all/KanA/events?id=ce198d52-d8e4-4400-a8a8-44a769eeccb7',
 Choco:'https://fortnitetracker.com/profile/all/Choco/events?id=2b094ce4-6d09-4e26-8301-c560f9b1d8c3',
 sena:'https://fortnitetracker.com/profile/all/sena/events?id=f4f0cf26-d8e1-4042-a9cc-8f731831d1f2',
 '112345abcde':'https://fortnitetracker.com/profile/all/112345abcde/events?id=51cac31c-907c-4e66-9bff-771a2c723883',
 candyz1a:'https://fortnitetracker.com/profile/all/blue%20p%20candyz1a/events?id=f5c1ab9c-c1ca-429e-aa3c-167c90da2121'
};
const tournament=tournaments.catalog.find(x=>x.id==='ch5s3-zb-duos-cash');
if(!tournament||tournament.name!=='ZB Duos Cash Cup'||!tournament.sourceEventIds.includes('S30_DuosCashCupZB')||tournament.mode!=='zero-build'||tournament.team!=='duo')throw Error('Missing or incompatible confirmed tournament catalog');
const fixtures=[
 ['Zerokun','Fuukun',2,294,16,600,8.50,1381,2.67],
 ['Aim','ZAZI',5,206,16,200,16.17,1258,2.67],
 ['Tayler','Shelom',6,196,22,200,26.67,921,3.67],
 ['Raito','Razl',7,182,19,200,23,1041,3.17],
 ['suisei_s','ちゃる',8,172,8,200,18.33,1160,1.33],
 ['MMC KAAN BABA','みるやちぇ',14,152,9,200,17,1213,1.50],
 ['favsie','meah',25,128,15,200,28.50,1015,2.50],
 ['Minipiyo','KanA',28,112,9,0,26.67,988,1.50],
 ['Choco','sena',29,110,7,0,23.67,1179,1.17],
 ['112345abcde','candyz1a',30,108,9,0,26.33,982,1.50]
];
function make(f){
 const [a,b,rank,points,kills,prize,avgPlace,avgTimeAliveSeconds,kdRatio]=f;
 const names=[a,b];
 const id='s30-me-zb-duos-cash-final-20240613-'+String(rank).padStart(2,'0');
 const raw=names.map(n=>n==='ちゃる'?'charufn':n==='candyz1a'?'blue p candyz1a':n).join(' / ');
 return {id,date:'2024-06-13',region:'ME',player:names.join(' / '),players:names,playerRaw:raw,
 event:'ZB Duos Cash Cup',round:'Event 2 · Round 2 / 賞金決勝',rank,points,kills,vrs:0,prize,teamPrize:prize,prizePerPlayer:prize/2,kind:'賞金決勝',
 matches:6,seasonId:'S30',chapter:5,season:3,tournamentId:'ch5s3-zb-duos-cash',source,verified:true,
 profiles:names.map(name=>({name,url:profiles[name]})),
 note:'ユーザー提供2026/11/12 Fortnite Tracker画像で2024/6/13 ME Zero Build Duos Cash Cup Event2 Round2 の'+rank+'位・'+points+'pt・6試合・'+kills+'チームキル・0VR・チーム賞金$'+prize+'（各$'+prize/2+'）を確認。名義は'+raw+'、本人Tracker ID '+names.map(n=>n+'='+new URL(profiles[n]).searchParams.get('id')).join('、')+'で照合。賞金は順位制で0VRでも獲得。支払完了の断定ではない。',
 trackerStats:{verified:true,source,avgPlace,avgTimeAliveSeconds,kdRatio}
 };
}
const added=fixtures.map(make), ids=new Set(data.map(x=>x.id));
let changes=0;
function sortedRoster(row){return (row.players||[row.player]).slice().sort().join('\u0001');}
for(const entry of added){
 const exists=data.find(x=>x.id===entry.id);
 if(exists){
  if(['date','region','event','rank','points','matches','kills','vrs','prize','player'].some(k=>exists[k]!==entry[k])||sortedRoster(exists)!==sortedRoster(entry))throw Error('Conflicting existing result id '+entry.id);
  continue;
 }
 const possible=data.find(x=>x.date===entry.date&&x.region==='ME'&&x.event===entry.event&&
 (sortedRoster(x)===sortedRoster(entry)||x.rank===entry.rank&&x.points===entry.points&&x.kills===entry.kills));
 if(possible)throw Error('Possible overlapping result '+possible.id+' vs '+entry.id);
 if(ids.has(entry.id))throw Error('Duplicate result id '+entry.id);
 data.push(entry);ids.add(entry.id);changes++;
}
const newPlayers=['Tayler','Shelom','suisei_s','KanA'];
for(const [i,name] of newPlayers.entries()){
 if(players.candidates.some(x=>x.name===name))continue;
 const entry=added.find(x=>x.players.includes(name));
 players.candidates.push({name,initials:name.slice(0,2).toUpperCase(),accent:['pink','cyan','violet'][i%3],
 desc:'2024/6/13 ME Zero Build Duos Cash Cup Event2決勝 '+entry.rank+'位・'+entry.kills+'チームキル・0VR・個人賞金$'+entry.prizePerPlayer+'。Tracker ID '+new URL(profiles[name]).searchParams.get('id')+'で確認。'});
 changes++;
}
for(const [name,alias] of [['ちゃる','charufn'],['candyz1a','blue p candyz1a']]){
 const list=players.confirmedAliases[name]||[];
 if(list.includes(alias))continue;
 const owners=Object.entries(players.confirmedAliases).filter(([owner,aliases])=>owner!==name&&aliases.includes(alias));
 if(owners.length)throw Error('Alias linked elsewhere '+alias);
 players.confirmedAliases[name]=list.concat(alias);changes++;
}
const evidenceText='2024/6/13 ME ZB Duos Cash Cup Event2 Round2：Zerokun/Fuukun 2位$600、Aim/ZAZI 5位$200、Tayler/Shelom 6位$200など合計10組をユーザー提供Fortnite Tracker画像・各本人IDで確認。0VRでも順位に応じ現金賞金。';
if(!tournament.evidence.some(x=>x.text===evidenceText)){tournament.evidence.push({text:evidenceText,url:source});changes++;}
const {validateData}=require('./data-checks.cjs');
const verification=validateData({results:data,players,tournaments});
if(verification.errors.length)throw Error('Full data validation failed: '+JSON.stringify(verification.errors.slice(0,10)));
if(changes){
 write('results.json',data);write('players.json',players);write('tournaments.json',tournaments);
}
console.log('Verified S30 ME ZB Duos: '+added.length+' team records / 20 player appearances / '+changes+' changes; total '+data.length+' records');
