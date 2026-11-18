'use strict';
// One-time fail-closed publication: 38 original source-locked Epic candidates.
// Leaves 19 unverified S30 NAC and 14 transient S37 NAW, plus held S34.
const path=require('node:path'),fs=require('node:fs');
const root=path.resolve(__dirname,'..');
const {readResults,publishResults}=require('./source-results-store.cjs');
const {validateData}=require('./data-checks.cjs');
const {validateUpdateLog}=require('./validate-updates.cjs');
const {sameScannedCandidate,verifiedPartialPage}=require('./verified-partial-page.cjs');
const {linkedAccounts}=require('./osirion-sync.cjs');
const proof=require('./verified-bulk-s35-s37-20261118.cjs');
const dry=process.argv.includes('--dry-run');
const load=x=>JSON.parse(fs.readFileSync(path.join(root,x),'utf8'));
const write=(x,o)=>fs.writeFileSync(path.join(root,x),JSON.stringify(o,null,2)+'\n');
const must=(ok,msg)=>{if(!ok)throw Error('PUBLISH_38_REVIEW '+msg)};
const t=load('tournaments.json'),rules=load('tournament-rules.json'),
 players=load('players.json'),scans=load('history-sync-scan.json').windows,
 review=load('history-sync-review.json'),status=load('history-sync-status.json'),
 ledger=load('approval-history.json'),updates=load('updates.json'),
 results=readResults(root).rows;
const baseline=results.length,ids=new Set(results.map(x=>x.id));
const known=new Set(players.candidates.map(x=>x.name));
const aliases=players.confirmedAliases||{};
const earlier=new Set(ledger.entries.map(x=>x.id));
const existingAccounts=linkedAccounts({results,players});
const linked=new Map(existingAccounts.accounts.map(x=>[x.epicAccountId,x.player]));
must(baseline>=8400&&ids.size===baseline&&earlier.size===ledger.entries.length,'baseline source/ledger inconsistent');
must(proof.validateManifest(),'invalid pinned proof');
const published=[];
const calendar=new Map();
for(const original of proof.manifest.rows){
 must(!ids.has(original.id)&&!earlier.has(original.id),'already published ID '+original.id);
 const q=review.proposals.filter(x=>x.id===original.id);
 must(q.length===1&&sameScannedCandidate(q[0],original),'review item changed '+original.id);
 const rule=proof.ruleFor(original,rules);
 const team=original.players;
 must(team.length===2&&team.every(p=>known.has(p)),'player not linked to existing AOT registry '+original.id);
 for(let i=0;i<2;i++){
  const mapped=linked.get(original.teamAccountIds[i]);
  must(!mapped||mapped===team[i]||aliases[team[i]]?.includes(mapped)||aliases[mapped]?.includes(team[i]),
   'prior Epic UUID belongs to another player '+original.id);
 }
 const u=new URL(original.source);
 const windowId=u.searchParams.get('round'),eventId=decodeURIComponent(u.pathname.split('/')[3]);
 must(u.protocol==='https:'&&u.hostname==='www.fortnite.com'&&
  u.pathname==='/competitive/events/'+eventId+'/'&&
  u.searchParams.get('region')===original.region&&
  windowId===eventId+'_Event'+(original.date==='2025-08-31'?3:original.date==='2025-05-17'?1:2)+
    'Round'+(original.kind==='予選'?1:2)+'_'+original.region&&
  rule.eventIds.includes(eventId),'official event and Round ID mismatch '+original.id);
 const key='epicgames_'+eventId+'_'+original.region+'/'+windowId;
 const cp=scans[key];must(cp?.rankingOrderValid===true&&cp.proposals?.filter(x=>
  sameScannedCandidate(x,original)).length===1,'original leaderboard score differs '+original.id);
 const month=original.date.slice(0,7);
 if(!calendar.has(month))calendar.set(month,load('calendar-history/'+month+'.json').sessions);
 const sessions=calendar.get(month).filter(x=>x.eventId===eventId&&
  x.sourceWindowId===windowId&&x.dateJst===original.date&&x.region===original.region&&
  x.tournamentId===original.tournamentId&&x.seasonId===original.seasonId);
 must(sessions.length===1,'original Epic session not uniquely found '+original.id);
 const session=sessions[0],end=Date.parse(session.endUtc),seen=Date.parse(cp.lastSuccessAt);
 must(Number.isFinite(end)&&Number.isFinite(seen)&&
  seen-end>=4*3600000&&Date.now()-end>=4*3600000,'session not matured '+original.id);
 if(original.kind==='予選')
  must(verifiedPartialPage(original,{end},cp),'incomplete/corrupt partial qualifier prefix '+original.id);
 else must(cp.complete===true&&cp.nextPage===cp.totalPages,'final leaderboard incomplete '+original.id);
 must(!cp.lastErrorCode&&!cp.lastError&&!cp.retryAfter,'original checkpoint retry pending '+original.id);
 const result=proof.scoreRecord(original,rules,t),entry=proof.approvalEntry(original,result);
 must(proof.verifyPublished(result,entry),'pinned approval mismatch '+original.id);
 const dup=results.find(x=>x.date===result.date&&x.region===result.region&&
  x.tournamentId===result.tournamentId&&(
   x.id===result.id||
   ((x.player===result.player||x.rank===result.rank)&&
    (function(){try{return new URL(x.source).searchParams.get('round')===windowId}catch{return false}})())));
 must(!dup,'existing original event/roster/rank conflict '+original.id+': '+dup?.id);
 results.push(result);ids.add(result.id);ledger.entries.push(entry);earlier.add(entry.id);
 published.push({id:result.id,kind:result.kind,rank:result.rank,player:result.player,
  prize:result.prize,perPlayer:result.prizePerPlayer||0});
}
must(published.length===38&&results.length===baseline+38&&
 published.filter(x=>x.prize>0).length===1&&
 published.reduce((n,x)=>n+x.prize,0)===200,'expected 38 results and one $200/team final');
const publishedIds=new Set(published.map(x=>x.id));
review.proposals=review.proposals.filter(x=>!publishedIds.has(x.id));
review.manualReviewedAt='2026-11-18T00:00:00Z';
status.found=review.proposals.length;
status.manualReviewCandidates=review.proposals.length;
status.reviewOnlyCandidates=review.proposals.filter(x=>x.reviewOnly===true).length;
status.manualReviewProcessed=(status.manualReviewProcessed||0)+38;
status.manualReviewResolvedAt='2026-11-18T00:00:00Z';
updates.entries.unshift({id:'verified-duos-s35-s37-bulk-20261118',date:'2026-11-18',
 type:'records',title:'2025年5月S35 Console Duos中心に38戦績を一括検証掲載',
 description:'Epic公式May 2025 Console Duos規則、保存済み全ページ決勝順位表・成熟済み連続予選ページ、本人2名Epic ID、開催枠と重複を38件検証。S35 ME予選19組（うち2組は突破圏外参加）、決勝18組、S37 OCE 0VR決勝1組を追加。S35 ME10位 asvaswgernb/Teddy 1VRのみチーム$200・各$100、その他決勝は0VRで$0。受給資格・支払いは未確認。',
 recordIds:published.map(x=>x.id)});
const check=validateData({results,players,tournaments:t});
must(check.errors.length===0,'site data failed '+JSON.stringify(check.errors.slice(0,4)));
const updateErrors=validateUpdateLog(results,updates);
must(!updateErrors.length,'update log failed '+JSON.stringify(updateErrors.slice(0,4)));
if(!dry){
 publishResults(root,results);write('history-sync-review.json',review);
 write('history-sync-status.json',status);write('approval-history.json',ledger);
 write('updates.json',updates);
}
console.log('BULK_S35_S37_PUBLISH '+JSON.stringify({dry,before:baseline,after:results.length,
 published:published.length,qualifiers:published.filter(x=>x.kind==='予選').length,
 outOfCutoff:published.filter(x=>x.kind==='参加確認').length,
 zeroVR:published.filter(x=>x.kind==='賞金決勝'&&x.prize===0).length,
 cash:published.filter(x=>x.prize>0),remaining:review.proposals.length}));
