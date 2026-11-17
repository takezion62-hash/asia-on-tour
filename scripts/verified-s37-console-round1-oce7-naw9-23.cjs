'use strict';
// Frozen Epic / Osirion observation proofs, not blanket tournament approvals.
const POLICY="verified-s37-console-round1-oce7-naw9-23-20261117";
const RULE="https://www.fortnite.com/competitive/rules-guidelines/rules-library/fortnite-duos-console-victory-cash-cups-chapter-6-season-4-official-rules?region=NAC";
const SNAPSHOT_PATH="data/manual-approvals/s37-console-round1-oce7-naw9-23-checkpoint-20261117.json";
const SOURCE_COMMIT="5668daffb31f140e84d3e142dc71386037f43235";
const SOURCE_BLOB="43d4af41369f1e3fc30baf60c84de9b8062ff47b";
const CUTOFF=250;
const GROUPS=Object.freeze([
 Object.freeze({"date":"2025-10-04","region":"OCE","eventNo":7,"key":"epicgames_S37_ConsoleDuosCashCups_OCE/S37_ConsoleDuosCashCups_Event7Round1_OCE","window":"S37_ConsoleDuosCashCups_Event7Round1_OCE","complete":true,"sessionEndUtc":"2025-10-04T05:00:00.000Z","count":13,"rankMax":1590}),
 Object.freeze({"date":"2025-10-19","region":"NAW","eventNo":9,"key":"epicgames_S37_ConsoleDuosCashCups_NAW/S37_ConsoleDuosCashCups_Event9Round1_NAW","window":"S37_ConsoleDuosCashCups_Event9Round1_NAW","complete":false,"sessionEndUtc":"2025-10-18T22:00:00.000Z","count":10,"rankMax":189})
]);
const SPECS=Object.freeze([
 Object.freeze({"id":"auto-s37-3a3350526a5d","date":"2025-10-04","region":"OCE","player":"Mofu / すかい","playerRaw":"RC MOFU 16ǃ / AtlanticSkyx","players":["Mofu","すかい"],"rank":20,"points":265,"kills":61,"vrs":1,"matches":7,"source":"https://www.fortnite.com/competitive/events/S37_ConsoleDuosCashCups/?region=OCE&round=S37_ConsoleDuosCashCups_Event7Round1_OCE","originalRound":"Event 7 · Round 1 / 予選"}),
 Object.freeze({"id":"auto-s37-a86f31929b53","date":"2025-10-04","region":"OCE","player":"Asuka / Rabbit","playerRaw":"VOLARE Asuka / Yotta Rabbitǃ","players":["Asuka","Rabbit"],"rank":142,"points":193,"kills":28,"vrs":1,"matches":4,"source":"https://www.fortnite.com/competitive/events/S37_ConsoleDuosCashCups/?region=OCE&round=S37_ConsoleDuosCashCups_Event7Round1_OCE","originalRound":"Event 7 · Round 1 / 予選"}),
 Object.freeze({"id":"auto-s37-3d43167716cc","date":"2025-10-04","region":"OCE","player":"CALM かずにょっす / 永瀬さらLOVEじょーじ396","playerRaw":"CALM かずにょっす / 永瀬さらLOVEじょーじ396","players":["CALM かずにょっす","永瀬さらLOVEじょーじ396"],"rank":185,"points":186,"kills":41,"vrs":0,"matches":6,"source":"https://www.fortnite.com/competitive/events/S37_ConsoleDuosCashCups/?region=OCE&round=S37_ConsoleDuosCashCups_Event7Round1_OCE","originalRound":"Event 7 · Round 1 / 予選"}),
 Object.freeze({"id":"auto-s37-096cb519033b","date":"2025-10-04","region":"OCE","player":"りーく / huggyfv","playerRaw":"Wcr r3exk / STX Huggy","players":["りーく","huggyfv"],"rank":246,"points":178,"kills":40,"vrs":0,"matches":6,"source":"https://www.fortnite.com/competitive/events/S37_ConsoleDuosCashCups/?region=OCE&round=S37_ConsoleDuosCashCups_Event7Round1_OCE","originalRound":"Event 7 · Round 1 / 予選"}),
 Object.freeze({"id":"auto-s37-20ef4ce7e948","date":"2025-10-04","region":"OCE","player":"TONIGHTREET / 私は3本のガーベラを君に贈ります","playerRaw":"イーザンバロンⅤナス寿郎聖 / 私は3本のガーベラを君に贈ります","players":["TONIGHTREET","私は3本のガーベラを君に贈ります"],"rank":457,"points":149,"kills":42,"vrs":1,"matches":2,"source":"https://www.fortnite.com/competitive/events/S37_ConsoleDuosCashCups/?region=OCE&round=S37_ConsoleDuosCashCups_Event7Round1_OCE","originalRound":"Event 7 · Round 1 / 予選"}),
 Object.freeze({"id":"auto-s37-2d8567ba494e","date":"2025-10-04","region":"OCE","player":"きおらび / SN Season","playerRaw":"きおらび / SN Season","players":["きおらび","SN Season"],"rank":772,"points":110,"kills":21,"vrs":0,"matches":4,"source":"https://www.fortnite.com/competitive/events/S37_ConsoleDuosCashCups/?region=OCE&round=S37_ConsoleDuosCashCups_Event7Round1_OCE","originalRound":"Event 7 · Round 1 / 予選"}),
 Object.freeze({"id":"auto-s37-8113db72a8cd","date":"2025-10-04","region":"OCE","player":"seljuny / Rura","playerRaw":"alpha s3awesomer / a78ryq2yr0awf23m","players":["seljuny","Rura"],"rank":807,"points":104,"kills":26,"vrs":0,"matches":5,"source":"https://www.fortnite.com/competitive/events/S37_ConsoleDuosCashCups/?region=OCE&round=S37_ConsoleDuosCashCups_Event7Round1_OCE","originalRound":"Event 7 · Round 1 / 予選"}),
 Object.freeze({"id":"auto-s37-1bf62d829315","date":"2025-10-04","region":"OCE","player":"なずな / えいぶか","playerRaw":"TsV なずねぎ / s2 ほんまにふわかろん雑魚","players":["なずな","えいぶか"],"rank":919,"points":88,"kills":33,"vrs":0,"matches":7,"source":"https://www.fortnite.com/competitive/events/S37_ConsoleDuosCashCups/?region=OCE&round=S37_ConsoleDuosCashCups_Event7Round1_OCE","originalRound":"Event 7 · Round 1 / 予選"}),
 Object.freeze({"id":"auto-s37-705e8c4f6a22","date":"2025-10-04","region":"OCE","player":"ちからV2 / しこぴよフォートナイト","playerRaw":"NEXUS ちからV2ǃ / しこぴよフォートナイト","players":["ちからV2","しこぴよフォートナイト"],"rank":1086,"points":70,"kills":24,"vrs":0,"matches":3,"source":"https://www.fortnite.com/competitive/events/S37_ConsoleDuosCashCups/?region=OCE&round=S37_ConsoleDuosCashCups_Event7Round1_OCE","originalRound":"Event 7 · Round 1 / 予選"}),
 Object.freeze({"id":"auto-s37-24cfac817735","date":"2025-10-04","region":"OCE","player":"らる / まろやかれおちゃあいと","playerRaw":"らるニキ LIZAǃǃӜ / 爆運まろやかれおちゃあいと爆運","players":["らる","まろやかれおちゃあいと"],"rank":1087,"points":70,"kills":20,"vrs":0,"matches":5,"source":"https://www.fortnite.com/competitive/events/S37_ConsoleDuosCashCups/?region=OCE&round=S37_ConsoleDuosCashCups_Event7Round1_OCE","originalRound":"Event 7 · Round 1 / 予選"}),
 Object.freeze({"id":"auto-s37-8398fed27912","date":"2025-10-04","region":"OCE","player":"でーもんくらげǃ / ももち","playerRaw":"でーもんくらげǃ / Ascend JerenX","players":["でーもんくらげǃ","ももち"],"rank":1104,"points":68,"kills":14,"vrs":0,"matches":2,"source":"https://www.fortnite.com/competitive/events/S37_ConsoleDuosCashCups/?region=OCE&round=S37_ConsoleDuosCashCups_Event7Round1_OCE","originalRound":"Event 7 · Round 1 / 予選"}),
 Object.freeze({"id":"auto-s37-c9d23c25fb21","date":"2025-10-04","region":"OCE","player":"くりたる / 内海ゆうま","playerRaw":"FTW kulitalu 10ǃ / チータルタル弁当ネギトッピング","players":["くりたる","内海ゆうま"],"rank":1180,"points":60,"kills":23,"vrs":0,"matches":6,"source":"https://www.fortnite.com/competitive/events/S37_ConsoleDuosCashCups/?region=OCE&round=S37_ConsoleDuosCashCups_Event7Round1_OCE","originalRound":"Event 7 · Round 1 / 予選"}),
 Object.freeze({"id":"auto-s37-093e3d4b9915","date":"2025-10-04","region":"OCE","player":"こがね / MV.demonking鬼龍覇気","playerRaw":"Zst kogane / MV.demonking鬼龍覇気","players":["こがね","MV.demonking鬼龍覇気"],"rank":1590,"points":22,"kills":11,"vrs":0,"matches":3,"source":"https://www.fortnite.com/competitive/events/S37_ConsoleDuosCashCups/?region=OCE&round=S37_ConsoleDuosCashCups_Event7Round1_OCE","originalRound":"Event 7 · Round 1 / 予選"}),
 Object.freeze({"id":"auto-s37-de8967e4b249","date":"2025-10-19","region":"NAW","player":"りむた / かめてぃん","playerRaw":"A_α Rimuta / かめてぃん.魔女","players":["りむた","かめてぃん"],"rank":3,"points":332,"kills":38,"vrs":2,"matches":6,"source":"https://www.fortnite.com/competitive/events/S37_ConsoleDuosCashCups/?region=NAW&round=S37_ConsoleDuosCashCups_Event9Round1_NAW","originalRound":"Event 9 · Round 1 / 予選"}),
 Object.freeze({"id":"auto-s37-099c070a09fa","date":"2025-10-19","region":"NAW","player":"きおらび / SN Season","playerRaw":"きおらび / SN Season","players":["きおらび","SN Season"],"rank":8,"points":296,"kills":49,"vrs":2,"matches":5,"source":"https://www.fortnite.com/competitive/events/S37_ConsoleDuosCashCups/?region=NAW&round=S37_ConsoleDuosCashCups_Event9Round1_NAW","originalRound":"Event 9 · Round 1 / 予選"}),
 Object.freeze({"id":"auto-s37-8080bbfeb095","date":"2025-10-19","region":"NAW","player":"TONIGHTREET / ちゃる","playerRaw":"イーザンバロンⅤナス寿郎聖 / charufn","players":["TONIGHTREET","ちゃる"],"rank":73,"points":241,"kills":40,"vrs":1,"matches":7,"source":"https://www.fortnite.com/competitive/events/S37_ConsoleDuosCashCups/?region=NAW&round=S37_ConsoleDuosCashCups_Event9Round1_NAW","originalRound":"Event 9 · Round 1 / 予選"}),
 Object.freeze({"id":"auto-s37-07bbea7d2a5a","date":"2025-10-19","region":"NAW","player":"kaf / p1ng","playerRaw":"ひかる舎弟 / boltzZzero0oǃ","players":["kaf","p1ng"],"rank":99,"points":235,"kills":49,"vrs":1,"matches":7,"source":"https://www.fortnite.com/competitive/events/S37_ConsoleDuosCashCups/?region=NAW&round=S37_ConsoleDuosCashCups_Event9Round1_NAW","originalRound":"Event 9 · Round 1 / 予選"}),
 Object.freeze({"id":"auto-s37-80f624429737","date":"2025-10-19","region":"NAW","player":"kmyt / falcon manzuǃ","playerRaw":"やまもと そうし / falcon manzuǃ","players":["kmyt","falcon manzuǃ"],"rank":106,"points":233,"kills":32,"vrs":1,"matches":4,"source":"https://www.fortnite.com/competitive/events/S37_ConsoleDuosCashCups/?region=NAW&round=S37_ConsoleDuosCashCups_Event9Round1_NAW","originalRound":"Event 9 · Round 1 / 予選"}),
 Object.freeze({"id":"auto-s37-07fda194efba","date":"2025-10-19","region":"NAW","player":"Esosa Vee / Kkkkfdjdfdufdu","playerRaw":"たけしfnbr / Kkkkfdjdfdufdu","players":["Esosa Vee","Kkkkfdjdfdufdu"],"rank":124,"points":230,"kills":18,"vrs":0,"matches":7,"source":"https://www.fortnite.com/competitive/events/S37_ConsoleDuosCashCups/?region=NAW&round=S37_ConsoleDuosCashCups_Event9Round1_NAW","originalRound":"Event 9 · Round 1 / 予選"}),
 Object.freeze({"id":"auto-s37-99b20816d139","date":"2025-10-19","region":"NAW","player":"112345abcde / RADWIMPSǃ","playerRaw":"112345abcde / RADWIMPSǃ","players":["112345abcde","RADWIMPSǃ"],"rank":155,"points":226,"kills":18,"vrs":0,"matches":6,"source":"https://www.fortnite.com/competitive/events/S37_ConsoleDuosCashCups/?region=NAW&round=S37_ConsoleDuosCashCups_Event9Round1_NAW","originalRound":"Event 9 · Round 1 / 予選"}),
 Object.freeze({"id":"auto-s37-7cc66cde7bbb","date":"2025-10-19","region":"NAW","player":"MMC KAAN BABA / ns tmu","playerRaw":"KAAN BABA GOTY / ns tmu","players":["MMC KAAN BABA","ns tmu"],"rank":165,"points":224,"kills":20,"vrs":2,"matches":6,"source":"https://www.fortnite.com/competitive/events/S37_ConsoleDuosCashCups/?region=NAW&round=S37_ConsoleDuosCashCups_Event9Round1_NAW","originalRound":"Event 9 · Round 1 / 予選"}),
 Object.freeze({"id":"auto-s37-c8cfb3e72b8e","date":"2025-10-19","region":"NAW","player":"Botえもん / モバイル勢のまかろん","playerRaw":"Botえもん / BRN 916GonLuck","players":["Botえもん","モバイル勢のまかろん"],"rank":187,"points":221,"kills":33,"vrs":1,"matches":4,"source":"https://www.fortnite.com/competitive/events/S37_ConsoleDuosCashCups/?region=NAW&round=S37_ConsoleDuosCashCups_Event9Round1_NAW","originalRound":"Event 9 · Round 1 / 予選"}),
 Object.freeze({"id":"auto-s37-cd8b80fcc770","date":"2025-10-19","region":"NAW","player":"falcon 6xω / お前らグラファいってないんｗｗ","playerRaw":"falcon 6xω / love is evrythin","players":["falcon 6xω","お前らグラファいってないんｗｗ"],"rank":189,"points":221,"kills":42,"vrs":1,"matches":7,"source":"https://www.fortnite.com/competitive/events/S37_ConsoleDuosCashCups/?region=NAW&round=S37_ConsoleDuosCashCups_Event9Round1_NAW","originalRound":"Event 9 · Round 1 / 予選"})
]);
const findSpec=id=>SPECS.find(x=>x.id===id);
const findGroup=spec=>GROUPS.find(g=>g.date===spec?.date&&g.region===spec?.region);
const expectedKind=spec=>spec.rank<=CUTOFF?'予選':'参加確認';
const expectedRound=spec=>`Event ${findGroup(spec)?.eventNo} · Round 1 / ${spec.rank<=CUTOFF?'予選突破':'参加確認'}`;
function matchOriginal(x,s){
 if(!x||!s||x.id!==s.id||x.date!==s.date||x.region!==s.region||
  x.seasonId!=='S37'||x.chapter!==6||x.season!==4||
  x.tournamentId!=='ch6s4-console-duos-victory'||
  x.event!=='Duos Console Victory Cash Cup'||x.round!==s.originalRound||
  x.kind!=='予選'||x.source!==s.source||x.verified!==true||x.prize!==0||
  x.reviewOnly===true||x.player!==s.player||x.playerRaw!==s.playerRaw||
  JSON.stringify(x.players)!==JSON.stringify(s.players))return false;
 return ['rank','points','kills','vrs','matches'].every(k=>x[k]===s[k]);
}
function validateRecord(x,e){
 const s=findSpec(x?.id);
 if(!s||!e||e.decision!=='published'||e.policy!==POLICY||e.id!==s.id||
  e.recordId!==s.id||e.rule!==RULE||e.source!==s.source||
  !e.evidence?.includes(SOURCE_BLOB)||!e.evidence?.includes('source-verified 23')||
  x.date!==s.date||x.region!==s.region||x.source!==s.source||
  x.seasonId!=='S37'||x.chapter!==6||x.season!==4||
  x.tournamentId!=='ch6s4-console-duos-victory'||x.event!=='Duos Console Victory Cash Cup'||
  x.kind!==expectedKind(s)||x.round!==expectedRound(s)||x.prize!==0||
  x.verified!==true||x.reviewOnly===true||x.reviewReason!==undefined||
  x.player!==s.player||x.playerRaw!==s.playerRaw||
  JSON.stringify(x.players)!==JSON.stringify(s.players)||
  typeof x.note!=='string'||!x.note.includes(RULE)||!x.note.includes(SOURCE_BLOB)||
  !x.note.includes('上位250')||!x.note.includes('賞金$0'))return false;
 return ['rank','points','kills','vrs','matches'].every(k=>x[k]===s[k]);
}
function removeResolved(queue,ids){
 if(!Array.isArray(queue)||!Array.isArray(ids)||new Set(ids).size!==ids.length)
  throw Error('Invalid source-review cleanup input');
 const actual=queue.filter(x=>ids.includes(x.id));
 if(actual.length!==ids.length||new Set(actual.map(x=>x.id)).size!==ids.length)
  throw Error('Cannot remove absent or repeated source-review ID');
 return queue.filter(x=>!ids.includes(x.id));
}
module.exports={POLICY,RULE,SNAPSHOT_PATH,SOURCE_COMMIT,SOURCE_BLOB,CUTOFF,GROUPS,SPECS,findSpec,findGroup,expectedKind,expectedRound,matchOriginal,validateRecord,removeResolved};
