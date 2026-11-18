'use strict';
// One-time exact 6-player-pair publication from the saved mature Epic prefix.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const {readResults,publishResults}=require('./source-results-store.cjs');
const {sameScannedCandidate,verifiedPartialPage}=require('./verified-partial-page.cjs');
const {validateData}=require('./data-checks.cjs');
const {validateUpdateLog}=require('./validate-updates.cjs');
const verified=require('./verified-s35-me-six-20261118.cjs');
const dry=process.argv.includes('--dry-run');
if(!dry&&!process.argv.includes('--apply'))throw Error('Explicit --dry-run or --apply required');
verified.validate();
const t=read('tournament-rules.json').rules.find(x=>x.id==='ch6s2-console-duos-victory');
const cat=read('tournaments.json');
const calendar=read('calendar-history/2025-05.json').sessions;
const win=calendar.filter(x=>x.sourceWindowId===verified.WINDOW&&x.eventId===verified.EVENT&&
 x.tournamentId===t?.id&&x.region==='ME'&&x.dateJst==='2025-05-17');
const fail=(v,msg)=>{if(!v)throw Error('S35_SIX_PUBLISH: '+msg)};
fail(t&&t.source===verified.RULE&&t.advance.ME===250&&t.prizePerVictory===100&&
 t.teamPrizePerVictory===200&&t.matchCaps['予選']===7&&
 cat.catalog.some(x=>x.id===t.id&&x.team==='duo'), 'official rules/catalog');
fail(win.length===1&&Number.isFinite(Date.parse(win[0].endUtc)),'official calendar window');
const scan=read('history-sync-scan.json').windows['epicgames_'+verified.EVENT+'_ME/'+verified.WINDOW];
const last=Date.parse(scan?.lastSuccessAt||''),end=Date.parse(win[0].endUtc);
fail(scan?.rankingOrderValid===true&&scan.pages===scan.nextPage&&
 scan.nextPage>=4&&scan.lastSeenRank>=400&&!scan.lastErrorCode&&!scan.lastError&&
 !scan.retryAfter&&scan.emptyAttempts===0&&last-end>4*3600000,
 'no mature contiguous, error-free prefix');
const reviews=read('history-sync-review.json'),status=read('history-sync-status.json');
const ledger=read('approval-history.json'),updates=read('updates.json');
const players=read('players.json'),known=new Set(players.candidates.map(x=>x.name));
const rows=readResults(root).rows;
const existing=new Set(rows.map(x=>x.id)),existingLedger=new Set(ledger.entries.map(x=>x.id));
fail(existing.size===rows.length&&existingLedger.size===ledger.entries.length,
 'duplicate IDs already present');
let added=[];
for(const x of verified.manifest.rows){
 const source=reviews.proposals.filter(z=>z.id===x.id);
 fail(source.length===1&&sameScannedCandidate(source[0],x),'candidate changed '+x.id);
 console.log('S35_SIX_CHECKPOINT '+JSON.stringify({id:x.id,complete:scan.complete,pages:scan.pages,nextPage:scan.nextPage,totalPages:scan.totalPages,lastSeenRank:scan.lastSeenRank,lastSuccessAt:scan.lastSuccessAt,lastErrorCode:scan.lastErrorCode,lastError:scan.lastError,retryAfter:scan.retryAfter,emptyAttempts:scan.emptyAttempts,hasCandidate:scan.proposals.some(z=>z.id===x.id),end}));
 fail((scan.complete===true&&scan.pages>=scan.totalPages)||verifiedPartialPage(x,{end},scan),'rank not in mature completed/prefix leaderboard '+x.id);
 fail(scan.proposals.filter(z=>z.id===x.id&&sameScannedCandidate(z,x)).length===1,
  'saved exact score and Epic ID mismatch '+x.id);
 fail(x.players.every(n=>known.has(n))&&x.teamAccountIds.every(y=>/^[0-9a-f]{32}$/.test(y)),
  'unverified player roster '+x.id);
 fail(!existing.has(x.id)&&!existingLedger.has(x.id),'already published '+x.id);
 const normalized=x.players.slice().sort((a,b)=>a.localeCompare(b,'ja')).join(' / ');
 const overlap=rows.filter(r=>r.date===x.date&&r.region===x.region&&
  r.tournamentId===x.tournamentId&&
  String(r.source).includes(verified.WINDOW)&&
  ((r.players||[r.player]).slice().sort((a,b)=>a.localeCompare(b,'ja')).join(' / ')===normalized||
   r.rank===x.rank&&r.playerRaw===x.playerRaw));
 fail(!overlap.length,'possible duplicate original '+x.id+' '+overlap.map(y=>y.id));
 const record=verified.record(x),entry=verified.ledger(x,record);
 fail(verified.verifyRow(record,entry),'source-sealed publication failed '+x.id);
 rows.push(record);existing.add(x.id);ledger.entries.push(entry);existingLedger.add(entry.id);added.push(record);
}
fail(added.length===6&&added.every(x=>x.prize===0)&&added.filter(x=>x.round.endsWith('/ 予選突破')).length===1,
 'six awards/ME cutoff not exact');
const gone=new Set(added.map(x=>x.id));
reviews.proposals=reviews.proposals.filter(x=>!gone.has(x.id));
reviews.manualReviewedAt='2026-11-18T01:00:00Z';
status.found=reviews.proposals.length;
status.manualReviewCandidates=reviews.proposals.length;
status.reviewOnlyCandidates=reviews.proposals.filter(x=>x.reviewOnly===true).length;
status.manuallyPublished=(status.manuallyPublished||0)+6;
status.lastReviewedBatchAt='2026-11-18T01:00:00Z';
ledger.reviewedAt='2026-11-18T01:00:00Z';
fail(!updates.entries.some(x=>x.id==='s35-me-six-partial-20261118'),'publication already logged');
updates.entries.unshift({id:'s35-me-six-partial-20261118',date:'2026-11-18',
 type:'records',title:'S35 ME Console Duos予選6組の成績を追加',
 description:'2025/5/17 ME Event1 Round1の連続した成熟済み公式Epic順位表と2名のEpic IDを照合。228位kaf/Ruraは公式上位250組で予選突破、残り5組は突破圏外の参加確認。いずれも予選賞金$0。決勝賞金やスキンは加算しない。',
 recordIds:added.map(x=>x.id)});
fail(validateData({results:rows,players,tournaments:cat}).errors.length===0,'data validator');
fail(validateUpdateLog(rows,updates).length===0,'updates validator');
if(!dry){
 publishResults(root,rows);
 for(const [f,o] of [['history-sync-review.json',reviews],['history-sync-status.json',status],
  ['approval-history.json',ledger],['updates.json',updates]])
  fs.writeFileSync(path.join(root,f),JSON.stringify(o,null,2)+'\n');
}
console.log('S35_ME_SIX '+JSON.stringify({dry,source:rows.length-6,final:rows.length,remainingHistory:reviews.proposals.length,
 added:added.map(x=>({id:x.id,player:x.player,rank:x.rank,round:x.round,prize:x.prize}))}));
