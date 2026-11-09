'use strict';
// Complete Epic event leaderboard audit for 2024 ME S30 Solo/ZB Victory Cash Finals.
// Six duplicate Lady Liberty Cup skin records are closed only if all original
// statistics match exactly. Cash prizes are NOT claimed from incomplete pages.
const fs=require('node:fs'),path=require('node:path');
const {getLeaderboard,normalizeRow,linkedAccounts}=require('./osirion-sync.cjs');
const {sameScannedCandidate}=require('./verified-partial-page.cjs');
const {collision}=require('./manual-approval-core.cjs');
const root=path.resolve(__dirname,'..');
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const write=(p,v)=>fs.writeFileSync(path.join(root,p),JSON.stringify(v,null,2)+'\n');
const check=(x,msg)=>{if(!x)throw Error('S30_20261110_UNVERIFIED: '+msg)};
const VICTORY_RULES='https://www.fortnite.com/news/fortnite-victory-cash-cups-chapter-5-season-3-official-rules';
const dupIds=new Set(['auto-s42-cd980b09cda6','auto-s42-22d2f1862036','auto-s42-20c7163112b6',
 'auto-s42-78aba2a9c1af','auto-s42-7db0f2c7b39d','auto-s42-a89e05ac2219']);
const cashIds=new Set(['auto-s30-98626046a964','auto-s30-911390d99438','auto-s30-3077f2edac3c',
 'auto-s30-703ca9b45d37','auto-s30-d7214dc238d1','auto-s30-92d43aa93584',
 'auto-s30-5cedf005448b','auto-s30-ea85f980987c']);
const events=['S30_SoloVictoryCashCup','S30_SoloZBVictoryCashCup'];
const roster=r=>Array.isArray(r.players)&&r.players.length?r.players:[r.player];
const sameScore=(a,b)=>['date','region','player','rank','points','kills','vrs'].every(k=>a[k]===b[k])&&
 roster(a).join('|')===roster(b).join('|');
function verifyDuplicates(db){
 const report=[],resolved=[];
 for(const p of db.review.proposals.filter(p=>dupIds.has(p.id))){
  const matches=db.results.filter(r=>collision(r,p,db.players.confirmedAliases));
  if(matches.length!==1){report.push({id:p.id,reason:'multiple or no public equivalents'});continue}
  const existing=matches[0],u=new URL(p.source);
  const tracker='https://fortnitetracker.com/events/epicgames_S42_PurgeCup_OCE';
  if(!sameScore(existing,p)||existing.kind!=='スキン大会'||existing.prize!==0||
     existing.source!==tracker||p.event!=='Lady Liberty Cup Battle Royale'||
     p.date!=='2026-10-17'||p.region!=='OCE'||u.searchParams.get('round')!=='S42_PurgeCup_OCE'||
     (existing.matches!==undefined&&existing.matches!==p.matches)){
    report.push({id:p.id,reason:'existing skin record does not exactly match official candidate'});
    continue;
  }
  const cp=db.historyScan.windows['epicgames_S42_PurgeCup_OCE/S42_PurgeCup_OCE'];
  if(!cp?.proposals?.some(x=>sameScannedCandidate(x,p))||cp.rankingOrderValid!==true){
    report.push({id:p.id,reason:'no trusted saved Epic candidate for skin identity'});
    continue;
  }
  resolved.push({id:p.id,existingId:existing.id,player:p.player});
 }
 return {resolved,held:report};
}
async function fullEvent(eventId,expected,totalExpected,linked,db){
 const windowId=eventId+'_Event1Round2_ME';
 const key='epicgames_'+eventId+'_ME/'+windowId;
 const cp=db.historyScan.windows[key];
 check(cp&&cp.rankingOrderValid===true&&cp.lastSeenRank>=Math.max(...expected.map(x=>x.rank))&&
    cp.nextPage>=2&&cp.totalPages===totalExpected&&cp.epicIdsRetained===true&&
    !cp.lastErrorCode&&!cp.lastError&&!cp.retryAfter,'old checkpoint invalid: '+eventId);
 const linkedByName=new Map();
 for(const x of linked){if(!linkedByName.has(x.player))linkedByName.set(x.player,new Set());linkedByName.get(x.player).add(x.epicAccountId)}
 for(const p of expected){
  check(p.verified===true&&p.kind==='賞金決勝'&&p.prize===null&&p.vrs===1&&p.points===100&&
    p.matches>=1&&p.matches<=3&&p.date==='2024-06-04'&&p.region==='ME'&&
    p.round==='Event 1 · Round 2 / 賞金決勝'&&
    p.source==='https://www.fortnite.com/competitive/events/'+eventId+'/?region=ME&round='+windowId,
   'candidate invalid '+p.id);
  check(cp.proposals.some(x=>sameScannedCandidate(x,p)),'original ranking is missing '+p.id);
  check(linkedByName.get(p.player)?.size,'no verified Epic identity for '+p.id);
 }
 const cal=read('calendar-history/2024-06.json').sessions.filter(s=>
  s.eventId===eventId&&s.sourceWindowId===windowId&&s.dateJst==='2024-06-04'&&s.region==='ME');
 check(cal.length===1,'ambiguous official date/time: '+eventId);
 const win={key,fullEventId:'epicgames_'+eventId+'_ME',eventId,windowId,region:'ME'};
 const found=new Map(),visited=new Set();let total=0,lastRank=0;
 for(let page=0;page<totalExpected;page++){
  const res=await getLeaderboard(win,page);
  check(res.totalPages===totalExpected,'provider page count changed at '+eventId+' / '+page);
  check(Array.isArray(res.entries)&&res.entries.length>0,'empty provider page '+eventId+' / '+page);
  for(const e of res.entries){
   check(Number.isSafeInteger(e.rank)&&e.rank>=lastRank,'non-monotonic rank at page '+page);
   lastRank=e.rank;total++;
   const n=normalizeRow(e,win);
   if(!n?.teamAccountIds||n.teamAccountIds.length!==1)continue;
   const id=n.teamAccountIds[0];
   for(const p of expected){
    if(!linkedByName.get(p.player)?.has(id))continue;
    check(!found.has(p.id),'same Epic account found twice on leaderboard '+p.id);
    check(n.points===p.points&&n.vrs===p.vrs&&n.kills===p.kills&&n.matches===p.matches,
      'live stats do not match original verified candidate '+p.id);
    check(Math.abs(e.rank-p.rank)<=3,'leaderboard rank moved beyond small tie threshold '+p.id);
    found.set(p.id,{id,rank:e.rank,points:n.points,kills:n.kills,vrs:n.vrs,matches:n.matches});
    visited.add(id);
   }
  }
 }
 check(total>=totalExpected*25&&found.size===expected.length,'incomplete original leaderboard: '+eventId+
  ' found '+found.size+' of '+expected.length+' across '+total+' rows');
 return {eventId,windowId,pages:totalExpected,rowsChecked:total,found};
}
async function main(){
 const db={results:read('results.json'),players:read('players.json'),tournaments:read('tournaments.json'),
  updates:read('updates.json'),review:read('history-sync-review.json'),
  status:read('history-sync-status.json'),reviewed:read('history-sync-reviewed.json'),
  historyScan:read('history-sync-scan.json')};
 const now=new Date().toISOString();
 const duplicates=verifyDuplicates(db);
 const toVerify=db.review.proposals.filter(p=>cashIds.has(p.id));
 const grouped=new Map(events.map(x=>[x,toVerify.filter(p=>new URL(p.source).pathname.includes(x+'/'))]));
 const link=linkedAccounts({results:db.results,players:db.players}).accounts;
 const summaries=[],deferred=[],newResults=[],newSeen=new Set(db.results.map(x=>x.id));
 for(const [eventId,rows] of grouped){
  if(!rows.length)continue;
  try{
   const targetCount=eventId==='S30_SoloVictoryCashCup'?2:6;
   check(rows.length===targetCount,'target group shrank or grew: '+eventId);
   const all=await fullEvent(eventId,rows,eventId==='S30_SoloVictoryCashCup'?19:18,link,db);
   const cat=db.tournaments.catalog.find(x=>x.sourceEventIds?.includes(eventId)&&x.seasonId==='S30');
   check(cat&&cat.team==='solo'&&cat.series==='victory-cup','official tournament catalog mismatch');
   for(const p of rows){
    const live=all.found.get(p.id);
    check(live&&live.vrs===1,'winner proof absent '+p.id);
    check(!newSeen.has(p.id),'record already published '+p.id);
    const coll=db.results.filter(x=>collision(x,p,db.players.confirmedAliases));
    check(coll.length===0,'another public result with same identity and window '+p.id);
    const {reviewReason,reviewOnly,teamAccountIds,note,...clean}=p;
    const row={...clean,rank:live.rank,prize:100,kind:'賞金決勝',
      note:'2024-06-04 ME賞金決勝：Epic順位表の全'+all.pages+'ページを再取得し本人Epic IDと1VR、キル・試合数を一致確認。'
        +'公式ルールRound2は1VRにつき$100。支払完了は未検証。公式規則: '+VICTORY_RULES};
    newResults.push(row);newSeen.add(row.id);
   }
   summaries.push({eventId,pages:all.pages,rows:all.rowsChecked,verified:rows.length});
  }catch(e){
   deferred.push({eventId,reason:String(e.message||e).slice(0,320),candidates:rows.length});
  }
 }
 const resolvedIds=new Set([...duplicates.resolved.map(x=>x.id),...newResults.map(x=>x.id)]);
 const report={matchedExistingSkin:duplicates.resolved.length,skinConflictHeld:duplicates.held,
  finalsPublished:newResults.length,fullScans:summaries,finalsDeferred:deferred,
  remainingHistory:db.review.proposals.length-resolvedIds.size,cashAdded:newResults.length*100};
 console.log('AOT_S30_FINAL_REVIEW '+JSON.stringify(report));
 if(process.argv.includes('--dry-run')||!resolvedIds.size)return;
 const existingReviewed=new Set(db.reviewed.entries.map(x=>x.id));
 for(const item of duplicates.resolved){
  check(!existingReviewed.has(item.id),'duplicate review ledger '+item.id);
  db.reviewed.entries.push({id:item.id,decision:'already-published',existingId:item.existingId,
   reviewedAt:now,policy:'exact-epic-ranked-skin-collision',source:'https://www.fortnite.com/competitive/events/S42_PurgeCup/?region=OCE&round=S42_PurgeCup_OCE',
   evidence:'Same name/date/region/event/rank/points/kills/VR as previously published Lady Liberty skin result'});
  existingReviewed.add(item.id);
 }
 for(const row of newResults){
  check(!existingReviewed.has(row.id),'already-reviewed final '+row.id);
  db.reviewed.entries.push({id:row.id,recordId:row.id,decision:'published',
   reviewedAt:now,policy:'complete-live-epic-leaderboard-plus-official-1-vr-payout',
   approvedBy:'ChatGPT full round 2 leaderboard audit Nov 10, 2026',
   officialRules:VICTORY_RULES,source:row.source,
   evidence:'Each page of ME 2024 S30 leaderboard retrieved in ranking order; Epic ID and 1VR/per-game scores verified'});
  existingReviewed.add(row.id);
 }
 if(newResults.length){
  const updateId='s30-me-full-round2-verified-20261110';
  check(!db.updates.entries.some(x=>x.id===updateId),'duplicate update announcement');
  db.results.push(...newResults);
  db.updates.entries.unshift({id:updateId,date:new Date(Date.now()+9*3600000).toISOString().slice(0,10),
   type:'records',title:'2024年6月 ME賞金決勝 全順位表照合'+newResults.length+'件',
   description:'Epic公式順位表を全ページ再確認し、本人Epic ID・1VR・公式$100賞金規則と照合。未確認の受給資格・支払完了は確定していない。',
   recordIds:newResults.map(x=>x.id)});
 }
 db.review.proposals=db.review.proposals.filter(p=>!resolvedIds.has(p.id));
 db.review.manualReviewedAt=now;
 db.status.found=db.review.proposals.length;
 db.status.manualReviewCandidates=db.review.proposals.length;
 db.status.reviewOnlyCandidates=db.review.proposals.filter(p=>p.reviewOnly).length;
 db.status.lastReviewedBatchAt=now;
 db.status.message='旧大会精査：Lady Liberty重複'+duplicates.resolved.length+'件整理、S30賞金決勝'+
  newResults.length+'件を全ページ再取得で掲載、保留'+db.review.proposals.length+'件。';
 db.reviewed.reviewedAt=now;
 for(const [file,value] of Object.entries({
  'results.json':db.results,'updates.json':db.updates,
  'history-sync-review.json':db.review,'history-sync-status.json':db.status,
  'history-sync-reviewed.json':db.reviewed}))write(file,value);
 console.log('AOT_S30_FINAL_PUBLISHED '+JSON.stringify(report));
}
main().catch(e=>{console.error('AOT_S30_FINAL_ERROR '+(e.stack||e));process.exitCode=1});
