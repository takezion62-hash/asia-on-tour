'use strict';
const {selectRules,eventWindow}=require('./tournament-approval-policy.cjs');
const {individualRankPrize,validMatchCount}=require('./tournament-rule-engine.cjs');
// S39 NVIDIA GeForce RTX Cup: exact single-session Solo cash payout.
// Confirm full official leaderboard, Epic account identity and archived event window.
// Hardware/cosmetic awards are not converted into cash or claimed as delivered.
const RULES=selectRules('nvidia');
const archive=require('../calendar-history/2025-12.json').sessions;
const REGIONS=['EU','NAC','NAW','BR','ME','OCE'];
const decline=reason=>({approved:false,reason});
const payout=individualRankPrize;
function nvidiaWindow(win){
 const rule=RULES[win?.tournamentId];
 if(!rule||win.eventId!=='S39_NvidiaCup'||win.round!=='単一開催枠 / 参加確認'||!eventWindow(rule,win,{format:'single'})||!rule.cashPrizes?.tiers?.[win.region])return null;
 return rule;
}
function sameSession(a,b){
 return a.tournamentId===b.tournamentId&&a.date===b.date&&
   a.region===b.region&&(a.player===b.player||a.rank===b.rank);
}
function decide(row,win,checkpoint,data){
 const rule=nvidiaWindow(win);
 if(!rule)return decline('登録済みのS39 NVIDIA大会・地域・開催枠に一致しません');
 if(!row||!/^auto-s39-[0-9a-f]{12}$/.test(row.id||'')||
   row.verified!==true||row.reviewOnly!==true||
   row.kind!=='参加確認'||row.prize!==null)
   return decline('確認済みAPI参加候補の属性が不正');
 if(!checkpoint?.complete||checkpoint.rankingOrderValid!==true||
   checkpoint.epicIdsRetained!==true||
   !Number.isSafeInteger(checkpoint.nextPage)||
   !Number.isSafeInteger(checkpoint.totalPages)||
   checkpoint.totalPages<1||checkpoint.nextPage!==checkpoint.totalPages||
   !Array.isArray(checkpoint.proposals)||
   !checkpoint.proposals.some(x=>JSON.stringify(x)===JSON.stringify(row)))
   return decline('全ページ連続の順位表・Epic ID付完全スナップショットが未確認');
 const catalog=data.tournaments?.catalog?.find(x=>x.id===rule.id);
 if(!catalog||catalog.name!==row.event||catalog.team!=='solo'||
   catalog.series!=='nvidia-cup'||catalog.seasonId!==rule.seasonId||
   !catalog.sourceEventIds.includes(win.eventId)||
   row.tournamentId!==win.tournamentId||row.seasonId!==win.seasonId||
   row.date!==win.dateJst||row.region!==win.region||
   row.round!==win.round||row.kind!==win.kind)
   return decline('大会カタログ・日付・地域・選手結果が不一致');
 const sessions=archive.filter(s=>s.eventId===win.eventId&&
   s.tournamentId===rule.id&&s.seasonId===rule.seasonId&&
   s.name===catalog.name&&s.region===win.region&&
   s.sourceWindowId===win.windowId&&s.dateJst===win.dateJst&&
   s.stage==='単一ラウンド'&&
   Date.parse(s.startUtc)===Date.parse(win.startUtc)&&
   Date.parse(s.endUtc)===win.end);
 if(sessions.length!==1)return decline('公式アーカイブの開始・終了時刻を照合できません');
 const names=Array.isArray(row.players)?row.players:[row.player];
 const ids=row.teamAccountIds;
 if(names.length!==1||names[0]!==row.player||
   !data.players?.candidates?.some(p=>p.name===row.player)||
   !Array.isArray(ids)||ids.length!==1||
   typeof ids[0]!=='string'||!/^[0-9a-f]{32}$/.test(ids[0]))
   return decline('名鑑のソロ選手・元Epic IDが未確認');
 const matched=(data.verifiedAccounts||[]).filter(a=>a.confirmed===true&&a.epicAccountId===ids[0]);
 if(matched.length!==1||matched[0].player!==row.player)
   return decline('確認済みEpic IDが選手本人と一致しません');
 if(!Number.isSafeInteger(row.rank)||row.rank<1||
   !Number.isSafeInteger(row.points)||row.points<0||
   !Number.isSafeInteger(row.kills)||row.kills<0||
   !Number.isSafeInteger(row.vrs)||row.vrs<0||
   !Number.isSafeInteger(row.matches)||row.matches<1||
   !validMatchCount(rule,'単一ラウンド',row.matches)||row.vrs>row.matches)
   return decline('順位・ポイント・キル・VR・試合数が不正');
 let url;
 try{url=new URL(row.source)}catch{}
 if(!url||url.protocol!=='https:'||url.hostname!=='www.fortnite.com'||
   url.username||url.password||url.hash||
   url.pathname!=='/competitive/events/S39_NvidiaCup/'||
   url.searchParams.get('region')!==win.region||
   url.searchParams.get('round')!==win.windowId)
   return decline('Epic公式順位表の地域・開催回が不一致');
 const prize=payout(rule,win.region,row.rank);
 if(!Number.isSafeInteger(prize)||prize<0)
   return decline('地域別の公式個人賞金表が未登録');
 if((data.results||[]).some(old=>old.id===row.id||sameSession(old,row)))
   return decline('同一大会の同一人物または順位が掲載済み');
 const {reviewOnly,reviewReason,teamAccountIds,note,...base}=row;
 return {approved:true,record:{...base,
   kind:'賞金決勝',round:'Session 1 / 賞金決勝',prize,
   note:'2025 NVIDIA GeForce RTX Cup '+win.region+' '+row.rank+'位。'+
     (prize?'Epic公式個人賞金$'+prize+'を順位で照合。':'公式賞金圏外のため現金$0。')+
     '全ページ・公式日時・本人Epic ID・既存記録との重複を検査。'+
     'GPU・コスメ報酬の受取および現金の支払完了は未確認。公式規則: '+rule.source},
   rule:rule.source};
}
function evaluate(proposals,windows,checkpoints,data){
 const byWindow=new Map(windows.map(w=>[w.key,w])),approved=[],held=[];
 const snapshot={...data,results:[...(data.results||[])]};
 for(const row of proposals){
  if(!RULES[row?.tournamentId])continue;
  let win=null,cp=null;
  for(const [key,state] of Object.entries(checkpoints||{})){
   if(state?.proposals?.some(x=>x.id===row.id)){
    win=byWindow.get(key);cp=state;break;
   }
  }
  if(!win){held.push({id:row.id,reason:'開催枠の順位表スナップショットなし'});continue}
  const result=decide(row,win,cp,snapshot);
  if(result.approved){approved.push(result.record);snapshot.results.push(result.record)}
  else held.push({id:row.id,reason:result.reason});
 }
 return {approved,held};
}
module.exports={RULES,payout,nvidiaWindow,sameSession,decide,evaluate};
