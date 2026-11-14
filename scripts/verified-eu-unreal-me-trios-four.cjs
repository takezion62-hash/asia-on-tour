'use strict';
// Immutable independent snapshot. Protects historical cash payouts and corrected existing result IDs.
const TARGETS=Object.freeze([
  {
    "id": "s39-eu-1million-unreal-20251221-r919-zazi-tossy",
    "operation": "add",
    "date": "2025-12-21",
    "seasonId": "S39",
    "chapter": 7,
    "season": 1,
    "region": "EU",
    "tournamentId": "ch7s1-one-million-unreal-cup",
    "event": "$1 Million Unreal Cup",
    "round": "Session 1 / 賞金決勝",
    "rank": 919,
    "points": 275,
    "matches": 8,
    "kills": 13,
    "vrs": 2,
    "prize": 200,
    "prizePerPlayer": 100,
    "players": [
      "ZAZI",
      "Tossy"
    ],
    "sourceOfficial": "https://www.fortnite.com/competitive/events/S39_1MillionUnrealCup/?region=EU&round=S39_1MillionUnrealCup_EU",
    "sourceTracker": "https://fortnitetracker.com/events/epicgames_S39_1MillionUnrealCup_EU?window=S39_1MillionUnrealCup_EU",
    "rule": "https://www.fortnite.com/competitive/rules-guidelines/rules-library/1-million-dollar-unreal-cup-chapter-7-season-1-official-rules",
    "player": "ZAZI / Tossy",
    "rawStored": "LYNX ZAZI 咲 / zst tossÿ3k.",
    "profiles": [
      {
        "name": "ZAZI",
        "url": "https://fortnitetracker.com/profile/all/LYNX%20ZAZI%20%E5%92%B2/events?id=f08aad62-9bf0-40d6-beb7-8c7aea8e0a1f"
      },
      {
        "name": "Tossy",
        "url": "https://fortnitetracker.com/profile/all/zst%20toss%C3%BF3k./events?id=ffbecf98-e3cb-4383-9e63-9559064a4a50"
      }
    ],
    "uuids": [
      "f08aad62-9bf0-40d6-beb7-8c7aea8e0a1f",
      "ffbecf98-e3cb-4383-9e63-9559064a4a50"
    ]
  },
  {
    "id": "auto-s32-5841f054e733",
    "operation": "correct",
    "date": "2024-11-08",
    "seasonId": "S32",
    "chapter": 5,
    "season": 5,
    "region": "ME",
    "tournamentId": "ch5s5-trios-cash",
    "event": "Trios Cash Cup",
    "round": "Event 1 · Round 2 / 賞金決勝",
    "rank": 16,
    "points": 109,
    "matches": 6,
    "kills": 11,
    "vrs": 0,
    "prize": 300,
    "prizePerPlayer": 100,
    "players": [
      "Choco",
      "こいる",
      "Jaemon"
    ],
    "sourceOfficial": "https://www.fortnite.com/competitive/events/S32_TriosCashCup/?region=ME&round=S32_TriosCashCup_Event1Round2_ME",
    "sourceTracker": "https://fortnitetracker.com/events/epicgames_S32_TriosCashCup_ME?window=S32_TriosCashCup_Event1Round2_ME",
    "rule": "https://www.fortnite.com/news/fortnite-trios-cash-cups-chapter-2-remix-official-rules",
    "player": "Choco / こいる / Jaemon",
    "rawStored": "nagisa furukawaǃ / こいるやけん / Jaemon.K",
    "profiles": [
      {
        "name": "Choco",
        "url": "https://fortnitetracker.com/profile/all/Choco/events?id=2b094ce4-6d09-4e26-8301-c560f9b1d8c3"
      },
      {
        "name": "こいる",
        "url": "https://fortnitetracker.com/profile/all/%E3%81%93%E3%81%84%E3%82%8B/events?id=50ca67e7-87cd-415a-b266-92cac0e326c8"
      },
      {
        "name": "Jaemon",
        "url": "https://fortnitetracker.com/profile/all/Jaemon/events?id=dcc5f4df-088a-4bca-b405-8b9b0fb2f97c"
      }
    ],
    "uuids": [
      "2b094ce4-6d09-4e26-8301-c560f9b1d8c3",
      "50ca67e7-87cd-415a-b266-92cac0e326c8",
      "dcc5f4df-088a-4bca-b405-8b9b0fb2f97c"
    ]
  },
  {
    "id": "auto-s32-df12a93419a4",
    "operation": "correct",
    "date": "2024-11-08",
    "seasonId": "S32",
    "chapter": 5,
    "season": 5,
    "region": "ME",
    "tournamentId": "ch5s5-trios-cash",
    "event": "Trios Cash Cup",
    "round": "Event 1 · Round 2 / 賞金決勝",
    "rank": 24,
    "points": 56,
    "matches": 6,
    "kills": 7,
    "vrs": 0,
    "prize": 300,
    "prizePerPlayer": 100,
    "players": [
      "Stain",
      "ぷろぼこ",
      "ZAZI"
    ],
    "sourceOfficial": "https://www.fortnite.com/competitive/events/S32_TriosCashCup/?region=ME&round=S32_TriosCashCup_Event1Round2_ME",
    "sourceTracker": "https://fortnitetracker.com/events/epicgames_S32_TriosCashCup_ME?window=S32_TriosCashCup_Event1Round2_ME",
    "rule": "https://www.fortnite.com/news/fortnite-trios-cash-cups-chapter-2-remix-official-rules",
    "player": "Stain / ぷろぼこ / ZAZI",
    "rawStored": "E36 StainY281 / ぷろぼこTakethetop / LYNX ZAZI 咲",
    "profiles": [
      {
        "name": "Stain",
        "url": "https://fortnitetracker.com/profile/all/Stain/events?id=268fddd5-9748-458e-a78b-23ad3bae9ac5"
      },
      {
        "name": "ぷろぼこ",
        "url": "https://fortnitetracker.com/profile/all/Puroboko/events?id=7992a13b-46a2-4f30-a29b-4b6fa67c99e1"
      },
      {
        "name": "ZAZI",
        "url": "https://fortnitetracker.com/profile/all/LYNX%20ZAZI%20%E5%92%B2/events?id=f08aad62-9bf0-40d6-beb7-8c7aea8e0a1f"
      }
    ],
    "uuids": [
      "268fddd5-9748-458e-a78b-23ad3bae9ac5",
      "7992a13b-46a2-4f30-a29b-4b6fa67c99e1",
      "f08aad62-9bf0-40d6-beb7-8c7aea8e0a1f"
    ]
  },
  {
    "id": "s31-me-trios-cash-20241020-event3-final-r10-stain-puroboko-zazi",
    "operation": "add",
    "date": "2024-10-20",
    "seasonId": "S31",
    "chapter": 5,
    "season": 4,
    "region": "ME",
    "tournamentId": "ch5s4-trios-cash",
    "event": "Trios Cash Cup",
    "round": "Event 3 · Round 2 / 賞金決勝",
    "rank": 10,
    "points": 402,
    "matches": 7,
    "kills": 23,
    "vrs": 3,
    "prize": 300,
    "prizePerPlayer": 100,
    "players": [
      "Stain",
      "ぷろぼこ",
      "ZAZI"
    ],
    "sourceOfficial": "https://www.fortnite.com/competitive/events/S31_TriosCashCup/?region=ME&round=S31_TriosCashCup_Event3Round2_ME",
    "sourceTracker": "https://fortnitetracker.com/events/epicgames_S31_TriosCashCup_ME?window=S31_TriosCashCup_Event3Round2_ME",
    "rule": "https://www.fortnite.com/news/fortnite-trios-cash-cups-chapter-5-season-4-official-rules",
    "player": "Stain / ぷろぼこ / ZAZI",
    "rawStored": "Stain / Puroboko / ZAZI",
    "profiles": [
      {
        "name": "Stain",
        "url": "https://fortnitetracker.com/profile/all/Stain/events?id=268fddd5-9748-458e-a78b-23ad3bae9ac5"
      },
      {
        "name": "ぷろぼこ",
        "url": "https://fortnitetracker.com/profile/all/Puroboko/events?id=7992a13b-46a2-4f30-a29b-4b6fa67c99e1"
      },
      {
        "name": "ZAZI",
        "url": "https://fortnitetracker.com/profile/all/LYNX%20ZAZI%20%E5%92%B2/events?id=f08aad62-9bf0-40d6-beb7-8c7aea8e0a1f"
      }
    ],
    "uuids": [
      "268fddd5-9748-458e-a78b-23ad3bae9ac5",
      "7992a13b-46a2-4f30-a29b-4b6fa67c99e1",
      "f08aad62-9bf0-40d6-beb7-8c7aea8e0a1f"
    ]
  }
].map(x=>Object.freeze(x)));
const POLICY='verified-20261114-eu-unreal-me-trios-four';
function uuid(url){try{const u=new URL(url);if(u.protocol!=='https:'||u.hostname!=='fortnitetracker.com'||!u.pathname.startsWith('/profile/all/')||u.searchParams.size!==1)return null;const id=u.searchParams.get('id');return /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id||'')?id.toLowerCase():null;}catch{return null}}
function payout(t){if(t.seasonId==='S39'&&t.region==='EU'&&t.rank>=101&&t.rank<=1000)return 200;if(t.region==='ME'&&t.seasonId==='S32'&&t.rank>=4&&t.rank<=25)return 300;if(t.region==='ME'&&t.seasonId==='S31'&&t.rank>=6&&t.rank<=25)return 300;return null;}
function verifyCashRow(row,entry){if(!row||!entry)return false;const t=TARGETS.find(x=>x.id===row.id);if(!t)return false;const profile=Array.isArray(row.profiles)?row.profiles:[];return Boolean(
entry.recordId===t.id&&entry.id===t.id&&entry.policy===POLICY&&entry.decision==='published'&&entry.source===t.sourceTracker&&entry.rule===t.rule&&
row.id===t.id&&row.date===t.date&&row.seasonId===t.seasonId&&row.chapter===t.chapter&&row.season===t.season&&row.region===t.region&&row.tournamentId===t.tournamentId&&row.event===t.event&&row.round===t.round&&row.kind==='賞金決勝'&&row.verified===true&&row.reviewOnly!==true&&row.source===t.sourceOfficial&&
row.player===t.player&&row.playerRaw===t.rawStored&&Array.isArray(row.players)&&JSON.stringify(row.players)===JSON.stringify(t.players)&&row.rank===t.rank&&row.points===t.points&&row.matches===t.matches&&row.kills===t.kills&&row.vrs===t.vrs&&row.prize===t.prize&&row.teamPrize===t.prize&&row.prizePerPlayer===t.prizePerPlayer&&payout(t)===t.prize&&
Array.isArray(row.teamAccountIds)&&row.teamAccountIds.length===t.uuids.length&&row.teamAccountIds.every((v,i)=>v===t.uuids[i].replace(/-/g,''))&&profile.length===t.profiles.length&&profile.every((p,i)=>p.name===t.players[i]&&uuid(p.url)===t.uuids[i])&&
typeof row.note==='string'&&row.note.includes(t.sourceTracker)&&row.note.includes(t.rule)&&row.note.includes('各選手$'+t.prizePerPlayer)
);}
module.exports={TARGETS,POLICY,uuid,payout,verifyCashRow};
