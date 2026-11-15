'use strict';
// Fail-closed screenshot/official-rule publisher for 10 ME historical finals.
// Zero-prize Console Champions Cup participants remain in the same Final window.
const fs=require('node:fs'),path=require('node:path');
const {readResults,publishResults}=require('./source-results-store.cjs');
const {validateData,personalCents,roster}=require('./data-checks.cjs');
const {audit}=require('./validate-approvals.cjs');
const {validateUpdateLog}=require('./validate-updates.cjs');
const V=require('./verified-s31-ps-s26-console-zb-ten.cjs');
const ROOT=path.resolve(__dirname,'..');
const load=name=>JSON.parse(fs.readFileSync(path.join(ROOT,name),'utf8'));
const write=(name,obj)=>fs.writeFileSync(path.join(ROOT,name),JSON.stringify(obj,null,2)+'\n');
const check=(ok,msg)=>{if(!ok)throw Error('ME_S31_PS_S26_CONSOLE_TEN: '+msg)};
const argv=process.argv.slice(2),dry=argv.includes('--dry-run');
check(argv.length===0||(argv.length===1&&dry),'only --dry-run supported');
const proof=load('data/manual-approvals/20261115-me-s31-ps-s26-console-zb-ten-proof.json');
check(proof.version===1&&proof.batch?.id==='tracker-20261115-me-s31-ps-s26-console-zb-ten'&&
 Array.isArray(proof.batch.targets)&&proof.batch.targets.length===10&&
 JSON.stringify(proof.batch.targets)===JSON.stringify(V.TARGETS),'proof changed from screenshot oracle');
const results=readResults(ROOT).rows,players=load('players.json'),
 tournaments=load('tournaments.json'),ledger=load('approval-history.json'),updates=load('updates.json');
check(Array.isArray(results)&&Array.isArray(players.candidates)&&
 Array.isArray(ledger.entries)&&Array.isArray(updates.entries),'invalid repository data');
const byId=new Map(results.map(r=>[r.id,r])),oldCount=results.length;
check(byId.size===oldCount,'existing duplicate ID');
const cash=arr=>arr.reduce((s,r)=>s+Math.round((r.prize||0)*100),0);
const allocated=arr=>arr.reduce((s,r)=>s+personalCents(r)*roster(r).length,0);
const oldCash=cash(results),oldPersonal=allocated(results);
const known=new Set(players.candidates.map(p=>p.name)),owners=new Map([...known].map(n=>[n,n]));
for(const [key,aliases] of Object.entries(players.confirmedAliases||{})){
 check(known.has(key)&&Array.isArray(aliases),'invalid original aliases: '+key);
 for(const alias of aliases){
  check(!owners.has(alias)||owners.get(alias)===key,'ambiguous existing alias: '+alias);
  owners.set(alias,key);
 }
}
const newcomers={
 '神櫻神遊神楽舞':{initials:'SK',accent:'violet'},
 'alive in love':{initials:'AL',accent:'pink'},
 '羌瘣.':{initials:'KK',accent:'cyan'},
 'Beautiful World.':{initials:'BW',accent:'violet'},
 'Eliy':{initials:'EL',accent:'pink'}
};
const created=[];
for(const [name,preset] of Object.entries(newcomers)){
 check(!owners.has(name)||owners.get(name)===name,'proposed new name already mapped elsewhere '+name);
 if(!known.has(name)){
  const t=V.TARGETS.find(t=>t.players.includes(name));
  check(t&&t.profiles.some(p=>p.name===name&&V.uuid(p.url)===p.id),
   'new player lacks original Epic ID '+name);
  players.candidates.push({name,...preset,desc:t.date+' '+t.region+' '+t.event+
   '決勝 '+t.rank+'位、'+t.points+'pt、'+t.matches+'試合、チーム'+t.kills+
   'キル、'+t.vrs+'VR、個人賞金$'+t.prizePerPlayer+
   '。提供画像とFortnite Tracker本人Epic UUIDで照合。'});
  known.add(name);owners.set(name,name);created.push(name);
 }
}
let newAlias=false;
check(known.has('らる')&&owners.get('はあちゃまっちゃまーwwǃǃӜ')==='らる',
 'preserve existing らる original screenshot alias');
const rawEliy='Wcr oco';
check(known.has('Eliy'),'new Eliy profile absent');
if(!owners.has(rawEliy)){
 players.confirmedAliases['Eliy']||=[];
 check(Array.isArray(players.confirmedAliases['Eliy']),'Eliy alias storage invalid');
 players.confirmedAliases['Eliy'].push(rawEliy);
 owners.set(rawEliy,'Eliy');newAlias=true;
}
check(owners.get(rawEliy)==='Eliy','Wcr oco assigned to a different profile');
check(known.has('p1ng')&&known.has('RGN p1ng')&&owners.get('p1ng')==='p1ng',
 'p1ng must remain distinct from RGN p1ng');
const calendar=load('calendar-history/2024-09.json');
check(Array.isArray(calendar.sessions)&&calendar.sessions.some(s=>
 s.sourceWindowId==='S31_PlaystationSypherPKCup_Final_ME'&&s.dateJst==='2024-09-02'&&
 s.region==='ME'&&s.eventId==='S31_PlaystationSypherPKCup'),'2024 ME PlayStation official session missing');
const expectedRanks=new Map([['S31',[92,94]],['S26',[2,4,5,7,24,33,35,46]]]);
for(const [seasonId,ranks] of expectedRanks)
 check(JSON.stringify(V.TARGETS.filter(t=>t.seasonId===seasonId).map(t=>t.rank))===
  JSON.stringify(ranks),'screenshot rank list drift '+seasonId);
check(V.TARGETS.reduce((s,t)=>s+t.prize,0)===2000&&
 V.TARGETS.filter(t=>t.prize===0).length===4,'expected 6 cash and 4 zero-dollar finals');
const added=[],already=[];
for(const t of V.TARGETS){
 const duo=t.seasonId==='S26',size=duo?2:1;
 check(t.region==='ME'&&t.players.length===size&&t.profiles.length===size&&
 t.matches>=1&&t.matches<=6&&Number.isInteger(t.kills)&&t.kills>=0&&
 t.vrs>=0&&t.vrs<=t.matches&&Number.isInteger(t.points)&&t.points>=0,
 'invalid match totals or team size '+t.id);
 check(V.payout(t)===t.prize&&t.prizePerPlayer*size===t.prize,
 'Epic Middle East cash table mismatch '+t.id);
 check(t.rule===(duo?V.RULES.S26:V.RULES.S31),
 'wrong Epic award rules '+t.id);
 check((duo&&t.date==='2023-10-30'&&t.vrs<=1&&t.matches===6&&
 t.eventId==='S26_ConsoleChampionsCupZB'&&t.windowId==='S26_ConsoleChampionsCupZB_ME_Final')||
 (!duo&&t.date==='2024-09-02'&&t.vrs===0&&t.matches===4&&
 t.eventId==='S31_PlaystationSypherPKCup'&&t.windowId==='S31_PlaystationSypherPKCup_Final_ME'),
 'wrong final event/date or screenshot format '+t.id);
 const cat=tournaments.catalog.find(x=>x.id===t.tournamentId);
 check(cat&&cat.name===t.event&&cat.seasonId===t.seasonId&&cat.chapter===t.chapter&&
 cat.season===t.season&&cat.mode===(duo?'zero-build':'battle-royale')&&
 cat.team===(duo?'duo':'solo')&&cat.sourceEventIds.includes(t.eventId),
 'tournament catalog/category mismatch '+t.id);
 check(t.sourceTracker==='https://fortnitetracker.com/events/epicgames_'+
  t.eventId+'_ME?window='+t.windowId,'wrong specific event window '+t.id);
 check(new Set(t.players).size===size,'duplicate player in same team '+t.id);
 for(const [i,p] of t.profiles.entries()){
  check(p.name===t.players[i]&&known.has(p.name)&&owners.get(p.name)===p.name&&
   V.uuid(p.url)===p.id,'Epic player UUID/name proof mismatch '+t.id);
  check(owners.get(p.raw)===p.name||p.raw===p.name,
   'raw Tracker name not canonical alias '+t.id+' '+p.raw);
  for(const row of results)for(const old of row.profiles||[]){
   if(V.uuid(old.url)===p.id)
    check(old.name===p.name||owners.get(old.name)===p.name,
     'original Epic ID reused by different canonical profile '+p.name+' / '+old.name);
  }
 }
 const prior=ledger.entries.filter(e=>e.recordId===t.id),existing=byId.get(t.id);
 if(existing){
  check(prior.length===1&&V.verifyRow(existing,prior[0]),
    'existing matching ID differs from screenshot '+t.id);
  already.push(t.id);continue;
 }
 check(!prior.length,'orphan approval ledger row '+t.id);
 const repeated=results.filter(r=>r.seasonId===t.seasonId&&r.region==='ME'&&
 r.date===t.date&&r.tournamentId===t.tournamentId&&
 (r.rank===t.rank||(Array.isArray(r.players)&&
 JSON.stringify([...r.players].sort())===JSON.stringify([...t.players].sort()))));
 check(!repeated.length,'same event rank/team already published '+t.id+' '+repeated.map(x=>x.id));
 const note='2026/11/15提供画像 '+t.screenshot+' と全選手のEpic UUIDを照合。'+
  t.date+' ME '+t.event+' '+t.round+'、'+t.rank+'位、'+t.points+'pt、'+
  t.matches+'試合、チーム'+t.kills+'K、'+t.vrs+'VR、チーム$'+t.prize+
  '・各選手$'+t.prizePerPlayer+'。'+(t.prize===0?'決勝参加・賞金圏外。':'賞金圏内。')+
  '支払い完了は未確認。Tracker: '+t.sourceTracker+' Rule: '+t.rule;
 const row={id:t.id,date:t.date,region:t.region,event:t.event,round:t.round,
  kind:'賞金決勝',player:t.players.join(' / '),players:[...t.players],
  playerRaw:t.playerRaw,profiles:t.profiles.map(p=>({name:p.name,url:p.url})),
  teamAccountIds:t.profiles.map(p=>p.id.replace(/-/g,'')),
  rank:t.rank,points:t.points,matches:t.matches,kills:t.kills,vrs:t.vrs,
  prize:t.prize,teamPrize:t.prize,prizePerPlayer:t.prizePerPlayer,
  source:t.sourceTracker,verified:true,seasonId:t.seasonId,
  chapter:t.chapter,season:t.season,tournamentId:t.tournamentId,note};
 const entry={id:t.id,recordId:t.id,decision:'published',policy:V.POLICY,
  approvedAt:new Date().toISOString(),
  approvedBy:'ChatGPT / 2026-11-15 user screenshot and original Epic UUID',
  source:t.sourceTracker,rule:t.rule,
  evidence:'User provided screenshot '+t.screenshot+'; '+size+' Epic UUID(s), event window, final placing and official cash prize rules'};
 check(V.verifyRow(row,entry),'new record fails immutable verification '+t.id);
 results.push(row);ledger.entries.push(entry);added.push(row);
}
const increase=added.reduce((n,x)=>n+Math.round(x.prize*100),0);
check(results.length===oldCount+added.length&&
 new Set(results.map(x=>x.id)).size===results.length,'lost or duplicated result IDs');
check(cash(results)===oldCash+increase&&allocated(results)===oldPersonal+increase,
 'team and individual cash totals differ from validated additional payouts');
if(added.length){
 check(!updates.entries.some(x=>x.id===proof.batch.id),'already logged separate update');
 updates.entries.unshift({id:proof.batch.id,date:'2026-11-15',type:'records',
  title:'ME 2024 SypherPK2件と2023 ZB Console Champions Cup決勝8組',
  description:'ユーザー提供画像10枚・各選手Epic UUIDを照合。2024/9/2 ME PlayStation SypherPK Cup決勝92位TakoBeL・94位Solary Kurаmа各$200。2023/10/30 ME Zero Build Console Champions Cup決勝2位$550、4位$400、5位$350、7位$300、24/33/35/46位$0の8組。新規プロフィール5名、既存選手を維持、Eliy=Tracker Wcr oco名義。チーム賞金$2,000・個人配分合計$2,000。賞金なしも同じ決勝枠へ統合、実際の支払いは未確認。',
  recordIds:added.map(x=>x.id)});
}
const d=validateData({results,players,tournaments});
check(!d.errors.length,'data quality '+JSON.stringify(d.errors.slice(0,6)));
const a=audit(results,ledger,players);
check(!a.length,'approval history '+JSON.stringify(a.slice(0,6)));
const u=validateUpdateLog(results,updates);
check(!u.length,'updates ledger '+JSON.stringify(u.slice(0,6)));
if(!dry&&(added.length||created.length||newAlias)){
 if(added.length)publishResults(ROOT,results);
 write('players.json',players);
 write('approval-history.json',ledger);
 write('updates.json',updates);
}
console.log('ME_S31_PS_S26_CONSOLE_TEN '+JSON.stringify({mode:dry?'dry-run':'apply',
 newRows:added.length,already:already.length,newProfiles:created,
 newAlias,cashAdded:increase/100,totalRows:results.length,
 ids:added.map(x=>({id:x.id,rank:x.rank,prize:x.prize}))}));
