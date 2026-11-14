'use strict';
// Idempotently publish only screenshot-confirmed S25 ME June 19/26 ZB Duos Victory Cash Cup teams.
// Source-results manifest and linked award ledger must always validate together.
const fs=require('node:fs'),path=require('node:path');
const {readResults,publishResults}=require('./source-results-store.cjs');
const {validateData,personalCents,roster}=require('./data-checks.cjs');
const {audit}=require('./validate-approvals.cjs');
const {validateUpdateLog}=require('./validate-updates.cjs');
const {upsertPublicationLog}=require('./reviewed-publication-core.cjs');
const V=require('./verified-s25-me-zb-duos-2023.cjs');
const ROOT=path.resolve(__dirname,'..');
const read=name=>JSON.parse(fs.readFileSync(path.join(ROOT,name),'utf8'));
const write=(name,data)=>fs.writeFileSync(path.join(ROOT,name),JSON.stringify(data,null,2)+'\n');
const assert=(condition,msg)=>{if(!condition)throw Error('S25_ME_ZB_DUOS_2023: '+msg)};
const args=process.argv.slice(2),dry=args.includes('--dry-run');
assert(args.length===0||(args.length===1&&dry),'only --dry-run or no args allowed');
const doc=read('data/manual-approvals/20230619-26-me-zb-duos-vcup-proof.json'),b=doc.batch;
assert(doc.version===1&&b?.id==='tracker-2023-me-zb-duos-vcup-20230619-26'&&
 b.region==='ME'&&b.seasonId===V.SEASON&&b.chapter===4&&b.season===3&&
 b.rule===V.RULE&&Array.isArray(b.teams)&&b.teams.length===10,
 'evidence document, official rules, roster count or season changed');
const results=readResults(ROOT).rows;
const players=read('players.json'),tournaments=read('tournaments.json');
const ledger=read('approval-history.json'),updates=read('updates.json');
assert(Array.isArray(players.candidates)&&players.confirmedAliases&&
 Array.isArray(ledger.entries),'invalid existing player/approval data');
const cat=tournaments.catalog.find(t=>t.id===V.TOURNAMENT);
assert(cat&&cat.name==='Zero Build Duos Victory Cup'&&cat.seasonId===V.SEASON&&
 cat.chapter===4&&cat.season===3&&cat.mode==='zero-build'&&cat.team==='duo'&&
 Array.isArray(cat.sourceEventIds)&&cat.sourceEventIds.length===1&&
 cat.sourceEventIds[0]===V.EVENT,'missing or incorrect S25 tournament definition');
const known=new Set(players.candidates.map(x=>x.name));
const aliasOwners=new Map([...known].map(x=>[x,x]));
for(const [canonical,aliases] of Object.entries(players.confirmedAliases)){
 assert(known.has(canonical)&&Array.isArray(aliases),'invalid alias owner '+canonical);
 for(const alias of aliases){
  assert(!aliasOwners.has(alias)||aliasOwners.get(alias)===canonical,
   'conflicting known alias '+alias);
  aliasOwners.set(alias,canonical);
 }
}
const existingUuid=new Map();
// Fail closed on Epic IDs used by this batch; legacy unrelated UUID conflicts
// should not block registration of independently verified June 2023 players.
const targetUuids=new Set(V.TARGETS.flatMap(t=>t.ids));
for(const r of results){
 const profiles=Array.isArray(r.profiles)?r.profiles:
  r.profileUrl?[{name:r.player,url:r.profileUrl}]:[];
 for(const p of profiles){
  const uid=V.uuid(p.url);
  if(!uid||!targetUuids.has(uid))continue;
  const owner=aliasOwners.get(p.name)||p.name;
  assert(!existingUuid.has(uid)||existingUuid.get(uid)===owner,
   'existing Epic UUID belongs to conflicting owners: '+uid);
  existingUuid.set(uid,owner);
 }
}
const old={count:results.length,
 team:results.reduce((n,r)=>n+Math.round((r.prize||0)*100),0),
 personal:results.reduce((n,r)=>n+personalCents(r)*roster(r).length,0)};
const allowedNew=new Set([
 'Daddy','LODSTK','mаkise','Yuna','すしくん.','Mainly','Reim',
 'ぺぽ','ぱやぱやの和田もひ','うのすけ'
]);
const added=[],alreadyPresent=[],newPlayers=[],newAliases=[],seen=new Set();
for(const item of b.teams){
 const t=V.TARGETS.find(x=>x.date===item.date&&
  x.eventNumber===item.eventNumber&&x.rank===item.rank);
 assert(t&&!seen.has(t.id)&&item.round===2&&item.windowId===V.WINDOW(t)&&
  item.points===t.points&&item.kills===t.kills&&item.vrs===t.vrs&&
  item.matches===t.matches&&item.teamPrize===t.prize&&
  item.points===100*item.vrs&&item.teamPrize===200*item.vrs&&
  item.matches>=item.vrs&&item.matches<=3&&
  Array.isArray(item.members)&&item.members.length===2&&
  item.members.map(p=>p.name).join(' / ')===t.player&&
  [1,2].includes(item.eventNumber)&&
  item.date===(item.eventNumber===1?'2023-06-19':'2023-06-26'),
  'image score, event/date, payout or roster mismatch at '+item.rank);
 seen.add(t.id);
 const names=[],profiles=[];
 for(let i=0;i<2;i++){
  const p=item.members[i],uid=V.uuid(p.url);
  assert(typeof p.name==='string'&&p.name===p.name.trim()&&p.name&&
   typeof p.raw==='string'&&p.raw===p.raw.trim()&&p.raw&&
   uid===t.ids[i]&&
   (!aliasOwners.has(p.name)||aliasOwners.get(p.name)===p.name)&&
   (!existingUuid.has(uid)||existingUuid.get(uid)===p.name),
   'Epic UUID, player identity or alias conflict: '+p.name);
  if(!known.has(p.name)){
   assert(allowedNew.has(p.name),'unapproved new player '+p.name);
   players.candidates.push({name:p.name,
    initials:Array.from(p.name).slice(0,2).join(''),
    accent:players.candidates.length%2?'cyan':'violet',
    desc:'2023年6月ME Zero Build Duos Victory Cup決勝で現金賞金を獲得。ユーザー提供スクリーンショットと本人Epic UUIDで確認。'});
   known.add(p.name);aliasOwners.set(p.name,p.name);newPlayers.push(p.name);
  }
  existingUuid.set(uid,p.name);
  if(p.raw!==p.name&&aliasOwners.get(p.raw)!==p.name){
   assert(!aliasOwners.has(p.raw),'raw display name belongs to another player '+p.raw);
   if(!players.confirmedAliases[p.name])players.confirmedAliases[p.name]=[];
   players.confirmedAliases[p.name].push(p.raw);
   aliasOwners.set(p.raw,p.name);newAliases.push({canonical:p.name,raw:p.raw});
  }
  names.push(p.name);profiles.push({name:p.name,url:p.url});
 }
 const collisions=results.filter(r=>r.date===t.date&&r.region==='ME'&&
   r.tournamentId===V.TOURNAMENT&&
   (r.id===t.id||r.rank===t.rank||
    (Array.isArray(r.players)&&
      JSON.stringify([...r.players].sort())===JSON.stringify([...names].sort()))));
 assert(collisions.length<=1,'multiple existing candidate duplicates: '+t.id);
 if(collisions.length){
  const row=collisions[0],entry=ledger.entries.find(e=>e.recordId===row.id);
  assert(row.id===t.id&&ledger.entries.filter(e=>e.recordId===row.id).length===1&&
   V.verifyCashRow(row,entry),'existing record does not match screenshots: '+t.id);
  alreadyPresent.push(t.id);continue;
 }
 assert(!results.some(r=>r.id===t.id),'record ID already exists in another round '+t.id);
 const note='ユーザー提供2023年6月ME Zero Build Duos Victory Cup決勝画像'+item.screenshot+
  '・両選手のEpic UUIDにより確認。Event '+t.eventNumber+' Round2、'+
  t.rank+'位・'+t.points+'pt・'+t.kills+'チームキル・'+t.matches+
  '試合・'+t.vrs+'VR。Chapter 4 Season 3公式規則により1VRにつき各選手$100'+
  '、合計チーム賞金$'+t.prize+'。実際の支払い完了は未確認。'+
  ' Tracker: '+V.TRACKER(t)+' Rule: '+V.RULE;
 const row={id:t.id,date:t.date,region:'ME',player:t.player,players:names,
  playerRaw:item.members.map(p=>p.raw).join(' / '),
  event:cat.name,round:V.ROUND(t),rank:t.rank,points:t.points,kills:t.kills,
  vrs:t.vrs,matches:t.matches,prize:t.prize,teamPrize:t.prize,
  prizePerPlayer:t.vrs*100,kind:'賞金決勝',seasonId:'S25',
  chapter:4,season:3,tournamentId:V.TOURNAMENT,source:V.TRACKER(t),
  profiles,verified:true,note};
 const entry={id:t.id,recordId:t.id,decision:'published',policy:V.POLICY,
  approvedAt:new Date().toISOString(),
  approvedBy:'ChatGPT / user-authorized screenshot-backed GitHub publication',
  source:V.TRACKER(t),rule:V.RULE,
  evidence:'User Tracker screenshot '+item.screenshot+' original event/date/rank/score/VR/matches and both Epic UUIDs'};
 assert(V.verifyCashRow(row,entry),'generated entry failed fixed rule/identity proof: '+t.id);
 results.push(row);ledger.entries.push(entry);added.push(row);
}
assert(seen.size===10&&V.TARGETS.every(t=>seen.has(t.id)),
 'missing one of the 10 submitted screenshot targets');
const addedCents=added.reduce((n,r)=>n+r.prize*100,0);
assert(results.length===old.count+added.length&&
 results.reduce((n,r)=>n+Math.round((r.prize||0)*100),0)===old.team+addedCents&&
 results.reduce((n,r)=>n+personalCents(r)*roster(r).length,0)===old.personal+addedCents,
 'existing records or cash totals changed unexpectedly');
if(added.length)upsertPublicationLog(updates,{
 id:b.id,date:'2026-11-14',
 title:'2023年6月19日・26日ME ZB Duos Victory Cup：賞金10組を登録',
 description:'6/19 Event1決勝5組（LODSTK/RiaMは2VR各$200）、6/26 Event2決勝5組。スクショ・Epic UUIDと公式1VR=各$100を照合。チーム賞金計$2,200。既存データ保持。',
 recordIds:added.map(x=>x.id)
});
const validation=validateData({results,players,tournaments});
assert(!validation.errors.length,'data validation failed '+JSON.stringify(validation.errors.slice(0,5)));
const approvals=audit(results,ledger,players);
assert(!approvals.length,'approval history mismatch '+JSON.stringify(approvals.slice(0,5)));
const logs=validateUpdateLog(results,updates);
assert(!logs.length,'update log mismatch '+JSON.stringify(logs.slice(0,5)));
if(!dry&&added.length){
 publishResults(ROOT,results);
 write('players.json',players);write('approval-history.json',ledger);write('updates.json',updates);
}
console.log('S25_ME_ZB_DUOS_2023 '+JSON.stringify({
 mode:dry?'dry-run':'apply',registered:added.length,
 alreadyPresent:alreadyPresent.length,newPlayers,newAliases,
 newTotal:results.length,addedTeamPrize:addedCents/100,
 addedPersonalPrize:addedCents/100,
 records:added.map(r=>({date:r.date,rank:r.rank,roster:r.player,vrs:r.vrs,teamPrize:r.prize}))
}));
