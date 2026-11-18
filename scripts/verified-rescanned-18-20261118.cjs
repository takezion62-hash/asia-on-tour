'use strict';
// Immutable source re-fetch of exactly 18 Epic original-account records.
// The pinned 12-page evidence does not imply the entire leaderboard is complete.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const ROOT=path.resolve(__dirname,'..');
const FILE='data/manual-approvals/20261118-targeted-18-original-epic-proof.json';
const bytes=fs.readFileSync(path.join(ROOT,FILE));
const blobSha=crypto.createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
const EXPECTED_BLOB='4e5686b6aba03339924d306680a8be07a647a56d';
const proof=JSON.parse(bytes.toString('utf8'));
const POLICY='verified-original-epic-followup-18-20261118';
const IDS=["auto-s30-a103643641b1","auto-s30-70b7ad18f5c9","auto-s30-5d3c621cca4f","auto-s30-c5a4e1122ece","auto-s30-34299f88c843","auto-s30-412c8b9da38b","auto-s30-b27118d1a3fd","auto-s30-e6db840c8e88","auto-s30-67d959296fe6","auto-s30-89776dc74a9a","auto-s30-6ae79da44383","auto-s30-db1c31afbd7b","auto-s30-3f2080887f71","auto-s30-fe63ae5a57a4","auto-s35-4e0c99df25d4","auto-s35-7602cc2b62ad","auto-s37-a008117f9f01","auto-s37-52c023fdb196"];
const GROUPS=[
 {key:'epicgames_S30_SoloZBVictoryCashCup_NAC/S30_SoloZBVictoryCashCup_Event8Round1_NAC',
  date:'2024-08-06',region:'NAC',seasonId:'S30',tournamentId:'ch5s3-zb-solo-victory',
  eventId:'S30_SoloZBVictoryCashCup',windowId:'S30_SoloZBVictoryCashCup_Event8Round1_NAC',
  eventNo:8,roundNo:1,count:14,pages:31,totalPages:100,rankMax:3100,team:1},
 {key:'epicgames_S35_VictoryDuosCup_ME/S35_VictoryDuosCup_Event2Round1_ME',
  date:'2025-05-24',region:'ME',seasonId:'S35',tournamentId:'ch6s2-console-duos-victory',
  eventId:'S35_VictoryDuosCup',windowId:'S35_VictoryDuosCup_Event2Round1_ME',
  eventNo:2,roundNo:1,count:2,pages:5,totalPages:73,rankMax:500,team:2},
 {key:'epicgames_S37_ConsoleDuosCashCups_NAW/S37_ConsoleDuosCashCups_Event4Round2_NAW',
  date:'2025-09-15',region:'NAW',seasonId:'S37',tournamentId:'ch6s4-console-duos-victory',
  eventId:'S37_ConsoleDuosCashCups',windowId:'S37_ConsoleDuosCashCups_Event4Round2_NAW',
  eventNo:4,roundNo:2,count:2,pages:1,totalPages:3,rankMax:100,team:2}
];
const RULES={
 S30:'https://www.fortnite.com/news/fortnite-victory-cash-cups-chapter-5-season-3-official-rules',
 S35:'https://www.fortnite.com/news/fortnite-duos-console-victory-cash-cups-may-2025-official-rules',
 S37:'https://www.fortnite.com/competitive/rules-guidelines/rules-library/fortnite-duos-console-victory-cash-cups-chapter-6-season-4-official-rules'
};
const hash=o=>crypto.createHash('sha256').update(JSON.stringify(o)).digest('hex');
const read=p=>JSON.parse(fs.readFileSync(path.join(ROOT,p),'utf8'));
const must=(v,m)=>{if(!v)throw Error('ORIGINAL_18 '+m)};
function group(p){return GROUPS.find(g=>g.key===p.windowKey)}
function roundName(g){return 'Event '+g.eventNo+' · Round '+g.roundNo+' / '+(g.roundNo===1?'予選':'賞金決勝')}
function validateProof(){
 must(blobSha===EXPECTED_BLOB,'evidence source Git blob changed');
 must(proof.version===1&&proof.checkedOn==='2026-11-18'&&
  proof.apiPagesAttempted===12&&proof.apiPageErrors===0&&
  Array.isArray(proof.checkedIds)&&JSON.stringify(proof.checkedIds)===JSON.stringify(IDS)&&
  Array.isArray(proof.verified)&&proof.verified.length===18&&
  Array.isArray(proof.held)&&proof.held.length===0&&
  Array.isArray(proof.groups)&&proof.groups.length===3,'evidence quantity differs');
 const seen=new Set();
 for(const g of GROUPS){
  const m=proof.groups.find(x=>x.key===g.key);
  must(m&&m.pages===g.pages&&m.totalPages===g.totalPages&&
   m.nextPage===g.pages&&m.lastSeenRank===g.rankMax&&
   m.rankingOrderValid===true&&m.complete===false&&
   Number.isFinite(Date.parse(m.lastSuccessAt)), 'incomplete source page proof '+g.key);
 }
 for(const p of proof.verified){
  const r=p.original,g=group(p);
  must(g&&r&&IDS.includes(r.id)&&!seen.has(r.id)&&
   r.seasonId===g.seasonId&&r.tournamentId===g.tournamentId&&
   r.region===g.region&&r.date===g.date&&r.round===roundName(g)&&
   r.verified===true&&r.reviewOnly!==true&&
   r.source==='https://www.fortnite.com/competitive/events/'+g.eventId+'/?region='+g.region+'&round='+g.windowId&&
   Number.isSafeInteger(r.rank)&&r.rank>=1&&r.rank<=g.rankMax&&
   p.observedPage===Math.floor((r.rank-1)/100)&&
   p.observedPage<g.pages&&p.providerTotalPages===g.totalPages&&
   ['points','kills','vrs','matches'].every(k=>Number.isSafeInteger(r[k])&&r[k]>=0)&&
   r.matches>=1&&r.matches<=(g.roundNo===1?7:3)&&r.vrs<=r.matches,
   'source event, rank, score or page mismatch '+r?.id);
  const names=r.players?.length?r.players:[r.player];
  must(names.length===g.team&&new Set(names).size===g.team&&
   names.join(' / ')===r.player&&
   Array.isArray(p.teamAccountIds)&&p.teamAccountIds.length===g.team&&
   new Set(p.teamAccountIds).size===g.team&&
   p.teamAccountIds.every(x=>typeof x==='string'&&/^[0-9a-f]{32}$/.test(x)),
   'original identity UUID or team missing '+r.id);
  if(g.seasonId==='S30')must(r.kind==='予選'&&r.prize===0,
    'NAC Round1 original not zero cash '+r.id);
  if(g.seasonId==='S35')must(r.kind==='予選'&&r.prize===0&&r.rank>250,
    'ME original outside top 250 not proven '+r.id);
  if(g.seasonId==='S37')must(r.kind==='賞金決勝'&&r.prize===null&&r.points===0&&r.vrs===0,
    'Round2 cannot imply prize '+r.id);
  seen.add(r.id);
 }
 must(seen.size===18&&GROUPS.every(g=>proof.verified.filter(p=>p.windowKey===g.key).length===g.count),
  'exact 18 checked originals required');
 return true;
}
function published(p,book,tournaments){
 const r=p.original,g=group(p);
 must(g,'unknown original window');
 const catalog=tournaments.catalog.find(x=>x.id===g.tournamentId);
 must(catalog&&catalog.name===r.event&&catalog.seasonId===g.seasonId&&
  catalog.sourceEventIds.includes(g.eventId)&&catalog.team===(g.team===1?'solo':'duo'),
  'catalog altered '+r.id);
 const rule=book.rules.find(x=>x.id===g.tournamentId);
 must(rule&&rule.source===RULES[g.seasonId]&&rule.eventIds.includes(g.eventId)&&
  rule.matchCaps['予選']===7,'official source rule altered '+r.id);
 if(g.team===2)must(rule.matchCaps['賞金決勝']===3&&
  rule.advance[g.region]===250&&rule.prizePerVictory===100&&
  rule.teamPrizePerVictory===200,'official duo award and qualification mismatch '+r.id);
 const {reviewReason,reviewOnly,teamAccountIds,note,...base}=r;
 const prefix='2026/11/18 元のEpic公式順位表を独立して再取得し、本人Epic UUID '+g.team+
  '名と順位'+r.rank+'位・'+r.points+'pt・'+r.kills+'K・'+r.vrs+
  'VR・'+r.matches+'試合の一致を確認。';
 if(g.roundNo===2){
  must(r.vrs===0&&r.points===0,'Round2 cash inference prohibited');
  return {...base,kind:'賞金決勝',prize:0,
   note:prefix+'Round2出場・0VRを確認したためチーム賞金$0、個人賞金$0。'+
    '未取得ページの順位や他のチームの賞金は推定しない。規則: '+rule.source};
 }
 if(g.seasonId==='S35'){
  must(r.rank>250,'top250 rule changed');
  return {...base,kind:'参加確認',prize:0,round:'Event '+g.eventNo+' · Round 1 / 参加確認',
   note:prefix+'ME上位250組の決勝突破圏外。参加のみ掲載し予選賞金$0。'+
    '決勝成績・賞金は未認定。規則: '+rule.source};
 }
 must(g.seasonId==='S30','unknown attendance round');
 return {...base,kind:'参加確認',prize:0,round:'Event '+g.eventNo+' · Round 1 / 参加確認',
  note:prefix+'NACの当該地域・開催枠の突破条件は未登録のため予選突破を認定しない。'+
   'Round1賞金$0。未取得ページや賞金決勝進出は推定しない。規則: '+rule.source};
}
function entryFor(p,r,approvedAt){
 const g=group(p);
 return {id:r.id,recordId:r.id,decision:'published',policy:POLICY,approvedAt,
  approvedBy:'ChatGPT / owner authorized Epic source recheck',
  source:r.source,rule:RULES[g.seasonId],
  candidateSha256:hash(p.original),epicUuidSha256:hash(p.teamAccountIds),
  recordSha256:hash(r),
  evidence:'Pinned independently refetched original Epic source blob '+EXPECTED_BLOB+
   '; original account UUIDs, rank, score, page and official $0 condition'};
}
function verifyPublished(r,e){
 try{
  const p=proof.verified.find(p=>p.original.id===r?.id),g=p&&group(p);
  if(!p||!g||e?.id!==r.id||e.recordId!==r.id||e.decision!=='published'||
   e.policy!==POLICY||e.source!==r.source||e.rule!==RULES[g.seasonId]||
   e.candidateSha256!==hash(p.original)||
   e.epicUuidSha256!==hash(p.teamAccountIds)||
   e.recordSha256!==hash(r)||r.teamAccountIds!==undefined)return false;
  return JSON.stringify(published(p,read('tournament-rules.json'),read('tournaments.json')))===
   JSON.stringify(r);
 }catch{return false}
}
validateProof();
module.exports={FILE,EXPECTED_BLOB,POLICY,GROUPS,RULES,IDS,proof,hash,validateProof,published,entryFor,verifyPublished};