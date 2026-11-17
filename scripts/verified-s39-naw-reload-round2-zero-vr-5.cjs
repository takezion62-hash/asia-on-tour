'use strict';
// Exactly five 0VR verified Reload Duos Victory Cup finals in full 2-page boards.
const POLICY="verified-s39-naw-reload-duos-round2-zero-vr-5-20261117";
const RULE="https://www.fortnite.com/competitive/rules-guidelines/rules-library/fortnite-victory-cups-chapter-7-season-1-official-rules?region=NAC";
const SNAPSHOT_PATH="data/manual-approvals/s39-naw-reload-round2-zero-vr-5-snapshot-20261117.json";
const SOURCE_BLOB="43d4af41369f1e3fc30baf60c84de9b8062ff47b";
const GROUPS=Object.freeze([
 Object.freeze({"date":"2025-12-14","eventNo":3,"key":"epicgames_S39_ReloadCashVictoryCup_Dec_NAW/S39_ReloadCashVictoryCup_Event3Round2_NAW","window":"S39_ReloadCashVictoryCup_Event3Round2_NAW","sessionEndUtc":"2025-12-14T06:00:00.000Z","count":3,"pages":2}),
 Object.freeze({"date":"2025-12-21","eventNo":6,"key":"epicgames_S39_ReloadCashVictoryCup_Dec_NAW/S39_ReloadCashVictoryCup_Event6Round2_NAW","window":"S39_ReloadCashVictoryCup_Event6Round2_NAW","sessionEndUtc":"2025-12-21T01:00:00.000Z","count":2,"pages":2})
]);
const SPECS=Object.freeze([
 Object.freeze({"id":"auto-s39-0cdce5beb2a3","date":"2025-12-14","region":"NAW","player":"でーもんくらげǃ / ももち","playerRaw":"でーもんくらげǃ / Ascend JerenX","players":["でーもんくらげǃ","ももち"],"rank":36,"points":0,"kills":9,"vrs":0,"matches":3,"source":"https://www.fortnite.com/competitive/events/S39_ReloadCashVictoryCup_Dec/?region=NAW&round=S39_ReloadCashVictoryCup_Event3Round2_NAW","eventNo":3}),
 Object.freeze({"id":"auto-s39-bb953d3b5bc8","date":"2025-12-14","region":"NAW","player":"REINER / Astell","playerRaw":"Blue_P reinerǃǃ / NŁT Astell fvǃ","players":["REINER","Astell"],"rank":82,"points":0,"kills":4,"vrs":0,"matches":3,"source":"https://www.fortnite.com/competitive/events/S39_ReloadCashVictoryCup_Dec/?region=NAW&round=S39_ReloadCashVictoryCup_Event3Round2_NAW","eventNo":3}),
 Object.freeze({"id":"auto-s39-94b2ebbcba7c","date":"2025-12-14","region":"NAW","player":"ゆの / FA かっちゃん","playerRaw":"NŁT りんねまんとゆの / FA かっちゃん","players":["ゆの","FA かっちゃん"],"rank":110,"points":0,"kills":1,"vrs":0,"matches":3,"source":"https://www.fortnite.com/competitive/events/S39_ReloadCashVictoryCup_Dec/?region=NAW&round=S39_ReloadCashVictoryCup_Event3Round2_NAW","eventNo":3}),
 Object.freeze({"id":"auto-s39-1500f2d29d96","date":"2025-12-21","region":"NAW","player":"ゆの / FA かっちゃん","playerRaw":"NŁT りんねまんとゆの / FA かっちゃん","players":["ゆの","FA かっちゃん"],"rank":30,"points":0,"kills":12,"vrs":0,"matches":3,"source":"https://www.fortnite.com/competitive/events/S39_ReloadCashVictoryCup_Dec/?region=NAW&round=S39_ReloadCashVictoryCup_Event6Round2_NAW","eventNo":6}),
 Object.freeze({"id":"auto-s39-1b5466ac6f72","date":"2025-12-21","region":"NAW","player":"ぶゆ / hst basil","playerRaw":"Lit Buyureyli / hst basil","players":["ぶゆ","hst basil"],"rank":68,"points":0,"kills":4,"vrs":0,"matches":2,"source":"https://www.fortnite.com/competitive/events/S39_ReloadCashVictoryCup_Dec/?region=NAW&round=S39_ReloadCashVictoryCup_Event6Round2_NAW","eventNo":6})
]);
const getSpec=id=>SPECS.find(s=>s.id===id);
const groupOf=s=>GROUPS.find(g=>g.eventNo===s?.eventNo&&g.date===s?.date);
const originalRound=s=>`Event ${s.eventNo} · Round 2 / 賞金決勝`;
function matchOriginal(x,s){
 if(!x||!s||x.id!==s.id||x.date!==s.date||x.region!=='NAW'||
  x.seasonId!=='S39'||x.chapter!==7||x.season!==1||
  x.tournamentId!=='ch7s1-reload-duos-victory'||x.event!=='Reload Duos Victory Cup'||
  x.round!==originalRound(s)||x.kind!=='賞金決勝'||
  x.source!==s.source||x.prize!==null||x.vrs!==0||
  x.verified!==true||x.reviewOnly===true||
  x.player!==s.player||x.playerRaw!==s.playerRaw||
  JSON.stringify(x.players)!==JSON.stringify(s.players))return false;
 return ['rank','points','kills','vrs','matches'].every(k=>x[k]===s[k]);
}
function validateRecord(x,e){
 const s=getSpec(x?.id);
 if(!s||!e||e.id!==s.id||e.recordId!==s.id||
  e.policy!==POLICY||e.decision!=='published'||e.source!==s.source||
  e.rule!==RULE||!e.evidence?.includes(SOURCE_BLOB)||
  !e.evidence?.includes('S39 Reload verified 5')||
  x.id!==s.id||x.seasonId!=='S39'||x.chapter!==7||x.season!==1||
  x.tournamentId!=='ch7s1-reload-duos-victory'||
  x.event!=='Reload Duos Victory Cup'||
  x.date!==s.date||x.region!=='NAW'||x.round!==originalRound(s)||
  x.kind!=='賞金決勝'||x.prize!==0||x.vrs!==0||
  x.source!==s.source||x.verified!==true||x.reviewOnly===true||x.reviewReason!==undefined||
  x.player!==s.player||x.playerRaw!==s.playerRaw||
  JSON.stringify(x.players)!==JSON.stringify(s.players)||
  typeof x.note!=='string'||!x.note.includes(SOURCE_BLOB)||
  !x.note.includes(RULE)||!x.note.includes('0VR')||!x.note.includes('賞金$0'))return false;
 return ['rank','points','kills','vrs','matches'].every(k=>x[k]===s[k]);
}
function removeExact(queue,ids){
 if(!Array.isArray(queue)||!Array.isArray(ids)||new Set(ids).size!==ids.length)
  throw Error('Invalid Reload zero-VR queue cleanup');
 const matches=queue.filter(x=>ids.includes(x.id));
 if(matches.length!==ids.length||new Set(matches.map(x=>x.id)).size!==ids.length)
  throw Error('Missing or duplicated Reload zero-VR source row');
 return queue.filter(x=>!ids.includes(x.id));
}
module.exports={POLICY,RULE,SNAPSHOT_PATH,SOURCE_BLOB,GROUPS,SPECS,getSpec,groupOf,originalRound,matchOriginal,validateRecord,removeExact};
