'use strict';
// Stage 2: read-only inventory. A classification is NOT permission to skip a job.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {readResults}=require('./source-results-store.cjs');
const {parseWorkflow}=require('./premerge-rebuild-preflight.cjs');
const {verifyHistoricalRow}=require('./confirmed-player-renames-20261126.cjs');
const ROOT=path.resolve(__dirname,'..');
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
const WORKFLOWS=['build-season-data.yml','history-sync.yml','auto-sync.yml'];
// Only these explicitly inspected fixed batches have an exact proof adapter.
const FIXED=Object.freeze([
 ['mobile-eu-nac-20261126','owner-mobile-eu-nac-20261126',10],
 ['mobile-extra-ten-20261121','owner-mobile-jan-oct-extra-ten-20261121',10],
 ['mobile-series-nine-20261121','owner-s39-s41-s42-mobile-nine-20261121',9],
 ['mobile-oce-naw-ten-20261121','owner-s39-s41-mobile-oce-naw-ten-20261121',10],
 ['mobile-series-ten-20261121','owner-s40-s41-s42-mobile-ten-20261121',10],
 ['s21-s25-s41-s42-ten-20261121','owner-s21-s25-s41-s42-ten-20261121',10],
 ['s21-s22-s35-s36-s37-ten-20261121','owner-s21-s22-s35-s36-s37-ten-20261121',10],
 ['s30-eu-zb-solo-eight-20261119','owner-s30-eu-zb-solo-eight-20261119',8],
 ['s30-oce-s37-naw-ten-20261120','owner-s30-oce-zb-s37-naw-ten-20261120',10],
 ['s28-nac-zb-duos-three-20261119','owner-s28-nac-zb-duos-three-20261119',3]
].map(([name,marker,count])=>Object.freeze({script:'scripts/apply-'+name+'.cjs',proof:'verified-'+name+'.cjs',marker,count})));
const RECURRING=Object.freeze({
 'scripts/publish-pending-review-20261114.cjs':'Processes newly queued candidates, not only the original IDs.',
 'scripts/publish-generic-review-only.cjs':'Reconciles held candidates and ongoing review-only publications.',
 'scripts/promote-published-cash.cjs':'Rechecks published records for newly available cash evidence.',
 'scripts/resolve-exact-duplicates.cjs':'Rechecks existing duplicates on current data.',
 'scripts/apply-player-renames-20261126.cjs':'Replay protects canonical identity after subsequent data refreshes; do not retire without a replacement invariant.',
 'scripts/attendance-award-recheck.cjs':'Rechecks attendance awards against new evidence.',
 'scripts/participation-promotion.cjs':'Promotes newly verified attendance records.'
});
function inventory(workflows){
 const by=new Map();
 for(const [file,content] of Object.entries(workflows)){
  const commands=file==='build-season-data.yml'?parseWorkflow(content).map(t=>t.join(' ')):
   [...content.matchAll(/\bnode\s+(scripts\/[a-zA-Z0-9._/-]+\.cjs)([^\r\n]*)/g)].map(m=>m[1]+m[2]);
  for(const line of commands){
   const m=line.match(/^(scripts\/(?:apply-|publish-|reconcile-|resolve-|promote-|attendance-award-recheck|participation-promotion)[a-zA-Z0-9._-]*\.cjs)(?=\s|$)/);
   if(!m)continue;
   const script=m[1],row=by.get(script)||{script,invocations:[]};
   row.invocations.push({workflow:file,mode:/\b--dry-run(?:\s|$)/.test(line)||line.includes('--dry-run')?'dry-run':'other'});
   by.set(script,row);
  }
 }
 return [...by.values()].sort((a,b)=>a.script.localeCompare(b.script,'en'));
}
const unique=(xs,key)=>{const m=new Map();for(const x of xs){const k=key(x);const a=m.get(k)||[];a.push(x);m.set(k,a)}return m};
function classifyFixed({expected,marker,count,verify},ctx){
 const ids=expected.map(x=>x.id);
 if(ids.length!==count||new Set(ids).size!==count||!ids.every(x=>typeof x==='string'&&x))
  return {status:'review-required',reason:'invalid expected proof set'};
 const markers=ctx.updates.get(marker)||[];
 const present=ids.filter(id=>ctx.rows.has(id));
 const approvals=ids.filter(id=>ctx.approvals.has(id));
 const pending=ids.filter(id=>ctx.pending.has(id));
 const evidence={expected:count,present:present.length,approvals:approvals.length,pending:pending.length,marker};
 if(!present.length&&!approvals.length&&!markers.length)
  return {status:'not-applied',reason:'No exact record, approval or update marker found; other-ID equivalents not ruled out.',evidence};
 if(markers.length!==1||!Array.isArray(markers[0].recordIds)||
    markers[0].recordIds.length!==count||new Set(markers[0].recordIds).size!==count||
    !ids.every(id=>markers[0].recordIds.includes(id))||pending.length)
  return {status:'review-required',reason:'Missing or inconsistent update marker or unresolved pending candidate.',evidence};
 const failed=ids.filter(id=>{
  const rows=ctx.rows.get(id)||[],entries=ctx.approvals.get(id)||[];
  return rows.length!==1||entries.length!==1||!verify(rows[0],entries[0],ctx.players);
 });
 return failed.length?{status:'review-required',reason:'Incomplete or changed exact proof.',evidence:{...evidence,failed}}:
  {status:'applied',reason:'All exact records, approval proofs and update marker verified.',evidence};
}
function context({rows,ledger,updates,players,reviews}){
 if(!Array.isArray(rows)||!Array.isArray(ledger.entries)||!Array.isArray(updates.entries)||
    !reviews.every(r=>Array.isArray(r.proposals)))throw Error('Invalid publication inventory input');
 return {rows:unique(rows,r=>r.id),approvals:unique(ledger.entries,e=>e.recordId),
  updates:unique(updates.entries,e=>e.id),players,pending:new Set(reviews.flatMap(r=>r.proposals.map(p=>p.id)))};
}
function build(root=ROOT){
 const read=f=>fs.readFileSync(path.join(root,f),'utf8'),json=f=>JSON.parse(read(f));
 const workflows=Object.fromEntries(WORKFLOWS.map(f=>[f,read('.github/workflows/'+f)]));
 const store=readResults(root),ctx=context({rows:store.rows,ledger:json('approval-history.json'),
  updates:json('updates.json'),players:json('players.json'),reviews:['auto-sync-review.json','history-sync-review.json'].map(json)});
 const scripts=inventory(workflows).map(row=>{
  const sourceSha256=hash(read(row.script));
  const base={...row,sourceSha256,maySkip:false};
  if(RECURRING[row.script])return {...base,status:'recurring',reason:RECURRING[row.script]};
  const f=FIXED.find(x=>x.script===row.script);
  if(!f)return {...base,status:'review-required',reason:'No reviewed exact completion adapter yet.'};
  // The existing verifier modules read the checked-out repository. Do not mix
  // their proof data with a different root.
  if(path.resolve(root)!==ROOT)throw Error('Exact proof inventory must use its own checkout');
  const v=require('./'+f.proof);
  const entries=v.DOC?.batch?.entries||v.GOLD;
  if(!Array.isArray(entries)||typeof v.project!=='function'||typeof v.verifyRow!=='function')
   throw Error('Unsupported fixed proof '+f.proof);
  const expected=entries.map(v.project);
  const result=classifyFixed({...f,expected,verify:(r,e,p)=>verifyHistoricalRow(v.verifyRow,r,e,p)},ctx);
  return {...base,proof:f.proof,proofSha256:hash(read('scripts/'+f.proof)),...result};
 });
 const counts={applied:0,'not-applied':0,recurring:0,'review-required':0};
 for(const row of scripts)counts[row.status]++;
 return {version:1,readOnly:true,skipEnabled:false,sourceSha256:store.manifest.canonicalSha256,
  workflowSha256:Object.fromEntries(Object.entries(workflows).map(([f,c])=>[f,hash(c)])),
  total:scripts.length,counts,scripts};
}
if(require.main===module){
 if(process.argv.length!==2)throw Error('Usage: node scripts/publication-inventory.cjs');
 console.log(JSON.stringify(build(),null,2));
}
module.exports={FIXED,RECURRING,inventory,context,classifyFixed,build};
