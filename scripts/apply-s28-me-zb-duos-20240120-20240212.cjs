'use strict';
// Backfill S28 C5S1, ME Zero Build Duos Victory Cash Cup Round 2.
// Explicitly documented Tracker "Event 5" on 2024-01-20 JST and
// Tracker "Event 8" on 2024-02-12 JST, independent of schedule numbering.
// Exactly eight screenshot-backed awards. An unlisted result cannot earn cash.
const fs=require('node:fs'),path=require('node:path');
const {readResults,publishResults}=require('./source-results-store.cjs');
const {validateData,personalCents,roster}=require('./data-checks.cjs');
const {audit}=require('./validate-approvals.cjs');
const {validateUpdateLog}=require('./validate-updates.cjs');
const {upsertPublicationLog}=require('./reviewed-publication-core.cjs');
const V=require('./verified-s28-me-zb-duos-20240120-20240212.cjs');
const ROOT=path.resolve(__dirname,'..');
const read=name=>JSON.parse(fs.readFileSync(path.join(ROOT,name),'utf8'));
const write=(name,data)=>fs.writeFileSync(path.join(ROOT,name),JSON.stringify(data,null,2)+'\n');
const assert=(ok,message)=>{if(!ok)throw Error('S28_ME_DUOS_2024_BOTH: '+message)};
const args=process.argv.slice(2),dry=args.includes('--dry-run');
assert(args.length===0||(args.length===1&&dry),'only --dry-run or no args allowed');
const doc=read('data/manual-approvals/20240120-20240212-me-zb-duos-vcup-proof.json'),b=doc.batch;
assert(doc.version===1&&b?.id==='tracker-s28-me-zb-duos-vcup-20240120-20240212'&&
 b.region===V.REGION&&b.seasonId===V.SEASON&&
 b.tournamentId===V.TOURNAMENT&&b.eventId===V.EVENT&&
 b.source===V.BASE&&b.ruleUrl===V.RULE&&
 Array.isArray(b.teams)&&b.teams.length===8,
 'evidence document does not match 8 exact ME ZB Duos Victory awards');
const results=readResults(ROOT).rows;
const players=read('players.json'),tournaments=read('tournaments.json'),
 ledger=read('approval-history.json'),updates=read('updates.json');
const cat=tournaments.catalog.find(t=>t.id===V.TOURNAMENT);
assert(cat&&cat.name==='Zero Build Duos Victory Cup'&&cat.seasonId===V.SEASON&&
 cat.chapter===5&&cat.season===1&&cat.mode==='zero-build'&&
 cat.team==='duo'&&cat.sourceEventIds?.length===1&&
 cat.sourceEventIds[0]===V.EVENT,'Season 28 historical tournament not registered safely');
const known=new Set(players.candidates.map(x=>x.name));
const aliasOwners=new Map([...known].map(x=>[x,x]));
for(const [canonical,aliases] of Object.entries(players.confirmedAliases||{})){
 assert(known.has(canonical)&&Array.isArray(aliases),'invalid existing alias owner '+canonical);
 for(const alias of aliases){
  assert(!aliasOwners.has(alias)||aliasOwners.get(alias)===canonical,
   'ambiguous legacy alias '+alias);
  aliasOwners.set(alias,canonical);
 }
}
assert(aliasOwners.get('charufn')==='ちゃる'&&aliasOwners.get('ptt ろず')==='ろず',
 'historic confirmed user aliases charufn/ptt ろず must be preserved');
const existingUuid=new Map();
for(const r of results)for(const p of r.profiles||[]){
 const id=V.uuid(p.url);
 if(!id)continue;
 const owner=aliasOwners.get(p.name)||p.name;
 assert(!existingUuid.has(id)||existingUuid.get(id)===owner,
  'existing Tracker Epic account appears under different canonical names '+id);
 existingUuid.set(id,owner);
}
const old={count:results.length,
 team:results.reduce((n,r)=>n+Math.round((r.prize||0)*100),0),
 personal:results.reduce((n,r)=>n+personalCents(r)*roster(r).length,0)};
const added=[],published=[],newPlayers=[],newAliases=[],seen=new Set();
const allowedNew=new Set(['Vall','Stay Alivё']);
for(const item of b.teams){
 const t=V.TARGETS.find(x=>x.date===item.date&&x.eventNumber===item.eventNumber&&x.rank===item.rank);
 assert(t&&!seen.has(t.id)&&
  item.round===2&&item.windowId===V.WINDOW(t.eventNumber)&&
  item.points===t.points&&item.kills===t.kills&&item.vrs===t.vrs&&
  item.matches===t.matches&&item.teamPrize===t.prize&&
  item.points===100&&item.vrs===1&&item.matches>=1&&item.matches<=3&&
  item.teamPrize===200&&Array.isArray(item.members)&&item.members.length===2&&
  item.members.map(m=>m.name).join(' / ')===t.player,
  'event window, scoreboard, score or payout did not match fixed screenshot '+item.rank);
 seen.add(t.id);
 const rosterNames=[],profiles=[];
 for(let i=0;i<2;i++){
  const p=item.members[i],uid=V.uuid(p.url);
  assert(typeof p.name==='string'&&p.name===p.name.trim()&&p.name.length>0&&
   typeof p.raw==='string'&&p.raw===p.raw.trim()&&p.raw.length>0&&
   uid===t.ids[i]&&
   (!aliasOwners.has(p.name)||aliasOwners.get(p.name)===p.name)&&
   (!existingUuid.has(uid)||existingUuid.get(uid)===p.name),
   'unverified or conflicting Epic account/identity '+p.name+' '+t.id);
  if(!known.has(p.name)){
   assert(allowedNew.has(p.name),'refused unknown new player '+p.name);
   players.candidates.push({
    name:p.name,
    initials:p.name==='Vall'?'Va':'St',accent:players.candidates.length%2?'cyan':'violet',
    desc:'2024年1月20日/2月12日 ME Zero Build Duos Victory Cup Event5/8決勝、1VR・個人賞金$100。画像と本人Fortnite Tracker Epic IDで確認。'
   });
   known.add(p.name);aliasOwners.set(p.name,p.name);newPlayers.push(p.name);
  }
  existingUuid.set(uid,p.name);
  if(p.raw!==p.name&&aliasOwners.get(p.raw)!==p.name){
   assert(!aliasOwners.has(p.raw),'raw account name owned by someone else '+p.raw);
   if(!players.confirmedAliases[p.name])players.confirmedAliases[p.name]=[];
   players.confirmedAliases[p.name].push(p.raw);
   aliasOwners.set(p.raw,p.name);newAliases.push({name:p.name,raw:p.raw});
  }
  rosterNames.push(p.name);profiles.push({name:p.name,url:p.url});
 }
 const matches=results.filter(r=>r.date===t.date&&r.region==='ME'&&
  r.tournamentId===V.TOURNAMENT&&
  (r.id===t.id||r.rank===t.rank||
   (Array.isArray(r.players)&&r.players.slice().sort().join('\u0000')===
    rosterNames.slice().sort().join('\u0000'))));
 assert(matches.length<=1,'duplicate results: '+t.id);
 if(matches.length){
  const row=matches[0],e=ledger.entries.find(x=>x.recordId===row.id);
  assert(row.id===t.id&&ledger.entries.filter(x=>x.recordId===row.id).length===1&&
   V.verifyCashRow(row,e),'originally published row no longer matches screenshot '+t.id);
  published.push(t.id);continue;
 }
 assert(!results.some(r=>r.id===t.id),'duplicate record ID outside this event '+t.id);
 const note='ユーザー提供のFortnite Tracker結果スクリーンショットと両選手のEpic IDを照合。'+
  '2024年'+(t.eventNumber===5?'1月20日':'2月12日')+
  ' JST、ME Zero Build Duos Victory Cup Event'+t.eventNumber+' Round2。'+
  t.rank+'位・100pt・'+t.kills+'チームキル・'+t.matches+'試合・1VR。'+
  'Epic公式Chapter5 Season1 ZB Duos Victory Cash Cup賞金規則：1VRで選手各$100（チーム$200）。'+
  '本人への実支払い完了は未確認。大会: '+V.TRACKER(t.eventNumber)+' 公式: '+V.RULE;
 const row={id:t.id,date:t.date,region:'ME',
  player:t.player,players:rosterNames,playerRaw:item.members.map(x=>x.raw).join(' / '),
  event:cat.name,round:V.ROUND(t.eventNumber),rank:t.rank,
  points:100,kills:t.kills,vrs:1,matches:t.matches,
  prize:200,teamPrize:200,prizePerPlayer:100,kind:'賞金決勝',
  seasonId:V.SEASON,chapter:5,season:1,tournamentId:V.TOURNAMENT,
  source:V.TRACKER(t.eventNumber),profiles,verified:true,note};
 const e={id:t.id,recordId:t.id,decision:'published',policy:V.POLICY,
  approvedAt:new Date().toISOString(),approvedBy:'ChatGPT / user-authorized screenshot-backed GitHub publication',
  source:V.TRACKER(t.eventNumber),rule:V.RULE,
  evidence:'2024 S28 ME ZB Duos Victory Cash: original Round2 user screenshots prove 1VR, 100 pts, $100 per player, exact rank/team/elims/2 Epic IDs'};
 assert(V.verifyCashRow(row,e),'imported new record does not pass strict audited award '+t.id);
 results.push(row);ledger.entries.push(e);added.push(row);
}
assert(V.TARGETS.length===seen.size&&V.TARGETS.every(t=>seen.has(t.id)),
 'not all eight screenshot teams processed');
assert(results.length===old.count+added.length&&
 results.reduce((n,r)=>n+Math.round((r.prize||0)*100),0)===old.team+added.length*20000&&
 results.reduce((n,r)=>n+personalCents(r)*roster(r).length,0)===old.personal+added.length*20000,
 'added earnings changed any existing cash or per-player amounts unexpectedly');
if(added.length)upsertPublicationLog(updates,{
 id:b.id,date:'2026-11-14',
 title:'2024年1月・2月ME Zero Build Duos Victory Cup：賞金8組を登録',
 description:'1/20 Event5決勝5組、2/12 Event8決勝3組を公式1VR=選手各$100の規則と画像・選手IDで照合。チーム$200ずつ計$1,600。既存大会・賞金は保持。',
 recordIds:added.map(x=>x.id)
});
const validation=validateData({results,players,tournaments});
assert(!validation.errors.length,'data validation failed '+JSON.stringify(validation.errors.slice(0,5)));
const approvalErrors=audit(results,ledger,players);
assert(!approvalErrors.length,'approval audit failed '+JSON.stringify(approvalErrors.slice(0,5)));
const logErrors=validateUpdateLog(results,updates);
assert(!logErrors.length,'update log invalid '+JSON.stringify(logErrors.slice(0,5)));
if(!dry&&added.length){
 publishResults(ROOT,results);
 write('players.json',players);write('approval-history.json',ledger);write('updates.json',updates);
}
console.log('S28_ME_ZB_DUOS_2024 '+JSON.stringify({mode:dry?'dry-run':'apply',
 registered:added.length,alreadyPresent:published.length,newPlayers,newAliases,
 newCount:results.length,addedTeamPrize:added.length*200,
 addedPersonalPrize:added.length*200,records:added.map(r=>({date:r.date,rank:r.rank,name:r.player}))}));
