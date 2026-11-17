'use strict';
// Immutable, user-supplied screenshot evidence for exactly five S37 Console
// Duos Victory Cash Cup Round 2 awards, two Epic-profile UUIDs per team.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const POLICY='verified-s37-console-five-tracker-20261117';
const FILE='data/manual-approvals/20261117-s37-console-duos-five.json';
const RULE='https://www.fortnite.com/competitive/rules-guidelines/rules-library/fortnite-duos-console-victory-cash-cups-chapter-6-season-4-official-rules';
const EID='S37_ConsoleDuosCashCups',TID='ch6s4-console-duos-victory';
const must=(v,m)=>{if(!v)throw Error('S37_CONSOLE_FIVE: '+m)};
const accountId=url=>{
 try {
  const u=new URL(url);
  if(u.protocol!=='https:'||u.hostname!=='fortnitetracker.com'||!u.pathname.startsWith('/profile/all/'))return null;
  const id=u.searchParams.get('id')?.toLowerCase();
  return /^[0-9a-f-]{36}$/.test(id||'')?id.replace(/-/g,''):null;
 }catch{return null}
};
const PIN=Object.freeze({
 'manual-s37-naw-console-duos-20250915-r8-rakua-kmyt':
  [1899,'2025-09-15','NAW',4,8,100,12,1,3,'rakua','FPG rakua 7','25bcf8f370b842cf8c1f214420cfc594','kmyt','やまもと そうし','280bea94ac754668b69c31752624fb04'],
 'manual-s37-naw-console-duos-20250915-r9-aoneko-mofu':
  [1900,'2025-09-15','NAW',4,9,100,6,1,2,'あおねこ','Celis あおねこ416','32fab8de7cd041a1aa87fabf285e40f0','Mofu','Mofu','b78631905b9847c38d347af8ea94d4b5'],
 'manual-s37-naw-console-duos-20250915-r10-pegu-firu':
  [1901,'2025-09-15','NAW',4,10,100,6,1,2,'Pegu','pegu','4988cefe843f4a6bb6a86f8c3b1daafa','ふぃる','ポルターガイストǃ','b8ee0fe8a5744c3ca37bb746388064ec'],
 'manual-s37-naw-console-duos-20250915-r14-dynamic-bot':
  [1902,'2025-09-15','NAW',4,14,100,4,1,3,'DynamicCart1801','DynamicCart1801','77e63d1aa5324bfe9ff4fa01c875aa73','Botえもん','Botえもん','d25771154c6443f1902090eccc1097e1'],
 'manual-s37-oce-console-duos-20251025-r4-mofu-macaron':
  [1903,'2025-10-25','OCE',10,4,100,5,1,1,'Mofu','Mofu','b78631905b9847c38d347af8ea94d4b5','モバイル勢のまかろん','モバイル勢のまかろん','facede25f8fd4f47be4decb0796abd33']
});
const proof=read(FILE);
function validateProof(doc=proof){
 must(doc.version===1&&doc.checkedAt==='2026-11-17'&&doc.rulesUrl===RULE&&
  Array.isArray(doc.rows)&&doc.rows.length===5,'proof format/rule/quantity changed');
 const seen=new Set();
 for(const p of doc.rows){
  const v=PIN[p.id];
  must(v&&!seen.has(p.id),'unexpected/repeated record '+p.id);seen.add(p.id);
  must(p.seasonId==='S37'&&p.tournamentId===TID&&p.eventId===EID&&
    p.windowId===EID+'_Event'+p.roundNo+'Round2_'+p.region&&
    p.teamPrizeUSD===200&&p.perPlayerUSD===100&&
    Array.isArray(p.members)&&p.members.length===2,'unsupported source window/award '+p.id);
  const fields=[p.image,p.date,p.region,p.roundNo,p.rank,p.points,p.kills,p.vrs,p.matches,
   p.members[0].name,p.members[0].raw,accountId(p.members[0].url),
   p.members[1].name,p.members[1].raw,accountId(p.members[1].url)];
  must(JSON.stringify(fields)===JSON.stringify(v),'screenshot-locked points/kill/cash/identity differ '+p.id);
  must(p.vrs===1&&p.points===100&&p.matches<=3&&p.matches>=1,'official 1 VR award invalid '+p.id);
 }
 must(seen.size===Object.keys(PIN).length,'unregistered screenshot');
 return true;
}
validateProof();
function source(p){
 return 'https://fortnitetracker.com/events/epicgames_'+EID+'_'+p.region+'?window='+p.windowId;
}
function expected(p,tournament){
 must(tournament?.id===TID&&tournament.seasonId==='S37'&&
  tournament.chapter===6&&tournament.season===4&&tournament.team==='duo'&&
  tournament.sourceEventIds?.includes(EID),'wrong tournament catalog '+p.id);
 const names=p.members.map(x=>x.name);
 const raw=p.members.map(x=>x.raw);
 return {
  id:p.id,date:p.date,region:p.region,player:names.join(' / '),players:names,
  playerRaw:raw.join(' / '),event:tournament.name,
  round:'Event '+p.roundNo+' · Round 2 / 賞金決勝',rank:p.rank,
  points:p.points,kills:p.kills,vrs:p.vrs,matches:p.matches,
  prize:200,teamPrize:200,prizePerPlayer:100,kind:'賞金決勝',
  seasonId:'S37',chapter:6,season:4,tournamentId:TID,
  source:source(p),
  profiles:p.members.map(x=>({name:x.name,url:x.url})),
  teamAccountIds:p.members.map(x=>accountId(x.url)),
  verified:true,
  note:'2026/11/17ユーザー提供Fortnite Trackerスクリーンショット（'+p.image+
   '）と両選手のEpic IDを照合。'+p.date+' '+p.region+
   ' Duos Console Victory Cash Cup Event '+p.roundNo+'決勝：'+p.rank+
   '位・100pt・'+p.matches+'試合・チーム'+p.kills+
   'キル・1VR。Epic公式規則の1VR＝チーム$200・個人各$100を適用。'+
   '支払い完了は未確認。規則: '+RULE
 };
}
function historyEntry(r){
 return {id:r.id,recordId:r.id,decision:'published',policy:POLICY,
  approvedAt:'2026-11-17T11:18:55Z',approvedBy:'ChatGPT / user-authorized screenshot evidence',
  source:r.source,rule:RULE,
  evidence:'User-supplied Tracker screenshot and exact two profile UUIDs, score and 1VR payout'};
}
function verifyPublished(r,entry){
 try{
  if(!r||!entry||entry.id!==r.id||entry.recordId!==r.id||
   entry.decision!=='published'||entry.policy!==POLICY||
   entry.source!==r.source||entry.rule!==RULE||r.verified!==true)return false;
  const src=proof.rows.find(x=>x.id===r.id);
  if(!src)return false;
  return JSON.stringify(r)===JSON.stringify(expected(src,
    read('tournaments.json').catalog.find(x=>x.id===TID)));
 }catch{return false}
}
module.exports={POLICY,FILE,RULE,EID,TID,PIN,proof,accountId,validateProof,source,expected,historyEntry,verifyPublished};
