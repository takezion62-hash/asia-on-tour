'use strict';
// Immutable user-screenshot-backed 2023 S25 ME ZB Duos Victory Cup score and Epic-ID oracle.
// Each leaderboard record is one TEAM, not one individual; two players share team prize.
const REGION='ME',SEASON='S25',TOURNAMENT='ch4s3-zero-build-duos-victory-cup';
const EVENT='S25_DuosZBVictoryCashCup';
const POLICY='verified-tracker-s25-me-zb-duos-vcup-20230619-26';
const RULE='https://www.fortnite.com/news/victory-cash-cups-chapter-4-season-3-official-rules';
const ROUND=t=>'Event '+t.eventNumber+' · Round 2 / 賞金決勝';
const WINDOW=t=>EVENT+'_Event'+t.eventNumber+'Round2_ME';
const TRACKER=t=>'https://fortnitetracker.com/events/epicgames_'+EVENT+'_ME?window='+WINDOW(t);
const TARGETS=Object.freeze([
  {
    "id": "s25-me-zb-duos-vc-final-20230626-r4",
    "date": "2023-06-26",
    "eventNumber": 2,
    "rank": 4,
    "kills": 24,
    "matches": 2,
    "points": 100,
    "vrs": 1,
    "prize": 200,
    "player": "Minipiyo / KanA",
    "ids": [
      "022c1a1b-18ea-4c3e-a392-2a086b0b6dcf",
      "ce198d52-d8e4-4400-a8a8-44a769eeccb7"
    ]
  },
  {
    "id": "s25-me-zb-duos-vc-final-20230626-r12",
    "date": "2023-06-26",
    "eventNumber": 2,
    "rank": 12,
    "kills": 14,
    "matches": 2,
    "points": 100,
    "vrs": 1,
    "prize": 200,
    "player": "Aim / ZAZI",
    "ids": [
      "8baf28ea-b515-48e6-9232-d03509c13382",
      "f08aad62-9bf0-40d6-beb7-8c7aea8e0a1f"
    ]
  },
  {
    "id": "s25-me-zb-duos-vc-final-20230626-r19",
    "date": "2023-06-26",
    "eventNumber": 2,
    "rank": 19,
    "kills": 9,
    "matches": 2,
    "points": 100,
    "vrs": 1,
    "prize": 200,
    "player": "Daddy / どんぐり",
    "ids": [
      "3107ea75-eacf-4c3b-82a2-a2d26f05ef4b",
      "ec941277-b49f-4119-95fe-8011b7a6e012"
    ]
  },
  {
    "id": "s25-me-zb-duos-vc-final-20230626-r20",
    "date": "2023-06-26",
    "eventNumber": 2,
    "rank": 20,
    "kills": 13,
    "matches": 3,
    "points": 100,
    "vrs": 1,
    "prize": 200,
    "player": "LODSTK / RiaM",
    "ids": [
      "95efd5fb-69dc-4dbb-ba2c-ac69a2f0af61",
      "dbc01485-7ea8-438c-9fa0-9ecf7c649508"
    ]
  },
  {
    "id": "s25-me-zb-duos-vc-final-20230626-r23",
    "date": "2023-06-26",
    "eventNumber": 2,
    "rank": 23,
    "kills": 12,
    "matches": 3,
    "points": 100,
    "vrs": 1,
    "prize": 200,
    "player": "mаkise / sena",
    "ids": [
      "e6c131fd-ba4a-4451-b163-5e228f7cacba",
      "f4f0cf26-d8e1-4042-a9cc-8f731831d1f2"
    ]
  },
  {
    "id": "s25-me-zb-duos-vc-final-20230619-r1",
    "date": "2023-06-19",
    "eventNumber": 1,
    "rank": 1,
    "kills": 25,
    "matches": 3,
    "points": 200,
    "vrs": 2,
    "prize": 400,
    "player": "LODSTK / RiaM",
    "ids": [
      "95efd5fb-69dc-4dbb-ba2c-ac69a2f0af61",
      "dbc01485-7ea8-438c-9fa0-9ecf7c649508"
    ]
  },
  {
    "id": "s25-me-zb-duos-vc-final-20230619-r3",
    "date": "2023-06-19",
    "eventNumber": 1,
    "rank": 3,
    "kills": 12,
    "matches": 1,
    "points": 100,
    "vrs": 1,
    "prize": 200,
    "player": "Yuna / すしくん.",
    "ids": [
      "4ee03077-4480-40c2-bc4e-05f89aa6bfb2",
      "c4c57597-e005-4684-9baa-9384bf6651d2"
    ]
  },
  {
    "id": "s25-me-zb-duos-vc-final-20230619-r11",
    "date": "2023-06-19",
    "eventNumber": 1,
    "rank": 11,
    "kills": 18,
    "matches": 3,
    "points": 100,
    "vrs": 1,
    "prize": 200,
    "player": "Mainly / Reim",
    "ids": [
      "489af374-9608-4f48-b37f-6e6aa8a0d6b9",
      "e27ce1e7-fbf5-4eb2-afe3-dbee332e5786"
    ]
  },
  {
    "id": "s25-me-zb-duos-vc-final-20230619-r8",
    "date": "2023-06-19",
    "eventNumber": 1,
    "rank": 8,
    "kills": 21,
    "matches": 3,
    "points": 100,
    "vrs": 1,
    "prize": 200,
    "player": "ぺぽ / wickesy",
    "ids": [
      "5ca2f57f-d456-4f98-a2c4-967166f7222e",
      "b2b0fbd1-cf4e-4b51-b01d-83f8c5d03cc0"
    ]
  },
  {
    "id": "s25-me-zb-duos-vc-final-20230619-r14",
    "date": "2023-06-19",
    "eventNumber": 1,
    "rank": 14,
    "kills": 16,
    "matches": 3,
    "points": 100,
    "vrs": 1,
    "prize": 200,
    "player": "ぱやぱやの和田もひ / うのすけ",
    "ids": [
      "35ac3b8d-870d-40d5-b25d-aec767721188",
      "7874eb51-4eb6-4224-8bbc-12576db975ce"
    ]
  }
].map(x=>Object.freeze(x)));
function uuid(url){
 try {
  const u=new URL(url);
  if(u.protocol!=='https:'||u.hostname!=='fortnitetracker.com'||
     !u.pathname.startsWith('/profile/all/')||u.searchParams.size!==1)return null;
  const id=u.searchParams.get('id');
  return /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id||'')?id.toLowerCase():null;
 }catch{return null}
}
function verifyCashRow(row,e){
 const t=TARGETS.find(x=>x.id===row?.id);
 return Boolean(t&&e&&e.id===t.id&&e.recordId===t.id&&
  e.decision==='published'&&e.policy===POLICY&&
  e.source===TRACKER(t)&&e.rule===RULE&&
  row.id===t.id&&row.date===t.date&&row.region===REGION&&
  row.seasonId===SEASON&&row.chapter===4&&row.season===3&&
  row.tournamentId===TOURNAMENT&&row.event==='Zero Build Duos Victory Cup'&&
  row.round===ROUND(t)&&row.kind==='賞金決勝'&&
  row.source===TRACKER(t)&&row.verified===true&&row.reviewOnly!==true&&
  row.player===t.player&&Array.isArray(row.players)&&row.players.length===2&&
  row.players[0]!==row.players[1]&&row.players.join(' / ')===t.player&&
  row.rank===t.rank&&row.points===t.points&&row.kills===t.kills&&
  row.vrs===t.vrs&&row.matches===t.matches&&
  row.matches>=t.vrs&&row.matches<=3&&row.points===t.vrs*100&&
  row.prize===t.prize&&row.teamPrize===t.prize&&
  row.prizePerPlayer===t.vrs*100&&row.prize===t.vrs*200&&
  Array.isArray(row.profiles)&&row.profiles.length===2&&
  row.profiles.every((p,i)=>p.name===row.players[i]&&uuid(p.url)===t.ids[i])&&
  typeof row.note==='string'&&row.note.includes(TRACKER(t))&&row.note.includes(RULE));
}
module.exports={REGION,SEASON,TOURNAMENT,EVENT,POLICY,RULE,TARGETS,ROUND,WINDOW,TRACKER,uuid,verifyCashRow};
