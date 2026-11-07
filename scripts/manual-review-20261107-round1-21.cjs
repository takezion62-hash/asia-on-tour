'use strict';
// 2026-11-07 second historical review: finished qualifiers and attendance-only
// records with known zero cash; no monetary payments from non-final divisions.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const write=(p,x)=>fs.writeFileSync(path.join(root,p),JSON.stringify(x,null,2)+'\n');
const IDS=["auto-s31-b1e9107f9fef","auto-s40-c58175f566f6","auto-s40-ff1d02498e00","auto-s40-f6057c533bca","auto-s40-89381b1bbefb","auto-s36-8c8d8ade9ab9","auto-s40-4905f6f37758","auto-s40-15b985a2fcf7","auto-s40-219b2a0f6743","auto-s42-461d93f03b96","auto-s42-beee7acc0690","auto-s42-c1d050bf8a39","auto-s31-81d19f0d8ad6","auto-s31-85ca36c222c8","auto-s31-e3d1e3559e56","auto-s31-118adc8b2ebe","auto-s31-4b386cd3fe50","auto-s31-223244cf726b","auto-s31-1b810ca09f61","auto-s31-21b92a395d4f","auto-s31-8649baa73bc6"],marker='review-20261107-round1-participation-21';
const OFFICIAL={
 duo:'https://www.fortnite.com/news/duos-cash-cups-chapter-5-season-4-official-rules',
 console:'https://www.fortnite.com/news/fortnite-duos-console-victory-cash-cups-chapter-6-season-3-official-rules',
 fncs:'https://www.fortnite.com/competitive/rules-guidelines/rules-library/fncs-divisional-cups-chapter-7-season-2-official-rules',
 perf:'https://www.fortnite.com/competitive/events/S42_PerformanceEvaluation/?region=NAC&round=S42_PerformanceEvaluation_Event2Round1_NAC'
};
const db=read('results.json'),queue=read('history-sync-review.json'),scan=read('history-sync-scan.json'),
  tours=read('tournaments.json'),players=read('players.json'),ledger=read('history-sync-reviewed.json'),
  status=read('history-sync-status.json'),updates=read('updates.json');
if(updates.entries.some(x=>x.id===marker)){console.log('BATCH21_ALREADY_APPLIED');process.exit(0)}
if(IDS.length!==21||new Set(IDS).size!==21||!scan.windows||!Array.isArray(db))throw Error('Corrupt manifest/DB');
const pending=new Map(queue.proposals.map(x=>[x.id,x])),catalog=new Map(tours.catalog.map(x=>[x.id,x])),
 known=new Set(players.candidates.map(x=>x.name)),oldLedger=new Set(ledger.entries.map(x=>x.id)),month=new Map();
const alias=new Map(),normalize=x=>String(x).trim().normalize('NFKC').toLowerCase();
for(const [main,others] of Object.entries(players.confirmedAliases||{})){
 alias.set(normalize(main),main);for(const alt of others)alias.set(normalize(alt),main);
}
const lineup=x=>x.players?.length?x.players:[x.player];
const team=x=>lineup(x).map(name=>alias.get(normalize(name))||normalize(name)).sort().join('|');
const sourceWindow=x=>{try{return new URL(x.source).searchParams.get('round')||null}catch{return null}};
function sameSession(a,b){
 if(a.date!==b.date||a.region!==b.region||a.tournamentId!==b.tournamentId||team(a)!==team(b))return false;
 const A=sourceWindow(a),B=sourceWindow(b);
 if(A&&B)return A===B;
 return true; // uncertain older manual round => prevent double publication.
}
function validate(row){
 if(!row||row.verified!==true||!Number.isSafeInteger(row.rank)||row.rank<1||
  !Number.isSafeInteger(row.points)||row.points<0||!Number.isSafeInteger(row.kills)||row.kills<0||
  !Number.isSafeInteger(row.vrs)||row.vrs<0||!Number.isSafeInteger(row.matches)||row.matches<1||row.vrs>row.matches)
  throw Error('Invalid source score');
 const t=catalog.get(row.tournamentId),people=lineup(row);
 if(!t||t.name!==row.event||t.seasonId!==row.seasonId||
  people.length!==({solo:1,duo:2,trio:3,squad:4})[t.team]||
  people.some(name=>!known.has(name))||new Set(people).size!==people.length||
  row.player!==people.join(' / '))throw Error('Tournament catalog or known duo identity mismatch');
 const url=new URL(row.source),m=url.pathname.match(/^\/competitive\/events\/([^/]+)\/$/),
  win=url.searchParams.get('round');
 if(url.protocol!=='https:'||url.hostname!=='www.fortnite.com'||!m||
  !t.sourceEventIds.includes(m[1])||url.searchParams.get('region')!==row.region||
  !win||!win.startsWith(row.seasonId+'_')||!win.endsWith('_'+row.region))
  throw Error('Unrecognized official Epic event window');
 const mon=row.date.slice(0,7);if(!month.has(mon))month.set(mon,read('calendar-history/'+mon+'.json').sessions);
 const sessions=month.get(mon).filter(s=>s.eventId===m[1]&&s.tournamentId===t.id&&
  s.seasonId===row.seasonId&&s.dateJst===row.date&&s.region===row.region&&s.sourceWindowId===win);
 if(sessions.length!==1)throw Error('Date/region/session not verified in official calendar');
 const cp=scan.windows['epicgames_'+m[1]+'_'+row.region+'/'+win],
  same=cp?.proposals?.filter(s=>s.id===row.id)||[];
 if(!cp||cp.nextPage<1||same.length!==1)throw Error('Missing exactly one original saved leaderboard row');
 const original=same[0];
 for(const k of ['id','player','playerRaw','date','region','event','round','rank','points',
  'kills','vrs','matches','kind','prize','seasonId','tournamentId','source','verified']){
  if(JSON.stringify(row[k]??null)!==JSON.stringify(original[k]??null))throw Error('Leaderboard checkpoint discrepancy '+k);
 }
 if(JSON.stringify(row.players||null)!==JSON.stringify(original.players||null))
  throw Error('Leaderboard team account discrepancy');
 return t;
}
function classify(r){
 const {reviewReason,reviewOnly,teamAccountIds,note,...row}=r;
 let policy,rule;
 if(r.tournamentId==='ch5s4-duos-cash-cup'){
  if(r.seasonId!=='S31'||r.region!=='ME'||r.kind!=='参加確認'||r.prize!==null||
   !/^Event [34] · Round 1 \/ 参加確認$/.test(r.round)||r.matches>10)
    throw Error('CH5 S4 Duos Round1 event mismatch');
  row.kind=r.rank<=50?'予選':'参加確認';
  row.round=r.round.replace(' / 参加確認',r.rank<=50?' / 予選突破':' / 出場確認');
  row.prize=0;rule=OFFICIAL.duo;policy='2024-duo-round1';
  row.note='CH5 S4 Duos Cash Cup MEはRound1上位50組がRound2進出。今回'+r.rank+'位、'+
   (r.rank<=50?'予選突破':'予選順位のみ・決勝未進出')+'。Round1には現金賞金がないため$0。'+
   '本人Epic ID・保存順位表・公式開催枠を照合。規則: '+rule;
 }else if(r.tournamentId==='ch6s3-console-duos-victory'){
  if(r.seasonId!=='S36'||r.region!=='EU'||r.kind!=='賞金決勝'||r.prize!==null||
    r.vrs!==0||r.points!==0||r.matches>3||!/Event 2 · Round 2/.test(r.round))
    throw Error('Console DUO final score not safe');
  row.prize=0;row.prizePerPlayer=0;row.kind='賞金決勝';rule=OFFICIAL.console;policy='2025-console-zero-vr';
  row.note='CH6 S3 Console Duos VC決勝はチーム1VRにつき$200。保存済み'+r.vrs+
   'VRを照合し、該当チーム現金$0。個人賞金$0。規則: '+rule;
 }else if(r.tournamentId==='ch7s2-fncs-division-1'){
  if(r.seasonId!=='S40'||r.region!=='ME'||r.kind!=='参加確認'||r.prize!==null||
    r.matches>11||!/Week1Day[12]_ME/.test(sourceWindow(r))||
    !['2026-03-24','2026-03-25'].includes(r.date))
     throw Error('FNCS Division 1 Day 1/2 source mismatch');
  row.kind='参加確認';row.prize=0;rule=OFFICIAL.fncs;policy='fncs-week1-qualification-attendance';
  row.note='CH7 S2 FNCS Division1 Week1 Day'+(r.date==='2026-03-24'?1:2)+
   '参加順位'+r.rank+'位。週内Day1+Day2の合計ポイントによる上位50組がWeekly Finalsへ進出。'+
   '現金賞金はWeekly FinalsのためこのDay単位の現金$0。最終進出判定はこの単日順位から確定しない。'+
   '本人Epic ID・公式開催枠を照合。規則: '+rule;
 }else if(r.tournamentId==='ch7s4-performance-evaluation'){
  if(r.seasonId!=='S42'||r.region!=='NAC'||r.kind!=='参加確認'||r.prize!==null||
    r.date!=='2026-09-04'||r.matches>10||r.rank<=50||
    r.round!=='Event 2 · Round 1 / 参加確認')throw Error('S42 Performance participation mismatch');
  row.kind='参加確認';row.prize=0;rule=OFFICIAL.perf;policy='performance-nac-outside-top50';
  row.note='S42 Duo Performance Evaluation NAC・Event2 Round1上位50組がRound2進出。'+
   r.rank+'位のためRound2には進出せず、Round1現金賞金$0。'+
   'Epic公式セッションの本人ID・順位・ポイントを照合。公式イベント: '+rule;
 }else throw Error('Not an approved event in batch');
 return {row,policy,rule};
}
const added=[],duplicates=[],held=[],details=[];
for(const id of IDS){
 const entry=pending.get(id);
 if(!entry){held.push({id,reason:'Absent from current queue, preserve for reconciliation'});continue}
 try{
  validate(entry);
  if(oldLedger.has(id))throw Error('Candidate ID already adjudicated');
  const old=db.find(x=>sameSession(x,entry));
  if(old){
   if(!['rank','points','kills','vrs'].every(k=>old[k]===entry[k])||
       old.matches!=null&&old.matches!==entry.matches)
     throw Error('Same roster/round already published with conflicting score: '+old.id);
   duplicates.push({id,existing:old.id});
   ledger.entries.push({id,decision:'already-published',existingId:old.id,
    evidence:'Exact Epic event window, canonical roster and all score fields matched'});
   oldLedger.add(id);continue;
  }
  const classified=classify(entry),out=classified.row;
  if(db.some(x=>sameSession(x,out)))throw Error('New duplicate after classification');
  db.push(out);added.push(out);details.push({name:out.player,event:out.event,kind:out.kind,rank:out.rank,prize:out.prize});
  ledger.entries.push({id,decision:'published',recordId:id,source:entry.source,
   rule:classified.rule,policy:classified.policy,
   evidence:'Official rule payout boundary, event schedule, original saved Epic-ID leaderboard row and no matching existing record'});
  oldLedger.add(id);
 }catch(e){held.push({id,reason:e.message})}
}
const clear=new Set([...added.map(x=>x.id),...duplicates.map(x=>x.id)]);
if(!clear.size){console.log('ROUND1_BATCH_NO_CHANGES '+JSON.stringify({held}));process.exit(0)}
queue.proposals=queue.proposals.filter(x=>!clear.has(x.id));
const now=new Date().toISOString();
queue.manualReviewedAt=now;ledger.reviewedAt=now;
status.found=queue.proposals.length;status.manualReviewCandidates=queue.proposals.length;
status.reviewOnlyCandidates=queue.proposals.filter(x=>x.reviewOnly===true).length;
status.manuallyPublished=(status.manuallyPublished||0)+added.length;
status.manuallyResolvedDuplicates=(status.manuallyResolvedDuplicates||0)+duplicates.length;
status.lastRound1ReviewAt=now;
status.message='過去予選・FNCS・Console・Performance: '+added.length+'件新規、'+
 duplicates.length+'件既存、'+held.length+'件保留。無効開催枠と未完成Unrealデータは除外。過去候補残'+queue.proposals.length+'件。';
if(added.length)updates.entries.unshift({id:marker,date:now.slice(0,10),type:'records',
 title:'FNCS・Duos Cash・Performance・Consoleの過去成績'+added.length+'件を掲載',
 description:'保存済みEpic公式大会成績と公式大会規則を照合。Duos Cash予選上位50のみ突破、FNCS Div1 Day1/2は週合計順位の判定を保留。大会賞金のないラウンド・0VRを$0で記録。無効大会は掲載しない。',
 recordIds:added.map(x=>x.id)});
write('results.json',db);write('history-sync-review.json',queue);
write('history-sync-reviewed.json',ledger);write('history-sync-status.json',status);write('updates.json',updates);
console.log('ROUND1_BATCH21_RESULT '+JSON.stringify({added:added.length,duplicates,held,
 remaining:queue.proposals.length,byEvent:details.reduce((a,x)=>(a[x.event]=(a[x.event]||0)+1,a),{}),
 qualifying:details.filter(x=>x.kind==='予選'),details}));
