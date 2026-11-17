'use strict';
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const {loadReviewDb}=require('./reviewed-publication-core.cjs');
const {reviewBatch,entryList}=require('./review-batch-core.cjs');
const db=loadReviewDb(root);
db.reviewed=JSON.parse(fs.readFileSync(path.join(root,'history-sync-reviewed.json'),'utf8'));
for(const row of entryList(db)){
 const month=row.date.slice(0,7);
 if(!db.calendar[month])db.calendar[month]=JSON.parse(fs.readFileSync(path.join(root,'calendar-history',month+'.json'),'utf8')).sessions;
}
const all=entryList(db).map(x=>x.id),plans=[];
let current=db;
for(let start=0;start<all.length;start+=100){
 const ids=all.slice(start,start+100),runId='bulk-preview-'+start;
 const plan=reviewBatch(current,{limit:100,ids,runId,timestamp:'2026-11-18T01:00:00.000Z',actor:'ChatGPT / owner-authorized bulk review'});
 plans.push(plan);
 current={...current,...plan.next};
 console.log('BULK_PREVIEW_BATCH '+JSON.stringify({start,selected:plan.selected,published:plan.published.length,duplicates:plan.duplicates.length,held:plan.held.length,samples:plan.published.slice(0,10),heldReasons:plan.held.slice(0,9)}));
}
const published=plans.flatMap(x=>x.published),duplicates=plans.flatMap(x=>x.duplicates),held=plans.flatMap(x=>x.held);
const byReason={};for(const x of held)byReason[x.reason]=(byReason[x.reason]||0)+1;
const stats={total:all.length,published:published.length,duplicates:duplicates.length,held:held.length,byPolicy:published.reduce((a,x)=>(a[x.policy]=(a[x.policy]||0)+1,a),{}),byReason,cashDelta:published.reduce((a,x)=>a+(x.prize||0),0),countAfter:current.results.length};
console.log('BULK_PREVIEW_FINAL '+JSON.stringify(stats));
