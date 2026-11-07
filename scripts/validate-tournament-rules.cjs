'use strict';
const fs=require('node:fs'),path=require('node:path');
const REGIONS=new Set(['ME','EU','NAC','NAW','OCE','BR']);
const TEAMS=new Set(['solo','duo','trio','squad']);
const URL_HOSTS=new Set(['fortnite.com','www.fortnite.com']);
const positive=x=>Number.isSafeInteger(x)&&x>0;
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
function validateRegistry(doc,tournaments){
 const errors=[];
 const fail=(id,message)=>errors.push(id+': '+message);
 if(!object(doc)||doc.version!==1||!Array.isArray(doc.rules))return ['rules document: version:1 と rules 配列が必要です'];
 if(!Array.isArray(tournaments?.catalog))return ['tournaments catalog unavailable'];
 const catalog=new Map(tournaments.catalog.map(x=>[x.id,x])),known=new Set();
 for(const rule of doc.rules){
  const id=String(rule?.id||'missing');
  if(known.has(id))fail(id,'大会IDが重複');known.add(id);
  const t=catalog.get(id);
  if(!t){fail(id,'登録済み大会カタログにありません');continue}
  if(rule.seasonId!==t.seasonId||rule.team!==t.team||rule.series!==t.series)fail(id,'シーズン/チーム/シリーズが一致しません');
  if(!['victory-cup','skin-cup'].includes(rule.series))fail(id,'許可されない自動判定シリーズです');
  if(!Array.isArray(rule.eventIds)||!rule.eventIds.length||new Set(rule.eventIds).size!==rule.eventIds.length||
      rule.eventIds.some(x=>typeof x!=='string'||!t.sourceEventIds.includes(x)))fail(id,'EpicイベントIDがカタログと不一致');
  if(!TEAMS.has(rule.team))fail(id,'チーム形式が不正');
  let url;
  try{url=new URL(rule.source)}catch{}
  if(!url||url.protocol!=='https:'||!URL_HOSTS.has(url.hostname)||url.username||url.password||url.hash)fail(id,'Epic公式規則URLが不正');
  if(!object(rule.matchCaps)||!Object.keys(rule.matchCaps).length||
     Object.entries(rule.matchCaps).some(([name,value])=>!['予選','賞金決勝','スキン大会'].includes(name)||!positive(value)||value>40))fail(id,'公式試合数上限が不正');
  if(rule.series==='victory-cup'){
   if(!positive(rule.matchCaps?.['予選'])||!positive(rule.matchCaps?.['賞金決勝']))fail(id,'Victory Cupの予選/決勝試合数上限が不足');
   if(!object(rule.advance)||!Object.keys(rule.advance).length||
      Object.entries(rule.advance).some(([region,value])=>!REGIONS.has(region)||!positive(value)))fail(id,'地域別予選通過順位が不正');
   if(rule.cosmeticRanks!==undefined)fail(id,'Victory Cupにスキン順位は登録不可');
   if(rule.prizePerVictory!==undefined&&(!positive(rule.prizePerVictory)||rule.prizePerVictory>10000))fail(id,'VR賞金単価が不正');
  }else if(rule.series==='skin-cup'){
   if(!positive(rule.matchCaps?.['スキン大会']))fail(id,'スキン大会の試合数上限が必要');
   if(!positive(rule.chapter)||!positive(rule.season)||rule.chapter!==t.chapter||rule.season!==t.season)fail(id,'チャプター/シーズン不一致');
   if(!object(rule.cosmeticRanks)||!Object.keys(rule.cosmeticRanks).length||
      Object.entries(rule.cosmeticRanks).some(([region,value])=>!REGIONS.has(region)||!positive(value)))fail(id,'スキン獲得順位が不正');
   if(rule.prizePerVictory!==undefined||rule.advance!==undefined)fail(id,'スキン大会に現金賞金や予選通過を混在させないでください');
  }
 }
 return errors;
}
function main(){
 const root=path.resolve(__dirname,'..');
 const doc=JSON.parse(fs.readFileSync(path.join(root,'tournament-rules.json'),'utf8'));
 const tournaments=JSON.parse(fs.readFileSync(path.join(root,'tournaments.json'),'utf8'));
 const errors=validateRegistry(doc,tournaments);
 if(errors.length){console.error('大会ルール検証失敗:\n'+errors.join('\n'));process.exitCode=1;return}
 console.log('大会ルールマスター検証成功: '+doc.rules.length+'大会 / '+tournaments.catalog.length+'登録大会');
}
if(require.main===module)main();
module.exports={validateRegistry};
