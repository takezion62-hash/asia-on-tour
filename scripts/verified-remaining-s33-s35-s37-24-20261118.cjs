'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const pathName='data/manual-approvals/20261118-source-verified-s33-s35-s37-24.json';
const proofBytes=fs.readFileSync(path.join(root,pathName));
const blobSha=crypto.createHash('sha1').update('blob '+proofBytes.length+'\0').update(proofBytes).digest('hex');
const LOCKED_BLOB='736d2668424175ebb3578c2437cc8665d24e5395';
const proof=JSON.parse(proofBytes.toString('utf8'));
const POLICY='source-verified-s33-s35-s37-24-20261118';
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const hash=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
const must=(v,msg)=>{if(!v)throw Error('SAFE_24 '+msg)};
const sources={
 'S33-final-attendance':{season:'S33',tournamentId:'ch6s1-solo-cash',eventId:'S33_SoloCashCup',region:'NAW',date:'2025-02-19',round:'Event 8 · Round 2 / 参加確認',count:6,rankMax:563,pages:6,totalPages:6,team:1},
 'S35-qualifier':{season:'S35',tournamentId:'ch6s2-console-duos-victory',eventId:'S35_VictoryDuosCup',region:'ME',date:'2025-05-17',round:'Event 1 · Round 1 / 予選',count:6,rankMax:500,pages:5,totalPages:75,team:2},
 'S37-final-zero':{season:'S37',tournamentId:'ch6s4-console-duos-victory',eventId:'S37_ConsoleDuosCashCups',region:'NAW',date:'2025-08-18',round:'Event 1 · Round 2 / 賞金決勝',count:12,rankMax:200,pages:2,totalPages:3,team:2}
};
const requiredIdByMode={
 'S33-final-attendance':['auto-s33-1c1b5b51fb33','auto-s33-50b598dfe674','auto-s33-7e72f4646bb9','auto-s33-b6d42c01d8c9','auto-s33-bd5edb7a9bb9','auto-s33-fe682d26452a'],
 'S35-qualifier':['auto-s35-1d8317e62e26','auto-s35-1dae8998aef9','auto-s35-2feccd077d35','auto-s35-70945663bd3e','auto-s35-abfa67e68898','auto-s35-baf1676e9290'],
 'S37-final-zero':['auto-s37-0257c7abaae9','auto-s37-0d90af6ea4de','auto-s37-20ebf0fa94f6','auto-s37-28df3884e4e7','auto-s37-3d73a11e2718','auto-s37-42b20b899e1a','auto-s37-47f1e1684c27','auto-s37-4d4f8660021a','auto-s37-7d5d75aca45c','auto-s37-beeb914fe10f','auto-s37-db8660f8e9e9','auto-s37-747bc5d4b65e']
};
const RULES={S35:'https://www.fortnite.com/news/fortnite-duos-console-victory-cash-cups-may-2025-official-rules',S37:'https://www.fortnite.com/competitive/rules-guidelines/rules-library/fortnite-duos-console-victory-cash-cups-chapter-6-season-4-official-rules'};
function sourceKey(r){
 const u=new URL(r.source);
 must(u.protocol==='https:'&&u.hostname==='www.fortnite.com'&&
  u.pathname==='/competitive/events/'+r.sourceEventId+'/'&&
  u.searchParams.get('region')===r.region,'untrusted event source');
 return 'epicgames_'+r.sourceEventId+'_'+r.region+'/'+u.searchParams.get('round');
}
function validateProof(){
 must(blobSha===LOCKED_BLOB,'committed source evidence blob mutated');
 must(proof.version===1&&proof.reviewedOn==='2026-11-18'&&
  JSON.stringify(proof.ruleUrls)===JSON.stringify(RULES)&&
  Array.isArray(proof.groups)&&proof.groups.length===3,'proof groups or official sources differ');
 const seen=new Set();let rows=0;
 for(const group of proof.groups){
  const c=sources[group.mode],meta=group.metadata;
  must(c&&group.key==='epicgames_'+c.eventId+'_'+c.region+'/'+
    c.eventId+(group.mode==='S33-final-attendance'?'_Event8Round2_NAW':
    group.mode==='S35-qualifier'?'_Event1Round1_ME':'_Event1Round2_NAW'),
   'window key not source-locked');
  must(Array.isArray(group.rows)&&group.rows.length===c.count&&
   meta.rankingOrderValid===true&&meta.pages===c.pages&&meta.nextPage===c.pages&&
   meta.totalPages===c.totalPages&&meta.lastSeenRank===c.rankMax&&
   !meta.lastErrorCode&&!meta.lastError&&!meta.retryAfter&&
   !meta.emptyAttempts&&Number.isFinite(Date.parse(meta.lastSuccessAt)),
   'nonconsecutive/mature page evidence invalid');
  // S35 shows "complete:true" for its 5-page fetch window despite 75
  // leaderboard pages. We assert actual prefix 1–500, NOT a whole leaderboard.
  if(group.mode==='S33-final-attendance')must(meta.complete===true&&meta.pages===meta.totalPages,'incomplete S33 final');
  if(group.mode==='S37-final-zero')must(meta.complete===false,'S37 page-3 unknown');
  const ids=new Set(requiredIdByMode[group.mode]);
  for(const r of group.rows){
   rows++;
   must(ids.has(r.id)&&!seen.has(r.id)&&r.seasonId===c.season&&
    r.tournamentId===c.tournamentId&&r.date===c.date&&r.region===c.region&&
    r.round===c.round&&r.verified===true&&
    r.rank>0&&r.rank<=meta.lastSeenRank&&r.player&&r.source&&
    Number.isSafeInteger(r.points)&&Number.isSafeInteger(r.kills)&&
    Number.isSafeInteger(r.vrs)&&Number.isSafeInteger(r.matches)&&
    r.matches>=1&&r.vrs<=r.matches,'invalid candidate '+r.id);
   seen.add(r.id);
   const u=new URL(r.source);
   must(u.hostname==='www.fortnite.com'&&u.pathname==='/competitive/events/'+c.eventId+'/'&&
    u.searchParams.get('region')===c.region&&group.key.endsWith('/'+u.searchParams.get('round')),
    'wrong Epic source window '+r.id);
   const lineup=Array.isArray(r.players)?r.players:[r.player];
   must(lineup.length===c.team&&new Set(lineup).size===c.team&&
     r.player===lineup.join(' / ')&&r.teamAccountIds?.length===c.team&&
     new Set(r.teamAccountIds).size===c.team&&
     r.teamAccountIds.every(x=>/^[0-9a-f]{32}$/.test(x)),'unverified exact Epic UUIDs '+r.id);
   if(group.mode==='S33-final-attendance')
    must(r.reviewOnly===true&&r.kind==='参加確認'&&r.prize===null&&
     r.rank>=300&&r.matches<=10,'S33 final-only attendance scope '+r.id);
   if(group.mode==='S35-qualifier')
    must(r.kind==='予選'&&r.prize===0&&r.matches<=7,'S35 Round1 prize limit '+r.id);
   if(group.mode==='S37-final-zero')
    must(r.kind==='賞金決勝'&&r.prize===null&&r.points===0&&r.vrs===0&&
     r.matches<=3,'S37 cannot imply nonzero final payout '+r.id);
  }
 }
 must(rows===24&&seen.size===24,'exact 24 unique evidence items required');
 return true;
}
function originals(){return proof.groups.flatMap(x=>x.rows.map(r=>({...r,_mode:x.mode})))}
function record(original,rulebook,tournaments){
 const mode=original._mode||proof.groups.find(x=>x.rows.some(r=>r.id===original.id))?.mode;
 const c=sources[mode],catalog=tournaments.catalog.find(x=>x.id===original.tournamentId);
 must(c&&catalog?.name===original.event&&catalog.team===(c.team===2?'duo':'solo')&&
  catalog.seasonId===c.season&&catalog.sourceEventIds.includes(c.eventId),
  'official catalog mismatch '+original.id);
 const {reviewOnly,reviewReason,teamAccountIds,note,_mode,...base}=original;
 if(mode==='S33-final-attendance'){
  return {...base,kind:'参加確認',prize:null,
   note:'2026/11/18 Epic公式Event8 Round2の全6ページ・本人Epic ID・順位・試合・キルを確認。'+
    '決勝参加のみ掲載し、現金賞金・賞品獲得は未確認。出典: '+original.source};
 }
 const rule=rulebook.rules.find(x=>x.id===c.tournamentId);
 must(rule&&rule.source===RULES[c.season]&&rule.team==='duo'&&
  rule.prizePerVictory===100&&rule.teamPrizePerVictory===200&&
  rule.eventIds.includes(c.eventId)&&rule.advance[c.region]===250&&
  rule.matchCaps['予選']===7&&rule.matchCaps['賞金決勝']===3,
  'official region and payout rules changed');
 if(mode==='S35-qualifier'){
  const pass=original.rank<=250;
  return {...base,kind:pass?'予選':'参加確認',
   round:'Event 1 · Round 1 / '+(pass?'予選突破':'参加確認'),prize:0,
   note:'2026/11/18 Epic公式2025/5/17 ME Event1 Round1の連続5ページ（1–500位）と'+
    '2名のEpic ID・'+original.rank+'位を確認。公式ME上位250組がRound2進出。'+
    (pass?'予選突破。':'突破圏外の参加記録。')+
    '予選賞金$0、決勝賞金は未認定。規則: '+rule.source};
 }
 must(original.points===0&&original.vrs===0,'unsupported Round2 victory amount');
 return {...base,kind:'賞金決勝',prize:0,teamPrize:0,prizePerPlayer:0,
  note:'2026/11/18 Epic公式2025/8/18 NAW Event1 Round2の連続2ページ（1–200位）と'+
   '2名のEpic ID・'+original.rank+'位・'+original.kills+'K・0VRを確認。'+
   '公式1VR＝チーム$200のため0VRのチーム賞金$0・各選手$0。'+
   '未取得の3ページ目は、この確認済み順位やVRを変更する根拠に使わない。'+
   '規則: '+rule.source};
}
function approval(original,r,at){
 return {id:r.id,recordId:r.id,decision:'published',policy:POLICY,approvedAt:at,
  approvedBy:'ChatGPT / owner-authorized historical source verification',source:r.source,
  rule:original.seasonId==='S33'?null:RULES[original.seasonId],
  candidateSha256:hash(original),recordSha256:hash(r),
  evidence:'Immutable consecutive Epic leaderboard page prefix, exact player UUID(s), event calendar, score and independently verified payout policy'};
}
function verifyPublished(r,entry){
 try{
  if(!r||!entry||entry.policy!==POLICY||entry.recordId!==r.id||entry.id!==r.id||
   entry.decision!=='published'||entry.source!==r.source||r.verified!==true)return false;
  const original=originals().find(x=>x.id===r.id);
  if(!original)return false;
  if(entry.rule!==(original.seasonId==='S33'?null:RULES[original.seasonId])||
   entry.candidateSha256!==hash(original)||entry.recordSha256!==hash(r))return false;
  return JSON.stringify(record(original,read('tournament-rules.json'),read('tournaments.json')))===JSON.stringify(r);
 }catch{return false}
}
validateProof();
module.exports={POLICY,proof,RULES,hash,validateProof,originals,record,approval,verifyPublished};
