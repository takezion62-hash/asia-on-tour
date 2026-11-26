'use strict';
// All-or-none, replay-safe publisher for owner's 10 screenshots dated 2026-11-21.
// Only main's shard rebuild workflow may mutate the authoritative results.
const fs=require('node:fs'),path=require('node:path');
const {readResults,publishResults}=require('./source-results-store.cjs');
const {validateData,personalCents,roster}=require('./data-checks.cjs');
const {audit}=require('./validate-approvals.cjs');
const {verifyHistoricalRow}=require('./confirmed-player-renames-20261126.cjs');
const {validateUpdateLog}=require('./validate-updates.cjs');
const {upsertPublicationLog}=require('./reviewed-publication-core.cjs');
const V=require('./verified-mobile-series-ten-20261121.cjs');
const ROOT=path.resolve(__dirname,'..');
const read=p=>JSON.parse(fs.readFileSync(path.join(ROOT,p),'utf8'));
const write=(p,j)=>fs.writeFileSync(path.join(ROOT,p),JSON.stringify(j,null,2)+'\n');
const must=(ok,why)=>{if(!ok)throw Error('PUBLISH_MOBILE_TEN '+why)};
function apply({dryRun=false}={}){
 must(V.validateProof()===true,'proof changed');
 const rows=readResults(ROOT).rows,players=read('players.json'),
  catalog=read('tournaments.json'),ledger=read('approval-history.json'),
  updates=read('updates.json');
 const known=new Set(players.candidates.map(p=>p.name));
 const aliases=new Map([...known].map(x=>[x,x]));
 for(const [name,alts] of Object.entries(players.confirmedAliases||{})){
  must(known.has(name)&&Array.isArray(alts),'invalid aliases '+name);
  for(const alt of alts){
   must(!aliases.has(alt)||aliases.get(alt)===name,'ambiguous alias '+alt);
   aliases.set(alt,name);
  }
 }
 for(const player of V.DOC.expected.knownPlayers)
  must(known.has(aliases.get(player)||player),'existing canonical profile missing: '+player);
 const uids=new Set(V.GOLD.map(z=>z[5])),owners=new Map();
 const capture=(url,name)=>{
  const uid=V.epicId(url);if(!uids.has(uid))return;
  const canonical=aliases.get(name)||name;
  must(!owners.has(uid)||owners.get(uid)===canonical,
   'published Epic UUID conflicts with a distinct player '+uid);
  owners.set(uid,canonical);
 };
 for(const row of rows){
  for(const p of row.profiles||[])capture(p.url,p.name);
  if(row.profileUrl&&(!row.players||row.players.length===1))
   capture(row.profileUrl,row.players?.[0]||row.player);
 }
 for(const p of players.candidates)
  if(p.epicAccountVerified&&p.trackerProfileUrl)capture(p.trackerProfileUrl,p.name);
 const before={count:rows.length,
  cash:rows.reduce((n,r)=>n+Math.round((r.prize||0)*100),0),
  personal:rows.reduce((n,r)=>n+personalCents(r)*roster(r).length,0)};
 const added=[],existing=[];
 for(const x of V.DOC.batch.entries){
  const t=catalog.catalog.find(z=>z.id===x.tournamentId);
  must(t&&t.seasonId===x.seasonId&&t.name===x.event&&t.team==='solo'&&
   t.mode===x.mode&&t.platform==='mobile'&&t.sourceEventIds.includes(x.eventId),
   'catalog mismatch '+x.id);
  const canonical=aliases.get(x.name)||x.name;
  must(known.has(canonical)&&
   (aliases.get(x.rawName)||x.rawName)===canonical,
   'unapproved new identity or alias '+x.name);
  const uid=V.epicId(x.profileUrl);
  must(uid===x.epicUUID&&(!owners.has(uid)||owners.get(uid)===canonical),
   'Epic UUID belongs to a different verified account: '+x.id);
  owners.set(uid,canonical);
  const collisions=rows.filter(r=>r.id===x.id||
   (r.date===x.date&&r.region===x.region&&
    (r.tournamentId===x.tournamentId||r.source===x.source)&&
    (r.rank===x.rank||
      (r.players||[r.player]).some(y=>(aliases.get(y)||y)===canonical)||
      (r.profiles||[]).some(p=>V.epicId(p.url)===uid)||
      V.epicId(r.profileUrl)===uid)));
  must(collisions.length<=1,'multiple original records overlap '+x.id);
  if(collisions.length){
   const prior=collisions[0],a=ledger.entries.filter(z=>z.recordId===prior.id);
   must(prior.id===x.id&&a.length===1&&verifyHistoricalRow(V.verifyRow,prior,a[0],players),
    'previous unverified or altered published result '+x.id);
   existing.push(x.id);continue;
  }
  must(canonical===x.name,'renamed historical record missing; refuse to recreate old identity '+x.id);
  const row=V.project(x),a=V.approval(x);
  must(V.verifyRow(row,a),'new proof audit mismatch '+x.id);
  rows.push(row);ledger.entries.push(a);added.push(row);
 }
 must(added.length+existing.length===10&&(added.length===0||added.length===10),
  'incomplete 10-row atomic publication');
 const cents=added.reduce((n,r)=>n+Math.round(r.prize*100),0);
 const personal=added.reduce((n,r)=>n+personalCents(r)*roster(r).length,0);
 must(cents===personal&&cents===(added.length?120000:0),'award delta mismatch');
 must(rows.length===before.count+added.length&&
  rows.reduce((n,r)=>n+Math.round((r.prize||0)*100),0)===before.cash+cents&&
  rows.reduce((n,r)=>n+personalCents(r)*roster(r).length,0)===before.personal+personal,
  'prior cash or record count changed');
 if(added.length){
  upsertPublicationLog(updates,{id:'owner-s40-s41-s42-mobile-ten-20261121',
   date:'2026-11-21',
   title:'Mobile Series Heats・QualifierとMobile Victory Cup 10成績・$1,200',
   description:'画像1〜10：S40 NAW 4/6・5/4 Mobile Series賞金付きQualifier3件($650)、S41 NAC/NAW 8/16 Heat4各1件($250・上位4名未達)、S41 NAW 8/18 Elite Stronghold Reload決勝1VR=$100、S42 NAW 10/18 Mini Venture Zero Build Reload決勝4件1VR=$50（計$200）。4既存プロフィールに紐づけ、Grapeは確認済み別名で統一。順位賞金と突破は別判定。実際の振込完了は未確認。',
   recordIds:added.map(x=>x.id)});
  updates.entries.sort((a,b)=>b.date.localeCompare(a.date));
 }
 const errors=validateData({results:rows,players,tournaments:catalog}).errors;
 must(errors.length===0,'data checks '+JSON.stringify(errors.slice(0,9)));
 const audited=audit(rows,ledger,players);
 must(audited.length===0,'approval audit '+JSON.stringify(audited.slice(0,9)));
 const history=validateUpdateLog(rows,updates);
 must(history.length===0,'update log '+JSON.stringify(history.slice(0,9)));
 if(!dryRun&&added.length){
  publishResults(ROOT,rows);
  write('approval-history.json',ledger);write('updates.json',updates);
 }
 const result={mode:dryRun?'dry-run':'apply',added:added.length,
  existing:existing.length,players:V.DOC.expected.knownPlayers,
  prize:cents/100,vr:added.reduce((n,r)=>n+r.vrs,0),count:rows.length,
  ids:added.map(x=>x.id)};
 console.log('MOBILE_SERIES_NINE '+JSON.stringify(result));return result;
}
if(require.main===module)try{
 const args=process.argv.slice(2);
 must(args.length===0||(args.length===1&&args[0]==='--dry-run'),'Usage: [--dry-run]');
 apply({dryRun:args.includes('--dry-run')});
}catch(err){console.error(err.stack);process.exitCode=1}
module.exports={apply};
