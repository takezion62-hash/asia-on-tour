'use strict';
// Four immutable source-verified NAW S37 Round 1 candidates, independently corroborated
// by their already-published Round 2 finals. Partial original scoreboard is not
// misrepresented as complete; no prize is inferred from Round 1 VRs.
const POLICY='verified-s37-naw-console-event6-round1-four-20261116';
const RULE="https://www.fortnite.com/competitive/rules-guidelines/rules-library/fortnite-duos-console-victory-cash-cups-chapter-6-season-4-official-rules?region=NAC";
const SOURCE="https://www.fortnite.com/competitive/events/S37_ConsoleDuosCashCups/?region=NAW&round=S37_ConsoleDuosCashCups_Event6Round1_NAW";
const EVENT='S37_ConsoleDuosCashCups';
const WINDOW='S37_ConsoleDuosCashCups_Event6Round1_NAW';
const KEY='epicgames_'+EVENT+'_NAW/'+WINDOW;
const CUTOFF=250;
const SPECS=Object.freeze([
 Object.freeze({"id":"auto-s37-53b9f3b97c1d","player":"きおらび / SN Season","playerRaw":"きおらび / SN Season","players":["きおらび","SN Season"],"rank":40,"points":259,"kills":43,"vrs":1,"matches":6,"finalId":"s37-naw-console-duos-vc-20250928-r5","finalRank":5,"finalPrize":200}),
 Object.freeze({"id":"auto-s37-ba492cfcb3fa","player":"りーく / ちからV2","playerRaw":"Wcr r3exk / NEXUS ちからV2ǃ","players":["りーく","ちからV2"],"rank":54,"points":253,"kills":46,"vrs":1,"matches":6,"finalId":"s37-naw-console-duos-vc-20250928-r9","finalRank":9,"finalPrize":200}),
 Object.freeze({"id":"auto-s37-b1fc6e573046","player":"Botえもん / すかい","playerRaw":"Botえもん / AtlanticSkyx","players":["Botえもん","すかい"],"rank":59,"points":250,"kills":27,"vrs":2,"matches":6,"finalId":"s37-naw-console-duos-vc-20250928-r13","finalRank":13,"finalPrize":200}),
 Object.freeze({"id":"auto-s37-e5101bad430d","player":"でーもんくらげǃ / ももち","playerRaw":"でーもんくらげǃ / Ascend JerenX","players":["でーもんくらげǃ","ももち"],"rank":220,"points":221,"kills":40,"vrs":1,"matches":7,"finalId":"s37-naw-console-duos-vc-20250928-r1","finalRank":1,"finalPrize":400})
]);
const getSpec=id=>SPECS.find(x=>x.id===id);
function matchesOriginal(candidate,spec){
 return !!candidate&&!!spec&&candidate.id===spec.id&&
  candidate.date==='2025-09-28'&&candidate.region==='NAW'&&
  candidate.seasonId==='S37'&&candidate.chapter===6&&candidate.season===4&&
  candidate.tournamentId==='ch6s4-console-duos-victory'&&
  candidate.event==='Duos Console Victory Cash Cup'&&
  candidate.round==='Event 6 · Round 1 / 予選'&&candidate.kind==='予選'&&
  candidate.source===SOURCE&&candidate.verified===true&&candidate.prize===0&&
  candidate.player===spec.player&&candidate.playerRaw===spec.playerRaw&&
  JSON.stringify(candidate.players)===JSON.stringify(spec.players)&&
  ['rank','points','kills','vrs','matches'].every(field=>candidate[field]===spec[field]);
}
function verifiedFinal(spec,records){
 const found=records.filter(x=>x.id===spec.finalId);
 return found.length===1&&found[0].date==='2025-09-28'&&found[0].region==='NAW'&&
  found[0].seasonId==='S37'&&found[0].tournamentId==='ch6s4-console-duos-victory'&&
  found[0].event==='Duos Console Victory Cash Cup'&&
  found[0].round==='Event 6 · Round 2 / 賞金決勝'&&
  found[0].kind==='賞金決勝'&&found[0].verified===true&&
  found[0].rank===spec.finalRank&&found[0].prize===spec.finalPrize&&
  found[0].player===spec.player&&
  JSON.stringify(found[0].players)===JSON.stringify(spec.players)&&
  found[0].source?.includes('Event6Round2_NAW')===true;
}
function expectedKind(){return '予選'}
function expectedRound(){return 'Event 6 · Round 1 / 予選突破'}
function validatedRecord(row,entry){
 const spec=getSpec(row?.id);
 return !!spec&&!!entry&&entry.decision==='published'&&entry.id===spec.id&&
  entry.recordId===spec.id&&entry.policy===POLICY&&
  entry.rule===RULE&&entry.source===SOURCE&&
  entry.evidence?.includes(spec.finalId)===true&&
  row.id===spec.id&&row.date==='2025-09-28'&&row.region==='NAW'&&
  row.seasonId==='S37'&&row.chapter===6&&row.season===4&&
  row.tournamentId==='ch6s4-console-duos-victory'&&
  row.event==='Duos Console Victory Cash Cup'&&row.source===SOURCE&&
  row.verified===true&&row.reviewOnly!==true&&row.reviewReason===undefined&&
  row.kind===expectedKind()&&row.round===expectedRound()&&
  row.prize===0&&row.player===spec.player&&row.playerRaw===spec.playerRaw&&
  JSON.stringify(row.players)===JSON.stringify(spec.players)&&
  ['rank','points','kills','vrs','matches'].every(field=>row[field]===spec[field])&&
  typeof row.note==='string'&&row.note.includes(RULE)&&
  row.note.includes(spec.finalId)&&row.note.includes('上位250')&&row.note.includes('賞金$0');
}
module.exports={POLICY,RULE,SOURCE,EVENT,WINDOW,KEY,CUTOFF,SPECS,getSpec,matchesOriginal,verifiedFinal,expectedKind,expectedRound,validatedRecord};
