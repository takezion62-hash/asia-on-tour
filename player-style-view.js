/* ASIA ON TOUR — display-only player-style presentation helpers. */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.AsiaPlayerStyleView=api;
})(typeof globalThis==='object'?globalThis:this,function(){
 'use strict';
 const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const num=(n,decimals=1)=>n==null||!Number.isFinite(n)?'—':n.toLocaleString('ja-JP',{minimumFractionDigits:decimals,maximumFractionDigits:decimals});
 const pct=n=>n==null?'—':num(100*n,1)+'%';
 const count=n=>num(n,0);
 const choices=(value,list)=>list.map(item=>'<option value="'+esc(item.id)+'"'+(value===item.id?' selected':'')+'>'+esc(item.label)+'</option>').join('');
 const axis=(label,value)=>'<div class="style-bar-line"><span>'+esc(label)+'</span><div class="style-bar"><i style="width:'+Math.max(0,Math.min(100,value||0))+'%"></i></div><small>'+count(value)+'/100</small></div>';
 const dataLine=(a,b)=>a+' · '+b;
 const trustedSource=url=>{
   try{const u=new URL(String(url||''));return u.protocol==='https:'&&
     ['www.fortnite.com','fortnite.com','fortnitetracker.com','www.fortnitetracker.com','liquipedia.net','www.liquipedia.net','myfortnitestats.com','osirion.gg'].includes(u.hostname)?u.href:null;}
   catch{return null;}
 };
 const trendGraph=(rows,metric,label,color)=>{
   const points=rows.map(r=>({month:r.month,value:r[metric]})).filter(p=>p.value!=null&&Number.isFinite(p.value));
   if(points.length<2)return '<div class="style-box style-trend-plot"><h3>'+esc(label)+'</h3><p class="style-note">グラフ表示には実測月が2か月以上必要だょ</p></div>';
   const stamp=p=>Number(p.month.slice(0,4))*12+Number(p.month.slice(5,7));
   const months=points.map(stamp),min=Math.min(...months),span=Math.max(1,Math.max(...months)-min);
   const max=Math.max(0.001,...points.map(p=>p.value));
   const coords=points.map((p,i)=>({
     x:18+(months[i]-min)/span*294,
     y:145-(p.value/max)*110,
     label:p.month
   }));
   const poly=coords.map(p=>p.x.toFixed(1)+','+p.y.toFixed(1)).join(' ');
   const dots=coords.map(p=>'<circle cx="'+p.x.toFixed(1)+'" cy="'+p.y.toFixed(1)+'" r="4" fill="'+color+'"/>').join('');
   const first=esc(points[0].month),last=esc(points.at(-1).month);
   return '<div class="style-box style-trend-plot"><h3>'+esc(label)+'</h3><svg viewBox="0 0 330 190" role="img" aria-label="'+esc(label)+'の月別推移 '+first+'から'+last+'" width="100%">'
     +'<path d="M18 145H312" stroke="#5e728d" stroke-width="1"/>'
     +'<polyline points="'+poly+'" fill="none" stroke="'+color+'" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>'
     +dots+'<text x="18" y="172" fill="#bbcade" font-size="12">'+first+'</text><text x="312" y="172" text-anchor="end" fill="#bbcade" font-size="12">'+last+'</text>'
     +'</svg><p class="style-note">実測値だけを描画。月の間隔は実際の経過月数を反映するょ</p></div>';
 };
 function radar(style){
   if(style.attack==null||style.victory==null||style.breadth==null)return '';
   const points=[style.attack,style.victory,style.breadth];
   const position=(i,score)=>{
     const angle=-Math.PI/2+i*2*Math.PI/3;
     return [155+94*(score/100)*Math.cos(angle),128+94*(score/100)*Math.sin(angle)];
   };
   const ring=(score)=>[0,1,2].map(i=>position(i,score).map(n=>n.toFixed(1)).join(',')).join(' ');
   const shape=points.map((n,i)=>position(i,n).map(v=>v.toFixed(1)).join(',')).join(' ');
   return '<div class="style-box style-radar"><h3>3軸の相対傾向（同条件の比較対象内）</h3>'
     +'<svg viewBox="0 0 310 250" width="100%" style="max-width:330px;display:block;margin:auto" role="img" aria-label="攻撃'+count(style.attack)+'、VR'+count(style.victory)+'、遠征地域数の幅'+count(style.breadth)+'。相対スコアであり総合的な強さではありません">'
     +'<polygon points="'+ring(100)+'" fill="none" stroke="#7186a8" stroke-width="1.6"/>'
     +'<polygon points="'+ring(50)+'" fill="none" stroke="#4e6481" stroke-width="1.3"/>'
     +'<polygon points="'+shape+'" fill="#9c8ded66" stroke="#c2b7ff" stroke-width="2.3"/>'
     +'<text x="155" y="20" text-anchor="middle" fill="#d6e6fb" font-size="12">攻撃効率</text>'
     +'<text x="280" y="227" text-anchor="middle" fill="#d6e6fb" font-size="12">VR効率</text>'
     +'<text x="27" y="227" text-anchor="middle" fill="#d6e6fb" font-size="12">遠征地域数</text>'
     +'</svg><p class="style-note">3軸は同じ選択条件の選手と比較した相対位置。遠征地域数は実力ではなく、記録のある地域の幅を示すょ</p></div>';
 }
 function profile(report,opts={}){
   const f=report.filters,q=report.stats;
   const optsMap=opts||{};
   const teamChoices=[{id:'solo',label:'ソロ'},{id:'duo',label:'デュオ'},{id:'trio',label:'トリオ'},{id:'squad',label:'スクワッド'}];
   const modes=[{id:'all',label:'全形式'},...(optsMap.modes||[])];
   const series=[{id:'all',label:'全シリーズ'},...(optsMap.series||[])];
   const seasons=[{id:'all',label:'全期間'},...(optsMap.seasons||[])];
   const regions=[{id:'all',label:'全地域'},...report.regions.map(r=>({id:r.region,label:r.region}))];
   const filter=(id,label,items)=>'<label>'+esc(label)+'<select data-style-filter="'+id+'" aria-label="プレイスタイル分析 '+esc(label)+'">'+choices(f[id],items)+'</select></label>';
   const filterMarkup='<div class="style-filters">'+filter('season','期間',seasons)
     +filter('team','チーム形式',teamChoices)+filter('mode','ゲーム形式',modes)
     +filter('series','大会シリーズ',series)+filter('region','対象地域',regions)+'</div>';
   const card=(label,value,hint)=>'<div class="style-card"><small>'+esc(label)+'</small><strong>'+esc(value)+'</strong><em>'+esc(hint)+'</em></div>';
   const summary='<div class="style-cards">'+[
     card(f.team==='solo'?'個人キル / 試合':'チームキル / 試合',q.kpm==null?'—':num(q.kpm,2),count(q.killMatches)+'試合・'+count(q.killRecords)+'戦績が対象'),
     card('VR / 試合',q.vrRate==null?'—':pct(q.vrRate),count(q.vrMatches)+'試合・'+count(q.vrRecords)+'戦績が対象'),
     card('分析対象の開催枠',count(report.quality.windows),count(q.records)+'件の掲載済み戦績'),
     card('試合数を確認できた記録',count(q.knownMatchRecords),count(q.unknownMatchRecords)+'件は試合数不明')
   ].join('')+'</div>';
   const cov=report.coverage||{};
   const percentage=val=>val==null?'—':num(val*100,0)+'%';
   const qualityHtml='<div class="style-quality" aria-label="データの充実度">'
     +'<div><strong>入力の充実度</strong><span>キル入力 '+percentage(cov.killCoverage)+' · VR入力 '+percentage(cov.vrCoverage)+'</span></div>'
     +'<div class="style-quality-bar" aria-hidden="true"><i style="width:'+Math.round((cov.killCoverage||0)*100)+'%"></i></div>'
     +'<p>掲載戦績'+count(q.records)+'件のうち試合数不明'+count(cov.missingMatches||0)+'件、キル効率の対象外'+count(cov.missingKillRecords||0)+'件、VR率の対象外'+count(cov.missingVrRecords||0)+'件。未知数値を0には置き換えないょ</p>'
     +(cov.overlappingIds?.length?'<p class="style-quality-warning">同じ開催枠の重複疑い '+count(cov.overlappingIds.length)+'件を除外中</p>':'')
     +(cov.conflictingIds?.length?'<p class="style-quality-warning">対象データセット内のID衝突 '+count(cov.conflictingIds.length)+'件を除外中（この選手に限らない）</p>':'')
     +'</div>';
   const eligible=report.affinity;
   const best=eligible.region?'🏅 集計上の得意地域候補：'+eligible.region:'🌍 得意地域：未判定';
   const style='<div class="style-status"><span class="style-tag'+(report.style.key==='unrated'?' is-low':'')+'">'+esc(report.style.label)+'</span><span class="style-small">'+esc(report.style.reason)+'</span></div>';
   const most=[...report.regions].filter(r=>r.records>0).sort((a,b)=>b.records-a.records)[0];
   const observed=most?'<p class="style-advice">掲載戦績が最も多い地域：<b>'+esc(most.region)+'</b>（'+count(most.records)+'戦績）※得意地域の判定とは別</p>':'';
   const affinity='<div class="style-status"><span class="style-tag'+(!eligible.region?' is-low':'')+'">'+esc(best)+'</span><span class="style-small">'+esc(eligible.reason)+'</span></div>';
   const specials=report.specialties||{};
   const specialty=(icon,label,region,reason)=>'<div class="style-specialty"><small>'+icon+' '+label+'</small><strong>'+(region?esc(region):'未判定')+'</strong><span>'+esc(reason||'比較材料なし')+'</span></div>';
   const specialtyHtml='<div class="style-specialties" aria-label="地域別の得意傾向">'
     +specialty('⚔️','攻撃効率が高い地域',specials.attack,specials.attackReason)
     +specialty('🏆','勝ち切り効率が高い地域',specials.victory,specials.victoryReason)
     +'</div>';
   const adapt=eligible.adaptation?'<p class="style-advice">地域適応力の参考情報：<strong>'+count(eligible.adaptation.qualifiedRegions)+'地域に比較可能な記録</strong>があり、そのうち'+count(eligible.adaptation.consistentRegions)+'地域は最良地域スコアの75%以上（'+esc(eligible.adaptation.label)+'）</p>'
     :'<p class="style-advice">地域適応力は複数地域の十分な試合数がそろってから判定するょ</p>';
   const regionStats='<div class="style-regions">'+report.regions.map(r=>'<article class="style-region'+(r.region===eligible.region?' is-best':'')+(r.region===specials.attack?' is-attack':'')+(r.region===specials.victory?' is-victory':'')+'" data-style-region="'+esc(r.region)+'"><strong>'+esc(r.region)+(r.region===eligible.region?' 🏅':'')+(r.region===specials.attack?' ⚔️':'')+(r.region===specials.victory?' 🏆':'')+'</strong>'
     +'<small>'+count(r.records)+'戦績 · '+count(r.windows)+'開催枠 · '+count(r.matchTotal)+'試合（試合数確認分）</small>'
     +'<b>K/試合 '+(r.kpm==null?'—':num(r.kpm,2))+' / VR率 '+pct(r.vrRate)+'</b>'
     +'<small>'+(r.level==='qualified'?'比較候補：5枠・30試合以上':r.level==='provisional'?'暫定：3枠・15試合以上':'データ不足')+'</small></article>').join('')+'</div>';
   const percentiles=report.style.attack==null?'<p class="style-note">相対評価に必要な条件を満たしていないため、数値を推測せず保留中だょ</p>'
     :'<div class="style-box"><h3>実測効率の相対位置</h3><div class="style-compare-bars">'+axis('攻撃',report.style.attack)+axis('勝利',report.style.victory)
      +(report.style.breadth!=null?axis('遠征幅',report.style.breadth):'')+'</div><p class="style-note">比較対象'+count(report.style.peers)+'名の中での順位割合。100点満点の実力判定ではないょ</p></div>';
   const trend=report.trend.slice(-12).reverse();
   const trendHtml='<div class="style-box"><h3>月別の実測傾向（最大12か月）</h3><div class="style-scroll"><table class="style-trend"><thead><tr><th>開催月</th><th>キル/試合</th><th>VR率</th><th>試合数確認</th></tr></thead><tbody>'
     +(trend.length?trend.map(t=>'<tr><th>'+esc(t.month)+'</th><td>'+(t.kpm==null?'—':num(t.kpm,2))+'</td><td>'+pct(t.vrRate)+'</td><td>'+count(t.matchTotal)+'</td></tr>').join('')
      :'<tr><td colspan="4">対象月の掲載戦績はありません</td></tr>')
     +'</tbody></table></div><p class="style-small">未掲載月は表示しないため、不参加や0キルを意味しません</p></div>';
   const mom=report.momentum||{};
   const delta=(n,kind)=>n==null?'—':(n>0?'+':'')+num(n*(kind==='rate'?100:1),2)+(kind==='rate'?'pt':'');
   const momentumHtml=mom.ready?'<div class="style-momentum"><strong>📈 直近5開催枠 vs 前5開催枠</strong>'
     +'<span>キル/試合 '+delta(mom.deltaKpm)+' · VR率 '+delta(mom.deltaVrRate,'rate')+'</span>'
     +'<small>同条件・各期間15試合以上の実測差。将来の成績予測ではないょ</small></div>'
     :'<p class="style-note">📈 最近の傾向：'+esc(mom.reason||'データ不足')+'</p>';
   const graphs='<div class="style-extra">'+trendGraph(report.trend,'kpm','月別 キル/試合','#a79dff')
     +trendGraph(report.trend,'vrRate','月別 VR率','#68dcd6')+'</div>';
   const proof=(report.evidence||[]).slice(0,15).map(r=>{
     const url=trustedSource(r.source);
     return '<tr><td>'+esc(r.date)+'</td><td>'+esc(r.region)+'</td>'
      +'<td>'+esc(r.event||'大会未確認')+'<small class="style-proof-round">'+esc(r.round||'')+'</small></td>'
      +'<td>'+count(r.matches)+'</td><td>'+count(r.kills)+'</td><td>'+count(r.vrs)+'</td>'
      +'<td>'+(url?'<a href="'+esc(url)+'" target="_blank" rel="noopener noreferrer">出典 ↗</a>':'—')+'</td></tr>';
   }).join('');
   const evidenceHtml='<details class="style-evidence"><summary>📚 計算に使った戦績・出典を見る（直近'+count((report.evidence||[]).length)+'件）</summary>'
     +'<div class="style-evidence-scroll" tabindex="0"><table><thead><tr><th>日付</th><th>地域</th><th>大会</th><th>試合</th><th>キル</th><th>VR</th><th>根拠</th></tr></thead><tbody>'
     +(proof||'<tr><td colspan="7">表示できる掲載戦績はないょ</td></tr>')+'</tbody></table></div>'
     +'<p class="style-note">ここには最新15件を表示。元戦績・資格確認・対象大会は他のページでも確認できるょ</p></details>';
   return '<section class="profile-style" id="profile-style" aria-labelledby="profile-style-title">'
     +'<div class="style-head"><div><span class="style-kicker">PLAYER STYLE / REGION PERFORMANCE</span><h2 id="profile-style-title">プレイスタイル<span>分析</span></h2>'
     +'<p>海外大会の実測結果から攻撃・勝利・得意地域を比較。戦術的なIGL/フラッガー役は推測しないょ</p></div><span class="style-icon" aria-hidden="true">🎯</span></div>'
     +filterMarkup+(f.season==='all'&&report.recommendedSeason?'<div class="style-season-help"><span>🌱 シーズンをそろえると地域別の得意傾向をより正確に比較できるょ</span><button type="button" data-style-season-pick="'+esc(report.recommendedSeason)+'">記録が充実した '+esc(report.recommendedSeason)+' に絞る ↗</button></div>':'')+summary+qualityHtml+style+affinity+specialtyHtml+observed+adapt
     +'<h3 class="style-region-title">🌍 地域別パフォーマンス</h3>'+regionStats
     +'<p class="style-region-note">地域の累計キル数では判定しない。得意地域候補は同シーズン・同形式・同シリーズで2地域以上の15試合・3開催枠を満たし、総合差が10点以上の場合のみ表示（キル効率70%＋VR率30%）。大会の難易度差は補正していないょ</p>'
     +'<div class="style-extra">'+percentiles+radar(report.style)+'</div>'
     +trendHtml+graphs+momentumHtml+evidenceHtml
     +'<p class="style-footnote">出典確認済みの掲載結果と本人確認済み出場アーカイブの重複排除分のみを対象にしているょ。試合数不明はK/試合・VR率に加えず、チームのキルやVRを個人の数字として扱わない。大会未掲載・詳細未確認・同一IDの矛盾は集計しない。<button type="button" data-style-growth-jump class="style-jump">既存の成長グラフを見る ↗</button> ／ <a href="./verification.html">データ検証センター</a></p></section>';
 }
 function comparison(reports,options={}){
   const selected=Array.isArray(reports)?reports:[];
   const team=options.team||'solo';
   const opts=[['solo','ソロ'],['duo','デュオ'],['trio','トリオ'],['squad','スクワッド']]
     .map(([key,label])=>'<option value="'+key+'"'+(team===key?' selected':'')+'>'+label+'</option>').join('');
   const cards=selected.map(report=>{
     const s=report.stats;
     const best=report.affinity.region||'判定保留';
     return '<article class="style-compare-item" data-compare-style-player="'+esc(report.player)+'"><h3>'+esc(report.player)+'</h3>'
       +'<dl><dt>キル / 試合</dt><dd>'+(s.kpm==null?'—':num(s.kpm,2))+'</dd>'
       +'<dt>VR / 試合</dt><dd>'+pct(s.vrRate)+'</dd>'
       +'<dt>キル集計の試合数</dt><dd>'+count(s.killMatches)+'</dd>'
       +'<dt>VR集計の試合数</dt><dd>'+count(s.vrMatches)+'</dd>'
       +'<dt>総合得意地域</dt><dd>'+esc(best)+'</dd>'
       +'<dt>攻撃効率の地域</dt><dd>'+esc(report.specialties?.attack||'未判定')+'</dd>'
       +'<dt>勝ち切り効率の地域</dt><dd>'+esc(report.specialties?.victory||'未判定')+'</dd></dl>'
       +'<span class="style-tag'+(report.style.key==='unrated'?' is-low':'')+'">'+esc(report.style.label)+'</span>'
       +'<p class="style-small">'+esc(report.affinity.reason)+'</p></article>';
   }).join('');
   const regionMatrix='<div class="style-evidence-scroll style-region-matrix" tabindex="0" aria-label="同条件・地域別の攻撃効率と勝率の比較表">'
     +'<table class="style-matrix"><thead><tr><th scope="col">地域</th>'
     +selected.map(r=>'<th scope="col">'+esc(r.player)+'</th>').join('')+'</tr></thead><tbody>'
     +['ME','EU','NAC','NAW','OCE','BR'].map(region=>{
       return '<tr data-style-compare-region="'+region+'"><th scope="row">'+region+'</th>'
        +selected.map(player=>{
          const metric=player.regions.find(x=>x.region===region);
          const hasData=metric?.records>0;
          const checked=metric?.killMatches||0,winChecked=metric?.vrMatches||0;
          return '<td data-style-matrix-player="'+esc(player.player)+'">'
            +(hasData?'<strong>K/試合 '+num(metric.kpm,2)+'</strong><small>VR率 '+pct(metric.vrRate)
              +' · '+count(checked)+'試合（K） / '+count(winChecked)+'試合（VR）</small>'
              +(metric.level==='insufficient'?'<small>※データ少</small>':'')
              :'<small>掲載済み戦績なし</small>')+'</td>';
        }).join('')+'</tr>';
     }).join('')+'</tbody></table></div>';
   return '<section class="compare-style" aria-labelledby="compare-style-title"><div class="style-head"><div><span class="style-kicker">PLAYSTYLE COMPARISON</span><h2 id="compare-style-title">プレイスタイル<span>比較</span></h2><p>選手比較の期間・地域・形式・大会シリーズと同期。チーム形式は別途そろえるょ</p></div></div>'
     +'<div class="style-filters"><label>チーム形式<select id="compare-style-team" aria-label="プレイスタイル比較 チーム形式">'+opts+'</select></label></div>'
     +'<div class="style-compare-row">'+cards+'</div>'
     +'<h3 class="style-region-title">🌍 同条件の地域別実測比較</h3>'+regionMatrix
     +'<p class="style-footnote">試合数がわからない記録は率に含めません。チーム戦はチームキル・チームVR。得意地域候補は厳密に同じ条件で比較可能な地域が複数ある場合にのみ表示します。</p></section>';
 }
 return Object.freeze({profile,comparison,radar});
});
