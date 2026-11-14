'use strict';
// Idempotent source-results publication for 10 user-screenshot-verified legacy
// PlayStation cash finals and June 2023 ME ZB Duos cash results.
const fs=require('node:fs'),path=require('node:path');
const {readResults,publishResults}=require('./source-results-store.cjs');
const {validateData,personalCents,roster}=require('./data-checks.cjs');
const {audit}=require('./validate-approvals.cjs');
const {validateUpdateLog}=require('./validate-updates.cjs');
const {upsertPublicationLog}=require('./reviewed-publication-core.cjs');
const V=require('./verified-ps-cups-2022-2024-nov14.cjs');
const ROOT=path.resolve(__dirname,'..');
const read=name=>JSON.parse(fs.readFileSync(path.join(ROOT,name),'utf8'));
const write=(name,data)=>fs.writeFileSync(path.join(ROOT,name),JSON.stringify(data,null,2)+'\n');
const ensure=(condition,msg)=>{if(!condition)throw Error('PS_S22_S25_S31_20261114: '+msg)};
const args=process.argv.slice(2),dry=args.includes('--dry-run');
ensure(args.length===0||(args.length===1&&dry),'--dry-run or no arguments');
const doc=read('data/manual-approvals/20261114-s22-s25-s31-ps-zb-10-proof.json');
ensure(doc.version===1&&doc.batch?.id==='screenshots-20261114-s22-s25-s31-ps-zb-10'&&
 Array.isArray(doc.batch.entries)&&doc.batch.entries.length===10,
 'evidence document not the fixed ten-entry screenshot batch');
const results=readResults(ROOT).rows;
const players=read('players.json'),tournaments=read('tournaments.json');
const ledger=read('approval-history.json'),updates=read('updates.json');
ensure(Array.isArray(players.candidates)&&players.confirmedAliases&&Array.isArray(ledger.entries),
 'existing player or approval data malformed');
const known=new Set(players.candidates.map(p=>p.name));
const aliases=new Map([...known].map(p=>[p,p]));
for(const [owner,names] of Object.entries(players.confirmedAliases)){
 ensure(known.has(owner)&&Array.isArray(names),'invalid alias owner '+owner);
 for(const name of names){
  ensure(!aliases.has(name)||aliases.get(name)===owner,'conflicting known alias '+name);
  aliases.set(name,owner);
 }
}
const targetUuids=new Set(V.TARGETS.flatMap(t=>t.uuids));
const existingUuid=new Map();
for(const r of results){
 const ps=Array.isArray(r.profiles)?r.profiles:r.profileUrl?[{name:r.player,url:r.profileUrl}]:[];
 for(const p of ps){
  const id=V.uuid(p.url);
  if(!id||!targetUuids.has(id))continue;
  const owner=aliases.get(p.name)||p.name;
  ensure(!existingUuid.has(id)||existingUuid.get(id)===owner,
   'target Epic UUID has conflicting existing owner: '+id);
  existingUuid.set(id,owner);
 }
}
const cash=rows=>rows.reduce((n,r)=>n+Math.round((r.prize||0)*100),0);
const personal=rows=>rows.reduce((n,r)=>n+personalCents(r)*roster(r).length,0);
const old={count:results.length,team:cash(results),personal:personal(results)};
const allowedNew=new Set(['えるy7','clxer','ちゃービィ','goma']);
const seen=new Set(),added=[],alreadyPresent=[],newPlayers=[];
for(const item of doc.batch.entries){
 const t=V.TARGETS.find(x=>x.seasonId===item.seasonId&&x.date===item.date&&
  x.region===item.region&&x.rank===item.rank&&x.tournamentId===item.tournamentId);
 ensure(t&&!seen.has(t.id),'unexpected/duplicate screenshot rank or tournament');
 seen.add(t.id);
 ensure(item.chapter===t.chapter&&item.season===t.season&&
  item.round===t.round&&item.event===t.event&&item.source===t.source&&
  item.rule===t.rule&&item.points===t.points&&item.matches===t.matches&&
  item.kills===t.kills&&item.vrs===t.vrs&&item.prize===t.prize&&
  V.expectedPrice(t)===item.prize&&
  Array.isArray(item.profiles)&&item.profiles.length===t.uuids.length&&
  item.profiles.every((p,i)=>p.name===t.profileNames[i]&&V.uuid(p.url)===t.uuids[i]),
  'screenshot score/identity/prize tier differs from locked approval '+t.id);
 const dual=Array.isArray(t.players);
 ensure((dual&&Array.isArray(item.team)&&item.team.join(' / ')===t.player)||
  (!dual&&item.player===t.player&&(!item.team||item.team.length===0)),
  'team roster differs from screenshot '+t.id);
 const cat=tournaments.catalog.find(x=>x.id===t.tournamentId);
 ensure(cat&&cat.seasonId===t.seasonId&&cat.name===t.event&&
  cat.chapter===t.chapter&&cat.season===t.season&&
  cat.mode===(dual?'zero-build':'battle-royale')&&cat.team===(dual?'duo':'solo')&&
  cat.sourceEventIds.some(eventId=>t.source.includes('epicgames_'+eventId+'_')),
  'missing or inconsistent tournament catalog '+t.id);
 for(let i=0;i<t.uuids.length;i++){
  const name=t.profileNames[i],id=t.uuids[i];
  ensure(!aliases.has(name)||aliases.get(name)===name,'player is a conflicting name alias '+name);
  ensure(!existingUuid.has(id)||existingUuid.get(id)===name,
   'Epic ID has an existing unrelated player name '+name+': '+id);
  if(!known.has(name)){
   ensure(allowedNew.has(name),'new unreviewed identity '+name);
   players.candidates.push({name,initials:Array.from(name).slice(0,2).join(''),
    accent:players.candidates.length%2?'cyan':'violet',
    desc:'2022年OCE PlayStation Cup決勝の賞金獲得者。Tracker順位画像・公式賞金規則・Epic IDで確認。'});
   known.add(name);aliases.set(name,name);newPlayers.push(name);
  }
  existingUuid.set(id,name);
 }
 const collisions=results.filter(r=>r.date===t.date&&r.region===t.region&&
  r.tournamentId===t.tournamentId&&(
   r.id===t.id||r.rank===t.rank||
   (dual&&Array.isArray(r.players)&&
    JSON.stringify([...r.players].sort())===JSON.stringify([...t.players].sort()))||
   (!dual&&r.player===t.player)));
 ensure(collisions.length<=1,'multiple result collisions '+t.id);
 if(collisions.length){
  const prior=collisions[0],log=ledger.entries.filter(e=>e.recordId===prior.id);
  ensure(prior.id===t.id&&log.length===1&&V.verifyCashRow(prior,log[0]),
   'existing record has conflicting screenshot score or ledger: '+t.id);
  alreadyPresent.push(t.id);continue;
 }
 ensure(!results.some(r=>r.id===t.id),'duplicate result ID in another event '+t.id);
 const names=t.profileNames,profiles=item.profiles.map(p=>({name:p.name,url:p.url}));
 const note='ユーザー提供画像'+item.screenshot+'、Tracker公式開催枠とEpic IDで照合。'+
  t.date+' '+t.region+' '+t.event+'決勝 '+t.rank+'位 / '+t.points+'pt / '+
  t.matches+'試合 / '+t.kills+(dual?'チーム':'')+'キル / '+t.vrs+'VR。'+
  'Epic公式の順位またはVR賞金規則により'+(dual?'チーム':'個人')+'賞金$'+t.prize+
  '。賞金支払完了は未確認。 Tracker: '+t.source+' Rule: '+t.rule;
 const row={id:t.id,date:t.date,region:t.region,player:t.player,
  playerRaw:dual?item.raw.join(' / '):item.raw,
  event:t.event,round:t.round,rank:t.rank,points:t.points,
  matches:t.matches,kills:t.kills,vrs:t.vrs,prize:t.prize,
  kind:'賞金決勝',seasonId:t.seasonId,chapter:t.chapter,season:t.season,
  tournamentId:t.tournamentId,source:t.source,profiles,verified:true,note};
 if(dual){
  row.players=[...names];row.teamPrize=t.prize;row.prizePerPlayer=t.prize/2;
 }else{
  row.profileUrl=profiles[0].url;row.teamPrize=t.prize;row.prizePerPlayer=t.prize;
 }
 const entry={id:t.id,recordId:t.id,decision:'published',policy:V.POLICY,
  approvedAt:new Date().toISOString(),
  approvedBy:'ChatGPT / user-provided Tracker screenshot publication',
  source:t.source,rule:t.rule,
  evidence:'November 14 user screenshot '+item.screenshot+' rank and score, official payout tiers and Epic account ID'};
 ensure(V.verifyCashRow(row,entry),'generated result failed independent proof: '+t.id);
 results.push(row);ledger.entries.push(entry);added.push(row);
}
ensure(seen.size===10&&V.TARGETS.every(x=>seen.has(x.id)), 'missing screenshot result');
const earned=added.reduce((n,r)=>n+r.prize*100,0);
ensure(results.length===old.count+added.length&&cash(results)===old.team+earned&&
 personal(results)===old.personal+earned,
 'existing record or team/personal cash changed unexpectedly');
if(added.length){
 upsertPublicationLog(updates,{
  id:doc.batch.id,date:'2026-11-14',
  title:'2022/9/25 OCE PlayStation Cup・2023/6/19 ME ZB Duos・2024/9/2 NAC SypherPK：10件',
  description:'提供画像10枚、Epic ID、公式賞金規則、既存重複を照合。OCE7件、ME1組、NAC2件。合計$2,350を記録。',
  recordIds:added.map(x=>x.id)
 });
}
const report=validateData({results,players,tournaments});
ensure(!report.errors.length,'data validation failure: '+JSON.stringify(report.errors.slice(0,5)));
const appr=audit(results,ledger,players);
ensure(!appr.length,'approval audit failure: '+JSON.stringify(appr.slice(0,5)));
const logs=validateUpdateLog(results,updates);
ensure(!logs.length,'update validation failure: '+JSON.stringify(logs.slice(0,5)));
if(!dry&&added.length){
 publishResults(ROOT,results);
 write('players.json',players);write('approval-history.json',ledger);write('updates.json',updates);
}
console.log('PS_S22_S25_S31_20261114 '+JSON.stringify({
 mode:dry?'dry-run':'apply',registered:added.length,alreadyPresent:alreadyPresent.length,
 newPlayers,newCount:results.length,addedTeamPrize:earned/100,
 addedPersonalPrize:earned/100,
 rows:added.map(x=>({id:x.id,date:x.date,region:x.region,rank:x.rank,player:x.player,prize:x.prize}))
}));
