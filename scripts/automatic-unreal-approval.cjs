'use strict';
const {selectRules,eventWindow}=require('./tournament-approval-policy.cjs');
const {teamRankPrize,validMatchCount,payingRank}=require('./tournament-rule-engine.cjs');
const {verifiedRankBoundary}=require('./verified-partial-page.cjs');
// $1M Unreal Cup S39: official single-session duo prize ladder. Exact full leaderboard,
// all two Epic IDs and dated Epic window must match. Never count prizes from VR alone.
const RULES=selectRules('unreal');
const archive=[...require('../calendar-history/2025-12.json').sessions,
 ...require('../calendar-history/2026-01.json').sessions];
const roster=x=>Array.isArray(x?.players)&&x.players.length?x.players:[x?.player];
const key=x=>roster(x).slice().sort((a,b)=>a.localeCompare(b,'ja')).join('|');
const decline=reason=>({approved:false,reason});
const payout=teamRankPrize;
function unrealWindow(win){
 const rule=RULES[win?.tournamentId];
 if(!rule||win.eventId!=='S39_1MillionUnrealCup'||!eventWindow(rule,win,{format:'single'})||!rule.cashPrizes.tiers[win.region])return null;
 return rule;
}
function sameSession(left,right){
 if(left.tournamentId!==right.tournamentId||left.date!==right.date||
    left.region!==right.region||key(left)!==key(right))return false;
 // One official session per region/day for S39. A manually recorded row may use
 // a different round description but must still block duplicate cash.
 return true;
}
function prizePrefixEvidence(row,win,cp,now=Date.now()){
 const rule=unrealWindow(win);
 if(!rule||row?.tournamentId!==rule.id||row.seasonId!==win.seasonId||row.region!==win.region||
  row.date!==win.dateJst||row.round!==win.round||row.kind!=='参加確認'||row.verified!==true||
  row.reviewOnly!==true||row.prize!==null||cp?.complete!==false)return false;
 const award=payout(rule,win.region,row.rank);
 return !!award&&award.team>0&&verifiedRankBoundary(row,win,cp,payingRank(rule,win.region,'per-team'),
  {now,requireEpicIds:true,unique:true});
}
function decide(row,win,checkpoint,data,now=Date.now()){
 const rule=unrealWindow(win);
 if(!rule)return decline('S39 Unreal Cupの正確な大会・地域・開催枠ではありません');
 if(!row||row.id?.match(/^auto-s39-[a-f0-9]{12}$/)==null||row.verified!==true||
    row.reviewOnly!==true||row.kind!=='参加確認'||row.prize!==null)
   return decline('確認済みAPI候補の属性が不正');
 const prefix=prizePrefixEvidence(row,win,checkpoint,now);
 if(!prefix&&(!checkpoint?.complete||checkpoint.rankingOrderValid!==true||
    !Number.isSafeInteger(checkpoint.nextPage)||checkpoint.nextPage!==checkpoint.totalPages||
    checkpoint.epicIdsRetained!==true||!Array.isArray(checkpoint.proposals)||
    !checkpoint.proposals.some(x=>JSON.stringify(x)===JSON.stringify(row))))
   return decline('全ページ連続順位・本人Epic ID付きの完全なスナップショットが未確認');
 const tournament=data.tournaments?.catalog?.find(x=>x.id===rule.id);
 if(!tournament||tournament.name!==row.event||tournament.seasonId!==rule.seasonId||
    tournament.series!=='unreal-cup'||tournament.team!=='duo'||
    !tournament.sourceEventIds.includes(win.eventId)||row.tournamentId!==win.tournamentId||
    row.seasonId!==win.seasonId||row.date!==win.dateJst||
    row.region!==win.region||row.kind!==win.kind||row.round!==win.round)
   return decline('大会マスター・日付・地域・スコア行の不一致');
 const matched=archive.filter(s=>s.eventId===win.eventId&&s.tournamentId===rule.id&&
    s.seasonId===rule.seasonId&&s.name===tournament.name&&s.region===win.region&&
    s.sourceWindowId===win.windowId&&s.dateJst===win.dateJst&&
    s.stage==='単一ラウンド'&&Date.parse(s.startUtc)===Date.parse(win.startUtc)&&
    Date.parse(s.endUtc)===win.end);
 if(matched.length!==1)return decline('Epic公式アーカイブの開催日時と一致する枠がありません');
 const players=roster(row),ids=row.teamAccountIds;
 if(players.length!==2||row.player!==players.join(' / ')||new Set(players).size!==2||
    players.some(x=>!data.players?.candidates?.some(p=>p.name===x))||
    !Array.isArray(ids)||ids.length!==2||new Set(ids).size!==2||
    ids.some(id=>typeof id!=='string'||!/^[a-f0-9]{32}$/.test(id)))
   return decline('デュオ両者の名鑑・Epic IDが未確認');
 const accounts=new Map((data.verifiedAccounts||[]).filter(a=>a?.confirmed===true&&
    typeof a.epicAccountId==='string').map(a=>[a.epicAccountId,a.player]));
 if(ids.some((id,i)=>accounts.get(id)!==players[i]))return decline('2人のEpic IDと掲載名が一致しません');
 if(!Number.isSafeInteger(row.rank)||row.rank<1||!Number.isSafeInteger(row.points)||row.points<0||
    !Number.isSafeInteger(row.kills)||row.kills<0||
    !Number.isSafeInteger(row.vrs)||row.vrs<0||
    !Number.isSafeInteger(row.matches)||row.matches<1||
    !validMatchCount(rule,'単一ラウンド',row.matches)||row.vrs>row.matches)
   return decline('順位・得点・キル・VR・試合数に不整合');
 const award=payout(rule,win.region,row.rank);
 if(!award||!Number.isSafeInteger(award.team)||award.team<0||
    !Number.isSafeInteger(award.perPlayer)||award.perPlayer<0||
    award.perPlayer*2!==award.team)return decline('公式賞金表・個人配分が未登録');
 let u;
 try{u=new URL(row.source)}catch{}
 if(!u||u.protocol!=='https:'||u.hostname!=='www.fortnite.com'||
    u.username||u.password||u.hash||
    u.pathname!=='/competitive/events/S39_1MillionUnrealCup/'||
    u.searchParams.get('region')!==win.region||
    u.searchParams.get('round')!==win.windowId)
   return decline('Epic公式出典の地域・開催ウィンドウが不一致');
 if((data.results||[]).some(old=>old.id===row.id||sameSession(old,row)))
   return decline('同一デュオの同日同地域の大会成績は登録済み');
 const {reviewOnly,reviewReason,teamAccountIds,note,...base}=row;
 return {approved:true,record:{...base,round:'Session 1 / 賞金決勝',
   kind:'賞金決勝',prize:award.team,prizePerPlayer:award.perPlayer,
   note:'2025年$1 Million Unreal Cup '+win.region+' '+row.rank+'位。Epic公式のチーム賞金$'+
    award.team+'（2人それぞれ$'+award.perPlayer+'）。'+
    (award.team===0?'賞金圏外を$0で記録。':'規定の賞金獲得順位を公式規則で確認。')+
    (prefix?'終了4時間後以降の連続順位表が公式賞金圏（上位'+payingRank(rule,win.region,'per-team')+'組）を越えたことを確認。取得済み'+checkpoint.nextPage+'/'+checkpoint.totalPages+'ページ（全ページ未取得）。公式開催枠、2人の確認済みEpic ID、重複を照合。':'公式開催枠、全順位ページの連続性、2人の確認済みEpic ID、重複を照合。')+'受給資格や支払完了は未確認。規則: '+rule.source},
   rule:rule.source};
}
function evaluate(proposals,windows,checkpoints,data){
 const byWindow=new Map(windows.map(w=>[w.key,w])),approved=[],held=[];
 const snapshot={...data,results:[...(data.results||[])]};
 for(const row of proposals){
  if(!RULES[row?.tournamentId])continue;
  let win=null,cp=null;
  for(const [key,state] of Object.entries(checkpoints||{})){
   if(state?.proposals?.some(x=>x.id===row.id)){win=byWindow.get(key);cp=state;break}
  }
  if(!win){held.push({id:row.id,reason:'対象となる公式開催枠のチェックポイントなし'});continue}
  const choice=decide(row,win,cp,snapshot);
  if(choice.approved){approved.push(choice.record);snapshot.results.push(choice.record)}
  else held.push({id:row.id,reason:choice.reason});
 }
 return {approved,held};
}
module.exports={RULES,payout,unrealWindow,sameSession,prizePrefixEvidence,decide,evaluate};
