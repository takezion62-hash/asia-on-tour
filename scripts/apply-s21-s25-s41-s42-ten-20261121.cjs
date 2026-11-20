'use strict';
// Atomic preflight, replay-safe historical owner proof publisher.
// The main branch's "Rebuild lightweight season data" workflow performs real writes.
const fs=require('node:fs'),path=require('node:path');
const {readResults,publishResults}=require('./source-results-store.cjs');
const {validateData,personalCents,roster}=require('./data-checks.cjs');
const {audit}=require('./validate-approvals.cjs');
const {validateUpdateLog}=require('./validate-updates.cjs');
const {upsertPublicationLog}=require('./reviewed-publication-core.cjs');
const V=require('./verified-s21-s25-s41-s42-ten-20261121.cjs');
const ROOT=path.resolve(__dirname,'..');
const read=p=>JSON.parse(fs.readFileSync(path.join(ROOT,p),'utf8'));
const write=(p,o)=>fs.writeFileSync(path.join(ROOT,p),JSON.stringify(o,null,2)+'\n');
const must=(v,msg)=>{if(!v)throw Error('PUBLISH_1970_1979 '+msg)};
function apply({dryRun=false}={}){
 must(V.validateProof()===true,'screen/rule proof absent');
 const rows=readResults(ROOT).rows,players=read('players.json'),catalog=read('tournaments.json'),
  ledger=read('approval-history.json'),updates=read('updates.json');
 const known=new Set(players.candidates.map(x=>x.name));
 const aliases=new Map([...known].map(x=>[x,x]));
 for(const [name,alts] of Object.entries(players.confirmedAliases||{})){
  must(known.has(name)&&Array.isArray(alts),'bad canonical alias ownership '+name);
  for(const alt of alts){must(!aliases.has(alt)||aliases.get(alt)===name,'ambiguous alias '+alt);
   aliases.set(alt,name)}
 }
 const allowed=new Set(V.DOC.expected.newPlayers),target=new Set(V.GOLD.map(x=>x[5]));
 const owners=new Map();
 function capture(url,name){
  const id=V.epicId(url);if(!target.has(id))return;
  const canonical=aliases.get(name)||name;
  must(!owners.has(id)||owners.get(id)===canonical,'existing source conflicts for '+id);
  owners.set(id,canonical);
 }
 for(const r of rows){
  for(const p of r.profiles||[])capture(p.url,p.name);
  if(r.profileUrl&&(!r.players||r.players.length===1))
   capture(r.profileUrl,r.players?.[0]||r.player);
 }
 for(const p of players.candidates)if(p.epicAccountVerified&&p.trackerProfileUrl)
  capture(p.trackerProfileUrl,p.name);
 for(const name of ['KENTAch','KanA','モバイル勢のまかろん','Reo','れぼりゅーしょん'])
  must(known.has(name),'missing established canonical player '+name);
 must(aliases.get('YOTTAれぼりゅーしゅん')==='れぼりゅーしょん',
  'known YOTTA alias missing or reassigned');
 const before={count:rows.length,
  cash:rows.reduce((n,r)=>n+Math.round((r.prize||0)*100),0),
  personal:rows.reduce((n,r)=>n+personalCents(r)*roster(r).length,0)};
 const newPlayers=[],added=[],existing=[];
 for(const x of V.DOC.batch.entries){
  const t=catalog.catalog.find(z=>z.id===x.tournamentId);
  must(t&&t.name===x.event&&t.seasonId===x.seasonId&&t.team==='solo'&&
   t.mode===x.mode&&t.sourceEventIds.includes(x.eventId),
   'catalog disagreement '+x.id);
  const id=V.epicId(x.profileUrl),canonical=aliases.get(x.name)||x.name;
  must(id===x.epicUUID&&canonical===x.name&&
   (!owners.has(id)||owners.get(id)===x.name),'Epic UUID owner mismatch '+x.id);
  must(x.rawName===x.name||aliases.get(x.rawName)===x.name,
   'unverified changed display name '+x.rawName);
  if(!known.has(x.name)){
   must(allowed.has(x.name),'unapproved new player '+x.name);
   players.candidates.push({name:x.name,
    initials:Array.from(x.name).slice(0,2).join(''),
    accent:players.candidates.length%2?'cyan':'violet',
    desc:x.date+' '+x.region+' '+x.event+' 決勝'+x.rank+'位、'+
      x.kills+'キル、'+x.vrs+'VR、順位賞金$'+x.prize+
      '。ユーザー提供の画像とEpic IDで照合。',
    epicAccountVerified:true,trackerProfileUrl:x.profileUrl});
   known.add(x.name);aliases.set(x.name,x.name);newPlayers.push(x.name);
  }
  owners.set(id,x.name);
  const collisions=rows.filter(r=>r.id===x.id||
   (r.date===x.date&&r.region===x.region&&
    (r.tournamentId===x.tournamentId||r.source===x.source)&&
    (r.rank===x.rank||(r.players||[r.player]).some(y=>(aliases.get(y)||y)===x.name)||
     (r.profiles||[]).some(y=>V.epicId(y.url)===id)||V.epicId(r.profileUrl)===id)));
  must(collisions.length<=1,'overlap of multiple existing records '+x.id);
  if(collisions.length){
   const prior=collisions[0],a=ledger.entries.filter(v=>v.recordId===prior.id);
   must(prior.id===x.id&&a.length===1&&V.verifyRow(prior,a[0]),
    'published score or conflicting historical identity '+x.id);
   existing.push(x.id);continue;
  }
  const row=V.project(x),approval=V.approval(x);
  must(V.verifyRow(row,approval),'evidence hash mismatch '+x.id);
  rows.push(row);ledger.entries.push(approval);added.push(row);
 }
 must(added.length+existing.length===10&&(added.length===0||added.length===10),
  'reject partial rollout');
 must(JSON.stringify(newPlayers)===JSON.stringify(added.length?V.DOC.expected.newPlayers:[]),
  'unexpected new canonical identities');
 const prize=added.reduce((n,r)=>n+Math.round(r.prize*100),0),personal=added.reduce(
  (n,r)=>n+personalCents(r)*roster(r).length,0);
 must(prize===personal&&prize===(added.length?170000:0),'cash/personal mismatch');
 must(rows.length===before.count+added.length&&
  rows.reduce((n,r)=>n+Math.round((r.prize||0)*100),0)===before.cash+prize&&
  rows.reduce((n,r)=>n+personalCents(r)*roster(r).length,0)===before.personal+personal,
  'prior record or personal cash totals changed');
 if(added.length){
  upsertPublicationLog(updates,{id:'owner-s21-s25-s41-s42-ten-20261121',
   date:'2026-11-21',
   title:'2022/2023 PlayStation＋2026 Mobile Reload ZB 決勝10件・$1,700',
   description:'画像1970〜1979：S21 OCE決勝5件（62/67位各$200、91/94/95位$0）、S41 OCE Days of Play ZB優勝$1,000、S25 BR PlayStation ZB 53位$150、S42 EU Mobile Reload Mini Venture ZBの1VR各$50を3名。本人Epic UUIDと公式規則で確認し、賞金の送金完了は未確認。',
   recordIds:added.map(r=>r.id)});
  updates.entries.sort((a,b)=>b.date.localeCompare(a.date));
 }
 const errors=validateData({results:rows,players,tournaments:catalog}).errors;
 must(errors.length===0,'data checks '+JSON.stringify(errors.slice(0,7)));
 const audited=audit(rows,ledger,players);
 must(audited.length===0,'approval audit '+JSON.stringify(audited.slice(0,7)));
 const logErrors=validateUpdateLog(rows,updates);
 must(logErrors.length===0,'update log '+JSON.stringify(logErrors.slice(0,7)));
 if(!dryRun&&added.length){
  publishResults(ROOT,rows);
  write('players.json',players);write('approval-history.json',ledger);
  write('updates.json',updates);
 }
 const result={mode:dryRun?'dry-run':'apply',added:added.length,existing:existing.length,
  newPlayers,prize:prize/100,vr:added.reduce((n,r)=>n+r.vrs,0),
  count:rows.length,records:added.map(r=>({id:r.id,player:r.player,rank:r.rank,prize:r.prize}))};
 console.log('OWNER_TEN_1970_1979 '+JSON.stringify(result));return result;
}
if(require.main===module)try{
 const a=process.argv.slice(2);
 must(a.length===0||(a.length===1&&a[0]==='--dry-run'),'Usage: [--dry-run]');
 apply({dryRun:a.includes('--dry-run')});
}catch(e){console.error(e.stack);process.exitCode=1}
module.exports={apply};
