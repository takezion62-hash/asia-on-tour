'use strict';
// Temporary review-only test on draft PR 241. Never pushes or edits the checkout.
// Produce exact, verified JSON deltas so a connected reviewer can prepare a
// data-only PR without granting this runner write permission.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const hash=(s)=>crypto.createHash('sha1').update('blob '+Buffer.byteLength(s)+'\0').update(s).digest('hex');
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function delta(a,b,p=[],out=[]){
 if(equal(a,b))return out;
 if(Array.isArray(a)&&Array.isArray(b)){
  if(a.length===b.length){for(let i=0;i<a.length;i++)delta(a[i],b[i],[...p,i],out);return out}
  let i=0,j=0;
  while(i<Math.min(a.length,b.length)&&equal(a[i],b[i]))i++;
  while(j<Math.min(a.length,b.length)-i&&equal(a[a.length-1-j],b[b.length-1-j]))j++;
  out.push({op:'splice',path:p,index:i,remove:a.length-i-j,items:b.slice(i,b.length-j)});return out;
 }
 if(a&&b&&typeof a==='object'&&typeof b==='object'&&!Array.isArray(a)&&!Array.isArray(b)&&equal(Object.keys(a),Object.keys(b))){
  for(const k of Object.keys(a))delta(a[k],b[k],[...p,k],out);return out;
 }
 out.push({op:'replace',path:p,value:b});return out;
}
test('export verified Phase 5 data-only corrections from an isolated read-only CI checkout', {timeout:240000},()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'aot-phase5-export-'));
 try{
  const copy=path.join(temp,'checkout');fs.mkdirSync(copy);
  const archive=path.join(temp,'repo.tar');
  execFileSync('git',['archive','--format=tar','--output='+archive,'HEAD'],{cwd:root});
  execFileSync('tar',['-xf',archive,'-C',copy]);
  const files=()=>['updates.json','candidate-triage.json','published-attendance-phase5-history.json','attendance-award-recheck-history.json',
   ...['source-results','season-data'].flatMap(d=>fs.readdirSync(path.join(copy,d)).filter(n=>n.endsWith('.json')).map(n=>d+'/'+n))].sort();
  const read=p=>fs.existsSync(path.join(copy,p))?fs.readFileSync(path.join(copy,p),'utf8'):null;
  const before=new Map(files().map(p=>[p,read(p)]));
  const node=(script,...args)=>execFileSync(process.execPath,[script,...args],{cwd:copy,encoding:'utf8',maxBuffer:16*1024*1024,env:{...process.env,AOT_PHASE5_CONFIRMATION:'CONFIRM'}});
  const preview=JSON.parse(node('scripts/published-attendance-phase5.cjs','--dry-run'));
  const report=JSON.parse(node('scripts/published-attendance-phase5.cjs','--apply'));
  assert.equal(report.additionalProviderRequests,0);assert.equal(report.publishedAfter,report.publishedBefore);
  assert.deepEqual(report.proposals,preview.proposals);assert.deepEqual(report.manualChanges,preview.manualChanges);
  node('scripts/build-season-data.cjs');node('scripts/build-candidate-triage.cjs');
  node('scripts/build-source-results.cjs','--check');
  execFileSync('npm',['run','validate'],{cwd:copy,encoding:'utf8',maxBuffer:16*1024*1024});
  node('scripts/build-season-data.cjs','--check');node('scripts/build-candidate-triage.cjs','--check');
  const changes=[];
  for(const file of files()){
   const old=before.get(file)??null,next=read(file);if(old===next)continue;
   assert.ok(next!==null,'unexpected deletion');
   const value=JSON.parse(next);
   const format=[{indent:2,newline:true},{indent:0,newline:true},{indent:0,newline:false}].find(f=>JSON.stringify(value,null,f.indent)+(f.newline?'\n':'')===next);
   assert.ok(format,'unknown serialization '+file);
   changes.push({file,oldBlob:old===null?null:hash(old),newBlob:hash(next),format,ops:old===null?[{op:'replace',path:[],value}]:delta(JSON.parse(old),value)});
  }
  const patch=JSON.stringify({version:1,totalChanges:report.totalChanges,additionalProviderRequests:0,files:changes});
  const size=5000,n=Math.ceil(patch.length/size);
  for(let i=0;i<n;i++)console.log('AOT_PHASE5_DELTA '+(i+1)+'/'+n+' '+JSON.stringify(patch.slice(i*size,(i+1)*size)));
  console.log('AOT_PHASE5_DELTA_SUMMARY '+JSON.stringify({totalChanges:report.totalChanges,files:changes.map(f=>f.file),chunks:n}));
 }finally{fs.rmSync(temp,{recursive:true,force:true})}
});
