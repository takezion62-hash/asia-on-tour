'use strict';
// Fixed screenshot/identity oracle for 2026-11-14 user-provided NAW/NAC award batch.
// Any change to payout, record ID, roster, rank, event/round, kills or Epic UUID fails the approval audit.
const TARGETS=Object.freeze([
  {
    "seasonId": "S37",
    "chapter": 6,
    "season": 4,
    "date": "2025-10-04",
    "region": "OCE",
    "event": "Duos Console Victory Cash Cup",
    "round": "Event 7 · Round 2 / 賞金決勝",
    "tournamentId": "ch6s4-console-duos-victory",
    "source": "https://fortnitetracker.com/events/epicgames_S37_ConsoleDuosCashCups_OCE?window=S37_ConsoleDuosCashCups_Event7Round2_OCE",
    "rule": "https://www.fortnite.com/competitive/rules-guidelines/rules-library/fortnite-duos-console-victory-cash-cups-chapter-6-season-4-official-rules",
    "rank": 6,
    "points": 100,
    "matches": 2,
    "kills": 12,
    "vrs": 1,
    "prize": 200,
    "id": "s37-oce-console-duos-vc-20251004-r6",
    "player": "Mofu / すかい",
    "players": [
      "Mofu",
      "すかい"
    ],
    "raw": "Mofu / AtlanticSkyx",
    "uuids": [
      "b7863190-5b98-47c3-8d34-7af8ea94d4b5",
      "fba14a7d-6fc3-42ba-9599-c6afa9f2c568"
    ]
  },
  {
    "seasonId": "S41",
    "chapter": 7,
    "season": 3,
    "date": "2026-06-21",
    "region": "OCE",
    "event": "Console Solo Victory Cup (ZB)",
    "round": "Event 2 · Round 2 / 賞金決勝",
    "tournamentId": "ch7s3-console-zb-solo-victory",
    "source": "https://fortnitetracker.com/events/epicgames_S41_ConsoleVCC_SolosZB_OCE?window=S41_ConsoleVCC_SolosZB_Event2Round2_OCE",
    "rule": "https://www.fortnite.com/competitive/rules-guidelines/rules-library/fortnite-victory-cups-chapter-7-season-3-official-rules",
    "rank": 1,
    "points": 100,
    "matches": 3,
    "kills": 24,
    "vrs": 1,
    "prize": 100,
    "id": "s41-oce-console-zb-solo-vc-20260621-r1",
    "player": "ЯGN Pinobot ǃ",
    "players": [
      "ЯGN Pinobot ǃ"
    ],
    "raw": "ЯGN Pinobot !",
    "uuids": [
      "3181582a-2e0d-47df-971a-a70f248c9400"
    ]
  },
  {
    "seasonId": "S41",
    "chapter": 7,
    "season": 3,
    "date": "2026-06-21",
    "region": "OCE",
    "event": "Console Solo Victory Cup (ZB)",
    "round": "Event 2 · Round 2 / 賞金決勝",
    "tournamentId": "ch7s3-console-zb-solo-victory",
    "source": "https://fortnitetracker.com/events/epicgames_S41_ConsoleVCC_SolosZB_OCE?window=S41_ConsoleVCC_SolosZB_Event2Round2_OCE",
    "rule": "https://www.fortnite.com/competitive/rules-guidelines/rules-library/fortnite-victory-cups-chapter-7-season-3-official-rules",
    "rank": 6,
    "points": 100,
    "matches": 3,
    "kills": 15,
    "vrs": 1,
    "prize": 100,
    "id": "s41-oce-console-zb-solo-vc-20260621-r6",
    "player": "めいる",
    "players": [
      "めいる"
    ],
    "raw": "めいる",
    "uuids": [
      "2afccdfc-1f6a-402a-a5d3-a5024332d8ef"
    ]
  },
  {
    "seasonId": "S41",
    "chapter": 7,
    "season": 3,
    "date": "2026-06-21",
    "region": "OCE",
    "event": "Console Solo Victory Cup (ZB)",
    "round": "Event 2 · Round 2 / 賞金決勝",
    "tournamentId": "ch7s3-console-zb-solo-victory",
    "source": "https://fortnitetracker.com/events/epicgames_S41_ConsoleVCC_SolosZB_OCE?window=S41_ConsoleVCC_SolosZB_Event2Round2_OCE",
    "rule": "https://www.fortnite.com/competitive/rules-guidelines/rules-library/fortnite-victory-cups-chapter-7-season-3-official-rules",
    "rank": 15,
    "points": 100,
    "matches": 3,
    "kills": 8,
    "vrs": 1,
    "prize": 100,
    "id": "s41-oce-console-zb-solo-vc-20260621-r15",
    "player": "すかい",
    "players": [
      "すかい"
    ],
    "raw": "AtlanticSkyx",
    "uuids": [
      "fba14a7d-6fc3-42ba-9599-c6afa9f2c568"
    ]
  },
  {
    "seasonId": "S41",
    "chapter": 7,
    "season": 3,
    "date": "2026-06-14",
    "region": "OCE",
    "event": "Console Solo Victory Cup (ZB)",
    "round": "Event 1 · Round 2 / 賞金決勝",
    "tournamentId": "ch7s3-console-zb-solo-victory",
    "source": "https://fortnitetracker.com/events/epicgames_S41_ConsoleVCC_SolosZB_OCE?window=S41_ConsoleVCC_SolosZB_Event1Round2_OCE",
    "rule": "https://www.fortnite.com/competitive/rules-guidelines/rules-library/fortnite-victory-cups-chapter-7-season-3-official-rules",
    "rank": 25,
    "points": 100,
    "matches": 3,
    "kills": 3,
    "vrs": 1,
    "prize": 100,
    "id": "s41-oce-console-zb-solo-vc-20260614-r25",
    "player": "すかい",
    "players": [
      "すかい"
    ],
    "raw": "AtlanticSkyx",
    "uuids": [
      "fba14a7d-6fc3-42ba-9599-c6afa9f2c568"
    ]
  }
].map(t=>Object.freeze(t)));
const POLICY='verified-s37-s41-oce-five-screenshot-awards-20261114';
function uuid(url){
 try {
  const u=new URL(url);
  if(u.protocol!=='https:'||u.hostname!=='fortnitetracker.com'||
   !u.pathname.startsWith('/profile/all/')||u.searchParams.size!==1)return null;
  const id=u.searchParams.get('id');
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id||'')?id.toLowerCase():null;
 }catch{return null}
}
function price(t){if(t.seasonId==='S37')return 200*t.vrs;if(t.seasonId==='S41')return 100*t.vrs;return null;}
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
 (row.points===100*row.vrs&&row.prize===t.vrs*(solo?100:200))&&
 profiles.length===t.uuids.length&&
 profiles.every((p,i)=>p.name===t.players[i]&&uuid(p.url)===t.uuids[i])&&
 (solo?row.profileUrl===profiles[0].url:!row.profileUrl)&&
 typeof row.note==='string'&&row.note.includes(t.source)&&row.note.includes(t.rule));
}
module.exports={TARGETS,POLICY,uuid,price,verifyCashRow};
