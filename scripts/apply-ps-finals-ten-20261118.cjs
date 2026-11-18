'use strict';
// Replay-safe one-shot publication of ten user-submitted PlayStation Finals rows.
// Never overwrite an earlier result, infer a cash bracket or coalesce the
// confirmed 2024/2026 OCE "とまと" identity or change existing scores.
const fs=require('node:fs'),path=require('node:path');
const {readResults,publishResults}=require('./source-results-store.cjs');
const {validateData,personalCents,roster}=require('./data-checks.cjs');
const {audit}=require('./validate-approvals.cjs');
const {validateUpdateLog}=require('./validate-updates.cjs');
const {upsertPublicationLog}=require('./reviewed-publication-core.cjs');
const V=require('./verified-ps-finals-ten-20261118.cjs');
const ROOT=path.resolve(__dirname,'..');
const read=p=>JSON.parse(fs.readFileSync(path.join(ROOT,p),'utf8'));
const write=(p,x)=>fs.writeFileSync(path.join(ROOT,p),JSON.stringify(x,null,2)+'\n');
const must=(v,s)=>{if(!v)throw Error('PS_FINALS_TEN '+s)};
function apply({dryRun=false}={}){
 must(V.validateProof()===true,'fixed screenshot proof differs');
 const rows=readResults(ROOT).rows;
 const players=read('players.json'),tournaments=read('tournaments.json'),ledger=read('approval-history.json'),updates=read('updates.json');
 const existingIds=new Set(rows.map(x=>x.id)),known=new Set(players.candidates.map(x=>x.name));
 const aliases=new Map([...known].map(x=>[x,x]));
 for(const [canonical,names] of Object.entries(players.confirmedAliases||{})){
  must(known.has(canonical)&&Array.isArray(names),'bad known alias owner '+canonical);
  for(const alias of names){
   must(!aliases.has(alias)||aliases.get(alias)===canonical,'conflicting aliases '+alias);
   aliases.set(alias,canonical);
  }
 }
 const targetUuids=new Set(V.TARGETS.map(x=>x[9]));
 const identityOwners=new Map();
 const capture=(url,canonical)=>{
  const uuid=V.uuid(url);
  if(!uuid||!targetUuids.has(uuid))return;
  must(!identityOwners.has(uuid)||identityOwners.get(uuid)===canonical,
   'same Epic ID currently belongs to a different player '+uuid);
  identityOwners.set(uuid,canonical);
 };
 for(const row of rows){
  for(const profile of row.profiles||[])
   capture(profile.url,aliases.get(profile.name)||profile.name);
  if(row.profileUrl)capture(row.profileUrl,aliases.get(row.player)||row.player);
 }
 for(const player of players.candidates){
  if(player.epicAccountVerified!==true)continue;
  const url=player.trackerProfileUrl;
  if(url)capture(url,player.name);
 }
 const initial={count:rows.length,team:rows.reduce((n,x)=>n+Math.round((x.prize||0)*100),0),
  personal:rows.reduce((n,x)=>n+personalCents(x)*roster(x).length,0)};
 const allowedNew=new Set(['xyxyxyxyxyxyzz','VRS k3nz1xJR','はるぱか']);
 const newPlayers=[],added=[],existing=[];
 const takenRanks=new Set();
 const checks=tournaments.catalog;
 for(const x of V.DOC.batch.entries){
  const key=[x.date,x.region,x.tournamentId,x.rank].join('/');
  must(!takenRanks.has(key),'repeated screenshot slot '+key);
  takenRanks.add(key);
  const catalog=checks.find(z=>z.id===x.tournamentId);
  must(catalog&&catalog.seasonId===x.seasonId&&catalog.chapter===x.chapter&&
   catalog.season===x.season&&catalog.mode===x.mode&&catalog.team==='solo'&&
   catalog.name===x.event&&catalog.series==='playstation-cup'&&
   catalog.sourceEventIds.includes(x.eventId),'catalog not aligned with exact final '+x.id);
  const epicUuid=V.uuid(x.profileUrl);
  must(epicUuid,'invalid source identity '+x.id);
  must(!identityOwners.has(epicUuid)||identityOwners.get(epicUuid)===x.player,
   'an existing record links Epic account to a different player: '+x.player);
  if(!known.has(x.player)){
   must(allowedNew.has(x.player),'unapproved new canonical player '+x.player);
   must(!aliases.has(x.player),'player label conflicts with existing alias '+x.player);
   players.candidates.push({name:x.player,
    initials:Array.from(x.player).slice(0,2).join(''),
    accent:players.candidates.length%2?'cyan':'violet',
    desc:x.date+' '+x.region+' '+x.event+'決勝'+x.rank+'位・'+x.kills+
     'キル・賞金$'+x.prize+'（本人Epic ID・公式順位別賞金確認）。',
    epicAccountVerified:true,trackerProfileUrl:x.profileUrl});
   known.add(x.player);aliases.set(x.player,x.player);newPlayers.push(x.player);
  }
  identityOwners.set(epicUuid,x.player);
  const candidates=rows.filter(r=>r.date===x.date&&r.region===x.region&&
    r.tournamentId===x.tournamentId&&(
      r.id===x.id||r.rank===x.rank||r.player===x.player||
      V.uuid(r.profileUrl)===epicUuid||
      (Array.isArray(r.profiles)&&r.profiles.some(p=>V.uuid(p.url)===epicUuid))));
  must(candidates.length<=1,'duplicate/conflicting rank or Epic account for '+x.id);
  if(candidates.length){
   const prev=candidates[0],oldApproval=ledger.entries.find(e=>e.recordId===prev.id);
   must(prev.id===x.id&&oldApproval&&V.verifyRow(prev,oldApproval),
    'existing rank/score/cash/identity differs from screenshot '+x.id);
   existing.push(x.id);continue;
  }
  must(!existingIds.has(x.id),'result ID already used in unrelated match '+x.id);
  const result=V.project(x),entry=V.approval(x);
  must(V.verifyRow(result,entry),'independent screenshot verifier rejected publication '+x.id);
  rows.push(result);ledger.entries.push(entry);
  existingIds.add(x.id);added.push(result);
 }
 must(takenRanks.size===10,'some screenshot ranks were not reviewed');
 const cashAdded=added.reduce((sum,x)=>sum+x.prize*100,0);
 must(rows.length===initial.count+added.length&&
  rows.reduce((n,x)=>n+Math.round((x.prize||0)*100),0)===initial.team+cashAdded&&
  rows.reduce((n,x)=>n+personalCents(x)*roster(x).length,0)===initial.personal+cashAdded,
  'previous awards, score count or individual prize silently changed');
 if(added.length){
  upsertPublicationLog(updates,{id:'owner-ps-finals-10-20261118',date:'2026-11-18',
   title:'PlayStation Cup過去4大会：Mofu・Saku・ごんた・新規選手など10件',
   description:'提供画像10枚と本人Epic ID・公式順位別賞金を照合。S30 OCE BR/ZB、S33 ME、S37 OCEの10成績を追記。賞金獲得7件・賞金圏外3件。2024年・2026年の「とまと」を本人Epic IDで統合。新規賞金合計$1,150。',
   recordIds:added.map(x=>x.id)});
 }
 const dataErrors=validateData({results:rows,players,tournaments});
 must(!dataErrors.errors.length,'data validation: '+JSON.stringify(dataErrors.errors.slice(0,8)));
 const ledgerErrors=audit(rows,ledger,players);
 must(!ledgerErrors.length,'source approval: '+JSON.stringify(ledgerErrors.slice(0,8)));
 const logErrors=validateUpdateLog(rows,updates);
 must(!logErrors.length,'history log: '+JSON.stringify(logErrors.slice(0,8)));
 if(!dryRun&&added.length){
  publishResults(ROOT,rows);
  write('players.json',players);write('approval-history.json',ledger);write('updates.json',updates);
 }
 const summary={mode:dryRun?'dry-run':'apply',added:added.length,alreadyPublished:existing.length,
  total:rows.length,newPlayers,addedPrize:cashAdded/100,originalPrize:initial.team/100,
  results:added.map(x=>({id:x.id,player:x.player,region:x.region,rank:x.rank,prize:x.prize}))};
 console.log('PS_FOUR_FINALS_TEN '+JSON.stringify(summary));
 return summary;
}
if(require.main===module)try{
 const args=process.argv.slice(2);
 must(args.length===0||(args.length===1&&args[0]==='--dry-run'),
 'usage: [--dry-run]');
 apply({dryRun:args.includes('--dry-run')});
}catch(error){console.error(error.stack);process.exitCode=1}
module.exports={apply};
