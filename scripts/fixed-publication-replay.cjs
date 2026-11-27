'use strict';
// Keep the entire original dry-run validation. Only omit a second, provably
// write-free invocation of a reviewed fixed publisher; never omit an audit.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {spawnSync}=require('node:child_process');
const ROOT=path.resolve(__dirname,'..');
// name, reviewed git blob hash, expected count, output label, existing-count key, apply arg
const SPECS=Object.freeze(Object.fromEntries([
 ['s28-nac-zb-duos-three-20261119','a9eae4b6abea8df995fc5c5e2a3fe0cdbca5960c',3,'S28_NAC_ZB_DUOS_3','alreadyPublished'],
 ['mobile-series-ten-20261121','e73ff53ef7bf4b25b373ff0e6f0c8d94e305b4bd',10,'MOBILE_SERIES_NINE','existing'],
 ['mobile-oce-naw-ten-20261121','92d0a2c41e0f34daccbcd682c9e568fb5817163f',10,'MOBILE_OCE_NAW_TEN','existing'],
 ['mobile-extra-ten-20261121','6f0670ffaa15208e3bd4fdafe9b93f9006b5245b',10,'MOBILE_EXTRA_TEN','existing'],
 ['mobile-series-nine-20261121','1229f9ff4f0140bbd038814b05a21dfdfb4c1e4d',9,'MOBILE_SERIES_NINE','existing'],
 ['s21-s25-s41-s42-ten-20261121','f88220db6b57c88ef2a7f75b5955dccd78f0f3fc',10,'OWNER_TEN_1970_1979','existing'],
 ['s21-s22-s35-s36-s37-ten-20261121','a78820ece7ada0f5b289b359ae2bf5284896ed3c',10,'HISTORICAL_TEN_PUBLISHED','existing'],
 ['s30-oce-s37-naw-ten-20261120','c5d4154da323834b1c4cd875814b345bd1f79a1b',10,'OCE_ZB_NAW_PS_TEN','existing'],
 ['s30-eu-zb-solo-eight-20261119','d125714cadae6da42f8565a013cd9464fe6fec82',8,'S30_EU_ZB_SOLO_EIGHT','alreadyPublished'],
 ['mobile-eu-nac-20261126','7781ab3c805e8ae38e998c2c910a6257ae280a5b',10,'MOBILE_EU_NAC','already','--apply']
].map(([name,blob,count,label,key,arg])=>['scripts/apply-'+name+'.cjs',Object.freeze({blob,count,label,key,args:arg?[arg]:[]})])));
const allowed=s=>Object.hasOwn(SPECS,s);
function blobHash(bytes){
 return crypto.createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
}
function noOp(stdout,spec){
 const lines=String(stdout).split(/\r?\n/).filter(l=>l.startsWith(spec.label+' '));
 if(lines.length!==1)return false;
 try{
  const s=JSON.parse(lines[0].slice(spec.label.length+1));
  if(s.added!==0||s[spec.key]!==spec.count)return false;
  if(spec.key==='already'){
   if(s.dry!==true||!Array.isArray(s.existing)||s.existing.length)return false;
  }else if(s.mode!=='dry-run')return false;
  for(const k of ['rows','ids','records','newPlayers','newAliases'])
   if(Object.hasOwn(s,k)&&(!Array.isArray(s[k])||s[k].length))return false;
  for(const k of ['prize','addedCash','vr','addedWins'])
   if(Object.hasOwn(s,k)&&s[k]!==0)return false;
  return true;
 }catch{return false}
}
function proofComplete(script){
 // Read the authoritative snapshot again after the dry run, not a stale
 // generated ranking or a cached status. No proof code is removed.
 const {FIXED,context,classifyFixed}=require('./publication-inventory.cjs');
 const {readResults}=require('./source-results-store.cjs');
 const {verifyHistoricalRow}=require('./confirmed-player-renames-20261126.cjs');
 const f=FIXED.find(x=>x.script===script);
 if(!f)return false;
 const json=p=>JSON.parse(fs.readFileSync(path.join(ROOT,p),'utf8'));
 const v=require('./'+f.proof);
 const ctx=context({rows:readResults(ROOT).rows,ledger:json('approval-history.json'),updates:json('updates.json'),
  players:json('players.json'),reviews:['auto-sync-review.json','history-sync-review.json'].map(json)});
 return classifyFixed({...f,expected:(v.DOC?.batch?.entries||v.GOLD).map(v.project),
  verify:(r,e,p)=>verifyHistoricalRow(v.verifyRow,r,e,p)},ctx).status==='applied';
}
function replay(script,{run=spawnSync,read=p=>fs.readFileSync(path.join(ROOT,p)),prove=proofComplete,force=process.env.AOT_FORCE_PUBLICATION_REPLAY==='1',log=console.log}={}){
 if(!allowed(script))throw Error('FIXED_REPLAY unknown script '+script);
 const spec=SPECS[script];
 const invoke=args=>{
  const r=run(process.execPath,[script,...args],{cwd:ROOT,encoding:'utf8',maxBuffer:8*1024*1024,timeout:180000,stdio:['ignore','pipe','pipe']});
  if(r.stdout)log(r.stdout.trimEnd());
  if(r.stderr)console.error(r.stderr.trimEnd());
  if(r.error||r.status!==0)throw Error('FIXED_REPLAY failed '+script+' '+args.join(' ')+' '+String(r.error||r.status));
  return r.stdout;
 };
 const stdout=invoke(['--dry-run']);
 let skip=false;
 if(!force&&blobHash(read(script))===spec.blob&&noOp(stdout,spec)){
  try{skip=prove(script)===true}catch(e){log('FIXED_REPLAY proof unavailable; use original apply: '+e.message)}
 }
 if(!skip)invoke(spec.args);
 const result={script,skippedApply:skip,validatedDryRun:true};
 log('AOT_FIXED_REPLAY '+JSON.stringify(result));
 return result;
}
if(require.main===module){
 if(process.argv.length!==3)throw Error('Usage: node scripts/fixed-publication-replay.cjs scripts/apply-....cjs');
 replay(process.argv[2]);
}
module.exports={SPECS,allowed,blobHash,noOp,replay};
