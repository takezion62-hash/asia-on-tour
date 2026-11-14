'use strict';
// Opt-in, tournament-rule-backed Cash Cup publication for verified teams, including prize-free finishing ranks.
// All other Cash Cups remain review-only until a complete official payout rule is registered.
const {verifiedPartialPage,FOUR_HOURS,sameScannedCandidate}=require('./verified-partial-page.cjs');
const {sameRound}=require('./automatic-duo-qualifier-approval.cjs');
const RULES=Object.freeze(Object.fromEntries(
 require('../tournament-rules.json').rules
  .filter(rule=>rule.series==='cash-cup'&&(rule.autoApproval==='verified-team-rank'||rule.cashFinalAutoApproval==='verified-duo-round2-rank'))
  .map(rule=>[rule.id,rule])
));
const people=row=>Array.isArray(row?.players)&&row.players.length?row.players:[row?.player];
const teamKey=row=>people(row).slice().sort((a,b)=>a.localeCompare(b,'ja')).join('|');
const decline=reason=>({approved:false,reason});
function cashPrize(rule,region,rank){
 if(!Number.isSafeInteger(rank)||rank<1)return null;
 const tiers=rule?.cashPrizes?.tiers?.[region];
 if(!Array.isArray(tiers)||!tiers.length)return null;
 // Ranges are inclusive: top #10 following top #5 covers sixth through tenth.
 for(const tier of tiers){
  if(rank<=tier.through)return tier.perPlayer;
 }
 // Rank beyond the last awarded place has no cash prize.
 return 0;
}
function cashLimitForWindow(win){
 const rule=RULES[win?.tournamentId];
 if(!rule||win.series!=='cash-cup'||win.kind!=='参加確認'||
  win.seasonId!==rule.seasonId||!rule.eventIds.includes(win.eventId))return null;
 if(typeof win.windowId!=='string'||typeof win.region!=='string')return null;
 const escaped=win.eventId.replace(/[.*+?^$\{\}()|[\]\\]/g,'\\$&');
 if(rule.cashFinalAutoApproval==='verified-duo-round2-rank'){
  const final=win.windowId.match(new RegExp('^'+escaped+'_Event([1-9][0-9]*)Round2_'+win.region+'$'));
  // The final has at most twenty qualified duos. Include unpaid finishers.
  return final&&rule.matchCaps['賞金決勝']===6?20:null;
 }
 const match=win.windowId.match(new RegExp('^'+escaped+'_Event([1-9][0-9]*)_'+win.region+'$'));
 const arenas=rule.id==='ch7s5-arenas-cash-cup'&&rule.seasonId==='S43'&&
   rule.team==='solo'&&rule.eventIds.length===1&&rule.eventIds[0]==='S43_ArenaCashCup'&&
   rule.rankedEligibility?.mode==='arenas-boxfights'&&
   rule.rankedEligibility?.minimumRank==='Platinum'&&
   rule.matchCaps?.['単一ラウンド']===12;
 if(!match||(!arenas&&!Object.hasOwn(rule.rankedEligibility,String(Number(match[1])))))return null;
 const tiers=rule.cashPrizes.tiers?.[win.region];
 return tiers?.length?tiers[tiers.length-1].through:null;
}
function sameEvent(a,b){
 if(a.tournamentId!==b.tournamentId||a.date!==b.date||a.region!==b.region||
  teamKey(a)!==teamKey(b))return false;
 let fromSource=null,toSource=null;
 try{fromSource=new URL(a.source).searchParams.get('round')}catch{}
 try{toSource=new URL(b.source).searchParams.get('round')}catch{}
 if(fromSource&&toSource&&fromSource===toSource)return true;
 // A pre-existing manual result without an event ID should never trigger
 // a duplicate cash award just because its round uses different wording.
 const getEvent=row=>String(row.round||'').match(/Event\s*([1-9][0-9]*)/i)?.[1];
 const ea=getEvent(a),eb=getEvent(b);
 return !ea||!eb||ea===eb;
}
// S43 Reload ZB Duos uses a separate Round 1 qualification rule. This
// approval covers only the six-match Round 2 and never reclassifies Round 1.
function decideReloadDuoFinal(row,win,checkpoint,data,now=Date.now()){
 const rule=RULES[row?.tournamentId];
 if(!rule||rule.cashFinalAutoApproval!=='verified-duo-round2-rank'||
   win?.series!=='cash-cup'||win?.kind!=='参加確認'||
   win.seasonId!==rule.seasonId||!rule.eventIds.includes(win.eventId)||
   row?.reviewOnly!==true||row?.kind!=='参加確認'||row?.prize!==null||
   row?.verified!==true||!/^auto-s43-[0-9a-f]{12}$/.test(row?.id||''))
  return decline('本人確認済みのS43 Reload ZB Duos決勝候補ではありません');
 const match=String(win.windowId||'').match(/^S43_ReloadZBDuosCashCup_Event([1-9][0-9]*)Round2_(EU|NAC|NAW|BR|ME|OCE)$/);
 if(!match||match[2]!==win.region||win.eventId!=='S43_ReloadZBDuosCashCup'||
   win.round!=='Event '+Number(match[1])+' · Round 2 / 参加確認'||
   cashLimitForWindow(win)!==20)
  return decline('公式決勝の開催枠・イベント回が不一致');
 if(!checkpoint?.complete||checkpoint.rankingOrderValid!==true||
   !Array.isArray(checkpoint.proposals)||
   !checkpoint.proposals.some(x=>sameScannedCandidate(x,row)))
  return decline('決勝の完全な公式順位表が確認できません');
 if(!Number.isFinite(win.end)||now-win.end<FOUR_HOURS)
  return decline('決勝終了後の確定期間が経過していません');
 const catalog=data.tournaments?.catalog?.find(x=>x.id===rule.id);
 if(!catalog||catalog.series!=='cash-cup'||catalog.team!=='duo'||
   catalog.seasonId!=='S43'||catalog.name!==row.event||
   !catalog.sourceEventIds?.includes(win.eventId)||
   row.tournamentId!==rule.id||row.seasonId!=='S43'||
   row.region!==win.region||row.date!==win.dateJst||
   row.round!==win.round||row.kind!==win.kind)
  return decline('大会名・地域・決勝ラウンド・開催日が一致しません');
 const session=data.schedule?.sessions?.filter(s=>
   s.eventId===win.eventId&&s.seasonId===rule.seasonId&&
   s.name===catalog.name&&s.region===win.region&&s.dateJst===win.dateJst&&
   s.round==='Event '+Number(match[1])+' · Round 2'&&s.stage==='決勝'&&
   Date.parse(s.startUtc)===Date.parse(win.startUtc));
 if(session?.length!==1)return decline('決勝の公式大会カレンダーを照合できません');
 const lineup=people(row),ids=row.teamAccountIds;
 if(lineup.length!==2||new Set(lineup).size!==2||
   row.player!==lineup.join(' / ')||
   lineup.some(name=>!data.players?.candidates?.some(p=>p.name===name))||
   !Array.isArray(ids)||ids.length!==2||new Set(ids).size!==2||
   ids.some(id=>typeof id!=='string'||!/^[0-9a-f]{32}$/.test(id)))
  return decline('デュオ2名の名鑑・Epic IDが不足しています');
 const known=new Map((data.verifiedAccounts||[])
  .filter(x=>x?.confirmed===true&&typeof x.epicAccountId==='string')
  .map(x=>[x.epicAccountId,x.player]));
 if(ids.some((id,i)=>known.get(id)!==lineup[i]))
  return decline('本人確認済みEpic IDと選手名が一致しません');
 if(!Number.isSafeInteger(row.rank)||row.rank<1||row.rank>20||
   !Number.isSafeInteger(row.matches)||row.matches<1||row.matches>6||
   !Number.isSafeInteger(row.points)||row.points<0||
   !Number.isSafeInteger(row.kills)||row.kills<0||
   !Number.isSafeInteger(row.vrs)||row.vrs<0||row.vrs>row.matches)
  return decline('公式決勝の順位・試合数・キル・VRが不正');
 let source;
 try{source=new URL(row.source)}catch{}
 if(!source||source.protocol!=='https:'||source.hostname!=='www.fortnite.com'||
   source.username||source.password||source.hash||
   source.pathname!=='/competitive/events/'+encodeURIComponent(win.eventId)+'/'||
   source.searchParams.get('round')!==win.windowId||
   source.searchParams.get('region')!==win.region)
  return decline('Epic公式決勝順位表のURLが一致しません');
 if(data.results?.some(old=>old.id===row.id||sameRound(old,row)))
  return decline('同じチーム・大会・決勝ラウンドが登録済み');
 const share=cashPrize(rule,win.region,row.rank);
 if(!Number.isSafeInteger(share)||share<0)
  return decline('地域別個人賞金が確定していません');
 const {reviewOnly,reviewReason,teamAccountIds,note,...base}=row;
 const teamCash=share*2;
 return {approved:true,record:{...base,
  round:'Event '+Number(match[1])+' · Round 2 / 賞金決勝',kind:'賞金決勝',
  prize:teamCash,prizePerPlayer:share,
  note:'S43 Reload ZB Duos Cash Cup '+win.region+' Event '+Number(match[1])+
   ' Round 2公式順位表'+row.rank+'位。個人賞金$'+share+
   '、デュオ合計$'+teamCash+'。'+(share===0?'賞金圏外のため$0。':'Epic Attachment Cの地域別順位賞金を適用。')+
   '本人Epic ID2名・全順位表・開催日時・公式規則を照合。受給資格と支払完了は未確認。規則: '+rule.source
 },rule:rule.source};
}
function decide(row,win,checkpoint,data){
 const rule=RULES[row?.tournamentId];
 if(!rule)return decline('公式賞金ルールが自動掲載対応として登録されていません');
 if(rule.cashFinalAutoApproval==='verified-duo-round2-rank')return decideReloadDuoFinal(row,win,checkpoint,data);
 if(!row?.reviewOnly||row.kind!=='参加確認'||row.prize!==null||row.verified!==true)
  return decline('確認済みのCash Cup参加候補ではありません');
 if(!/^auto-s[0-9]+-[a-f0-9]{12}$/.test(row.id||''))return decline('公式スキャン候補ID不一致');
 const cutoff=cashLimitForWindow(win);
 if(cutoff===null)return decline('開催枠・イベント番号・地域の公式条件が未確認');
 // Out-of-prize ranks pay $0 regardless of later pages. Do not grant cash
 // from a partial leaderboard; cash-eligible ranks still require completion.
 const zeroCash=cashPrize(rule,win?.region,row.rank)===0;
 if(checkpoint?.rankingOrderValid!==true||!Array.isArray(checkpoint?.proposals)||
  !checkpoint.proposals.some(x=>JSON.stringify(x)===JSON.stringify(row))||
  (!checkpoint.complete&&!(zeroCash&&verifiedPartialPage(row,win,checkpoint))))
  return decline('順位表の連続した上位順位の取得が完了していません');
 const catalog=data.tournaments?.catalog?.find(x=>x.id===row.tournamentId);
 if(!catalog||catalog.series!=='cash-cup'||catalog.team!==rule.team||
  catalog.seasonId!==rule.seasonId||catalog.name!==row.event||
  !catalog.sourceEventIds.includes(win.eventId))
  return decline('大会マスターのイベント・チーム形式が一致しません');
 if(win.tournamentId!==row.tournamentId||row.seasonId!==rule.seasonId||
  win.seasonId!==rule.seasonId||row.region!==win.region||
  row.date!==win.dateJst||row.round!==win.round||row.kind!==win.kind)
  return decline('開催日・地域・ラウンドが一致しません');
 const event=Number(win.windowId.match(/_Event([1-9][0-9]*)_/)[1]);
 const session=data.schedule?.sessions?.filter(s=>
  s.eventId===win.eventId&&s.seasonId===rule.seasonId&&
  s.name===catalog.name&&s.region===win.region&&s.dateJst===win.dateJst&&
  s.round==='Event '+event&&Number.isFinite(Date.parse(win.startUtc))&&
  Date.parse(s.startUtc)===Date.parse(win.startUtc));
 if(!session||session.length!==1||session[0].stage!=='単一ラウンド')
  return decline('公式大会カレンダーの開始日時・開催回が未照合');
 const lineup=people(row),expected={solo:1,duo:2,trio:3,squad:4}[rule.team];
 if(lineup.length!==expected||row.player!==lineup.join(' / ')||
  new Set(lineup).size!==expected||lineup.some(name=>!data.players?.candidates?.some(p=>p.name===name)))
  return decline('全チーム選手の名鑑照合が未完了');
 const ids=row.teamAccountIds;
 if(!Array.isArray(ids)||ids.length!==expected||new Set(ids).size!==expected||
  ids.some(id=>typeof id!=='string'||!/^[0-9a-f]{32}$/.test(id)))
  return decline('開催形式に必要なEpic IDが欠落または重複');
 const accounts=new Map((data.verifiedAccounts||[])
  .filter(x=>x?.confirmed===true&&typeof x.epicAccountId==='string')
  .map(x=>[x.epicAccountId,x.player]));
 if(ids.some((id,i)=>accounts.get(id)!==lineup[i]))
  return decline('Epic IDと選手名の対応が一致しません');
 const max=rule.matchCaps['単一ラウンド'];
 if(!Number.isSafeInteger(row.matches)||row.matches<1||row.matches>max||
  !Number.isSafeInteger(row.vrs)||row.vrs<0||row.vrs>row.matches||
  !Number.isSafeInteger(row.rank)||row.rank<1||
  !Number.isSafeInteger(row.points)||row.points<0||
  !Number.isSafeInteger(row.kills)||row.kills<0)
  return decline('公式試合数・入賞順位・キル・VR・ポイントの範囲外');
 const share=cashPrize(rule,win.region,row.rank);
 if(!Number.isSafeInteger(share)||share<0)return decline('対象地域の個人賞金ルールが未登録');
 let url;
 try{url=new URL(row.source)}catch{}
 if(!url||url.protocol!=='https:'||url.hostname!=='www.fortnite.com'||
  url.username||url.password||url.hash||
  url.pathname!=='/competitive/events/'+encodeURIComponent(win.eventId)+'/'||
  url.searchParams.get('round')!==win.windowId||
  url.searchParams.get('region')!==win.region)
  return decline('Epic公式開催枠と出典URLが不一致');
 if(data.results?.some(old=>old.id===row.id||sameEvent(old,row)))
  return decline('同一開催枠・同一チームがすでに掲載されています');
 const {reviewOnly,reviewReason,teamAccountIds,note,...base}=row;
 const cash=share*expected;
 const record={...base,round:row.round.replace(/\s*\/\s*参加確認$/u,' / 賞金決勝'),
  kind:'賞金決勝',prize:cash,prizePerPlayer:share,
  note:'Epic公式賞金規則で'+win.region+'・Event '+event+'の'+row.rank+
   '位は個人賞金USD '+share+'、チーム合計USD '+cash+'。'+
   (share===0?'賞金圏外のため現金賞金は0。':'公式地域別順位の賞金額を適用。')+
   '保存済みOsirion順位表、'+expected+
   '名の既知Epic ID、公式開催日時を照合済み。受給資格の審査・支払完了は未確認。規則: '+rule.source};
 return {approved:true,record,rule:rule.source};
}
function evaluate(proposals,windows,checkpoints,data){
 const lookup=new Map(windows.map(w=>[w.key,w])),approved=[],held=[];
 const snapshot={...data,results:[...(data.results||[])]};
 for(const row of proposals){
  if(!RULES[row.tournamentId])continue;
  let win=null,checkpoint=null;
  for(const [key,cp] of Object.entries(checkpoints||{})){
   if(cp?.proposals?.some(x=>x.id===row.id)){win=lookup.get(key);checkpoint=cp;break}
  }
  if(!win){held.push({id:row.id,reason:'該当公式大会枠なし'});continue}
  const decision=decide(row,win,checkpoint,snapshot);
  if(decision.approved){approved.push(decision.record);snapshot.results.push(decision.record)}
  else held.push({id:row.id,reason:decision.reason});
 }
 return {approved,held};
}
module.exports={RULES,cashPrize,cashLimitForWindow,sameEvent,decideReloadDuoFinal,decide,evaluate};
