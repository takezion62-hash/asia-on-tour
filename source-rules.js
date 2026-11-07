'use strict';
// Read-only official tournament rule directory under SOURCES.
// Publication logic uses this same JSON through Node on GitHub Actions.
(()=>{
  const root=document.querySelector('#source-rules');
  if(!root)return;
  const $=selector=>root.querySelector(selector);
  const esc=value=>String(value??'').replace(/[&<>"']/g,character=>({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  })[character]);
  const safeUrl=value=>{
    try{
      const url=new URL(value);
      return url.protocol==='https:'&&['www.fortnite.com','fortnite.com'].includes(url.hostname)?url.href:null;
    }catch{return null}
  };
  const regionLabels=['ME','EU','NAC','NAW','OCE','BR'];
  const seriesLabel={ 'victory-cup':'Victory Cup','cash-cup':'Cash Cup','skin-cup':'スキン大会','icon-cup':'Icon Cup','fncs':'FNCS','performance-evaluation':'Performance Evaluation','playstation-cup':'PlayStation Cup','unreal-cup':'Unreal Cup','test-cup':'Test Cup' };
  const modeLabel={solo:'ソロ',duo:'デュオ',trio:'トリオ',squad:'スクワッド'};
  const fmtNumber=value=>Number(value).toLocaleString('ja-JP');
  const state={catalog:[],rules:new Map(),sessions:[],search:'',region:'all',status:'registered',visible:12};
  const regionRows=(map,label)=>{
    if(!map||typeof map!=='object')return '<span class="source-rule-unknown">'+esc(label)+'は未登録</span>';
    const keys=state.region==='all'?regionLabels:[state.region];
    return keys.map(key=>Object.hasOwn(map,key)
      ?'<span class="source-rule-region">'+esc(key)+' <strong>上位'+fmtNumber(map[key])+'</strong></span>'
      :'<span class="source-rule-region is-unknown">'+esc(key)+'：未登録</span>').join('');
  };

  // Ranking thresholds are inclusive: 'Top #5' after '#3' applies to 4th–5th.
  // All amounts in this branch are per player, not full trio totals.
  function cashMarkup(rule){
    const award=rule.cashPrizes;
    const selected=state.region==='all'?regionLabels:[state.region];
    const sections=selected.map(region=>{
      const tiers=award?.tiers?.[region];
      if(!tiers?.length)return '<div class="source-rule-cash-region is-unknown"><strong>'+esc(region)+'</strong><span>賞金表未登録</span></div>';
      let last=0;
      const rows=tiers.map(tier=>{
        const from=last+1;
        const label=from===tier.through?from+'位':from+'〜'+tier.through+'位';
        last=tier.through;
        return '<div class="source-rule-cash-tier"><span>'+esc(label)+'</span><strong>$'+fmtNumber(tier.perPlayer)+'</strong></div>';
      }).join('');
      return '<div class="source-rule-cash-region"><h4>'+esc(region)+'</h4>'+rows+'</div>';
    }).join('');
    const eligible=Object.entries(rule.rankedEligibility||{}).map(([event,rank])=>
      'Event '+esc(event)+': '+esc(rank)+'以上').join(' / ');
    const supported=new Set(Object.keys(award?.tiers||{}));
    const sessions=state.sessions.filter(s=>rule.eventIds.includes(s.eventId)&&
      supported.has(s.region)&&(state.region==='all'||s.region===state.region))
      .sort((a,b)=>a.startUtc.localeCompare(b.startUtc)||a.region.localeCompare(b.region));
    const scheduleHtml=sessions.length?'<details class="source-rule-dates"><summary>開催日程（日本時間・登録済み地域）</summary><div>'+
      sessions.map(s=>'<p><strong>'+esc(s.region)+'</strong> '+esc(s.round)+' · '+esc(s.dateJst)+
      ' '+esc(s.timeJst)+'〜（約3時間）</p>').join('')+'</div></details>':'';
    return '<div class="source-rule-fact"><span>個人賞金（USD・チーム3名それぞれ）</span>'+
      '<div class="source-rule-cash-grid">'+sections+'</div></div>'+
      '<div class="source-rule-fact"><span>参加ランク条件（BRランク）</span><strong>'+esc(eligible)+'</strong></div>'+
      scheduleHtml+
      '<p class="source-rule-warning">※ 公式地域別賞金表と照合済みの全チームは、3名すべてのEpic ID・完了した開催枠・順位・既存戦績を確認できた場合に自動掲載します。賞金圏外は$0として掲載します。本人の受給資格・賞金支払完了は未確認です。</p>';
  }
  // Unreal Cup payouts are TEAM totals. The per-player half is shown separately.
  function unrealMarkup(rule){
    const award=rule.cashPrizes;
    const regions=state.region==='all'?['EU','NAC','NAW','BR','ME','ASIA','OCE']:[state.region];
    const sections=regions.map(region=>{
      const tiers=award?.tiers?.[region];
      if(!tiers?.length)return '<div class="source-rule-cash-region is-unknown"><strong>'+esc(region)+'</strong> 賞金表未登録</div>';
      let previous=0;
      const rows=tiers.map(tier=>{
        const from=previous+1;previous=tier.through;
        const label=from===tier.through?from+'位':from+'〜'+tier.through+'位';
        const each=tier.perTeam/award.teamSize;
        return '<div class="source-rule-cash-tier source-rule-unreal-tier"><span>'+esc(label)+'</span>'+
          '<div><strong>チーム 
    const rule=state.rules.get(entry.id),present=Boolean(rule);
    const ids=rule?.eventIds?.length?rule.eventIds:entry.sourceEventIds||[];
    const url=safeUrl(rule?.source);
    const eventUrl=ids[0]?safeUrl('https://www.fortnite.com/competitive/events/'+encodeURIComponent(ids[0])+'/'):null;
    const conditions=rule?.series==='unreal-cup'?unrealMarkup(rule):rule?.series==='cash-cup'?cashMarkup(rule):
      rule?.cosmeticRanks
      ?'<div class="source-rule-fact"><span>スキン獲得対象順位</span><div class="source-rule-regions">'+regionRows(rule.cosmeticRanks,'スキン獲得ライン')+'</div></div>'
      :'<div class="source-rule-fact"><span>予選突破の地域別条件</span><div class="source-rule-regions">'+regionRows(rule?.advance,'予選通過順位')+'</div></div>';
    const cash=['victory-cup','performance-evaluation'].includes(rule?.series)
      ?'<div class="source-rule-fact"><span>決勝賞金</span><strong>'+(
        Number.isFinite(rule.prizePerVictory)
          ?'決勝1VRにつき'+(rule.series==='performance-evaluation'?'各選手':'')+'$'+fmtNumber(rule.prizePerVictory)+'（規則上）'
          :'VRごとの賞金単価は未登録（0VRは$0で記録可能）'
      )+'</strong></div>':'';
    const evalNote=rule?.series==='performance-evaluation'?
      '<p class="source-rule-warning">※ S43開催枠の通過対象は上位26。公式規則本文の一般表記は33のため、現行イベントの報酬欄・ユーザー確認に基づき26を採用。決勝はVR100ポイントにつき個人$400、チーム$1,200です。支払・資格審査完了までは未確認。</p>':'';
    const matchCaps=Object.entries(rule?.matchCaps||{}).map(([stage,limit])=>esc(stage)+' 最大'+fmtNumber(limit)+'試合').join(' / ');
    const details=present?
      '<div class="source-rule-facts">'+conditions+cash+evalNote+
      '<div class="source-rule-fact"><span>試合数の上限</span><strong>'+esc(matchCaps||'未登録')+'</strong></div></div>'
      :'<p class="source-rule-warning">公式の地域別通過・賞金・スキン獲得条件は未登録です。順位だけから報酬を自動認定しません。</p>';
    return '<article class="source-rule-card" data-rule-id="'+esc(entry.id)+'">'+
      '<div class="source-rule-title"><div><span class="source-rule-season">'+esc(entry.seasonId||'シーズン不明')+
      ' · '+esc(seriesLabel[entry.series]||entry.series||'大会')+'</span>'+
      '<h3>'+esc(entry.name)+'</h3>'+
      '<p>'+esc(modeLabel[entry.team]||entry.team||'形式未確認')+' / '+esc(entry.mode||'モード未確認')+'</p></div>'+
      '<span class="source-rule-state '+(present?'is-ready':'is-pending')+'">'+(present?(rule?.autoApproval==='review-only'?'公式規則登録済み・確認専用':rule?.autoApproval==='verified-team-rank'?'公式規則登録済み・全順位を自動掲載':rule?.autoApproval==='verified-performance-vr'?'予選突破・決勝VRを自動掲載':'公式規則登録済み'):'ルール未登録')+'</span></div>'+
      details+
      '<details class="source-rule-identifiers"><summary>大会ID・適用範囲</summary><div>'+ids.map(id=>'<code>'+esc(id)+'</code>').join('')+
      '<p>公式規則が確認済みでも、本人Epic ID・地域・開催枠・順位表の検証が必要です</p></div></details>'+
      '<div class="source-rule-links">'+
      (url?'<a href="'+esc(url)+'" target="_blank" rel="noopener noreferrer">Epic公式大会ルール ↗</a>':'')+
      (eventUrl?'<a href="'+esc(eventUrl)+'" target="_blank" rel="noopener noreferrer">公式大会ページ ↗</a>':'')+
      '</div></article>';
  }
  function render(){
    const query=state.search.toLocaleLowerCase('ja');
    const matches=state.catalog.filter(entry=>{
      const found=state.rules.has(entry.id);
      if(state.status==='registered'&&!found)return false;
      if(state.status==='pending'&&found)return false;
      if(!query)return true;
      const haystack=[entry.name,entry.id,entry.seasonId,entry.series,...(entry.sourceEventIds||[])].join(' ').toLocaleLowerCase('ja');
      return haystack.includes(query);
    });
    const items=matches.slice(0,state.visible);
    $('#source-rule-results').innerHTML=items.length?items.map(ruleMarkup).join(''):
      '<p class="source-rule-empty">条件に合う大会がないょ。検索や絞り込みを変えてみてね。</p>';
    $('#source-rule-status').textContent='表示 '+fmtNumber(items.length)+' / '+fmtNumber(matches.length)+'大会 · 公式ルール登録済み '+fmtNumber(state.rules.size)+'大会';
    $('#source-rule-more').hidden=items.length>=matches.length;
    $('#source-rule-more').textContent='さらに12大会を見る（残り'+fmtNumber(matches.length-items.length)+'件）';
  }
  for(const [control,key] of [['#source-rule-search','search'],['#source-rule-region','region'],['#source-rule-filter','status']]){
    const element=$(control);
    if(!element)continue;
    element.addEventListener(key==='search'?'input':'change',()=>{
      state[key]=element.value;state.visible=12;render();
    });
  }
  $('#source-rule-more').addEventListener('click',()=>{state.visible+=12;render()});
  async function load(){
    try{
      const responses=await Promise.all(['tournament-rules.json','tournaments.json','schedule.json'].map(file=>fetch('./'+file,{cache:'no-store'})));
      if(responses.some(response=>!response.ok))throw Error('大会ルールデータを読み込めません');
      const [registry,catalog,schedule]=await Promise.all(responses.map(response=>response.json()));
      if(registry?.version!==1||!Array.isArray(registry.rules)||!Array.isArray(catalog.catalog)||!Array.isArray(schedule.sessions))throw Error('大会ルールの形式が不正です');
      state.rules=new Map(registry.rules.map(entry=>[entry.id,entry]));
      state.sessions=schedule.sessions;
      state.catalog=catalog.catalog.slice().sort((a,b)=>{
        const exists=Number(state.rules.has(b.id))-Number(state.rules.has(a.id));
        return exists||Number(b.seasonId?.replace('S','')||0)-Number(a.seasonId?.replace('S','')||0)||a.name.localeCompare(b.name,'ja');
      });
      $('#source-rule-overview').textContent='公式規則登録 '+fmtNumber(state.rules.size)+' / 大会 '+fmtNumber(state.catalog.length);
      render();
    }catch(error){
      $('#source-rule-status').textContent='大会ルールを読み込めませんでした。通信状態を確認して再読み込みしてください。';
      $('#source-rule-results').textContent='';
      $('#source-rule-more').hidden=true;
      root.dataset.state='error';
      console.error('Source rule master load failed',error);
    }
  }
  document.querySelector('#source-rule-jump')?.addEventListener('click',()=>root.scrollIntoView({behavior:'smooth',block:'start'}));
  load();
})();
+fmtNumber(tier.perTeam)+'</strong><small>1人 
    const rule=state.rules.get(entry.id),present=Boolean(rule);
    const ids=rule?.eventIds?.length?rule.eventIds:entry.sourceEventIds||[];
    const url=safeUrl(rule?.source);
    const eventUrl=ids[0]?safeUrl('https://www.fortnite.com/competitive/events/'+encodeURIComponent(ids[0])+'/'):null;
    const conditions=rule?.series==='cash-cup'?cashMarkup(rule):
      rule?.cosmeticRanks
      ?'<div class="source-rule-fact"><span>スキン獲得対象順位</span><div class="source-rule-regions">'+regionRows(rule.cosmeticRanks,'スキン獲得ライン')+'</div></div>'
      :'<div class="source-rule-fact"><span>予選突破の地域別条件</span><div class="source-rule-regions">'+regionRows(rule?.advance,'予選通過順位')+'</div></div>';
    const cash=['victory-cup','performance-evaluation'].includes(rule?.series)
      ?'<div class="source-rule-fact"><span>決勝賞金</span><strong>'+(
        Number.isFinite(rule.prizePerVictory)
          ?'決勝1VRにつき'+(rule.series==='performance-evaluation'?'各選手':'')+'$'+fmtNumber(rule.prizePerVictory)+'（規則上）'
          :'VRごとの賞金単価は未登録（0VRは$0で記録可能）'
      )+'</strong></div>':'';
    const evalNote=rule?.series==='performance-evaluation'?
      '<p class="source-rule-warning">※ S43開催枠の通過対象は上位26。公式規則本文の一般表記は33のため、現行イベントの報酬欄・ユーザー確認に基づき26を採用。決勝はVR100ポイントにつき個人$400、チーム$1,200です。支払・資格審査完了までは未確認。</p>':'';
    const matchCaps=Object.entries(rule?.matchCaps||{}).map(([stage,limit])=>esc(stage)+' 最大'+fmtNumber(limit)+'試合').join(' / ');
    const details=present?
      '<div class="source-rule-facts">'+conditions+cash+evalNote+
      '<div class="source-rule-fact"><span>試合数の上限</span><strong>'+esc(matchCaps||'未登録')+'</strong></div></div>'
      :'<p class="source-rule-warning">公式の地域別通過・賞金・スキン獲得条件は未登録です。順位だけから報酬を自動認定しません。</p>';
    return '<article class="source-rule-card" data-rule-id="'+esc(entry.id)+'">'+
      '<div class="source-rule-title"><div><span class="source-rule-season">'+esc(entry.seasonId||'シーズン不明')+
      ' · '+esc(seriesLabel[entry.series]||entry.series||'大会')+'</span>'+
      '<h3>'+esc(entry.name)+'</h3>'+
      '<p>'+esc(modeLabel[entry.team]||entry.team||'形式未確認')+' / '+esc(entry.mode||'モード未確認')+'</p></div>'+
      '<span class="source-rule-state '+(present?'is-ready':'is-pending')+'">'+(present?(rule?.autoApproval==='review-only'?'公式規則登録済み・確認専用':rule?.autoApproval==='verified-team-rank'?'公式規則登録済み・全順位を自動掲載':rule?.autoApproval==='verified-performance-vr'?'予選突破・決勝VRを自動掲載':'公式規則登録済み'):'ルール未登録')+'</span></div>'+
      details+
      '<details class="source-rule-identifiers"><summary>大会ID・適用範囲</summary><div>'+ids.map(id=>'<code>'+esc(id)+'</code>').join('')+
      '<p>公式規則が確認済みでも、本人Epic ID・地域・開催枠・順位表の検証が必要です</p></div></details>'+
      '<div class="source-rule-links">'+
      (url?'<a href="'+esc(url)+'" target="_blank" rel="noopener noreferrer">Epic公式大会ルール ↗</a>':'')+
      (eventUrl?'<a href="'+esc(eventUrl)+'" target="_blank" rel="noopener noreferrer">公式大会ページ ↗</a>':'')+
      '</div></article>';
  }
  function render(){
    const query=state.search.toLocaleLowerCase('ja');
    const matches=state.catalog.filter(entry=>{
      const found=state.rules.has(entry.id);
      if(state.status==='registered'&&!found)return false;
      if(state.status==='pending'&&found)return false;
      if(!query)return true;
      const haystack=[entry.name,entry.id,entry.seasonId,entry.series,...(entry.sourceEventIds||[])].join(' ').toLocaleLowerCase('ja');
      return haystack.includes(query);
    });
    const items=matches.slice(0,state.visible);
    $('#source-rule-results').innerHTML=items.length?items.map(ruleMarkup).join(''):
      '<p class="source-rule-empty">条件に合う大会がないょ。検索や絞り込みを変えてみてね。</p>';
    $('#source-rule-status').textContent='表示 '+fmtNumber(items.length)+' / '+fmtNumber(matches.length)+'大会 · 公式ルール登録済み '+fmtNumber(state.rules.size)+'大会';
    $('#source-rule-more').hidden=items.length>=matches.length;
    $('#source-rule-more').textContent='さらに12大会を見る（残り'+fmtNumber(matches.length-items.length)+'件）';
  }
  for(const [control,key] of [['#source-rule-search','search'],['#source-rule-region','region'],['#source-rule-filter','status']]){
    const element=$(control);
    if(!element)continue;
    element.addEventListener(key==='search'?'input':'change',()=>{
      state[key]=element.value;state.visible=12;render();
    });
  }
  $('#source-rule-more').addEventListener('click',()=>{state.visible+=12;render()});
  async function load(){
    try{
      const responses=await Promise.all(['tournament-rules.json','tournaments.json','schedule.json'].map(file=>fetch('./'+file,{cache:'no-store'})));
      if(responses.some(response=>!response.ok))throw Error('大会ルールデータを読み込めません');
      const [registry,catalog,schedule]=await Promise.all(responses.map(response=>response.json()));
      if(registry?.version!==1||!Array.isArray(registry.rules)||!Array.isArray(catalog.catalog)||!Array.isArray(schedule.sessions))throw Error('大会ルールの形式が不正です');
      state.rules=new Map(registry.rules.map(entry=>[entry.id,entry]));
      state.sessions=schedule.sessions;
      state.catalog=catalog.catalog.slice().sort((a,b)=>{
        const exists=Number(state.rules.has(b.id))-Number(state.rules.has(a.id));
        return exists||Number(b.seasonId?.replace('S','')||0)-Number(a.seasonId?.replace('S','')||0)||a.name.localeCompare(b.name,'ja');
      });
      $('#source-rule-overview').textContent='公式規則登録 '+fmtNumber(state.rules.size)+' / 大会 '+fmtNumber(state.catalog.length);
      render();
    }catch(error){
      $('#source-rule-status').textContent='大会ルールを読み込めませんでした。通信状態を確認して再読み込みしてください。';
      $('#source-rule-results').textContent='';
      $('#source-rule-more').hidden=true;
      root.dataset.state='error';
      console.error('Source rule master load failed',error);
    }
  }
  document.querySelector('#source-rule-jump')?.addEventListener('click',()=>root.scrollIntoView({behavior:'smooth',block:'start'}));
  load();
})();
+fmtNumber(each)+'</small></div></div>';
      }).join('');
      return '<div class="source-rule-cash-region"><h4>'+esc(region)+' · 上位'+fmtNumber(tiers.at(-1).through)+'組</h4>'+rows+'</div>';
    }).join('');
    const scores=(rule.scoring?.placementPoints||[]).map((points,index)=>
      '<div><span>'+fmtNumber(index+1)+'位</span><strong>'+fmtNumber(points)+'pt</strong></div>').join('');
    return '<div class="source-rule-fact"><span>地域別賞金表（USD・チーム合計 / 個人）</span>'+
      '<div class="source-rule-cash-grid source-rule-unreal-grid">'+sections+'</div></div>'+
      '<div class="source-rule-fact"><span>参加条件</span><strong>デュオ / 通常BRランク・アンリアル / 13歳以上 / 2段階認証 / Epicアカウントレベル350以上</strong></div>'+
      '<div class="source-rule-fact"><span>開催形式</span><strong>地域別1セッション約'+fmtNumber(rule.sessionMinutes)+
      '分 / 最大'+fmtNumber(rule.matchCaps['単一ラウンド'])+'試合 / 予選なし / クロスプラットフォーム</strong></div>'+
      '<div class="source-rule-fact"><span>開催日</span><strong>'+(rule.sessionDates||[]).map(esc).join('・')+
      '（地域別の時刻・最終日程はゲーム内表示を優先）</strong></div>'+
      '<div class="source-rule-fact"><span>ポイント</span><strong>1位65pt / 2位56pt / 3位52pt / 25位2pt · 1キル'+
      fmtNumber(rule.scoring.eliminationPoints)+'pt</strong>'+
      '<details class="source-rule-dates"><summary>1〜25位の順位ポイントをすべて見る</summary>'+
      '<div class="source-rule-score-grid">'+scores+'</div></details>'+
      '<strong>同点時：総ポイント → VR数 → 平均キル → 平均順位 → 生存時間</strong></div>'+
      '<p class="source-rule-warning">※ Attachment Cの賞金はチーム合計。2人の個人配分は半額ずつ表示。'+
      '賞金圏外は$0。Epic ID・地域・開催回・順位表・既存記録の確認前に現金を自動認定しません。'+
      '本人の受給資格・支払い完了は別途確認が必要です。</p>';
  }
  function ruleMarkup(entry){
    const rule=state.rules.get(entry.id),present=Boolean(rule);
    const ids=rule?.eventIds?.length?rule.eventIds:entry.sourceEventIds||[];
    const url=safeUrl(rule?.source);
    const eventUrl=ids[0]?safeUrl('https://www.fortnite.com/competitive/events/'+encodeURIComponent(ids[0])+'/'):null;
    const conditions=rule?.series==='cash-cup'?cashMarkup(rule):
      rule?.cosmeticRanks
      ?'<div class="source-rule-fact"><span>スキン獲得対象順位</span><div class="source-rule-regions">'+regionRows(rule.cosmeticRanks,'スキン獲得ライン')+'</div></div>'
      :'<div class="source-rule-fact"><span>予選突破の地域別条件</span><div class="source-rule-regions">'+regionRows(rule?.advance,'予選通過順位')+'</div></div>';
    const cash=['victory-cup','performance-evaluation'].includes(rule?.series)
      ?'<div class="source-rule-fact"><span>決勝賞金</span><strong>'+(
        Number.isFinite(rule.prizePerVictory)
          ?'決勝1VRにつき'+(rule.series==='performance-evaluation'?'各選手':'')+'$'+fmtNumber(rule.prizePerVictory)+'（規則上）'
          :'VRごとの賞金単価は未登録（0VRは$0で記録可能）'
      )+'</strong></div>':'';
    const evalNote=rule?.series==='performance-evaluation'?
      '<p class="source-rule-warning">※ S43開催枠の通過対象は上位26。公式規則本文の一般表記は33のため、現行イベントの報酬欄・ユーザー確認に基づき26を採用。決勝はVR100ポイントにつき個人$400、チーム$1,200です。支払・資格審査完了までは未確認。</p>':'';
    const matchCaps=Object.entries(rule?.matchCaps||{}).map(([stage,limit])=>esc(stage)+' 最大'+fmtNumber(limit)+'試合').join(' / ');
    const details=present?
      '<div class="source-rule-facts">'+conditions+cash+evalNote+
      '<div class="source-rule-fact"><span>試合数の上限</span><strong>'+esc(matchCaps||'未登録')+'</strong></div></div>'
      :'<p class="source-rule-warning">公式の地域別通過・賞金・スキン獲得条件は未登録です。順位だけから報酬を自動認定しません。</p>';
    return '<article class="source-rule-card" data-rule-id="'+esc(entry.id)+'">'+
      '<div class="source-rule-title"><div><span class="source-rule-season">'+esc(entry.seasonId||'シーズン不明')+
      ' · '+esc(seriesLabel[entry.series]||entry.series||'大会')+'</span>'+
      '<h3>'+esc(entry.name)+'</h3>'+
      '<p>'+esc(modeLabel[entry.team]||entry.team||'形式未確認')+' / '+esc(entry.mode||'モード未確認')+'</p></div>'+
      '<span class="source-rule-state '+(present?'is-ready':'is-pending')+'">'+(present?(rule?.autoApproval==='review-only'?'公式規則登録済み・確認専用':rule?.autoApproval==='verified-team-rank'?'公式規則登録済み・全順位を自動掲載':rule?.autoApproval==='verified-performance-vr'?'予選突破・決勝VRを自動掲載':'公式規則登録済み'):'ルール未登録')+'</span></div>'+
      details+
      '<details class="source-rule-identifiers"><summary>大会ID・適用範囲</summary><div>'+ids.map(id=>'<code>'+esc(id)+'</code>').join('')+
      '<p>公式規則が確認済みでも、本人Epic ID・地域・開催枠・順位表の検証が必要です</p></div></details>'+
      '<div class="source-rule-links">'+
      (url?'<a href="'+esc(url)+'" target="_blank" rel="noopener noreferrer">Epic公式大会ルール ↗</a>':'')+
      (eventUrl?'<a href="'+esc(eventUrl)+'" target="_blank" rel="noopener noreferrer">公式大会ページ ↗</a>':'')+
      '</div></article>';
  }
  function render(){
    const query=state.search.toLocaleLowerCase('ja');
    const matches=state.catalog.filter(entry=>{
      const found=state.rules.has(entry.id);
      if(state.status==='registered'&&!found)return false;
      if(state.status==='pending'&&found)return false;
      if(!query)return true;
      const haystack=[entry.name,entry.id,entry.seasonId,entry.series,...(entry.sourceEventIds||[])].join(' ').toLocaleLowerCase('ja');
      return haystack.includes(query);
    });
    const items=matches.slice(0,state.visible);
    $('#source-rule-results').innerHTML=items.length?items.map(ruleMarkup).join(''):
      '<p class="source-rule-empty">条件に合う大会がないょ。検索や絞り込みを変えてみてね。</p>';
    $('#source-rule-status').textContent='表示 '+fmtNumber(items.length)+' / '+fmtNumber(matches.length)+'大会 · 公式ルール登録済み '+fmtNumber(state.rules.size)+'大会';
    $('#source-rule-more').hidden=items.length>=matches.length;
    $('#source-rule-more').textContent='さらに12大会を見る（残り'+fmtNumber(matches.length-items.length)+'件）';
  }
  for(const [control,key] of [['#source-rule-search','search'],['#source-rule-region','region'],['#source-rule-filter','status']]){
    const element=$(control);
    if(!element)continue;
    element.addEventListener(key==='search'?'input':'change',()=>{
      state[key]=element.value;state.visible=12;render();
    });
  }
  $('#source-rule-more').addEventListener('click',()=>{state.visible+=12;render()});
  async function load(){
    try{
      const responses=await Promise.all(['tournament-rules.json','tournaments.json','schedule.json'].map(file=>fetch('./'+file,{cache:'no-store'})));
      if(responses.some(response=>!response.ok))throw Error('大会ルールデータを読み込めません');
      const [registry,catalog,schedule]=await Promise.all(responses.map(response=>response.json()));
      if(registry?.version!==1||!Array.isArray(registry.rules)||!Array.isArray(catalog.catalog)||!Array.isArray(schedule.sessions))throw Error('大会ルールの形式が不正です');
      state.rules=new Map(registry.rules.map(entry=>[entry.id,entry]));
      state.sessions=schedule.sessions;
      state.catalog=catalog.catalog.slice().sort((a,b)=>{
        const exists=Number(state.rules.has(b.id))-Number(state.rules.has(a.id));
        return exists||Number(b.seasonId?.replace('S','')||0)-Number(a.seasonId?.replace('S','')||0)||a.name.localeCompare(b.name,'ja');
      });
      $('#source-rule-overview').textContent='公式規則登録 '+fmtNumber(state.rules.size)+' / 大会 '+fmtNumber(state.catalog.length);
      render();
    }catch(error){
      $('#source-rule-status').textContent='大会ルールを読み込めませんでした。通信状態を確認して再読み込みしてください。';
      $('#source-rule-results').textContent='';
      $('#source-rule-more').hidden=true;
      root.dataset.state='error';
      console.error('Source rule master load failed',error);
    }
  }
  document.querySelector('#source-rule-jump')?.addEventListener('click',()=>root.scrollIntoView({behavior:'smooth',block:'start'}));
  load();
})();
