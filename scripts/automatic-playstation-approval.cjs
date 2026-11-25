'use strict';
const {selectRules,matchesWindow}=require('./tournament-approval-policy.cjs');
const {individualRankPrize,matchCap,qualifies,namedRound,payingRank}=require('./tournament-rule-engine.cjs');
// Epic 2026-11-20 S43 PlayStation Cup official regulations.
// Independently classify PS4/PS5 Solo Battle Royale and Zero Build.
// Only source-backed known Epic accounts and complete, mature scoreboard
// checkpoints qualify. Finals pay by PLACEMENT, never by VR count.
const {sameScannedCandidate,FOUR_HOURS,verifiedRankBoundary,verifiedQualification}=require('./verified-partial-page.cjs');
const RULES=selectRules('playstation');
const REGIONS=new Set(['ME','EU','NAC','NAW','OCE','BR']); // ASIA is not an overseas region.
const decline=reason=>({approved:false,reason});
const payout=individualRankPrize;
function stageFor(win){
 const rule=RULES[win?.tournamentId];
 if(!rule||rule.seasonId!=='S43'||!matchesWindow(rule,win,'参加確認'))return null;
 const stage=namedRound(rule,win);
 return stage?{rule,final:stage.stage==='賞金決勝'}:null;
}
function sameSession(a,b){
 if(a?.tournamentId!==b?.tournamentId||a?.region!==b?.region||
   a?.date!==b?.date||a?.player!==b?.player)return false;
 const sourceRound=row=>{try{return new URL(row.source).searchParams.get('round')}catch{return null}};
 const ra=sourceRound(a),rb=sourceRound(b);
 if(ra&&rb)return ra===rb;
 // Do not turn a manually reported, source-unclear match into a duplicate.
 return String(a.round||'').includes('Final')===String(b.round||'').includes('Final');
}
function prizePrefixEvidence(row,win,cp,now=Date.now()){
 const stage=stageFor(win),rule=stage?.rule;
 if(!stage?.final||row?.tournamentId!==rule.id||row.seasonId!==win.seasonId||row.region!==win.region||
  row.date!==win.dateJst||row.round!==win.round||row.kind!=='参加確認'||row.verified!==true||
  row.reviewOnly!==true||row.prize!==null||cp?.complete!==false)return false;
 const amount=payout(rule,win.region,row.rank);
 return Number.isSafeInteger(amount)&&amount>0&&verifiedRankBoundary(row,win,cp,payingRank(rule,win.region),
  {now,requireEpicIds:true,unique:true});
}
function qualificationEvidence(row,win,cp,data,now=Date.now()){
 const stage=stageFor(win),rule=stage?.rule;
 return !!stage&&!stage.final&&row?.kind==='参加確認'&&row.reviewOnly===true&&row.prize===null&&
  verifiedQualification(row,win,cp,rule,rule.advance?.[win.region],{now,requireEpicIds:true})&&
  Array.isArray(row.teamAccountIds)&&require('./saved-candidate-recheck.cjs').identityProof(row,win,data.verifiedAccounts||[],'solo');
}
function decide(row,win,cp,data,now=Date.now()){
 const stage=stageFor(win),rule=stage?.rule;
 if(!stage)return decline('公式S43 PlayStation BR/ZBのRound1/Finalと一致しません');
 if(!row||row.verified!==true||row.reviewOnly!==true||
   row.kind!=='参加確認'||row.prize!==null||
   !/^auto-s43-[a-f0-9]{12}$/.test(row.id||''))
   return decline('公開前のEpic公式スキャン候補属性が不一致');
 const prefix=prizePrefixEvidence(row,win,cp,now);
 const qualifierPrefix=qualificationEvidence(row,win,cp,data,now);
 if(!prefix&&!qualifierPrefix&&(!cp||cp.complete!==true||cp.rankingOrderValid!==true||
   cp.epicIdsRetained!==true||!Array.isArray(cp.proposals)||
   cp.proposals.filter(x=>sameScannedCandidate(x,row)).length!==1))
   return decline('完了した保存済み順位表・本人Epic IDの連続性が未確認');
 if(!Number.isFinite(win.end)||now-win.end<FOUR_HOURS||
   !Number.isFinite(Date.parse(win.startUtc))||Date.parse(win.startUtc)>=win.end)
   return decline('開催終了後の確定時間が未経過');
 const t=data.tournaments?.catalog?.find(x=>x.id===rule.id);
 if(!t||t.series!=='playstation-cup'||t.team!=='solo'||t.platform!=='playstation'||
   t.mode!==(rule.mode)||!t.sourceEventIds?.includes(win.eventId)||
   t.name!==row.event||t.seasonId!==rule.seasonId||
   row.seasonId!==rule.seasonId||row.tournamentId!==rule.id||
   row.region!==win.region||row.date!==win.dateJst||
   row.round!==win.round||row.kind!==win.kind)
   return decline('BR/ZB大会ID・本人結果の日付/形式が一致しません');
 const names=Array.isArray(row.players)?row.players:[row.player];
 const ids=row.teamAccountIds;
 if(names.length!==1||names[0]!==row.player||
   !data.players?.candidates?.some(x=>x.name===row.player)||
   !Array.isArray(ids)||ids.length!==1||typeof ids[0]!=='string'||
   !/^[0-9a-f]{32}$/.test(ids[0]))
   return decline('選手名鑑・ソロEpic IDが未確認');
 const accounts=(data.verifiedAccounts||[]).filter(x=>
   x.confirmed===true&&x.epicAccountId===ids[0]&&x.player===row.player);
 if(accounts.length!==1)return decline('既存選手と確定EpicアカウントIDが一致しません');
 const cap=matchCap(rule,stage.final?'賞金決勝':'予選');
 if(cap===null)return decline('公式試合数上限が未登録');
 if(!Number.isSafeInteger(row.rank)||row.rank<1||
   !Number.isSafeInteger(row.points)||row.points<0||
   !Number.isSafeInteger(row.kills)||row.kills<0||
   !Number.isSafeInteger(row.vrs)||row.vrs<0||
   !Number.isSafeInteger(row.matches)||row.matches<1||row.matches>cap||
   row.vrs>row.matches)
   return decline('順位・得点・試合数・キル・VR数が公式上限外');
 let source;
 try{source=new URL(row.source)}catch{}
 if(!source||source.protocol!=='https:'||source.hostname!=='www.fortnite.com'||
   source.username||source.password||source.hash||
   source.pathname!=='/competitive/events/'+win.eventId+'/'||
   source.searchParams.get('region')!==win.region||
   source.searchParams.get('round')!==win.windowId||
   source.searchParams.size!==2)
   return decline('公式大会の開催枠・地域・URLが不一致');
 if(data.results?.some(old=>old.id===row.id||sameSession(old,row)))
   return decline('同一Epic選手・開催枠の戦績が掲載済み');
 const {reviewOnly,reviewReason,teamAccountIds,note,...base}=row;
 if(!stage.final){
   const qualified=qualifies(rule,win.region,row.rank);
   if(qualified===null)return decline('公式予選突破条件が未登録');
   return {approved:true,participation:!qualified,
     record:{...base,
       kind:qualified?'予選':'参加確認',
       round:'Qualifier / '+(qualified?'予選突破':'参加確認'),
       prize:0,
       note:'2026 PlayStation Cup '+rule.mode+' '+win.region+' 公式予選'+row.rank+
        '位。上位'+rule.advance[win.region]+'名だけが決勝進出。'+
        (qualified?'予選突破。':'決勝進出圏外の出場確認。')+
        '予選の現金賞金$0。8pt以上はFroggory Stanceスプレー対象だが配布状況は未確認。'+
        (qualifierPrefix&&cp.complete!==true?'BR/ZBを区別し、本人Epic ID・終了4時間後以降の連続順位表で通過ライン超過を確認（'+cp.pages+'/'+cp.totalPages+'ページ、全ページ未取得）。開催日時・重複を照合。規則: ':'BR/ZBを区別し、Epic ID・完了順位表・開催日時・重複を照合。規則: ')+rule.source},
     rule:rule.source};
 }
 const prize=payout(rule,win.region,row.rank);
 if(!Number.isSafeInteger(prize)||prize<0)return decline('決勝順位の地域別個人賞金表が不足');
 return {approved:true,participation:false,
   record:{...base,kind:'賞金決勝',round:'Final / 賞金決勝',
     prize,note:'2026 PlayStation Cup '+rule.mode+' '+win.region+'決勝'+row.rank+
      '位。公式Attachment Cの個人順位賞金$'+prize+
      '（VR '+row.vrs+'回とは独立）。'+
      (prefix?'終了4時間後以降の連続順位表が公式賞金圏（上位'+payingRank(rule,win.region)+'名）を越えたことを確認。取得済み'+cp.nextPage+'/'+cp.totalPages+'ページ（全ページ未取得）。Epic ID・公式開催枠・重複を照合。':'全順位表・Epic ID・公式開催枠・重複を照合。')+
      '資格確認・支払完了は未確認。規則: '+rule.source},
   rule:rule.source};
}
function evaluate(proposals,windows,checkpoints,data,now=Date.now()){
 const byKey=new Map((windows||[]).map(w=>[w.key,w]));
 const results=[...(data.results||[])],approved=[],held=[],participationIds=[];
 for(const row of proposals||[]){
   if(!RULES[row?.tournamentId])continue;
   const matches=Object.entries(checkpoints||{}).filter(([,cp])=>
     cp?.proposals?.some(x=>x.id===row.id));
   if(matches.length!==1){held.push({id:row.id,reason:'開催枠スナップショット重複または欠落'});continue}
   const [[key,cp]]=matches,win=byKey.get(key);
   const decision=decide(row,win,cp,{...data,results},now);
   if(decision.approved){
     approved.push(decision.record);results.push(decision.record);
     if(decision.participation)participationIds.push(decision.record.id);
   }else held.push({id:row.id,reason:decision.reason});
 }
 return {approved,held,participationIds};
}
module.exports={RULES,payout,stageFor,sameSession,prizePrefixEvidence,qualificationEvidence,decide,evaluate};
