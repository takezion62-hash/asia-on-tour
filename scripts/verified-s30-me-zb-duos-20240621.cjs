'use strict';
// Screenshot-backed, exact 2024-06-21 JST Middle East Zero Build Duos
// Cash Cup Event 3 Round 2. Rules: Top25 receive prize, ranks 4..25 $200/team.
// Never generalize to any other cash cup date/region/event.
const DATE='2024-06-21',REGION='ME',TOURNAMENT='ch5s3-zb-duos-cash';
const EVENT='S30_DuosCashCupZB',WINDOW='S30_DuosCashCupZB_Event3Round2_ME';
const SOURCE='https://www.fortnite.com/competitive/events/'+EVENT+'/?region=ME&round='+WINDOW;
const TRACKER='https://fortnitetracker.com/events/epicgames_S30_DuosCashCupZB_ME?window='+WINDOW;
const RULE='https://www.fortnite.com/news/duos-cash-cups-chapter-5-season-3-official-rules';
const ROUND='Event 3 · Round 2 / 賞金決勝';
const POLICY='verified-tracker-duos-cash-20240621';
const TARGETS=Object.freeze([
 {id:'auto-s30-1c7844c647ce',rank:13,player:'MMC KAAN BABA / みるやちぇ',
  points:165,kills:9,vrs:1,matches:6,prize:200,
  uuids:['2bf3a503-80fa-49ff-a655-2c23c2e384cf','dd786061-211a-46fb-b849-4687e32189b9']},
 {id:'manual-s30-me-zbduos-20240621-r26',rank:26,player:'るかぽりん / かわあと',
  points:98,kills:6,vrs:0,matches:6,prize:0,
  uuids:['968ebdb8-0fa4-4b94-8558-a66766fb6141','af2b53e2-556f-4fa3-9330-38f439bee18a']},
 {id:'manual-s30-me-zbduos-20240621-r35',rank:35,player:'なずな / R10 ⒶⓁⓅⒽⒶ',
  points:30,kills:0,vrs:0,matches:4,prize:0,
  uuids:['801068c3-cddd-4d65-8d56-8722a9d253e4','b1c907cc-3e7a-4891-bf99-c7155fed87b1']}
]);
const uuid=url=>{try{
 const u=new URL(url);
 if(u.protocol!=='https:'||u.hostname!=='fortnitetracker.com'||
  !u.pathname.startsWith('/profile/all/')||u.searchParams.size!==1)return null;
 const id=u.searchParams.get('id');
 return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id||'')?id:null;
 }catch{return null}};
function verifyCashRow(row,entry){
 const t=TARGETS.find(x=>x.id===row?.id);
 if(!t||!entry||entry.id!==t.id||entry.recordId!==t.id||
  entry.decision!=='published'||entry.policy!==POLICY||
  entry.source!==SOURCE||entry.rule!==RULE||
  row.date!==DATE||row.region!==REGION||row.tournamentId!==TOURNAMENT||
  row.seasonId!=='S30'||row.chapter!==5||row.season!==3||
  row.event!=='ZB Duos Cash Cup'||row.round!==ROUND||
  row.kind!=='賞金決勝'||row.verified!==true||row.reviewOnly===true||
  row.source!==SOURCE||row.player!==t.player||
  !Array.isArray(row.players)||row.players.length!==2||
  new Set(row.players).size!==2||row.players.join(' / ')!==t.player||
  row.rank!==t.rank||row.points!==t.points||row.kills!==t.kills||
  row.vrs!==t.vrs||row.matches!==t.matches||
  row.prize!==t.prize||row.teamPrize!==t.prize||
  row.prizePerPlayer!==t.prize/2||
  !Array.isArray(row.profiles)||row.profiles.length!==2||
  row.profiles.some((p,i)=>p.name!==row.players[i]||uuid(p.url)!==t.uuids[i])||
  typeof row.note!=='string'||!row.note.includes(TRACKER)||
  !row.note.includes(RULE))return false;
 return true;
}
module.exports={DATE,REGION,TOURNAMENT,EVENT,WINDOW,SOURCE,TRACKER,RULE,
 ROUND,POLICY,TARGETS,verifyCashRow,uuid};
