'use strict';
// Manual evidence-based review of previously queued ASIA ON TOUR results.
// Never claim a real payment, and never use round-one VRs as cash.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {sameScannedCandidate,verifiedPartialPage}=require('./verified-partial-page.cjs');
const {collision}=require('./manual-approval-core.cjs');
const {appendArchive,toParticipation,publishedEquivalent}=require('./participation-archive.cjs');
const {validateData}=require('./data-checks.cjs');
const root=path.resolve(__dirname,'..');
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const write=(p,j)=>fs.writeFileSync(path.join(root,p),JSON.stringify(j,null,2)+'\n');
const db={
 results:read('results.json'),players:read('players.json'),tournaments:read('tournaments.json'),
 review:read('history-sync-review.json'),scan:read('history-sync-scan.json'),
 reviewed:read('history-sync-reviewed.json'),ledger:read('approval-history.json'),
 status:read('history-sync-status.json'),updates:read('updates.json')
};
const RULES={
 S30:{'ch5s3-zb-solo-victory':{ME:2000},'ch5s3-solo-victory-cup':{NAC:5000}},
 S31:{'ch5s4-solo-victory-cup':{NAC:10000}},
 S32:{'ch5s5-solo-victory-cup':{ME:2000,NAC:10000}}
};
const RULE_URL={
 S30:'https://www.fortnite.com/news/fortnite-victory-cash-cups-chapter-5-season-3-official-rules',
 S31:'https://www.fortnite.com/news/fortnite-victory-cash-cups-chapter-5-season-4-official-rules',
 S32:'https://www.fortnite.com/news/competitive-details-make-your-mark-in-chapter-2-remix'
};
const TRI_RULE='https://www.fortnite.com/news/fortnite-trios-cash-cups-chapter-2-remix-official-rules';
const roster=x=>Array.isArray(x.players)&&x.players.length?x.players:[x.player];
const cat=new Map(db.tournaments.catalog.map(x=>[x.id,x]));
const known=new Set(db.players.candidates.map(x=>x.name));
const aliases=db.players.confirmedAliases||{};
const presentIds=new Set(db.results.map(x=>x.id));
const reviewedIds=new Set(db.reviewed.entries.map(x=>x.id));
const ledgerIds=new Set(db.ledger.entries.map(x=>x.id));
const calendarCache=new Map();
const targeted=db.review.proposals.filter(row=>['S30','S31','S32','S36','S41'].includes(row.seasonId));
if(!targeted.length){
 console.log('REVIEW_NEXT_20261112 '+JSON.stringify({original:0,published:0,archived:0,held:0,message:'Current candidates already resolved'}));process.exit(0);
}
const now=new Date().toISOString(),day=new Date(Date.now()+9*3600000).toISOString().slice(0,10);
const published=[],archived=[],held=[];
function ensure(ok,msg){if(!ok)throw Error(msg);}
function verify(row){
 ensure(row.verified===true&&/^auto-s\d+-[a-f0-9]{12}$/.test(row.id),'invalid verified candidate ID');
 ensure(!presentIds.has(row.id)&&!reviewedIds.has(row.id)&&!ledgerIds.has(row.id),'already registered or adjudicated ID');
 const tournament=cat.get(row.tournamentId);
 ensure(tournament&&tournament.seasonId===row.seasonId&&tournament.name===row.event,'tournament catalog mismatch');
 const people=roster(row),teamSize={solo:1,duo:2,trio:3,squad:4}[tournament.team];
 ensure(teamSize&&people.length===teamSize&&new Set(people).size===teamSize&&people.every(p=>known.has(p)),'team member identity not confirmed');
 ensure(row.player===people.join(' / '),'team display/roster mismatch');
 for(const field of ['rank','points','kills','vrs','matches'])
  ensure(Number.isSafeInteger(row[field])&&row[field]>=(field==='rank'||field==='matches'?1:0),'invalid '+field);
 ensure(row.vrs<=row.matches,'wins over games');
 if(people.length>1){
  // A historic, no-reward cosmetic attendance record may lack per-member
  // IDs in the preserved snapshot; an exact immutable Epic-ID-linked row,
  // known roster and full original-source matching are still required.
  const attendanceOnly=row.tournamentId==='ch7s3-champion-aphrodite-fncs-cup-battle-royale'&&
    row.kind==='参加確認'&&row.prize===null&&row.date==='2026-07-31'&&row.region==='OCE';
  if(!attendanceOnly||row.teamAccountIds!=null){
   ensure(row.teamAccountIds?.length===people.length,'missing verified Epic team account IDs');
   ensure(new Set(row.teamAccountIds).size===people.length,'duplicate team account IDs');
  }
 }
 const u=new URL(row.source);
 ensure(u.protocol==='https:'&&u.hostname==='www.fortnite.com'&&!u.username&&!u.password&&!u.hash,'untrusted source URL');
 const event=u.pathname.split('/').filter(Boolean).at(-1),winId=u.searchParams.get('round');
 ensure(tournament.sourceEventIds.includes(event)&&winId&&winId.startsWith(row.seasonId+'_')&&winId.endsWith('_'+row.region)&&u.searchParams.get('region')===row.region,'official event ID/round mismatch');
 const month=row.date.slice(0,7);
 if(!calendarCache.has(month))calendarCache.set(month,read('calendar-history/'+month+'.json').sessions);
 const sessions=calendarCache.get(month).filter(x=>x.url===row.source&&x.dateJst===row.date&&x.region===row.region&&x.seasonId===row.seasonId&&x.eventId===event&&x.sourceWindowId===winId&&x.tournamentId===row.tournamentId);
 ensure(sessions.length===1,'calendar session not uniquely verified');
 const session=sessions[0],key='epicgames_'+event+'_'+row.region+'/'+winId;
 const checkpoint=db.scan.windows[key];
 ensure(checkpoint&&checkpoint.rankingOrderValid===true&&checkpoint.nextPage>0&&checkpoint.pages===checkpoint.nextPage&&checkpoint.lastSeenRank>=row.rank,'incomplete original rank verification');
 ensure(checkpoint.proposals.filter(x=>x.id===row.id&&sameScannedCandidate(row,x)).length===1,'saved Epic ID and values do not match candidate');
 ensure(checkpoint.complete===true||verifiedPartialPage(row,{end:Date.parse(session.endUtc)},checkpoint),'partial leaderboard not mature or not continuous');
 ensure(!db.results.some(x=>collision(x,row,aliases)),'possible duplicate of published result');
 ensure(!published.some(x=>collision(x.record,row,aliases)),'possible duplicate in same batch');
 return {tournament,session,event,winId};
}
for(const row of targeted){
 try{
  const {tournament,session,event,winId}=verify(row);
  let rec=null,policy=null,rule=null;
  if(row.kind==='予選'){
   const cutoff=RULES[row.seasonId]?.[row.tournamentId]?.[row.region];
   ensure(Number.isSafeInteger(cutoff)&&row.rank<=cutoff&&row.prize===0&&row.matches<=7,'qualifier cutoff/score not independently proven');
   ensure(/Round1_/i.test(winId)||/Round1/i.test(winId),'wrong qualifier round');
   const {reviewReason,reviewOnly,teamAccountIds,...base}=row;
   rule=RULE_URL[row.seasonId];
   rec={...base,round:row.round.replace(/\/\s*予選$/u,'/ 予選突破'),kind:'予選',prize:0,
    note:'保存済みEpic ID・公式大会開催枠・連続順位表で'+row.region+' '+row.rank+'位・'+row.points+'pt・'+row.kills+'K・'+row.vrs+'VRを確認。地域通過上位'+cutoff+'人以内につき予選突破。現金賞金$0。本人への賞金支払は主張しない。公式大会情報・規則: '+rule};
   policy='verified-qualifier';
  }else if(row.kind==='賞金決勝'){
   ensure(row.seasonId==='S32'&&row.tournamentId==='ch5s5-solo-victory-cup'&&row.region==='ME'&&row.date==='2024-11-09'&&winId==='S32_SoloVictoryCashCup_Event1Round2_ME','final not in verified S32 scope');
   ensure(row.vrs===1&&row.points===100&&row.matches<=3&&row.prize===null,'S32 $100/VR final evidence does not match');
   const {reviewReason,reviewOnly,teamAccountIds,...base}=row;
   rule=RULE_URL.S32;
   rec={...base,prize:100,
    note:'2024/11/9 ME Chapter 2 Remix Solo Victory Cup Event1決勝。本人Epic ID・保存済み公式順位表の1VR/100ptを照合。Epic公式大会案内の1VRにつき$100により規則上の獲得賞金$100。支払完了・最終受賞資格は未確認。根拠: '+rule};
   policy='verified-s32-final-100usd-vr';
  }else if(row.kind==='参加確認'&&row.seasonId==='S32'&&row.tournamentId==='ch5s5-trios-cash'&&row.date==='2024-11-15'&&row.region==='ME'){
   ensure(winId==='S32_TriosCashCup_Event3Round1_ME'&&row.matches<=10&&row.prize===null&&roster(row).length===3,'unverified Trios Round1');
   const {reviewReason,reviewOnly,teamAccountIds,...base}=row;
   rule=TRI_RULE;
   rec={...base,prize:0,kind:'参加確認',
    note:'2024/11/15 ME Trios Cash Cup Event3 Round1への出場と'+row.rank+'位・'+row.points+'pt・'+row.kills+'チームキル・'+row.vrs+'VRを本人Epic ID・保存済み順位表で確認。Round 1で現金賞金なし（$0）、決勝進出は未確認。公式規則: '+rule};
   policy='verified-trios-qualifier-participation-zero-cash';
  }else{
   ensure(row.kind==='参加確認'&&row.prize===null&&['S41','S36'].includes(row.seasonId),'unsupported award/participation');
   const win={dateJst:row.date,region:row.region,tournamentId:row.tournamentId,seasonId:row.seasonId,eventId:event,windowId:winId,round:row.round,kind:row.kind,series:tournament.series};
   const p=toParticipation(row,win,null);
   ensure(p,'unsafe participation conversion');
   ensure(!publishedEquivalent(p,db.results),'participation duplicate of published result');
   archived.push({row,win,record:p,policy:'verified-participation-only',source:row.source});continue;
  }
  ensure(rec&&rec.prize>=0&&rec.verified===true,'invalid converted result');
  ensure(!db.results.some(x=>collision(x,rec,aliases)),'converted result overlaps publication');
  published.push({row,record:rec,policy,rule});
 }catch(error){held.push({id:row.id,player:row.player,reason:String(error.message||error)})}
}
const approved=published.map(x=>x.record);
const verifyNext=validateData({results:[...db.results,...approved],players:db.players,tournaments:db.tournaments});
if(verifyNext.errors.length)throw Error('Full data validation failed: '+JSON.stringify(verifyNext.errors.slice(0,10)));
let archiveOutcome={added:0,rejected:0,duplicates:0};
if(archived.length){
 archiveOutcome=appendArchive(root,archived.map(x=>({win:x.win,proposals:[x.row],cutoff:null})),[...db.results,...approved],{checkedAt:now});
 ensure(archiveOutcome.rejected===0&&archiveOutcome.skippedPublished===0,'Participation archive rejected verified entries');
 // Avoid resolving a source item if it was not physically added or already present.
 ensure(archiveOutcome.added+archiveOutcome.duplicates===archived.length,'Participation archive result count mismatch');
}
db.results.push(...approved);
const resolved=[...published,...archived],doneIds=new Set(resolved.map(x=>x.row.id));
for(const x of published){
 db.reviewed.entries.push({id:x.row.id,decision:'published',recordId:x.record.id,reviewedAt:now,source:x.row.source,policy:x.policy,rule:x.rule});
 db.ledger.entries.push({id:x.row.id,decision:'published',recordId:x.record.id,approvedAt:now,source:x.row.source,policy:x.policy,rule:x.rule,
  approvedBy:'ChatGPT / user-requested source-backed review',
  evidence:'Exact linked Epic ID; official event/date; original observed leaderboard checkpoint (mature/continuous); season-specific cutoff or $100/VR rule; duplicate check'});
}
for(const x of archived)db.reviewed.entries.push({id:x.row.id,decision:'participation-archived',recordId:x.record.id,reviewedAt:now,source:x.row.source,policy:x.policy,
 note:'Exact Epic ID and mature official saved scoreboard; no monetary/cosmetic/qualification award inferred'});
ensure(new Set(db.reviewed.entries.map(x=>x.id)).size===db.reviewed.entries.length,'reviewed ledger duplicate IDs');
db.review.proposals=db.review.proposals.filter(x=>!doneIds.has(x.id));
const qualified=published.filter(x=>x.policy==='verified-qualifier').length;
const cash=published.filter(x=>x.policy==='verified-s32-final-100usd-vr').length;
const trios=published.filter(x=>x.policy==='verified-trios-qualifier-participation-zero-cash').length;
db.review.manualReviewedAt=now;
db.status.found=db.review.proposals.length;
db.status.manualReviewCandidates=db.review.proposals.length;
db.status.reviewOnlyCandidates=db.review.proposals.filter(x=>x.reviewOnly===true).length;
db.status.manuallyPublished=(db.status.manuallyPublished||0)+published.length;
db.status.lastReviewedBatchAt=now;
db.status.latestManualReview={
 reviewedAt:now,reviewedCandidates:targeted.length,published:published.length,
 verifiedQualifiers:qualified,verifiedCashFinals:cash,triosZeroCash:trios,
 participationArchived:archived.length,remainingPending:db.review.proposals.length,
 note:'Official event roster and matured saved rank; S30/S31/S32 cutoff from Epic/Fortnite Tracker published terms; S32 one VR $100; zero-cash Trios Round1'
};
db.status.message='確認待ちの原本再調査：賞金決勝'+cash+'件・予選突破'+qualified+'件・トリオ参加'+trios+'件・出場記録'+archived.length+'件を解決、保留'+db.review.proposals.length+'件。';
db.reviewed.reviewedAt=now;db.ledger.reviewedAt=now;
const id='manual-pending-batch-20261112-'+crypto.createHash('sha256').update([...doneIds].sort().join('|')).digest('hex').slice(0,12);
ensure(!db.updates.entries.some(x=>x.id===id),'duplicate update marker');
if(published.length)db.updates.entries.unshift({id,date:day,type:'records',title:'確認待ちの公式順位表を調査・正式掲載 '+published.length+'件',
 description:'2024年S30/S31/S32予選突破'+qualified+'件、S32決勝$100の1VR賞金'+cash+'件、Trios Cash Cup予選の0ドル出場成績'+trios+'件。本人Epic ID・大会開催枠・保存順位表・大会規則を照合。参加専用'+archived.length+'件は別管理で賞金計上せず。',
 recordIds:approved.map(x=>x.id)});
for(const [file,value] of [
 ['results.json',db.results],['history-sync-review.json',db.review],
 ['history-sync-reviewed.json',db.reviewed],['approval-history.json',db.ledger],
 ['history-sync-status.json',db.status],['updates.json',db.updates]
])write(file,value);
if(archived.length){
 const index=read('participation-index.json'),status=read('participation-status.json');
 status.total=index.total;status.lastManualReviewAt=now;
 status.manualReviewPublished=(status.manualReviewPublished||0)+archiveOutcome.added;
 status.message='賞金・報酬を認定しない本人確認済み出場記録 '+archiveOutcome.added+'件を追加';
 write('participation-status.json',status);
}
console.log('REVIEW_NEXT_20261112 '+JSON.stringify({
 total:targeted.length,published:published.length,qualified,cashFinals:cash,triosZeroCash:trios,
 participationArchived:archiveOutcome.added,pending:db.review.proposals.length,held,
 cashNames:published.filter(x=>x.policy==='verified-s32-final-100usd-vr').map(x=>x.record.player)
}));
