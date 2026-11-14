'use strict';
// Fail-closed, idempotent publisher for ten 2023-2025 screenshot-verified
// NAC ZB Duos, NAW PlayStation, ME PlayStation SypherPK final results.
const fs=require('node:fs'),path=require('node:path');
const {readResults,publishResults}=require('./source-results-store.cjs');
const {validateData,personalCents,roster}=require('./data-checks.cjs');
const {audit}=require('./validate-approvals.cjs');
const {validateUpdateLog}=require('./validate-updates.cjs');
const V=require('./verified-s27-s34-s31-ps-zb-ten.cjs');
const ROOT=path.resolve(__dirname,'..');
const read=file=>JSON.parse(fs.readFileSync(path.join(ROOT,file),'utf8'));
const write=(file,obj)=>fs.writeFileSync(path.join(ROOT,file),JSON.stringify(obj,null,2)+'\n');
const check=(ok,msg)=>{if(!ok)throw Error('S27_S34_S31_PS_ZB_TEN: '+msg)};
const args=process.argv.slice(2),dry=args.includes('--dry-run');
check(args.length===0||(args.length===1&&dry),'only --dry-run is permitted');
const doc=read('data/manual-approvals/20261114-s27-s34-s31-ps-zb-ten-proof.json');
check(doc.version===1&&doc.batch?.id==='tracker-20261114-nac-s27-naw-s34-me-s31-ten'&&
 Array.isArray(doc.batch.targets)&&doc.batch.targets.length===10&&
 JSON.stringify(doc.batch.targets)===JSON.stringify(V.TARGETS),
 'proof diverges from independent original image oracle');
const results=readResults(ROOT).rows,players=read('players.json'),tournaments=read('tournaments.json'),
 ledger=read('approval-history.json'),updates=read('updates.json');
check(Array.isArray(results)&&Array.isArray(players.candidates)&&
 Array.isArray(ledger.entries)&&Array.isArray(updates.entries),'invalid repository state');
const originalCount=results.length,byId=new Map(results.map(x=>[x.id,x]));
check(byId.size===originalCount,'duplicate original record IDs');
const cash=arr=>arr.reduce((n,r)=>n+Math.round((r.prize||0)*100),0);
const alloc=arr=>arr.reduce((n,r)=>n+personalCents(r)*roster(r).length,0);
const originalCash=cash(results),originalAllocation=alloc(results);
const names=new Set(players.candidates.map(p=>p.name));
const owners=new Map([...names].map(n=>[n,n]));
for(const [name,aliases] of Object.entries(players.confirmedAliases||{})){
 check(names.has(name)&&Array.isArray(aliases),'broken prior alias owner '+name);
 for(const raw of aliases){
  check(!owners.has(raw)||owners.get(raw)===name,'ambiguous alias '+raw);
  owners.set(raw,name);
 }
}
let newPlayer=false,newAlias=false;
const uniqueNew='永瀬さらLOVEじょーじ396';
if(!names.has(uniqueNew)){
 check(!owners.has(uniqueNew),'new user name already assigned as an alias');
 players.candidates.push({name:uniqueNew,initials:'NS',accent:'pink',
 desc:'2024/9/2 ME PlayStation SypherPK Cup決勝79位、12pt、3試合、1キル、0VR、個人賞金$200。ユーザー提供Tracker画像とオリジナルEpic UUID effc991d-fba7-41ef-aa66-4fbd1065d32cで確認。'});
 names.add(uniqueNew);owners.set(uniqueNew,uniqueNew);newPlayer=true;
}
const alt='ptt れっどにゃんぐ';
check(names.has('れっどうぃんぐ'),'missing existing redwing profile');
if(!owners.has(alt)){
 players.confirmedAliases['れっどうぃんぐ']||=[];
 players.confirmedAliases['れっどうぃんぐ'].push(alt);
 owners.set(alt,'れっどうぃんぐ');newAlias=true;
}
check(owners.get(alt)==='れっどうぃんぐ','redwing original account is assigned to another player');
check(names.has('ちからV2')&&owners.get('ちからv2')==='ちからV2',
 'preserve exact V2 canonical name and existing lower-v alias');
check(names.has('p1ng')&&names.has('RGN p1ng')&&owners.get('p1ng')==='p1ng',
 'do not merge p1ng with RGN p1ng');
for(const name of ['ゆったり','りんたろう','p1ng','れっどうぃんぐ','プロGON','Asuka','ちからV2',uniqueNew])
 check(names.has(name),'missing canonical member '+name);
const calendar=new Map();
for(const period of ['2024-09','2025-05']){
 const source=read('calendar-history/'+period+'.json');
 check(Array.isArray(source.sessions),'missing calendar '+period);
 for(const s of source.sessions)calendar.set(s.sourceWindowId,s);
}
check(V.TARGETS.reduce((n,t)=>n+t.prize,0)===2400,
 'screenshot expected total is $2,400');
check(V.TARGETS.filter(t=>t.prize===0).length===1,
 'only NAW PlayStation rank64 should have zero cash');
let added=[],present=[];
for(const t of V.TARGETS){
 const size=t.seasonId==='S27'?2:1;
 check(t.profiles.length===size&&t.players.length===size&&
  new Set(t.players).size===size,'incorrect solo/duos roster '+t.id);
 check(Number.isInteger(t.points)&&t.points>=0&&t.matches>=1&&t.matches<=6&&
  t.kills>=0&&t.vrs>=0&&t.vrs<=t.matches,'impossible score '+t.id);
 check(V.payout(t)===t.prize&&t.prize===t.prizePerPlayer*size,
  'prize contradicts OG VR or PlayStation placement policy '+t.id);
 if(t.seasonId==='S27'){
  check(t.rule===V.RULES.OG&&t.matches===3&&t.vrs===1&&t.points===100&&
    t.eventId==='S27_DuosZBVictoryCashCup','invalid OG victory cash result '+t.id);
 }else{
  check(t.vrs===0,'PlayStation placing awards must not be inferred from a VR');
  check(t.rule===(t.seasonId==='S34'?V.RULES.PS2025:V.RULES.SYPHER),
    'wrong PlayStation prize rule '+t.id);
 }
 const cat=tournaments.catalog.find(x=>x.id===t.tournamentId);
 check(cat&&cat.name===t.event&&cat.seasonId===t.seasonId&&cat.chapter===t.chapter&&
 cat.season===t.season&&cat.team===(size===2?'duo':'solo')&&
 cat.sourceEventIds.includes(t.eventId)&&
 cat.mode===(size===2?'zero-build':'battle-royale'),
 'wrong official tournament or category '+t.id);
 if(t.seasonId!=='S27'){
  const session=calendar.get(t.windowId);
  check(session&&session.dateJst===t.date&&session.region===t.region&&
    session.eventId===t.eventId,
   'calendar/official final window mismatch '+t.id);
 }else{
  check(t.region==='NAC'&&
   ((t.date==='2023-12-01'&&t.windowId==='S27_DuosZBVictoryCashCup_Event2Round2_NAC')||
    (t.date==='2023-11-28'&&t.windowId==='S27_DuosZBVictoryCashCup_Event5Round2_NAC')),
   'OG 2023 final window differs from user screenshots '+t.id);
 }
 check(t.sourceTracker==='https://fortnitetracker.com/events/epicgames_'+
 t.eventId+'_'+t.region+'?window='+t.windowId,'wrong Tracker event URL '+t.id);
 for(const [i,p] of t.profiles.entries()){
  check(p.name===t.players[i]&&owners.get(p.name)===p.name&&
   V.uuid(p.url)===p.id,'original Epic account does not belong to player '+t.id);
  check(owners.get(p.raw)===p.name||p.raw===p.name,
   'Tracker raw name not the approved profile owner: '+t.id+' '+p.raw);
  for(const old of results)for(const oldProfile of old.profiles||[])
   if(V.uuid(oldProfile.url)===p.id)
    check(owners.get(oldProfile.name)===p.name||oldProfile.name===p.name,
     'another player already owns the supplied Epic UUID for '+p.name);
 }
 const prior=ledger.entries.filter(x=>x.recordId===t.id),existing=byId.get(t.id);
 if(existing){
  check(prior.length===1&&V.verifyRow(existing,prior[0]),
   'previously published proof/approval row was modified '+t.id);
  present.push(t.id);continue;
 }
 check(prior.length===0,'orphan approval history row '+t.id);
 const duplicates=results.filter(r=>r.seasonId===t.seasonId&&
  r.date===t.date&&r.region===t.region&&r.tournamentId===t.tournamentId&&
  (r.rank===t.rank||(Array.isArray(r.players)&&
   JSON.stringify([...r.players].sort())===JSON.stringify([...t.players].sort()))));
 check(!duplicates.length,'existing team/rank in this same event: '+t.id+' '+duplicates.map(x=>x.id));
 const note='2026/11/14ユーザー提供Fortnite Tracker画像 '+t.screenshot+' と元のEpic IDを照合。'+
 t.date+' '+t.region+' '+t.event+' '+t.round+'、'+t.rank+'位、'+t.points+
 'pt、'+t.matches+'試合、'+t.kills+'チームキル、'+t.vrs+'VR、チーム賞金$'+t.prize+
 '・各選手$'+t.prizePerPlayer+'。公式賞金条件と照合。現金の入金自体は未確認。Tracker: '+
 t.sourceTracker+' Rule: '+t.rule;
 const row={id:t.id,date:t.date,region:t.region,event:t.event,round:t.round,
  kind:t.prize>0?'賞金決勝':'決勝',
  player:t.players.join(' / '),playerRaw:t.playerRaw,players:[...t.players],
  profiles:t.profiles.map(p=>({name:p.name,url:p.url})),
  teamAccountIds:t.profiles.map(p=>p.id.replace(/-/g,'')),
  rank:t.rank,points:t.points,matches:t.matches,kills:t.kills,vrs:t.vrs,
  prize:t.prize,teamPrize:t.prize,prizePerPlayer:t.prizePerPlayer,
  source:t.sourceTracker,verified:true,
  seasonId:t.seasonId,chapter:t.chapter,season:t.season,tournamentId:t.tournamentId,note};
 const entry={id:t.id,recordId:t.id,decision:'published',policy:V.POLICY,
  approvedAt:new Date().toISOString(),
  approvedBy:'ChatGPT / screenshot + Epic UUID and official award rule 2026-11-14',
  source:t.sourceTracker,rule:t.rule,
  evidence:'Provided screenshot '+t.screenshot+', '+size+' Epic UUIDs, exact rank, points, VR and prize'};
 check(V.verifyRow(row,entry),'new row disagrees with independent evidence '+t.id);
 results.push(row);ledger.entries.push(entry);added.push(row);
}
const expectedAdded=added.reduce((sum,r)=>sum+Math.round(r.prize*100),0);
check(results.length===originalCount+added.length&&
 new Set(results.map(x=>x.id)).size===results.length,
 'previous results were lost or duplicated');
check(cash(results)===originalCash+expectedAdded&&
 alloc(results)===originalAllocation+expectedAdded,
 'team / individual prize totals changed beyond newly verified payouts');
if(added.length){
 check(!updates.entries.some(x=>x.id===doc.batch.id),'update ledger already exists');
 updates.entries.unshift({id:doc.batch.id,date:'2026-11-14',type:'records',
  title:'NAC 2023 ZB Duos2組・NAW 2025 PS Cup3件・ME 2024 SypherPK5件を追加',
  description:'ユーザー提供画像10枚の10戦績（9賞金・1賞金0）を照合。2023/11/28・12/1 NAC ZB Duos各1VR、2025/5/1 NAW PlayStation Cup2名各$500と64位れっどうぃんぐ$0、2024/9/2 ME PlayStation SypherPK Cup5名各$200。個人配分賞金合計$2,400、既存記録と選手を保持。ちからv2はちからV2に統一、ptt れっどにゃんぐはれっどうぃんぐの別名義。新規選手は永瀬さらLOVEじょーじ396。入金自体は未確認。',
  recordIds:added.map(x=>x.id)});
}
const validate=validateData({results,players,tournaments});
check(!validate.errors.length,'data check failed '+JSON.stringify(validate.errors.slice(0,5)));
const approvals=audit(results,ledger,players);
check(!approvals.length,'approval audit failed '+JSON.stringify(approvals.slice(0,5)));
const hist=validateUpdateLog(results,updates);
check(!hist.length,'update log failed '+JSON.stringify(hist.slice(0,5)));
if(!dry&&(added.length||newPlayer||newAlias)){
 if(added.length)publishResults(ROOT,results);
 write('players.json',players);
 write('approval-history.json',ledger);
 write('updates.json',updates);
}
console.log('S27_S34_S31_PS_ZB_TEN '+JSON.stringify({
 mode:dry?'dry-run':'apply',newRows:added.length,already:present.length,
 cashAdded:expectedAdded/100,afterCount:results.length,newPlayer,newAlias,
 rows:added.map(x=>({id:x.id,player:x.player,rank:x.rank,prize:x.prize}))
}));
