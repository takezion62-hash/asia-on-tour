'use strict';
/** Safe one-shot publisher. Check every invariant before touching a JSON file. */
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const {build}=require('./manual-review-history-27.cjs');
const {validateData,summarize}=require('./data-checks.cjs');
const {validateUpdateLog}=require('./validate-updates.cjs');
const {audit:validateApprovals}=require('./validate-approvals.cjs');
const read=name=>JSON.parse(fs.readFileSync(path.join(root,name),'utf8'));
const write=(name,data)=>fs.writeFileSync(path.join(root,name),JSON.stringify(data,null,2)+'\n');
const updateId='history-reviewed-27-20261106',existingUpdates=read('updates.json');
if(existingUpdates.entries.some(x=>x.id===updateId)){
 console.log('HISTORY27 already published; no additional writes.');
 process.exit(0);
}
const db={
 results:read('results.json'),reviews:read('history-sync-review.json'),
 scan:read('history-sync-scan.json'),status:read('history-sync-status.json'),
 players:read('players.json'),tournaments:read('tournaments.json'),
 ledger:read('history-sync-reviewed.json'),approvals:read('approval-history.json'),
 updates:existingUpdates,calendars:{}
};
const reviewMonths=new Set(db.reviews.proposals.map(x=>x.date.slice(0,7)));
for(const month of reviewMonths)db.calendars[month]=read('calendar-history/'+month+'.json');
const before=summarize({results:db.results,players:db.players,tournaments:db.tournaments}).total;
const plan=build(db,{timestamp:new Date().toISOString()});
const validated=validateData({results:plan.results,players:db.players,tournaments:db.tournaments});
if(validated.errors.length)throw Error('Results validator: '+JSON.stringify(validated.errors.slice(0,8)));
const logErrors=validateUpdateLog(plan.results,plan.updates);
if(logErrors.length)throw Error('Updates log: '+JSON.stringify(logErrors.slice(0,8)));
const approvalErrors=validateApprovals(plan.results,db.approvals,db.players);
if(approvalErrors.length)throw Error('Prior manual approval integrity: '+JSON.stringify(approvalErrors.slice(0,8)));
const after=summarize({results:plan.results,players:db.players,tournaments:db.tournaments}).total;
if(after-before!==200)throw Error('Cash total must increase by exactly $200: '+before+' -> '+after);
const oldById=new Map(db.results.map(x=>[x.id,x]));
if(plan.results.length!==db.results.length+27)throw Error('Unexpected published result count');
for(const row of plan.results){
 const original=oldById.get(row.id);
 if(original&&JSON.stringify(original)!==JSON.stringify(row))throw Error('Existing record mutated: '+row.id);
 if(!original&&!plan.added.some(x=>x.id===row.id))throw Error('Unexpected new record: '+row.id);
}
if(plan.review.proposals.length!==db.reviews.proposals.length-27)throw Error('Unrelated pending candidate removed');
if(plan.ledger.entries.length!==db.ledger.entries.length+27)throw Error('History review ledger count invalid');
if(plan.added.filter(x=>x.group==='cash').length!==1||plan.added.some(x=>x.group!=='cash'&&x.record.prize!==0&&x.record.prize!==null))
 throw Error('Unsupported award in new records');
const writes={
 'results.json':plan.results,
 'history-sync-review.json':plan.review,
 'history-sync-status.json':plan.status,
 'history-sync-reviewed.json':plan.ledger,
 'updates.json':plan.updates,
 'data/manual-approvals/20261106-history-27-audit.json':{...plan.report,cashBefore:before,cashAfter:after,
   remainingHistoryCandidates:plan.review.proposals.length,validationWarnings:validated.warnings.length}
};
for(const [name,data] of Object.entries(writes))write(name,data);
console.log('HISTORY27_PUBLISHED '+JSON.stringify({
 beforeCount:db.results.length,afterCount:plan.results.length,
 newRecords:plan.added.length,groupCounts:plan.report.groups,
 historyQueueBefore:db.reviews.proposals.length,historyQueueAfter:plan.review.proposals.length,
 cashBefore:before,cashAfter:after,cashDifference:after-before,
 errors:validated.errors.length,warnings:validated.warnings.length,
 fileCount:Object.keys(writes).length
}));
