'use strict';
// Season-specific, source-backed console Duo award adapter. S36 and all
// other Duo series retain their former policies; no inferred VR payout.
const {selectRules,eventWindow}=require('./tournament-approval-policy.cjs');
const {advancementCutoff,validMatchCount,individualVrPrize}=require('./tournament-rule-engine.cjs');
const {sameScannedCandidate,verifiedQualifierPrefix}=require('./verified-partial-page.cjs');
const {identityProof,mature}=require('./saved-candidate-recheck.cjs');
const {MANIFEST}=require('./generic-review-only-core.cjs');
const {collision}=require('./manual-approval-core.cjs');
const SPECS=Object.freeze({
 'ch6s2-console-duos-victory':{season:'S35',event:'S35_VictoryDuosCup',source:'https://www.fortnite.com/news/fortnite-duos-console-victory-cash-cups-may-2025-official-rules'},
 'ch6s4-console-duos-victory':{season:'S37',event:'S37_ConsoleDuosCashCups',source:'https://www.fortnite.com/competitive/rules-guidelines/rules-library/fortnite-duos-console-victory-cash-cups-chapter-6-season-4-official-rules'}
});
const RULES=selectRules('consoleDuos'),isConsole=id=>Object.hasOwn(SPECS,id);
const roster=r=>Array.isArray(r?.players)&&r.players.length?r.players:[r?.player];
const decline=reason=>({approved:false,reason});
function stageFor(win){
 const rule=RULES[win?.tournamentId],spec=SPECS[win?.tournamentId];
 if(!rule||!spec||rule.seasonId!==spec.season||rule.team!=='duo'||rule.source!==spec.source||
  rule.eventIds?.length!==1||rule.eventIds[0]!==spec.event||win.eventId!==spec.event||
  rule.prizePerVictory!==100||rule.teamPrizePerVictory!==200||rule.matchCaps?.['予選']!==7||
  rule.matchCaps?.['賞金決勝']!==3)return null;
 const round=win.kind==='予選'?1:win.kind==='賞金決勝'?2:null;
 const parsed=round&&eventWindow(rule,win,{kind:win.kind,rounds:[round],optionalSeparator:true});
 if(!parsed||win.round!=='Event '+parsed.event+' · Round '+round+' / '+win.kind)return null;
 const cutoff=advancementCutoff(rule,win.region);
 if(cutoff!==({EU:500,NAC:500,NAW:250,ME:250,OCE:250,BR:250}[win.region]))return null;
 return {rule,round,event:parsed.event,cutoff,label:'Event '+parsed.event+' · Round '+round};
}
function overlaps(old,row,aliases={}){
 if(old.id===row.id)return true;
 if(old.tournamentId!==row.tournamentId||!isConsole(row.tournamentId)||old.date!==row.date||old.region!==row.region)return false;
 const stage=r=>String(r.round||'').match(/Event\s*(\d+).*Round\s*([12])/i);
 const a=stage(old),b=stage(row);
 if(a&&b&&(Number(a[1])!==Number(b[1])||a[2]!==b[2]))return false;
 if(collision(old,row,aliases))return true;
 const owners=new Map();
 for(const [name,values] of Object.entries(aliases||{}))for(const alias of values||[]){
  if(!owners.has(alias))owners.set(alias,new Set());
  owners.get(alias).add(name);
 }
 const names=r=>new Set([...roster(r),...(r.teamPlayers||[])].flatMap(n=>[n,...(owners.get(n)||[])]));
 const left=names(old),right=names(row);
 return old.rank===row.rank||[...right].some(n=>left.has(n))||
  (old.teamAccountIds||[]).some(id=>(row.teamAccountIds||[]).includes(id));
}
function sessionFor(win,sessions){
 const stage=stageFor(win);
 if(!stage)return null;
 const source='https://www.fortnite.com/competitive/events/'+win.eventId+'/?region='+win.region+'&round='+win.windowId;
 const matches=(sessions||[]).filter(s=>s.id===win.key&&s.sourceWindowId===win.windowId&&
  s.tournamentId===win.tournamentId&&s.seasonId===win.seasonId&&s.eventId===win.eventId&&
  s.name==='Duos Console Victory Cash Cup'&&s.series==='victory-cup'&&s.mode==='battle-royale'&&
  s.region===win.region&&s.dateJst===win.dateJst&&s.round===stage.label&&s.url===source&&
  s.stage===(stage.round===1?'予選':'決勝'));
 if(matches.length!==1)return null;
 const s=matches[0],start=Date.parse(s.startUtc),end=Date.parse(s.endUtc);
 if(!Number.isFinite(start)||!Number.isFinite(end)||end-start!==(stage.round===1?120:60)*60000||
  Date.parse(win.startUtc)!==start||win.end!==end)return null;
 return s;
}
function qualifierEvidence(row,win,cp,now){
 const stage=stageFor(win);
 if(stage?.round!==1)return false;
 return verifiedQualifierPrefix(row,win,cp,stage.cutoff,now);
}
function decide(row,win,cp,data,now=Date.now()){
 const stage=stageFor(win),rule=stage?.rule;
 if(!rule||!row||row.tournamentId!==rule.id||row.seasonId!==rule.seasonId||row.verified!==true||
  row.reviewOnly===true||row.kind!==win.kind||row.round!==win.round||row.date!==win.dateJst||row.region!==win.region)
  return decline('Console Duosの公式開催枠・ラウンド不一致');
 if((MANIFEST.held||[]).some(x=>x.id===row.id))return decline('明示保留中の本人確認');
 const cat=data.tournaments?.catalog?.find(t=>t.id===rule.id);
 if(!cat||cat.name!==row.event||cat.name!=='Duos Console Victory Cash Cup'||cat.seasonId!==rule.seasonId||
  cat.team!=='duo'||cat.series!=='victory-cup'||cat.mode!=='battle-royale'||!cat.sourceEventIds?.includes(win.eventId))
  return decline('大会カタログ不一致');
 if(!sessionFor(win,data.consoleCalendarSessions))return decline('保存公式カレンダーの開催日時・ラウンド未照合');
 const source='https://www.fortnite.com/competitive/events/'+win.eventId+'/?region='+row.region+'&round='+win.windowId;
 if(row.source!==source||win.key!=='epicgames_'+win.eventId+'_'+row.region+'/'+win.windowId)return decline('公式開催枠URL不一致');
 if(!Array.isArray(row.players)||row.players.length!==2||row.players.some(n=>!data.players?.candidates?.some(p=>p.name===n))||
  !Array.isArray(row.teamAccountIds)||!identityProof(row,win,data.verifiedAccounts||[],'duo'))return decline('2選手の元Epic ID・候補ID再照合が必要');
 if(!Number.isSafeInteger(row.rank)||row.rank<1||!['points','kills','vrs'].every(k=>Number.isSafeInteger(row[k])&&row[k]>=0)||
  !validMatchCount(rule,row.kind,row.matches)||row.vrs>row.matches)return decline('順位・試合数・成績の不一致');
 if(!Array.isArray(cp?.proposals)||cp.proposals.filter(p=>p.id===row.id).length!==1||
  !cp.proposals.some(p=>sameScannedCandidate(p,row)))return decline('保存済み順位表と候補が完全一致しない');
 if(!mature(cp,win,row,now)&&!qualifierEvidence(row,win,cp,now))return decline('成熟した連続順位表の取得が完了していません');
 if(data.results.some(old=>overlaps(old,row,data.players.confirmedAliases)))return decline('同一開催枠の既掲載チーム・混成チームとの重複疑い');
 const {reviewReason,reviewOnly,teamAccountIds,...record}=row;
 if(stage.round===1){
  if(row.prize!==0)return decline('予選賞金は$0である必要があります');
  const qualified=row.rank<=stage.cutoff;
  record.round=stage.label+' / '+(qualified?'予選突破':'予選');
  record.prize=0;record.prizePerPlayer=0;
  record.note='本人Epic ID2名・公式開催枠・保存順位表を照合。上位'+stage.cutoff+'組が進出。'+
   (qualified?'予選突破。':'突破圏外の予選順位。通過実績に加算しない。')+' 予選賞金$0。規則: '+rule.source;
 }else{
  if(row.prize!==null||row.rank>stage.cutoff||row.points!==row.vrs*100)
   return decline('決勝順位・100pt/VR・未確認賞金の整合性不足');
  const perPlayer=individualVrPrize(rule,row.vrs);
  if(perPlayer===null||perPlayer*2!==rule.teamPrizePerVictory*row.vrs)return decline('公式チーム賞金配分が不一致');
  record.prize=perPlayer*2;record.prizePerPlayer=perPlayer;
  record.note='本人Epic ID2名・公式開催枠・完全順位表で'+row.vrs+'VR（'+row.points+'pt）を照合。個人$'+perPlayer+
   '、チーム合計$'+record.prize+'。公式規則上の賞金、受給資格・支払完了は未確認。規則: '+rule.source;
 }
 return {approved:true,record,rule:rule.source};
}
function evaluate(rows,windows,checkpoints,data,now=Date.now()){
 const byKey=new Map(windows.map(w=>[w.key,w])),approved=[],held=[],results=[...data.results];
 const targets=new Set(rows.filter(r=>isConsole(r.tournamentId)).map(r=>r.id)),index=new Map();
 for(const [key,cp] of Object.entries(checkpoints||{}))for(const row of cp?.proposals||[]){
  if(!targets.has(row.id))continue;
  if(!index.has(row.id))index.set(row.id,[]);
  index.get(row.id).push({key,cp});
 }
 for(const row of rows){
  if(!isConsole(row.tournamentId))continue;
  const proof=index.get(row.id)||[];
  if(proof.length!==1){held.push({id:row.id,reason:'保存開催枠が重複または欠落'});continue}
  const {key,cp}=proof[0],out=decide(row,byKey.get(key),cp,{...data,results},now);
  if(out.approved){approved.push(out.record);results.push(out.record)}
  else held.push({id:row.id,reason:out.reason});
 }
 return {approved,held};
}
module.exports={RULES,isConsole,stageFor,sessionFor,qualifierEvidence,overlaps,decide,evaluate};
