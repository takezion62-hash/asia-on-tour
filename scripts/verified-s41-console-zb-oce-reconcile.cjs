'use strict';
// Locked screenshot and event evidence; intentionally exact, not a general payment guess.
const POLICY='tracker-20261114-s41-console-zb-four-vr-awards';
const TARGETS=[
  {
    "id": "s41-eu-console-zb-solo-vc-final-20260622-demonkurage",
    "date": "2026-06-22",
    "region": "EU",
    "week": "Event 2",
    "round": "Event 2 · Round 2 / 賞金決勝",
    "windowId": "S41_ConsoleVCC_SolosZB_Event2Round2_EU",
    "rank": 41,
    "points": 100,
    "matches": 3,
    "kills": 7,
    "vrs": 1,
    "prize": 100,
    "member": {
      "player": "でーもんくらげǃ",
      "raw": "でーもんくらげǃ",
      "id": "1ec763a9-ecbf-4b13-85d3-702e7a64b22c",
      "url": "https://fortnitetracker.com/profile/all/%E3%81%A7%E3%83%BC%E3%82%82%E3%82%93%E3%81%8F%E3%82%89%E3%81%92%C7%83/events?id=1ec763a9-ecbf-4b13-85d3-702e7a64b22c"
    },
    "screenshot": "2026-11-14 uploaded image 1 (EU 2026-06-22)",
    "avgPlace": 32.33,
    "avgTimeAliveSeconds": 874,
    "kdRatio": 3.5,
    "sourceTracker": "https://fortnitetracker.com/events/epicgames_S41_ConsoleVCC_SolosZB_EU?window=S41_ConsoleVCC_SolosZB_Event2Round2_EU",
    "rule": "https://www.fortnite.com/competitive/rules-guidelines/rules-library/fortnite-victory-cups-chapter-7-season-3-official-rules",
    "eventId": "S41_ConsoleVCC_SolosZB",
    "tournamentId": "ch7s3-console-zb-solo-victory",
    "event": "Console Solo Victory Cup (ZB)",
    "seasonId": "S41",
    "chapter": 7,
    "season": 3
  },
  {
    "id": "s41-me-console-zb-solo-vc-final-20260726-demonkurage",
    "date": "2026-07-26",
    "region": "ME",
    "week": "Event 4",
    "round": "Event 4 · Round 2 / 賞金決勝",
    "windowId": "S41_ConsoleVCC_SolosZB_Event4Round2_ME",
    "rank": 7,
    "points": 100,
    "matches": 3,
    "kills": 14,
    "vrs": 1,
    "prize": 100,
    "member": {
      "player": "でーもんくらげǃ",
      "raw": "でーもんくらげǃ",
      "id": "1ec763a9-ecbf-4b13-85d3-702e7a64b22c",
      "url": "https://fortnitetracker.com/profile/all/%E3%81%A7%E3%83%BC%E3%82%82%E3%82%93%E3%81%8F%E3%82%89%E3%81%92%C7%83/events?id=1ec763a9-ecbf-4b13-85d3-702e7a64b22c"
    },
    "screenshot": "2026-11-14 uploaded image 2 (ME 2026-07-26)",
    "avgPlace": 7.67,
    "avgTimeAliveSeconds": 1155,
    "kdRatio": 7,
    "sourceTracker": "https://fortnitetracker.com/events/epicgames_S41_ConsoleVCC_SolosZB_ME?window=S41_ConsoleVCC_SolosZB_Event4Round2_ME",
    "rule": "https://www.fortnite.com/competitive/rules-guidelines/rules-library/fortnite-victory-cups-chapter-7-season-3-official-rules",
    "eventId": "S41_ConsoleVCC_SolosZB",
    "tournamentId": "ch7s3-console-zb-solo-victory",
    "event": "Console Solo Victory Cup (ZB)",
    "seasonId": "S41",
    "chapter": 7,
    "season": 3
  },
  {
    "id": "s41-me-console-zb-solo-vc-final-20260726-magurohoppe",
    "date": "2026-07-26",
    "region": "ME",
    "week": "Event 4",
    "round": "Event 4 · Round 2 / 賞金決勝",
    "windowId": "S41_ConsoleVCC_SolosZB_Event4Round2_ME",
    "rank": 19,
    "points": 100,
    "matches": 2,
    "kills": 4,
    "vrs": 1,
    "prize": 100,
    "member": {
      "player": "まぐろのほっぺ",
      "raw": "まぐろのほっぺ",
      "id": "21884020-9c99-4339-9c81-6cba567693bf",
      "url": "https://fortnitetracker.com/profile/all/%E3%81%BE%E3%81%90%E3%82%8D%E3%81%AE%E3%81%BB%E3%81%A3%E3%81%BA/events?id=21884020-9c99-4339-9c81-6cba567693bf"
    },
    "screenshot": "2026-11-14 uploaded image 3 (ME 2026-07-26)",
    "avgPlace": 1.5,
    "avgTimeAliveSeconds": 1297,
    "kdRatio": 4,
    "sourceTracker": "https://fortnitetracker.com/events/epicgames_S41_ConsoleVCC_SolosZB_ME?window=S41_ConsoleVCC_SolosZB_Event4Round2_ME",
    "rule": "https://www.fortnite.com/competitive/rules-guidelines/rules-library/fortnite-victory-cups-chapter-7-season-3-official-rules",
    "eventId": "S41_ConsoleVCC_SolosZB",
    "tournamentId": "ch7s3-console-zb-solo-victory",
    "event": "Console Solo Victory Cup (ZB)",
    "seasonId": "S41",
    "chapter": 7,
    "season": 3
  },
  {
    "id": "s41-me-console-zb-solo-vc-final-20260726-tarakokuchibiru",
    "date": "2026-07-26",
    "region": "ME",
    "week": "Event 4",
    "round": "Event 4 · Round 2 / 賞金決勝",
    "windowId": "S41_ConsoleVCC_SolosZB_Event4Round2_ME",
    "rank": 20,
    "points": 100,
    "matches": 3,
    "kills": 5,
    "vrs": 1,
    "prize": 100,
    "member": {
      "player": "たらこ唇",
      "raw": "dydゼロビルド勢ではありません",
      "id": "9f0f2857-4e0a-4882-ae93-960c79cee8b4",
      "url": "https://fortnitetracker.com/profile/all/dyd%E3%82%BC%E3%83%AD%E3%83%93%E3%83%AB%E3%83%89%E5%8B%A2%E3%81%A7%E3%81%AF%E3%81%82%E3%82%8A%E3%81%BE%E3%81%9B%E3%82%93/events?id=9f0f2857-4e0a-4882-ae93-960c79cee8b4"
    },
    "screenshot": "2026-11-14 uploaded image 4 (ME 2026-07-26)",
    "avgPlace": 11.33,
    "avgTimeAliveSeconds": 1196,
    "kdRatio": 2.5,
    "sourceTracker": "https://fortnitetracker.com/events/epicgames_S41_ConsoleVCC_SolosZB_ME?window=S41_ConsoleVCC_SolosZB_Event4Round2_ME",
    "rule": "https://www.fortnite.com/competitive/rules-guidelines/rules-library/fortnite-victory-cups-chapter-7-season-3-official-rules",
    "eventId": "S41_ConsoleVCC_SolosZB",
    "tournamentId": "ch7s3-console-zb-solo-victory",
    "event": "Console Solo Victory Cup (ZB)",
    "seasonId": "S41",
    "chapter": 7,
    "season": 3
  }
];
const DUPLICATES=[
  {
    "removeId": "s42-oce-console-zb-solo-vc-final-20261017-demonkurage",
    "retainId": "auto-s42-166cfc8cc561",
    "player": "でーもんくらげǃ",
    "rank": 11,
    "kills": 9,
    "matches": 3,
    "date": "2026-10-17",
    "region": "OCE",
    "event": "Console Zero Build Solo Victory Cup",
    "tournamentId": "ch7s4-console-zero-build-solo-victory-cup",
    "vrs": 1,
    "points": 100,
    "prize": 100,
    "legacyRound": "決勝 / 賞金獲得",
    "retainedRound": "Event 7 · Round 2 / 賞金決勝",
    "officialWindowId": "S42_ConsoleVCC_SolosZB_Event7Round2_OCE"
  },
  {
    "removeId": "s42-oce-console-zb-solo-vc-final-20261017-nununununu",
    "retainId": "auto-s42-56a43e4527b2",
    "player": "ぬぬぬぬぬぬぬぬwww覚醒WWW",
    "rank": 13,
    "kills": 7,
    "matches": 3,
    "date": "2026-10-17",
    "region": "OCE",
    "event": "Console Zero Build Solo Victory Cup",
    "tournamentId": "ch7s4-console-zero-build-solo-victory-cup",
    "vrs": 1,
    "points": 100,
    "prize": 100,
    "legacyRound": "決勝 / 賞金獲得",
    "retainedRound": "Event 7 · Round 2 / 賞金決勝",
    "officialWindowId": "S42_ConsoleVCC_SolosZB_Event7Round2_OCE"
  },
  {
    "removeId": "s42-oce-console-zb-solo-vc-final-20261017-alpacabest",
    "retainId": "auto-s42-e616b2d9b6d3",
    "player": "ももち",
    "rank": 19,
    "kills": 1,
    "matches": 1,
    "date": "2026-10-17",
    "region": "OCE",
    "event": "Console Zero Build Solo Victory Cup",
    "tournamentId": "ch7s4-console-zero-build-solo-victory-cup",
    "vrs": 1,
    "points": 100,
    "prize": 100,
    "legacyRound": "決勝 / 賞金獲得",
    "retainedRound": "Event 7 · Round 2 / 賞金決勝",
    "officialWindowId": "S42_ConsoleVCC_SolosZB_Event7Round2_OCE"
  }
];
const RULE="https://www.fortnite.com/competitive/rules-guidelines/rules-library/fortnite-victory-cups-chapter-7-season-3-official-rules";
function uuid(value){
 try{const u=new URL(value);const x=u.searchParams.get('id');
 return u.origin==='https://fortnitetracker.com'&&u.pathname.startsWith('/profile/all/')&&/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(x||'')?x.toLowerCase():null;
 }catch{return null;}
}
function verifyCashRow(r,e) {
 if(!r||!e)return false;
 const t=TARGETS.find(x=>x.id===r.id);
 if(!t||e.id!==t.id||e.recordId!==t.id||e.policy!==POLICY||e.decision!=='published'||e.source!==t.sourceTracker||e.rule!==RULE)return false;
 for(const k of ['id','date','region','round','event','rank','points','matches','kills','vrs','prize','seasonId','chapter','season','tournamentId']){
  if(r[k]!==t[k])return false;
 }
 if(r.source!==t.sourceTracker||r.kind!=='賞金決勝'||r.verified!==true||r.reviewOnly===true||
  r.teamPrize!==t.prize||r.prizePerPlayer!==t.prize||r.prize!==r.vrs*100||r.player!==t.member.player||
  r.playerRaw!==t.member.raw||JSON.stringify(r.players)!==JSON.stringify([t.member.player])||
  r.profileUrl!==t.member.url||!Array.isArray(r.profiles)||r.profiles.length!==1||
  r.profiles[0].name!==t.member.player||uuid(r.profiles[0].url)!==t.member.id||
  !Array.isArray(r.teamAccountIds)||r.teamAccountIds.length!==1||
  r.teamAccountIds[0]!==t.member.id.replace(/-/g,''))return false;
 const st=r.trackerStats;
 return !!st&&st.verified===true&&st.source===t.sourceTracker&&
  st.avgPlace===t.avgPlace&&st.avgTimeAliveSeconds===t.avgTimeAliveSeconds&&st.kdRatio===t.kdRatio&&
  typeof r.note==='string'&&r.note.includes(t.sourceTracker)&&r.note.includes(RULE)&&r.note.includes('個人賞金$100');
}
module.exports={POLICY,TARGETS,DUPLICATES,RULE,uuid,verifyCashRow};
