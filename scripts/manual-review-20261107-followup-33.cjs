'use strict';
// 2026-11-07 follow-up historical review: 33 source-checked $0/cosmetic
// records. Preserve the already-published conflicting 3peace/Job result.
const fs=require('node:fs'),path=require('node:path'),root=path.resolve(__dirname,'..');
const read=x=>JSON.parse(fs.readFileSync(path.join(root,x),'utf8'));
const write=(x,v)=>fs.writeFileSync(path.join(root,x),JSON.stringify(v,null,2)+'\n');
const ids=["auto-s39-a052b0a15965","auto-s43-b0bd703cb7b4","auto-s41-1e2148d2aff7","auto-s41-93e50e2ec760","auto-s42-2bad772e0151","auto-s42-4c87b55ce849","auto-s31-32c8bed6be0f","auto-s31-1c0ed290d956","auto-s31-8059e72134fb","auto-s31-dc23adb9c9b7","auto-s31-2361e266b2e9","auto-s31-600028028d08","auto-s31-26aa7c7044c5","auto-s31-f6cd6d283787","auto-s31-a43cc6e4283a","auto-s31-a2d7fc11b6c4","auto-s31-949f34257f4d","auto-s30-e1a5e5e8fc06","auto-s30-cb3ff7cc63f3","auto-s30-744c768c6ca2","auto-s30-35530fb15343","auto-s30-83841940bad4","auto-s37-b2638106ca87","auto-s37-f7fdfd3f3d00","auto-s37-e8fd49cf5ee6","auto-s37-1c38633a3406","auto-s37-bbb7d2094406","auto-s40-dd7539f3d9b5","auto-s40-bdd795391f30","auto-s40-84e71cf9fbbf","auto-s40-aab17b5edeef","auto-s40-b055153274e5","auto-s40-bf4cfcb568bf"];
const marker='verified-history-20261107-followup-33';
const urls={
 unreal:'https://www.fortnite.com/competitive/rules-guidelines/rules-library/1-million-dollar-unreal-cup-chapter-7-season-1-official-rules',
 soloS30:'https://www.fortnite.com/news/fortnite-victory-cash-cups-chapter-5-season-3-official-rules',
 soloS31:'https://www.fortnite.com/news/fortnite-victory-cash-cups-chapter-5-season-4-official-rules',
 console:'https://www.fortnite.com/competitive/rules-guidelines/rules-library/fortnite-duos-console-victory-cash-cups-chapter-6-season-4-official-rules',
 fncs:'https://fortnitetracker.com/events/epicgames_S40_FNCSDivisionalCup_Division1_NAW?window=S40_FNCSDivisionalCup_Division1_Week2Day1_NAW',
 playstation:'https://www.fortnite.com/competitive/rules-guidelines/rules-library/days-of-play-playstation-cup-chapter-7-season-3-official-rules',
 perf:'https://fortnitetracker.com/events/epicgames_S42_PerformanceEvaluation_NAC?window=S42_PerformanceEvaluation_Event4Round1_NAC',
 test:'https://www.fortnite.com/competitive/events/S43_SoloReloadTestCup/?region=NAW&round=S43_SoloReloadTestCup_NAW'
};
const results=read('results.json'),review=read('history-sync-review.json'),scan=read('history-sync-scan.json'),
 players=read('players.json'),tournaments=read('tournaments.json'),rules=read('tournament-rules.json'),
 ledger=read('history-sync-reviewed.json'),status=read('history-sync-status.json'),updates=read('updates.json');
if(updates.entries.some(x=>x.id===marker)){console.log('FOLLOWUP33_ALREADY_APPLIED');process.exit(0)}
if(ids.length!==33||new Set(ids).size!==33||!Array.isArray(results)||!scan.windows)
 throw Error('Manifest/DB invalid');
const pending=new Map(review.proposals.map(x=>[x.id,x])),catalog=new Map(tournaments.catalog.map(t=>[t.id,t])),
 known=new Set(players.candidates.map(p=>p.name)),ledgerIds=new Set(ledger.entries.map(e=>e.id)),months=new Map();
const norm=x=>String(x).trim().normalize('NFKC').toLowerCase(),alias=new Map();
for(const [canonical,names] of Object.entries(players.confirmedAliases||{})){
 alias.set(norm(canonical),canonical);for(const name of names)alias.set(norm(name),canonical);
}
const team=x=>(x.players?.length?x.players:[x.player]).map(n=>alias.get(norm(n))||norm(n)).sort().join('|');
const win=x=>{try{return new URL(x.source).searchParams.get('round')}catch{return null}};
const stage=x=>{const m=String(win(x)||x.round||'').match(/Event[_ ]?(\d+)[_ ]?Round[_ ]?(\d+)/i);return m?m[1]+'-'+m[2]:null};
function duplicate(a,b){
 if(a.tournamentId!==b.tournamentId||a.date!==b.date||a.region!==b.region||team(a)!==team(b))return false;
 return !stage(a)||!stage(b)||stage(a)===stage(b);
}
function equalScore(a,b){return ['rank','points','kills','vrs'].every(k=>a[k]===b[k])&&
 (a.matches==null||b.matches==null||a.matches===b.matches)}
function verify(row){
 if(!row||row.verified!==true||row.prize!==null||
 !Number.isSafeInteger(row.rank)||row.rank<1||!Number.isSafeInteger(row.points)||row.points<0||
 !Number.isSafeInteger(row.kills)||row.kills<0||!Number.isSafeInteger(row.vrs)||row.vrs<0||
 !Number.isSafeInteger(row.matches)||row.matches<1||row.vrs>row.matches)
  throw Error('Invalid saved Epic score');
 const t=catalog.get(row.tournamentId),p=row.players?.length?row.players:[row.player];
 if(!t||t.name!==row.event||t.seasonId!==row.seasonId||!Array.isArray(t.sourceEventIds)||
  p.length!==({solo:1,duo:2,trio:3,squad:4})[t.team]||
  new Set(p).size!==p.length||p.some(n=>!known.has(n))||
  row.player!==p.join(' / '))throw Error('Missing official tournament or confirmed player roster');
 const u=new URL(row.source),m=u.pathname.match(/^\/competitive\/events\/([^/]+)\/$/),w=u.searchParams.get('round');
 if(u.protocol!=='https:'||u.hostname!=='www.fortnite.com'||!m||
  !t.sourceEventIds.includes(m[1])||u.searchParams.get('region')!==row.region||
  !w||!w.startsWith(row.seasonId+'_')||!w.endsWith('_'+row.region))
    throw Error('Epic event/round/region not matching');
 const month=row.date.slice(0,7);
 if(!months.has(month))months.set(month,read('calendar-history/'+month+'.json').sessions);
 const times=months.get(month).filter(s=>s.eventId===m[1]&&s.tournamentId===t.id&&
  s.seasonId===row.seasonId&&s.region===row.region&&s.dateJst===row.date&&
  s.sourceWindowId===w);
 if(times.length!==1)throw Error('Official calendar date/round missing');
 const cp=scan.windows['epicgames_'+m[1]+'_'+row.region+'/'+w],prior=(cp?.proposals||[]).filter(x=>x.id===row.id);
 if(!cp||cp.nextPage<1||prior.length!==1)throw Error('No unique saved Epic-ID checkpoint');
 const other=prior[0];
 for(const k of ['id','date','region','player','playerRaw','event','round','rank','points','kills',
    'vrs','prize','kind','matches','seasonId','tournamentId','source','verified'])
  if(JSON.stringify(other[k]??null)!==JSON.stringify(row[k]??null))throw Error('Original leaderboard differs: '+k);
 if(JSON.stringify(other.players||null)!==JSON.stringify(row.players||null)||
    JSON.stringify(other.teamAccountIds||null)!==JSON.stringify(row.teamAccountIds||null))
  throw Error('Confirmed two-player roster mismatch');
 if(row.teamAccountIds!==undefined){
  if(!Array.isArray(row.teamAccountIds)||row.teamAccountIds.length!==p.length||
     new Set(row.teamAccountIds).size!==p.length||
     row.teamAccountIds.some(x=>!/^[a-f0-9]{32}$/.test(x)))
   throw Error('Malformed historical Epic player IDs');
 }else if(p.length>1&&!['ch6s4-console-duos-victory','ch7s2-fncs-division-1'].includes(row.tournamentId))
   throw Error('Unconfirmed team Epic ID list');
 return t;
}
function classify(row){
 const {reviewOnly,reviewReason,teamAccountIds,note,...data}=row;
 let result={...data},rule,summary,share;
 if(row.tournamentId==='ch7s1-one-million-unreal-cup'&&row.seasonId==='S39'&&row.region==='NAW'){
  const r=rules.rules.find(x=>x.id===row.tournamentId);
  if(!r||r.cashPrizes?.tiers?.NAW?.at(-1)?.through!==500||row.rank<=500||
   row.date!=='2025-12-21'||row.kind!=='参加確認'||row.matches>10)
    throw Error('Unreal NAW official cash cutoff mismatch');
  result.kind='賞金決勝';result.round='単一開催枠 / 賞金決勝';result.prizePerPlayer=0;
  rule=urls.unreal;summary='NAW Unreal Cup上位500組までが賞金対象。'+row.rank+'位は圏外、デュオ合計/個人ともに$0。';
 }else if(row.tournamentId==='ch7s5-solo-reload-test-cup'&&row.seasonId==='S43'&&row.region==='NAW'){
  if(row.date!=='2026-11-02'||row.kind!=='参加確認'||row.matches>12||
    row.round!=='単一開催枠 / 参加確認')throw Error('Not confirmed Solo Reload Test Cup');
  result.kind='参加確認';rule=urls.test;
  summary='Epic公式大会の説明により2026年11月2日のSolo Reload Test Cupは賞品なし。'+row.rank+'位・'+row.points+'ptを$0で記録。';
 }else if(row.tournamentId==='ch7s3-days-of-play-playstation-cup-br'&&row.seasonId==='S41'&&row.region==='NAW'){
  if(row.date!=='2026-06-08'||row.kind!=='参加確認'||row.rank<=100||
    row.points<8||row.matches>10||row.round!=='Qualifier / 参加確認')
    throw Error('NAW PlayStation prize/qualification mismatch');
  result.kind='スキン大会';result.round='Qualifier / スプレー獲得';
  rule=urls.playstation;summary='8pt以上のFlorin’s Victoryスプレー獲得条件を'+row.points+
   'ptで満たした（配布確認なし）。'+row.rank+'位は決勝進出圏外、現金$0。';
 }else if(row.tournamentId==='ch7s4-performance-evaluation'&&row.seasonId==='S42'&&row.region==='NAC'){
  if(row.date!=='2026-09-18'||row.kind!=='参加確認'||row.rank<=50||
   row.round!=='Event 4 · Round 1 / 参加確認'||row.matches>10)
    throw Error('Performance qualifier and cash distinction mismatch');
  result.kind='参加確認';result.round='Event 4 · Round 1 / 出場確認';
  rule=urls.perf;summary='NAC Performance Evaluation Event4はRound1上位50組のみ決勝へ。'+
   row.rank+'位の出場順位で、決勝進出なし・Round1現金$0。';
 }else if(row.tournamentId==='ch5s4-solo-victory-cup'&&row.seasonId==='S31'&&row.region==='OCE'){
  if(row.date!=='2024-09-02'||row.kind!=='予選'||row.prize!==0||
   row.matches>7||row.rank>1500||row.round!=='Event 1 · Round 1 / 予選')
    throw Error('OCE CH5S4 qualifying cutoff/points mismatch');
  result.kind='予選';result.round='Event 1 · Round 1 / 予選突破';
  rule=urls.soloS31;summary='OCEのSolo Victory Cash Cup Round1上位1500人がRound2進出。'+
   row.rank+'位で予選突破、Round1の現金報酬$0。';
 }else if(['ch5s3-solo-victory-cup','ch5s4-solo-victory-cup'].includes(row.tournamentId)&&
    ['S30','S31'].includes(row.seasonId)&&['ME','OCE'].includes(row.region)){
  if(row.kind!=='賞金決勝'||row.prize!==null||row.vrs!==0||row.points!==0||
    row.matches>3||!/^Event \d+ · Round 2 \/ 賞金決勝$/.test(row.round))
    throw Error('Solo final is not a verified zero-VR score');
  result.kind='賞金決勝';rule=row.seasonId==='S30'?urls.soloS30:urls.soloS31;
  summary='2024年Solo Victory Cash Cup決勝は1VRにつき個人$100。'+
   row.rank+'位・0VRのため賞金$0。';
 }else if(row.tournamentId==='ch6s4-console-duos-victory'&&row.seasonId==='S37'&&row.region==='NAW'){
  if(row.date!=='2025-10-19'||row.kind!=='賞金決勝'||row.prize!==null||
    row.vrs!==0||row.points!==0||row.matches>3||
    row.round!=='Event 9 · Round 2 / 賞金決勝')
   throw Error('S37 Console duo final VR/payout mismatch');
  result.kind='賞金決勝';result.prizePerPlayer=0;rule=urls.console;
  summary='2025年10月19日NAW Console Duos Victory決勝はチーム1VRにつき$200。'+
   '今回0VRなのでチーム・個人賞金とも$0。';
 }else if(row.tournamentId==='ch7s2-fncs-division-1'&&row.seasonId==='S40'&&row.region==='ME'){
  if(row.date!=='2026-03-31'||row.kind!=='参加確認'||
    row.matches>11||win(row)!=='S40_FNCSDivisionalCup_Division1_Week2Day1_ME')
    throw Error('Not the exact Week2 Day1 FNCS session');
  result.kind='参加確認';rule=urls.fncs;
  summary='FNCS Div1 Week2 Day1の'+row.rank+
   '位。Day1/Day2合計の上位50組だけがWeekly Finals進出。単日の順位で決勝進出を断定しない。'+
   'Day1の現金賞金は$0。';
 }else throw Error('Unlisted tournament type');
 if(!rule||!summary)throw Error('No verified official payout rule');
 result.prize=0;result.note=summary+
   '選手名、地域、公式イベント日時と保存済みEpic順位表を照合。出典: '+rule;
 return result;
}
const added=[],duplicates=[],held=[];
for(const id of ids){
 const row=pending.get(id);
 if(!row){if(ledgerIds.has(id)||results.some(x=>x.id===id))continue;held.push({id,reason:'Candidate no longer in queue'});continue}
 try{
  verify(row);
  if(ledgerIds.has(id))throw Error('Previously reviewed');
  const old=results.find(x=>duplicate(x,row));
  if(old){
   if(!equalScore(old,row))throw Error('Existing matching event has contradictory rank/score: '+old.id);
   duplicates.push({id,existingId:old.id});
   ledger.entries.push({id,decision:'already-published',existingId:old.id,
     source:row.source,evidence:'Exact official session and scored event already present; duplicate suppressed'});
   ledgerIds.add(id);continue;
  }
  const converted=classify(row);
  if(results.some(x=>duplicate(x,converted)))throw Error('Second duplicate on converted result');
  results.push(converted);added.push(converted);
  ledger.entries.push({id,decision:'published',recordId:id,source:row.source,
   evidence:'Archived original Epic score and event session, verified public season rule, zero-dollar or cosmetic condition only'});
  ledgerIds.add(id);
 }catch(err){held.push({id,reason:err.message})}
}
const resolved=new Set([...added.map(x=>x.id),...duplicates.map(x=>x.id)]);
if(!resolved.size){console.log('FOLLOWUP33_NO_CHANGES '+JSON.stringify({held}));process.exit(0)}
review.proposals=review.proposals.filter(x=>!resolved.has(x.id));
const now=new Date().toISOString();review.manualReviewedAt=now;ledger.reviewedAt=now;
status.found=review.proposals.length;status.manualReviewCandidates=review.proposals.length;
status.reviewOnlyCandidates=review.proposals.filter(x=>x.reviewOnly===true).length;
status.manuallyPublished=(status.manuallyPublished||0)+added.length;
status.manuallyResolvedDuplicates=(status.manuallyResolvedDuplicates||0)+duplicates.length;
status.lastReviewedBatchAt=now;
status.message='追加の歴史候補を検証して'+added.length+'件を$0・予選突破・スプレーで掲載、'+
 duplicates.length+'件重複解消、'+held.length+'件保留。3peace/Job既存競合は上書き禁止。現確認待ち'+review.proposals.length+'件。';
if(added.length)updates.entries.unshift({id:marker,date:now.slice(0,10),type:'records',
 title:'過去Solo VC・Console・FNCS・Unreal等'+added.length+'戦績を追加掲載',
 description:'公式の保存順位表・大会日時・Epicの現金/スプレー/テスト大会規則を照合。予選突破・0VR決勝・FNCS Day1出場・賞金圏外を区別。既存と食い違う3peace/Job成績は未修正。',
 recordIds:added.map(x=>x.id)});
write('results.json',results);write('history-sync-review.json',review);
write('history-sync-reviewed.json',ledger);write('history-sync-status.json',status);write('updates.json',updates);
console.log('FOLLOWUP33_RESULT '+JSON.stringify({added:added.length,duplicates,held,
 remaining:review.proposals.length,byEvent:added.reduce((a,x)=>(a[x.event]=(a[x.event]||0)+1,a),{}),
 records:added.map(x=>({id:x.id,name:x.player,event:x.event,rank:x.rank,kind:x.kind,cash:x.prize}))}));
