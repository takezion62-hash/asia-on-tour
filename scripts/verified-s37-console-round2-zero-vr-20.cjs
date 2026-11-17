'use strict';
// Exactly 20 S37 Round 2 non-winning duos from three complete ranked windows.
const POLICY="verified-s37-console-round2-zero-vr-20-20261117";
const RULE="https://www.fortnite.com/competitive/rules-guidelines/rules-library/fortnite-duos-console-victory-cash-cups-chapter-6-season-4-official-rules?region=NAC";
const SNAPSHOT_PATH="data/manual-approvals/s37-console-round2-zero-vr-20-snapshot-20261117.json";
const SOURCE_BLOB="43d4af41369f1e3fc30baf60c84de9b8062ff47b";
const GROUPS=Object.freeze([
 Object.freeze({"date":"2025-09-28","region":"NAW","eventNo":6,"expect":8,"key":"epicgames_S37_ConsoleDuosCashCups_NAW/S37_ConsoleDuosCashCups_Event6Round2_NAW","window":"S37_ConsoleDuosCashCups_Event6Round2_NAW","sessionEndUtc":"2025-09-28T00:00:00.000Z","count":8,"pages":3}),
 Object.freeze({"date":"2025-10-04","region":"OCE","eventNo":7,"expect":3,"key":"epicgames_S37_ConsoleDuosCashCups_OCE/S37_ConsoleDuosCashCups_Event7Round2_OCE","window":"S37_ConsoleDuosCashCups_Event7Round2_OCE","sessionEndUtc":"2025-10-04T07:00:00.000Z","count":3,"pages":3}),
 Object.freeze({"date":"2025-10-26","region":"NAW","eventNo":10,"expect":9,"key":"epicgames_S37_ConsoleDuosCashCups_NAW/S37_ConsoleDuosCashCups_Event10Round2_NAW","window":"S37_ConsoleDuosCashCups_Event10Round2_NAW","sessionEndUtc":"2025-10-26T00:00:00.000Z","count":9,"pages":3})
]);
const SPECS=Object.freeze([
 Object.freeze({"id":"auto-s37-bb586ddb336e","date":"2025-09-28","region":"NAW","player":"kmyt / Choco","playerRaw":"やまもと そうし / nagisa furukawaǃ","players":["kmyt","Choco"],"rank":29,"points":0,"kills":9,"vrs":0,"matches":2,"source":"https://www.fortnite.com/competitive/events/S37_ConsoleDuosCashCups/?region=NAW&round=S37_ConsoleDuosCashCups_Event6Round2_NAW","eventNo":6}),
 Object.freeze({"id":"auto-s37-afafda8539da","date":"2025-09-28","region":"NAW","player":"VLZ 対面の極意 / CALM かずにょっす","playerRaw":"VLZ 対面の極意 / CALM かずにょっす","players":["VLZ 対面の極意","CALM かずにょっす"],"rank":111,"points":0,"kills":6,"vrs":0,"matches":3,"source":"https://www.fortnite.com/competitive/events/S37_ConsoleDuosCashCups/?region=NAW&round=S37_ConsoleDuosCashCups_Event6Round2_NAW","eventNo":6}),
 Object.freeze({"id":"auto-s37-f37ce32441f8","date":"2025-09-28","region":"NAW","player":"MAT4DOR. / ちゃる","playerRaw":"MAT4DOR. / charufn","players":["MAT4DOR.","ちゃる"],"rank":154,"points":0,"kills":4,"vrs":0,"matches":3,"source":"https://www.fortnite.com/competitive/events/S37_ConsoleDuosCashCups/?region=NAW&round=S37_ConsoleDuosCashCups_Event6Round2_NAW","eventNo":6}),
 Object.freeze({"id":"auto-s37-2578206ab630","date":"2025-09-28","region":"NAW","player":"すたーだよ / falcon manzuǃ","playerRaw":"すたーだよ / falcon manzuǃ","players":["すたーだよ","falcon manzuǃ"],"rank":168,"points":0,"kills":3,"vrs":0,"matches":3,"source":"https://www.fortnite.com/competitive/events/S37_ConsoleDuosCashCups/?region=NAW&round=S37_ConsoleDuosCashCups_Event6Round2_NAW","eventNo":6}),
 Object.freeze({"id":"auto-s37-4995457384ec","date":"2025-09-28","region":"NAW","player":"らる / まろやかれおちゃあいと","playerRaw":"はあちゃまっちゃまーwwǃǃӜ / 爆運まろやかれおちゃあいと爆運","players":["らる","まろやかれおちゃあいと"],"rank":185,"points":0,"kills":3,"vrs":0,"matches":3,"source":"https://www.fortnite.com/competitive/events/S37_ConsoleDuosCashCups/?region=NAW&round=S37_ConsoleDuosCashCups_Event6Round2_NAW","eventNo":6}),
 Object.freeze({"id":"auto-s37-6f063dea309f","date":"2025-09-28","region":"NAW","player":"かぷせるてぃーてぃーTTていてい / Amo","playerRaw":"Pollo 17 ǃ ǃ / AmonRoadToGlorÿ","players":["かぷせるてぃーてぃーTTていてい","Amo"],"rank":211,"points":0,"kills":1,"vrs":0,"matches":2,"source":"https://www.fortnite.com/competitive/events/S37_ConsoleDuosCashCups/?region=NAW&round=S37_ConsoleDuosCashCups_Event6Round2_NAW","eventNo":6}),
 Object.freeze({"id":"auto-s37-4cf59d3256db","date":"2025-09-28","region":"NAW","player":"えいぶか / あすふぁろず","playerRaw":"s2 ほんまにふわかろん雑魚 / あすふぁろず","players":["えいぶか","あすふぁろず"],"rank":235,"points":0,"kills":0,"vrs":0,"matches":3,"source":"https://www.fortnite.com/competitive/events/S37_ConsoleDuosCashCups/?region=NAW&round=S37_ConsoleDuosCashCups_Event6Round2_NAW","eventNo":6}),
 Object.freeze({"id":"auto-s37-20561d92eebb","date":"2025-09-28","region":"NAW","player":"おこっとふー / センス0","playerRaw":"おこっとふー / 光オロチs","players":["おこっとふー","センス0"],"rank":236,"points":0,"kills":0,"vrs":0,"matches":3,"source":"https://www.fortnite.com/competitive/events/S37_ConsoleDuosCashCups/?region=NAW&round=S37_ConsoleDuosCashCups_Event6Round2_NAW","eventNo":6}),
 Object.freeze({"id":"auto-s37-7cde35ed5197","date":"2025-10-04","region":"OCE","player":"りーく / huggyfv","playerRaw":"Wcr r3exk / STX Huggy","players":["りーく","huggyfv"],"rank":90,"points":0,"kills":4,"vrs":0,"matches":2,"source":"https://www.fortnite.com/competitive/events/S37_ConsoleDuosCashCups/?region=OCE&round=S37_ConsoleDuosCashCups_Event7Round2_OCE","eventNo":7}),
 Object.freeze({"id":"auto-s37-5a4406d38e42","date":"2025-10-04","region":"OCE","player":"Asuka / Rabbit","playerRaw":"VOLARE Asuka / Yotta Rabbitǃ","players":["Asuka","Rabbit"],"rank":92,"points":0,"kills":4,"vrs":0,"matches":2,"source":"https://www.fortnite.com/competitive/events/S37_ConsoleDuosCashCups/?region=OCE&round=S37_ConsoleDuosCashCups_Event7Round2_OCE","eventNo":7}),
 Object.freeze({"id":"auto-s37-c6abe345a83e","date":"2025-10-04","region":"OCE","player":"CALM かずにょっす / 永瀬さらLOVEじょーじ396","playerRaw":"CALM かずにょっす / 永瀬さらLOVEじょーじ396","players":["CALM かずにょっす","永瀬さらLOVEじょーじ396"],"rank":192,"points":0,"kills":1,"vrs":0,"matches":2,"source":"https://www.fortnite.com/competitive/events/S37_ConsoleDuosCashCups/?region=OCE&round=S37_ConsoleDuosCashCups_Event7Round2_OCE","eventNo":7}),
 Object.freeze({"id":"auto-s37-3fe68284f399","date":"2025-10-26","region":"NAW","player":"りーく / しこぴよフォートナイト","playerRaw":"Wcr r3exk / しこぴよフォートナイト","players":["りーく","しこぴよフォートナイト"],"rank":79,"points":0,"kills":8,"vrs":0,"matches":3,"source":"https://www.fortnite.com/competitive/events/S37_ConsoleDuosCashCups/?region=NAW&round=S37_ConsoleDuosCashCups_Event10Round2_NAW","eventNo":10}),
 Object.freeze({"id":"auto-s37-b023a770df26","date":"2025-10-26","region":"NAW","player":"りーち / モバイル勢のまかろん","playerRaw":"35ピングなので対面勝てないです / BRN 916GonLuck","players":["りーち","モバイル勢のまかろん"],"rank":123,"points":0,"kills":5,"vrs":0,"matches":3,"source":"https://www.fortnite.com/competitive/events/S37_ConsoleDuosCashCups/?region=NAW&round=S37_ConsoleDuosCashCups_Event10Round2_NAW","eventNo":10}),
 Object.freeze({"id":"auto-s37-8e8f4a0fbfd4","date":"2025-10-26","region":"NAW","player":"きおらび / SN Season","playerRaw":"きおらび / SN Season","players":["きおらび","SN Season"],"rank":131,"points":0,"kills":3,"vrs":0,"matches":2,"source":"https://www.fortnite.com/competitive/events/S37_ConsoleDuosCashCups/?region=NAW&round=S37_ConsoleDuosCashCups_Event10Round2_NAW","eventNo":10}),
 Object.freeze({"id":"auto-s37-792315093f25","date":"2025-10-26","region":"NAW","player":"EXV mAximum24 / えありー","playerRaw":"EXV mAximum24 / zst Airyfnbr","players":["EXV mAximum24","えありー"],"rank":140,"points":0,"kills":4,"vrs":0,"matches":3,"source":"https://www.fortnite.com/competitive/events/S37_ConsoleDuosCashCups/?region=NAW&round=S37_ConsoleDuosCashCups_Event10Round2_NAW","eventNo":10}),
 Object.freeze({"id":"auto-s37-7afd94463d90","date":"2025-10-26","region":"NAW","player":"でーもんくらげǃ / すかい","playerRaw":"でーもんくらげǃ / AtlanticSkyx","players":["でーもんくらげǃ","すかい"],"rank":152,"points":0,"kills":3,"vrs":0,"matches":3,"source":"https://www.fortnite.com/competitive/events/S37_ConsoleDuosCashCups/?region=NAW&round=S37_ConsoleDuosCashCups_Event10Round2_NAW","eventNo":10}),
 Object.freeze({"id":"auto-s37-a39124adfbee","date":"2025-10-26","region":"NAW","player":"おこっとふー / VOLARE まろた","playerRaw":"おこっとふー / VOLARE まろた","players":["おこっとふー","VOLARE まろた"],"rank":156,"points":0,"kills":2,"vrs":0,"matches":2,"source":"https://www.fortnite.com/competitive/events/S37_ConsoleDuosCashCups/?region=NAW&round=S37_ConsoleDuosCashCups_Event10Round2_NAW","eventNo":10}),
 Object.freeze({"id":"auto-s37-424f1819179c","date":"2025-10-26","region":"NAW","player":"Asuka / Rabbit","playerRaw":"VOLARE Asuka / Yotta Rabbitǃ","players":["Asuka","Rabbit"],"rank":159,"points":0,"kills":3,"vrs":0,"matches":3,"source":"https://www.fortnite.com/competitive/events/S37_ConsoleDuosCashCups/?region=NAW&round=S37_ConsoleDuosCashCups_Event10Round2_NAW","eventNo":10}),
 Object.freeze({"id":"auto-s37-25c049169859","date":"2025-10-26","region":"NAW","player":"かぷせるてぃーてぃーTTていてい / Amo","playerRaw":"Pollo 17 ǃ ǃ / AmonRoadToGlorÿ","players":["かぷせるてぃーてぃーTTていてい","Amo"],"rank":172,"points":0,"kills":3,"vrs":0,"matches":3,"source":"https://www.fortnite.com/competitive/events/S37_ConsoleDuosCashCups/?region=NAW&round=S37_ConsoleDuosCashCups_Event10Round2_NAW","eventNo":10}),
 Object.freeze({"id":"auto-s37-a5447cb904ec","date":"2025-10-26","region":"NAW","player":"ふぃる / あすふぁろず","playerRaw":"ポルターガイストǃ / あすふぁろず","players":["ふぃる","あすふぁろず"],"rank":221,"points":0,"kills":1,"vrs":0,"matches":3,"source":"https://www.fortnite.com/competitive/events/S37_ConsoleDuosCashCups/?region=NAW&round=S37_ConsoleDuosCashCups_Event10Round2_NAW","eventNo":10})
]);
const groupOf=s=>GROUPS.find(g=>g.date===s?.date&&g.region===s?.region&&g.eventNo===s?.eventNo);
const findSpec=id=>SPECS.find(s=>s.id===id);
const roundName=s=>`Event ${s.eventNo} · Round 2 / 賞金決勝`;
function matchOriginal(x,s){
 return !!x&&!!s&&x.id===s.id&&x.seasonId==='S37'&&x.chapter===6&&x.season===4&&
  x.date===s.date&&x.region===s.region&&
  x.event==='Duos Console Victory Cash Cup'&&x.tournamentId==='ch6s4-console-duos-victory'&&
  x.kind==='賞金決勝'&&x.round===roundName(s)&&x.source===s.source&&
  x.verified===true&&x.reviewOnly!==true&&x.prize===null&&x.vrs===0&&
  x.player===s.player&&x.playerRaw===s.playerRaw&&
  JSON.stringify(x.players)===JSON.stringify(s.players)&&
  ['rank','points','kills','vrs','matches'].every(k=>x[k]===s[k]);
}
function validateRecord(x,e){
 const s=findSpec(x?.id);
 return !!s&&!!e&&e.id===s.id&&e.recordId===s.id&&e.policy===POLICY&&
  e.decision==='published'&&e.rule===RULE&&e.source===s.source&&
  e.evidence?.includes(SOURCE_BLOB)===true&&
  e.evidence?.includes('complete Round2 0VR')===true&&
  x.id===s.id&&x.date===s.date&&x.region===s.region&&
  x.seasonId==='S37'&&x.chapter===6&&x.season===4&&
  x.event==='Duos Console Victory Cash Cup'&&
  x.tournamentId==='ch6s4-console-duos-victory'&&
  x.kind==='賞金決勝'&&x.round===roundName(s)&&
  x.source===s.source&&x.verified===true&&
  x.reviewOnly!==true&&x.reviewReason===undefined&&
  x.prize===0&&x.vrs===0&&x.player===s.player&&
  x.playerRaw===s.playerRaw&&JSON.stringify(x.players)===JSON.stringify(s.players)&&
  ['rank','points','kills','vrs','matches'].every(k=>x[k]===s[k])&&
  typeof x.note==='string'&&x.note.includes(RULE)&&
  x.note.includes(SOURCE_BLOB)&&x.note.includes('0VR')&&x.note.includes('賞金$0');
}
function removeExact(queue,ids){
 if(!Array.isArray(queue)||!Array.isArray(ids)||ids.length!==new Set(ids).size)
  throw Error('Invalid Round2 cleanup input');
 const found=queue.filter(x=>ids.includes(x.id));
 if(found.length!==ids.length||new Set(found.map(x=>x.id)).size!==ids.length)
  throw Error('Missing/duplicate Round2 review ID');
 return queue.filter(x=>!ids.includes(x.id));
}
module.exports={POLICY,RULE,SNAPSHOT_PATH,SOURCE_BLOB,GROUPS,SPECS,groupOf,findSpec,roundName,matchOriginal,validateRecord,removeExact};
