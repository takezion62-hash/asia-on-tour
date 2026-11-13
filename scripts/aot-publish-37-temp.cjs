'use strict';
/*
 * Temporary reviewed historical candidate publication, 2026-11-13.
 * Saves only genuinely observed original Epic scoreboard rows and separately
 * deduplicates an already verified Fortnite Tracker prize. Both generated
 * scripts/workflows are removed before raising the PR.
 */
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const {loadReviewDb,writeReviewDb,upsertPublicationLog}=require('./reviewed-publication-core.cjs');
const {verifiedPartialPage,sameScannedCandidate}=require('./verified-partial-page.cjs');
const {collision}=require('./manual-approval-core.cjs');
const {validateData}=require('./data-checks.cjs');
const read=n=>JSON.parse(fs.readFileSync(path.join(root,n),'utf8'));
const dry=process.argv.includes('--dry-run');
const now=new Date().toISOString(),today=new Date(Date.now()+9*3600000).toISOString().slice(0,10);
const d=loadReviewDb(root),q=d.reviews.history.proposals;
const reviewed=read('history-sync-reviewed.json');
const alreadyReviewed=new Set(reviewed.entries.map(x=>x.id)),logged=new Set(d.ledger.entries.map(x=>x.id));
const catalog=new Map(d.tournaments.catalog.map(x=>[x.id,x]));
const known=new Set(d.players.candidates.map(x=>x.name));
const byId=new Map(d.results.map(x=>[x.id,x]));
const sourceIds=new Set(d.results.map(x=>x.id));
const originalPrizes=d.results.reduce((n,x)=>n+(typeof x.prize==='number'?Math.round(x.prize*100):0),0);
const rule30='https://www.fortnite.com/news/fortnite-victory-cash-cups-chapter-5-season-3-official-rules';
const rule31='https://www.fortnite.com/news/fortnite-victory-cash-cups-chapter-5-season-4-official-rules';
const cutoff={
 S30:{SoloVictoryCashCup:{ME:2000,NAC:5000,OCE:2000},SoloZBVictoryCashCup:{ME:2000,OCE:2000}},
 S31:{SoloVictoryCashCup:{NAC:10000}}
};
const assert=(ok,msg)=>{if(!ok)throw Error('AOT37_SAFE_PUBLISH: '+msg)};
const lineup=p=>Array.isArray(p.players)&&p.players.length?p.players:[p.player];
function evidence(p){
 assert(/^auto-s\d+-[a-z0-9]{12}$/.test(p.id||'')&&p.verified===true,'candidate ID/verified flag '+p.id);
 assert(!byId.has(p.id)&&!alreadyReviewed.has(p.id)&&!logged.has(p.id),'candidate already reviewed '+p.id);
 const url=new URL(p.source),m=url.pathname.match(/^\/competitive\/events\/(S\d+_[\w]+)\/$/);
 assert(url.protocol==='https:'&&url.hostname==='www.fortnite.com'&&m&&
  url.searchParams.get('region')===p.region&&!url.username&&!url.password&&!url.hash,'untrusted source URL '+p.id);
 const event=m[1],win=url.searchParams.get('round');
 assert(win&&win.startsWith(event+'_')&&win.endsWith('_'+p.region),'incorrect regional window '+p.id);
 assert(p.seasonId===event.match(/^S\d+/)[0],'season mismatch '+p.id);
 const cat=catalog.get(p.tournamentId),names=lineup(p);
 const size={solo:1,duo:2,trio:3,squad:4}[cat?.team];
 assert(cat&&cat.name===p.event&&cat.seasonId===p.seasonId&&cat.sourceEventIds?.includes(event),
  'unknown official event '+p.id);
 assert(Number.isSafeInteger(size)&&names.length===size&&p.player===names.join(' / ')&&
  new Set(names).size===size&&names.every(x=>known.has(x)),'unknown roster member '+p.id);
 for(const k of ['rank','points','kills','vrs','matches'])
  assert(Number.isSafeInteger(p[k])&&p[k]>=(k==='rank'||k==='matches'?1:0),'invalid '+k+' '+p.id);
 assert(p.vrs<=p.matches,'invalid VR count '+p.id);
 const key='epicgames_'+event+'_'+p.region+'/'+win;
 const cps=Object.values(d.scans).map(x=>x.windows?.[key]).filter(Boolean);
 const cp=cps.find(x=>x.rankingOrderValid===true&&
  x.pages===x.nextPage&&x.nextPage>0&&Number.isSafeInteger(x.lastSeenRank)&&x.lastSeenRank>=p.rank&&
  x.proposals?.filter(y=>y.id===p.id&&sameScannedCandidate(y,p)).length===1);
 assert(cp,'unconfirmed original Epic account and score '+p.id);
 const ym=p.date.slice(0,7);
 if(!d.calendar[ym])d.calendar[ym]=read('calendar-history/'+ym+'.json').sessions;
 const cal=d.calendar[ym].find(x=>x.dateJst===p.date&&x.region===p.region&&
  x.tournamentId===p.tournamentId&&x.seasonId===p.seasonId&&
  x.eventId===event&&x.sourceWindowId===win&&x.url===p.source);
 assert(cal&&Number.isFinite(Date.parse(cal.endUtc)),'official session mismatch '+p.id);
 const observedAt=Date.parse(cp.lastSuccessAt);
 assert(Number.isFinite(observedAt)&&observedAt>=Date.parse(cal.endUtc)+4*3600000&&observedAt<=Date.now()+300000,
  'immature original leaderboard '+p.id);
 assert(!cp.lastErrorCode&&!cp.lastError&&!cp.retryAfter&&cp.emptyAttempts===0,
  'unresolved source API error '+p.id);
 assert(cp.complete===true||verifiedPartialPage(p,{end:Date.parse(cal.endUtc)},cp),
  'rank not on a mature, contiguous original leaderboard page '+p.id);
 return {event,win,cat,cp};
}
function classification(p,proof){
 if(p.kind==='予選'){
  assert(p.prize===0&&p.matches<=7&&proof.cat.team==='solo'&&
   proof.win.endsWith('Round1_'+p.region)&&p.round.includes('Round 1 / 予選'),
   'invalid qualifying stage/limit '+p.id);
  const tournament=proof.event.split('_').slice(1).join('_');
  const allowed=cutoff[p.seasonId]?.[tournament]?.[p.region];
  assert(Number.isSafeInteger(allowed)&&p.rank<=allowed,'no official regional qualification rule '+p.id);
  return {policy:'verified-rule',kind:'予選',prize:0,round:p.round.replace(/\/ 予選$/,'/ 予選突破'),
   rule:p.seasonId==='S30'?rule30:rule31,
   note:'保存済みの本人Epic ID・公式開催枠・成熟した連続順位表で'+p.rank+'位、'+p.kills+'K、'+p.vrs+'VRを照合。Epic公式'+p.region+'上位'+allowed+'名の予選突破。予選現金賞金$0。規則: '+(p.seasonId==='S30'?rule30:rule31)};
 }
 assert(p.kind==='参加確認'&&p.prize===null&&p.reviewOnly===true,'unsupported unconfirmed award '+p.id);
 assert(proof.cat.team==='solo'||proof.cat.team==='duo','unsupported participation format '+p.id);
 assert(proof.event==='S33_SoloCashCup'||proof.event==='S30_DuosCashCupZB'||proof.event==='S41_PSCupDaysOfPlay',
  'unexpected attendance-only source '+p.id);
 assert(p.matches<=10&&p.round.includes('参加確認'),'unexpected match cap or stage '+p.id);
 return {policy:'attendance-only',kind:'参加確認',prize:null,round:p.round,rule:null,
  note:'本人Epic ID・保存済み公式順位表の'+p.rank+'位、'+p.kills+'K、'+p.vrs+'VR、'+p.matches+'試合を確認。大会参加だけを掲載。賞金・スキン・予選突破を推測しない。'};
}
const published=[],dupes=[],held=[];
assert(q.length===37,'review queue size changed since inspected: '+q.length);
const triage=new Map(read('candidate-triage.json').queue.map(x=>[x.id,x]));
for(const p of q){
 try{
 const proof=evidence(p);
 const possibleId=triage.get(p.id)?.evidence?.possibleExistingId;
 if(possibleId){
  const previous=byId.get(possibleId);
  assert(p.id==='auto-s42-79a365bd4811'&&
   previous&&previous.verified===true&&previous.id!==p.id&&previous.player===p.player&&
   previous.date===p.date&&previous.region===p.region&&previous.event===p.event&&
   previous.tournamentId===p.tournamentId&&previous.kind==='賞金決勝'&&previous.prize===100&&
   p.vrs===1&&p.points===100&&p.prize===null&&previous.rank===p.rank&&
   ['points','kills','vrs','matches'].every(k=>previous[k]===p[k]),
   'duplicate award not safely equivalent '+p.id);
  dupes.push({candidate:p,existing:previous});continue;
 }
 const info=classification(p,proof);
 const {reviewOnly,reviewReason,teamAccountIds,...raw}=p;
 const rec={...raw,kind:info.kind,round:info.round,prize:info.prize,note:info.note};
 assert(!sourceIds.has(rec.id),'duplicate record ID '+rec.id);
 assert(!d.results.some(x=>collision(x,rec,d.players.confirmedAliases||{})),
  'possible existing overlapping event '+rec.id);
 assert(!published.some(x=>collision(x.record,rec,d.players.confirmedAliases||{})),
  'possible batch duplicate '+rec.id);
 published.push({candidate:p,record:rec,info});sourceIds.add(rec.id);
 }catch(e){held.push({id:p.id,player:p.player,reason:String(e.message||e)})}
}
const done=new Set([...published.map(x=>x.candidate.id),...dupes.map(x=>x.candidate.id)]);
const report={dry,before:d.results.length,added:published.length,qualified:published.filter(x=>x.info.policy==='verified-rule').length,
 attendance:published.filter(x=>x.info.policy==='attendance-only').length,dupes:dupes.length,
 held,after:d.results.length+published.length,remaining:q.length-done.size,
 addedIds:published.map(x=>x.record.id),names:published.map(x=>({player:x.record.player,date:x.record.date,region:x.record.region,rank:x.record.rank,kind:x.record.kind,kills:x.record.kills,vrs:x.record.vrs}))};
console.log('AOT37_PUBLISH '+JSON.stringify(report));
if(dry)process.exit(0);
assert(published.length>0,'no safe rows; refuse empty publishing');
for(const {candidate,record,info} of published){
 d.results.push(record);
 d.ledger.entries.push({id:candidate.id,decision:'published',recordId:record.id,policy:info.policy,
  approvedAt:now,approvedBy:'ChatGPT / user-requested original Epic source review',source:candidate.source,rule:info.rule,
  evidence:'Exact saved Epic-ID row and score, mature continuous leaderboard pages, official schedule; no inferred payout'});
 reviewed.entries.push({id:candidate.id,decision:'published',recordId:record.id,
  reviewedAt:now,source:candidate.source,policy:info.policy,rule:info.rule});
}
for(const {candidate,existing} of dupes){
 reviewed.entries.push({id:candidate.id,decision:'already-published',existingId:existing.id,
  reviewedAt:now,source:candidate.source,
  note:'Exact same official event, player, rank, points, kills, VR, matches and $100 existing verified Tracker result. Existing award remains unchanged.'});
}
assert(new Set(reviewed.entries.map(x=>x.id)).size===reviewed.entries.length,'duplicate reviewed history');
d.reviews.history.proposals=d.reviews.history.proposals.filter(x=>!done.has(x.id));
d.reviews.history.manualReviewedAt=now;
d.statuses.history.found=d.reviews.history.proposals.length;
d.statuses.history.manualReviewCandidates=d.reviews.history.proposals.length;
d.statuses.history.reviewOnlyCandidates=d.reviews.history.proposals.filter(x=>x.reviewOnly).length;
d.statuses.history.manuallyPublished=(d.statuses.history.manuallyPublished||0)+published.length;
d.statuses.history.manuallyResolvedDuplicates=(d.statuses.history.manuallyResolvedDuplicates||0)+dupes.length;
d.statuses.history.lastReviewedBatchAt=now;
d.statuses.history.latestManualReview={reviewedAt:now,reviewedCandidates:done.size,published:published.length,
  duplicatesResolved:dupes.length,remainingPending:d.reviews.history.proposals.length,
  policy:'Epic-ID and original mature ranked checkpoint, official C5S3/C5S4 qualifier cutoffs, no inferred awards'};
d.statuses.history.message='確認候補'+q.length+'件の元順位表を照合し、'+published.length+
 '件を正式掲載・'+dupes.length+'件は既掲載賞金と重複整理、残り'+d.reviews.history.proposals.length+'件。';
if(published.length)upsertPublicationLog(d.updates,{id:'reviewed-history-publish-fast-20261113',date:today,
 title:'Epic保存順位表の再調査で'+published.length+'件を追加',
 description:'2024年Victory Cup予選突破と、賞金不明の参加確認を本人Epic ID・公式大会カレンダー・成熟した連続順位表で検証。既存の決勝賞金記録は重複整理。賞金は推定しない。',
 recordIds:published.map(x=>x.record.id)});
const nextPrizes=d.results.reduce((n,x)=>n+(typeof x.prize==='number'?Math.round(x.prize*100):0),0);
assert(nextPrizes===originalPrizes,'existing cash changed by proposed publication');
const check=validateData({results:d.results,players:d.players,tournaments:d.tournaments});
assert(check.errors.length===0,'invalid publication payload '+JSON.stringify(check.errors.slice(0,5)));
writeReviewDb(root,d);
reviewed.reviewedAt=now;
fs.writeFileSync(path.join(root,'history-sync-reviewed.json'),JSON.stringify(reviewed,null,2)+'\n');
const lines=[
 '# 2026-11-13 確認待ち37件・保存済みEpic原本の再検証',
 '',
 '- 今回の対象: '+q.length+'件',
 '- 正式掲載: '+published.length+'件（予選突破 '+report.qualified+'件、参加確認 '+report.attendance+'件）',
 '- 既掲載と同一の記録: '+dupes.length+'件',
 '- 根拠不足で保留: '+held.length+'件',
 '- 総戦績: '+report.before+' → '+report.after,
 '- 個人・チーム賞金: 変動なし',
 '',
 '## 掲載結果',
 '',
 '| 日付 | 地域 | 選手 / チーム | 順位 | K | VR | 確認賞金 | 区分 |',
 '|---|---|---|---:|---:|---:|---|---|',
 ...published.map(x=>{const r=x.record;return '| '+r.date+' | '+r.region+' | '+r.player+
 ' | '+r.rank+' | '+r.kills+' | '+r.vrs+' | '+(r.prize===null?'未確認':'$'+r.prize)+' | '+
 (x.info.policy==='verified-rule'?'予選突破':'参加確認')+' |'}),
 '',
 '## 重複整理',
 ...dupes.map(x=>'- '+x.candidate.player+'（'+x.candidate.date+' '+x.candidate.region+
 '）既掲載ID '+x.existing.id+'、順位'+x.existing.rank+'、1VR、賞金$'+x.existing.prize+
 '。賞金を再加算せず、既存の記録を保持'),
 '',
 '## 保留',
 ...(held.length?held.map(x=>'- '+x.id+' '+x.player+'：'+x.reason):['- なし']),
 '',
 '## 審査条件',
 '- 元のEpicアカウントID・得点・順位・キル・VR・試合数が保存済み順位表と完全一致',
 '- 大会・地域・開催日時・ラウンドを公式カレンダーの同一ウィンドウで確認',
 '- 完了していない順位表も、取得済みの連続ページが成熟・整合し、APIエラーがない場合のみ当該行を掲載',
 '- S30/S31 Victory Cupの予選突破は地域別の当時の公式規則で確定',
 '- 出場確認の賞金は未確認のまま。既存戦績・賞金・順位の上書きなし',
 '- 関連規則: '+rule30,
 '- 関連規則: '+rule31
].join('\n')+'\n';
fs.mkdirSync(path.join(root,'review-reports'),{recursive:true});
fs.writeFileSync(path.join(root,'review-reports/2026-11-13-reviewed-37-fast.md'),lines);
