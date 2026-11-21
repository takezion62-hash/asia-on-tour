'use strict';
// Display-only audit of authentic archived round IDs. Never manufacture
// qualifying *advancement* or mutate published data/approval/cash/PR.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {loadData,tournamentKey}=require('../scripts/data-checks.cjs');
const ROOT=path.resolve(__dirname,'..');
const data=loadData(ROOT).data,records=data.results;
const app=fs.readFileSync(path.join(ROOT,'app.js'),'utf8');
const begin=app.indexOf('    function isQualifyingParticipation(');
const end=app.indexOf('    // Calendar-only result scope;',begin);
assert.ok(begin>=0&&end>begin,'app qualifier classifier boundary changed');
// Evaluate the actual client-side functions with known catalog data rather
// than testing an independently copied guess of the implementation.
const logic=vm.runInNewContext('(function(){'+app.slice(begin,end)+
  ';return {isQualifyingParticipation,canonicalTournamentRound,canonicalTournamentKind}})()',{
  tournamentCatalog:data.tournaments.catalog,
  all:()=>records,
  classifyTournamentRecord:r=>({id:tournamentKey(r,data)})
});
const catalog=new Map(data.tournaments.catalog.map(t=>[t.id,t]));
function stage(row){
 const id=tournamentKey(row,data);
 return {round:logic.canonicalTournamentRound(row.round,row.kind,id,row.date,row.region,row.source),
  kind:logic.canonicalTournamentKind(row.kind,id,row.round,row.source)};
}
function matching({date,region,event,round,sourceIncludes}){
 const row=records.find(x=>x.date===date&&x.region===region
  &&x.kind==='参加確認'
  &&(!event||x.event===event)
  &&(!round||String(x.round||'').startsWith(round))
  &&(!sourceIncludes||String(x.source||'').includes(sourceIncludes)));
 assert.ok(row,'missing existing sample: '+[date,region,event,round,sourceIncludes].join('/'));
 return row;
}
test('source-backed Round 1/Qualifier attendees display as 予選 across competition series',()=>{
 const examples=[
  {date:'2024-11-15',region:'ME',event:'Trios Cash Cup',round:'Event 3 · Round 1'},
  {date:'2025-01-18',region:'NAW',event:'Solo Cash Cup',round:'Event 4 · Round 1'},
  {date:'2025-07-19',region:'NAW',event:'Squid Grounds Cash Cup',round:'Event 4 · Round 1'},
  {date:'2025-09-28',region:'NAW',event:'Duos Console Victory Cash Cup',round:'Event 6 · Round 1'},
  {date:'2026-07-30',region:'NAW',event:'PlayStation Typical Gamer Icon Cup Battle Royale',round:'Qualifier'},
  {date:'2026-11-06',region:'NAC',event:'Fortnite Performance Evaluation',round:'Event 1 · Round 1'}
 ];
 for(const query of examples){
  const row=matching(query),before=JSON.stringify(row),result=stage(row);
  assert.equal(result.kind,'予選',JSON.stringify(query));
  assert.match(result.round,/\/ 予選$/u,JSON.stringify(query));
  assert.equal(JSON.stringify(row),before,'result data must stay unchanged');
 }
});
test('legacy PlayStation single placeholder is a qualifier ONLY with source-window proof',()=>{
 const samples=[
  matching({date:'2024-12-07',region:'ME',event:'PlayStation Cup',round:'単一開催枠',sourceIncludes:'Qualifier1'}),
  matching({date:'2025-04-30',region:'NAW',event:'PlayStation Cup',round:'単一開催枠',sourceIncludes:'Qualifier1'})
 ];
 for(const row of samples)assert.deepEqual(stage(row),{kind:'予選',round:'Qualifier / 予選'});
 const t=samples[1],id=tournamentKey(t,data);
 const without={...t,source:''},untrusted={...t,source:'https://not-epic.example/?round=S34_PlaystationCupQualifier1_NAW'};
 assert.equal(stage(without).kind,'参加確認');
 assert.equal(stage(untrusted).kind,'参加確認');
 assert.equal(logic.canonicalTournamentKind(t.kind,id,t.round,t.source),'予選');
});
test('Round 2, standalone events, FNCS match days and no-proof sources never become qualifiers',()=>{
 const controls=[
  matching({date:'2025-02-03',region:'NAW',event:'Solo Cash Cup',round:'Event 6 · Round 2'}),
  matching({date:'2025-12-22',region:'NAW',event:'NVIDIA GeForce RTX Cup',round:'単一開催枠'}),
  matching({date:'2026-03-24',region:'ME',event:'FNCS Division 1',round:'単一開催枠'}),
  matching({date:'2026-11-02',region:'NAW',event:'Solo Reload Test Cup',round:'単一開催枠'})
 ];
 for(const row of controls){
  const id=tournamentKey(row,data),out=stage(row);
  assert.equal(logic.isQualifyingParticipation(row.kind,id,row.round,row.source),false,row.id);
  assert.notEqual(out.kind,'予選',row.id);
 }
 const row=matching({date:'2025-01-18',region:'NAW',event:'Solo Cash Cup',round:'Event 4 · Round 1'});
 assert.equal(logic.canonicalTournamentKind('参加確認',tournamentKey(row,data),'Event 4 · Round 2 / 参加確認',row.source),'参加確認');
});
test('known console Round 1 sessions merge participant and qualifier labels without changing results',()=>{
 const group=records.filter(x=>x.date==='2025-09-28'&&x.region==='NAW'&&
  x.event==='Duos Console Victory Cash Cup'&&
  String(x.round||'').includes('Event 6 · Round 1'));
 assert.ok(group.some(x=>x.kind==='参加確認'),'attendance rows');
 assert.ok(group.some(x=>x.kind==='予選'),'separately verified qualifier rows');
 const keys=new Set(group.map(x=>JSON.stringify([x.date,x.region,tournamentKey(x,data),stage(x).round,stage(x).kind])));
 assert.equal(keys.size,1,'one displayed Round 1 leaderboard, never two separate cards');
 assert.ok(group.every(x=>x.verified===true||x.kind==='参加確認'),'keep original proof status');
});
test('all display-normalized attendees have an explicit stage or a trusted PlayStation Qualifier window',()=>{
 let eligible=0,kept=0;
 for(const row of records.filter(x=>x.kind==='参加確認')){
  const before=JSON.stringify(row),id=tournamentKey(row,data),series=catalog.get(id)?.series;
  const result=stage(row);
  if(result.kind==='予選'){
   eligible++;
   assert.ok(
     /^Qualifier(?:\s+\d+)?\s*\/\s*参加確認$/iu.test(String(row.round||'').trim())
     ||(['cash-cup','victory-cup','performance-evaluation','playstation-cup','console-champions-cup'].includes(series)
       &&/^(?:(?:Event|Day|Week)\s*\d+\s*·\s*)?Round\s*1\s*\/\s*参加確認$/iu.test(String(row.round||'').trim()))
     ||(series==='playstation-cup'
       &&/^単一開催枠\s*\/\s*参加確認$/u.test(String(row.round||'').trim())
       &&/Qualifier\d*(?:[_-]|$)/iu.test(String(row.source||''))),
     'unproven qualifier promotion '+row.id);
  }else kept++;
  assert.equal(JSON.stringify(row),before,'display must never mutate source records');
 }
 assert.ok(eligible>=100,'wide historical source coverage is expected');
 assert.ok(kept>0,'unverified / nonqualifying attendance must remain visible');
});
