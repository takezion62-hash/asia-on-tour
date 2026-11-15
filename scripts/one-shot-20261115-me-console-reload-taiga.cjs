'use strict';
// One-shot verified correction from the user's 2026-11-15 Tracker screenshots.
// This file is removed after safe branch publication; only data remains in PR.
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const ROOT=path.resolve(__dirname,'..');
const {readResults,publishResults}=require('./source-results-store.cjs');
const load=name=>JSON.parse(fs.readFileSync(path.join(ROOT,name),'utf8'));
const save=(name,value)=>fs.writeFileSync(path.join(ROOT,name),JSON.stringify(value,null,2)+'\n');
const REF="https://fortnitetracker.com/events/epicgames_S31_PlatformReloadDuosCashCupConsole_ME?window=S31_PlatformReloadDuosCashCupConsole_Event4Round2_ME";
const RULE="https://www.fortnite.com/news/reload-platform-duos-cash-cups-chapter-5-season-4-official-rules";
const TAIGA_SRC="https://fortnitetracker.com/events/epicgames_S42_ReloadReloadSoloVictoryCup_NAW?window=S42_ReloadSoloVictoryCup_Event4_Round2_NAW";
const TAIGA_PROFILE="https://fortnitetracker.com/profile/all/%E3%81%9F%E3%81%84%E3%81%8C/events?id=12485be1-a95b-4dc9-be0b-3ea1425c348a";
const KURAMA="Solary Kurаmа";
const PING="p1ng";
const KURAMA_URL="https://fortnitetracker.com/profile/all/Solary%20Kur%D0%B0m%D0%B0/events?id=1872812e-3050-4d6f-89bc-bd652b1d38d4";
const PING_URL="https://fortnitetracker.com/profile/all/p1ng/events?id=9766622e-ec65-443f-b8cf-2b860838c19d";
const NEW_ID="s31-me-console-reload-duos-final-20240928-kurama-p1ng";
const FIX_ID="s42-naw-reload-solo-20261017-taiga";
const T_ID="ch5s4-reload-duos-cash-cup-console";
const uuid=url=>new URL(url).searchParams.get('id')?.toLowerCase();
const compact=id=>id.replace(/-/g,'');
const newRow=()=>({
 id:NEW_ID,date:"2024-09-28",region:"ME",
 player:KURAMA+" / "+PING,players:[KURAMA,PING],
 playerRaw:KURAMA+" / "+PING,
 event:"Reload Duos Cash Cup (Console)",round:"Event 4 · Round 2 / 賞金決勝",
 rank:5,points:34,matches:6,kills:8,vrs:0,prize:200,teamPrize:200,prizePerPlayer:100,
 kind:"賞金決勝",
 profiles:[{name:KURAMA,url:KURAMA_URL},{name:PING,url:PING_URL}],
 teamAccountIds:[compact(uuid(KURAMA_URL)),compact(uuid(PING_URL))],
 source:REF,verified:true,seasonId:"S31",chapter:5,season:4,tournamentId:T_ID,
 note:"2026-11-15 ユーザー提供スクリーンショット (1863).pngで照合。2024-09-28 JST（ME開催の9/27 UTC）Reload Duos Cash Cup (Console) Event 4 Round 2。5位、34pt、6試合、8K（平均1.33）、0VR。順位賞金チーム$200・各選手$100。本人Epic ID: 1872812e-3050-4d6f-89bc-bd652b1d38d4 / 9766622e-ec65-443f-b8cf-2b860838c19d。出典: "+REF+" 規則: "+RULE
});
const tournament=()=>({
 id:T_ID,name:"Reload Duos Cash Cup (Console)",chapter:5,season:4,seasonId:"S31",
 sourceEventIds:["S31_PlatformReloadDuosCashCupConsole"],
 series:"cash-cup",mode:"reload",subtype:"duos-cash-cup",team:"duo",platform:"console",unknownFields:[],
 evidence:[
  {text:"ユーザー提供の2024/9/28（JST）MEコンソールReloadデュオ決勝Tracker順位表。Event 4 Round 2、5位チーム$200・各選手$100。",url:REF},
  {text:"Epic公式 Reload Platform Duos Cash Cups Chapter 5 Season 4 規則。Console/Reload/Duosと地域別賞金表を確認。",url:RULE}
 ]
});
function patchTaiga(row){
 const next={...row};
 next.date="2026-10-17";
 next.rank=4;next.round="Event 4 · Round 2 / 賞金決勝";
 next.source=TAIGA_SRC;next.profileUrl=TAIGA_PROFILE;next.matches=3;
 next.note="2026-11-15 ユーザー提供スクリーンショット (1864).png と既存サイト誤表記 (1865).pngを照合し、旧表示の2026-10-13 Event 3 決勝・5位を修正。正しくは2026-10-17 NAW Solo Reload Victory Cup Event 4 Round 2 決勝4位、100pt、3試合、19K、1VR、個人賞金$100。本人Epic ID 12485be1-a95b-4dc9-be0b-3ea1425c348a。既存レコードIDを維持して二重登録しない。出典: "+TAIGA_SRC;
 return next;
}
function main(dry){
 const before=readResults(ROOT);
 const all=before.rows;
 const manifest=before.manifest;
 const players=load('players.json'),t=load('tournaments.json');
 const names=new Set(players.candidates.map(c=>c.name));
 for(const name of [KURAMA,PING,"たいが"])assert(names.has(name),"Missing existing canonical player "+name);
 assert.equal(uuid(KURAMA_URL),"1872812e-3050-4d6f-89bc-bd652b1d38d4");
 assert.equal(uuid(PING_URL),"9766622e-ec65-443f-b8cf-2b860838c19d");
 assert.equal(uuid(TAIGA_PROFILE),"12485be1-a95b-4dc9-be0b-3ea1425c348a");
 const matches=all.filter(r=>r.id===FIX_ID);
 assert.equal(matches.length,1,"Taiga existing record must be unique");
 const old=matches[0];
 assert.equal(old.player,"たいが");
 assert.equal(old.region,"NAW");assert.equal(old.seasonId,"S42");
 assert.equal(old.event,"Solo Reload Victory Cup");
 assert.equal(old.kind,"賞金決勝");
 for(const [key,value] of Object.entries({points:100,kills:19,vrs:1,prize:100}))
   assert.equal(old[key],value,"Taiga unchanged "+key);
 const legacy=old.date==="2026-10-13"&&old.rank===5&&
  old.round==="Event 3 · Round 2 / 賞金決勝";
 const correct=old.date==="2026-10-17"&&old.rank===4&&
  old.round==="Event 4 · Round 2 / 賞金決勝";
 assert(legacy||correct,"Unexpected Taiga source changed; investigate before publication");
 const existing=all.filter(r=>r.id===NEW_ID);
 assert(existing.length<=1,"Duplicate new ID");
 const duo=newRow();
 // The exact proof's IDs and cash are part of the release guard.
 assert.equal(duo.teamAccountIds[0],"1872812e30504d6f89bcbd652b1d38d4");
 assert.equal(duo.teamAccountIds[1],"9766622eec65443fb8cf2b860838c19d");
 const duplicate=all.filter(r=>r.region==="ME"&&r.seasonId==="S31"&&
  r.date==="2024-09-28"&&r.event===duo.event&&r.round===duo.round&&
  ((Array.isArray(r.players)&&r.players.some(n=>duo.players.includes(n))) ||
   (Array.isArray(r.teamAccountIds)&&r.teamAccountIds.some(id=>duo.teamAccountIds.includes(id)))));
 assert(duplicate.length===existing.length,"Possible existing ME result duplicate");
 if(existing.length)assert.deepEqual(existing[0],duo,"New record was previously published differently");
 const oldTournament=t.catalog.find(x=>x.id===T_ID);
 if(oldTournament)assert.deepEqual(oldTournament,tournament(),"Unexpected matching catalog definition");
 const updated=all.map(r=>r.id===FIX_ID?patchTaiga(r):r);
 if(!existing.length)updated.push(duo);
 const oldIds=new Set(all.map(x=>x.id));
 assert.equal(new Set(updated.map(x=>x.id)).size,updated.length,"Duplicate ID");
 assert.equal(updated.length,all.length+(existing.length?0:1));
 assert(updated.every(x=>!oldIds.has(x.id)||x.id===FIX_ID||
  JSON.stringify(x)===JSON.stringify(all.find(y=>y.id===x.id))),"Unrelated record mutated");
 assert.equal(updated.filter(r=>r.id===FIX_ID).length,1);
 const report={mode:dry?"DRY_RUN":"APPLY",previousRecords:manifest.count,
  nextRecords:updated.length,taigaBefore:{date:old.date,rank:old.rank,round:old.round},
  taigaAfter:{date:"2026-10-17",rank:4,round:"Event 4 · Round 2 / 賞金決勝"},
  addedDuo:!existing.length?{id:NEW_ID,rank:5,teamPrize:200,individual:100,kills:8}:null};
 if(!dry){
  if(!oldTournament){t.catalog.push(tournament());save('tournaments.json',t)}
  const result=publishResults(ROOT,updated);
  assert.equal(result.count,updated.length);
  assert.deepEqual([...result.changedShards].sort(),["S31","S42"]);
  console.log("SOURCE_PUBLICATION",JSON.stringify(result));
 }
 console.log("SCREENSHOT_RESULT_AUDIT",JSON.stringify(report));
}
if(require.main===module){try{main(process.argv.includes('--dry-run'))}catch(e){console.error(e.stack);process.exitCode=1}}
module.exports={main};
