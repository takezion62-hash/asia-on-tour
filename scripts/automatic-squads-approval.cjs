'use strict';
// Only the registered S43 Squads BR rules; never use the generic solo VR route.
const {selectRules,eventWindow}=require('./tournament-approval-policy.cjs');
const {advancementCutoff,validMatchCount,individualVrPrize}=require('./tournament-rule-engine.cjs');
const {sameScannedCandidate,verifiedPartialPage,FOUR_HOURS}=require('./verified-partial-page.cjs');
const {identityProof,mature}=require('./saved-candidate-recheck.cjs');
const {MANIFEST}=require('./generic-review-only-core.cjs');
const {collision}=require('./manual-approval-core.cjs');
const ID='ch7s5-squads-victory-cup',EVENT='S43_SquadsVictoryCup';
const RULES=selectRules('squads'),RULE=RULES[ID];
const SOURCE='https://www.fortnite.com/competitive/rules-guidelines/rules-library/fortnite-squads-victory-cup-chapter-7-mini-season-official-rules';
const regions=['EU','NAC','NAW','ME','OCE','BR'];
const roster=r=>Array.isArray(r?.players)&&r.players.length?r.players:[r?.player];
const decline=reason=>({approved:false,reason});
function stageFor(win){
 if(!RULE||RULE.id!==ID||RULE.source!==SOURCE||RULE.seasonId!=='S43'||RULE.team!=='squad'||
  RULE.prizePerVictory!==50||RULE.teamPrizePerVictory!==200||RULE.finalWinPoints!==100||
  RULE.matchCaps?.['予選']!==8||RULE.matchCaps?.['賞金決勝']!==3||
  !regions.includes(win?.region)||win.eventId!==EVENT)return null;
 const round=win.kind==='予選'?1:win.kind==='賞金決勝'?2:null;
 if(!round)return null;
 const parsed=eventWindow(RULE,win,{kind:win.kind,rounds:[round],optionalSeparator:true});
 if(!parsed||win.round!=='Event '+parsed.event+' · Round '+round+' / '+win.kind)return null;
 const cutoff=advancementCutoff(RULE,win.region);
 if(cutoff!==({EU:300,NAC:200,NAW:120,ME:120,OCE:120,BR:120}[win.region]))return null;
 return {round,event:parsed.event,cutoff,label:'Event '+parsed.event+' · Round '+round};
}
// Conservative collision guard includes mixed-region/manual single-player
// records, even if the old source is Tracker or team roster was shortened.
function overlaps(old,row,aliases={}){
 if(old.id===row.id)return true;
 if(old.tournamentId!==ID||old.date!==row.date||old.region!==row.region)return false;
 if(collision(old,row,aliases))return true;
 const stage=r=>String(r.round||'').match(/Event\s*(\d+).*Round\s*([12])/i);
 const a=stage(old),b=stage(row);
 if(a&&b&&(Number(a[1])!==Number(b[1])||a[2]!==b[2]))return false;
 const nameOwners=new Map();
 for(const [name,values] of Object.entries(aliases))for(const alias of values||[]){
  if(!nameOwners.has(alias))nameOwners.set(alias,new Set());
  nameOwners.get(alias).add(name);
 }
 const names=r=>new Set([...roster(r),...(r.teamPlayers||[])].flatMap(n=>[n,...(nameOwners.get(n)||[])]));
 const left=names(old),right=names(row);
 return old.rank===row.rank||[...right].some(n=>left.has(n))||
  (old.teamAccountIds||[]).some(id=>(row.teamAccountIds||[]).includes(id));
}
function sessionFor(win,schedule){
 const stage=stageFor(win);
 if(!stage)return null;
 const matches=(schedule?.sessions||[]).filter(s=>s.seasonId==='S43'&&s.eventId===EVENT&&
  s.name==='Squads Victory Cup Battle Royale'&&s.series==='victory-cup'&&s.mode==='battle-royale'&&
  s.region===win.region&&s.dateJst===win.dateJst&&s.round===stage.label&&
  s.stage===(stage.round===1?'予選':'決勝'));
 if(matches.length!==1)return null;
 const s=matches[0],start=Date.parse(s.startUtc),duration=(stage.round===1?120:60)*60000;
 if(!Number.isFinite(start)||Date.parse(win.startUtc)!==start||win.end!==start+duration||
  (s.endUtc!==undefined&&Date.parse(s.endUtc)!==win.end)||
  (s.sourceWindowId!==undefined&&s.sourceWindowId!==win.windowId))return null;
 return s;
}
function decide(row,win,cp,data,now=Date.now()){
 const stage=stageFor(win);
 if(!stage||!row||row.tournamentId!==ID||row.seasonId!=='S43'||row.verified!==true||
  row.reviewOnly===true||row.kind!==win.kind||row.round!==win.round||row.date!==win.dateJst||row.region!==win.region)
  return decline('S43 Squadsの公式開催枠・ラウンドと不一致');
 if((MANIFEST.held||[]).some(x=>x.id===row.id))return decline('明示保留中の本人確認');
 const cat=data.tournaments?.catalog?.find(t=>t.id===ID);
 if(!cat||cat.name!==row.event||cat.seasonId!=='S43'||cat.team!=='squad'||cat.series!=='victory-cup'||
  cat.mode!=='battle-royale'||!cat.sourceEventIds?.includes(EVENT))return decline('大会カタログ不一致');
 if(!sessionFor(win,data.schedule))return decline('公式カレンダーの開催日時・ラウンド未照合');
 const source='https://www.fortnite.com/competitive/events/'+EVENT+'/?region='+row.region+'&round='+win.windowId;
 if(row.source!==source||win.key!=='epicgames_'+EVENT+'_'+row.region+'/'+win.windowId)return decline('公式開催枠URL不一致');
 if(!Array.isArray(row.players)||row.players.length!==4||row.players.some(n=>!data.players?.candidates?.some(p=>p.name===n))||
  !identityProof(row,win,data.verifiedAccounts||[],'squad'))return decline('4選手の元Epic ID・候補IDの再照合が必要');
 if(!Number.isSafeInteger(row.rank)||row.rank<1||!['points','kills','vrs'].every(k=>Number.isSafeInteger(row[k])&&row[k]>=0)||
  !validMatchCount(RULE,row.kind,row.matches)||row.vrs>row.matches)return decline('順位・試合数・成績の不一致');
 if(!Array.isArray(cp?.proposals)||cp.proposals.filter(p=>p.id===row.id&&sameScannedCandidate(p,row)).length!==1)
  return decline('保存済み順位表と候補が完全一致しない');
 // Historical qualifier scans can stop after crossing the official cutoff.
 // Such a checkpoint proves only the observed rank, not the complete board.
 const capped=stage.round===1&&cp.complete===true&&cp.nextPage<cp.totalPages&&cp.lastSeenRank>stage.cutoff&&row.rank<=stage.cutoff;
 const prefix=stage.round===1&&verifiedPartialPage(row,win,capped?{...cp,complete:false}:cp,now);
 if(!mature(cp,win,row,now)&&!prefix)return decline('成熟した連続順位表の取得が完了していません');
 if(data.results.some(old=>overlaps(old,row,data.players.confirmedAliases)))return decline('同一開催枠の既掲載チーム・混成チームとの重複疑い');
 const {reviewReason,reviewOnly,teamAccountIds,...record}=row;
 if(stage.round===1){
  if(row.prize!==0)return decline('予選賞金は$0である必要があります');
  const qualified=row.rank<=stage.cutoff;
  record.round=stage.label+' / '+(qualified?'予選突破':'予選');
  record.prize=0;record.prizePerPlayer=0;
  record.note='本人Epic ID4名・公式開催枠・保存順位表を照合。上位'+stage.cutoff+'チームが進出。'+
   (qualified?'予選突破。':'突破圏外の予選順位。通過実績に加算しない。')+' 予選賞金$0。規則: '+SOURCE;
 }else{
  if(row.prize!==null||row.rank>stage.cutoff||row.points!==row.vrs*RULE.finalWinPoints)
   return decline('決勝の順位・100pt/VR・未確認賞金の整合性不足');
  const perPlayer=individualVrPrize(RULE,row.vrs);
  if(perPlayer===null||perPlayer*4!==RULE.teamPrizePerVictory*row.vrs)return decline('公式チーム賞金配分が不一致');
  record.prize=perPlayer*4;record.prizePerPlayer=perPlayer;
  record.note='本人Epic ID4名・公式開催枠・完全順位表で'+row.vrs+'VR（'+row.points+'pt）を照合。個人$'+perPlayer+
   '、チーム合計$'+record.prize+'。公式規則上の賞金、受給資格・支払完了は未確認。規則: '+SOURCE;
 }
 return {approved:true,record,rule:SOURCE};
}
function evaluate(rows,windows,checkpoints,data,now=Date.now()){
 const byKey=new Map(windows.map(w=>[w.key,w])),approved=[],held=[],results=[...data.results];
 const targets=new Set(rows.filter(r=>r.tournamentId===ID).map(r=>r.id)),index=new Map();
 for(const [key,cp] of Object.entries(checkpoints||{}))for(const row of cp?.proposals||[]){
  if(!targets.has(row.id))continue;
  if(!index.has(row.id))index.set(row.id,[]);
  index.get(row.id).push({key,cp});
 }
 for(const row of rows){
  if(row.tournamentId!==ID)continue;
  const proof=index.get(row.id)||[];
  if(proof.length!==1){held.push({id:row.id,reason:'保存開催枠が重複または欠落'});continue}
  const {key,cp}=proof[0],out=decide(row,byKey.get(key),cp,{...data,results},now);
  if(out.approved){approved.push(out.record);results.push(out.record)}
  else held.push({id:row.id,reason:out.reason});
 }
 return {approved,held};
}
module.exports={ID,RULES,stageFor,sessionFor,overlaps,decide,evaluate};
