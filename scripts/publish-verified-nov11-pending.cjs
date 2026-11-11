'use strict';
// 2026-11-11: Source-verified historic review batch. Only exact original
// Epic account+event+ranked checkpoint rows are published; no uncertain cash.
// Integrate into the ordinary results feed. No separate attendance archive.
const fs=require('node:fs'),path=require('node:path');
const {equalCandidate,collision}=require('./manual-approval-core.cjs');
const root=path.resolve(__dirname,'..');
const read=n=>JSON.parse(fs.readFileSync(path.join(root,n),'utf8'));
const write=(n,x)=>fs.writeFileSync(path.join(root,n),JSON.stringify(x,null,2)+'\n');
const now=new Date().toISOString(),dry=process.argv.includes('--dry-run');
const R30='https://www.fortnite.com/news/fortnite-victory-cash-cups-chapter-5-season-3-official-rules';
const R39='https://www.fortnite.com/competitive/rules-guidelines/rules-library/fortnite-solo-victory-cups-chapter-7-season-1-official-rules';
const cases=[
 // Exact 2024 C5S3 Round 1: NAC/NA top 5,000; ME top 2,000.
 ['2024-06-18','NAC','S30_SoloVictoryCashCup','S30_SoloVictoryCashCup_Event3Round1_NAC','ch5s3-solo-victory-cup',5000],
 ['2024-06-25','ME','S30_SoloVictoryCashCup','S30_SoloVictoryCashCup_Event4Round1_ME','ch5s3-solo-victory-cup',2000],
 ['2024-06-25','ME','S30_SoloZBVictoryCashCup','S30_SoloZBVictoryCashCup_Event4Round1_ME','ch5s3-zb-solo-victory',2000],
 ['2024-06-25','NAC','S30_SoloVictoryCashCup','S30_SoloVictoryCashCup_Event4Round1_NAC','ch5s3-solo-victory-cup',5000],
 ['2024-08-06','NAC','S30_SoloVictoryCashCup','S30_SoloVictoryCashCup_Event8Round1_NAC','ch5s3-solo-victory-cup',5000],
 ['2024-08-13','NAC','S30_SoloVictoryCashCup','S30_SoloVictoryCashCup_Event9Round1_NAC','ch5s3-solo-victory-cup',5000]
].map(([date,region,event,window,tournamentId,cutoff])=>({date,region,event,window,tournamentId,cutoff,rule:R30}));
const d={
 results:read('results.json'),review:read('history-sync-review.json'),
 reviewed:read('history-sync-reviewed.json'),status:read('history-sync-status.json'),
 approval:read('approval-history.json'),updates:read('updates.json'),
 scan:read('history-sync-scan.json'),players:read('players.json'),
 tournaments:read('tournaments.json'),calendar:{}
};
const catalogs=new Map(d.tournaments.catalog.map(x=>[x.id,x]));
const playerNames=new Set(d.players.candidates.map(x=>x.name));
const reviewedIds=new Set(d.reviewed.entries.map(x=>x.id));
const existingIds=new Set(d.results.map(x=>x.id));
const published=[],held=[],ineligible=[],selected=[];
function assert(cond,message){if(!cond)throw Error(message)}
function check(r,event,window,team,allowExisting=false){
 const url=new URL(r.source);
 assert(url.protocol==='https:'&&url.hostname==='www.fortnite.com'&&
   url.pathname==='/competitive/events/'+event+'/'&&url.searchParams.get('region')===r.region&&
   url.searchParams.get('round')===window,'untrusted Epic official URL');
 const c=catalogs.get(r.tournamentId);
 assert(c&&c.seasonId===r.seasonId&&c.name===r.event&&c.team===team&&
   c.sourceEventIds?.includes(event),'unknown or mismatched catalog');
 assert(r.verified===true&&!existingIds.has(r.id)&&
   Number.isSafeInteger(r.rank)&&r.rank>=1&&
   Number.isSafeInteger(r.points)&&r.points>=0&&
   Number.isSafeInteger(r.kills)&&r.kills>=0&&
   Number.isSafeInteger(r.vrs)&&r.vrs>=0&&
   Number.isSafeInteger(r.matches)&&r.matches>=1&&r.vrs<=r.matches,'invalid original candidate');
 assert(Array.isArray(r.players)?r.players.length===1:playerNames.has(r.player),'unknown player roster');
 const key='epicgames_'+event+'_'+r.region+'/'+window;
 const cp=d.scan.windows?.[key];
 assert(cp&&Array.isArray(cp.proposals)&&cp.nextPage>=1&&
   cp.rankingOrderValid===true&&Number.isSafeInteger(cp.lastSeenRank)&&r.rank<=cp.lastSeenRank,
   'original saved score/rank not within observed ranked checkpoint');
 assert(cp.proposals.filter(x=>x.id===r.id&&equalCandidate(x,r)).length===1,
   'original Epic ID/score differs from cached leaderboard');
 const month=r.date.slice(0,7);
 if(!d.calendar[month])d.calendar[month]=read('calendar-history/'+month+'.json').sessions;
 assert(d.calendar[month]?.some(s=>s.sourceWindowId===window&&s.eventId===event&&
   s.dateJst===r.date&&s.region===r.region&&s.tournamentId===r.tournamentId&&s.seasonId===r.seasonId),
   'official calendar window/date mismatch');
 assert(!d.approval.entries.some(x=>x.id===r.id),'candidate already approved');
 if(!allowExisting)assert(!d.results.some(x=>collision(x,r,d.players.confirmedAliases||{})),'existing overlapping result; hold for reconciliation');
}
function publish(row,kind,round,prize,rule,note){
 const {reviewOnly,reviewReason,teamAccountIds,...entry}=row;
 entry.kind=kind;entry.round=round;entry.prize=prize;entry.note=note;
 assert(entry.prize===0&&['予選','賞金決勝'].includes(entry.kind)&&!entry.round.includes('予選敗退'),
   'unsafe or unsupported publication fields');
 d.results.push(entry);existingIds.add(entry.id);
 d.review.proposals=d.review.proposals.filter(r=>r.id!==row.id);
 d.approval.entries.push({id:row.id,decision:'published',recordId:row.id,policy:'verified-rule',
   approvedAt:now,approvedBy:'ChatGPT / user-authorized 2026-11-11 GitHub direct publication',
   source:row.source,rule,evidence:'Exact Epic account/session/calendar and cached Osirion ranked row; official advancement or zero-VR rule, never guessed prize'});
 if(!reviewedIds.has(row.id)){
  d.reviewed.entries.push({id:row.id,decision:'published',recordId:row.id,reviewedAt:now,
   policy:'verified-rule-and-original-epic-score',source:row.source,rule});
  reviewedIds.add(row.id);
 }
 published.push({id:row.id,player:row.player,event:row.event,date:row.date,
  region:row.region,rank:row.rank,kind,round,prize,verifiedVR:row.vrs});
}
for(const row of [...d.review.proposals]){
 let spec=cases.find(s=>s.date===row.date&&s.region===row.region&&s.tournamentId===row.tournamentId
   &&row.source?.includes('round='+s.window));
 let finalS39=row.date==='2026-03-09'&&row.seasonId==='S39'&&row.region==='NAW'&&
   row.tournamentId==='ch7s1-solo-victory'&&
   row.source?.includes('round=S39_SoloVictoryCup_Round2_Day1_NAW');
 if(!spec&&!finalS39)continue;
 selected.push(row.id);
 try{
  if(spec){
   assert(row.seasonId==='S30'&&row.kind==='予選'&&row.prize===0&&
    row.round.includes('Round 1 / 予選')&&row.matches<=7,
    'not an eligible CH5S3 Round 1 candidate');
   check(row,spec.event,spec.window,'solo');
   const qualified=row.rank<=spec.cutoff;
   const round=row.round.replace(/\/ 予選$/,'/ '+(qualified?'予選突破':'予選'));
   publish(row,'予選',round,0,R30,
    'Epic IDと保存済み公式開催枠・順位表の'+row.rank+'位、'+row.points+'pt、'+row.kills+'K、'+row.vrs+'VRを照合。'
    +(qualified?'Epic CH5S3の地域別上位'+spec.cutoff+'位以内で予選突破。':'同大会の予選順位を記録。突破実績には加算しない。')
    +'Round1の現金賞金は$0。公式規則: '+R30+' / 出典: '+row.source);
  }else{
   assert(row.kind==='賞金決勝'&&row.prize===null&&row.vrs===0&&row.points===0&&
    row.matches<=3&&row.round.includes('Round 2 / 賞金決勝'),
    'cash final award cannot be inferred for this candidate');
   check(row,'S39_SoloVictoryCup','S39_SoloVictoryCup_Round2_Day1_NAW','solo');
   publish(row,'賞金決勝',row.round,0,R39,
    'Epic公式S39 Solo Victory Cup NAW 2026年3月9日Round2決勝、'+row.rank+'位、'+row.kills+'K、0VRをEpic ID・保存済み順位表で照合。'
    +'公式規則は決勝1VR=$100、0VRのため現金賞金$0。予選でのVRと混同しない。規則: '+R39+' / 出典: '+row.source);
  }
 }catch(e){
  held.push({id:row.id,player:row.player,reason:String(e.message||e),event:row.event});
 }
}
const cashEvents=[
 {date:'2024-06-24',region:'OCE',window:'S30_SoloVictoryCashCup_Event4Round2_OCE'},
 {date:'2024-06-25',region:'ME',window:'S30_SoloVictoryCashCup_Event4Round2_ME'}
];
for(const row of [...d.review.proposals]){
 const spec=cashEvents.find(x=>x.date===row.date&&x.region===row.region&&
   row.seasonId==='S30'&&row.tournamentId==='ch5s3-solo-victory-cup'&&
   row.source?.includes('round='+x.window));
 if(!spec)continue;
 selected.push(row.id);
 try{
  assert(row.kind==='賞金決勝'&&row.prize===null&&row.vrs>=1&&row.vrs<=3&&
    row.points===row.vrs*100&&row.matches<=3&&row.round.includes('Round 2 / 賞金決勝'),'unverified VR cash final');
  check(row,'S30_SoloVictoryCashCup',spec.window,'solo');
  const {reviewOnly,reviewReason,teamAccountIds,...record}=row;
  record.prize=row.vrs*100;
  record.note='2024 C5S3 '+row.region+' Solo Victory Cash Cup Event4 Round2。本人Epic ID・保存済み順位表の'
   +row.rank+'位、'+row.vrs+'VR / '+row.matches+'試合を照合。公式1VR=$100により現金獲得額
 const day=new Date(Date.parse(now)+9*3600000).toISOString().slice(0,10);
 const id='verified-s30-s39-review-'+require('node:crypto').createHash('sha256').update(published.map(x=>x.id).sort().join('|')).digest('hex').slice(0,14);
 assert(!d.updates.entries.some(x=>x.id===id),'existing update key collision');
 if(published.length)d.updates.entries.unshift({id,date:day,type:'records',
   title:'Epic公式2024・2026年の海外大会成績'+published.length+'件を掲載',
   description:'本人Epic IDと保存済み公式順位表・規則を照合。予選突破、決勝0VR、決勝1VR=$100を区別して通常の遠征結果に掲載。',
   recordIds:published.map(x=>x.id)});
 d.review.manualReviewedAt=now;d.reviewed.reviewedAt=now;d.approval.reviewedAt=now;
 d.status.found=d.review.proposals.length;
 d.status.manualReviewCandidates=d.review.proposals.length;
 d.status.lastReviewedBatchAt=now;
 d.status.manuallyPublished=(d.status.manuallyPublished||0)+published.length;
 d.status.manuallyResolvedDuplicates=(d.status.manuallyResolvedDuplicates||0)+duplicates.length;
 d.status.message='Epic本人ID・順位を照合して'+published.length+'件掲載、重複'+duplicates.length+'件整理。残り'+d.review.proposals.length+'件。';
}
const by={};for(const p of published)by[p.event+' | '+p.date]=(by[p.event+' | '+p.date]||0)+1;
const report={dry,selected:selected.length,added:published.length,by,heldCount:held.length,held,
 duplicates:duplicates.length,duplicateRows:duplicates,remaining:d.review.proposals.length,rows:published.map(p=>({id:p.id,player:p.player,date:p.date,rank:p.rank,kind:p.kind,round:p.round}))};
console.log('AOT_HISTORIC_REVIEW_BATCH '+JSON.stringify(report));
if(!dry&&(published.length||duplicates.length)){
 for(const [name,obj] of [['results.json',d.results],['history-sync-review.json',d.review],
  ['history-sync-reviewed.json',d.reviewed],['history-sync-status.json',d.status],
  ['approval-history.json',d.approval],['updates.json',d.updates]])write(name,obj);
}
+record.prize+
   '。支払完了の確認とは区別。規則: '+R30+' / 出典: '+row.source;
  d.results.push(record);existingIds.add(record.id);
  d.review.proposals=d.review.proposals.filter(x=>x.id!==row.id);
  d.approval.entries.push({id:row.id,decision:'published',recordId:row.id,
   policy:'official-final-vr-award',approvedAt:now,
   approvedBy:'ChatGPT / user-authorized source verified review',
   source:row.source,rule:R30,evidence:'Exact original Epic scoreboard/identity and '+row.vrs+' VR x $100'});
  if(!reviewedIds.has(row.id)){
   d.reviewed.entries.push({id:row.id,decision:'published',recordId:row.id,reviewedAt:now,
    policy:'official-final-vr-award',source:row.source,rule:R30});
   reviewedIds.add(row.id);
  }
  published.push({id:row.id,player:row.player,event:row.event,date:row.date,region:row.region,
   rank:row.rank,kind:'賞金決勝',round:row.round,prize:record.prize,verifiedVR:row.vrs});
 }catch(e){held.push({id:row.id,player:row.player,reason:String(e.message||e),event:row.event})}
}
const duplicates=[];
for(const row of [...d.review.proposals]){
 if(row.tournamentId!=='ch7s4-override-persona-5-royal-cup-reload'||row.seasonId!=='S42'||
  row.region!=='NAC'||row.date!=='2026-09-26'||row.kind!=='参加確認'||row.reviewOnly!==true)continue;
 selected.push(row.id);
 try{
  check(row,'S42_Persona5Cup','S42_Persona5Cup_NAC','solo',true);
  const old=d.results.filter(x=>collision(x,row,d.players.confirmedAliases||{}));
  assert(old.length===1,'not exactly one existing Persona 5 result');
  const existing=old[0],url=new URL(existing.source);
  assert((url.hostname==='fortnitetracker.com'&&url.pathname.includes('S42_Persona5Cup_NAC'))||
    (url.hostname==='www.fortnite.com'&&url.pathname.includes('/S42_Persona5Cup/')&&url.searchParams.get('region')==='NAC'),
    'mismatched Persona 5 source');
  assert(existing.kind==='スキン大会'&&existing.prize===0&&existing.verified===true,
    'preexisting result not verified cosmetic award');
  for(const k of ['date','region','player','event','rank','points','kills','vrs','matches','tournamentId'])
    assert(existing[k]===row[k],'Persona 5 '+k+' conflict: '+existing[k]+' vs '+row[k]);
  d.review.proposals=d.review.proposals.filter(x=>x.id!==row.id);
  if(!reviewedIds.has(row.id)){
   d.reviewed.entries.push({id:row.id,decision:'already-published',existingId:existing.id,
     reviewedAt:now,source:row.source,evidence:'Exact saved Epic scoreboard, player, event, rank, points, kills, VR and matches agree with existing Tracker record'});
   reviewedIds.add(row.id);
  }
  duplicates.push({id:row.id,existingId:existing.id,player:row.player,rank:row.rank});
 }catch(e){held.push({id:row.id,player:row.player,reason:String(e.message||e),event:row.event})}
}
if(published.length||duplicates.length){
 const day=new Date(Date.parse(now)+9*3600000).toISOString().slice(0,10);
 const id='verified-s30-s39-review-'+require('node:crypto').createHash('sha256').update(published.map(x=>x.id).sort().join('|')).digest('hex').slice(0,14);
 assert(!d.updates.entries.some(x=>x.id===id),'existing update key collision');
 d.updates.entries.unshift({id,date:day,type:'records',
   title:'Epic公式C5S3予選とC7S1決勝の成績'+published.length+'件を掲載',
   description:'過去大会の本人Epic ID・公式開催枠・保存済みオリジナル順位表と公式規則を照合。予選突破条件・現金賞金$0・決勝0VRを区別し、通常の遠征結果に反映。',
   recordIds:published.map(x=>x.id)});
 d.review.manualReviewedAt=now;d.reviewed.reviewedAt=now;d.approval.reviewedAt=now;
 d.status.found=d.review.proposals.length;
 d.status.manualReviewCandidates=d.review.proposals.length;
 d.status.lastReviewedBatchAt=now;
 d.status.manuallyPublished=(d.status.manuallyPublished||0)+published.length;
 d.status.message='Epic本人IDと保存済み順位を確認して'+published.length+'件を通常一覧に掲載。残り'+d.review.proposals.length+'件。未確認賞金を推定しない。';
}
const by={};for(const p of published)by[p.event+' | '+p.date]=(by[p.event+' | '+p.date]||0)+1;
const report={dry,selected:selected.length,added:published.length,by,heldCount:held.length,held,
 remaining:d.review.proposals.length,rows:published.map(p=>({id:p.id,player:p.player,date:p.date,rank:p.rank,kind:p.kind,round:p.round}))};
console.log('AOT_HISTORIC_REVIEW_BATCH '+JSON.stringify(report));
if(!dry&&published.length){
 for(const [name,obj] of [['results.json',d.results],['history-sync-review.json',d.review],
  ['history-sync-reviewed.json',d.reviewed],['history-sync-status.json',d.status],
  ['approval-history.json',d.approval],['updates.json',d.updates]])write(name,obj);
}
