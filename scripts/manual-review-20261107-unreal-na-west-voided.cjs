'use strict';
// 2026-11-07 final historical audit:
// $1M Unreal NAW #122: independent live public Tracker confirms team $200 / $100 each.
// 2026-06-07 OCE Days of Play Qualifier1 was VOIDED: exclude all 19 known rows.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const write=(p,x)=>fs.writeFileSync(path.join(root,p),JSON.stringify(x,null,2)+'\n');
const voidIds=["auto-s41-0b735deca3de","auto-s41-8ee445e815bd","auto-s41-605380df065c","auto-s41-25773441abe2","auto-s41-9b5da99a2c77","auto-s41-7d673a661fcc","auto-s41-e199bfc5ca58","auto-s41-b93d5f9982cc","auto-s41-ab5f532b51e5","auto-s41-b74c5f18bde2","auto-s41-2dcbaf01d1b6","auto-s41-99dde642c80f","auto-s41-0cc56a920990","auto-s41-1dc242e86e63","auto-s41-22611231606a","auto-s41-07b6e9b2b37e","auto-s41-fa745c4bc14a","auto-s41-0989e8a09e8d","auto-s41-25fca1e49aa1"],cashId='auto-s39-6b024a834d72',
 marker='review-20261107-unreal-na-west-and-voided-oce-20';
const RULE='https://www.fortnite.com/competitive/rules-guidelines/rules-library/1-million-dollar-unreal-cup-chapter-7-season-1-official-rules';
const TRACKER='https://fortnitetracker.com/events/epicgames_S39_1MillionUnrealCup_NAW?page=1&window=S39_1MillionUnrealCup_NAW';
const VOID='https://fortnitetracker.com/events/epicgames_S41_PSCupDaysOfPlay_OCE?window=S41_PSCupDaysOfPlay_Final_OCE';
const db=read('results.json'),review=read('history-sync-review.json'),
  ledger=read('history-sync-reviewed.json'),scan=read('history-sync-scan.json'),
  players=read('players.json'),catalog=read('tournaments.json'),
  rules=read('tournament-rules.json'),updates=read('updates.json'),status=read('history-sync-status.json');
if(updates.entries.some(x=>x.id===marker)){console.log('CASH_AND_VOID_REVIEW_ALREADY_APPLIED');process.exit(0)}
if(voidIds.length!==19||new Set(voidIds).size!==19||!Array.isArray(db)||!scan.windows)
 throw Error('Audit manifest/checkpoint incomplete');
const pending=new Map(review.proposals.map(x=>[x.id,x])),known=new Set(players.candidates.map(x=>x.name)),
 aliases=new Map();
const norm=x=>String(x).trim().normalize('NFKC').toLowerCase();
for(const [name,group] of Object.entries(players.confirmedAliases||{})){
 aliases.set(norm(name),name);for(const alias of group)aliases.set(norm(alias),name);
}
const team=x=>(x.players||[x.player]).map(x=>aliases.get(norm(x))||norm(x)).sort().join('|');
const added=[],duplicates=[],voided=[],held=[];
const ledgerIds=new Set(ledger.entries.map(x=>x.id));
function duplicate(r){
 return db.find(x=>x.tournamentId===r.tournamentId&&x.date===r.date&&
 x.region===r.region&&team(x)===team(r));
}
function saved(row){
 const u=new URL(row.source),m=u.pathname.match(/^\/competitive\/events\/([^/]+)\/$/),
 w=u.searchParams.get('round');
 if(!m||u.hostname!=='www.fortnite.com'||u.protocol!=='https:'||
 u.searchParams.get('region')!==row.region||!w||!w.endsWith('_'+row.region))
 throw Error('Not the official Epic event window');
 const lookup='epicgames_'+m[1]+'_'+row.region+'/'+w,cp=scan.windows[lookup];
 const candidates=(cp?.proposals||[]).filter(x=>x.id===row.id);
 if(!cp||cp.nextPage<1||candidates.length!==1)throw Error('Original leaderboard row not uniquely retained');
 const original=candidates[0];
 for(const k of ['id','player','date','region','rank','points','kills','vrs','matches',
    'kind','prize','source','seasonId','tournamentId','verified']){
  if(JSON.stringify(original[k]??null)!==JSON.stringify(row[k]??null))
   throw Error('Original Epic checkpoint disagrees: '+k);
 }
 if(JSON.stringify(original.players||null)!==JSON.stringify(row.players||null))
  throw Error('Epic checkpoint team differs');
 return {win:w,eventId:m[1],cp};
}
for(const id of voidIds){
 const row=pending.get(id);
 if(!row){held.push({id,reason:'Not currently in review'});continue}
 try{
  if(ledgerIds.has(id)||db.some(x=>x.id===id))throw Error('Already handled or published; audit manually');
  if(row.date!=='2026-06-07'||row.region!=='OCE'||
   row.tournamentId!=='ch7s3-days-of-play-playstation-cup-br'||
   row.kind!=='参加確認'||row.prize!==null||row.verified!==true||row.reviewOnly!==true||
   !/^S41_PSCupDaysOfPlay_Qualifier_OCE$/.test(new URL(row.source).searchParams.get('round')||''))
   throw Error('Not the exact voided session or row score changed');
  saved(row);
  ledger.entries.push({id,decision:'voided-not-published',event:'2026-06-07 OCE Days of Play PlayStation Cup BR Session 1',
   source:row.source,voidEvidence:VOID,reviewedAt:'2026-11-07',
   evidence:'Tracker event selector explicitly marks this session VOIDED; excludes score, qualification, sprays and all payments from public results.'});
  ledgerIds.add(id);voided.push(id);
 }catch(e){held.push({id,reason:e.message})}
}
const row=pending.get(cashId);
if(!row){held.push({id:cashId,reason:'Unreal candidate missing'});}
else try{
 if(ledgerIds.has(cashId))throw Error('Previously adjudicated cash candidate');
 if(row.date!=='2025-12-21'||row.region!=='NAW'||row.player!=='Kahcy / まいにちフロッパー'||
    row.seasonId!=='S39'||row.tournamentId!=='ch7s1-one-million-unreal-cup'||
    row.rank!==122||row.points!==287||row.kills!==27||row.vrs!==2||
    row.matches!==7||row.prize!==null||row.verified!==true||row.reviewOnly!==true||
    row.kind!=='参加確認'||JSON.stringify(row.players)!=='["Kahcy","まいにちフロッパー"]'||
    !Array.isArray(row.teamAccountIds)||row.teamAccountIds.length!==2||
    new Set(row.teamAccountIds).size!==2||
    row.teamAccountIds.some(x=>!/^[a-f0-9]{32}$/.test(x)))throw Error('Unreal identity/rank/points different from verified public Tracker #122');
 const c=catalog.catalog.find(x=>x.id===row.tournamentId);
 const rule=rules.rules.find(x=>x.id===row.tournamentId);
 if(!c||!rule||c.seasonId!=='S39'||c.team!=='duo'||c.series!=='unreal-cup'||
 c.name!==row.event||!c.sourceEventIds.includes('S39_1MillionUnrealCup')||
 !row.players.every(x=>known.has(x))||rule.cashPrizes?.teamSize!==2||
 rule.autoApproval!=='verified-team-rank')throw Error('Unreal rule/team identity not registered');
 const event=saved(row);
 if(event.win!=='S39_1MillionUnrealCup_NAW'||event.eventId!=='S39_1MillionUnrealCup')
   throw Error('Stored leaderboard window not correct');
 const months=read('calendar-history/2025-12.json').sessions;
 if(months.filter(x=>x.tournamentId===c.id&&x.seasonId==='S39'&&
 x.eventId===event.eventId&&x.sourceWindowId===event.win&&
 x.region===row.region&&x.dateJst===row.date).length!==1)
   throw Error('Official calendar cannot confirm exact NAW event');
 // Independent public Tracker: 122nd, "JP Kahcy + NXFZ まいにちフロッパー",
 // 287 PTS, 7 MATCHES, 2 WINS, 3.86 average elims (27 total);
 // displayed Cash Prize "$200 / $100 each".
 const tier=rule.cashPrizes.tiers.NAW.find(x=>row.rank<=x.through);
 if(tier?.perTeam!==200||tier.through!==200)throw Error('Official NAW 101-200 prize tier mismatched');
 const old=duplicate(row);
 if(old){
  if(['rank','points','kills','vrs'].some(k=>old[k]!==row[k])||
     old.matches!=null&&old.matches!==row.matches||
     old.prize!==200||old.prizePerPlayer!==100)
   throw Error('Existing same player/event has inconsistent cash result: '+old.id);
  duplicates.push({id:cashId,existingId:old.id});
  ledger.entries.push({id:cashId,decision:'already-published',existingId:old.id,
   evidence:'Same duo/round #122 287pt 27K 2VR 7matches and team $200 / person $100 as independent Tracker'});
 }else{
  const {reviewReason,reviewOnly,teamAccountIds,note,...base}=row;
  const out={...base,kind:'賞金獲得',round:'単一開催枠 / 賞金獲得',prize:200,prizePerPlayer:100,
   note:'2025/12/21 NAW $1 Million Unreal Cupの122位・287pt・27K・2VR・7試合をEpic本人IDの保存順位表と独立のFortnite Tracker順位122で照合。チーム$200（Kahcy・まいにちフロッパー各$100）。実際の支払完了・賞金受給資格は未確認。規則: '+RULE+' Tracker: '+TRACKER};
  db.push(out);added.push(out);
  ledger.entries.push({id:cashId,decision:'published',recordId:cashId,policy:'manual-independent-rank-cash-check',
   rule:RULE,source:row.source,independentLeaderboard:TRACKER,
   evidence:'NAW rank122, 287pts, 7matches, 2VR and 27 eliminations, two confirmed Epic IDs, Tracker $200 team and $100 per player'});
 }
 ledgerIds.add(cashId);
}catch(e){held.push({id:cashId,reason:e.message})}
const clear=new Set([...voided,...added.map(x=>x.id),...duplicates.map(x=>x.id)]);
if(!clear.size){console.log('FINAL20_NO_SAFE_CHANGES '+JSON.stringify({held}));process.exit(0)}
review.proposals=review.proposals.filter(x=>!clear.has(x.id));
const now=new Date().toISOString();
review.manualReviewedAt=now;ledger.reviewedAt=now;
status.found=review.proposals.length;status.manualReviewCandidates=review.proposals.length;
status.reviewOnlyCandidates=review.proposals.filter(x=>x.reviewOnly===true).length;
status.reviewedVoided=(status.reviewedVoided||0)+voided.length;
status.manuallyPublished=(status.manuallyPublished||0)+added.length;
status.manuallyResolvedDuplicates=(status.manuallyResolvedDuplicates||0)+duplicates.length;
status.lastUnrealAndVoidedAuditAt=now;
status.message='Unreal NAW122位のチーム$200（個人各$100）を公式規則・独立順位表で確認。'+
  '無効OCE PlayStation '+voided.length+'件を掲載除外、'+held.length+'件保留。過去確認待ち残'+review.proposals.length+'件。';
updates.entries.unshift({id:marker,date:now.slice(0,10),type:added.length?'records':'site',
 title:'過去大会の最後の確認：Unreal Cup賞金と無効PlayStation大会を整理',
 description:'NAW Unreal Cup Kahcy／まいにちフロッパー組122位をEpic/Trackerで照合しチーム$200・各$100。6/7 OCE PlayStationのVOIDED開催枠'+voided.length+'件を公開せず記録。未確認成績を賞金化しない。',
 recordIds:added.map(x=>x.id)});
write('results.json',db);write('history-sync-review.json',review);
write('history-sync-reviewed.json',ledger);write('history-sync-status.json',status);write('updates.json',updates);
console.log('UNREAL_NAW_AND_VOIDED_FINAL '+JSON.stringify({cashAdded:added.map(x=>({player:x.player,prize:x.prize,perPlayer:x.prizePerPlayer,rank:x.rank})),
 voided: voided.length,duplicates,held,remaining:review.proposals.length}));
