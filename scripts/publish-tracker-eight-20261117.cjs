'use strict';
// Authoritative in-place source-shard publication of exactly six NEW screenshot
// results and two EXISTING source-verified S41 NAC $50 final corrections.
// A failed check never pushes mutated files; CI worktree is disposable.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const {readResults,publishResults}=require('./source-results-store.cjs');
const {validateData}=require('./data-checks.cjs');
const {validateUpdateLog}=require('./validate-updates.cjs');
const seal=require('./verified-tracker-eight-20261117.cjs');
const dry=process.argv.includes('--dry-run');
const read=name=>JSON.parse(fs.readFileSync(path.join(root,name),'utf8'));
const write=(name,o)=>fs.writeFileSync(path.join(root,name),JSON.stringify(o,null,2)+'\n');
const must=(ok,m)=>{if(!ok)throw Error('EIGHT_TRACKER_PUBLICATION '+m)};
const results=readResults(root).rows;
const initialCount=results.length,initialIds=new Set(results.map(x=>x.id));
must(initialIds.size===initialCount&&initialCount>=8000,'baseline source content unexpected');
const players=read('players.json'),catalog=read('tournaments.json').catalog;
const ledger=read('approval-history.json'),updates=read('updates.json');
const proof=seal.proof;
seal.verifyProof(proof);
must(ledger.version===1&&Array.isArray(ledger.entries)&&
 updates.version===1&&Array.isArray(updates.entries),'invalid log formats');
const known=new Set(players.candidates.map(p=>p.name));
const aliases=players.confirmedAliases||{};
const observedAccountOwners=new Map(),ambiguousHistoricalIds=new Set();
for(const row of results){
 for(const p of row.profiles||[]){
  const id=seal.profileId(p);if(!id)continue;
  const owner=observedAccountOwners.get(id);
  if(owner&&owner!==p.name&&!((aliases[owner]||[]).includes(p.name))&&
     !((aliases[p.name]||[]).includes(owner)))
   ambiguousHistoricalIds.add(id);
  observedAccountOwners.set(id,p.name);
 }
}
const newPlayers=[],added=[],reused=[],corrected=[],alreadyCorrected=[];
const ledgerById=new Map(ledger.entries.map(x=>[x.id,x]));
must(ledgerById.size===ledger.entries.length,'approval ID collision baseline');
const accountAliases={};
for(const s of proof.newResults){
 for(let i=0;i<2;i++){
  const p=s.players[i],raw=s.raw[i];
  must(p.name!=='Jagareet'||raw==='Jagareet','unexpected Jagareet alias');
  const uri=new URL(p.url),id=seal.profileId(p);
  must(id&&uri.protocol==='https:'&&uri.hostname==='fortnitetracker.com',
   'profile ID invalid '+p.name);
  const old=observedAccountOwners.get(id);
  must(!ambiguousHistoricalIds.has(id),'target UUID has conflicting historical owners '+id);
  must(!old||old===p.name||(aliases[p.name]||[]).includes(old),
   'same Epic account linked to different player '+id);
  observedAccountOwners.set(id,p.name);
  if(!known.has(p.name)){
   must(['なおきん','Jagareet'].includes(p.name),'unapproved new player '+p.name);
   players.candidates.push({name:p.name,
    initials:p.name==='なおきん'?'NK':'JA',accent:p.name==='なおきん'?'cyan':'violet',
    desc:'2025/12/21 NAW $1 Million Unreal Cupデュオ決勝。本人Tracker Epic IDとユーザー提供画像を照合済み。獲得賞金は規則上の金額。'});
   known.add(p.name);newPlayers.push(p.name);
  }
  if(p.name==='なおきん'){
   must(raw==='hst 999','unverified なおきん nickname');
   for(const [other,values] of Object.entries(aliases))
    must(other==='なおきん'||!values.includes('hst 999'),'hst 999 alias already owned');
   aliases['なおきん']||=[];
   if(!aliases['なおきん'].includes('hst 999'))aliases['なおきん'].push('hst 999');
  }else if(raw!==p.name){
   must((aliases[p.name]||[]).includes(raw)||
    (p.name==='ちからV2'&&raw==='ちからv2')||
    (p.name==='とあっくす'&&raw==='ftw KakáDelPiero'),
    'unapproved alternative Epic name '+p.name+' / '+raw);
  }
 }
}
players.confirmedAliases=aliases;
// Catch every exact same tournament window & roster (including a different ID).
const identity=r=>(Array.isArray(r.players)&&r.players.length?r.players:[r.player])
 .slice().sort((a,b)=>a.localeCompare(b,'ja')).join('\u0000');
function sameWindow(r,s){
 if(r.date!==s.date||r.region!==s.region||r.tournamentId!==s.tournamentId)return false;
 const from=String(r.source||'');
 return from.includes(s.windowId)||(
   r.event===catalog.find(x=>x.id===s.tournamentId)?.name&&
   // Unreal Cup is a one-session tournament; other sessions must match round.
   (s.rule==='S39Unreal'||r.round===s.round));
}
for(const s of proof.newResults){
 const c=catalog.find(x=>x.id===s.tournamentId);
 must(c&&c.name&&c.seasonId===s.seasonId&&c.team==='duo'&&
 c.sourceEventIds.includes(s.eventId),'official catalog mismatch '+s.id);
 const target=seal.expectedNew(s,c);
 const existing=results.find(x=>x.id===s.id);
 if(existing){
  must(JSON.stringify(existing)===JSON.stringify(target),'already published row differs '+s.id);
  reused.push(s.id);continue;
 }
 const overlaps=results.filter(x=>sameWindow(x,s)&&
  (identity(x)===identity(target)||x.rank===s.rank&&x.playerRaw===target.playerRaw));
 must(!overlaps.length,'same-event team or result already registered '+s.id+': '+overlaps.map(x=>x.id).join(','));
 must(!ledgerById.has(s.id),'unexpected unpaired manual approval '+s.id);
 results.push(target);added.push(target);
 const entry=seal.newEntry(target,s);
 must(seal.verifyNewRow(target,entry),'locked source proof failed '+s.id);
 ledger.entries.push(entry);ledgerById.set(s.id,entry);
}
const promotions=[];
for(const s of proof.corrections){
 const idx=results.findIndex(x=>x.id===s.id);
 must(idx>=0,'existing NAC final missing '+s.id);
 const old=results[idx],entry=ledgerById.get(s.id);
 must(entry&&entry.policy==='attendance-only'&&entry.recordId===s.id&&
  entry.source===old.source,'original attendance decision missing '+s.id);
 if(old.kind==='賞金決勝'){
  const audit=read(seal.HISTORY).entries.find(x=>x.id===s.id);
  must(audit&&JSON.stringify(seal.expectedCorrection(audit.before,s,
   catalog.find(x=>x.id===s.tournamentId)))===JSON.stringify(old),
   'previous award already differs '+s.id);
  alreadyCorrected.push(s.id);continue;
 }
 const after=seal.expectedCorrection(old,s,catalog.find(x=>x.id===s.tournamentId));
 const h={id:s.id,originalPolicy:entry.policy,source:old.source,rule:seal.RULES.S41,
  beforeSha256:seal.hash(old),afterSha256:seal.hash(after),
  before:old,award:{region:'NAC',rank:s.rank,perPlayerUSD:50,ruleSection:'Attachment C - NAC 76th–100th',image:s.image}};
 results[idx]=after;corrected.push(s.id);promotions.push(h);
}
must(added.length+reused.length===6&&corrected.length+alreadyCorrected.length===2,
 'eight screenshot results not reconciled exactly');
const newIDs=added.map(x=>x.id);
if(newIDs.length){
 must(!updates.entries.some(x=>x.id==='verified-tracker-eight-20261117'),
  'publication update already present');
 updates.entries.unshift({id:'verified-tracker-eight-20261117',date:'2026-11-17',
  type:'records',title:'Tracker決勝6戦績を追加・Days of Play NAC決勝2戦績の賞金を訂正',
  description:'2025年OCE Console Duos（2件）、NAW Unreal Cup（3件）、OCE Reload Duos（1件）を本人Epic IDとTracker画像、Epic公式規則で照合して掲載。さらに既存の2026年Days of Play PlayStation Cup NAC決勝93位・98位を公式賞金表に従い各$50へ修正。新規チーム合計$1,100、既存2件修正$100。Minipiyo/ちからV2既存213位は重複登録していない。',
  recordIds:newIDs});
}
must(results.length===initialCount+6&&
 new Set(results.map(x=>x.id)).size===results.length,'source counts/IDs did not grow by exactly six');
const validation=validateData({results,players,tournaments:{catalog,axes:read('tournaments.json').axes}});
must(validation.errors.length===0,'data invalid '+JSON.stringify(validation.errors.slice(0,5)));
const updateErrors=validateUpdateLog(results,updates);
must(updateErrors.length===0,'update log invalid '+JSON.stringify(updateErrors.slice(0,5)));
const increase=added.reduce((n,x)=>n+x.prize,0)+corrected.length*50;
must(increase===1200,'cash delta is not $1200');
if(!dry){
 // Preserve original S41 participation decisions, add a distinct immutable
 // before/after correction proof. Never edit 8,371 existing IDs otherwise.
 if(promotions.length)write(seal.HISTORY,{
  version:1,reviewedAt:'2026-11-17',basis:'Original attendance-only ledger retained. Exact original rows, screenshot and official NAC $50 rule replayed.',entries:promotions});
 publishResults(root,results);
 write('players.json',players);
 write('approval-history.json',ledger);
 write('updates.json',updates);
}
console.log('EIGHT_TRACKER_PUBLISH '+JSON.stringify({dry,baseline:initialCount,
 added:newIDs,corrected,existing:reused,alreadyCorrected,newPlayers,cashIncreaseUSD:increase}));
