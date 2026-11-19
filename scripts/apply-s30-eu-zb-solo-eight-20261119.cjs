'use strict';
// Append-only, replay-safe publisher: never overwrites existing players, rows,
// awards or a separate Round1 entry. Reports conflicts instead of guessing.
const fs=require('node:fs'),path=require('node:path');
const {readResults,publishResults}=require('./source-results-store.cjs');
const {validateData,personalCents,roster}=require('./data-checks.cjs');
const {audit}=require('./validate-approvals.cjs');
const {validateUpdateLog}=require('./validate-updates.cjs');
const {upsertPublicationLog}=require('./reviewed-publication-core.cjs');
const V=require('./verified-s30-eu-zb-solo-eight-20261119.cjs');
const ROOT=path.resolve(__dirname,'..');
const read=file=>JSON.parse(fs.readFileSync(path.join(ROOT,file),'utf8'));
const write=(file,obj)=>fs.writeFileSync(path.join(ROOT,file),JSON.stringify(obj,null,2)+'\n');
const must=(ok,msg)=>{if(!ok)throw Error('S30_EU_ZB_EIGHT_PUBLISH '+msg)};
function apply({dryRun=false}={}){
 must(V.validateProof()===true,'original screenshot proof changed');
 const rows=readResults(ROOT).rows,players=read('players.json'),tournaments=read('tournaments.json');
 const ledger=read('approval-history.json'),updates=read('updates.json');
 const known=new Set(players.candidates.map(x=>x.name)),aliases=new Map([...known].map(n=>[n,n]));
 for(const [owner,list] of Object.entries(players.confirmedAliases||{})){
  must(known.has(owner)&&Array.isArray(list),'broken alias owner '+owner);
  for(const alias of list){
   must(!aliases.has(alias)||aliases.get(alias)===owner,'ambiguous alias: '+alias);
   aliases.set(alias,owner);
  }
 }
 must(known.has('モバイル勢のまかろん')&&aliases.get('BRN 916GonLuck')==='モバイル勢のまかろん'&&
  known.has('ちゃる')&&aliases.get('charufn')==='ちゃる'&&
  known.has('TakoBeL')&&known.has('MMC KAAN BABA'),'canonical player or aliases changed');
 const targetIds=new Set(V.TUPLES.map(t=>t[9])),owners=new Map();
 function capture(url,name){
  const id=V.uuid(url);
  if(!id||!targetIds.has(id))return;
  const canonical=aliases.get(name)||name;
  must(!owners.has(id)||owners.get(id)===canonical,'existing Epic account maps to another player: '+id);
  owners.set(id,canonical);
 }
 for(const row of rows){
  for(const p of row.profiles||[])capture(p.url,p.name);
  if(row.profileUrl&&(!row.players||row.players.length===1))
   capture(row.profileUrl,row.players?.[0]||row.player);
 }
 for(const p of players.candidates){
  if(p.epicAccountVerified===true&&p.trackerProfileUrl)capture(p.trackerProfileUrl,p.name);
 }
 const initial={rows:rows.length,cash:rows.reduce((sum,r)=>sum+Math.round((r.prize||0)*100),0),
  personal:rows.reduce((sum,r)=>sum+personalCents(r)*roster(r).length,0)};
 const added=[],existing=[],newPlayers=[];
 for(const x of V.DOC.batch.entries){
  const catalog=tournaments.catalog.find(t=>t.id===x.tournamentId);
  must(catalog&&catalog.name===x.event&&catalog.team==='solo'&&catalog.mode==='zero-build'&&
   catalog.seasonId==='S30'&&catalog.sourceEventIds.includes(x.eventId),'catalog not verified '+x.id);
  const name=x.playerNames[0],id=V.uuid(x.profileUrls[0]);
  must(!owners.has(id)||owners.get(id)===name,'Epic ID owner conflict: '+name);
  if(!known.has(name)){
   must(name==='あーうw'&&!aliases.has(name),'new canonical identity not authorized: '+name);
   players.candidates.push({name,initials:Array.from(name).slice(0,2).join(''),accent:'cyan',
    desc:'2024/08/13 EU ZB Solo Victory Cup Event9賞金決勝36位・15K・1VR・個人賞金$100。Epic公式ルールとTracker本人プロフィールIDで確認。',
    epicAccountVerified:true,trackerProfileUrl:x.profileUrls[0]});
   known.add(name);aliases.set(name,name);newPlayers.push(name);
  }
  owners.set(id,name);
  // Separate Round1 evidence is valid and must not collide with this Round2 result.
  const conflicts=rows.filter(r=>r.id===x.id||(r.date===x.date&&r.region===x.region&&
   r.tournamentId===x.tournamentId&&r.kind==='賞金決勝'&&
   (r.rank===x.rank||(r.players||[r.player]).includes(name)||
    (r.profiles||[]).some(p=>V.uuid(p.url)===id)||V.uuid(r.profileUrl)===id)));
  must(conflicts.length<=1,'duplicate or conflicting finalist: '+x.id);
  if(conflicts.length){
   const prior=conflicts[0],approval=ledger.entries.find(e=>e.recordId===prior.id);
   must(prior.id===x.id&&approval&&V.verifyRow(prior,approval),'different existing result for finalist '+x.id);
   existing.push(x.id);continue;
  }
  const row=V.project(x),approval=V.approval(x);
  must(V.verifyRow(row,approval),'snapshot roundtrip rejected '+x.id);
  rows.push(row);ledger.entries.push(approval);added.push(row);
 }
 must(added.length+existing.length===8&&(added.length===0||added.length===8),
  'partial publication or concurrent row detected');
 must(newPlayers.length===(added.length?1:0),'unexpected player creation');
 const cashDelta=added.reduce((n,x)=>n+Math.round(x.prize*100),0);
 must(rows.length===initial.rows+added.length&&
  rows.reduce((n,x)=>n+Math.round((x.prize||0)*100),0)===initial.cash+cashDelta&&
  rows.reduce((n,x)=>n+personalCents(x)*roster(x).length,0)===initial.personal+cashDelta,
  'old rows, personal totals or cash changed');
 if(added.length){
  upsertPublicationLog(updates,{id:'owner-s30-eu-zb-solo-eight-20261119',date:'2026-11-19',
   title:'2024 EU ZB Solo Victory Cup決勝 8成績・個人賞金$800',
   description:'2024/6/18 Event3、6/25 Event4、8/13 Event9の計8件。本人Epic UUIDと画像1928〜1935の結果を確認。各選手1VR・$100。8/13の一部Tracker表示$0はEpic公式1VR=$100およびユーザー補足に従い修正。既存成績に変更なし。',
   recordIds:added.map(x=>x.id)});
  updates.entries.sort((a,b)=>b.date.localeCompare(a.date));
 }
 const invalid=validateData({results:rows,players,tournaments}).errors;
 must(!invalid.length,'data validation: '+JSON.stringify(invalid.slice(0,6)));
 const approvalErrors=audit(rows,ledger,players);
 must(!approvalErrors.length,'approval audit: '+JSON.stringify(approvalErrors.slice(0,6)));
 const updateErrors=validateUpdateLog(rows,updates);
 must(!updateErrors.length,'update log validation: '+JSON.stringify(updateErrors.slice(0,6)));
 if(!dryRun&&added.length){
  publishResults(ROOT,rows);
  write('players.json',players);write('approval-history.json',ledger);write('updates.json',updates);
 }
 const summary={mode:dryRun?'dry-run':'apply',added:added.length,alreadyPublished:existing.length,
  newPlayers,addedCash:cashDelta/100,total:rows.length,rows:added.map(x=>({id:x.id,player:x.player,
   date:x.date,rank:x.rank,kills:x.kills,vrs:x.vrs,prize:x.prize}))};
 console.log('S30_EU_ZB_SOLO_EIGHT '+JSON.stringify(summary));return summary;
}
if(require.main===module){
 try{
  const args=process.argv.slice(2);
  must(args.length===0||(args.length===1&&args[0]==='--dry-run'),'usage: [--dry-run]');
  apply({dryRun:args.includes('--dry-run')});
 }catch(error){console.error(error.stack);process.exitCode=1}
}
module.exports={apply};
