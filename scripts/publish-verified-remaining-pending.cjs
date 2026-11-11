'use strict';
/**
 * Complete remaining evidence-backed 2026 cosmetic review, de-duplicate exact
 * matches with previous source-verified publications, and archive select S42
 * lower-rank console qualifiers without inventing cash or qualification.
 *
 * Reuses manual-approval-core for identity, event-calendar, saved scoreboard,
 * re-review and duplicate checks. Never removes an ambiguous duplicate.
 */
const fs=require('node:fs'),path=require('node:path');
const {apply,collision,equalCandidate}=require('./manual-approval-core.cjs');
const {evaluate,CUT_OFFS}=require('./cosmetic-rank-rules.cjs');
const root=path.resolve(__dirname,'..');
const read=name=>JSON.parse(fs.readFileSync(path.join(root,name),'utf8'));
const write=(name,obj)=>fs.writeFileSync(path.join(root,name),JSON.stringify(obj,null,2)+'\n');
const now=new Date().toISOString(),dry=process.argv.includes('--dry-run');
const db={results:read('results.json'),players:read('players.json'),
 tournaments:read('tournaments.json'),
 reviews:{auto:read('auto-sync-review.json'),history:read('history-sync-review.json')},
 statuses:{auto:read('auto-sync-status.json'),history:read('history-sync-status.json')},
 scans:{auto:read('auto-sync-scan.json'),history:read('history-sync-scan.json')},
 ledger:read('approval-history.json'),updates:read('updates.json'),calendar:{}};
const reviewed=read('history-sync-reviewed.json');
const reviewedIds=new Set(reviewed.entries.map(x=>x.id));
const recordsAdded=[],reconciled=[],held=[];
const sourceRule={
 'ch7s4-inoxtag-icon-cup-battle-royale':'https://www.fortnite.com/competitive/rules-guidelines/rules-library/inoxtag-icon-cup-chapter-7-season-4-official-rules',
 'ch7s4-street-fighter-cup-reload':'https://www.fortnite.com/competitive/events/S42_StreetFighterCup/'
};
const targetDate={
 'ch7s4-inoxtag-icon-cup-battle-royale':'2026-10-26',
 'ch7s4-street-fighter-cup-reload':'2026-10-10'
};
const rankSame=(a,b)=>a.player===b.player&&JSON.stringify(a.players||[])===JSON.stringify(b.players||[])
 &&a.date===b.date&&a.region===b.region&&a.tournamentId===b.tournamentId
 &&a.rank===b.rank&&a.points===b.points&&a.kills===b.kills
 &&a.vrs===b.vrs&&a.matches===b.matches&&a.source===b.source;
const already=new Set(db.results.map(x=>x.id));
function getWindow(r){
 const src=new URL(r.source),windowId=src.searchParams.get('round'),eventId=decodeURIComponent(src.pathname.split('/')[3]||'');
 const month=r.date.slice(0,7);
 if(!db.calendar[month])db.calendar[month]=read('calendar-history/'+month+'.json').sessions;
 const win=db.calendar[month].find(x=>x.sourceWindowId===windowId&&x.region===r.region&&x.tournamentId===r.tournamentId);
 if(!win||win.eventId!==eventId||win.dateJst!==r.date)throw Error('Calendar window identity mismatch');
 return{eventId,windowId};
}
function findScore(r,part){
 const win=getWindow(r);
 const key='epicgames_'+win.eventId+'_'+r.region+'/'+win.windowId;
 const cp=part.windows?.[key];
 if(!cp||cp.nextPage<1||cp.rankingOrderValid!==true||!Array.isArray(cp.proposals))throw Error('No verified saved scoreboard page');
 if(cp.proposals.filter(x=>x.id===r.id&&equalCandidate(x,r)).length!==1)throw Error('Score does not match original saved Epic row');
 if(!Number.isSafeInteger(cp.lastSeenRank)||r.rank>cp.lastSeenRank)throw Error('Not observed inside saved scoreboard boundary');
 return cp;
}
// First resolve repeat proposals only if the pre-existing record has identical,
// event-specific source and numerical facts. Any mismatch remains for review.
for(const origin of ['history','auto']){
 for(const r of [...db.reviews[origin].proposals]){
  const conflicts=db.results.filter(x=>collision(x,r,db.players.confirmedAliases));
  if(conflicts.length!==1||!rankSame(conflicts[0],r))continue;
  db.reviews[origin].proposals=db.reviews[origin].proposals.filter(x=>x.id!==r.id);
  if(!reviewedIds.has(r.id)){
   reviewed.entries.push({id:r.id,decision:'already-published',existingId:conflicts[0].id,
    reviewedAt:now,source:r.source,reason:'Identical saved scoreboard rank, Epic lineup, region, date, round and result statistics'});
   reviewedIds.add(r.id);
  }
  reconciled.push({id:r.id,existingId:conflicts[0].id,event:r.event,player:r.player});
 }
}
// Second integrate outfit-eligible records and other exact participants into the
// *regular* results page, not an independent attendance-only result panel.
const candidates=[...db.reviews.history.proposals,...db.reviews.auto.proposals]
 .filter(r=>r.reviewOnly===true&&r.verified===true&&r.kind==='参加確認'&&
   targetDate[r.tournamentId]===r.date&&
   ((r.tournamentId==='ch7s4-street-fighter-cup-reload'&&r.region==='ME')||
     (r.tournamentId==='ch7s4-inoxtag-icon-cup-battle-royale'&&['ME','NAC'].includes(r.region))))
 .sort((a,b)=>a.date.localeCompare(b.date)||a.rank-b.rank);
for(const r of candidates){
 try{
  const cutoff=CUT_OFFS[r.tournamentId]?.ranks[r.region];
  if(!Number.isSafeInteger(cutoff))throw Error('No regional costume cutoff');
  const reward=r.rank<=cutoff;
  if(reward&&!evaluate(r).eligible)throw Error('Costume rank evidence not validated');
  const m=r.date.slice(0,7);
  if(!db.calendar[m])db.calendar[m]=read('calendar-history/'+m+'.json').sessions;
  const policy=reward?'cosmetic-rank':'attendance-only';
  const approved=apply(db,{ids:[r.id],policy,confirmation:'CONFIRM',timestamp:now,
    runId:'aot-review-3-'+r.id,actor:'ChatGPT / user-authorized review and publication'});
  if(approved.changes.length!==1)throw Error('No newly approved record');
  const record=approved.changes[0].record;
  if(reward){
   const garment=r.tournamentId==='ch7s4-street-fighter-cup-reload'?'Chun-Li Outfit':'Inoxtag Outfit';
   record.note='本人Epic IDと開催枠の保存済み順位表で'+r.region+' '+r.rank+'位。'
    +(r.tournamentId==='ch7s4-street-fighter-cup-reload'
      ?'Fortnite TrackerのME Reload公式大会報酬欄に上位50組の'+garment+'と装飾品が明示。'
      :'Epic公式Inoxtag Icon Cupルール Attachment C のBattle Royale上位'+cutoff+'組が'+garment+'報酬対象。')
    +' 現金賞金$0。ゲーム内アイテムの配布完了や適格性は未確認。大会出典: '+r.source
    +' / 規則または報酬表: '+sourceRule[r.tournamentId]
    +(r.tournamentId==='ch7s4-street-fighter-cup-reload'
      ?' / https://fortnitetracker.com/events/epicgames_S42_StreetFighterCup_ME':'');
  }else{
   record.note='Epic ID・公式イベント・保存済み順位を照合した結果。衣装の上位'+cutoff+'組の範囲外であり、衣装実績には加算しない。現金賞金・実物景品は未認定。出典: '+r.source;
  }
  Object.assign(db,{results:approved.next.results,reviews:approved.next.reviews,
    statuses:approved.next.statuses,ledger:approved.next.ledger,updates:approved.next.updates});
  recordsAdded.push({id:r.id,player:r.player,rank:r.rank,event:r.event,region:r.region,reward});
 }catch(e){held.push({id:r.id,player:r.player,reason:String(e.message||e)})}
}
// Third, try the two low-ranked S42 ME console qualifiers; they have $0 cash
// because only the actual Round 2 victory earns cash. Never claim advancement.
for(const r of [...db.reviews.auto.proposals]){
 if(r.tournamentId!=='ch7s4-console-zero-build-solo-victory-cup'||r.date!=='2026-10-24'||r.region!=='ME'||r.seasonId!=='S42')continue;
 try{
  if(!r.verified||r.reviewOnly===true||r.kind!=='予選'||r.prize!==0||
   !Number.isSafeInteger(r.rank)||r.rank<=800||!Number.isSafeInteger(r.kills)||
   !Number.isSafeInteger(r.points)||!Number.isSafeInteger(r.matches)||r.matches<1||
   !Number.isSafeInteger(r.vrs)||r.vrs>r.matches)throw Error('No verified prize-free qualifier fact');
  const url=new URL(r.source),win=getWindow(r);
  if(url.hostname!=='www.fortnite.com'||url.pathname!=='/competitive/events/S42_ConsoleVCC_SolosZB/'||
    win.windowId!=='S42_ConsoleVCC_SolosZB_Event8Round1_ME')throw Error('Untrusted source window');
  const cat=db.tournaments.catalog.find(x=>x.id===r.tournamentId);
  if(cat?.team!=='solo'||!db.players.candidates.some(x=>x.name===r.player))throw Error('Unlinked player');
  findScore(r,db.scans.auto);
  if(db.results.some(x=>collision(x,r,db.players.confirmedAliases))||already.has(r.id))throw Error('Existing record');
  const {reviewOnly,reviewReason,...record}=r;
  record.kind='予選';record.round='Event 8 · Round 1 / 予選';record.prize=0;
  record.note='Epic ID・開催枠・保存済みOsirion順位表の取得済みページで'+r.rank+'位を確認。'
   +'2026年C7S4のConsole ZB Solo Victory CupでRound1の現金賞金は$0。'
   +'順位は決勝進出条件ではないため突破とみなさない。予選敗退の表示は行わない。'
   +'規則: https://www.fortnite.com/competitive/rules-guidelines/rules-library/fortnite-victory-cups-chapter-7-season-4-official-rules';
  db.results.push(record);already.add(record.id);
  db.reviews.auto.proposals=db.reviews.auto.proposals.filter(x=>x.id!==r.id);
  db.ledger.entries.push({id:r.id,decision:'published',recordId:r.id,policy:'verified-rule',
   approvedAt:now,approvedBy:'ChatGPT / user-authorized review',source:r.source,
   rule:'https://www.fortnite.com/competitive/rules-guidelines/rules-library/fortnite-victory-cups-chapter-7-season-4-official-rules',
   evidence:'Exact Epic ID, event, rank within observed saved ranked page; no cash/no progression claimed'});
  recordsAdded.push({id:r.id,player:r.player,rank:r.rank,event:r.event,region:r.region,reward:false});
 }catch(e){held.push({id:r.id,player:r.player,reason:String(e.message||e)})}
}
if(reconciled.length||recordsAdded.length){
 const prefix='review-publication-aot-review-3-';
 db.updates.entries=db.updates.entries.filter(x=>!String(x.id||'').startsWith(prefix));
 const marker='pending-review-batch-3-20261111';
 if(recordsAdded.length){
  db.updates.entries.unshift({id:marker,date:'2026-11-11',type:'records',
   title:'Inoxtag・Street Fighter海外大会の成績を追加',
   description:'Epic公式開催枠・本人ID・保存済み順位表と地域別報酬を照合。衣装報酬圏内と参加順位を区別し、現金は推定せず通常の遠征結果に掲載。重複は既存結果を維持して整理。',
   recordIds:recordsAdded.map(x=>x.id)});
 }
 for(const origin of ['auto','history']){
  db.statuses[origin].found=db.reviews[origin].proposals.length;
  db.statuses[origin].manualReviewCandidates=db.reviews[origin].proposals.length;
  db.statuses[origin].reviewOnlyCandidates=db.reviews[origin].proposals.filter(x=>x.reviewOnly===true).length;
  db.statuses[origin].lastReviewedBatchAt=now;
  db.statuses[origin].manuallyResolvedDuplicates=(Number(db.statuses[origin].manuallyResolvedDuplicates)||0)+reconciled.filter(x=>x.id.startsWith('auto-')).length;
  db.statuses[origin].message='第3弾で通常一覧に'+recordsAdded.length+'件掲載、順位・出典まで完全一致した重複'+reconciled.length+'件を整理。確認待ち'+db.reviews[origin].proposals.length+'件。';
 }
 reviewed.reviewedAt=now;
}
if(!dry&&(reconciled.length||recordsAdded.length)){
 for(const [p,d] of [
  ['results.json',db.results],['history-sync-review.json',db.reviews.history],
  ['auto-sync-review.json',db.reviews.auto],['history-sync-status.json',db.statuses.history],
  ['auto-sync-status.json',db.statuses.auto],['approval-history.json',db.ledger],
  ['updates.json',db.updates],['history-sync-reviewed.json',reviewed]])write(p,d);
}
const suspected=[...db.reviews.history.proposals,...db.reviews.auto.proposals].map(r=>{
 const existing=db.results.filter(x=>collision(x,r,db.players.confirmedAliases));
 return {r,existing};
}).filter(x=>x.existing.length);
const audit=suspected.map(({r,existing})=>({
 id:r.id,player:r.player,event:r.event,region:r.region,date:r.date,
 candidate:{rank:r.rank,points:r.points,kills:r.kills,vrs:r.vrs,matches:r.matches,source:r.source},
 existing:existing.slice(0,2).map(x=>({id:x.id,player:x.player,rank:x.rank,points:x.points,
  kills:x.kills,vrs:x.vrs,matches:x.matches,kind:x.kind,round:x.round,source:x.source,
  matchingStatistics:x.rank===r.rank&&x.points===r.points&&x.kills===r.kills&&
    x.vrs===r.vrs&&x.matches===r.matches}))
}));
console.log('AOT_PENDING_COLLISION_AUDIT '+JSON.stringify({count:audit.length,
 exact:audit.filter(x=>x.existing.length===1&&x.existing[0].matchingStatistics).length,
 examples:audit.slice(0,70)}));
const by={};for(const x of recordsAdded)by[x.event]=(by[x.event]||0)+1;
console.log('AOT_PENDING_REVIEW_THIRD '+JSON.stringify({dry,
 added:recordsAdded.length,awards:recordsAdded.filter(x=>x.reward).length,
 by,addedRows:recordsAdded,
 reconciled:reconciled.length,reconciledByEvent:Object.fromEntries(
   [...new Set(reconciled.map(x=>x.event))].map(e=>[e,reconciled.filter(x=>x.event===e).length])),
 held:held.length,heldSamples:held.slice(0,30),
 remainingHistory:db.reviews.history.proposals.length,
 remainingAuto:db.reviews.auto.proposals.length
}));
