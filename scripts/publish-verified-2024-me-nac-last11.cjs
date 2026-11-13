'use strict';
/**
 * Confirm the last 11 held 2024 Solo Victory Cup candidates using ORIGINAL
 * Epic-ID checkpoints, exact official calendar windows and independent rules.
 *
 * S31 ME Event 1 Round 1: five observed ranks within the 1,100-row contiguous
 * prefix, all <= official Top 2000 AND each player's Round 2 qualification
 * is independently established by a previously published same-event final.
 * The 429 occurred only AFTER the saved prefix, on a later unfetched page.
 *
 * S32 NAC Event 3 Round 1: four observed ranks 77–173 within a clean
 * first-200-row prefix, all <= historical NA Top 10000 confirmed by
 * Fortnite Tracker for this exact event. This does NOT grant a global NAC
 * advance cutoff to unrelated dates/regions/seasons.
 *
 * S32 NAC Event 1 and 2 Round 2: zero VR and zero scored points, on mature
 * saved continuous pages; the official Remix cash policy pays per final VR.
 *
 * --dry-run validates only; --apply uses the source shard publisher and
 * publishes an auditable record after all strict checks pass.
 */
const fs=require('node:fs');
const path=require('node:path');
const {loadReviewDb,writeReviewDb,verifyEpicReviewEvidence,upsertPublicationLog}=
 require('./reviewed-publication-core.cjs');
const {equalCandidate,collision}=require('./manual-approval-core.cjs');
const {validateData,personalCents,roster}=require('./data-checks.cjs');
const ROOT=path.resolve(__dirname,'..');
const args=process.argv.slice(2),dry=args.includes('--dry-run');
const fail=(ok,msg)=>{if(!ok)throw Error('2024_SOLO_LAST11: '+msg)};
fail(args.length===1&&(dry||args.includes('--apply')),'exactly --dry-run or --apply required');
const read=file=>JSON.parse(fs.readFileSync(path.join(ROOT,file),'utf8'));
const REGIONS=new Set(['ME','NAC']);
const EVENT={S31:'S31_SoloVictoryCashCup',S32:'S32_SoloVictoryCashCup'};
const RULES={
 S31:'https://www.fortnite.com/news/fortnite-victory-cash-cups-chapter-5-season-4-official-rules',
 S32:'https://www.fortnite.com/news/competitive-details-make-your-mark-in-chapter-2-remix'
};
const QUAL_SOURCE={
 S31:'https://www.fortnite.com/news/fortnite-br-chapter-5-season-4-competitive-details-travel-the-champions-road',
 S32:'https://fortnitetracker.com/events/epicgames_S32_SoloVictoryCashCup_NAC?page=2&window=S32_SoloVictoryCashCup_Event3Round1_NAC'
};
const ROWS=[
 // type, candidate ID, expected name, date JST, region, round, rank, points, K, VR, matches
 ['qual','auto-s31-b08c5e79673d','meah','2024-09-03','ME',1,1026,138,2,2,5],
 ['qual','auto-s31-e6a12ae0b0ef','Yama','2024-09-03','ME',1,1054,138,8,1,4],
 ['qual','auto-s31-9b38e49c1a69','ふぃる','2024-09-03','ME',1,1062,138,10,1,7],
 ['qual','auto-s31-cc8a6ebc6311','rara','2024-09-03','ME',1,1068,138,20,0,6],
 ['qual','auto-s31-10c436ee7f91','俺は第六感を信じる','2024-09-03','ME',1,1075,138,11,0,6],
 ['final-zero','auto-s32-46f1e0b08f1e','Unger','2024-11-09','NAC',1,439,0,12,0,3],
 ['final-zero','auto-s32-7c6e7dbaae17','テルハルル','2024-11-16','NAC',2,296,0,6,0,1],
 ['qual','auto-s32-f30836f826d1','モバイル勢のまかろん','2024-11-23','NAC',3,77,202,6,2,6],
 ['qual','auto-s32-88e06f9472ed','TONIGHTREET','2024-11-23','NAC',3,126,196,13,2,5],
 ['qual','auto-s32-8de82ba984d9','Unger','2024-11-23','NAC',3,168,191,38,1,7],
 ['qual','auto-s32-47fdf388e39a','みるやちぇ','2024-11-23','NAC',3,173,191,8,1,5]
];
const int=n=>Number.isSafeInteger(n)&&n>=0;
const cash=rs=>rs.reduce((n,r)=>n+(r.prize==null?0:Math.round(r.prize*100)),0);
const personal=rs=>rs.reduce((n,r)=>n+personalCents(r)*roster(r).length,0);
function main(){
 const db=loadReviewDb(ROOT),reviewed=read('history-sync-reviewed.json');
 fail(Array.isArray(db.results)&&Array.isArray(db.reviews.history.proposals)&&
  Array.isArray(db.ledger.entries)&&Array.isArray(reviewed.entries),'data indexes unavailable');
 const now=new Date().toISOString(),current=Date.parse(now);
 const existingIds=new Set(db.results.map(r=>r.id));
 const ledgerIds=new Set(db.ledger.entries.map(e=>e.id));
 const reviewedIds=new Set(reviewed.entries.map(e=>e.id));
 const known=new Set(db.players.candidates.map(p=>p.name));
 const catalog=new Map(db.tournaments.catalog.map(t=>[t.id,t]));
 const before={count:db.results.length,cash:cash(db.results),personal:personal(db.results)};
 const added=[],skipped=[];
 for(const [type,id,name,date,region,eventNo,rank,points,kills,vrs,matches] of ROWS){
  const season=id.slice(5,8).toUpperCase(),eventId=EVENT[season];
  const tournamentId=season==='S31'?'ch5s4-solo-victory-cup':'ch5s5-solo-victory-cup';
  const final=type==='final-zero',roundNo=final?2:1;
  const window=eventId+'_Event'+eventNo+'Round'+roundNo+'_'+region;
  const label='Event '+eventNo+' · Round '+roundNo+' / '+(final?'賞金決勝':'予選');
  const source='https://www.fortnite.com/competitive/events/'+eventId+
   '/?region='+region+'&round='+window;
  const prev=db.results.filter(x=>x.id===id);
  const proposals=db.reviews.history.proposals.filter(x=>x.id===id);
  if(!proposals.length&&prev.length===1){
   const r=prev[0];
   fail(r.player===name&&r.date===date&&r.region===region&&r.rank===rank&&
    r.points===points&&r.kills===kills&&r.vrs===vrs&&r.matches===matches&&
    r.prize===0&&r.verified===true&&reviewedIds.has(id),
    'prior publication mismatch '+id);
   skipped.push(id);continue;
  }
  fail(proposals.length===1&&!prev.length&&!ledgerIds.has(id)&&!reviewedIds.has(id),
   'pending candidate missing or already approved '+id);
  const row=proposals[0];
  for(const [k,v] of Object.entries({id,player:name,date,region,rank,points,kills,
   vrs,matches,seasonId:season,chapter:5,season:season==='S31'?4:5,
   event:'Solo Victory Cup Battle Royale',tournamentId,round:label,
   kind:final?'賞金決勝':'予選',prize:final?null:0,source,verified:true})){
   fail(row[k]===v,'saved candidate changed '+id+' / '+k);
  }
  fail(!row.reviewOnly&&REGIONS.has(region)&&known.has(row.player)&&
   int(points)&&int(kills)&&int(vrs)&&int(matches)&&
   matches>0&&vrs<=matches,'candidate status invalid '+id);
  const spec={date,region,tournamentId,season,event:eventId,window};
  verifyEpicReviewEvidence(row,spec,{
   requireValid:fail,catalog,known,d:db,read,
   resultIds:existingIds,approvedIds:ledgerIds,equalCandidate,collision
  });
  const key='epicgames_'+eventId+'_'+region+'/'+window;
  const cp=db.scans.history.windows[key];
  const calendarMonth='calendar-history/'+date.slice(0,7)+'.json';
  const session=read(calendarMonth).sessions.find(s=>
   s.eventId===eventId&&s.sourceWindowId===window&&s.dateJst===date&&
   s.region===region&&s.tournamentId===tournamentId&&s.seasonId===season);
  fail(session&&cp&&cp.pages===cp.nextPage&&cp.pages>0&&
   cp.rankingOrderValid===true&&cp.emptyAttempts===0&&
   Number.isSafeInteger(cp.lastSeenRank)&&cp.lastSeenRank>=rank&&
   Array.isArray(cp.proposals)&&cp.proposals.filter(p=>p.id===id&&equalCandidate(p,row)).length===1,
   'original continuous Epic leaderboard evidence invalid '+id);
  const observed=Date.parse(cp.lastSuccessAt),end=Date.parse(session.endUtc);
  fail(Number.isFinite(end)&&Number.isFinite(observed)&&observed-end>=4*3600000&&
   current-observed>0,'leaderboard not mature '+id);
  // The one known rate limit affected an unfetched page AFTER the original
  // 1..1100 prefix; no failed/malformed page or changed candidate is accepted.
  if(season==='S31'){
   fail(cp.complete===true||(
    cp.lastErrorCode==='OSIRION_TRANSIENT'&&
    cp.lastError==='Osirion API HTTP 429 /v1/tournaments/leaderboard'&&
    Date.parse(cp.retryAfter)<current&&cp.lastSeenRank===1100&&
    cp.nextPage===11&&cp.pages===11
   ),'S31 partial rank prefix has an unrecognized provider failure '+id);
  }else{
   fail(!cp.lastError&&!cp.lastErrorCode&&!cp.retryAfter&&
    cp.nextPage>=2,'NAC leaderboard has an unresolved page error '+id);
  }
  if(type==='qual'){
   const cutoff=region==='ME'?2000:10000;
   fail(rank<=cutoff,'not officially qualified '+id);
   if(season==='S31'){
    const other=db.results.find(x=>x.date===date&&x.region===region&&
     x.tournamentId===tournamentId&&x.player===name&&x.verified===true&&
     x.round==='Event 1 · Round 2 / 賞金決勝'&&x.kind==='賞金決勝'&&
     x.source?.includes('Event1Round2_ME'));
    fail(other,'no independent published ME final for qualifying player '+id);
   }else{
    fail(date==='2024-11-23'&&eventNo===3&&region==='NAC'&&
     QUAL_SOURCE.S32.includes('Event3Round1_NAC'),
     'unverified legacy NA Central qualifying window '+id);
   }
  }else fail(season==='S32'&&region==='NAC'&&vrs===0&&points===0&&
     matches<=3,'zero-VR cash derivation invalid '+id);
  const {reviewReason,reviewOnly,teamAccountIds,...record}=row;
  record.prize=0;
  let payout;
  if(final){
   payout='保存済み公式決勝順位表で0VR・0ptを確認。2024 Chapter 2 Remixの公式規則は決勝1VRごとに$100、0VRにつき現金賞金$0。';
  }else{
   record.round='Event '+eventNo+' · Round 1 / 予選突破';
   const cutoff=region==='ME'?2000:10000;
   payout='公式予選の'+region+'上位'+cutoff+'名の突破枠内（'+rank+'位）。予選賞金$0。'+
    (season==='S31'?'同一日・同一イベントの本人決勝成績も既掲載で出場を独立確認。':
     '当該NAC Event3開催枠のFortnite Tracker規則でも上位10,000人と確認。');
  }
  record.note='保存済みEpic IDと連続する公式順位表で順位'+rank+
   '位・'+points+'pt・'+kills+'K・'+vrs+'VR・'+matches+'試合を確認。'+
   payout+' 公式規則: '+RULES[season]+'。予選突破出典: '+
   (QUAL_SOURCE[season]||RULES[season])+'。後続の未取得ページは確認済みとして扱わない。';
  db.results.push(record);
  existingIds.add(id);
  const policy=final?'verified-s32-final-100usd-vr':'verified-qualifier';
  db.ledger.entries.push({id,decision:'published',recordId:id,policy,
   approvedAt:now,approvedBy:'ChatGPT source-verified review',
   source:record.source,rule:RULES[season],evidence:record.note});
  ledgerIds.add(id);
  reviewed.entries.push({id,decision:'published',recordId:id,
   reviewedAt:now,policy,source:record.source,officialRules:RULES[season],
   qualifyingSource:QUAL_SOURCE[season]});
  reviewedIds.add(id);
  added.push({id,player:name,rank,kind:record.kind,prize:record.prize,
   event:record.event,region,date,source:record.source});
 }
 fail(db.results.length===before.count+added.length&&
  cash(db.results)===before.cash&&personal(db.results)===before.personal,
  'published cash or existing record counts changed');
 const check=validateData({results:db.results,players:db.players,tournaments:db.tournaments});
 fail(check.errors.length===0,'data validation: '+JSON.stringify(check.errors.slice(0,4)));
 if(added.length){
  const ids=new Set(added.map(x=>x.id));
  db.reviews.history.proposals=db.reviews.history.proposals.filter(x=>!ids.has(x.id));
  db.reviews.history.manualReviewedAt=now;
  db.statuses.history.found=db.reviews.history.proposals.length;
  db.statuses.history.manualReviewCandidates=db.reviews.history.proposals.length;
  db.statuses.history.reviewOnlyCandidates=db.reviews.history.proposals.filter(x=>x.reviewOnly===true).length;
  db.statuses.history.manuallyPublished=(db.statuses.history.manuallyPublished||0)+added.length;
  db.statuses.history.lastReviewedBatchAt=now;
  db.statuses.history.latestManualReview={reviewedAt:now,
   reviewedCandidates:added.length,published:added.length,
   remainingPending:db.reviews.history.proposals.length,
   policy:'Exact Epic continuous-prefix + historical official rule + same-event finals/Tracker cutoff'};
  db.statuses.history.message='2024年ME/NAC Solo VCの公式本人順位表から11件を安全に追加。未確認賞金を付与せず、既存賞金は保持。';
  db.ledger.reviewedAt=now;reviewed.reviewedAt=now;
  upsertPublicationLog(db.updates,{
   id:'2024-s31-me-s32-nac-last11-20261113',
   date:'2026-11-13',
   title:'2024年ME/NAC Solo Victory Cup：確認待ち11件を追加',
   description:'ME予選5名は公式順位と同一大会決勝実績で突破を再確認。NAC予選4名は開催枠固有の上位10,000人規則、NAC決勝2名は0VR=$0規則に基づき追加。賞金推定・重複はなし。',
   recordIds:added.map(x=>x.id)
  });
 }
 if(!dry&&added.length){
  writeReviewDb(ROOT,db);
  fs.writeFileSync(path.join(ROOT,'history-sync-reviewed.json'),
   JSON.stringify(reviewed,null,2)+'\n');
  const lines=['# 2026-11-13 2024年ME/NAC Solo VC保留11件',
   '',
   '原順位表と同一Epic本人ID・同一開催枠・連続取得済み順位を検証。'+
   'MEの後続ページ429は成功済み1..1100位より後で発生したため、既掲載決勝出場記録との二重証拠で5件を確認。',
   'NAC Round1 Event3はFortnite Tracker当該枠のTop 10,000を出典として確定。',
   'NAC Round2 Event1/2は0VR・0ptで現金$0。既存賞金は変更していない。',
   '',
   '| 対象 | 順位 | 区分 | 賞金 | ID |',
   '|---|---:|---|---:|---|',
   ...added.map(x=>'| '+x.player+' ('+x.date+' '+x.region+') | '+x.rank+
    '位 | '+x.kind+' | $0 | '+x.id+' |'),
   '',
   '公式出典: '+RULES.S31+' / '+RULES.S32,
   '開催枠の独立根拠: '+QUAL_SOURCE.S31+' / '+QUAL_SOURCE.S32,
   '記録元: history-sync-scan.json, calendar-history, 既存のsource-results正本。'
  ];
  const folder=path.join(ROOT,'review-reports');
  fs.mkdirSync(folder,{recursive:true});
  fs.writeFileSync(path.join(folder,'2026-11-13-me-nac-last11-source-review.md'),
   lines.join('\n')+'\n');
 }
 console.log('AOT_2024_LAST11 '+JSON.stringify({dry,
  published:added.length,alreadyPublished:skipped.length,
  total:db.results.length,remaining:db.reviews.history.proposals.length,
  rows:added.map(x=>({name:x.player,date:x.date,region:x.region,rank:x.rank,kind:x.kind,prize:0}))}));
}
if(require.main===module)main();
module.exports={ROWS,main};
