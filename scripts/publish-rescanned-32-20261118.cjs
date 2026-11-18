'use strict';
// Publish only the 32 original-ID-confirmed Round1 rows from an immutable
// targeted re-fetch. Does not grant unverified NAC qualification or cash.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const write=(p,o)=>fs.writeFileSync(path.join(root,p),JSON.stringify(o,null,2)+'\n');
const {readResults,publishResults}=require('./source-results-store.cjs');
const {validateData}=require('./data-checks.cjs');
const {validateUpdateLog}=require('./validate-updates.cjs');
const {linkedAccounts}=require('./osirion-sync.cjs');
const seal=require('./verified-rescanned-32-20261118.cjs');
const dry=process.argv.includes('--dry-run'),must=(v,m)=>{if(!v)throw Error('PUBLISH_RESCANNED32 '+m)};
seal.validateProof();
const data={results:readResults(root).rows,players:read('players.json'),tournaments:read('tournaments.json')};
const rules=read('tournament-rules.json'),review=read('history-sync-review.json');
const reviewed=read('history-sync-reviewed.json'),status=read('history-sync-status.json');
const ledger=read('approval-history.json'),updates=read('updates.json');
const originalCount=data.results.length,initialCash=data.results.reduce((n,r)=>n+(r.prize||0),0);
must(originalCount>=8500&&Array.isArray(review.proposals)&&
 Array.isArray(reviewed.entries)&&Array.isArray(ledger.entries)&&Array.isArray(updates.entries),
 'baseline files missing');
const existingIds=new Set(data.results.map(x=>x.id)),reviewedIds=new Set(reviewed.entries.map(x=>x.id));
const ledgerIds=new Set(ledger.entries.map(x=>x.id));
must(existingIds.size===data.results.length&&reviewedIds.size===reviewed.entries.length&&
 ledgerIds.size===ledger.entries.length,'pre-existing ID conflict');
const aliases=linkedAccounts(data),accountMap=new Map(aliases.accounts.map(a=>[a.epicAccountId,a.player]));
const calendars={
 '2024-07':read('calendar-history/2024-07.json').sessions,
 '2025-10':read('calendar-history/2025-10.json').sessions
};
const stamp='2026-11-18T03:38:00.000Z',added=[];
for(const p of seal.proof.verified){
 const original=p.original,existingReview=review.proposals.find(x=>x.id===original.id);
 must(existingReview&&JSON.stringify(existingReview)===JSON.stringify(original),
  'current review queue differs from immutable original '+original.id);
 must(!existingIds.has(original.id)&&!ledgerIds.has(original.id)&&
 !reviewedIds.has(original.id),'already published/reviewed '+original.id);
 const members=Array.isArray(original.players)&&original.players.length?original.players:[original.player];
 must(p.teamAccountIds.map(id=>accountMap.get(id)).join(' / ')===members.join(' / '),
  'original Epic UUID no longer confirms same players '+original.id);
 const g=seal.GROUPS.find(x=>x.key===p.windowKey);
 must(g&&calendars[original.date.slice(0,7)]?.filter(s=>
  s.sourceWindowId===g.windowId&&s.dateJst===original.date&&
  s.region===original.region&&s.tournamentId===original.tournamentId).length===1,
  'missing original archived official calendar '+original.id);
 const next=seal.published(p,rules,data.tournaments);
 const collision=data.results.some(r=>{
  if(r.date!==next.date||r.region!==next.region||r.tournamentId!==next.tournamentId)return false;
  const a=(r.players?.length?r.players:[r.player]).slice().sort().join('|');
  const b=(next.players?.length?next.players:[next.player]).slice().sort().join('|');
  if(a!==b&&!(r.rank===next.rank&&r.playerRaw===next.playerRaw))return false;
  try {return new URL(r.source).searchParams.get('round')===g.windowId}
  catch {return false}
 });
 must(!collision,'duplicate same-team/scoreboard window '+original.id);
 const approval=seal.entryFor(p,next,stamp);
 must(seal.verifyPublished(next,approval),'newly planned record failed permanent tamper replay '+original.id);
 data.results.push(next);existingIds.add(original.id);
 ledger.entries.push(approval);ledgerIds.add(original.id);
 reviewed.entries.push({id:original.id,decision:'published',recordId:original.id,
  reviewedAt:stamp,source:original.source,policy:seal.POLICY,
  rule:seal.RULES[original.seasonId]});
 reviewedIds.add(original.id);
 added.push(next);
}
must(added.length===32&&new Set(added.map(x=>x.id)).size===32,'all 32 exact source-verified rows required');
const done=new Set(added.map(x=>x.id));
review.proposals=review.proposals.filter(x=>!done.has(x.id));
review.manualReviewedAt=stamp;reviewed.reviewedAt=stamp;
status.found=review.proposals.length;status.manualReviewCandidates=review.proposals.length;
status.message='原文順位表を再取得して本人Epic UUIDを照合、32件のRound1を掲載。'+
 '残る'+review.proposals.length+'件は証拠未確定のため保留。今回の追加賞金$0。';
must(review.proposals.length===20,'unexpected residual review count: '+review.proposals.length);
const uid='verified-original-epic-rescan32-20261118';
must(!updates.entries.some(x=>x.id===uid),'duplicate update record');
updates.entries.unshift({id:uid,date:'2026-11-18',type:'records',
 title:'元Epic順位表の本人IDを再取得し、S30 NAC/S37 NAWの予選32件を安全に掲載',
 description:'2024年S30 NAC ZB Solo Event5/7の参加18件と2025年S37 NAW Console Duos Event9の予選14組。元のEpic順位表19ページを再取得し、元の32候補の本人Epic UUID・順位・チームキル・VR・試合数を再照合。S37上位250組に該当する4組は予選突破、残りは参加確認。S30 NACの突破条件は未登録のため判断せず、予選参加のみ掲載。すべて予選賞金$0。候補20件は本人ID不足・未解決の取得エラーなどのため保留。既存戦績と既存賞金は変更しない。',
 recordIds:added.map(x=>x.id)});
must(data.results.length===originalCount+32&&new Set(data.results.map(x=>x.id)).size===data.results.length&&
 data.results.reduce((n,r)=>n+(r.prize||0),0)===initialCash,'results or existing award count modified');
const errors=validateData(data).errors;
must(errors.length===0,'data checks '+JSON.stringify(errors.slice(0,5)));
const updateErrors=validateUpdateLog(data.results,updates);
must(updateErrors.length===0,'update log invalid '+JSON.stringify(updateErrors.slice(0,5)));
if(!dry){
 publishResults(root,data.results);
 for(const [p,o] of [
  ['history-sync-review.json',review],['history-sync-reviewed.json',reviewed],
  ['history-sync-status.json',status],['approval-history.json',ledger],['updates.json',updates]
 ])write(p,o);
}
console.log('PUBLISH_RESCANNED32 '+JSON.stringify({dry,baseline:originalCount,final:data.results.length,
 added:added.length,qualified:added.filter(x=>x.round.endsWith('予選突破')).length,
 attendance:added.filter(x=>x.kind==='参加確認').length,cashAdded:0,remaining:review.proposals.length,
 newIds:added.map(x=>x.id)}));
