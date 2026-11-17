'use strict';
// One-shot fail-closed canonical publication from the five screenshot-locked
// S37 Round2 entries. Only new results (no rewriting old ID/awards).
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const {readResults,publishResults}=require('./source-results-store.cjs');
const {validateData}=require('./data-checks.cjs');
const {validateUpdateLog}=require('./validate-updates.cjs');
const fixed=require('./verified-s37-console-five.cjs');
const dry=process.argv.includes('--dry-run');
const read=name=>JSON.parse(fs.readFileSync(path.join(root,name),'utf8'));
const write=(name,o)=>fs.writeFileSync(path.join(root,name),JSON.stringify(o,null,2)+'\n');
const must=(v,m)=>{if(!v)throw Error('PUBLISH_S37_CONSOLE_FIVE: '+m)};
const old=readResults(root).rows,results=[...old],players=read('players.json');
const tournamentData=read('tournaments.json'),updates=read('updates.json');
const approval=read('approval-history.json'),rules=read('tournament-rules.json');
const ruleset=rules.rules.find(x=>x.id===fixed.TID);
must(ruleset&&ruleset.teamPrizePerVictory===200&&ruleset.prizePerVictory===100&&
 ruleset.matchCaps?.['賞金決勝']===3&&ruleset.source===fixed.RULE,
 'changed official S37 prize or caps');
must(Array.isArray(approval.entries)&&approval.version===1&&
 updates.version===1&&Array.isArray(updates.entries),'missing approval or update log');
fixed.validateProof();
const events={
 '2025-09-15':read('calendar-history/2025-09.json').sessions,
 '2025-10-25':read('calendar-history/2025-10.json').sessions
};
const known=new Set(players.candidates.map(p=>p.name)),aliases=players.confirmedAliases;
const registry=new Map();
for(const r of old)for(const p of r.profiles||[]){
 const id=fixed.accountId(p.url);if(!id)continue;
 const owners=registry.get(id)||new Set();
 owners.add(p.name);registry.set(id,owners);
}
for(const src of fixed.proof.rows){
 const slots=events[src.date].filter(x=>x.dateJst===src.date&&
  x.region===src.region&&x.eventId===fixed.EID&&x.sourceWindowId===src.windowId&&
  x.tournamentId===fixed.TID);
 must(slots.length===1,'official calendar session absent/duplicated '+src.id);
 const start=Date.parse(slots[0].startUtc),end=Date.parse(slots[0].endUtc);
 must(Number.isFinite(start)&&Number.isFinite(end)&&end>start,'invalid session time '+src.id);
}
const desiredNames={
 'あおねこ':{raw:'Celis あおねこ416',initials:'AN',accent:'pink'},
 'DynamicCart1801':{raw:'DynamicCart1801',initials:'DY',accent:'cyan'}
};
const newlyNamed=[];
for(const src of fixed.proof.rows)for(const member of src.members){
 const id=fixed.accountId(member.url),owners=registry.get(id)||new Set();
 must(id&&[...owners].every(owner=>owner===member.name||
  (aliases[member.name]||[]).includes(owner)||(aliases[owner]||[]).includes(member.name)),
  'Epic ID previously assigned to different name '+member.name);
 if(!known.has(member.name)){
  const permit=desiredNames[member.name];
  must(permit&&member.raw===permit.raw,'unsupported new player '+member.name);
  players.candidates.push({name:member.name,initials:permit.initials,accent:permit.accent,
   desc:'2025年S37 Console Duos Victory Cash Cup決勝で1VR・個人$100。'+
    '2026/11/17ユーザー提供Tracker順位表とEpic IDで確認済み。'});
  newlyNamed.push(member.name);known.add(member.name);
 }
 if(member.raw!==member.name){
  const current=aliases[member.name]||[];
  const permit=desiredNames[member.name];
  must(current.includes(member.raw)||permit?.raw===member.raw,
   'unapproved alias '+member.raw);
  if(permit?.raw===member.raw&&!current.includes(member.raw)){
   must(!Object.entries(aliases).some(([name,v])=>name!==member.name&&v.includes(member.raw)),
    'alias already registered to another player');
   aliases[member.name]=[...current,member.raw];
  }
 }
 owners.add(member.name);registry.set(id,owners);
}
const newResults=[],already=[],newLedger=[];
const ids=new Set(results.map(x=>x.id));
const approvalById=new Map(approval.entries.map(x=>[x.id,x]));
must(ids.size===results.length&&approvalById.size===approval.entries.length,
 'baseline IDs duplicated');
const inRound=(r,src)=>{
 if(r.seasonId!==src.seasonId||r.date!==src.date||r.region!==src.region||
  r.tournamentId!==src.tournamentId)return false;
 try{
  const u=new URL(r.source),win=u.searchParams.get('round')||u.searchParams.get('window');
  return win===src.windowId||(!win&&r.round==='Event '+src.roundNo+' · Round 2 / 賞金決勝');
 }catch{return false}
};
const roster=r=>Array.isArray(r.players)?r.players:[r.player];
for(const src of fixed.proof.rows){
 const cat=tournamentData.catalog.find(x=>x.id===src.tournamentId),next=fixed.expected(src,cat);
 const prev=results.find(x=>x.id===next.id);
 if(prev){
  must(JSON.stringify(prev)===JSON.stringify(next)&&
   fixed.verifyPublished(prev,approvalById.get(prev.id)),
   'existing exact result altered: '+src.id);
  already.push(src.id);continue;
 }
 must(!approvalById.has(next.id),'prior approval with missing result '+next.id);
 const overlap=results.filter(r=>inRound(r,src)&&(
  r.rank===next.rank||
  roster(r).slice().sort().join('|')===next.players.slice().sort().join('|')||
  (r.teamAccountIds?.some(id=>next.teamAccountIds.includes(id)))));
 must(!overlap.length,'collision with existing window '+src.id+': '+overlap.map(x=>x.id).join(','));
 ids.add(next.id);results.push(next);
 const h=fixed.historyEntry(next);
 must(fixed.verifyPublished(next,h),'invalid source seal '+src.id);
 approval.entries.push(h);approvalById.set(next.id,h);newLedger.push(h);newResults.push(next);
}
must(newResults.length+already.length===5&&new Set(results.map(x=>x.id)).size===results.length,
 'not exactly five reconciled results');
if(newResults.length){
 must(!updates.entries.some(x=>x.id==='verified-s37-console-five-20261117'),
  'publication note duplicated');
 updates.entries.unshift({id:'verified-s37-console-five-20261117',date:'2026-11-17',
  type:'records',
  title:'S37 NAW/OCE Console Duos Victory Cash Cup決勝5組を追加',
  description:'2025/9/15 NAW Event4決勝4組（rakua/kmyt、あおねこ/Mofu、Pegu/ふぃる、DynamicCart1801/Botえもん）と2025/10/25 OCE Event10決勝Mofu/モバイル勢のまかろん。本人Epic ID・各スクショの順位・チームキル・1VRを検証。全5組チーム$200・各選手$100、合計チーム賞金$1,000。既存戦績と名前を保持。',
  recordIds:newResults.map(x=>x.id)});
}
must(results.length===old.length+newResults.length,'unexpected source result count delta');
const res=validateData({results,players,tournaments:tournamentData});
must(!res.errors.length,'invalid data '+JSON.stringify(res.errors.slice(0,6)));
const errors=validateUpdateLog(results,updates);
must(!errors.length,'invalid updates '+JSON.stringify(errors.slice(0,6)));
if(!dry&&newResults.length){
 publishResults(root,results);
 write('players.json',players);write('approval-history.json',approval);
 write('updates.json',updates);
}
console.log('S37_CONSOLE_FIVE '+JSON.stringify({mode:dry?'dry-run':'apply',
 initial:old.length,final:results.length,newIds:newResults.map(x=>x.id),
 already,addedPlayerNames:newlyNamed,teamPrizeAdded:newResults.reduce((n,x)=>n+x.prize,0)}));
