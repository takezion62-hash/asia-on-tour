'use strict';
// One-time, fail-closed publisher of 18 original-Epic-ID verified records.
// Never publish the two pending S34 PlayStation identity gaps.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const write=(p,o)=>fs.writeFileSync(path.join(root,p),JSON.stringify(o,null,2)+'\n');
const {readResults,publishResults}=require('./source-results-store.cjs');
const {validateData}=require('./data-checks.cjs');
const {validateUpdateLog}=require('./validate-updates.cjs');
const {linkedAccounts}=require('./osirion-sync.cjs');
const seal=require('./verified-rescanned-18-20261118.cjs');
const must=(ok,why)=>{if(!ok)throw Error('PUBLISH_18 '+why)};
const dry=process.argv.includes('--dry-run');
seal.validateProof();
const data={results:readResults(root).rows,players:read('players.json'),tournaments:read('tournaments.json')};
const rules=read('tournament-rules.json');
const review=read('history-sync-review.json'),reviewed=read('history-sync-reviewed.json');
const status=read('history-sync-status.json');
const ledger=read('approval-history.json'),updates=read('updates.json');
const originalCount=data.results.length,cashBefore=data.results.reduce((n,r)=>n+(r.prize||0),0);
must(originalCount>=8594&&Array.isArray(review.proposals)&&
 Array.isArray(reviewed.entries)&&Array.isArray(ledger.entries)&&Array.isArray(updates.entries),
 'baseline files missing');
const existingIds=new Set(data.results.map(r=>r.id)),reviewedIds=new Set(reviewed.entries.map(r=>r.id)),ledgerIds=new Set(ledger.entries.map(r=>r.id));
must(existingIds.size===data.results.length&&reviewedIds.size===reviewed.entries.length&&
 ledgerIds.size===ledger.entries.length,'baseline ID conflicts');
const aliases=linkedAccounts(data);
const accounts=new Map(aliases.accounts.map(a=>[a.epicAccountId,a.player]));
const calendars={
 '2024-08':read('calendar-history/2024-08.json').sessions,
 '2025-05':read('calendar-history/2025-05.json').sessions,
 '2025-09':read('calendar-history/2025-09.json').sessions
};
const stamp='2026-11-18T04:47:00.000Z',added=[];
for(const p of seal.proof.verified){
 const original=p.original,g=seal.GROUPS.find(g=>g.key===p.windowKey);
 const current=review.proposals.find(x=>x.id===original.id);
 must(current&&JSON.stringify(current)===JSON.stringify(original),
  'current pending candidate differs from source original '+original.id);
 must(!existingIds.has(original.id)&&!reviewedIds.has(original.id)&&!ledgerIds.has(original.id),
  'duplicate published/reviewed '+original.id);
 const names=original.players?.length?original.players:[original.player];
 must(p.teamAccountIds.map(a=>accounts.get(a)).join(' / ')===names.join(' / '),
  'original Epic account no longer identifies same player '+original.id);
 must(g&&calendars[original.date.slice(0,7)]?.filter(s=>
  s.sourceWindowId===g.windowId&&s.dateJst===original.date&&
  s.region===original.region&&s.tournamentId===original.tournamentId).length===1,
  'official archived calendar missing '+original.id);
 const next=seal.published(p,rules,data.tournaments);
 const duplicate=data.results.some(r=>{
  if(r.date!==next.date||r.region!==next.region||r.tournamentId!==next.tournamentId)return false;
  const a=(r.players?.length?r.players:[r.player]).slice().sort().join('|');
  const b=(next.players?.length?next.players:[next.player]).slice().sort().join('|');
  if(a!==b&&!(r.rank===next.rank&&r.playerRaw===next.playerRaw))return false;
  try{return new URL(r.source).searchParams.get('round')===g.windowId}catch{return false}
 });
 must(!duplicate,'duplicate team and official event window '+original.id);
 const entry=seal.entryFor(p,next,stamp);
 must(seal.verifyPublished(next,entry),'permanent replay did not validate '+original.id);
 data.results.push(next);existingIds.add(next.id);
 ledger.entries.push(entry);ledgerIds.add(next.id);
 reviewed.entries.push({id:next.id,decision:'published',recordId:next.id,
  reviewedAt:stamp,source:next.source,policy:seal.POLICY,rule:seal.RULES[g.seasonId]});
 reviewedIds.add(next.id);
 added.push(next);
}
must(added.length===18&&new Set(added.map(x=>x.id)).size===18,'exactly 18 verified rows required');
must(added.filter(r=>r.kind==='参加確認').length===16&&
 added.filter(r=>r.kind==='賞金決勝'&&r.vrs===0&&r.prize===0).length===2,
 'unsupported classification of original Epic scores');
const processed=new Set(added.map(x=>x.id));
review.proposals=review.proposals.filter(x=>!processed.has(x.id));
must(review.proposals.length===2&&review.proposals.every(x=>x.seasonId==='S34'&&
 x.tournamentId==='ch6s2-playstation-cup'),
 'unexpected leftover review group or identity unresolved');
review.manualReviewedAt=stamp;reviewed.reviewedAt=stamp;
status.found=review.proposals.length;
status.manualReviewCandidates=review.proposals.length;
status.manualReviewProcessed=(status.manualReviewProcessed||0)+18;
status.lastReviewedBatchAt=stamp;
status.message='本人Epic UUID・元順位表・公式開催枠を再照合し18件を$0で掲載。'+
 '未確定のPlayStation Cup 2件は保留。未取得ページや賞金は推定せず既存の全戦績・賞金を保持。';
const uid='verified-original-epic-followup18-20261118';
must(!updates.entries.some(x=>x.id===uid),'update log already exists');
updates.entries.unshift({id:uid,date:'2026-11-18',type:'records',
 title:'追加取得した元Epic順位表で18件を本人照合して掲載',
 description:'S30 NAC Zero Build Solo Event8 Round1の14名とS35 ME Console Duos Event2 Round1の2組を予選参加確認$0として登録。S37 NAW Console Duos Event4 Round2のReo/sena・かめてぃん/huggyfvの2組は0VRの賞金決勝としてチーム$0を記録。元のEpic順位表12ページ・本人のEpic UUIDと順位、ポイント、キル、VR、試合数を照合。NACの突破順位は未登録のため推定しない。未確認のS34 ME PlayStation Cup 2件は保留。既存賞金額は変更しない。',
 recordIds:added.map(x=>x.id)});
must(data.results.length===originalCount+18&&
 new Set(data.results.map(x=>x.id)).size===data.results.length&&
 data.results.reduce((n,r)=>n+(r.prize||0),0)===cashBefore,'results counts or cash changed');
const errors=validateData(data).errors;
must(errors.length===0,'data validation '+JSON.stringify(errors.slice(0,5)));
const updateErrors=validateUpdateLog(data.results,updates);
must(updateErrors.length===0,'update log '+JSON.stringify(updateErrors.slice(0,5)));
if(!dry){
 publishResults(root,data.results);
 for(const [p,o] of [
  ['history-sync-review.json',review],['history-sync-reviewed.json',reviewed],
  ['history-sync-status.json',status],['approval-history.json',ledger],
  ['updates.json',updates]
 ])write(p,o);
}
console.log('PUBLISH_18 '+JSON.stringify({
 dry,baseline:originalCount,final:data.results.length,added:added.length,
 participation:added.filter(x=>x.kind==='参加確認').length,
 zeroVrFinal:added.filter(x=>x.kind==='賞金決勝').length,cashAdded:0,
 remaining:review.proposals.length,ids:added.map(x=>x.id)}));