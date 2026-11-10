'use strict';
// Source-verified, repeatable review queue publisher. Works only on the three
// exact September 2026 S42 cosmetic sessions and two confirmed Inoxtag rows.
// All candidate scores, Epic IDs, calendar windows and existing result collisions
// are revalidated by manual-approval-core before any files are written.
const fs=require('node:fs');
const path=require('node:path');
const {apply}=require('./manual-approval-core.cjs');
const {evaluate,CUT_OFFS}=require('./cosmetic-rank-rules.cjs');
const root=path.resolve(__dirname,'..');
const read=f=>JSON.parse(fs.readFileSync(path.join(root,f),'utf8'));
const write=(f,o)=>fs.writeFileSync(path.join(root,f),JSON.stringify(o,null,2)+'\n');
const dry=process.argv.includes('--dry-run');
const target=new Map([
 ['ch7s4-override-kingdom-hearts-cup','2026-09-19'],
 ['ch7s4-override-persona-5-royal-cup-reload','2026-09-26'],
 ['ch7s4-champion-focus-fncs-cup','2026-09-21']
]);
const db={
 results:read('results.json'),
 players:read('players.json'),
 tournaments:read('tournaments.json'),
 reviews:{auto:read('auto-sync-review.json'),history:read('history-sync-review.json')},
 statuses:{auto:read('auto-sync-status.json'),history:read('history-sync-status.json')},
 scans:{auto:read('auto-sync-scan.json'),history:read('history-sync-scan.json')},
 ledger:read('approval-history.json'),
 updates:read('updates.json'),
 calendar:{}
};
const list=[...db.reviews.history.proposals,...db.reviews.auto.proposals]
 .filter(r=>r.reviewOnly===true&&r.kind==='参加確認'&&r.verified===true&&
   ((target.get(r.tournamentId)===r.date)||
    (r.tournamentId==='ch7s4-inoxtag-icon-cup-battle-royale'&&r.date==='2026-10-26'&&r.region==='NAW')))
 .sort((a,b)=>a.date.localeCompare(b.date)||a.region.localeCompare(b.region)||a.rank-b.rank);
const added=[],held=[],skipped=[];
const stamp=new Date().toISOString();
for(const r of list){
 try{
  if(!db.calendar[r.date.slice(0,7)]){
    const month=read('calendar-history/'+r.date.slice(0,7)+'.json');
    if(!Array.isArray(month.sessions))throw Error('Missing official calendar month');
    db.calendar[r.date.slice(0,7)]=month.sessions;
  }
  const cutoff=CUT_OFFS[r.tournamentId]?.ranks?.[r.region];
  const reward=Number.isSafeInteger(cutoff)&&r.rank<=cutoff;
  if(reward){
    const verdict=evaluate(r);
    if(!verdict.eligible)throw Error('Award rule mismatch: '+verdict.reason);
  }
  const policy=reward?'cosmetic-rank':'attendance-only';
  const p=apply(db,{ids:[r.id],policy,confirmation:'CONFIRM',timestamp:stamp,
    runId:'aot-20261111-'+r.id,actor:'ChatGPT / approved by repository owner'});
  if(p.changes.length){
   db.results=p.next.results;db.reviews=p.next.reviews;db.statuses=p.next.statuses;
   db.ledger=p.next.ledger;db.updates=p.next.updates;
   added.push({id:r.id,player:r.player,rank:r.rank,region:r.region,event:r.event,policy});
  }else skipped.push(r.id);
 }catch(e){
  held.push({id:r.id,reason:String(e.message||e)});
 }
}
const prefix='review-publication-aot-20261111-';
db.updates.entries=db.updates.entries.filter(x=>!String(x.id||'').startsWith(prefix));
const marker='reviewed-cosmetic-result-batch-20261111';
if(added.length){
 const prev=db.updates.entries.find(x=>x.id===marker);
 if(prev){
  prev.recordIds=[...new Set([...(prev.recordIds||[]),...added.map(x=>x.id)])];
  prev.description='Epic本人ID・保存済み公式順位表・地域別賞品規則を照合した'+prev.recordIds.length+'件を通常の遠征結果へ追加（現金賞金の推定なし）';
 }else db.updates.entries.unshift({
  id:marker,date:'2026-11-11',type:'records',title:'Epic公式規則で確認した海外大会成績を追加',
  description:'KINGDOM HEARTS、Persona 5 Reload、Champion Focus FNCSの地域別衣装獲得条件とInoxtag参加を照合。スキン対象外は参加記録のみ。現金賞金を推定せず通常の遠征結果へ統合。',
  recordIds:added.map(x=>x.id)
 });
 for(const k of ['auto','history']){
  db.statuses[k].lastReviewedBatchAt=stamp;
  db.statuses[k].message='公式順位・本人IDを照合した確認候補を掲載。残り確認待ち'+db.reviews[k].proposals.length+'件。';
 }
}
if(!dry&&added.length){
 for(const [p,o] of [
  ['results.json',db.results],['auto-sync-review.json',db.reviews.auto],
  ['history-sync-review.json',db.reviews.history],
  ['auto-sync-status.json',db.statuses.auto],
  ['history-sync-status.json',db.statuses.history],
  ['approval-history.json',db.ledger],['updates.json',db.updates]])write(p,o);
}
console.log('VERIFIED_COSMETIC_REVIEW '+JSON.stringify({
 dry,candidates:list.length,added:added.length,awardRecords:added.filter(x=>x.policy==='cosmetic-rank').length,
 attendanceRecords:added.filter(x=>x.policy==='attendance-only').length,
 remainingRecent:db.reviews.auto.proposals.length,remainingHistory:db.reviews.history.proposals.length,
 held:held.slice(0,20),heldCount:held.length,skipped:skipped.length,examples:added.slice(0,10)
}));
