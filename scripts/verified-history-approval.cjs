'use strict';
// Narrow, rule-backed auto approval. Only allow-listed historical events qualify.
// A zero-VR final can be recorded as $0 because the rules pay per final-round VR.
// Positive cash requires a season-specific verified payout rule; unknown events remain in manual review.
// Single source of truth: the same versioned official rules shown under SOURCES.
const {verifiedPartialPage,sameScannedCandidate}=require('./verified-partial-page.cjs');
const RULES=Object.freeze(Object.fromEntries(
 require('../tournament-rules.json').rules.filter(rule=>rule.series==='victory-cup')
  .map(rule=>[rule.id,Object.freeze(rule)])));
const roundId=x=>{
 const match=String(x||'').match(/(?:Event\s*(\d+)|Day\s*(\d+)).*Round\s*([12])/i);
 return match?(match[1]?'event'+Number(match[1]):'day'+Number(match[2]))+'/round'+match[3]:String(x||'');
};
const participants=r=>Array.isArray(r.players)&&r.players.length?r.players:[r.player];
const identity=r=>[r.date,r.region,r.tournamentId,roundId(r.round),participants(r).slice().sort().join('|')].join('::');
const decline=reason=>({approved:false,reason});
function decide(row,win,checkpoint,data){
 if(row?.reviewOnly===true||row?.kind==='参加確認'||win?.kind==='参加確認'||(win?.series&&win.series!=='victory-cup'))return decline('確認専用大会は自動承認不可');
 // A verified 0-VR final has $0 under official VR-only rules. Its observed
 // rows need not wait for thousands of unrelated leaderboard pages.
 // Qualifiers and positive-VR cash still require completed official scans.
 // Manual batch review may accept a qualifier actually seen in a mature,
 // contiguous saved prefix, but only with a verified official regional rule.
 // Scheduled auto-approval keeps its existing, stricter default.
 const observedQualifier=win?.allowPartialQualifier===true&&row?.kind==='予選'&&
   row.prize===0&&verifiedPartialPage(row,win,checkpoint);
 if(!checkpoint?.complete&&!(row.kind==='賞金決勝'&&row.vrs===0&&row.prize===null&&
      verifiedPartialPage(row,win,checkpoint))&&!observedQualifier)
  return decline('順位表の取得が完了していません');
 const rule=RULES[row.tournamentId];
 if(!rule)return decline('未検証のシーズンまたは大会');
 if(rule.autoApproval==='verified-duo-qualifier-only')return decline('デュオ予選は公式Round1専用検証で判定');
 const catalog=data.tournaments.catalog.find(x=>x.id===row.tournamentId);
 if(!catalog||catalog.team!==(rule.team||'solo')||catalog.series!=='victory-cup'||catalog.seasonId!==rule.seasonId)return decline('大会カタログ不一致');
 if(win.tournamentId!==row.tournamentId||win.seasonId!==rule.seasonId||row.seasonId!==rule.seasonId||!rule.eventIds.includes(win.eventId)||!catalog.sourceEventIds.includes(win.eventId))return decline('公式イベントID不一致');
 // Historical NA qualifier cutoffs cannot be mapped broadly to NAC.
 // Allow only exact, source-backed tournament date and Round1 window.
 const historicalNac=[rule.verifiedLegacyNacWindow,...(rule.verifiedLegacyNacExtraWindows||[])]
  .filter(Boolean);
 const verifiedNacWindow=historicalNac.find(w=>
  row.region==='NAC'&&row.kind==='予選'&&win.region==='NAC'&&win.kind==='予選'&&
  w.dateJst===row.date&&w.dateJst===win.dateJst&&w.windowId===win.windowId);
 const exactLegacyNacQualifier=Boolean(verifiedNacWindow);
 const qualifierCutoff=rule.advance[row.region]||
  (exactLegacyNacQualifier?verifiedNacWindow.cutoff:undefined);
 const oldNacZeroFinal=['S30','S31'].includes(rule.seasonId)&&rule.team==='solo'&&
  row.region==='NAC'&&row.kind==='賞金決勝'&&row.vrs===0&&row.prize===null;
 if(row.date!==win.dateJst||row.region!==win.region||
  (qualifierCutoff===undefined&&!oldNacZeroFinal)||
  row.round!==win.round||row.kind!==win.kind)
  return decline('開催日・地域・ラウンド不一致');
 if(oldNacZeroFinal&&(row.points!==0||checkpoint.rankingOrderValid!==true||
  !checkpoint.proposals.some(x=>sameScannedCandidate(x,row))))
  return decline('2024 NAC 0VR決勝の保存済み順位表・ポイント整合性が未確認');
 if(!row.id?.startsWith('auto-'+rule.seasonId.toLowerCase()+'-')||row.verified!==true||!Array.isArray(checkpoint.proposals)||!checkpoint.proposals.some(x=>x.id===row.id))return decline('照合済み候補ではありません');
 const lineup=participants(row),teamSize=rule.team==='squad'?4:1;
 if(lineup.length!==teamSize||new Set(lineup).size!==lineup.length
    ||lineup.some(name=>!data.players.candidates.some(x=>x.name===name))
    ||lineup.join(' / ')!==row.player)return decline('名鑑と照合できない選手');
 if(!Number.isSafeInteger(row.rank)||row.rank<1||!Number.isSafeInteger(row.points)||row.points<0||!Number.isSafeInteger(row.kills)||row.kills<0||!Number.isSafeInteger(row.vrs)||row.vrs<0||!Number.isSafeInteger(row.matches)||row.matches<1||row.vrs>row.matches)return decline('不正または未確定の成績');
 if(row.matches>rule.matchCaps[row.kind])return decline('公式試合数上限との矛盾');
 try{
  const source=new URL(row.source);
  const path='/competitive/events/'+encodeURIComponent(win.eventId)+'/';
  if(source.protocol!=='https:'||source.hostname!=='www.fortnite.com'||source.pathname!==path||source.searchParams.get('region')!==win.region||source.searchParams.get('round')!==win.windowId)return decline('出典・ラウンドURL不一致');
 }catch{return decline('出典URLを確認できません')}
 if(data.results.some(x=>x.id===row.id||identity(x)===identity(row)))return decline('既存の戦績');
 const rec={...row};
 if(row.kind==='予選'){
  if(qualifierCutoff===undefined||row.prize!==0)
   return decline('予選通過条件または賞金値不一致');
  rec.prize=0;
  if(row.rank>qualifierCutoff){
   // Only the Epic-verified S42 Solo Reload tournament can count an
   // out-of-cutoff Round 1 finish as participation without false qualification.
   // This award-free Round 1 row is never an earned prize or a Round 2 entry.
   if(rule.autoApproval!=='verified-qualifier-participation')
    return decline('予選突破圏外の参加記録は公式対象大会のみに限定');
   rec.round=win.round.replace(/\/ 予選$/,'/ 参加確認');
   rec.kind='参加確認';
   rec.note='Epic公式規則で'+row.region+'の予選突破は上位'+qualifierCutoff+
    '名。Osirionで'+row.rank+'位のEpic IDとRound 1出場・結果を確認。突破圏外につき「参加確認」のみ記録し、賞金$0。規則: '+rule.source;
  }else{
   rec.round=win.round.replace(/\/ 予選$/,'/ 予選突破');
   rec.kind='予選';
   const legacyEvidence=exactLegacyNacQualifier?
    ' 当該2024年NA Central開催枠の予選通過順位を別途照合: '+verifiedNacWindow.source:'';
   rec.note='Epic公式規則の予選突破条件に基づき'+row.region+'上位'+qualifierCutoff+
    '名が突破。Osirion順位表'+row.rank+'位のEpic IDと照合。予選賞金$0。規則: '+rule.source+
    legacyEvidence;
  }

 }else if(row.kind==='賞金決勝'){
  if(row.prize!==null)return decline('APIの賞金額は未確認のまま照合する必要があります');
  // Never guess dollars for a season without a verified payout rule.
  if(row.vrs>0&&(!Number.isSafeInteger(rule.prizePerVictory)||rule.prizePerVictory<=0))
   return decline('正確なVRごとの賞金規則が未登録');
  rec.round=win.round;
  rec.kind='賞金決勝';
  rec.prize=row.vrs*(rule.prizePerVictory||0);
  rec.note=row.vrs>0?
   'Epic公式規則で決勝VR1回あたり$'+rule.prizePerVictory+'。Osirionの'+row.vrs+
   'VRから規則上の獲得賞金$'+rec.prize+'を算定。本人資格審査・支払完了までは未確認。規則: '+rule.source:
   'Epic公式規則は決勝のVRごとに賞金を付与。Osirionで決勝0VRを確認したため現金賞金$0。規則: '+rule.source;
 }else return decline('対象外ラウンド');
 return {approved:true,record:rec,rule:rule.source};
}
function evaluate(proposals,windows,checkpoints,data){
 const lookup=new Map(windows.map(w=>[w.key,w]));
 const approved=[],held=[],seen=new Set();
 for(const x of proposals){
  let window=null,checkpoint=null;
  for(const [key,state] of Object.entries(checkpoints)){
   if(state?.proposals?.some(r=>r.id===x.id)){window=lookup.get(key);checkpoint=state;break}
  }
  if(!window){held.push({id:x.id,reason:'大会ウィンドウが見つかりません'});continue}
  const choice=decide(x,window,checkpoint,data);
  if(!choice.approved){held.push({id:x.id,reason:choice.reason});continue}
  const key=identity(choice.record);
  if(seen.has(key)){held.push({id:x.id,reason:'自動承認内の重複'});continue}
  seen.add(key);approved.push(choice.record);
 }
 return {approved,held};
}
module.exports={RULES,identity,decide,evaluate};
