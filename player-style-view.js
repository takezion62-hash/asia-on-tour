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
   const teamChoices=[{id:'all',label:'全チーム形式'},{id:'solo',label:'ソロ'},{id:'duo',label:'デュオ'},{id:'trio',label:'トリオ'},{id:'squad',label:'スクワッド'}];
   const modes=[{id:'all',label:'全形式'},...(optsMap.modes||[])];
   const series=[{id:'all',label:'全シリーズ'},...(optsMap.series||[])];
   const seasons=[{id:'all',label:'全期間'},...(optsMap.seasons||[])];
   const regions=[{id:'all',label:'全地域'},...report.regions.map(r=>({id:r.region,label:r.region}))];
   const filter=(id,label,items)=>'<label>'+esc(label)+'<select data-style-filter="'+id+'" aria-label="プレイスタイル分析 '+esc(label)+'">'+choices(f[id],items)+'</select></label>';
   const filterMarkup='<div class="style-filters">'+filter('season','期間',seasons)
     +filter('team','チーム形式',teamChoices)+filter('mode','ゲーム形式',modes)
     +filter('series','大会シリーズ',series)+filter('region','対象地域',regions)+'</div>';
   const card=(label,value,hint)=>'<div class="style-card"><small>'+esc(label)+'</small><strong>'+esc(value)+'</strong><em>'+esc(hint)+'</em></div>';
   const mixedTeam=f.team==='all';
   const summary='<div class="style-cards">'+(mixedTeam?[
     card('記録されたキル合計',count(q.kills),'ソロ個人＋チーム戦のキルが混在。効率比較には使わない'),
     card('記録されたVR合計',count(q.vrs),'チーム戦はチームのVRを含む'),
     card('分析対象の開催枠',count(report.quality.windows),count(q.records)+'件の掲載済み戦績'),
     card('確認できた試合数',count(q.matchTotal),count(q.unknownMatchRecords)+'件は試合数不明')
   ]:[
     card(f.team==='solo'?'個人キル / 試合':'チームキル / 試合',q.kpm==null?'—':num(q.kpm,2),count(q.killMatches)+'試合・'+count(q.killRecords)+'戦績が対象'),
     card('VR / 試合',q.vrRate==null?'—':pct(q.vrRate),count(q.vrMatches)+'試合・'+count(q.vrRecords)+'戦績が対象'),
     card('分析対象の開催枠',count(report.quality.windows),count(q.records)+'件の掲載済み戦績'),
     card('試合数を確認できた記録',count(q.knownMatchRecords),count(q.unknownMatchRecords)+'件は試合数不明')
   ]).join('')+'</div>';
   const insight=report.insights||{label:'対象データなし',tags:[],progress:0,
     detail:'現在の条件に該当する掲載済み戦績はありません'};
   const level=insight.progress||0;
   const traits=(insight.tags||[]).map(t=>
     '<span class="style-trait" title="'+esc(t.detail||'')+'">'+esc(t.label)+'</span>').join('');
   const scope=report.recommendedScope;
   const differentScope=scope&&['season','team','mode','series'].some(k=>scope[k]!==f[k]);
   const scopeButton=differentScope?'<button type="button" class="style-preset" data-style-scope-pick'
     +' data-style-scope-season="'+esc(scope.season)+'"'
     +' data-style-scope-team="'+esc(scope.team)+'"'
     +' data-style-scope-mode="'+esc(scope.mode)+'"'
     +' data-style-scope-series="'+esc(scope.series)+'">'
     +'記録が最も多い形式（'+esc(scope.season)+'・'+esc(({solo:'ソロ',duo:'デュオ',trio:'トリオ',squad:'スクワッド'})[scope.team]||scope.team)
     +'）で詳しく見る</button>':'';
   const insightHtml='<section class="style-overview" aria-label="少量データ対応の基本分析">'
     +'<div class="style-overview-top"><div><small>EVIDENCE-BASED SCOUT · v2.0</small>'
     +'<h3>現在の分析：'+esc(insight.label)+'</h3></div>'
     +'<strong class="style-stage">LEVEL '+level+' / 3</strong></div>'
     +'<div class="style-level-steps" aria-label="分析段階 '+level+'/3">'
     +[1,2,3].map(n=>'<span'+(level>=n?' class="is-active"':'')+'></span>').join('')
     +'</div><p class="style-overview-description">'+esc(insight.detail||'')+'</p>'
     +'<div class="style-traits">'+(traits||'<span class="style-trait is-muted">対象の戦績が増えると実績タグが表示されるょ</span>')+'</div>'
     +(mixedTeam?'<p class="style-overview-warning">全チーム形式の実績をまとめて表示中。ソロの個人キルとチーム戦のキルを混ぜて効率比較しないょ</p>':'')
     +scopeButton+'</section>';
   const regionSummary=report.regionHighlights||{};
   const snapshot=(label,region,detail)=>'<article class="style-region-fact"><small>'+esc(label)+'</small>'
     +'<strong>'+esc(region||'記録なし')+'</strong><span>'+esc(detail||'確認済み記録なし')+'</span></article>';
   const regionFacts='<section class="style-region-facts" aria-label="少数記録からわかる海外遠征の実績">'
     +'<h3>🌍 海外遠征の実績からわかること</h3>'
     +'<div class="style-region-fact-grid">'
     +snapshot('最多参加地域',regionSummary.active?.region,regionSummary.active?count(regionSummary.active.windows)+'開催枠を確認':'')
     +snapshot('賞金獲得記録が最多の地域',regionSummary.cash?.region,
       regionSummary.cash?count(regionSummary.cash.records)+'件の賞金付き戦績':'賞金付き戦績なし、または最多地域が同数')
     +snapshot('記録されたVRが最多の地域',regionSummary.victory?.region,
       regionSummary.victory?count(regionSummary.victory.vrs)+'VR（チーム戦はチームVR）':'VRなし、または最多地域が同数')
     +'</div><p class="style-region-facts-note">これは確認済み記録の多さであって「最も得意な地域」ではないょ。大会難易度やPingの差は補正していないよ</p>'
     +'</section>';
   const cov=report.coverage||{};
   const percentage=val=>val==null?'—':num(val*100,0)+'%';
   const qualityHtml='<div class="style-quality" aria-label="データの充実度">'
     +'<div><strong>入力の充実度</strong><span>キル入力 '+percentage(cov.killCoverage)+' · VR入力 '+percentage(cov.vrCoverage)+'</span></div>'
     +'<div class="style-quality-bar" aria-hidden="true"><i style="width:'+Math.round((cov.killCoverage||0)*100)+'%"></i></div>'
     +'<p>掲載戦績'+count(q.records)+'件のうち試合数不明'+count(cov.missingMatches||0)+'件、キル効率の対象外'+count(cov.missingKillRecords||0)+'件、VR率の対象外'+count(cov.missingVrRecords||0)+'件。未知数値を0には置き換えないょ</p>'
     +(cov.overlappingIds?.length?'<p class="style-quality-warning">同じ開催枠の重複疑い '+count(cov.overlappingIds.length)+'件を除外中</p>':'')
     +(cov.conflictingIds?.length?'<p class="style-quality-warning">対象データセット内のID衝突 '+count(cov.conflictingIds.length)+'件を除外中（この選手に限らない）</p>':'')
     +'</div>';
   // Scouting report is a disclosure inside the existing playstyle fold.
   // Its numbers are observed summaries, not tactical roles or a strength score.
   const scout=report.scouting||{};
   const scoutCard=(label,value,detail)=>'<div class="style-scout-card"><small>'+esc(label)+'</small><strong>'+esc(value)+'</strong><span>'+esc(detail)+'</span></div>';
   const scoutDelta=(n,percentage=false)=>n==null?'—':(n>0?'+':'')+num(n*(percentage?100:1),2)+(percentage?'pt':'');
   const scoutHtml='<details class="style-scouting" aria-label="スカウティングレポート">'
     +'<summary>🧭 スカウティングレポート <small>根拠・データ量・評価保留を確認</small></summary>'
     +'<div class="style-scout-body"><p class="style-note">実測データから見た海外大会での傾向。総合実力スコアや戦術ロールの推定ではないょ</p>'
     +'<div class="style-scout-grid">'
     +scoutCard('攻撃効率',mixedTeam?'形式を選択':scout.attack?.value==null?'—':num(scout.attack.value,2)+' K/試合',
       (scout.attack?.level||'データ不足')+' · '+count(scout.attack?.matches||0)+'試合を確認')
     +scoutCard('勝ち切り効率',mixedTeam?'形式を選択':scout.victory?.value==null?'—':pct(scout.victory.value),
       (scout.victory?.level||'データ不足')+' · '+count(scout.victory?.matches||0)+'試合を確認')
     +scoutCard('キル効率のばらつき',scout.stability?.spread==null?'—':num(scout.stability.spread,2)+' K/試合',
       (scout.stability?.level||'データ不足')+' · 開催枠ごとの標準偏差（小さいほど変動が小さい）')
     +scoutCard('遠征の確認記録',scout.windows==null?'—':count(scout.windows)+'開催枠',
       count(scout.regions||0)+'地域 · 決勝記録'+count(scout.documentedFinals||0)+'件')
     +'</div><p class="style-scout-context">直近変化：'
     +(scout.momentum?.ready?'キル効率 '+esc(scoutDelta(scout.momentum.deltaKpm))
       +' / VR率 '+esc(scoutDelta(scout.momentum.deltaVrRate,true))
       :esc(scout.momentum?.reason||'実測データ不足'))
     +'</p><p class="style-scout-context">現在の記録からわかる特徴：'
     +esc(report.observedTendency?.label||scout.relative?.label||'確認済み戦績なし')+(scout.relative?.peers?'（比較可能 '+count(scout.relative.peers)+'名）':'')
     +'</p><p class="style-note">比較する場合は同一シーズン・ゲーム形式・シリーズ・チーム編成にそろえてね。'
     +esc(scout.limitations||'データ不足の項目は未判定')+'根拠の大会は下の「計算に使った戦績・出典」で確認できるょ</p></div></details>';
   // Every number here has a recorded denominator and an explicit sample grade.
   // These are observations, never a fabricated individual performance rating.
   const axes=report.axes||{},ra=axes.regional||{},fa=axes.format||{};
   const finals=axes.finalStrength||{},growth=axes.growth||{};
   const conf=x=>x?.label||'低';
   const card4=(key,label,value,detail,grade)=>{
     return '<article class="style-axis-card" data-style-axis="'+esc(key)+'" data-axis-confidence="'+esc(grade?.level||'low')+'">'
       +'<div class="style-axis-head"><h4>'+esc(label)+'</h4><span>信頼度 '+esc(conf(grade))+'</span></div>'
       +'<strong>'+esc(value)+'</strong><p>'+esc(detail)+'</p><small>'+esc(grade?.note||'確認済みの対象なし')+'</small></article>';
   };
   const duoStats=Array.isArray(fa.teams)?fa.teams:[];
   const part=(key)=>duoStats.find(x=>x.team===key);
   const solo=part('solo'),duo=part('duo');
   const teamVr=x=>x?.stats?.vrRate==null?'—':pct(x.stats.vrRate);
   const fmtGrades=[solo?.confidence?.level,duo?.confidence?.level];
   const fmtLevel=fmtGrades.includes('low')||fmtGrades.some(x=>!x)?'low':fmtGrades.includes('medium')?'medium':'high';
   const fmtGrade={level:fmtLevel,label:{low:'低',medium:'中',high:'高'}[fmtLevel],
     note:'ソロ '+(solo?.confidence?.note||'記録なし')+' / デュオ '+(duo?.confidence?.note||'記録なし')};
   const delta4=(n,decimal=1,unit='pt')=>n==null?'—':(n>0?'+':'')+num(n,decimal)+unit;
   const regionValue=ra.leader&&ra.score!=null?ra.leader+' '+num(ra.score,1)+'/100':'比較保留';
   const regionDetail=ra.leader
     ?'次点 '+(ra.runnerUp||'—')+' '+num(ra.runnerScore,1)+'/100 · 本人の地域間の相対値'
     :(ra.reason||'同条件の2地域以上の記録が必要');
   const fmtValue=fa.leader?(fa.leader==='solo'?'ソロ':'デュオ')+'のVR率が高い':'適性は未判定';
   const fmtDetail='ソロ '+teamVr(solo)+' / デュオ '+teamVr(duo)
     +(fa.comparable?' · 差 '+delta4(fa.deltaVrPp):'')+' · '+(fa.reason||'条件が不足');
   const finalValue=finals.vrRate==null?'決勝VR率 —':'決勝VR率 '+pct(finals.vrRate);
   const finalDetail='決勝 '+count(finals.recorded||0)+'件 · TOP10 '+count(finals.top10||0)
     +'件（'+pct(finals.top10Rate)+'） · '+(finals.reason||'データ不足');
   const growthValue=growth.ready?'K/試合 '+delta4(growth.deltaKpm,2,''):'変化は未判定';
   const growthDetail=growth.ready?'VR率 '+delta4(growth.deltaVrPp,2)
     +' · '+count(growth.windowsCompared)+'開催枠 · '+growth.reason:(growth.reason||'実測記録が不足');
   const axesHtml='<section class="style-four-axis" aria-label="得意地域・ソロデュオ・決勝・成長の数値比較">'
     +'<div class="style-four-axis-title"><div><small>FOUR-AXIS EVIDENCE</small>'
     +'<h3>📊 4軸の数値比較</h3></div><p>根拠が少ない項目は判定しない</p></div>'
     +'<div class="style-four-axis-grid">'
     +card4('region','🌍 得意地域',regionValue,regionDetail,ra.confidence)
     +card4('format','🎮 ソロ・デュオ適性',fmtValue,fmtDetail,fmtGrade)
     +card4('final','🏆 決勝での強さ',finalValue,finalDetail,finals.confidence)
     +card4('growth','📈 成長傾向',growthValue,growthDetail,growth.confidence)
     +'</div><details class="style-axis-method"><summary>信頼度・比較条件の説明</summary>'
     +'<p>信頼度 高：5開催枠・30試合以上、入力80%以上。中：3開催枠・15試合以上、入力75%以上。それ未満は低。'
     +'信頼度はデータの充実度であり、選手の実力スコアや統計的な信頼区間ではないよ</p>'
     +'<p>地域点数は本人の同条件の地域間相対値。ソロ個人キルとデュオのチームキルは直接比較せず、VR率だけを並べるよ。'
     +'決勝は決勝セッションのみ、成長は新旧3〜5開催枠ずつの同条件の差を比較するよ</p>'
     +'<p>'+esc(axes.caveat||'出典確認済みの掲載戦績のみを使うよ')+'</p>'
     +'</details></section>';
   const eligible=report.affinity;
   const best=eligible.region?'🏅 集計上の得意地域候補：'+eligible.region:'🌍 得意地域は比較準備中';
   const fact=report.observedTendency;
   const observedStat=(label,value,detail)=>'<div class="style-observed-stat"><small>'+esc(label)+'</small><strong>'+esc(value)+'</strong><span>'+esc(detail)+'</span></div>';
   const observedPanel=fact&&fact.records?'<section class="style-observed" aria-label="少ない戦績からわかる特徴">'
     +'<div class="style-observed-top"><div><small>OBSERVED PROFILE / 実測からわかる特徴</small>'
     +'<h3>'+esc(fact.label)+'</h3></div><span class="style-observed-confidence">'+esc(fact.confidence)+'</span></div>'
     +'<p>'+esc(fact.reason)+'</p>'
     +'<div class="style-observed-grid">'
     +observedStat('大会記録',count(fact.records)+'件',count(fact.windows)+'開催枠 · '+count(fact.regionCount)+'地域')
     +observedStat('記録されたキル',q.killRecords?count(fact.kills)+' K':'—',q.killRecords?count(fact.killMatches)+'試合から集計':'キル未入力')
     +observedStat('記録されたVR',q.vrRecords?count(fact.vrs)+' VR':'—',q.vrRecords?count(fact.vrMatches)+'試合から集計':'VR未入力')
     +(fact.mixed?observedStat('K/試合・VR率','形式別に確認','異なるチーム形式や大会シリーズを平均しない')
       :observedStat(fact.unit==='チーム'?'チームK/試合':'K/試合',
        fact.kpm==null?'—':num(fact.kpm,2),count(fact.killMatches)+'試合の実測')
       +observedStat('VR率',fact.vrRate==null?'—':pct(fact.vrRate),count(fact.vrMatches)+'試合の実測'))
     +'</div><p class="style-observed-warning">これは公開済み戦績の事実をまとめた参考プロファイル。強さ・IGLなどの役割・他選手との優劣は判定していないよ</p></section>':'';
   const relative=report.style.key==='unrated'
     ?'<details class="style-relative-more"><summary>📊 厳密な相対タイプの判定条件を見る</summary>'
      +'<p>'+esc(report.style.reason)+'。同じシーズン・人数・ゲーム形式・大会シリーズの20名以上を対象とした比較は、条件がそろった場合だけ表示するよ</p></details>'
     :'<div class="style-status"><span class="style-tag">'+esc('同条件の相対タイプ：'+report.style.label)
      +'</span><span class="style-small">'+esc(report.style.reason)+'</span></div>';
   const style=observedPanel+relative;
   const most=[...report.regions].filter(r=>r.records>0).sort((a,b)=>b.records-a.records)[0];
   const observed=most?'<p class="style-advice">掲載戦績が最も多い地域：<b>'+esc(most.region)+'</b>（'+count(most.records)+'戦績）※得意地域の判定とは別</p>':'';
   const affinity='<div class="style-status"><span class="style-tag'+(!eligible.region?' is-low':'')+'">'+esc(best)+'</span><span class="style-small">'+esc(eligible.region?eligible.reason:'記録のある地域は表示するけど、得意・不得意は少数データから決めないよ。'+eligible.reason)+'</span></div>';
   const specials=report.specialties||{};
   const specialty=(icon,label,region,reason)=>'<div class="style-specialty"><small>'+icon+' '+label+'</small><strong>'+(region?esc(region):'未判定')+'</strong><span>'+esc(reason||'比較材料なし')+'</span></div>';
   const activeRegions=report.regions.filter(r=>r.records>0);
   const snapshotRegion=activeRegions.length===1?activeRegions[0]:null;
   const specialtyHtml='<div class="style-specialties" aria-label="地域別の記録">'
     +(specials.attack?specialty('⚔️','攻撃効率が高い地域',specials.attack,specials.attackReason)
       :specialty('⚔️','キルを記録した地域',snapshotRegion?.region||null,
          snapshotRegion?(count(snapshotRegion.kills)+' K · '+count(snapshotRegion.killMatches)+'試合の実測。地域間の優劣は未比較'):specials.attackReason))
     +(specials.victory?specialty('🏆','勝ち切り効率が高い地域',specials.victory,specials.victoryReason)
       :specialty('🏆','VRを記録した地域',snapshotRegion?.region||null,
          snapshotRegion?(count(snapshotRegion.vrs)+' VR · '+count(snapshotRegion.vrMatches)+'試合の実測。地域間の優劣は未比較'):specials.victoryReason))
     +'</div>';
   const adapt=eligible.adaptation?'<p class="style-advice">地域適応力の参考情報：<strong>'+count(eligible.adaptation.qualifiedRegions)+'地域に比較可能な記録</strong>があり、そのうち'+count(eligible.adaptation.consistentRegions)+'地域は最良地域スコアの75%以上（'+esc(eligible.adaptation.label)+'）</p>'
     :'<p class="style-advice">🌱 地域ごとの実測記録は確認できるよ。2地域以上で条件がそろったら、得意地域も比較できるようになるよ</p>';
   const regionStats='<div class="style-regions">'+report.regions.map(r=>'<article class="style-region'+(r.region===eligible.region?' is-best':'')+(r.region===specials.attack?' is-attack':'')+(r.region===specials.victory?' is-victory':'')+'" data-style-region="'+esc(r.region)+'"><strong>'+esc(r.region)+(r.region===eligible.region?' 🏅':'')+(r.region===specials.attack?' ⚔️':'')+(r.region===specials.victory?' 🏆':'')+'</strong>'
     +'<small>'+count(r.records)+'戦績 · '+count(r.windows)+'開催枠 · '+count(r.matchTotal)+'試合（試合数確認分）</small>'
     +'<b>'+(mixedTeam?'形式混在のため効率比較なし':'K/試合 '+(r.kpm==null?'—':num(r.kpm,2))+' / VR率 '+pct(r.vrRate))+'</b>'
     +'<small>'+(r.level==='qualified'?'比較候補：5枠・30試合以上':r.level==='provisional'?'暫定：3枠・10試合以上':r.records?'実測参考：'+count(r.matchTotal)+'試合':'掲載記録なし')+'</small></article>').join('')+'</div>';
   const percentiles=report.style.attack==null?''
     :'<div class="style-box"><h3>実測効率の相対位置</h3><div class="style-compare-bars">'+axis('攻撃',report.style.attack)+axis('勝利',report.style.victory)
      +(report.style.breadth!=null?axis('遠征幅',report.style.breadth):'')+'</div><p class="style-note">比較対象'+count(report.style.peers)+'名の中での順位割合。100点満点の実力判定ではないょ</p></div>';
   const trend=report.trend.slice(-12).reverse();
   const trendHtml=mixedTeam?'<div class="style-box"><h3>月別の実測傾向</h3><p class="style-note">チーム形式を選択すると、形式混在のない月別キル効率・VR率を確認できるょ</p></div>':'<div class="style-box"><h3>月別の実測傾向（最大12か月）</h3><div class="style-scroll"><table class="style-trend"><thead><tr><th>開催月</th><th>キル/試合</th><th>VR率</th><th>試合数確認</th></tr></thead><tbody>'
     +(trend.length?trend.map(t=>'<tr><th>'+esc(t.month)+'</th><td>'+(t.kpm==null?'—':num(t.kpm,2))+'</td><td>'+pct(t.vrRate)+'</td><td>'+count(t.matchTotal)+'</td></tr>').join('')
      :'<tr><td colspan="4">対象月の掲載戦績はありません</td></tr>')
     +'</tbody></table></div><p class="style-small">未掲載月は表示しないため、不参加や0キルを意味しません</p></div>';
   const mom=report.momentum||{};
   const delta=(n,kind)=>n==null?'—':(n>0?'+':'')+num(n*(kind==='rate'?100:1),2)+(kind==='rate'?'pt':'');
   const momentumHtml=mixedTeam?'<p class="style-note">📈 最近の効率変化は、チーム形式を選んでから比較できるょ</p>':mom.ready?'<div class="style-momentum"><strong>📈 直近5開催枠 vs 前5開催枠</strong>'
     +'<span>キル/試合 '+delta(mom.deltaKpm)+' · VR率 '+delta(mom.deltaVrRate,'rate')+'</span>'
     +'<small>同条件・各期間15試合以上の実測差。将来の成績予測ではないょ</small></div>'
     :'<p class="style-note">📈 最近の傾向：'+esc(mom.reason||'データ不足')+'</p>';
   const graphs=mixedTeam?'':'<div class="style-extra">'+trendGraph(report.trend,'kpm','月別 キル/試合','#a79dff')
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
     +'<details class="style-fold" id="profile-style-fold">'
     +'<summary class="style-fold-summary"><span class="style-fold-intro"><span class="style-kicker">PLAYER STYLE / REGION PERFORMANCE</span>'
     +'<span class="style-fold-title" id="profile-style-title">🎯 プレイスタイル<span>分析</span></span>'
     +'<span class="style-fold-desc">攻撃・勝利・得意地域の詳しい分析</span></span>'
     +'<span class="style-fold-action" aria-hidden="true"><span class="style-fold-closed">詳細を見る ⌄</span><span class="style-fold-opened">閉じる ⌃</span></span></summary>'
     +'<div class="style-fold-body">'
     +insightHtml+filterMarkup+(f.season==='all'&&report.recommendedSeason?'<div class="style-season-help"><span>🌱 シーズンをそろえると地域別の得意傾向をより正確に比較できるょ</span><button type="button" data-style-season-pick="'+esc(report.recommendedSeason)+'">記録が充実した '+esc(report.recommendedSeason)+' に絞る ↗</button></div>':'')+summary+qualityHtml+axesHtml+scoutHtml+style+affinity+specialtyHtml+observed+adapt
     +regionFacts+'<h3 class="style-region-title">🌍 地域別パフォーマンス</h3>'+regionStats
     +'<p class="style-region-note">少ない記録でも地域別のK/試合・VR率を実測として表示するよ。得意地域と断定する場合だけ、同条件の2地域以上で各3開催枠・15試合と十分な差を要求。大会難易度やPingの違いは補正していないよ</p>'
     +'<div class="style-extra">'+percentiles+radar(report.style)+'</div>'
     +trendHtml+graphs+momentumHtml+evidenceHtml
     +'<p class="style-footnote">出典確認済みの掲載結果と本人確認済み出場アーカイブの重複排除分のみを対象にしているょ。試合数不明はK/試合・VR率に加えず、チームのキルやVRを個人の数字として扱わない。大会未掲載・詳細未確認・同一IDの矛盾は集計しない。<button type="button" data-style-growth-jump class="style-jump">既存の成長グラフを見る ↗</button> ／ <a href="./verification.html">データ検証センター</a></p></div></details></section>';
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
       +'<span class="style-tag'+(report.style.key==='unrated'?' is-low':'')+'">'+esc(report.style.key==='unrated'&&report.observedTendency?.records?'観測：'+report.observedTendency.label+'（参考）':report.style.label)+'</span>'
       +'<p class="style-small">'+esc(report.affinity.reason)+'</p></article>';
   }).join('');
   const formatConfidence=r=>{
     const groups=r.axes?.format?.teams||[];
     if(groups.length!==2)return null;
     const levels=groups.map(x=>x.confidence?.level||'low');
     const level=levels.includes('low')?'low':levels.includes('medium')?'medium':'high';
     return {label:{low:'低',medium:'中',high:'高'}[level],
       note:groups.map(x=>(x.team==='solo'?'ソロ':'デュオ')+' '+(x.confidence?.note||'対象なし')).join(' / ')};
   };
   const fourMetrics=[
     ['🌍 得意地域',r=>r.axes?.regional?.leader? r.axes.regional.leader+' '+num(r.axes.regional.score,1)+'/100':'未判定',r=>r.axes?.regional?.confidence],
     ['🎮 ソロ・デュオ',r=>{
       const teams=r.axes?.format?.teams||[];
       const teamVr=t=>pct(teams.find(x=>x.team===t)?.stats?.vrRate??null);
       return 'ソロ '+teamVr('solo')+' / デュオ '+teamVr('duo');
     },formatConfidence],
     ['🏆 決勝パフォーマンス',r=>r.axes?.finalStrength?.vrRate==null?
       'TOP10 '+count(r.axes?.finalStrength?.top10||0)+'件':
       '決勝VR率 '+pct(r.axes.finalStrength.vrRate)+' / TOP10 '+count(r.axes.finalStrength.top10)+'件',r=>r.axes?.finalStrength?.confidence],
     ['📈 成長傾向',r=>r.axes?.growth?.ready?
       'K/試合 '+num(r.axes.growth.deltaKpm,2)+'差 / VR率 '+num(r.axes.growth.deltaVrPp,1)+'pt差':
       '同条件の記録不足',r=>r.axes?.growth?.confidence]
   ];
   const axesMatrix='<div class="style-evidence-scroll style-four-axis-matrix" tabindex="0" aria-label="4軸の実測比較・信頼度">'
     +'<table class="style-matrix"><thead><tr><th scope="col">比較軸</th>'
     +selected.map(r=>'<th scope="col">'+esc(r.player)+'</th>').join('')
     +'</tr></thead><tbody>'
     +fourMetrics.map(([label,format,grade],i)=>'<tr data-style-compare-axis="'+i+'"><th scope="row">'+esc(label)+'</th>'
       +selected.map(r=>'<td><strong>'+esc(format(r))+'</strong><small>信頼度 '+esc(grade(r)?.label||'低')
       +' · '+esc(grade(r)?.note||'同条件の観測が不足')+'</small></td>').join('')+'</tr>').join('')
     +'</tbody></table><p class="style-note">信頼度はデータ量。地域の100点は本人内の相対値であり、選手同士の実力点数ではありません</p></div>';
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
   return '<section class="compare-style" aria-labelledby="compare-style-title">'
     +'<details class="style-fold" id="compare-style-fold">'
     +'<summary class="style-fold-summary"><span class="style-fold-intro"><span class="style-kicker">PLAYSTYLE COMPARISON</span>'
     +'<span class="style-fold-title" id="compare-style-title">⚔️ プレイスタイル<span>比較</span></span>'
     +'<span class="style-fold-desc">選手ごとの特徴と6地域の実測値を比較</span></span>'
     +'<span class="style-fold-action" aria-hidden="true"><span class="style-fold-closed">詳細を見る ⌄</span><span class="style-fold-opened">閉じる ⌃</span></span></summary>'
     +'<div class="style-fold-body">'
     +'<div class="style-filters"><label>チーム形式<select id="compare-style-team" aria-label="プレイスタイル比較 チーム形式">'+opts+'</select></label></div>'
     +'<div class="style-compare-row">'+cards+'</div>'
     +'<h3 class="style-region-title">📊 4軸の数値・信頼度比較</h3>'+axesMatrix
     +'<h3 class="style-region-title">🌍 同条件の地域別実測比較</h3>'+regionMatrix
     +'<p class="style-footnote">試合数がわからない記録は率に含めません。チーム戦はチームキル・チームVR。得意地域候補は厳密に同じ条件で比較可能な地域が複数ある場合にのみ表示します。</p></div></details></section>';
 }
 return Object.freeze({profile,comparison,radar});
});
