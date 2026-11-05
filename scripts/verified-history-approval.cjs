'use strict';
// Narrow, rule-backed auto approval. Only allow-listed historical events qualify.
// A zero-VR final can be recorded as $0 because the rules pay per final-round VR.
// Positive cash awards and unknown events remain in manual review.
const RULES=Object.freeze({
  'ch5s3-squads-victory-cup':{
    seasonId:'S30',eventIds:['S30_SquadsVictoryCashCup'],team:'squad',
    matchCaps:{'予選':7,'賞金決勝':3},advance:{EU:150,ME:150,OCE:150,BR:150},
    source:'https://www.fortnite.com/news/fortnite-victory-cash-cups-chapter-5-season-3-official-rules'
  },
  'ch5s3-solo-victory-cup':{
    seasonId:'S30',eventIds:['S30_SoloVictoryCashCup'],
    matchCaps:{'予選':7,'賞金決勝':3},advance:{"EU":7000,"BR":2000,"ME":2000,"OCE":2000},
    source:'https://www.fortnite.com/news/fortnite-victory-cash-cups-chapter-5-season-3-official-rules'
  },
  'ch5s3-zb-solo-victory':{
    seasonId:'S30',eventIds:['S30_SoloZBVictoryCashCup'],
    matchCaps:{'予選':7,'賞金決勝':3},advance:{"EU":7000,"BR":2000,"ME":2000,"OCE":2000},
    source:'https://www.fortnite.com/news/fortnite-victory-cash-cups-chapter-5-season-3-official-rules'
  },
  'ch5s4-solo-victory-cup':{
    seasonId:'S31',eventIds:['S31_SoloVictoryCashCup'],
    matchCaps:{'予選':7,'賞金決勝':3},advance:{"EU":15000,"BR":2500,"ME":2000,"OCE":1500},
    source:'https://www.fortnite.com/news/fortnite-victory-cash-cups-chapter-5-season-4-official-rules'
  },
  'ch5s4-zb-solo-victory':{
    seasonId:'S31',eventIds:['S31_SoloZBVictoryCashCup'],
    matchCaps:{'予選':7,'賞金決勝':3},advance:{"EU":3000,"BR":1000,"ME":1000,"OCE":600},
    source:'https://www.fortnite.com/news/fortnite-victory-cash-cups-chapter-5-season-4-official-rules'
  },
  'ch7s3-solo-reload-victory-cup':{
    seasonId:'S41',eventIds:['S41_ReloadReloadSoloVictoryCup','S41_ReloadSoloVictoryCup'],
    matchCaps:{'予選':8,'賞金決勝':3},advance:{EU:1600,NAC:800,ME:320,NAW:320,OCE:320,BR:320},
    source:'https://www.fortnite.com/competitive/rules-guidelines/rules-library/fortnite-victory-cups-chapter-7-season-3-official-rules'
  },
  'ch7s4-solo-victory-cup':{
    seasonId:'S42',eventIds:['S42_SoloVictoryCup','S42_SoloVictoryCupBR'],
    matchCaps:{'予選':8,'賞金決勝':3},advance:{EU:4000,NAC:2000,ME:800,NAW:800,OCE:800,BR:800},
    source:'https://www.fortnite.com/competitive/rules-guidelines/rules-library/fortnite-victory-cups-chapter-7-season-4-official-rules'
  }
});
const roundId=x=>{
 const match=String(x||'').match(/(?:Event\s*(\d+)|Day\s*(\d+)).*Round\s*([12])/i);
 return match?(match[1]?'event'+Number(match[1]):'day'+Number(match[2]))+'/round'+match[3]:String(x||'');
};
const participants=r=>Array.isArray(r.players)&&r.players.length?r.players:[r.player];
const identity=r=>[r.date,r.region,r.tournamentId,roundId(r.round),participants(r).slice().sort().join('|')].join('::');
const decline=reason=>({approved:false,reason});
function decide(row,win,checkpoint,data){
 if(row?.reviewOnly===true||row?.kind==='参加確認'||win?.kind==='参加確認'||(win?.series&&win.series!=='victory-cup'))return decline('確認専用大会は自動承認不可');
 if(!checkpoint?.complete)return decline('順位表の取得が完了していません');
 const rule=RULES[row.tournamentId];
 if(!rule)return decline('未検証のシーズンまたは大会');
 const catalog=data.tournaments.catalog.find(x=>x.id===row.tournamentId);
 if(!catalog||catalog.team!==(rule.team||'solo')||catalog.series!=='victory-cup'||catalog.seasonId!==rule.seasonId)return decline('大会カタログ不一致');
 if(win.tournamentId!==row.tournamentId||win.seasonId!==rule.seasonId||row.seasonId!==rule.seasonId||!rule.eventIds.includes(win.eventId)||!catalog.sourceEventIds.includes(win.eventId))return decline('公式イベントID不一致');
 if(row.date!==win.dateJst||row.region!==win.region||!Object.hasOwn(rule.advance,row.region)||row.round!==win.round||row.kind!==win.kind)return decline('開催日・地域・ラウンド不一致');
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
  if(row.rank>rule.advance[row.region]||row.prize!==0)return decline('予選通過条件または賞金値不一致');
  rec.round=win.round.replace(/\/ 予選$/,'/ 予選突破');
  rec.kind='予選';
  rec.prize=0;
  rec.note='Epic公式規則で'+row.region+'上位'+rule.advance[row.region]+'名が予選突破。Osirion順位表の'+row.rank+'位をEpic IDで照合。予選の現金賞金は$0。規則: '+rule.source;
 }else if(row.kind==='賞金決勝'){
  if(row.vrs!==0||row.prize!==null)return decline('賞金が発生する可能性があり確認が必要');
  // Keep the same cash-final stage for winners and $0 finalists.
  // Whether the player earned cash is represented only by prize.
  rec.round=win.round;
  rec.kind='賞金決勝';
  rec.prize=0;
  rec.note='Epic公式規則は決勝のVRごとに賞金を付与。Osirionで決勝0VRを確認したため現金賞金$0。規則: '+rule.source;
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
