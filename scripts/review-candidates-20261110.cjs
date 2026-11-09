'use strict';
/*
 * Source-evidence-gated, one-shot review of pending ASIA ON TOUR candidates.
 * Never infer cash. A partial leaderboard can prove an Epic-ID-linked rank
 * already traversed, but cannot prove unscanned awards or season qualification.
 */
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const {sameScannedCandidate,verifiedPartialPage}=require('./verified-partial-page.cjs');
const {collision}=require('./manual-approval-core.cjs');
const {linkedAccounts}=require('./osirion-sync.cjs');
const {appendArchive,recordId,publishedEquivalent}=require('./participation-archive.cjs');
const RULE='https://www.fortnite.com/competitive/rules-guidelines/rules-library/fortnite-victory-cups-chapter-7-season-4-official-rules';
const read=name=>JSON.parse(fs.readFileSync(path.join(root,name),'utf8'));
const write=(name,obj)=>fs.writeFileSync(path.join(root,name),JSON.stringify(obj,null,2)+'\n');
const assert=(pass,reason)=>{if(!pass)throw Error('AOT_REVIEW_20261110: '+reason)};
const lineup=p=>Array.isArray(p.players)&&p.players.length?p.players:[p.player];
const columns=['rank','points','kills','vrs','matches'];
const scoreSame=(a,b)=>['date','region','tournamentId','rank','points','kills','vrs','matches'].every(k=>a[k]===b[k])&&lineup(a).join('|')===lineup(b).join('|');
const RULE_KEY='ch7s4-console-zero-build-solo-victory-cup';
const logId='candidate-evidence-batch-20261110';
function processAll(){
 const db={
  players:read('players.json'),tournaments:read('tournaments.json'),results:read('results.json'),
  updates:read('updates.json'),reviewed:read('history-sync-reviewed.json'),
  review:{auto:read('auto-sync-review.json'),history:read('history-sync-review.json')},
  status:{auto:read('auto-sync-status.json'),history:read('history-sync-status.json')},
  scans:{auto:read('auto-sync-scan.json'),history:read('history-sync-scan.json')}
 };
 const known=new Set(db.players.candidates.map(p=>p.name));
 const linked=linkedAccounts({players:db.players,results:db.results});
 assert(linked.accounts.length>=400,'linked Epic account inventory unexpectedly small');
 const accountMap=new Map(linked.accounts.map(x=>[x.epicAccountId,x.player]));
 const masters=new Map(db.tournaments.catalog.map(x=>[x.id,x]));
 const dates=new Map();
 const readCalendar=month=>{
  if(!dates.has(month)){
   const file='calendar-history/'+month+'.json';
   dates.set(month,fs.existsSync(path.join(root,file))?read(file).sessions:[]);
  }
  return dates.get(month);
 };
 const recentlyPublished=new Set(db.results.map(x=>x.id));
 const adjudicated=new Set(db.reviewed.entries.map(x=>x.id));
 const existingArchive=new Map();
 for(const file of fs.readdirSync(path.join(root,'participation')).filter(n=>/^\d{4}-\d{2}\.json$/.test(n)))
  for(const rec of read('participation/'+file).entries)existingArchive.set(rec.id,rec);
 const queue=new Map();
 for(const scope of ['auto','history'])for(const p of db.review[scope].proposals){
  if(queue.has(p.id)){
   const q=queue.get(p.id);
   if(!sameScannedCandidate(q.p,p)){q.conflict=true;continue}
   q.scopes.push(scope);
  }else queue.set(p.id,{p,scopes:[scope],conflict:false});
 }
 const planned=[],held=[],resolved=new Set(),toPublish=[],toArchive=[],dupes=[];
 const now=new Date().toISOString();
 const checkCandidate=(p,scopes)=>{
  assert(/^auto-s\d+-[a-f0-9]{12}$/.test(p.id)&&p.verified===true,'unverified candidate id');
  assert(/^\d{4}-\d{2}-\d{2}$/.test(p.date)&&['EU','NAC','NAW','OCE','ME','BR'].includes(p.region),'date/region');
  assert(columns.every(k=>Number.isSafeInteger(p[k])&&p[k]>=(k==='rank'||k==='matches'?1:0))&&p.vrs<=p.matches,'numeric score');
  const cat=masters.get(p.tournamentId);
  assert(cat&&cat.name===p.event&&cat.seasonId===p.seasonId&&cat.sourceEventIds?.length,'catalog/event');
  const roster=lineup(p),size={solo:1,duo:2,trio:3,squad:4}[cat.team];
  assert(size===roster.length&&new Set(roster).size===size&&p.player===roster.join(' / ')&&roster.every(n=>known.has(n)),'unlinked player/team');
  if(p.teamAccountIds){
   assert(p.teamAccountIds.length===size&&p.teamAccountIds.every((id,i)=>accountMap.get(id)===roster[i]),'Epic account roster mismatch');
  }
  const src=new URL(p.source);
  assert(src.protocol==='https:'&&src.hostname==='www.fortnite.com'&&
    /^\/competitive\/events\/[^/]+\/$/.test(src.pathname)&&!src.username&&!src.password&&!src.hash&&
    src.searchParams.get('region')===p.region,'official source URL');
  const eventId=decodeURIComponent(src.pathname.split('/')[3]),windowId=src.searchParams.get('round');
  assert(cat.sourceEventIds.includes(eventId)&&windowId?.startsWith(p.seasonId+'_')&&windowId.endsWith('_'+p.region),'source event mismatch');
  const cal=readCalendar(p.date.slice(0,7)).filter(s=>
   s.sourceWindowId===windowId&&s.eventId===eventId&&s.region===p.region&&
   s.tournamentId===p.tournamentId&&s.dateJst===p.date&&s.seasonId===p.seasonId);
  assert(cal.length===1&&Number.isFinite(Date.parse(cal[0].endUtc)),'official calendar session not unique');
  const key='epicgames_'+eventId+'_'+p.region+'/'+windowId;
  const found=scopes.map(scope=>db.scans[scope].windows?.[key]).filter(Boolean);
  assert(found.length,'saved provider checkpoint missing');
  const cp=found.filter(x=>Array.isArray(x.proposals)&&x.proposals.some(r=>sameScannedCandidate(r,p)))
    .sort((a,b)=>Number(b.complete)-Number(a.complete)||(b.nextPage||0)-(a.nextPage||0))[0];
  assert(cp,'candidate differs from original Epic/Osirion evidence');
  assert(cp.rankingOrderValid===true&&cp.nextPage>=1&&cp.pages>=1&&
    Number.isSafeInteger(cp.lastSeenRank)&&cp.lastSeenRank>=p.rank&&
    !cp.lastErrorCode&&!cp.lastError&&!cp.retryAfter&&!cp.emptyAttempts,'incomplete/malformed or reordered observed page');
  if(cp.complete){
   assert(!cp.coverageLimited&&cp.nextPage>=cp.totalPages,'complete ranking marker contradictory');
  }else{
   assert(verifiedPartialPage(p,{end:Date.parse(cal[0].endUtc)},cp,Date.now()),
    'partial leaderboard not yet certified continuous/mature');
  }
  const cutoff=['EU','NAC'].includes(p.region)?2000:1000;
  const isConsole=p.tournamentId===RULE_KEY&&p.seasonId==='S42'&&p.kind==='予選'&&
    p.round==='Event 8 · Round 1 / 予選'&&
    windowId==='S42_ConsoleVCC_SolosZB_Event8Round1_'+p.region&&cat.team==='solo'&&p.prize===0&&p.matches<=8;
  const qualifying=isConsole&&p.rank<=cutoff;
  return {cat,cal:cal[0],eventId,windowId,key,cp,cutoff,isConsole,qualifying};
 };
 for(const {p,scopes,conflict} of queue.values()){
  if(conflict){held.push({id:p.id,reason:'review copies disagree'});continue}
  if(recentlyPublished.has(p.id)||adjudicated.has(p.id)){
   resolved.add(p.id);dupes.push({id:p.id,reason:'already adjudicated'});continue;
  }
  let x;try{x=checkCandidate(p,scopes)}catch(e){held.push({id:p.id,player:p.player,reason:String(e.message)});continue}
  const conflicts=db.results.filter(r=>collision(r,p,db.players.confirmedAliases));
  if(conflicts.length){
   if(conflicts.length===1&&scoreSame(conflicts[0],p)){
    resolved.add(p.id);dupes.push({id:p.id,reason:'identical official appearance',existingId:conflicts[0].id});
    if(!adjudicated.has(p.id)){
     db.reviewed.entries.push({id:p.id,decision:'already-published',existingId:conflicts[0].id,
      reviewedAt:now,source:p.source,policy:'score-and-session-equivalence'});
     adjudicated.add(p.id);
    }
   }else held.push({id:p.id,player:p.player,reason:'conflicting published team/session/score'});
   continue;
  }
  if(x.qualifying){
   const {reviewOnly,reviewReason,teamAccountIds,...clean}=p;
   const result={...clean,round:'Event 8 · Round 1 / 予選突破',prize:0,kind:'予選',
    note:'確認済みEpic本人ID・公式日時・順位表連続ページを照合。Console ZB Solo VC予選'+p.rank+'位、'+
      p.region+'公式上位'+x.cutoff+'位以内で予選通過、Round 1賞金$0。試合数'+p.matches+
      '、キル'+p.kills+'、VR'+p.vrs+'。出典規則: '+RULE};
   if(p.reviewOnly===true){held.push({id:p.id,reason:'qualified row marked review-only'});continue}
   const collision2=db.results.filter(r=>collision(r,result,db.players.confirmedAliases));
   if(collision2.length){held.push({id:p.id,reason:'qualified record conflicts with another row'});continue}
   db.results.push(result);recentlyPublished.add(result.id);
   toPublish.push({id:p.id,player:p.player,region:p.region,rank:p.rank});
   planned.push({id:p.id,action:'qualified'});
   resolved.add(p.id);
  }else if(p.kind==='予選'||p.kind==='参加確認'){
   const win={...x.cal,eventId:x.eventId,windowId:x.windowId,
    kind:p.kind==='予選'?'予選':'参加確認',round:p.round,
    series:x.cat.series};
   // Only this season's console region-specific cutoff is official here.
   const cutoff=x.isConsole?x.cutoff:null;
   const id=recordId(p);
   const archived=existingArchive.get(id);
   if(archived){
    if(scoreSame(archived,p)&&archived.source===p.source){
     resolved.add(p.id);dupes.push({id:p.id,reason:'already archived',recordId:id});
    }else held.push({id:p.id,reason:'different existing participation stats'});
    continue;
   }
   if(publishedEquivalent(p,db.results)){
    held.push({id:p.id,reason:'already a published identity with different round/alias'});continue;
   }
   toArchive.push({p,win,cutoff,recordId:id});
   planned.push({id:p.id,action:'participation',player:p.player,region:p.region,rank:p.rank});
   resolved.add(p.id);
  }else held.push({id:p.id,reason:'award/final verification not complete'});
 }
 const result={processed:queue.size,published:toPublish.length,archived:toArchive.length,
  duplicates:dupes.length,held:held.length,remaining:held.length,qualified:toPublish,
  archivedPreview:toArchive.slice(0,10).map(x=>({id:x.p.id,player:x.p.player,region:x.p.region,rank:x.p.rank})),
  heldReasons:held.reduce((m,x)=>(m[x.reason]=(m[x.reason]||0)+1,m),{}),heldSample:held.slice(0,20)};
 console.log('AOT_20261110_PLAN '+JSON.stringify(result));
 if(process.argv.includes('--audit'))return;
 if(!resolved.size){console.log('AOT_20261110_NO_CHANGES');return}
 const saved=appendArchive(root,toArchive.map(x=>({win:x.win,cutoff:x.cutoff,proposals:[x.p]})),
  db.results,{checkedAt:now});
 assert(saved.rejected===0&&saved.added+saved.duplicates+saved.skippedPublished===toArchive.length,
  'archive rejected or silently skipped an eligible row '+JSON.stringify(saved));
 const jsDate=new Date(Date.now()+9*3600000).toISOString().slice(0,10);
 if(toPublish.length){
  const id=logId+'-results';
  assert(!db.updates.entries.some(x=>x.id===id),'duplicate publication announcement');
  db.updates.entries.unshift({id,date:jsDate,type:'records',title:'公式照合済みConsole ZB予選突破'+toPublish.length+'戦績',
   description:'2026/10/24-25のEU・ME等のConsole Zero Build Solo Victory Cup予選をEpic ID・保存済み順位表・公式通過人数で照合。予選Round 1賞金$0。重複と通過圏外を除外。',
   recordIds:toPublish.map(x=>x.id)});
 }
 if(saved.added){
  // Participation announcements must refer to one month, so navigation opens
  // the correct month and the existing updates validator can check every ID.
  const months=new Map();
  for(const item of toArchive){
   const month=item.p.date.slice(0,7);
   if(!months.has(month))months.set(month,[]);
   months.get(month).push(item);
  }
  for(const [month,items] of months){
   const id=logId+'-attendance-'+month;
   assert(!db.updates.entries.some(x=>x.id===id),'duplicate archive announcement');
   db.updates.entries.unshift({id,date:jsDate,type:'participation',recordIds:[],
    participationMonth:month,
    title:month+'の確認済み予選敗退・出場'+items.length+'件をアーカイブに追加',
    description:'保存済みEpic順位表・公式開催枠・本人IDを検証。予選突破・現金賞金・スキン報酬は推定していません。',
    participationIds:items.map(x=>x.recordId),participantTeams:items.map(x=>x.p.player)});
  }
 }
 for(const entry of [...toPublish.map(x=>({id:x.id,recordId:x.id,decision:'published'})),
                    ...toArchive.map(x=>({id:x.p.id,recordId:x.recordId,decision:'participation-archived'}))]){
  assert(!adjudicated.has(entry.id),'review ledger duplication');
  db.reviewed.entries.push({...entry,reviewedAt:now,
   policy:entry.decision==='published'?'official-region-top-cutoff':'Epic-evidenced-attendance-only',
   approvedBy:'ChatGPT user-authorized verified publication',source:queue.get(entry.id).p.source,
   officialRules:entry.decision==='published'?RULE:null,
   evidence:'Exact saved ranked page checkpoint, original player ID, calendar window and no duplicated public record'});
  adjudicated.add(entry.id);
 }
 for(const scope of ['auto','history']){
  const obj=db.review[scope],status=db.status[scope];
  obj.proposals=obj.proposals.filter(x=>!resolved.has(x.id));
  obj.manualReviewedAt=now;status.found=obj.proposals.length;
  status.manualReviewCandidates=obj.proposals.length;
  status.reviewOnlyCandidates=obj.proposals.filter(x=>x.reviewOnly).length;
  status.lastReviewedBatchAt=now;
  status.message='検証済み確認待ち一括処理：予選突破'+toPublish.length+
   '件、参加記録'+saved.added+'件、既存重複解消'+dupes.length+
   '件。未確認は保留'+obj.proposals.length+'件。賞金は推定しない。';
 }
 db.reviewed.reviewedAt=now;
 const out={'results.json':db.results,'updates.json':db.updates,
 'auto-sync-review.json':db.review.auto,'history-sync-review.json':db.review.history,
 'auto-sync-status.json':db.status.auto,'history-sync-status.json':db.status.history,
 'history-sync-reviewed.json':db.reviewed};
 for(const [name,value] of Object.entries(out))write(name,value);
 console.log('AOT_20261110_PUBLISHED '+JSON.stringify({...result,saved,
  remainingRecent:db.review.auto.proposals.length,remainingHistory:db.review.history.proposals.length,
  totalRecords:db.results.length}));
}
processAll();
