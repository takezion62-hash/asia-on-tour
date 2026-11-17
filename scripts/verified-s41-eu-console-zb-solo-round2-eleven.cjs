'use strict';
// S41 EU Console Zero Build Solo Victory Cup Round2: 11 exact Epic standings.
// Complete original scoreboard, per-player prize $100 × Round2 VR.
const POLICY='verified-s41-eu-console-zb-round2-eleven-20261117';
const RULE="https://www.fortnite.com/competitive/rules-guidelines/rules-library/fortnite-victory-cups-chapter-7-season-3-official-rules?region=NAC";
const SOURCE="https://www.fortnite.com/competitive/events/S41_ConsoleVCC_SolosZB/?region=EU&round=S41_ConsoleVCC_SolosZB_Event1Round2_EU";
const SCAN_BLOB='43d4af41369f1e3fc30baf60c84de9b8062ff47b';
const EVENT='S41_ConsoleVCC_SolosZB',WINDOW='S41_ConsoleVCC_SolosZB_Event1Round2_EU',KEY='epicgames_S41_ConsoleVCC_SolosZB_EU/S41_ConsoleVCC_SolosZB_Event1Round2_EU';
const DATE='2026-06-15',REGION='EU';
const SPECS=Object.freeze([
 Object.freeze({"id":"auto-s41-290627e7d44a","player":"なずな","playerRaw":"TsV なずねぎ","rank":18,"points":100,"kills":12,"vrs":1,"matches":3,"date":"2026-06-15"}),
 Object.freeze({"id":"auto-s41-27022cc8fb69","player":"るかぽりん","playerRaw":"urzb るかぽりん","rank":512,"points":0,"kills":4,"vrs":0,"matches":3,"date":"2026-06-15"}),
 Object.freeze({"id":"auto-s41-96a2895051fe","player":"miru","playerRaw":"Twitch mirufv","rank":865,"points":0,"kills":2,"vrs":0,"matches":3,"date":"2026-06-15"}),
 Object.freeze({"id":"auto-s41-7be3c3b08e58","player":"はむたろう","playerRaw":"UC.はむたろう","rank":973,"points":0,"kills":2,"vrs":0,"matches":3,"date":"2026-06-15"}),
 Object.freeze({"id":"auto-s41-88a081fd2220","player":"にじいろベタ","playerRaw":"Æ IGNITE.にじいろベタ","rank":1014,"points":0,"kills":2,"vrs":0,"matches":3,"date":"2026-06-15"}),
 Object.freeze({"id":"auto-s41-c4c6588206be","player":"MushyGoose6356","playerRaw":"MushyGoose6356","rank":1034,"points":0,"kills":2,"vrs":0,"matches":3,"date":"2026-06-15"}),
 Object.freeze({"id":"auto-s41-24f34f2d615d","player":"おーくん","playerRaw":"RGL おーくん","rank":1408,"points":0,"kills":1,"vrs":0,"matches":3,"date":"2026-06-15"}),
 Object.freeze({"id":"auto-s41-58cd957c8f91","player":"32歳爆運たひね","playerRaw":"フィズジャンパたひね 執念","rank":1519,"points":0,"kills":0,"vrs":0,"matches":2,"date":"2026-06-15"}),
 Object.freeze({"id":"auto-s41-3b66f11219d0","player":"ぽいずん","playerRaw":"URZB 特別な竜 とくりゅ.ゥ","rank":1524,"points":0,"kills":0,"vrs":0,"matches":3,"date":"2026-06-15"}),
 Object.freeze({"id":"auto-s41-2381163d55ca","player":"しいら","playerRaw":"NE C-RA ｼｲﾗｧｧｧ","rank":1606,"points":0,"kills":0,"vrs":0,"matches":3,"date":"2026-06-15"}),
 Object.freeze({"id":"auto-s41-88daa901d56d","player":"bigsky","playerRaw":"tzd Ackermanǃ","rank":1747,"points":0,"kills":0,"vrs":0,"matches":3,"date":"2026-06-15"})
]);
const getSpec=id=>SPECS.find(x=>x.id===id);
const amount=s=>s.vrs*100;
function matchesOriginal(r,s){
 return !!r&&!!s&&r.id===s.id&&r.date===DATE&&r.region===REGION&&
 r.seasonId==='S41'&&r.chapter===7&&r.season===3&&
 r.tournamentId==='ch7s3-console-zb-solo-victory'&&
 r.event==='Console Solo Victory Cup (ZB)'&&r.source===SOURCE&&
 r.kind==='賞金決勝'&&r.round==='Event 1 · Round 2 / 賞金決勝'&&
 r.prize===null&&r.verified===true&&r.reviewOnly!==true&&
 r.player===s.player&&r.playerRaw===s.playerRaw&&
 ['rank','points','kills','vrs','matches'].every(k=>r[k]===s[k])&&
 r.vrs>=0&&r.points===r.vrs*100;
}
function removeExact(queue,ids){
 if(!Array.isArray(queue)||!Array.isArray(ids)||!ids.length||
 new Set(ids).size!==ids.length)throw Error('S41_EU_R2 invalid cleanup request');
 const found=queue.filter(x=>ids.includes(x.id));
 if(found.length!==ids.length||new Set(found.map(x=>x.id)).size!==ids.length)
  throw Error('S41_EU_R2 missing or duplicate pending ID');
 return queue.filter(x=>!ids.includes(x.id));
}
function validateRecord(r,e){
 const s=getSpec(r?.id);
 return !!r&&!!e&&!!s&&
 e.id===s.id&&e.recordId===s.id&&e.policy===POLICY&&
 e.decision==='published'&&e.source===SOURCE&&e.rule===RULE&&
 typeof e.evidence==='string'&&e.evidence.includes('20-page complete Epic source')&&
 e.evidence.includes(SCAN_BLOB)&&
 r.id===s.id&&r.date===DATE&&r.region===REGION&&
 r.seasonId==='S41'&&r.chapter===7&&r.season===3&&
 r.tournamentId==='ch7s3-console-zb-solo-victory'&&
 r.event==='Console Solo Victory Cup (ZB)'&&r.source===SOURCE&&
 r.kind==='賞金決勝'&&r.round==='Event 1 · Round 2 / 賞金決勝'&&
 r.verified===true&&r.reviewOnly!==true&&r.reviewReason===undefined&&
 r.prize===amount(s)&&r.player===s.player&&r.playerRaw===s.playerRaw&&
 ['rank','points','kills','vrs','matches'].every(k=>r[k]===s[k])&&
 r.prize===r.vrs*100&&r.points===r.vrs*100&&
 typeof r.note==='string'&&r.note.includes(RULE)&&
 r.note.includes(SCAN_BLOB)&&r.note.includes('20/20')&&r.note.includes('賞金$'+amount(s));
}
module.exports={POLICY,RULE,SOURCE,SCAN_BLOB,EVENT,WINDOW,KEY,DATE,REGION,SPECS,getSpec,amount,
 matchesOriginal,removeExact,validateRecord};
