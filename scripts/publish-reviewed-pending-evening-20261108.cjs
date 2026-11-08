'use strict';
/**
 * One-time hand-reviewed 2026-11-08 evening backlog publication.
 * Exactly the 32 queue IDs selected by ChatGPT after comparing saved
 * Epic/Osirion standings against Fortnite Tracker and original Epic rules.
 * Reads current main on every execution. Never writes data without checking
 * original checkpoint, official series cutoff, roster and existing records.
 *
 * Does NOT infer paid prizes, FNCS final qualification from a single day,
 * or cosmetics delivery. Any uncertain collision stays in review.
 */
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const {linkedAccounts}=require('./osirion-sync.cjs');
const {sameScannedCandidate}=require('./verified-partial-page.cjs');
const {collision}=require('./manual-approval-core.cjs');
const {CUT_OFFS}=require('./cosmetic-rank-rules.cjs');
const list=Object.freeze([
  {
    "id": "auto-s43-9d42693207cd",
    "tournamentId": "ch7s5-one-piece-zoro-cup-zero-build",
    "rank": 363
  },
  {
    "id": "auto-s43-37b3d4421c8d",
    "tournamentId": "ch7s5-one-piece-zoro-cup-zero-build",
    "rank": 374
  },
  {
    "id": "auto-s42-c89b5a4a433d",
    "tournamentId": "ch7s4-performance-evaluation",
    "rank": 908
  },
  {
    "id": "auto-s42-4783b94daf29",
    "tournamentId": "ch7s4-performance-evaluation",
    "rank": 910
  },
  {
    "id": "auto-s42-f9aa442dafd0",
    "tournamentId": "ch7s4-performance-evaluation",
    "rank": 922
  },
  {
    "id": "auto-s42-e59e0c0024fc",
    "tournamentId": "ch7s4-performance-evaluation",
    "rank": 1041
  },
  {
    "id": "auto-s39-1fb3f5e13469",
    "tournamentId": "ch7s1-one-million-unreal-cup",
    "rank": 4781
  },
  {
    "id": "auto-s31-836b2c756855",
    "tournamentId": "ch5s4-duos-cash-cup",
    "rank": 1058
  },
  {
    "id": "auto-s31-241a6a759863",
    "tournamentId": "ch5s4-duos-cash-cup",
    "rank": 1471
  },
  {
    "id": "auto-s31-5c8aae1a97c0",
    "tournamentId": "ch5s4-duos-cash-cup",
    "rank": 1685
  },
  {
    "id": "auto-s41-58909aa5fe59",
    "tournamentId": "ch7s3-days-of-play-playstation-cup-br",
    "rank": 4321
  },
  {
    "id": "auto-s42-e2ee81373ff7",
    "tournamentId": "ch7s4-performance-evaluation",
    "rank": 1237
  },
  {
    "id": "auto-s31-3f7f463435a0",
    "tournamentId": "ch5s4-duos-cash-cup",
    "rank": 2093
  },
  {
    "id": "auto-s31-ef6050715853",
    "tournamentId": "ch5s4-duos-cash-cup",
    "rank": 2235
  },
  {
    "id": "auto-s39-f565464e0467",
    "tournamentId": "ch7s1-one-million-unreal-cup",
    "rank": 6813
  },
  {
    "id": "auto-s42-9715b7bcb37d",
    "tournamentId": "ch7s4-solo-victory-cup",
    "rank": 1464
  },
  {
    "id": "auto-s41-21554375eec1",
    "tournamentId": "ch7s3-fncs-division-1",
    "rank": 78
  },
  {
    "id": "auto-s41-04189e65d91c",
    "tournamentId": "ch7s3-fncs-division-1",
    "rank": 176
  },
  {
    "id": "auto-s42-7d1eeadd439a",
    "tournamentId": "ch7s4-madison-beer-icon-cup-reload",
    "rank": 6644
  },
  {
    "id": "auto-s41-371af6c68f60",
    "tournamentId": "ch7s3-champion-aphrodite-fncs-cup-battle-royale",
    "rank": 2002
  },
  {
    "id": "auto-s30-759687540552",
    "tournamentId": "ch5s3-solo-victory-cup",
    "rank": 1240
  },
  {
    "id": "auto-s30-cd8e7b1dd9af",
    "tournamentId": "ch5s3-solo-victory-cup",
    "rank": 1344
  },
  {
    "id": "auto-s30-5d733e736ac9",
    "tournamentId": "ch5s3-solo-victory-cup",
    "rank": 1345
  },
  {
    "id": "auto-s30-39015b071d4e",
    "tournamentId": "ch5s3-solo-victory-cup",
    "rank": 1347
  },
  {
    "id": "auto-s30-1497c00aa126",
    "tournamentId": "ch5s3-solo-victory-cup",
    "rank": 1351
  },
  {
    "id": "auto-s31-9c05023ad6d0",
    "tournamentId": "ch5s4-duos-cash-cup",
    "rank": 4227
  },
  {
    "id": "auto-s42-3448df924bae",
    "tournamentId": "ch7s4-solo-victory-cup",
    "rank": 2310
  },
  {
    "id": "auto-s41-46ebb3dedac4",
    "tournamentId": "ch7s3-fncs-division-1",
    "rank": 235
  },
  {
    "id": "auto-s41-a1d5026632c3",
    "tournamentId": "ch7s3-fncs-division-1",
    "rank": 290
  },
  {
    "id": "auto-s41-be73453a4632",
    "tournamentId": "ch7s3-fncs-division-1",
    "rank": 292
  },
  {
    "id": "auto-s41-a748712a1404",
    "tournamentId": "ch7s3-fncs-division-1",
    "rank": 295
  },
  {
    "id": "auto-s41-b446a01ccbc3",
    "tournamentId": "ch7s3-fncs-division-1",
    "rank": 392
  }
]);
const read=name=>JSON.parse(fs.readFileSync(path.join(root,name),'utf8'));
const write=(name,v)=>fs.writeFileSync(path.join(root,name),JSON.stringify(v,null,2)+'\n');
const must=(b,s)=>{if(!b)throw Error('DIRECT_REVIEW_SAFETY '+s)};
const members=r=>Array.isArray(r?.players)&&r.players.length?r.players:[r?.player];
const numeric=['rank','points','kills','vrs','matches'];
const samePerformance=(a,b)=>
 a&&b&&['date','region','tournamentId','event',...numeric].every(k=>a[k]===b[k])&&
  members(a).slice().sort().join('\u001f')===members(b).slice().sort().join('\u001f');
const RULES={
 'ch7s4-solo-victory-cup':{region:'EU',scope:'qualified',cutoff:4000,
  maxMatches:8,minimumPoints:204,round:/^Event 2 · Round 1 \/ 予選$/,
  source:'https://www.fortnite.com/competitive/rules-guidelines/rules-library/fortnite-victory-cups-chapter-7-season-4-official-rules',
  reference:'https://fortnitetracker.com/events/epicgames_S42_SoloVictoryCup_EU?window=S42_SoloVictoryCup_Event2Round1_EU'},
 'ch5s3-solo-victory-cup':{region:'OCE',scope:'qualified',cutoff:2000,
  maxMatches:7,minimumPoints:93,round:/^Event 6 · Round 1 \/ 予選$/,
  source:'https://www.fortnite.com/news/fortnite-victory-cash-cups-chapter-5-season-3-official-rules',
  reference:'https://fortnitetracker.com/events/epicgames_S30_SoloVictoryCashCup_OCE?window=S30_SoloVictoryCashCup_Event6Round1_OCE'},
 'ch5s4-duos-cash-cup':{region:'ME',scope:'round1-nonqualifier',cutoff:50,
  maxMatches:10,round:/^Event 5 · Round 1 \/ 参加確認$/,
  source:'https://www.fortnite.com/news/duos-cash-cups-chapter-5-season-4-official-rules',
  reference:'https://fortnitetracker.com/events/epicgames_S31_DuosCashCup_ME?window=S31_DuosCashCup_Event5Round1_ME'},
 'ch7s4-performance-evaluation':{region:'NAC',scope:'round1-nonqualifier',
  cutoff:50,maxMatches:7,round:/^Event 1 · Round 1 \/ 参加確認$/,
  source:'https://www.fortnite.com/competitive/rules-guidelines/rules-library/fortnite-performance-evaluation-chapter-7-official-rules',
  reference:'https://www.fortnite.com/competitive/events/S42_PerformanceEvaluation/?region=NAC'},
 'ch7s3-fncs-division-1':{region:'ME',scope:'day1-participation',maxMatches:11,
  round:/^単一開催枠 \/ 参加確認$/,
  source:'https://www.fortnite.com/competitive/rules-guidelines/rules-library/fncs-divisional-cups-chapter-7-season-3-official-rules',
  reference:'https://fortnitetracker.com/events/epicgames_S41_FNCSDivisionalCup_Division1_ME?window=S41_FNCSDivisionalCup_Division1_Week3Day1_ME'},
 'ch7s3-days-of-play-playstation-cup-br':{region:'NAW',scope:'qualifier-participation',
  round:/^Qualifier \/ 参加確認$/,
  source:'https://www.fortnite.com/competitive/events/S41_PSCupDaysOfPlay/?region=NAW',
  reference:'https://blog.playstation.com/2026/05/26/days-of-play-2026-begins-may-27/'},
 'ch7s4-madison-beer-icon-cup-reload':{region:'NAW',scope:'cosmetic-participation',
  round:/^単一開催枠 \/ 参加確認$/,
  source:'https://www.fortnite.com/competitive/events/S42_MadisonBeerIconCup/?region=NAW',
  reference:'https://fortnitetracker.com/events/epicgames_S42_MadisonBeerIconCup_ME'},
 'ch7s3-champion-aphrodite-fncs-cup-battle-royale':{region:'OCE',scope:'cosmetic-participation',
  round:/^単一開催枠 \/ 参加確認$/,
  source:'https://www.fortnite.com/competitive/rules-guidelines/rules-library/champion-aphrodite-fncs-cup-chapter-7-season-3-official-rules',
  reference:'https://www.fortnite.com/competitive/events/S41_FNCSCommunityCup/?region=OCE'},
 'ch7s1-one-million-unreal-cup':{region:'EU',scope:'unreal-unpaid',cutoff:2000,
  maxMatches:10,round:/^単一開催枠 \/ 参加確認$/,
  source:'https://www.fortnite.com/competitive/rules-guidelines/rules-library/1-million-dollar-unreal-cup-chapter-7-season-1-official-rules',
  reference:'https://www.fortnite.com/competitive/events/S39_1MillionUnrealCup/?region=EU'},
 'ch7s5-one-piece-zoro-cup-zero-build':{region:'EU',scope:'zoro-existing-or-cosmetic',
  cutoff:525,maxMatches:11,round:/^単一開催枠 \/ 参加確認$/,
  source:'https://www.fortnite.com/competitive/rules-guidelines/rules-library/fortnite-one-piece-zoro-cups-chapter-7-mini-season-official-rules',
  reference:'https://www.fortnite.com/competitive/events/S43_OnePieceZoroCup_ZB/?region=EU'}
};
function original(row,scans){
 const u=new URL(row.source);
 must(u.protocol==='https:'&&u.hostname==='www.fortnite.com'&&
  !u.username&&!u.password&&!u.hash,'invalid Epic source '+row.id);
 const m=u.pathname.match(/^\/competitive\/events\/([^/]+)\/$/);
 must(!!m,'invalid Epic event path '+row.id);
 const eventId=decodeURIComponent(m[1]);
 const win=u.searchParams.get('round');
 must(!!win&&u.searchParams.get('region')===row.region&&
  win.startsWith(row.seasonId+'_')&&win.endsWith('_'+row.region),
  'source window mismatch '+row.id);
 let found=[];
 for(const [scope,scan] of Object.entries(scans)){
  for(const [key,cp] of Object.entries(scan.windows||{})){
   const match=cp.proposals?.find(p=>p.id===row.id);
   if(match&&key.endsWith('/'+win)){
    if(!sameScannedCandidate(match,row))throw Error('scan tampering '+row.id);
    found.push({scope,key,cp});
   }
  }
 }
 must(found.length>0,'no saved source checkpoint '+row.id);
 found.sort((a,b)=>Number(b.cp.complete)-Number(a.cp.complete)||Number(b.cp.pages)-Number(a.cp.pages));
 const best=found[0],cp=best.cp;
 must(cp.rankingOrderValid===true&&Number.isSafeInteger(cp.pages)&&cp.pages>0&&
  Number.isSafeInteger(cp.nextPage)&&cp.nextPage>=1&&
  Number.isSafeInteger(cp.lastSeenRank)&&cp.lastSeenRank>=row.rank&&
  !cp.lastErrorCode&&!cp.lastError&&!cp.retryAfter&&!cp.emptyAttempts,
  'unsafe saved rank/order or retry '+row.id);
 const observedAt=Date.parse(cp.lastSuccessAt||'');
 must(Number.isFinite(observedAt)&&observedAt>Date.parse(row.date+'T00:00:00Z')+4*3600000,
  'unsettled leaderboard '+row.id);
 must(best.key==='epicgames_'+eventId+'_'+row.region+'/'+win,
  'scan key mismatch '+row.id);
 return {cp,eventId,windowId:win};
}
function approve(row,rule,db,src){
 must(row.verified===true&&row.reviewOnly!==false&&
  numeric.every(k=>Number.isSafeInteger(row[k])&&row[k]>=(k==='rank'||k==='matches'?1:0))&&
  row.vrs<=row.matches&&row.prize===null||row.verified===true&&row.reviewOnly!==true&&
  row.kind==='予選'&&row.prize===0&&numeric.every(k=>Number.isSafeInteger(row[k])&&row[k]>=(k==='rank'||k==='matches'?1:0))&&row.vrs<=row.matches,
  'unverified score or cash '+row.id);
 const catalog=db.tournaments.catalog.find(t=>t.id===row.tournamentId);
 must(catalog&&catalog.seasonId===row.seasonId&&catalog.name===row.event&&
  catalog.sourceEventIds.includes(src.eventId)&&catalog.team&&catalog.series,
  'missing official catalog '+row.id);
 const people=members(row),size={solo:1,duo:2,trio:3,squad:4}[catalog.team];
 must(people.length===size&&new Set(people).size===size&&
  row.player===people.join(' / ')&&people.every(x=>db.players.candidates.some(p=>p.name===x)),
  'roster mismatch '+row.id);
 must(row.region===rule.region&&rule.round.test(row.round)&&
  (!rule.maxMatches||row.matches<=rule.maxMatches)&&
  (!row.teamAccountIds||row.teamAccountIds.length===size&&
   row.teamAccountIds.every(id=>typeof id==='string'&&/^[0-9a-f]{32}$/.test(id))),
   'region/round/match cap/identities '+row.id);
 if(row.teamAccountIds){
  const map=new Map(db.verifiedAccounts.map(x=>[x.epicAccountId,x.player]));
  must(row.teamAccountIds.every((id,i)=>map.get(id)===people[i]),'unconfirmed Epic ID for '+row.id);
 }
 let output,detail='';
 const {reviewOnly,reviewReason,teamAccountIds,note,...base}=row;
 if(rule.scope==='qualified'){
  must(row.kind==='予選'&&row.prize===0&&row.rank<=rule.cutoff&&
   row.points>=rule.minimumPoints&&size===1,'qualifier cutoff not met '+row.id);
  detail='公式上位'+rule.cutoff+'人・Tracker上の通過pt '+rule.minimumPoints+'を満たすため予選突破';
  output={...base,kind:'予選',round:row.round.replace(/\/ 予選$/,'/ 予選突破'),prize:0};
 }else if(rule.scope==='round1-nonqualifier'){
  must(row.kind==='参加確認'&&row.prize===null&&row.rank>rule.cutoff,
   'nonqualifier condition not met '+row.id);
  detail='Round1は現金賞金なし。上位'+rule.cutoff+'組の決勝進出条件には入らない';
  output={...base,kind:'予選',round:row.round.replace(/\/ 参加確認$/,'/ 予選'),prize:0};
 }else if(rule.scope==='day1-participation'){
  must(src.windowId.includes('Week3Day1')&&row.kind==='参加確認'&&row.prize===null,
   'FNCS day1-only evidence missing '+row.id);
  detail='FNCS Division1のWeek3 Day1参加確認。週間合算による決勝進出・週間決勝賞金は未確認';
  output={...base,kind:'参加確認',prize:0};
 }else if(rule.scope==='qualifier-participation'){
  must(src.windowId.includes('Qualifier')&&row.rank>100&&
   row.kind==='参加確認'&&row.prize===null,'PlayStation qualifier assumptions unsafe '+row.id);
  detail='PlayStation Cupの予選参加。決勝進出・賞金受賞なし';
  output={...base,kind:'予選',round:row.round.replace(/\/ 参加確認$/,'/ 予選'),prize:0};
 }else if(rule.scope==='cosmetic-participation'){
  must(row.kind==='参加確認'&&row.prize===null&&row.rank>60,
   'cosmetic region prize unknown '+row.id);
  detail='参加・順位を確認。現金賞金$0。衣装獲得条件とは区別、ポイント条件の別報酬は配布未確認';
  output={...base,kind:'参加確認',prize:0};
 }else if(rule.scope==='unreal-unpaid'){
  must(row.kind==='参加確認'&&row.prize===null&&row.rank>rule.cutoff,
   'Unreal award cutoff not verified '+row.id);
  detail='EUの公式賞金対象は上位'+rule.cutoff+'組。圏外のためチーム賞金$0・個人賞金$0';
  output={...base,kind:'賞金決勝',round:'Session 1 / 賞金決勝',prize:0,prizePerPlayer:0};
 }else if(rule.scope==='zoro-existing-or-cosmetic'){
  must(row.kind==='参加確認'&&row.prize===null&&row.rank<=rule.cutoff,
   'Zoro cosmetic cutoff not verified '+row.id);
  must(CUT_OFFS[row.tournamentId]?.ranks?.EU===rule.cutoff,'Zoro official registry mismatch');
  detail='EU上位'+rule.cutoff+'組に入るスキン報酬対象順位。配布・受給確認までは未認定';
  output={...base,kind:'スキン大会',round:'単一開催枠 / スキン獲得',prize:0};
 }else throw Error('Unhandled rule scope '+rule.scope);
 output.note='ChatGPTが2026-11-08に公式Epic/Osirion保存順位表とTracker大会条件を照合。'+
   row.region+' '+row.rank+'位、'+row.points+'pt、'+row.kills+'K、'+row.vrs+'VR、'+row.matches+
   '試合。'+detail+'。規則: '+rule.source+' 比較元: '+rule.reference;
 return {record:output,rule:rule.source};
}
function main(){
 const db={results:read('results.json'),updates:read('updates.json'),
  players:read('players.json'),tournaments:read('tournaments.json'),
  reviews:{history:read('history-sync-review.json'),auto:read('auto-sync-review.json')},
  statuses:{history:read('history-sync-status.json'),auto:read('auto-sync-status.json')},
  scans:{history:read('history-sync-scan.json'),auto:read('auto-sync-scan.json')},
  reviewed:read('history-sync-reviewed.json')};
 db.verifiedAccounts=linkedAccounts({players:db.players,results:db.results}).accounts;
 const selected=new Set(list.map(x=>x.id));
 must(selected.size===32&&Object.keys(RULES).length===10,'unexpected hand-selected batch');
 must(list.every(x=>RULES[x.tournamentId]),'unknown hand-selected tournament');
 const queues={history:new Map(db.reviews.history.proposals.map(x=>[x.id,x])),
  auto:new Map(db.reviews.auto.proposals.map(x=>[x.id,x]))};
 const existingIds=new Set(db.results.map(x=>x.id));
 const processed=new Set(db.reviewed.entries.map(x=>x.id));
 const now=new Date().toISOString(),found={approved:[],duplicates:[],held:[],missing:[]},resolved=new Set();
 const before=db.results.length;
 for(const {id,tournamentId,rank} of list){
  const row=queues.history.get(id)||queues.auto.get(id);
  if(!row){
   if(existingIds.has(id)||processed.has(id)){
    found.duplicates.push({id,reason:'already resolved by concurrent publication'});
   }else found.missing.push({id,reason:'not currently in pending queue'});
   continue;
  }
  if(row.tournamentId!==tournamentId||row.rank!==rank){
   found.held.push({id,reason:'rank or tournament changed since review'});continue;
  }
  if(existingIds.has(id)||processed.has(id)){
   resolved.add(id);found.duplicates.push({id,reason:'candidate already processed'});
   continue;
  }
  const rule=RULES[tournamentId];
  let choice;
  try{const src=original(row,db.scans);choice=approve(row,rule,db,src)}
  catch(e){found.held.push({id,reason:String(e.message)});continue}
  const record=choice.record;
  const clashes=db.results.filter(old=>collision(old,record,db.players.confirmedAliases));
  if(clashes.length){
   if(clashes.length===1&&samePerformance(clashes[0],record)&&
      (clashes[0].prize===record.prize||clashes[0].prize===null&&record.prize===0)){
    resolved.add(id);
    found.duplicates.push({id,existingId:clashes[0].id,reason:'matching published performance'});
    db.reviewed.entries.push({id,decision:'already-published',existingId:clashes[0].id,
      reviewedAt:now,approvedBy:'ChatGPT source review 2026-11-08 evening',
      source:row.source,evidence:'Compared original Epic window, roster, rank and scores; no duplicate record added'});
    processed.add(id);
   }else found.held.push({id,reason:'different existing result for same event/roster',
      existingIds:clashes.map(x=>x.id),existing:clashes.map(x=>({id:x.id,rank:x.rank,points:x.points,kills:x.kills,vrs:x.vrs,matches:x.matches,prize:x.prize,kind:x.kind,round:x.round}))});
   continue;
  }
  // Preserve original measured scores, never create an unexpected payout.
  must(record.prize===0&&numeric.every(k=>record[k]===row[k])&&
    record.verified===true&&record.reviewOnly!==true,
    'final record changed stats or inferred money '+id);
  db.results.push(record);existingIds.add(id);resolved.add(id);
  found.approved.push({id,player:record.player,rank:record.rank,
   kind:record.kind,round:record.round,prize:record.prize,tournamentId});
  db.reviewed.entries.push({id,recordId:id,decision:'published',reviewedAt:now,
   approvedBy:'ChatGPT verified review 2026-11-08 evening',
   policy:'source-verified-round-or-attendance',officialRules:choice.rule,source:record.source,
   evidence:'Rank and scores from saved exact Epic/Osirion checkpoint; category and $0 per documented rules'});
  processed.add(id);
 }
 const newlyPublished=found.approved.length;
 if(resolved.size){
  for(const scope of ['history','auto']){
   db.reviews[scope].proposals=db.reviews[scope].proposals.filter(x=>!resolved.has(x.id));
   db.reviews[scope].manualReviewedAt=now;
   db.statuses[scope].found=db.reviews[scope].proposals.length;
   db.statuses[scope].manualReviewCandidates=db.reviews[scope].proposals.length;
   db.statuses[scope].reviewOnlyCandidates=db.reviews[scope].proposals.filter(x=>x.reviewOnly===true).length;
   db.statuses[scope].lastReviewedBatchAt=now;
   db.statuses[scope].message='ChatGPT確認済み直接掲載'+newlyPublished+'件（全履歴・直近合計）。残り'+db.reviews[scope].proposals.length+'件。';
  }
  db.reviewed.reviewedAt=now;
 }
 if(newlyPublished){
  const entry='assistant-reviewed-pending-20261108-evening';
  must(!db.updates.entries.some(x=>x.id===entry),'updates ID already present');
  db.updates.entries.unshift({id:entry,date:new Date(Date.now()+9*3600000).toISOString().slice(0,10),
   type:'records',title:'ChatGPTが確認待ちを調査し'+newlyPublished+'件の成績を直接掲載',
   description:'Fortnite Trackerの大会通過ライン・Epic公式規則とOsirion保存順位表、本人の掲載名、実測順位とスコアを突き合わせて直接掲載。賞金受給・衣装配布・未確認の決勝進出は推定しない。重複疑いは保留。',
   recordIds:found.approved.map(x=>x.id)});
 }
 const report={at:now,selected:list.length,approved:newlyPublished,duplicates:found.duplicates.length,
  held:found.held.length,missing:found.missing.length,details:found,
  before,after:db.results.length,remaining:{history:db.reviews.history.proposals.length,auto:db.reviews.auto.proposals.length}};
 console.log('AOT_DIRECT_EVENING_REVIEW '+JSON.stringify(report));
 if(process.argv.includes('--dry-run')||!resolved.size)return;
 for(const [file,o] of Object.entries({
  'results.json':db.results,'updates.json':db.updates,
  'history-sync-review.json':db.reviews.history,'auto-sync-review.json':db.reviews.auto,
  'history-sync-status.json':db.statuses.history,'auto-sync-status.json':db.statuses.auto,
  'history-sync-reviewed.json':db.reviewed}))write(file,o);
}
if(require.main===module)main();
module.exports={main,list,RULES};
