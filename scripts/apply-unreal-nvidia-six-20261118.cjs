'use strict';
// Replay-safe owner-approved six-result publisher; preserves old scores and payouts.
const fs=require('node:fs'),path=require('node:path');
const {readResults,publishResults}=require('./source-results-store.cjs');
const {validateData,personalCents,roster}=require('./data-checks.cjs');
const {audit}=require('./validate-approvals.cjs');
const {validateUpdateLog}=require('./validate-updates.cjs');
const {upsertPublicationLog}=require('./reviewed-publication-core.cjs');
const V=require('./verified-unreal-nvidia-six-20261118.cjs');
const ROOT=path.resolve(__dirname,'..'),read=f=>JSON.parse(fs.readFileSync(path.join(ROOT,f),'utf8'));
const write=(f,d)=>fs.writeFileSync(path.join(ROOT,f),JSON.stringify(d,null,2)+'\n');
const must=(x,m)=>{if(!x)throw Error('UNREAL_NVIDIA_SIX '+m)};
function orderPublicationLog(updates){
 must(Array.isArray(updates?.entries),'missing update entries');
 // Historical screenshot batches can be published after newer dated updates.
 // Keep original order for entries with the same date (stable Array#sort).
 updates.entries.sort((a,b)=>b.date.localeCompare(a.date));
}
function apply({dryRun=false}={}){
 must(V.validateProof()===true,'screenshot proof changed');
 const rows=readResults(ROOT).rows,players=read('players.json'),tournaments=read('tournaments.json');
 const ledger=read('approval-history.json'),updates=read('updates.json');
 const known=new Set(players.candidates.map(p=>p.name)),aliases=new Map([...known].map(x=>[x,x]));
 for(const [name,list] of Object.entries(players.confirmedAliases||{})){
  must(known.has(name)&&Array.isArray(list),'broken canonical alias owner '+name);
  for(const alias of list){must(!aliases.has(alias)||aliases.get(alias)===name,'ambiguous alias '+alias);aliases.set(alias,name)}
 }
 for(const [canonical,alias] of [['テルハルル','BoF てるはるるの相方popo'],
 ['モバイル勢のまかろん','BRN 916GonLuck'],['ふぃる','ポルターガイストǃ']])
  must(known.has(canonical)&&aliases.get(alias)===canonical,'previous confirmed alias missing '+canonical);
 const targets=new Set(V.PINNED.flatMap(p=>p.ids));
 const owners=new Map();
 function capture(url,name){
  const id=V.uuid(url);if(!id||!targets.has(id))return;
  const canonical=aliases.get(name)||name;
  must(!owners.has(id)||owners.get(id)===canonical,'existing Epic ID already owned by another player '+id+' '+canonical);
  owners.set(id,canonical);
 }
 for(const row of rows){
  for(const p of row.profiles||[])capture(p.url,p.name);
  if(row.profileUrl&&(!row.players||row.players.length===1))capture(row.profileUrl,row.players?.[0]||row.player);
 }
 for(const p of players.candidates)if(p.epicAccountVerified===true&&p.trackerProfileUrl)capture(p.trackerProfileUrl,p.name);
 const initial={rows:rows.length,cash:rows.reduce((n,x)=>n+Math.round((x.prize||0)*100),0),
 personal:rows.reduce((n,x)=>n+personalCents(x)*roster(x).length,0)};
 const added=[],existing=[],newPlayers=[],newNames=new Set(['さんげん','PONY']);
 for(const x of V.DOC.batch.entries){
  const catalog=tournaments.catalog.find(c=>c.id===x.tournamentId);
  must(catalog&&catalog.name===x.event&&catalog.seasonId==='S39'&&catalog.team===x.team&&
   catalog.mode==='battle-royale'&&catalog.sourceEventIds.includes(x.eventId),'invalid event catalog '+x.id);
  for(let i=0;i<x.playerNames.length;i++){
   const name=x.playerNames[i],id=V.uuid(x.profileUrls[i]);
   must(!owners.has(id)||owners.get(id)===name,'different canonical owner of Epic ID '+name);
   if(!known.has(name)){
    must(newNames.has(name)&&!aliases.has(name),'new canonical player not approved: '+name);
    players.candidates.push({name,initials:Array.from(name).slice(0,2).join(''),accent:players.candidates.length%2?'pink':'cyan',
      desc:x.date+' '+x.region+' '+x.event+' '+x.rank+'位・'+x.kills+'キル・'+x.vrs+'VR・個人賞金$'+x.prizePerPlayer+'。本人Epic IDと公式ルールで確認。',
      epicAccountVerified:true,trackerProfileUrl:x.profileUrls[i]});
    known.add(name);aliases.set(name,name);newPlayers.push(name);
   }
   owners.set(id,name);
  }
  const conflicts=rows.filter(r=>r.id===x.id||(r.date===x.date&&r.region===x.region&&r.tournamentId===x.tournamentId&&
    (r.rank===x.rank||(r.players||[r.player]).some(n=>x.playerNames.includes(n))||
     (r.profiles||[]).some(p=>x.profileUrls.some(u=>V.uuid(p.url)===V.uuid(u))))));
  must(conflicts.length<=1,'duplicate/conflicting ranking or Epic ID '+x.id);
  if(conflicts.length){
   const old=conflicts[0],approval=ledger.entries.find(a=>a.recordId===old.id);
   must(old.id===x.id&&approval&&V.verifyRow(old,approval),'existing result disagrees with screenshot '+x.id);
   existing.push(x.id);continue;
  }
  const row=V.project(x),a=V.approval(x);
  must(V.verifyRow(row,a),'independent new result rejected '+x.id);
  rows.push(row);ledger.entries.push(a);added.push(row);
 }
 must(existing.length+added.length===6&&(added.length===0||added.length===6),'incomplete batch');
 const cents=added.reduce((n,x)=>n+Math.round(x.prize*100),0);
 must(rows.length===initial.rows+added.length&&
  rows.reduce((n,x)=>n+Math.round((x.prize||0)*100),0)===initial.cash+cents&&
  rows.reduce((n,x)=>n+personalCents(x)*roster(x).length,0)===initial.personal+cents,
  'existing ranks, individual rewards or overall payouts would be modified');
 if(added.length)upsertPublicationLog(updates,{id:'owner-s39-unreal-nvidia-six-20261118',date:'2026-11-18',
  title:'2025 NAC Unreal・NAW NVIDIA GeForce RTX Cup 6成績',
  description:'画像1916〜1924とEpic本人UUID・公式順位別賞金を確認。NAC Unreal 1093位デュオ$100（個人各$50）。NAW NVIDIAソロ33/36位各$100、53/69/71位各$0。NVIDIAは単一ラウンド・通常BRソロ・10試合/3時間、40位まで賞金、8pt Rust Bucket対象。追加賞金計$300。',
  recordIds:added.map(x=>x.id)});
 // The shared upsert prepends new notices, but the archive is strictly date-descending.
 // A reviewed 2026-11-18 batch can arrive after another 2026-11-19 announcement.
 if(added.length)orderPublicationLog(updates);
 const errors=validateData({results:rows,players,tournaments}).errors;
 must(!errors.length,'data validation: '+JSON.stringify(errors.slice(0,6)));
 const bad=audit(rows,ledger,players);must(!bad.length,'approval audit: '+JSON.stringify(bad.slice(0,6)));
 const updatesBad=validateUpdateLog(rows,updates);must(!updatesBad.length,'updates validation: '+JSON.stringify(updatesBad.slice(0,6)));
 if(!dryRun&&added.length){
  publishResults(ROOT,rows);
  write('players.json',players);write('approval-history.json',ledger);write('updates.json',updates);
 }
 const summary={mode:dryRun?'dry-run':'apply',added:added.length,alreadyPublished:existing.length,
 total:rows.length,newPlayers,addedCash:cents/100,rows:added.map(x=>({id:x.id,player:x.player,rank:x.rank,prize:x.prize}))};
 console.log('UNREAL_NVIDIA_SIX '+JSON.stringify(summary));return summary;
}
if(require.main===module)try{
 const args=process.argv.slice(2);must(args.length===0||(args.length===1&&args[0]==='--dry-run'),'usage: [--dry-run]');
 apply({dryRun:args.includes('--dry-run')});
}catch(error){console.error(error.stack);process.exitCode=1}
module.exports={apply,orderPublicationLog};
