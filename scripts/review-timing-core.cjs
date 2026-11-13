'use strict';
function duration(start,end){
 const a=Date.parse(start||''),b=Date.parse(end||'');
 return Number.isFinite(a)&&Number.isFinite(b)&&b>=a?b-a:null;
}
const fmt=ms=>ms===null?'未計測':(ms/1000).toFixed(2)+' 秒';
function summary(report){
 const lines=[
 '# ASIA ON TOUR CI / 公開時間の自動測定','',
 '- 対象: '+report.workflow+' ('+report.event+')',
 '- 実行: '+report.url,
 '- 結果: '+report.conclusion,
 '- ブランチ: '+report.branch,
 '',
 '| 計測点 | 所要時間 |','|---|---:|',
 '| 待機 | '+fmt(report.durations.queueMs)+' |',
 '| 実行 | '+fmt(report.durations.executionMs)+' |',
 '| 合計 | '+fmt(report.durations.totalMs)+' |',
 '', '## ジョブ単位', '',
 '| ジョブ | 結果 | 所要時間 |', '|---|---|---:|',
 ...report.jobs.map(j=>'| '+j.name.replace(/\|/g,'/')+' | '+j.conclusion+' | '+fmt(j.durationMs)+' |'),
 '', 'PRから公開までの合計は、各PR・デプロイ実行の時刻を合わせて確認してね',
 '候補の照合・重複検証・保存時間は batch-review のJSONレポートに記録されるよ'
 ];
 return lines.join('\n')+'\n';
}
module.exports={duration,fmt,summary};
