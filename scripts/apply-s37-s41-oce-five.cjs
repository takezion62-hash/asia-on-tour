'use strict';
// Apply five screenshot-verified S37/S41 OCE console awards without replacing existing results.
// Idempotent, append only; exact Epic IDs, tournament windows, individual splits and dollar totals.
const fs=require('node:fs'),path=require('node:path');
const {readResults,publishResults}=require('./source-results-store.cjs');
const {validateData,personalCents,roster}=require('./data-checks.cjs');
const {audit}=require('./validate-approvals.cjs');
const {validateUpdateLog}=require('./validate-updates.cjs');
const {upsertPublicationLog}=require('./reviewed-publication-core.cjs');
const V=require('./verified-s37-s41-oce-five.cjs');
const ROOT=path.resolve(__dirname,'..');
const read=n=>JSON.parse(fs.readFileSync(path.join(ROOT,n),'utf8'));
const write=(n,o)=>fs.writeFileSync(path.join(ROOT,n),JSON.stringify(o,null,2)+'\n');
const must=(ok,msg)=>{if(!ok)throw Error('S37_S41_OCE_FIVE: '+msg)};
const args=process.argv.slice(2),dry=args.includes('--dry-run');
must(args.length===0||(args.length===1&&dry),'only --dry-run or no args');
const doc=read('data/manual-approvals/20261114-s37-s41-oce-five-proof.json');
must(doc.version===1&&doc.batch?.id==='tracker-20261114-s37-s41-oce-five'&&
 Array.isArray(doc.batch.entries)&&doc.batch.entries.length===5,'missing locked screenshot batch');
const results=readResults(ROOT).rows;
const players=read('players.json'),tournaments=read('tournaments.json');
const ledger=read('approval-history.json'),updates=read('updates.json');
must(Array.isArray(players.candidates)&&players.confirmedAliases&&Array.isArray(ledger.entries),
 'malformed players/ledger');
const known=new Set(players.candidates.map(x=>x.name));
const aliases=new Map([...known].map(n=>[n,n]));
for(const [owner,names] of Object.entries(players.confirmedAliases)){
 must(known.has(owner)&&Array.isArray(names),'invalid confirmed alias owner: '+owner);
 for(const name of names){
  must(!aliases.has(name)||aliases.get(name)===owner,'ambiguous previously confirmed alias '+name);
  aliases.set(name,owner);
 }
}
const relevantIds=new Set(V.TARGETS.flatMap(t=>t.uuids)),existingUUIDs=new Map();
for(const r of results){
 const profiles=Array.isArray(r.profiles)?r.profiles:
   r.profileUrl?[{name:r.player,url:r.profileUrl}]:[];
 for(const p of profiles){
  const id=V.uuid(p.url);if(!id||!relevantIds.has(id))continue;
  const owner=aliases.get(p.name)||p.name;
  must(!existingUUIDs.has(id)||existingUUIDs.get(id)===owner,
   'existing Epic UUID has conflicting canonical players '+id);
  existingUUIDs.set(id,owner);
 }
}
const totalCash=rows=>rows.reduce((n,r)=>n+Math.round((r.prize||0)*100),0);
const personalCash=rows=>rows.reduce((n,r)=>n+personalCents(r)*roster(r).length,0);
const old={count:results.length,total:totalCash(results),personal:personalCash(results)};
const entries=doc.batch.entries,seen=new Set(),added=[],alreadyPresent=[],newPlayers=[],newAliases=[];
for(const item of entries){
 const t=V.TARGETS.find(t=>t.date===item.date&&t.region===item.region&&
  t.seasonId===item.seasonId&&t.rank===item.rank&&t.tournamentId===item.tournamentId);
 must(t&&!seen.has(t.id),'unexpected or duplicate screenshot item');
 seen.add(t.id);
 must(item.chapter===t.chapter&&item.season===t.season&&item.event===t.event&&
  item.round===t.round&&item.source===t.source&&item.rule===t.rule&&
  item.points===t.points&&item.matches===t.matches&&item.kills===t.kills&&
  item.vrs===t.vrs&&item.prize===t.prize&&V.price(t)===item.prize&&
  item.players.join(' / ')===t.player&&item.raw.join(' / ')===t.raw&&
  Array.isArray(item.profiles)&&item.profiles.length===t.players.length&&
  item.profiles.every((p,i)=>p.name===t.players[i]&&V.uuid(p.url)===t.uuids[i]),
  'screen score / player identity / official award changed: '+t.id);
 const cat=tournaments.catalog.find(x=>x.id===t.tournamentId);
 must(cat&&cat.seasonId===t.seasonId&&cat.chapter===t.chapter&&cat.season===t.season&&
  cat.name===t.event&&cat.team===(t.players.length===1?'solo':'duo')&&
  cat.mode===(t.seasonId==='S37'?'battle-royale':'zero-build')&&
  cat.sourceEventIds.some(id=>t.source.includes('epicgames_'+id+'_')),
  'missing or mismatched official tournament definition: '+t.id);
 for(let i=0;i<t.players.length;i++){
  const name=t.players[i],raw=item.raw[i],uuid=t.uuids[i];
  must(!aliases.has(name)||aliases.get(name)===name,
   'canonical roster player already belongs to a different identity '+name);
  must(!existingUUIDs.has(uuid)||existingUUIDs.get(uuid)===name,
   'source UUID is owned by different profile '+name+': '+uuid);
  if(!known.has(name)){
   must(false,'unverified new profile: '+name);
   players.candidates.push({
    name,initials:'おら',accent:'cyan',
    desc:'2025年12月21日 NAC $1 Million Unreal Cup決勝で、すかいと109位・27チームキル・賞金各$100を獲得。Tracker名「みかんわおらんげ」。Epic IDで本人確認済み。'
   });
   known.add(name);aliases.set(name,name);newPlayers.push(name);
  }
  if(raw!==name&&aliases.get(raw)!==name){
   must(!aliases.has(raw),'raw Tracker name belongs to another player: '+raw);
   if(!Array.isArray(players.confirmedAliases[name]))players.confirmedAliases[name]=[];
   players.confirmedAliases[name].push(raw);
   aliases.set(raw,name);newAliases.push({name,raw});
  }
  existingUUIDs.set(uuid,name);
 }
 const collisions=results.filter(r=>r.seasonId===t.seasonId&&r.date===t.date&&
   r.region===t.region&&r.tournamentId===t.tournamentId&&
   (r.id===t.id||r.rank===t.rank||
    (Array.isArray(r.players)&&
     JSON.stringify([...r.players].sort())===JSON.stringify([...t.players].sort()))||
    (t.players.length===1&&r.player===t.player)));
 must(collisions.length<=1,'duplicate matches for same tournament: '+t.id);
 if(collisions.length){
  const row=collisions[0],matches=ledger.entries.filter(e=>e.recordId===row.id);
  must(row.id===t.id&&matches.length===1&&V.verifyCashRow(row,matches[0]),
   'conflicting existing cash award at '+t.id);
  alreadyPresent.push(t.id);continue;
 }
 must(!results.some(r=>r.id===t.id),'ID collision outside event: '+t.id);
 const profiles=item.profiles.map(p=>({name:p.name,url:p.url}));
 const note='ユーザー提供Tracker画像'+item.screenshot+'で本人Epic IDと当該大会の決勝順位を確認。'+
  t.date+' '+t.region+' '+t.event+' '+t.round+' '+t.rank+'位、'+
  t.points+'pt、'+t.matches+'試合、'+t.kills+(t.players.length===2?'チーム':'')+
  'キル、'+t.vrs+'VR。公式規則より'+(t.players.length===2?'チーム':'個人')+
  '賞金$'+t.prize+'（'+(t.players.length===2?'各選手$'+t.prize/2:'個人$'+t.prize)+
  '）。支払完了は未確認。 Tracker: '+t.source+' Rule: '+t.rule;
 const row={id:t.id,date:t.date,region:t.region,player:t.player,
  players:[...t.players],playerRaw:t.raw,event:t.event,round:t.round,rank:t.rank,
  points:t.points,matches:t.matches,kills:t.kills,vrs:t.vrs,prize:t.prize,
  teamPrize:t.prize,prizePerPlayer:t.prize/t.players.length,kind:'賞金決勝',
  seasonId:t.seasonId,chapter:t.chapter,season:t.season,tournamentId:t.tournamentId,
  source:t.source,profiles,verified:true,note};
 if(t.players.length===1)row.profileUrl=profiles[0].url;
 const entry={id:t.id,recordId:t.id,decision:'published',policy:V.POLICY,
  approvedAt:new Date().toISOString(),
  approvedBy:'ChatGPT / user-provided Fortnite Tracker evidence',
  source:t.source,rule:t.rule,
  evidence:'Five submitted screenshots, verified Epic account IDs, official award payout'};
 must(V.verifyCashRow(row,entry),'generated entry failed fixed payout and identity check '+t.id);
 results.push(row);ledger.entries.push(entry);added.push(row);
}
must(seen.size===5&&V.TARGETS.every(x=>seen.has(x.id)),'missing one of five proofs');
const amount=added.reduce((s,r)=>s+r.prize*100,0);
must(results.length===old.count+added.length&&
 totalCash(results)===old.total+amount&&personalCash(results)===old.personal+amount,
 'existing prize, personal split or row count changed');
if(added.length)upsertPublicationLog(updates,{
 id:doc.batch.id,date:'2026-11-14',
 title:'2025 OCE Console Duos / 2026 OCE Console ZB Solo：5戦績',
 description:'ユーザーのTracker画像5枚、Epic UUID、1VR賞金・既存のすかい名義を厳格照合。S37 1件、S41 4件。賞金+$600。',
 recordIds:added.map(x=>x.id)
});
const report=validateData({results,players,tournaments});
must(!report.errors.length,'data verification failed: '+JSON.stringify(report.errors.slice(0,5)));
const appr=audit(results,ledger,players);
must(!appr.length,'approval audit failed: '+JSON.stringify(appr.slice(0,5)));
const logErrors=validateUpdateLog(results,updates);
must(!logErrors.length,'update history failed: '+JSON.stringify(logErrors.slice(0,5)));
if(!dry&&added.length){
 publishResults(ROOT,results);write('players.json',players);
 write('approval-history.json',ledger);write('updates.json',updates);
}
console.log('S37_S41_OCE_FIVE '+JSON.stringify({
 mode:dry?'dry-run':'apply',registered:added.length,
 alreadyPresent:alreadyPresent.length,newPlayers,newAliases,
 newCount:results.length,teamCashAdded:amount/100,personalCashAdded:amount/100,
 rows:added.map(x=>({id:x.id,player:x.player,rank:x.rank,prize:x.prize}))
}));
