'use strict';
/**
 * Main entrypoint for a full, bounded AOT candidate review:
 *   node scripts/review-batch.cjs --dry-run [--limit=100] [--ids=a,b]
 *   AOT_BATCH_CONFIRMATION=CONFIRM node scripts/review-batch.cjs --apply
 * Dry-run makes only hidden preview artifacts; --apply is user-authorized
 * and must be followed by an inspectable PR and its required CI.
 */
const fs=require('node:fs'),path=require('node:path');
const {performance}=require('node:perf_hooks');
const {loadReviewDb,writeReviewDb}=require('./reviewed-publication-core.cjs');
const {reviewBatch}=require('./review-batch-core.cjs');
const {validateData,personalCents,roster}=require('./data-checks.cjs');
const root=path.resolve(__dirname,'..'),begin=performance.now();
const args=process.argv.slice(2),applying=args.includes('--apply');
if(args.includes('--dry-run')&&applying)throw Error('BATCH_REVIEW preview and publication cannot mix');
if(!applying&&!args.includes('--dry-run'))throw Error('BATCH_REVIEW explicitly choose --dry-run or --apply');
if(applying&&process.env.AOT_BATCH_CONFIRMATION!=='CONFIRM')
 throw Error('BATCH_REVIEW publication requires explicit CONFIRM');
const limitArg=args.find(x=>x.startsWith('--limit='));
const limit=limitArg===undefined?100:Number(limitArg.slice('--limit='.length));
const idsArg=args.find(x=>x.startsWith('--ids='));
const ids=idsArg?idsArg.slice('--ids='.length).split(/[;,，、]+/).filter(Boolean):null;
const runId=(process.env.GITHUB_RUN_ID||'local')+'-'+(process.env.GITHUB_RUN_ATTEMPT||'1');
const timestamp=new Date().toISOString(),today=new Date(Date.now()+9*3600000).toISOString().slice(0,10);
const loadStart=performance.now(),db=loadReviewDb(root);
db.reviewed=JSON.parse(fs.readFileSync(path.join(root,'history-sync-reviewed.json'),'utf8'));
const reviewedAt=performance.now();
const candidates=[...db.reviews.auto.proposals,...db.reviews.history.proposals];
const months=new Set(candidates.map(x=>x.date?.slice(0,7)).filter(x=>/^\d{4}-\d{2}$/.test(x)));
for(const month of months){
 const file=path.join(root,'calendar-history',month+'.json');
 if(fs.existsSync(file)){
  const doc=JSON.parse(fs.readFileSync(file,'utf8'));
  if(!Array.isArray(doc.sessions))throw Error('BATCH_REVIEW invalid archived calendar: '+month);
  db.calendar[month]=doc.sessions;
 }
}
const loadMs=Number((performance.now()-loadStart).toFixed(3));
const plan=reviewBatch(db,{
 limit,ids,runId,timestamp,actor:process.env.GITHUB_ACTOR||'AOT batch-review workflow'
});
const verifyStart=performance.now();
const validation=validateData({results:plan.next.results,players:db.players,tournaments:db.tournaments});
if(validation.errors.length)
 throw Error('BATCH_REVIEW site data errors: '+JSON.stringify(validation.errors.slice(0,6)));
const uniqueIds=new Set(plan.next.results.map(x=>x.id));
if(uniqueIds.size!==plan.next.results.length)
 throw Error('BATCH_REVIEW produced duplicate result IDs');
const cash=rows=>rows.reduce((sum,row)=>sum+(typeof row.prize==='number'?Math.round(row.prize*100):0),0);
const individual=rows=>rows.reduce((sum,row)=>sum+personalCents(row)*roster(row).length,0);
if(cash(db.results)!==cash(plan.next.results)||individual(db.results)!==individual(plan.next.results))
 throw Error('BATCH_REVIEW changed cash without individual verified payout evidence');
const verifyMs=Number((performance.now()-verifyStart).toFixed(3));
const filesStart=performance.now();
let wrote=false;
if(applying&&(plan.published.length||plan.duplicates.length)){
 writeReviewDb(root,plan.next);
 if(plan.next.reviewed)fs.writeFileSync(path.join(root,'history-sync-reviewed.json'),
  JSON.stringify(plan.next.reviewed,null,2)+'\n');
 wrote=true;
}
const saveMs=Number((performance.now()-filesStart).toFixed(3));
const metrics={loadMs,...plan.metrics,verificationMs:verifyMs,writeMs:saveMs,
 totalRunnerMs:Number((performance.now()-begin).toFixed(3))};
const report={
 version:1,at:timestamp,runId,applied:applying,wrote,
 sourceResults:plan.preview.sourceResults,resultCount:plan.preview.nextResults,
 selected:plan.selected,windows:plan.windowGroups,
 published:plan.published,duplicates:plan.duplicates,held:plan.held,
 remainingPending:plan.preview.remainingPending,metrics
};
const lines=[
 '# ASIA ON TOUR — 一括調査と安全な掲載レビュー',
 '',
 '- 実行: '+timestamp,
 '- 操作: '+(applying?'掲載PR用にデータ更新済み（マージ前）':'確認のみ、正本データ変更なし'),
 '- 照合対象: '+plan.selected+'件 / 元Epic順位表ウィンドウ '+plan.windowGroups+'個',
 '- 掲載予定: '+plan.published.length+'件',
 '- 同一成績として整理: '+plan.duplicates.length+'件',
 '- 根拠不足・保留: '+plan.held.length+'件',
 '- 総戦績: '+plan.preview.sourceResults+' → '+plan.preview.nextResults,
 '- 既存賞金の合計: 変更なし',
 '',
 '## 掲載候補', '',
 '| 選手 | 順位 | 種別 | 賞金 | 候補ID |',
 '|---|---:|---|---|---|',
 ...plan.published.map(x=>'| '+x.player+' | '+x.rank+' | '+x.kind+' | '+(x.prize===null?'未確認':'$'+x.prize)+' | '+x.id+' |'),
 '', '## 重複整理', '',
 ...(plan.duplicates.length?plan.duplicates.map(x=>'- '+x.player+' ('+x.id+') → 既掲載 '+x.existingId+' / 元の賞金を保持'):['- なし']),
 '', '## 保留と根拠', '',
 ...(plan.held.length?plan.held.map(x=>'- '+x.id+' '+x.player+': '+x.reason):['- なし']),
 '', '## 処理時間（このワークフロー内）', '',
 '| 工程 | 時間（ms） |','|---|---:|',
 ...Object.entries(metrics).map(([key,value])=>'| '+key+' | '+value+' |'),
 '', '## 安全性',
 '- 出典はEpic公式URL・本人Epic ID・保存済みの同一開催枠順位表',
 '- 未完了順位表は成熟済み連続ページ上の候補のみ',
 '- 予選突破と0VR決勝は元の公式ルールにある地域別条件を満たすときのみ',
 '- 未確認賞金・スキンは自動確定しない',
 '- スコアに矛盾する重複は消さずに保留',
 '- 最終掲載はPRの必須データ・PC/スマホテスト合格後にマージ'
].join('\n')+'\n';
fs.writeFileSync(path.join(root,'.batch-review-summary.md'),lines);
fs.writeFileSync(path.join(root,'.batch-review-report.json'),JSON.stringify(report,null,2)+'\n');
if(wrote){
 const out=path.join(root,'review-reports',today+'-batch-review-'+runId+'.md');
 fs.mkdirSync(path.dirname(out),{recursive:true});
 fs.writeFileSync(out,lines);
}
if(process.env.GITHUB_STEP_SUMMARY)
 fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,lines+'\n');
console.log('AOT_REVIEW_BATCH '+JSON.stringify({
 applied:applying,wrote,selected:plan.selected,windows:plan.windowGroups,
 new:plan.published.length,duplicates:plan.duplicates.length,held:plan.held.length,
 before:db.results.length,after:plan.next.results.length,metrics}));
