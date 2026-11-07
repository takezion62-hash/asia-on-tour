'use strict';
const fs=require('node:fs'),path=require('node:path'),root=path.resolve(__dirname,'..');
const read=x=>JSON.parse(fs.readFileSync(path.join(root,x),'utf8'));
const write=(x,v)=>fs.writeFileSync(path.join(root,x),JSON.stringify(v,null,2)+'\n');
const ids=['auto-s31-32c8bed6be0f','auto-s31-1c0ed290d956','auto-s31-8059e72134fb'];
const rule='https://www.fortnite.com/news/fortnite-victory-cash-cups-chapter-5-season-4-official-rules',
 marker='review-20261107-oce-s31-qualifier-last-three';
const results=read('results.json'),review=read('history-sync-review.json'),
 scan=read('history-sync-scan.json'),catalog=read('tournaments.json'),players=read('players.json'),
 cal=read('calendar-history/2024-09.json').sessions,ledger=read('history-sync-reviewed.json'),
 updates=read('updates.json'),status=read('history-sync-status.json');
if(updates.entries.some(x=>x.id===marker)){console.log('OCE3_ALREADY_APPLIED');process.exit(0)}
const known=new Set(players.candidates.map(x=>x.name)),pending=new Map(review.proposals.map(x=>[x.id,x])),
 ledgerIds=new Set(ledger.entries.map(x=>x.id));
const alias=new Map(),norm=x=>String(x).trim().normalize('NFKC').toLowerCase();
for(const [name,alts] of Object.entries(players.confirmedAliases||{})){
 alias.set(norm(name),name);for(const n of alts)alias.set(norm(n),name);
}
const identity=x=>alias.get(norm(x.player))||norm(x.player);
function collide(a,b){
 return a.date===b.date&&a.region===b.region&&a.tournamentId===b.tournamentId&&identity(a)===identity(b)&&
  (!String(a.source).includes('round=')||!String(b.source).includes('round=')||
    new URL(a.source).searchParams.get('round')===new URL(b.source).searchParams.get('round'));
}
const added=[],duplicates=[],held=[];
for(const id of ids){
 const row=pending.get(id);
 if(!row){if(results.some(x=>x.id===id)||ledgerIds.has(id))continue;held.push({id,reason:'Candidate missing'});continue}
 try{
  const tournament=catalog.catalog.find(x=>x.id===row.tournamentId);
  if(ledgerIds.has(id)||!tournament||tournament.id!=='ch5s4-solo-victory-cup'||tournament.name!==row.event||
   tournament.seasonId!=='S31'||!tournament.sourceEventIds.includes('S31_SoloVictoryCashCup')||
   row.seasonId!=='S31'||row.region!=='OCE'||row.date!=='2024-09-02'||
   row.round!=='Event 1 · Round 1 / 予選'||row.kind!=='予選'||
   row.prize!==0||row.verified!==true||!known.has(row.player)||
   !Number.isSafeInteger(row.rank)||row.rank<1||row.rank>1500||
   !Number.isSafeInteger(row.points)||row.points<0||
   !Number.isSafeInteger(row.kills)||row.kills<0||
   !Number.isSafeInteger(row.vrs)||row.vrs<0||
   !Number.isSafeInteger(row.matches)||row.matches<1||row.matches>7||row.vrs>row.matches)
    throw Error('Verified qualifying rank, player or tournament rule mismatch');
  const u=new URL(row.source),win='S31_SoloVictoryCashCup_Event1Round1_OCE';
  if(u.protocol!=='https:'||u.hostname!=='www.fortnite.com'||
    u.pathname!=='/competitive/events/S31_SoloVictoryCashCup/'||
    u.searchParams.get('region')!=='OCE'||u.searchParams.get('round')!==win)
    throw Error('Not matching original Epic event URL');
  if(cal.filter(s=>s.eventId==='S31_SoloVictoryCashCup'&&s.tournamentId===tournament.id&&
    s.seasonId==='S31'&&s.region==='OCE'&&s.dateJst===row.date&&s.sourceWindowId===win).length!==1)
    throw Error('Official event calendar not matched');
  const cp=scan.windows['epicgames_S31_SoloVictoryCashCup_OCE/'+win],
    original=(cp?.proposals||[]).filter(x=>x.id===id);
  if(!cp||cp.nextPage<1||original.length!==1)throw Error('Original leaderboard checkpoint missing');
  for(const k of ['id','date','region','player','rank','points','kills','vrs','matches',
    'kind','prize','source','verified','tournamentId','seasonId']){
   if(JSON.stringify(original[0][k]??null)!==JSON.stringify(row[k]??null))
    throw Error('Stored Epic score changed '+k);
  }
  const earlier=results.find(x=>collide(x,row));
  if(earlier){
   if(!['rank','points','kills','vrs'].every(k=>earlier[k]===row[k])||
     earlier.matches!=null&&earlier.matches!==row.matches)
    throw Error('Existing same player/event has different score: '+earlier.id);
   duplicates.push({id,existingId:earlier.id});
   ledger.entries.push({id,decision:'already-published',existingId:earlier.id,
     evidence:'Same source window and validated score already in results'});
   ledgerIds.add(id);continue;
  }
  const {reviewOnly,reviewReason,teamAccountIds,note,...base}=row;
  const record={...base,kind:'予選',round:'Event 1 · Round 1 / 予選突破',prize:0,
   note:'2024年9月2日OCE Solo Victory Cash Cup Round1上位1500位の公式予選突破条件を'+
    row.rank+'位・'+row.points+'ptで達成。本人名義とEpic順位表スナップショットを照合。予選現金賞金は$0。'+
    '元の順位表は途中取得のため無関係な賞金決勝の成績を推定しない。ルール: '+rule};
  results.push(record);added.push(record);
  ledger.entries.push({id,decision:'published',recordId:id,source:row.source,rule,
   evidence:'Original Epic checkpoint, exact archived date/window, 2024 OCE top 1500 official cutoff and known player ID'});
  ledgerIds.add(id);
 }catch(e){held.push({id,reason:e.message})}
}
const resolved=new Set([...added.map(x=>x.id),...duplicates.map(x=>x.id)]);
if(!resolved.size){console.log('OCE3_NO_CHANGES '+JSON.stringify({held}));process.exit(0)}
review.proposals=review.proposals.filter(x=>!resolved.has(x.id));
const now=new Date().toISOString();review.manualReviewedAt=now;ledger.reviewedAt=now;
status.found=review.proposals.length;status.manualReviewCandidates=review.proposals.length;
status.reviewOnlyCandidates=review.proposals.filter(x=>x.reviewOnly===true).length;
status.manuallyPublished=(status.manuallyPublished||0)+added.length;
status.manuallyResolvedDuplicates=(status.manuallyResolvedDuplicates||0)+duplicates.length;
status.message='OCE Solo Victory Cup 予選突破'+added.length+'件追加。未解決のスコア競合を上書きせず保護。過去の確認待ち'+review.proposals.length+'件。';
if(added.length)updates.entries.unshift({id:marker,date:now.slice(0,10),type:'records',
 title:'2024年9月OCE Solo Victory Cup予選突破'+added.length+'名を確認掲載',
 description:'Epic本人の保存済み予選成績、開催日、OCE上位1500位の公式ルールを照合。現金賞金$0、既存成績は保持。確証がない他大会の賞金は加算しない。',
 recordIds:added.map(x=>x.id)});
write('results.json',results);write('history-sync-review.json',review);
write('history-sync-reviewed.json',ledger);write('history-sync-status.json',status);write('updates.json',updates);
const conflict=review.proposals.find(x=>x.id==='auto-s42-ef18ae1d40bd');
const matching=conflict&&results.filter(x=>x.date===conflict.date&&x.region===conflict.region&&
 x.tournamentId===conflict.tournamentId&&identity(x)===identity(conflict));
console.log('OCE3_RESULT '+JSON.stringify({added:added.map(x=>({id:x.id,player:x.player,rank:x.rank,prize:x.prize})),
 duplicates,held,remaining:review.proposals.length,
 conflict:conflict?{candidate:{id:conflict.id,rank:conflict.rank,points:conflict.points,kills:conflict.kills,
 vrs:conflict.vrs,matches:conflict.matches},
 existing:matching?.map(x=>({id:x.id,rank:x.rank,points:x.points,kills:x.kills,vrs:x.vrs,matches:x.matches,
 source:x.source}))}:null}));
