'use strict';
// Screenshot-pinned, zero-cash finals only. No inference for other rounds/dates.
const C=require('./verified-s30-duos-cash-20240607.cjs');
const POLICY='verified-s30-me-zb-duos-zero-20240607';
const TARGETS=[
 {id:'manual-s30-me-zbduos-20240607-r29',rank:29,points:98,kills:6,vrs:0,matches:6,prize:0,
  members:[{name:'現在練習中melonsoda',raw:'現在練習中melonsoda',uuid:'9e7474bf-f358-43dd-a3f8-b2932c7f7b63'},
           {name:'ぜろむ',raw:'ぜろむ',uuid:'b9ed3e6b-f276-4ff5-95d8-fc41eaf2ac65'}]},
 {id:'manual-s30-me-zbduos-20240607-r32',rank:32,points:74,kills:4,vrs:0,matches:3,prize:0,
  members:[{name:'愛知県代表だいき君',raw:'愛知県代表だいき君',uuid:'49f75840-4f67-49ca-9cba-0d67d5551349'},
           {name:'番犬でぐ',raw:'番犬でぐ',uuid:'d407a7f4-2cba-4e75-8b00-03d56eb3d510'}]},
 {id:'manual-s30-me-zbduos-20240607-r37',rank:37,points:56,kills:8,vrs:0,matches:6,prize:0,
  members:[{name:'nooooonameeeeee',raw:'nooooonameeeeee',uuid:'68251480-b041-421a-8b95-61a1518a6e70'},
           {name:'るいぼっと',raw:'Αθηνά.',uuid:'f495a2a6-295c-4c5d-923a-ab6795439bec'}]}
];
function verifyNonprizeRow(row,entry){
 const t=TARGETS.find(x=>x.id===row?.id);
 if(!t||!row||!entry||entry.decision!=='published'||
    entry.policy!==POLICY||entry.id!==t.id||entry.recordId!==t.id||
    entry.source!==C.SOURCE||entry.rule!==C.RULE||
    row.date!==C.DATE||row.region!==C.REGION||row.seasonId!=='S30'||
    row.chapter!==5||row.season!==3||row.tournamentId!==C.TOURNAMENT||
    row.event!=='ZB Duos Cash Cup'||row.round!==C.ROUND||
    row.kind!=='賞金決勝'||row.verified!==true||row.reviewOnly===true||
    row.source!==C.SOURCE||row.rank!==t.rank||
    row.points!==t.points||row.kills!==t.kills||row.vrs!==0||
    row.matches!==t.matches||row.prize!==0||
    row.prizePerPlayer!==0||row.teamPrize!==0||
    !Array.isArray(row.players)||row.players.length!==2||
    row.players.join(' / ')!==t.members.map(m=>m.name).join(' / ')||
    row.player!==row.players.join(' / ')||
    row.playerRaw!==t.members.map(m=>m.raw).join(' / ')||
    !Array.isArray(row.profiles)||row.profiles.length!==2||
    typeof row.note!=='string'||!row.note.includes(C.TRACKER)||
    !row.note.includes(C.RULE)||!row.note.includes('賞金圏外'))
    return false;
 try{
  return row.profiles.every((p,i)=>{
   const m=t.members[i],u=new URL(p?.url);
   return p?.name===m.name&&u.protocol==='https:'&&
    u.hostname==='fortnitetracker.com'&&
    u.pathname==='/profile/all/'+encodeURIComponent(m.raw)+'/events'&&
    u.searchParams.get('id')===m.uuid&&u.searchParams.size===1;
  });
 }catch{return false}
}
module.exports={POLICY,TARGETS,verifyNonprizeRow};
