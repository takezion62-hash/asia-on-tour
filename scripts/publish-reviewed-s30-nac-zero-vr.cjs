'use strict';
// Historical ASIA ON TOUR verification for Chapter 5 Season 3 Solo Victory Cash
// Cup NAC (2024-08-12 local / 2024-08-13 JST), Event 9 Round 2.
// Source: Epic's June 2024 official rules, Attachment C ($100 per final VR).
// This imports ONLY confirmed 0-VR/$0 finals from a completely downloaded,
// ordered Epic-ID leaderboard. Does not infer cash/awards from participation.
const fs=require('node:fs'),path=require('node:path');
const {equalCandidate,collision}=require('./manual-approval-core.cjs');
const ROOT=path.resolve(__dirname,'..');
const ID='ch5s3-solo-victory-cup',EVENT='S30_SoloVictoryCashCup';
const WINDOW='S30_SoloVictoryCashCup_Event9Round2_NAC';
const KEY='epicgames_'+EVENT+'_NAC/'+WINDOW;
const RULE='https://www.fortnite.com/news/fortnite-victory-cash-cups-chapter-5-season-3-official-rules';
const UPDATE_ID='verified-historical-s30-nac-solo-vc-20240813-zero-vr';
const FILES={
 results:'results.json',updates:'updates.json',review:'history-sync-review.json',
 reviewed:'history-sync-reviewed.json',status:'history-sync-status.json',
 scan:'history-sync-scan.json',players:'players.json',tournaments:'tournaments.json',
 rules:'tournament-rules.json'
};
const clone=v=>JSON.parse(JSON.stringify(v));
const read=f=>JSON.parse(fs.readFileSync(path.join(ROOT,f),'utf8'));
const write=(f,v)=>fs.writeFileSync(path.join(ROOT,f),JSON.stringify(v,null,2)+'\n');
const check=(cond,msg)=>{if(!cond)throw Error('S30_NAC_VERIFIED_REVIEW: '+msg)};
const lineup=r=>Array.isArray(r.players)&&r.players.length?r.players:[r.player];
const validNumber=n=>Number.isSafeInteger(n)&&n>=0;
const identical=(a,b)=>['date','region','tournamentId','rank','points','kills','vrs','matches']
 .every(k=>JSON.stringify(a[k])===JSON.stringify(b[k]))&&
 lineup(a).slice().sort().join('|')===lineup(b).slice().sort().join('|');
function processReview(data,stamp){
 const copied=clone(data);
 const {results,updates,review,reviewed,status,scan,players,tournaments,rules}=copied;
 check(Array.isArray(results)&&updates&&Array.isArray(updates.entries)
  &&review&&Array.isArray(review.proposals)&&reviewed&&Array.isArray(reviewed.entries)
  &&scan&&scan.windows&&players&&Array.isArray(players.candidates)
  &&tournaments&&Array.isArray(tournaments.catalog)&&rules&&Array.isArray(rules.rules),
  'data documents missing');
 const catalog=tournaments.catalog.find(x=>x.id===ID);
 const rule=rules.rules.find(x=>x.id===ID);
 check(catalog?.name==='Solo Victory Cup Battle Royale'&&catalog.team==='solo'&&catalog.series==='victory-cup'
  &&catalog.seasonId==='S30'&&catalog.sourceEventIds?.includes(EVENT),
  'tournament catalog changed');
 check(rule&&rule.seasonId==='S30'&&rule.team==='solo'&&rule.eventIds?.includes(EVENT)
  &&rule.series==='victory-cup'&&rule.source===RULE&&rule.matchCaps?.['賞金決勝']===3,
  '2024 cash payout rules registry changed');
 const checkpoint=scan.windows[KEY];
 check(checkpoint?.complete===true
  &&checkpoint?.rankingOrderValid===true
  &&Number.isSafeInteger(checkpoint.totalPages)&&checkpoint.totalPages>1
  &&checkpoint.nextPage>=checkpoint.totalPages
  &&checkpoint.pages>=checkpoint.totalPages
  &&Array.isArray(checkpoint.proposals),
  '2024 NAC official final leaderboard is NOT completely verified');
 const names=new Set(players.candidates.map(x=>x.name));
 const aliases=players.confirmedAliases||{};
 const registered=new Set(results.map(x=>x.id));
 check(registered.size===results.length,'existing IDs duplicated');
 const reviewedIds=new Set(reviewed.entries.map(x=>x.id));
 const candidates=review.proposals.filter(x=>x.tournamentId===ID&&x.region==='NAC'&&x.date==='2024-08-13'
  &&x.round==='Event 9 · Round 2 / 賞金決勝'&&x.kind==='賞金決勝');
 const imported=[],duplicates=[],held=[];
 for(const candidate of candidates){
  if(reviewedIds.has(candidate.id)){
   review.proposals=review.proposals.filter(x=>x.id!==candidate.id);
   continue;
  }
  let reason='';
  if(candidate.verified!==true||!/^auto-s30-[0-9a-f]{12}$/.test(candidate.id)
   ||candidate.event!==catalog.name||candidate.seasonId!=='S30'
   ||candidate.chapter!==5||candidate.season!==3
   ||candidate.kind!=='賞金決勝'||candidate.vrs!==0||candidate.prize!==null||candidate.points!==0
   ||!Number.isSafeInteger(candidate.rank)||candidate.rank<1
   ||!validNumber(candidate.kills)||!Number.isSafeInteger(candidate.matches)
   ||candidate.matches<1||candidate.matches>3)reason='candidate data not verifiable as 0-VR final';
  const member=lineup(candidate);
  if(!reason&&(member.length!==1||candidate.player!==member[0]||!names.has(member[0])))
   reason='unconfirmed single Epic ID';
  const cached=checkpoint.proposals.find(x=>x.id===candidate.id);
  if(!reason&&(!cached||!equalCandidate(cached,candidate)))
   reason='leaderboard checkpoint and queued candidate differ';
  if(!reason){
   try{
    const url=new URL(candidate.source);
    if(url.protocol!=='https:'||url.hostname!=='www.fortnite.com'
       ||url.pathname!=='/competitive/events/'+EVENT+'/'
       ||url.searchParams.get('region')!=='NAC'
       ||url.searchParams.get('round')!==WINDOW
       ||url.hash||url.username||url.password)reason='not the confirmed 2024 official event';
   }catch{reason='missing official event URL'}
  }
  if(reason){held.push({id:candidate.id,reason});continue}
  const matches=results.filter(x=>collision(x,candidate,aliases));
  if(matches.length){
   if(matches.length===1&&identical(matches[0],candidate)){
    duplicates.push({id:candidate.id,existingId:matches[0].id});
    review.proposals=review.proposals.filter(x=>x.id!==candidate.id);
    reviewedIds.add(candidate.id);
    reviewed.entries.push({id:candidate.id,decision:'already-published',
     existingId:matches[0].id,source:candidate.source,verifiedAt:stamp,
     note:'Full Epic leaderboard and identical manual rank/stats/roster confirmed'});
   }else held.push({id:candidate.id,reason:'different or ambiguous previously published result'});
   continue;
  }
  if(registered.has(candidate.id)){held.push({id:candidate.id,reason:'public ID collides'});continue}
  const {reviewOnly,reviewReason,teamAccountIds,...row}=candidate;
  row.prize=0;row.note='2024/8/12開催（日本時間8/13）のNAC Solo Victory Cash Cup #9決勝。'
   +'Epic公式本人ID・順位表の全'+checkpoint.totalPages+'ページ・順位順序を確認。'
   +'0VRにつき公式規則Attachment Cの賞金は$0（1VRにつき$100）。'
   +'順位・ポイント・キル・試合数は元のAPIから変更なし。出典: '+RULE;
  results.push(row);registered.add(row.id);
  imported.push(row);
  review.proposals=review.proposals.filter(x=>x.id!==candidate.id);
  reviewedIds.add(candidate.id);
  reviewed.entries.push({id:candidate.id,decision:'published',recordId:candidate.id,
   policy:'complete-leaderboard-zero-vr',source:candidate.source,officialRules:RULE,
   window:WINDOW,pages:checkpoint.totalPages,verifiedAt:stamp,rank:row.rank,prize:0});
 }
 if(imported.length){
  check(!updates.entries.some(x=>x.id===UPDATE_ID),'historical update ID already used');
  const day=new Date(new Date(stamp).getTime()+9*3600000).toISOString().slice(0,10);
  updates.entries.unshift({
   id:UPDATE_ID,date:day,type:'records',
   title:'2024年8月13日NAC Solo Victory Cup決勝の0VR戦績'+imported.length+'件を掲載',
   description:'2024年8月12日開催（日本時間13日）のS30 NAC Solo Victory Cash Cup #9決勝。'
    +'Epic IDと公式順位表全'+checkpoint.totalPages+'ページの取得・順位順序を検証。'
    +'Epic公式賞金規則で決勝0VRは$0。既存戦績・賞金額は変更せず、'
    +'掲載済みの同一開催枠・同一選手を重複登録しない。出典: '+RULE,
   recordIds:imported.map(x=>x.id)});
  updates.entries.sort((a,b)=>b.date.localeCompare(a.date));
 }
 if(imported.length||duplicates.length){
  reviewed.reviewedAt=stamp;
  review.manualReviewedAt=stamp;
  status.manuallyPublished=(Number(status.manuallyPublished)||0)+imported.length;
  status.manuallyResolvedDuplicates=(Number(status.manuallyResolvedDuplicates)||0)+duplicates.length;
  status.lastReviewedBatchAt=stamp;
  status.found=review.proposals.length;
  status.manualReviewCandidates=review.proposals.length;
  status.reviewOnlyCandidates=review.proposals.filter(x=>x.reviewOnly===true).length;
  status.message='S30 NAC Solo Victory Cash Cupの完全取得済み決勝を再検証。'
   +'0VR・$0の'+imported.length+'件を掲載、既存と同一'+duplicates.length+'件を重複解消。'
   +'保留'+held.length+'件、残り確認待ち'+review.proposals.length+'件。未確認の賞金や順位は変更せず。';
 }
 return {docs:{results,updates,review,reviewed,status},report:{
  considered:candidates.length,published:imported.map(x=>({id:x.id,player:x.player,
   rank:x.rank,kills:x.kills,vrs:x.vrs,prize:x.prize})),
  duplicates,held,remaining:review.proposals.length,changed:Boolean(imported.length||duplicates.length)}};
}
function main(){
 const data=Object.fromEntries(Object.entries(FILES).map(([key,file])=>[key,read(file)]));
 const result=processReview(data,new Date().toISOString());
 console.log('S30_NAC_REVIEW_PUBLICATION '+JSON.stringify(result.report));
 if(process.argv.includes('--dry-run')||!result.report.changed)return;
 for(const name of ['results','updates','review','reviewed','status'])
  write(FILES[name],result.docs[name]);
}
if(require.main===module)main();
module.exports={processReview,KEY,WINDOW,RULE,ID};
