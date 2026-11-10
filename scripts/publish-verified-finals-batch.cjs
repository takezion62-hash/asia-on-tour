'use strict';
// Published only for Epic-ID confirmed final results within saved official leaderboard checkpoints.
// Existing results, unconfirmed VR awards and conflicting records are never overwritten.
const fs=require('node:fs'),path=require('node:path');
const {equalCandidate,collision}=require('./manual-approval-core.cjs');
const {appendArchive}=require('./participation-archive.cjs');
const ROOT=path.resolve(__dirname,'..');
const read=name=>JSON.parse(fs.readFileSync(path.join(ROOT,name),'utf8'));
const write=(name,value)=>fs.writeFileSync(path.join(ROOT,name),JSON.stringify(value,null,2)+'\n');
const clone=o=>JSON.parse(JSON.stringify(o));
const assert=(v,m)=>{if(!v)throw Error('VERIFIED_CASH_FINAL_BATCH: '+m)};
const R30='https://www.fortnite.com/news/fortnite-victory-cash-cups-chapter-5-season-3-official-rules';
const R31='https://www.fortnite.com/news/fortnite-victory-cash-cups-chapter-5-season-4-official-rules';
const R36='https://www.fortnite.com/news/fortnite-duos-console-victory-cash-cups-chapter-6-season-3-official-rules';
const GROUPS=[
 {date:'2024-06-11',season:'S30',region:'ME',event:'S30_SoloZBVictoryCashCup',window:'S30_SoloZBVictoryCashCup_Event2Round2_ME',tournament:'ch5s3-zb-solo-victory',members:1,rule:R30,full:false},
 {date:'2024-10-15',season:'S31',region:'NAC',event:'S31_SoloVictoryCashCup',window:'S31_SoloVictoryCashCup_Event7Round2_NAC',tournament:'ch5s4-solo-victory-cup',members:1,rule:R31,full:false},
 {date:'2025-06-21',season:'S36',region:'NAW',event:'S36_VictoryDuosCup',window:'S36_VictoryDuosCup_Event2Round2_NAW',tournament:'ch6s3-console-duos-victory',members:2,rule:R36,full:true},
 {date:'2025-06-28',season:'S36',region:'NAW',event:'S36_VictoryDuosCup',window:'S36_VictoryDuosCup_Event3Round2_NAW',tournament:'ch6s3-console-duos-victory',members:2,rule:R36,full:true},
 {date:'2025-06-28',season:'S36',region:'NAC',event:'S36_VictoryDuosCup',window:'S36_VictoryDuosCup_Event3Round2_NAC',tournament:'ch6s3-console-duos-victory',members:2,rule:R36,full:true}
];
const roster=p=>Array.isArray(p.players)&&p.players.length?p.players:[p.player];
const sameStats=(a,b)=>['date','region','tournamentId','event','rank','points','kills','vrs','matches'].every(k=>a[k]===b[k])
 &&roster(a).slice().sort().join('|')===roster(b).slice().sort().join('|');
function reconcile(original,now='2026-11-11T00:00:00.000Z'){
 const d=clone(original),ids=new Set(d.results.map(x=>x.id)),reviewedIds=new Set(d.reviewed.entries.map(x=>x.id));
 assert(ids.size===d.results.length,'existing result IDs duplicated');
 const players=new Set(d.players.candidates.map(x=>x.name));
 const catalogs=new Map(d.tournaments.catalog.map(x=>[x.id,x]));
 const confirmed=[],duplicates=[],held=[],selected=new Set();
 for(const group of GROUPS){
  const relevant=d.review.proposals.filter(p=>p.date===group.date&&p.region===group.region&&p.seasonId===group.season
   &&p.tournamentId===group.tournament&&p.kind==='賞金決勝'&&p.source?.includes('round='+group.window));
  if(!relevant.length)continue;
  const key='epicgames_'+group.event+'_'+group.region+'/'+group.window,checkpoint=d.scan.windows[key],cat=catalogs.get(group.tournament);
  assert(cat&&cat.seasonId===group.season&&cat.name===relevant[0].event&&cat.sourceEventIds?.includes(group.event)
   &&cat.team===(group.members===2?'duo':'solo'),'official event catalog mismatch '+key);
  assert(checkpoint&&Array.isArray(checkpoint.proposals)&&checkpoint.rankingOrderValid===true
   &&Number.isSafeInteger(checkpoint.lastSeenRank)&&checkpoint.nextPage>=1,'leaderboard checkpoint unverified '+key);
  if(group.full)assert(checkpoint.complete===true&&Number.isSafeInteger(checkpoint.totalPages)
   &&checkpoint.nextPage>=checkpoint.totalPages,'full duo final leaderboard is incomplete '+key);
  for(const row of relevant){
   assert(!selected.has(row.id),'repeated pending ID '+row.id);selected.add(row.id);
   const url=new URL(row.source);
   assert(url.protocol==='https:'&&url.hostname==='www.fortnite.com'
    &&url.pathname==='/competitive/events/'+group.event+'/'
    &&url.searchParams.get('region')===group.region&&url.searchParams.get('round')===group.window,
    'untrusted event URL '+row.id);
   const participants=roster(row);
   assert(row.verified===true&&row.prize===null&&row.kind==='賞金決勝'&&row.round.includes('Round 2 / 賞金決勝')
    &&participants.length===group.members&&participants.every(n=>players.has(n))
    &&new Set(participants).size===group.members&&row.player===participants.join(' / ')
    &&Number.isSafeInteger(row.rank)&&row.rank>=1&&row.rank<=checkpoint.lastSeenRank
    &&Number.isSafeInteger(row.points)&&row.points===row.vrs*100
    &&Number.isSafeInteger(row.kills)&&row.kills>=0
    &&Number.isSafeInteger(row.vrs)&&row.vrs>=0&&Number.isSafeInteger(row.matches)
    &&row.matches>=1&&row.matches<=3&&row.vrs<=row.matches,
    'score/identity/VR does not match official final rules '+row.id);
   const found=checkpoint.proposals.filter(x=>x.id===row.id);
   assert(found.length===1&&equalCandidate(found[0],row),'saved Epic-ID leaderboard differs from review '+row.id);
   const overlap=d.results.filter(x=>collision(x,row,d.players.confirmedAliases||{}));
   if(overlap.length){
    if(overlap.length!==1||!sameStats(overlap[0],row)){held.push(row.id);continue}
    duplicates.push(row.id);
    d.review.proposals=d.review.proposals.filter(x=>x.id!==row.id);
    if(!reviewedIds.has(row.id)){d.reviewed.entries.push({id:row.id,decision:'already-published',existingId:overlap[0].id,reviewedAt:now,source:row.source});reviewedIds.add(row.id)}
    continue;
   }
   assert(!ids.has(row.id),'results ID collision '+row.id);
   const {reviewOnly,reviewReason,teamAccountIds,...record}=row;
   const teamAward=group.members===2?row.vrs*200:null;
   record.prize=group.members===2?teamAward:row.vrs*100;
   if(group.members===2){record.teamPrize=teamAward;record.prizePerPlayer=teamAward/2}
   record.note='Epic ID・公式'+group.season+'決勝順位表（'+row.rank+'位）と'
     +(group.full?'全'+checkpoint.totalPages+'ページ取得済みの開催枠':'取得済み順位表の該当順位')+'を照合。'
     +(group.members===2?'チーム1VR=$200、個人1VR=$100':'ソロ1VR=$100')
     +'により'+row.vrs+'VRの規則上の現金賞金額を計算。支払完了の断定はしない。規則: '+group.rule;
   d.results.push(record);ids.add(record.id);confirmed.push(record);
   d.review.proposals=d.review.proposals.filter(x=>x.id!==row.id);
   d.approval.entries.push({id:row.id,decision:'published',recordId:record.id,policy:'official-final-vr-award',
    approvedAt:now,approvedBy:'ChatGPT (user-authorized GitHub integration)',rule:group.rule,
    source:row.source,evidence:'Exact saved Epic-ID final ranked row and official '+row.vrs+' VR payout; team award '+(teamAward??record.prize)});
   if(!reviewedIds.has(row.id)){d.reviewed.entries.push({id:row.id,decision:'published',recordId:row.id,reviewedAt:now,
    policy:'saved-official-final-score-and-vr-award',source:row.source,officialRules:group.rule});reviewedIds.add(row.id)}
  }
 }
 if(confirmed.length||duplicates.length){
  const date=new Date(Date.parse(now)+9*3600000).toISOString().slice(0,10);
  if(confirmed.length){
   const updateId='manual-finals-20261111-batch3';
   assert(!d.updates.entries.some(x=>x.id===updateId),'previous publication update exists');
   d.updates.entries.unshift({id:updateId,date,type:'records',
    title:'2024/2025公式決勝'+confirmed.length+'戦績を通常結果へ追加',
    description:'S30 ME ZB Solo決勝、S31 NAC Solo決勝、S36 Console Duos NAW/NAC決勝。保存済みEpic ID・順位表と公式VR賞金ルールを照合。デュオはチーム賞金と個人賞金を区別、0VRは$0。過去の記録を保持。',
    recordIds:confirmed.map(x=>x.id)});
  }
  d.review.manualReviewedAt=now;d.reviewed.reviewedAt=now;d.approval.reviewedAt=now;
  d.status.manualReviewCandidates=d.review.proposals.length;d.status.found=d.review.proposals.length;
  d.status.manuallyPublished=(Number(d.status.manuallyPublished)||0)+confirmed.length;
  d.status.manuallyResolvedDuplicates=(Number(d.status.manuallyResolvedDuplicates)||0)+duplicates.length;
  d.status.lastReviewedBatchAt=now;
  d.status.latestManualReview={reviewedAt:now,reviewedCandidates:selected.size,
   published:confirmed.length,remainingPending:d.review.proposals.length,
   policy:'S30/S31 solo official $100 per VR, S36 duos $200 team per VR; exact leaderboard, zero VR=$0'};
  d.status.message='公式VR賞金額を確認した決勝'+confirmed.length+'件を通常戦績に追加。重複'+duplicates.length+'件を解消。過去の確認待ち'+d.review.proposals.length+'件。';
 }
 return {docs:d,report:{selected:selected.size,published:confirmed.map(x=>({id:x.id,date:x.date,region:x.region,player:x.player,rank:x.rank,vrs:x.vrs,prize:x.prize,prizePerPlayer:x.prizePerPlayer})),duplicates,held,remaining:d.review.proposals.length,changed:confirmed.length+duplicates.length>0}};
}
function main(){
 const src={results:read('results.json'),review:read('history-sync-review.json'),reviewed:read('history-sync-reviewed.json'),
  approval:read('approval-history.json'),updates:read('updates.json'),status:read('history-sync-status.json'),
  scan:read('history-sync-scan.json'),players:read('players.json'),tournaments:read('tournaments.json')};
 const out=reconcile(src,new Date().toISOString());
 console.log('VERIFIED_CASH_FINAL_BATCH '+JSON.stringify(out.report));
 if(process.argv.includes('--dry-run')||!out.report.changed)return;
 for(const [k,n] of Object.entries({results:'results.json',review:'history-sync-review.json',reviewed:'history-sync-reviewed.json',
  approval:'approval-history.json',updates:'updates.json',status:'history-sync-status.json'}))write(n,out.docs[k]);
 console.log('VERIFIED_FINALS_ARCHIVE '+JSON.stringify(appendArchive(ROOT,[],out.docs.results,{checkedAt:new Date().toISOString()})));
}
if(require.main===module)main();
module.exports={reconcile,GROUPS};
