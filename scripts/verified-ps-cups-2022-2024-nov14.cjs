'use strict';
// Independent fixed score/price/identity oracle for user-provided screenshots (Nov 14 2026).
// No published data may claim a changed placement, award, player Epic UUID or session.
const TARGETS=Object.freeze([
  {
    "id": "s25-me-zb-duos-vc-final-20230619-r17",
    "seasonId": "S25",
    "chapter": 4,
    "season": 3,
    "date": "2023-06-19",
    "region": "ME",
    "event": "Zero Build Duos Victory Cup",
    "tournamentId": "ch4s3-zero-build-duos-victory-cup",
    "round": "Event 1 · Round 2 / 賞金決勝",
    "source": "https://fortnitetracker.com/events/epicgames_S25_DuosZBVictoryCashCup_ME?window=S25_DuosZBVictoryCashCup_Event1Round2_ME",
    "rule": "https://www.fortnite.com/news/victory-cash-cups-chapter-4-season-3-official-rules",
    "player": "Aim / ZAZI",
    "players": [
      "Aim",
      "ZAZI"
    ],
    "rank": 17,
    "points": 100,
    "matches": 3,
    "kills": 13,
    "vrs": 1,
    "prize": 200,
    "uuids": [
      "8baf28ea-b515-48e6-9232-d03509c13382",
      "f08aad62-9bf0-40d6-beb7-8c7aea8e0a1f"
    ],
    "profileNames": [
      "Aim",
      "ZAZI"
    ]
  },
  {
    "id": "s31-nac-playstation-sypherpk-final-20240902-r69",
    "seasonId": "S31",
    "chapter": 5,
    "season": 4,
    "date": "2024-09-02",
    "region": "NAC",
    "event": "PlayStation SypherPK Cup",
    "tournamentId": "ch5s4-playstation-sypherpk-cup",
    "round": "Final / 賞金決勝",
    "source": "https://fortnitetracker.com/events/epicgames_S31_PlaystationSypherPKCup_NAC?window=S31_PlaystationSypherPKCup_Final_NAC",
    "rule": "https://www.fortnite.com/news/playstation-sypherpk-cup-chapter-5-season-4-official-rules",
    "player": "p1ng",
    "players": null,
    "rank": 69,
    "points": 34,
    "matches": 6,
    "kills": 5,
    "vrs": 0,
    "prize": 300,
    "uuids": [
      "9766622e-ec65-443f-b8cf-2b860838c19d"
    ],
    "profileNames": [
      "p1ng"
    ]
  },
  {
    "id": "s31-nac-playstation-sypherpk-final-20240902-r89",
    "seasonId": "S31",
    "chapter": 5,
    "season": 4,
    "date": "2024-09-02",
    "region": "NAC",
    "event": "PlayStation SypherPK Cup",
    "tournamentId": "ch5s4-playstation-sypherpk-cup",
    "round": "Final / 賞金決勝",
    "source": "https://fortnitetracker.com/events/epicgames_S31_PlaystationSypherPKCup_NAC?window=S31_PlaystationSypherPKCup_Final_NAC",
    "rule": "https://www.fortnite.com/news/playstation-sypherpk-cup-chapter-5-season-4-official-rules",
    "player": "Aim",
    "players": null,
    "rank": 89,
    "points": 18,
    "matches": 6,
    "kills": 2,
    "vrs": 0,
    "prize": 200,
    "uuids": [
      "8baf28ea-b515-48e6-9232-d03509c13382"
    ],
    "profileNames": [
      "Aim"
    ]
  },
  {
    "id": "s22-oce-playstation-cup-final-20220925-r9",
    "seasonId": "S22",
    "chapter": 3,
    "season": 4,
    "date": "2022-09-25",
    "region": "OCE",
    "event": "PlayStation Cup",
    "tournamentId": "ch3s4-playstation-cup-september",
    "round": "Final / 賞金決勝",
    "source": "https://fortnitetracker.com/events/epicgames_S22_PlaystationCupSep_OCE?window=S22_PlaystationCupSep_OCE_Final",
    "rule": "https://www.fortnite.com/news/fortnite-playstation-cup-chapter-3-season-4-official-rules-september-2022",
    "player": "えるy7",
    "players": null,
    "rank": 9,
    "points": 76,
    "matches": 6,
    "kills": 9,
    "vrs": 1,
    "prize": 450,
    "uuids": [
      "7f2ecd5a-c6ae-4fe2-b717-e92eed60b0bf"
    ],
    "profileNames": [
      "えるy7"
    ]
  },
  {
    "id": "s22-oce-playstation-cup-final-20220925-r24",
    "seasonId": "S22",
    "chapter": 3,
    "season": 4,
    "date": "2022-09-25",
    "region": "OCE",
    "event": "PlayStation Cup",
    "tournamentId": "ch3s4-playstation-cup-september",
    "round": "Final / 賞金決勝",
    "source": "https://fortnitetracker.com/events/epicgames_S22_PlaystationCupSep_OCE?window=S22_PlaystationCupSep_OCE_Final",
    "rule": "https://www.fortnite.com/news/fortnite-playstation-cup-chapter-3-season-4-official-rules-september-2022",
    "player": "Aim",
    "players": null,
    "rank": 24,
    "points": 53,
    "matches": 6,
    "kills": 3,
    "vrs": 1,
    "prize": 200,
    "uuids": [
      "8baf28ea-b515-48e6-9232-d03509c13382"
    ],
    "profileNames": [
      "Aim"
    ]
  },
  {
    "id": "s22-oce-playstation-cup-final-20220925-r55",
    "seasonId": "S22",
    "chapter": 3,
    "season": 4,
    "date": "2022-09-25",
    "region": "OCE",
    "event": "PlayStation Cup",
    "tournamentId": "ch3s4-playstation-cup-september",
    "round": "Final / 賞金決勝",
    "source": "https://fortnitetracker.com/events/epicgames_S22_PlaystationCupSep_OCE?window=S22_PlaystationCupSep_OCE_Final",
    "rule": "https://www.fortnite.com/news/fortnite-playstation-cup-chapter-3-season-4-official-rules-september-2022",
    "player": "clxer",
    "players": null,
    "rank": 55,
    "points": 30,
    "matches": 6,
    "kills": 5,
    "vrs": 0,
    "prize": 200,
    "uuids": [
      "034e54c9-4908-4580-84d6-280686d2808c"
    ],
    "profileNames": [
      "clxer"
    ]
  },
  {
    "id": "s22-oce-playstation-cup-final-20220925-r58",
    "seasonId": "S22",
    "chapter": 3,
    "season": 4,
    "date": "2022-09-25",
    "region": "OCE",
    "event": "PlayStation Cup",
    "tournamentId": "ch3s4-playstation-cup-september",
    "round": "Final / 賞金決勝",
    "source": "https://fortnitetracker.com/events/epicgames_S22_PlaystationCupSep_OCE?window=S22_PlaystationCupSep_OCE_Final",
    "rule": "https://www.fortnite.com/news/fortnite-playstation-cup-chapter-3-season-4-official-rules-september-2022",
    "player": "ちゃービィ",
    "players": null,
    "rank": 58,
    "points": 27,
    "matches": 6,
    "kills": 3,
    "vrs": 0,
    "prize": 200,
    "uuids": [
      "a9c068d9-37a9-4c52-b7cf-4c71fe004cbf"
    ],
    "profileNames": [
      "ちゃービィ"
    ]
  },
  {
    "id": "s22-oce-playstation-cup-final-20220925-r61",
    "seasonId": "S22",
    "chapter": 3,
    "season": 4,
    "date": "2022-09-25",
    "region": "OCE",
    "event": "PlayStation Cup",
    "tournamentId": "ch3s4-playstation-cup-september",
    "round": "Final / 賞金決勝",
    "source": "https://fortnitetracker.com/events/epicgames_S22_PlaystationCupSep_OCE?window=S22_PlaystationCupSep_OCE_Final",
    "rule": "https://www.fortnite.com/news/fortnite-playstation-cup-chapter-3-season-4-official-rules-september-2022",
    "player": "seek",
    "players": null,
    "rank": 61,
    "points": 25,
    "matches": 4,
    "kills": 5,
    "vrs": 0,
    "prize": 200,
    "uuids": [
      "c47247e8-accd-4555-b635-89ba77751afe"
    ],
    "profileNames": [
      "seek"
    ]
  },
  {
    "id": "s22-oce-playstation-cup-final-20220925-r72",
    "seasonId": "S22",
    "chapter": 3,
    "season": 4,
    "date": "2022-09-25",
    "region": "OCE",
    "event": "PlayStation Cup",
    "tournamentId": "ch3s4-playstation-cup-september",
    "round": "Final / 賞金決勝",
    "source": "https://fortnitetracker.com/events/epicgames_S22_PlaystationCupSep_OCE?window=S22_PlaystationCupSep_OCE_Final",
    "rule": "https://www.fortnite.com/news/fortnite-playstation-cup-chapter-3-season-4-official-rules-september-2022",
    "player": "goma",
    "players": null,
    "rank": 72,
    "points": 18,
    "matches": 6,
    "kills": 4,
    "vrs": 0,
    "prize": 200,
    "uuids": [
      "b4649d51-2c59-46c8-9a6e-94ba673ae2e7"
    ],
    "profileNames": [
      "goma"
    ]
  },
  {
    "id": "s22-oce-playstation-cup-final-20220925-r73",
    "seasonId": "S22",
    "chapter": 3,
    "season": 4,
    "date": "2022-09-25",
    "region": "OCE",
    "event": "PlayStation Cup",
    "tournamentId": "ch3s4-playstation-cup-september",
    "round": "Final / 賞金決勝",
    "source": "https://fortnitetracker.com/events/epicgames_S22_PlaystationCupSep_OCE?window=S22_PlaystationCupSep_OCE_Final",
    "rule": "https://www.fortnite.com/news/fortnite-playstation-cup-chapter-3-season-4-official-rules-september-2022",
    "player": "KanA",
    "players": null,
    "rank": 73,
    "points": 18,
    "matches": 6,
    "kills": 4,
    "vrs": 0,
    "prize": 200,
    "uuids": [
      "ce198d52-d8e4-4400-a8a8-44a769eeccb7"
    ],
    "profileNames": [
      "KanA"
    ]
  }
].map(x=>Object.freeze(x)));
const POLICY='verified-s22-s25-s31-playstation-plus-zb-20261114';
function uuid(url){
 try{const u=new URL(url);if(u.protocol!=='https:'||u.hostname!=='fortnitetracker.com'||!u.pathname.startsWith('/profile/all/')||u.searchParams.size!==1)return null;
 const id=u.searchParams.get('id');return /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(id||'')?id.toLowerCase():null}catch{return null}
}
function expectedPrice(t){
 if(t.seasonId==='S25')return t.vrs*200;
 if(t.seasonId==='S31')return t.rank>=61&&t.rank<=75?300:t.rank>=76&&t.rank<=100?200:null;
 if(t.seasonId==='S22'&&t.region==='OCE')return t.rank===9?450:t.rank>=11&&t.rank<=90?200:null;
 return null;
}
function verifyCashRow(row,entry){
 const t=TARGETS.find(x=>x.id===row?.id);if(!t||!entry)return false;
 const dual=Array.isArray(t.players),expectedProfiles=t.uuids.length;
 const profiles=Array.isArray(row.profiles)?row.profiles:[];
 return Boolean(
 entry.id===t.id&&entry.recordId===t.id&&entry.decision==='published'&&
 entry.policy===POLICY&&entry.source===t.source&&entry.rule===t.rule&&
 row.id===t.id&&row.seasonId===t.seasonId&&row.chapter===t.chapter&&row.season===t.season&&
 row.date===t.date&&row.region===t.region&&row.event===t.event&&
 row.tournamentId===t.tournamentId&&row.round===t.round&&row.kind==='賞金決勝'&&
 row.verified===true&&row.reviewOnly!==true&&row.source===t.source&&
 row.player===t.player&&row.rank===t.rank&&row.points===t.points&&
 row.matches===t.matches&&row.kills===t.kills&&row.vrs===t.vrs&&
 row.prize===t.prize&&expectedPrice(t)===t.prize&&
 row.matches>=row.vrs&&
 profiles.length===expectedProfiles&&
 profiles.every((p,i)=>p.name===t.profileNames[i]&&uuid(p.url)===t.uuids[i])&&
 (dual? (
 Array.isArray(row.players)&&row.players.length===2&&
 row.players[0]===t.players[0]&&row.players[1]===t.players[1]&&
 row.teamPrize===t.prize&&row.prizePerPlayer===t.prize/2&&
 row.points===100*row.vrs&&row.prize===200*row.vrs
 ):( (!row.players||row.players.length===0)&&
 row.profileUrl===profiles[0].url&&
 (row.teamPrize==null||row.teamPrize===t.prize)&&
 (row.prizePerPlayer==null||row.prizePerPlayer===t.prize) ))&&
 typeof row.note==='string'&&row.note.includes(t.source)&&row.note.includes(t.rule));
}
module.exports={TARGETS,POLICY,uuid,expectedPrice,verifyCashRow};
