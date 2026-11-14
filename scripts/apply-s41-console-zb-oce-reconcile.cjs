'use strict';
// Two distinct, fail-closed operations: publish four screenshot-verified S41 cash
// wins, and remove exactly three duplicate S42 OCE Tracker-imported rows.
// Keep the original official Epic S42 Event 7 Round 2 records intact.
const fs=require('node:fs'),path=require('node:path');
const {readResults,publishResults}=require('./source-results-store.cjs');
const {validateData,personalCents,roster}=require('./data-checks.cjs');
const {audit}=require('./validate-approvals.cjs');
const {validateUpdateLog}=require('./validate-updates.cjs');
const V=require('./verified-s41-console-zb-oce-reconcile.cjs');
const ROOT=path.resolve(__dirname,'..');
const read=p=>JSON.parse(fs.readFileSync(path.join(ROOT,p),'utf8'));
const write=(p,d)=>fs.writeFileSync(path.join(ROOT,p),JSON.stringify(d,null,2)+'\n');
const fail=(ok,why)=>{if(!ok)throw Error('S41_CONSOLE_ZB_OCE_DEDUP: '+why)};
const args=process.argv.slice(2),dry=args.includes('--dry-run');
fail(args.length===0||(args.length===1&&dry),'unsupported args: only --dry-run');
const doc=read('data/manual-approvals/20261114-s41-console-zb-oce-reconcile-proof.json');
fail(doc.version===1&&doc.batch?.id==='tracker-20261114-s41-console-zb-4-oce3-dedup'&&
  JSON.stringify(doc.batch.targets)===JSON.stringify(V.TARGETS)&&
  JSON.stringify(doc.batch.duplicates)===JSON.stringify(V.DUPLICATES),
  'locked screenshot or exact dedup pair changed');
const current=readResults(ROOT).rows, players=read('players.json'),
  tournaments=read('tournaments.json'), ledger=read('approval-history.json'),updates=read('updates.json');
fail(Array.isArray(current)&&Array.isArray(players.candidates)&&
 Array.isArray(ledger.entries)&&Array.isArray(updates.entries),'missing repository data');
const names=new Set(players.candidates.map(x=>x.name)),knownAlias=players.confirmedAliases||{};
const owner=new Map([...names].map(n=>[n,n]));
for(const [n,list] of Object.entries(knownAlias)){
 fail(names.has(n)&&Array.isArray(list),'unknown existing alias owner '+n);
 for(const v of list){fail(!owner.has(v)||owner.get(v)===n,'ambiguous existing alias '+v);owner.set(v,n)}
}
fail(names.has('でーもんくらげǃ')&&names.has('まぐろのほっぺ')&&names.has('たらこ唇'),
 'original player profiles missing');
fail(owner.get('dydゼロビルド勢ではありません')==='たらこ唇','tarako alias mismatch');
const byId=new Map(current.map(x=>[x.id,x]));
fail(byId.size===current.length,'duplicate existing result id');
const before=new Map(current.map(x=>[x.id,JSON.stringify(x)]));
const oldTeam=current.reduce((v,x)=>v+Math.round((x.prize||0)*100),0);
const oldPersonal=current.reduce((v,x)=>v+personalCents(x)*roster(x).length,0);
const targetCatalog=tournaments.catalog.find(c=>c.id==='ch7s3-console-zb-solo-victory');
fail(targetCatalog&&targetCatalog.seasonId==='S41'&&targetCatalog.chapter===7&&
 targetCatalog.season===3&&targetCatalog.team==='solo'&&targetCatalog.mode==='zero-build'&&
 targetCatalog.sourceEventIds.includes('S41_ConsoleVCC_SolosZB'),'wrong season or official console tournament');
const windows=new Map();
for(const month of ['2026-06','2026-07'])for(const s of read('calendar-history/'+month+'.json').sessions)
 windows.set(s.sourceWindowId,s);
const additions=[],existing=[];
for(const t of V.TARGETS){
 const member=t.member;
 fail(names.has(member.player)&&owner.get(member.player)===member.player&&
  V.uuid(member.url)===member.id,'unverified original Epic ID or player '+t.id);
 fail(t.eventId==='S41_ConsoleVCC_SolosZB'&&t.tournamentId===targetCatalog.id&&t.event===targetCatalog.name&&
  t.points===100&&t.vrs===1&&t.prize===100&&t.kills>=0&&
  t.matches>=1&&t.matches<=3&&t.rank>=1&&t.points===t.vrs*100,'inconsistent win or payout '+t.id);
 fail(t.sourceTracker==='https://fortnitetracker.com/events/epicgames_'+t.eventId+'_'+t.region+'?window='+t.windowId&&
  t.rule===V.RULE,'mismatched scoreboard/rule '+t.id);
 const slot=windows.get(t.windowId);
 fail(slot&&slot.dateJst===t.date&&slot.region===t.region&&slot.stage==='決勝'&&
  slot.tournamentId===t.tournamentId&&slot.eventId===t.eventId,'not a verified official scheduled final '+t.id);
 for(const other of current)for(const p of other.profiles||[]){
  if(V.uuid(p.url)===member.id)
   fail(owner.get(p.name)===member.player||p.name===member.player,'Epic UUID used by a different published player '+p.name);
 }
 const found=byId.get(t.id),prior=ledger.entries.filter(e=>e.recordId===t.id);
 if(found){
  fail(prior.length===1&&V.verifyCashRow(found,prior[0]),'published award does not match approved screenshot '+t.id);
  existing.push(t.id);continue;
 }
 fail(prior.length===0,'stale approval exists without record '+t.id);
 const same=current.filter(x=>x.date===t.date&&x.region===t.region&&
  x.tournamentId===t.tournamentId&&x.round===t.round&&
  (x.rank===t.rank||x.player===member.player));
 fail(same.length===0,'duplicate/competing same-event score exists '+t.id+': '+same.map(x=>x.id));
 const now=new Date().toISOString();
 const note='2026/11/14ユーザー提供Fortnite Tracker画像（'+t.screenshot+'）、本人Epic ID '+member.id+
  ' と公式大会カレンダーを照合。'+t.date+' '+t.region+' '+t.event+' '+t.round+' '+
  t.rank+'位・'+t.points+'pt・'+t.matches+'試合・'+t.kills+'キル・'+t.vrs+'VR。'+
  'Epic公式規則：決勝1VRにつき個人賞金$100。実際の入金は未確認。 Tracker: '+t.sourceTracker+' Rule: '+V.RULE;
 const row={id:t.id,date:t.date,region:t.region,player:member.player,players:[member.player],
  profiles:[{name:member.player,url:member.url}],profileUrl:member.url,
  teamAccountIds:[member.id.replace(/-/g,'')],teamPrize:100,prizePerPlayer:100,playerRaw:member.raw,
  event:t.event,round:t.round,rank:t.rank,points:t.points,kills:t.kills,
  vrs:t.vrs,prize:100,kind:'賞金決勝',matches:t.matches,seasonId:'S41',chapter:7,season:3,
  tournamentId:t.tournamentId,source:t.sourceTracker,verified:true,note,
  trackerStats:{verified:true,source:t.sourceTracker,avgPlace:t.avgPlace,
   avgTimeAliveSeconds:t.avgTimeAliveSeconds,kdRatio:t.kdRatio}};
 const entry={id:t.id,recordId:t.id,decision:'published',policy:V.POLICY,approvedAt:now,
  approvedBy:'ChatGPT / user-authorized 2026-11-14 screenshots',
  source:t.sourceTracker,rule:V.RULE,
  evidence:'Original screenshot '+t.screenshot+', Epic UUID '+member.id+', official final window and $100 per VR'};
 fail(V.verifyCashRow(row,entry),'newly created score or cash failed locked audit '+t.id);
 additions.push(row);ledger.entries.push(entry);
}
const removed=[];
for(const t of V.DUPLICATES){
 const older=byId.get(t.removeId),retained=byId.get(t.retainId);
 const alreadyRemoved=!older;
 fail(retained,'must retain existing authoritative Epic result '+t.retainId);
 fail(retained.id!==t.removeId&&retained.source==='https://www.fortnite.com/competitive/events/S42_ConsoleVCC_SolosZB/?region=OCE&round='+t.officialWindowId,
  'retained Epic scoreboard not original event '+t.retainId);
 for(const record of [retained,...(older?[older]:[])]){
  fail(record.date===t.date&&record.region===t.region&&record.seasonId==='S42'&&record.chapter===7&&
    record.season===4&&record.tournamentId===t.tournamentId&&record.event===t.event&&
    record.player===t.player&&record.rank===t.rank&&record.points===t.points&&
    record.kills===t.kills&&record.vrs===t.vrs&&record.matches===t.matches&&
    record.prize===t.prize&&record.kind==='賞金決勝'&&record.verified===true,
    'mismatched duplicate or retained score '+t.removeId);
 }
 fail(retained.round===t.retainedRound,'retained exact round label changed '+t.retainId);
 if(alreadyRemoved)continue;
 fail(older.round===t.legacyRound&&older.source==='https://fortnitetracker.com/events/epicgames_S42_ConsoleVCC_SolosZB_OCE',
  'old evidence is no longer the exact legacy duplicate '+t.removeId);
 fail(!ledger.entries.some(e=>e.recordId===t.removeId||e.id===t.removeId),
  'refuse to delete ledger-approved record '+t.removeId);
 fail(!updates.entries.some(u=>u.recordIds?.includes(t.removeId)),
  'refuse to delete record referenced by existing update '+t.removeId);
 removed.push(t.removeId);
}
fail(removed.length===0||removed.length===3,'partial deletion of three exact duplicates is forbidden');
const removedSet=new Set(removed);
const next=current.filter(x=>!removedSet.has(x.id)).concat(additions);
fail(next.length===current.length+additions.length-removed.length&&
 new Set(next.map(x=>x.id)).size===next.length,'unexpected row count/duplicate IDs');
const nextById=new Map(next.map(x=>[x.id,x]));
for(const [id,encoded] of before){
 if(!removedSet.has(id))fail(JSON.stringify(nextById.get(id))===encoded,'changed unrelated or retained published record '+id);
}
const newTeam=next.reduce((v,x)=>v+Math.round((x.prize||0)*100),0);
const newPersonal=next.reduce((v,x)=>v+personalCents(x)*roster(x).length,0);
const net=(additions.length-removed.length)*10000;
fail(newTeam===oldTeam+net&&newPersonal===oldPersonal+net,'cash invariant violation');
const updateId=doc.batch.id;
if(additions.length||removed.length){
 fail(!updates.entries.some(e=>e.id===updateId),'duplicate update log ID');
 updates.entries.unshift({id:updateId,date:'2026-11-14',type:'records',
  title:'2026 Console ZB Solo VC賞金4件追加・OCE重複3件修復',
  description:'2026/6/22 EU でーもんくらげǃ41位と7/26 ME でーもんくらげǃ7位・まぐろのほっぺ19位・たらこ唇20位、4件各$100をEpic本人IDとTracker画像・公式VR賞金で追加。2026/10/17 OCE Event7 Round2の3名（でーもんくらげǃ11位・ぬぬぬぬぬぬぬぬwww覚醒WWW13位・ももち19位）のTracker旧行3件を削除し、元の公式Epic承認行3件は維持。削除対象と残すIDの対応は証拠ファイルに保存。賞金集計の純増$100。',
  recordIds:additions.map(x=>x.id)});
}
const valid=validateData({results:next,players,tournaments});
fail(valid.errors.length===0,'data validation failed: '+JSON.stringify(valid.errors.slice(0,7)));
const approvals=audit(next,ledger,players);
fail(approvals.length===0,'approval validation failed: '+JSON.stringify(approvals.slice(0,7)));
const history=validateUpdateLog(next,updates);
fail(history.length===0,'update log validation failed: '+JSON.stringify(history.slice(0,7)));
if(!dry&&(additions.length||removed.length)){
 publishResults(ROOT,next,{allowRemoval:removed.length>0});
 write('approval-history.json',ledger);
 write('updates.json',updates);
}
console.log('S41_CONSOLE_ZB_OCE_DEDUP '+JSON.stringify({
 mode:dry?'dry-run':'apply',before:current.length,after:next.length,
 added:additions.map(x=>({id:x.id,player:x.player,rank:x.rank,prize:x.prize})),
 removed,retained:V.DUPLICATES.map(x=>x.retainId),existing:existing.length,
 teamPrizeDeltaUSD:(newTeam-oldTeam)/100,personalPrizeDeltaUSD:(newPersonal-oldPersonal)/100
}));
