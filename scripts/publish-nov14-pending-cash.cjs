'use strict';
// User-authorized, idempotent publication of TWO individually corroborated cash candidates.
const fs=require('node:fs'),path=require('node:path');
const {loadReviewDb,writeReviewDb,upsertPublicationLog}=require('./reviewed-publication-core.cjs');
const {validateOriginal,collision}=require('./manual-approval-core.cjs');
const {sameScannedCandidate,verifiedPartialPage}=require('./verified-partial-page.cjs');
const {validateData,personalCents,roster}=require('./data-checks.cjs');
const {audit}=require('./validate-approvals.cjs');
const {validateUpdateLog}=require('./validate-updates.cjs');
const V=require('./verified-nov14-pending-cash.cjs');
const ROOT=path.resolve(__dirname,'..'),args=process.argv.slice(2);
const dry=args.includes('--dry-run');
if(!(args.length===0||(args.length===1&&dry)))throw Error('Only --dry-run or no arguments allowed');
const fail=(ok,msg)=>{if(!ok)throw Error('NOV14_PENDING_CASH: '+msg)};
const db=loadReviewDb(ROOT);
db.reviewed=JSON.parse(fs.readFileSync(path.join(ROOT,'history-sync-reviewed.json'),'utf8'));
const catalog=new Map(db.tournaments.catalog.map(x=>[x.id,x]));
const now=new Date().toISOString();
const existsId=new Set(db.results.map(x=>x.id));
const ledgerIds=new Set(db.ledger.entries.map(x=>x.id));
const done=new Set(db.reviewed.entries.map(x=>x.id));
const added=[],already=[];
function readMonth(month){return JSON.parse(fs.readFileSync(path.join(ROOT,'calendar-history',month+'.json'),'utf8'))}
function cashTotal(rows){return rows.reduce((n,r)=>n+Math.round((r.prize||0)*100),0)}
function personalTotal(rows){return rows.reduce((n,r)=>n+personalCents(r)*roster(r).length,0)}
const before={count:db.results.length,cash:cashTotal(db.results),personal:personalTotal(db.results)};
for(const t of V.TARGETS){
 let original=null,origin=null;
 for(const key of ['auto','history']){
  const a=db.reviews[key].proposals.filter(x=>x.id===t.id);
  fail(a.length<=1,'duplicate candidate in scope '+key);
  if(a.length){
   if(original)fail(sameScannedCandidate(original,a[0]),'two scopes differ '+t.id);
   original=a[0];origin=key;
  }
 }
 if(!original){
  const previous=db.results.find(x=>x.id===t.id),entry=db.ledger.entries.find(x=>x.id===t.id);
  fail(previous&&entry&&V.verifiedCashRow(previous,entry)&&done.has(t.id),
   'previously published candidate changed or disappeared: '+t.id);
  already.push(t.id);continue;
 }
 fail(!existsId.has(t.id)&&!ledgerIds.has(t.id)&&!done.has(t.id),'already approved candidate still in queue '+t.id);
 fail(original.verified===true&&V.exactScores(original,t)&&
  original.kind===(t.seasonId==='S43'?'参加確認':'賞金決勝')&&
  original.prize===null&&(original.reviewOnly===true)===(t.seasonId==='S43')&&
  (t.seasonId==='S32'||original.players?.join(' / ')===t.player&&
    original.teamAccountIds?.join('/')===t.accountIds.join('/')),'original candidate mismatch '+t.id);
 const eventCat=catalog.get(t.tournamentId),expectedTeam=t.roster?'duo':'solo';
 fail(eventCat&&eventCat.seasonId===t.seasonId&&eventCat.team===expectedTeam&&
  eventCat.sourceEventIds.includes(t.eventId)&&eventCat.name===original.event,
  'event catalog differs '+t.id);
 const session=readMonth(t.date.slice(0,7)).sessions.find(s=>
  s.sourceWindowId===t.windowId&&s.eventId===t.eventId&&
  s.dateJst===t.date&&s.region===t.region&&
  s.tournamentId===t.tournamentId&&s.seasonId===t.seasonId);
 fail(Boolean(session),'original official calendar session missing '+t.id);
 const key='epicgames_'+t.eventId+'_'+t.region+'/'+t.windowId;
 const matching=Object.values(db.scans).map(scan=>scan.windows?.[key]).filter(Boolean).filter(cp=>
  cp.rankingOrderValid===true&&cp.proposals?.filter(p=>p.id===t.id&&sameScannedCandidate(p,original)).length===1);
 fail(matching.length>=1,'Epic ID leaderboard or numeric results differ '+t.id);
 const proven=matching.some(cp=>cp.complete===true&&cp.lastErrorCode==null||
  verifiedPartialPage(original,{end:Date.parse(session.endUtc)},cp));
 fail(proven,'original ranked prefix not mature or interrupted '+t.id);
 validateOriginal(original,matching[0],session,eventCat,db.players);
 if(t.roster){
  const known=db.players.confirmedAliases;
  fail(known.bigsky?.includes('tzd Ackermanǃ')&&known.Reo?.includes('IGNUM Reo'),
   'bigsky/Reo account aliases not independently verified');
  const qualified=db.results.filter(r=>r.date==='2026-11-08'&&r.region==='OCE'&&
   r.tournamentId===t.tournamentId&&r.player===t.player&&r.rank<=20&&
   /Round 1 \/ 予選突破/.test(r.round)&&r.prize===0&&r.verified===true);
  fail(qualified.length===1&&qualified[0].playerRaw===t.playerRaw&&qualified[0].players?.join(' / ')===t.player,
   'S43 finalists must match the prior verified top-20 qualification');
 }
 fail(!db.results.some(r=>collision(r,original,db.players.confirmedAliases)),
  'overlapping published record '+t.id);
 const {reviewOnly,reviewReason,...candidate}=original;
 const label=t.seasonId==='S43'?'Event 1 · Round 2 / 賞金決勝':'Event 3 · Round 2 / 賞金決勝';
 const note=t.seasonId==='S43'
 ? '2026/11/13 OCE Reload ZB Duos Cash Cup Event 1 決勝、3位・264pt・6試合・30チームキル・0VR。Epic元順位表で2名の本人ID照合、同大会Round1で19位の突破も確認。Trackerの決勝3位賞金は各$200、チーム計$400。VR賞金ではなく順位賞金。賞金の受取・資格認定は未確認。規則: '+t.rule+' / 出典: '+t.award+' / 独立順位: '+t.independent
 : '2024/11/23（JST）NAC Solo Victory Cup Event 3 決勝、保存済みEpic順位表で123位・100pt・3試合・9キル・1VR。Tracker/公式規則は決勝1VRにつき$100、Liquipediaも同大会賞金$100（掲載順位124位と1位差）を確認。順位は保存済み元Epic値123位を採用。支払完了は未確認。規則: '+t.rule+' / 出典: '+t.award+' / 独立賞金: '+t.independent;
 const row={...candidate,kind:'賞金決勝',round:label,prize:t.prize,note,
  ...(t.roster?{teamPrize:400,prizePerPlayer:200}:{})};
 const e={id:t.id,recordId:t.id,decision:'published',policy:V.POLICY,
  approvedAt:now,approvedBy:'ChatGPT / user-authorized source-verified manual review',
  source:row.source,rule:t.rule,evidence:'Same original Epic-ID scoreboard; exact event/round and independent award table'};
 fail(V.verifiedCashRow(row,e),'record disagrees with immutable cash-evidence oracle '+t.id);
 db.results.push(row);db.ledger.entries.push(e);
 db.reviewed.entries.push({id:t.id,decision:'published',recordId:t.id,
  reviewedAt:now,source:row.source,policy:V.POLICY,rule:t.rule});
 for(const scope of ['auto','history']){
  const old=db.reviews[scope].proposals.length;
  db.reviews[scope].proposals=db.reviews[scope].proposals.filter(x=>x.id!==t.id);
  if(db.reviews[scope].proposals.length!==old){
   const newCount=db.reviews[scope].proposals.length;
   db.reviews[scope].manualReviewedAt=now;
   db.statuses[scope].found=newCount;db.statuses[scope].manualReviewCandidates=newCount;
   db.statuses[scope].reviewOnlyCandidates=db.reviews[scope].proposals.filter(x=>x.reviewOnly===true).length;
   db.statuses[scope].manuallyPublished=(db.statuses[scope].manuallyPublished||0)+1;
   db.statuses[scope].lastReviewedBatchAt=now;
  }
 }
 added.push(row);
}
fail(db.results.length===before.count+added.length,'count changed unexpectedly');
fail(cashTotal(db.results)===before.cash+added.reduce((n,r)=>n+r.prize*100,0),
 'cash total changed unexpectedly');
fail(personalTotal(db.results)===before.personal+added.reduce((n,r)=>n+r.prize*100,0),
 'individual cash total changed unexpectedly');
if(added.length)upsertPublicationLog(db.updates,{
 id:'nov14-verified-pending-cash-two',
 date:new Date(Date.now()+9*3600000).toISOString().slice(0,10),
 title:'確認待ち2024 Unger + 2026 OCE Reo / bigskyの賞金を検証掲載',
 description:'2024 NAC Solo VC決勝1VR＝$100、2026 OCE Reload ZB Duos Cash Cup決勝3位＝選手各$200（チーム$400）。本人ID・公式順位表・独立賞金根拠を照合。過去成績を保持。',
 recordIds:added.map(x=>x.id)});
const v=validateData({results:db.results,players:db.players,tournaments:db.tournaments});
fail(!v.errors.length,'data validation errors '+JSON.stringify(v.errors.slice(0,5)));
const errors=audit(db.results,db.ledger,db.players);
fail(!errors.length,'approval audit errors '+JSON.stringify(errors.slice(0,5)));
const logs=validateUpdateLog(db.results,db.updates);
fail(!logs.length,'updates validation errors '+JSON.stringify(logs.slice(0,5)));
if(!dry&&added.length){
 writeReviewDb(ROOT,db);
 fs.writeFileSync(path.join(ROOT,'history-sync-reviewed.json'),JSON.stringify(db.reviewed,null,2)+'\n');
}
console.log('NOV14_PENDING_CASH '+JSON.stringify({mode:dry?'dry-run':'apply',
 added:added.map(r=>({id:r.id,player:r.player,rank:r.rank,kills:r.kills,prize:r.prize})),
 already,oldCount:before.count,newCount:db.results.length,
 deltaCash:added.reduce((n,r)=>n+r.prize,0)}));
