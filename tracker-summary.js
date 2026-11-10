/* ASIA ON TOUR — event summary from confirmed totals + optional Tracker-only facts.
 * No round-level breakdown, K/D inference, or absent-as-zero normalization.
 */
(function(root,factory){
  'use strict';
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.AotTrackerSummary=api;
})(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','"':'&quot;',"'":'&#39;'}[c]));
  const whole=x=>Number.isSafeInteger(x)&&x>=0;
  const n=x=>Number.isFinite(x)&&x>=0;
  const num=x=>x===null?'—':x.toLocaleString('ja-JP');
  const dec=x=>x===null?'—':x.toFixed(2);
  const trackerURL=s=>{
    try{
      const u=new URL(s);
      return u.protocol==='https:'&&!u.username&&!u.password&&!u.hash&&
        ['fortnitetracker.com','www.fortnitetracker.com'].includes(u.hostname)&&
        (/^\/(?:events|profile)\//.test(u.pathname))?u.href:null;
    }catch{return null}
  };
  const secs=x=>x===null?'—':Math.floor(x/60)+'分'+String(x%60).padStart(2,'0')+'秒';
  function validate(record){
    const t=record?.trackerStats;
    if(t==null)return [];
    const errors=[];
    if(!t||typeof t!=='object'||Array.isArray(t))return ['trackerStatsはオブジェクトで指定'];
    if(t.verified!==true)errors.push('Tracker追加指標にはverified:trueが必要');
    if(!trackerURL(t.source))errors.push('出典はFortnite TrackerのHTTPSイベント・プロフィールURLが必要');
    const allowed=new Set(['verified','source','avgPlace','avgTimeAliveSeconds','kdRatio']);
    for(const key of Object.keys(t))if(!allowed.has(key))errors.push('未知のTracker追加指標: '+key);
    const present=['avgPlace','avgTimeAliveSeconds','kdRatio'].filter(key=>t[key]!=null);
    if(!present.length)errors.push('確認した追加指標を1つ以上指定');
    if(t.avgPlace!=null&&!(n(t.avgPlace)&&t.avgPlace>=1&&t.avgPlace<=10000))errors.push('avgPlaceは1以上の有限数');
    if(t.avgTimeAliveSeconds!=null&&!(whole(t.avgTimeAliveSeconds)&&t.avgTimeAliveSeconds<=86400))errors.push('avgTimeAliveSecondsは0〜86400の整数');
    if(t.kdRatio!=null&&!(n(t.kdRatio)&&t.kdRatio<=100000))errors.push('kdRatioは0以上の有限数');
    return errors;
  }
  function metrics(record){
    const m=whole(record?.matches)&&record.matches>0?record.matches:null;
    const pts=whole(record?.points)?record.points:null;
    const wins=whole(record?.vrs)?record.vrs:null;
    const kills=whole(record?.kills)?record.kills:null;
    const t=validate(record).length===0?record?.trackerStats:null;
    return [
      {key:'points',label:'POINTS / ポイント',value:num(pts)},
      {key:'matches',label:'MATCHES / 試合数',value:num(whole(record?.matches)?record.matches:null)},
      {key:'wins',label:'WINS / VR',value:num(wins)},
      {key:'avg-points',label:'AVG. POINTS / 平均Pt',value:dec(m!==null&&pts!==null?pts/m:null)},
      {key:'avg-place',label:'AVG. PLACE / 平均順位',value:dec(t?.avgPlace??null)},
      {key:'avg-time',label:'AVG. TIME ALIVE / 平均生存',value:secs(t?.avgTimeAliveSeconds??null)},
      {key:'elims',label:'ELIMINATIONS / キル',value:num(kills)},
      {key:'avg-elims',label:'AVG. ELIMS / 平均キル',value:dec(m!==null&&kills!==null?kills/m:null)},
      {key:'kd',label:'K/D RATIO',value:dec(t?.kdRatio??null)}
    ];
  }
  function render(record){
    const roster=Array.isArray(record?.players)&&record.players.length?record.players:[record?.player];
    const team=roster.length>1;
    const extras=record?.trackerStats&&validate(record).length===0?record.trackerStats:null;
    const source=extras?trackerURL(extras.source):null;
    const cells=metrics(record).map(m=>'<div class="tracker-summary-cell" data-tracker-metric="'+esc(m.key)+'">'
      +'<dt>'+esc(m.label)+'</dt><dd>'+esc(m.value)+'</dd></div>').join('');
    return '<section class="tracker-summary" aria-label="Fortnite Tracker形式の大会基本スタッツ">'
      +'<h4>📊 大会の基本スタッツ <small>TRACKER SUMMARY</small></h4>'
      +'<dl class="tracker-summary-grid">'+cells+'</dl>'
      +'<p class="tracker-summary-hint">'+(team?'キル・VR・K/Dはチーム記録。個人への按分はしない。':
        'キル・VRは掲載した大会記録の数値。')
      +' 平均Ptと平均キルは合計÷確認済み試合数。平均順位・平均生存時間・K/Dは出典確認できた場合だけ表示。未取得は「—」で、0とは区別する。</p>'
      +(source?'<a class="tracker-summary-source" href="'+esc(source)+'" target="_blank" rel="noopener noreferrer">Trackerで追加指標を確認 ↗</a>':'')
      +'</section>';
  }
  return Object.freeze({VERSION:1,metrics,validate,render});
});
