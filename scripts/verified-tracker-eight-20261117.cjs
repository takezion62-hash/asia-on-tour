'use strict';
// Source-locked user screenshot batch. No payout is inferred beyond official
// event rules and the exact eight selected Tracker results.
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const ROOT=path.resolve(__dirname,'..');
const FILE='data/manual-approvals/20261117-tracker-eight-verified.json';
const HISTORY='data/manual-approvals/20261117-s41-days-promotion-history.json';
const POLICY='user-screenshot-20261117-six-finals';
const hash=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
const load=(name)=>JSON.parse(fs.readFileSync(path.join(ROOT,name),'utf8'));
const RULES={
 S37:'https://www.fortnite.com/competitive/rules-guidelines/rules-library/fortnite-duos-console-victory-cash-cups-chapter-6-season-4-official-rules',
 S39Unreal:'https://www.fortnite.com/competitive/rules-guidelines/rules-library/1-million-dollar-unreal-cup-chapter-7-season-1-official-rules',
 S39Reload:'https://www.fortnite.com/competitive/rules-guidelines/rules-library/fortnite-victory-cups-chapter-7-season-1-official-rules',
 S41:'https://www.fortnite.com/competitive/rules-guidelines/rules-library/days-of-play-playstation-cup-chapter-7-season-3-official-rules'
};
// Index by immutable record ID: event/date/region, named pair, exact rank,
// source team stats, per-team and per-player cash, and both Epic UUIDs.
const PINNED=Object.freeze({
 'manual-s37-oce-console-duos-20250920-chikara-rura':
 ['S37','2025-09-20','OCE','ch6s4-console-duos-victory','S37_ConsoleDuosCashCups','S37_ConsoleDuosCashCups_Event5Round2_OCE','Event 5 · Round 2 / 賞金決勝','ちからV2','Rura',9,100,9,1,2,200,100,'2512ed089c99409fb69d2cc3de7c35c6','d5e9dc74c49e4825bd81a9d69056c683'],
 'manual-s37-oce-console-duos-20250831-chikara-rura':
 ['S37','2025-08-31','OCE','ch6s4-console-duos-victory','S37_ConsoleDuosCashCups','S37_ConsoleDuosCashCups_Event3Round2_OCE','Event 3 · Round 2 / 賞金決勝','ちからV2','Rura',1,200,17,2,3,400,200,'2512ed089c99409fb69d2cc3de7c35c6','d5e9dc74c49e4825bd81a9d69056c683'],
 'manual-s39-naw-unreal-20251221-mofu-rinneman':
 ['S39','2025-12-21','NAW','ch7s1-one-million-unreal-cup','S39_1MillionUnrealCup','S39_1MillionUnrealCup_NAW','Session 1 / 賞金決勝','Mofu','りんねまん',209,273,38,1,9,100,50,'b78631905b9847c38d347af8ea94d4b5','cf6f3adc475546118b18cf1b7101c8b5'],
 'manual-s39-naw-unreal-20251221-raeyache-naokin':
 ['S39','2025-12-21','NAW','ch7s1-one-million-unreal-cup','S39_1MillionUnrealCup','S39_1MillionUnrealCup_NAW','Session 1 / 賞金決勝','Raeyache','なおきん',221,272,47,1,10,100,50,'50e40200155b4c9a8f4e0fb4335796df','d3519730e79e4727af4edf9ba4422463'],
 'manual-s39-naw-unreal-20251221-toax-jagareet':
 ['S39','2025-12-21','NAW','ch7s1-one-million-unreal-cup','S39_1MillionUnrealCup','S39_1MillionUnrealCup_NAW','Session 1 / 賞金決勝','とあっくす','Jagareet',218,272,22,2,10,100,50,'6c0186bd1aea4369b8f4b5ea5d76f8b3','982b0f991952475d9bfd79cd3e74b242'],
 'manual-s39-oce-reload-duos-20251207-mofu-rinneman':
 ['S39','2025-12-07','OCE','ch7s1-reload-duos-victory','S39_ReloadCashVictoryCup_Dec','S39_ReloadCashVictoryCup_Event1Round2_mg_OCE','Event 1 · Round 2 / 賞金決勝','Mofu','りんねまん',13,100,7,1,3,200,100,'b78631905b9847c38d347af8ea94d4b5','cf6f3adc475546118b18cf1b7101c8b5']
});
const PINNED_S41=Object.freeze({
 'auto-s41-8f7f939170b8':['ちからV2','NEXUS ちからV2ǃ',93,3,1,0,4],
 'auto-s41-dac735a621e2':['Mofu','RC MOFU 16ǃ',98,0,0,0,1]
});
function must(ok,msg){if(!ok)throw Error('EIGHT_SCREENSHOT_PROOF '+msg);}
function source(s){
 return 'https://fortnitetracker.com/events/epicgames_'+s.eventId+'_'+s.region+
  '?window='+s.windowId;
}
function profileId(p){
 try {
  const u=new URL(p.url);
  if(u.protocol!=='https:'||u.hostname!=='fortnitetracker.com'||
   !u.pathname.startsWith('/profile/all/'))return null;
  const id=u.searchParams.get('id')?.toLowerCase();
  return /^[a-f0-9-]{36}$/.test(id||'')?id.replace(/-/g,''):null;
 }catch{return null}
}
function verifyProof(doc){
 must(doc?.version===1&&doc.receivedOn==='2026-11-17'&&
  Array.isArray(doc.newResults)&&doc.newResults.length===6&&
  Array.isArray(doc.corrections)&&doc.corrections.length===2,'wrong proof version/count');
 must(JSON.stringify(doc.rules)===JSON.stringify(RULES),'official source URL changed');
 must(new Set(doc.newResults.map(s=>s.id)).size===6&&
  Object.keys(PINNED).every(id=>doc.newResults.some(s=>s.id===id)),'unrecognized or repeated final');
 for(const s of doc.newResults){
  const pin=PINNED[s.id];
  must(pin&&s.players?.length===2&&s.raw?.length===2,'roster missing: '+s.id);
  const actual=[s.seasonId,s.date,s.region,s.tournamentId,s.eventId,s.windowId,s.round,
   s.players[0].name,s.players[1].name,s.rank,s.points,s.kills,s.vrs,s.matches,
   s.teamUSD,s.eachUSD,profileId(s.players[0]),profileId(s.players[1])];
  must(JSON.stringify(actual)===JSON.stringify(pin),'source-locked score/identity mutated: '+s.id);
  must(s.raw.every(x=>typeof x==='string'&&x.trim()),'raw name missing: '+s.id);
  must(s.teamUSD===s.eachUSD*2,'cash share not split exactly: '+s.id);
  must(s.vrs<=s.matches&&s.matches>0&&s.matches<=(s.rule==='S39Unreal'?10:3),
   'match cap invalid: '+s.id);
  must((s.rule==='S39Unreal'&&s.rank>=201&&s.rank<=500&&s.teamUSD===100)||
   ((s.rule==='S37'||s.rule==='S39Reload')&&
    s.points===100*s.vrs&&s.teamUSD===200*s.vrs),'official payout invalid: '+s.id);
 }
 must(Object.keys(PINNED_S41).every(id=>doc.corrections.some(s=>s.id===id)),'S41 target missing');
 for(const s of doc.corrections){
  const pin=PINNED_S41[s.id];
  must(pin&&s.seasonId==='S41'&&s.date==='2026-06-11'&&s.region==='NAC'&&
   s.tournamentId==='ch7s3-days-of-play-playstation-cup-br'&&
   s.eventId==='S41_PSCupDaysOfPlay'&&s.windowId==='S41_PSCupDaysOfPlay_Final_NAC'&&
   s.rule==='S41'&&s.prizeUSD===50&&
   JSON.stringify([s.player,s.raw,s.rank,s.points,s.kills,s.vrs,s.matches])===JSON.stringify(pin),
   'S41 prize or source changed: '+s.id);
 }
 return true;
}
const proof=load(FILE);
verifyProof(proof);
function expectedNew(s,catalog){
 must(catalog?.id===s.tournamentId&&catalog.name&&catalog.team==='duo'&&
  catalog.seasonId===s.seasonId&&catalog.sourceEventIds.includes(s.eventId),
  'tournament mismatch for '+s.id);
 const members=s.players.map(p=>p.name),ids=s.players.map(profileId);
 return {
  id:s.id,date:s.date,region:s.region,player:members.join(' / '),
  players:members,playerRaw:s.raw.join(' / '),event:catalog.name,round:s.round,
  rank:s.rank,points:s.points,kills:s.kills,vrs:s.vrs,prize:s.teamUSD,
  teamPrize:s.teamUSD,prizePerPlayer:s.eachUSD,kind:'賞金決勝',
  matches:s.matches,seasonId:s.seasonId,chapter:catalog.chapter,
  season:catalog.season,tournamentId:s.tournamentId,source:source(s),
  profiles:s.players.map(p=>({name:p.name,url:p.url})),teamAccountIds:ids,
  verified:true,
  note:'2026/11/17ユーザー提供Fortnite Tracker画像（'+s.image+'）と2名のEpic IDで照合。'+
   s.date+' '+s.region+' '+catalog.name+'：'+s.rank+'位・'+s.points+'pt・'+
   s.matches+'試合・チーム'+s.kills+'キル・'+s.vrs+'VR。'+
   'Epic公式規則に基づきチーム賞金$'+s.teamUSD+'・各選手$'+s.eachUSD+
   '。受給資格・支払完了は未確認。規則: '+RULES[s.rule]
 };
}
function expectedCorrection(before,s,catalog){
 must(before?.id===s.id&&before.kind==='参加確認'&&before.prize===null&&
  before.verified===true&&before.reviewOnly!==true&&
  before.seasonId==='S41'&&before.date===s.date&&before.region===s.region&&
  before.player===s.player&&before.playerRaw===s.raw&&
  before.tournamentId===s.tournamentId&&before.event===catalog?.name&&
  before.round==='Final / 参加確認'&&
  [before.rank,before.points,before.kills,before.vrs,before.matches].every((x,i)=>
    x===[s.rank,s.points,s.kills,s.vrs,s.matches][i])&&
  before.source==='https://www.fortnite.com/competitive/events/S41_PSCupDaysOfPlay/?region=NAC&round=S41_PSCupDaysOfPlay_Final_NAC',
  'S41 pre-correction source differs: '+s.id);
 return {...before,round:'Session 1 · Round 2 / 賞金決勝',
  kind:'賞金決勝',prize:s.prizeUSD,
  note:'2026/11/17ユーザー提供Fortnite Tracker画像（'+s.image+'）・元のEpic本人ID照合済み記録を再確認。'+
   '2026/6/11 NAC Days of Play PlayStation Cup BR決勝'+s.rank+'位・'+s.points+
   'pt・'+s.matches+'試合・'+s.kills+'キル。Epic公式Attachment CのNAC76〜100位＝個人$50により'+
   '賞金$50へ訂正。元の参加記録ID、順位・本人情報を保持。支払完了は未確認。規則: '+RULES.S41};
}
function newEntry(record,s){
 return {id:record.id,recordId:record.id,decision:'published',policy:POLICY,
  approvedAt:'2026-11-17T09:51:23Z',approvedBy:'ChatGPT / authorized owner screenshot audit',
  source:record.source,rule:RULES[s.rule],evidence:'User screenshot '+s.image+
   ' original Tracker Epic UUID pair and official Epic payout rule'};
}
function verifyNewRow(r,entry){
 const s=proof.newResults.find(s=>s.id===r?.id);
 if(!s||entry?.id!==r.id||entry.recordId!==r.id||
  entry.policy!==POLICY||entry.decision!=='published')return false;
 const catalog=load('tournaments.json').catalog.find(c=>c.id===s.tournamentId);
 return JSON.stringify(expectedNew(s,catalog))===JSON.stringify(r)&&
  entry.source===r.source&&entry.rule===RULES[s.rule]&&r.verified===true;
}
function verifyS41Promotion(r,entry){
 if(entry?.policy!=='attendance-only'||entry.id!==r?.id||
  entry.recordId!==r.id||entry.source!==r.source)return false;
 const s=proof.corrections.find(s=>s.id===r.id);
 if(!s)return false;
 let h;
 try {h=load(HISTORY).entries.find(x=>x.id===r.id)}catch{return false}
 if(!h||h.id!==r.id||h.originalPolicy!==entry.policy||
  h.beforeSha256!==hash(h.before)||h.afterSha256!==hash(r))return false;
 try {
  const catalog=load('tournaments.json').catalog.find(c=>c.id===s.tournamentId);
  return JSON.stringify(expectedCorrection(h.before,s,catalog))===JSON.stringify(r);
 }catch{return false}
}
module.exports={POLICY,FILE,HISTORY,RULES,proof,verifyProof,profileId,source,
 expectedNew,expectedCorrection,newEntry,verifyNewRow,verifyS41Promotion,hash};
