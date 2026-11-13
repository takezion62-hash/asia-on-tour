'use strict';
// Source-backed, idempotent correction and addition of three known teams from
// user supplied 2024-06-21 ME ZB Duos Cash Cup Event3 Round2 screenshots.
// The paid 13th place was previously saved as attendance-only; retain its ID,
// update its prior approval policy, and add exactly two $0 final results.
const fs=require('node:fs'),path=require('node:path');
const {readResults,publishResults}=require('./source-results-store.cjs');
const {validateData,personalCents,roster}=require('./data-checks.cjs');
const {audit}=require('./validate-approvals.cjs');
const {validateUpdateLog}=require('./validate-updates.cjs');
const {upsertPublicationLog}=require('./reviewed-publication-core.cjs');
const C=require('./verified-s30-me-zb-duos-20240621.cjs');
const ROOT=path.resolve(__dirname,'..');
const read=name=>JSON.parse(fs.readFileSync(path.join(ROOT,name),'utf8'));
const write=(name,value)=>fs.writeFileSync(path.join(ROOT,name),JSON.stringify(value,null,2)+'\n');
const assert=(ok,message)=>{if(!ok)throw Error('S30_ME_ZB_DUOS_20240621: '+message)};
const args=process.argv.slice(2),dryRun=args.includes('--dry-run');
assert(args.length===0||(args.length===1&&dryRun),'only --dry-run or no args permitted');
const doc=read('data/manual-approvals/20240621-me-zb-duos-final-tracker.json'),batch=doc.batch;
assert(doc.version===1&&batch?.id==='tracker-s30-me-zb-duos-final-20240621'&&
 batch.date===C.DATE&&batch.region===C.REGION&&batch.seasonId==='S30'&&
 batch.tournamentId===C.TOURNAMENT&&batch.eventId===C.EVENT&&
 batch.windowId===C.WINDOW&&batch.source===C.TRACKER&&
 batch.ruleUrl===C.RULE&&batch.cashCutoff===25&&
 Array.isArray(batch.teams)&&batch.teams.length===3,
 'user screenshot evidence document differs from exact approved tournament');
const results=readResults(ROOT).rows,players=read('players.json'),
 tournaments=read('tournaments.json'),ledger=read('approval-history.json'),
 updates=read('updates.json');
const cat=tournaments.catalog.find(x=>x.id===C.TOURNAMENT);
assert(cat&&cat.name==='ZB Duos Cash Cup'&&cat.seasonId==='S30'&&
 cat.chapter===5&&cat.season===3&&cat.team==='duo'&&
 cat.mode==='zero-build'&&cat.sourceEventIds?.includes(C.EVENT),
 'catalog does not match official Zero Build Duos event');
const sessions=read('calendar-history/2024-06.json').sessions;
assert(sessions.filter(x=>x.dateJst===C.DATE&&x.region===C.REGION&&
 x.tournamentId===C.TOURNAMENT&&x.eventId===C.EVENT&&
 x.sourceWindowId===C.WINDOW&&x.url===C.SOURCE&&
 x.stage==='決勝'&&x.round==='Event 3 · Round 2').length===1,
 'historical official JST session / region / round is unverified');
const names=new Set(players.candidates.map(x=>x.name));
const aliasOwner=new Map([...names].map(n=>[n,n]));
for(const [canonical,list] of Object.entries(players.confirmedAliases||{})){
 assert(names.has(canonical)&&Array.isArray(list),'broken player aliases before correction');
 for(const alias of list){
  assert(!aliasOwner.has(alias)||aliasOwner.get(alias)===canonical,
   'ambiguous preexisting identity '+alias);
  aliasOwner.set(alias,canonical);
 }
}
const seenProfiles=new Map();
for(const row of results)for(const p of row.profiles||[]){
 const id=C.uuid(p.url);
 if(!id)continue;
 const canonical=aliasOwner.get(p.name)||p.name;
 assert(!seenProfiles.has(id)||seenProfiles.get(id)===canonical,
  'existing Tracker ID assigned to multiple players: '+id);
 seenProfiles.set(id,canonical);
}
const before={count:results.length,team:results.reduce((n,x)=>n+(x.prize||0),0),
 personal:results.reduce((n,x)=>n+personalCents(x)*roster(x).length,0)};
const corrections=[],newRows=[],unchanged=[],newPlayers=[],newAliases=[];
const rankSeen=new Set();
for(const team of batch.teams){
 const target=C.TARGETS.find(t=>t.rank===team.rank);
 assert(target&&!rankSeen.has(team.rank)&&team.points===target.points&&
  team.kills===target.kills&&team.vrs===target.vrs&&
  team.matches===target.matches&&team.teamPrize===target.prize&&
  team.matches>=1&&team.matches<=6&&team.vrs<=team.matches&&
  (team.rank===13?team.teamPrize===200:team.teamPrize===0)&&
  (team.rank===13?team.rank<=batch.cashCutoff:team.rank>batch.cashCutoff)&&
  Array.isArray(team.members)&&team.members.length===2&&
  team.members.map(x=>x.name).join(' / ')===target.player,
  'pinned scoreboard rank/points/elims/VR/payout mismatch: '+team.rank);
 rankSeen.add(team.rank);
 const profiles=[];
 for(let i=0;i<team.members.length;i++){
  const p=team.members[i],uuid=C.uuid(p.url);
  assert(uuid===target.uuids[i]&&typeof p.raw==='string'&&p.raw.length>0&&
   typeof p.name==='string'&&p.name.length>0&&p.name===p.name.trim()&&
   p.raw===p.raw.trim()&&(!aliasOwner.has(p.name)||aliasOwner.get(p.name)===p.name)&&
   (!seenProfiles.has(uuid)||seenProfiles.get(uuid)===p.name),
   'player canonical identity or distinct Tracker ID changed at rank '+team.rank);
  seenProfiles.set(uuid,p.name);
  if(!names.has(p.name)){
   assert(['かわあと','R10 ⒶⓁⓅⒽⒶ'].includes(p.name),
    'do not create a player without explicit user identity '+p.name);
   players.candidates.push({name:p.name,
    initials:p.name.startsWith('R10')?'R1':p.name.slice(0,2),
    accent:players.candidates.length%2?'cyan':'violet',
    desc:'2024/6/21 ME ZB Duos Cash Cup Event3賞金決勝'+team.rank+
     '位・'+team.points+'pt・'+team.kills+'チームキル・個人賞金$0。ユーザー提供画像と本人Tracker IDで確認。'});
   names.add(p.name);aliasOwner.set(p.name,p.name);newPlayers.push(p.name);
  }
  if(p.raw!==p.name&&aliasOwner.get(p.raw)!==p.name){
   assert(!aliasOwner.has(p.raw),'same raw alias maps to a different player '+p.raw);
   if(!players.confirmedAliases[p.name])players.confirmedAliases[p.name]=[];
   players.confirmedAliases[p.name].push(p.raw);
   aliasOwner.set(p.raw,p.name);newAliases.push({canonical:p.name,alias:p.raw});
  }
  profiles.push({name:p.name,url:p.url});
 }
 const comparable=results.filter(x=>x.date===C.DATE&&x.region===C.REGION&&
   x.tournamentId===C.TOURNAMENT&&
   (x.id===target.id||
    (x.rank===team.rank&&x.source===C.SOURCE)||
    (Array.isArray(x.players)&&x.players.slice().sort().join('\u0000')===
     team.members.map(m=>m.name).sort().join('\u0000'))));
 assert(comparable.length<=1,'colliding score or roster at rank '+team.rank);
 const note='ユーザー提供2026/11/13 Fortnite Tracker画像と本人IDの照合で'+
  '2024/6/21 ME ZB Duos Cash Cup Event3 Round2の'+
  team.rank+'位・'+team.points+'pt・'+team.kills+'チームキル・'+
  team.vrs+'VR・'+team.matches+'試合を確認。'+
  (team.rank<=25?'公式4〜25位のチーム賞金$200・個人各$100。':
   '公式上位25組の賞金圏外：チーム賞金$0・個人各$0。')+
  '支払完了は断定しない。元順位表: '+C.TRACKER+'。公式規則: '+C.RULE;
 let row,approval;
 if(comparable.length){
  row=comparable[0];
  assert(team.rank===13&&row.id===target.id&&row.player===target.player&&
   row.source===C.SOURCE&&row.verified===true&&
   ['rank','points','kills','vrs','matches'].every(k=>row[k]===team[k]),
   'existing row is not the exact 13th place candidate');
  approval=ledger.entries.find(e=>e.recordId===row.id);
  assert(ledger.entries.filter(e=>e.recordId===row.id).length===1&&
   approval.id===row.id&&approval.source===row.source,
   'previous 13th place approval missing or conflicted');
  if(row.kind==='賞金決勝'){
   assert(C.verifyCashRow(row,approval),'already corrected cash result differs');
   unchanged.push(row.id);continue;
  }
  assert(row.kind==='参加確認'&&row.round==='Event 3 · Round 2 / 参加確認'&&
   row.prize===null&&approval.policy==='attendance-only'&&
   !row.teamPrize&&!row.prizePerPlayer,
   'existing payout or original attendance review unexpectedly changed');
  row.round=C.ROUND;row.kind='賞金決勝';row.prize=200;
  row.teamPrize=200;row.prizePerPlayer=100;
  row.profiles=profiles;row.note=note;
  approval.policy=C.POLICY;approval.rule=C.RULE;
  approval.evidence='13th-place $200/team, $100 each by 2024-06-21 original user Tracker screenshot, 2 unique Epic IDs and Epic official cash rules: '+C.TRACKER;
  corrections.push(row.id);
 }else{
  assert([26,35].includes(team.rank)&&!results.some(x=>x.id===target.id),
   'new row out of allowlist or duplicate ID '+target.id);
  row={id:target.id,date:C.DATE,region:C.REGION,
   player:target.player,players:team.members.map(m=>m.name),
   playerRaw:team.members.map(m=>m.raw).join(' / '),
   event:cat.name,round:C.ROUND,rank:team.rank,points:team.points,
   kills:team.kills,vrs:team.vrs,matches:team.matches,
   prize:0,teamPrize:0,prizePerPlayer:0,kind:'賞金決勝',
   tournamentId:C.TOURNAMENT,seasonId:'S30',chapter:5,season:3,
   source:C.SOURCE,profiles,verified:true,note};
  results.push(row);newRows.push(row);
  approval={id:row.id,recordId:row.id,decision:'published',
   policy:C.POLICY,approvedAt:new Date().toISOString(),
   approvedBy:'ChatGPT / owner-authorized Tracker screenshot review',
   source:C.SOURCE,rule:C.RULE,
   evidence:'2024-06-21 ME ZB Duos Cash Cup official Top25 cash threshold; rank 26/35 $0; 2 unique Tracker Epic IDs: '+C.TRACKER};
  ledger.entries.push(approval);
 }
 assert(C.verifyCashRow(row,approval),'final cash and account audit failed rank '+team.rank);
}
assert(rankSeen.size===3&&C.TARGETS.every(t=>rankSeen.has(t.rank)),
 'three supplied teams were not completely reconciled');
assert(results.length===before.count+newRows.length&&
 Math.abs(results.reduce((n,x)=>n+(x.prize||0),0)-(before.team+200*(corrections.length?1:0)))<0.001&&
 results.reduce((n,x)=>n+personalCents(x)*roster(x).length,0)===
 before.personal+20000*(corrections.length?1:0),
 'existing cash and personal totals changed unexpectedly');
if(newRows.length){
 upsertPublicationLog(updates,{
  id:batch.id,date:'2026-11-13',
  title:'2024/6/21 ME ZB Duos Cash Cup決勝：13位賞金訂正＋26・35位追加',
  description:'MMC KAAN BABA/みるやちぇの13位はチーム$200・個人各$100に訂正。るかぽりん/かわあと26位、なずな/R10 ⒶⓁⓅⒽⒶ35位は公式上位25組の圏外のため$0で新規掲載。',
  recordIds:newRows.map(x=>x.id)
 });
}
const dataErrors=validateData({results,players,tournaments}).errors;
assert(!dataErrors.length,'data validation: '+JSON.stringify(dataErrors.slice(0,5)));
const ledgerErrors=audit(results,ledger,players);
assert(!ledgerErrors.length,'approval ledger: '+JSON.stringify(ledgerErrors.slice(0,5)));
const updateErrors=validateUpdateLog(results,updates);
assert(!updateErrors.length,'history ledger: '+JSON.stringify(updateErrors.slice(0,5)));
if(!dryRun&&(corrections.length||newRows.length)){
 publishResults(ROOT,results);
 write('players.json',players);write('approval-history.json',ledger);
 write('updates.json',updates);
}
console.log('S30_ME_ZB_DUOS_20240621 '+JSON.stringify({mode:dryRun?'dry-run':'apply',
 corrected:corrections.length,added:newRows.length,unchanged:unchanged.length,
 newPlayers,newAliases,existingCount:before.count,newCount:results.length,
 addedTeamCash:corrections.length*200,addedPersonalCash:corrections.length*200,
 affectedIds:corrections.concat(newRows.map(x=>x.id))}));
