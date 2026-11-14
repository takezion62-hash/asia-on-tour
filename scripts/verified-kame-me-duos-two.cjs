'use strict';
// Locked independent audit values for two user-supplied ME screenshots.
const POLICY='tracker-20261114-kame-me-duos-two-official-rank-cash';
const TARGETS=[
  {
    "id": "s31-me-duos-cash-final-20241004-kame-ryle",
    "screenshot": "スクリーンショット (1778).png",
    "date": "2024-10-04",
    "seasonId": "S31",
    "chapter": 5,
    "season": 4,
    "region": "ME",
    "tournamentId": "ch5s4-duos-cash-cup",
    "event": "Duos Cash Cup",
    "round": "Event 5 · Round 2 / 賞金決勝",
    "eventId": "S31_DuosCashCup",
    "windowId": "S31_DuosCashCup_Event5Round2_ME",
    "rank": 40,
    "points": 40,
    "matches": 6,
    "kills": 4,
    "vrs": 0,
    "prize": 200,
    "prizePerPlayer": 100,
    "players": [
      "Kame",
      "Ryle"
    ],
    "playerRaw": "Kame / Ryle ay лол 7",
    "uuids": [
      "20be8b17-b7eb-4b7d-b2b4-69004da9abaa",
      "9b426796-99ef-41c9-9349-e15c60890634"
    ],
    "profiles": [
      {
        "name": "Kame",
        "url": "https://fortnitetracker.com/profile/all/Kame%20/events?id=20be8b17-b7eb-4b7d-b2b4-69004da9abaa"
      },
      {
        "name": "Ryle",
        "url": "https://fortnitetracker.com/profile/all/Ryle%20ay%20%D0%BB%D0%BE%D0%BB%207/events?id=9b426796-99ef-41c9-9349-e15c60890634"
      }
    ],
    "sourceTracker": "https://fortnitetracker.com/events/epicgames_S31_DuosCashCup_ME?window=S31_DuosCashCup_Event5Round2_ME",
    "rule": "https://www.fortnite.com/news/duos-cash-cups-chapter-5-season-4-official-rules",
    "avgPlace": 28.83,
    "avgTimeAliveSeconds": 1047,
    "kdRatio": 0.67
  },
  {
    "id": "s22-me-elite-weekly-finals-20221023-kame-zazi",
    "screenshot": "スクリーンショット (1794).png",
    "date": "2022-10-23",
    "seasonId": "S22",
    "chapter": 3,
    "season": 4,
    "region": "ME",
    "tournamentId": "ch3s4-elite-cup-weekly-finals",
    "event": "Elite Cup Weekly Finals",
    "round": "Week 4 · Finals / 賞金決勝",
    "eventId": "S22_DivisionalCups_Elite_Finals",
    "windowId": "S22_DivisionalCups_Elite_Finals_ME_Week4_v2",
    "rank": 38,
    "points": 72,
    "matches": 6,
    "kills": 8,
    "vrs": 0,
    "prize": 400,
    "prizePerPlayer": 200,
    "players": [
      "Kame",
      "ZAZI"
    ],
    "playerRaw": "Kame / ZAZI",
    "uuids": [
      "20be8b17-b7eb-4b7d-b2b4-69004da9abaa",
      "f08aad62-9bf0-40d6-beb7-8c7aea8e0a1f"
    ],
    "profiles": [
      {
        "name": "Kame",
        "url": "https://fortnitetracker.com/profile/all/Kame%20/events?id=20be8b17-b7eb-4b7d-b2b4-69004da9abaa"
      },
      {
        "name": "ZAZI",
        "url": "https://fortnitetracker.com/profile/all/ZAZI/events?id=f08aad62-9bf0-40d6-beb7-8c7aea8e0a1f"
      }
    ],
    "sourceTracker": "https://fortnitetracker.com/events/epicgames_S22_DivisionalCups_Elite_Finals_ME?window=S22_DivisionalCups_Elite_Finals_ME_Week4_v2",
    "rule": "https://www.fortnite.com/news/fortnite-divisional-play-chapter-3-season-4-official-rules",
    "avgPlace": 35,
    "avgTimeAliveSeconds": 635,
    "kdRatio": 1.33
  }
];
function uuid(url){try{const u=new URL(url);if(u.protocol!=='https:'||u.hostname!=='fortnitetracker.com'||!u.pathname.startsWith('/profile/all/'))return null;const id=u.searchParams.get('id');return /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id||'')?id.toLowerCase():null;}catch{return null}}
function payout(t){
 if(t.seasonId==='S31'&&t.eventId==='S31_DuosCashCup'&&t.region==='ME'&&t.rank>=6&&t.rank<=40)return 200;
 if(t.seasonId==='S22'&&t.eventId==='S22_DivisionalCups_Elite_Finals'&&t.region==='ME'&&t.rank>=4&&t.rank<=40)return 400;
 return null;
}
function verifyCashRow(row,entry){
 const t=TARGETS.find(x=>x.id===row?.id);
 if(!t||!row||!entry||entry.id!==t.id||entry.recordId!==t.id||entry.policy!==POLICY||entry.decision!=='published'||entry.source!==t.sourceTracker||entry.rule!==t.rule||payout(t)!==t.prize)return false;
 const fields=['id','date','seasonId','chapter','season','region','tournamentId','event','round','rank','points','matches','kills','vrs','prize','prizePerPlayer','source'];
 for(const k of fields){if(row[k]!==t[k==='source'?'sourceTracker':k])return false}
 if(row.teamPrize!==t.prize||row.kind!=='賞金決勝'||row.verified!==true||row.reviewOnly===true||row.player!==t.players.join(' / ')||row.playerRaw!==t.playerRaw)return false;
 if(JSON.stringify(row.players)!==JSON.stringify(t.players))return false;
 if(!Array.isArray(row.profiles)||row.profiles.length!==2||!row.profiles.every((p,i)=>p.name===t.players[i]&&uuid(p.url)===t.uuids[i]))return false;
 if(!Array.isArray(row.teamAccountIds)||!row.teamAccountIds.every((x,i)=>x===t.uuids[i].replace(/-/g,''))||row.teamAccountIds.length!==2)return false;
 if(!row.trackerStats||row.trackerStats.verified!==true||row.trackerStats.source!==t.sourceTracker||row.trackerStats.avgPlace!==t.avgPlace||row.trackerStats.avgTimeAliveSeconds!==t.avgTimeAliveSeconds||row.trackerStats.kdRatio!==t.kdRatio)return false;
 return typeof row.note==='string'&&row.note.includes(t.sourceTracker)&&row.note.includes(t.rule)&&row.note.includes('各選手$'+t.prizePerPlayer);
}
module.exports={TARGETS,POLICY,uuid,payout,verifyCashRow};
