'use strict';
// Replay-safe append-only publisher: validates all original screenshots and
// source windows before writing. A conflicting existing row is a hard failure.
const fs=require('node:fs'),path=require('node:path');
const {readResults,publishResults}=require('./source-results-store.cjs');
const {validateData,personalCents,roster}=require('./data-checks.cjs');
const {audit}=require('./validate-approvals.cjs');
const {validateUpdateLog}=require('./validate-updates.cjs');
const {upsertPublicationLog}=require('./reviewed-publication-core.cjs');
const V=require('./verified-s30-oce-s37-naw-ten-20261120.cjs');
const ROOT=path.resolve(__dirname,'..');
const read=name=>JSON.parse(fs.readFileSync(path.join(ROOT,name),'utf8'));
const write=(name,obj)=>fs.writeFileSync(path.join(ROOT,name),JSON.stringify(obj,null,2)+'\n');
const must=(x,message)=>{if(!x)throw Error('OCE_ZB_NAW_PS_TEN_PUBLISH '+message)};
function apply({dryRun=false}={}){
 must(V.validateProof()===true,'original screenshot proof changed');
 const rows=readResults(ROOT).rows,players=read('players.json'),
  tournaments=read('tournaments.json'),ledger=read('approval-history.json'),
  updates=read('updates.json');
 const known=new Set(players.candidates.map(x=>x.name));
 const aliases=new Map([...known].map(n=>[n,n]));
 for(const [name,alternate] of Object.entries(players.confirmedAliases||{})){
  must(known.has(name)&&Array.isArray(alternate),'invalid existing alias owner');
  for(const alt of alternate){
   must(!aliases.has(alt)||aliases.get(alt)===name,'existing ambiguous alias: '+alt);
   aliases.set(alt,name);
  }
 }
 for(const name of ['かわあと','りむた','モバイル勢のまかろん','Jaemon','sena','ちからV2'])
  must(known.has(name),'existing canonical player must be retained: '+name);
 must(aliases.get('Blue_P かわあと')==='かわあと'&&
  aliases.get('BRN 916GonLuck')==='モバイル勢のまかろん'&&
  aliases.get('ちからv2')==='ちからV2',
  'existing player identities changed');
 const targetUuids=new Set(V.TUPLES.map(t=>t[11])),owners=new Map();
 function capture(url,name){
  const uid=V.uuid(url);
  if(!uid||!targetUuids.has(uid))return;
  const canonical=aliases.get(name)||name;
  must(!owners.has(uid)||owners.get(uid)===canonical,
   'another player already owns original Epic account '+uid+': '+canonical);
  owners.set(uid,canonical);
 }
 for(const row of rows){
  for(const profile of row.profiles||[])capture(profile.url,profile.name);
  if(row.profileUrl&&(!row.players||row.players.length===1))
   capture(row.profileUrl,row.players?.[0]||row.player);
 }
 for(const p of players.candidates)if(p.epicAccountVerified===true&&p.trackerProfileUrl)
  capture(p.trackerProfileUrl,p.name);
 const initial={total:rows.length,cash:rows.reduce((n,r)=>n+Math.round((r.prize||0)*100),0),
  personal:rows.reduce((n,r)=>n+personalCents(r)*roster(r).length,0)};
 const added=[],existing=[],newPlayers=[],newAliases=[];
 const allowNew=new Set(['CRT koyful','おかっぱがふ子','グラッセパルフェ']);
 for(const x of V.DOC.batch.entries){
  const def=tournaments.catalog.find(t=>t.id===x.tournamentId);
  must(def&&def.name===x.event&&def.seasonId===x.seasonId&&
   def.sourceEventIds.includes(x.eventId)&&def.team==='solo'&&
   def.mode===(x.region==='OCE'?'zero-build':'battle-royale'),
   'tournament catalog mismatch '+x.id);
  const name=x.playerNames[0],raw=x.playerRaw,uid=V.uuid(x.profileUrls[0]);
  must(uid&&(!owners.has(uid)||owners.get(uid)===name),
   'Epic account ID belongs to another player '+name);
  if(!known.has(name)){
   must(allowNew.has(name)&&!aliases.has(name),
    'new canonical player not approved: '+name);
   players.candidates.push({name,initials:Array.from(name).slice(0,2).join(''),
    accent:players.candidates.length%2?'cyan':'violet',
    desc:x.date+' '+x.region+' '+x.event+'決勝'+x.rank+'位、'+x.kills+
     'K、'+x.vrs+'VR、個人賞金$'+x.prize+
     '。ユーザーのTracker画像と本人EpicプロフィールIDで確認。',
    epicAccountVerified:true,trackerProfileUrl:x.profileUrls[0]});
   known.add(name);aliases.set(name,name);newPlayers.push(name);
  }
  owners.set(uid,name);
  if(raw!==name&&aliases.get(raw)!==name){
   must(!aliases.has(raw),'raw name already assigned to another player '+raw);
   if(!players.confirmedAliases[name])players.confirmedAliases[name]=[];
   players.confirmedAliases[name].push(raw);aliases.set(raw,name);
   newAliases.push({name,raw});
  }
  // Other date, region or different event rounds can be separate results.
  const conflicts=rows.filter(r=>r.id===x.id||(r.date===x.date&&r.region===x.region&&
   r.tournamentId===x.tournamentId&&r.kind==='賞金決勝'&&
   (r.rank===x.rank||(r.players||[r.player]).some(n=>(aliases.get(n)||n)===name)||
    (r.profiles||[]).some(p=>V.uuid(p.url)===uid)||V.uuid(r.profileUrl)===uid)));
  must(conflicts.length<=1,'duplicate or conflicted result '+x.id);
  if(conflicts.length){
   const old=conflicts[0],matches=ledger.entries.filter(a=>a.recordId===old.id);
   must(old.id===x.id&&matches.length===1&&V.verifyRow(old,matches[0]),
    'existing result differs from original screenshot '+x.id);
   existing.push(x.id);continue;
  }
  const row=V.project(x),approval=V.approval(x);
  must(V.verifyRow(row,approval),'review policy could not verify '+x.id);
  rows.push(row);ledger.entries.push(approval);added.push(row);
 }
 must(added.length+existing.length===10&&(added.length===0||added.length===10),
  'partial submission must not be silently published');
 must(newPlayers.length===(added.length?3:0),'unexpected new identity count');
 must(newAliases.length===(added.length?1:0),'unexpected new profile alias count');
 const cash=added.reduce((n,x)=>n+Math.round(x.prize*100),0);
 must(rows.length===initial.total+added.length&&
  rows.reduce((n,r)=>n+Math.round((r.prize||0)*100),0)===initial.cash+cash&&
  rows.reduce((n,r)=>n+personalCents(r)*roster(r).length,0)===initial.personal+cash,
  'existing cash or personal prize totals unexpectedly changed');
 if(added.length){
  upsertPublicationLog(updates,{id:'owner-s30-oce-zb-s37-naw-ten-20261120',
   date:'2026-11-20',title:'2024 OCE ZB Solo + 2025 NAW PlayStation決勝 10件・個人賞金$2,300',
   description:'画像1939〜1941・1943〜1949で本人Epic ID、キル、順位、VRと賞金を照合。OCE Event4 Round2：6人・7VR・$700。NAW PlayStation Cup Final：Jaemon・モバイル勢のまかろん・sena・ちからV2の4人、各0VR・順位賞金$400。りむたの別名A_α Rimutaを追加。既存データは変更なし。',
   recordIds:added.map(r=>r.id)});
  updates.entries.sort((a,b)=>b.date.localeCompare(a.date));
 }
 const invalid=validateData({results:rows,players,tournaments}).errors;
 must(!invalid.length,'data validation: '+JSON.stringify(invalid.slice(0,6)));
 const auditErrors=audit(rows,ledger,players);
 must(!auditErrors.length,'approval audit: '+JSON.stringify(auditErrors.slice(0,6)));
 const logErrors=validateUpdateLog(rows,updates);
 must(!logErrors.length,'update log audit: '+JSON.stringify(logErrors.slice(0,6)));
 if(!dryRun&&added.length){
  publishResults(ROOT,rows);
  write('players.json',players);write('approval-history.json',ledger);write('updates.json',updates);
 }
 const report={mode:dryRun?'dry-run':'apply',added:added.length,existing:existing.length,
  newPlayers,newAliases,addedCash:cash/100,addedWins:added.reduce((n,x)=>n+x.vrs,0),
  total:rows.length,rows:added.map(x=>({name:x.player,id:x.id,rank:x.rank,kills:x.kills,
  vrs:x.vrs,prize:x.prize}))};
 console.log('OCE_ZB_NAW_PS_TEN '+JSON.stringify(report));return report;
}
if(require.main===module)try{
 const args=process.argv.slice(2);
 must(args.length===0||(args.length===1&&args[0]==='--dry-run'),'usage: [--dry-run]');
 apply({dryRun:args.includes('--dry-run')});
}catch(e){console.error(e.stack);process.exitCode=1;}
module.exports={apply};
