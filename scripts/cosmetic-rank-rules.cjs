'use strict';
// Rank-based cosmetic classification. In-game rewards only; physical goods and actual
// item delivery may require residence/eligibility checks and are never asserted here.
const RULE_URL='https://www.fortnite.com/competitive/rules-guidelines/rules-library/one-piece-zoro-cup-chapter-7-mini-season-official-rules';
const CUT_OFFS=Object.freeze({
 'ch7s5-one-piece-zoro-cup-battle-royale':Object.freeze({
   eventId:'S43_OnePieceZoroCup',
   ranks:Object.freeze({OCE:50,ME:50,EU:525,BR:100,NAC:375,NAW:100})
 }),
 'ch7s5-one-piece-zoro-mobile-cup':Object.freeze({
   eventId:'S43_OnePieceZoroCup_Mobile',
   ranks:Object.freeze({OCE:30,ME:30,EU:200,BR:30,NAC:150,NAW:30})
 })
});
function evaluate(row){
 const event=CUT_OFFS[row?.tournamentId];
 const decline=reason=>({eligible:false,reason});
 if(!event)return decline('公式の獲得ラインが未登録の大会');
 if(row.seasonId!=='S43'||row.chapter!==7||row.season!==5||row.verified!==true)return decline('シーズン・本人照合が不一致');
 if(!['参加確認','スキン大会'].includes(row.kind)||!Number.isSafeInteger(row.rank)||row.rank<1)return decline('確認済みの順位がない');
 const cutoff=event.ranks[row.region];
 if(!Number.isSafeInteger(cutoff))return decline('地域の獲得ラインが不明');
 if(row.rank>cutoff)return decline('報酬圏外');
 if(!Number.isSafeInteger(row.matches)||row.matches<1||!Number.isSafeInteger(row.kills)||row.kills<0||!Number.isSafeInteger(row.vrs)||row.vrs<0||row.vrs>row.matches)return decline('成績データの矛盾');
 let url;
 try{url=new URL(row.source)}catch{return decline('大会出典が不正')}
 if(url.protocol!=='https:'||url.hostname!=='www.fortnite.com'||url.pathname!=='/competitive/events/'+event.eventId+'/'||
   url.searchParams.get('region')!==row.region||url.searchParams.get('round')!==event.eventId+'_'+row.region)
   return decline('公式大会の開催枠を照合できない');
 return {eligible:true,cutoff,rule:RULE_URL};
}
module.exports={RULE_URL,CUT_OFFS,evaluate};
