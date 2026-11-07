'use strict';
// Automatic cosmetic publication is deliberately limited to exact Epic rank rules.
// Never infer cash, physical delivery, an unlisted event, or player identity.
const {CUT_OFFS,evaluate:evaluateRank}=require('./cosmetic-rank-rules.cjs');
const people=r=>Array.isArray(r?.players)&&r.players.length?r.players:[r?.player];
const signature=r=>people(r).slice().sort((a,b)=>a.localeCompare(b,'ja')).join('|');
const decline=reason=>({approved:false,reason});
function cutoffForWindow(win){
 const rule=CUT_OFFS[win?.tournamentId];
 if(!rule||win.series!=='skin-cup'||win.kind!=='参加確認'||win.seasonId!=='S43'
   ||win.eventId!==rule.eventId||win.windowId!==rule.eventId+'_'+win.region)return null;
 return Number.isSafeInteger(rule.ranks[win.region])?rule.ranks[win.region]:null;
}
function decide(row,win,checkpoint,data){
 if(!row?.reviewOnly||row.kind!=='参加確認'||row.prize!==null)return decline('スキン報酬判定の元データではありません');
 const cutoff=cutoffForWindow(win);
 if(cutoff===null)return decline('公式の順位条件を登録していない大会');
 if(!checkpoint?.complete||!Array.isArray(checkpoint.proposals)||!checkpoint.proposals.some(x=>x.id===row.id))
  return decline('対象順位表の安全な走査が完了していません');
 const catalog=data.tournaments.catalog.find(x=>x.id===row.tournamentId);
 if(!catalog||catalog.series!=='skin-cup'||catalog.seasonId!==win.seasonId||
   !catalog.sourceEventIds?.includes(win.eventId)||!['solo','duo'].includes(catalog.team))
  return decline('登録済み大会カタログと一致しません');
 if(row.tournamentId!==win.tournamentId||row.seasonId!==win.seasonId||row.date!==win.dateJst||
   row.region!==win.region||row.round!==win.round||row.event!==catalog.name)
  return decline('開催日・大会枠・地域が一致しません');
 const members=people(row),teamSize=catalog.team==='duo'?2:1;
 const known=new Set(data.players.candidates.map(x=>x.name));
 if(members.length!==teamSize||new Set(members).size!==members.length||
   members.some(name=>!known.has(name))||row.player!==members.join(' / '))
  return decline('全選手の本人確認が完了していません');
 const maxMatches=catalog.team==='duo'?11:8;
 if(!Number.isSafeInteger(row.matches)||row.matches<1||row.matches>maxMatches)
  return decline('公式試合数上限と一致しません');
 const outcome=evaluateRank(row);
 if(!outcome.eligible)return decline(outcome.reason);
 if(row.rank>cutoff)return decline('報酬順位の対象外');
 // Be conservative: do not create a second record for an existing attendance or
 // cosmetic row in this same single-session cup, even if its text label differs.
 if(data.results.some(existing=>existing.id===row.id||
   (existing.date===row.date&&existing.region===row.region&&
    existing.tournamentId===row.tournamentId&&signature(existing)===signature(row))))
  return decline('同一大会・同一選手の既存掲載があるため要照合');
 const {reviewOnly,reviewReason,...base}=row;
 const record={...base,round:'単一開催枠 / スキン獲得',kind:'スキン大会',prize:0,
  note:'Epic公式規則で'+row.region+'上位'+cutoff+'位がゲーム内スキン獲得対象。'+row.rank+
    '位を本人確認済みEpic ID・保存済み順位表と照合。現金賞金$0。現物賞品や配布完了は未確認。規則: '+outcome.rule};
 return {approved:true,record,rule:outcome.rule};
}
function evaluate(proposals,windows,checkpoints,data){
 const lookup=new Map(windows.map(w=>[w.key,w])),approved=[],held=[];
 const snapshot={...data,results:[...data.results]};
 for(const row of proposals){
  let win=null,checkpoint=null;
  for(const [key,cp] of Object.entries(checkpoints)){
   if(cp?.proposals?.some(x=>x.id===row.id)){win=lookup.get(key);checkpoint=cp;break}
  }
  if(!win){held.push({id:row.id,reason:'登録済み大会枠なし'});continue}
  const decision=decide(row,win,checkpoint,snapshot);
  if(decision.approved){approved.push(decision.record);snapshot.results.push(decision.record)}
  else held.push({id:row.id,reason:decision.reason});
 }
 return {approved,held};
}
module.exports={cutoffForWindow,decide,evaluate};
