'use strict';
// Frozen independent oracle: original Epic scoreboard + independently published cash
// prize table. Do not treat a Battle Royale win as necessary for placement-cash.
const POLICY='verified-nov14-pending-cash';
const TARGETS=Object.freeze([
 Object.freeze({
  id:'auto-s32-eb755a2d9ea4',date:'2024-11-23',region:'NAC',
  tournamentId:'ch5s5-solo-victory-cup',seasonId:'S32',
  eventId:'S32_SoloVictoryCashCup',windowId:'S32_SoloVictoryCashCup_Event3Round2_NAC',
  player:'Unger',playerRaw:'EDGE Unger',
  rank:123,points:100,kills:9,vrs:1,matches:3,prize:100,
  rule:'https://www.fortnite.com/news/competitive-details-make-your-mark-in-chapter-2-remix',
  award:'https://fortnitetracker.com/events/epicgames_S32_SoloVictoryCashCup_NAC?window=S32_SoloVictoryCashCup_Event3Round2_NAC',
  independent:'https://liquipedia.net/fortnite/Unger/Results'
 }),
 Object.freeze({
  id:'auto-s43-08f4dbe1293e',date:'2026-11-13',region:'OCE',
  tournamentId:'ch7s5-reload-zero-build-duos-cash-cup',seasonId:'S43',
  eventId:'S43_ReloadZBDuosCashCup',windowId:'S43_ReloadZBDuosCashCup_Event1Round2_OCE',
  player:'bigsky / Reo',playerRaw:'tzd Ackermanǃ / IGNUM Reo',
  roster:Object.freeze(['bigsky','Reo']),
  accountIds:Object.freeze(['0d77cc7e6bda47d48183890d973ec508','25945a39f1564a22aab8ea7808feac98']),
  rank:3,points:264,kills:30,vrs:0,matches:6,prize:400,perPlayer:200,
  rule:'https://www.fortnite.com/competitive/rules-guidelines/rules-library/fortnite-zero-build-reload-cash-cups-chapter-7-mini-season-official-rules',
  award:'https://fortnitetracker.com/events/epicgames_S43_ReloadZBDuosCashCup_OCE?window=S43_ReloadZBDuosCashCup_Event1Round2_OCE',
  independent:'https://fortnite.gg/events/epicgames_S43_ReloadZBDuosCashCup_OCE'
 })
]);
function official(t){return 'https://www.fortnite.com/competitive/events/'+t.eventId+'/?region='+t.region+'&round='+t.windowId}
function exactScores(row,t){return row.id===t.id&&row.date===t.date&&row.region===t.region&&
 row.tournamentId===t.tournamentId&&row.seasonId===t.seasonId&&
 row.player===t.player&&row.playerRaw===t.playerRaw&&
 row.rank===t.rank&&row.points===t.points&&row.kills===t.kills&&
 row.vrs===t.vrs&&row.matches===t.matches&&row.source===official(t)}
function verifiedCashRow(row,ledger){
 const t=TARGETS.find(x=>x.id===row?.id);
 if(!t||!ledger||ledger.policy!==POLICY||ledger.id!==t.id||
  ledger.recordId!==t.id||ledger.decision!=='published'||
  ledger.source!==official(t)||ledger.rule!==t.rule||
  row.verified!==true||row.reviewOnly===true||
  row.kind!=='賞金決勝'||row.prize!==t.prize)return false;
 // The round label is exactly validated by tournament and date below.
 if(!exactScores(row,t)||row.round!==
  (t.seasonId==='S43'?'Event 1 · Round 2 / 賞金決勝':'Event 3 · Round 2 / 賞金決勝')||
  typeof row.note!=='string'||!row.note.includes(t.award)||
  !row.note.includes(t.rule)||!row.note.includes(t.independent))return false;
 if(t.roster)return Array.isArray(row.players)&&row.players.length===2&&
  row.players.every((x,i)=>x===t.roster[i])&&
  Array.isArray(row.teamAccountIds)&&row.teamAccountIds.length===2&&
  row.teamAccountIds.every((x,i)=>x===t.accountIds[i])&&
  row.teamPrize===400&&row.prizePerPlayer===200;
 return (!row.players||row.players.length===1&&row.players[0]==='Unger')&&
  row.teamPrize===undefined&&row.prizePerPlayer===undefined;
}
module.exports={POLICY,TARGETS,official,exactScores,verifiedCashRow};
