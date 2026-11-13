'use strict';
// Owner-supplied Fortnite Tracker screenshots: 2024-06-07 ME ZB Duos Cash Cup.
// Correct 8 already-published unconfirmed records and append 2 genuinely absent
// teams. This script is idempotent, exact-window scoped, and fail-closed.
const fs=require('node:fs'),path=require('node:path');
const {readResults,publishResults}=require('./source-results-store.cjs');
const {validateData}=require('./data-checks.cjs');
const {audit}=require('./validate-approvals.cjs');
const {upsertPublicationLog}=require('./reviewed-publication-core.cjs');
const C=require('./verified-s30-duos-cash-20240607.cjs');
const root=path.resolve(__dirname,'..');
const read=name=>JSON.parse(fs.readFileSync(path.join(root,name),'utf8'));
const write=(name,obj)=>fs.writeFileSync(path.join(root,name),JSON.stringify(obj,null,2)+'\n');
const assert=(ok,msg)=>{if(!ok)throw Error('S30_ZB_DUOS_CASH_REPAIR: '+msg);};
const dryRun=process.argv.includes('--dry-run');
assert(process.argv.every(x=>x==='--dry-run'||!x.startsWith('--')),'unsupported options');
const doc=read('data/manual-approvals/20240607-me-zb-duos-cash-evidence.json');
const b=doc.batch;
assert(doc.version===1&&b?.id==='tracker-s30-me-zb-duos-final-20240607'&&
 b.date===C.DATE&&b.region===C.REGION&&
 b.tournamentId===C.TOURNAMENT&&b.eventId===C.EVENT&&b.windowId===C.WINDOW&&
 b.source===C.TRACKER&&b.ruleUrl===C.RULE&&
 Array.isArray(b.teams)&&b.teams.length===10,'exact source/date/window/teams mismatch');
const results=readResults(root).rows,players=read('players.json'),
 tournaments=read('tournaments.json'),ledger=read('approval-history.json'),updates=read('updates.json');
const catalog=tournaments.catalog.find(x=>x.id===C.TOURNAMENT);
assert(catalog&&catalog.seasonId==='S30'&&catalog.chapter===5&&catalog.season===3&&
 catalog.name==='ZB Duos Cash Cup'&&catalog.team==='duo'&&
 catalog.mode==='zero-build'&&catalog.sourceEventIds.includes(C.EVENT),
 'tournament catalog identity mismatch');
const names=new Set(players.candidates.map(x=>x.name));
const aliasOwner=new Map();
for(const name of names)aliasOwner.set(name,name);
for(const [canonical,list] of Object.entries(players.confirmedAliases))
 for(const raw of list){
  assert(!aliasOwner.has(raw)||aliasOwner.get(raw)===canonical,
    'preexisting alias maps to multiple people: '+raw);
  aliasOwner.set(raw,canonical);
 }
const idsSeen=new Set(),memberIds=new Map();
const uuid=u=>{try{return new URL(u).searchParams.get('id')}catch{return null}};
const amended=[],added=[],newPlayers=[],unchanged=[];
const roster=x=>Array.isArray(x.players)&&x.players.length?x.players:[x.player];
const profileMatches=(old,m)=>{
 for(const rec of results)for(const p of rec.profiles||[]){
  if(uuid(p.url)===uuid(m.url))
   assert((aliasOwner.get(p.name)||p.name)===m.name,
    'Tracker UUID belongs to another canonical player: '+m.name);
 }
};
for(const team of b.teams){
 const expected=C.TARGETS.find(x=>x.rank===team.rank);
 assert(expected&&!idsSeen.has(team.rank)&&team.points===expected.points&&
  team.kills===expected.kills&&team.vrs===expected.vrs&&
  team.matches===expected.matches&&team.teamPrize===expected.prize&&
  Array.isArray(team.members)&&team.members.length===2&&
  team.members.map(x=>x.name).join(' / ')===expected.player,
  'uploaded screenshot diverges from independently pinned record: '+team.rank);
 idsSeen.add(team.rank);
 assert(team.teamPrize%2===0,'uneven verified team payout');
 for(const m of team.members){
  let url;
  try{url=new URL(m.url)}catch{assert(false,'invalid account URL at '+team.rank)}
  const u=uuid(m.url);
  assert(typeof m.name==='string'&&m.name.length>0&&m.name.trim()===m.name&&
   typeof m.raw==='string'&&m.raw.length>0&&m.raw.trim()===m.raw&&
   url.protocol==='https:'&&url.hostname==='fortnitetracker.com'&&
   url.pathname.startsWith('/profile/all/')&&
   /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(u||'')&&
   (!aliasOwner.has(m.name)||aliasOwner.get(m.name)===m.name)&&
   (!memberIds.has(u)||memberIds.get(u)===m.name),
   'unverified Epic ID/canonical name: '+m.name);
  memberIds.set(u,m.name);
  profileMatches(results,m);
  if(!names.has(m.name)){
   // Only the two missing team members may be added as new players.
   assert(['1度だけこの壁を越えさせてやる','れんむZ'].includes(m.name),
     'unexpected missing player: '+m.name);
   players.candidates.push({name:m.name,initials:/^[a-z]/i.test(m.name)?
    m.name.slice(0,2).toUpperCase():m.name.slice(0,2),
    accent:players.candidates.length%2?'cyan':'violet',
    desc:'2024/6/7 ME ZB Duos Cash Cup賞金決勝'+team.rank+
      '位・個人賞金$'+team.teamPrize/2+'。本人Fortnite Tracker IDと決勝スクショで照合。'});
   names.add(m.name);aliasOwner.set(m.name,m.name);newPlayers.push(m.name);
  }
 }
 const targetPlayers=team.members.map(x=>x.name);
 const matching=results.filter(x=>x.date===C.DATE&&x.region===C.REGION&&
  x.tournamentId===C.TOURNAMENT&&
  roster(x).slice().sort().join('\u0000')===targetPlayers.slice().sort().join('\u0000'));
 assert(matching.length<=1,'duplicate existing team at rank '+team.rank);
 const note='ユーザー提供Fortnite Tracker決勝スクショ・各選手Epic IDで確認。2024/6/7 ME '+
  'ZB Duos Cash Cup Event 1 Round 2、'+team.rank+'位・'+team.points+
  'pt・'+team.kills+'キル・'+team.vrs+'VR。順位によるチーム賞金$'+team.teamPrize+
  '、個人$'+team.teamPrize/2+'（支払完了は未確認）。スコアボード: '+
  C.TRACKER+'。公式規則: '+C.RULE;
 let row=matching[0],approval=null;
 const profiles=team.members.map(m=>({name:m.name,url:m.url}));
 if(row){
  assert(row.id===expected.id&&row.player===expected.player&&
   ['rank','points','kills','vrs','matches'].every(k=>row[k]===team[k])&&
   row.source===C.SOURCE&&row.verified===true,
   'existing score, source or stable ID mismatches screenshot at rank '+team.rank);
  const previous=ledger.entries.filter(x=>x.recordId===row.id);
  assert(previous.length===1,'expected one previously approved record '+row.id);
  approval=previous[0];
  if(row.kind==='賞金決勝'){
   assert(C.verifyCashRow(row,approval),
     'already-corrected entry has conflicting team/personal award at rank '+team.rank);
   unchanged.push(row.id);continue;
  }
  assert(row.kind==='参加確認'&&row.round==='Event 1 · Round 2 / 参加確認'&&
   row.prize===null&&approval.policy==='attendance-only',
   'previous record is not a permitted unconfirmed attendance result '+team.rank);
  row.kind='賞金決勝';row.round=C.ROUND;row.prize=team.teamPrize;
  row.teamPrize=team.teamPrize;row.prizePerPlayer=team.teamPrize/2;
  row.profiles=profiles;row.note=note;
  approval.policy=C.POLICY;approval.rule=C.RULE;
  approval.evidence='2024-06-07 ME Event1 Round2 Tracker team award screenshot & two unique account IDs: '+C.TRACKER;
  amended.push(row.id);
 }else{
  assert([7,16].includes(team.rank),'unexpected new team: '+team.rank);
  assert(!results.some(x=>x.id===expected.id),'new deterministic ID collision: '+expected.id);
  row={id:expected.id,date:C.DATE,region:C.REGION,
   player:targetPlayers.join(' / '),players:targetPlayers,
   playerRaw:team.members.map(m=>m.raw).join(' / '),
   event:catalog.name,round:C.ROUND,rank:team.rank,points:team.points,
   kills:team.kills,vrs:team.vrs,matches:team.matches,
   prize:team.teamPrize,teamPrize:team.teamPrize,prizePerPlayer:team.teamPrize/2,
   kind:'賞金決勝',source:C.SOURCE,profiles,verified:true,
   tournamentId:catalog.id,seasonId:catalog.seasonId,
   chapter:catalog.chapter,season:catalog.season,note};
  results.push(row);added.push(row.id);
  ledger.entries.push({id:row.id,recordId:row.id,decision:'published',
   policy:C.POLICY,approvedAt:new Date().toISOString(),
   approvedBy:'ChatGPT / owner-authorized screenshot correction',
   source:C.SOURCE,rule:C.RULE,
   evidence:'2024-06-07 ME Event1 Round2 original Tracker screenshot & account IDs: '+C.TRACKER});
  approval=ledger.entries.at(-1);
 }
 assert(C.verifyCashRow(row,approval),
  'post-correction provenance or money check failed at rank '+team.rank);
}
assert(idsSeen.size===C.TARGETS.length&&
 C.TARGETS.every(x=>idsSeen.has(x.rank)),'not all 10 screenshot teams were checked');
const nextRows=results.filter(x=>x.date===C.DATE&&x.region===C.REGION&&
 x.tournamentId===C.TOURNAMENT&&x.kind==='賞金決勝'&&
 C.TARGETS.some(t=>t.id===x.id));
assert(nextRows.length===10&&
 nextRows.reduce((sum,x)=>sum+x.prize,0)===2400&&
 nextRows.reduce((sum,x)=>sum+x.prizePerPlayer*x.players.length,0)===2400,
 'team and individual cash totals must both equal the screenshot $2400');
const changes=amended.concat(added);
if(changes.length)upsertPublicationLog(updates,{
 id:b.id,date:'2026-11-13',
 title:'2024/6/7 ME ZB Duos Cash Cup決勝：10組の賞金額・個人配分を訂正',
 description:'本人ID・ユーザー提供Tracker画像の1〜25位賞金表示を照合。既掲載8件を参加確認から賞金決勝へ修正し、不足2件を追加。総チーム賞金$2400（各2名に正確に配分）。',
 // Existing eight records are corrections: they remain tied to their original
 // publication log; only the two newly imported records are new publication IDs.
 recordIds:added
});
const validated=validateData({results,players,tournaments});
assert(validated.errors.length===0,
 'site data errors: '+JSON.stringify(validated.errors.slice(0,6)));
const historyErrors=audit(results,ledger,players);
assert(historyErrors.length===0,
 'approval history errors: '+JSON.stringify(historyErrors.slice(0,8)));
if(!dryRun&&changes.length){
 publishResults(root,results);
 write('players.json',players);write('approval-history.json',ledger);
 write('updates.json',updates);
}
console.log('S30_ZB_DUOS_CASH_REPAIR '+JSON.stringify({mode:dryRun?'dry-run':'apply',
 corrected:amended.length,imported:added.length,unchanged:unchanged.length,
 newPlayers,teamPrizeTotal:2400,personalPrizeTotal:2400,
 before:results.length-added.length,after:results.length,recordIds:changes}));
