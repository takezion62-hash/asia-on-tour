'use strict';
// Verified historical review publication: S35 ME Console Duos Victory Cash Cup,
// 2025-05-31 Event 3 Round 2. Only complete archived Epic-ID leaderboard
// checks plus official May 2025 0-VR=$0 cash rules qualify. No speculative cash.
const fs=require('node:fs');
const path=require('node:path');
const {equalCandidate,collision}=require('./manual-approval-core.cjs');
const ROOT=path.resolve(__dirname,'..');
const TID='ch6s2-console-duos-victory';
const EVENT='S35_VictoryDuosCup',WINDOW='S35_VictoryDuosCup_Event3Round2_ME';
const RULES='https://www.fortnite.com/news/fortnite-duos-console-victory-cash-cups-may-2025-official-rules?lang=en-US';
const TARGETS=[
 'auto-s35-a2d9f9d86f3a','auto-s35-d847cffb6ce2',
 'auto-s35-bd84370bed67','auto-s35-cce8b3002a38',
 'auto-s35-3c7a7bd8746c','auto-s35-696e947ecd65'
];
const RECHECK_DUPLICATES=['auto-s42-97bb48f5d3f0','auto-s42-3427725928b0'];
const read=name=>JSON.parse(fs.readFileSync(path.join(ROOT,name),'utf8'));
const write=(name,value)=>fs.writeFileSync(path.join(ROOT,name),JSON.stringify(value,null,2)+'\n');
const clone=o=>JSON.parse(JSON.stringify(o));
const roster=r=>Array.isArray(r.players)&&r.players.length?r.players:[r.player];
const assert=(ok,msg)=>{if(!ok)throw Error('HISTORIC_REVIEW_VERIFY: '+msg)};
const fieldsSame=(a,b,keys)=>keys.every(key=>JSON.stringify(a[key])===JSON.stringify(b[key]));
const isDuplicate=(a,b)=>fieldsSame(a,b,['date','region','tournamentId','rank','points','kills','vrs','matches'])
  &&roster(a).slice().sort().join('|')===roster(b).slice().sort().join('|');
function resolveCandidates(data,now='2026-11-08T00:00:00.000Z'){
 const {results,updates,review,reviewed,status,scan,players,tournaments}=clone(data);
 assert(Array.isArray(results)&&Array.isArray(updates.entries)&&Array.isArray(review.proposals)
  &&Array.isArray(reviewed.entries)&&scan?.windows&&Array.isArray(players.candidates)
  &&Array.isArray(tournaments.catalog),'missing or invalid source documents');
 const existingIds=new Set(results.map(x=>x.id));
 assert(existingIds.size===results.length,'existing result IDs already duplicated');
 const catalog=tournaments.catalog.find(x=>x.id===TID);
 assert(catalog&&catalog.name==='Duos Console Victory Cash Cup'
   &&catalog.seasonId==='S35'&&catalog.team==='duo'&&catalog.series==='victory-cup'
   &&catalog.sourceEventIds?.includes(EVENT),'event catalog not the official 2025 Console Duos cup');
 const cp=scan.windows['epicgames_'+EVENT+'_ME/'+WINDOW];
 assert(cp&&cp.complete===true&&Number.isInteger(cp.totalPages)&&cp.totalPages>=1
   &&cp.nextPage>=cp.totalPages&&cp.rankingOrderValid!==false
   &&Array.isArray(cp.proposals),'May 31 ME official round-2 leaderboard not fully scanned');
 const names=new Set(players.candidates.map(x=>x.name));
 const aliases=players.confirmedAliases||{};
 const ids=new Set(reviewed.entries.map(x=>x.id));
 const verified=[],duplicates=[],held=[];
 function removeReview(id){review.proposals=review.proposals.filter(x=>x.id!==id)}
 function ledger(id,entry){
  if(ids.has(id))return;
  reviewed.entries.push({id,...entry});ids.add(id);
 }
 for(const id of TARGETS){
  const row=review.proposals.find(x=>x.id===id);
  if(!row){continue}
  if(ids.has(id)){removeReview(id);continue}
  assert(row.date==='2025-05-31'&&row.region==='ME'&&row.tournamentId===TID&&row.seasonId==='S35'
   &&row.event===catalog.name&&row.kind==='賞金決勝'&&row.round==='Event 3 · Round 2 / 賞金決勝',
   'incorrect league or stage for candidate '+id);
  assert(row.id===id&&row.verified===true&&row.vrs===0&&row.prize===null
   &&row.points===0&&Number.isSafeInteger(row.rank)&&row.rank>0
   &&Number.isSafeInteger(row.kills)&&row.kills>=0
   &&Number.isSafeInteger(row.matches)&&row.matches>=1&&row.matches<=3,
   'bad or uncertain 0-VR record '+id);
  const members=roster(row);
  assert(members.length===2&&new Set(members).size===2&&members.every(x=>names.has(x))
   &&row.player===members.join(' / '),'duo identity mismatch '+id);
  assert(cp.proposals.some(saved=>equalCandidate(saved,row)),'cached official Epic IDs/standings mismatch '+id);
  const url=new URL(row.source);
  assert(url.protocol==='https:'&&url.hostname==='www.fortnite.com'&&url.pathname==='/competitive/events/'+EVENT+'/'
    &&url.searchParams.get('region')==='ME'&&url.searchParams.get('round')===WINDOW,
    'source URL not the official final '+id);
  const colliding=results.filter(x=>collision(x,row,aliases));
  if(colliding.length){
   if(colliding.length!==1||!isDuplicate(colliding[0],row)){
    held.push({id,reason:'existing result has conflicting rank/score'});continue;
   }
   duplicates.push({id,existingId:colliding[0].id});
   removeReview(id);
   ledger(id,{decision:'already-published',existingId:colliding[0].id,
    note:'Rank, kills, points and 0VR cross-checked against completed official May 2025 session',source:row.source});
   continue;
  }
  assert(!existingIds.has(id),'candidate ID collision '+id);
  const {reviewOnly,reviewReason,teamAccountIds,...record}=row;
  record.prize=0;
  record.note='Epic ID照合済み・S35 2025/5/31 ME Console Duos Victory Cash Cup決勝の全'+cp.totalPages+'ページを取得済み。'
   +'チーム0VRにつき、Epic公式賞金規則（VR1回あたりチーム$200）から現金賞金$0と確認。'
   +'元の順位・ポイント・キル・試合数を維持。公式規則: '+RULES;
  results.push(record);existingIds.add(id);
  verified.push(record);
  removeReview(id);
  ledger(id,{decision:'published',recordId:id,policy:'verified-official-zero-vr',
   verifiedAt:now,source:row.source,officialRules:RULES,leaderboardWindow:WINDOW,
   leaderboardPages:cp.totalPages,rank:record.rank,prize:0});
 }
 // Prior reviewed NAW S42 official solo finals are already present under manual IDs.
 for(const id of RECHECK_DUPLICATES){
  const row=review.proposals.find(x=>x.id===id);
  if(!row){continue}
  const matches=results.filter(x=>collision(x,row,aliases));
  if(matches.length!==1||!isDuplicate(matches[0],row)){held.push({id,reason:'duplicate candidate not strictly identical'});continue}
  removeReview(id);
  duplicates.push({id,existingId:matches[0].id});
  ledger(id,{decision:'already-published',existingId:matches[0].id,
   note:'Existing published S42 NAW event/round/roster/rank/stats matched',source:row.source,verifiedAt:now});
 }
 if(verified.length){
  const day=new Date(new Date(now).getTime()+9*3600000).toISOString().slice(0,10);
  const entryId='manual-verified-s35-console-duos-20261108';
  assert(!updates.entries.some(x=>x.id===entryId),'publication update ID already exists');
  const log={id:entryId,date:day,type:'records',
   title:'2025年5月31日ME Console Duos決勝の0VR・未受賞6組を公式規則で確認し掲載',
   description:'Epic IDで特定済みの決勝順位表を全ページ取得済み（'+cp.totalPages+'ページ）。公式規則でVR1回あたりチーム$200のため、0VRの6組は$0と確認。既存の順位・KILLS・VR・試合数を維持。重複掲載せず、本人未確認のチームや順位表未完了の大会は保留。出典: '+RULES,
   recordIds:verified.map(x=>x.id)};
  updates.entries.unshift(log);
  updates.entries.sort((a,b)=>b.date.localeCompare(a.date));
 }
 if(verified.length||duplicates.length){
  reviewed.reviewedAt=now;
  status.found=review.proposals.length;
  status.manualReviewCandidates=review.proposals.length;
  status.reviewOnlyCandidates=review.proposals.filter(x=>x.reviewOnly===true).length;
  status.manuallyPublished=(Number(status.manuallyPublished)||0)+verified.length;
  status.manuallyResolvedDuplicates=(Number(status.manuallyResolvedDuplicates)||0)+duplicates.length;
  status.lastReviewedBatchAt=now;
  status.message='公式順位表と規則でS35 ME Console Duos 0VRを'+verified.length+'件$0掲載。既存戦績の重複'+duplicates.length+
   '件を確認済みに移動。残り確認待ち'+review.proposals.length+'件。未確定賞金や取得途中の順位は変更しない。';
 }
 return {docs:{results,updates,review,reviewed,status},report:{
  published:verified.map(x=>({id:x.id,player:x.player,rank:x.rank,vrs:x.vrs,prize:x.prize})),
  duplicates,held,remaining:review.proposals.length,changed:verified.length+duplicates.length>0
 }};
}
function main(){
 const before={
  results:read('results.json'),updates:read('updates.json'),review:read('history-sync-review.json'),
  reviewed:read('history-sync-reviewed.json'),status:read('history-sync-status.json'),
  scan:read('history-sync-scan.json'),players:read('players.json'),tournaments:read('tournaments.json')
 };
 const output=resolveCandidates(before,new Date().toISOString());
 console.log('HISTORIC_REVIEW_PUBLICATION '+JSON.stringify(output.report));
 if(process.argv.includes('--dry-run')||!output.report.changed)return;
 const {docs}=output;
 write('results.json',docs.results);
 write('updates.json',docs.updates);
 write('history-sync-review.json',docs.review);
 write('history-sync-reviewed.json',docs.reviewed);
 write('history-sync-status.json',docs.status);
}
if(require.main===module)main();
module.exports={process:resolveCandidates,TARGETS,RECHECK_DUPLICATES};
