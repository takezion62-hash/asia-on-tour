'use strict';
// $1M Unreal Cup S39: official single-session duo prize ladder. Exact full leaderboard,
// all two Epic IDs and dated Epic window must match. Never count prizes from VR alone.
const RULES=Object.freeze(Object.fromEntries(require('../tournament-rules.json').rules
 .filter(x=>x.series==='unreal-cup'&&x.autoApproval==='verified-team-rank').map(x=>[x.id,x])));
const archive=require('../calendar-history/2025-12.json').sessions;
const roster=x=>Array.isArray(x?.players)&&x.players.length?x.players:[x?.player];
const key=x=>roster(x).slice().sort((a,b)=>a.localeCompare(b,'ja')).join('|');
const decline=reason=>({approved:false,reason});
function payout(rule,region,rank){
 if(!Number.isSafeInteger(rank)||rank<1)return null;
 const tiers=rule?.cashPrizes?.tiers?.[region];
 if(!Array.isArray(tiers)||!tiers.length)return null;
 const tier=tiers.find(t=>rank<=t.through);
 const team=tier?.perTeam??0;
 return {team,perPlayer:team/(rule.cashPrizes.teamSize||2)};
}
function unrealWindow(win){
 const rule=RULES[win?.tournamentId];
 if(!rule||win.series!=='unreal-cup'||win.seasonId!==rule.seasonId||
    win.eventId!=='S39_1MillionUnrealCup'||win.kind!=='参加確認'||
    win.tournamentId!==rule.id||!rule.eventIds.includes(win.eventId)||
    win.windowId!=='S39_1MillionUnrealCup_'+win.region||
    !['EU','NAC','NAW','BR','ME','OCE'].includes(win.region)||
    !rule.cashPrizes.tiers[win.region])return null;
 return rule;
}
function sameSession(left,right){
 if(left.tournamentId!==right.tournamentId||left.date!==right.date||
    left.region!==right.region||key(left)!==key(right))return false;
 // One official session per region/day for S39. A manually recorded row may use
 // a different round description but must still block duplicate cash.
 return true;
}
function decide(row,win,checkpoint,data){
 const rule=unrealWindow(win);
 if(!rule)return decline('S39 Unreal Cupの正確な大会・地域・開催枠ではありません');
 if(!row||row.id?.match(/^auto-s39-[a-f0-9]{12}$/)==null||row.verified!==true||
    row.reviewOnly!==true||row.kind!=='参加確認'||row.prize!==null)
   return decline('確認済みAPI候補の属性が不正');
 if(!checkpoint?.complete||checkpoint.rankingOrderValid!==true||
    !Number.isSafeInteger(checkpoint.nextPage)||checkpoint.nextPage!==checkpoint.totalPages||
    checkpoint.epicIdsRetained!==true||!Array.isArray(checkpoint.proposals)||
    !checkpoint.proposals.some(x=>JSON.stringify(x)===JSON.stringify(row)))
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
 if(matched.length!==1)return decline('2025年12月のEpic公式開催日時と一致する枠がありません');
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
    row.matches>rule.matchCaps['単一ラウンド']||row.vrs>row.matches)
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
    '公式開催枠、全順位ページの連続性、2人の確認済みEpic ID、重複を照合。受給資格や支払完了は未確認。規則: '+rule.source},
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
module.exports={RULES,payout,unrealWindow,sameSession,decide,evaluate};
