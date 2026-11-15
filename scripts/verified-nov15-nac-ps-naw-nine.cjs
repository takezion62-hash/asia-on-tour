'use strict';
// Immutable independent screenshot oracle for Nov 15 NAC/NAW finals and exact prize upgrade.
// The proof file supplies raw links; these independent tuples lock identities and totals.
const POLICY='verified-20261115-nac-s29-ps-s36-naw-s37-nine';
const FIXED=Object.freeze([
 ['s29-nac-zb-duos-vc-final-20240404-nannan-svbl','S29','2024-04-04','NAC',20,100,3,21,1,200,'0d2e7fb9-8aa4-4856-a166-def24e79da5b','469d92dc-f57e-46fc-b229-382e77bb6f4f'],
 ['s29-nac-zb-duos-vc-final-20240404-kurama-p1ng','S29','2024-04-04','NAC',67,100,3,12,1,200,'1872812e-3050-4d6f-89bc-bd652b1d38d4','9766622e-ec65-443f-b8cf-2b860838c19d'],
 ['s29-nac-zb-duos-vc-final-20240404-prurun-asfa','S29','2024-04-04','NAC',84,100,3,10,1,200,'e1dd57b9-f3df-41c7-9201-9b37c3e1c744','ec619db3-75ab-4f3a-8c80-2ec2d6c71e2b'],
 ['s29-nac-zb-duos-vc-final-20240404-shikaneki-senokuru','S29','2024-04-04','NAC',91,100,3,8,1,200,'4facdfb7-6707-4318-81c8-7252b7a51c59','ac40f786-8a1d-4309-b917-7e004095107c'],
 ['auto-s36-05defadba950','S36','2025-07-27','NAC',88,19,5,0,0,240,'9766622e-ec65-443f-b8cf-2b860838c19d'],
 ['s37-naw-console-duos-final-20251026-kumafv-chromeret','S37','2025-10-26','NAW',10,100,3,5,1,200,'5aa76ea4-2a16-4e4e-ac2a-e3da5a0d8ed2','acc1707b-9b94-4b90-95fe-b41eda87ee75'],
 ['s37-naw-console-duos-final-20251026-piitako-gerbera','S37','2025-10-26','NAW',12,100,2,3,1,200,'6ecdddc1-b766-4695-9d49-d76b778f7660','a56d84b6-fc14-4b5c-b47b-0a0ddd7ccfb1'],
 ['s37-naw-console-duos-final-20251026-seljuny-p1ng','S37','2025-10-26','NAW',13,100,3,4,1,200,'1e2bd6cc-1261-4993-9286-42aed3d4f1e4','9766622e-ec65-443f-b8cf-2b860838c19d'],
 ['s37-naw-console-duos-final-20251026-mat4dor-hakkun','S37','2025-10-26','NAW',14,100,3,3,1,200,'17b382b1-e9be-42a1-b8d5-b961c04fa963','63826005-a9c2-4444-b113-589813cde1d8']
].map(x=>Object.freeze(x)));
const {targets:TARGETS}=require('../data/manual-approvals/20261115-nac-s29-ps-s36-naw-s37-nine-proof.json').batch;
const RULES=Object.freeze({
 S29:'https://www.fortnite.com/news/victory-cash-cups-chapter-5-season-2-official-rules',
 S36:'https://www.fortnite.com/news/playstation-cup-chapter-6-season-3-official-rules',
 S37:'https://www.fortnite.com/competitive/rules-guidelines/rules-library/fortnite-duos-console-victory-cash-cups-chapter-6-season-4-official-rules'
});
function uuid(value){try{const u=new URL(value),id=u.searchParams.get('id');
 return u.origin==='https://fortnitetracker.com'&&u.pathname.startsWith('/profile/all/')&&
 /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(id||'')?id.toLowerCase():null;
}catch{return null}}
function expected(t){
 const f=FIXED.find(x=>x[0]===t?.id);
 if(!f||!t||t.seasonId!==f[1]||t.date!==f[2]||t.region!==f[3]||
    t.rank!==f[4]||t.points!==f[5]||t.matches!==f[6]||
    t.kills!==f[7]||t.vrs!==f[8]||t.prize!==f[9]||
    t.prizePerPlayer*t.players.length!==f[9]||
    t.profiles?.length!==f.length-10||
    !t.profiles.every((p,i)=>p.name===t.players[i]&&uuid(p.url)===f[10+i]&&p.id===f[10+i]))return false;
 const known={
  S29:['ch5s2-zero-build-duos-victory-cup','Zero Build Duos Victory Cup','S29_DuosZBVictoryCashCup','S29_DuosZBVictoryCashCup_Event5Round2_NAC','Event 5 · Round 2 / 賞金決勝',5,2],
  S36:['ch6s3-playstation-cup','PlayStation Cup','S36_PlayStationCup','S36_PlayStationCup_Final_NAC','Final / 賞金決勝',6,3],
  S37:['ch6s4-console-duos-victory','Duos Console Victory Cash Cup','S37_ConsoleDuosCashCups','S37_ConsoleDuosCashCups_Event10Round2_NAW','Event 10 · Round 2 / 賞金決勝',6,4]
 }[t.seasonId];
 if(!known||[t.tournamentId,t.event,t.eventId,t.windowId,t.round,t.chapter,t.season].some((v,i)=>v!==known[i])||
    t.rule!==RULES[t.seasonId]||
    t.sourceTracker!=='https://fortnitetracker.com/events/epicgames_'+t.eventId+'_'+t.region+'?window='+t.windowId)return false;
 if(t.seasonId==='S36')return t.players.length===1&&t.playerRaw==='boltzZzero0oǃ'&&
   t.originalKind==='参加確認'&&t.originalRound==='Final / 参加確認'&&
   t.originalPrize===null&&t.originalSource==='https://www.fortnite.com/competitive/events/S36_PlayStationCup/?region=NAC&round=S36_PlayStationCup_Final_NAC'&&t.prize===240;
 return t.players.length===2&&t.points===100*t.vrs&&t.vrs===1&&t.prize===200;
}
function verifyRow(r,entry){
 const t=TARGETS.find(x=>x.id===r?.id);
 if(!expected(t)||!r||!entry||entry.id!==r.id||entry.recordId!==r.id||
    entry.policy!==POLICY||entry.decision!=='published'||entry.rule!==t.rule||
    r.source!==entry.source||r.kind!=='賞金決勝'||r.verified!==true||r.reviewOnly===true)return false;
 for(const k of ['id','date','region','seasonId','chapter','season','tournamentId','event','round','rank','points','matches','kills','vrs','prize','prizePerPlayer','playerRaw'])
  if(r[k]!==t[k])return false;
 if(r.teamPrize!==t.prize||r.player!==t.players.join(' / ')||
    JSON.stringify(r.players)!==JSON.stringify(t.players)||
    r.profiles?.length!==t.profiles.length||r.teamAccountIds?.length!==t.players.length||
    !r.profiles.every((p,i)=>p.name===t.players[i]&&uuid(p.url)===t.profiles[i].id)||
    !r.teamAccountIds.every((id,i)=>id===t.profiles[i].id.replace(/-/g,'')))return false;
 if(t.seasonId==='S36'){
  if(r.source!==t.originalSource||r.profileUrl!==t.profiles[0].url)return false;
 }else if(r.source!==t.sourceTracker||r.profileUrl)return false;
 return typeof r.note==='string'&&r.note.includes(t.sourceTracker)&&
  r.note.includes(t.rule)&&r.note.includes(t.screenshot)&&
  r.note.includes(t.players.length===1?'個人$240':'各選手$100');
}
module.exports={POLICY,TARGETS,FIXED,RULES,uuid,expected,verifyRow};
