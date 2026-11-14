'use strict';
// Idempotent, fail-closed publication for 2025 NAW Squads, 2024 ME Duos Cash,
// and seven 2024 ME Boter FNCS Cup duos. All scores and Epic IDs are user-provided.
const fs=require('node:fs'),path=require('node:path');
const {readResults,publishResults}=require('./source-results-store.cjs');
const {validateData,personalCents,roster}=require('./data-checks.cjs');
const {audit}=require('./validate-approvals.cjs');
const {validateUpdateLog}=require('./validate-updates.cjs');
const V=require('./verified-boter-s31-s38-nine.cjs');
const ROOT=path.resolve(__dirname,'..');
const read=name=>JSON.parse(fs.readFileSync(path.join(ROOT,name),'utf8'));
const write=(name,obj)=>fs.writeFileSync(path.join(ROOT,name),JSON.stringify(obj,null,2)+'\n');
const fail=(ok,why)=>{if(!ok)throw Error('B0TER_S31_S38_NINE: '+why)};
const args=process.argv.slice(2),dry=args.includes('--dry-run');
fail(args.length===0||(args.length===1&&dry),'only --dry-run is supported');
const proof=read('data/manual-approvals/20261114-boter7-me-duos-s38-squad-nine-proof.json');
fail(proof.version===1&&proof.batch?.id==='tracker-20261114-boter7-me-duos-s38-squad-nine'&&
 JSON.stringify(proof.batch.targets)===JSON.stringify(V.TARGETS)&&
 proof.batch.targets.length===9,'locked screenshot proof differs from independent oracle');
const results=readResults(ROOT).rows,players=read('players.json'),tournaments=read('tournaments.json');
const ledger=read('approval-history.json'),updates=read('updates.json');
fail(Array.isArray(results)&&Array.isArray(players.candidates)&&Array.isArray(ledger.entries)&&
  Array.isArray(updates.entries),'invalid repository data');
const oldResultIds=new Set(results.map(r=>r.id)),beforeCount=results.length;
fail(oldResultIds.size===results.length,'old result IDs already duplicated');
const byId=new Map(results.map(r=>[r.id,r]));
const cashTotal=arr=>arr.reduce((n,r)=>n+Math.round((r.prize||0)*100),0);
const personalTotal=arr=>arr.reduce((n,r)=>n+personalCents(r)*roster(r).length,0);
const oldCash=cashTotal(results),oldPersonal=personalTotal(results);
const names=new Set(players.candidates.map(p=>p.name)),owners=new Map([...names].map(n=>[n,n]));
for(const [canonical,aliases] of Object.entries(players.confirmedAliases||{})){
 fail(names.has(canonical)&&Array.isArray(aliases),'invalid existing player alias owner '+canonical);
 for(const alias of aliases){
  fail(!owners.has(alias)||owners.get(alias)===canonical,'ambiguous existing alias '+alias);
  owners.set(alias,canonical);
 }
}
fail(names.has('Pegu')&&owners.get('pegu')==='Pegu','pegu must belong to existing Pegu');
fail(names.has('Yama')&&names.has('yama')&&
  owners.get('UC.Yama 橘')==='Yama'&&owners.get('Yama')==='Yama'&&owners.get('yama')==='yama',
  'UC.Yama 橘 must be separate from lowercase yama');
fail(names.has('ぷろぼこ')&&owners.get('Puroboko')==='ぷろぼこ','Puroboko alias mismatch');
let createdGoat=false;
if(!names.has('goat playerfnbr')){
 fail(!owners.has('goat playerfnbr'),'goat playerfnbr is already someone else alias');
 players.candidates.push({name:'goat playerfnbr',initials:'GP',accent:'cyan',
  desc:'2024/9/7 ME Boter FNCS Cup（FNCS Influencer Cup）決勝で、ばぶっちと46位・100pt・3チームキル・1VR・チーム$200（個人$100）。本人Tracker Epic ID e8815502-3abd-4dc7-a5ae-013c4d7dc00cを確認。'});
 names.add('goat playerfnbr');owners.set('goat playerfnbr','goat playerfnbr');createdGoat=true;
}
fail(owners.get('goat playerfnbr')==='goat playerfnbr','goat account is owned by another player');
const windows=new Map();
for(const month of ['2024-09','2025-11']){
 const cal=read('calendar-history/'+month+'.json');
 fail(Array.isArray(cal.sessions),'missing competition calendar '+month);
 for(const session of cal.sessions)windows.set(session.sourceWindowId,session);
}
const expectedRank=[12,22,28,37,40,43,46,47,48];
fail(V.TARGETS.every((t,i)=>t.rank===expectedRank[i]),'target rank list drift');
const additions=[],existing=[];
for(const t of V.TARGETS){
 const size=t.players.length;
 fail(size===(t.seasonId==='S38'?4:2),'incorrect tournament team size '+t.id);
 fail(t.profiles.length===size&&new Set(t.players).size===size,'duplicate team member '+t.id);
 for(let i=0;i<size;i++){
  const p=t.profiles[i];
  fail(names.has(p.name)&&owners.get(p.name)===p.name&&p.name===t.players[i]&&
   V.uuid(p.url)===p.id,'unverified original Epic ID for '+t.id+' '+p.name);
  const trackerAlias=p.raw;
  fail(owners.get(trackerAlias)===p.name||trackerAlias.trim()===p.name,
   'Tracker display name/alias belongs to a different player '+p.name+' '+trackerAlias);
  for(const r of results){
   for(const rp of r.profiles||[]){
    if(V.uuid(rp.url)===p.id)
     fail(owners.get(rp.name)===p.name||rp.name===p.name,
      'original Epic UUID is already associated with another player '+p.name+' vs '+rp.name);
   }
  }
 }
 const cat=tournaments.catalog.find(c=>c.id===t.tournamentId);
 fail(cat&&cat.name===t.event&&cat.seasonId===t.seasonId&&cat.chapter===t.chapter&&
  cat.season===t.season&&cat.team===(size===4?'squad':'duo')&&cat.mode==='battle-royale'&&
  cat.sourceEventIds.includes(t.eventId),'incorrect tournament catalog record '+t.id);
 const slot=windows.get(t.windowId);
 fail(slot&&slot.dateJst===t.date&&slot.region===t.region&&slot.eventId===t.eventId&&
  slot.tournamentId===t.tournamentId||(
   // Legacy Influencer Cup region slots pre-date the per-region Boter catalog:
   slot&&t.eventId==='S31_InfluencerCup'&&slot.dateJst===t.date&&
   slot.region===t.region&&slot.eventId===t.eventId&&slot.sourceWindowId===t.windowId),
   'not the official 2024/2025 match day and final window '+t.id);
 fail(t.windowId.includes('Round2')&&
   t.sourceTracker==='https://fortnitetracker.com/events/epicgames_'+t.eventId+'_'+t.region+'?window='+t.windowId,
   'untrusted or wrong Tracker event window '+t.id);
 fail(t.matches>=1&&t.matches<=6&&t.kills>=0&&t.vrs>=0&&t.vrs<=t.matches&&
   V.payout(t)===t.prize&&t.prizePerPlayer*size===t.prize,
   'wrong official rank/VR prize '+t.id);
 if(t.eventId!=='S31_DuosCashCup')fail(t.points===t.vrs*100&&t.vrs===1&&t.matches<=3,'wrong VR final scores '+t.id);
 else fail(t.rank===22&&t.points===106&&t.matches===6&&t.vrs===0&&t.kills===10,'2024 ME Duos cash final score drift');
 if(t.eventId==='S31_InfluencerCup')fail(t.rule===V.RULES.influencer,'Boter rule mismatch');
 else if(t.eventId==='S31_DuosCashCup')fail(t.rule===V.RULES.duos,'cash rule mismatch');
 else fail(t.rule===V.RULES.squads,'squad rule mismatch');
 const old=byId.get(t.id), prior=ledger.entries.filter(e=>e.recordId===t.id);
 if(old){
  fail(prior.length===1&&V.verifyCashRow(old,prior[0]),'old approved row was altered '+t.id);
  existing.push(t.id);continue;
 }
 fail(prior.length===0,'orphan approved ID '+t.id);
 const matches=results.filter(r=>r.seasonId===t.seasonId&&r.date===t.date&&
   r.region===t.region&&r.tournamentId===t.tournamentId&&
   (r.rank===t.rank||(Array.isArray(r.players)&&
    JSON.stringify([...r.players].sort())===JSON.stringify([...t.players].sort()))));
 fail(matches.length===0,'existing same-team/rank event conflict '+t.id+': '+matches.map(x=>x.id).join(','));
 const player=t.players.join(' / ');
 const note='ユーザー提供2026/11/14 Fortnite Tracker画像「'+t.screenshot+'」と各選手のEpic IDを照合。'+
  t.date+' '+t.region+' '+t.event+' '+t.round+'：'+t.rank+'位、'+t.points+'pt、'+
  t.matches+'試合、'+t.kills+'チームキル、'+t.vrs+'VR。公式賞金規則によりチーム$'+t.prize+
  '、各選手$'+t.prizePerPlayer+'。実際の支払完了は未確認。Tracker: '+t.sourceTracker+' Rule: '+t.rule;
 const row={id:t.id,date:t.date,region:t.region,event:t.event,round:t.round,kind:'賞金決勝',
  player,playerRaw:t.playerRaw,players:[...t.players],
  profiles:t.profiles.map(p=>({name:p.name,url:p.url})),
  teamAccountIds:t.profiles.map(p=>p.id.replace(/-/g,'')),
  rank:t.rank,points:t.points,matches:t.matches,kills:t.kills,vrs:t.vrs,prize:t.prize,
  teamPrize:t.prize,prizePerPlayer:t.prizePerPlayer,source:t.sourceTracker,verified:true,
  seasonId:t.seasonId,chapter:t.chapter,season:t.season,tournamentId:t.tournamentId,note};
 const entry={id:t.id,recordId:t.id,decision:'published',policy:V.POLICY,
   approvedAt:new Date().toISOString(),approvedBy:'ChatGPT / user screenshot and Epic account IDs 2026-11-14',
   source:t.sourceTracker,rule:t.rule,
   evidence:'Screenshot '+t.screenshot+' and '+size+' original Epic account UUIDs; exact final rank/VR and Epic prize table'};
 fail(V.verifyCashRow(row,entry),'new record failed independent cash/identity audit '+t.id);
 results.push(row);ledger.entries.push(entry);additions.push(row);
}
fail(results.length===beforeCount+additions.length&&
  new Set(results.map(r=>r.id)).size===results.length,'unintended record overwrite/deletion');
const addedMoney=additions.reduce((n,r)=>n+Math.round(r.prize*100),0);
fail(cashTotal(results)===oldCash+addedMoney&&
 personalTotal(results)===oldPersonal+addedMoney,'team/personal cash totals changed unexpectedly');
if(additions.length){
 fail(!updates.entries.some(x=>x.id===proof.batch.id),'duplicate update ID');
 updates.entries.unshift({id:proof.batch.id,date:'2026-11-14',type:'records',
  title:'2024 ME Boter FNCS Cup7組・ME Duos Cash1組、2025 NAW Squads1組の賞金を追加',
  description:'ユーザー提供Tracker 9枚と計17のEpic UUID、公式賞金ルール、現存の大会枠を照合。Boter FNCS CupをME大会として新規登録。2025/11/10 NAW Squads 12位チーム$400、2024/9/13 ME Duos Cash 22位チーム$200、2024/9/7 ME Boter FNCS Cup決勝7組各チーム$200。9戦績、計チーム賞金$2,000（個人配分合計$2,000）。Pegu/peguとぷろぼこ/Purobokoを統一し、UC.Yama 橘はYamaとして小文字yamaとは別管理。既存賞金・他日付の戦績は保持。実際の入金は未確認。',
  recordIds:additions.map(r=>r.id)});
}
const d=validateData({results,players,tournaments});
fail(!d.errors.length,'data validation: '+JSON.stringify(d.errors.slice(0,6)));
const a=audit(results,ledger,players);
fail(!a.length,'approval audit: '+JSON.stringify(a.slice(0,6)));
const u=validateUpdateLog(results,updates);
fail(!u.length,'updates audit: '+JSON.stringify(u.slice(0,6)));
if(!dry&&(additions.length||createdGoat)){
 if(additions.length)publishResults(ROOT,results);
 write('players.json',players);
 write('approval-history.json',ledger);
 write('updates.json',updates);
}
console.log('B0TER_S31_S38_NINE '+JSON.stringify({
 mode:dry?'dry-run':'apply',newRows:additions.length,existingRows:existing.length,
 cashAdded:addedMoney/100,afterCount:results.length,newPlayer:createdGoat?'goat playerfnbr':null,
 rows:additions.map(r=>({id:r.id,rank:r.rank,players:r.players,prize:r.prize}))
}));
