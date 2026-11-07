'use strict';
// Conclude reviewed candidates without publishing a VOIDED event or duplicating results.
// Source: FortniteTracker marks 2026-06-07 OCE PlayStation BR session VOIDED;
// Official Epic ME Solo Reload Test leaderboard is rank75, not Osirion rank74.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const write=(p,o)=>fs.writeFileSync(path.join(root,p),JSON.stringify(o,null,2)+'\n');
const VOID_IDS=["auto-s41-2a0ca39875d4","auto-s41-62f75d6684c6","auto-s41-bb9668bd35e5","auto-s41-2cce4619d5f2","auto-s41-b8e6b6ea2115","auto-s41-704ead32c1b3","auto-s41-6d3693648527","auto-s41-1d23722df81b","auto-s41-22bc1422dbfc","auto-s41-27c4ed02bdaf","auto-s41-2b023a1a37bc","auto-s41-dfaec5d7dc8c","auto-s41-adcbb8ece8a2"];
const REVIEW_ID='auto-s43-1f3a56f9719d';
const ZORO_IDS=['auto-s43-c51e2bbfb3ed','auto-s43-6b7fe976d9eb'];
const marker='review-20261107-final-voided-and-duplicates';
const history=read('history-sync-review.json'),current=read('auto-sync-review.json'),
  hStatus=read('history-sync-status.json'),aStatus=read('auto-sync-status.json'),
  ledger=read('history-sync-reviewed.json'),approvals=read('approval-history.json'),
  scan=read('history-sync-scan.json'),autoScan=read('auto-sync-scan.json'),
  results=read('results.json'),updates=read('updates.json');
if(updates.entries.some(x=>x.id===marker)){console.log('FINAL_AUDIT_ALREADY_APPLIED');process.exit(0)}
if(VOID_IDS.length!==13||new Set(VOID_IDS).size!==13)throw Error('Void audit manifest invalid');
const hBy=new Map(history.proposals.map(x=>[x.id,x])),aBy=new Map(current.proposals.map(x=>[x.id,x]));
const required=new Set([...VOID_IDS,REVIEW_ID]);
for(const id of required)if(!hBy.has(id))throw Error('Historical candidate missing '+id);
for(const id of ZORO_IDS)if(!aBy.has(id))throw Error('Current candidate missing '+id);
const checkpoint=(row,data)=>{
 const url=new URL(row.source),win=url.searchParams.get('round');
 const m=url.pathname.match(/^\/competitive\/events\/([^/]+)\/$/);
 if(!m||url.protocol!=='https:'||url.hostname!=='www.fortnite.com'||
 url.searchParams.get('region')!==row.region||!win)throw Error('Official source mismatch: '+row.id);
 const key='epicgames_'+m[1]+'_'+row.region+'/'+win;
 const cp=data.windows[key],original=cp?.proposals?.find(x=>x.id===row.id);
 if(!original||cp.nextPage<1)throw Error('Missing saved official Epic ID score for '+row.id);
 for(const k of ['date','region','player','playerRaw','rank','points','kills','vrs','matches',
 'source','seasonId','tournamentId','kind'])
  if(JSON.stringify(row[k]??null)!==JSON.stringify(original[k]??null))
   throw Error('Immutable checkpoint changed '+row.id+' '+k);
 if(row.verified!==true||row.reviewOnly!==true||row.prize!==null)throw Error('Not pending for review');
 return {original,cp,key};
};
const voidSource='https://fortnitetracker.com/events/epicgames_S41_PSCupDaysOfPlay_OCE?page=2&window=S41_PSCupDaysOfPlay_Qualifier_OCE';
for(const id of VOID_IDS){
 const row=hBy.get(id);
 if(row.date!=='2026-06-07'||row.region!=='OCE'||
  row.tournamentId!=='ch7s3-days-of-play-playstation-cup-br'||
  row.event!=='Days of Play PlayStation Cup (Battle Royale)'||
  row.source!=='https://www.fortnite.com/competitive/events/S41_PSCupDaysOfPlay/?region=OCE&round=S41_PSCupDaysOfPlay_Qualifier_OCE')
  throw Error('Voided event identity mismatch '+id);
 checkpoint(row,scan);
 if(ledger.entries.some(x=>x.id===id))throw Error('Already audited VOIDED row '+id);
 if(results.some(x=>x.id===id))throw Error('Voided entry already public, manual repair needed '+id);
 ledger.entries.push({id,decision:'voided-not-published',event:'2026-06-07 OCE Days of Play PlayStation Cup BR Qualifier 1',
  source:row.source,voidEvidence:voidSource,reviewedAt:'2026-11-07',
  evidence:'FortniteTracker labels this exact June7 OCE Session 1 VOIDED. No qualification, spray or cash awarded from this voided round; excluded from public results.'});
}
const oldRow=hBy.get(REVIEW_ID);
checkpoint(oldRow,scan);
if(oldRow.date!=='2026-11-02'||oldRow.region!=='ME'||
 oldRow.tournamentId!=='ch7s5-solo-reload-test-cup'||oldRow.player!=='RVL ぐれーぷふぁんぼーい'||
 oldRow.rank!==74||oldRow.points!==375||oldRow.kills!==15||oldRow.vrs!==1||oldRow.matches!==9)
 throw Error('Disputed original changed');
const old=results.find(x=>x.id==='s43-me-solo-reload-test-20261102-rvl-grape');
if(!old||old.date!==oldRow.date||old.region!==oldRow.region||old.tournamentId!==oldRow.tournamentId||
 old.player!==oldRow.player||old.rank!==75||old.points!==375||old.kills!==15||old.vrs!==1||old.matches!==9)
 throw Error('Existing site row not exactly same source score with official rank75');
const official='https://www.fortnite.com/competitive/events/S43_SoloReloadTestCup/leaderboard?defId=S43_SoloReloadTestCup_DefaultLeaderboardDef&region=ME&round=S43_SoloReloadTestCup_ME';
if(ledger.entries.some(x=>x.id===REVIEW_ID))throw Error('Disputed candidate already decided');
ledger.entries.push({id:REVIEW_ID,decision:'rank-conflict-resolved-existing-official',
 existingId:old.id,source:oldRow.source,officialLeaderboard:official,
 evidence:'Epic official leaderboard shows RVL xxx 75th, 375 points, 15 elims, 1VR, 9 matches; Osirion cached rank74 differs. Existing 75th place record retained, not duplicated.'});
if(!old.note.includes('公式順位75位')){
 old.note+=' Epic公式最終順位75位・375pt・15K・1VR・9試合を照合。Osirionキャッシュの74位は不採用。公式: '+official;
}
for(const id of ZORO_IDS){
 const row=aBy.get(id);checkpoint(row,autoScan);
 const reviewed=ledger.entries.find(x=>x.id===id&&x.decision==='already-published');
 const published=results.find(x=>x.id===reviewed?.existingId);
 if(!reviewed||!published||row.date!==published.date||row.region!==published.region||
  row.tournamentId!==published.tournamentId||row.player!==published.player||
  ['rank','points','kills','vrs'].some(k=>row[k]!==published[k]))
  throw Error('Current Zoro is not an exact confirmed duplicate '+id);
 if(approvals.entries.some(x=>x.id===id))throw Error('Current Zoro already decided in approval ledger');
 approvals.entries.push({id,decision:'already-published',existingId:published.id,
  policy:'cosmetic-rank-existing',source:row.source,approvedAt:'2026-11-07',
  evidence:'Verified same Epic account, OCE session, team, rank, kills, VR and points. Previously published Zoro Mobile award; duplicate ignored.'});
}
const hCleared=new Set([...VOID_IDS,REVIEW_ID]);
history.proposals=history.proposals.filter(x=>!hCleared.has(x.id));
current.proposals=current.proposals.filter(x=>!ZORO_IDS.includes(x.id));
if(history.proposals.length!==0||current.proposals.length!==0)throw Error('New candidates appeared during audit; refuse stale queue clearing');
const now=new Date().toISOString();history.manualReviewedAt=now;current.manualReviewedAt=now;
ledger.reviewedAt=now;approvals.reviewedAt=now;
hStatus.found=0;hStatus.manualReviewCandidates=0;hStatus.reviewOnlyCandidates=0;
hStatus.reviewedVoided=(hStatus.reviewedVoided||0)+13;
hStatus.reviewedRankConflict=(hStatus.reviewedRankConflict||0)+1;
hStatus.lastAuditAt=now;
hStatus.message='過去候補を照合完了。無効開催枠13件は掲載除外、ME Solo Reloadの順位差異1件は公式75位の既存行を維持。今回の過去確認待ち残件0。';
aStatus.found=0;aStatus.manualReviewCandidates=0;aStatus.reviewOnlyCandidates=0;
aStatus.reviewedExactDuplicates=(aStatus.reviewedExactDuplicates||0)+2;
aStatus.lastAuditAt=now;aStatus.message='最新候補2件は既存のZoro Mobileスキン結果と完全一致。新規重複なしで確認待ちを解消。';
updates.entries.unshift({id:marker,date:now.slice(0,10),type:'site',
 title:'確認待ち候補の照合を完了：無効大会・重複・順位差を整理',
 description:'OCE PlayStation Cup 2026/6/7の無効開催枠13件は掲載対象外。ME Solo Reloadの74/75位差異はEpic公式75位を採用して二重登録せず。OCE Zoro Mobileの既存スキン2件は重複除外。既存の賞金・成績は保持。',
 recordIds:[]});
write('results.json',results);write('history-sync-review.json',history);write('auto-sync-review.json',current);
write('history-sync-status.json',hStatus);write('auto-sync-status.json',aStatus);
write('history-sync-reviewed.json',ledger);write('approval-history.json',approvals);write('updates.json',updates);
console.log('FINAL_REVIEW_AUDIT '+JSON.stringify({voided:13,rankConflict:1,currentExactDuplicates:2,
 historyRemaining:history.proposals.length,recentRemaining:current.proposals.length,existingOfficialRank:old.rank}));
