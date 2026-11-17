'use strict';
// Source-locked, explicit one-time review of exactly 37 May 2025 S35 console
// duos candidates and one S37 OCE 0VR final. No generic team auto-payout.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const file='data/manual-approvals/20261118-verified-duo-rulebacked-38.json';
const POLICY='verified-s35-s37-duos-source-review-20261118';
const read=x=>JSON.parse(fs.readFileSync(path.join(root,x),'utf8'));
const manifest=read(file);
const RULES=Object.freeze({
 S35:'https://www.fortnite.com/news/fortnite-duos-console-victory-cash-cups-may-2025-official-rules',
 S37:'https://www.fortnite.com/competitive/rules-guidelines/rules-library/fortnite-duos-console-victory-cash-cups-chapter-6-season-4-official-rules'
});
const hash=o=>crypto.createHash('sha256').update(JSON.stringify(o)).digest('hex');
const must=(v,msg)=>{if(!v)throw Error('BULK_S35_S37_'+msg)};
function ruleFor(original,rulebook){
 const expected=original.seasonId==='S35'?
  {id:'ch6s2-console-duos-victory',event:'S35_VictoryDuosCup',region:'ME'}:
  {id:'ch6s4-console-duos-victory',event:'S37_ConsoleDuosCashCups',region:'OCE'};
 const r=rulebook.rules.find(x=>x.id===expected.id);
 must(r&&original.tournamentId===expected.id&&original.region===expected.region&&
  original.seasonId in RULES&&r.seasonId===original.seasonId&&
  r.team==='duo'&&r.series==='victory-cup'&&
  JSON.stringify(r.eventIds)===JSON.stringify([expected.event])&&
  r.matchCaps['予選']===7&&r.matchCaps['賞金決勝']===3&&
  r.advance[expected.region]===250&&
  r.prizePerVictory===100&&r.teamPrizePerVictory===200&&
  r.source===RULES[original.seasonId],'official rule/region/cash mismatch '+original.id);
 return r;
}
function validateManifest(){
 must(manifest.version===1&&manifest.reviewedOn==='2026-11-18'&&
  JSON.stringify(manifest.officialRules)===JSON.stringify(RULES)&&
  Array.isArray(manifest.rows)&&manifest.rows.length===38,'proof list differs');
 const ids=new Set();let nQual=0,nZero=0,nCash=0;
 for(const x of manifest.rows){
  must(/^auto-s(?:35|37)-[a-f0-9]{12}$/.test(x.id)&&!ids.has(x.id),'unexpected/duplicate ID '+x.id);ids.add(x.id);
  must(x.verified===true&&x.prize===(x.kind==='予選'?0:null)&&
   Array.isArray(x.players)&&x.players.length===2&&x.player===x.players.join(' / ')&&
   Array.isArray(x.teamAccountIds)&&x.teamAccountIds.length===2&&
   new Set(x.teamAccountIds).size===2&&
   x.teamAccountIds.every(id=>/^[a-f0-9]{32}$/.test(id)),'saved Epic roster missing '+x.id);
  must(x.region===(x.seasonId==='S35'?'ME':'OCE')&&
    Number.isSafeInteger(x.rank)&&x.rank>0&&Number.isSafeInteger(x.matches)&&
    x.matches>=1&&x.matches<=(x.kind==='予選'?7:3)&&
    Number.isSafeInteger(x.points)&&x.points>=0&&
    Number.isSafeInteger(x.kills)&&x.kills>=0&&
    Number.isSafeInteger(x.vrs)&&x.vrs>=0&&x.vrs<=x.matches,'invalid score '+x.id);
  if(x.seasonId==='S37')must(x.kind==='賞金決勝'&&x.date==='2025-08-31'&&
    x.rank===207&&x.vrs===0&&x.kills===1&&x.points===0,'S37 pin mismatch');
  if(x.kind==='予選'){nQual++;must(x.seasonId==='S35'&&x.round.includes('Round 1'),'S35 qualifier scope');}
  else{
   must(x.round.includes('Round 2')&&x.points===x.vrs*100,'final score mismatch');
   if(x.vrs>0){nCash++;must(x.seasonId==='S35'&&x.rank===10&&x.vrs===1&&x.player==='asvaswgernb / Teddy','positive cash winner differs');}
   else nZero++;
  }
 }
 must(nQual===19&&nZero===18&&nCash===1,'expected exact 19 qualifier+18 zero finals+1 cash final');
 return true;
}
function scoreRecord(original,rulebook,tournaments){
 const rule=ruleFor(original,rulebook);
 const catalog=tournaments.catalog.find(x=>x.id===rule.id);
 must(catalog?.name===original.event&&catalog.seasonId===original.seasonId&&
   catalog.team==='duo'&&catalog.sourceEventIds.includes(rule.eventIds[0]),'catalog differs');
 const {reviewReason,reviewOnly,teamAccountIds,note,...base}=original;
 if(original.kind==='予選'){
  const qualified=original.rank<=rule.advance[original.region];
  return {...base,kind:qualified?'予選':'参加確認',prize:0,
   round:original.round.replace(/\/\s*予選$/,qualified?'/ 予選突破':'/ 参加確認'),
   note:'2026/11/18 保存済みEpic公式Round1順位表と2名のEpic IDで確認。'+
    original.region+'上位'+rule.advance[original.region]+'組が決勝進出。'+
    '本人の'+original.rank+'位は'+(qualified?'突破範囲内。':'突破範囲外の参加確認。')+
    '予選賞金$0。Round2成績・受賞は未認定。規則: '+rule.source};
 }
 must(original.kind==='賞金決勝'&&original.points===original.vrs*100,'unsupported final');
 const prize=original.vrs*200;
 return {...base,kind:'賞金決勝',prize,teamPrize:prize,prizePerPlayer:prize/2,
  note:'2026/11/18 保存済みEpic公式Round2順位表の最終'+original.rank+'位・'+
   original.matches+'試合・チーム'+original.kills+'K・'+original.vrs+'VRを2名のEpic IDで確認。'+
   '公式賞金は1VRにつきチーム$200・各選手$100。'+
   'チーム賞金$'+prize+'、個人各$'+(prize/2)+'。資格確認・支払完了は未確認。規則: '+rule.source};
}
function approvalEntry(original,record){
 return {id:record.id,recordId:record.id,decision:'published',policy:POLICY,
  approvedAt:'2026-11-18T00:00:00Z',approvedBy:'ChatGPT / owner-authorized original Epic scoreboard review',
  source:record.source,rule:RULES[record.seasonId],
  candidateSha256:hash(original),recordSha256:hash(record),
  evidence:'Exact saved original Epic leaderboard candidate, two player account UUIDs, official session and May 2025 Victory/qualifier conditions'};
}
function verifyPublished(row,entry){
 try{
  if(!row||!entry||entry.policy!==POLICY||entry.id!==row.id||
   entry.recordId!==row.id||entry.decision!=='published'||
   entry.source!==row.source||entry.rule!==RULES[row.seasonId]||
   row.verified!==true)return false;
  const original=manifest.rows.find(x=>x.id===row.id);
  if(!original||entry.candidateSha256!==hash(original)||entry.recordSha256!==hash(row))return false;
  return JSON.stringify(scoreRecord(original,read('tournament-rules.json'),read('tournaments.json')))===JSON.stringify(row);
 }catch{return false}
}
validateManifest();
module.exports={RULES,POLICY,manifest,hash,validateManifest,ruleFor,scoreRecord,approvalEntry,verifyPublished};
