'use strict';
// 20 immutable source-verified 0-VR Round2 finalists, which earn $0 cash.
// Never infer a victory or cash payout from placement or earlier qualifier.
const POLICY='verified-s37-console-duos-round2-20-zero-vr-20261117';
const RULE="https://www.fortnite.com/competitive/rules-guidelines/rules-library/fortnite-duos-console-victory-cash-cups-chapter-6-season-4-official-rules?region=NAC";
const SCAN_BLOB='43d4af41369f1e3fc30baf60c84de9b8062ff47b';
const SOURCE_COMMIT='1431043bef60ddd61f8f4a12bb537d23f3a043b7';
const EVENT='S37_ConsoleDuosCashCups';
const GROUPS=Object.freeze([
 Object.freeze({"date":"2025-09-28","region":"NAW","eventNo":6,"window":"S37_ConsoleDuosCashCups_Event6Round2_NAW","count":8,"key":"epicgames_S37_ConsoleDuosCashCups_NAW/S37_ConsoleDuosCashCups_Event6Round2_NAW","pages":3,"lastSeenRank":248,"totalPages":3,"sessionEndUtc":"2025-09-28T00:00:00.000Z"}),
 Object.freeze({"date":"2025-10-04","region":"OCE","eventNo":7,"window":"S37_ConsoleDuosCashCups_Event7Round2_OCE","count":3,"key":"epicgames_S37_ConsoleDuosCashCups_OCE/S37_ConsoleDuosCashCups_Event7Round2_OCE","pages":3,"lastSeenRank":239,"totalPages":3,"sessionEndUtc":"2025-10-04T07:00:00.000Z"}),
 Object.freeze({"date":"2025-10-26","region":"NAW","eventNo":10,"window":"S37_ConsoleDuosCashCups_Event10Round2_NAW","count":9,"key":"epicgames_S37_ConsoleDuosCashCups_NAW/S37_ConsoleDuosCashCups_Event10Round2_NAW","pages":3,"lastSeenRank":244,"totalPages":3,"sessionEndUtc":"2025-10-26T00:00:00.000Z"})
]);
const SPECS=Object.freeze([
 Object.freeze({"id":"auto-s37-bb586ddb336e","date":"2025-09-28","region":"NAW","player":"kmyt / Choco","playerRaw":"やまもと そうし / nagisa furukawaǃ","players":["kmyt","Choco"],"rank":29,"points":0,"kills":9,"vrs":0,"matches":2}),
 Object.freeze({"id":"auto-s37-afafda8539da","date":"2025-09-28","region":"NAW","player":"VLZ 対面の極意 / CALM かずにょっす","playerRaw":"VLZ 対面の極意 / CALM かずにょっす","players":["VLZ 対面の極意","CALM かずにょっす"],"rank":111,"points":0,"kills":6,"vrs":0,"matches":3}),
 Object.freeze({"id":"auto-s37-f37ce32441f8","date":"2025-09-28","region":"NAW","player":"MAT4DOR. / ちゃる","playerRaw":"MAT4DOR. / charufn","players":["MAT4DOR.","ちゃる"],"rank":154,"points":0,"kills":4,"vrs":0,"matches":3}),
 Object.freeze({"id":"auto-s37-2578206ab630","date":"2025-09-28","region":"NAW","player":"すたーだよ / falcon manzuǃ","playerRaw":"すたーだよ / falcon manzuǃ","players":["すたーだよ","falcon manzuǃ"],"rank":168,"points":0,"kills":3,"vrs":0,"matches":3}),
 Object.freeze({"id":"auto-s37-4995457384ec","date":"2025-09-28","region":"NAW","player":"らる / まろやかれおちゃあいと","playerRaw":"はあちゃまっちゃまーwwǃǃӜ / 爆運まろやかれおちゃあいと爆運","players":["らる","まろやかれおちゃあいと"],"rank":185,"points":0,"kills":3,"vrs":0,"matches":3}),
 Object.freeze({"id":"auto-s37-6f063dea309f","date":"2025-09-28","region":"NAW","player":"かぷせるてぃーてぃーTTていてい / Amo","playerRaw":"Pollo 17 ǃ ǃ / AmonRoadToGlorÿ","players":["かぷせるてぃーてぃーTTていてい","Amo"],"rank":211,"points":0,"kills":1,"vrs":0,"matches":2}),
 Object.freeze({"id":"auto-s37-4cf59d3256db","date":"2025-09-28","region":"NAW","player":"えいぶか / あすふぁろず","playerRaw":"s2 ほんまにふわかろん雑魚 / あすふぁろず","players":["えいぶか","あすふぁろず"],"rank":235,"points":0,"kills":0,"vrs":0,"matches":3}),
 Object.freeze({"id":"auto-s37-20561d92eebb","date":"2025-09-28","region":"NAW","player":"おこっとふー / センス0","playerRaw":"おこっとふー / 光オロチs","players":["おこっとふー","センス0"],"rank":236,"points":0,"kills":0,"vrs":0,"matches":3}),
 Object.freeze({"id":"auto-s37-7cde35ed5197","date":"2025-10-04","region":"OCE","player":"りーく / huggyfv","playerRaw":"Wcr r3exk / STX Huggy","players":["りーく","huggyfv"],"rank":90,"points":0,"kills":4,"vrs":0,"matches":2}),
 Object.freeze({"id":"auto-s37-5a4406d38e42","date":"2025-10-04","region":"OCE","player":"Asuka / Rabbit","playerRaw":"VOLARE Asuka / Yotta Rabbitǃ","players":["Asuka","Rabbit"],"rank":92,"points":0,"kills":4,"vrs":0,"matches":2}),
 Object.freeze({"id":"auto-s37-c6abe345a83e","date":"2025-10-04","region":"OCE","player":"CALM かずにょっす / 永瀬さらLOVEじょーじ396","playerRaw":"CALM かずにょっす / 永瀬さらLOVEじょーじ396","players":["CALM かずにょっす","永瀬さらLOVEじょーじ396"],"rank":192,"points":0,"kills":1,"vrs":0,"matches":2}),
 Object.freeze({"id":"auto-s37-3fe68284f399","date":"2025-10-26","region":"NAW","player":"りーく / しこぴよフォートナイト","playerRaw":"Wcr r3exk / しこぴよフォートナイト","players":["りーく","しこぴよフォートナイト"],"rank":79,"points":0,"kills":8,"vrs":0,"matches":3}),
 Object.freeze({"id":"auto-s37-b023a770df26","date":"2025-10-26","region":"NAW","player":"りーち / モバイル勢のまかろん","playerRaw":"35ピングなので対面勝てないです / BRN 916GonLuck","players":["りーち","モバイル勢のまかろん"],"rank":123,"points":0,"kills":5,"vrs":0,"matches":3}),
 Object.freeze({"id":"auto-s37-8e8f4a0fbfd4","date":"2025-10-26","region":"NAW","player":"きおらび / SN Season","playerRaw":"きおらび / SN Season","players":["きおらび","SN Season"],"rank":131,"points":0,"kills":3,"vrs":0,"matches":2}),
 Object.freeze({"id":"auto-s37-792315093f25","date":"2025-10-26","region":"NAW","player":"EXV mAximum24 / えありー","playerRaw":"EXV mAximum24 / zst Airyfnbr","players":["EXV mAximum24","えありー"],"rank":140,"points":0,"kills":4,"vrs":0,"matches":3}),
 Object.freeze({"id":"auto-s37-7afd94463d90","date":"2025-10-26","region":"NAW","player":"でーもんくらげǃ / すかい","playerRaw":"でーもんくらげǃ / AtlanticSkyx","players":["でーもんくらげǃ","すかい"],"rank":152,"points":0,"kills":3,"vrs":0,"matches":3}),
 Object.freeze({"id":"auto-s37-a39124adfbee","date":"2025-10-26","region":"NAW","player":"おこっとふー / VOLARE まろた","playerRaw":"おこっとふー / VOLARE まろた","players":["おこっとふー","VOLARE まろた"],"rank":156,"points":0,"kills":2,"vrs":0,"matches":2}),
 Object.freeze({"id":"auto-s37-424f1819179c","date":"2025-10-26","region":"NAW","player":"Asuka / Rabbit","playerRaw":"VOLARE Asuka / Yotta Rabbitǃ","players":["Asuka","Rabbit"],"rank":159,"points":0,"kills":3,"vrs":0,"matches":3}),
 Object.freeze({"id":"auto-s37-25c049169859","date":"2025-10-26","region":"NAW","player":"かぷせるてぃーてぃーTTていてい / Amo","playerRaw":"Pollo 17 ǃ ǃ / AmonRoadToGlorÿ","players":["かぷせるてぃーてぃーTTていてい","Amo"],"rank":172,"points":0,"kills":3,"vrs":0,"matches":3}),
 Object.freeze({"id":"auto-s37-a5447cb904ec","date":"2025-10-26","region":"NAW","player":"ふぃる / あすふぁろず","playerRaw":"ポルターガイストǃ / あすふぁろず","players":["ふぃる","あすふぁろず"],"rank":221,"points":0,"kills":1,"vrs":0,"matches":3})
]);
const getSpec=id=>SPECS.find(x=>x.id===id);
const groupFor=s=>GROUPS.find(g=>g.region===s?.region&&g.date===s?.date);
const sourceFor=g=>'https://www.fortnite.com/competitive/events/'+EVENT+'/?region='+g.region+'&round='+g.window;
function matchesOriginal(r,s){
 const g=groupFor(s);
 return !!r&&!!s&&!!g&&r.id===s.id&&r.date===g.date&&r.region===g.region&&
 r.seasonId==='S37'&&r.chapter===6&&r.season===4&&
 r.tournamentId==='ch6s4-console-duos-victory'&&r.event==='Duos Console Victory Cash Cup'&&
 r.source===sourceFor(g)&&r.round==='Event '+g.eventNo+' · Round 2 / 賞金決勝'&&
 r.kind==='賞金決勝'&&r.prize===null&&r.verified===true&&r.reviewOnly!==true&&
 r.player===s.player&&r.playerRaw===s.playerRaw&&
 JSON.stringify(r.players)===JSON.stringify(s.players)&&
 ['rank','points','kills','vrs','matches'].every(k=>r[k]===s[k])&&s.vrs===0;
}
function removeExact(proposals,ids){
 if(!Array.isArray(proposals)||!Array.isArray(ids)||!ids.length||
  new Set(ids).size!==ids.length)throw Error('S37_ROUND2_ZERO invalid IDs');
 const found=proposals.filter(x=>ids.includes(x.id));
 if(found.length!==ids.length||new Set(found.map(x=>x.id)).size!==ids.length)
  throw Error('S37_ROUND2_ZERO missing or duplicated pending entries');
 return proposals.filter(x=>!ids.includes(x.id));
}
function validateRecord(r,e){
 const s=getSpec(r?.id),g=groupFor(s);
 return !!r&&!!e&&!!s&&!!g&&
 e.id===s.id&&e.recordId===s.id&&e.policy===POLICY&&e.decision==='published'&&
 e.source===sourceFor(g)&&e.rule===RULE&&typeof e.evidence==='string'&&
 e.evidence.includes(SCAN_BLOB)&&e.evidence.includes('0VR from complete original Epic Round2')&&
 r.id===s.id&&r.date===s.date&&r.region===s.region&&
 r.seasonId==='S37'&&r.chapter===6&&r.season===4&&
 r.tournamentId==='ch6s4-console-duos-victory'&&r.event==='Duos Console Victory Cash Cup'&&
 r.source===sourceFor(g)&&r.round==='Event '+g.eventNo+' · Round 2 / 賞金決勝'&&
 r.kind==='賞金決勝'&&r.verified===true&&r.prize===0&&r.vrs===0&&
 r.reviewReason===undefined&&r.reviewOnly!==true&&
 r.player===s.player&&r.playerRaw===s.playerRaw&&JSON.stringify(r.players)===JSON.stringify(s.players)&&
 ['rank','points','kills','vrs','matches'].every(k=>r[k]===s[k])&&
 typeof r.note==='string'&&r.note.includes('0VR')&&r.note.includes('賞金$0')&&
 r.note.includes(RULE)&&r.note.includes(SCAN_BLOB);
}
module.exports={POLICY,RULE,SCAN_BLOB,SOURCE_COMMIT,EVENT,GROUPS,SPECS,getSpec,groupFor,sourceFor,matchesOriginal,removeExact,validateRecord};
