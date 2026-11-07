'use strict';
// 2026-11-07: source-backed publication of the 30 pending historical cash/qualifier rows.
// Never guesses awards: official CH7 S3/S4 cutoffs, CH5 S4 $100/VR and $0 for
// verified first-round entries / zero-VR finals. Holds conflicting identities.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const write=(p,v)=>fs.writeFileSync(path.join(root,p),JSON.stringify(v,null,2)+'\n');
const manifest=[
'auto-s36-3201cfa39026','auto-s36-727347333cf5','auto-s42-8acacc857df4',
'auto-s41-2b5a7693349c','auto-s41-5681c6a72ed9','auto-s41-158627160c8c',
'auto-s41-cf87d8810351','auto-s41-b42f5fae6fee','auto-s41-ea793bbeb22f',
'auto-s41-cb75ea7865b2','auto-s41-7d70e76215a6','auto-s41-44d3ad3fbc4d',
'auto-s41-851fc0b962f0','auto-s41-52a923d0d3ee','auto-s41-c8bddd35d105',
'auto-s41-0afdb5c38883','auto-s41-280b991d2c27','auto-s41-397e9ba13380',
'auto-s41-6019515666a7','auto-s41-9f929af9623b','auto-s41-092f2a7f7fa9',
'auto-s41-076d7a1cb664','auto-s41-8a108d42f284','auto-s41-6265eb1c5704',
'auto-s41-2c480fce0432','auto-s41-a5dbd1a2695c','auto-s31-611c9063f61e',
'auto-s31-d2c5085fda43','auto-s31-6aa16c08c27c','auto-s31-798efaead9a7'];
if(manifest.length!==30||new Set(manifest).size!==30)throw Error('Frozen manifest not 30 distinct candidates');
const marker='manual-history-20261107-rule-30';
const results=read('results.json'),review=read('history-sync-review.json'),
 scan=read('history-sync-scan.json'),players=read('players.json'),
 tours=read('tournaments.json'),rules=read('tournament-rules.json'),
 ledger=read('history-sync-reviewed.json'),status=read('history-sync-status.json'),updates=read('updates.json');
if(updates.entries.some(e=>e.id===marker)){console.log('RULE30_ALREADY_APPLIED');process.exit(0)}
if(!Array.isArray(results)||!Array.isArray(review.proposals)||!scan.windows)throw Error('Bad database');
const byId=new Map(results.map(r=>[r.id,r])),pending=new Map(review.proposals.map(r=>[r.id,r]));
const known=new Set(players.candidates.map(r=>r.name)),catalog=new Map(tours.catalog.map(r=>[r.id,r]));
const ruleCatalog=new Map(rules.rules.map(r=>[r.id,r]));
const past=new Set(ledger.entries.map(r=>r.id));
const windows=new Map(),calendar=new Map();
for(const [key,cp] of Object.entries(scan.windows))
 for(const p of cp.proposals||[]){
  if(!windows.has(p.id))windows.set(p.id,[]);
  windows.get(p.id).push({key,cp,p});
 }
const aliases=new Map();
for(const [canonical,list] of Object.entries(players.confirmedAliases||{})){
 aliases.set(canonical.normalize('NFKC').toLowerCase(),canonical);
 for(const alt of list)aliases.set(String(alt).normalize('NFKC').toLowerCase(),canonical);
}
const clean=x=>aliases.get(String(x).trim().normalize('NFKC').toLowerCase())||String(x).trim().normalize('NFKC').toLowerCase();
const names=x=>(Array.isArray(x.players)&&x.players.length?x.players:[x.player]).map(clean).sort().join('|');
function phase(r){
 const text=String(r.round||''),match=text.match(/(?:Event|Day)\s*(\d+)\s*·\s*Round\s*([12])/i);
 if(match)return match[1]+'-'+match[2];
 const url=String(r.source||'').match(/[?&]round=[^&#]*(?:Event|Day)(\d+)Round([12])/i);
 return url?url[1]+'-'+url[2]:null;
}
function collision(candidate){
 return results.find(old=>old.date===candidate.date&&old.region===candidate.region&&
   old.tournamentId===candidate.tournamentId&&names(old)===names(candidate)&&
   (!phase(old)||!phase(candidate)||phase(old)===phase(candidate)));
}
function verify(row){
 if(row.verified!==true||row.reviewOnly===true||row.kind==='参加確認'||!Number.isSafeInteger(row.rank)||row.rank<1||
  !Number.isSafeInteger(row.points)||row.points<0||!Number.isSafeInteger(row.kills)||row.kills<0||
  !Number.isSafeInteger(row.vrs)||row.vrs<0||!Number.isSafeInteger(row.matches)||row.matches<1||
  row.vrs>row.matches)throw Error('Invalid verified score');
 const lineup=row.players||[row.player],t=catalog.get(row.tournamentId);
 if(!t||t.name!==row.event||t.seasonId!==row.seasonId||!lineup.length||
  lineup.some(x=>!known.has(x))||new Set(lineup).size!==lineup.length||
  lineup.length!==({solo:1,duo:2,trio:3,squad:4})[t.team]||
  lineup.join(' / ')!==row.player)throw Error('Unknown team or tournament');
 const u=new URL(row.source),m=u.pathname.match(/^\/competitive\/events\/([^/]+)\/$/);
 const win=u.searchParams.get('round');
 if(u.protocol!=='https:'||u.hostname!=='www.fortnite.com'||!m||!win||
   u.searchParams.get('region')!==row.region||!t.sourceEventIds.includes(m[1])||
   !win.startsWith(row.seasonId+'_')||!win.endsWith('_'+row.region))
   throw Error('Nonofficial or mismatched event ID');
 const month=row.date.slice(0,7);
 if(!calendar.has(month))calendar.set(month,read('calendar-history/'+month+'.json').sessions);
 if(!calendar.get(month).some(s=>s.dateJst===row.date&&s.region===row.region&&
  s.eventId===m[1]&&s.sourceWindowId===win&&s.tournamentId===row.tournamentId&&
  s.seasonId===row.seasonId))throw Error('Calendar/session mismatch');
 const evidence=windows.get(row.id)||[];
 if(evidence.length!==1||evidence[0].key!=='epicgames_'+m[1]+'_'+row.region+'/'+win||
  evidence[0].cp.nextPage<1)throw Error('Missing unique checkpoint');
 const snapshot=evidence[0].p;
 for(const k of ['id','date','region','player','playerRaw','event','round','rank','points','kills','vrs',
                  'prize','kind','matches','seasonId','tournamentId','source','verified']){
  if(JSON.stringify(snapshot[k]??null)!==JSON.stringify(row[k]??null))
   throw Error('Cached evidence mismatch '+k);
 }
 if(JSON.stringify(snapshot.players||null)!==JSON.stringify(row.players||null))
   throw Error('Cached team IDs mismatch');
 return {t,win};
}
const approved=[],duplicates=[],held=[];
for(const id of manifest){
 const row=pending.get(id);
 if(!row){
  if(byId.has(id)||past.has(id))duplicates.push({id,reason:'Previously processed'});
  else held.push({id,reason:'Not in current review queue'});
  continue;
 }
 try {
  verify(row);
  if(past.has(id))throw Error('Ledger already reviewed');
  const old=collision(row);
  if(old){
   if(['rank','points','kills','vrs'].some(k=>old[k]!==row[k])||
      (old.matches!=null&&old.matches!==row.matches))
    throw Error('Same team/session already published with different score: '+old.id);
   duplicates.push({id,existingId:old.id,reason:'Exact existing result'});
   ledger.entries.push({id,decision:'already-published',existingId:old.id,
     evidence:'Official window, canonical roster, rank, score and VR matched existing result'});
   past.add(id);
   continue;
  }
  const {reviewReason,reviewOnly,...base}=row;
  const r={...base},rule=ruleCatalog.get(row.tournamentId);
  if(row.tournamentId==='ch7s3-solo-reload-victory-cup'){
   if(!rule||rule.advance?.[row.region]!==320||!['ME','NAW'].includes(row.region)||
    !/^2026-08-(15|16)$/.test(row.date)||row.rank>320||row.matches>8||
    !/^Day 3 · Round 1/.test(row.round)||row.prize!==0||row.kind!=='予選')
    throw Error('CH7 S3 Reload qualifier rules or input differ');
   r.kind='予選';r.round='Day 3 · Round 1 / 予選突破';r.prize=0;
   r.note='Epic公式の'+row.region+'上位320名以内（'+row.rank+'位）で決勝進出対象。保存済み順位表のEpic IDを照合。予選現金$0。規則: '+rule.source;
  }else if(row.tournamentId==='ch7s4-solo-victory-cup'){
   if(!rule||rule.advance?.NAC!==2000||row.region!=='NAC'||row.date!=='2026-09-22'||
    row.rank>2000||row.kind!=='予選'||row.prize!==0||row.matches>8||!/^Event 3 · Round 1/.test(row.round))
    throw Error('CH7 S4 Solo qualifier differs');
   r.kind='予選';r.round='Event 3 · Round 1 / 予選突破';r.prize=0;
   r.note='Epic公式のNAC上位2000名以内（'+row.rank+'位）で予選突破対象。Epic IDと公式順位表照合。予選現金$0。規則: '+rule.source;
  }else if(row.tournamentId==='ch5s4-solo-victory-cup'){
   if(row.region!=='OCE'||!['2024-09-02','2024-09-09'].includes(row.date)||
    row.kind!=='賞金決勝'||row.prize!==null||row.vrs>1||row.matches>3||
    !/^Event [12] · Round 2/.test(row.round)||row.points!==row.vrs*100)
    throw Error('CH5 S4 final differs');
   const url='https://www.fortnite.com/news/fortnite-victory-cash-cups-chapter-5-season-4-official-rules';
   r.kind='賞金決勝';r.prize=row.vrs*100;
   r.note='Epic公式CH5 S4決勝の1VRあたり$100。個別順位表の'+row.vrs+'VRから現金$'+r.prize+'と算定。支払実績の確認とは別。規則: '+url;
  }else if(row.tournamentId==='ch6s3-console-duos-victory'){
   if(row.date!=='2025-06-14'||row.region!=='NAC'||row.rank<=500||
    row.kind!=='予選'||row.prize!==0||row.matches>7||!/^Event 1 · Round 1/.test(row.round))
    throw Error('CH6 S3 console qualifier differs');
   r.kind='予選';r.prize=0;
   r.note='NAC Duos Console Victory CupのRound 1参加順位'+row.rank+'位をEpic本人IDで確認。予選突破・決勝報酬は認定しない。予選現金$0。';
  }else throw Error('Unexpected event for rule-backed batch');
  if(collision(r))throw Error('New collision following classification');
  results.push(r);byId.set(r.id,r);approved.push(r);
  ledger.entries.push({id,decision:'published',recordId:id,
   source:row.source,rule:row.tournamentId==='ch5s4-solo-victory-cup'?
    'https://www.fortnite.com/news/fortnite-victory-cash-cups-chapter-5-season-4-official-rules':rule?.source||null,
   evidence:'Official Epic calendar, exact Epic-ID leaderboard checkpoint, season-specific cutoff/cash and no same-session duplicate'});
  past.add(id);
 }catch(e){held.push({id,reason:e.message})}
}
const cleared=new Set([...approved.map(x=>x.id),...duplicates.map(x=>x.id)]);
if(!cleared.size){console.log('RULE30_NO_SAFE_UPDATES '+JSON.stringify({held}));process.exit(0)}
review.proposals=review.proposals.filter(r=>!cleared.has(r.id));
const now=new Date().toISOString();
review.manualReviewedAt=now;ledger.reviewedAt=now;
status.found=review.proposals.length;status.manualReviewCandidates=review.proposals.length;
status.reviewOnlyCandidates=review.proposals.filter(x=>x.reviewOnly===true).length;
status.manuallyPublished=(status.manuallyPublished||0)+approved.length;
status.manuallyResolvedDuplicates=(status.manuallyResolvedDuplicates||0)+duplicates.length;
status.lastRuleReviewedAt=now;
status.message='2026-11-07過去大会ルール確認: 新規'+approved.length+'件、完全一致の既存'+duplicates.length+'件、保留'+held.length+'件。現金1VR=$100、予選突破320/2000位規則のみ適用。';
updates.entries.unshift({id:marker,date:now.slice(0,10),type:'records',
 title:'過去大会の予選突破・賞金決勝など'+approved.length+'戦績を検証掲載',
 description:'2026年8月Solo Reload予選、9月Solo VC予選と2024年OCE決勝のEpic公式成績・大会規則を照合。既存と完全一致する候補は再登録なし。未確認の賞金や成績は保留。',
 recordIds:approved.map(x=>x.id)});
write('results.json',results);write('history-sync-review.json',review);
write('history-sync-reviewed.json',ledger);write('history-sync-status.json',status);write('updates.json',updates);
console.log('RULE30_RESULT '+JSON.stringify({published:approved.length,duplicates:duplicates.length,held,remaining:review.proposals.length,
  winners:approved.filter(x=>x.prize>0).map(x=>({player:x.player,prize:x.prize})),names:approved.map(x=>x.player)}));
