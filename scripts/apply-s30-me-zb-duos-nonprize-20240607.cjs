'use strict';
// Safe, repeatable 2024/6/7 ME ZB Duos Cash Cup $0 final importer.
// Existing paid teams stay untouched, same final session, never duplicate
// the Αθηνά. alias already confirmed for canonical player るいぼっと.
const fs=require('node:fs'),path=require('node:path');
const {readResults,publishResults}=require('./source-results-store.cjs');
const {validateData}=require('./data-checks.cjs');
const {audit}=require('./validate-approvals.cjs');
const {validateUpdateLog}=require('./validate-updates.cjs');
const {upsertPublicationLog}=require('./reviewed-publication-core.cjs');
const C=require('./verified-s30-duos-cash-20240607.cjs');
const Z=require('./verified-s30-duos-nonprize-20240607.cjs');
const root=path.resolve(__dirname,'..');
const read=name=>JSON.parse(fs.readFileSync(path.join(root,name),'utf8'));
const save=(name,obj)=>fs.writeFileSync(path.join(root,name),JSON.stringify(obj,null,2)+'\n');
const assert=(ok,msg)=>{if(!ok)throw Error('S30_ME_ZB_DUOS_ZERO: '+msg)};
const dryRun=process.argv.includes('--dry-run');
assert(process.argv.every(arg=>!arg.startsWith('--')||arg==='--dry-run'),'invalid CLI option');
const doc=read('data/manual-approvals/20240607-me-zb-duos-zero-finals.json'),b=doc.batch;
assert(doc.version===1&&b&&b.id==='tracker-s30-me-zb-duos-zero-20240607'&&
 b.date===C.DATE&&b.region===C.REGION&&b.eventId===C.EVENT&&b.windowId===C.WINDOW&&
 b.tournamentId===C.TOURNAMENT&&b.source===C.TRACKER&&b.ruleUrl===C.RULE&&
 b.cashCutoff===25&&Array.isArray(b.teams)&&b.teams.length===3,
 'unsupported season/date/window or screenshot batch');
const results=readResults(root).rows,players=read('players.json'),ledger=read('approval-history.json'),
 updates=read('updates.json'),tournaments=read('tournaments.json');
const catalog=tournaments.catalog.find(t=>t.id===C.TOURNAMENT);
assert(catalog&&catalog.name==='ZB Duos Cash Cup'&&catalog.chapter===5&&catalog.season===3&&
 catalog.seasonId==='S30'&&catalog.team==='duo'&&catalog.mode==='zero-build'&&
 catalog.sourceEventIds.includes(C.EVENT),'invalid existing tournament catalog');
const names=new Set(players.candidates.map(x=>x.name));
const aliasOwner=new Map([...names].map(n=>[n,n]));
for(const [canonical,list] of Object.entries(players.confirmedAliases||{})){
 assert(names.has(canonical)&&Array.isArray(list),'broken existing canonical player aliases');
 for(const raw of list){
  assert(!aliasOwner.has(raw)||aliasOwner.get(raw)===canonical,
   'multiple aliases or aliases belonging to distinct players: '+raw);
  aliasOwner.set(raw,canonical);
 }
}
assert(names.has('るいぼっと')&&
 aliasOwner.get('Αθηνά.')==='るいぼっと',
 'Αθηνά. must be the already-confirmed alias of るいぼっと');
const uuid=url=>{try{return new URL(url).searchParams.get('id')}catch{return null}};
const tracked=new Map();
for(const r of results)for(const p of r.profiles||[]){
 const id=uuid(p.url);
 if(id){
  const canonical=aliasOwner.get(p.name)||p.name;
  assert(!tracked.has(id)||tracked.get(id)===canonical,
   'existing Tracker Epic ID points to multiple players '+id);
  tracked.set(id,canonical);
 }
}
const usedRanks=new Set(),newRecords=[],unchanged=[],newPlayers=[];
for(const team of b.teams){
 const t=Z.TARGETS.find(x=>x.rank===team.rank);
 assert(t&&!usedRanks.has(team.rank)&&team.rank>b.cashCutoff&&
  [29,32,37].includes(team.rank)&&
  team.points===t.points&&team.kills===t.kills&&team.vrs===0&&
  team.matches===t.matches&&team.teamPrize===0&&
  Number.isSafeInteger(team.points)&&team.points>=0&&team.matches>=1&&
  team.matches<=6&&team.kills>=0&&
  Array.isArray(team.members)&&team.members.length===2,
  'screenshot score or $0 payout mismatch at '+team.rank);
 usedRanks.add(team.rank);
 const taken=new Set();
 for(let i=0;i<team.members.length;i++){
  const m=team.members[i],p=t.members[i];
  assert(m.name===p.name&&m.raw===p.raw&&uuid(m.url)===p.uuid&&
   typeof m.url==='string'&&m.url==='https://fortnitetracker.com/profile/all/'+
    encodeURIComponent(m.raw)+'/events?id='+m.url.split('id=')[1]&&
   new URL(m.url).hostname==='fortnitetracker.com'&&
   /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(p.uuid)&&
   (!aliasOwner.has(p.name)||aliasOwner.get(p.name)===p.name)&&
   (!aliasOwner.has(p.raw)||aliasOwner.get(p.raw)===p.name)&&
   (!tracked.has(p.uuid)||tracked.get(p.uuid)===p.name)&&!taken.has(p.uuid),
   'unverified Epic identity/alias at rank '+team.rank+': '+m.name);
  taken.add(p.uuid);tracked.set(p.uuid,p.name);
  if(!names.has(p.name)){
   assert(p.name!=='るいぼっと'&&p.raw===p.name,
    'do not create a duplicate identity for Αθηνά.');
   players.candidates.push({
    name:p.name,initials:/^[a-z]/i.test(p.name)?p.name.slice(0,2).toUpperCase():p.name.slice(0,2),
    accent:players.candidates.length%2?'cyan':'violet',
    desc:'2024/6/7 ME ZB Duos Cash Cup賞金決勝'+team.rank+'位・チーム'+team.kills+
      'キル・0VR・個人賞金$0。スクショと本人Trackerアカウントを照合。'
   });
   names.add(p.name);aliasOwner.set(p.name,p.name);newPlayers.push(p.name);
  }
 }
 const player=t.members.map(x=>x.name).join(' / ');
 const matching=results.filter(x=>x.date===C.DATE&&x.region===C.REGION&&
  x.tournamentId===C.TOURNAMENT&&
  (x.id===t.id||(Array.isArray(x.players)&&
   x.players.slice().sort().join('\u0000')===t.members.map(m=>m.name).sort().join('\u0000'))||
   x.rank===t.rank&&(x.source===C.SOURCE||x.round.includes('Event 1'))));
 assert(matching.length<=1,'existing result duplicates or rank conflict '+team.rank);
 if(matching.length){
  const entry=ledger.entries.find(x=>x.recordId===t.id);
  assert(matching[0].id===t.id&&Z.verifyNonprizeRow(matching[0],entry),
   'existing result differs from verified original: '+team.rank);
  unchanged.push(t.id);continue;
 }
 assert(!results.some(x=>x.id===t.id),'duplicate record id '+t.id);
 const row={
  id:t.id,date:C.DATE,region:C.REGION,player,
  players:t.members.map(x=>x.name),playerRaw:t.members.map(x=>x.raw).join(' / '),
  event:catalog.name,round:C.ROUND,rank:t.rank,points:t.points,kills:t.kills,
  vrs:0,matches:t.matches,prize:0,teamPrize:0,prizePerPlayer:0,
  kind:'賞金決勝',source:C.SOURCE,verified:true,
  tournamentId:C.TOURNAMENT,seasonId:'S30',chapter:5,season:3,
  profiles:team.members.map(m=>({name:m.name,url:m.url})),
  note:'ユーザー提供2024/6/7 ME ZB Duos Cash Cup Event1 Round2のFortnite Tracker画像で'+
   t.rank+'位・'+t.points+'pt・'+t.kills+'キル・0VRを確認。'+
   '公式賞金圏外（上位25組のみ賞金）：チーム$0・個人各$0。'+
   '元順位表: '+C.TRACKER+'。公式規則: '+C.RULE
 };
 const entry={id:t.id,recordId:t.id,decision:'published',policy:Z.POLICY,
  approvedAt:new Date().toISOString(),
  approvedBy:'ChatGPT / owner-authorized verified Tracker screenshot review',
  source:C.SOURCE,rule:C.RULE,
  evidence:'2024-06-07 ME ZB Duos Event1 Round2 scoreboard rank 29/32/37, noncash; official rules and 2 Tracker account IDs: '+C.TRACKER};
 assert(Z.verifyNonprizeRow(row,entry),'new row failed zero-cash proof '+t.rank);
 results.push(row);ledger.entries.push(entry);newRecords.push(row);
}
assert(usedRanks.size===3,'incomplete three-team screenshot reconciliation');
if(newRecords.length)upsertPublicationLog(updates,{
 id:b.id,date:'2026-11-13',
 title:'2024/6/7 ME ZB Duos Cash Cup賞金決勝：29・32・37位の3組を追加',
 description:'スクショ・本人IDで出場を確認。3組とも上位25位の賞金圏外のためチーム/個人$0。Αθηνά.は既存るいぼっとと同一人物として統合し、既掲載10組の賞金合計は変更しない。',
 recordIds:newRecords.map(r=>r.id)
});
const validation=validateData({results,players,tournaments});
assert(validation.errors.length===0,'data validation errors '+JSON.stringify(validation.errors.slice(0,6)));
const approvalErrors=audit(results,ledger,players);
assert(approvalErrors.length===0,'approval errors '+JSON.stringify(approvalErrors.slice(0,6)));
const updateErrors=validateUpdateLog(results,updates);
assert(updateErrors.length===0,'publication log errors '+JSON.stringify(updateErrors.slice(0,6)));
if(!dryRun&&newRecords.length){
 publishResults(root,results);
 save('players.json',players);save('approval-history.json',ledger);save('updates.json',updates);
}
console.log('S30_ME_ZB_DUOS_ZERO '+JSON.stringify({
 mode:dryRun?'dry-run':'apply',added:newRecords.length,alreadyPublished:unchanged.length,
 newPlayers,recordIds:newRecords.map(x=>x.id),before:results.length-newRecords.length,
 after:results.length,teamPrizeAdded:0,personalPrizeAdded:0
}));
