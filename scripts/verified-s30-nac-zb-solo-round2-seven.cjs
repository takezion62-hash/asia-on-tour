'use strict';
// Immutable source-pinned complete 2024 NAC Zero Build Solo Round2 1VR finalists.
const POLICY="verified-s30-nac-zb-solo-round2-seven-20261117", RULE="https://www.fortnite.com/news/fortnite-victory-cash-cups-chapter-5-season-3-official-rules", SNAPSHOT_PATH="data/manual-approvals/s30-nac-zb-solo-round2-seven-20261117.json", SCAN_BLOB="43d4af41369f1e3fc30baf60c84de9b8062ff47b";
const SPECS=Object.freeze([
  {
    "id": "auto-s30-22bf6da5b90e",
    "player": "ちからV2",
    "playerRaw": "NEXUS ちからV2ǃ",
    "rank": 41,
    "points": 100,
    "kills": 12,
    "vrs": 1,
    "matches": 3,
    "date": "2024-06-04",
    "source": "https://www.fortnite.com/competitive/events/S30_SoloZBVictoryCashCup/?region=NAC&round=S30_SoloZBVictoryCashCup_Event1Round2_NAC",
    "eventNo": 1
  },
  {
    "id": "auto-s30-2e86feed363a",
    "player": "ひょっこりもりりん",
    "playerRaw": "BRN ひょっこりもりりん",
    "rank": 67,
    "points": 100,
    "kills": 8,
    "vrs": 1,
    "matches": 3,
    "date": "2024-06-04",
    "source": "https://www.fortnite.com/competitive/events/S30_SoloZBVictoryCashCup/?region=NAC&round=S30_SoloZBVictoryCashCup_Event1Round2_NAC",
    "eventNo": 1
  },
  {
    "id": "auto-s30-3b4837d76900",
    "player": "TakoBeL",
    "playerRaw": "LYNX TakoBeL",
    "rank": 63,
    "points": 100,
    "kills": 8,
    "vrs": 1,
    "matches": 3,
    "date": "2024-07-16",
    "source": "https://www.fortnite.com/competitive/events/S30_SoloZBVictoryCashCup/?region=NAC&round=S30_SoloZBVictoryCashCup_Event5Round2_NAC",
    "eventNo": 5
  },
  {
    "id": "auto-s30-54270253e968",
    "player": "zerua",
    "playerRaw": "Faction 朝倉未来",
    "rank": 98,
    "points": 100,
    "kills": 4,
    "vrs": 1,
    "matches": 3,
    "date": "2024-07-16",
    "source": "https://www.fortnite.com/competitive/events/S30_SoloZBVictoryCashCup/?region=NAC&round=S30_SoloZBVictoryCashCup_Event5Round2_NAC",
    "eventNo": 5
  },
  {
    "id": "auto-s30-000a713b1ecc",
    "player": "まぐろのほっぺ",
    "playerRaw": "まぐろのほっぺ",
    "rank": 87,
    "points": 100,
    "kills": 5,
    "vrs": 1,
    "matches": 3,
    "date": "2024-07-30",
    "source": "https://www.fortnite.com/competitive/events/S30_SoloZBVictoryCashCup/?region=NAC&round=S30_SoloZBVictoryCashCup_Event7Round2_NAC",
    "eventNo": 7
  },
  {
    "id": "auto-s30-67994e2d2de8",
    "player": "みるやちぇ",
    "playerRaw": "orz MilkÿGotyǃ",
    "rank": 47,
    "points": 100,
    "kills": 11,
    "vrs": 1,
    "matches": 3,
    "date": "2024-07-30",
    "source": "https://www.fortnite.com/competitive/events/S30_SoloZBVictoryCashCup/?region=NAC&round=S30_SoloZBVictoryCashCup_Event7Round2_NAC",
    "eventNo": 7
  },
  {
    "id": "auto-s30-9ee62ca0e426",
    "player": "Dark",
    "playerRaw": "Dxrkÿzǃ",
    "rank": 46,
    "points": 100,
    "kills": 11,
    "vrs": 1,
    "matches": 3,
    "date": "2024-07-30",
    "source": "https://www.fortnite.com/competitive/events/S30_SoloZBVictoryCashCup/?region=NAC&round=S30_SoloZBVictoryCashCup_Event7Round2_NAC",
    "eventNo": 7
  }
]);
const GROUPS=Object.freeze([
  {
    "key": "epicgames_S30_SoloZBVictoryCashCup_NAC/S30_SoloZBVictoryCashCup_Event1Round2_NAC",
    "window": "S30_SoloZBVictoryCashCup_Event1Round2_NAC",
    "date": "2024-06-04",
    "eventNo": 1,
    "source": "https://www.fortnite.com/competitive/events/S30_SoloZBVictoryCashCup/?region=NAC&round=S30_SoloZBVictoryCashCup_Event1Round2_NAC",
    "seenPages": 45,
    "totalPages": 45,
    "rankMax": 67
  },
  {
    "key": "epicgames_S30_SoloZBVictoryCashCup_NAC/S30_SoloZBVictoryCashCup_Event5Round2_NAC",
    "window": "S30_SoloZBVictoryCashCup_Event5Round2_NAC",
    "date": "2024-07-16",
    "eventNo": 5,
    "source": "https://www.fortnite.com/competitive/events/S30_SoloZBVictoryCashCup/?region=NAC&round=S30_SoloZBVictoryCashCup_Event5Round2_NAC",
    "seenPages": 45,
    "totalPages": 45,
    "rankMax": 98
  },
  {
    "key": "epicgames_S30_SoloZBVictoryCashCup_NAC/S30_SoloZBVictoryCashCup_Event7Round2_NAC",
    "window": "S30_SoloZBVictoryCashCup_Event7Round2_NAC",
    "date": "2024-07-30",
    "eventNo": 7,
    "source": "https://www.fortnite.com/competitive/events/S30_SoloZBVictoryCashCup/?region=NAC&round=S30_SoloZBVictoryCashCup_Event7Round2_NAC",
    "seenPages": 45,
    "totalPages": 45,
    "rankMax": 87
  }
]);
const amount=s=>s.vrs*100;
const getSpec=id=>SPECS.find(s=>s.id===id);
function matchOriginal(r,s){return !!r&&!!s&&r.id===s.id&&r.date===s.date&&r.region==='NAC'&&r.seasonId==='S30'&&r.chapter===5&&r.season===3&&r.tournamentId==='ch5s3-zb-solo-victory'&&r.event==='ZB Solo Victory Cup'&&r.round==='Event '+s.eventNo+' · Round 2 / 賞金決勝'&&r.kind==='賞金決勝'&&r.source===s.source&&r.prize===null&&r.verified===true&&r.reviewOnly!==true&&r.player===s.player&&r.playerRaw===s.playerRaw&&['rank','points','kills','vrs','matches'].every(k=>r[k]===s[k])&&r.vrs===1&&r.points===100;}
function validateRecord(r,e){const s=getSpec(r?.id);return !!s&&!!r&&!!e&&e.id===s.id&&e.recordId===s.id&&e.decision==='published'&&e.policy===POLICY&&e.source===s.source&&e.rule===RULE&&e.evidence?.includes(SCAN_BLOB)&&r.id===s.id&&r.date===s.date&&r.region==='NAC'&&r.seasonId==='S30'&&r.chapter===5&&r.season===3&&r.tournamentId==='ch5s3-zb-solo-victory'&&r.event==='ZB Solo Victory Cup'&&r.round==='Event '+s.eventNo+' · Round 2 / 賞金決勝'&&r.kind==='賞金決勝'&&r.source===s.source&&r.verified===true&&r.reviewReason===undefined&&r.reviewOnly!==true&&r.player===s.player&&r.playerRaw===s.playerRaw&&['rank','points','kills','vrs','matches'].every(k=>r[k]===s[k])&&r.prize===100&&r.teamPrize===100&&r.prizePerPlayer===100&&r.vrs===1&&r.points===100&&r.note?.includes(RULE)&&r.note.includes(SCAN_BLOB)&&r.note.includes('45/45')&&r.note.includes('賞金$100');}
function removeExact(q,ids){if(!Array.isArray(q)||new Set(ids).size!==ids.length||q.filter(x=>ids.includes(x.id)).length!==ids.length)throw Error('S30_R2_SEVEN duplicate or missing candidate ID');return q.filter(x=>!ids.includes(x.id));}
module.exports={POLICY,RULE,SNAPSHOT_PATH,SCAN_BLOB,SPECS,GROUPS,amount,getSpec,matchOriginal,validateRecord,removeExact};
