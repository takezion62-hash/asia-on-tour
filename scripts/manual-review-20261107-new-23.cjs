'use strict';
// Historical queue review 2026-11-07: source-backed zero-cash rows and cosmetic,
// with exact saved Epic-ID scores, independent rule pages, and no duplication.
// Never add positive cash from unconfirmed participation or match wins.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=file=>JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
const write=(file,obj)=>fs.writeFileSync(path.join(root,file),JSON.stringify(obj,null,2)+'\n');
const ids=["auto-s39-8013b82bd26c","auto-s39-e295a8430e56","auto-s41-2ab71c261ebc","auto-s39-c5d51157b59b","auto-s42-ef18ae1d40bd","auto-s31-ccd4e8b8fdde","auto-s31-a56e2e669d49","auto-s31-6694e5414706","auto-s31-ac68f34a6cb1","auto-s31-6fc342970b34","auto-s31-03fbfacef9b7","auto-s31-8453057e5e57","auto-s31-f96176a9ae2b","auto-s31-774803c04e8a","auto-s31-d2a196418954","auto-s36-6bbf300c2d1c","auto-s36-c3316b41a513","auto-s36-7b8e6f8a9909","auto-s36-dadb1051063a","auto-s36-bc5aa1e89c91","auto-s30-219da620d0e2"];
const recentIds=["auto-s43-c51e2bbfb3ed","auto-s43-6b7fe976d9eb"];
const mark='verified-review-20261107-21-history-and-2-recent';
const url={
 unreal:'https://www.fortnite.com/competitive/rules-guidelines/rules-library/1-million-dollar-unreal-cup-chapter-7-season-1-official-rules',
 trackerNaw:'https://fortnitetracker.com/events/epicgames_S39_1MillionUnrealCup_NAW?window=S39_1MillionUnrealCup_NAW',
 trackerOce:'https://fortnitetracker.com/events/epicgames_S39_1MillionUnrealCup_OCE?window=S39_1MillionUnrealCup_OCE',
 solo30:'https://www.fortnite.com/news/fortnite-victory-cash-cups-chapter-5-season-3-official-rules',
 solo31:'https://www.fortnite.com/news/fortnite-victory-cash-cups-chapter-5-season-4-official-rules',
 duo31:'https://www.fortnite.com/news/duos-cash-cups-chapter-5-season-4-official-rules',
 console:'https://fortnitetracker.com/events/epicgames_S36_VictoryDuosCup_NAW?window=S36_VictoryDuosCup_Event1Round2_NAW',
 playstation:'https://www.fortnite.com/competitive/rules-guidelines/rules-library/days-of-play-playstation-cup-chapter-7-season-3-official-rules',
 playstationTracker:'https://fortnitetracker.com/events/epicgames_S41_PSCupDaysOfPlay_NAW?window=S41_PSCupDaysOfPlay_Qualifier_NAW',
 perf:'https://fortnitetracker.com/events/epicgames_S42_PerformanceEvaluation_NAC?window=S42_PerformanceEvaluation_Event4Round1_NAC'
};
const results=read('results.json'),history=read('history-sync-review.json'),recent=read('auto-sync-review.json'),
 scan=read('history-sync-scan.json'),players=read('players.json'),tours=read('tournaments.json'),
 rules=read('tournament-rules.json'),ledger=read('history-sync-reviewed.json'),
 histStatus=read('history-sync-status.json'),recentStatus=read('auto-sync-status.json'),updates=read('updates.json');
if(updates.entries.some(x=>x.id===mark)){console.log('REVIEW23_ALREADY_APPLIED');process.exit(0)}
if(ids.length!==21||recentIds.length!==2||new Set(ids).size!==21||new Set(recentIds).size!==2||
 !Array.isArray(results)||!scan.windows)throw Error('Frozen manifest/DB malformed');
const hqueue=new Map(history.proposals.map(x=>[x.id,x])),rqueue=new Map(recent.proposals.map(x=>[x.id,x])),
 byTournament=new Map(tours.catalog.map(t=>[t.id,t])),known=new Set(players.candidates.map(p=>p.name)),
 ledgerIds=new Set(ledger.entries.map(e=>e.id)),calendar=new Map();
const norm=x=>String(x).trim().normalize('NFKC').toLowerCase();
const aliases=new Map();
for(const [canon,alts] of Object.entries(players.confirmedAliases||{})){
 aliases.set(norm(canon),canon);
 for(const v of alts)aliases.set(norm(v),canon);
}
const members=x=>x.players?.length?x.players:[x.player];
const teamKey=x=>members(x).map(p=>aliases.get(norm(p))||norm(p)).sort().join('|');
function sourceWindow(row){
 try{
  const u=new URL(row.source);
  return u.searchParams.get('round')||u.searchParams.get('window');
 }catch{return null}
}
function phase(row){
 const s=sourceWindow(row)||String(row.round||'');
 const m=s.match(/Event[_ ]?(\d+)[_ ]?Round[_ ]?(\d+)/i);
 return m?m[1]+'-'+m[2]:s.includes('Qualifier')?'Qualifier':null;
}
function sameEvent(a,b){
 if(a.date!==b.date||a.region!==b.region||a.tournamentId!==b.tournamentId||
    teamKey(a)!==teamKey(b))return false;
 const p=phase(a),q=phase(b);
 return !p||!q||p===q;
}
function sameScore(a,b){
 return ['rank','points','kills','vrs'].every(k=>a[k]===b[k])&&
  (a.matches==null||b.matches==null||a.matches===b.matches);
}
function verifyRecorded(row,mode='history'){
 if(!row||row.verified!==true||row.prize!==null||!Number.isSafeInteger(row.rank)||row.rank<1||
  !Number.isSafeInteger(row.points)||row.points<0||
  !Number.isSafeInteger(row.kills)||row.kills<0||
  !Number.isSafeInteger(row.vrs)||row.vrs<0||
  !Number.isSafeInteger(row.matches)||row.matches<1||row.vrs>row.matches)
  throw Error('Original verified score missing or invalid');
 const t=byTournament.get(row.tournamentId),roster=members(row),size={solo:1,duo:2,trio:3,squad:4}[t?.team];
 if(!t||t.name!==row.event||t.seasonId!==row.seasonId||
    !Number.isInteger(size)||roster.length!==size||
    new Set(roster).size!==size||!roster.every(x=>known.has(x))||
    row.player!==roster.join(' / '))throw Error('Tournament catalog or player identity invalid');
 const u=new URL(row.source),e=u.pathname.match(/^\/competitive\/events\/([^/]+)\/$/),
    window=u.searchParams.get('round');
 if(u.protocol!=='https:'||u.hostname!=='www.fortnite.com'||
    !e||!t.sourceEventIds.includes(e[1])||u.searchParams.get('region')!==row.region||
    !window||!window.startsWith(row.seasonId+'_')||!window.endsWith('_'+row.region))
  throw Error('Epic source event/window mismatch');
 const month=row.date.slice(0,7);
 if(!calendar.has(month))calendar.set(month,read('calendar-history/'+month+'.json').sessions);
 const valid=calendar.get(month).filter(s=>s.eventId===e[1]&&s.tournamentId===t.id&&
    s.seasonId===row.seasonId&&s.dateJst===row.date&&s.region===row.region&&
    s.sourceWindowId===window);
 if(valid.length!==1)throw Error('Official archived event calendar not matched');
 if(mode==='history'){
  const cp=scan.windows['epicgames_'+e[1]+'_'+row.region+'/'+window];
  const original=(cp?.proposals||[]).filter(x=>x.id===row.id);
  if(!cp||cp.nextPage<1||original.length!==1)
   throw Error('Saved original Epic score/ID checkpoint not unique');
  for(const k of ['id','date','region','player','playerRaw','event','round',
      'rank','points','kills','vrs','matches','prize','kind','seasonId',
      'tournamentId','source','verified']){
   if(JSON.stringify(original[0][k]??null)!==JSON.stringify(row[k]??null))
    throw Error('Saved Epic leaderboard row changed: '+k);
  }
  if(JSON.stringify(original[0].players||null)!==JSON.stringify(row.players||null)||
     JSON.stringify(original[0].teamAccountIds||null)!==JSON.stringify(row.teamAccountIds||null))
    throw Error('Team members or Epic IDs changed');
  if(size>1&&(!Array.isArray(row.teamAccountIds)||row.teamAccountIds.length!==size||
   new Set(row.teamAccountIds).size!==size||row.teamAccountIds.some(id=>!/^[a-f0-9]{32}$/.test(id))))
    throw Error('Multi-player Epic account identities unverified');
 }
 return {t,window};
}
function classify(row){
 const {reviewOnly,reviewReason,teamAccountIds,note,...record}=row;
 const is=(id,season,region)=>row.tournamentId===id&&row.seasonId===season&&row.region===region;
 let basis=null,kind=null,round=null,prize=0,perPlayer=null,caption='';
 if(is('ch7s1-one-million-unreal-cup','S39',row.region)&&['NAW','OCE'].includes(row.region)){
  const spec=rules.rules.find(x=>x.id===row.tournamentId),regionTiers=spec?.cashPrizes?.tiers?.[row.region]||[];
  const threshold=regionTiers.at(-1)?.through;
  if(row.kind!=='参加確認'||row.round!=='単一開催枠 / 参加確認'||
     spec?.cashPrizes?.basis!=='per-team'||spec?.cashPrizes?.teamSize!==2||
     !Number.isSafeInteger(threshold)||row.rank<=threshold||
     !['2025-12-20','2025-12-21'].includes(row.date)||row.matches>10)
    throw Error('Unreal prize boundary or round identity not safe');
  kind='賞金決勝';round='単一開催枠 / 賞金決勝';perPlayer=0;
  basis=url.unreal;caption='Epic公式の地域別チーム賞金圏は上位'+threshold+
    '組。今回'+row.rank+'位は賞金圏外のためチーム$0、個人各$0。'+
    '公式大会ID、本人Epic IDの保存順位表とTracker地域別賞金表を照合。Tracker: '+
    (row.region==='NAW'?url.trackerNaw:url.trackerOce);
 }else if(['ch5s4-solo-victory-cup','ch5s3-solo-victory-cup'].includes(row.tournamentId)){
  const is31=row.tournamentId==='ch5s4-solo-victory-cup';
  if(!['S30','S31'].includes(row.seasonId)||row.seasonId!==(is31?'S31':'S30')||
     !['OCE','ME'].includes(row.region)||row.kind!=='賞金決勝'||row.vrs!==0||
     row.points!==0||row.prize!==null||row.matches>3||
     !/^Event \d+ · Round 2 \/ 賞金決勝$/.test(row.round))
    throw Error('Solo VC final payout or season mismatch');
  kind='賞金決勝';round=row.round;basis=is31?url.solo31:url.solo30;
  caption='Epic公式の2024年Solo Victory Cash Cup決勝は1VRごとに個人$100。'+
   '保存した公式順位表では0VRのため賞金$0。決勝進出成績は掲載し、賞金は加算しない。';
 }else if(is('ch5s4-duos-cash-cup','S31','ME')){
  if(row.kind!=='参加確認'||row.rank<=50||row.matches>10||
    !/^Event 4 · Round 1 \/ 参加確認$/.test(row.round))
    throw Error('Duos cash qualifier and round mismatch');
  kind='参加確認';round='Event 4 · Round 1 / 出場確認';basis=url.duo31;
  caption='2024年Duos Cash CupはRound1上位50組だけが決勝進出。今回'+row.rank+
   '位は予選突破外で、Round1に現金賞金なし（$0）。';
 }else if(is('ch6s3-console-duos-victory','S36','NAW')){
  if(row.kind!=='賞金決勝'||row.vrs!==0||row.points!==0||
    row.matches>3||row.date!=='2025-06-14'||
    row.round!=='Event 1 · Round 2 / 賞金決勝')
    throw Error('Console Victory duo zero-VR final mismatch');
  kind='賞金決勝';round=row.round;basis=url.console;perPlayer=0;
  caption='2025年6月14日NAW Console Victory Duos決勝は1VRごとにチーム$200（個人各$100）。'+
   '保存順位表で0VRを確認、賞金はチーム$0／各$0。';
 }else if(is('ch7s4-performance-evaluation','S42','NAC')){
  if(row.kind!=='参加確認'||row.rank<=50||
    row.round!=='Event 4 · Round 1 / 参加確認'||row.matches>10||
    row.date!=='2026-09-18')throw Error('Performance qualifier identity invalid');
  kind='参加確認';round='Event 4 · Round 1 / 出場確認';basis=url.perf;
  caption='TrackerでNAC Event4 Round1は上位50組が決勝へ進出。'+row.rank+
   '位のため決勝進出はなく、Round1の現金賞金$0。';
 }else if(is('ch7s3-days-of-play-playstation-cup-br','S41','NAW')){
  if(row.date!=='2026-06-08'||row.kind!=='参加確認'||row.rank<=100||
   row.points<8||row.matches>10||row.round!=='Qualifier / 参加確認')
   throw Error('NAW PlayStation spray or session mismatch');
  kind='スキン大会';round='Qualifier / スプレー獲得';basis=url.playstation;
  caption='Epic公式規則でQualifier8pt以上のFlorin’s Victoryスプレー対象。'+
   row.points+'ptで条件達成（配布完了は未確認）。'+row.rank+
   '位で上位100位の決勝進出はなし。現金賞金$0。Tracker: '+url.playstationTracker;
 }else throw Error('Unexpected tournament or score classification');
 if(!kind||!basis||prize!==0)throw Error('Cash classification not confirmed');
 return {...record,kind,round,prize,...(perPlayer!==null?{prizePerPlayer:perPlayer}:{}),
  note:caption+' 本人Epic ID・大会日付・地域・元の公式保存順位表を照合。出典: '+basis};
}
const added=[],duplicates=[],clearedRecent=[],held=[];
for(const id of ids){
 const row=hqueue.get(id);
 if(!row){if(results.some(x=>x.id===id)||ledgerIds.has(id))continue;held.push({id,reason:'Not present in latest historical queue'});continue}
 try{
  verifyRecorded(row);
  if(ledgerIds.has(id))throw Error('Already reviewed and must not publish twice');
  const old=results.find(x=>sameEvent(x,row));
  if(old){
   if(!sameScore(old,row))throw Error('Existing same player+round with different score: '+old.id);
   duplicates.push({id,existingId:old.id});
   ledger.entries.push({id,decision:'already-published',existingId:old.id,source:row.source,
    evidence:'Exact event, team, rank and score already recorded; do not duplicate'});
   ledgerIds.add(id);continue;
  }
  const record=classify(row);
  if(results.some(x=>sameEvent(x,record)))throw Error('Unexpected collision after classification');
  results.push(record);added.push(record);
  ledger.entries.push({id,decision:'published',recordId:id,source:row.source,
   rule:record.note.match(/https:\/\/\S+/)?.[0]||null,
   evidence:'Exact original Epic-ID row, official dated tournament window, independent published prize rule; zero-dollar or cosmetic attendance only'});
  ledgerIds.add(id);
 }catch(e){held.push({id,reason:e.message})}
}
for(const id of recentIds){
 const row=rqueue.get(id);
 if(!row){if(ledgerIds.has(id)||results.some(x=>x.id===id))continue;held.push({id,reason:'Recent duplicate candidate missing'});continue}
 try{
  // A reused manually published result can have an alternate ID, but MUST have
  // identical canonical player/date/region/official event/score before suppression.
  if(row.event!=='One Piece: Zoro Mobile Cup'||row.date!=='2026-11-06'||
     row.region!=='OCE'||row.verified!==true||row.prize!==null||
     row.tournamentId!=='ch7s5-one-piece-zoro-mobile-cup')
    throw Error('Not an exact Zoro candidate');
  const old=results.find(x=>sameEvent(x,row));
  if(!old||!sameScore(old,row))throw Error('No matching verified published Zoro score');
  if(!ledgerIds.has(id))ledger.entries.push({id,decision:'already-published',existingId:old.id,
   source:row.source,evidence:'Existing Zoro OCE event, participant and all score fields checked; never overwrite existing reward'});
  ledgerIds.add(id);clearedRecent.push({id,existingId:old.id});
 }catch(e){held.push({id,reason:e.message})}
}
const done=new Set([...added.map(x=>x.id),...duplicates.map(x=>x.id)]),recDone=new Set(clearedRecent.map(x=>x.id));
if(!done.size&&!recDone.size){console.log('REVIEW23_NONE '+JSON.stringify({held}));process.exit(0)}
history.proposals=history.proposals.filter(x=>!done.has(x.id));
recent.proposals=recent.proposals.filter(x=>!recDone.has(x.id));
const stamp=new Date().toISOString();
history.manualReviewedAt=stamp;recent.manualReviewedAt=stamp;ledger.reviewedAt=stamp;
histStatus.found=history.proposals.length;histStatus.manualReviewCandidates=history.proposals.length;
histStatus.reviewOnlyCandidates=history.proposals.filter(x=>x.reviewOnly===true).length;
histStatus.manuallyPublished=(histStatus.manuallyPublished||0)+added.length;
histStatus.manuallyResolvedDuplicates=(histStatus.manuallyResolvedDuplicates||0)+duplicates.length;
histStatus.lastReviewedBatchAt=stamp;
histStatus.message='2026/11/07過去候補のルール・本人確認: '+added.length+'戦績を$0/スプレーで掲載、'+
 duplicates.length+'件既存一致、'+held.filter(x=>ids.includes(x.id)).length+'件保留。過去確認待ち'+history.proposals.length+'件。';
recentStatus.found=recent.proposals.length;recentStatus.manualReviewCandidates=recent.proposals.length;
recentStatus.reviewOnlyCandidates=recent.proposals.filter(x=>x.reviewOnly===true).length;
recentStatus.manuallyResolvedDuplicates=(recentStatus.manuallyResolvedDuplicates||0)+clearedRecent.length;
recentStatus.message='Zoro Mobile Cup同一成績'+clearedRecent.length+
 '件を既存掲載と照合し、重複防止で処理。追加確認待ち'+recent.proposals.length+'件。';
if(added.length)updates.entries.unshift({id:mark,date:stamp.slice(0,10),type:'records',
 title:'過去のUnreal・Solo VC・Console・Cash・Performanceなど'+added.length+'戦績を確認掲載',
 description:'Epicの本人ID付き保存順位、公式日程、Trackerの地域別賞金・突破順位を照合。決勝0VR、予選未突破、Unreal圏外は$0。NAW PlayStation 8ptスプレー獲得条件を現金と区別。既存Zoro重複は再登録なし。',
 recordIds:added.map(x=>x.id)});
write('results.json',results);write('history-sync-review.json',history);write('auto-sync-review.json',recent);
write('history-sync-reviewed.json',ledger);write('history-sync-status.json',histStatus);
write('auto-sync-status.json',recentStatus);write('updates.json',updates);
console.log('REVIEW23_RESULT '+JSON.stringify({new:added.length,duplicates,clearedRecent,held,
 remainingHistory:history.proposals.length,remainingRecent:recent.proposals.length,
 byEvent:added.reduce((a,x)=>(a[x.event]=(a[x.event]||0)+1,a),{}),
 records:added.map(x=>({id:x.id,player:x.player,rank:x.rank,event:x.event,region:x.region,kind:x.kind,prize:x.prize}))}));
