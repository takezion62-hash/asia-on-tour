'use strict';
// User-supplied screenshots 1846–1855: add eight verified duo results and
// upgrade ONE existing NAC PlayStation finalist's unconfirmed award to $240.
// Fail closed on duplicate team, incorrect Epic UUID, wrong winner payout,
// different prior source or unexpected approval history.
const fs=require('node:fs'),path=require('node:path');
const {readResults,publishResults}=require('./source-results-store.cjs');
const {validateData,personalCents,roster}=require('./data-checks.cjs');
const {audit}=require('./validate-approvals.cjs');
const {validateUpdateLog}=require('./validate-updates.cjs');
const V=require('./verified-nov15-nac-ps-naw-nine.cjs');
const ROOT=path.resolve(__dirname,'..');
const read=p=>JSON.parse(fs.readFileSync(path.join(ROOT,p),'utf8'));
const write=(p,v)=>fs.writeFileSync(path.join(ROOT,p),JSON.stringify(v,null,2)+'\n');
const must=(v,why)=>{if(!v)throw Error('NOV15_FINAL9: '+why)};
const args=process.argv.slice(2),dry=args.includes('--dry-run');
must(args.length===0||(args.length===1&&dry),'only --dry-run or no args');
const proof=read('data/manual-approvals/20261115-nac-s29-ps-s36-naw-s37-nine-proof.json');
must(proof.version===1&&proof.batch?.id==='tracker-20261115-nac-s29-ps-s36-naw-s37-nine'&&
 Array.isArray(proof.batch.targets)&&proof.batch.targets.length===9&&
 JSON.stringify(proof.batch.targets)===JSON.stringify(V.TARGETS),
 'screenshot proof differs from fixed oracle');
must(V.TARGETS.every(V.expected)&&
 V.TARGETS.reduce((n,t)=>n+t.prize,0)===1840&&
 V.TARGETS.filter(t=>t.seasonId==='S29').length===4&&
 V.TARGETS.filter(t=>t.seasonId==='S37').length===4&&
 V.TARGETS.filter(t=>t.seasonId==='S36').length===1,'all 9 original award proofs must agree');
const results=readResults(ROOT).rows, players=read('players.json'),
 tournaments=read('tournaments.json'),ledger=read('approval-history.json'),updates=read('updates.json');
must(Array.isArray(results)&&Array.isArray(players.candidates)&&Array.isArray(ledger.entries)&&
 Array.isArray(updates.entries),'source documents missing');
const known=new Set(players.candidates.map(x=>x.name));
const owners=new Map([...known].map(n=>[n,n]));
must(known.size===players.candidates.length,'duplicate named player');
for(const [name,aliases] of Object.entries(players.confirmedAliases||{})){
 must(known.has(name)&&Array.isArray(aliases),'existing alias owner unknown '+name);
 for(const a of aliases){must(!owners.has(a)||owners.get(a)===name,
   'ambiguous pre-existing player alias '+a);owners.set(a,name)}
}
const newNameStyles={
 'wtj nannanfs31dd':'WT',
 'ASFA 法的処置':'AS',
 'しかねき':'SK',
 'せのくるです':'SN',
 'ℭhromeRet.Player':'CR',
 'ぴぃたこ':'PT',
 '私は3本のガーベラを君に贈ります':'GB',
 'MAT4DOR.':'MT'
};
const newNames=[],newAliases=[],added=[],promoted=[],already=[];
const priorCount=results.length;
const amount=rows=>rows.reduce((n,r)=>n+Math.round((r.prize||0)*100),0);
const personal=rows=>rows.reduce((n,r)=>n+personalCents(r)*roster(r).length,0);
const oldCash=amount(results),oldPersonal=personal(results);
const seen=new Set();
for(const t of V.TARGETS){
 must(V.expected(t)&&!seen.has(t.id),'altered/duplicate screenshot evidence '+t.id);
 seen.add(t.id);
 const duo=t.players.length===2;
 must(t.matches>=1&&t.matches<=(duo?3:6)&&t.vrs<=t.matches&&
 new Set(t.players).size===t.players.length,'invalid team or match count '+t.id);
 const cat=tournaments.catalog.find(x=>x.id===t.tournamentId);
 must(cat&&cat.seasonId===t.seasonId&&cat.chapter===t.chapter&&
 cat.season===t.season&&cat.name===t.event&&cat.sourceEventIds.includes(t.eventId)&&
 cat.team===(duo?'duo':'solo')&&cat.mode===(t.seasonId==='S29'?'zero-build':'battle-royale'),
 'wrong tournament catalog or event scope '+t.id);
 for(const p of t.profiles){
  must(!!V.uuid(p.url)&&V.uuid(p.url)===p.id,'bad Tracker account UUID '+p.name);
  const n=p.name;
  if(!known.has(n)){
   must(Object.hasOwn(newNameStyles,n)&&!owners.has(n),'unconfirmed new player identity '+n);
   players.candidates.push({name:n,initials:newNameStyles[n],accent:'cyan',
    desc:t.date+' '+t.region+' '+t.event+'決勝'+t.rank+'位・'+t.kills+
    (duo?'チーム':'')+'K・'+t.vrs+'VR・個人賞金$'+t.prizePerPlayer+
    '。本人Epic IDと提供Tracker画像で確認。'});
   known.add(n);owners.set(n,n);newNames.push(n);
  }
  must(owners.get(n)===n,'canonical name belongs to another identity '+n);
  // Screenshot nickname くまえふぶい is the SAME account as the existing
  // Cue.Ganondorf profile (Epic UUID 5aa76ea4-2a16-4e4e-ac2a-e3da5a0d8ed2).
  // Add the user-confirmed nickname as an alias; never create a second player.
  if(t.id==='s37-naw-console-duos-final-20251026-kumafv-chromeret'&&n==='Cue.Ganondorf'){
   must(t.confirmedDisplayAlias==='くまえふぶい'&&
    t.existingCanonicalName===n&&p.id==='5aa76ea4-2a16-4e4e-ac2a-e3da5a0d8ed2',
    'existing Cue.Ganondorf identity or submitted nickname changed');
   const nick=t.confirmedDisplayAlias;
   must(!owners.has(nick)||owners.get(nick)===n,'nickname already belongs to a different account');
   if(!owners.has(nick)){
    if(!players.confirmedAliases[n])players.confirmedAliases[n]=[];
    must(Array.isArray(players.confirmedAliases[n]),'canonical nickname list missing');
    players.confirmedAliases[n].push(nick);owners.set(nick,n);newAliases.push({name:n,raw:nick});
   }
  }
  if(p.raw!==n&&owners.get(p.raw)!==n){
   must(!owners.has(p.raw),'raw Tracker name already belongs to another person '+p.raw);
   if(!players.confirmedAliases[n])players.confirmedAliases[n]=[];
   must(Array.isArray(players.confirmedAliases[n]),'broken alias list '+n);
   players.confirmedAliases[n].push(p.raw);owners.set(p.raw,n);
   newAliases.push({name:n,raw:p.raw});
  }
  // A UUID can only be reused by the *same* canonical player on a
  // different date/round. Identical display names are NOT enough.
  for(const r of results)for(const old of
     (Array.isArray(r.profiles)?r.profiles:(r.profileUrl?[{name:r.player,url:r.profileUrl}]:[]))){
   if(V.uuid(old.url)===p.id)
    must(owners.get(old.name)===n,
     'Epic UUID is linked to a different canonical profile: '+p.id+' / '+old.name+' vs '+n);
  }
 }
 const existing=results.find(r=>r.id===t.id),hist=ledger.entries.filter(e=>e.recordId===t.id);
 const note='2026/11/15提供画像 '+t.screenshot+' と各Epic UUID・公式賞金表を照合。'+
  t.date+' '+t.region+' '+t.event+' '+t.round+'、'+t.rank+'位、'+t.points+
  'pt、'+t.matches+'試合、'+t.kills+(duo?'チーム':'')+'K、'+t.vrs+'VR。'+
  (duo?'チーム$'+t.prize+'・各選手$'+t.prizePerPlayer:'個人$240')+
  '。支払い完了は未確認。'+(t.confirmedDisplayAlias?' ユーザー提供名義「'+t.confirmedDisplayAlias+'」は既存の'+t.existingCanonicalName+'と同一Epic UUID。':'')+' Tracker: '+t.sourceTracker+' Rule: '+t.rule;
 if(existing){
  must(hist.length===1,'missing or multiple existing approval history '+t.id);
  if(V.verifyRow(existing,hist[0])){already.push(t.id);continue}
  must(t.seasonId==='S36'&&t.id==='auto-s36-05defadba950'&&
   existing.date===t.date&&existing.region===t.region&&existing.player==='p1ng'&&
   existing.playerRaw===t.playerRaw&&existing.tournamentId===t.tournamentId&&
   existing.event===t.event&&existing.seasonId===t.seasonId&&
   existing.round===t.originalRound&&existing.kind===t.originalKind&&
   existing.prize===null&&existing.source===t.originalSource&&
   existing.rank===t.rank&&existing.points===t.points&&
   existing.matches===t.matches&&existing.kills===t.kills&&existing.vrs===0&&
   existing.verified===true&&hist[0].policy==='attendance-only'&&
   hist[0].source===existing.source&&hist[0].decision==='published',
   'existing PlayStation attendance does NOT match exact original proof '+t.id);
  // Preserve the same ID/source/record position: no duplicated finalist.
  Object.assign(existing,{kind:'賞金決勝',round:t.round,prize:t.prize,
   teamPrize:t.prize,prizePerPlayer:t.prizePerPlayer,
   players:[...t.players],profiles:t.profiles.map(p=>({name:p.name,url:p.url})),
   teamAccountIds:t.profiles.map(p=>p.id.replace(/-/g,'')),
   profileUrl:t.profiles[0].url,
   note:note+' 賞金未確認だった既存参加確認を同一IDのまま補完。元の表示名 '+t.playerRaw+'。'});
  delete existing.reviewOnly;
  Object.assign(hist[0],{policy:V.POLICY,rule:t.rule,
   evidence:'Before: saved and verified Epic final #88, 19pt/5 matches/0K/0VR/$null; after: official NAC 51–100th $240, screenshot #1850 and Epic UUID'});
  must(V.verifyRow(existing,hist[0]),'cash promotion failed independent audit '+t.id);
  promoted.push(existing);continue;
 }
 must(hist.length===0,'orphan approval entry '+t.id);
 const collided=results.filter(r=>r.seasonId===t.seasonId&&
  r.date===t.date&&r.region===t.region&&r.tournamentId===t.tournamentId&&
  r.round===t.round&&
  (r.rank===t.rank||JSON.stringify([...roster(r)].sort())===JSON.stringify([...t.players].sort())));
 must(!collided.length,'same event final already published under another ID '+t.id);
 const row={id:t.id,date:t.date,region:t.region,player:t.players.join(' / '),
  players:[...t.players],playerRaw:t.playerRaw,event:t.event,round:t.round,
  rank:t.rank,points:t.points,matches:t.matches,kills:t.kills,vrs:t.vrs,
  prize:t.prize,teamPrize:t.prize,prizePerPlayer:t.prizePerPlayer,
  kind:'賞金決勝',seasonId:t.seasonId,chapter:t.chapter,season:t.season,
  tournamentId:t.tournamentId,source:t.sourceTracker,
  profiles:t.profiles.map(p=>({name:p.name,url:p.url})),
  teamAccountIds:t.profiles.map(p=>p.id.replace(/-/g,'')),
  verified:true,note};
 const e={id:t.id,recordId:t.id,decision:'published',policy:V.POLICY,
  approvedAt:new Date().toISOString(),
  approvedBy:'ChatGPT / 2026-11-15 screenshots and original Epic account UUIDs',
  source:t.sourceTracker,rule:t.rule,
  evidence:'User screenshots, region, round window, two Epic UUIDs, final VR and per-player prize'};
 must(V.verifyRow(row,e),'screenshot-locked result does not match '+t.id);
 results.push(row);ledger.entries.push(e);added.push(row);
}
must(seen.size===9&&new Set(results.map(x=>x.id)).size===results.length,
 'missing result or duplicate source ID');
const delta=added.concat(promoted).reduce((n,r)=>n+Math.round(r.prize*100),0);
must(results.length===priorCount+added.length&&amount(results)===oldCash+delta&&
 personal(results)===oldPersonal+delta,'previous existing cash or individual payouts changed unexpectedly');
if(added.length||promoted.length){
 must(!updates.entries.some(u=>u.id===proof.batch.id),'duplicate publication log');
 updates.entries.unshift({id:proof.batch.id,date:'2026-11-15',type:'records',
  title:'2024 NAC ZB Duos／2025 NAC PlayStation／2025 NAW Console Duos決勝：9件',
  description:'画像10枚とEpic UUIDを厳格照合。2024/4/4 NAC Zero Buildデュオ4組（各$200）、2025/7/27 NAC PlayStation決勝p1ngの既存参加確認を88位$240に補完、2025/10/26 NAW Consoleデュオ4組（各$200）。チーム賞金+$1,840、重複ゼロ。',
  recordIds:added.concat(promoted).map(r=>r.id)});
}
const report=validateData({results,players,tournaments});
must(!report.errors.length,'data integrity '+JSON.stringify(report.errors.slice(0,8)));
const approvals=audit(results,ledger,players);
must(!approvals.length,'approval verification '+JSON.stringify(approvals.slice(0,8)));
const uerrors=validateUpdateLog(results,updates);
must(!uerrors.length,'update history '+JSON.stringify(uerrors.slice(0,8)));
if(!dry&&(added.length||promoted.length||newNames.length||newAliases.length)){
 publishResults(ROOT,results);
 write('players.json',players);
 write('approval-history.json',ledger);
 write('updates.json',updates);
}
console.log('NOV15_VERIFIED_FINAL9 '+JSON.stringify({
 mode:dry?'dry-run':'apply',added:added.length,promoted:promoted.length,
 already:already.length,newPlayers:newNames,aliases:newAliases,
 prizeIncrease:delta/100,newRecordCount:results.length,
 ids:added.concat(promoted).map(r=>({id:r.id,player:r.player,rank:r.rank,prize:r.prize}))
}));
