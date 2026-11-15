'use strict';
/**
 * Promote already-published Cash Cup attendance without changing its record ID.
 * Automatic promotion needs a completed, ordered scan and the existing strict
 * official-rule cash validator. A single explicit, externally checked top-five
 * proof can substitute ONLY for scan completion; all other checks still apply.
 *
 * Usage: node scripts/promote-published-cash.cjs --dry-run | --apply
 */
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const {readResults,publishResults}=require('./source-results-store.cjs');
const {RULES,cashPrize,cashLimitForWindow,decide}=require('./automatic-cash-approval.cjs');
const {validateData}=require('./data-checks.cjs');
const read=file=>JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
const fields=['id','date','region','player','playerRaw','event','round','rank','points',
 'kills','vrs','prize','kind','matches','seasonId','chapter','season','tournamentId',
 'source','verified','players','teamAccountIds'];
const json=x=>JSON.stringify(x);
const matchPublished=(published,candidate)=>
 published?.verified===true&&published.kind==='参加確認'&&published.prize===null&&
 candidate?.verified===true&&candidate.reviewOnly===true&&
 fields.every(key=>json(published[key])===json(candidate[key]));
function indexedProposals(...documents){
 const index=new Map();
 for(const doc of documents){
  for(const [key,cp] of Object.entries(doc?.windows||{})){
   if(cp?.rankingOrderValid!==true||!Array.isArray(cp.proposals))continue;
   for(const candidate of cp.proposals){
    if(!candidate?.id||!candidate.reviewOnly)continue;
    const previous=index.get(candidate.id),next={key,cp,candidate};
    if(!previous||(!previous.cp.complete&&cp.complete)||
      (previous.cp.complete===cp.complete&&Date.parse(cp.lastSuccessAt||0)>Date.parse(previous.cp.lastSuccessAt||0)))
     index.set(candidate.id,next);
   }
  }
 }
 return index;
}
function sourceWindow(row,rule,schedule){
 try{
  const u=new URL(row.source);
  if(u.protocol!=='https:'||u.hostname!=='www.fortnite.com'||u.username||u.password||
   u.hash||u.searchParams.get('region')!==row.region)return null;
  const eventId=decodeURIComponent(u.pathname.match(/^\/competitive\/events\/([^/]+)\/$/)?.[1]||'');
  if(!rule.eventIds.includes(eventId))return null;
  const windowId=u.searchParams.get('round');
  const m=String(windowId||'').match(new RegExp('^'+eventId+'_Event([1-9][0-9]*)_'+row.region+'$'));
  if(!m||row.round!=='Event '+Number(m[1])+' / 参加確認')return null;
  const sessions=(schedule.sessions||[]).filter(s=>s.eventId===eventId&&s.seasonId===rule.seasonId&&
   s.region===row.region&&s.dateJst===row.date&&s.round==='Event '+Number(m[1])&&
   s.stage==='単一ラウンド'&&s.name===row.event&&Number.isFinite(Date.parse(s.startUtc)));
  if(sessions.length!==1)return null;
  return {key:'epicgames_'+eventId+'_'+row.region+'/'+windowId,eventId,windowId,
   series:'cash-cup',kind:'参加確認',tournamentId:row.tournamentId,seasonId:row.seasonId,
   region:row.region,dateJst:row.date,round:row.round,startUtc:sessions[0].startUtc,
   end:Date.parse(sessions[0].startUtc)+3*60*60*1000};
 }catch{return null}
}
function independentlyVerified(proof,published,candidate,win,checkpoint,rule){
 if(!proof||!published||!candidate||!win||!checkpoint||
    checkpoint.rankingOrderValid!==true||!(checkpoint.lastSeenRank>=published.rank)||
    !matchPublished(published,candidate))return false;
 if(proof.recordId!==published.id||proof.eventId!==win.eventId||
    proof.windowId!==win.windowId||proof.date!==published.date||
    proof.region!==published.region||proof.tournamentId!==published.tournamentId||
    proof.playerRaw!==published.playerRaw||proof.rank!==published.rank||
    proof.points!==published.points||proof.kills!==published.kills||
    proof.vrs!==published.vrs||proof.matches!==published.matches||
    json(proof.players)!==json(published.players)||
    json(proof.teamAccountIds)!==json(candidate.teamAccountIds)||
    json(proof.displayNames)!==json(published.playerRaw.split(' / '))||
    proof.perPlayerUSD!==cashPrize(rule,win.region,published.rank)||proof.perPlayerUSD<=0)
   return false;
 try{
  const url=new URL(proof.officialLeaderboard),tracker=new URL(proof.trackerPrizeTable);
  return url.origin==='https://www.fortnite.com'&&
   url.pathname==='/competitive/events/'+win.eventId+'/leaderboard'&&
   url.searchParams.get('region')===win.region&&url.searchParams.get('round')===win.windowId&&
   tracker.origin==='https://fortnitetracker.com'&&
   tracker.pathname==='/events/epicgames_'+win.eventId+'_'+win.region&&
   tracker.searchParams.get('window')===win.windowId;
 }catch{return false}
}
function plan({results,players,tournaments,schedule,scanDocs,proofs,limit=5}){
 const checkpoints=indexedProposals(...scanDocs),proofById=new Map(proofs.map(p=>[p.recordId,p]));
 const updated=results.slice(),changes=[];
 for(let index=0;index<updated.length&&changes.length<limit;index++){
  const old=updated[index],rule=RULES[old?.tournamentId];
  if(old?.kind!=='参加確認'||old.prize!==null||old.verified!==true||
   !rule||rule.autoApproval!=='verified-team-rank')continue;
  const found=checkpoints.get(old.id);
  if(!found||!matchPublished(old,found.candidate))continue;
  const win=sourceWindow(old,rule,schedule);
  if(!win||win.key!==found.key||cashLimitForWindow(win)===null)continue;
  const {cp,candidate}=found,proof=proofById.get(old.id);
  const officialProof=!cp.complete&&independentlyVerified(proof,old,candidate,win,cp,rule);
  if(!cp.complete&&!officialProof)continue;
  const ids=candidate.teamAccountIds,roster=candidate.players;
  if(!Array.isArray(ids)||!Array.isArray(roster)||ids.length!==roster.length)continue;
  // Re-use the strict cash validator. For an independently confirmed official
  // top-five, the synthetic complete flag is used ONLY in this in-memory
  // validation call; the stored scan remains accurately marked incomplete.
  const validationCheckpoint=officialProof?{...cp,complete:true}:cp;
  const verdict=decide(candidate,win,validationCheckpoint,{
   results:updated.filter((r,i)=>i!==index),players,tournaments,schedule,
   verifiedAccounts:roster.map((player,i)=>({player,epicAccountId:ids[i],confirmed:true}))
  });
  if(!verdict.approved)continue;
  const next={...old,round:verdict.record.round,kind:verdict.record.kind,
   prize:verdict.record.prize,prizePerPlayer:verdict.record.prizePerPlayer,
   note:verdict.record.note+(officialProof?
    ' 公開済み参加記録を、Epic公式TOP5順位表とTracker地域別個人賞金表で独立照合し同じ成績IDで昇格（取得済みスキャンは全ページ未完了）。'+
    ' Epic順位表: '+proof.officialLeaderboard+' Tracker: '+proof.trackerPrizeTable:'')};
  if(next.id!==old.id||next.rank!==old.rank||next.points!==old.points||
   next.kills!==old.kills||next.vrs!==old.vrs||next.matches!==old.matches||
   next.prize!==next.prizePerPlayer*roster.length)throw Error('CASH_PROMOTION inconsistent upgrade');
  updated[index]=next;
  changes.push({id:old.id,player:old.player,region:old.region,rank:old.rank,
   individualPrize:next.prizePerPlayer,teamPrize:next.prize,
   proof:officialProof?'official-top-five':'completed-provider-scan'});
 }
 if(updated.length!==results.length||new Set(updated.map(r=>r.id)).size!==results.length)
  throw Error('CASH_PROMOTION lost or duplicated records');
 if(changes.length){
  const check=validateData({results:updated,players,tournaments});
  if(check.errors.length)throw Error('CASH_PROMOTION data check: '+check.errors.slice(0,3).join('; '));
 }
 return {updated,changes};
}
function main(){
 const dry=process.argv.includes('--dry-run'),apply=process.argv.includes('--apply');
 if(dry===apply)throw Error('CASH_PROMOTION specify exactly one of --dry-run or --apply');
 const results=readResults(root).rows;
 const payload={results,players:read('players.json'),tournaments:read('tournaments.json'),
  schedule:read('schedule.json'),scanDocs:[read('auto-sync-scan.json'),read('history-sync-scan.json')],
  proofs:read('data/manual-approvals/20261115-naw-trios-cash-fifth-proof.json').proofs};
 const outcome=plan(payload);
 if(apply&&outcome.changes.length)publishResults(root,outcome.updated);
 console.log('PUBLISHED_CASH_PROMOTION '+JSON.stringify({mode:dry?'dry-run':'apply',
  count:outcome.changes.length,changes:outcome.changes,unchangedCount:results.length-outcome.changes.length}));
}
if(require.main===module){try{main()}catch(e){console.error(e.stack);process.exitCode=1}}
module.exports={matchPublished,sourceWindow,independentlyVerified,indexedProposals,plan};
