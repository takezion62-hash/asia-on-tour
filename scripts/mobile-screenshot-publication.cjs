'use strict';
// Shared publisher for the four reviewed mobile screenshot batches. Immutable
// event-specific evidence and the independent approval audit stay unchanged.
const path=require('node:path');
const {validateData,personalCents,roster}=require('./data-checks.cjs');
const {audit}=require('./validate-approvals.cjs');
const {verifyHistoricalRow}=require('./confirmed-player-renames-20261126.cjs');
const {validateUpdateLog}=require('./validate-updates.cjs');
const {upsertPublicationLog,createPublicationFiles}=require('./reviewed-publication-core.cjs');
const ROOT=path.resolve(__dirname,'..');
const BATCHES=Object.freeze({
 'mobile-series-nine-20261121':Object.freeze({proof:'verified-mobile-series-nine-20261121.cjs',prefix:'PUBLISH_MOBILE_NINE',uuidIndex:4,count:9,cents:175000,includeNew:false,label:'MOBILE_SERIES_NINE',log:Object.freeze({id:'owner-s39-s41-s42-mobile-nine-20261121',
   date:'2026-11-21',
   title:'Mobile Series Heats・QualifierとMobile Victory Cup 9成績・$1,750',
   description:'画像1986〜1994：S39 EU 2026年1月/2月Mobile Series賞金付きQualifier計4件($1,300)、S41 EU 6月Heats10位$150（Heats突破なし）、6/29 Mobile Battle Royale決勝1VR=$100、S42 NAC 9/27 Mini Venture ZB Reload決勝3件1VR=$50（計$200）。Mobile Seriesの順位賞金とGroup Stage進出を区別し、4人の既存プロフィールに統合。実際の賞金送金は未確認。'})}),
 'mobile-series-ten-20261121':Object.freeze({proof:'verified-mobile-series-ten-20261121.cjs',prefix:'PUBLISH_MOBILE_TEN',uuidIndex:5,count:10,cents:120000,includeNew:false,label:'MOBILE_SERIES_NINE',log:Object.freeze({id:'owner-s40-s41-s42-mobile-ten-20261121',
   date:'2026-11-21',
   title:'Mobile Series Heats・QualifierとMobile Victory Cup 10成績・$1,200',
   description:'画像1〜10：S40 NAW 4/6・5/4 Mobile Series賞金付きQualifier3件($650)、S41 NAC/NAW 8/16 Heat4各1件($250・上位4名未達)、S41 NAW 8/18 Elite Stronghold Reload決勝1VR=$100、S42 NAW 10/18 Mini Venture Zero Build Reload決勝4件1VR=$50（計$200）。4既存プロフィールに紐づけ、Grapeは確認済み別名で統一。順位賞金と突破は別判定。実際の振込完了は未確認。'})}),
 'mobile-oce-naw-ten-20261121':Object.freeze({proof:'verified-mobile-oce-naw-ten-20261121.cjs',prefix:'PUBLISH_MOBILE_OCE_NAW_TEN',uuidIndex:5,count:10,cents:255000,includeNew:false,label:'MOBILE_OCE_NAW_TEN',log:Object.freeze({id:'owner-s39-s41-mobile-oce-naw-ten-20261121',
   date:'2026-11-21',
   title:'Mobile Series 2月Qualifier・OCE Heats・Mini Venture 10成績・$2,550',
   description:'画像2008〜2017：S39の2026/2/22 OCE・2/23 NAW Mobile Series February Qualifier6各3成績、S41 OCE 6/20 Heat1・7/25 Heat2計3成績、S41 OCE 6/21 Mini Venture Reload決勝1VR=$50。6既存プロフィールに統合しGrapeは確認済み別名で統一。賞金合計$2,550・9VR。Heatsの入賞賞金は上位4名進出と区別。実際の振込完了は未確認。'})}),
 'mobile-extra-ten-20261121':Object.freeze({proof:'verified-mobile-extra-ten-20261121.cjs',prefix:'PUBLISH_MOBILE_EXTRA_TEN',uuidIndex:4,count:10,cents:375000,includeNew:true,label:'MOBILE_EXTRA_TEN',log:Object.freeze({id:'owner-mobile-jan-oct-extra-ten-20261121',
   date:'2026-11-21',
   title:'Mobile Series S39–S41とS42 Mini Venture 10成績・$3,750',
   description:'画像2018〜2027：S39 OCE 1月Qualifier3の4名、2月Qualifier6のまかろん1名、S40 BR 4月・5月各1名、S41 ME 8月Reo1名、S42 ME 10月Mini Venture決勝Reo/まかろん2名。既存OCE 2月の3成績と同じ開催枠に統合。賞金合計$3,750・10VR。klutzfnmを本人IDで新規追加。順位賞金とVR賞金および進出を区別。振込完了は未確認。'})})
});
function applyBatch(batch,{dryRun=false}={},files=createPublicationFiles(ROOT)){
 if(!Object.hasOwn(BATCHES,batch))throw Error('Unknown mobile screenshot batch: '+batch);
 const spec=BATCHES[batch],V=require('./'+spec.proof);
 const must=(ok,why)=>{if(!ok)throw Error(spec.prefix+' '+why)};
 const read=files.read,write=files.write;
 must(V.validateProof()===true,'proof changed');
 const rows=read('results.json'),players=read('players.json'),
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
 for(const player of (spec.includeNew?[...V.DOC.expected.knownPlayers,...V.DOC.expected.newPlayers]:V.DOC.expected.knownPlayers))
  must(known.has(aliases.get(player)||player),'existing canonical profile missing: '+player);
 const uids=new Set(V.GOLD.map(z=>z[spec.uuidIndex])),owners=new Map();
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
 must(added.length+existing.length===spec.count&&(added.length===0||added.length===spec.count),
  'incomplete '+spec.count+'-row atomic publication');
 const cents=added.reduce((n,r)=>n+Math.round(r.prize*100),0);
 const personal=added.reduce((n,r)=>n+personalCents(r)*roster(r).length,0);
 must(cents===personal&&cents===(added.length?spec.cents:0),'award delta mismatch');
 must(rows.length===before.count+added.length&&
  rows.reduce((n,r)=>n+Math.round((r.prize||0)*100),0)===before.cash+cents&&
  rows.reduce((n,r)=>n+personalCents(r)*roster(r).length,0)===before.personal+personal,
  'prior cash or record count changed');
 if(added.length){
  upsertPublicationLog(updates,{...spec.log,recordIds:added.map(x=>x.id)});
  updates.entries.sort((a,b)=>b.date.localeCompare(a.date));
 }
 const errors=validateData({results:rows,players,tournaments:catalog}).errors;
 must(errors.length===0,'data checks '+JSON.stringify(errors.slice(0,9)));
 const audited=audit(rows,ledger,players);
 must(audited.length===0,'approval audit '+JSON.stringify(audited.slice(0,9)));
 const history=validateUpdateLog(rows,updates);
 must(history.length===0,'update log '+JSON.stringify(history.slice(0,9)));
 if(!dryRun&&added.length){
  write('results.json',rows);
  write('approval-history.json',ledger);write('updates.json',updates);
 }
 const result={mode:dryRun?'dry-run':'apply',added:added.length,
  existing:existing.length,players:V.DOC.expected.knownPlayers,
  prize:cents/100,vr:added.reduce((n,r)=>n+r.vrs,0),count:rows.length,
  ids:added.map(x=>x.id)};
 console.log(spec.label+' '+JSON.stringify(result));return result;
}
function cli(batch,args=process.argv.slice(2)){
 if(!Object.hasOwn(BATCHES,batch))throw Error('Unknown mobile screenshot batch: '+batch);
 if(!(args.length===0||(args.length===1&&args[0]==='--dry-run')))throw Error(BATCHES[batch].prefix+' Usage: [--dry-run]');
 return applyBatch(batch,{dryRun:args.includes('--dry-run')});
}
if(require.main===module)try{cli(process.argv[2],process.argv.slice(3));}catch(error){console.error(error.stack);process.exitCode=1}
module.exports={BATCHES,applyBatch,cli};
