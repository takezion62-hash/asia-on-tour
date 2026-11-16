'use strict';
// Exact 2025-09-28 NAW S37 event 6 Round 1: 14 distinct saved candidates.
// Verified mature contiguous leaderboard pages, never an invented complete scan.
const POLICY='verified-s37-naw-event6-round1-remaining14-20261116';
const RULE="https://www.fortnite.com/competitive/rules-guidelines/rules-library/fortnite-duos-console-victory-cash-cups-chapter-6-season-4-official-rules?region=NAC";
const SOURCE="https://www.fortnite.com/competitive/events/S37_ConsoleDuosCashCups/?region=NAW&round=S37_ConsoleDuosCashCups_Event6Round1_NAW";
const EVENT='S37_ConsoleDuosCashCups';
const WINDOW='S37_ConsoleDuosCashCups_Event6Round1_NAW';
const KEY='epicgames_'+EVENT+'_NAW/'+WINDOW;
const CUTOFF=250;
const ARCHIVE_COMMIT='ad4aec18e61a6d528398f92e7440d87d02c10399';
const ARCHIVE_BLOB='6af9cc80993405327bf07ef8620bfaddc717d7d1';
const SPECS=Object.freeze([
 Object.freeze({"id":"auto-s37-8389b10646aa","player":"らる / まろやかれおちゃあいと","playerRaw":"はあちゃまっちゃまーwwǃǃӜ / 爆運まろやかれおちゃあいと爆運","players":["らる","まろやかれおちゃあいと"],"rank":19,"points":278,"kills":50,"vrs":0,"matches":6}),
 Object.freeze({"id":"auto-s37-05934e51dc7d","player":"VLZ 対面の極意 / CALM かずにょっす","playerRaw":"VLZ 対面の極意 / CALM かずにょっす","players":["VLZ 対面の極意","CALM かずにょっす"],"rank":96,"points":239,"kills":24,"vrs":1,"matches":5}),
 Object.freeze({"id":"auto-s37-ffc1dcf8c79e","player":"かぷせるてぃーてぃーTTていてい / Amo","playerRaw":"Pollo 17 ǃ ǃ / AmonRoadToGlorÿ","players":["かぷせるてぃーてぃーTTていてい","Amo"],"rank":122,"points":234,"kills":39,"vrs":2,"matches":6}),
 Object.freeze({"id":"auto-s37-d956ca757dfd","player":"MAT4DOR. / ちゃる","playerRaw":"MAT4DOR. / charufn","players":["MAT4DOR.","ちゃる"],"rank":124,"points":234,"kills":33,"vrs":0,"matches":6}),
 Object.freeze({"id":"auto-s37-59a231e13359","player":"えいぶか / あすふぁろず","playerRaw":"s2 ほんまにふわかろん雑魚 / あすふぁろず","players":["えいぶか","あすふぁろず"],"rank":139,"points":231,"kills":41,"vrs":1,"matches":7}),
 Object.freeze({"id":"auto-s37-2d26cc35e767","player":"おこっとふー / センス0","playerRaw":"おこっとふー / 光オロチs","players":["おこっとふー","センス0"],"rank":140,"points":231,"kills":36,"vrs":1,"matches":7}),
 Object.freeze({"id":"auto-s37-133977417c62","player":"すたーだよ / falcon manzuǃ","playerRaw":"すたーだよ / falcon manzuǃ","players":["すたーだよ","falcon manzuǃ"],"rank":149,"points":230,"kills":21,"vrs":0,"matches":5}),
 Object.freeze({"id":"auto-s37-976d4cc349b1","player":"kmyt / Choco","playerRaw":"やまもと そうし / nagisa furukawaǃ","players":["kmyt","Choco"],"rank":177,"points":227,"kills":28,"vrs":1,"matches":6}),
 Object.freeze({"id":"auto-s37-e6850a9c11c7","player":"Saku / れっどうぃんぐ","playerRaw":"A_α さくʕᵔᴥᵔʔ / ptt れっどにゃんぐ","players":["Saku","れっどうぃんぐ"],"rank":285,"points":212,"kills":41,"vrs":0,"matches":7}),
 Object.freeze({"id":"auto-s37-aefc610f622e","player":"Asuka / Rabbit","playerRaw":"VOLARE Asuka / Yotta Rabbitǃ","players":["Asuka","Rabbit"],"rank":343,"points":207,"kills":36,"vrs":1,"matches":7}),
 Object.freeze({"id":"auto-s37-f16a3f5b348b","player":"TONIGHTREET / まっちゃやけん","playerRaw":"イーザンバロンⅤナス寿郎聖 / chapfnr７７","players":["TONIGHTREET","まっちゃやけん"],"rank":399,"points":202,"kills":40,"vrs":0,"matches":7}),
 Object.freeze({"id":"auto-s37-79ca1b69c73f","player":"EXV mAximum24 / えありー","playerRaw":"EXV mAximum24 / zst Airyfnbr","players":["EXV mAximum24","えありー"],"rank":489,"points":195,"kills":36,"vrs":1,"matches":5}),
 Object.freeze({"id":"auto-s37-c579947451a3","player":"りむた / ろみぃ","playerRaw":"A_α Rimuta / INNMU Reo","players":["りむた","ろみぃ"],"rank":635,"points":185,"kills":43,"vrs":1,"matches":7}),
 Object.freeze({"id":"auto-s37-76bdb2b7bfbd","player":"れすぶゆりる / おーくん","playerRaw":"12345ででんででんACE / RGL おーくん","players":["れすぶゆりる","おーくん"],"rank":672,"points":182,"kills":32,"vrs":0,"matches":7})
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
function expectedKind(spec){return spec.rank<=CUTOFF?'予選':'参加確認'}
function expectedRound(spec){return 'Event 6 · Round 1 / '+(spec.rank<=CUTOFF?'予選突破':'参加確認')}
function validatedRecord(row,entry){
 const spec=getSpec(row?.id);
 return !!spec&&!!entry&&entry.decision==='published'&&entry.id===spec.id&&
  entry.recordId===spec.id&&entry.policy===POLICY&&
  entry.rule===RULE&&entry.source===SOURCE&&
  entry.evidence?.includes('mature contiguous observed leaderboard')===true&&
  entry.evidence?.includes(ARCHIVE_BLOB)===true&&
  row.id===spec.id&&row.date==='2025-09-28'&&row.region==='NAW'&&
  row.seasonId==='S37'&&row.chapter===6&&row.season===4&&
  row.tournamentId==='ch6s4-console-duos-victory'&&
  row.event==='Duos Console Victory Cash Cup'&&row.source===SOURCE&&
  row.verified===true&&row.reviewOnly!==true&&row.reviewReason===undefined&&
  row.kind===expectedKind(spec)&&row.round===expectedRound(spec)&&
  row.prize===0&&row.player===spec.player&&row.playerRaw===spec.playerRaw&&
  JSON.stringify(row.players)===JSON.stringify(spec.players)&&
  ['rank','points','kills','vrs','matches'].every(field=>row[field]===spec[field])&&
  typeof row.note==='string'&&row.note.includes(RULE)&&
  row.note.includes('上位250')&&row.note.includes('賞金$0')&&
  row.note.includes('未完了')&&row.note.includes(ARCHIVE_BLOB);
}
module.exports={POLICY,RULE,SOURCE,EVENT,WINDOW,KEY,CUTOFF,ARCHIVE_COMMIT,ARCHIVE_BLOB,SPECS,getSpec,matchesOriginal,expectedKind,expectedRound,validatedRecord};
