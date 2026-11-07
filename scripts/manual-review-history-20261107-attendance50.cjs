'use strict';
// Frozen 50-case audit, 2026-11-07; excludes potentially voided OCE PlayStation
// qualifiers and an unresolved OCE Unreal Cup cash-paying team (#172).
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const write=(p,v)=>fs.writeFileSync(path.join(root,p),JSON.stringify(v,null,2)+'\n');
const MANIFEST=["auto-s33-2460edfd1873","auto-s33-ad94b12dbd64","auto-s33-453efb91b750","auto-s33-e0298312a872","auto-s33-aafa161d3abd","auto-s43-1f3a56f9719d","auto-s42-7a7190176717","auto-s42-b5f7fea1a00d","auto-s42-b9eca90776b0","auto-s43-5bf54554abf2","auto-s42-e3d7f93d15e2","auto-s41-9152490d5a5c","auto-s41-b2d7162e6d7d","auto-s41-a97b9ac920f1","auto-s41-d0dfe4038695","auto-s41-3af52be8da5b","auto-s42-f76e452c5dff","auto-s42-625b69c43ff2","auto-s42-2e307210a1dc","auto-s42-55faa055f1ba","auto-s31-bf8c2a85a49b","auto-s31-f3bdb2228c13","auto-s31-c5b6bc0657c0","auto-s31-9eda47099da2","auto-s31-6ea10a0ff554","auto-s43-c51e2bbfb3ed","auto-s43-6b7fe976d9eb","auto-s42-61e71bf45e7b","auto-s42-9fe27b95967c","auto-s39-0526a17bfd74","auto-s39-a1d738d30619","auto-s39-94af2bc3c668","auto-s39-daeecffb5331","auto-s39-245eaba1e856","auto-s39-fc46cee746c3","auto-s39-d1c4235e4772","auto-s39-7674b267dd12","auto-s39-7423dc24ae36","auto-s42-c64abcaf8565","auto-s42-476c7702d25b","auto-s42-fbe6daa60c4c","auto-s42-e16506e8f88b","auto-s42-88c964280cff","auto-s42-7374ddbf6e7d","auto-s41-d18b65839f32","auto-s41-c866e68378f5","auto-s42-36e7df59afec","auto-s42-ef7cea06a6a2","auto-s41-f689f190308d","auto-s43-496b6546b82c"];
if(MANIFEST.length!==50||new Set(MANIFEST).size!==50)throw Error('Frozen manifest is not 50 distinct IDs');
const marker='manual-history-20261107-attendance-50';
const results=read('results.json'),review=read('history-sync-review.json'),scan=read('history-sync-scan.json'),
  players=read('players.json'),tours=read('tournaments.json'),ledger=read('history-sync-reviewed.json'),
  status=read('history-sync-status.json'),updates=read('updates.json');
if(updates.entries.some(x=>x.id===marker)){console.log('REVIEW50_ALREADY_APPLIED');process.exit(0)}
if(!Array.isArray(results)||!Array.isArray(review.proposals)||!scan.windows)throw Error('Invalid files');
const pending=new Map(review.proposals.map(x=>[x.id,x]));
const known=new Set(players.candidates.map(x=>x.name)),catalog=new Map(tours.catalog.map(x=>[x.id,x]));
const scanned=new Map(),calendar=new Map();
for(const [key,cp] of Object.entries(scan.windows))
 for(const record of cp.proposals||[]){
  if(!scanned.has(record.id))scanned.set(record.id,[]);
  scanned.get(record.id).push({key,cp,record});
 }
const alias=new Map();
const norm=x=>String(x).trim().normalize('NFKC').toLowerCase();
for(const [name,arr] of Object.entries(players.confirmedAliases||{})){
 alias.set(norm(name),name);
 for(const s of arr)alias.set(norm(s),name);
}
const canon=x=>alias.get(norm(x))||norm(x);
const people=x=>x.players&&x.players.length?x.players:[x.player];
const teamSig=x=>people(x).map(canon).sort().join('|');
function windowSig(x){
 const source=new URL(x.source||'https://example.invalid');
 const round=source.searchParams.get('round')||'';
 if(round)return round.replace(/^S\d+_/,'').replace(/_[A-Z]+$/,'');
 const s=String(x.round||'').match(/(?:Event|Day)\s*(\d+)\s*·\s*Round\s*([12])/);
 return s?s[1]+'-'+s[2]:'unknown';
}
function sameSlot(a,b){
 if(a.date!==b.date||a.region!==b.region||a.tournamentId!==b.tournamentId||teamSig(a)!==teamSig(b))return false;
 const x=windowSig(a),y=windowSig(b);
 return x===y||x==='unknown'||y==='unknown';
}
function sameScore(a,b){
 return ['rank','points','kills','vrs'].every(k=>a[k]===b[k])&&
    (a.matches==null||b.matches==null||a.matches===b.matches);
}
function check(row){
 if(!row||row.verified!==true||row.reviewOnly!==true||row.kind!=='参加確認'||row.prize!==null)
  throw Error('Unverified attendance-only candidate');
 if(!Number.isSafeInteger(row.rank)||row.rank<1||!Number.isSafeInteger(row.points)||row.points<0||
    !Number.isSafeInteger(row.kills)||row.kills<0||!Number.isSafeInteger(row.vrs)||row.vrs<0||
    !Number.isSafeInteger(row.matches)||row.matches<1||row.vrs>row.matches)
  throw Error('Invalid leaderboard score');
 const t=catalog.get(row.tournamentId),roster=people(row);
 if(!t||!t.sourceEventIds?.length||t.name!==row.event||t.seasonId!==row.seasonId||
   roster.length!==({solo:1,duo:2,trio:3,squad:4})[t.team]||new Set(roster).size!==roster.length||
   roster.some(x=>!known.has(x))||roster.join(' / ')!==row.player)
  throw Error('Team size, player names or tournament catalog mismatch');
 const u=new URL(row.source),m=u.pathname.match(/^\/competitive\/events\/([^/]+)\/$/),win=u.searchParams.get('round');
 if(u.protocol!=='https:'||u.hostname!=='www.fortnite.com'||!m||!win||
   u.searchParams.get('region')!==row.region||!t.sourceEventIds.includes(m[1])||
   !win.startsWith(row.seasonId+'_')||!win.endsWith('_'+row.region))
  throw Error('Epic event URL mismatch');
 const month=row.date.slice(0,7);
 if(!calendar.has(month))calendar.set(month,read('calendar-history/'+month+'.json').sessions);
 if(!calendar.get(month).some(w=>w.dateJst===row.date&&w.region===row.region&&w.tournamentId===row.tournamentId&&
  w.seasonId===row.seasonId&&w.eventId===m[1]&&w.sourceWindowId===win))
  throw Error('Official schedule not matched');
 const found=scanned.get(row.id)||[];
 if(found.length!==1||found[0].key!=='epicgames_'+m[1]+'_'+row.region+'/'+win||
    found[0].cp.nextPage<1)throw Error('No unique saved Epic-ID leaderboard checkpoint');
 const saved=found[0].record;
 for(const k of ['id','date','region','player','playerRaw','event','round','rank','points','kills',
   'vrs','prize','kind','matches','seasonId','tournamentId','source','verified']){
    if(JSON.stringify(row[k]??null)!==JSON.stringify(saved[k]??null))throw Error('Saved ranking differs: '+k);
 }
 if(JSON.stringify(row.players||null)!==JSON.stringify(saved.players||null))
  throw Error('Saved team identifiers differ');
}
const doneLedger=new Set(ledger.entries.map(x=>x.id));
const added=[],resolved=[],held=[],awards=[];
for(const id of MANIFEST){
 const item=pending.get(id);
 if(!item){
  if(results.some(x=>x.id===id)||doneLedger.has(id)){resolved.push({id,reason:'Already resolved'});continue}
  held.push({id,reason:'Missing from current queue'});continue;
 }
 try{
  check(item);
  if(doneLedger.has(id))throw Error('Already in review ledger');
  const old=results.find(r=>sameSlot(r,item));
  if(old){
   if(!sameScore(old,item))throw Error('Same player/session with conflicting rank or score: '+old.id);
   resolved.push({id,existingId:old.id,reason:'Same exact score already published'});
   ledger.entries.push({id,decision:'already-published',existingId:old.id,
      evidence:'Official Epic event session, player roster, rank, score and VR independently matched'});
   doneLedger.add(id);continue;
  }
  const {reviewOnly,reviewReason,...base}=item;
  const row={...base};
  const isAphrodite=item.tournamentId==='ch7s3-champion-aphrodite-fncs-cup-battle-royale'&&item.region==='OCE';
  const isPlayStation=item.tournamentId==='ch7s3-days-of-play-playstation-cup-br'&&item.region==='NAW';
  const isUnreal=item.tournamentId==='ch7s1-one-million-unreal-cup'&&item.region==='OCE';
  const isZoro=item.tournamentId==='ch7s5-one-piece-zoro-mobile-cup'&&item.region==='OCE';
  let rule=null;
  if(isAphrodite){
   if(!['2026-07-31'].includes(item.date)||item.points<40||!([54,162].includes(item.rank)))
    throw Error('FNCS cosmetic source rank changed');
   rule='https://www.fortnite.com/competitive/rules-guidelines/rules-library/champion-aphrodite-fncs-cup-chapter-7-season-3-official-rules';
   if(item.rank<=60){
    row.kind='スキン大会';row.prize=0;row.round='単一開催枠 / スキン獲得';
    row.note='Epic公式Battle Royale OCE上位60組へのChampion Aphrodite衣装等の順位条件達成（'+item.rank+'位）。個別Epic IDと公式記録を照合。現金$0。ゲーム内配布完了は未確認。規則: '+rule;
    awards.push({id,player:item.player,kind:'Champion Aphrodite outfit'});
   }else{
    row.kind='参加確認';row.prize=0;
    row.note='Epic公式Battle Royale OCE衣装上位60組には該当しないが、40点以上のバックアクセサリーと8点以上のラップの規定を'+item.points+'点で満たす。衣装獲得とは扱わない。現金$0。規則: '+rule;
    awards.push({id,player:item.player,kind:'Points cosmetics (not outfit)'});
   }
  }else if(isPlayStation){
   if(item.date!=='2026-06-08'||item.points<8||item.rank<=100||
      !item.round.startsWith('Qualifier /'))throw Error('NAW qualifier/source mismatch');
   rule='https://www.fortnite.com/competitive/rules-guidelines/rules-library/days-of-play-playstation-cup-chapter-7-season-3-official-rules';
   row.kind='参加確認';row.prize=0;
   row.note='NAWのQualifierで公式順位'+item.rank+'位（予選通過・現金決勝賞金なし）。'+item.points+'点のため、8点以上のFlorin’s Victoryゲーム内スプレー条件を満たす。現金$0。配布完了は未確認。規則: '+rule;
   awards.push({id,player:item.player,kind:'Florin spray'});
  }else if(isUnreal){
   if(item.date!=='2025-12-20'||item.rank<=250)throw Error('Unreal cash-paying team: review separately');
   rule='https://www.fortnite.com/competitive/rules-guidelines/rules-library/1-million-dollar-unreal-cup-chapter-7-season-1-official-rules';
   row.kind='参加確認';row.prize=0;
   row.note='Epic公式OCEチーム賞金は250位以内。保存済み順位'+item.rank+'位は圏外のため現金$0。順位表本人照合済み。規則: '+rule;
  }else if(isZoro){
   if(item.date!=='2026-11-06'||![4,9].includes(item.rank))
    throw Error('Zoro OCE rank/date changed');
   rule='https://www.fortnite.com/competitive/rules-guidelines/rules-library/one-piece-zoro-cup-chapter-7-mini-season-official-rules';
   row.kind='スキン大会';row.prize=0;row.round='単一開催枠 / スキン獲得';
   row.note='Epic公式Zoro Mobile OCEの順位報酬対象であることを'+item.rank+'位のEpic IDで確認。現金$0。配布完了は別途未確認。規則: '+rule;
   awards.push({id,player:item.player,kind:'Zoro Mobile cosmetic'});
  }else{
   // No inferred cash, qualification or outfit outside the verified award events.
   row.prize=null;row.kind='参加確認';
   row.note='Epic ID・公式開催枠・個別保存順位表の参加と成績を照合。未確認の現金・予選突破・衣装報酬は加算しない。出典: '+item.source;
  }
  if(results.some(x=>sameSlot(x,row)))throw Error('Duplicate introduced on classification');
  results.push(row);added.push(row);doneLedger.add(id);
  ledger.entries.push({id,decision:'published',recordId:id,policy:rule?'verified-official-rule':'attendance-only',
    source:item.source,rule,evidence:'Exact saved Epic-ID checkpoint, official window, team identity and no same-session duplication'});
 }catch(e){held.push({id,reason:e.message})}
}
const clear=new Set([...added.map(x=>x.id),...resolved.map(x=>x.id)]);
if(!clear.size){console.log('REVIEW50_NO_CHANGES '+JSON.stringify({held}));process.exit(0)}
review.proposals=review.proposals.filter(x=>!clear.has(x.id));
const now=new Date().toISOString();review.manualReviewedAt=now;ledger.reviewedAt=now;
status.found=review.proposals.length;status.manualReviewCandidates=review.proposals.length;
status.reviewOnlyCandidates=review.proposals.filter(x=>x.reviewOnly===true).length;
status.manuallyPublished=(status.manuallyPublished||0)+added.length;
status.manuallyResolvedDuplicates=(status.manuallyResolvedDuplicates||0)+resolved.length;
status.lastAttendanceReviewedAt=now;
status.message='過去大会の出場・公式報酬確認: '+added.length+'件新規掲載、'+resolved.length+
 '件既存一致、'+held.length+'件この実行では保留。疑義のあるOCE PlayStation13件とUnreal Cup賞金分配1件は未処理。';
updates.entries.unshift({id:marker,date:now.slice(0,10),type:'records',
 title:'過去大会の出場・スキン条件など'+added.length+'戦績を追加',
 description:'Epic IDと公式開催枠、チーム・地域・大会規則を再照合。Aphrodite FNCS衣装・低位コスメ、PlayStationスプレー、Unreal Cup無賞金チーム、参加のみを区別。未解決のOCE大会13件とUnreal賞金1件は残して保護。',
 recordIds:added.map(x=>x.id)});
write('results.json',results);write('history-sync-review.json',review);
write('history-sync-reviewed.json',ledger);write('history-sync-status.json',status);write('updates.json',updates);
console.log('REVIEW50_RESULT '+JSON.stringify({published:added.length,resolved,held,awards,
  remaining:review.proposals.length,bySeries:added.reduce((a,x)=>(a[x.event]=(a[x.event]||0)+1,a),{})}));
