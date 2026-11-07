'use strict';
// S43 Trios Performance Evaluation: exact EU/NAC Round 1 top 26 and Round 2
// personal $400 per VR. Legacy seasons and other event formats stay review-only.
const RULES=Object.freeze(Object.fromEntries(
 require('../tournament-rules.json').rules
 .filter(rule=>rule.series==='performance-evaluation'&&rule.autoApproval==='verified-performance-vr')
 .map(rule=>[rule.id,rule])
));
const roster=row=>Array.isArray(row?.players)&&row.players.length?row.players:[row?.player];
const teamSignature=row=>roster(row).slice().sort((a,b)=>a.localeCompare(b,'ja')).join('|');
const decline=reason=>({approved:false,reason});
function evaluationStage(win){
 const rule=RULES[win?.tournamentId];
 if(!rule||win.series!=='performance-evaluation'||win.kind!=='参加確認'||
    win.seasonId!==rule.seasonId||!rule.eventIds.includes(win.eventId)||
    typeof win.windowId!=='string')return null;
 const match=win.windowId.match(/^S43_PerformanceEvaluation_Event([1-9][0-9]*)Round([12])_(EU|NAC)$/);
 if(!match||match[3]!==win.region||!Object.hasOwn(rule.advance,win.region))return null;
 return {rule,event:Number(match[1]),round:Number(match[2])};
}
function qualifierCutoff(win){
 const state=evaluationStage(win);
 return state?.round===1?state.rule.advance[win.region]:null;
}
function sameAppearance(left,right){
 if(left.tournamentId!==right.tournamentId||left.date!==right.date||
    left.region!==right.region||teamSignature(left)!==teamSignature(right))return false;
 let a,b;
 try{a=new URL(left.source).searchParams.get('round')}catch{}
 try{b=new URL(right.source).searchParams.get('round')}catch{}
 if(a&&b&&a===b)return true;
 // Different rounds of one Event are separate results. Unknown round labels
 // are conservatively held so manual and automated rows never duplicate.
 const phase=x=>{
  const round=String(x.round||'');
  const event=round.match(/Event\s*([1-9][0-9]*)/i)?.[1];
  const stage=round.match(/Round\s*([12])/i)?.[1];
  return event&&stage?event+'/'+stage:null;
 };
 const pa=phase(left),pb=phase(right);
 return !pa||!pb||pa===pb;
}
function decide(row,win,checkpoint,data){
 const state=evaluationStage(win),rule=state?.rule;
 if(!rule)return decline('公式ルールで登録されたS43 EU/NAC Performance Evaluationではありません');
 if(!row?.reviewOnly||row.kind!=='参加確認'||row.prize!==null||row.verified!==true||
    !/^auto-s43-[0-9a-f]{12}$/.test(row.id||''))
  return decline('確定したAPI参加候補と一致しません');
 if(!checkpoint?.complete||checkpoint.rankingOrderValid!==true||
    !Array.isArray(checkpoint.proposals)||
    !checkpoint.proposals.some(p=>JSON.stringify(p)===JSON.stringify(row)))
  return decline('順位表の全取得または通過ラインまでの正しい並びが未確認');
 const tournament=data.tournaments?.catalog?.find(t=>t.id===rule.id);
 if(!tournament||tournament.name!==row.event||tournament.team!=='trio'||
    tournament.series!=='performance-evaluation'||tournament.seasonId!==rule.seasonId||
    !tournament.sourceEventIds.includes(win.eventId)||row.tournamentId!==win.tournamentId||
    row.seasonId!==win.seasonId||row.date!==win.dateJst||row.region!==win.region||
    row.kind!==win.kind||row.round!==win.round)
  return decline('大会形式・開催日・地域・ラウンドが一致しません');
 const scheduled=data.schedule?.sessions?.filter(s=>s.eventId===win.eventId&&
    s.seasonId===rule.seasonId&&s.name===tournament.name&&s.region===win.region&&
    s.dateJst===win.dateJst&&s.round==='Event '+state.event+' · Round '+state.round&&
    s.stage===(state.round===1?'予選':'決勝')&&
    Number.isFinite(Date.parse(win.startUtc))&&Date.parse(s.startUtc)===Date.parse(win.startUtc));
 if(!scheduled||scheduled.length!==1)return decline('開催回の公式カレンダー時刻を照合できません');
 const people=roster(row),ids=row.teamAccountIds,expected=3;
 if(people.length!==expected||new Set(people).size!==expected||
    row.player!==people.join(' / ')||
    people.some(name=>!data.players?.candidates?.some(p=>p.name===name))||
    !Array.isArray(ids)||ids.length!==expected||new Set(ids).size!==expected||
    ids.some(id=>typeof id!=='string'||!/^[0-9a-f]{32}$/.test(id)))
  return decline('全3名の選手・Epic IDが未確認');
 const accounts=new Map((data.verifiedAccounts||[])
    .filter(x=>x?.confirmed===true&&typeof x.epicAccountId==='string')
    .map(x=>[x.epicAccountId,x.player]));
 if(ids.some((id,i)=>accounts.get(id)!==people[i]))
  return decline('Epic IDと掲載選手名の照合が不一致');
 const limit=rule.matchCaps[state.round===1?'予選':'Performance決勝'];
 if(!Number.isSafeInteger(row.rank)||row.rank<1||
    !Number.isSafeInteger(row.points)||row.points<0||
    !Number.isSafeInteger(row.kills)||row.kills<0||
    !Number.isSafeInteger(row.vrs)||row.vrs<0||
    !Number.isSafeInteger(row.matches)||row.matches<1||row.matches>limit||
    row.vrs>row.matches)return decline('試合数または成績が開催枠の仕様と不一致');
 let source;
 try{source=new URL(row.source)}catch{}
 if(!source||source.protocol!=='https:'||source.hostname!=='www.fortnite.com'||
    source.username||source.password||source.hash||
    source.pathname!=='/competitive/events/'+encodeURIComponent(win.eventId)+'/'||
    source.searchParams.get('region')!==win.region||
    source.searchParams.get('round')!==win.windowId)
  return decline('Epic公式順位表の参照先を確認できません');
 if(data.results?.some(old=>old.id===row.id||sameAppearance(old,row)))
  return decline('同チーム・同じ開催ラウンドが既に公開済み');
 const {reviewOnly,reviewReason,teamAccountIds,note,...base}=row;
 let record;
 if(state.round===1){
   if(row.rank>rule.advance[win.region])return decline('上位26位に入っていない予選参加候補');
   record={...base,kind:'予選',
     round:win.round.replace(/\/\s*参加確認$/u,'/ 予選突破'),prize:0,
     note:'S43 Performance Evaluation '+win.region+'・Event '+state.event+
      'は予選上位26チームが決勝進出。公式順位表'+row.rank+
      '位と3名の確認済みEpic IDを照合。予選の現金賞金$0。イベント別通過条件: '+
      rule.evidence[0].url};
 }else{
   // In Round 2 only VRs earn points. The displayed 100 points per win are
   // checked separately from the actual VR count to catch incomplete data.
   if(row.points!==row.vrs*rule.finalWinPoints)
     return decline('Round 2の獲得ポイントとVR数に矛盾');
   const perPlayer=row.vrs*rule.prizePerVictory;
   record={...base,kind:'Performance決勝',
     round:win.round.replace(/\/\s*参加確認$/u,'/ Performance決勝'),
     prize:perPlayer*expected,prizePerPlayer:perPlayer,
     note:'S43 Performance Evaluation '+win.region+'・Event '+state.event+
      'の決勝'+row.vrs+'VRを確認。1VRにつき選手1人$'+rule.prizePerVictory+
      '、個人賞金$'+perPlayer+'、チーム総額$'+(perPlayer*expected)+
      '（公式規則上）。本人の受給資格審査・実際の支払いは未確認。規則: '+rule.source};
 }
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
  if(!win){held.push({id:row.id,reason:'対応する公式イベント枠がない'});continue}
  const result=decide(row,win,checkpoint,snapshot);
  if(result.approved){approved.push(result.record);snapshot.results.push(result.record)}
  else held.push({id:row.id,reason:result.reason});
 }
 return {approved,held};
}
module.exports={RULES,evaluationStage,qualifierCutoff,sameAppearance,decide,evaluate};
