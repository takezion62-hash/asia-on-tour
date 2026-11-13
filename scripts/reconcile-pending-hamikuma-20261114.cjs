'use strict';
// Preserve screenshot/Tracker and independent Fortnite.gg cosmetic standings.
// Original Epic API checkpoint returns a one-position smaller rank for three
// NAW teams, while all match scores/rosters remain the same. No duplicate skins.
const fs=require('node:fs'),path=require('node:path');
const {loadReviewDb,writeReviewDb}=require('./reviewed-publication-core.cjs');
const {validateOriginal,collision}=require('./manual-approval-core.cjs');
const {sameScannedCandidate,verifiedPartialPage}=require('./verified-partial-page.cjs');
const {validateData}=require('./data-checks.cjs');
const {audit}=require('./validate-approvals.cjs');
const {validateUpdateLog}=require('./validate-updates.cjs');
const ROOT=path.resolve(__dirname,'..');
const dry=process.argv.includes('--dry-run');
if(!(process.argv.length===2||(process.argv.length===3&&dry)))
 throw Error('Only --dry-run or no args allowed');
const PROOF='https://fortnite.gg/events/epicgames_S42_HamiKumaCup_NAW';
const TARGETS=[
 ['auto-s42-a4f23e465769','s42-me-hamikuma-br-trios-skin-20261025-ema-shxrkgoty-akishika','ME',21,21,398,35,1,9],
 ['auto-s42-020f0ae10c3b','s42-naw-hamikuma-br-trios-skin-20261025-kusachan-rurumaru-nijiirobeta','NAW',45,46,444,93,0,10],
 ['auto-s42-8edeaf466d81','s42-naw-hamikuma-br-trios-skin-20261025-hiro-fisker-kereyushi','NAW',54,55,435,57,3,11],
 ['auto-s42-86bfaeeec308','s42-naw-hamikuma-br-trios-skin-20261025-minto-alpha-miteru','NAW',56,57,434,53,1,8]
];
const ok=(assert,msg)=>{if(!assert)throw Error('NOV14_HAMIKUMA_RECONCILE: '+msg)};
const db=loadReviewDb(ROOT);
db.reviewed=JSON.parse(fs.readFileSync(path.join(ROOT,'history-sync-reviewed.json'),'utf8'));
const prior=new Set(db.reviewed.entries.map(x=>x.id)),exists=new Map(db.results.map(x=>[x.id,x]));
const known=new Map(db.tournaments.catalog.map(x=>[x.id,x]));
const now=new Date().toISOString();
let resolved=0,already=0;
const details=[];
for(const [id,existingId,region,epicRank,trackerRank,points,kills,vrs,matches] of TARGETS){
 const row=exists.get(existingId);
 ok(row&&row.date==='2026-10-25'&&row.region===region&&
  row.tournamentId==='ch7s4-hamikuma-cup-battle-royale'&&
  row.event==='HamiKuma Cup Battle Royale'&&row.kind==='スキン大会'&&
  row.verified===true&&row.prize===0&&row.rank===trackerRank&&
  row.points===points&&row.kills===kills&&row.vrs===vrs&&row.matches===matches,
  'cannot alter or misidentify existing cosmetic achievement '+existingId);
 const requests=['auto','history'].flatMap(origin=>
  db.reviews[origin].proposals.filter(x=>x.id===id).map(x=>({origin,row:x})));
 if(!requests.length){
  ok(prior.has(id)&&db.reviewed.entries.some(x=>x.id===id&&x.decision==='already-published'&&x.existingId===existingId),
   'candidate missing without exact duplicate review '+id);
  already++;continue;
 }
 ok(requests.every(x=>x.row===requests[0].row||sameScannedCandidate(x.row,requests[0].row)),
  'conflicting candidate across scopes '+id);
 const cand=requests[0].row,window='S42_HamiKumaCup_'+region;
 ok(cand.id===id&&cand.date==='2026-10-25'&&cand.region===region&&
  cand.player===row.player&&cand.tournamentId===row.tournamentId&&
  cand.event===row.event&&cand.kind==='参加確認'&&cand.reviewOnly===true&&
  cand.prize===null&&cand.rank===epicRank&&cand.points===points&&
  cand.kills===kills&&cand.vrs===vrs&&cand.matches===matches&&
  cand.source==='https://www.fortnite.com/competitive/events/S42_HamiKumaCup/?region='+region+'&round='+window&&
  collision(row,cand,db.players.confirmedAliases),
  'original Epic ID/score or roster does not match existing screenshot '+id);
 const cal=JSON.parse(fs.readFileSync(path.join(ROOT,'calendar-history/2026-10.json'),'utf8'));
 const session=cal.sessions.find(s=>s.eventId==='S42_HamiKumaCup'&&
  s.sourceWindowId===window&&s.region===region&&s.dateJst==='2026-10-25'&&
  s.tournamentId===row.tournamentId);
 ok(Boolean(session),'no official Epic event calendar '+id);
 const key='epicgames_S42_HamiKumaCup_'+region+'/'+window;
 const cps=Object.values(db.scans).map(scan=>scan.windows?.[key]).filter(Boolean);
 ok(cps.some(cp=>cp.rankingOrderValid===true&&
  cp.proposals?.some(q=>q.id===id&&sameScannedCandidate(q,cand))&&
  (cp.complete===true||verifiedPartialPage(cand,{end:Date.parse(session.endUtc)},cp))),
  'official Epic leaderboard is not independently verified '+id);
 validateOriginal(cand,cps.find(cp=>cp.proposals?.some(q=>q.id===id&&sameScannedCandidate(q,cand))),
  session,known.get(cand.tournamentId),db.players);
 ok(!prior.has(id)&&!exists.has(id)&&!db.ledger.entries.some(e=>e.id===id),
  'candidate already in publication ledger '+id);
 for(const origin of ['auto','history']){
  const list=db.reviews[origin].proposals;
  const kept=list.filter(x=>x.id!==id);
  if(kept.length!==list.length){
   db.reviews[origin].proposals=kept;db.reviews[origin].manualReviewedAt=now;
   db.statuses[origin].found=kept.length;
   db.statuses[origin].manualReviewCandidates=kept.length;
   db.statuses[origin].reviewOnlyCandidates=kept.filter(x=>x.reviewOnly===true).length;
   db.statuses[origin].manuallyResolvedDuplicates=(db.statuses[origin].manuallyResolvedDuplicates||0)+1;
   db.statuses[origin].lastReviewedBatchAt=now;
  }
 }
 db.reviewed.entries.push({
  id,decision:'already-published',existingId,reviewedAt:now,source:cand.source,
  evidence:region==='NAW'
  ? 'Epic mature leaderboard + earlier user Tracker screenshot + independently published Fortnite.gg rank '+trackerRank+
    ' (Epic queue rank '+epicRank+' differs by one; original Tracker score/skin kept). '+PROOF
  : 'Original screenshot score, original Epic roster and rank 21 match exactly; keep rewarded skin record.'});
 prior.add(id);details.push({player:row.player,region,epicRank,keptTrackerRank:trackerRank,existingId});
 resolved++;
}
const v=validateData({results:db.results,players:db.players,tournaments:db.tournaments});
ok(!v.errors.length,'published data validation failed');
ok(!audit(db.results,db.ledger,db.players).length,'approval audit failed');
ok(!validateUpdateLog(db.results,db.updates).length,'updates audit failed');
if(!dry&&resolved){
 writeReviewDb(ROOT,db);
 fs.writeFileSync(path.join(ROOT,'history-sync-reviewed.json'),JSON.stringify(db.reviewed,null,2)+'\n');
}
console.log('NOV14_HAMIKUMA '+JSON.stringify({mode:dry?'dry-run':'apply',
 resolved,already,keptPrize:0,scoreUnchanged:true,details}));
