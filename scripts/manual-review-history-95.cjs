'use strict';
// Manual, frozen-batch audit of the 95 historical review candidates recorded
// on 2026-11-06. Reconcile exact duplicate outcomes, publish only source-linked
// players, and use explicit Epic competition rules for qualification and cash.
// A partially scanned leaderboard is allowed only for an individually confirmed
// rank from an API page already held in the durable checkpoint.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const load=f=>JSON.parse(fs.readFileSync(path.join(root,f),'utf8'));
const save=(f,v)=>fs.writeFileSync(path.join(root,f),JSON.stringify(v,null,2)+'\n');
const plan=load('data/manual-approvals/20261106-remaining-95.json');
if(plan.version!==1||plan.entries.length!==95||new Set(plan.entries.map(x=>x.id)).size!==95)throw Error('Frozen 95-candidate audit plan is invalid');
const results=load('results.json'),review=load('history-sync-review.json'),scan=load('history-sync-scan.json');
const updates=load('updates.json'),ledger=load('history-sync-reviewed.json'),players=load('players.json'),tours=load('tournaments.json'),status=load('history-sync-status.json');
const marker='manual-reviewed-history-95-20261106';
if(updates.entries.some(x=>x.id===marker)){
 console.log('HISTORIC_MANUAL_REVIEW already applied');process.exit(0);
}
const RULE_CH5='https://www.fortnite.com/news/fortnite-victory-cash-cups-chapter-5-season-3-official-rules';
const RULE_CH6='https://www.fortnite.com/news/fortnite-duos-console-victory-cash-cups-chapter-6-season-3-official-rules';
const RULE_CH7='https://www.fortnite.com/competitive/rules-guidelines/rules-library/fortnite-victory-cups-chapter-7-season-4-official-rules';
const RULE_PS='https://www.fortnite.com/competitive/rules-guidelines/rules-library/days-of-play-playstation-cup-chapter-7-season-3-official-rules';
const RULE_UNREAL='https://www.fortnite.com/competitive/rules-guidelines/rules-library/1-million-dollar-unreal-cup-chapter-7-season-1-official-rules';
const known=new Set(players.candidates.map(x=>x.name)),catalog=new Map(tours.catalog.map(x=>[x.id,x]));
const orig=new Map(),checkpointById=new Map();
for(const [key,checkpoint] of Object.entries(scan.windows))
 for(const row of checkpoint.proposals||[]){
  if(orig.has(row.id)){
   const prev=orig.get(row.id);
   if(JSON.stringify(prev)!==JSON.stringify(row))throw Error('Conflicting checkpoint for '+row.id);
  }
  orig.set(row.id,row);
  checkpointById.set(row.id,{key,checkpoint});
 }
const months=new Map();
const jstWindow=(month,windowId,region,eventId)=>{
 if(!months.has(month))months.set(month,load('calendar-history/'+month+'.json').sessions);
 return months.get(month).find(x=>x.sourceWindowId===windowId&&x.region===region&&x.eventId===eventId);
};
const byId=new Map(results.map(x=>[x.id,x])),reviewById=new Map(review.proposals.map(x=>[x.id,x]));
const ledgerIds=new Set(ledger.entries.map(x=>x.id)),noteSuffix='（2026-11-06 Epic公式の開催枠・順位表と登録済みアカウントIDを手動再照合）';
const signature=x=>(x.players||[x.player]).slice().sort().join('\x1f');
const identity=x=>[x.date,x.region,x.tournamentId,String(x.round||'').split('/')[0].trim(),signature(x)].join('\x1f');
const notes=[];
const added=[],resolved=[],held=[];
for(const item of plan.entries){
 const prior=reviewById.get(item.id),scanOriginal=orig.get(item.id);
 // Concurrent historical ingestion can independently publish one ID; do not
 // reverse those writes, but resolve it as an already-published candidate.
 if(!prior&&byId.has(item.id)){resolved.push({id:item.id,decision:'already-published',existingId:item.id});continue}
 if(!prior&&ledgerIds.has(item.id)){resolved.push({id:item.id,decision:'previously-reviewed'});continue}
 if(!prior||!scanOriginal)throw Error('Frozen candidate missing from current review/checkpoint: '+item.id);
 for(const k of ['id','date','region','tournamentId','rank','points','kills','vrs','matches','kind','round'])
  if(prior[k]!==item[k]||scanOriginal[k]!==item[k])throw Error('Candidate metadata mismatch '+item.id+' '+k);
 if(signature(prior)!==item.roster||signature(scanOriginal)!==item.roster)throw Error('Player identity changed '+item.id);
 if(['source','player','playerRaw','verified'].some(k=>prior[k]!==scanOriginal[k]))
  throw Error('Epic API evidence changed '+item.id);
 if(prior.verified!==true||!Number.isSafeInteger(prior.rank)||prior.rank<1||
    !Number.isSafeInteger(prior.points)||prior.points<0||!Number.isSafeInteger(prior.kills)||prior.kills<0||
    !Number.isSafeInteger(prior.vrs)||prior.vrs<0||!Number.isSafeInteger(prior.matches)||prior.matches<1||
    prior.vrs>prior.matches)throw Error('Unverified or invalid leaderboard entry '+item.id);
 const persons=prior.players||[prior.player],t=catalog.get(prior.tournamentId);
 if(!t||!persons.length||persons.some(n=>!known.has(n))||new Set(persons).size!==persons.length||
    (prior.players&&prior.player!==persons.join(' / '))||!t.sourceEventIds?.length)throw Error('Unverified roster/catalog '+item.id);
 const expectedTeam={solo:1,duo:2,trio:3,squad:4}[t.team];
 if(expectedTeam!==persons.length)throw Error('Unexpected team size '+item.id);
 const url=new URL(prior.source),winId=url.searchParams.get('round'),matched=url.pathname.match(/^\/competitive\/events\/([^/]+)\/$/);
 if(url.protocol!=='https:'||url.hostname!=='www.fortnite.com'||!winId||!matched||
    url.searchParams.get('region')!==prior.region)throw Error('Missing official Epic source '+item.id);
 const eventId=decodeURIComponent(matched[1]),official=jstWindow(prior.date.slice(0,7),winId,prior.region,eventId);
 if(!t.sourceEventIds.includes(eventId)||!official||official.dateJst!==prior.date||
    official.tournamentId!==prior.tournamentId)throw Error('Epic window ID/JST mismatch '+item.id);
 const holder=checkpointById.get(item.id);
 if(!holder||holder.key!==('epicgames_'+eventId+'_'+prior.region+'/'+winId)||
    holder.checkpoint.nextPage<1||!holder.checkpoint.proposals?.some(x=>x.id===item.id))
    throw Error('Unscanned candidate '+item.id);
 if(item.decision==='duplicate'){
  const existing=byId.get(item.existingId);
  if(!existing||existing.date!==prior.date||existing.region!==prior.region||existing.tournamentId!==prior.tournamentId||
    signature(existing)!==signature(prior)||['rank','points','kills','vrs'].some(k=>existing[k]!==prior[k])||
    (existing.matches!=null&&existing.matches!==prior.matches))
    throw Error('Previously published entry does not match original: '+item.id);
  if(!String(existing.note||'').includes(prior.source)){
   existing.note=(existing.note||'')+' 公式出典の追加照合: '+prior.source;
  }
  if(existing.id==='s42-me-solo-vc-final-20260922-mell'&&existing.round==='Round 2 / 賞金決勝（Event番号未確認）')
   existing.round='Event 3 · Round 2 / 賞金決勝';
  ledger.entries.push({id:item.id,decision:'already-published',existingId:item.existingId,evidence:'Same player, official date, region, round score and verified rank. No new award counted.'});
  ledgerIds.add(item.id);resolved.push(item);
  continue;
 }
 if(item.decision!=='publish')throw Error('Unexpected plan disposition '+item.id);
 if(byId.has(item.id)||ledgerIds.has(item.id))throw Error('Previously registered proposed ID '+item.id);
 let round=prior.round,kind=prior.kind,prize=0,rule=prior.source,note='';
 const base=prior.tournamentId;
 if(base==='ch5s3-solo-victory-cup'){
  if(prior.region!=='ME'||prior.date!=='2024-07-23'||persons.length!==1)throw Error('Unexpected CH5 S3 candidate '+item.id);
  if(kind==='予選'&&/Event 6 · Round 1/.test(round)&&prior.rank<=2000&&prior.matches<=7){
   round='Event 6 · Round 1 / 予選突破';
   note='Epic公式規則ME上位2000名がRound 2進出。順位表'+prior.rank+'位。予選は現金$0。';
  }else if(kind==='賞金決勝'&&/Event 6 · Round 2/.test(round)&&prior.vrs===1&&prior.matches<=3&&prior.prize===null){
   prize=100;
   note='Epic公式規則ではRound 2のビクロイ1回につき$100。公式IDの順位表で1VR確認。';
  }else throw Error('Unsafe CH5 solo event '+item.id);
  rule=RULE_CH5;
 }else if(base==='ch7s4-solo-victory-cup'){
  if(prior.region!=='NAW'||prior.date!=='2026-09-06'||kind!=='予選'||
     !/Event 1 · Round 1/.test(round)||prior.rank>800||prior.matches>8)
    throw Error('Unexpected NAW Solo VC qualifier '+item.id);
  round='Event 1 · Round 1 / 予選突破';
  note='Epic CH7 S4公式のNAW予選通過枠800名以内。公式IDの順位表で'+prior.rank+'位を確認。予選は現金$0。';
  rule=RULE_CH7;
 }else if(base==='ch6s3-console-duos-victory'){
  if(prior.date!=='2025-06-14'||kind!=='予選'||prior.matches>7||
     !/Event 1 · Round 1/.test(round)||!['NAC','EU'].includes(prior.region))throw Error('Bad CH6 console qualifier '+item.id);
  if(prior.region==='NAC'&&prior.rank<=500){round='Event 1 · Round 1 / 予選突破';note='Epic公式規則NAC上位500組の予選突破条件を満たす。';}
  else if(prior.region==='EU'&&prior.rank>500){note='Epic公式規則EU予選通過上位500組の範囲外。参加順位のみ掲載、突破加点なし。';}
  else throw Error('CH6 console qualification unclear '+item.id);
  rule=RULE_CH6;
 }else if(base==='ch7s3-days-of-play-playstation-cup-br'){
  if(prior.region!=='NAW'||kind!=='参加確認'||persons.length!==1)throw Error('Bad PlayStation entry '+item.id);
  if(prior.date==='2026-06-08'&&round.startsWith('Qualifier /')){
   kind='予選';round='Session 1 · Round 1 / '+(prior.rank<=50?'予選突破':'予選');
   note=prior.rank<=50?'Epic公式条件でNAW予選の上位50名。公式ID・順位を確認し、予選突破。':'NAWのQualifier第1ラウンドに参加。上位50名の通過条件外なので、この枠では突破未確認。';
  }else if(prior.date==='2026-06-11'&&round.startsWith('Final /')&&prior.rank>50){
   kind='賞金決勝';round='Session 1 · Round 2 / 賞金決勝';
   note='NAW決勝の公式賞金対象は上位50名。'+prior.rank+'位のため現金$0。';
  }else throw Error('PlayStation round/award unclear '+item.id);
  rule=RULE_PS;
 }else if(base==='ch7s2-fncs-division-1'){
  if(prior.date!=='2026-03-29'||prior.region!=='ME'||prior.rank!==29||persons.length!==2)
   throw Error('Unexpected FNCS Div1 unprized result '+item.id);
  round='Week 1 · Final / 参加確認';kind='参加確認';prize=null;
  note='FNCS Division 1 Week 1 FinalのEpic公式大会ウィンドウで順位を確認。賞金対象か不明のため現金賞金は未確定、加算なし。';
 }else if(base==='ch7s4-performance-evaluation'){
  if(prior.region!=='EU'||kind!=='参加確認'||prior.prize!==null||!/Round 1/.test(round))
   throw Error('Performance Eval status unclear '+item.id);
  note='EU Performance Evaluation Round 1への参加確認。予選通過や賞金は確認していない。';
 }else if(base==='ch7s1-one-million-unreal-cup'){
  if(prior.region!=='NAW'||prior.rank<=500||prior.date!=='2025-12-21'||prior.prize!==null)throw Error('Unreal cash threshold unclear '+item.id);
  round='Session 1 / 参加確認';
  note='Epic公式のNAW現金賞金対象500位以内の範囲外。参加のみ掲載、現金$0。';rule=RULE_UNREAL;
 }else if(base==='ch7s3-champion-aphrodite-fncs-cup-battle-royale'){
  if(prior.region!=='ME'||prior.date!=='2026-08-01'||kind!=='参加確認'||prior.rank<5000)
   throw Error('Cosmetic FNCS cutoff/status unclear '+item.id);
  round='Session 1 / 参加確認';
  note='FNCS Community Cup参加をEpic公式の順位表で確認。衣装・アクセサリー等の報酬取得は未確認、現金$0。';
 }else if(base==='ch7s4-madison-beer-icon-cup-reload'){
  if(prior.region!=='NAW'||prior.date!=='2026-09-25'||kind!=='参加確認'||prior.rank<=100)
   throw Error('Icon Cup reward status unclear '+item.id);
  round='Session 1 / 参加確認';
  note='Madison Beer Icon Cupへの参加をEpic IDで確認。スキン報酬の獲得は未確認、現金$0。';
 }else throw Error('Unexpected series in approved batch '+base+' '+item.id);
 if(!Number.isSafeInteger(prize)&&prize!==null)throw Error('Prize not verified '+item.id);
 const {reviewReason,reviewOnly,...original}=prior;
 const row={...original,round,kind,prize,note:note+' 根拠: '+rule+' '+noteSuffix};
 if(results.some(x=>identity(x)===identity(row)))throw Error('Semantic duplicate found for '+item.id);
 results.push(row);byId.set(row.id,row);
 ledger.entries.push({id:row.id,decision:'published',recordId:row.id,rule,evidence:'Manual checked Epic window, checkpoint ranks, existing-record uniqueness and official award/qualification threshold'});
 ledgerIds.add(row.id);added.push(row);
 notes.push({id:row.id,kind,prize,series:base});
}
if(added.length!==77||resolved.filter(x=>x.decision==='duplicate').length!==18||
   plan.entries.filter(x=>x.decision==='publish').length!==77)
 throw Error('Unexpected disposition, stop rather than publishing partial: '+added.length+'/'+resolved.length);
const newIdSet=new Set(added.map(x=>x.id)),cleared=new Set(plan.entries.map(x=>x.id));
review.proposals=review.proposals.filter(x=>!cleared.has(x.id));
review.manualReviewedAt=new Date().toISOString();
ledger.reviewedAt=review.manualReviewedAt;
status.found=review.proposals.length;
status.manualReviewCandidates=review.proposals.length;
status.reviewOnlyCandidates=review.proposals.filter(x=>x.reviewOnly).length;
status.manuallyPublished=added.length;
status.manuallyResolvedDuplicates=18;
status.message='過去大会確認待ち95件を手動照合。新規77件、既存重複18件、今回対象の残件0件。';
updates.entries.unshift({id:marker,date:'2026-11-06',type:'records',
 title:'過去大会の確認済み77戦績を追加',
 description:'Epic IDと公式大会ウィンドウ、規則を照合。2024年ME Victory Cup、2026年NAW Victory Cupなど予選突破・2024年ME決勝1VR$100×2・その他参加記録を掲載。重複18候補は既存戦績へ出典統合。スキン等未確定報酬は加算しない。',
 recordIds:added.map(x=>x.id)});
save('results.json',results);save('history-sync-review.json',review);
save('history-sync-reviewed.json',ledger);save('history-sync-status.json',status);save('updates.json',updates);
console.log('MANUAL_HISTORY_95 '+JSON.stringify({published:added.length,duplicates:18,remaining:review.proposals.length,prizeRecords:added.filter(x=>x.prize>0).map(x=>({name:x.player,prize:x.prize})),byTournament:notes.reduce((a,x)=>(a[x.series]=(a[x.series]||0)+1,a),{}),results:results.length}));
