'use strict';
// Immutable after-the-fact original Epic UUID recheck for 32 archived candidates.
// Only source-OBSERVED Round1 entries; no unknown leaderboard pages/awards.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),FILE='data/manual-approvals/20261118-targeted-32-original-epic-proof.json';
const bytes=fs.readFileSync(path.join(root,FILE));
const blobSha=crypto.createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
const EXPECTED_BLOB='129d1f1d3432df0e3bad1438f720f6e1de97b42e';
const proof=JSON.parse(bytes.toString('utf8'));
const POLICY='verified-original-epic-32-20261118';
const hash=o=>crypto.createHash('sha256').update(JSON.stringify(o)).digest('hex');
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const must=(ok,why)=>{if(!ok)throw Error('ORIGINAL_32 '+why);};
const IDS=[
 "auto-s30-c84acc2ac9ff",
 "auto-s30-76be9ad0ebbe",
 "auto-s30-040dcc04c0b2",
 "auto-s30-b6d4e1402a37",
 "auto-s30-756a5ffaeb14",
 "auto-s30-161bcfac873f",
 "auto-s30-fbdce0282f26",
 "auto-s30-fe3a5e3ba5e0",
 "auto-s30-1817974baef5",
 "auto-s30-9e73de77745d",
 "auto-s30-5e8ea2768e51",
 "auto-s30-16cb81247877",
 "auto-s30-46b1837e398e",
 "auto-s30-87ebd653e6ac",
 "auto-s30-3bfbd8cb762b",
 "auto-s30-e2d6134b0036",
 "auto-s30-2ed4bd929279",
 "auto-s30-be0fda0c3a51",
 "auto-s37-c3c87ab3a2af",
 "auto-s37-46087ce48e12",
 "auto-s37-13871b65f3aa",
 "auto-s37-ad6bfb4e113b",
 "auto-s37-232d6ba9c3f2",
 "auto-s37-ada5fcd01cf8",
 "auto-s37-9c291b73fa44",
 "auto-s37-6f934070f0ae",
 "auto-s37-2124c353d60c",
 "auto-s37-8353469d7b88",
 "auto-s37-397c5764cb06",
 "auto-s37-9af2234758ec",
 "auto-s37-a571b7105e24",
 "auto-s37-767d34f8eb64"
];
const GROUPS=[
 {key:'epicgames_S30_SoloZBVictoryCashCup_NAC/S30_SoloZBVictoryCashCup_Event5Round1_NAC',
  date:'2024-07-16',eventId:'S30_SoloZBVictoryCashCup',windowId:'S30_SoloZBVictoryCashCup_Event5Round1_NAC',seasonId:'S30',tournamentId:'ch5s3-zb-solo-victory',region:'NAC',count:4,pages:45,totalPages:100,rankMax:4500,team:1},
 {key:'epicgames_S30_SoloZBVictoryCashCup_NAC/S30_SoloZBVictoryCashCup_Event7Round1_NAC',
  date:'2024-07-30',eventId:'S30_SoloZBVictoryCashCup',windowId:'S30_SoloZBVictoryCashCup_Event7Round1_NAC',seasonId:'S30',tournamentId:'ch5s3-zb-solo-victory',region:'NAC',count:14,pages:29,totalPages:100,rankMax:2900,team:1},
 {key:'epicgames_S37_ConsoleDuosCashCups_NAW/S37_ConsoleDuosCashCups_Event9Round1_NAW',
  date:'2025-10-19',eventId:'S37_ConsoleDuosCashCups',windowId:'S37_ConsoleDuosCashCups_Event9Round1_NAW',seasonId:'S37',tournamentId:'ch6s4-console-duos-victory',region:'NAW',count:14,pages:34,totalPages:52,rankMax:3400,team:2}
];
const RULES={
 S30:'https://www.fortnite.com/news/fortnite-victory-cash-cups-chapter-5-season-3-official-rules',
 S37:'https://www.fortnite.com/competitive/rules-guidelines/rules-library/fortnite-duos-console-victory-cash-cups-chapter-6-season-4-official-rules'
};
function validateProof(){
 must(blobSha===EXPECTED_BLOB,'stored original API evidence blob changed');
 must(proof?.version===1&&proof.checkedOn==='2026-11-18'&&
  Array.isArray(proof.checkedIds)&&proof.checkedIds.length===32&&
  JSON.stringify(proof.checkedIds)===JSON.stringify(IDS)&&
  Array.isArray(proof.verified)&&proof.verified.length===32&&
  Array.isArray(proof.held)&&proof.held.length===0&&
  proof.apiPagesAttempted===19&&proof.apiPageErrors===0&&
  Array.isArray(proof.groups)&&proof.groups.length===3,
  'source-check quantity/method changed');
 for(const group of GROUPS){
  const meta=proof.groups.find(x=>x.key===group.key);
  must(meta&&meta.pages===group.pages&&meta.totalPages===group.totalPages&&
   meta.nextPage===group.pages&&meta.lastSeenRank===group.rankMax&&
   meta.complete===false&&meta.rankingOrderValid===true&&
   Number.isFinite(Date.parse(meta.lastSuccessAt)), 'uncaptured/malformed prefix '+group.key);
 }
 const found=new Set();
 for(const p of proof.verified){
  const r=p.original,g=GROUPS.find(g=>g.key===p.windowKey);
  must(r&&g&&IDS.includes(r.id)&&!found.has(r.id)&&
   r.seasonId===g.seasonId&&r.tournamentId===g.tournamentId&&r.region===g.region&&
   r.date===g.date&&r.kind==='予選'&&r.prize===0&&r.verified===true&&
   r.source==='https://www.fortnite.com/competitive/events/'+g.eventId+
    '/?region='+g.region+'&round='+g.windowId&&
   r.round==='Event '+(g.windowId.includes('Event5')?'5':g.windowId.includes('Event7')?'7':'9')+
    ' · Round 1 / 予選'&&
   Number.isSafeInteger(r.rank)&&r.rank>=1&&r.rank<=g.rankMax&&
   p.observedPage===Math.floor((r.rank-1)/100)&&p.observedPage<g.pages&&
   p.providerTotalPages===g.totalPages&&
   Number.isSafeInteger(r.points)&&r.points>=0&&
   Number.isSafeInteger(r.kills)&&r.kills>=0&&
   Number.isSafeInteger(r.vrs)&&r.vrs>=0&&
   Number.isSafeInteger(r.matches)&&r.matches>=1&&r.matches<=7&&r.vrs<=r.matches,
   'candidate scoreboard/region/stage/page altered '+r?.id);
  const names=r.players?.length?r.players:[r.player];
  must(names.length===g.team&&new Set(names).size===g.team&&
   names.join(' / ')===r.player&&
   Array.isArray(p.teamAccountIds)&&p.teamAccountIds.length===g.team&&
   new Set(p.teamAccountIds).size===g.team&&
   p.teamAccountIds.every(x=>typeof x==='string'&&/^[0-9a-f]{32}$/.test(x)),
   'Epic UUID/roster missing '+r.id);
  found.add(r.id);
 }
 must(found.size===IDS.length&&GROUPS.every(g=>proof.verified.filter(p=>p.windowKey===g.key).length===g.count),
  '32 exactly observed records required');
 return true;
}
function published(p,rulebook,tournaments){
 const original=p.original,g=GROUPS.find(g=>g.key===p.windowKey);
 must(g,'missing original source window');
 const catalog=tournaments.catalog.find(x=>x.id===g.tournamentId);
 must(catalog&&catalog.name===original.event&&catalog.seasonId===g.seasonId&&
  catalog.sourceEventIds.includes(g.eventId)&&catalog.team===(g.team===1?'solo':'duo'),
  'tournament catalog changed '+original.id);
 const rule=rulebook.rules.find(x=>x.id===g.tournamentId);
 must(rule&&rule.source===RULES[g.seasonId]&&
  rule.matchCaps['予選']===7,'original official rule changed '+original.id);
 const qualifiers=g.seasonId==='S37';
 if(qualifiers)must(rule.advance?.NAW===250&&rule.eventIds.includes(g.eventId)&&
  rule.teamPrizePerVictory===200&&rule.prizePerVictory===100,'NAW advancement rule changed');
 const passed=qualifiers&&original.rank<=250;
 const {reviewReason,reviewOnly,teamAccountIds,note,...base}=original;
 return {...base,kind:passed?'予選':'参加確認',
  round:'Event '+(g.windowId.includes('Event5')?'5':g.windowId.includes('Event7')?'7':'9')+
  ' · Round 1 / '+(passed?'予選突破':'参加確認'),
  prize:0,note:'2026/11/18 元のEpic順位表の対象ページを再取得し、'+
   '本人Epic UUID '+g.team+'名・'+original.rank+'位・'+original.points+'pt・'+
   original.kills+'K・'+original.vrs+'VR・'+original.matches+'試合を一致確認。'+
   (passed?'NAW上位250組として予選突破。':
    qualifiers?'NAW上位250組の突破圏外の参加記録。':
    'NACの公式地域別突破条件は未登録のため、参加だけを確認し予選突破は未認定。')+
   'Round 1の賞金は$0。未取得ページの結果、決勝参加や賞金獲得は推定しない。規則: '+rule.source};
}
function entryFor(p,r,approvedAt){
 const g=GROUPS.find(g=>g.key===p.windowKey);
 return {id:r.id,recordId:r.id,decision:'published',policy:POLICY,approvedAt,
  approvedBy:'ChatGPT / owner authorized source recheck',source:r.source,
  rule:RULES[g.seasonId],
  candidateSha256:hash(p.original),epicUuidSha256:hash(p.teamAccountIds),
  recordSha256:hash(r),
  evidence:'Pinned source blob '+EXPECTED_BLOB+'; independently fetched Epic scoreboard rank, two/one matching original account IDs, exact stats, observed page'};
}
function verifyPublished(r,e){
 try{
  const proofRow=proof.verified.find(p=>p.original.id===r?.id),g=proofRow&&GROUPS.find(g=>g.key===proofRow.windowKey);
  if(!proofRow||!g||e?.id!==r.id||e.recordId!==r.id||e.decision!=='published'||
   e.policy!==POLICY||e.source!==r.source||e.rule!==RULES[g.seasonId]||
   e.candidateSha256!==hash(proofRow.original)||
   e.epicUuidSha256!==hash(proofRow.teamAccountIds)||e.recordSha256!==hash(r)||
   r.teamAccountIds!==undefined)return false;
  return JSON.stringify(published(proofRow,read('tournament-rules.json'),read('tournaments.json')))===
   JSON.stringify(r);
 }catch{return false}
}
validateProof();
module.exports={FILE,POLICY,RULES,IDS,GROUPS,proof,hash,validateProof,published,entryFor,verifyPublished};
