'use strict';
// One-off, fail-closed source publisher. Never fetches a live ranking,
// guesses winnings, or edits old results. All 24 rows are immutable evidence.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const {readResults,publishResults}=require('./source-results-store.cjs');
const {validateData}=require('./data-checks.cjs');
const {validateUpdateLog}=require('./validate-updates.cjs');
const source=require('./verified-remaining-s33-s35-s37-24-20261118.cjs');
const dry=process.argv.includes('--dry-run');
const read=x=>JSON.parse(fs.readFileSync(path.join(root,x),'utf8'));
const write=(p,x)=>fs.writeFileSync(path.join(root,p),JSON.stringify(x,null,2)+'\n');
const must=(v,m)=>{if(!v)throw Error('PUBLISH_VERIFIED_24 '+m)};
source.validateProof();
const results=readResults(root).rows,oldCount=results.length;
const players=read('players.json'),tournaments=read('tournaments.json');
const rules=read('tournament-rules.json');
const review=read('history-sync-review.json'),status=read('history-sync-status.json');
const ledger=read('approval-history.json'),updates=read('updates.json');
must(Array.isArray(review.proposals)&&Array.isArray(ledger.entries)&&
 Array.isArray(updates.entries)&&oldCount>=8500,'unexpected baseline');
const existing=new Set(results.map(x=>x.id)),approved=new Set(ledger.entries.map(x=>x.id));
must(existing.size===results.length&&approved.size===ledger.entries.length,'duplicate old IDs');
const known=new Set(players.candidates.map(x=>x.name));
const groups=source.proof.groups;
const originalIds=new Set(source.originals().map(x=>x.id));
must(originalIds.size===24,'exact original proof ID count');
const calendars={};
const allOriginal=source.originals();
const generated=[];
const sourceWindow=row=>{
 try{return new URL(row.source).searchParams.get('round')||new URL(row.source).searchParams.get('window')}catch{return null}
};
const lineup=row=>Array.isArray(row.players)&&row.players.length?row.players:[row.player];
const scoreFields=['id','date','region','player','playerRaw','players','event','round','rank',
 'points','kills','vrs','matches','prize','kind','seasonId','chapter','season',
 'tournamentId','source','verified','reviewOnly','teamAccountIds'];
function sameOriginal(a,b){
 return scoreFields.every(k=>JSON.stringify(a[k]??null)===JSON.stringify(b[k]??null));
}
for(const o of allOriginal){
 const { _mode,...sourceRow}=o;
 must(!existing.has(o.id)&&!approved.has(o.id),'already on main/approved '+o.id);
 const queued=review.proposals.find(x=>x.id===o.id);
 must(queued&&sameOriginal(sourceRow,queued),'live pending record differs from locked Epic source '+o.id);
 const month=o.date.slice(0,7);
 if(!calendars[month])calendars[month]=read('calendar-history/'+month+'.json').sessions;
 const c=calendars[month].filter(x=>x.sourceWindowId===sourceWindow(o)&&
  x.dateJst===o.date&&x.region===o.region&&x.tournamentId===o.tournamentId&&
  x.seasonId===o.seasonId);
 must(c.length===1&&c[0].eventId===new URL(o.source).pathname.split('/')[3]&&
  Date.parse(c[0].endUtc)+4*3600000<Date.parse(source.proof.groups.find(g=>g.rows.some(x=>x.id===o.id)).metadata.lastSuccessAt),
  'official schedule and settled ranking check failed '+o.id);
 const team=lineup(o);
 must(team.every(name=>known.has(name))&&team.join(' / ')===o.player,
  'unrecognized player name '+o.id);
 const group=groups.find(g=>g.rows.some(x=>x.id===o.id));
 const sourceFull=group.rows.find(x=>x.id===o.id);
 must(sourceFull&&sameOriginal(o,sourceFull),'original source checkpoint mismatch '+o.id);
 const next=source.record(o,rules,tournaments);
 const w=sourceWindow(o);
 must(w&&results.filter(r=>r.date===o.date&&r.region===o.region&&
  r.tournamentId===o.tournamentId&&sourceWindow(r)===w&&(
   r.rank===next.rank&&r.playerRaw===next.playerRaw||
   lineup(r).slice().sort().join('|')===team.slice().sort().join('|'))).length===0,
  'existing same-window duplicate '+o.id);
 must(!generated.some(r=>r.date===next.date&&r.region===next.region&&
  r.tournamentId===next.tournamentId&&sourceWindow(r)===w&&
  (r.rank===next.rank&&r.playerRaw===next.playerRaw||
   lineup(r).slice().sort().join('|')===team.slice().sort().join('|'))),
  'duplicate inside incoming 24 '+o.id);
 generated.push(next);
}
must(generated.length===24,'not all 24 reviewed');
const timestamp=new Date().toISOString(),jst=new Date(Date.now()+9*3600000).toISOString().slice(0,10);
for(const o of allOriginal){
 const next=generated.find(x=>x.id===o.id);
 const ent=source.approval(o,next,timestamp);
 must(source.verifyPublished(next,ent),'approval proof did not replay '+o.id);
 ledger.entries.push(ent);
}
const ids=new Set(generated.map(x=>x.id));
review.proposals=review.proposals.filter(x=>!ids.has(x.id));
review.manualReviewedAt=timestamp;
must(review.proposals.length===76-24,'pending queue moved unexpectedly');
status.found=review.proposals.length;
status.manualReviewCandidates=review.proposals.length;
status.reviewOnlyCandidates=review.proposals.filter(x=>x.reviewOnly===true).length;
status.manuallyPublished=(status.manuallyPublished||0)+24;
status.manualReviewProcessed=(status.manualReviewProcessed||0)+24;
status.manualReviewResolvedAt=timestamp;
status.lastReviewedBatchAt=timestamp;
const marker='verified-s33-s35-s37-source-24-20261118';
must(!updates.entries.some(x=>x.id===marker),'update already published');
updates.entries.unshift({id:marker,date:jst,type:'records',
 title:'保存済みEpic順位表からS33/S35/S37の24戦績を安全に追加',
 description:'S33 NAW Solo Cash Cup Round2参加6件（賞金未確認）、S35 ME Console Duos Round1予選6組（上位250組のみ突破・予選$0）、S37 NAW Console Duos Round2の0VR決勝12組（チーム$0・各選手$0）。保存済み連続順位表の取得範囲・日付・本人Epic UUID・公式規則と重複なしを照合。S34の本人UUID不足2件は保留。',
 recordIds:generated.map(x=>x.id)});
const nextResults=[...results,...generated];
must(nextResults.length===oldCount+24&&new Set(nextResults.map(x=>x.id)).size===nextResults.length,
 'source count or unique ID changed');
const validation=validateData({results:nextResults,players,tournaments});
must(validation.errors.length===0,'dataset invalid '+JSON.stringify(validation.errors.slice(0,6)));
const upErrors=validateUpdateLog(nextResults,updates);
must(upErrors.length===0,'updates invalid '+JSON.stringify(upErrors.slice(0,6)));
const beforeCash=results.reduce((n,x)=>n+(Number.isFinite(x.prize)?x.prize:0),0);
const afterCash=nextResults.reduce((n,x)=>n+(Number.isFinite(x.prize)?x.prize:0),0);
must(beforeCash===afterCash&&generated.every(x=>x.prize===0||x.prize===null),
 'cash total unexpectedly changed');
if(!dry){
 publishResults(root,nextResults);
 write('history-sync-review.json',review);write('history-sync-status.json',status);
 write('approval-history.json',ledger);write('updates.json',updates);
}
console.log('VERIFIED_24_PUBLISH '+JSON.stringify({dry,before:oldCount,after:nextResults.length,
 published:generated.length,byMode:Object.fromEntries(groups.map(g=>[g.mode,g.rows.length])),
 projectedPending:review.proposals.length,cashDelta:afterCash-beforeCash,ids:generated.map(x=>x.id)}));
