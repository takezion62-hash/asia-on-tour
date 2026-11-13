'use strict';
// User-supplied screenshots and ten distinct Tracker Epic IDs, 2024-05-06 JST.
// S29 ME ZB Duos Victory Cup Event7 Round2: one VR gives $100 PER PLAYER.
// Constrain this cash policy to exactly five inspected teams, never infer
// earnings in other events or across the same season.
const DATE='2024-05-06',REGION='ME',SEASON='S29';
const TOURNAMENT='ch5s2-zero-build-duos-victory-cup',EVENT='S29_DuosZBVictoryCashCup';
const WINDOW='S29_DuosZBVictoryCashCup_Event7Round2_ME';
const TRACKER='https://fortnitetracker.com/events/epicgames_'+EVENT+
 '_ME?window='+WINDOW;
const RULE='https://www.fortnite.com/news/victory-cash-cups-chapter-5-season-2-official-rules';
const ROUND='Event 7 · Round 2 / 賞金決勝',POLICY='verified-tracker-s29-me-zb-duos-vcup-20240506';
const TARGETS=Object.freeze([
 {rank:14,id:'s29-me-zb-duos-vc-final-20240506-14',player:'Fraymy / RyoIT',
  points:100,kills:16,vrs:1,matches:3,teamPrize:200,
  uuids:['88181029-896a-4a04-81fd-a93d63d9a8d1','f4cd4eba-e078-4e02-999a-c7f8d911b4c8']},
 {rank:16,id:'s29-me-zb-duos-vc-final-20240506-16',player:'るいぼっと / mask off420',
  points:100,kills:14,vrs:1,matches:3,teamPrize:200,
  uuids:['f495a2a6-295c-4c5d-923a-ab6795439bec','f4c4a11a-03ab-4831-9cae-2ce13c2eeae7']},
 {rank:19,id:'s29-me-zb-duos-vc-final-20240506-19',player:'ねふぁ / ruporupo',
  points:100,kills:13,vrs:1,matches:3,teamPrize:200,
  uuids:['8cbdd28f-a8bd-43ff-abb6-d26b982a76e3','f3be0e8f-1469-479f-aef2-0f281bc59e6b']},
 {rank:21,id:'s29-me-zb-duos-vc-final-20240506-21',player:'僕の番だ / ふりすく',
  points:100,kills:8,vrs:1,matches:3,teamPrize:200,
  uuids:['7b6a0852-1c2a-4b15-a03e-560aaf04353b','8ad1ccd8-fc11-441c-898e-1b56d85da004']},
 {rank:22,id:'s29-me-zb-duos-vc-final-20240506-22',player:'Aim / ZAZI',
  points:100,kills:6,vrs:1,matches:3,teamPrize:200,
  uuids:['8baf28ea-b515-48e6-9232-d03509c13382','f08aad62-9bf0-40d6-beb7-8c7aea8e0a1f']}
]);
function uuid(url){
 try{
  const u=new URL(url);
  if(u.protocol!=='https:'||u.hostname!=='fortnitetracker.com'||
   !u.pathname.startsWith('/profile/all/')||u.searchParams.size!==1)return null;
  const id=u.searchParams.get('id');
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id||'')?id:null;
 }catch{return null}
}
function verifyCashRow(row,approval){
 const t=TARGETS.find(v=>v.id===row?.id);
 if(!t||!approval||approval.id!==t.id||approval.recordId!==t.id||
  approval.decision!=='published'||approval.policy!==POLICY||
  approval.source!==TRACKER||approval.rule!==RULE||
  row.date!==DATE||row.region!==REGION||row.seasonId!==SEASON||
  row.tournamentId!==TOURNAMENT||row.chapter!==5||row.season!==2||
  row.event!=='Zero Build Duos Victory Cup'||row.round!==ROUND||
  row.kind!=='賞金決勝'||row.verified!==true||row.reviewOnly===true||
  row.source!==TRACKER||row.player!==t.player||
  !Array.isArray(row.players)||row.players.length!==2||
  new Set(row.players).size!==2||row.players.join(' / ')!==t.player||
  row.rank!==t.rank||row.points!==t.points||row.kills!==t.kills||
  row.vrs!==t.vrs||row.matches!==t.matches||
  row.prize!==t.teamPrize||row.teamPrize!==t.teamPrize||
  row.prizePerPlayer!==100||
  !Array.isArray(row.profiles)||row.profiles.length!==2||
  row.profiles.some((p,i)=>p.name!==row.players[i]||uuid(p.url)!==t.uuids[i])||
  typeof row.note!=='string'||!row.note.includes(TRACKER)||
  !row.note.includes(RULE))return false;
 return true;
}
module.exports={DATE,REGION,SEASON,TOURNAMENT,EVENT,WINDOW,TRACKER,RULE,
 ROUND,POLICY,TARGETS,uuid,verifyCashRow};
