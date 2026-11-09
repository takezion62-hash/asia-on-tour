'use strict';
// One-time, safety-checked publication of four remaining recent review proposals.
// EU qualified result belongs in results.json; three non-awarded appearances
// belong in the separate participation archive (not cash or achievements).
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const {sameScannedCandidate}=require('./verified-partial-page.cjs');
const {collision}=require('./manual-approval-core.cjs');
const {appendArchive,recordId}=require('./participation-archive.cjs');
const read=name=>JSON.parse(fs.readFileSync(path.join(root,name),'utf8'));
const write=(name,data)=>fs.writeFileSync(path.join(root,name),JSON.stringify(data,null,2)+'\n');
const requireTrue=(ok,msg)=>{if(!ok)throw Error('AOT_PENDING_20261109: '+msg)};
const RULE='https://www.fortnite.com/competitive/rules-guidelines/rules-library/fortnite-victory-cups-chapter-7-season-4-official-rules';
const TARGETS=Object.freeze([
 {id:'auto-s42-ecf6149fa02e',date:'2026-10-24',region:'EU',player:'Dartri',rank:275,points:250,kills:2,vrs:1,matches:5,kind:'result'},
 {id:'auto-s42-0445c2eb81e2',date:'2026-10-25',region:'NAW',player:'みずるん',rank:4713,points:106,kills:14,vrs:0,matches:3,kind:'archive'},
 {id:'auto-s42-0ff9d88f0488',date:'2026-10-25',region:'NAC',player:'たらこ唇',rank:4453,points:140,kills:8,vrs:0,matches:3,kind:'archive'},
 {id:'auto-s42-d4f17e5d984d',date:'2026-10-26',region:'NAW',player:'EXV mAximum24 / ぱな',rank:448,points:296,kills:56,vrs:0,matches:11,kind:'archive'}
]);
const SCORE_KEYS=['date','region','player','rank','points','kills','vrs','matches'];
const roster=r=>Array.isArray(r.players)&&r.players.length?r.players:[r.player];
const identicalPerformance=(a,b)=>SCORE_KEYS.every(k=>a[k]===b[k])&&
 a.source===b.source&&a.tournamentId===b.tournamentId&&
 roster(a).slice().sort().join('|')===roster(b).slice().sort().join('|');
function main(){
 const db={
  results:read('results.json'),players:read('players.json'),tournaments:read('tournaments.json'),
  review:read('auto-sync-review.json'),scan:read('auto-sync-scan.json'),
  status:read('auto-sync-status.json'),reviewed:read('history-sync-reviewed.json'),
  approvals:read('approval-history.json'),updates:read('updates.json')
 };
 const cals=read('calendar-history/2026-10.json').sessions;
 const archived=read('participation/2026-10.json').entries;
 const known=new Set(db.players.candidates.map(p=>p.name));
 const processed=new Map(db.reviewed.entries.map(x=>[x.id,x]));
 const approved=new Set(db.approvals.entries.map(x=>x.id));
 const catalogs=new Map(db.tournaments.catalog.map(x=>[x.id,x]));
 const now=new Date().toISOString();
 const resolved=new Set(),resultsAdded=[],archiveItems=[],already=[];
 requireTrue(TARGETS.length===4&&new Set(TARGETS.map(x=>x.id)).size===4,'target list changed');
 requireTrue(db.review.proposals&&db.scan.windows,'review/scan missing');
 for(const expected of TARGETS){
  const row=db.review.proposals.find(x=>x.id===expected.id);
  if(!row){
   requireTrue(processed.has(expected.id)||db.results.some(x=>x.id===expected.id),
    'candidate disappeared without publication or review: '+expected.id);
   already.push({id:expected.id,reason:'previously processed'});
   continue;
  }
  requireTrue(SCORE_KEYS.every(k=>row[k]===expected[k])&&row.verified===true&&
   /^auto-s42-[a-f0-9]{12}$/.test(row.id)&&
   row.seasonId==='S42'&&row.prize===(row.tournamentId==='ch7s4-console-zero-build-solo-victory-cup'?0:null),
   'candidate score or classification changed: '+row.id);
  const url=new URL(row.source);
  const eventId=decodeURIComponent(url.pathname.split('/')[3]),windowId=url.searchParams.get('round');
  requireTrue(url.protocol==='https:'&&url.hostname==='www.fortnite.com'&&
   url.searchParams.get('region')===row.region&&windowId&&
   windowId.endsWith('_'+row.region),'unverified event link: '+row.id);
  const catalog=catalogs.get(row.tournamentId);
  const isConsole=row.tournamentId==='ch7s4-console-zero-build-solo-victory-cup';
  requireTrue(catalog&&catalog.name===row.event&&catalog.seasonId===row.seasonId&&
   catalog.sourceEventIds.includes(eventId)&&
   (isConsole?catalog.team==='solo':catalog.team==='duo'),
   'tournament catalog mismatch: '+row.id);
  requireTrue(isConsole===(expected.kind!=='archive'||row.id!=='auto-s42-d4f17e5d984d'),
   'unexpected event category: '+row.id);
  const people=roster(row);
  requireTrue(people.length===(isConsole?1:2)&&people.every(n=>known.has(n))&&
   row.player===people.join(' / '),'player identity is not linked: '+row.id);
  const calendar=cals.filter(s=>s.sourceWindowId===windowId&&s.eventId===eventId&&
   s.dateJst===row.date&&s.region===row.region&&
   s.tournamentId===row.tournamentId&&s.seasonId===row.seasonId);
  requireTrue(calendar.length===1,'official calendar window not unique: '+row.id);
  const key='epicgames_'+eventId+'_'+row.region+'/'+windowId;
  const cp=db.scan.windows[key];
  requireTrue(cp&&cp.proposals?.some(x=>x.id===row.id&&sameScannedCandidate(x,row))&&
   cp.rankingOrderValid===true&&cp.nextPage>=1&&cp.lastSeenRank>=row.rank&&
   !cp.lastErrorCode&&!cp.lastError&&!cp.retryAfter&&!cp.emptyAttempts,
   'source ranking/ID checkpoint incomplete or conflicting: '+row.id);
  requireTrue(Date.parse(cp.lastSuccessAt)>Date.parse(calendar[0].endUtc)+4*3600000,
   'source leaderboard not settled: '+row.id);
  const cutoff=row.region==='EU'||row.region==='NAC'?2000:1000;
  const existing=db.results.filter(x=>collision(x,row,db.players.confirmedAliases));
  if(existing.length){
   requireTrue(existing.length===1&&identicalPerformance(existing[0],row),
    'conflicting published performance: '+row.id);
   resolved.add(row.id);already.push({id:row.id,reason:'already in results.json',existingId:existing[0].id});
   if(!processed.has(row.id))db.reviewed.entries.push({id:row.id,decision:'already-published',
     existingId:existing[0].id,reviewedAt:now,evidence:'Identical official score, source, session and roster'});
   continue;
  }
  if(expected.kind==='result'){
   requireTrue(isConsole&&row.region==='EU'&&row.kind==='予選'&&row.rank<=cutoff&&
    row.round==='Event 8 · Round 1 / 予選'&&row.matches<=8&&!approved.has(row.id),
    'EU qualified result missing cutoff evidence: '+row.id);
   const {reviewReason,reviewOnly,teamAccountIds,note,...base}=row;
   const rec={...base,round:'Event 8 · Round 1 / 予選突破',
    kind:'予選',prize:0,
    note:'保存済み公式順位表と本人Epic IDを照合。EU予選上位2000位の通過条件内（275位）。賞金$0。最終賞金・受給資格は未認定。根拠: '+RULE};
   db.results.push(rec);
   resultsAdded.push(row.id);
   db.approvals.entries.push({id:row.id,decision:'published',recordId:row.id,
    policy:'verified-rule',approvedAt:now,approvedBy:'ChatGPT (user-authorized GitHub integration)',
    source:row.source,rule:RULE,evidence:'Epic ID, ranked checkpoint, official calendar and region-specific top 2000 qualifying cutoff; cash $0.'});
  }else{
   requireTrue(!approved.has(row.id),'archive candidate incorrectly appears in cash approval ledger: '+row.id);
   if(isConsole)requireTrue(row.kind==='予選'&&row.prize===0&&
    row.round==='Event 8 · Round 1 / 予選'&&row.rank>cutoff,
    'out-of-cutoff archive record would be a qualifier: '+row.id);
   else requireTrue(row.kind==='参加確認'&&row.prize===null&&row.reviewOnly===true&&
    row.round==='単一開催枠 / 参加確認','icon cup award not confirmed: '+row.id);
   const prev=archived.find(x=>x.id===recordId(row));
   if(prev&&prev.rank!==row.rank){
    requireTrue(Math.abs(prev.rank-row.rank)<=1&&
     ['date','region','player','points','kills','vrs','matches'].every(k=>prev[k]===row[k])&&
     prev.source===row.source&&prev.tournamentId===row.tournamentId&&
     roster(prev).join('|')===roster(row).join('|'),
     'rank change cannot be safely reconciled: '+row.id);
    const beforeRank=prev.rank;
    prev.rank=row.rank;
    prev.note=(prev.note||'')+' 保存済み公式API順位の再取得で'+beforeRank+'位から'+row.rank+'位へ更新。';
   }
   if(prev)requireTrue(identicalPerformance(prev,row),'conflicting participation archive: '+row.id);
   archiveItems.push({row,win:{...calendar[0],windowId:calendar[0].sourceWindowId,kind:isConsole?'予選':'参加確認',round:row.round},
    cutoff:isConsole?cutoff:null,already:!!prev});
  }
  resolved.add(row.id);
  if(!processed.has(row.id))db.reviewed.entries.push({id:row.id,
   decision:expected.kind==='result'?'published':'participation-archived',
   recordId:expected.kind==='result'?row.id:recordId(row),
   reviewedAt:now,source:row.source,
   evidence:'Confirmed Epic-ID-linked official checkpoint, event session, source, roster and rank; unverified prizes never inferred'});
 }
 if(archiveItems.some(x=>x.already))write('participation/2026-10.json',{version:1,month:'2026-10',entries:archived});
 const archiveSummary=archiveItems.length?appendArchive(root,archiveItems.map(x=>({
  win:x.win,proposals:[x.row],cutoff:x.cutoff
 })),db.results,{checkedAt:now}):{added:0,duplicates:0,skippedPublished:0};
 requireTrue(!archiveSummary.rejected,'archive rejected candidate');
 const archivedIds=archiveItems.map(x=>recordId(x.row));
 requireTrue(archiveSummary.added+archiveSummary.duplicates===archiveItems.length,
  'not every eligible attendance was recorded: '+JSON.stringify(archiveSummary));
 if(resolved.size){
  db.review.proposals=db.review.proposals.filter(x=>!resolved.has(x.id));
  db.review.manualReviewedAt=now;
  db.status.found=db.review.proposals.length;
  db.status.manualReviewCandidates=db.review.proposals.length;
  db.status.reviewOnlyCandidates=db.review.proposals.filter(x=>x.reviewOnly===true).length;
  db.status.lastReviewedBatchAt=now;
  db.status.message='直近確認候補4件を照合：EU予選突破1件を成績掲載、3件を参加確認アーカイブ。既存成績や未確認賞金を保持。';
  db.reviewed.reviewedAt=now;
 }
 if(resultsAdded.length||archiveSummary.added){
  const logId='verified-pending-publication-20261109-final';
  requireTrue(!db.updates.entries.some(x=>x.id===logId),'update log already exists');
  db.updates.entries.unshift({id:logId,date:new Date(Date.now()+9*3600000).toISOString().slice(0,10),
   type:'records',title:'確認待ちの公式照合成績と参加記録を追加',
   description:'EU Console ZB予選突破を成績へ、NAW/NAC Console ZBの通過圏外2件とNAW Inoxtag Cup1件を参加アーカイブへ。本人Epic ID・公式順位表・大会枠を確認し、未確認の賞金やスキン報酬を加算しない。',
   recordIds:resultsAdded,participationIds:archivedIds});
 }
 if(process.argv.includes('--dry-run')){
  console.log('AOT_PENDING_DRY_RUN '+JSON.stringify({resultsAdded,archivedIds,archiveSummary,remaining:db.review.proposals.length,already}));
  return;
 }
 for(const [name,obj] of Object.entries({'results.json':db.results,
   'auto-sync-review.json':db.review,'auto-sync-status.json':db.status,
   'history-sync-reviewed.json':db.reviewed,'approval-history.json':db.approvals,
   'updates.json':db.updates}))write(name,obj);
 console.log('AOT_PENDING_PUBLISHED '+JSON.stringify({resultsAdded,archivedIds,archiveSummary,
  recentRemaining:db.review.proposals.length,already,recordTotal:db.results.length}));
}
main();
