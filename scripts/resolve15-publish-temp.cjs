'use strict';
// Narrow review of 15 previously held candidates. Only source-observed rows are
// eligible. An HTTP 429 on an *unread later page* is not treated as a bad value
// on an already saved, contiguous, verified page; this exception is scoped to
// the exact archived checkpoint and never grants an unknown cash/skin award.
const fs=require('node:fs'),path=require('node:path');
const {loadReviewDb,writeReviewDb,upsertPublicationLog}=require('./reviewed-publication-core.cjs');
const {sameScannedCandidate}=require('./verified-partial-page.cjs');
const {collision}=require('./manual-approval-core.cjs');
const {validateData}=require('./data-checks.cjs');
const root=path.resolve(__dirname,'..'),dry=process.argv.includes('--dry-run');
const now=new Date().toISOString(),today=new Date(Date.parse(now)+9*3600000).toISOString().slice(0,10);
const read=name=>JSON.parse(fs.readFileSync(path.join(root,name),'utf8'));
const db=loadReviewDb(root),reviewed=read('history-sync-reviewed.json');
const byId=new Map(db.results.map(r=>[r.id,r])),triage=new Map(read('candidate-triage.json').queue.map(x=>[x.id,x]));
const oldReview=new Set(reviewed.entries.map(x=>x.id)),oldLedger=new Set(db.ledger.entries.map(x=>x.id));
const catalog=new Map(db.tournaments.catalog.map(x=>[x.id,x])),known=new Set(db.players.candidates.map(x=>x.name));
const original=db.reviews.history.proposals.slice();
const EXPECT_IDS=new Set([
 'auto-s41-8e950bbbae00','auto-s30-83bebdb937f0',
 'auto-s42-62c4a8a76cd0','auto-s42-f4587a6acf5d','auto-s42-8102c02bf5b3','auto-s42-3a99f7b2a280','auto-s42-3bf1faec39b0',
 'auto-s30-095c1d0edfbc','auto-s30-1483215dfce8','auto-s31-34d62bd38ec2','auto-s31-f01a4e37f369','auto-s31-f6b118894425',
 'auto-s31-a2ff6c3fd5a1','auto-s41-f9685b2de3b7','auto-s41-39525da1acf5'
]);
const S30='https://www.fortnite.com/news/fortnite-victory-cash-cups-chapter-5-season-3-official-rules';
const S31='https://www.fortnite.com/news/fortnite-victory-cash-cups-chapter-5-season-4-official-rules';
const ALLOWED=new Map([
 ['S30|2024-07-23|NAC|ch5s3-solo-victory-cup',{kind:'qualifier',rule:S30,cutoff:5000,event:'S30_SoloVictoryCashCup',round:'Event6Round1',cap:7}],
 ['S31|2024-09-03|ME|ch5s4-solo-victory-cup',{kind:'qualifier',rule:S31,cutoff:2000,event:'S31_SoloVictoryCashCup',round:'Event1Round1',cap:7}],
 ['S31|2024-09-10|NAC|ch5s4-solo-victory-cup',{kind:'zero-final',rule:S31,event:'S31_SoloVictoryCashCup',round:'Event2Round2',cap:3}],
 ['S30|2024-07-18|ME|ch5s3-zb-duos-cash',{kind:'attendance',event:'S30_DuosCashCupZB',round:'Event5Round1',cap:10}],
 ['S41|2026-06-07|ME|ch7s3-days-of-play-playstation-cup-br',{kind:'attendance',event:'S41_PSCupDaysOfPlay',round:'Qualifier',cap:10}],
 ['S41|2026-06-08|NAC|ch7s3-days-of-play-playstation-cup-br',{kind:'attendance',event:'S41_PSCupDaysOfPlay',round:'Qualifier',cap:10}]
]);
const assert=(ok,message)=>{if(!ok)throw Error(message)};
const take=r=>Array.isArray(r.players)&&r.players.length?r.players:[r.player];
function observed(r,{allow429}){
 assert(r.verified===true&&/^auto-s\d+-[a-z0-9]{12}$/.test(r.id),'invalid original verification flag/ID');
 assert(!byId.has(r.id)&&!oldReview.has(r.id)&&!oldLedger.has(r.id),'previously reviewed or published ID '+r.id);
 const u=new URL(r.source),m=u.pathname.match(/^\/competitive\/events\/(S\d+_[A-Za-z0-9_]+)\/$/);
 assert(u.protocol==='https:'&&u.hostname==='www.fortnite.com'&&m&&u.searchParams.get('region')===r.region,
   'original event URL mismatch '+r.id);
 const event=m[1],window=u.searchParams.get('round');
 assert(window?.startsWith(r.seasonId+'_')&&window.endsWith('_'+r.region),'window mismatch '+r.id);
 const cat=catalog.get(r.tournamentId);
 assert(cat&&cat.name===r.event&&cat.seasonId===r.seasonId&&cat.sourceEventIds?.includes(event),'tournament/catalog mismatch '+r.id);
 const team=take(r);
 assert(team.length==={solo:1,duo:2,trio:3,squad:4}[cat.team]&&new Set(team).size===team.length&&team.every(x=>known.has(x))&&team.join(' / ')===r.player,
  'roster mismatch '+r.id);
 for(const key of ['rank','points','kills','vrs','matches'])
  assert(Number.isSafeInteger(r[key])&&r[key]>=(['rank','matches'].includes(key)?1:0),'invalid numeric value '+r.id+':'+key);
 assert(r.vrs<=r.matches,'VR count > games '+r.id);
 const ym=r.date.slice(0,7);
 if(!db.calendar[ym])db.calendar[ym]=read('calendar-history/'+ym+'.json').sessions;
 const session=db.calendar[ym].find(x=>x.dateJst===r.date&&x.region===r.region&&x.tournamentId===r.tournamentId&&
   x.seasonId===r.seasonId&&x.eventId===event&&x.sourceWindowId===window&&x.url===r.source);
 assert(session&&Number.isFinite(Date.parse(session.endUtc)),'original official calendar missing '+r.id);
 const key='epicgames_'+event+'_'+r.region+'/'+window;
 const cp=Object.values(db.scans).map(x=>x.windows?.[key]).find(Boolean);
 assert(cp&&cp.rankingOrderValid===true&&Number.isSafeInteger(cp.pages)&&cp.pages>0&&cp.pages===cp.nextPage&&
   Number.isSafeInteger(cp.lastSeenRank)&&cp.lastSeenRank>=r.rank&&
   Array.isArray(cp.proposals)&&cp.proposals.filter(x=>x.id===r.id&&sameScannedCandidate(x,r)).length===1,
   'candidate not confirmed on contiguous original leaderboard '+r.id);
 const observedAt=Date.parse(cp.lastSuccessAt);
 assert(Number.isFinite(observedAt)&&observedAt>=Date.parse(session.endUtc)+4*3600000&&observedAt<=Date.now()+300000,
  'leaderboard scan not mature '+r.id);
 assert(cp.emptyAttempts===0||cp.emptyAttempts==null,'source returned empty/malformed page '+r.id);
 if(allow429){
   // The 429 is on page nextPage *after* the rank was already observed.
   // Never use this exception for malformed, 403/404, or unscanned ranks.
   assert(cp.complete===false&&cp.totalPages>cp.nextPage&&
      cp.lastErrorCode==='OSIRION_TRANSIENT'&&/^Osirion API HTTP 429 \/v1\/tournaments\/leaderboard$/.test(cp.lastError||'')&&
      Number.isFinite(Date.parse(cp.retryAfter||''))&&Date.parse(cp.retryAfter)>=observedAt,
      'API partial prefix not safely confirmed '+r.id);
 }else assert(cp.lastErrorCode==null&&!cp.lastError,'duplicate candidate checkpoint source error '+r.id);
 return {event,window,session,cp,cat};
}
function classify(r,proof){
 const spec=ALLOWED.get([r.seasonId,r.date,r.region,r.tournamentId].join('|'));
 assert(spec&&proof.event===spec.event&&proof.window===r.seasonId+'_'+(spec.event.split('_').slice(1).join('_'))+'_'+spec.round+'_'+r.region ||
  false,''); // placeholder replaced below
}
const published=[],duplicates=[],held=[];
function classifyExact(r,proof){
 const spec=ALLOWED.get([r.seasonId,r.date,r.region,r.tournamentId].join('|'));
 assert(spec&&proof.event===spec.event&&proof.window===spec.event+'_'+spec.round+'_'+r.region&&r.matches<=spec.cap,
  'no explicit dated official-window allowlist '+r.id);
 if(spec.kind==='qualifier'){
  assert(proof.cat.team==='solo'&&r.kind==='予選'&&r.prize===0&&r.rank<=spec.cutoff&&r.round.includes('Round 1 / 予選'),
   'qualifier limit or record mismatch '+r.id);
  return {kind:'予選',round:r.round.replace(/\/ 予選$/,'/ 予選突破'),prize:0,policy:'verified-rule',rule:spec.rule,
   note:'本人Epic IDと保存済み順位表の'+r.rank+'位・'+r.kills+'K・'+r.vrs+'VRを確認。期限を十分に経過した連続順位表の保存済みページに記録があり、以降のページで429アクセス制限が発生したことを別途確認。公式'+r.region+'上位'+spec.cutoff+'名の予選突破。予選現金賞金$0。規則: '+spec.rule};
 }
 if(spec.kind==='zero-final'){
  assert(proof.cat.team==='solo'&&r.kind==='賞金決勝'&&r.prize===null&&r.points===0&&r.vrs===0&&r.round.includes('Round 2 / 賞金決勝'),
   'cannot verify zero-VR final payout '+r.id);
  return {kind:'賞金決勝',round:r.round,prize:0,policy:'verified-zero-final',rule:spec.rule,
   note:'Epic本人ID・公式決勝開催枠・保存済み順位表で0pt/0VR/3試合を確認。保存済みの当該ページは連続取得で有効、続きのページ取得のみHTTP 429で中断。C5S4公式規則は決勝VRのみ賞金付与のため$0。規則: '+spec.rule};
 }
 assert(spec.kind==='attendance'&&r.kind==='参加確認'&&r.reviewOnly===true&&r.prize===null,
   'not a verified attendance-only candidate '+r.id);
 return {kind:'参加確認',round:r.round,prize:null,policy:'attendance-only',rule:null,
   note:'元のEpic本人ID・公式開催枠・保存済み順位表の'+r.rank+'位を確認。連続して取得した順位表ページ内で実績を確認後、それ以降の取得のみHTTP 429で中断。参加実績として記録し、現金賞金・予選突破・スキン報酬を推定しない。'};
}
for(const r of original){
 try{
 assert(EXPECT_IDS.has(r.id),'candidate not in exact 15-ID reviewed scope '+r.id);
 const existingId=triage.get(r.id)?.evidence?.possibleExistingId;
 if(existingId){
  const proof=observed(r,{allow429:false});
  const old=byId.get(existingId);
  assert(old&&old.verified===true&&proof.cat.series==='skin-cup'&&old.kind==='スキン大会'&&old.prize===0&&
   old.tournamentId===r.tournamentId&&old.event===r.event&&old.player===r.player&&
   old.date===r.date&&old.region===r.region&&old.rank===r.rank+1&&
   ['points','kills','vrs','matches'].every(key=>old[key]===r[key]),
   'skin record not strictly equivalent or 1-place Tracker rank difference unproven '+r.id);
  duplicates.push({candidate:r,existingId});
 }else{
  const proof=observed(r,{allow429:true});
  const resolution=classifyExact(r,proof);
  const {reviewOnly,reviewReason,teamAccountIds,...data}=r;
  const rec={...data,kind:resolution.kind,round:resolution.round,prize:resolution.prize,note:resolution.note};
  assert(!db.results.some(x=>collision(x,rec,db.players.confirmedAliases||{})),
   'existing performance collision '+r.id);
  assert(!published.some(x=>collision(x.record,rec,db.players.confirmedAliases||{})),
   'same batch performance collision '+r.id);
  published.push({candidate:r,record:rec,resolution});
 }
 }catch(e){held.push({id:r.id,player:r.player,reason:e.message})}
}
const next=new Set([...published.map(x=>x.candidate.id),...duplicates.map(x=>x.candidate.id)]);
const report={dry,original:original.length,published:published.map(x=>({id:x.record.id,name:x.record.player,date:x.record.date,region:x.record.region,
 rank:x.record.rank,kills:x.record.kills,vrs:x.record.vrs,kind:x.record.kind,prize:x.record.prize,policy:x.resolution.policy})),
 duplicates:duplicates.map(x=>({id:x.candidate.id,name:x.candidate.player,trackerResultId:x.existingId,
 trackerRank:x.candidate.rank+1,originalRank:x.candidate.rank})),held,
 before:db.results.length,after:db.results.length+published.length,remaining:original.length-next.size};
assert(new Set(original.map(x=>x.id)).size===original.length,'duplicate queue IDs');
console.log('REMAINING_15_REVIEW '+JSON.stringify(report));
if(dry)process.exit(0);
assert(next.size>0,'No verified candidate to resolve; no file writes');
for(const {candidate,record,resolution} of published){
 db.results.push(record);byId.set(record.id,record);
 db.ledger.entries.push({
  id:candidate.id,decision:'published',recordId:record.id,approvedAt:now,
  policy:resolution.policy,approvedBy:'ChatGPT / user-authorized evidence review',
  rule:resolution.rule,source:candidate.source,
  evidence:'Exact saved Epic account/score, official session and mature contiguous observed leaderboard pages; subsequent HTTP 429 confined to unseen pages; no inferred cash'
 });
 reviewed.entries.push({id:candidate.id,decision:'published',recordId:record.id,reviewedAt:now,
  source:candidate.source,policy:resolution.policy,rule:resolution.rule});
}
for(const {candidate,existingId} of duplicates){
 reviewed.entries.push({id:candidate.id,decision:'already-published',existingId,reviewedAt:now,
  source:candidate.source,note:'Same official event/person and exact points/kills/VR/matches; provider original leaderboard rank '+candidate.rank+
   ' vs existing Fortnite Tracker rank '+(candidate.rank+1)+'. Preserve original Tracker published rank, award and record ID.'});
}
db.reviews.history.proposals=db.reviews.history.proposals.filter(x=>!next.has(x.id));
db.reviews.history.manualReviewedAt=now;
reviewed.reviewedAt=now;db.ledger.reviewedAt=now;
const status=db.statuses.history;
status.found=db.reviews.history.proposals.length;
status.manualReviewCandidates=db.reviews.history.proposals.length;
status.reviewOnlyCandidates=db.reviews.history.proposals.filter(x=>x.reviewOnly).length;
status.manuallyPublished=(status.manuallyPublished||0)+published.length;
status.manuallyResolvedDuplicates=(status.manuallyResolvedDuplicates||0)+duplicates.length;
status.lastReviewedBatchAt=now;
status.latestManualReview={reviewedAt:now,reviewedCandidates:next.size,published:published.length,
 duplicatesResolved:duplicates.length,remainingPending:db.reviews.history.proposals.length,
 policy:'Original Epic-ID checkpoint rank, official session, mature captured page before subsequent HTTP 429; duplicates require exact equal score + one Tracker rank shift'};
status.message='保存済み順位表の取得済み部分を厳格照合して'+published.length+
 '件掲載、既掲載'+duplicates.length+'件を重複整理。未解決'+db.reviews.history.proposals.length+'件。';
if(published.length){
 upsertPublicationLog(db.updates,{id:'pending-evidence-continuation-20261113',date:today,
 title:'保留候補の再検証：'+published.length+'件を追加、既掲載重複'+duplicates.length+'件を整理',
 description:'大会終了後の連続取得済みEpic本人ID順位表で確認できた部分だけを使用。未取得後続ページは429により保留したまま。予選公式基準・決勝0VR・参加確認を区別し、現金賞金・スキンを推定せず、既存のTracker順位を保持。',
 recordIds:published.map(x=>x.record.id)});
}
assert(new Set(reviewed.entries.map(x=>x.id)).size===reviewed.entries.length,'duplicate historical-reviewed entry');
const validation=validateData({results:db.results,players:db.players,tournaments:db.tournaments});
assert(validation.errors.length===0,'data-validator errors '+JSON.stringify(validation.errors.slice(0,6)));
writeReviewDb(root,db);
fs.writeFileSync(path.join(root,'history-sync-reviewed.json'),JSON.stringify(reviewed,null,2)+'\n');
const reportLines=[
 '# 残り15候補の証拠確認・掲載結果', '',
 '対象日: '+today,'- 確認対象: '+original.length+'件',
 '- 追加掲載: '+published.length+'件', '- 既掲載の重複整理: '+duplicates.length+'件',
 '- 根拠不足で保留: '+held.length+'件','- 戦績件数: '+report.before+' → '+report.after, '',
 '## 新規掲載', '',
 '| 日付 | 地域 | 選手 | 順位 | K | VR | 賞金 | 区分 |',
 '|---|---|---|---:|---:|---:|---:|---|',
 ...report.published.map(x=>'| '+x.date+' | '+x.region+' | '+x.name+' | '+x.rank+' | '+x.kills+' | '+x.vrs+' | '+(x.prize===null?'未確認':'$'+x.prize)+' | '+x.kind+' |'),
 '', '## 重複整理（既存Tracker戦績を維持）', '',
 '| 選手 | Epic保存順位 | 既存Tracker順位 | 判定 |',
 '|---|---:|---:|---|',
 ...report.duplicates.map(x=>'| '+x.name+' | '+x.originalRank+' | '+x.trackerRank+' | 成績全数値が同一、既存ID維持 |'),
 '', '## 未解決', '',
 ...report.held.map(x=>'- '+x.id+' ('+x.player+'): '+x.reason),
 '', '## 検証ポリシー', '',
 '- 本人Epic ID・ソース記録・大会カレンダー・連続した成熟済み順位表の記録済みページが完全一致した候補だけを掲載',
 '- HTTP 429は取得済みページに影響しないが、未取得部分を完了したとは主張しない',
 '- 未確認賞金・資格・スキン報酬は推測しない',
 '- 当時の予選通過条件はEpic公式の地域別規則と一致する場合だけ確定',
 '- 順位がプロバイダー間で1つずれる同一選手・同一数値の5件は既存Tracker記録を保持'
].join('\n')+'\n';
fs.mkdirSync(path.join(root,'review-reports'),{recursive:true});
fs.writeFileSync(path.join(root,'review-reports/2026-11-13-resolve-15.md'),reportLines);
