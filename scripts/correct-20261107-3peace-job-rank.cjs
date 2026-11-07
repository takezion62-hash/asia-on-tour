'use strict';
// Repair the sole previously-conflicting S42 NAC Performance Evaluation duo.
// Confirmed by the site's owner on 2026-11-07: correct place 702, not 701.
// Keep every other scored field and the existing public record ID unchanged.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=file=>JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
const write=(file,data)=>fs.writeFileSync(path.join(root,file),JSON.stringify(data,null,2)+'\n');
const SOURCE_ID='auto-s42-ef18ae1d40bd';
const RECORD_ID='s42-nac-performance-duos-qual-20260918-3peace-job';
const WINDOW='S42_PerformanceEvaluation_Event4Round1_NAC';
const EVENT='S42_PerformanceEvaluation';
const MARK='corrected-20261107-performance-3peace-job-rank702';
const results=read('results.json');
const queue=read('history-sync-review.json');
const ledger=read('history-sync-reviewed.json');
const status=read('history-sync-status.json');
const updates=read('updates.json');
const scan=read('history-sync-scan.json');
const catalog=read('tournaments.json').catalog;
if(updates.entries.some(x=>x.id===MARK)){
 console.log('S42_3PEACE_JOB_ALREADY_CORRECTED');process.exit(0);
}
if(!Array.isArray(results)||!Array.isArray(queue.proposals)||!Array.isArray(ledger.entries)||
 !scan.windows)throw Error('Validation source missing');
const candidate=queue.proposals.find(x=>x.id===SOURCE_ID);
const matches=results.filter(x=>x.id===RECORD_ID);
if(!candidate||matches.length!==1)throw Error('Unique original row and review candidate required');
const record=matches[0];
if(ledger.entries.some(x=>x.id===SOURCE_ID))throw Error('Candidate already adjudicated; do not repeat');
const competition=catalog.find(x=>x.id==='ch7s4-performance-evaluation');
if(!competition||competition.seasonId!=='S42'||!competition.sourceEventIds.includes(EVENT))
 throw Error('Competition catalog does not match official source');
if(candidate.date!=='2026-09-18'||candidate.region!=='NAC'||
 candidate.player!=='3peace / Job'||candidate.tournamentId!==competition.id||
 candidate.event!==competition.name||candidate.seasonId!=='S42'||
 candidate.rank!==702||candidate.points!==83||candidate.kills!==3||
 candidate.vrs!==0||candidate.matches!==4||candidate.kind!=='参加確認'||
 candidate.verified!==true||candidate.prize!==null||
 candidate.round!=='Event 4 · Round 1 / 参加確認'||
 JSON.stringify(candidate.players)!==JSON.stringify(['3peace','Job']))
 throw Error('Submitted correct 702nd placement differs from the saved Epic candidate');
const source=new URL(candidate.source);
if(source.protocol!=='https:'||source.hostname!=='www.fortnite.com'||
 source.pathname!=='/competitive/events/'+EVENT+'/'||
 source.searchParams.get('region')!=='NAC'||source.searchParams.get('round')!==WINDOW)
 throw Error('Saved Epic candidate is not the exact September 18 NAC qualifying window');
const cp=scan.windows['epicgames_'+EVENT+'_NAC/'+WINDOW];
const original=(cp?.proposals||[]).filter(x=>x.id===SOURCE_ID);
if(!cp||cp.nextPage<1||original.length!==1||
 !['rank','points','kills','vrs','matches','date','region','player','source','tournamentId'].every(k=>
  JSON.stringify(original[0][k])===JSON.stringify(candidate[k])))
 throw Error('Saved Epic-ID leaderboard cannot corroborate the exact 702nd place and score');
if(record.id!==RECORD_ID||record.date!==candidate.date||
 record.region!==candidate.region||record.player!==candidate.player||
 record.tournamentId!==candidate.tournamentId||record.seasonId!==candidate.seasonId||
 record.event!==candidate.event||
 ![701,702].includes(record.rank)||
 ['points','kills','vrs','matches'].some(k=>record[k]!==candidate[k])||
 record.verified!==true||!(record.prize===0||record.prize===null))
 throw Error('The currently published 701st result has changed; preserve it for review');
const oldUrl=new URL(record.source);
if(oldUrl.hostname!=='fortnitetracker.com'||!oldUrl.pathname.includes('epicgames_'+EVENT+'_NAC')||
 oldUrl.searchParams.get('window')!==WINDOW)
 throw Error('The existing rank is from an unexpected tournament window');
if(results.some(x=>x.id!==RECORD_ID&&x.date===record.date&&x.region===record.region&&
 x.tournamentId===record.tournamentId&&x.player===record.player))
 throw Error('Another row for this exact duo and tournament needs manual reconciliation');
const before=record.rank;
record.rank=702;
if(typeof record.note==='string'&&record.note.includes('701位'))record.note=record.note.replaceAll('701位','702位');
const now=new Date().toISOString();
queue.proposals=queue.proposals.filter(x=>x.id!==SOURCE_ID);
queue.manualReviewedAt=now;
ledger.entries.push({
 id:SOURCE_ID,decision:'corrected-existing',existingId:RECORD_ID,recordId:RECORD_ID,
 source:candidate.source,previousRank:before,correctedRank:702,
 evidence:'Site owner confirmed the 2026-09-18 NAC Performance Evaluation 3peace/Job duo official position is 702; archived Epic leaderboard also shows 702. Previously listed Tracker result had rank 701 but identical 83 points, 3 eliminations, 0 wins and 4 matches.',
 reviewedAt:now
});
ledger.reviewedAt=now;
status.found=queue.proposals.length;
status.manualReviewCandidates=queue.proposals.length;
status.reviewOnlyCandidates=queue.proposals.filter(x=>x.reviewOnly===true).length;
status.manuallyCorrected=(status.manuallyCorrected||0)+1;
status.lastCorrectedReviewAt=now;
status.message='3peace / JobのNAC Performance Evaluation順位を701→702に修正し、確認待ち重複1件を解消。既存の得点・キル・VR・試合数・賞金は維持。残り確認待ち'+queue.proposals.length+'件。';
updates.entries.unshift({
 id:MARK,date:now.slice(0,10),type:'site',
 title:'NAC Performance Evaluationの3peace／Jobの順位を702位へ修正',
 description:'既存戦績 '+RECORD_ID+'：2026年9月18日NAC Event 4 Round 1。元掲載701位から702位へ訂正。83pt・3K・0VR・4試合と賞金は変更せず、重複した確認候補1件を解消。',
 recordIds:[]
});
write('results.json',results);
write('history-sync-review.json',queue);
write('history-sync-reviewed.json',ledger);
write('history-sync-status.json',status);
write('updates.json',updates);
console.log('S42_3PEACE_JOB_RANK_CORRECTED '+JSON.stringify({
 recordId:RECORD_ID,previousRank:before,newRank:record.rank,
 points:record.points,kills:record.kills,vr:record.vrs,matches:record.matches,
 prize:record.prize,remainingHistory:queue.proposals.length}));
