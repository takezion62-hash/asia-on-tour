'use strict';
// Operator-friendly summary. This is read-only and cannot publish results.
const fs=require('node:fs'),path=require('node:path');
const ROOT=path.resolve(__dirname,'..');
const read=p=>JSON.parse(fs.readFileSync(path.join(ROOT,p),'utf8'));
const n=v=>Number.isSafeInteger(v)&&v>=0?v:0;
function describe(status,now=Date.now()){
 if(!status||!Number.isFinite(Date.parse(status.checkedAt)))
  throw Error('HISTORY_SYNC_HEALTH missing valid scan checkpoint time');
 const total=n(status.trackedWindows),completed=n(status.completedWindows);
 const ageMinutes=Math.max(0,Math.round((now-Date.parse(status.checkedAt))/60000));
 return {
  checkedAt:status.checkedAt,ageMinutes,stale:ageMinutes>=480,
  totalWindows:total,completedWindows:completed,
  unfinishedWindows:Math.max(0,total-completed),
  scannedPages:n(status.scannedPages),
  completedThisRun:n(status.newlyCompletedWindows),
  processedWindows:n(status.processedWindows),
  imported:n(status.imported),
  retryWaiting:n(status.coverage?.counts?.retryWaiting),
  retryDue:n(status.coverage?.counts?.retryDue),
  rateLimited:status.providerRateLimitPaused===true,
  retryAfter:status.providerRateLimitRetryAfter||null,
  transientFailures:n(status.transientFailures)
 };
}
function report(view){
 const lines=[
  '### 過去大会の自動調査',
  '',
  '| 項目 | 状況 |','|---|---:|',
  '| 最新スキャン（UTC） | '+view.checkedAt+' |',
  '| 調査済み / 総開催枠 | '+view.completedWindows+' / '+view.totalWindows+' |',
  '| 未完了の開催枠 | '+view.unfinishedWindows+' |',
  '| 今回の取得ページ | '+view.scannedPages+' |',
  '| 今回完了した開催枠 | '+view.completedThisRun+' |',
  '| 今回追加した成績 | '+view.imported+' |',
  '| 取得先の429制限による中断 | '+(view.rateLimited?'あり':'なし')+' |',
  '| API再試行待ち | '+view.retryWaiting+' |',
  ''
 ];
 if(view.rateLimited)lines.push('取得元のHTTP 429で新規アクセスを中断し、確認済みページを保持。再試行時刻: '+(view.retryAfter||'未指定')+'。');
 if(view.stale)lines.push('注意: チェックポイントの最終更新から8時間以上経過。GitHub Actionsのschedule遅延や実行失敗を確認。');
 return lines.join('\n')+'\n';
}
function main(){
 const status=read('history-sync-status.json'),v=describe(status);
 console.log('HISTORY_SYNC_HEALTH '+JSON.stringify(v));
 if(v.rateLimited)console.warn('::warning::Osirion HTTP 429: verified pages were preserved and remaining requests paused');
 if(v.stale)console.warn('::warning::Historical scan checkpoint has not advanced for 8h or more');
 if(process.env.GITHUB_STEP_SUMMARY)
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,report(v));
}
if(require.main===module)main();
module.exports={describe,report};
