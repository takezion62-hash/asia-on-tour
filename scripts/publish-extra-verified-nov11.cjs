'use strict';
// Incremental official source review of new candidates added by the historical
// scan while the first 76-record review was already being published.
const fs=require('node:fs'),path=require('node:path');
const {collision,equalCandidate}=require('./manual-approval-core.cjs');
const dir=path.resolve(__dirname,'..'),dry=process.argv.includes('--dry-run'),now=new Date().toISOString();
const read=f=>JSON.parse(fs.readFileSync(path.join(dir,f),'utf8'));
const write=(f,v)=>fs.writeFileSync(path.join(dir,f),JSON.stringify(v,null,2)+'\n');
const RULE30='https://www.fortnite.com/news/fortnite-victory-cash-cups-chapter-5-season-3-official-rules';
const RULE40='https://www.fortnite.com/competitive/rules-guidelines/rules-library/fortnite-victory-cups-chapter-7-season-2-official-rules';
const RULECLIX='https://www.fortnite.com/competitive/rules-guidelines/rules-library/playstation-clix-cup-official-rules';
const db={results:read('results.json'),review:read('history-sync-review.json'),
 reviewed:read('history-sync-reviewed.json'),status:read('history-sync-status.json'),
 ledger:read('approval-history.json'),updates:read('updates.json'),
 scan:read('history-sync-scan.json'),players:read('players.json'),
 tournaments:read('tournaments.json'),calendar:{}};
const allowed=[
 {date:'2024-06-11',region:'NAC',event:'S30_SoloVictoryCashCup',window:'S30_SoloVictoryCashCup_Event2Round1_NAC',tid:'ch5s3-solo-victory-cup',type:'qual',maxRank:5000},
 {date:'2024-07-16',region:'ME',event:'S30_SoloZBVictoryCashCup',window:'S30_SoloZBVictoryCashCup_Event5Round1_ME',tid:'ch5s3-zb-solo-victory',type:'qual',maxRank:2000},
 {date:'2024-07-15',region:'OCE',event:'S30_SoloVictoryCashCup',window:'S30_SoloVictoryCashCup_Event5Round2_OCE',tid:'ch5s3-solo-victory-cup',type:'cash'},
 {date:'2026-03-23',region:'NAC',event:'S40_SoloVictoryCup',window:'S40_SoloVictoryCup_Round2_Day1_NAC',tid:'ch7s2-solo-victory',type:'no-vr'},
 {date:'2026-04-30',region:'NAC',event:'S40_PlayStationCupClix',window:'S40_PlayStationCupClix_Qualifier_NAC',tid:'ch7s2-playstation-clix-cup-br',type:'clix',maxRank:100}
];
const known=new Set(db.players.candidates.map(p=>p.name));
const handled=new Set(db.reviewed.entries.map(x=>x.id));
const ids=new Set(db.results.map(x=>x.id));
const added=[],held=[];
const verify=(row,spec)=>{
 const u=new URL(row.source);
 if(u.protocol!=='https:'||u.hostname!=='www.fortnite.com'||u.pathname!=='/competitive/events/'+spec.event+'/'||
  u.searchParams.get('region')!==spec.region||u.searchParams.get('round')!==spec.window)throw Error('official source mismatch');
 const cat=db.tournaments.catalog.find(t=>t.id===row.tournamentId);
 if(!cat||cat.team!=='solo'||cat.name!==row.event||cat.seasonId!==row.seasonId||
  !cat.sourceEventIds?.includes(spec.event)||!known.has(row.player))throw Error('unknown Epic player or tournament');
 if(row.verified!==true||!Number.isSafeInteger(row.rank)||row.rank<1||
  !Number.isSafeInteger(row.kills)||row.kills<0||!Number.isSafeInteger(row.vrs)||row.vrs<0||
  !Number.isSafeInteger(row.points)||row.points<0||!Number.isSafeInteger(row.matches)||row.matches<1||
  row.vrs>row.matches)throw Error('ranked candidate numerical or identity invalid');
 const key='epicgames_'+spec.event+'_'+spec.region+'/'+spec.window,cp=db.scan.windows?.[key];
 if(!cp||cp.nextPage<1||cp.rankingOrderValid!==true||cp.lastSeenRank<row.rank||
  !Array.isArray(cp.proposals)||cp.proposals.filter(p=>p.id===row.id&&equalCandidate(p,row)).length!==1)
  throw Error('saved Epic ID or ranked checkpoint could not be confirmed');
 const mo=row.date.slice(0,7);
 if(!db.calendar[mo])db.calendar[mo]=read('calendar-history/'+mo+'.json').sessions;
 if(!db.calendar[mo]?.some(x=>x.sourceWindowId===spec.window&&x.eventId===spec.event&&x.region===spec.region&&
  x.dateJst===row.date&&x.tournamentId===row.tournamentId))throw Error('calendar window mismatch');
 if(ids.has(row.id)||db.ledger.entries.some(x=>x.id===row.id)||
  db.results.some(x=>collision(x,row,db.players.confirmedAliases||{})))throw Error('previously published or conflicting result');
};
for(const row of [...db.review.proposals]){
 const spec=allowed.find(x=>x.date===row.date&&x.region===row.region&&x.tid===row.tournamentId&&
  row.source?.includes('round='+x.window));
 if(!spec)continue;
 try{
  verify(row,spec);
  let prize=0,kind='',round='',note='',rule=RULE30,policy='verified-rule';
  if(spec.type==='qual'){
   if(row.seasonId!=='S30'||row.kind!=='予選'||row.prize!==0||row.matches>7||row.rank>spec.maxRank)
    throw Error('not an official regional 2024 top-ranked qualifier');
   kind='予選';round=row.round.replace(/\/ 予選$/,'/ 予選突破');
   note='本人Epic IDと保存済みEpic順位表の'+row.rank+'位を照合。'+spec.region+
    '上位'+spec.maxRank+'名の公式予選突破条件を満たし、Round1現金賞金は$0。規則: '+RULE30;
  }else if(spec.type==='cash'){
   if(row.seasonId!=='S30'||row.kind!=='賞金決勝'||row.prize!==null||row.vrs!==1||
      row.points!==100||row.matches>3)throw Error('cannot certify this final VR payout');
   kind='賞金決勝';round=row.round;prize=100;policy='official-final-vr-award';
   note='2024 CH5S3 OCE Event5 Round2決勝の'+row.rank+'位、1VRを本人Epic IDと保存済み順位表で確認。'
    +'公式1VR=$100、個人賞金$100。支払完了とは区別。規則: '+RULE30;
  }else if(spec.type==='no-vr'){
   if(row.seasonId!=='S40'||row.kind!=='賞金決勝'||row.prize!==null||
      row.vrs!==0||row.points!==0||row.matches>3)throw Error('uncertain 2026 S40 final score');
   kind='賞金決勝';round=row.round;rule=RULE40;
   note='2026 CH7S2 NAC Solo Victory Cup Round2 '+row.rank+'位。'
    +'本人Epic ID、保存済み順位表で0VRと一致。公式1VR=$100のため現金賞金$0。規則: '+RULE40;
  }else if(spec.type==='clix'){
   if(row.seasonId!=='S40'||row.kind!=='参加確認'||row.reviewOnly!==true||
      row.prize!==null||row.rank>100||row.matches>11)throw Error('uncertain Clix qualifier');
   kind='予選';round='Qualifier / 予選突破';rule=RULECLIX;
   note='2026 PlayStation Clix Cup NAC予選 '+row.rank+'位。Epic本人ID・保存済み順位表で上位100名の決勝進出を確認。'
    +'公式NAC上位200名のClix衣装などの報酬条件にも該当（配布完了未確認）。予選現金賞金$0。規則: '+RULECLIX;
  }
  if(!kind||/予選敗退/.test(round))throw Error('cannot classify a safe official result');
  const {reviewOnly,reviewReason,teamAccountIds,...r}=row;
  Object.assign(r,{kind,round,prize,note:note+' / 出典: '+row.source});
  db.results.push(r);ids.add(r.id);
  db.review.proposals=db.review.proposals.filter(x=>x.id!==row.id);
  db.ledger.entries.push({id:row.id,decision:'published',recordId:row.id,policy,approvedAt:now,
   approvedBy:'ChatGPT / user-authorized original Epic review',rule,source:row.source,
   evidence:'Exact saved official Epic ID, score, calendar window and regional official payout/qualification rule'});
  if(!handled.has(row.id)){
   db.reviewed.entries.push({id:row.id,decision:'published',recordId:row.id,reviewedAt:now,policy,source:row.source,rule});
   handled.add(row.id);
  }
  added.push({id:row.id,player:row.player,event:row.event,rank:row.rank,region:row.region,kind,prize});
 }catch(e){held.push({id:row.id,player:row.player,reason:String(e.message||e)})}
}
if(added.length){
 const id='source-verified-next-candidates-20261111';
 if(db.updates.entries.some(x=>x.id===id))throw Error('conflicting update log ID');
 db.updates.entries.unshift({id,date:'2026-11-11',type:'records',
  title:'2024/2026年の新規確認候補'+added.length+'戦績を通常一覧へ追加',
  description:'公式順位表の本人Epic ID、予選突破・決勝VR賞金・衣装対象の根拠を確認。未確認の実績や報酬を加算しない。',
  recordIds:added.map(x=>x.id)});
 db.review.manualReviewedAt=now;db.reviewed.reviewedAt=now;db.ledger.reviewedAt=now;
 db.status.found=db.review.proposals.length;
 db.status.manualReviewCandidates=db.review.proposals.length;
 db.status.manuallyPublished=(db.status.manuallyPublished||0)+added.length;
 db.status.lastReviewedBatchAt=now;
 db.status.message='新たな確認候補'+added.length+'件を公式順位表で照合して通常結果へ掲載。残り'+db.review.proposals.length+'件。';
}
const by={};for(const p of added)by[p.event]=(by[p.event]||0)+1;
console.log('AOT_NEW_REVIEWED_CANDIDATES '+JSON.stringify({dry,added:added.length,cash:added.filter(x=>x.prize>0).length,prizeSum:added.reduce((n,x)=>n+x.prize,0),by,held,remaining:db.review.proposals.length,rows:added}));
if(!dry&&added.length){
 for(const [name,x] of [['results.json',db.results],['history-sync-review.json',db.review],
  ['history-sync-reviewed.json',db.reviewed],['history-sync-status.json',db.status],
  ['approval-history.json',db.ledger],['updates.json',db.updates]])write(name,x);
}
