'use strict';
// Exact user-provided Fortnite Tracker final screenshot, 2024-06-07 ME.
// No inferred payout for any other season, event, window, date, or rank.
const DATE='2024-06-07',REGION='ME',TOURNAMENT='ch5s3-zb-duos-cash';
const EVENT='S30_DuosCashCupZB',WINDOW='S30_DuosCashCupZB_Event1Round2_ME';
const SOURCE='https://www.fortnite.com/competitive/events/'+EVENT+'/?region=ME&round='+WINDOW;
const TRACKER='https://fortnitetracker.com/events/epicgames_S30_DuosCashCupZB_ME?window='+WINDOW;
const RULE='https://www.fortnite.com/news/duos-cash-cups-chapter-5-season-3-official-rules';
const ROUND='Event 1 · Round 2 / 賞金決勝';
const POLICY='verified-tracker-duos-cash-20240607';
const TARGETS=[
 {rank:2,player:'Minipiyo / KanA',points:382,kills:35,vrs:2,matches:6,prize:600,id:'auto-s30-8f5a4a97cd86'},
 {rank:7,player:'1度だけこの壁を越えさせてやる / alivenoah',points:238,kills:25,vrs:0,matches:6,prize:200,id:'manual-s30-me-zbduos-20240607-r7'},
 {rank:8,player:'Tayler / Shelom',points:232,kills:14,vrs:0,matches:6,prize:200,id:'auto-s30-17aa17b739a7'},
 {rank:9,player:'RADWIMPSǃ / TEITEI',points:182,kills:16,vrs:0,matches:6,prize:200,id:'auto-s30-02f233a9f9a1'},
 {rank:13,player:'Jaax / こう修行中',points:165,kills:14,vrs:1,matches:6,prize:200,id:'auto-s30-ef98c32395a8'},
 {rank:14,player:'Raito / Razl',points:164,kills:13,vrs:0,matches:6,prize:200,id:'auto-s30-6a316b1e1b05'},
 {rank:16,player:'れんむZ / TakoBeL',points:159,kills:9,vrs:1,matches:5,prize:200,id:'manual-s30-me-zbduos-20240607-r16'},
 {rank:17,player:'Aim / ZAZI',points:156,kills:12,vrs:0,matches:6,prize:200,id:'auto-s30-f1de84355809'},
 {rank:23,player:'MMC KAAN BABA / みるやちぇ',points:132,kills:6,vrs:0,matches:6,prize:200,id:'auto-s30-3b51fd302fd8'},
 {rank:25,player:'りーく / モバイル勢のまかろん',points:120,kills:7,vrs:0,matches:6,prize:200,id:'auto-s30-eaa077924703'}
];
function verifyCashRow(row,approval) {
 const t=TARGETS.find(x=>x.id===row?.id);
 if(!t||!row||!approval||approval.id!==t.id||
  approval.recordId!==t.id||approval.decision!=='published'||
  approval.policy!==POLICY||approval.source!==SOURCE||approval.rule!==RULE||
  row.date!==DATE||row.region!==REGION||row.tournamentId!==TOURNAMENT||
  row.seasonId!=='S30'||row.chapter!==5||row.season!==3||
  row.event!=='ZB Duos Cash Cup'||row.round!==ROUND||
  row.kind!=='賞金決勝'||row.verified!==true||row.reviewOnly===true||
  row.source!==SOURCE||row.player!==t.player||
  !Array.isArray(row.players)||row.players.length!==2||
  row.players.join(' / ')!==t.player||
  !Array.isArray(row.profiles)||row.profiles.length!==2||
  row.profiles.some((p,i)=>p.name!==row.players[i]||
    typeof p.url!=='string'||!p.url.startsWith('https://fortnitetracker.com/profile/all/')||
    !/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(new URL(p.url).searchParams.get('id')||''))||
  row.rank!==t.rank||row.points!==t.points||row.kills!==t.kills||
  row.vrs!==t.vrs||row.matches!==t.matches||
  row.prize!==t.prize||row.teamPrize!==t.prize||
  row.prizePerPlayer!==t.prize/2||
  typeof row.note!=='string'||!row.note.includes(TRACKER)||
  !row.note.includes(RULE))
  return false;
 return true;
}
module.exports={DATE,REGION,TOURNAMENT,EVENT,WINDOW,SOURCE,TRACKER,RULE,ROUND,POLICY,TARGETS,verifyCashRow};
