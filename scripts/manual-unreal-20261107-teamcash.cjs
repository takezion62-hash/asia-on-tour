'use strict';
// Source-backed OCE #172 Unreal Cup team award; do not invent person-level split.
// Retain the separate conflicting Solo Reload Test Cup candidate for source audit.
const fs=require('node:fs'),path=require('node:path');
const base=path.resolve(__dirname,'..');
const read=p=>JSON.parse(fs.readFileSync(path.join(base,p),'utf8'));
const write=(p,v)=>fs.writeFileSync(path.join(base,p),JSON.stringify(v,null,2)+'\n');
const id='auto-s39-4d5f1e94f897',marker='manual-unreal-20261107-team-prize';
const results=read('results.json'),review=read('history-sync-review.json'),
  scan=read('history-sync-scan.json'),tournaments=read('tournaments.json'),
  players=read('players.json'),status=read('history-sync-status.json'),
  updates=read('updates.json'),ledger=read('history-sync-reviewed.json');
const disputed=results.filter(r=>r.date==='2026-11-02'&&r.region==='ME'&&r.event==='Solo Reload Test Cup'&&
  String(r.player).includes('ぐれーぷふぁんぼーい'));
console.log('RELOAD_ME_DISPUTE_EXISTING '+JSON.stringify(disputed.map(r=>({
 id:r.id,date:r.date,player:r.player,rank:r.rank,points:r.points,kills:r.kills,vrs:r.vrs,matches:r.matches,
 source:r.source,round:r.round}))));
if(updates.entries.some(x=>x.id===marker)){console.log('UNREAL_CASH_ALREADY_APPLIED');process.exit(0)}
const row=review.proposals.find(x=>x.id===id);
if(!row){if(results.some(x=>x.id===id)){console.log('UNREAL_CASH_ALREADY_EXISTS');process.exit(0)}throw Error('Unreal prize candidate not in review')}
const expect={date:'2025-12-20',region:'OCE',seasonId:'S39',
  tournamentId:'ch7s1-one-million-unreal-cup',rank:172,points:236,kind:'参加確認',
  player:'まいにちフロッパー / mint'};
for(const [k,v] of Object.entries(expect))if(row[k]!==v)throw Error('Original candidate changed '+k);
if(row.verified!==true||row.reviewOnly!==true||row.prize!==null||
 row.players?.length!==2||row.players[0]!=='まいにちフロッパー'||row.players[1]!=='mint'||
 !Number.isSafeInteger(row.kills)||row.kills<0||!Number.isSafeInteger(row.matches)||
 row.matches<1||row.matches>10||!Number.isSafeInteger(row.vrs)||row.vrs<0||row.vrs>row.matches)
 throw Error('Original Epic ID team/metrics not valid');
const tour=tournaments.catalog.find(x=>x.id===row.tournamentId);
if(!tour||tour.team!=='duo'||tour.seasonId!=='S39'||tour.name!==row.event||
 !tour.sourceEventIds.includes('S39_1MillionUnrealCup')||
 row.players.some(x=>!players.candidates.some(y=>y.name===x)))
 throw Error('Tournament or identity unverified');
const url=new URL(row.source),windowId='S39_1MillionUnrealCup_OCE';
if(url.hostname!=='www.fortnite.com'||url.protocol!=='https:'||
 url.pathname!=='/competitive/events/S39_1MillionUnrealCup/'||
 url.searchParams.get('region')!=='OCE'||url.searchParams.get('round')!==windowId)
 throw Error('Epic official event source does not match');
const schedule=read('calendar-history/2025-12.json').sessions;
if(!schedule.some(s=>s.dateJst===row.date&&s.region==='OCE'&&
 s.seasonId===row.seasonId&&s.tournamentId===row.tournamentId&&
 s.sourceWindowId===windowId&&s.eventId==='S39_1MillionUnrealCup'))
 throw Error('Official calendar session missing');
const snapshot=scan.windows['epicgames_S39_1MillionUnrealCup_OCE/'+windowId];
const candidate=snapshot?.proposals?.find(x=>x.id===id);
if(!candidate||snapshot.nextPage<1)throw Error('Original saved API leaderboard unavailable');
for(const k of ['id','date','region','player','playerRaw','rank','points','kills','vrs',
  'matches','prize','kind','tournamentId','source']){
 if(JSON.stringify(row[k]??null)!==JSON.stringify(candidate[k]??null))throw Error('Cached leaderboard differs: '+k);
}
const alias=players.confirmedAliases||{},canon=n=>{
 for(const [k,list] of Object.entries(alias))if([k,...list].some(x=>x.normalize('NFKC').toLowerCase()===n.normalize('NFKC').toLowerCase()))return k;
 return n.normalize('NFKC').toLowerCase();
};
const sig=r=>(r.players||[r.player]).map(canon).sort().join('|');
const conflict=results.find(r=>r.date===row.date&&r.region===row.region&&
 r.tournamentId===row.tournamentId&&sig(r)===sig(row));
if(conflict)throw Error('Same team/session already published, verify before another cash: '+conflict.id);
if(ledger.entries.some(r=>r.id===id))throw Error('Already reviewed id');
const RULE='https://www.fortnite.com/competitive/rules-guidelines/rules-library/1-million-dollar-unreal-cup-chapter-7-season-1-official-rules';
const {reviewReason,reviewOnly,...plain}=row;
const record={...plain,kind:'賞金獲得',prize:100,
 note:'Epic公式$1M Unreal Cup OCEの101〜250位はチーム規定賞金$100。172位のEpic本人ID・保存順位表を照合。個人配分の原文根拠は未確定のためprizePerPlayerを設定せず、個人累計へは加算しない。本人資格審査・支払完了は未確認。規則: '+RULE};
results.push(record);review.proposals=review.proposals.filter(x=>x.id!==id);
const now=new Date().toISOString();
status.found=review.proposals.length;status.manualReviewCandidates=review.proposals.length;
status.reviewOnlyCandidates=review.proposals.filter(x=>x.reviewOnly===true).length;
status.manuallyPublished=(status.manuallyPublished||0)+1;
status.lastCashReviewedAt=now;status.message='Unreal Cup OCE172位のチーム規定賞金$100を公式規則で確認して掲載。個人配分未確認は個人累計に加算せず、別候補の競合は保留。残り'+review.proposals.length+'件。';
review.manualReviewedAt=now;ledger.reviewedAt=now;
ledger.entries.push({id,decision:'published',recordId:id,policy:'verified-team-prize',rule:RULE,source:row.source,
 evidence:'Exact Epic IDs and original leaderboard row, OCE rank172 within prize-paid rank101-250; team cash $100 but no asserted per-player split'});
updates.entries.unshift({id:marker,date:now.slice(0,10),type:'records',
 title:'2025年OCE Unreal Cupのチーム賞金$100を検証掲載',
 description:'まいにちフロッパー / mint組172位を公式順位表とチーム賞金101〜250位$100の規定で確認。個人配分が未確認のため個人賞金集計には未加算。',
 recordIds:[id]});
write('results.json',results);write('history-sync-review.json',review);
write('history-sync-reviewed.json',ledger);write('history-sync-status.json',status);write('updates.json',updates);
console.log('UNREAL_TEAM_PRIZE_PUBLISHED '+JSON.stringify({id,team:row.player,rank:row.rank,prize:100,remaining:review.proposals.length}));
