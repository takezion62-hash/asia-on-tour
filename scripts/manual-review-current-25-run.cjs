'use strict';
/*
 * One-off, idempotent 25-candidate review publication runner.
 * Reads current repository data, performs strict source/identity/round checks,
 * validates resulting dataset before writing any JSON files.
 */
const fs=require('node:fs'),path=require('node:path');
const {build}=require('./manual-review-current-25.cjs');
const {validateData,summarize}=require('./data-checks.cjs');
const {validateUpdateLog}=require('./validate-updates.cjs');
const {audit:validateApprovals}=require('./validate-approvals.cjs');
const root=path.resolve(__dirname,'..');
const load=path=>JSON.parse(fs.readFileSync(require('node:path').join(root,path),'utf8'));
const save=(file,data)=>fs.writeFileSync(path.join(root,file),JSON.stringify(data,null,2)+'\n');
const updateId='reviewed-25-results-20261106',updates=load('updates.json');
if(updates.entries.some(entry=>entry.id===updateId)){
 console.log('REVIEW_CURRENT_25: already published; no changes to write');process.exit(0);
}
const data={
 results:load('results.json'),players:load('players.json'),tournaments:load('tournaments.json'),
 reviews:{history:load('history-sync-review.json'),recent:load('auto-sync-review.json')},
 scans:{history:load('history-sync-scan.json'),recent:load('auto-sync-scan.json')},
 statuses:{history:load('history-sync-status.json'),recent:load('auto-sync-status.json')},
 historyLedger:load('history-sync-reviewed.json'),approvalLedger:load('approval-history.json'),
 updates,calendars:{}
};
for(const month of new Set([...data.reviews.history.proposals,...data.reviews.recent.proposals].map(x=>x.date.slice(0,7)))){
 const c=load('calendar-history/'+month+'.json');
 if(!Array.isArray(c.sessions))throw Error('Bad calendar sessions '+month);
 data.calendars[month]=c.sessions;
}
const planned=build(data,{stamp:new Date().toISOString()});
if(planned.added.length!==23||planned.duplicates.length!==2||planned.updated.length!==1)throw Error('Wrong result counts');
if(planned.added.some(a=>a.record.prize!==0&&a.record.prize!==null))throw Error('Unexpected cash payout');
const verdict=validateData({results:planned.results,players:data.players,tournaments:data.tournaments});
if(verdict.errors.length)throw Error('Data validation errors: '+JSON.stringify(verdict.errors.slice(0,20)));
const updateErrors=validateUpdateLog(planned.results,planned.updates);
if(updateErrors.length)throw Error('Update log invalid: '+JSON.stringify(updateErrors.slice(0,20)));
const approvalErrors=validateApprovals(planned.results,planned.approvalLedger,data.players);
if(approvalErrors.length)throw Error('Approval history invalid: '+JSON.stringify(approvalErrors.slice(0,20)));
const before=summarize(data).total,after=summarize({results:planned.results,players:data.players,tournaments:data.tournaments}).total;
if(before!==after)throw Error('Unintended cash total difference: '+before+' -> '+after);
const previousIds=new Map(data.results.map(r=>[r.id,r]));
for(const row of planned.results){
 const old=previousIds.get(row.id);
 if(!old)continue;
 if(row.id==='s42-nac-performance-eval-qual-20260911-meath-3peace'){
  for(const key of Object.keys(old))if(!['kills','matches','note'].includes(key)&&JSON.stringify(old[key])!==JSON.stringify(row[key]))throw Error('Unexpected performance result edit: '+key);
 }else if(JSON.stringify(row)!==JSON.stringify(old))throw Error('Existing result unexpectedly changed: '+row.id);
}
const files={
 'results.json':planned.results,
 'history-sync-review.json':planned.reviews.history,
 'auto-sync-review.json':planned.reviews.recent,
 'history-sync-reviewed.json':planned.historyLedger,
 'approval-history.json':planned.approvalLedger,
 'history-sync-status.json':planned.statuses.history,
 'auto-sync-status.json':planned.statuses.recent,
 'updates.json':planned.updates,
 'data/manual-approvals/20261106-current-25-audit.json':planned.audit
};
for(const [file,data] of Object.entries(files))save(file,data);
console.log('REVIEW_CURRENT_25 '+JSON.stringify({
 before:data.results.length,after:planned.results.length,new:planned.added.length,duplicates:planned.duplicates,
 existingUpdated:planned.updated,byGroup:planned.added.reduce((a,x)=>(a[x.group]=(a[x.group]||0)+1,a),{}),
 waiting:{historical:planned.reviews.history.proposals.length,recent:planned.reviews.recent.proposals.length},
 cashBefore:before,cashAfter:after,warnings:verdict.warnings.length,files:Object.keys(files)
}));
