'use strict';
// Replay-safe NAC S28 Zero Build Duos publisher, three user-reviewed Round2 teams.
// Retains all previously published results, rank payouts and confirmed aliases.
const fs=require('node:fs'),path=require('node:path');
const {readResults,publishResults}=require('./source-results-store.cjs');
const {validateData,personalCents,roster}=require('./data-checks.cjs');
const {audit}=require('./validate-approvals.cjs');
const {validateUpdateLog}=require('./validate-updates.cjs');
const {upsertPublicationLog}=require('./reviewed-publication-core.cjs');
const V=require('./verified-s28-nac-zb-duos-three-20261119.cjs');
const ROOT=path.resolve(__dirname,'..');
const read=file=>JSON.parse(fs.readFileSync(path.join(ROOT,file),'utf8'));
const write=(file,value)=>fs.writeFileSync(path.join(ROOT,file),JSON.stringify(value,null,2)+'\n');
const must=(ok,msg)=>{if(!ok)throw Error('S28_NAC_ZB_DUOS_3_PUBLISH '+msg)};
function apply({dryRun=false}={}){
 must(V.validateProof()===true,'screenshot proof changed');
 const rows=readResults(ROOT).rows,players=read('players.json'),tournaments=read('tournaments.json');
 const ledger=read('approval-history.json'),updates=read('updates.json');
 const known=new Set(players.candidates.map(p=>p.name));
 const aliases=new Map([...known].map(n=>[n,n]));
 for(const [name,list] of Object.entries(players.confirmedAliases||{})){
  must(known.has(name)&&Array.isArray(list),'broken alias owner '+name);
  for(const alias of list){
   must(!aliases.has(alias)||aliases.get(alias)===name,'ambiguous alias '+alias);
   aliases.set(alias,name);
  }
 }
 for(const name of ['こいる','sena','モバイル勢のまかろん'])
  must(known.has(name),'existing canonical player missing: '+name);
 must(aliases.get('BRN 916GonLuck')==='モバイル勢のまかろん',
  'existing macaron alias changed');
 const targetIds=new Set(V.TUPLES.flatMap(t=>t[8]));
 const owners=new Map();
 function capture(url,name){
  const id=V.uuid(url);
  if(!id||!targetIds.has(id))return;
  const canonical=aliases.get(name)||name;
  must(!owners.has(id)||owners.get(id)===canonical,
   'previous Epic account ID belongs to different player: '+id+' '+canonical);
  owners.set(id,canonical);
 }
 for(const row of rows){
  for(const p of row.profiles||[])capture(p.url,p.name);
  if(row.profileUrl&&(!row.players||row.players.length===1))
   capture(row.profileUrl,row.players?.[0]||row.player);
 }
 for(const p of players.candidates)if(p.epicAccountVerified===true&&p.trackerProfileUrl)
  capture(p.trackerProfileUrl,p.name);
 const starting={count:rows.length,
  prize:rows.reduce((n,x)=>n+Math.round((x.prize||0)*100),0),
  personal:rows.reduce((n,x)=>n+personalCents(x)*roster(x).length,0)};
 const added=[],existing=[],newPlayers=[],newAliases=[];
 const allowNew=new Set(['たまふぃっしー2号だよーん','ろる']);
 for(const x of V.DOC.batch.entries){
  const catalog=tournaments.catalog.find(t=>t.id===x.tournamentId);
  must(catalog&&catalog.name==='Zero Build Duos Victory Cup'&&catalog.team==='duo'&&
   catalog.mode==='zero-build'&&catalog.seasonId==='S28'&&
   catalog.sourceEventIds.includes(V.EVENT),'unknown original ZB tournament '+x.id);
  for(let i=0;i<2;i++){
   const name=x.playerNames[i],raw=x.rawNames[i],url=x.profileUrls[i],uid=V.uuid(url);
   must(uid&&(!owners.has(uid)||owners.get(uid)===name),'Epic ID belongs to another player: '+name);
   if(!known.has(name)){
    must(allowNew.has(name)&&!aliases.has(name),'unverified new canonical player '+name);
    players.candidates.push({name,initials:Array.from(name).slice(0,2).join(''),
     accent:players.candidates.length%2?'cyan':'violet',
     desc:x.date+' NAC Zero Build Duos Victory Cup賞金決勝'+x.rank+
      '位、チーム'+x.kills+'K・1VR・個人賞金$100。ユーザー提供Tracker順位表と本人プロフィールIDで確認。',
     epicAccountVerified:true,trackerProfileUrl:url});
    known.add(name);aliases.set(name,name);newPlayers.push(name);
   }
   owners.set(uid,name);
   if(raw!==name&&aliases.get(raw)!==name){
    must(!aliases.has(raw),'raw profile name already owned by someone else: '+raw);
    if(!players.confirmedAliases[name])players.confirmedAliases[name]=[];
    players.confirmedAliases[name].push(raw);aliases.set(raw,name);
    newAliases.push({name,raw});
   }
  }
  // Round1 is a separate achievement, and may coexist with this exact Round2.
  const conflicts=rows.filter(r=>r.id===x.id||(r.date===x.date&&r.region==='NAC'&&
   r.tournamentId===V.TOURNAMENT&&r.kind==='賞金決勝'&&
   (r.rank===x.rank||(r.players||[r.player]).some(n=>x.playerNames.includes(n))||
    (r.profiles||[]).some(p=>x.profileUrls.some(url=>V.uuid(url)===V.uuid(p.url))))));
  must(conflicts.length<=1,'duplicate or conflicting finals rank/player '+x.id);
  if(conflicts.length){
   const old=conflicts[0],original=ledger.entries.filter(a=>a.recordId===old.id);
   must(old.id===x.id&&original.length===1&&V.verifyRow(old,original[0]),
    'existing final does not match the original screenshot '+x.id);
   existing.push(x.id);continue;
  }
  const row=V.project(x),entry=V.approval(x);
  must(V.verifyRow(row,entry),'verification rejected new screenshot result '+x.id);
  rows.push(row);ledger.entries.push(entry);added.push(row);
 }
 must(existing.length+added.length===3&&(added.length===0||added.length===3),
  'cannot publish a partial verified three-team batch');
 must(newPlayers.length===(added.length?2:0),'new player count unexpectedly changed');
 must(newAliases.length===(added.length?1:0),'new player aliases unexpectedly changed');
 const cents=added.reduce((n,r)=>n+Math.round(r.prize*100),0);
 must(rows.length===starting.count+added.length&&
  rows.reduce((n,r)=>n+Math.round((r.prize||0)*100),0)===starting.prize+cents&&
  rows.reduce((n,r)=>n+personalCents(r)*roster(r).length,0)===starting.personal+cents,
  'prior cash, old results or personal prize totals would be changed');
 if(added.length){
  upsertPublicationLog(updates,{id:'owner-s28-nac-zb-duos-three-20261119',
   date:'2026-11-19',title:'2024 NAC Zero Build Duos Victory Cup：決勝3組・賞金$600',
   description:'2024年1月22日 Event6決勝1組、2月10日 Event7決勝2組。画像1936〜1938の本人EpicプロフィールID・順位・チームキル・1VRを照合。各組$200/各選手$100。ろる=TsV ろるねぎの名義を追加。',
   recordIds:added.map(x=>x.id)});
  updates.entries.sort((a,b)=>b.date.localeCompare(a.date));
 }
 const errors=validateData({results:rows,players,tournaments}).errors;
 must(!errors.length,'data validation: '+JSON.stringify(errors.slice(0,6)));
 const approvals=audit(rows,ledger,players);
 must(!approvals.length,'approval audit: '+JSON.stringify(approvals.slice(0,6)));
 const log=validateUpdateLog(rows,updates);
 must(!log.length,'update history: '+JSON.stringify(log.slice(0,6)));
 if(!dryRun&&added.length){
  publishResults(ROOT,rows);
  write('players.json',players);
  write('approval-history.json',ledger);
  write('updates.json',updates);
 }
 const summary={mode:dryRun?'dry-run':'apply',added:added.length,alreadyPublished:existing.length,
  newPlayers,newAliases,addedCash:cents/100,total:rows.length,
  rows:added.map(x=>({id:x.id,players:x.players,rank:x.rank,kills:x.kills,vrs:x.vrs,prize:x.prize}))};
 console.log('S28_NAC_ZB_DUOS_3 '+JSON.stringify(summary));return summary;
}
if(require.main===module)try{
 const args=process.argv.slice(2);
 must(args.length===0||(args.length===1&&args[0]==='--dry-run'),'usage: [--dry-run]');
 apply({dryRun:args.includes('--dry-run')});
}catch(error){console.error(error.stack);process.exitCode=1}
module.exports={apply};
