'use strict';
// Immutable screenshot-backed score/identity oracle for 2023 ME Zero Build Duos Victory Cash Cups.
// Round 2, S26 Event6 (2023-10-23 JST), S28 Event3 (2023-12-16 JST).
const REGION='ME', EVENT='DuosZBVictoryCashCup';
const POLICY='verified-tracker-2023-me-zb-duos-vcup-20231023-20231216';
const RULES=Object.freeze({
 S26:'https://www.fortnite.com/news/victory-cash-cups-chapter-4-season-4-official-rules',
 S28:'https://www.fortnite.com/news/victory-cash-cups-chapter-5-season-1-official-rules'
});
const TOURNAMENTS=Object.freeze({
 S26:'ch4s4-zero-build-duos-victory-cup',
 S28:'ch5s1-zero-build-duos-victory-cup'
});
const CHAPTERS=Object.freeze({S26:[4,4],S28:[5,1]});
const WINDOW=t=>t.seasonId+'_'+EVENT+'_Event'+t.eventNumber+'Round2_ME';
const TRACKER=t=>'https://fortnitetracker.com/events/epicgames_'+t.seasonId+'_'+EVENT+'_ME?window='+WINDOW(t);
const ROUND=t=>'Event '+t.eventNumber+' · Round 2 / 賞金決勝';
const TARGETS=Object.freeze([
  {
    "id": "s28-me-zb-duos-vc-final-20231216-r18",
    "date": "2023-12-16",
    "seasonId": "S28",
    "eventNumber": 3,
    "rank": 18,
    "kills": 13,
    "matches": 3,
    "points": 100,
    "vrs": 1,
    "prize": 200,
    "player": "gents らにりあハンバーガー / ankoro",
    "ids": [
      "0e40af60-272b-4bd3-853b-61cf23e5587b",
      "cb52e200-ea0f-4232-9124-0283f2b637b9"
    ]
  },
  {
    "id": "s28-me-zb-duos-vc-final-20231216-r25",
    "date": "2023-12-16",
    "seasonId": "S28",
    "eventNumber": 3,
    "rank": 25,
    "kills": 5,
    "matches": 3,
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
    "id": "s26-me-zb-duos-vc-final-20231023-r4",
    "date": "2023-10-23",
    "seasonId": "S26",
    "eventNumber": 6,
    "rank": 4,
    "kills": 23,
    "matches": 2,
    "points": 100,
    "vrs": 1,
    "prize": 200,
    "player": "Tayler / Shelom",
    "ids": [
      "31f184df-3e4e-4d20-b3cc-cd439d8ce705",
      "c2688f57-2c94-4718-80df-e1573cff940b"
    ]
  },
  {
    "id": "s26-me-zb-duos-vc-final-20231023-r7",
    "date": "2023-10-23",
    "seasonId": "S26",
    "eventNumber": 6,
    "rank": 7,
    "kills": 22,
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
    "id": "s26-me-zb-duos-vc-final-20231023-r18",
    "date": "2023-10-23",
    "seasonId": "S26",
    "eventNumber": 6,
    "rank": 18,
    "kills": 9,
    "matches": 2,
    "points": 100,
    "vrs": 1,
    "prize": 200,
    "player": "favsie / meah",
    "ids": [
      "4d91273f-56bd-4e8c-811c-8a76f89c18b8",
      "51942f08-b9c3-4f3e-bb12-5dd3e13fafa6"
    ]
  },
  {
    "id": "s26-me-zb-duos-vc-final-20231023-r20",
    "date": "2023-10-23",
    "seasonId": "S26",
    "eventNumber": 6,
    "rank": 20,
    "kills": 8,
    "matches": 2,
    "points": 100,
    "vrs": 1,
    "prize": 200,
    "player": "みよしゆうき / Hagane",
    "ids": [
      "4c4e6b44-655e-4e56-8313-9f4a35e41e2c",
      "8ef7f1f0-4ba4-4de6-989c-230574666feb"
    ]
  },
  {
    "id": "s26-me-zb-duos-vc-final-20231023-r21",
    "date": "2023-10-23",
    "seasonId": "S26",
    "eventNumber": 6,
    "rank": 21,
    "kills": 12,
    "matches": 3,
    "points": 100,
    "vrs": 1,
    "prize": 200,
    "player": "Clover / seek",
    "ids": [
      "8a585019-3be2-436c-b2aa-91195113694a",
      "c47247e8-accd-4555-b635-89ba77751afe"
    ]
  },
  {
    "id": "s26-me-zb-duos-vc-final-20231023-r24",
    "date": "2023-10-23",
    "seasonId": "S26",
    "eventNumber": 6,
    "rank": 24,
    "kills": 6,
    "matches": 2,
    "points": 100,
    "vrs": 1,
    "prize": 200,
    "player": "Altria natural / そみー",
    "ids": [
      "26ec6eb7-d347-4a02-9178-e2d22b5c2739",
      "61fe8404-7400-4668-8b1f-b5c984ddb602"
    ]
  },
  {
    "id": "s26-me-zb-duos-vc-final-20231023-r25",
    "date": "2023-10-23",
    "seasonId": "S26",
    "eventNumber": 6,
    "rank": 25,
    "kills": 8,
    "matches": 3,
    "points": 100,
    "vrs": 1,
    "prize": 200,
    "player": "Smile / hoimin",
    "ids": [
      "8ea5061e-b3d6-447c-a57c-b059933cab9d",
      "94b123ad-e23d-4e40-9b18-3b15d1ccd1e7"
    ]
  },
  {
    "id": "s26-me-zb-duos-vc-final-20231023-r27",
    "date": "2023-10-23",
    "seasonId": "S26",
    "eventNumber": 6,
    "rank": 27,
    "kills": 7,
    "matches": 3,
    "points": 100,
    "vrs": 1,
    "prize": 200,
    "player": "ディンカイサーフパオカミウーラ / 匿名362",
    "ids": [
      "0d0e0d78-1eb9-4e70-9eca-07205fa67b08",
      "e4eea3f6-cdb0-4de9-a2b8-ad2f8f3639e9"
    ]
  }
].map(t=>Object.freeze(t)));
function uuid(url){
 try {
  const u=new URL(url);
  if(u.protocol!=='https:'||u.hostname!=='fortnitetracker.com'||
   !u.pathname.startsWith('/profile/all/')||u.searchParams.size!==1) return null;
  const candidate=u.searchParams.get('id');
  return /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(candidate||'')?candidate.toLowerCase():null;
 }catch{return null;}
}
function verifyCashRow(row,e){
 const t=TARGETS.find(v=>v.id===row?.id);
 return Boolean(t&&e&&e.id===t.id&&e.recordId===t.id&&
  e.decision==='published'&&e.policy===POLICY&&
  e.source===TRACKER(t)&&e.rule===RULES[t.seasonId]&&
  row.date===t.date&&row.region===REGION&&row.seasonId===t.seasonId&&
  row.tournamentId===TOURNAMENTS[t.seasonId]&&
  row.chapter===CHAPTERS[t.seasonId][0]&&row.season===CHAPTERS[t.seasonId][1]&&
  row.event==='Zero Build Duos Victory Cup'&&
  row.round===ROUND(t)&&row.kind==='賞金決勝'&&
  row.source===TRACKER(t)&&row.verified===true&&row.reviewOnly!==true&&
  row.player===t.player&&
  Array.isArray(row.players)&&row.players.length===2&&
  new Set(row.players).size===2&&row.players.join(' / ')===t.player&&
  row.rank===t.rank&&row.points===t.points&&row.kills===t.kills&&
  row.vrs===t.vrs&&row.matches===t.matches&&row.prize===t.prize&&
  row.teamPrize===t.prize&&row.prizePerPlayer===100&&
  Array.isArray(row.profiles)&&row.profiles.length===2&&
  row.profiles.every((p,i)=>p.name===row.players[i]&&uuid(p.url)===t.ids[i])&&
  typeof row.note==='string'&&row.note.includes(TRACKER(t))&&
  row.note.includes(RULES[t.seasonId]));
}
module.exports={REGION,EVENT,POLICY,RULES,TOURNAMENTS,CHAPTERS,TARGETS,WINDOW,TRACKER,ROUND,uuid,verifyCashRow};
