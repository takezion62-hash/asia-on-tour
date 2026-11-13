'use strict';
// Safe review of the 21 candidates retained in AOT's November queue.
// Use existing vetted review planner; never infer money, cosmetics, or qualification.
const fs=require('node:fs');
const path=require('node:path');
const {loadReviewDb,writeReviewDb}=require('./reviewed-publication-core.cjs');
const {reviewBatch}=require('./review-batch-core.cjs');
const {validateData,personalCents,roster}=require('./data-checks.cjs');
const {audit}=require('./validate-approvals.cjs');
const {validateUpdateLog}=require('./validate-updates.cjs');
const ROOT=path.resolve(__dirname,'..');
const TARGET_IDS=[
  "auto-s30-792418efe572",
  "auto-s30-de3f84735786",
  "auto-s30-022060aed2ea",
  "auto-s41-d3b44e842ffb",
  "auto-s42-020f0ae10c3b",
  "auto-s42-8edeaf466d81",
  "auto-s42-86bfaeeec308",
  "auto-s42-85b505f35943",
  "auto-s42-5d5bba34b73f",
  "auto-s32-eb755a2d9ea4",
  "auto-s32-9a4c4bfb5f6e",
  "auto-s32-51232d4bcf15",
  "auto-s32-10ba113b4b52",
  "auto-s32-67939e7070f7",
  "auto-s32-11f4a64b366a",
  "auto-s32-78d9afa8c65f",
  "auto-s32-55616049ef3d",
  "auto-s32-112342e8df46",
  "auto-s32-ed582e1d73f7",
  "auto-s43-60ffbb4b325c",
  "auto-s43-65f27228b7e8"
];
const args=process.argv.slice(2),dry=args.includes('--dry-run');
if(!(args.length===0||(args.length===1&&dry)))throw Error('Only --dry-run or no arguments accepted');
const db=loadReviewDb(ROOT);
db.reviewed=JSON.parse(fs.readFileSync(path.join(ROOT,'history-sync-reviewed.json'),'utf8'));
const available=new Set([...db.reviews.auto.proposals,...db.reviews.history.proposals].map(x=>x.id));
const target=TARGET_IDS.filter(x=>available.has(x));
const oldCash=rs=>rs.reduce((n,x)=>n+Math.round((x.prize||0)*100),0);
const oldPersonal=rs=>rs.reduce((n,x)=>n+personalCents(x)*roster(x).length,0);
if(target.length===0){
 console.log('PENDING_REVIEW_20261114 '+JSON.stringify({mode:dry?'dry-run':'apply',pending:0,alreadyResolved:TARGET_IDS.length,added:0}));
 process.exit(0);
}
const months=new Set([...db.reviews.auto.proposals,...db.reviews.history.proposals]
 .filter(x=>target.includes(x.id)).map(x=>x.date.slice(0,7)));
for(const month of months){
 const archive=path.join(ROOT,'calendar-history',month+'.json');
 if(!fs.existsSync(archive))throw Error('Missing official calendar archive '+month);
 const data=JSON.parse(fs.readFileSync(archive,'utf8'));
 if(!Array.isArray(data.sessions))throw Error('Invalid calendar archive '+month);
 db.calendar[month]=data.sessions;
}
const plan=reviewBatch(db,{ids:target,limit:100,runId:'pending-20261114',
 timestamp:new Date().toISOString(),actor:'ChatGPT / user authorized confirmed-candidate review'});
const verdict=validateData({results:plan.next.results,players:db.players,tournaments:db.tournaments});
if(verdict.errors.length)throw Error('Candidate data validation failed '+JSON.stringify(verdict.errors.slice(0,8)));
if(oldCash(db.results)!==oldCash(plan.next.results)||
 oldPersonal(db.results)!==oldPersonal(plan.next.results))
 throw Error('Cash amount changed without separately verified award evidence');
const approvals=audit(plan.next.results,plan.next.ledger,db.players);
if(approvals.length)throw Error('Approval audit failed '+JSON.stringify(approvals.slice(0,5)));
const updates=validateUpdateLog(plan.next.results,plan.next.updates);
if(updates.length)throw Error('Update log failed '+JSON.stringify(updates.slice(0,5)));
const report={
 mode:dry?'dry-run':'apply',pending:target.length,
 alreadyResolved:TARGET_IDS.length-target.length,
 added:plan.published.length,duplicates:plan.duplicates.length,
 held:plan.held.length,oldCount:db.results.length,newCount:plan.next.results.length,
 addedRecords:plan.published,dups:plan.duplicates,
 heldCandidates:plan.held
};
if(!dry&&(plan.published.length||plan.duplicates.length)){
 writeReviewDb(ROOT,plan.next);
 fs.writeFileSync(path.join(ROOT,'history-sync-reviewed.json'),
  JSON.stringify(plan.next.reviewed,null,2)+'\n');
}
console.log('PENDING_REVIEW_20261114 '+JSON.stringify(report));
