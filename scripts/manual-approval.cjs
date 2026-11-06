'use strict';
// GitHub Actions workflow_dispatch only. Produces an auditable change proposal;
// the workflow pushes a dedicated PR branch, never commits directly to main.
const fs=require('node:fs'),path=require('node:path');
const {apply,parseIds}=require('./manual-approval-core.cjs');
const {validateData}=require('./data-checks.cjs');
const root=path.resolve(__dirname,'..'),dry=process.argv.includes('--dry-run');
const read=(name,required=true)=>{
  const file=path.join(root,name);
  if(!fs.existsSync(file)){if(required)throw Error('Required file missing: '+name);return null}
  return JSON.parse(fs.readFileSync(file,'utf8'));
};
const write=(name,data)=>fs.writeFileSync(path.join(root,name),JSON.stringify(data,null,2)+'\n');
const ids=parseIds(process.env.AOT_APPROVAL_IDS);
const policy=process.env.AOT_APPROVAL_POLICY;
const confirmation=process.env.AOT_APPROVAL_CONFIRMATION;
const runId=(process.env.GITHUB_RUN_ID||'local')+'-'+(process.env.GITHUB_RUN_ATTEMPT||'1');
const timestamp=new Date().toISOString();
const base={
  results:read('results.json'),
  players:read('players.json'),
  tournaments:read('tournaments.json'),
  reviews:{auto:read('auto-sync-review.json'),history:read('history-sync-review.json')},
  statuses:{auto:read('auto-sync-status.json'),history:read('history-sync-status.json')},
  scans:{auto:read('auto-sync-scan.json'),history:read('history-sync-scan.json')},
  ledger:read('approval-history.json'),
  updates:read('updates.json'),
  calendar:{}
};
for(const id of ids){
  let row;
  for(const doc of Object.values(base.reviews))row ||=doc.proposals.find(x=>x.id===id);
  if(row){
    const month=row.date?.slice(0,7);
    if(!/^\d{4}-\d{2}$/.test(month))throw Error('Date not valid for '+id);
    if(!base.calendar[month]){
      const obj=read('calendar-history/'+month+'.json');
      if(!Array.isArray(obj.sessions))throw Error('Missing verified calendar sessions for '+month);
      base.calendar[month]=obj.sessions;
    }
  }
}
const plan=apply(base,{ids,policy,confirmation,timestamp,runId,actor:process.env.GITHUB_ACTOR||'local-reviewer'});
const before=base.results.length,after=plan.next.results.length;
const check=validateData({results:plan.next.results,players:base.players,tournaments:base.tournaments});
if(check.errors.length)throw Error('Publication fails site data validator: '+JSON.stringify(check.errors.slice(0,5)));
const chosen=plan.changes.map(x=>({id:x.id,origin:x.origin,player:x.record.player,
  date:x.record.date,region:x.record.region,tournamentId:x.record.tournamentId,
  round:x.record.round,kind:x.record.kind,rank:x.record.rank,prize:x.record.prize,
  rule:x.rule,source:x.record.source}));
const report={version:1,runId,dryRun:dry,policy,timestamp,
  publishedBefore:before,publishedAfter:after,newRecords:chosen.length,
  approved:chosen,alreadyPublished:plan.skipped,validatorWarnings:check.warnings.length,
  note:'Admin request only. This preview or PR is not public approval. Publication requires merge and CI.'};
const summary=[
  '# ASIA ON TOUR — 管理者確認済み候補の掲載提案',
  '',
  '方式：'+policy+' ／ ワークフロー実行：'+runId,
  '',
  '追加候補：**'+chosen.length+'件**（既存戦績：'+before+'件 → '+after+'件）',
  '',
  '| 候補ID | 選手 | 日付 | 地域 | 区分 | 賞金 |',
  '| --- | --- | --- | --- | --- | --- |',
  ...chosen.map(x=>'| '+x.id+' | '+x.player.replace(/\|/g,'/')+' | '+x.date+' | '+x.region+' | '+x.kind+' | '+(x.prize==null?'未確認':'$'+x.prize)+' |'),
  '',
  '> 出典のEpic ID・順位表・大会ラウンド・既存成績との重複を再照合済み。未確認賞金やスキン・通過を推定していません。',
  '',
  '## 公開前のチェック',
  '',
  '- [ ] 差分に意図しない変更がないこと',
  '- [ ] GitHub Actions の検証とPC・スマホテストが合格していること',
  '- [ ] 承認後、mainが更新されていないか確認した上でマージ',
  '',
  '**このPull Requestをマージするまでは正式な掲載ではありません。**'
].join('\n')+'\n';
fs.writeFileSync(path.join(root,'.manual-approval-summary.md'),summary);
fs.writeFileSync(path.join(root,'.manual-approval-report.json'),JSON.stringify(report,null,2)+'\n');
if(!dry&&chosen.length){
  write('results.json',plan.next.results);
  write('auto-sync-review.json',plan.next.reviews.auto);
  write('history-sync-review.json',plan.next.reviews.history);
  write('auto-sync-status.json',plan.next.statuses.auto);
  write('history-sync-status.json',plan.next.statuses.history);
  write('approval-history.json',plan.next.ledger);
  write('updates.json',plan.next.updates);
}
console.log('AOT_REVIEW_APPROVAL '+JSON.stringify({dry,runId,policy,new:chosen.length,skipped:plan.skipped.length,before,after,validatorWarnings:check.warnings.length}));
