'use strict';
// Never publish or change scores. Resolve only duplicates with original Epic
// roster IDs, complete mature checkpoints, exact official sessions, and
// a successful existing official Cash Cup approval decision (on an isolated
// snapshot with the one matching published record removed).
const {sameScannedCandidate,FOUR_HOURS}=require('./verified-partial-page.cjs');
const {sourceWindow}=require('./candidate-triage-core.cjs');
const {decide,RULES}=require('./automatic-cash-approval.cjs');
const {MANIFEST}=require('./generic-review-only-core.cjs');
const {isDeepStrictEqual}=require('node:util');
const FIELDS=['rank','points','kills','vrs','matches'];
const SCOPES=['auto','history'];
const roster=r=>Array.isArray(r?.players)&&r.players.length?r.players:[r?.player];
const validId=id=>typeof id==='string'&&/^[0-9a-f]{32}$/.test(id);
const size=t=>({solo:1,duo:2,trio:3,squad:4})[t];
const clone=x=>JSON.parse(JSON.stringify(x));
function rosterProof(row,expected,accounts){
 const names=roster(row),ids=row?.teamAccountIds;
 if(!expected||names.length!==expected||names.join(' / ')!==row.player||new Set(names).size!==expected||
   !Array.isArray(ids)||ids.length!==expected||new Set(ids).size!==expected||
   ids.some((id,i)=>!validId(id)||accounts.get(id)!==names[i]))return null;
 return names.map((name,i)=>[ids[i],name]).sort((a,b)=>a[0].localeCompare(b[0]));
}
function maturity(cp,row,end,now){
 const seen=Date.parse(cp?.lastSuccessAt||'');
 return cp?.complete===true&&cp.rankingOrderValid===true&&Number.isSafeInteger(cp.totalPages)&&cp.totalPages>0&&
  cp.nextPage===cp.totalPages&&cp.pages===cp.nextPage&&Number.isSafeInteger(cp.lastSeenRank)&&cp.lastSeenRank>=row.rank&&
  !cp.lastErrorCode&&!cp.lastError&&!cp.retryAfter&&!(cp.emptyAttempts>0)&&
  Number.isFinite(end)&&Number.isFinite(seen)&&now-end>=FOUR_HOURS&&seen-end>=FOUR_HOURS&&seen<=now+300000;
}
function planDuplicates(db,{now=Date.now()}={}){
 if(!Number.isFinite(now))throw Error('invalid duplicate resolution time');
 const timestamp=new Date(now).toISOString(),resolved=[],held=[];
 for(const scope of SCOPES)if(!Array.isArray(db.reviews?.[scope]?.proposals)||!db.scans?.[scope]?.windows||!db.statuses?.[scope])
  throw Error('invalid duplicate queue input '+scope);
 if(!Array.isArray(db.results)||!Array.isArray(db.reviewed?.entries)||!Array.isArray(db.ledger?.entries))
  throw Error('invalid duplicate resolution database');
 const done=new Set([...db.results,...db.reviewed.entries,...db.ledger.entries].map(x=>x.id));
 const pinned=new Set((MANIFEST.held||[]).map(x=>x.id));
 const known=new Map(),ambiguous=new Set();
 for(const x of db.verifiedAccounts||[]){
  if(x.confirmed!==true||!validId(x.epicAccountId))continue;
  if(known.has(x.epicAccountId)&&known.get(x.epicAccountId)!==x.player)ambiguous.add(x.epicAccountId);
  known.set(x.epicAccountId,x.player);
 }
 for(const id of ambiguous)known.delete(id);
 const byId=new Map(),checkpoints=new Map(),catalog=new Map(db.tournaments.catalog.map(t=>[t.id,t]));
 for(const scope of SCOPES)for(const row of db.reviews[scope].proposals){
  if(!row?.id)continue;
  if(!byId.has(row.id))byId.set(row.id,[]);
  byId.get(row.id).push({scope,row});
 }
 for(const scope of SCOPES)for(const [key,cp] of Object.entries(db.scans[scope].windows)){
  for(const row of cp?.proposals||[]){
   if(!byId.has(row.id))continue;
   if(!checkpoints.has(row.id))checkpoints.set(row.id,[]);
   checkpoints.get(row.id).push({scope,key,cp,row});
  }
 }
 const existingByWindow=new Map();
 for(const old of db.results){
  const key=sourceWindow(old);
  if(!key)continue;
  const index=JSON.stringify([old.date,old.tournamentId,key]);
  if(!existingByWindow.has(index))existingByWindow.set(index,[]);
  existingByWindow.get(index).push(old);
 }
 const requireOK=(ok,reason)=>{if(!ok)throw Error(reason)};
 for(const [id,entries] of byId){
  const row=entries[0].row,cat=catalog.get(row.tournamentId),rule=RULES[row.tournamentId];
  // Stage one is deliberately narrow: existing rank-based Cash Cup final
  // approvers only. No attendance/qualifier/skin/VR or unknown-rule inference.
  if(!rule||cat?.series!=='cash-cup')continue;
  const key=sourceWindow(row),matches=existingByWindow.get(JSON.stringify([row.date,row.tournamentId,key]))||[];
  const possible=matches.filter(old=>old.rank===row.rank||roster(old).some(n=>roster(row).includes(n)));
  if(!possible.length)continue;
  try{
   requireOK(!done.has(id)&&!pinned.has(id),'既処理または明示保留ID');
   requireOK(/^auto-s[0-9]+-[a-f0-9]{12}$/.test(id)&&row.verified===true&&row.reviewOnly===true&&row.kind==='参加確認'&&row.prize===null,'未対応の候補形式');
   requireOK(entries.length===new Set(entries.map(x=>x.scope)).size&&entries.every(x=>sameScannedCandidate(row,x.row)),'新着・過去候補が不一致または重複');
   requireOK(key&&cat.seasonId===row.seasonId&&cat.name===row.event&&cat.team===rule.team,'大会カタログ不一致');
   const team=rosterProof(row,size(cat.team),known);
   requireOK(team,'候補の全員の本人Epic IDが未確認');
   requireOK(possible.length===1,'既存戦績が一意ではない');
   const old=possible[0];
   requireOK(old.id!==id&&old.verified===true&&old.kind==='賞金決勝'&&old.reviewOnly!==true&&
    old.seasonId===row.seasonId&&old.event===row.event&&old.region===row.region&&old.source===row.source&&
    FIELDS.every(k=>Number.isSafeInteger(row[k])&&old[k]===row[k]),'既存開催枠・成績・決勝種別が不一致');
   requireOK(isDeepStrictEqual(rosterProof(old,size(cat.team),known),team),'既掲載の全員のEpic IDが不明または不一致');
   requireOK(db.results.filter(x=>x.id===old.id).length===1,'既掲載IDが一意ではない');
   const u=new URL(row.source),eventId=decodeURIComponent(u.pathname.split('/')[3]),windowId=u.searchParams.get('round');
   requireOK(cat.sourceEventIds.includes(eventId)&&rule.eventIds.includes(eventId),'公式イベントID不一致');
   const sessions=(db.calendar[row.date.slice(0,7)]||[]).filter(s=>s.eventId===eventId&&s.sourceWindowId===windowId&&
    s.dateJst===row.date&&s.region===row.region&&s.tournamentId===row.tournamentId&&s.seasonId===row.seasonId&&s.url===row.source);
   requireOK(sessions.length===1,'公式開催枠が一意でない');
   const session=sessions[0],end=Date.parse(session.endUtc),start=Date.parse(session.startUtc);
   requireOK(Number.isFinite(start)&&Number.isFinite(end)&&start<end,'公式開催時刻不正');
   const boards=checkpoints.get(id)||[];
   requireOK(boards.length>0&&boards.length===new Set(boards.map(x=>x.scope)).size&&
    boards.every(x=>x.key===key&&sameScannedCandidate(x.row,row)),'元の順位表／本人IDと不一致');
   const proof=boards.find(x=>maturity(x.cp,row,end,now));
   requireOK(proof,'完了・成熟した順位表がない');
   const win={eventId,windowId,key,seasonId:row.seasonId,tournamentId:row.tournamentId,region:row.region,
    dateJst:row.date,series:cat.series,kind:row.kind,round:row.round,startUtc:session.startUtc,end};
   // Use the exact stored row: only reviewReason can have changed in the queue.
   // Do not bypass any other adapter guard or publish the hypothetical record.
   const decision=decide(proof.row,win,proof.cp,{...db,
    results:db.results.filter(x=>x.id!==old.id),schedule:{sessions:[session]}});
   requireOK(decision.approved,'公式承認条件未達: '+decision.reason);
   const expected=decision.record;
   requireOK(expected.kind===old.kind&&expected.round===old.round&&expected.source===old.source&&
    Number.isSafeInteger(expected.prize)&&expected.prize>=0&&
    Number.isSafeInteger(expected.prizePerPlayer)&&expected.prizePerPlayer>=0&&
    expected.prize===old.prize&&expected.prizePerPlayer===old.prizePerPlayer,
    '既存賞金と公式個人／チーム賞金が不一致または未確認');
   resolved.push({id,decision:'already-published',existingId:old.id,reviewedAt:timestamp,
    source:row.source,rule:decision.rule,policy:'exact-epic-window-score-cash-duplicate-v1',
    evidence:{windowKey:key,checkpointScope:proof.scope,lastSuccessAt:proof.cp.lastSuccessAt,
     roster:team.map(([epicAccountId,player])=>({epicAccountId,player})),
     stats:Object.fromEntries(FIELDS.map(k=>[k,row[k]])),prize:expected.prize,prizePerPlayer:expected.prizePerPlayer},
    note:'完全一致の既掲載戦績。新規賞金・順位・戦績を変更せず候補のみ解消。'});
  }catch(e){held.push({id,reason:String(e.message||e)})}
 }
 const reviews=clone(db.reviews),statuses=clone(db.statuses),reviewed=clone(db.reviewed);
 if(resolved.length){
  const ids=new Set(resolved.map(x=>x.id));
  reviewed.entries.push(...resolved);reviewed.reviewedAt=timestamp;
  for(const scope of SCOPES){
   const q=reviews[scope],before=q.proposals.length;
   q.proposals=q.proposals.filter(x=>!ids.has(x.id));
   const count=before-q.proposals.length;
   if(!count)continue;
   q.autoDuplicateReviewedAt=timestamp;
   const s=statuses[scope];
   s.found=q.proposals.length;s.manualReviewCandidates=q.proposals.length;
   s.reviewOnlyCandidates=q.proposals.filter(x=>x.reviewOnly===true).length;
   s.autoResolvedDuplicates=(s.autoResolvedDuplicates||0)+count;
   s.lastAutoDuplicateReviewAt=timestamp;
   s.message='完全一致の既掲載重複候補'+count+'件を自動解消。戦績・賞金変更なし。残り確認待ち'+q.proposals.length+'件。';
  }
 }
 return {resolved,held,next:{reviews,statuses,reviewed}};
}
module.exports={planDuplicates,rosterProof,maturity};
