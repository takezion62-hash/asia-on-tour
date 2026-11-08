'use strict';
// Epic-rule-verified duo Round 1 results. Qualifying != merely participating.
// Cash is $0 in Round 1; never infer Round 2 winnings from these standings.
const {verifiedPartialPage,FOUR_HOURS,sameScannedCandidate}=require('./verified-partial-page.cjs');
const RULES=Object.freeze(Object.fromEntries(require('../tournament-rules.json').rules
 .filter(r=>r.autoApproval==='verified-duo-qualifier-only').map(r=>[r.id,r])));
const decline=reason=>({approved:false,reason});
const members=r=>Array.isArray(r?.players)?r.players:[r?.player];
const rosterKey=r=>members(r).slice().sort((a,b)=>a.localeCompare(b,'ja')).join('|');
function roundInfo(win){
 const rule=RULES[win?.tournamentId];
 if(!rule||win.seasonId!==rule.seasonId||!rule.eventIds.includes(win.eventId)||
  win.kind!==(rule.series==='cash-cup'?'参加確認':'予選')||win.series!==rule.series||
  !Object.hasOwn(rule.advance,win.region))return null;
 const escaped=win.eventId.replace(/[.*+?^$\{\}()|[\]\\]/g,'\\$&');
 const m=win.windowId?.match(new RegExp('^'+escaped+'_Event([1-9][0-9]*)Round1_'+win.region+'$'));
 return m?{rule,event:Number(m[1]),cutoff:rule.advance[win.region]}:null;
}
function sameRound(a,b){
 if(a.date!==b.date||a.region!==b.region||a.tournamentId!==b.tournamentId||
  rosterKey(a)!==rosterKey(b))return false;
 let ar=null,br=null;
 try{ar=new URL(a.source).searchParams.get('round')}catch{}
 try{br=new URL(b.source).searchParams.get('round')}catch{}
 if(ar&&br)return ar===br;
 const sig=x=>{
  const m=String(x.round||'').match(/Event\s*([1-9][0-9]*).*Round\s*([12])/i);
  return m?m[1]+'/'+m[2]:null;
 };
 const left=sig(a),right=sig(b);
 return !left||!right||left===right;
}
function decide(row,win,cp,data,now=Date.now()){
 const info=roundInfo(win),rule=info?.rule;
 if(!rule)return decline('S36 Console DuosまたはS43 Reload ZB Duosの登録済みRound1ではありません');
 const recent=rule.series==='cash-cup';
 if(!row||row.verified!==true||!/^auto-s[0-9]+-[a-f0-9]{12}$/.test(row.id||'')||
  row.seasonId!==rule.seasonId||row.tournamentId!==rule.id||
  row.kind!==(recent?'参加確認':'予選')||
  row.prize!==(recent?null:0)||Boolean(row.reviewOnly)!==recent)
  return decline('本人ID確認済みの公式予選候補ではありません');
 if(!cp||cp.rankingOrderValid!==true||!Array.isArray(cp.proposals)||
  !cp.proposals.some(x=>sameScannedCandidate(x,row))||
  (!cp.complete&&!verifiedPartialPage(row,win,cp,now)))
  return decline('順位表の連続性・取得済みページ・終了後の成熟期間が確認できません');
 // A complete snapshot must still be taken after the session settled.
 if(!Number.isFinite(win.end)||now-win.end<FOUR_HOURS||!Number.isSafeInteger(row.rank)||row.rank<1)
  return decline('終了時刻または確定順位が確認できません');
 const catalog=data.tournaments?.catalog?.find(x=>x.id===rule.id);
 if(!catalog||catalog.seasonId!==rule.seasonId||catalog.team!=='duo'||
  catalog.series!==rule.series||catalog.name!==row.event||
  !catalog.sourceEventIds?.includes(win.eventId)||
  row.region!==win.region||row.date!==win.dateJst||row.round!==win.round||
  row.seasonId!==win.seasonId)
  return decline('大会ID・地域・日付・ラウンドの対応が不一致');
 const expectedRound=recent?'Event '+info.event+' · Round 1 / 参加確認':
  'Event '+info.event+' · Round 1 / 予選';
 if(win.round!==expectedRound)return decline('公式Round1以外の開催枠');
 const people=members(row);
 if(people.length!==2||new Set(people).size!==2||row.player!==people.join(' / ')||
  people.some(name=>!data.players?.candidates?.some(x=>x.name===name)))
  return decline('両選手の名鑑照合が不一致');
 const known=(data.verifiedAccounts||[]).filter(x=>x.confirmed===true);
 if(people.some(name=>!known.some(x=>x.player===name)))return decline('本人Epicアカウント照合が未完了');
 if(recent){
  const ids=row.teamAccountIds;
  if(!Array.isArray(ids)||ids.length!==2||new Set(ids).size!==2||
   ids.some((id,i)=>typeof id!=='string'||!/^[0-9a-f]{32}$/.test(id)||
    !known.some(x=>x.player===people[i]&&x.epicAccountId===id)))
   return decline('チーム2名の確定Epic IDが不一致');
  const schedule=data.schedule?.sessions?.filter(s=>s.eventId===win.eventId&&
   s.region===win.region&&s.dateJst===win.dateJst&&
   s.round==='Event '+info.event+' · Round 1'&&s.stage==='予選'&&
   Date.parse(s.startUtc)===Date.parse(win.startUtc));
  if(schedule?.length!==1)return decline('Round1の公式カレンダー・開催開始時刻が不一致');
 }
 const cap=recent?rule.matchCaps['単一ラウンド']:rule.matchCaps['予選'];
 if(!Number.isSafeInteger(row.matches)||row.matches<1||row.matches>cap||
  !Number.isSafeInteger(row.points)||row.points<0||
  !Number.isSafeInteger(row.kills)||row.kills<0||
  !Number.isSafeInteger(row.vrs)||row.vrs<0||row.vrs>row.matches)
  return decline('公式試合数上限または成績の値が不正');
 let url;
 try{url=new URL(row.source)}catch{}
 if(!url||url.protocol!=='https:'||url.hostname!=='www.fortnite.com'||
  url.username||url.password||url.hash||
  url.pathname!=='/competitive/events/'+encodeURIComponent(win.eventId)+'/'||
  url.searchParams.get('region')!==win.region||
  url.searchParams.get('round')!==win.windowId)
  return decline('公式Epic順位表と出典URLが不一致');
 if(data.results?.some(old=>old.id===row.id||sameRound(old,row)))
  return decline('既存の同一選手・同一開催ラウンドの戦績');
 const {reviewOnly,reviewReason,teamAccountIds,note,...base}=row;
 const qualified=row.rank<=info.cutoff;
 const result={...base,kind:'予選',
  round:'Event '+info.event+' · Round 1 / '+(qualified?'予選突破':'予選'),
  prize:0,note:rule.seasonId+' '+catalog.name+' '+win.region+'の公式Round1順位表'+
   row.rank+'位を確認。公式突破条件は各地域上位'+info.cutoff+'組。'+
   (qualified?'決勝進出条件を満たした予選突破記録。':'突破圏外だが参加・順位を確認した予選戦績。')+
   '予選は現金賞金$0。2名の名鑑・Epic IDを照合。Round2の賞金や受給資格は未確認。規則: '+rule.source};
 return {approved:true,record:result,rule:rule.source,qualified};
}
function evaluate(proposals,windows,checkpoints,data){
 const winByKey=new Map(windows.map(w=>[w.key,w]));
 const records=[...(data.results||[])],approved=[],held=[];
 for(const row of proposals){
  if(!RULES[row.tournamentId])continue;
  const matches=Object.entries(checkpoints||{}).filter(([,cp])=>cp?.proposals?.some(x=>x.id===row.id));
  if(matches.length!==1){held.push({id:row.id,reason:'大会チェックポイントが重複または欠落'});continue}
  const [[key,cp]]=matches,win=winByKey.get(key);
  const out=decide(row,win,cp,{...data,results:records});
  if(out.approved){approved.push(out.record);records.push(out.record)}
  else held.push({id:row.id,reason:out.reason});
 }
 return {approved,held};
}
module.exports={RULES,roundInfo,sameRound,decide,evaluate};
