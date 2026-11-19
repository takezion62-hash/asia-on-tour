'use strict';
// Replay-safe owner-approved publisher for 2024 NAC S28 Zero Build Duos Victory Cup.
// Existing results and approvals are append-only; fail closed on identity or rank collision.
const fs=require('node:fs'),path=require('node:path');
const {readResults,publishResults}=require('./source-results-store.cjs');
const {validateData,personalCents,roster}=require('./data-checks.cjs');
const {audit}=require('./validate-approvals.cjs');
const {validateUpdateLog}=require('./validate-updates.cjs');
const {upsertPublicationLog}=require('./reviewed-publication-core.cjs');
const V=require('./verified-s28-nac-zb-duos-three-20261119.cjs');
const ROOT=path.resolve(__dirname,'..');
const read=file=>JSON.parse(fs.readFileSync(path.join(ROOT,file),'utf8'));
const write=(file,content)=>fs.writeFileSync(path.join(ROOT,file),JSON.stringify(content,null,2)+'\n');
const must=(ok,why)=>{if(!ok)throw Error('S28_NAC_ZB_THREE_PUBLISH '+why)};
function apply({dryRun=false}={}){
 must(V.validateProof()===true,'pinned owner evidence changed');
 const rows=readResults(ROOT).rows,players=read('players.json'),tournaments=read('tournaments.json');
 const ledger=read('approval-history.json'),updates=read('updates.json');
 const known=new Set(players.candidates.map(p=>p.name)),aliases=new Map([...known].map(n=>[n,n]));
 for(const [canonical,list] of Object.entries(players.confirmedAliases||{})){
  must(known.has(canonical)&&Array.isArray(list),'invalid alias owner '+canonical);
  for(const alias of list){
   must(!aliases.has(alias)||aliases.get(alias)===canonical,'conflicting alias '+alias);
   aliases.set(alias,canonical);
  }
 }
 for(const name of ['こいる','sena','モバイル勢のまかろん'])
  must(known.has(name),'original canonical player not found: '+name);
 must(aliases.get('BRN 916GonLuck')==='モバイル勢のまかろん','macaron alias changed');
 const allowedNew=new Set(['たまふぃっしー2号だよーん','ろる']);
 const targetIds=new Set(V.PINNED.flatMap(x=>x[10])),owners=new Map();
 function capture(profile,name){
  const id=V.uuid(profile);
  if(!id||!targetIds.has(id))return;
  const canonical=aliases.get(name)||name;
  must(!owners.has(id)||owners.get(id)===canonical,'Epic UUID already belongs to another player: '+id);
  owners.set(id,canonical);
 }
 for(const row of rows){
  for(const profile of row.profiles||[])capture(profile.url,profile.name);
  if(row.profileUrl&&(!row.players||row.players.length===1))
   capture(row.profileUrl,row.players?.[0]||row.player);
 }
 for(const player of players.candidates)
  if(player.epicAccountVerified===true&&player.trackerProfileUrl)
   capture(player.trackerProfileUrl,player.name);
 const start={rows:rows.length,cash:rows.reduce((sum,r)=>sum+Math.round((r.prize||0)*100),0),
  personal:rows.reduce((sum,r)=>sum+personalCents(r)*roster(r).length,0)};
 const newPlayers=[],added=[],existing=[];
 for(const x of V.DOC.batch.entries){
  const cat=tournaments.catalog.find(e=>e.id===x.tournamentId);
  must(cat?.name===x.event&&cat.seasonId==='S28'&&cat.team==='duo'&&
    cat.mode==='zero-build'&&cat.sourceEventIds.includes(x.eventId),'catalog mismatch');
  for(let i=0;i<2;i++){
   const name=x.playerNames[i],id=V.uuid(x.profileUrls[i]);
   must(!owners.has(id)||owners.get(id)===name,'Epic identity changed: '+name);
   if(!known.has(name)){
    must(allowedNew.has(name)&&!aliases.has(name),'unapproved new player: '+name);
    const desc=x.date+' NAC Zero Build Duos Victory Cup賞金決勝'+x.rank+
     '位・'+x.kills+'チームK・1VR・個人賞金$100。'+x.playerNames.join(' / ')+
     'のチームで、公式ルールと両者のTracker Epic IDを確認。';
    players.candidates.push({name,initials:Array.from(name).slice(0,2).join(''),
     accent:players.candidates.length%2?'pink':'cyan',desc,
     epicAccountVerified:true,trackerProfileUrl:x.profileUrls[i]});
    newPlayers.push(name);known.add(name);aliases.set(name,name);
   }
   owners.set(id,name);
  }
  const conflicts=rows.filter(r=>r.id===x.id||(r.date===x.date&&r.region===x.region&&
   r.tournamentId===x.tournamentId&&r.kind==='賞金決勝'&&
    (r.rank===x.rank||(r.players||[r.player]).some(p=>x.playerNames.includes(p))||
     (r.profiles||[]).some(p=>x.profileUrls.some(u=>V.uuid(p.url)===V.uuid(u))))));
  must(conflicts.length<=1,'existing overlapping final: '+x.id);
  if(conflicts.length){
   const previous=conflicts[0],a=ledger.entries.find(e=>e.recordId===previous.id);
   must(previous.id===x.id&&a&&V.verifyRow(previous,a),
    'previous finalist disagrees with owner proof: '+x.id);
   existing.push(x.id);continue;
  }
  const row=V.project(x),a=V.approval(x);
  must(V.verifyRow(row,a),'new evidence validation failed: '+x.id);
  rows.push(row);ledger.entries.push(a);added.push(row);
 }
 must(added.length+existing.length===3&&(added.length===0||added.length===3),
  'partial publication: 3 results must be published together');
 must(newPlayers.length===(added.length?2:0),'unexpected new account count');
 const delta=added.reduce((sum,r)=>sum+Math.round(r.prize*100),0);
 must(rows.length===start.rows+added.length&&
  rows.reduce((sum,r)=>sum+Math.round((r.prize||0)*100),0)===start.cash+delta&&
  rows.reduce((sum,r)=>sum+personalCents(r)*roster(r).length,0)===start.personal+delta,
  'prior results, team prize or personal prize changed');
 if(added.length){
  upsertPublicationLog(updates,{id:'owner-s28-nac-zb-duos-three-20261119',date:'2026-11-19',
   title:'2024年NAC Zero Build Duos Victory Cup決勝3組・個人賞金$600',
   description:'2024/1/22 Event6：ろる/モバイル勢のまかろん81位・9K。2/10 Event7：こいる/sena25位・19K、たまふぃっしー2号だよーん/モバイル勢のまかろん67位・10K。いずれも3試合1VRでチーム$200（1人$100）。ユーザー画像1936〜1938と5名のEpicプロフィールIDを照合。既存データ変更なし。',
   recordIds:added.map(r=>r.id)});
  updates.entries.sort((a,b)=>b.date.localeCompare(a.date));
 }
 const errors=validateData({results:rows,players,tournaments}).errors;
 must(!errors.length,'data validation: '+JSON.stringify(errors.slice(0,7)));
 const approvals=audit(rows,ledger,players);
 must(!approvals.length,'approval audit: '+JSON.stringify(approvals.slice(0,7)));
 const updateErrors=validateUpdateLog(rows,updates);
 must(!updateErrors.length,'update log validation: '+JSON.stringify(updateErrors.slice(0,7)));
 if(!dryRun&&added.length){
  publishResults(ROOT,rows);
  write('players.json',players);write('approval-history.json',ledger);write('updates.json',updates);
 }
 const summary={mode:dryRun?'dry-run':'apply',added:added.length,alreadyPublished:existing.length,
  newPlayers,addedCash:delta/100,total:rows.length,
  ranks:added.map(r=>({id:r.id,player:r.player,date:r.date,rank:r.rank,kills:r.kills,prize:r.prize}))};
 console.log('S28_NAC_ZB_DUOS_THREE '+JSON.stringify(summary));
 return summary;
}
if(require.main===module)try{
 const args=process.argv.slice(2);
 must(args.length===0||(args.length===1&&args[0]==='--dry-run'),'usage: [--dry-run]');
 apply({dryRun:args.includes('--dry-run')});
}catch(e){console.error(e.stack);process.exitCode=1}
module.exports={apply};
