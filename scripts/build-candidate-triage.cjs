'use strict';
// Generate a small, source-backed triage index for the public verification center.
// Never mutate results, review queues, scan checkpoints, or award decisions.
const fs=require('node:fs');
const path=require('node:path');
const {buildTriage}=require('./candidate-triage-core.cjs');
const root=path.resolve(__dirname,'..');
const load=file=>JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
const result=buildTriage({
 autoReview:load('auto-sync-review.json'),historyReview:load('history-sync-review.json'),
 autoScan:load('auto-sync-scan.json'),historyScan:load('history-sync-scan.json'),
 results:load('results.json'),historyReviewed:load('history-sync-reviewed.json'),
 players:load('players.json')
});
const target=path.join(root,'candidate-triage.json');
const payload=JSON.stringify(result,null,2)+'\n';
const previous=fs.existsSync(target)?fs.readFileSync(target,'utf8'):null;
if(!process.argv.includes('--check')&&previous!==payload)fs.writeFileSync(target,payload);
if(process.argv.includes('--check')&&previous!==payload){
 console.error('CANDIDATE_TRIAGE_STALE: run node scripts/build-candidate-triage.cjs');
 process.exitCode=1;
}
console.log('CANDIDATE_TRIAGE '+JSON.stringify({
 pending:result.total,resolved:result.alreadyResolved,
 byStatus:result.byStatus,groups:result.byTournament.length,
 changed:previous!==payload
}));
