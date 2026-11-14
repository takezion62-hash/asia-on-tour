'use strict';
// Upgrade an already-published, verified attendance row in place (same ID).
// Only rule-specific approval adapters may grant a promotion. Saved full Epic
// leaderboard checkpoints are preferred; no network or fuzzy identity matching.
// Runs in small, idempotent batches and never edits unrelated results.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {readResults,publishResults}=require('./source-results-store.cjs');
const {linkedAccounts}=require('./osirion-sync.cjs');
const {decideReloadDuoFinal}=require('./automatic-cash-approval.cjs');

const ROOT=path.resolve(__dirname,'..');
const STATE_FILE='participation-promotion-state.json';
const HISTORY_FILE='participation-promotion-history.json';
const SCANS=['auto-sync-scan.json','history-sync-scan.json'];
const TARGET_ID='ch7s5-reload-zero-build-duos-cash-cup';
// We do not have a saved official end timestamp in the old checkpoints.
// For this *specific six-match S43 final* use a conservative 6-hour bound
// measured from the official scheduled start, PLUS the approver's 4-hour lag.
// Never describe the bound as the actual event duration. The complete,
// ordered leaderboard must also have been saved after the 6-hour bound.
const SIX_HOURS=6*60*60*1000,FOUR_HOURS=4*60*60*1000;
const FIELDS=['id','date','region','player','playerRaw','event','round','rank',
 'points','kills','vrs','prize','kind','matches','seasonId','chapter','season',
 'tournamentId','source','verified','players','teamAccountIds'];
const json=x=>JSON.stringify(x);
const hash=x=>crypto.createHash('sha256').update(typeof x==='string'?x:json(x)).digest('hex');
const read=(root,file)=>JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
const write=(root,file,value)=>fs.writeFileSync(path.join(root,file),JSON.stringify(value,null,2)+'\n');
const emptyState=()=>({version:1,ruleFingerprints:{},checked:{}});
const emptyHistory=()=>({version:1,entries:[]});
const limited=(n,defaultValue=5)=>Number.isSafeInteger(n)&&n>=1&&n<=20?n:defaultValue;
const supported=rule=>rule?.id===TARGET_ID&&rule.series==='cash-cup'&&
 rule.seasonId==='S43'&&rule.cashFinalAutoApproval==='verified-duo-round2-rank'&&
 rule.cashPrizes?.basis==='per-player'&&rule.cashPrizes.currency==='USD'&&
 rule.matchCaps?.['賞金決勝']===6;
const sameEvidence=(published,original)=>FIELDS.every(k=>json(published[k])===json(original[k]));
const sourceWindow=row=>{
 try{
  const u=new URL(row.source);
  const m=u.pathname.match(/^\/competitive\/events\/(S43_ReloadZBDuosCashCup)\/$/);
  if(u.protocol!=='https:'||u.hostname!=='www.fortnite.com'||!m||
     u.username||u.password||u.hash||u.searchParams.get('region')!==row.region)return null;
  const windowId=u.searchParams.get('round');
  if(!/^S43_ReloadZBDuosCashCup_Event[1-9][0-9]*Round2_(EU|NAC|NAW|BR|ME|OCE)$/.test(windowId||'')||
    !windowId.endsWith('_'+row.region))return null;
  const event=Number(windowId.match(/Event([1-9][0-9]*)Round2_/)[1]);
  if(row.round!=='Event '+event+' · Round 2 / 参加確認')return null;
  return {eventId:m[1],windowId,event,
   key:'epicgames_'+m[1]+'_'+row.region+'/'+windowId};
 }catch{return null}
};
function checkpointsFor(row,scanDocs){
 const identity=sourceWindow(row);
 if(!identity)return [];
 const hits=[];
 for(const {name,data} of scanDocs){
  const cp=data?.windows?.[identity.key];
  if(!cp||!Array.isArray(cp.proposals))continue;
  const matching=cp.proposals.filter(p=>p.id===row.id);
  if(matching.length!==1)continue;
  hits.push({file:name,cp,original:matching[0],identity});
 }
 return hits.sort((a,b)=>Number(b.cp.complete===true)-Number(a.cp.complete===true)||
  Date.parse(b.cp.lastSuccessAt||0)-Date.parse(a.cp.lastSuccessAt||0));
}
function officialSlot(row,identity,schedule){
 const matches=(schedule?.sessions||[]).filter(s=>s.eventId===identity.eventId&&
  s.region===row.region&&s.seasonId==='S43'&&s.dateJst===row.date&&
  s.name===row.event&&s.stage==='決勝'&&s.round==='Event '+identity.event+' · Round 2');
 return matches.length===1?matches[0]:null;
}
function fingerprint(row,rule,hits,slot,accounts){
 // Candidate-specific: unrelated results, leaderboards or rule changes do not
 // restart verification of previously examined rows.
 return hash({row,rule,slot,hits:hits.map(h=>({file:h.file,key:h.identity.key,
   complete:h.cp.complete,rankingOrderValid:h.cp.rankingOrderValid,
   lastSuccessAt:h.cp.lastSuccessAt,proposals:h.original})),
  accounts:accounts.filter(a=>row.teamAccountIds?.includes(a.epicAccountId))});
}
function inspect(row,context,hits,slot,now){
 if(row.kind!=='参加確認'||row.prize!==null||row.verified!==true||
  !/^auto-s43-[a-f0-9]{12}$/.test(row.id||''))return {reason:'公開済み参加確認の形式が不正'};
 if(!hits.length)return {reason:'保存済みの同一公式順位表がありません'};
 if(hits.some(h=>!sameEvidence(row,h.original)))return {reason:'保存済み順位表と公開済み成績が一致しません'};
 if(!slot||!Number.isFinite(Date.parse(slot.startUtc)))return {reason:'公式日程の決勝開催枠が一意に確認できません'};
 const end=Date.parse(slot.startUtc)+SIX_HOURS;
 if(now<end+FOUR_HOURS)return {reason:'保守的な決勝終了判定の経過待ち',timePending:true};
 const h=hits.find(x=>x.cp.complete===true&&x.cp.rankingOrderValid===true&&
  Number.isFinite(Date.parse(x.cp.lastSuccessAt))&&Date.parse(x.cp.lastSuccessAt)>=end);
 if(!h)return {reason:'全ページ取得済み・確定後の公式順位表がありません'};
 const win={...h.identity,region:row.region,seasonId:row.seasonId,
  tournamentId:row.tournamentId,series:'cash-cup',kind:'参加確認',
  dateJst:row.date,round:row.round,startUtc:slot.startUtc,end};
 // The same existing row is intentionally excluded from the duplicate check.
 // Any OTHER row for the same duo and official round still blocks the upgrade.
 const withoutTarget=context.results.filter(x=>x.id!==row.id);
 const decision=decideReloadDuoFinal(h.original,win,h.cp,{
  results:withoutTarget,players:context.players,tournaments:context.tournaments,
  schedule:context.schedule,verifiedAccounts:context.verifiedAccounts
 },now);
 if(!decision.approved)return {reason:decision.reason||'大会固有の自動承認に失敗'};
 const proposed=decision.record;
 if(proposed.id!==row.id||!sameEvidence({...proposed,kind:row.kind,round:row.round,prize:row.prize,
   teamAccountIds:row.teamAccountIds},row)||
  !['賞金決勝'].includes(proposed.kind)||!Number.isFinite(proposed.prize)||
  proposed.prize<0||!Number.isFinite(proposed.prizePerPlayer))
  return {reason:'昇格後に識別子・成績・賞金の不整合があります'};
 return {record:proposed,file:h.file,key:h.identity.key,lastSuccessAt:h.cp.lastSuccessAt};
}
function plan(context,state=emptyState(),history=emptyHistory(),{now=Date.now(),batchSize=5}={}){
 if(state.version!==1||!state.checked||!state.ruleFingerprints||
   history.version!==1||!Array.isArray(history.entries))throw Error('PROMOTION invalid state');
 const rules=(context.rules?.rules||[]).filter(supported);
 const byId=new Map(rules.map(r=>[r.id,r]));
 const ruleFingerprints={...state.ruleFingerprints};
 const changedRules=[];
 for(const rule of rules){
  const fresh=hash(rule);
  if(ruleFingerprints[rule.id]!==fresh)changedRules.push(rule.id);
  ruleFingerprints[rule.id]=fresh;
 }
 const checked={...state.checked};
 const historyIds=new Set(history.entries.map(e=>e.id));
 const eligible=context.results.filter(row=>row.kind==='参加確認'&&row.prize===null&&
  row.verified===true&&byId.has(row.tournamentId));
 const considered=[];
 for(const row of eligible){
  const rule=byId.get(row.tournamentId);
  const hits=checkpointsFor(row,context.scanDocs);
  const identity=sourceWindow(row);
  const slot=identity?officialSlot(row,identity,context.schedule):null;
  const signature=fingerprint(row,rule,hits,slot,context.verifiedAccounts||[]);
  if(checked[row.id]?.signature===signature&&!checked[row.id].timePending)continue;
  if(historyIds.has(row.id))throw Error('PROMOTION previously upgraded ID is still participation: '+row.id);
  considered.push({row,hits,slot,signature});
 }
 // Earlier date and stable ID first; no giant leaderboard rescans or unbounded work.
 considered.sort((a,b)=>a.row.date.localeCompare(b.row.date)||
   a.row.region.localeCompare(b.row.region)||a.row.id.localeCompare(b.row.id));
 const changes=[],held=[];
 const results=context.results.slice();
 for(const {row,hits,slot,signature} of considered.slice(0,limited(batchSize))){
  const result=inspect(row,{...context,results},hits,slot,now);
  checked[row.id]={signature,status:result.record?'promoted':'held',
    ...(result.record?{}:{reason:result.reason,timePending:result.timePending===true})};
  if(!result.record){held.push({id:row.id,reason:result.reason});continue}
  const at=results.findIndex(v=>v.id===row.id);
  if(at<0)throw Error('PROMOTION source row moved');
  results[at]=result.record;
  changes.push({id:row.id,date:row.date,region:row.region,
    tournamentId:row.tournamentId,player:row.player,
    before:{kind:row.kind,round:row.round,prize:row.prize},
    after:{kind:result.record.kind,round:result.record.round,prize:result.record.prize,
      prizePerPlayer:result.record.prizePerPlayer},
    beforeSha256:hash(row),afterSha256:hash(result.record),
    proof:{file:result.file,key:result.key,lastSuccessAt:result.lastSuccessAt,
      ruleSha256:ruleFingerprints[row.tournamentId]},approvedAt:new Date(now).toISOString()});
 }
 const previousIds=new Set(context.results.map(x=>x.id));
 if(results.length!==context.results.length||new Set(results.map(x=>x.id)).size!==results.length||
   results.some(x=>!previousIds.has(x.id)))throw Error('PROMOTION must preserve every existing result ID');
 const nextState={version:1,ruleFingerprints,checked};
 const nextHistory={version:1,entries:[...changes,...history.entries]};
 return {results,state:nextState,history:nextHistory,changes,held,
  summary:{changedRules,eligible:eligible.length,toReview:considered.length,
    processed:Math.min(considered.length,limited(batchSize)),
    promoted:changes.length,held:held.length,remaining:Math.max(0,considered.length-limited(batchSize))}};
}
function run(root=ROOT,{dryRun=false,batchSize=5,now=Date.now()}={}){
 const results=readResults(root).rows;
 const players=read(root,'players.json');
 const scanDocs=SCANS.filter(file=>fs.existsSync(path.join(root,file)))
  .map(name=>({name,data:read(root,name)}));
 const verifiedAccounts=linkedAccounts({results,players}).accounts;
 const context={results,players,tournaments:read(root,'tournaments.json'),
  schedule:read(root,'schedule.json'),rules:read(root,'tournament-rules.json'),
  scanDocs,verifiedAccounts};
 const state=fs.existsSync(path.join(root,STATE_FILE))?read(root,STATE_FILE):emptyState();
 const history=fs.existsSync(path.join(root,HISTORY_FILE))?read(root,HISTORY_FILE):emptyHistory();
 const output=plan(context,state,history,{now,batchSize});
 const marker=dryRun?'PROMOTION_DRY_RUN ':'PROMOTION_RESULT ';
 console.log(marker+JSON.stringify({...output.summary,
  upgraded:output.changes.map(x=>({id:x.id,region:x.region,player:x.player,
    prize:x.after.prize})),heldReasons:output.held.slice(0,5)}));
 if(dryRun)return output;
 if(output.changes.length)publishResults(root,output.results);
 if(json(state)!==json(output.state))write(root,STATE_FILE,output.state);
 if(output.changes.length)write(root,HISTORY_FILE,output.history);
 return output;
}
if(require.main===module){
 try{run(ROOT,{dryRun:process.argv.includes('--dry-run'),
   batchSize:limited(Number(process.env.AOT_PROMOTION_BATCH_SIZE)||5)});}
 catch(e){console.error('PROMOTION_ERROR '+e.stack);process.exitCode=1}
}
module.exports={TARGET_ID,emptyState,emptyHistory,sourceWindow,
 checkpointsFor,officialSlot,sameEvidence,fingerprint,inspect,plan,run};
