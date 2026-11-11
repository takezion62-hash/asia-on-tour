'use strict';
// Historical Epic-ID evidence round: 15 exact 2024 final cash rows, plus safe
// closure of original Epic results already represented by matching skin rows.
// Rankings that differ from published skin results remain pending.
const path=require('node:path'),crypto=require('node:crypto');
const {createPublicationFiles}=require('./reviewed-publication-core.cjs');
const {sameScannedCandidate,verifiedPartialPage}=require('./verified-partial-page.cjs');
const {collision}=require('./manual-approval-core.cjs');
const {read,write}=createPublicationFiles(path.resolve(__dirname,'..'));
const dry=process.argv.includes('--dry-run'),stamp=new Date().toISOString();
const R30='https://www.fortnite.com/news/fortnite-victory-cash-cups-chapter-5-season-3-official-rules';
const R31='https://www.fortnite.com/news/fortnite-victory-cash-cups-chapter-5-season-4-official-rules';
const cases=[
 ['2024-07-30','NAC','S30_SoloVictoryCashCup','Event7Round2','ch5s3-solo-victory-cup',1,R30],
 ['2024-08-12','OCE','S30_SoloVictoryCashCup','Event9Round2','ch5s3-solo-victory-cup',1,R30],
 ['2024-08-13','ME','S30_SoloVictoryCashCup','Event9Round2','ch5s3-solo-victory-cup',1,R30],
 ['2024-08-13','ME','S30_SoloZBVictoryCashCup','Event9Round2','ch5s3-zb-solo-victory',1,R30],
 ['2024-09-03','ME','S31_SoloVictoryCashCup','Event1Round2','ch5s4-solo-victory-cup',1,R31],
 ['2024-08-12','ME','S30_SquadsVictoryCashCup','Event5Round2','ch5s3-squads-victory-cup',4,R30]
].map(([date,region,event,round,tournamentId,team,rule])=>({
 date,region,event,window:event+'_'+round+'_'+region,tournamentId,team,rule
}));
const data={
 results:read('results.json'),review:read('history-sync-review.json'),
 reviewed:read('history-sync-reviewed.json'),ledger:read('approval-history.json'),
 status:read('history-sync-status.json'),updates:read('updates.json'),
 scan:read('history-sync-scan.json'),players:read('players.json'),tournaments:read('tournaments.json')
};
const catalogs=new Map(data.tournaments.catalog.map(x=>[x.id,x]));
const known=new Set(data.players.candidates.map(x=>x.name));
const resultIds=new Set(data.results.map(x=>x.id)),reviewedIds=new Set(data.reviewed.entries.map(x=>x.id));
const approvalIds=new Set(data.ledger.entries.map(x=>x.id)),calendar={};
const added=[],duplicates=[],held=[];
const assert=(ok,msg)=>{if(!ok)throw Error(msg)};
function evidence(row,expected){
 assert(row.verified===true&&!resultIds.has(row.id)&&!reviewedIds.has(row.id)&&!approvalIds.has(row.id),'already adjudicated');
 assert(Number.isSafeInteger(row.rank)&&row.rank>0&&Number.isSafeInteger(row.points)&&row.points>=0
   &&Number.isSafeInteger(row.kills)&&row.kills>=0&&Number.isSafeInteger(row.vrs)&&row.vrs>=0
   &&Number.isSafeInteger(row.matches)&&row.matches>=1&&row.vrs<=row.matches,'invalid score');
 const cat=catalogs.get(row.tournamentId),players=Array.isArray(row.players)&&row.players.length?row.players:[row.player];
 assert(cat&&cat.name===row.event&&cat.seasonId===row.seasonId&&cat.sourceEventIds.includes(expected.event)
   &&cat.team===({1:'solo',2:'duo',3:'trio',4:'squad'}[expected.team]),'catalog or official team mismatch');
 assert(players.length===expected.team&&players.join(' / ')===row.player&&new Set(players).size===expected.team
   &&players.every(p=>known.has(p)),'Epic identity mismatch');
 const url='https://www.fortnite.com/competitive/events/'+expected.event+'/?region='+expected.region+'&round='+expected.window;
 assert(row.source===url&&row.date===expected.date&&row.region===expected.region,'official Epic event source mismatch');
 const month=row.date.slice(0,7);
 if(!calendar[month])calendar[month]=read('calendar-history/'+month+'.json').sessions;
 const session=calendar[month].find(x=>x.dateJst===row.date&&x.region===row.region&&x.eventId===expected.event
   &&x.sourceWindowId===expected.window&&x.tournamentId===row.tournamentId&&x.seasonId===row.seasonId);
 assert(session&&session.url===row.source,'official calendar mismatch');
 const cp=data.scan.windows['epicgames_'+expected.event+'_'+row.region+'/'+expected.window];
 assert(cp&&cp.rankingOrderValid===true&&cp.nextPage>=1&&cp.pages===cp.nextPage
   &&Number.isSafeInteger(cp.lastSeenRank)&&cp.lastSeenRank>=row.rank
   &&cp.proposals.filter(x=>x.id===row.id&&sameScannedCandidate(x,row)).length===1,'Epic scoreboard checkpoint mismatch');
 assert((cp.complete===true&&cp.nextPage>=cp.totalPages)
   ||verifiedPartialPage(row,{end:Date.parse(session.endUtc)},cp),'incomplete or unstable original leaderboard');
 return cp;
}
const queue=[...data.review.proposals];
for(const row of queue){
 const spec=cases.find(s=>s.date===row.date&&s.region===row.region&&s.tournamentId===row.tournamentId
   &&row.source==='https://www.fortnite.com/competitive/events/'+s.event+'/?region='+s.region+'&round='+s.window);
 if(!spec||row.kind!=='賞金決勝'||row.prize!==null||row.vrs<1||row.vrs>3)continue;
 try{
  assert(row.round.includes('Round 2 / 賞金決勝')&&row.matches<=3&&row.points===row.vrs*100,
    'cash award score not exactly VR*100');
  evidence(row,spec);
  assert(!data.results.some(x=>collision(x,row,data.players.confirmedAliases||{})),'possible duplicate achievement');
  const {reviewOnly,reviewReason,teamAccountIds,...record}=row;
  record.prize=row.vrs*100*spec.team;
  if(spec.team>1){
   record.prizePerPlayer=row.vrs*100;
   record.teamPrize=record.prize;
  }
  record.note='本人Epic ID・公式大会枠・成熟した原本順位表の'+row.rank+'位、'+row.vrs+'VR、'+row.kills+
    'K、'+row.points+'ptを照合。公式決勝1VR=$100/選手により'+
    (spec.team>1?'チーム賞金$'+record.prize+'（各選手$'+record.prizePerPlayer+'）':'個人賞金$'+record.prize)+
    'と記録。支払完了は未確認。規則: '+spec.rule;
  data.results.push(record);resultIds.add(record.id);reviewedIds.add(record.id);approvalIds.add(record.id);
  data.review.proposals=data.review.proposals.filter(x=>x.id!==row.id);
  data.reviewed.entries.push({id:row.id,decision:'published',recordId:row.id,
   reviewedAt:stamp,source:row.source,policy:'official-final-vr-award',rule:spec.rule});
  data.ledger.entries.push({id:row.id,decision:'published',recordId:row.id,
   approvedAt:stamp,approvedBy:'ChatGPT / owner-authorized verified official finals',
   policy:'official-final-vr-award',source:row.source,rule:spec.rule,
   evidence:'Original Epic-ID team roster, official calendar and stable saved ranked finals with actual VRs and official per-player $100 payout'});
  added.push({id:row.id,player:row.player,rank:row.rank,date:row.date,prize:record.prize,prizePerPlayer:record.prizePerPlayer||record.prize});
 }catch(e){held.push({id:row.id,reason:String(e.message||e)})}
}
for(const row of [...data.review.proposals]){
 if(row.kind!=='参加確認'||row.reviewOnly!==true||row.prize!==null)continue;
 const existing=data.results.filter(x=>x.date===row.date&&x.region===row.region
   &&x.tournamentId===row.tournamentId&&x.event===row.event&&x.player===row.player&&x.kind==='スキン大会');
 if(existing.length!==1)continue;
 const old=existing[0];
 if(old.rank!==row.rank||old.points!==row.points||old.kills!==row.kills||old.vrs!==row.vrs
   ||(old.matches!==undefined&&old.matches!==row.matches)){
  held.push({id:row.id,reason:'skin result rank/stat conflict; do not overwrite existing result'});
  continue;
 }
 try{
  const expectedEvent=row.source.match(/\/events\/([^/]+)\//)?.[1],window=row.source.match(/[?&]round=([^&]+)/)?.[1];
  assert(expectedEvent&&window,'invalid original Epic URL');
  const spec={date:row.date,region:row.region,event:expectedEvent,window,
   tournamentId:row.tournamentId,team:(Array.isArray(row.players)?row.players.length:1)};
  evidence(row,spec);
  data.review.proposals=data.review.proposals.filter(x=>x.id!==row.id);
  data.reviewed.entries.push({id:row.id,decision:'already-published',existingId:old.id,
   source:row.source,verifiedAt:stamp,note:'Same player, date, event, rank, points, kills and VRs already represented in published skin result; no second participation row'});
  reviewedIds.add(row.id);
  duplicates.push({candidateId:row.id,existingId:old.id});
 }catch(e){held.push({id:row.id,reason:String(e.message||e)})}
}
const touched=added.length+duplicates.length;
if(touched){
 const day=new Date(Date.parse(stamp)+9*3600000).toISOString().slice(0,10);
 if(added.length){
  const id='legacy-exact-final-awards-'+crypto.createHash('sha256').update(added.map(x=>x.id).sort().join('|')).digest('hex').slice(0,12);
  assert(!data.updates.entries.some(x=>x.id===id),'reused cash award marker');
  data.updates.entries.unshift({id,date:day,type:'records',
   title:'2024年公式Victory Cup決勝の確認済み賞金 '+added.length+'件を追加',
   description:'Epic公式の原本順位表、本人ID、VR数、地域別大会枠を検証。各選手1VR=$100のS30/S31賞金を確定、Squadsはチーム総額と個人額を分離。支払完了は未確認。',
   recordIds:added.map(x=>x.id)});
 }
 data.review.manualReviewedAt=stamp;data.reviewed.reviewedAt=stamp;data.ledger.reviewedAt=stamp;
 data.status.found=data.review.proposals.length;
 data.status.manualReviewCandidates=data.review.proposals.length;
 data.status.reviewOnlyCandidates=data.review.proposals.filter(x=>x.reviewOnly===true).length;
 data.status.manuallyPublished=(data.status.manuallyPublished||0)+added.length;
 data.status.manuallyResolvedDuplicates=(data.status.manuallyResolvedDuplicates||0)+duplicates.length;
 data.status.lastReviewedBatchAt=stamp;
 data.status.message='2024年公式現金賞金'+added.length+'件、完全一致の既存スキン戦績との重複'+duplicates.length+'件を整理。残り'+data.review.proposals.length+'件は順位差等を保留。';
}
console.log('AOT_LEGACY_FINAL_AND_DUPLICATES '+JSON.stringify({
 dry,added:added.length,prizeTotal:added.reduce((x,y)=>x+y.prize,0),cash:added,duplicates:duplicates.length,
 heldCount:held.length,held:held.slice(0,25),remainingPending:data.review.proposals.length
}));
if(!dry&&touched){
 for(const [name,value] of [
  ['results.json',data.results],['history-sync-review.json',data.review],['history-sync-reviewed.json',data.reviewed],
  ['history-sync-status.json',data.status],['approval-history.json',data.ledger],['updates.json',data.updates]
 ])write(name,value);
}
