'use strict';
/**
 * Read-only CI / deploy duration monitor. Stores a downloadable JSON report,
 * never writes to published results. Batch evidence timings are captured by
 * review-batch.cjs before its proposal PR.
 */
const fs=require('node:fs'),path=require('node:path');
const {duration,summary}=require('./review-timing-core.cjs');
async function main(){
 const payload=JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH,'utf8'));
 const run=payload.workflow_run;
 if(!run||!Number.isSafeInteger(run.id)||!run.html_url)
  throw Error('TIMING unexpected workflow_run event');
 const repo=process.env.GITHUB_REPOSITORY;
 if(!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo||''))
  throw Error('TIMING missing repository');
 const headers={
  Accept:'application/vnd.github+json',
  'X-GitHub-Api-Version':'2022-11-28',
  Authorization:'Bearer '+process.env.GH_TOKEN
 };
 const base=(process.env.GITHUB_API_URL||'https://api.github.com')+'/repos/'+repo;
 const response=await fetch(base+'/actions/runs/'+run.id+'/jobs?per_page=100',{headers});
 if(!response.ok)throw Error('TIMING cannot list run jobs: HTTP '+response.status);
 const parsed=await response.json();
 if(!Array.isArray(parsed.jobs)||parsed.total_count>100)
  throw Error('TIMING missing/partial jobs list');
 const report={
  version:1,runId:run.id,workflow:run.name,branch:run.head_branch,
  event:run.event,conclusion:run.conclusion,sha:run.head_sha,
  url:run.html_url,
  durations:{queueMs:duration(run.created_at,run.run_started_at),
   executionMs:duration(run.run_started_at,run.updated_at),
   totalMs:duration(run.created_at,run.updated_at)},
  jobs:parsed.jobs.map(j=>({id:j.id,name:j.name,conclusion:j.conclusion,
   durationMs:duration(j.started_at,j.completed_at)}))
 };
 const destination=path.join(process.cwd(),'timing-reports');
 fs.mkdirSync(destination,{recursive:true});
 fs.writeFileSync(path.join(destination,'run-'+run.id+'.json'),JSON.stringify(report,null,2)+'\n');
 const message=summary(report);
 console.log(message);
 if(process.env.GITHUB_STEP_SUMMARY)
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,message+'\n');
}
main().catch(error=>{console.error(error);process.exitCode=1});
