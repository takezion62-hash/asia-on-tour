'use strict';
// Trusted-base, fail-closed selector for ordinary PR/push validation.
// Never execute a selector supplied by an unreviewed PR: tests.yml loads
// ci-change-scope.cjs from the trusted base SHA.
const fs=require('node:fs');
const path=require('node:path');
const ROOT=process.env.GITHUB_WORKSPACE||path.resolve(__dirname,'..');
const unitFile=/^tests\/[a-z0-9._-]+\.test\.cjs$/;
const specFile=/^tests\/[a-z0-9._-]+\.spec\.cjs$/;
const publisher=/^scripts\/(?:apply|publish|reconcile)-[a-z0-9.-]+\.cjs$/;
const oracle=/^scripts\/verified-[a-z0-9.-]+\.cjs$/;
const evidence=/^data\/manual-approvals\/[a-z0-9.-]+\.json$/;
const mappedUi=Object.freeze({
 'source-rules.js':'tests/source-rules.spec.cjs',
 'source-rules.css':'tests/source-rules.spec.cjs',
 'growth.js':'tests/growth.spec.cjs',
 'growth.css':'tests/growth.spec.cjs',
 'compare.js':'tests/compare.spec.cjs',
 'compare.css':'tests/compare.spec.cjs',
 'profile-layout.js':'tests/profile-layout.spec.cjs',
 'profile-layout.css':'tests/profile-layout.spec.cjs',
 'calendar.css':'tests/calendar.spec.cjs',
 'participation-ui.js':'tests/participation.spec.cjs',
 'participation.css':'tests/participation.spec.cjs',
 'player-style-view.js':'tests/player-style.spec.cjs',
 'player-style.css':'tests/player-style.spec.cjs'
});
const CORE=Object.freeze([
 'tests/data-validation.test.cjs','tests/approval-history.test.cjs',
 'tests/update-history.test.cjs','tests/session-date-consistency.test.cjs',
 'tests/tournament-rules.test.cjs','tests/source-results-store.test.cjs',
 'tests/final-round-consistency.test.cjs'
]);
const exists=(file,root=ROOT)=>fs.existsSync(path.join(root,file));
function select(files,{root=ROOT}={}){
 if(!Array.isArray(files)||!files.length||files.length>100)return null;
 const changed=files.map(x=>x.path),changedUnit=changed.filter(p=>unitFile.test(p));
 if(files.some(x=>!['A','M'].includes(x.status)))return null;
 const units=new Set(CORE),browsers=new Set(),publishers=new Set();
 let code=false,evidenceChanged=false;
 for(const p of changed){
  if(unitFile.test(p)){units.add(p);continue}
  if(specFile.test(p)){browsers.add(p);continue}
  if(Object.hasOwn(mappedUi,p)){browsers.add(mappedUi[p]);code=true;continue}
  if(p==='scripts/validate-approvals.cjs'){code=true;continue}
  if(evidence.test(p)){evidenceChanged=true;continue}
  if(publisher.test(p)||oracle.test(p)){
   code=true;
   if(publisher.test(p))publishers.add(p);
   const name=path.basename(p,'.cjs').replace(/^(?:apply|publish|reconcile|verified)-/,'');
   const matching=[
    'tests/'+name+'.test.cjs',
    'tests/'+path.basename(p,'.cjs')+'.test.cjs'
   ].filter(x=>exists(x,root));
   if(!matching.length)return null;
   matching.forEach(x=>units.add(x));
   continue;
  }
  if(p==='.github/workflows/build-season-data.yml')continue;
  return null;
 }
 if(evidenceChanged&&!code)return null;
 if(changed.includes('.github/workflows/build-season-data.yml')&&!publishers.size)return null;
 if(!changed.some(p=>code||unitFile.test(p)||specFile.test(p)))return null;
 if([...units,...browsers,...publishers].some(p=>!exists(p,root)))return null;
 if(units.size>35||browsers.size>8||publishers.size>12)return null;
 return {mode:'focused',reason:'explicit-test-coverage',unitFiles:[...units].sort(),
  browserFiles:[...browsers].sort(),publisherFiles:[...publishers].sort()};
}
// Build-season-data deployment workflow is approved for focused testing ONLY
// if the PR adds a new vetted publisher and its watched files / dry-run + apply
// lines without deleting, replacing or reordering ANY existing workflow line.
function appendOnlyPublisher(oldText,newText,publishers){
 if(typeof oldText!=='string'||typeof newText!=='string'||
  !Array.isArray(publishers)||publishers.length===0)return false;
 const old=oldText.split('\n'),next=newText.split('\n'),insertions=[];
 let pos=0;
 for(const line of next){
  if(pos<old.length&&line===old[pos]){pos++;continue}
  if(!/^(?:      - (?:scripts\/(?:apply|verified|publish|reconcile)-[a-z0-9.-]+\.cjs|data\/manual-approvals\/[a-z0-9.-]+\.json)|            node scripts\/(?:apply|publish|reconcile)-[a-z0-9.-]+\.cjs(?: --dry-run)?)$/.test(line))
    return false;
  insertions.push(line);
 }
 if(pos!==old.length||insertions.length===0)return false;
 // Exactly one newly added watched publisher and the matching two commands,
 // never injecting a second run of an existing command.
 const names=new Set(publishers);
 for(const p of names){
  if(!insertions.includes('      - '+p)||
     !insertions.includes('            node '+p+' --dry-run')||
     !insertions.includes('            node '+p))return false;
 }
 const watched=insertions.filter(s=>s.startsWith('      - scripts/')&&
   /\/(?:apply|publish|reconcile)-/.test(s)).map(s=>s.trim().slice(2));
 if(watched.length!==names.size||watched.some(p=>!names.has(p)))return false;
 // Each command must occur exactly once among the appended lines.
 for(const p of names)for(const s of ['            node '+p,'            node '+p+' --dry-run'])
  if(insertions.filter(x=>x===s).length!==1)return false;
 return true;
}
module.exports={CORE,mappedUi,select,appendOnlyPublisher,unitFile,specFile,publisher,oracle,evidence};
