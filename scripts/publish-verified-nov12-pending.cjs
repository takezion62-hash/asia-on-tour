'use strict';
// One-time, idempotent 2026-11-12 review of original Epic-ID ranked rows.
// Never overwrite older Tracker rankings; never infer cosmetic receipt or paid status.
// Test registry count now 21 (including official Lady Liberty BR cutoffs).
const path=require('node:path');
const {createPublicationFiles}=require('./reviewed-publication-core.cjs');
const {sameScannedCandidate,verifiedPartialPage}=require('./verified-partial-page.cjs');
const {toParticipation}=require('./participation-archive.cjs');
const {collision}=require('./manual-approval-core.cjs');
const root=path.resolve(__dirname,'..');
const {read,write}=createPublicationFiles(root);
const dry=process.argv.includes('--dry-run');
const now=new Date().toISOString();
const day=new Date(Date.now()+9*60*60*1000).toISOString().slice(0,10);
const RULE31='https://www.fortnite.com/news/fortnite-victory-cash-cups-chapter-5-season-4-official-rules';
const LADY='https://www.fortnite.com/competitive/rules-guidelines/rules-library/the-purges-lady-liberty-cup-chapter-7-season-4-official-rules';
const specs=[
 {date:'2024-09-10',region:'NAC',tournamentId:'ch5s4-solo-victory-cup',seasonId:'S31',eventId:'S31_SoloVictoryCashCup',windowId:'S31_SoloVictoryCashCup_Event2Round1_NAC',kind:'予選',rule:RULE31,cap:7},
 {date:'2024-09-10',region:'NAC',tournamentId:'ch5s4-solo-victory-cup',seasonId:'S31',eventId:'S31_SoloVictoryCashCup',windowId:'S31_SoloVictoryCashCup_Event2Round2_NAC',kind:'賞金決勝',rule:RULE31,cap:3},
 {date:'2024-09-17',region:'ME',tournamentId:'ch5s4-solo-victory-cup',seasonId:'S31',eventId:'S31_SoloVictoryCashCup',windowId:'S31_SoloVictoryCashCup_Event3Round2_ME',kind:'賞金決勝',rule:RULE31,cap:3},
 {date:'2026-10-18',region:'NAW',tournamentId:'ch7s4-lady-liberty-cup-battle-royale',seasonId:'S42',eventId:'S42_PurgeCup',windowId:'S42_PurgeCup_NAW',kind:'参加確認',rule:LADY,cap:11}
];
const d={
 results:read('results.json'),review:read('history-sync-review.json'),reviewed:read('history-sync-reviewed.json'),
 ledger:read('approval-history.json'),status:read('history-sync-status.json'),
 scans:read('history-sync-scan.json'),players:read('players.json'),tournaments:read('tournaments.json'),
 updates:read('updates.json'),oct:read('participation/2026-10.json'),
 sep:read('participation/2024-09.json'),index:read('participation-index.json'),
 partStatus:read('participation-status.json')
};
const fail=(ok,msg)=>{if(!ok)throw Error('NOV12_REVIEW '+msg)};
const publishedIds=new Set(d.results.map(x=>x.id));
const reviewedIds=new Set(d.reviewed.entries.map(x=>x.id));
const ledgerIds=new Set(d.ledger.entries.map(x=>x.id));
const players=new Set(d.players.candidates.map(x=>x.name));
const catalog=new Map(d.tournaments.catalog.map(x=>[x.id,x]));
const months={'2026-10':d.oct,'2024-09':d.sep};
const archiveIds=new Set([...d.oct.entries,...d.sep.entries].map(x=>x.id));
const key=p=>[p.date,p.region,p.tournamentId,p.player].join('::');
const archiveKeys=new Set([...d.oct.entries,...d.sep.entries].map(key));
const same=x=>specs.find(s=>x.date===s.date&&x.region===s.region&&x.seasonId===s.seasonId
 &&x.tournamentId===s.tournamentId&&x.source===
 'https://www.fortnite.com/competitive/events/'+s.eventId+'/?region='+s.region+'&round='+s.windowId);
const selected=d.review.proposals.map(row=>({row,spec:same(row)})).filter(x=>x.spec);
if(selected.length===0){console.log('NOV12_REVIEW nothing pending; no changes');process.exit(0);}
const calendar={};
function prove(row,spec){
 fail(/^auto-s\d+-[a-z0-9]{12}$/.test(row.id||'')&&row.verified===true&&!reviewedIds.has(row.id)
  &&!ledgerIds.has(row.id)&&!publishedIds.has(row.id),'already adjudicated or unverified '+row.id);
 fail(spec.kind===row.kind&&row.prize===(spec.kind==='予選'?0:null)&&row.matches<=spec.cap,
  'wrong round, match cap or prize state '+row.id);
 fail(Number.isSafeInteger(row.rank)&&row.rank>0&&Number.isSafeInteger(row.points)&&row.points>=0
  &&Number.isSafeInteger(row.kills)&&row.kills>=0&&Number.isSafeInteger(row.vrs)&&row.vrs>=0
  &&Number.isSafeInteger(row.matches)&&row.matches>0&&row.vrs<=row.matches,'invalid score '+row.id);
 const cat=catalog.get(row.tournamentId);
 fail(cat&&cat.seasonId===spec.seasonId&&cat.name===row.event
  &&cat.team==='solo'&&cat.sourceEventIds.includes(spec.eventId)&&players.has(row.player),
  'event master or player does not match '+row.id);
 const month=row.date.slice(0,7);
 if(!calendar[month])calendar[month]=read('calendar-history/'+month+'.json').sessions;
 const session=calendar[month].find(x=>x.eventId===spec.eventId&&x.sourceWindowId===spec.windowId
  &&x.region===row.region&&x.dateJst===row.date&&x.tournamentId===row.tournamentId
  &&x.seasonId===row.seasonId&&x.url===row.source);
 fail(session&&Number.isFinite(Date.parse(session.endUtc)),'unverified official calendar '+row.id);
 const cp=d.scans.windows['epicgames_'+spec.eventId+'_'+spec.region+'/'+spec.windowId];
 fail(cp&&cp.rankingOrderValid===true&&cp.lastSeenRank>=row.rank
  &&Array.isArray(cp.proposals)&&cp.proposals.filter(p=>p.id===row.id&&sameScannedCandidate(p,row)).length===1,
  'saved leaderboard score mismatch '+row.id);
 fail(cp.complete===true||verifiedPartialPage(row,{end:Date.parse(session.endUtc)},cp),
  'original leaderboard partial page is not mature '+row.id);
}
const formal=[],archived=[],dupes=[];
for(const {row,spec} of selected){
 prove(row,spec);
 const lady=spec.eventId==='S42_PurgeCup';
 const existing=d.results.find(r=>r.date===row.date&&r.region===row.region
  &&r.player===row.player&&r.tournamentId===row.tournamentId
  &&(lady||r.kind==='賞金決勝'&&row.kind==='賞金決勝'));
 if(existing){
  fail(lady&&existing.kind==='スキン大会'&&existing.points===row.points
   &&existing.kills===row.kills&&existing.vrs===row.vrs,
   'published record conflict; manual reconciliation required '+row.id);
  dupes.push(row);
  d.reviewed.entries.push({id:row.id,decision:'already-published',existingId:existing.id,
   verifiedAt:now,source:row.source,note:'Same official event and player, points/kills/VR match. Keep original Tracker rank.'});
  continue;
 }
 const cash=spec.kind==='賞金決勝'&&row.vrs===1&&row.points===100;
 const skin=lady&&row.rank<=200;
 if(spec.kind==='賞金決勝')fail(cash,'unknown payout or unverified VR '+row.id);
 if(cash||skin){
  const {reviewReason,reviewOnly,teamAccountIds,...base}=row;
  const originalProfile=d.results.find(r=>r.player===row.player&&r.profileUrl)?.profileUrl;
  const record={...base,...(originalProfile?{profileUrl:originalProfile}:{}),
   ...(cash?{
    kind:'賞金決勝',prize:100,
    note:'本人Epic ID、成熟した保存済み公式順位表、決勝1VR=100ptを照合。公式規則の1VR=$100による賞金。支払完了・賞金資格は未確認。規則: '+RULE31
   }:{
    kind:'スキン大会',round:'Session 1 / スキン獲得',prize:0,
    note:'本人Epic IDと元の大会順位表でNAW '+row.rank+'位を確認。公式Battle Royale報酬は上位200位まで。Lady Liberty衣装・背中アクセサリー獲得条件を満たすが受領自体は未確認。規則: '+LADY
   })};
  fail(!publishedIds.has(record.id)&&!d.results.some(x=>collision(x,record,d.players.confirmedAliases||{})),
   'possible duplicate result '+row.id);
  d.results.push(record);publishedIds.add(record.id);formal.push(record);
  const policy=cash?'official-final-vr-award':'cosmetic-rank';
  d.reviewed.entries.push({id:row.id,decision:'published',recordId:record.id,reviewedAt:now,
   source:row.source,policy,rule:spec.rule});
  d.ledger.entries.push({id:row.id,decision:'published',recordId:record.id,policy,approvedAt:now,
   approvedBy:'ChatGPT / user-authorized source-verified review',source:row.source,
   rule:spec.rule,evidence:'Epic ID + official session + mature saved ranked leaderboard; no claim of payout or item delivery'});
  continue;
 }
 // 2024 NAC R1 cannot be classified as qualified from the former NA rules.
 // For Lady Liberty rank >200 the cosmetic cutoff is definitively outside.
 fail(lady||spec.kind==='予選','unexpected candidate category '+row.id);
 const win={dateJst:row.date,region:row.region,tournamentId:row.tournamentId,
  eventId:spec.eventId,windowId:spec.windowId,round:row.round,kind:row.kind,
  series:lady?'skin-cup':'victory-cup'};
 const rec=toParticipation(row,win,null);
 fail(rec&&rec.id.startsWith('participation-'),'invalid participation record '+row.id);
 const month=months[rec.date.slice(0,7)];
 fail(month&&!archiveIds.has(rec.id)&&!archiveKeys.has(key(rec)),
  'duplicate archive record '+row.id);
 if(lady)rec.note='Epic IDと元の順位表で出場を確認。公式NAW Battle Royale上位200位の衣装報酬圏外。現金・衣装獲得は未認定。';
 else rec.note='Epic IDと元の順位表でNAC予選出場を確認。旧NA時代のNAC専用通過条件は未認定。';
 month.entries.push(rec);archiveIds.add(rec.id);archiveKeys.add(key(rec));archived.push(rec);
 d.reviewed.entries.push({id:row.id,decision:'participation-archived',recordId:rec.id,reviewedAt:now,
  policy:'Epic-evidenced-attendance-only',source:row.source,officialRules:spec.rule,
  evidence:'Official calendar, Epic account match, mature original ranked checkpoint'});
}
fail(formal.length+archived.length+dupes.length===selected.length,'count mismatch');
d.review.proposals=d.review.proposals.filter(x=>!same(x));
d.review.manualReviewedAt=now;d.reviewed.reviewedAt=now;d.ledger.reviewedAt=now;
for(const p of archived){
 const ym=p.date.slice(0,7),entry=d.index.months.find(x=>x.month===ym);
 fail(entry,'month missing from participation index '+ym);entry.count++;
 let player=d.index.players.find(x=>x.name===p.player);
 if(!player){player={name:p.player,count:0,months:[],latestDate:''};d.index.players.push(player);}
 player.count++;if(!player.months.includes(ym))player.months.push(ym);
 player.months.sort().reverse();if(p.date>player.latestDate)player.latestDate=p.date;
}
for(const doc of Object.values(months))doc.entries.sort((a,b)=>b.date.localeCompare(a.date)
 ||a.region.localeCompare(b.region)||a.rank-b.rank||a.id.localeCompare(b.id));
d.index.total+=archived.length;d.index.checkedAt=now;
d.index.players.sort((a,b)=>a.name.localeCompare(b.name,'ja'));
fail(d.index.months.reduce((n,x)=>n+x.count,0)===d.index.total,'participation index total mismatch');
if(formal.length){
 const updateId='manual-verified-review-nov12-69';
 fail(!d.updates.entries.some(x=>x.id===updateId),'duplicate update marker');
 d.updates.entries.unshift({id:updateId,date:day,type:'records',
  title:'確認待ち69件の精査：賞金決勝・スキン大会・参加実績',
  description:'本人Epic ID・公式大会カレンダー・成熟した順位表を照合。2024年決勝6人（各$100）とLady Liberty報酬圏内1人を正式掲載。41人は出場戦績に分離、既掲載21人は重複除外。受領/支払は未確認。',
  recordIds:formal.map(x=>x.id)});
}
d.status.manualReviewCandidates=d.review.proposals.length;
d.status.reviewOnlyCandidates=d.review.proposals.filter(x=>x.reviewOnly).length;
d.status.manuallyPublished=(d.status.manuallyPublished||0)+formal.length;
d.status.manuallyResolvedDuplicates=(d.status.manuallyResolvedDuplicates||0)+dupes.length;
d.status.lastReviewedBatchAt=now;
d.status.latestManualReview={reviewedAt:now,reviewedCandidates:selected.length,published:formal.length,
 remainingPending:d.review.proposals.length,duplicatesResolved:dupes.length,participationArchived:archived.length,
 policy:'Epic ID + official calendar + mature original ranked checkpoint; 2024 $100/VR; NAW top200 costume'};
d.status.latestParticipationReview={reviewedAt:now,participationPublished:archived.length,
 duplicatesResolved:dupes.length,remainingPending:d.review.proposals.length,notIncludedInPrizeTotals:true};
d.status.message='確認候補を原本再照合：正式'+formal.length+'件、出場'+archived.length+
 '件、既掲載重複'+dupes.length+'件。残り'+d.review.proposals.length+'件。';
d.partStatus.total=d.index.total;d.partStatus.lastManualReviewAt=now;
d.partStatus.manualReviewPublished=(d.partStatus.manualReviewPublished||0)+archived.length;
d.partStatus.message='Epic ID確認済み出場戦績：人手確認で'+archived.length+'件追加。現金賞金やスキン獲得は推定しない。';
fail(new Set(d.results.map(x=>x.id)).size===d.results.length,'duplicate result IDs');
if(!dry){
 for(const [file,data] of [
  ['results.json',d.results],['history-sync-review.json',d.review],
  ['history-sync-reviewed.json',d.reviewed],['approval-history.json',d.ledger],
  ['history-sync-status.json',d.status],['updates.json',d.updates],
  ['participation/2026-10.json',d.oct],['participation/2024-09.json',d.sep],
  ['participation-index.json',d.index],['participation-status.json',d.partStatus]
 ])write(file,data);
}
console.log(JSON.stringify({dry,formal:formal.length,prizes:formal.filter(x=>x.prize===100).length,
 cosmetics:formal.filter(x=>x.kind==='スキン大会').length,participation:archived.length,
 deduplicated:dupes.length,remaining:d.review.proposals.length,newResults:d.results.length,newArchive:d.index.total}));
