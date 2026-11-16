'use strict';
// Exact, independently rule-verified 2025-08-24 OCE Duos Console Victory Cash Cup
// Round 1 review. This is NOT a blanket S37/duos approval or cash inference.
const POLICY='verified-s37-oce-console-round1-three-20261116';
const RULE='https://www.fortnite.com/competitive/rules-guidelines/rules-library/fortnite-duos-console-victory-cash-cups-chapter-6-season-4-official-rules?region=NAC';
const SOURCE='https://www.fortnite.com/competitive/events/S37_ConsoleDuosCashCups/?region=OCE&round=S37_ConsoleDuosCashCups_Event2Round1_OCE';
const EVENT='S37_ConsoleDuosCashCups';
const WINDOW='S37_ConsoleDuosCashCups_Event2Round1_OCE';
const KEY='epicgames_'+EVENT+'_OCE/'+WINDOW;
const CUTOFF=250;
const SPECS=Object.freeze([
 Object.freeze({id:'auto-s37-d4b35b1e7aa2',player:'りむた / かめてぃん',
  playerRaw:'A_α Rimuta / かめてぃん.魔女',players:['りむた','かめてぃん'],
  rank:241,points:183,kills:28,vrs:1,matches:4}),
 Object.freeze({id:'auto-s37-233e43e48432',player:'Reeton120fps- / Mofu',
  playerRaw:'Reeton120fps- / RC MOFU 16ǃ',players:['Reeton120fps-','Mofu'],
  rank:1570,points:46,kills:14,vrs:0,matches:4}),
 Object.freeze({id:'auto-s37-27b3227250e3',player:'レザリク / りくとかい',
  playerRaw:'レザリク０４３０ / りくとかい15才.',players:['レザリク','りくとかい'],
  rank:1389,points:58,kills:1,vrs:0,matches:1})
]);
const getSpec=id=>SPECS.find(x=>x.id===id);
function matchesOriginal(candidate,spec){
 return !!candidate&&!!spec&&candidate.id===spec.id&&
  candidate.date==='2025-08-24'&&candidate.region==='OCE'&&
  candidate.seasonId==='S37'&&candidate.chapter===6&&candidate.season===4&&
  candidate.tournamentId==='ch6s4-console-duos-victory'&&
  candidate.event==='Duos Console Victory Cash Cup'&&
  candidate.round==='Event 2 · Round 1 / 予選'&&candidate.kind==='予選'&&
  candidate.source===SOURCE&&candidate.verified===true&&candidate.prize===0&&
  candidate.player===spec.player&&candidate.playerRaw===spec.playerRaw&&
  JSON.stringify(candidate.players)===JSON.stringify(spec.players)&&
  ['rank','points','kills','vrs','matches'].every(field=>candidate[field]===spec[field]);
}
function expectedKind(spec){return spec.rank<=CUTOFF?'予選':'参加確認'}
function expectedRound(spec){return 'Event 2 · Round 1 / '+(spec.rank<=CUTOFF?'予選突破':'参加確認')}
function validatedRecord(row,entry){
 const spec=getSpec(row?.id);
 return !!spec&&!!entry&&entry.decision==='published'&&entry.id===spec.id&&
  entry.recordId===spec.id&&entry.policy===POLICY&&
  entry.rule===RULE&&entry.source===SOURCE&&
  entry.evidence?.includes('26/26')&&
  row.id===spec.id&&row.date==='2025-08-24'&&row.region==='OCE'&&
  row.seasonId==='S37'&&row.chapter===6&&row.season===4&&
  row.tournamentId==='ch6s4-console-duos-victory'&&
  row.event==='Duos Console Victory Cash Cup'&&row.source===SOURCE&&
  row.verified===true&&row.reviewOnly!==true&&row.reviewReason===undefined&&
  row.kind===expectedKind(spec)&&row.round===expectedRound(spec)&&
  row.prize===0&&row.player===spec.player&&row.playerRaw===spec.playerRaw&&
  JSON.stringify(row.players)===JSON.stringify(spec.players)&&
  ['rank','points','kills','vrs','matches'].every(field=>row[field]===spec[field])&&
  typeof row.note==='string'&&row.note.includes(RULE)&&
  row.note.includes('上位250')&&row.note.includes('賞金$0');
}
module.exports={POLICY,RULE,SOURCE,EVENT,WINDOW,KEY,CUTOFF,SPECS,getSpec,matchesOriginal,expectedKind,expectedRound,validatedRecord};
