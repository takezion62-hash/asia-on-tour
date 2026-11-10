'use strict';
// ASIA ON TOUR: small, fail-closed review publication from verified saved Epic-ID rows.
// This runs on the repository checkout so large results.json is never uploaded through an API.
const fs=require('node:fs');
const path=require('node:path');
const {equalCandidate,collision}=require('./manual-approval-core.cjs');
const {appendArchive}=require('./participation-archive.cjs');
const ROOT=path.resolve(__dirname,'..');
const RULE_S30='https://www.fortnite.com/news/fortnite-victory-cash-cups-chapter-5-season-3-official-rules';
const RULE_S31='https://www.fortnite.com/news/fortnite-victory-cash-cups-chapter-5-season-4-official-rules';
const W=[
 ['2024-06-04','S30','ME','S30_SoloVictoryCashCup','Event1Round1','ch5s3-solo-victory-cup',2000,RULE_S30],
 ['2024-06-04','S30','ME','S30_SoloZBVictoryCashCup','Event1Round1','ch5s3-zb-solo-victory',2000,RULE_S30],
 ['2024-06-11','S30','ME','S30_SoloVictoryCashCup','Event2Round1','ch5s3-solo-victory-cup',2000,RULE_S30],
 ['2024-06-11','S30','ME','S30_SoloZBVictoryCashCup','Event2Round1','ch5s3-zb-solo-victory',2000,RULE_S30],
 ['2024-09-16','S31','OCE','S31_SoloVictoryCashCup','Event3Round1','ch5s4-solo-victory-cup',1500,RULE_S31],
 // In C5S3 the rules call NAC the "NA" region; its top 5,000 proceed.
 ['2024-08-06','S30','NAC','S30_SoloVictoryCashCup','Event8Round1','ch5s3-solo-victory-cup',5000,RULE_S30],
 ['2024-08-13','S30','NAC','S30_SoloVictoryCashCup','Event9Round1','ch5s3-solo-victory-cup',5000,RULE_S30]
].map(([date,season,region,event,round,tournament,cutoff,rules])=>({
 date,season,region,event,window:season+'_'+event.slice(season.length+1)+'_'+round+'_'+region,
 tournament,cutoff,rules
}));
const read=n=>JSON.parse(fs.readFileSync(path.join(ROOT,n),'utf8'));
const write=(n,d)=>fs.writeFileSync(path.join(ROOT,n),JSON.stringify(d,null,2)+'\n');
const clone=d=>JSON.parse(JSON.stringify(d));
const assert=(yes,msg)=>{if(!yes)throw Error('VERIFIED_QUALIFIER_BATCH: '+msg)};
const props=['id','date','region','player','playerRaw','players','event','round','rank','points','kills','vrs','matches','prize','kind','seasonId','chapter','season','tournamentId','source','verified'];
const same=(a,b)=>props.every(k=>JSON.stringify(a?.[k]??null)===JSON.stringify(b?.[k]??null));
function reconcile(original,now='2026-11-10T22:35:00.000Z'){
 const d=clone(original),ids=new Set(d.results.map(x=>x.id));
 assert(ids.size===d.results.length,'existing results contain duplicate IDs');
 const catalogs=new Map(d.tournaments.catalog.map(x=>[x.id,x]));
 const playerNames=new Set(d.players.candidates.map(x=>x.name));
 const alreadyReviewed=new Set(d.reviewed.entries.map(x=>x.id));
 const published=[],duplicates=[],held=[],selected=new Set();
 for(const spec of W){
  const cpKey='epicgames_'+spec.event+'_'+spec.region+'/'+spec.window;
  const rows=d.review.proposals.filter(p=>p.date===spec.date&&p.seasonId===spec.season&&p.region===spec.region
    &&p.tournamentId===spec.tournament&&p.source?.includes('round='+spec.window));
  if(!rows.length)continue;
  const cp=d.scan.windows[cpKey],cat=catalogs.get(spec.tournament);
  assert(cp&&Array.isArray(cp.proposals)&&cp.nextPage>0&&cp.rankingOrderValid===true&&Number.isSafeInteger(cp.lastSeenRank),'ranking checkpoint not verified '+cpKey);
  assert(cat&&cat.seasonId===spec.season&&cat.team==='solo'&&cat.sourceEventIds?.includes(spec.event),'official catalog mismatch '+cpKey);
  for(const p of rows){
   assert(!selected.has(p.id),'duplicate pending ID '+p.id);selected.add(p.id);
   const u=new URL(p.source);
   assert(u.protocol==='https:'&&u.hostname==='www.fortnite.com'&&u.pathname==='/competitive/events/'+spec.event+'/'
    &&u.searchParams.get('region')===spec.region&&u.searchParams.get('round')===spec.window,'untrusted source '+p.id);
   assert(p.event===cat.name&&p.verified===true&&p.kind==='予選'&&p.round.includes('Round 1 / 予選')
    &&p.prize===0&&Number.isSafeInteger(p.rank)&&p.rank>=1&&p.rank<=spec.cutoff&&p.rank<=cp.lastSeenRank
    &&Number.isSafeInteger(p.points)&&p.points>=0&&Number.isSafeInteger(p.kills)&&p.kills>=0
    &&Number.isSafeInteger(p.vrs)&&p.vrs>=0&&Number.isSafeInteger(p.matches)&&p.matches>=1&&p.vrs<=p.matches
    &&playerNames.has(p.player),'not a verified eligible solo result '+p.id);
   const q=cp.proposals.filter(x=>x.id===p.id);
   assert(q.length===1&&equalCandidate(q[0],p)&&same(q[0],p),'saved Epic-ID rank/score differs '+p.id);
   const colliding=d.results.filter(x=>collision(x,p,d.players.confirmedAliases||{}));
   if(colliding.length){
    const x=colliding[0],sameStats=colliding.length===1&&x.date===p.date&&x.region===p.region
     &&x.tournamentId===p.tournamentId&&x.rank===p.rank&&x.points===p.points
     &&x.kills===p.kills&&x.vrs===p.vrs&&x.matches===p.matches
     &&x.player===p.player&&x.source===p.source;
    if(!sameStats){held.push(p.id);continue}
    duplicates.push(p.id);
    d.review.proposals=d.review.proposals.filter(x=>x.id!==p.id);
    if(!alreadyReviewed.has(p.id)){d.reviewed.entries.push({id:p.id,decision:'already-published',existingId:x.id,reviewedAt:now,source:p.source});alreadyReviewed.add(p.id)}
    continue;
   }
   assert(!ids.has(p.id),'ID collision '+p.id);
   const {reviewOnly,reviewReason,teamAccountIds,...entry}=p;
   entry.round=p.round.replace(/\/ 予選$/,'/ 予選突破');
   entry.prize=0;
   entry.note='Epic公式規則で'+spec.region+'上位'+spec.cutoff+'名が予選突破。'
    +'本人Epic IDと保存済みOsirion順位表の'+p.rank+'位を照合。'
    +'取得済み順位表ページの範囲内で確認。予選の現金賞金は$0。規則: '+spec.rules;
   d.results.push(entry);ids.add(entry.id);published.push(entry);
   d.review.proposals=d.review.proposals.filter(x=>x.id!==p.id);
   d.approval.entries.push({id:p.id,decision:'published',recordId:p.id,policy:'verified-rule',
    approvedAt:now,approvedBy:'ChatGPT (user-authorized GitHub integration)',rule:spec.rules,
    source:p.source,evidence:'Saved Epic ID, official ranked placement '+p.rank+' within top '+spec.cutoff+'; qualifier $0'});
   if(!alreadyReviewed.has(p.id)){d.reviewed.entries.push({id:p.id,decision:'published',recordId:p.id,reviewedAt:now,
    policy:'exact-saved-page-and-official-region-cutoff',source:p.source,officialRules:spec.rules});alreadyReviewed.add(p.id)}
  }
 }
 if(published.length||duplicates.length){
  const day=new Date(Date.parse(now)+9*3600000).toISOString().slice(0,10);
  if(published.length){
   const updateId=published.some(x=>x.region==='NAC')?'manual-qualifiers-20261111-batch2':'manual-qualifiers-20261111-batch1';
   assert(!d.updates.entries.some(x=>x.id===updateId),'update ID already exists');
   d.updates.entries.unshift({id:updateId,date:day,type:'records',
    title:'2024年ME/NAC公式予選突破'+published.length+'戦績を通常一覧に追加',
    description:'Epic IDと保存済み順位表、Epic公式2024地域別突破条件で確認。'
      +'2024年ME: 上位2000名、北米(NA/NAC): 上位5000名。予選現金賞金$0。旧参加アーカイブとの重複も整理。',
    recordIds:published.map(x=>x.id)});
  }
  d.approval.reviewedAt=now;d.reviewed.reviewedAt=now;d.review.manualReviewedAt=now;
  d.status.manualReviewCandidates=d.review.proposals.length;d.status.found=d.review.proposals.length;
  d.status.manuallyPublished=(Number(d.status.manuallyPublished)||0)+published.length;
  d.status.manuallyResolvedDuplicates=(Number(d.status.manuallyResolvedDuplicates)||0)+duplicates.length;
  d.status.lastReviewedBatchAt=now;
  d.status.latestManualReview={reviewedAt:now,reviewedCandidates:selected.size,
   published:published.length,remainingPending:d.review.proposals.length,
   policy:'Official 2024 solo qualification cutoffs and exact verified saved Epic-ID ranked rows; no inferred cash'};
  d.status.message='公式予選突破'+published.length+'件を通常成績に追加。重複'+duplicates.length+
    '件を解消。残り確認待ち'+d.review.proposals.length+'件。未確認賞金は推定しない。';
 }
 return {docs:d,report:{selected:selected.size,published:published.map(x=>({id:x.id,date:x.date,player:x.player,rank:x.rank,region:x.region})),duplicates,held,remaining:d.review.proposals.length,changed:published.length+duplicates.length>0}};
}
function main(){
 const original={results:read('results.json'),review:read('history-sync-review.json'),reviewed:read('history-sync-reviewed.json'),
  approval:read('approval-history.json'),updates:read('updates.json'),status:read('history-sync-status.json'),
  scan:read('history-sync-scan.json'),players:read('players.json'),tournaments:read('tournaments.json')};
 const out=reconcile(original,new Date().toISOString());
 console.log('VERIFIED_QUALIFIER_BATCH '+JSON.stringify(out.report));
 if(process.argv.includes('--dry-run')||!out.report.changed)return;
 for(const [key,filename] of Object.entries({results:'results.json',review:'history-sync-review.json',
   reviewed:'history-sync-reviewed.json',approval:'approval-history.json',updates:'updates.json',
   status:'history-sync-status.json'}))write(filename,out.docs[key]);
 const archive=appendArchive(ROOT,[],out.docs.results,{checkedAt:new Date().toISOString()});
 console.log('VERIFIED_QUALIFIER_ARCHIVE '+JSON.stringify(archive));
}
if(require.main===module)main();
module.exports={reconcile,W};
