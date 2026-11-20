'use strict';
// Append-only replayable publisher of user screenshots 1960–1969.
// Verifies all tournament windows, player UUIDs, $/VR and alias ownership.
const fs=require('node:fs'),path=require('node:path');
const {readResults,publishResults}=require('./source-results-store.cjs');
const {validateData,personalCents,roster}=require('./data-checks.cjs');
const {audit}=require('./validate-approvals.cjs');
const {validateUpdateLog}=require('./validate-updates.cjs');
const {upsertPublicationLog}=require('./reviewed-publication-core.cjs');
const V=require('./verified-s21-s22-s35-s36-s37-ten-20261121.cjs');
const ROOT=path.resolve(__dirname,'..');
const read=name=>JSON.parse(fs.readFileSync(path.join(ROOT,name),'utf8'));
const write=(name,obj)=>fs.writeFileSync(path.join(ROOT,name),JSON.stringify(obj,null,2)+'\n');
const must=(cond,msg)=>{if(!cond)throw Error('HISTORIC_TEN_PUBLISH '+msg)};
function apply({dryRun=false}={}){
 must(V.validateProof()===true,'screenshot, rank or official rule proof missing');
 const rows=readResults(ROOT).rows,players=read('players.json'),
  catalog=read('tournaments.json'),ledger=read('approval-history.json'),updates=read('updates.json');
 const known=new Set(players.candidates.map(x=>x.name));
 const aliases=new Map([...known].map(name=>[name,name]));
 for(const [name,values] of Object.entries(players.confirmedAliases||{})){
  must(known.has(name)&&Array.isArray(values),'invalid existing alias owner');
  for(const alt of values){must(!aliases.has(alt)||aliases.get(alt)===name,
   'ambiguous existing alias: '+alt);aliases.set(alt,name);}
 }
 for(const name of ['Hakkun','TEITEI','Asuka','あおねこ','モバイル勢のまかろん','かぷせるてぃーてぃーTTていてい'])
  must(known.has(name),'previously verified player missing: '+name);
 must(aliases.get('RAGE Hakkun')==='Hakkun'&&
   aliases.get('Celis あおねこ416')==='あおねこ'&&
   aliases.get('BRN 916GonLuck')==='モバイル勢のまかろん',
   'previous aliases unexpectedly changed');
 const allowedNew=new Set(V.DOC.expected.newPlayers),targetIds=new Set(V.GOLD.flatMap(x=>x[5]));
 const owners=new Map();
 function capture(url,name){
  const uid=V.epicId(url);if(!uid||!targetIds.has(uid))return;
  const canonical=aliases.get(name)||name;
  must(!owners.has(uid)||owners.get(uid)===canonical,
   'existing Epic account belongs to another player '+uid+' '+canonical);
  owners.set(uid,canonical);
 }
 for(const r of rows){
  for(const p of r.profiles||[])capture(p.url,p.name);
  if(r.profileUrl&&(!r.players||r.players.length===1))
   capture(r.profileUrl,r.players?.[0]||r.player);
 }
 for(const p of players.candidates)if(p.epicAccountVerified&&p.trackerProfileUrl)
  capture(p.trackerProfileUrl,p.name);
 const before={records:rows.length,team:rows.reduce((n,x)=>n+Math.round((x.prize||0)*100),0),
  personal:rows.reduce((n,x)=>n+personalCents(x)*roster(x).length,0)};
 const added=[],existing=[],newPlayers=[],newAliases=[];
 for(const x of V.DOC.batch.entries){
  const t=catalog.catalog.find(z=>z.id===x.tournamentId);
  must(t&&t.name===x.event&&t.seasonId===x.seasonId&&t.team===x.team&&
    t.mode==='battle-royale'&&t.sourceEventIds.includes(x.eventId),
    'tournament type could not be verified '+x.id);
  for(let i=0;i<x.playerNames.length;i++){
   const name=x.playerNames[i],raw=x.rawNames[i],url=x.profileUrls[i],uid=V.epicId(url);
   must(uid&&(!owners.has(uid)||owners.get(uid)===name),
    'Epic UUID conflicts with existing player '+name+' '+uid);
   if(!known.has(name)){
    must(allowedNew.has(name)&&!aliases.has(name),'unexpected player '+name);
    players.candidates.push({name,initials:Array.from(name).slice(0,2).join(''),
     accent:players.candidates.length%2?'cyan':'violet',
     desc:x.date+' '+x.region+' '+x.event+' 賞金決勝'+x.rank+
      '位・'+x.kills+(x.team==='duo'?'チームK':'K')+'・'+x.vrs+'VR・個人賞金$'+
      x.prizePerPlayer+'。ユーザー画像・Fortnite Tracker本人Epic IDで確認。',
     epicAccountVerified:true,trackerProfileUrl:url});
    known.add(name);aliases.set(name,name);newPlayers.push(name);
   }
   owners.set(uid,name);
   if(raw!==name&&aliases.get(raw)!==name){
    must(!aliases.has(raw),'raw name already belongs to someone else '+raw);
    if(!players.confirmedAliases[name])players.confirmedAliases[name]=[];
    players.confirmedAliases[name].push(raw);
    aliases.set(raw,name);newAliases.push({name,raw});
   }
  }
  const meta=V.META[x.seasonId],ids=x.profileUrls.map(V.epicId),names=x.playerNames;
  const conflicts=rows.filter(r=>r.id===x.id||(r.date===x.date&&r.region===x.region&&
   (r.tournamentId===x.tournamentId||r.source===x.source)&&
   (r.rank===x.rank||(r.players||[r.player]).some(n=>names.includes(aliases.get(n)||n))||
   (r.profiles||[]).some(p=>ids.includes(V.epicId(p.url)))||
   ids.includes(V.epicId(r.profileUrl)))));
  must(conflicts.length<=1,'duplicate or conflicting row '+x.id);
  if(conflicts.length){
   const prior=conflicts[0],approvals=ledger.entries.filter(a=>a.recordId===prior.id);
   must(prior.id===x.id&&approvals.length===1&&V.verifyRow(prior,approvals[0]),
     'existing entry does not match source screenshot '+x.id);
   existing.push(x.id);continue;
  }
  const row=V.project(x),approval=V.approval(x);
  must(V.verifyRow(row,approval),'approval not consistent '+x.id);
  rows.push(row);ledger.entries.push(approval);added.push(row);
 }
 must(added.length+existing.length===10&&(added.length===0||added.length===10),
  'partial import rejected');
 must(newPlayers.length===(added.length?6:0),'unexpected new player count');
 must(JSON.stringify(newAliases)===JSON.stringify(added.length?[
  {name:'Hakkun',raw:'TGR はっくん'},
  {name:'irodori',raw:'FA irodori'},
  {name:'かぷせるてぃーてぃーTTていてい',raw:'Pollo 17 ǃ ǃ'}]:[]),'unexpected alias changes');
 const winnings=added.reduce((n,r)=>n+Math.round(r.prize*100),0);
 must(rows.length===before.records+added.length&&
  rows.reduce((n,r)=>n+Math.round((r.prize||0)*100),0)===before.team+winnings&&
  rows.reduce((n,r)=>n+personalCents(r)*roster(r).length,0)===before.personal+winnings,
  'existing team or per-player prize totals changed');
 if(added.length){
  upsertPublicationLog(updates,{id:'owner-s21-s22-s35-s36-s37-ten-20261121',
   date:'2026-11-21',title:'2022 PlayStation Cup＋2025 NAWデュオ決勝 計10件・$2,000',
   description:'ユーザー画像1960〜1969で10開催成績を照合。S35・S36・S37のNAWデュオ決勝6組＝合計6VR、チーム賞金$1,200（各選手$100）。S21のOCE・S22のNAW PlayStation決勝4件＝順位賞金$800（0VR・個人$200）。Epic公式開催IDと本人UUIDによる照合、重複防止、新規6名・別名義3件。',
   recordIds:added.map(x=>x.id)});
  updates.entries.sort((a,b)=>b.date.localeCompare(a.date));
 }
 const errors=validateData({results:rows,players,tournaments:catalog}).errors;
 must(!errors.length,'data check failed '+JSON.stringify(errors.slice(0,9)));
 const audits=audit(rows,ledger,players);
 must(!audits.length,'approval verification failed '+JSON.stringify(audits.slice(0,9)));
 const logs=validateUpdateLog(rows,updates);
 must(!logs.length,'update history failed '+JSON.stringify(logs.slice(0,9)));
 if(!dryRun&&added.length){
  publishResults(ROOT,rows);
  write('players.json',players);write('approval-history.json',ledger);write('updates.json',updates);
 }
 const report={mode:dryRun?'dry-run':'apply',added:added.length,
  existing:existing.length,newPlayers,newAliases,prize:winnings/100,
  vr:added.reduce((n,x)=>n+x.vrs,0),count:rows.length,
  records:added.map(x=>({id:x.id,players:x.players,rank:x.rank,prize:x.prize,vrs:x.vrs}))};
 console.log('HISTORICAL_TEN_PUBLISHED '+JSON.stringify(report));return report;
}
if(require.main===module)try{
 const args=process.argv.slice(2);
 must(args.length===0||(args.length===1&&args[0]==='--dry-run'),'Usage: [--dry-run]');
 apply({dryRun:args.includes('--dry-run')});
}catch(err){console.error(err.stack);process.exitCode=1;}
module.exports={apply};
