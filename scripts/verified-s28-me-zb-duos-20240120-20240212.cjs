'use strict';
// Two screenshot-backed independent ME 2024 C5S1 Zero Build Duos Victory
// Cup final windows. 8 teams, 12 exact Epic IDs, 1VR => $100 per player.
// These Epic "Event 5" and "Event 8" IDs are from the actual Tracker page;
// do NOT infer these numbers from Epic's announcement schedule numbering.
const REGION='ME',SEASON='S28',TOURNAMENT='ch5s1-zero-build-duos-victory-cup';
const EVENT='S28_DuosZBVictoryCashCup';
const BASE='https://fortnitetracker.com/events/epicgames_'+EVENT+'_ME';
const RULE='https://www.fortnite.com/news/victory-cash-cups-chapter-5-season-1-official-rules';
const POLICY='verified-tracker-s28-me-zb-duos-vcup-20240120-20240212';
const ROUND=(eventNumber)=>'Event '+eventNumber+' · Round 2 / 賞金決勝';
const WINDOW=eventNumber=>EVENT+'_Event'+eventNumber+'Round2_ME';
const TRACKER=eventNumber=>BASE+'?window='+WINDOW(eventNumber);
const TARGETS=Object.freeze([
 {date:'2024-02-12',eventNumber:8,rank:13,kills:17,matches:3,player:'Vall / Michael',
  ids:['c3cbde22-018a-40a2-87c7-d4969aa2d83f','e4d80acb-6e73-4dba-96d5-6aae0e5ac103']},
 {date:'2024-02-12',eventNumber:8,rank:24,kills:12,matches:3,player:'zerua / みやぐらーる',
  ids:['5600bac6-69e8-441a-a496-e8f11594cf6d','dff2ea39-6a1f-44e6-af71-c9d2aa28ebd0']},
 {date:'2024-02-12',eventNumber:8,rank:30,kills:2,matches:2,player:'Aim / ZAZI',
  ids:['8baf28ea-b515-48e6-9232-d03509c13382','f08aad62-9bf0-40d6-beb7-8c7aea8e0a1f']},
 {date:'2024-01-20',eventNumber:5,rank:10,kills:15,matches:2,player:'Vall / Michael',
  ids:['c3cbde22-018a-40a2-87c7-d4969aa2d83f','e4d80acb-6e73-4dba-96d5-6aae0e5ac103']},
 {date:'2024-01-20',eventNumber:5,rank:16,kills:17,matches:3,player:'俺は第六感を信じる / ちゃる',
  ids:['6f0e1f77-6406-431a-a91f-e6bd771eb3b7','e3d0bd7d-4b8c-4e60-ac46-564918e3e3a1']},
 {date:'2024-01-20',eventNumber:5,rank:19,kills:15,matches:3,player:'ろず / Stay Alivё',
  ids:['00a599b8-02b5-4bd8-9b85-2cc0a9385784','7d153870-0713-48c7-815e-27c8c1ff0c92']},
 {date:'2024-01-20',eventNumber:5,rank:21,kills:14,matches:3,player:'Aim / ZAZI',
  ids:['8baf28ea-b515-48e6-9232-d03509c13382','f08aad62-9bf0-40d6-beb7-8c7aea8e0a1f']},
 {date:'2024-01-20',eventNumber:5,rank:23,kills:12,matches:3,player:'Tayler / Shelom',
  ids:['31f184df-3e4e-4d20-b3cc-cd439d8ce705','c2688f57-2c94-4718-80df-e1573cff940b']}
].map(t=>({...t,id:'s28-me-zb-duos-vc-final-'+t.date.replaceAll('-','')+'-r'+t.rank,points:100,vrs:1,prize:200})));
function uuid(url){
 try{
  const u=new URL(url);
  if(u.protocol!=='https:'||u.hostname!=='fortnitetracker.com'||
   !u.pathname.startsWith('/profile/all/')||u.searchParams.size!==1)return null;
  const id=u.searchParams.get('id');
  return /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id||'')?id:null;
 }catch{return null}
}
function verifyCashRow(row,e){
 const t=TARGETS.find(x=>x.id===row?.id);
 return Boolean(t&&e&&e.id===t.id&&e.recordId===t.id&&
  e.decision==='published'&&e.policy===POLICY&&
  e.source===TRACKER(t.eventNumber)&&e.rule===RULE&&
  row.date===t.date&&row.region===REGION&&row.seasonId===SEASON&&
  row.tournamentId===TOURNAMENT&&row.chapter===5&&row.season===1&&
  row.event==='Zero Build Duos Victory Cup'&&
  row.round===ROUND(t.eventNumber)&&row.kind==='賞金決勝'&&
  row.source===TRACKER(t.eventNumber)&&row.verified===true&&
  row.reviewOnly!==true&&row.player===t.player&&
  Array.isArray(row.players)&&row.players.length===2&&
  new Set(row.players).size===2&&row.players.join(' / ')===t.player&&
  row.rank===t.rank&&row.points===t.points&&row.kills===t.kills&&
  row.vrs===t.vrs&&row.matches===t.matches&&row.prize===t.prize&&
  row.teamPrize===t.prize&&row.prizePerPlayer===100&&
  Array.isArray(row.profiles)&&row.profiles.length===2&&
  row.profiles.every((p,i)=>p.name===row.players[i]&&uuid(p.url)===t.ids[i])&&
  typeof row.note==='string'&&row.note.includes(TRACKER(t.eventNumber))&&
  row.note.includes(RULE));
}
module.exports={REGION,SEASON,TOURNAMENT,EVENT,BASE,RULE,POLICY,TARGETS,ROUND,WINDOW,TRACKER,uuid,verifyCashRow};
