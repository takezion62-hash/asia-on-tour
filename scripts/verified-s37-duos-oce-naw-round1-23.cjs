'use strict';
// Immutable 23 individually checked S37 Console Duos Round1 team standings.
// OCE has the entire 21-page leaderboard, NAW the clean first 2/52 pages.
const POLICY='verified-s37-oce-naw-round1-23-20261117';
const RULE="https://www.fortnite.com/competitive/rules-guidelines/rules-library/fortnite-duos-console-victory-cash-cups-chapter-6-season-4-official-rules?region=NAC";
const SCAN_BLOB='43d4af41369f1e3fc30baf60c84de9b8062ff47b';
const SCAN_COMMIT='e92adacb95d4263b43f23eb4f77685599a9b9c07';
const CUTOFF=250;
const EVENT='S37_ConsoleDuosCashCups';
const GROUPS=Object.freeze([
 Object.freeze({"region":"OCE","date":"2025-10-04","eventNum":7,"win":"S37_ConsoleDuosCashCups_Event7Round1_OCE","expected":13,"mode":"complete","key":"epicgames_S37_ConsoleDuosCashCups_OCE/S37_ConsoleDuosCashCups_Event7Round1_OCE","pages":21,"totalPages":21,"lastSeenRank":2026,"lastSuccessAt":"2026-11-17T02:36:42.625Z"}),
 Object.freeze({"region":"NAW","date":"2025-10-19","eventNum":9,"win":"S37_ConsoleDuosCashCups_Event9Round1_NAW","expected":10,"mode":"partial","key":"epicgames_S37_ConsoleDuosCashCups_NAW/S37_ConsoleDuosCashCups_Event9Round1_NAW","pages":2,"totalPages":52,"lastSeenRank":200,"lastSuccessAt":"2026-11-16T22:30:47.150Z"})
]);
const SPECS=Object.freeze([
 Object.freeze({"id":"auto-s37-3a3350526a5d","region":"OCE","date":"2025-10-04","player":"Mofu / すかい","playerRaw":"RC MOFU 16ǃ / AtlanticSkyx","players":["Mofu","すかい"],"rank":20,"points":265,"kills":61,"vrs":1,"matches":7}),
 Object.freeze({"id":"auto-s37-a86f31929b53","region":"OCE","date":"2025-10-04","player":"Asuka / Rabbit","playerRaw":"VOLARE Asuka / Yotta Rabbitǃ","players":["Asuka","Rabbit"],"rank":142,"points":193,"kills":28,"vrs":1,"matches":4}),
 Object.freeze({"id":"auto-s37-3d43167716cc","region":"OCE","date":"2025-10-04","player":"CALM かずにょっす / 永瀬さらLOVEじょーじ396","playerRaw":"CALM かずにょっす / 永瀬さらLOVEじょーじ396","players":["CALM かずにょっす","永瀬さらLOVEじょーじ396"],"rank":185,"points":186,"kills":41,"vrs":0,"matches":6}),
 Object.freeze({"id":"auto-s37-096cb519033b","region":"OCE","date":"2025-10-04","player":"りーく / huggyfv","playerRaw":"Wcr r3exk / STX Huggy","players":["りーく","huggyfv"],"rank":246,"points":178,"kills":40,"vrs":0,"matches":6}),
 Object.freeze({"id":"auto-s37-20ef4ce7e948","region":"OCE","date":"2025-10-04","player":"TONIGHTREET / 私は3本のガーベラを君に贈ります","playerRaw":"イーザンバロンⅤナス寿郎聖 / 私は3本のガーベラを君に贈ります","players":["TONIGHTREET","私は3本のガーベラを君に贈ります"],"rank":457,"points":149,"kills":42,"vrs":1,"matches":2}),
 Object.freeze({"id":"auto-s37-2d8567ba494e","region":"OCE","date":"2025-10-04","player":"きおらび / SN Season","playerRaw":"きおらび / SN Season","players":["きおらび","SN Season"],"rank":772,"points":110,"kills":21,"vrs":0,"matches":4}),
 Object.freeze({"id":"auto-s37-8113db72a8cd","region":"OCE","date":"2025-10-04","player":"seljuny / Rura","playerRaw":"alpha s3awesomer / a78ryq2yr0awf23m","players":["seljuny","Rura"],"rank":807,"points":104,"kills":26,"vrs":0,"matches":5}),
 Object.freeze({"id":"auto-s37-1bf62d829315","region":"OCE","date":"2025-10-04","player":"なずな / えいぶか","playerRaw":"TsV なずねぎ / s2 ほんまにふわかろん雑魚","players":["なずな","えいぶか"],"rank":919,"points":88,"kills":33,"vrs":0,"matches":7}),
 Object.freeze({"id":"auto-s37-705e8c4f6a22","region":"OCE","date":"2025-10-04","player":"ちからV2 / しこぴよフォートナイト","playerRaw":"NEXUS ちからV2ǃ / しこぴよフォートナイト","players":["ちからV2","しこぴよフォートナイト"],"rank":1086,"points":70,"kills":24,"vrs":0,"matches":3}),
 Object.freeze({"id":"auto-s37-24cfac817735","region":"OCE","date":"2025-10-04","player":"らる / まろやかれおちゃあいと","playerRaw":"らるニキ LIZAǃǃӜ / 爆運まろやかれおちゃあいと爆運","players":["らる","まろやかれおちゃあいと"],"rank":1087,"points":70,"kills":20,"vrs":0,"matches":5}),
 Object.freeze({"id":"auto-s37-8398fed27912","region":"OCE","date":"2025-10-04","player":"でーもんくらげǃ / ももち","playerRaw":"でーもんくらげǃ / Ascend JerenX","players":["でーもんくらげǃ","ももち"],"rank":1104,"points":68,"kills":14,"vrs":0,"matches":2}),
 Object.freeze({"id":"auto-s37-c9d23c25fb21","region":"OCE","date":"2025-10-04","player":"くりたる / 内海ゆうま","playerRaw":"FTW kulitalu 10ǃ / チータルタル弁当ネギトッピング","players":["くりたる","内海ゆうま"],"rank":1180,"points":60,"kills":23,"vrs":0,"matches":6}),
 Object.freeze({"id":"auto-s37-093e3d4b9915","region":"OCE","date":"2025-10-04","player":"こがね / MV.demonking鬼龍覇気","playerRaw":"Zst kogane / MV.demonking鬼龍覇気","players":["こがね","MV.demonking鬼龍覇気"],"rank":1590,"points":22,"kills":11,"vrs":0,"matches":3}),
 Object.freeze({"id":"auto-s37-de8967e4b249","region":"NAW","date":"2025-10-19","player":"りむた / かめてぃん","playerRaw":"A_α Rimuta / かめてぃん.魔女","players":["りむた","かめてぃん"],"rank":3,"points":332,"kills":38,"vrs":2,"matches":6}),
 Object.freeze({"id":"auto-s37-099c070a09fa","region":"NAW","date":"2025-10-19","player":"きおらび / SN Season","playerRaw":"きおらび / SN Season","players":["きおらび","SN Season"],"rank":8,"points":296,"kills":49,"vrs":2,"matches":5}),
 Object.freeze({"id":"auto-s37-8080bbfeb095","region":"NAW","date":"2025-10-19","player":"TONIGHTREET / ちゃる","playerRaw":"イーザンバロンⅤナス寿郎聖 / charufn","players":["TONIGHTREET","ちゃる"],"rank":73,"points":241,"kills":40,"vrs":1,"matches":7}),
 Object.freeze({"id":"auto-s37-07bbea7d2a5a","region":"NAW","date":"2025-10-19","player":"kaf / p1ng","playerRaw":"ひかる舎弟 / boltzZzero0oǃ","players":["kaf","p1ng"],"rank":99,"points":235,"kills":49,"vrs":1,"matches":7}),
 Object.freeze({"id":"auto-s37-80f624429737","region":"NAW","date":"2025-10-19","player":"kmyt / falcon manzuǃ","playerRaw":"やまもと そうし / falcon manzuǃ","players":["kmyt","falcon manzuǃ"],"rank":106,"points":233,"kills":32,"vrs":1,"matches":4}),
 Object.freeze({"id":"auto-s37-07fda194efba","region":"NAW","date":"2025-10-19","player":"Esosa Vee / Kkkkfdjdfdufdu","playerRaw":"たけしfnbr / Kkkkfdjdfdufdu","players":["Esosa Vee","Kkkkfdjdfdufdu"],"rank":124,"points":230,"kills":18,"vrs":0,"matches":7}),
 Object.freeze({"id":"auto-s37-99b20816d139","region":"NAW","date":"2025-10-19","player":"112345abcde / RADWIMPSǃ","playerRaw":"112345abcde / RADWIMPSǃ","players":["112345abcde","RADWIMPSǃ"],"rank":155,"points":226,"kills":18,"vrs":0,"matches":6}),
 Object.freeze({"id":"auto-s37-7cc66cde7bbb","region":"NAW","date":"2025-10-19","player":"MMC KAAN BABA / ns tmu","playerRaw":"KAAN BABA GOTY / ns tmu","players":["MMC KAAN BABA","ns tmu"],"rank":165,"points":224,"kills":20,"vrs":2,"matches":6}),
 Object.freeze({"id":"auto-s37-c8cfb3e72b8e","region":"NAW","date":"2025-10-19","player":"Botえもん / モバイル勢のまかろん","playerRaw":"Botえもん / BRN 916GonLuck","players":["Botえもん","モバイル勢のまかろん"],"rank":187,"points":221,"kills":33,"vrs":1,"matches":4}),
 Object.freeze({"id":"auto-s37-cd8b80fcc770","region":"NAW","date":"2025-10-19","player":"falcon 6xω / お前らグラファいってないんｗｗ","playerRaw":"falcon 6xω / love is evrythin","players":["falcon 6xω","お前らグラファいってないんｗｗ"],"rank":189,"points":221,"kills":42,"vrs":1,"matches":7})
]);
const groupFor=x=>GROUPS.find(g=>g.region===x?.region&&g.date===x?.date);
const getSpec=id=>SPECS.find(x=>x.id===id);
const sourceFor=g=>'https://www.fortnite.com/competitive/events/'+EVENT+'/?region='+g.region+'&round='+g.win;
function matchesOriginal(row,spec){
 const g=groupFor(spec);
 return !!row&&!!spec&&!!g&&row.id===spec.id&&
 row.seasonId==='S37'&&row.chapter===6&&row.season===4&&
 row.tournamentId==='ch6s4-console-duos-victory'&&
 row.event==='Duos Console Victory Cash Cup'&&
 row.date===g.date&&row.region===g.region&&row.source===sourceFor(g)&&
 row.round==='Event '+g.eventNum+' · Round 1 / 予選'&&row.kind==='予選'&&
 row.verified===true&&row.prize===0&&row.reviewOnly!==true&&
 row.player===spec.player&&row.playerRaw===spec.playerRaw&&
 JSON.stringify(row.players)===JSON.stringify(spec.players)&&
 ['rank','points','kills','vrs','matches'].every(k=>row[k]===spec[k]);
}
function expectedKind(spec){return spec.rank<=CUTOFF?'予選':'参加確認'}
function expectedRound(spec){
 const g=groupFor(spec);
 return 'Event '+g.eventNum+' · Round 1 / '+(spec.rank<=CUTOFF?'予選突破':'参加確認');
}
function removeResolvedPending(proposals,ids){
 if(!Array.isArray(proposals)||!Array.isArray(ids)||!ids.length||new Set(ids).size!==ids.length)
  throw Error('S37_DUOS_23 invalid cleanup IDs');
 const found=proposals.filter(x=>ids.includes(x.id));
 if(found.length!==ids.length||new Set(found.map(x=>x.id)).size!==ids.length)
  throw Error('S37_DUOS_23 selected ID missing or duplicated in queue');
 return proposals.filter(x=>!ids.includes(x.id));
}
function validatedRecord(row,entry){
 const spec=getSpec(row?.id),g=groupFor(spec);
 return !!spec&&!!g&&!!entry&&
  entry.id===spec.id&&entry.recordId===spec.id&&entry.decision==='published'&&
  entry.policy===POLICY&&entry.rule===RULE&&entry.source===sourceFor(g)&&
  typeof entry.evidence==='string'&&entry.evidence.includes(SCAN_BLOB)&&
  entry.evidence.includes('verified contiguous original pages')&&
  row.id===spec.id&&row.seasonId==='S37'&&row.chapter===6&&row.season===4&&
  row.tournamentId==='ch6s4-console-duos-victory'&&
  row.event==='Duos Console Victory Cash Cup'&&
  row.date===g.date&&row.region===g.region&&row.source===sourceFor(g)&&
  row.round===expectedRound(spec)&&row.kind===expectedKind(spec)&&
  row.verified===true&&row.prize===0&&row.reviewOnly!==true&&row.reviewReason===undefined&&
  row.player===spec.player&&row.playerRaw===spec.playerRaw&&
  JSON.stringify(row.players)===JSON.stringify(spec.players)&&
  ['rank','points','kills','vrs','matches'].every(k=>row[k]===spec[k])&&
  typeof row.note==='string'&&row.note.includes(SCAN_BLOB)&&
  row.note.includes(RULE)&&row.note.includes('上位250')&&row.note.includes('賞金$0')&&
  row.note.includes(g.mode==='complete'?'21/21':'2/52');
}
module.exports={POLICY,RULE,SCAN_BLOB,SCAN_COMMIT,CUTOFF,EVENT,GROUPS,SPECS,groupFor,getSpec,sourceFor,
 matchesOriginal,expectedKind,expectedRound,removeResolvedPending,validatedRecord};
