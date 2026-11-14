'use strict';
// Fixed screenshot/identity oracle for 2026-11-14 user-provided NAW/NAC award batch.
// Any change to payout, record ID, roster, rank, event/round, kills or Epic UUID fails the approval audit.
const TARGETS=Object.freeze([
  {
    "id": "s39-nac-1million-unreal-20251221-r109",
    "seasonId": "S39",
    "chapter": 7,
    "season": 1,
    "date": "2025-12-21",
    "region": "NAC",
    "event": "$1 Million Unreal Cup",
    "round": "Session 1 / 賞金決勝",
    "tournamentId": "ch7s1-one-million-unreal-cup",
    "source": "https://fortnitetracker.com/events/epicgames_S39_1MillionUnrealCup_NAC?window=S39_1MillionUnrealCup_NAC",
    "rule": "https://www.fortnite.com/competitive/rules-guidelines/rules-library/1-million-dollar-unreal-cup-chapter-7-season-1-official-rules",
    "player": "おらんげ / すかい",
    "players": [
      "おらんげ",
      "すかい"
    ],
    "raw": "みかんわおらんげ / AtlanticSkyx",
    "rank": 109,
    "points": 319,
    "matches": 8,
    "kills": 27,
    "vrs": 0,
    "prize": 200,
    "uuids": [
      "a8cf2c5c-6642-43eb-9a44-c7a15913d473",
      "fba14a7d-6fc3-42ba-9599-c6afa9f2c568"
    ]
  },
  {
    "id": "s40-naw-solo-vc-20260323-r15",
    "seasonId": "S40",
    "chapter": 7,
    "season": 2,
    "date": "2026-03-23",
    "region": "NAW",
    "event": "Solo Victory Cup",
    "round": "Round 2 · Day 1 / 賞金決勝",
    "tournamentId": "ch7s2-solo-victory",
    "source": "https://fortnitetracker.com/events/epicgames_S40_SoloVictoryCup_NAW?window=S40_SoloVictoryCup_Round2_Day1_NAW",
    "rule": "https://www.fortnite.com/competitive/rules-guidelines/rules-library/fortnite-victory-cups-chapter-7-season-2-official-rules",
    "player": "rakirye",
    "players": [
      "rakirye"
    ],
    "raw": "rakirye",
    "rank": 15,
    "points": 100,
    "matches": 3,
    "kills": 7,
    "vrs": 1,
    "prize": 100,
    "uuids": [
      "cfb4372c-bc47-45f5-8bdf-f7d6b18bc173"
    ]
  },
  {
    "id": "s40-naw-solo-vc-20260323-r17",
    "seasonId": "S40",
    "chapter": 7,
    "season": 2,
    "date": "2026-03-23",
    "region": "NAW",
    "event": "Solo Victory Cup",
    "round": "Round 2 · Day 1 / 賞金決勝",
    "tournamentId": "ch7s2-solo-victory",
    "source": "https://fortnitetracker.com/events/epicgames_S40_SoloVictoryCup_NAW?window=S40_SoloVictoryCup_Round2_Day1_NAW",
    "rule": "https://www.fortnite.com/competitive/rules-guidelines/rules-library/fortnite-victory-cups-chapter-7-season-2-official-rules",
    "player": "すかい",
    "players": [
      "すかい"
    ],
    "raw": "AtlanticSkyx",
    "rank": 17,
    "points": 100,
    "matches": 3,
    "kills": 6,
    "vrs": 1,
    "prize": 100,
    "uuids": [
      "fba14a7d-6fc3-42ba-9599-c6afa9f2c568"
    ]
  },
  {
    "id": "s37-naw-console-duos-vc-20250928-r1",
    "seasonId": "S37",
    "chapter": 6,
    "season": 4,
    "date": "2025-09-28",
    "region": "NAW",
    "event": "Duos Console Victory Cash Cup",
    "round": "Event 6 · Round 2 / 賞金決勝",
    "tournamentId": "ch6s4-console-duos-victory",
    "source": "https://fortnitetracker.com/events/epicgames_S37_ConsoleDuosCashCups_NAW?window=S37_ConsoleDuosCashCups_Event6Round2_NAW",
    "rule": "https://www.fortnite.com/competitive/rules-guidelines/rules-library/fortnite-duos-console-victory-cash-cups-chapter-6-season-4-official-rules",
    "player": "でーもんくらげǃ / ももち",
    "players": [
      "でーもんくらげǃ",
      "ももち"
    ],
    "raw": "でーもんくらげǃ / Ascend JerenX",
    "rank": 1,
    "points": 200,
    "matches": 3,
    "kills": 10,
    "vrs": 2,
    "prize": 400,
    "uuids": [
      "1ec763a9-ecbf-4b13-85d3-702e7a64b22c",
      "619038af-055c-4f49-a241-8eb04439de8e"
    ]
  },
  {
    "id": "s37-naw-console-duos-vc-20250928-r5",
    "seasonId": "S37",
    "chapter": 6,
    "season": 4,
    "date": "2025-09-28",
    "region": "NAW",
    "event": "Duos Console Victory Cash Cup",
    "round": "Event 6 · Round 2 / 賞金決勝",
    "tournamentId": "ch6s4-console-duos-victory",
    "source": "https://fortnitetracker.com/events/epicgames_S37_ConsoleDuosCashCups_NAW?window=S37_ConsoleDuosCashCups_Event6Round2_NAW",
    "rule": "https://www.fortnite.com/competitive/rules-guidelines/rules-library/fortnite-duos-console-victory-cash-cups-chapter-6-season-4-official-rules",
    "player": "きおらび / SN Season",
    "players": [
      "きおらび",
      "SN Season"
    ],
    "raw": "きおらび / SN Season",
    "rank": 5,
    "points": 100,
    "matches": 2,
    "kills": 9,
    "vrs": 1,
    "prize": 200,
    "uuids": [
      "7dcdf989-faa3-47fb-bab8-c2228abb4142",
      "b1a8dec9-b113-4b7e-8acd-83e7ac2f6789"
    ]
  },
  {
    "id": "s37-naw-console-duos-vc-20250928-r9",
    "seasonId": "S37",
    "chapter": 6,
    "season": 4,
    "date": "2025-09-28",
    "region": "NAW",
    "event": "Duos Console Victory Cash Cup",
    "round": "Event 6 · Round 2 / 賞金決勝",
    "tournamentId": "ch6s4-console-duos-victory",
    "source": "https://fortnitetracker.com/events/epicgames_S37_ConsoleDuosCashCups_NAW?window=S37_ConsoleDuosCashCups_Event6Round2_NAW",
    "rule": "https://www.fortnite.com/competitive/rules-guidelines/rules-library/fortnite-duos-console-victory-cash-cups-chapter-6-season-4-official-rules",
    "player": "りーく / ちからV2",
    "players": [
      "りーく",
      "ちからV2"
    ],
    "raw": "Wcr r3exk / ちからv2",
    "rank": 9,
    "points": 100,
    "matches": 2,
    "kills": 7,
    "vrs": 1,
    "prize": 200,
    "uuids": [
      "1320be89-d135-4adf-9078-f82d6c54ca71",
      "2512ed08-9c99-409f-b69d-2cc3de7c35c6"
    ]
  },
  {
    "id": "s37-naw-console-duos-vc-20250928-r13",
    "seasonId": "S37",
    "chapter": 6,
    "season": 4,
    "date": "2025-09-28",
    "region": "NAW",
    "event": "Duos Console Victory Cash Cup",
    "round": "Event 6 · Round 2 / 賞金決勝",
    "tournamentId": "ch6s4-console-duos-victory",
    "source": "https://fortnitetracker.com/events/epicgames_S37_ConsoleDuosCashCups_NAW?window=S37_ConsoleDuosCashCups_Event6Round2_NAW",
    "rule": "https://www.fortnite.com/competitive/rules-guidelines/rules-library/fortnite-duos-console-victory-cash-cups-chapter-6-season-4-official-rules",
    "player": "Botえもん / すかい",
    "players": [
      "Botえもん",
      "すかい"
    ],
    "raw": "Botえもん / AtlanticSkyx",
    "rank": 13,
    "points": 100,
    "matches": 3,
    "kills": 2,
    "vrs": 1,
    "prize": 200,
    "uuids": [
      "d2577115-4c64-43f1-9020-90eccc1097e1",
      "fba14a7d-6fc3-42ba-9599-c6afa9f2c568"
    ]
  }
].map(t=>Object.freeze(t)));
const POLICY='verified-s37-s39-s40-seven-screenshot-awards-20261114';
function uuid(url){
 try {
  const u=new URL(url);
  if(u.protocol!=='https:'||u.hostname!=='fortnitetracker.com'||
   !u.pathname.startsWith('/profile/all/')||u.searchParams.size!==1)return null;
  const id=u.searchParams.get('id');
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id||'')?id.toLowerCase():null;
 }catch{return null}
}
function price(t){
 if(t.seasonId==='S39')return t.rank>=101&&t.rank<=600?200:null;
 if(t.seasonId==='S40')return 100*t.vrs;
 if(t.seasonId==='S37')return 200*t.vrs;
 return null;
}
function verifyCashRow(row,e){
 if(!row||!e)return false;
 const t=TARGETS.find(x=>x.id===row.id);
 if(!t)return false;
 const solo=t.players.length===1,profiles=Array.isArray(row.profiles)?row.profiles:[];
 return Boolean(
 e.id===t.id&&e.recordId===t.id&&e.policy===POLICY&&
 e.decision==='published'&&e.source===t.source&&e.rule===t.rule&&
 row.id===t.id&&row.seasonId===t.seasonId&&row.chapter===t.chapter&&row.season===t.season&&
 row.date===t.date&&row.region===t.region&&row.event===t.event&&
 row.tournamentId===t.tournamentId&&row.round===t.round&&row.kind==='賞金決勝'&&
 row.verified===true&&row.reviewOnly!==true&&row.source===t.source&&
 row.player===t.player&&row.playerRaw===t.raw&&
 Array.isArray(row.players)&&row.players.length===t.players.length&&
 row.players.every((n,i)=>n===t.players[i])&&
 row.rank===t.rank&&row.points===t.points&&row.matches===t.matches&&
 row.kills===t.kills&&row.vrs===t.vrs&&row.prize===t.prize&&
 row.matches>=row.vrs&&price(t)===t.prize&&
 row.teamPrize===t.prize&&row.prizePerPlayer===t.prize/t.players.length&&
 (t.seasonId==='S39'||(row.points===100*row.vrs&&row.prize===t.vrs*(solo?100:200)))&&
 profiles.length===t.uuids.length&&
 profiles.every((p,i)=>p.name===t.players[i]&&uuid(p.url)===t.uuids[i])&&
 (solo?row.profileUrl===profiles[0].url:!row.profileUrl)&&
 typeof row.note==='string'&&row.note.includes(t.source)&&row.note.includes(t.rule));
}
module.exports={TARGETS,POLICY,uuid,price,verifyCashRow};
