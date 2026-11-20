'use strict';
// Replay-safe full-batch publisher: 7 NAW PS finals without cash + 3 Console
// duo 1VR prize teams. The known NAW teammate Shipski is not listed as an
// ASIA candidate; profile UUID is not invented.
const fs=require('node:fs'),path=require('node:path');
const {readResults,publishResults}=require('./source-results-store.cjs');
const {validateData,personalCents,roster}=require('./data-checks.cjs');
const {audit}=require('./validate-approvals.cjs');
const {validateUpdateLog}=require('./validate-updates.cjs');
const {upsertPublicationLog}=require('./reviewed-publication-core.cjs');
const V=require('./verified-s37-naw-ps-zero-console-three-20261120.cjs');
const ROOT=path.resolve(__dirname,'..');
const read=name=>JSON.parse(fs.readFileSync(path.join(ROOT,name),'utf8'));
const write=(name,obj)=>fs.writeFileSync(path.join(ROOT,name),JSON.stringify(obj,null,2)+'\n');
const must=(c,m)=>{if(!c)throw Error('S37_NAW_PS_CONSOLE_PUBLISH '+m)};
function apply({dryRun=false}={}){
 must(V.validateProof(),'screenshot evidence validation failed');
 const rows=readResults(ROOT).rows,players=read('players.json'),catalog=read('tournaments.json'),
  ledger=read('approval-history.json'),updates=read('updates.json');
 const known=new Set(players.candidates.map(p=>p.name)),
  aliases=new Map([...known].map(n=>[n,n]));
 for(const [name,list] of Object.entries(players.confirmedAliases||{})){
  must(known.has(name)&&Array.isArray(list),'invalid confirmed alias owner '+name);
  for(const alt of list){must(!aliases.has(alt)||aliases.get(alt)===name,
    'ambiguous existing alias '+alt);aliases.set(alt,name);}
 }
 for(const name of ['きみが死ぬまで恋をしたいɞ','えありー','ちゃる','3peace',
  'きおらび','AUR t3eny 19ǃ','モバイル勢のまかろん'])
  must(known.has(name),'previously verified canonical player missing '+name);
 must(aliases.get('Airy')==='えありー'&&aliases.get('charufn')==='ちゃる'&&
  aliases.get('BRN 916GonLuck')==='モバイル勢のまかろん',
  'existing player aliases not preserved');
 // Similar nickname is not an Epic identity: do not automatically merge
 // "ちゃんおに" with prior unrelated "kuro" alias.
 must(aliases.get('dyd チー牛ウン子漏らし')==='kuro',
  'existing kuro identity/short alias has changed');
 const targetIds=new Set(V.EXPECTED.flatMap(x=>x[4]).filter(Boolean));
 const owners=new Map();
 function capture(url,name){
  const uid=V.epicId(url);
  if(!uid||!targetIds.has(uid))return;
  const canonical=aliases.get(name)||name;
  must(!owners.has(uid)||owners.get(uid)===canonical,
   'Epic account '+uid+' is already assigned to '+owners.get(uid));
  owners.set(uid,canonical);
 }
 for(const row of rows){
  for(const p of row.profiles||[])capture(p.url,p.name);
  if(row.profileUrl&&(!row.players||row.players.length===1))
   capture(row.profileUrl,row.players?.[0]||row.player);
 }
 for(const p of players.candidates)if(p.epicAccountVerified&&p.trackerProfileUrl)
  capture(p.trackerProfileUrl,p.name);
 const initial={count:rows.length,team:rows.reduce((n,x)=>n+Math.round((x.prize||0)*100),0),
   personal:rows.reduce((n,x)=>n+personalCents(x)*roster(x).length,0)};
 const added=[],existing=[],newPlayers=[],newAliases=[];
 const approvedNew=new Set(V.DOC.expected.newPlayers);
 for(const x of V.DOC.batch.entries){
  const def=catalog.catalog.find(t=>t.id===x.tournamentId);
  must(def&&def.name===x.event&&def.seasonId==='S37'&&def.team===x.team&&
   def.mode==='battle-royale'&&def.sourceEventIds.includes(x.eventId),
   'unmapped tournament '+x.id);
  for(let i=0;i<x.playerNames.length;i++){
   const name=x.playerNames[i],raw=x.rawNames[i],url=x.profileUrls[i],uid=V.epicId(url);
   if(x.externalTeammates?.includes(name)){
    must(name==='Shipski'&&uid===null&&raw===name&&
      !known.has(name),'unverified NAW-only teammate must not be promoted to ASIA');
    continue;
   }
   must(uid&&(!owners.has(uid)||owners.get(uid)===name),
    'Epic ID already mapped to another person '+name+': '+uid);
   if(!known.has(name)){
    must(approvedNew.has(name)&&!aliases.has(name),
     'new player not expressly evidenced by provided screenshot/profile '+name);
    players.candidates.push({name,initials:Array.from(name).slice(0,2).join(''),
     accent:players.candidates.length%2?'cyan':'violet',
     desc:x.date+' NAW '+x.event+' 決勝'+x.rank+'位、'+x.kills+
      (x.team==='duo'?'チームK':'K')+'、'+x.vrs+'VR、'+
      (x.prize?'個人賞金$100':'決勝参加・賞金$0')+
      '。ユーザー提供のTracker画像とEpicプロフィールで本人を確認。',
     epicAccountVerified:true,trackerProfileUrl:url});
    known.add(name);aliases.set(name,name);newPlayers.push(name);
   }
   owners.set(uid,name);
   if(raw!==name&&aliases.get(raw)!==name){
    must(!aliases.has(raw),'raw name belongs to another player '+raw);
    if(!players.confirmedAliases[name])players.confirmedAliases[name]=[];
    players.confirmedAliases[name].push(raw);aliases.set(raw,name);
    newAliases.push({name,raw});
   }
  }
  const names=x.playerNames,profileIds=x.profileUrls.map(V.epicId).filter(Boolean);
  const conflict=rows.filter(r=>r.id===x.id||(r.date===x.date&&r.region==='NAW'&&
   r.tournamentId===x.tournamentId&&r.round===V.props(x.team==='solo'?'PS':'DUO').round&&
   (r.rank===x.rank||(r.players||[r.player]).some(n=>names.includes(aliases.get(n)||n))||
    (r.profiles||[]).some(p=>profileIds.includes(V.epicId(p.url)))||
    profileIds.includes(V.epicId(r.profileUrl)))));
  must(conflict.length<=1,'possible duplicate / same Epic account in round '+x.id);
  if(conflict.length){
   const old=conflict[0],approvals=ledger.entries.filter(e=>e.recordId===old.id);
   must(old.id===x.id&&approvals.length===1&&V.verifyRow(old,approvals[0]),
    'same event exists with conflicting source or amount '+x.id);
   existing.push(x.id);continue;
  }
  const row=V.project(x),entry=V.approval(x);
  must(V.verifyRow(row,entry),'approval could not verify row '+x.id);
  rows.push(row);ledger.entries.push(entry);added.push(row);
 }
 must(added.length+existing.length===10&&(added.length===0||added.length===10),
  'partial publication refused');
 must(newPlayers.length===(added.length?5:0),'new eligible player count differs');
 must(newAliases.length===(added.length?1:0),'new aliases differ');
 must(newAliases.length===0||newAliases[0].name==='ちゃんおに','must not reassign kuro alias');
 must(!players.candidates.some(p=>p.name==='Shipski'),'do not register NAW partner as ASIA');
 const dollars=added.reduce((n,x)=>n+Math.round(x.prize*100),0);
 must(rows.length===initial.count+added.length&&
  rows.reduce((n,x)=>n+Math.round((x.prize||0)*100),0)===initial.team+dollars&&
  rows.reduce((n,x)=>n+personalCents(x)*roster(x).length,0)===initial.personal+dollars,
  'existing prize totals or records changed');
 if(added.length){
  upsertPublicationLog(updates,{id:'owner-s37-naw-ps-zero-console-three-20261120',
   date:'2026-11-20',title:'2025 NAW PlayStation Cup決勝7名＋Consoleデュオ決勝3組',
   description:'画像1950〜1959、本人のTracker Epic ID・順位・キルを照合。2025年9/5 NAW PlayStation決勝は48〜96位7名が現金賞金$0、8/25 Console VCup Event2決勝は3チーム計3VR・チーム賞金合計$600（各選手$100）。ShipskiはNAW勢として扱い、本人未確認のEpic IDは作らない。旧kuro名義の同一人物断定もしない。',
   recordIds:added.map(x=>x.id)});
  updates.entries.sort((a,b)=>b.date.localeCompare(a.date));
 }
 const errors=validateData({results:rows,players,tournaments:catalog}).errors;
 must(!errors.length,'data errors: '+JSON.stringify(errors.slice(0,10)));
 const auditErrors=audit(rows,ledger,players);
 must(!auditErrors.length,'approval errors: '+JSON.stringify(auditErrors.slice(0,10)));
 const logErrors=validateUpdateLog(rows,updates);
 must(!logErrors.length,'update errors: '+JSON.stringify(logErrors.slice(0,10)));
 if(!dryRun&&added.length){
  publishResults(ROOT,rows);
  write('players.json',players);write('approval-history.json',ledger);write('updates.json',updates);
 }
 const status={mode:dryRun?'dry-run':'apply',added:added.length,alreadyPresent:existing.length,
  newPlayers,newAliases,prize:dollars/100,VRs:added.reduce((n,x)=>n+x.vrs,0),
  rows:added.map(x=>({id:x.id,players:x.players,rank:x.rank,kills:x.kills,prize:x.prize}))};
 console.log('S37_NAW_PS_CONSOLE '+JSON.stringify(status));
 return status;
}
if(require.main===module)try{
 const args=process.argv.slice(2);
 must(args.length===0||(args.length===1&&args[0]==='--dry-run'),'usage: [--dry-run]');
 apply({dryRun:args.includes('--dry-run')});
}catch(err){console.error(err.stack);process.exitCode=1;}
module.exports={apply};
