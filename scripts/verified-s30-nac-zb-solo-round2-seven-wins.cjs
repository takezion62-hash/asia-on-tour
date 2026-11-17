'use strict';
// Seven one-VR zero-build cash finals from full 45/45-page original EU? NAC leaderboard.
// S30 Chapter 5 Season 3: individual $100 for each Round 2 VR.
const POLICY='verified-s30-nac-zb-solo-r2-seven-vr-20261117';
const RULE="https://www.fortnite.com/news/fortnite-victory-cash-cups-chapter-5-season-3-official-rules";
const SCAN_BLOB='43d4af41369f1e3fc30baf60c84de9b8062ff47b';
const EVENT='S30_SoloZBVictoryCashCup';
const GROUPS=Object.freeze([
 Object.freeze({"date":"2024-06-04","n":2,"eventNum":1,"key":"epicgames_S30_SoloZBVictoryCashCup_NAC/S30_SoloZBVictoryCashCup_Event1Round2_NAC","window":"S30_SoloZBVictoryCashCup_Event1Round2_NAC","pages":45,"totalPages":45,"lastSeenRank":4466,"lastSuccessAt":"2026-11-16T06:46:05.724Z","candidateCount":16}),
 Object.freeze({"date":"2024-07-16","n":2,"eventNum":5,"key":"epicgames_S30_SoloZBVictoryCashCup_NAC/S30_SoloZBVictoryCashCup_Event5Round2_NAC","window":"S30_SoloZBVictoryCashCup_Event5Round2_NAC","pages":45,"totalPages":45,"lastSeenRank":4460,"lastSuccessAt":"2026-11-16T09:14:47.118Z","candidateCount":21}),
 Object.freeze({"date":"2024-07-30","n":3,"eventNum":7,"key":"epicgames_S30_SoloZBVictoryCashCup_NAC/S30_SoloZBVictoryCashCup_Event7Round2_NAC","window":"S30_SoloZBVictoryCashCup_Event7Round2_NAC","pages":45,"totalPages":45,"lastSeenRank":4472,"lastSuccessAt":"2026-11-17T02:36:07.736Z","candidateCount":44})
]);
const SPECS=Object.freeze([
 Object.freeze({"id":"auto-s30-22bf6da5b90e","player":"ちからV2","playerRaw":"NEXUS ちからV2ǃ","rank":41,"points":100,"kills":12,"vrs":1,"matches":3,"date":"2024-06-04"}),
 Object.freeze({"id":"auto-s30-2e86feed363a","player":"ひょっこりもりりん","playerRaw":"BRN ひょっこりもりりん","rank":67,"points":100,"kills":8,"vrs":1,"matches":3,"date":"2024-06-04"}),
 Object.freeze({"id":"auto-s30-3b4837d76900","player":"TakoBeL","playerRaw":"LYNX TakoBeL","rank":63,"points":100,"kills":8,"vrs":1,"matches":3,"date":"2024-07-16"}),
 Object.freeze({"id":"auto-s30-54270253e968","player":"zerua","playerRaw":"Faction 朝倉未来","rank":98,"points":100,"kills":4,"vrs":1,"matches":3,"date":"2024-07-16"}),
 Object.freeze({"id":"auto-s30-9ee62ca0e426","player":"Dark","playerRaw":"Dxrkÿzǃ","rank":46,"points":100,"kills":11,"vrs":1,"matches":3,"date":"2024-07-30"}),
 Object.freeze({"id":"auto-s30-67994e2d2de8","player":"みるやちぇ","playerRaw":"orz MilkÿGotyǃ","rank":47,"points":100,"kills":11,"vrs":1,"matches":3,"date":"2024-07-30"}),
 Object.freeze({"id":"auto-s30-000a713b1ecc","player":"まぐろのほっぺ","playerRaw":"まぐろのほっぺ","rank":87,"points":100,"kills":5,"vrs":1,"matches":3,"date":"2024-07-30"})
]);
const getSpec=id=>SPECS.find(x=>x.id===id);
const groupFor=s=>GROUPS.find(g=>g.date===s?.date);
const sourceFor=g=>'https://www.fortnite.com/competitive/events/'+EVENT+'/?region=NAC&round='+g.window;
function matchesOriginal(r,s){
 const g=groupFor(s);
 return !!r&&!!s&&!!g&&r.id===s.id&&r.date===g.date&&r.region==='NAC'&&
 r.seasonId==='S30'&&r.chapter===5&&r.season===3&&
 r.tournamentId==='ch5s3-zb-solo-victory'&&r.event==='ZB Solo Victory Cup'&&
 r.source===sourceFor(g)&&r.round==='Event '+g.eventNum+' · Round 2 / 賞金決勝'&&
 r.kind==='賞金決勝'&&r.verified===true&&r.reviewOnly!==true&&r.prize===null&&
 r.player===s.player&&r.playerRaw===s.playerRaw&&
 ['rank','points','kills','vrs','matches'].every(k=>r[k]===s[k])&&
 r.vrs===1&&r.points===100;
}
function removeExact(queue,ids){
 if(!Array.isArray(queue)||!Array.isArray(ids)||!ids.length||
  new Set(ids).size!==ids.length)throw Error('S30_NAC_R2 invalid cleanup IDs');
 const matches=queue.filter(x=>ids.includes(x.id));
 if(matches.length!==ids.length||new Set(matches.map(x=>x.id)).size!==ids.length)
  throw Error('S30_NAC_R2 missing or duplicate candidate ID');
 return queue.filter(x=>!ids.includes(x.id));
}
function validateRecord(r,e){
 const s=getSpec(r?.id),g=groupFor(s);
 return !!r&&!!e&&!!s&&!!g&&
 e.id===s.id&&e.recordId===s.id&&e.policy===POLICY&&e.decision==='published'&&
 e.source===sourceFor(g)&&e.rule===RULE&&
 typeof e.evidence==='string'&&e.evidence.includes(SCAN_BLOB)&&
 e.evidence.includes('all 45 original ranked pages')&&
 r.id===s.id&&r.date===g.date&&r.region==='NAC'&&
 r.seasonId==='S30'&&r.chapter===5&&r.season===3&&
 r.tournamentId==='ch5s3-zb-solo-victory'&&r.event==='ZB Solo Victory Cup'&&
 r.source===sourceFor(g)&&r.round==='Event '+g.eventNum+' · Round 2 / 賞金決勝'&&
 r.kind==='賞金決勝'&&r.verified===true&&r.reviewOnly!==true&&
 r.reviewReason===undefined&&r.prize===100&&r.vrs===1&&
 r.player===s.player&&r.playerRaw===s.playerRaw&&
 ['rank','points','kills','vrs','matches'].every(k=>r[k]===s[k])&&
 typeof r.note==='string'&&r.note.includes(SCAN_BLOB)&&
 r.note.includes(RULE)&&r.note.includes('45/45')&&r.note.includes('賞金$100');
}
module.exports={POLICY,RULE,SCAN_BLOB,EVENT,GROUPS,SPECS,getSpec,groupFor,sourceFor,
 matchesOriginal,removeExact,validateRecord};
