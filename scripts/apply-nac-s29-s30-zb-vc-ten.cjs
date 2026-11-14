'use strict';
// Idempotent, fail-closed release of ten NAC 2024 ZB Victory Cash results
// with exact screenshot ranks, Epic account IDs and VR-only award formulas.
const fs=require('node:fs'),path=require('node:path');
const {readResults,publishResults}=require('./source-results-store.cjs');
const {validateData,personalCents,roster}=require('./data-checks.cjs');
const {audit}=require('./validate-approvals.cjs');
const {validateUpdateLog}=require('./validate-updates.cjs');
const V=require('./verified-nac-s29-s30-zb-vc-ten.cjs');
const ROOT=path.resolve(__dirname,'..');
const read=name=>JSON.parse(fs.readFileSync(path.join(ROOT,name),'utf8'));
const write=(name,obj)=>fs.writeFileSync(path.join(ROOT,name),JSON.stringify(obj,null,2)+'\n');
const guard=(test,msg)=>{if(!test)throw Error('NAC_ZB_VC_TEN: '+msg)};
const args=process.argv.slice(2),dry=args.includes('--dry-run');
guard(args.length===0||(args.length===1&&dry),'unsupported arguments (only --dry-run)');
const proof=read('data/manual-approvals/20261114-nac-s29-s30-zb-vc-ten-proof.json');
guard(proof.version===1&&proof.batch?.id==='tracker-20261114-nac-s29-s30-zb-vc-ten'&&
 JSON.stringify(proof.batch.targets)===JSON.stringify(V.TARGETS)&&V.TARGETS.length===10,
 'user screenshots differ from independent locked data');
const results=readResults(ROOT).rows,players=read('players.json'),
 tournaments=read('tournaments.json'),ledger=read('approval-history.json'),updates=read('updates.json');
guard(Array.isArray(results)&&Array.isArray(players.candidates)&&
 Array.isArray(ledger.entries)&&Array.isArray(updates.entries),'invalid base data');
const byId=new Map(results.map(x=>[x.id,x]));
guard(byId.size===results.length,'duplicate existing IDs');
const oldCount=results.length;
const money=rs=>rs.reduce((n,r)=>n+Math.round((r.prize||0)*100),0);
const perPlayer=rs=>rs.reduce((n,r)=>n+personalCents(r)*roster(r).length,0);
const beforeCash=money(results),beforePersonal=perPlayer(results);
const known=new Set(players.candidates.map(p=>p.name));
const owners=new Map([...known].map(n=>[n,n]));
for(const [canonical,aliases] of Object.entries(players.confirmedAliases||{})){
 guard(known.has(canonical)&&Array.isArray(aliases),'invalid alias owner: '+canonical);
 for(const alias of aliases){
  guard(!owners.has(alias)||owners.get(alias)===canonical,'ambiguous original alias: '+alias);
  owners.set(alias,canonical);
 }
}
const fresh={
 'IPF ますたーにゃーだ':{initials:'IP',accent:'cyan'},
 'URZB まいと':{initials:'UR',accent:'violet'},
 'wicxsy':{initials:'WI',accent:'pink'}
};
const created=[];
for(const [name,preset] of Object.entries(fresh)){
 guard(!owners.has(name)||owners.get(name)===name,'existing alias owns new name '+name);
 if(!known.has(name)){
  const t=V.TARGETS.find(x=>x.players.includes(name));
  guard(t&&t.profiles.some(p=>p.id),'missing Epic proof for new profile '+name);
  players.candidates.push({name,...preset,
   desc:'2024/6/25 NAC ZB Solo Victory Cup Event4 Round2決勝：'+t.rank+
   '位、100pt、3試合、'+t.kills+'キル、1VR、個人賞金$100。Fortnite Tracker表示名・Epic本人IDを照合。'});
  known.add(name);owners.set(name,name);created.push(name);
 }
}
const calendar=read('calendar-history/2024-06.json');
guard(Array.isArray(calendar.sessions),'June 2024 official event history missing');
const datesAndRanks=new Map([
 ['2024-06-25',[70,72,75,77,114]],
 ['2024-06-18',[78,108]],
 ['2024-04-25',[4,54,93]]
]);
const actualDateGroups=new Map();
for(const t of V.TARGETS){
 const group=actualDateGroups.get(t.date)||[];
 group.push(t.rank);actualDateGroups.set(t.date,group);
}
for(const [date,ranks] of datesAndRanks)
 guard(JSON.stringify(actualDateGroups.get(date))===JSON.stringify(ranks),'fixed date/rank screenshot drift '+date);
guard(known.has('りんたろう')&&known.has('p1ng')&&known.has('RGN p1ng')&&'p1ng'!=='RGN p1ng',
 'preserve distinct p1ng identities');
let added=[],already=[];
for(const t of V.TARGETS){
 const solo=t.seasonId==='S30',size=solo?1:2;
 guard(t.region==='NAC'&&t.profiles.length===size&&t.players.length===size&&
 t.matches===3&&t.vrs>=1&&t.vrs<=3&&t.points===t.vrs*100&&t.kills>=0,
 'wrong event scoring/match count '+t.id);
 guard(V.payout(t)===t.prize&&t.prize===size*t.prizePerPlayer,
 'Epic VR payout wrong '+t.id);
 guard(t.rule===(solo?V.SOLO_RULE:V.DUO_RULE),'wrong official chapter/season cash rule '+t.id);
 const cat=tournaments.catalog.find(x=>x.id===t.tournamentId);
 guard(cat&&cat.name===t.event&&cat.seasonId===t.seasonId&&cat.chapter===t.chapter&&
 cat.season===t.season&&cat.mode==='zero-build'&&cat.team===(solo?'solo':'duo')&&
 cat.sourceEventIds.includes(t.eventId),'wrong registered tournament '+t.id);
 if(solo){
  const session=calendar.sessions.find(s=>s.sourceWindowId===t.windowId&&
   s.dateJst===t.date&&s.region==='NAC'&&s.stage==='決勝'&&
   s.tournamentId===t.tournamentId&&s.eventId===t.eventId);
  guard(session,'S30 official calendar session mismatch '+t.id);
 }else{
  // Historical April S29 is earlier than the archive's first local month;
  // preserve the exact Epic Event6 Round2 window supplied in the screenshot.
  guard(t.date==='2024-04-25'&&t.eventId==='S29_DuosZBVictoryCashCup'&&
   t.windowId==='S29_DuosZBVictoryCashCup_Event6Round2_NAC',
   'April S29 event window mismatch '+t.id);
 }
 guard(t.sourceTracker==='https://fortnitetracker.com/events/epicgames_'+
 t.eventId+'_NAC?window='+t.windowId,'incorrect tracker event source '+t.id);
 for(const [i,p] of t.profiles.entries()){
  guard(p.name===t.players[i]&&known.has(p.name)&&owners.get(p.name)===p.name&&
   V.uuid(p.url)===p.id,'canonical name/Epic UUID differs from screenshot '+t.id);
  for(const other of results)for(const profile of other.profiles||[]){
   if(V.uuid(profile.url)===p.id){
    guard(owners.get(profile.name)===p.name||profile.name===p.name,
     'account UUID bound to different canonical player '+p.name+' vs '+profile.name);
   }
  }
 }
 const prior=ledger.entries.filter(x=>x.recordId===t.id);
 const previous=byId.get(t.id);
 if(previous){
  guard(prior.length===1&&V.verifyCashRow(previous,prior[0]),
   'previous row differs from screenshot proof '+t.id);
  already.push(t.id);continue;
 }
 guard(!prior.length,'orphan approval for '+t.id);
 const conflicting=results.filter(r=>r.seasonId===t.seasonId&&r.date===t.date&&
 r.region==='NAC'&&r.tournamentId===t.tournamentId&&r.round===t.round&&
 (r.rank===t.rank||(Array.isArray(r.players)&&
 JSON.stringify([...r.players].sort())===JSON.stringify([...t.players].sort()))));
 guard(!conflicting.length,'same team/rank double-published '+t.id+' '+conflicting.map(r=>r.id));
 const note='2026/11/14ユーザー提供Fortnite Tracker画像 '+t.screenshot+' と全選手のEpic IDを照合。'+
 t.date+' NAC '+t.event+' '+t.round+'、'+t.rank+'位、'+t.points+'pt、'+t.matches+
 '試合、'+t.kills+'チームキル、'+t.vrs+'VR、チーム$'+t.prize+
 '・各選手$'+t.prizePerPlayer+'。Epic公式1VR賞金規則。実際の支払完了は未確認。Tracker: '+
 t.sourceTracker+' Rule: '+t.rule;
 const r={id:t.id,date:t.date,region:t.region,seasonId:t.seasonId,chapter:t.chapter,
 season:t.season,tournamentId:t.tournamentId,event:t.event,round:t.round,
 player:t.players.join(' / '),players:[...t.players],playerRaw:t.playerRaw,
 profiles:t.profiles.map(p=>({name:p.name,url:p.url})),
 teamAccountIds:t.profiles.map(p=>p.id.replace(/-/g,'')),
 rank:t.rank,points:t.points,matches:t.matches,kills:t.kills,vrs:t.vrs,
 prize:t.prize,teamPrize:t.prize,prizePerPlayer:t.prizePerPlayer,
 kind:'賞金決勝',verified:true,source:t.sourceTracker,note};
 const entry={id:t.id,recordId:t.id,decision:'published',policy:V.POLICY,
 approvedAt:new Date().toISOString(),
 approvedBy:'ChatGPT / user-provided 2026-11-14 screenshots and original Epic UUIDs',
 source:t.sourceTracker,rule:t.rule,
 evidence:'User screenshot '+t.screenshot+'; original '+size+' Epic ID(s); exact final event and official VR cash table'};
 guard(V.verifyCashRow(r,entry),'new cash row failed independent verification '+t.id);
 results.push(r);ledger.entries.push(entry);added.push(r);
}
guard(results.length===oldCount+added.length&&new Set(results.map(r=>r.id)).size===results.length,
 'record count drift or ID collision');
const newCash=added.reduce((n,r)=>n+Math.round(r.prize*100),0);
guard(money(results)===beforeCash+newCash&&perPlayer(results)===beforePersonal+newCash,
 'per-player and team totals must change by exactly awarded VRs');
if(added.length){
 guard(!updates.entries.some(e=>e.id===proof.batch.id),'duplicate update log');
 updates.entries.unshift({id:proof.batch.id,date:'2026-11-14',type:'records',
 title:'2024 NAC Zero Build Solo決勝7件・Duos決勝3件を追加',
 description:'ユーザー提供Tracker画像10枚・全13選手枠のEpicアカウントIDと公式VR賞金表を照合。2024/6/25 NAC ZB Solo VC Event4 5件、6/18 Event3 2件、4/25 ZB Duos VC Event6 3件。個人$100/VR、デュオは$200/VR、計10戦績チーム賞金$1,500（個人配分合計$1,500）。既存りんたろう、TEITEI、KanA、favsie、たら、p1ng、Lnano、seljunyの本人プロフィールを保持。IPF ますたーにゃーだ、URZB まいと、wicxsyは新規登録。実際の入金は未確認。',
 recordIds:added.map(r=>r.id)});
}
const d=validateData({results,players,tournaments});
guard(!d.errors.length,'data check failed '+JSON.stringify(d.errors.slice(0,6)));
const a=audit(results,ledger,players);
guard(!a.length,'approval audit failed '+JSON.stringify(a.slice(0,6)));
const u=validateUpdateLog(results,updates);
guard(!u.length,'update history check failed '+JSON.stringify(u.slice(0,6)));
if(!dry&&(added.length||created.length)){
 if(added.length)publishResults(ROOT,results);
 write('players.json',players);
 write('approval-history.json',ledger);
 write('updates.json',updates);
}
console.log('NAC_ZB_VC_TEN '+JSON.stringify({
 mode:dry?'dry-run':'apply',newCount:added.length,already:already.length,
 addedUSD:newCash/100,created,recordsNow:results.length,
 records:added.map(x=>({id:x.id,rank:x.rank,prize:x.prize,player:x.player}))
}));
