'use strict';
// 2026-11-07: checked 2024 CH5 S4 Solo Victory finalists / qualifiers,
// and 2026 EU Champion Aphrodite skin placement. Never trust an incomplete
// scan to prove final award without both the saved Epic score and official rule.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const write=(p,x)=>fs.writeFileSync(path.join(root,p),JSON.stringify(x,null,2)+'\n');
const ids=["auto-s41-30aa0adf3c57","auto-s31-533b82e4319a","auto-s31-58a2ed2ac368","auto-s31-0da274379f4f","auto-s31-3356f33b6267","auto-s31-1574e792dd58","auto-s31-14b61f93cb9d","auto-s31-37b4d7f85bf4","auto-s31-5424ddbadfd2","auto-s31-ea05dd6ee711","auto-s31-7aa3f4612a53","auto-s31-12e395437df2","auto-s31-7db527d8f481","auto-s31-b56d8105ab22","auto-s31-13723e6feaa6","auto-s31-55e885ea243b","auto-s31-0c6df4f8eff7","auto-s31-3ca4ea75e010","auto-s31-65a7d1f72bfa","auto-s31-a1ac68ac2478","auto-s31-8c3f8904dfb5","auto-s31-fef14df546a9","auto-s31-5c36a23a5912","auto-s31-23171c33e55b","auto-s31-a840eeaeac73","auto-s31-63027f4f1f68","auto-s31-3d0b076a6aa8","auto-s31-0ec994d48673","auto-s31-7f192eac6a5a","auto-s31-95678498167b","auto-s31-55d2401ca414","auto-s31-0031d2e8c0f8","auto-s31-635d5ac8d128","auto-s31-c69db2bc5468","auto-s31-dc320abeedd9","auto-s31-bd23e3c4d578","auto-s31-31686ad2075c","auto-s31-0c522c8f416c"];
const marker='review-20261107-s31-victory-aphrodite-38';
const RULE_VC='https://www.fortnite.com/news/fortnite-victory-cash-cups-chapter-5-season-4-official-rules';
const RULE_APH='https://www.fortnite.com/competitive/rules-guidelines/rules-library/champion-aphrodite-fncs-cup-chapter-7-season-3-official-rules';
const results=read('results.json'),pending=read('history-sync-review.json'),scan=read('history-sync-scan.json'),
  tours=read('tournaments.json'),players=read('players.json'),ledger=read('history-sync-reviewed.json'),
  status=read('history-sync-status.json'),updates=read('updates.json');
if(updates.entries.some(e=>e.id===marker)){console.log('S31_RULE_REVIEW_ALREADY_APPLIED');process.exit(0)}
if(ids.length!==38||new Set(ids).size!==38||!Array.isArray(results)||!scan.windows)throw Error('Frozen scan manifest or database invalid');
const indexed=new Map(pending.proposals.map(x=>[x.id,x])), catalog=new Map(tours.catalog.map(x=>[x.id,x]));
const known=new Set(players.candidates.map(x=>x.name)),oldLedger=new Set(ledger.entries.map(x=>x.id));
const aliases=new Map();
const normal=x=>String(x).trim().normalize('NFKC').toLowerCase();
for(const [canonical,list] of Object.entries(players.confirmedAliases||{})){
 aliases.set(normal(canonical),canonical);
 for(const alt of list)aliases.set(normal(alt),canonical);
}
const names=x=>(x.players||[x.player]).map(n=>aliases.get(normal(n))||normal(n)).sort().join('|');
const eventKey=x=>{
 try{return new URL(x.source).searchParams.get('round')||''}catch{return ''}
};
const phase=x=>{
 const win=eventKey(x),m=win.match(/Event(\d+)Round([12])/i);
 if(m)return m[1]+'-'+m[2];
 const label=String(x.round||'').match(/Event\s*(\d+)\s*·\s*Round\s*([12])/i);
 return label?label[1]+'-'+label[2]:null;
};
function sameSlot(a,b){
 if(a.date!==b.date||a.region!==b.region||a.tournamentId!==b.tournamentId||names(a)!==names(b))return false;
 const ap=phase(a),bp=phase(b);
 return !ap||!bp||ap===bp;
}
const savedSessions=new Map();
function check(row){
 const t=catalog.get(row.tournamentId);
 if(row.verified!==true||!t||row.event!==t.name||row.seasonId!==t.seasonId||
    !Array.isArray(row.players)&&!row.player||!Number.isSafeInteger(row.rank)||row.rank<1||
    !Number.isSafeInteger(row.points)||row.points<0||
    !Number.isSafeInteger(row.kills)||row.kills<0||
    !Number.isSafeInteger(row.vrs)||row.vrs<0||
    !Number.isSafeInteger(row.matches)||row.matches<1||row.vrs>row.matches)
    throw Error('Saved score, player, or event metadata is incomplete');
 const group=row.players||[row.player];
 if(group.length!==({solo:1,duo:2,trio:3,squad:4})[t.team]||
   group.some(n=>!known.has(n))||group.join(' / ')!==row.player)
   throw Error('Confirmed player roster does not match');
 const u=new URL(row.source),m=u.pathname.match(/^\/competitive\/events\/([^/]+)\/$/),win=u.searchParams.get('round');
 if(u.protocol!=='https:'||u.hostname!=='www.fortnite.com'||!m||
  !t.sourceEventIds.includes(m[1])||u.searchParams.get('region')!==row.region||
  !win||!win.startsWith(row.seasonId+'_')||!win.endsWith('_'+row.region))throw Error('Original Epic event window not matched');
 const month=row.date.slice(0,7);
 if(!savedSessions.has(month))savedSessions.set(month,read('calendar-history/'+month+'.json').sessions);
 const scheduled=savedSessions.get(month).filter(s=>s.eventId===m[1]&&s.tournamentId===t.id&&
   s.seasonId===row.seasonId&&s.dateJst===row.date&&s.region===row.region&&s.sourceWindowId===win);
 if(scheduled.length!==1)throw Error('Official archival calendar event/date mismatch');
 const checkpoint=scan.windows['epicgames_'+m[1]+'_'+row.region+'/'+win];
 const originals=(checkpoint?.proposals||[]).filter(x=>x.id===row.id);
 if(!checkpoint||checkpoint.nextPage<1||originals.length!==1)throw Error('No unique saved Epic-ID leaderboard evidence');
 const original=originals[0];
 for(const k of ['id','date','region','player','playerRaw','event','round','rank','points',
   'kills','vrs','prize','kind','matches','seasonId','tournamentId','source','verified']){
  if(JSON.stringify(original[k]??null)!==JSON.stringify(row[k]??null))throw Error('Saved leaderboard score changed at '+k);
 }
 if(JSON.stringify(original.players||null)!==JSON.stringify(row.players||null))
   throw Error('Saved team identifier mismatch');
}
const added=[],duplicates=[],held=[];
for(const id of ids){
 const row=indexed.get(id);
 if(!row){held.push({id,reason:'Missing from current review queue (concurrent sync?)'});continue}
 try{
  check(row);
  if(oldLedger.has(id))throw Error('Previously handled in approval ledger');
  const previous=results.find(x=>sameSlot(x,row));
  if(previous){
   if(!['rank','points','kills','vrs'].every(k=>previous[k]===row[k])||
     previous.matches!=null&&previous.matches!==row.matches)
     throw Error('Same player and event with score conflict: '+previous.id);
   duplicates.push({id,existing:previous.id});
   ledger.entries.push({id,decision:'already-published',existingId:previous.id,
     evidence:'Same season/region/Event/Round, confirmed player and all saved score fields'});
   oldLedger.add(id);continue;
  }
  const {reviewReason,reviewOnly,teamAccountIds,note,...original}=row;
  const record={...original};
  if(row.tournamentId==='ch5s4-solo-victory-cup'){
   const match=String(row.round).match(/^Event ([1-9][0-9]*) · Round ([12]) \/ (予選|賞金決勝)$/);
   if(!match||row.seasonId!=='S31'||!['OCE','ME'].includes(row.region))
     throw Error('CH5 S4 Solo Victory round or region mismatch');
   const stage=Number(match[2]),qualify=row.region==='OCE'?1500:2000;
   if(stage===1){
    if(row.kind!=='予選'||row.rank>qualify||row.matches>7||row.prize!==0)
      throw Error('2024 Solo Round1 no valid qualification or match cap');
    record.kind='予選';record.round='Event '+match[1]+' · Round 1 / 予選突破';
    record.prize=0;
    record.note='CH5 S4 Epic公式の'+row.region+'予選上位'+qualify+'位以内（'+row.rank+
     '位）。個人Epic IDと保存済み公式順位表を照合。予選賞金$0。規則: '+RULE_VC;
   }else{
    if(row.kind!=='賞金決勝'||row.matches>3||row.vrs>3||row.points!==row.vrs*100||
      row.prize!==null)throw Error('2024 Solo Round2 cash score or points mismatch');
    record.kind='賞金決勝';record.round='Event '+match[1]+' · Round 2 / 賞金決勝';
    record.prize=row.vrs*100;
    record.note='CH5 S4 Epic公式のRound2賞金は1VR=$100。保存済み'+row.vrs+
     'VRを大会規則と照合し、規定賞金$'+record.prize+'。支払い完了・受給資格の確認とは別。規則: '+RULE_VC;
   }
  }else if(row.tournamentId==='ch7s3-champion-aphrodite-fncs-cup-battle-royale'){
   if(row.date!=='2026-08-01'||row.region!=='EU'||row.seasonId!=='S41'||
      row.kind!=='参加確認'||row.rank>600||row.rank<1||row.prize!==null||
      row.players?.length!==2)throw Error('Aphrodite Battle Royale EU outfit rule mismatch');
   record.kind='スキン大会';record.round='単一開催枠 / スキン獲得';record.prize=0;
   record.note='CH7 S3 Champion Aphrodite FNCS Cup（通常BR）EUは上位600デュオがChampion Aphrodite衣装・ツルハシ・バックアクセサリー・ラップの順位報酬対象。'+row.rank+'位・'+row.points+
    'ptをEpic IDと順位表で照合済み。現金$0。配布完了は未確認。規則: '+RULE_APH;
  }else throw Error('Not an allowed event for this batch');
  if(results.some(x=>sameSlot(x,record)))throw Error('New collision');
  results.push(record);added.push(record);
  ledger.entries.push({id,decision:'published',recordId:id,source:row.source,
   rule:row.tournamentId==='ch5s4-solo-victory-cup'?RULE_VC:RULE_APH,
   evidence:'Verified Epic ID checkpoint, event window, official rank/VR rule, matched calendar and distinct published session'});
  oldLedger.add(id);
 }catch(e){held.push({id,reason:e.message})}
}
const resolved=new Set([...added.map(x=>x.id),...duplicates.map(x=>x.id)]);
if(!resolved.size){console.log('CH5_BATCH_NOTHING_SAFE '+JSON.stringify({held}));process.exit(0)}
pending.proposals=pending.proposals.filter(x=>!resolved.has(x.id));
const now=new Date().toISOString();pending.manualReviewedAt=now;ledger.reviewedAt=now;
status.found=pending.proposals.length;status.manualReviewCandidates=pending.proposals.length;
status.reviewOnlyCandidates=pending.proposals.filter(x=>x.reviewOnly===true).length;
status.manuallyPublished=(status.manuallyPublished||0)+added.length;
status.manuallyResolvedDuplicates=(status.manuallyResolvedDuplicates||0)+duplicates.length;
status.lastS31RuleReviewAt=now;
status.message='CH5 S4 Solo勝利賞金・予選とEU Aphrodite順位報酬を確認: '+added.length+'件掲載、'+duplicates.length+'件重複、'+held.length+'件保留。過去候補'+pending.proposals.length+'件。';
if(added.length)updates.entries.unshift({id:marker,date:now.slice(0,10),type:'records',
 title:'過去のSolo VCとChampion Aphroditeの成績を'+added.length+'件検証掲載',
 description:'2024年CH5 S4 Solo Victory Cupの公式予選突破・決勝1VR=$100および2026年EU Aphrodite通常BR上位600組のスキン条件を照合。公式本人アカウントの保存済み成績を検証し、既存記録は保持。報酬の支払い・配布完了は未確認。',
 recordIds:added.map(x=>x.id)});
write('results.json',results);write('history-sync-review.json',pending);
write('history-sync-reviewed.json',ledger);write('history-sync-status.json',status);write('updates.json',updates);
console.log('CH5_S31_RULE_BATCH '+JSON.stringify({published:added.length,duplicates,held,remaining:pending.proposals.length,
 cash:added.filter(x=>x.prize>0).map(x=>({name:x.player,region:x.region,date:x.date,rank:x.rank,cash:x.prize})),
 qualifiers:added.filter(x=>x.kind==='予選').length,skins:added.filter(x=>x.kind==='スキン大会').map(x=>x.player),
 zeroCash:added.filter(x=>x.prize===0).length}));
