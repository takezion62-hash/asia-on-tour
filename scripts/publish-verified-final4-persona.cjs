'use strict';
// Final 2026-11-11 review: confirmed C5S3 Solo Victory Cash Cup Event4
// 1VR cash prizes and duplicate reconciliation for existing Persona 5 outfits.
// No guesses, no second costume copy, no separate attendance archive.
const fs=require('node:fs'),path=require('node:path');
const {collision,equalCandidate}=require('./manual-approval-core.cjs');
const {evaluate}=require('./cosmetic-rank-rules.cjs');
const root=path.resolve(__dirname,'..'),dry=process.argv.includes('--dry-run');
const load=n=>JSON.parse(fs.readFileSync(path.join(root,n),'utf8'));
const write=(n,v)=>fs.writeFileSync(path.join(root,n),JSON.stringify(v,null,2)+'\n');
const now=new Date().toISOString();
const RULE='https://www.fortnite.com/news/fortnite-victory-cash-cups-chapter-5-season-3-official-rules';
const d={
 results:load('results.json'),review:load('history-sync-review.json'),
 reviewed:load('history-sync-reviewed.json'),status:load('history-sync-status.json'),
 ledger:load('approval-history.json'),updates:load('updates.json'),scan:load('history-sync-scan.json'),
 players:load('players.json'),tournaments:load('tournaments.json'),calendar:{}
};
const originalCash=new Set(['auto-s30-5f52bfd36735','auto-s30-8cea76a52b42',
 'auto-s30-4fc00e3d9d48','auto-s30-79ad4a8c4029']);
const originalPersona=new Set(['auto-s42-5fa14f18e8b5','auto-s42-c3187af8e934',
 'auto-s42-6239f2d85b2a','auto-s42-577164f19886','auto-s42-fa845d15612f']);
const reviewedIds=new Set(d.reviewed.entries.map(x=>x.id));
const known=new Set(d.players.candidates.map(x=>x.name));
const cash=[],duplicates=[],held=[];
function check(ok,err){if(!ok)throw Error(err)}
function originalEvidence(r,eventId,window){
 const u=new URL(r.source);
 check(r.verified===true&&u.protocol==='https:'&&u.hostname==='www.fortnite.com'&&
  u.pathname==='/competitive/events/'+eventId+'/'&&u.searchParams.get('region')===r.region&&
  u.searchParams.get('round')===window,'Epic source mismatch');
 const cat=d.tournaments.catalog.find(t=>t.id===r.tournamentId);
 check(cat&&cat.team==='solo'&&cat.name===r.event&&cat.seasonId===r.seasonId&&
   cat.sourceEventIds?.includes(eventId),'catalog or team mismatch');
 check(known.has(r.player)&&(!r.players||r.players.length===1),'unverified player identity');
 check(Number.isSafeInteger(r.rank)&&r.rank>0&&Number.isSafeInteger(r.points)&&r.points>=0&&
   Number.isSafeInteger(r.kills)&&r.kills>=0&&Number.isSafeInteger(r.vrs)&&r.vrs>=0&&
   Number.isSafeInteger(r.matches)&&r.matches>0&&r.vrs<=r.matches,'score is not valid');
 const key='epicgames_'+eventId+'_'+r.region+'/'+window,cp=d.scan.windows?.[key];
 check(cp?.rankingOrderValid===true&&cp.nextPage>0&&cp.lastSeenRank>=r.rank&&
   Array.isArray(cp.proposals)&&cp.proposals.filter(q=>q.id===r.id&&equalCandidate(q,r)).length===1,
   'exact saved Epic ID/score/page not verified');
 const month=r.date.slice(0,7);
 if(!d.calendar[month])d.calendar[month]=load('calendar-history/'+month+'.json').sessions;
 check(d.calendar[month].some(s=>s.eventId===eventId&&s.sourceWindowId===window&&
   s.dateJst===r.date&&s.region===r.region&&s.tournamentId===r.tournamentId),
   'official event calendar/date mismatch');
 check(!d.ledger.entries.some(x=>x.id===r.id),'candidate already approved');
}
for(const r of [...d.review.proposals]){
 if(!originalCash.has(r.id))continue;
 try{
  const target=r.region==='OCE'?'2024-06-24':'2024-06-25';
  const round='S30_SoloVictoryCashCup_Event4Round2_'+r.region;
  check(r.seasonId==='S30'&&r.date===target&&['ME','OCE'].includes(r.region)&&
    r.tournamentId==='ch5s3-solo-victory-cup'&&r.kind==='賞金決勝'&&r.prize===null&&
    r.round.includes('Round 2 / 賞金決勝')&&r.vrs===1&&r.points===100&&r.matches<=3,
    'different or unverified VR prize score');
  originalEvidence(r,'S30_SoloVictoryCashCup',round);
  check(!d.results.some(x=>collision(x,r,d.players.confirmedAliases||{})),'existing cash record collision');
  check(!d.results.some(x=>x.id===r.id),'cash record ID already exists');
  const {reviewOnly,reviewReason,teamAccountIds,...record}=r;
  record.prize=100;
  record.note='Epic公式C5S3 Solo Victory Cash Cup Event4 '+r.region+'決勝。'
    +'本人Epic ID、保存済み順位表の'+r.rank+'位・1VR・'+r.matches+'試合を照合。'
    +'公式1VRにつき$100の獲得額を掲載（支払完了の断定ではない）。'
    +'規則: '+RULE+' / 出典: '+r.source;
  d.results.push(record);
  d.review.proposals=d.review.proposals.filter(x=>x.id!==r.id);
  d.ledger.entries.push({id:r.id,decision:'published',recordId:r.id,policy:'official-final-vr-award',
    approvedAt:now,approvedBy:'ChatGPT / user-authorized Epic source review',
    source:r.source,rule:RULE,evidence:'Exact original Epic scoreboard: final 1VR x USD 100'});
  if(!reviewedIds.has(r.id)){
   d.reviewed.entries.push({id:r.id,decision:'published',recordId:r.id,
    reviewedAt:now,source:r.source,policy:'official-final-vr-award',rule:RULE});
   reviewedIds.add(r.id);
  }
  cash.push({id:r.id,player:r.player,region:r.region,rank:r.rank,prize:100});
 }catch(e){held.push({id:r.id,player:r.player,reason:String(e.message||e)})}
}
for(const r of [...d.review.proposals]){
 if(!originalPersona.has(r.id))continue;
 try{
  check(r.date==='2026-09-26'&&r.region==='NAC'&&r.seasonId==='S42'&&
    r.tournamentId==='ch7s4-override-persona-5-royal-cup-reload'&&
    r.kind==='参加確認'&&r.reviewOnly===true&&r.prize===null,'unexpected Persona review candidate');
  originalEvidence(r,'S42_Persona5Cup','S42_Persona5Cup_NAC');
  check(evaluate(r).eligible===true,'official regional outfit cutoff not met');
  const old=d.results.filter(x=>collision(x,r,d.players.confirmedAliases||{}));
  check(old.length===1,'unclear duplicate existing result');
  const existing=old[0],src=new URL(existing.source);
  check(src.hostname==='fortnitetracker.com'&&src.pathname.includes('S42_Persona5Cup_NAC')&&
    existing.kind==='スキン大会'&&existing.prize===0&&existing.verified===true,
    'existing result is not the exact official cosmetic event');
  for(const k of ['date','region','tournamentId','event','player','rank','points','kills','vrs','matches'])
    check(existing[k]===r[k],k+' mismatch; keep candidate for individual reconciliation: existing '+existing[k]+' official '+r[k]);
  d.review.proposals=d.review.proposals.filter(x=>x.id!==r.id);
  if(!reviewedIds.has(r.id)){
   d.reviewed.entries.push({id:r.id,decision:'already-published',existingId:existing.id,
    reviewedAt:now,source:r.source,evidence:'Matching original Epic ID, round, region, name, rank, points, eliminations, VR and matches'});
   reviewedIds.add(r.id);
  }
  duplicates.push({id:r.id,existingId:existing.id,player:r.player,rank:r.rank});
 }catch(e){held.push({id:r.id,player:r.player,reason:String(e.message||e)})}
}
if(cash.length||duplicates.length){
 if(cash.length){
  const id='verified-2024-s30-event4-final-cash-20261111';
  check(!d.updates.entries.some(x=>x.id===id),'update already exists while cash rows remain');
  d.updates.entries.unshift({id,date:'2026-11-11',type:'records',
   title:'2024年OCE/ME Solo Victory Cup決勝の賞金記録'+cash.length+'件を追加',
   description:'本人Epic ID、公式開催枠と保存済み順位表、Epic公式1VR=$100を検証。決勝賞金$100を通常遠征結果に統合。',
   recordIds:cash.map(x=>x.id)});
 }
 d.review.manualReviewedAt=now;d.reviewed.reviewedAt=now;d.ledger.reviewedAt=now;
 d.status.manualReviewCandidates=d.review.proposals.length;
 d.status.found=d.review.proposals.length;
 d.status.lastReviewedBatchAt=now;
 d.status.manuallyPublished=(d.status.manuallyPublished||0)+cash.length;
 d.status.manuallyResolvedDuplicates=(d.status.manuallyResolvedDuplicates||0)+duplicates.length;
 d.status.message='公式VR賞金'+cash.length+'件掲載、既存スキン戦績の同一候補'+duplicates.length+
  '件を整理。確認待ち'+d.review.proposals.length+'件。';
}
console.log('AOT_FINAL_CASH_PERSONA '+JSON.stringify({dry,added:cash.length,awardSum:cash.length*100,
 awards:cash,duplicates:duplicates.length,duplicateRows:duplicates,
 heldCount:held.length,held,remaining:d.review.proposals.length}));
if(!dry&&(cash.length||duplicates.length)){
 for(const [name,v] of [
  ['results.json',d.results],['history-sync-review.json',d.review],
  ['history-sync-reviewed.json',d.reviewed],['history-sync-status.json',d.status],
  ['approval-history.json',d.ledger],['updates.json',d.updates]])write(name,v);
}
