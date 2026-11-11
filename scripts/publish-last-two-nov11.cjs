'use strict';
// User-approved final Epic-ID verification and direct ordinary-result publication.
const fs=require('node:fs'),path=require('node:path');
const {collision,equalCandidate}=require('./manual-approval-core.cjs');
const root=path.resolve(__dirname,'..'),dry=process.argv.includes('--dry-run');
const read=n=>JSON.parse(fs.readFileSync(path.join(root,n),'utf8'));
const write=(n,x)=>fs.writeFileSync(path.join(root,n),JSON.stringify(x,null,2)+'\n');
const now=new Date().toISOString();
const DUO_RULE='https://www.fortnite.com/competitive/rules-guidelines/rules-library/fortnite-victory-cups-chapter-7-season-4-official-rules';
const CLIX_RULE='https://www.fortnite.com/competitive/rules-guidelines/rules-library/playstation-clix-cup-official-rules';
const types={
 'auto-s42-3fc137750a4c':{eventId:'S42_ReloadDuosVictoryCup',
  window:'S42_ReloadDuosVictoryCup_Event1_Round2_ME',date:'2026-08-25',region:'ME',
  tournamentId:'ch7s4-reload-duos-victory-cup',seasonId:'S42',team:'duo',rule:DUO_RULE},
 'auto-s40-aa4c808b5bea':{eventId:'S40_PlayStationCupClix',
  window:'S40_PlayStationCupClix_Final_NAC',date:'2026-05-03',region:'NAC',
  tournamentId:'ch7s2-playstation-clix-cup-br',seasonId:'S40',team:'solo',rule:CLIX_RULE}
};
const d={results:read('results.json'),review:read('history-sync-review.json'),
 reviewed:read('history-sync-reviewed.json'),ledger:read('approval-history.json'),
 updates:read('updates.json'),status:read('history-sync-status.json'),
 scans:read('history-sync-scan.json'),players:read('players.json'),
 catalog:read('tournaments.json').catalog,calendar:{}};
const known=new Set(d.players.candidates.map(x=>x.name)),seen=new Set(d.reviewed.entries.map(x=>x.id));
const results=[],held=[];
function ok(c,msg){if(!c)throw Error(msg)}
function verify(r,c){
 ok(r.date===c.date&&r.region===c.region&&r.tournamentId===c.tournamentId&&r.seasonId===c.seasonId&&r.verified===true,'unexpected event');
 const src=new URL(r.source);
 ok(src.protocol==='https:'&&src.hostname==='www.fortnite.com'&&
  src.pathname==='/competitive/events/'+c.eventId+'/'&&
  src.searchParams.get('region')===c.region&&src.searchParams.get('round')===c.window,'official session source mismatch');
 const cat=d.catalog.find(x=>x.id===c.tournamentId);
 ok(cat&&cat.name===r.event&&cat.team===c.team&&cat.seasonId===c.seasonId&&cat.sourceEventIds?.includes(c.eventId),'official tournament master mismatch');
 const roster=Array.isArray(r.players)&&r.players.length?r.players:[r.player];
 ok(roster.length===(c.team==='duo'?2:1)&&roster.every(name=>known.has(name))&&
  new Set(roster).size===roster.length&&r.player===roster.join(' / '),'unknown Epic lineup');
 ok(Number.isSafeInteger(r.rank)&&r.rank>0&&Number.isSafeInteger(r.points)&&r.points>=0&&
   Number.isSafeInteger(r.kills)&&r.kills>=0&&Number.isSafeInteger(r.vrs)&&r.vrs>=0&&
   Number.isSafeInteger(r.matches)&&r.matches>0&&r.vrs<=r.matches,'invalid original scored row');
 const key='epicgames_'+c.eventId+'_'+c.region+'/'+c.window,cp=d.scans.windows?.[key];
 ok(cp&&cp.nextPage>=1&&cp.rankingOrderValid===true&&cp.lastSeenRank>=r.rank&&
   cp.proposals?.filter(x=>x.id===r.id&&equalCandidate(x,r)).length===1,'original Epic-ID scoreboard not observed');
 const month=r.date.slice(0,7);
 if(!d.calendar[month])d.calendar[month]=read('calendar-history/'+month+'.json').sessions;
 ok(d.calendar[month]?.some(w=>w.eventId===c.eventId&&w.sourceWindowId===c.window&&
  w.dateJst===r.date&&w.region===r.region&&w.tournamentId===r.tournamentId),'official calendar session mismatch');
 ok(!d.results.some(x=>collision(x,r,d.players.confirmedAliases||{}))&&
   !d.ledger.entries.some(x=>x.id===r.id),'already-published or ambiguous duplicate');
}
for(const r of [...d.review.proposals]){
 const c=types[r.id];if(!c)continue;
 try{
  verify(r,c);
  let prize=0,kind='賞金決勝',round='',policy='verified-rule',note='';
  if(c.team==='duo'){
   ok(r.player==='Karf / huggyfv'&&r.kind==='賞金決勝'&&r.prize===null&&
     r.rank===14&&r.vrs===1&&r.points===100&&r.matches<=3&&
     r.round.includes('Round 2 / 賞金決勝'),'duo 1VR prize evidence mismatch');
   prize=200;policy='official-final-vr-award';round=r.round;
   note='Epic CH7S4 2026-08-25 ME Duos Reload Victory Cup Event1 Round2 14位。'
    +'Karf / huggyfv の公式Epic ID・保存済み順位表の1VRを照合。チーム賞金$200、個人それぞれ$100（支払完了の断定ではない）。';
  }else{
   ok(r.player==='みずるん'&&r.kind==='参加確認'&&r.reviewOnly===true&&r.prize===null&&
     r.rank===96&&r.vrs===0&&r.points===0&&r.matches<=6,'Clix final zero-VR fact mismatch');
   round='Final / 賞金決勝';
   note='Epic CH7S2 PlayStation Clix Cup NAC Final 96位。本人Epic ID・保存済み順位表で0VRを照合。'
    +'NAC決勝の公式賞金は1VR=$750、0VRのため現金賞金$0。予選時の衣装獲得とは別実績。';
  }
  const {reviewOnly,reviewReason,teamAccountIds,...record}=r;
  Object.assign(record,{prize,kind,round,note:note+' 公式規則: '+c.rule+' / 出典: '+r.source});
  if(c.team==='duo'){record.teamPrize=200;record.prizePerPlayer=100}
  d.results.push(record);d.review.proposals=d.review.proposals.filter(x=>x.id!==r.id);
  d.ledger.entries.push({id:r.id,decision:'published',recordId:r.id,policy,source:r.source,
   approvedAt:now,approvedBy:'ChatGPT / user-authorized verified historical review',rule:c.rule,
   evidence:'Exact saved Epic ID, verified team, original scoreboard window and official per-VR prize (including 0 VR)'});
  if(!seen.has(r.id)){d.reviewed.entries.push({id:r.id,decision:'published',recordId:r.id,
    policy,source:r.source,reviewedAt:now,rule:c.rule});seen.add(r.id)}
  results.push({id:r.id,player:r.player,event:r.event,date:r.date,region:r.region,rank:r.rank,prize});
 }catch(e){held.push({id:r.id,player:r.player,reason:String(e.message||e)})}
}
if(results.length){
 const id='verified-final-reviews-20261111';
 const old=d.updates.entries.find(x=>x.id===id);
 if(old){
  old.recordIds=[...new Set([...(old.recordIds||[]),...results.map(x=>x.id)])];
  old.title='公式最終確認済みの遠征結果'+old.recordIds.length+'件を追加';
 }else{
  d.updates.entries.unshift({id,date:'2026-11-11',type:'records',
   title:'公式最終確認済みの遠征結果'+results.length+'件を追加',
   description:'CH7S4 ME Reload Duos決勝1VR個人$100、CH7S2 NAC Clix決勝0VR現金$0をEpic ID、公式順位表、地域別公式規則で検証。',
   recordIds:results.map(x=>x.id)});
 }
 d.review.manualReviewedAt=now;d.reviewed.reviewedAt=now;d.ledger.reviewedAt=now;
 d.status.manualReviewCandidates=d.review.proposals.length;d.status.found=d.review.proposals.length;
 d.status.manuallyPublished=(d.status.manuallyPublished||0)+results.length;
 d.status.lastReviewedBatchAt=now;
 d.status.message='Karf/huggyfvとClixの公式決勝'+results.length+'件を掲載。確認待ち'+d.review.proposals.length+'件。';
}
console.log('AOT_LAST_TWO_VERIFIED '+JSON.stringify({dry,added:results.length,results,held,remaining:d.review.proposals.length}));
if(!dry&&results.length){
 for(const [file,body] of [
  ['results.json',d.results],['history-sync-review.json',d.review],
  ['history-sync-reviewed.json',d.reviewed],['history-sync-status.json',d.status],
  ['approval-history.json',d.ledger],['updates.json',d.updates]])write(file,body);
}
