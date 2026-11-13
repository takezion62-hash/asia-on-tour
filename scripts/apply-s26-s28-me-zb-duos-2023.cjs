'use strict';
// Publish only the ten 2023 ME Zero Build Duos Victory Cup finals supported
// by user screenshots, exact Tracker Epic IDs and season-specific Epic rules.
const fs=require('node:fs'),path=require('node:path');
const {readResults,publishResults}=require('./source-results-store.cjs');
const {validateData,personalCents,roster}=require('./data-checks.cjs');
const {audit}=require('./validate-approvals.cjs');
const {validateUpdateLog}=require('./validate-updates.cjs');
const {upsertPublicationLog}=require('./reviewed-publication-core.cjs');
const V=require('./verified-s26-s28-me-zb-duos-2023.cjs');
const ROOT=path.resolve(__dirname,'..');
const read=name=>JSON.parse(fs.readFileSync(path.join(ROOT,name),'utf8'));
const write=(name,data)=>fs.writeFileSync(path.join(ROOT,name),JSON.stringify(data,null,2)+'\n');
const assert=(condition,message)=>{if(!condition)throw Error('ME_ZB_DUOS_VC_2023: '+message)};
const args=process.argv.slice(2),dry=args.includes('--dry-run');
assert(args.length===0||(args.length===1&&dry),'only --dry-run or no args allowed');
const doc=read('data/manual-approvals/20231023-20231216-me-zb-duos-vcup-proof.json'),b=doc.batch;
assert(doc.version===1&&b?.id==='tracker-2023-me-zb-duos-vcup-20231023-20231216'&&
 b.region==='ME'&&Array.isArray(b.teams)&&b.teams.length===10&&
 Object.keys(b.rules).length===2&&
 Object.entries(V.RULES).every(([s,url])=>b.rules[s]===url),
 'evidence document or official payout rules changed');
const results=readResults(ROOT).rows;
const players=read('players.json'),tournaments=read('tournaments.json');
const ledger=read('approval-history.json'),updates=read('updates.json');
assert(Array.isArray(players.candidates)&&players.confirmedAliases&&
 Array.isArray(ledger.entries),'invalid existing player or approval data');
for(const season of ['S26','S28']){
 const cat=tournaments.catalog.find(t=>t.id===V.TOURNAMENTS[season]);
 assert(cat&&cat.name==='Zero Build Duos Victory Cup'&&
  cat.seasonId===season&&cat.chapter===V.CHAPTERS[season][0]&&
  cat.season===V.CHAPTERS[season][1]&&cat.mode==='zero-build'&&
  cat.team==='duo'&&cat.sourceEventIds?.length===1&&
  cat.sourceEventIds[0]===season+'_DuosZBVictoryCashCup',
  'missing/incorrect season-specific tournament '+season);
}
const known=new Set(players.candidates.map(x=>x.name));
const aliasOwners=new Map([...known].map(x=>[x,x]));
for(const [canonical,aliases] of Object.entries(players.confirmedAliases)){
 assert(known.has(canonical)&&Array.isArray(aliases),'invalid alias owner '+canonical);
 for(const alias of aliases){
  assert(!aliasOwners.has(alias)||aliasOwners.get(alias)===canonical,'conflicting alias '+alias);
  aliasOwners.set(alias,canonical);
 }
}
assert(aliasOwners.get('HOICHQN')==='hoimin'&&
 aliasOwners.get('UC.そみー')==='そみー'&&known.has('Hagane'),
 'prior verified identities not preserved');
const existingUuid=new Map();
for(const r of results)for(const p of r.profiles||[]){
 const uid=V.uuid(p.url);
 if(!uid)continue;
 const owner=aliasOwners.get(p.name)||p.name;
 assert(!existingUuid.has(uid)||existingUuid.get(uid)===owner,
  'same Epic UUID under two existing names '+uid);
 existingUuid.set(uid,owner);
}
const old={count:results.length,
 team:results.reduce((n,r)=>n+Math.round((r.prize||0)*100),0),
 personal:results.reduce((n,r)=>n+personalCents(r)*roster(r).length,0)};
const allowedNew=new Set([
 'gents らにりあハンバーガー','ankoro','みよしゆうき','Clover','seek',
 'Altria natural','Smile','ディンカイサーフパオカミウーラ','匿名362']);
const added=[],alreadyPresent=[],newPlayers=[],newAliases=[],seen=new Set();
for(const item of b.teams){
 const t=V.TARGETS.find(x=>x.seasonId===item.seasonId&&
  x.date===item.date&&x.eventNumber===item.eventNumber&&x.rank===item.rank);
 assert(t&&!seen.has(t.id)&&item.round===2&&item.windowId===V.WINDOW(t)&&
  item.points===t.points&&item.kills===t.kills&&item.vrs===t.vrs&&
  item.matches===t.matches&&item.teamPrize===t.prize&&
  item.points===100&&item.vrs===1&&item.matches>=1&&item.matches<=3&&
  item.teamPrize===200&&Array.isArray(item.members)&&item.members.length===2&&
  item.members.map(m=>m.name).join(' / ')===t.player,
  'score, date, official window, roster or payout disagrees with screenshot '+item.rank);
 seen.add(t.id);
 const names=[],profiles=[];
 for(let i=0;i<2;i++){
  const p=item.members[i],uid=V.uuid(p.url);
  assert(typeof p.name==='string'&&p.name===p.name.trim()&&p.name&&
   typeof p.raw==='string'&&p.raw===p.raw.trim()&&p.raw&&
   uid===t.ids[i]&&
   (!aliasOwners.has(p.name)||aliasOwners.get(p.name)===p.name)&&
   (!existingUuid.has(uid)||existingUuid.get(uid)===p.name),
   'conflicting Epic UUID, player name or alias '+p.name);
  if(!known.has(p.name)){
   assert(allowedNew.has(p.name),'unapproved new player '+p.name);
   players.candidates.push({name:p.name,
    initials:Array.from(p.name).slice(0,2).join(''),accent:players.candidates.length%2?'cyan':'violet',
    desc:'2023年ME Zero Build Duos Victory Cup決勝で1VR・個人賞金$100。スクリーンショットとEpic Tracker IDで確認。'});
   known.add(p.name);aliasOwners.set(p.name,p.name);newPlayers.push(p.name);
  }
  existingUuid.set(uid,p.name);
  if(p.raw!==p.name&&aliasOwners.get(p.raw)!==p.name){
   assert(!aliasOwners.has(p.raw),'raw display name belongs to another person '+p.raw);
   if(!players.confirmedAliases[p.name])players.confirmedAliases[p.name]=[];
   players.confirmedAliases[p.name].push(p.raw);
   aliasOwners.set(p.raw,p.name);newAliases.push({canonical:p.name,raw:p.raw});
  }
  names.push(p.name);profiles.push({name:p.name,url:p.url});
 }
 const matches=results.filter(r=>r.date===t.date&&r.region==='ME'&&
  r.tournamentId===V.TOURNAMENTS[t.seasonId]&&
  (r.id===t.id||r.rank===t.rank||
   (Array.isArray(r.players)&&r.players.slice().sort().join('\\u0000')===
    names.slice().sort().join('\\u0000'))));
 assert(matches.length<=1,'multiple possible duplicate rows for '+t.id);
 if(matches.length){
  const row=matches[0],e=ledger.entries.find(x=>x.recordId===row.id);
  assert(row.id===t.id&&ledger.entries.filter(x=>x.recordId===row.id).length===1&&
   V.verifyCashRow(row,e),'existing row differs from verified screenshot '+t.id);
  alreadyPresent.push(t.id);continue;
 }
 assert(!results.some(r=>r.id===t.id),'record ID already exists elsewhere '+t.id);
 const cat=tournaments.catalog.find(x=>x.id===V.TOURNAMENTS[t.seasonId]);
 const note='ローズ提供Fortnite Tracker決勝結果の画像と両選手のEpic UUIDを照合。'+
  t.date+' JST、ME Zero Build Duos Victory Cup Event'+t.eventNumber+
  ' Round2。'+t.rank+'位・100pt・'+t.kills+'チームキル・'+
  t.matches+'試合・1VR。公式'+t.seasonId+
  'ルールで1VRにつき各選手$100（チーム$200）。実際の支払い完了は未確認。'+
  ' Tracker: '+V.TRACKER(t)+' Epic: '+V.RULES[t.seasonId];
 const row={id:t.id,date:t.date,region:'ME',player:t.player,players:names,
  playerRaw:item.members.map(m=>m.raw).join(' / '),
  event:cat.name,round:V.ROUND(t),rank:t.rank,points:100,kills:t.kills,
  vrs:1,matches:t.matches,prize:200,teamPrize:200,prizePerPlayer:100,
  kind:'賞金決勝',seasonId:t.seasonId,
  chapter:V.CHAPTERS[t.seasonId][0],season:V.CHAPTERS[t.seasonId][1],
  tournamentId:V.TOURNAMENTS[t.seasonId],source:V.TRACKER(t),
  profiles,verified:true,note};
 const e={id:t.id,recordId:t.id,decision:'published',policy:V.POLICY,
  approvedAt:new Date().toISOString(),
  approvedBy:'ChatGPT / user-authorized screenshot-backed GitHub publication',
  source:V.TRACKER(t),rule:V.RULES[t.seasonId],
  evidence:'User-provided Tracker scoreboard screenshot '+item.screenshot+
   ': exact date/Event/Round2, rank, 100pt, 1VR, team eliminations, games, 2 Epic IDs, $100 per player'};
 assert(V.verifyCashRow(row,e),'generated record did not pass fixed award validator '+t.id);
 results.push(row);ledger.entries.push(e);added.push(row);
}
assert(seen.size===V.TARGETS.length&&V.TARGETS.every(t=>seen.has(t.id)),
 'not all 10 provided teams reviewed');
assert(results.length===old.count+added.length&&
 results.reduce((n,r)=>n+Math.round((r.prize||0)*100),0)===old.team+added.length*20000&&
 results.reduce((n,r)=>n+personalCents(r)*roster(r).length,0)===old.personal+added.length*20000,
 'existing totals changed or team/personal prizes diverged');
if(added.length)upsertPublicationLog(updates,{
 id:b.id,date:'2026-11-14',
 title:'2023年10月・12月ME ZB Duos Victory Cup：賞金10組を登録',
 description:'10/23 S26 Event6決勝8組、12/16 S28 Event3決勝2組をスクリーンショットと選手ID・Epic公式規則で確認。チーム$200ずつ計$2,000。既存データを維持。',
 recordIds:added.map(x=>x.id)
});
const validation=validateData({results,players,tournaments});
assert(!validation.errors.length,'data validation failed '+JSON.stringify(validation.errors.slice(0,5)));
const approvals=audit(results,ledger,players);
assert(!approvals.length,'approval audit failed '+JSON.stringify(approvals.slice(0,5)));
const logs=validateUpdateLog(results,updates);
assert(!logs.length,'update log failed '+JSON.stringify(logs.slice(0,5)));
if(!dry&&added.length){
 publishResults(ROOT,results);
 write('players.json',players);write('approval-history.json',ledger);write('updates.json',updates);
}
console.log('ME_ZB_DUOS_VC_2023 '+JSON.stringify({
 mode:dry?'dry-run':'apply',registered:added.length,alreadyPresent:alreadyPresent.length,
 newPlayers,newAliases,newTotal:results.length,
 addedTeamPrize:added.length*200,addedPersonalPrize:added.length*200,
 records:added.map(r=>({date:r.date,rank:r.rank,roster:r.player}))
}));
