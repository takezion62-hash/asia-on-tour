'use strict';
// Idempotent publisher: 2 screenshot-verified additions, 2 in-place cash corrections.
// Never append a second S32 team row. Keep original IDs and all unaffected results.
const fs=require('node:fs'),path=require('node:path');
const {readResults,publishResults}=require('./source-results-store.cjs');
const {validateData,personalCents,roster}=require('./data-checks.cjs');
const {audit}=require('./validate-approvals.cjs');
const {validateUpdateLog}=require('./validate-updates.cjs');
const {upsertPublicationLog}=require('./reviewed-publication-core.cjs');
const V=require('./verified-eu-unreal-me-trios-four.cjs');
const ROOT=path.resolve(__dirname,'..');
const read=n=>JSON.parse(fs.readFileSync(path.join(ROOT,n),'utf8'));
const write=(n,v)=>fs.writeFileSync(path.join(ROOT,n),JSON.stringify(v,null,2)+'\n');
const fail=(ok,msg)=>{if(!ok)throw Error('EU_UNREAL_ME_TRIOS_FOUR: '+msg)};
const arg=process.argv.slice(2),dry=arg.includes('--dry-run');
fail(arg.length===0||(arg.length===1&&dry),'only --dry-run allowed');
const doc=read('data/manual-approvals/20261114-eu-unreal-me-trios-four-proof.json');
fail(doc.version===1&&doc.batch?.id==='tracker-20261114-eu-unreal-me-trios-four'&&doc.batch.entries.length===4,'proof batch not locked');
const results=readResults(ROOT).rows,players=read('players.json'),tournaments=read('tournaments.json'),ledger=read('approval-history.json'),updates=read('updates.json');
fail(Array.isArray(players.candidates)&&Array.isArray(ledger.entries)&&players.confirmedAliases&&Array.isArray(updates.entries),'missing data');
const before=results.map(row=>({id:row.id,row:JSON.stringify(row)}));
const oldCount=results.length;
const sumTeam=arr=>arr.reduce((n,r)=>n+Math.round((r.prize||0)*100),0);
const sumPersonal=arr=>arr.reduce((n,r)=>n+personalCents(r)*roster(r).length,0);
const oldCash=sumTeam(results),oldPersonal=sumPersonal(results);
const known=new Set(players.candidates.map(x=>x.name));
const aliases=new Map([...known].map(x=>[x,x]));
for(const [owner,names] of Object.entries(players.confirmedAliases)){
 fail(known.has(owner)&&Array.isArray(names),'invalid existing aliases: '+owner);
 for(const alias of names){fail(!aliases.has(alias)||aliases.get(alias)===owner,'ambiguous original alias '+alias);aliases.set(alias,owner);}
}
const newProfiles=[],newAliases=[];
const needsProfile={Tossy:{name:'Tossy',initials:'TS',accent:'cyan',desc:'2025/12/21 EU $1 Million Unreal Cup：ZAZIと919位・275pt・13チームキル・2VR、チーム$200（個人$100）。Tracker名「zst tossÿ3k.」。本人Epic ID確認済み。'}};
for(const t of V.TARGETS)for(let i=0;i<t.players.length;i++){
 const name=t.players[i],url=t.profiles[i].url;
 fail(V.uuid(url)===t.uuids[i],'independent Epic account ID mismatch: '+name);
 if(!known.has(name)){
  fail(name==='Tossy'&&needsProfile[name],'unknown new player '+name);
  players.candidates.push(needsProfile[name]);known.add(name);aliases.set(name,name);newProfiles.push(name);
 }
 fail(aliases.get(name)===name,'canonical player name is owned by alias: '+name);
}
for(const [name,alias] of [['Tossy','zst tossÿ3k.'],['ZAZI','LYNX ZAZI 咲'],['ぷろぼこ','Puroboko']]){
 fail(!aliases.has(alias)||aliases.get(alias)===name,'alias owned by another player: '+alias);
 if(aliases.get(alias)!==name){
  if(!Array.isArray(players.confirmedAliases[name]))players.confirmedAliases[name]=[];
  players.confirmedAliases[name].push(alias);aliases.set(alias,name);newAliases.push({name,alias});
 }
}
const seen=new Set(),added=[],corrected=[],existing=[];
for(const t of V.TARGETS){
 const item=doc.batch.entries.find(x=>x.id===t.id);
 fail(item&&!seen.has(item.id)&&item.operation===t.operation,'missing/duplicate/corrupt proof '+t.id);seen.add(item.id);
 const keys=['date','seasonId','chapter','season','region','tournamentId','event','round','rank','points','matches','kills','vrs','prize','prizePerPlayer','sourceOfficial','sourceTracker','rule'];
 fail(keys.every(k=>item[k]===t[k])&&JSON.stringify(item.players)===JSON.stringify(t.players)&&
  item.profiles.length===t.uuids.length&&item.profiles.every((p,i)=>p.name===t.players[i]&&V.uuid(p.url)===t.uuids[i])&&
  V.payout(t)===t.prize,'score/identity/prize bracket differs from immutable oracle: '+t.id);
 const cat=tournaments.catalog.find(x=>x.id===t.tournamentId);
 fail(cat&&cat.name===t.event&&cat.seasonId===t.seasonId&&cat.chapter===t.chapter&&cat.season===t.season&&
   cat.team===(t.seasonId==='S39'?'duo':'trio')&&cat.sourceEventIds.some(id=>t.sourceTracker.includes('epicgames_'+id+'_')),
  'incorrect tournament definition: '+t.id);
 const same=results.filter(r=>r.seasonId===t.seasonId&&r.date===t.date&&r.region===t.region&&r.tournamentId===t.tournamentId&&
  (r.id===t.id||r.rank===t.rank||(Array.isArray(r.players)&&JSON.stringify([...r.players].sort())===JSON.stringify([...t.players].sort()))));
 fail(same.length<=1,'conflicting duplicate with same competition '+t.id);
 const row=results.find(r=>r.id===t.id),approved=ledger.entries.filter(e=>e.recordId===t.id);
 if(row&&approved.length===1&&V.verifyCashRow(row,approved[0])){existing.push(t.id);continue;}
 fail(!approved.length,'previously approved row has a different policy or cash: '+t.id);
 const profiles=t.profiles.map(p=>({...p}));
 const accountIds=t.uuids.map(x=>x.replace(/-/g,''));
 const note='ユーザー提供Trackerスクショ'+item.screenshot+'とチーム全員のEpic UUIDを照合。'+
  t.date+' '+t.region+' '+t.event+' '+t.round+' '+t.rank+'位、'+t.points+'pt、'+t.matches+'試合、'+
  t.kills+'チームキル、'+t.vrs+'VR。'+
  'Epic公式賞金規則によりチーム$'+t.prize+'、各選手$'+t.prizePerPlayer+
  '。VR数による賞金加算ではなく順位による報酬。実際の入金は未確認。'+
  ' Tracker: '+t.sourceTracker+' Rule: '+t.rule;
 if(t.operation==='correct'){
  fail(row&&same.length===1&&same[0].id===t.id,'correct only existing original S32 result '+t.id);
  fail(row.date===t.date&&row.region===t.region&&row.seasonId===t.seasonId&&
   row.chapter===t.chapter&&row.season===t.season&&row.tournamentId===t.tournamentId&&
   row.event===t.event&&row.player===t.player&&row.playerRaw===t.rawStored&&
   JSON.stringify(row.players)===JSON.stringify(t.players)&&
   row.rank===t.rank&&row.points===t.points&&row.matches===t.matches&&
   row.kills===t.kills&&row.vrs===t.vrs&&row.source===t.sourceOfficial&&
   row.verified===true&&row.prize===null&&row.kind==='参加確認'&&
   row.round==='Event 1 · Round 2 / 参加確認',
   'existing participation record drift, refuse overwrite '+t.id);
  Object.assign(row,{round:t.round,kind:'賞金決勝',prize:t.prize,teamPrize:t.prize,prizePerPlayer:t.prizePerPlayer,profiles,teamAccountIds:accountIds,note});
  corrected.push(row);
 }else{
  fail(!row&&!same.length&&!results.some(r=>r.id===t.id),'new record collides '+t.id);
  const newRow={id:t.id,date:t.date,seasonId:t.seasonId,chapter:t.chapter,season:t.season,region:t.region,
   tournamentId:t.tournamentId,event:t.event,round:t.round,kind:'賞金決勝',player:t.player,
   playerRaw:t.rawStored,players:[...t.players],rank:t.rank,points:t.points,matches:t.matches,
   kills:t.kills,vrs:t.vrs,prize:t.prize,teamPrize:t.prize,prizePerPlayer:t.prizePerPlayer,
   source:t.sourceOfficial,verified:true,profiles,teamAccountIds:accountIds,note};
  results.push(newRow);added.push(newRow);
 }
 const entry={id:t.id,recordId:t.id,decision:'published',policy:V.POLICY,
  approvedAt:new Date().toISOString(),approvedBy:'ChatGPT / 2026-11-14 screenshots and Epic official rules',
  source:t.sourceTracker,rule:t.rule,evidence:'Saved screenshot, original verified Epic account UUIDs and official rank-prize bracket'};
 ledger.entries.push(entry);
 fail(V.verifyCashRow(results.find(r=>r.id===t.id),entry),'created/updated award failed independent audit '+t.id);
}
fail(seen.size===4&&doc.batch.entries.every(x=>seen.has(x.id)),'unknown evidence entry');
const changed=[...added,...corrected],amount=changed.reduce((n,r)=>n+r.prize*100,0);
fail(results.length===oldCount+added.length&&sumTeam(results)===oldCash+amount&&
 sumPersonal(results)===oldPersonal+amount,'historical money/count invariants failed');
const touched=new Set(changed.map(x=>x.id));
for(const prev of before){
 const now=results.find(x=>x.id===prev.id);
 fail(now&&(!touched.has(prev.id)||JSON.stringify(now)!==prev.row),
  'unrelated original record changed or approved correction had no effect '+prev.id);
}
if(changed.length){
 // Log only genuinely new records; prior auto-import IDs must not appear as new history entries.
 upsertPublicationLog(updates,{
  id:doc.batch.id,date:'2026-11-14',
  title:'2025 EU Unreal Cupと2024 ME Trios Cash Cup：新規2件＋既存賞金2件修正',
  description:'ユーザー提供4枚のTracker画像とEpic公式順位賞金規則を照合。EU919位チーム$200、ME10/20の10位チーム$300を新規登録、ME11/8の16位・24位を元IDのまま各チーム$300へ修正。総賞金+$1,100。0VRでも順位賞金。',
  recordIds:added.map(x=>x.id)
 });
}
const check=validateData({results,players,tournaments});
fail(!check.errors.length,'data validation: '+JSON.stringify(check.errors.slice(0,8)));
const ap=audit(results,ledger,players);
fail(!ap.length,'approval audit: '+JSON.stringify(ap.slice(0,8)));
const errors=validateUpdateLog(results,updates);
fail(!errors.length,'update log audit: '+JSON.stringify(errors.slice(0,8)));
if(!dry&&changed.length){
 publishResults(ROOT,results);
 write('players.json',players);write('approval-history.json',ledger);write('updates.json',updates);
}
console.log('EU_UNREAL_ME_TRIOS_FOUR '+JSON.stringify({
 mode:dry?'dry-run':'apply',newRows:added.length,correctedRows:corrected.length,alreadyPresent:existing.length,
 cashAdded:amount/100,newCount:results.length,newPlayers:newProfiles,aliases:newAliases,
 changed:changed.map(x=>({id:x.id,date:x.date,player:x.player,rank:x.rank,prize:x.prize,personal:x.prizePerPlayer}))
}));
