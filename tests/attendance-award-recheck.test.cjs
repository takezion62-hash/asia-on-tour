'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const M=require('../scripts/attendance-award-recheck.cjs');
const ROOT=path.resolve(__dirname,'..');
const read=n=>JSON.parse(fs.readFileSync(path.join(ROOT,n),'utf8'));
const rule=read('tournament-rules.json').rules.find(r=>r.id==='ch7s5-playstation-cup-zero-build');
const row={id:'example',kind:'参加確認',round:'Qualifier / 参加確認',verified:true,prize:null,rank:80,region:'OCE',tournamentId:rule.id};
test('qualifying cutoff and positive official prizes only, never outside-cutoff or previously confirmed cash',()=>{
 assert.equal(M.route(row).kind,'qualifier');assert.equal(M.route({...row,rank:81}),null);
 assert.equal(M.route({...row,rank:0}),null);assert.equal(M.route({...row,kind:'予選',prize:0}),null);
 assert.equal(M.route({...row,round:'Final / 参加確認',rank:25}).kind,'cash');
 assert.equal(M.route({...row,round:'Final / 参加確認',rank:26}),null);
 assert.equal(M.route({...row,round:'Qualifier / 参加確認',rank:12,prize:0}),null);
});
test('only a complete, mature, exact saved prefix covering the official cutoff can correct a qualifier; cash requires all pages',()=>{
 const candidate={...row,reviewOnly:true,teamAccountIds:['a'.repeat(32)]};
 const cp={complete:true,rankingOrderValid:true,epicIdsRetained:true,pages:2,nextPage:2,totalPages:40,lastSeenRank:200,lastSuccessAt:'2026-11-24T02:00:00Z',proposals:[candidate]};
 const slot={endUtc:'2026-11-23T10:00:00Z'},now=Date.parse('2026-11-25T05:00:00Z');
 assert.ok(M.checkpointProof(cp,row,'qualifier',rule,slot,now));
 assert.equal(M.checkpointProof(cp,row,'cash',rule,slot,now),null);
 for(const bad of [{...cp,complete:false},{...cp,pages:1},{...cp,lastSeenRank:79},{...cp,retryAfter:'2026-11-26T00:00:00Z'},{...cp,lastSuccessAt:'2026-11-23T10:01:00Z'},{...cp,proposals:[{...candidate,rank:79}]},{...cp,proposals:[candidate,candidate]}])
  assert.equal(M.checkpointProof(bad,row,'qualifier',rule,slot,now),null);
});
test('production dry run checks actual saved evidence, preserves all IDs and leaves source and approval files untouched',()=>{
 const manifest='source-results/manifest.json',ledger='approval-history.json';
 const before=[manifest,ledger,M.HISTORY].map(n=>fs.existsSync(path.join(ROOT,n))?fs.readFileSync(path.join(ROOT,n),'utf8'):null);
 const context=M.loadContext(ROOT),out=M.run(ROOT,{dryRun:true});
 assert.deepEqual(out.results.map(r=>r.id),context.results.map(r=>r.id));
 assert.equal(out.inventory.total,context.results.filter(r=>r.kind==='参加確認').length);
 assert.equal(out.inventory.counts.corrected||0,out.changes.length);
 const ids=new Set(out.changes.map(h=>h.id)),entries=new Map(read(ledger).entries.map(e=>[e.recordId,e]));
 for(let i=0;i<out.results.length;i++){
  const old=context.results[i],r=out.results[i];
  if(!ids.has(r.id)){assert.deepEqual(r,old);continue}
  assert.equal(old.kind,'参加確認');assert.equal(old.prize,null);
  for(const k of ['rank','points','kills','matches','vrs','player','source','teamAccountIds'])assert.deepEqual(r[k],old[k]);
  assert.ok(M.verifyPromotion(r,entries.get(r.id),{...context,results:out.results},out.history));
  assert.equal(M.verifyPromotion({...r,prize:r.prize+100},entries.get(r.id),{...context,results:out.results},out.history),false);
 }
 assert.deepEqual([manifest,ledger,M.HISTORY].map(n=>fs.existsSync(path.join(ROOT,n))?fs.readFileSync(path.join(ROOT,n),'utf8'):null),before);
});

test('NVIDIA positive prize prefix is frozen accurately; other cash still needs all pages',()=>{
 const nv=require('../scripts/automatic-nvidia-approval.cjs');
 const n=nv.RULES['ch7s1-nvidia-geforce-rtx-cup'];
 const slot=read('calendar-history/2025-12.json').sessions.find(x=>x.eventId==='S39_NvidiaCup'&&x.region==='NAW');
 const old={id:'auto-s39-example',kind:'参加確認',round:'単一開催枠 / 参加確認',verified:true,prize:null,rank:21,region:'NAW',seasonId:'S39',date:slot.dateJst,tournamentId:n.id};
 const candidate={...old,reviewOnly:true,teamAccountIds:['a'.repeat(32)]};
 const end=Date.parse(slot.endUtc),now=end+48*3600000;
 const cp={complete:false,rankingOrderValid:true,epicIdsRetained:true,pages:1,nextPage:1,totalPages:100,lastSeenRank:100,lastSuccessAt:new Date(end+5*3600000).toISOString(),proposals:[candidate]};
 const frozen=M.checkpointProof(cp,old,'cash',n,slot,now);
 assert.ok(frozen);assert.equal(frozen.complete,false);
 assert.equal(frozen.nextPage,1);assert.equal(frozen.totalPages,100);
 assert.deepEqual(M.checkpointProof(frozen,old,'cash',n,slot,now),frozen);
 assert.equal(M.checkpointProof({...cp,lastSeenRank:40},old,'cash',n,slot,now),null);
 assert.equal(M.checkpointProof({...cp,lastErrorCode:'429'},old,'cash',n,slot,now),null);
 assert.equal(M.checkpointProof(cp,old,'cash',rule,slot,now),null);
});

test('registered PlayStation final partial proof is frozen, but cannot authorize a qualifier or wrong regional boundary',()=>{
 // Synthetic unit-test window: the live archive may not yet contain the
 // final. Production inspect() still requires a real, unique archived slot.
 const eventId=rule.eventIds[0];
 const slot={eventId,sourceWindowId:eventId+'_'+rule.roundWindows.final+'_OCE',
  dateJst:'2026-11-24',startUtc:'2026-11-24T07:00:00Z',endUtc:'2026-11-24T10:00:00Z'};
 const old={...row,round:'Final / 参加確認',rank:20,seasonId:rule.seasonId,date:slot.dateJst};
 const candidate={...old,reviewOnly:true,teamAccountIds:['a'.repeat(32)]};
 const end=Date.parse(slot.endUtc),now=end+48*3600000;
 const cp={complete:false,rankingOrderValid:true,epicIdsRetained:true,pages:1,nextPage:1,totalPages:10,lastSeenRank:100,lastSuccessAt:new Date(end+5*3600000).toISOString(),proposals:[candidate]};
 const frozen=M.checkpointProof(cp,old,'cash',rule,slot,now);
 assert.ok(frozen);assert.equal(frozen.complete,false);assert.deepEqual(M.checkpointProof(frozen,old,'cash',rule,slot,now),frozen);
 assert.equal(M.checkpointProof({...cp,lastSeenRank:25},old,'cash',rule,slot,now),null);
 assert.equal(M.checkpointProof(cp,old,'qualifier',rule,slot,now),null);
});

function fixture(tournamentId,round=1){
 const rule=read('tournament-rules.json').rules.find(r=>r.id===tournamentId);
 const catalog=read('tournaments.json').catalog.find(r=>r.id===tournamentId);
 const region='EU',eventId=rule.eventIds[0],ps=rule.series==='playstation-cup';
 const label=ps?'Qualifier':'Event 1 · Round '+round;
 const windowId=(rule.windowIdPrefix||eventId)+(ps?'_Qualifier_':'_Event1Round'+round+'_')+region;
 const key='epicgames_'+eventId+'_'+region+'/'+windowId,source='https://www.fortnite.com/competitive/events/'+eventId+'/?region='+region+'&round='+windowId;
 const names=['A','B','C'].slice(0,{solo:1,duo:2,trio:3}[rule.team]),ids=names.map((_,i)=>String(i+1).repeat(32));
 const id='auto-s43-'+require('node:crypto').createHash('sha256').update(JSON.stringify([eventId+'/'+windowId,ids])).digest('hex').slice(0,12);
 const rank=round===1?rule.advance[region]:2;
 const row={id,date:'2026-11-24',region,player:names.join(' / '),playerRaw:names.join(' / '),event:catalog.name,
  round:label+' / 参加確認',rank,points:round===1?300:200,kills:12,vrs:round===1?1:2,
  prize:null,kind:'参加確認',matches:round===1?6:4,seasonId:'S43',chapter:7,season:5,
  tournamentId,source,verified:true,...(names.length>1?{players:names}:{})};
 const candidate={...row,reviewOnly:true,teamAccountIds:ids},slot={eventId,sourceWindowId:windowId,dateJst:row.date,region,seasonId:row.seasonId,tournamentId,name:row.event,url:source,round:label,stage:round===1?'予選':'決勝',startUtc:'2026-11-24T01:00:00Z',endUtc:'2026-11-24T04:00:00Z'};
 const now=Date.parse('2026-11-25T10:00:00Z'),cp={complete:false,rankingOrderValid:true,epicIdsRetained:true,pages:1,nextPage:1,totalPages:10,lastSeenRank:rule.advance[region]+1,lastSuccessAt:'2026-11-24T12:00:00Z',proposals:[candidate]};
 const ledger={version:1,entries:[{id,recordId:id,source,policy:'attendance-only',decision:'published'}]};
 const context={results:[row],players:{candidates:names.map(name=>({name}))},tournaments:{catalog:[catalog]},verifiedAccounts:ids.map((epicAccountId,i)=>({epicAccountId,player:names[i],confirmed:true})),sessions:()=>[slot],scanDocs:[{file:'history-sync-scan.json',doc:{windows:{[key]:cp}}}]};
 return {row,candidate,slot,now,cp,ledger,context,key};
}
test('phase 5 replays partial PlayStation and Reload Duo qualifiers plus Performance top26 and VR awards',()=>{
 for(const [tournamentId,round,kind,prize] of [
  ['ch7s5-playstation-cup-zero-build',1,'予選',0],
  ['ch7s5-reload-zero-build-duos-cash-cup',1,'予選',0],
  ['ch7s5-performance-evaluation-trios',1,'予選',0],
  ['ch7s5-performance-evaluation-trios',2,'Performance決勝',2400]
 ]){
  const x=fixture(tournamentId,round),out=M.plan(x.context,x.ledger,undefined,{now:x.now});
  assert.equal(out.changes.length,1,JSON.stringify(out.held));
  const corrected=out.results[0];assert.equal(corrected.id,x.row.id);assert.equal(corrected.kind,kind);assert.equal(corrected.prize,prize);
  if(round===2)assert.equal(corrected.prizePerPlayer,800);else assert.match(corrected.round,/予選突破$/);
  assert.equal(M.verifyPromotion(corrected,x.ledger.entries[0],{...x.context,results:out.results},out.history),true);
  assert.equal(M.verifyPromotion({...corrected,points:999},x.ledger.entries[0],{...x.context,results:out.results},out.history),false);
  assert.equal(M.plan({...x.context,results:out.results},x.ledger,out.history,{now:x.now}).changes.length,0);
 }
});
test('phase 5 blocks conflicting snapshots, missing ledger, duplicate ledger, immature evidence and unknown rules',()=>{
 const make=()=>fixture('ch7s5-performance-evaluation-trios');
 for(const mutate of [
  x=>x.context.scanDocs.push({file:'auto-sync-scan.json',doc:{windows:{[x.key]:{...x.cp,proposals:[{...x.candidate,rank:1}]}}}}),
  x=>x.ledger.entries.length=0,
  x=>x.ledger.entries.push({...x.ledger.entries[0]}),
  x=>x.cp.lastSeenRank=26,
  x=>x.cp.lastErrorCode='429',
  x=>x.context.sessions=()=>[],
  x=>x.context.verifiedAccounts.pop()
 ]){
  const x=make();mutate(x);const out=M.plan(x.context,x.ledger,undefined,{now:x.now});
  assert.equal(out.changes.length,0);assert.deepEqual(out.results,[x.row]);assert.equal(out.inventory.total,1);
 }
 const x=make(),unknown={...x.row,id:'unknown',tournamentId:'unregistered',prize:null},zero={...x.row,id:'zero',prize:0,rank:27};
 const out=M.plan({...x.context,results:[unknown,zero]},x.ledger,undefined,{now:x.now});
 assert.equal(out.changes.length,0);assert.equal(out.inventory.counts['rule-needed'],1);assert.equal(out.inventory.counts['confirmed-zero-retained'],1);
});
