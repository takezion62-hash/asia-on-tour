'use strict';
// Narrow, repeatable 2026-11-12 resolution of exactly the original evidence-triaged
// queue. Never infer cash from Round 1/attendance. Never overwrite Tracker scores.
const path=require('node:path'),fs=require('node:fs'),crypto=require('node:crypto');
const {createPublicationFiles}=require('./reviewed-publication-core.cjs');
const {verifiedPartialPage,sameScannedCandidate}=require('./verified-partial-page.cjs');
const {collision}=require('./manual-approval-core.cjs');
const {RULES}=require('./verified-history-approval.cjs');
const {toParticipation,recordId:participationId,appendArchive,publishedEquivalent}=require('./participation-archive.cjs');
const {sourceWindow}=require('./candidate-triage-core.cjs');
const root=path.resolve(__dirname,'..'),{read,write}=createPublicationFiles(root);
// 2026-11-12 follow-up: append the still-pending source-verified candidates only.
const TARGET_IDS=new Set(["auto-s42-00bacaa46d78","auto-s42-1353c4dd52b0","auto-s42-36f61cec7e5e","auto-s42-666e9255abb7","auto-s42-8c5da81eea44","auto-s42-31ea77a81948","auto-s42-344bb93fb223","auto-s42-38c619af58c5","auto-s42-5e35168fc3f6","auto-s42-8d5c197e28e2","auto-s31-7a23e1138e55","auto-s31-fc55bba6d32f","auto-s31-2ae2abefe687","auto-s31-24c411e2e0e2","auto-s31-27ff62b1107c","auto-s31-eaed80bd268d","auto-s36-1ecc40675e2b","auto-s36-32b419bb7534","auto-s36-6e5e69f28783","auto-s36-7fef84ff571a","auto-s36-a11e61d5bc70","auto-s36-a567e5c7b23f","auto-s42-36cc38395ba3","auto-s42-86fa836511fe","auto-s42-a887487a1ee6","auto-s42-f319960a7db5","auto-s42-c3741a0cf405","auto-s42-0554fd98619e","auto-s42-07fdf08dd869","auto-s42-1f775155bfa4","auto-s42-1fcb410ad12c","auto-s42-44bcdf243c04","auto-s42-533e934c696f","auto-s42-70cd66eb5b1c","auto-s42-a74193d78b69","auto-s42-af2bc57f1191","auto-s42-d6d846dd1e79","auto-s42-28231f26cea6","auto-s42-4e12249f360d","auto-s42-a8710f7cfbe8","auto-s31-286299ef6e53","auto-s31-5539ecdbbee9","auto-s31-63a1687f62e9","auto-s31-6ba884a84f2e","auto-s31-aed99211a6b6","auto-s31-bba7802e7d06","auto-s31-e9e972efbd8c","auto-s42-34336c3be81a","auto-s42-20ff2eea3bb3","auto-s30-013524caf149","auto-s30-36c73a521b38","auto-s30-51ccf5f4742f","auto-s30-e62fc8ea41e6","auto-s30-e68f16f49747","auto-s31-39673413e961","auto-s31-db7713aabbaf","auto-s31-0b7e68aacdca","auto-s31-eff393d1a689","auto-s31-f387dc63d7a3","auto-s36-7da10bb1c06b","auto-s36-83ec8d1ff73d","auto-s31-8fe9cea087bf","auto-s31-5f4f59c082d7","auto-s30-38edc2a4468e","auto-s30-622ff6c2a448","auto-s30-5c100d6d95dc","auto-s30-64b28e27dafc","auto-s30-399aecb49618","auto-s30-1662db26699a","auto-s30-a5c983fd5b90","auto-s30-34e8e847274a","auto-s30-c8b9b18b2b58","auto-s36-8ed10eb27786","auto-s42-b57ae47b3a23","auto-s31-8e50853183b3","auto-s31-c3e1baa00d50","auto-s31-46721304168e","auto-s31-8effe69ec336","auto-s31-be3f7178669c","auto-s31-9ee5af459903","auto-s31-4df46aeebbaf","auto-s30-2d3ca7ffcf90","auto-s30-55e1c819a536","auto-s30-a3027775a0e4","auto-s30-91a358e33ee5","auto-s30-62dccaa1911f","auto-s30-36fd0a4ad697","auto-s30-173755b98c6a","auto-s36-554a50d5faf8","auto-s36-32286bb9a1b9","auto-s36-e13b0fff436c","auto-s36-282f8164bf5f","auto-s36-2bb5de7e86f4","auto-s36-64b2f394c311","auto-s32-34ae70ebe007","auto-s32-cd8173ab9978","auto-s42-b0f563eec64e","auto-s42-b6f4953848f0","auto-s31-58a1bc0e82e5","auto-s31-9d4fafec5780","auto-s31-95c8ed979ecb","auto-s31-9f2a33eb01d8","auto-s31-9460ac17a160","auto-s31-fd76916ac3ec","auto-s31-2844d1f5e873","auto-s31-3ae098b2ca4b","auto-s31-8e5de2817ad5","auto-s31-089cc3b362de","auto-s31-dc43bb42c913","auto-s31-5b63724f4f66","auto-s31-05deba4ed351","auto-s31-215123cce6a3"]);
const dry=process.argv.includes('--dry-run');
const now=new Date().toISOString(),dateJst=new Date(Date.now()+9*3600000).toISOString().slice(0,10);
const d={
 results:read('results.json'),
 reviews:{auto:read('auto-sync-review.json'),history:read('history-sync-review.json')},
 scans:{auto:read('auto-sync-scan.json'),history:read('history-sync-scan.json')},
 statuses:{auto:read('auto-sync-status.json'),history:read('history-sync-status.json')},
 reviewed:read('history-sync-reviewed.json'),ledger:read('approval-history.json'),updates:read('updates.json'),
 players:read('players.json'),tournaments:read('tournaments.json')
};
const fail=(ok,msg)=>{if(!ok)throw Error('TRIAGE_RESOLVE '+msg)};
const calCache=new Map(),catalog=new Map(d.tournaments.catalog.map(x=>[x.id,x]));
const known=new Set(d.players.candidates.map(x=>x.name)),aliases=d.players.confirmedAliases||{};
const recorded=new Set(d.results.map(x=>x.id));
const reviewed=new Set(d.reviewed.entries.map(x=>x.id));
const ledger=new Set(d.ledger.entries.map(x=>x.id));
const audience=new Map(),missing=[],held=[],dedup=[],published=[],attendance=[];
for(const origin of ['auto','history']){
 for(const row of d.reviews[origin].proposals){
  if(!TARGET_IDS.has(row.id))continue;
  if(audience.has(row.id)){
   // The same ID may appear in both queues only with identical evidence.
   fail(sameScannedCandidate(audience.get(row.id).row,row),'conflicting scopes '+row.id);
   audience.get(row.id).origins.push(origin);
  }else audience.set(row.id,{row,origins:[origin]});
 }
}
for(const id of TARGET_IDS)if(!audience.has(id))missing.push(id);
// One-time reconciliation is fully idempotent. In particular, do NOT touch
// reviewedAt/status files on later scheduled scans when the target queue is empty.
if(audience.size===0){
 console.log('TRIAGE_RESOLVE_20261112 '+JSON.stringify({dry,originalTargetIds:TARGET_IDS.size,
  stillInQueue:0,missing:missing.length,published:0,attendance:0,alreadyPublishedDuplicates:0,held:0}));
 process.exit(0);
}
function members(row){return Array.isArray(row.players)&&row.players.length?row.players:[row.player]}
function uniqueCandidate(row){
 if(recorded.has(row.id)||reviewed.has(row.id)||ledger.has(row.id))return false;
 return true;
}
function verify(row,{requireMaturity=true}={}){
 fail(row&&/^auto-s\d+-[a-z0-9]{12}$/.test(row.id)&&row.verified===true,'no official Epic ID proof');
 const cat=catalog.get(row.tournamentId);
 fail(cat&&cat.id===row.tournamentId&&cat.name===row.event&&cat.seasonId===row.seasonId&&
  ['solo','duo','trio','squad'].includes(cat.team),'tournament mismatch '+row.id);
 const team=members(row);
 fail(team.length==={solo:1,duo:2,trio:3,squad:4}[cat.team]&&
  new Set(team).size===team.length&&team.every(x=>known.has(x))&&
  team.join(' / ')===row.player,'verified roster mismatch '+row.id);
 for(const [field,min] of [['rank',1],['points',0],['kills',0],['vrs',0],['matches',1]])
  fail(Number.isSafeInteger(row[field])&&row[field]>=min,'invalid '+field+' '+row.id);
 fail(row.vrs<=row.matches,'invalid victory count '+row.id);
 const key=sourceWindow(row);
 fail(key&&key.startsWith('epicgames_'),'invalid official source '+row.id);
 const url=new URL(row.source);
 const eventId=decodeURIComponent(url.pathname.split('/')[3]),windowId=url.searchParams.get('round');
 fail(cat.sourceEventIds?.includes(eventId),'event ID not catalogued '+row.id);
 const month=row.date.slice(0,7);
 if(!calCache.has(month)){
  const file='calendar-history/'+month+'.json';
  fail(fs.existsSync(path.join(root,file)),'missing official calendar '+file);
  calCache.set(month,read(file).sessions||[]);
 }
 const sessions=calCache.get(month).filter(s=>s.eventId===eventId&&
  s.sourceWindowId===windowId&&s.dateJst===row.date&&s.region===row.region&&
  s.tournamentId===row.tournamentId&&s.seasonId===row.seasonId);
 fail(sessions.length===1,'official calendar session mismatch '+row.id);
 const session=sessions[0];
 fail(session.url===row.source,'official calendar URL mismatch '+row.id);
 const board=[];
 for(const [origin,scan] of Object.entries(d.scans)){
  const checkpoint=scan.windows[key];
  if(checkpoint?.proposals?.some(x=>x.id===row.id))board.push({origin,checkpoint});
 }
 fail(board.length>0,'not found in saved original rank '+row.id);
 const matching=board.filter(({checkpoint:cp})=>cp.rankingOrderValid===true&&cp.nextPage>0&&
  cp.pages===cp.nextPage&&cp.lastSeenRank>=row.rank&&
  cp.proposals.filter(x=>x.id===row.id&&sameScannedCandidate(x,row)).length===1);
 fail(matching.length>0,'rank/score not identical to Epic-ID checkpoint '+row.id);
 const eligible=matching.filter(({checkpoint:cp})=>
  (cp.complete===true&&cp.nextPage>=cp.totalPages)||
   verifiedPartialPage(row,{end:Date.parse(session.endUtc)},cp));
 if(requireMaturity)fail(eligible.length>0,'incomplete/unmatured or retry-waiting leaderboard '+row.id);
 const win={dateJst:row.date,region:row.region,tournamentId:row.tournamentId,
  seasonId:row.seasonId,eventId,windowId,round:row.round,kind:row.kind,series:cat.series};
 return {cat,win,cp:(eligible[0]||matching[0]).checkpoint,session};
}
const qualifiedId='ch5s4-solo-victory-cup',qualifiedZbId='ch5s3-zb-solo-victory';
const cosmeticId='ch7s4-lady-liberty-cup-battle-royale';
const scoreFields=['points','kills','vrs'];
for(const {row,origins} of audience.values()){
 if(!uniqueCandidate(row)){
  held.push({id:row.id,reason:'already published/adjudicated ID (do not reprocess)'});continue;
 }
 try{
  // Suppressing an exact duplicate does not issue an award or new record.
  // The saved rank and identical previously published skin score suffice.
  const duplicateCosmetic=row.tournamentId===cosmeticId&&row.kind==='参加確認'&&
   row.date==='2026-10-18'&&['ME','NAC'].includes(row.region);
  const {cat,win}=verify(row,{requireMaturity:!duplicateCosmetic});
  const origin=origins[0];
  if(row.tournamentId===cosmeticId&&row.kind==='参加確認'&&
   row.date==='2026-10-18'&&['ME','NAC'].includes(row.region)){
   const existing=d.results.filter(x=>x.date===row.date&&x.region===row.region&&
    x.tournamentId===row.tournamentId&&x.player===row.player&&x.event===row.event);
   fail(existing.length===1,'Lady Liberty not uniquely matched with existing record '+row.id);
   const old=existing[0];
   fail(old.id!==row.id&&old.kind==='スキン大会'&&old.prize===0&&
    scoreFields.every(k=>old[k]===row[k]),
    'Lady Liberty published skin score mismatch '+row.id);
   dedup.push({row,origin,existingId:old.id});
   continue;
  }
  const verifiedOldQualifier=row.kind==='予選'&&(
   row.seasonId==='S31'&&row.tournamentId===qualifiedId&&(
     row.date==='2024-10-07'&&row.region==='OCE'||
     row.date==='2024-10-08'&&row.region==='ME'||
     row.date==='2024-10-14'&&row.region==='OCE'||
      row.date==='2024-10-21'&&row.region==='OCE'||
      row.date==='2024-10-22'&&row.region==='ME'
   )||
   row.seasonId==='S30'&&row.tournamentId===qualifiedZbId&&
     row.date==='2024-06-11'&&row.region==='ME'
  );
  const rule=RULES[row.tournamentId];
  if(verifiedOldQualifier){
   const exactCutoff=rule?.advance?.[row.region];
   fail(rule?.seasonId===row.seasonId&&Number.isSafeInteger(exactCutoff)&&
    rule.eventIds.includes(win.eventId)&&row.rank<=exactCutoff&&
    row.matches<=rule.matchCaps['予選']&&row.prize===0&&cat.team==='solo',
    'not verified official 2024 ME/OCE qualifier '+row.id);
   const {reviewReason,reviewOnly,teamAccountIds,...rec}=row;
   rec.round=row.round.replace(/\/\s*予選$/,'/ 予選突破');
   rec.kind='予選';rec.prize=0;
   rec.note='Epic公式規則で'+row.region+'上位'+exactCutoff+'位が予選突破。本人Epic IDと保存済みの成熟した順位表で'+
    row.rank+'位を確認。予選の現金賞金$0。受賞・支払の断定なし。規則: '+rule.source;
   fail(!d.results.some(x=>collision(x,rec,aliases)),'potential existing result; no automatic merge '+row.id);
   published.push({row,record:rec,origin,rule:rule.source,policy:'verified-rule'});
   continue;
  }
  // The 2024 S31 NAC event 6 Round 2 awards exactly $100 per Victory
  // Royale. A point total of 100 and one VR must both be in the mature
  // saved Epic scoreboard, not inferred from a qualification or profile.
  const verifiedS31Final=row.seasonId==='S31'&&row.tournamentId===qualifiedId&&
   row.kind==='賞金決勝'&&(
    row.date==='2024-10-08'&&row.region==='NAC'||
    row.date==='2024-10-21'&&row.region==='OCE'||
    row.date==='2024-10-22'&&row.region==='ME');
  if(verifiedS31Final){
   const finalWindow={
    NAC:'S31_SoloVictoryCashCup_Event6Round2_NAC',
    OCE:'S31_SoloVictoryCashCup_Event8Round2_OCE',
    ME:'S31_SoloVictoryCashCup_Event8Round2_ME'
   }[row.region];
   fail(rule?.seasonId==='S31'&&
    rule.source==='https://www.fortnite.com/news/fortnite-victory-cash-cups-chapter-5-season-4-official-rules'&&
    win.windowId===finalWindow&&
    row.round.includes('Round 2 / 賞金決勝')&&row.prize===null&&
    row.vrs===1&&row.points===100&&row.matches<=3&&cat.team==='solo',
    '2024 S31 official VR payout not proved '+row.id);
   const {reviewReason,reviewOnly,teamAccountIds,...rec}=row;
   rec.prize=100;
   rec.note='2024年S31 '+row.region+' '+(row.region==='NAC'?'Event 6':'Event 8')+'決勝。Epic ID・公式開催枠・成熟した保存順位表で1VR/100ptを照合。Epic公式規則の全地域共通1VR=$100による規則上の賞金。実際の支払・受賞資格は未確認。規則: '+rule.source;
   fail(!d.results.some(x=>collision(x,rec,aliases)),'potential existing cash result '+row.id);
   published.push({row,record:rec,origin,rule:rule.source,policy:'official-final-vr-award'});
   continue;
  }
  // For everything outside our narrow official award scope, save attendance
  // separately from cash, badges, qualification and ranking totals.
  let cutoff=null;
  if(win.kind==='予選'&&cat.series==='victory-cup'&&rule?.seasonId===win.seasonId)
   cutoff=rule.advance?.[win.region]||null;
  const record=toParticipation(row,win,cutoff);
  fail(record,'unsafe participation conversion '+row.id);
  // Published equivalents need manual reconciliation rather than
  // hiding a potentially different round under a participation record.
  const equivalence=d.results.filter(x=>publishedEquivalent(record,[x]));
  fail(equivalence.length===0,'potential already-published participation equivalent '+row.id);
  attendance.push({row,record,win,cutoff,origin});
 }catch(e){
  held.push({id:row.id,origin:origins.join('+'),reason:String(e.message||e)});
 }
}
if(!dry){
 const approvedIds=[];
 for(const x of published){
  fail(!recorded.has(x.record.id),'collision while publishing '+x.record.id);
  d.results.push(x.record);recorded.add(x.record.id);approvedIds.push(x.record.id);
 }
 const saved=appendArchive(root,attendance.map(x=>({win:x.win,proposals:[x.row],cutoff:x.cutoff})),
  d.results,{checkedAt:now});
 fail(saved.rejected===0,'participation archive rejected a validated row');
 // Verify that all attendance claims are physically represented, whether
 // freshly inserted or already present, before marking anything resolved.
 const months=new Map();
 for(const x of attendance){
  const ym=x.row.date.slice(0,7);
  if(!months.has(ym))months.set(ym,new Set(read('participation/'+ym+'.json').entries.map(z=>z.id)));
  fail(months.get(ym).has(x.record.id),'archive entry missing '+x.row.id);
 }
 for(const x of published){
  d.reviewed.entries.push({id:x.row.id,decision:'published',recordId:x.record.id,reviewedAt:now,
   source:x.row.source,policy:x.policy,rule:x.rule});
  d.ledger.entries.push({id:x.row.id,decision:'published',recordId:x.record.id,
   policy:x.policy,approvedAt:now,
   approvedBy:'ChatGPT / user-authorized source-backed review',
   source:x.row.source,rule:x.rule,
   evidence:x.policy==='official-final-vr-award'?
    'Exact Epic roster + official session + mature saved 1VR/100pt scoreboard + S31 official $100/VR':
    'Exact Epic roster + official calendar + mature saved rank and region-specific qualifier cutoff'});
 }
 for(const x of dedup)d.reviewed.entries.push({id:x.row.id,decision:'already-published',
  existingId:x.existingId,reviewedAt:now,source:x.row.source,
  note:'Same official event/player/points/kills/VR as original skin result; preserve Tracker record and rank.'});
 for(const x of attendance)d.reviewed.entries.push({id:x.row.id,decision:'participation-archived',
  recordId:x.record.id,reviewedAt:now,source:x.row.source,
  note:'Epic ID + exact official event/calendar + mature saved leaderboard; cash, skin and advancement not assumed'});
 const done=new Set([...published,...dedup,...attendance].map(x=>x.row.id));
 fail(new Set(d.reviewed.entries.map(x=>x.id)).size===d.reviewed.entries.length,
   'reviewed ledger duplicate IDs');
 for(const origin of ['auto','history']){
  const before=d.reviews[origin].proposals.length;
  d.reviews[origin].proposals=d.reviews[origin].proposals.filter(x=>!done.has(x.id));
  const count=before-d.reviews[origin].proposals.length;
  if(!count)continue;
  d.reviews[origin].manualReviewedAt=now;
  const status=d.statuses[origin],q=d.reviews[origin].proposals;
  status.found=q.length;status.manualReviewCandidates=q.length;
  status.reviewOnlyCandidates=q.filter(x=>x.reviewOnly===true).length;
  status.manuallyPublished=(status.manuallyPublished||0)+published.filter(x=>x.origin===origin).length;
  status.manuallyResolvedDuplicates=(status.manuallyResolvedDuplicates||0)+dedup.filter(x=>x.origin===origin).length;
  status.lastReviewedBatchAt=now;
  status.latestManualReview={
    reviewedAt:now,reviewedCandidates:count,
    published:published.filter(x=>x.origin===origin).length,
    participationArchived:attendance.filter(x=>x.origin===origin).length,
    duplicatesResolved:dedup.filter(x=>x.origin===origin).length,
    remainingPending:q.length,
    policy:'Exact Epic ID, official calendar session, mature original leaderboard, official S30/S31 region-specific qualification rules, S31 $100/VR rule'
  };
  status.message='残候補の原本再調査：正式予選突破'+published.filter(x=>x.origin===origin).length+
   '件・出場'+attendance.filter(x=>x.origin===origin).length+
   '件・既掲載重複'+dedup.filter(x=>x.origin===origin).length+
   '件を解決。残り'+q.length+'件。報酬は推定しない。';
 }
 if(published.length){
  const hash=crypto.createHash('sha256').update(approvedIds.slice().sort().join('|')).digest('hex').slice(0,12);
  const entryId='triage-verified-20261112-'+hash;
  fail(!d.updates.entries.some(x=>x.id===entryId),'unexpected duplicate update marker');
  const cash=published.filter(x=>x.policy==='official-final-vr-award').length;
  const qualified=published.length-cash;
  d.updates.entries.unshift({id:entryId,date:dateJst,type:'records',
   title:'公式順位表を再照合：予選突破'+qualified+'件・賞金決勝'+cash+'件',
   description:'2024年S30/S31のME/OCE予選は各シーズン・地域の公式通過条件で$0の突破実績として、S31のNAC/OCE/ME決勝は本人Epic ID・1VR/100pt・公式全地域$100/VR規則で賞金記録として照合。実際の支払は未確認。参加記録は賞金に含めない。',
   recordIds:approvedIds});
 }
 d.reviewed.reviewedAt=now;d.ledger.reviewedAt=now;
 for(const [file,value] of [
  ['results.json',d.results],['updates.json',d.updates],
  ['history-sync-review.json',d.reviews.history],['auto-sync-review.json',d.reviews.auto],
  ['history-sync-reviewed.json',d.reviewed],['approval-history.json',d.ledger],
  ['history-sync-status.json',d.statuses.history],['auto-sync-status.json',d.statuses.auto]
 ])write(file,value);
 const st=read('participation-status.json');
 const index=read('participation-index.json');
 st.total=index.total;st.lastManualReviewAt=now;
 st.manualReviewPublished=(st.manualReviewPublished||0)+saved.added;
 st.message='元順位表で確認した海外大会出場'+saved.added+
  '件を追加。突破・現金賞金・スキン獲得を推測で加算しない。';
 write('participation-status.json',st);
}
const report={dry,originalTargetIds:TARGET_IDS.size,stillInQueue:audience.size,missing:missing.length,
 published:published.length,qualified:published.filter(x=>x.policy==='verified-rule').length,
 cashFinals:published.filter(x=>x.policy==='official-final-vr-award').length,
 attendance:attendance.length,alreadyPublishedDuplicates:dedup.length,
 held:held.length,heldReasons:held.slice(0,40),byPlayer:published.map(x=>({
  name:x.row.player,region:x.row.region,date:x.row.date,rank:x.row.rank,points:x.row.points,kills:x.row.kills,vrs:x.row.vrs,prize:x.record.prize
 }))};
console.log('TRIAGE_RESOLVE_20261112 '+JSON.stringify(report));
if(require.main===module)module.exports=report;
