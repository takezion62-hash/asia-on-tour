'use strict';
// S39 NVIDIA GeForce RTX Cup: exact regional cash-by-rank, GPU and Rust Bucket eligibility.
// A real payout or delivery is not proved by in-game placement; never add GPU ARV as cash.
// All auto-published results require a fully scanned, ordered Epic leaderboard, a pinned
// region-specific session, and one verified Epic account matching the canonical player.
const {sameScannedCandidate}=require('./verified-partial-page.cjs');
const RULES=Object.freeze(Object.fromEntries(require('../tournament-rules.json').rules
 .filter(r=>r.series==='nvidia-cup'&&r.autoApproval==='verified-team-rank')
 .map(r=>[r.id,r])));
const ARCHIVE=require('../calendar-history/2025-12.json').sessions;
const FOUR_HOURS=4*60*60*1000;
const decline=reason=>({approved:false,reason});
const REGIONS=new Set(['EU','NAC','NAW','ME','OCE','BR']);
function payout(rule,region,rank){
 if(!Number.isSafeInteger(rank)||rank<1)return null;
 const tiers=rule?.cashPrizes?.tiers?.[region];
 if(!Array.isArray(tiers)||!tiers.length)return null;
 return tiers.find(t=>rank<=t.through)?.perPlayer??0;
}
function nvidiaWindow(win){
 const rule=RULES[win?.tournamentId];
 if(!rule||win.series!=='nvidia-cup'||win.seasonId!=='S39'||win.kind!=='参加確認'||
    win.eventId!=='S39_NvidiaCup'||!REGIONS.has(win.region)||
    win.windowId!=='S39_NvidiaCup_'+win.region||
    !rule.eventIds.includes(win.eventId)||!rule.cashPrizes.tiers[win.region])return null;
 return rule;
}
function sameSession(a,b){
 if(!a||!b||a.tournamentId!==b.tournamentId||a.region!==b.region||
    a.date!==b.date)return false;
 const aa=Array.isArray(a.players)&&a.players.length?a.players:[a.player];
 const bb=Array.isArray(b.players)&&b.players.length?b.players:[b.player];
 return aa.length===1&&bb.length===1&&aa[0]===bb[0];
}
function decide(row,win,checkpoint,data,now=Date.now()){
 const rule=nvidiaWindow(win);
 if(!rule)return decline('S39 NVIDIA Cupの単一開催枠と地域が一致しません');
 if(!row||!/^auto-s39-[a-f0-9]{12}$/.test(row.id||'')||
    row.verified!==true||row.reviewOnly!==true||
    row.prize!==null||row.kind!=='参加確認'||
    row.round!==win.round||win.round!=='単一開催枠 / 参加確認')
   return decline('Osirionが確認待ちとして保存したNVIDIA Cupの候補ではありません');
 if(!checkpoint||checkpoint.complete!==true||
    checkpoint.rankingOrderValid!==true||
    !Number.isSafeInteger(checkpoint.totalPages)||checkpoint.totalPages<1||
    checkpoint.pages!==checkpoint.totalPages||
    checkpoint.nextPage!==checkpoint.totalPages||
    !Array.isArray(checkpoint.proposals)||
    checkpoint.proposals.filter(x=>sameScannedCandidate(x,row)).length!==1)
   return decline('本人IDを含む順位表の全ページが確認できません');
 if(!Number.isFinite(win.end)||now-win.end<FOUR_HOURS||
    !Number.isFinite(Date.parse(checkpoint.lastSuccessAt||''))||
    Date.parse(checkpoint.lastSuccessAt)<win.end+FOUR_HOURS)
   return decline('公式大会終了後4時間の確定期間を確認できません');
 const tournament=data.tournaments?.catalog?.find(t=>t.id===rule.id);
 if(!tournament||tournament.name!=='NVIDIA GeForce RTX Cup'||
    tournament.mode!=='battle-royale'||tournament.series!=='nvidia-cup'||
    tournament.team!=='solo'||tournament.seasonId!==rule.seasonId||
    !tournament.sourceEventIds.includes(win.eventId)||
    row.tournamentId!==win.tournamentId||row.seasonId!==win.seasonId||
    row.date!==win.dateJst||row.region!==win.region||
    row.event!==tournament.name||row.kind!==win.kind)
   return decline('大会マスターと本人順位表の開催日時・名義が一致しません');
 const sessions=ARCHIVE.filter(s=>s.eventId===win.eventId&&
    s.tournamentId===rule.id&&s.region===win.region&&
    s.sourceWindowId===win.windowId&&s.dateJst===win.dateJst&&
    s.seasonId==='S39'&&s.name===tournament.name&&
    s.stage==='単一ラウンド'&&Date.parse(s.startUtc)===Date.parse(win.startUtc)&&
    Date.parse(s.endUtc)===win.end);
 if(sessions.length!==1)return decline('2025年12月の公式開催アーカイブで日時が確認できません');
 const members=Array.isArray(row.players)&&row.players.length?row.players:[row.player],ids=row.teamAccountIds;
 if(members.length!==1||members[0]!==row.player||
    !data.players?.candidates?.some(p=>p.name===row.player)||
    !Array.isArray(ids)||ids.length!==1||
    !/^[0-9a-f]{32}$/.test(ids[0]))
   return decline('ソロ選手名と本人Epic UUIDの対応が未確認');
 const known=new Map((data.verifiedAccounts||[])
  .filter(a=>a?.confirmed===true&&typeof a.epicAccountId==='string')
  .map(a=>[a.epicAccountId.toLowerCase(),a.player]));
 if(known.get(ids[0])!==row.player)
   return decline('名鑑選手と確認済みEpic UUIDが一致しません');
 if(!Number.isSafeInteger(row.rank)||row.rank<1||
    !Number.isSafeInteger(row.points)||row.points<0||
    !Number.isSafeInteger(row.kills)||row.kills<0||
    !Number.isSafeInteger(row.vrs)||row.vrs<0||
    !Number.isSafeInteger(row.matches)||row.matches<1||
    row.matches>rule.matchCaps['単一ラウンド']||row.vrs>row.matches)
   return decline('順位・得点・キル・VR・試合数のいずれかが不正');
 let src;
 try{src=new URL(row.source)}catch{}
 if(!src||src.protocol!=='https:'||src.hostname!=='www.fortnite.com'||
    src.username||src.password||src.hash||
    src.pathname!=='/competitive/events/S39_NvidiaCup/'||
    src.searchParams.get('region')!==win.region||
    src.searchParams.get('round')!==win.windowId)
   return decline('Epic公式順位表の開催枠URLが一致しません');
 if((data.results||[]).some(x=>x.id===row.id||sameSession(x,row)))
   return decline('同一選手の同一開催枠は掲載済みです');
 const award=payout(rule,win.region,row.rank);
 if(award===null||!Number.isSafeInteger(award)||award<0)
   return decline('地域別の公式現金賞金表が未登録');
 const gpu=row.rank<=rule.hardwarePrizes.topRanks[win.region];
 const cosmetic=row.points>=rule.cosmeticReward.minimumPoints;
 const {reviewOnly,reviewReason,teamAccountIds,note,...base}=row;
 const record={...base,round:'Session 1 / 賞金決勝',kind:'賞金決勝',
  prize:award,prizePerPlayer:award,
  note:'2025年12月 NVIDIA GeForce RTX Cup '+win.region+' '+row.rank+'位。'+
   (award?'Epic公式の個人現金賞金順位に該当（規定額$'+award+'）。':'現金賞金圏外で$0。')+
   (gpu?' RTX 5080は規定上のGPU賞対象順位（現金に加算せず、受領は未確認）。':'')+
   (cosmetic?' 8pt以上のRust Bucket対象条件を満たす（受領は未確認）。':
    ' Rust Bucketの8pt条件は未達。')+
   ' 個人の参加資格審査・現金の実支払は未確認。'+
   'Epic公式の全ページ順位表・本人Epic UUID・大会日時を照合。得点計算はゲーム内表示に従い推定しない。規則: '+rule.source};
 return {approved:true,record,rule:rule.source};
}
function evaluate(proposals,windows,checkpoints,data){
 const byKey=new Map(windows.map(w=>[w.key,w])),snapshot={...data,results:[...(data.results||[])]},approved=[],held=[];
 for(const row of proposals){
  if(!RULES[row?.tournamentId])continue;
  let w,cp;
  for(const [key,state] of Object.entries(checkpoints||{})){
   if(state?.proposals?.some(x=>x.id===row.id)){w=byKey.get(key);cp=state;break}
  }
  if(!w){held.push({id:row.id,reason:'対象の公式開催枠の保存順位表がありません'});continue}
  const result=decide(row,w,cp,snapshot);
  if(result.approved){approved.push(result.record);snapshot.results.push(result.record)}
  else held.push({id:row.id,reason:result.reason});
 }
 return {approved,held};
}
module.exports={RULES,payout,nvidiaWindow,sameSession,decide,evaluate};
