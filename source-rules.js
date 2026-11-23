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
  const regionLabels=['ME','EU','NAC','NAW','OCE','BR','ASIA'];
  const seriesLabel={ 'victory-cup':'Victory Cup','cash-cup':'Cash Cup','skin-cup':'スキン大会','icon-cup':'Icon Cup','fncs':'FNCS','performance-evaluation':'Performance Evaluation','playstation-cup':'PlayStation Cup','unreal-cup':'Unreal Cup','nvidia-cup':'NVIDIA Cup','test-cup':'Test Cup' };
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
    // Round 1 qualification and Round 2 cash have independent validators.
    // Only show Round 2 payouts when the exact rule table is registered.
    if(rule.autoApproval==='verified-duo-qualifier-only'){
      const finalVerified=rule.cashFinalAutoApproval==='verified-duo-round2-rank'&&
        rule.cashPrizes?.basis==='per-player'&&rule.cashPrizes.currency==='USD'&&
        rule.matchCaps?.['賞金決勝']===6;
      const finalRegions=state.region==='all'?regionLabels:[state.region];
      const finalSections=finalVerified?finalRegions.map(region=>{
        const tiers=rule.cashPrizes.tiers?.[region];
        if(!tiers?.length)return '<div class="source-rule-cash-region is-unknown"><strong>'+esc(region)+'</strong><span>決勝賞金表未登録</span></div>';
        let last=0;
        const rows=tiers.map(tier=>{
          const first=last+1;
          const rank=first===tier.through?fmtNumber(first)+'位':fmtNumber(first)+'〜'+fmtNumber(tier.through)+'位';
          last=tier.through;
          return '<div class="source-rule-cash-tier"><span>'+esc(rank)+'</span><strong>$'+fmtNumber(tier.perPlayer)+'</strong></div>';
        }).join('');
        return '<div class="source-rule-cash-region"><h4>'+esc(region)+'</h4>'+rows+'</div>';
      }).join(''):'';
      const finalMarkup=finalVerified
        ?'<div class="source-rule-fact"><span>Round 2 決勝の個人賞金（USD・デュオ各選手）</span>'+
          '<div class="source-rule-cash-grid">'+finalSections+'</div></div>'+
          '<div class="source-rule-fact"><span>Round 2 決勝</span><strong>最大'+
            fmtNumber(rule.matchCaps['賞金決勝'])+'試合 · デュオのチーム賞金は表示額の2倍 · 賞金圏外は$0</strong></div>'
        :'';
      const note=finalVerified
        ?'Round 2は完了した公式順位表・開催日時・2人のEpic ID・地域別賞金表が一致した場合だけ賞金を自動掲載します。賞金圏外は$0。受給資格や支払い完了は未確認です。'
        :'Round 2の現金賞金額はこの規則から推定しません。';
      return '<div class="source-rule-fact"><span>Round 1 の決勝進出条件</span>'+
        '<div class="source-rule-regions">'+regionRows(rule.advance,'予選突破順位')+'</div></div>'+
        '<div class="source-rule-fact"><span>Round 1 出場記録</span><strong>最大'+
        fmtNumber(rule.matchCaps['単一ラウンド'])+'試合 · 予選現金賞金 $0</strong></div>'+
        finalMarkup+
        '<p class="source-rule-warning">※ Epic公式ルールの地域別通過ラインに基づき、本人Epic ID・保存済み順位表・開催日時を照合したRound 1成績を自動掲載します。通過圏外は「予選」として掲載し、決勝進出とは区別します。'+note+'</p>';
    }
    const award=rule.cashPrizes;
    const selected=state.region==='all'?regionLabels:[state.region];
    const sections=selected.map(region=>{
      const tiers=award?.tiers?.[region];
      if(!tiers?.length)return '<div class="source-rule-cash-region is-unknown"><strong>'+esc(region)+'</strong><span>賞金表未登録</span></div>';
      let last=0;
      const rows=tiers.map(tier=>{
        const from=last+1;
        const label=from===tier.through?fmtNumber(from)+'位':fmtNumber(from)+'〜'+fmtNumber(tier.through)+'位';
        last=tier.through;
        return '<div class="source-rule-cash-tier"><span>'+esc(label)+'</span><strong>$'+fmtNumber(tier.perPlayer)+'</strong></div>';
      }).join('');
      return '<div class="source-rule-cash-region"><h4>'+esc(region)+'</h4>'+rows+'</div>';
    }).join('');
    const arenas=rule.team==='solo'&&rule.rankedEligibility?.mode==='arenas-boxfights';
    const eligible=arenas
      ?'Arenas Ranked '+esc(rule.rankedEligibility.minimumRank)+'以上（現行または前シーズン）'
      :Object.entries(rule.rankedEligibility||{}).map(([event,rank])=>
        'Event '+esc(event)+': '+esc(rank)+'以上').join(' / ');
    const supported=new Set(Object.keys(award?.tiers||{}));
    const sessions=state.sessions.filter(s=>rule.eventIds.includes(s.eventId)&&
      supported.has(s.region)&&(state.region==='all'||s.region===state.region))
      .sort((a,b)=>a.startUtc.localeCompare(b.startUtc)||a.region.localeCompare(b.region));
    const scheduleHtml=sessions.length?'<details class="source-rule-dates"><summary>開催日程（日本時間・登録済み地域）</summary><div>'+
      sessions.map(s=>'<p><strong>'+esc(s.region)+'</strong> '+esc(s.round)+' · '+esc(s.dateJst)+
      ' '+esc(s.timeJst)+'〜（約'+fmtNumber(rule.sessionMinutes||180)+'分）</p>').join('')+'</div></details>':'';
    const members=rule.team==='solo'?1:rule.team==='duo'?2:rule.team==='trio'?3:4;
    const format=arenas?'Arenas Boxfights・ソロ':'通常BR・'+(members===3?'トリオ':'チーム');
    return '<div class="source-rule-fact"><span>個人賞金（USD・'+(arenas?'ソロ':'チーム'+members+'名それぞれ')+'）</span>'+
      '<div class="source-rule-cash-grid">'+sections+'</div></div>'+
      '<div class="source-rule-fact"><span>開催形式</span><strong>'+esc(format)+' / 最大'+fmtNumber(rule.matchCaps?.['単一ラウンド'])+'試合</strong></div>'+
      '<div class="source-rule-fact"><span>参加ランク条件（'+(arenas?'Arenas':'BR')+'ランク）</span><strong>'+eligible+'</strong></div>'+
      scheduleHtml+
      '<p class="source-rule-warning">※ 公式地域別賞金表・本人Epic ID'+members+'名分・完了した開催枠・順位・既存戦績を照合した成績のみ自動掲載します。賞金圏外は$0として掲載します。本人の受給資格・賞金支払完了は未確認です。</p>';
  }
  function playstationMarkup(rule){
    const regions=state.region==='all'?regionLabels:[state.region];
    const sections=regions.map(region=>{
      const tiers=rule.cashPrizes?.tiers?.[region];
      if(!tiers?.length)return '<div class="source-rule-cash-region is-unknown"><strong>'+esc(region)+'</strong> 決勝賞金表未登録</div>';
      let last=0;
      const rows=tiers.map(tier=>{
        const from=last+1;last=tier.through;
        const label=from===tier.through?fmtNumber(from)+'位':fmtNumber(from)+'〜'+fmtNumber(tier.through)+'位';
        return '<div class="source-rule-cash-tier"><span>'+esc(label)+'</span><strong>1人 
  function unrealMarkup(rule){
    const award=rule.cashPrizes;
    const regions=state.region==='all'?['EU','NAC','NAW','BR','ME','ASIA','OCE']:[state.region];
    const sections=regions.map(region=>{
      const tiers=award?.tiers?.[region];
      if(!tiers?.length)return '<div class="source-rule-cash-region is-unknown"><strong>'+esc(region)+'</strong> 賞金表未登録</div>';
      let previous=0;
      const rows=tiers.map(tier=>{
        const from=previous+1;previous=tier.through;
        const label=from===tier.through?fmtNumber(from)+'位':fmtNumber(from)+'〜'+fmtNumber(tier.through)+'位';
        const each=tier.perTeam/award.teamSize;
        return '<div class="source-rule-cash-tier source-rule-unreal-tier"><span>'+esc(label)+'</span>'+
          '<div><strong>チーム $'+fmtNumber(tier.perTeam)+'</strong><small>1人 $'+fmtNumber(each)+'</small></div></div>';
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
      '賞金圏外は$0。全順位の取得完了・Epic ID・地域・開催回・既存記録が一致した場合に自動掲載し、未確認の候補は保留します。'+
      '本人の受給資格・支払い完了は別途確認が必要です。</p>';
  }

  function nvidiaMarkup(rule){
    const regions=state.region==='all'?['OCE','ASIA','ME','EU','BR','NAC','NAW']:[state.region];
    const sections=regions.map(region=>{
      const tiers=rule.cashPrizes?.tiers?.[region];
      if(!tiers?.length)return '<div class="source-rule-cash-region is-unknown"><strong>'+esc(region)+'</strong> 賞金表未登録</div>';
      let previous=0;
      const rows=tiers.map(tier=>{
        const from=previous+1;previous=tier.through;
        const label=from===tier.through?fmtNumber(from)+'位':fmtNumber(from)+'〜'+fmtNumber(tier.through)+'位';
        return '<div class="source-rule-cash-tier source-rule-unreal-tier"><span>'+esc(label)+'</span>'+
          '<div><strong>1人 $'+fmtNumber(tier.perPlayer)+'</strong></div></div>';
      }).join('');
      return '<div class="source-rule-cash-region"><h4>'+esc(region)+' · 上位'+fmtNumber(tiers.at(-1).through)+'名</h4>'+rows+'</div>';
    }).join('');
    const hardware=regions.map(region=>{
      const cutoff=rule.hardwarePrizes?.rankCutoffs?.[region];
      return '<div class="source-rule-cash-tier"><span>'+esc(region)+'</span><strong>'+fmtNumber(cutoff)+'位以内</strong></div>';
    }).join('');
    return '<div class="source-rule-fact"><span>地域別賞金表（USD・選手1人あたり）</span>'+
      '<div class="source-rule-cash-grid source-rule-unreal-grid">'+sections+'</div></div>'+
      '<div class="source-rule-fact"><span>RTX 5080 現物賞品</span>'+
      '<div class="source-rule-cash-grid source-rule-unreal-grid">'+hardware+'</div></div>'+
      '<div class="source-rule-fact"><span>コスメ報酬</span><strong>'+esc(rule.cosmeticPrizes.item)+
      ' · 8ポイント以上（受領状況は別途確認）</strong></div>'+
      '<div class="source-rule-fact"><span>参加条件</span><strong>ソロ / BR・ゼロビルド・Reloadのいずれかのランクでゴールド以上 / 13歳以上'+
      ' / Epicレベル350以上 / 2段階認証 / 過去180日間に異なる公式大会14回以上参加</strong></div>'+
      '<div class="source-rule-fact"><span>開催形式</span><strong>クロスプラットフォーム・単一ラウンド / 約'+
      fmtNumber(rule.sessionMinutes)+'分 / 最大'+fmtNumber(rule.matchCaps['単一ラウンド'])+'試合</strong></div>'+
      '<div class="source-rule-fact"><span>開催日</span><strong>公式規則：'+
      (rule.sessionDates||[]).map(esc).join('・')+'（地域ごとの現地日付。NAWは日本時間2025-12-22）</strong></div>'+
      '<div class="source-rule-fact"><span>ポイント・同点時</span><strong>順位/撃破の配点はゲーム内表示が公式。'+
      '同点時は総ポイント → VR数 → 平均キル → 平均順位 → 合計生存時間</strong></div>'+
      '<p class="source-rule-warning">※ 現金は各選手の規定額を記録し、圏外は$0。RTX 5080とRust Bucketは現金賞金に換算しません。'+
      '全順位表・本人Epic ID・開催地域・開催回・順位の完全照合が取れた場合のみ自動承認します。'+
      '賞金・賞品の実際の受給資格と支払・配布は別途審査が必要です。</p>';
  }
  function ruleMarkup(entry){
    const rule=state.rules.get(entry.id),present=Boolean(rule);
    const ids=rule?.eventIds?.length?rule.eventIds:entry.sourceEventIds||[];
    const url=safeUrl(rule?.source);
    const eventUrl=ids[0]?safeUrl('https://www.fortnite.com/competitive/events/'+encodeURIComponent(ids[0])+'/'):null;
    // Catalog evidence is a research lead, never an auto-approval rule.
    // Link only directly to Epic rule documents, never to untrusted hosts.
    const researchLinks=present?[]:[...new Set((entry.evidence||[]).map(e=>safeUrl(e.url))
      .filter(Boolean).filter(u=>{
        const pathname=new URL(u).pathname;
        return pathname.startsWith('/competitive/rules-guidelines/rules-library/')||
          pathname.startsWith('/news/');
      }))].slice(0,3);
    const conditions=rule?.series==='playstation-cup'?playstationMarkup(rule):rule?.series==='nvidia-cup'?nvidiaMarkup(rule):rule?.series==='unreal-cup'?unrealMarkup(rule):rule?.series==='cash-cup'?cashMarkup(rule):
      rule?.cosmeticRanks
      ?'<div class="source-rule-fact"><span>スキン獲得対象順位</span><div class="source-rule-regions">'+regionRows(rule.cosmeticRanks,'スキン獲得ライン')+'</div></div>'
      :'<div class="source-rule-fact"><span>予選突破の地域別条件</span><div class="source-rule-regions">'+regionRows(rule?.advance,'予選通過順位')+'</div></div>';
    const cash=['victory-cup','performance-evaluation'].includes(rule?.series)
      ?'<div class="source-rule-fact"><span>決勝賞金</span><strong>'+(
        Number.isFinite(rule.prizePerVictory)
          ?(['squad','duo'].includes(rule.team)&&Number.isFinite(rule.teamPrizePerVictory)
            ?'決勝1VRにつき各選手$'+fmtNumber(rule.prizePerVictory)+'（チーム合計$'+fmtNumber(rule.teamPrizePerVictory)+'）'
            :'決勝1VRにつき'+(rule.series==='performance-evaluation'?'各選手':'')+'$'+fmtNumber(rule.prizePerVictory)+'（規則上）')
          :'VRごとの賞金単価は未登録（0VRは$0で記録可能）'
      )+'</strong></div>':'';
    const evalNote=rule?.series==='performance-evaluation'?
      '<p class="source-rule-warning">※ S43開催枠の通過対象は上位26。公式規則本文の一般表記は33のため、現行イベントの報酬欄・ユーザー確認に基づき26を採用。決勝はVR100ポイントにつき個人$400、チーム$1,200です。支払・資格審査完了までは未確認。</p>':'';
    const squadsNote=rule?.id==='ch7s5-squads-victory-cup'?
      '<p class="source-rule-warning">※ Round 1は地域別通過枠で判定し賞金$0。Round 2はビクロイのみ1VR=100ptで、最大3VR。各選手$50/VR、4名チーム合計$200/VR（3VRなら個人$150・チーム$600）。予選・決勝とも本人IDと順位表を検証し、未確認の賞金は掲載しません。</p>':'';
    const cosmeticDetail=rule?.cosmeticPrizes?.rankRewards?.length?
      '<div class="source-rule-fact"><span>上位入賞のゲーム内報酬</span><strong>'+
      rule.cosmeticPrizes.rankRewards.map(esc).join(' / ')+'</strong></div>'+
      '<div class="source-rule-fact"><span>参加ポイント報酬</span><strong>'+
      fmtNumber(rule.cosmeticPrizes.minimumPoints)+'ptで'+esc(rule.cosmeticPrizes.spray)+'</strong></div>'+
      '<div class="source-rule-fact"><span>開催部門</span><strong>'+
      esc(rule.team==='solo'?'Mobile / タッチ操作限定・Reload Zero Build / ソロ':entry.mode==='zero-build'?'Zero Build / デュオ':'Battle Royale / デュオ')+
      (Number.isSafeInteger(rule.sessionMinutes)?' / 約'+fmtNumber(rule.sessionMinutes)+'分':'')+'</strong></div>'+
      '<p class="source-rule-warning">※ 3つのWidowmaker部門は各々別の大会ID・形式・報酬圏。現金賞金は$0。衣装等の実際の配布・受給資格は別途確認が必要です。本人Epic IDと保存済み順位表を照合した場合に限り順位報酬として掲載します。スプレーは順位賞とは別の獲得条件です。</p>':'';
    const matchCaps=Object.entries(rule?.matchCaps||{}).map(([stage,limit])=>esc(stage)+' 最大'+fmtNumber(limit)+'試合').join(' / ');
    const details=present?
      '<div class="source-rule-facts">'+conditions+cash+evalNote+squadsNote+cosmeticDetail+
      '<div class="source-rule-fact"><span>試合数の上限</span><strong>'+esc(matchCaps||'未登録')+'</strong></div></div>'
      :'<div class="source-rule-facts"><div class="source-rule-fact"><span>現在の調査状況</span>'+
        '<strong>'+(researchLinks.length?'Epic公式資料の参照先あり · 条件の登録待ち':'公式条件の調査待ち')+'</strong></div>'+
        '<p class="source-rule-warning">大会の名称・形式は大会カタログに登録済みですが、地域別通過・賞金・スキン獲得条件はルールマスター未登録です。'+
        '公式資料へのリンクがあっても自動承認は有効化されません。順位だけから報酬を認定しません。</p></div>';
    return '<article class="source-rule-card" data-rule-id="'+esc(entry.id)+'">'+
      '<div class="source-rule-title"><div><span class="source-rule-season">'+esc(entry.seasonId||'シーズン不明')+
      ' · '+esc(seriesLabel[entry.series]||entry.series||'大会')+'</span>'+
      '<h3>'+esc(entry.name)+'</h3>'+
      '<p>'+esc(modeLabel[entry.team]||entry.team||'形式未確認')+' / '+esc(entry.mode||'モード未確認')+'</p></div>'+
      '<span class="source-rule-state '+(present?'is-ready':'is-pending')+'">'+(present?(rule?.autoApproval==='verified-solo-rank'?'公式賞金表・本人ID照合で自動掲載':rule?.autoApproval==='review-only'?'公式規則登録済み・確認専用':rule?.autoApproval==='verified-team-rank'?(rule.series==='unreal-cup'?'公式賞金表で自動掲載・圏外$0':'公式規則登録済み・全順位を自動掲載'):rule?.autoApproval==='verified-performance-vr'?'予選突破・決勝VRを自動掲載':rule?.cashFinalAutoApproval==='verified-duo-round2-rank'?'予選突破・決勝賞金を自動掲載':rule?.autoApproval==='verified-duo-qualifier-only'?'予選突破・参加$0を自動掲載':'公式規則登録済み'):'ルール未登録')+'</span></div>'+
      details+
      '<details class="source-rule-identifiers"><summary>大会ID・適用範囲</summary><div>'+ids.map(id=>'<code>'+esc(id)+'</code>').join('')+
      '<p>公式規則が確認済みでも、本人Epic ID・地域・開催枠・順位表の検証が必要です</p></div></details>'+
      '<div class="source-rule-links">'+
      (url?'<a href="'+esc(url)+'" target="_blank" rel="noopener noreferrer">Epic公式大会ルール ↗</a>':'')+
      researchLinks.map((link,index)=>'<a href="'+esc(link)+'" target="_blank" rel="noopener noreferrer">公式ルール資料 '+(index+1)+' ↗</a>').join('')+
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
+fmtNumber(tier.perPlayer)+'</strong></div>';
      }).join('');
      return '<div class="source-rule-cash-region"><h4>'+esc(region)+' · 上位'+fmtNumber(last)+'名</h4>'+rows+'</div>';
    }).join('');
    const mode=rule.mode==='zero-build'?'Zero Build':'Battle Royale';
    return '<div class="source-rule-fact"><span>対象大会</span><strong>PlayStation Cup '+esc(mode)+' / ソロ / PS4・PS5限定</strong></div>'+
      '<div class="source-rule-fact"><span>予選（Round 1）</span><strong>最大'+fmtNumber(rule.matchCaps['予選'])+'試合 / 約'+fmtNumber(rule.sessionMinutes)+'分 / 全地域上位80名が決勝進出 / 現金賞金$0</strong></div>'+
      '<div class="source-rule-fact"><span>決勝（Finals）</span><strong>最大'+fmtNumber(rule.matchCaps['賞金決勝'])+'試合 / 約'+fmtNumber(rule.finalSessionMinutes)+'分 / 最終順位で個人賞金を確定（VR数とは独立）</strong></div>'+
      '<div class="source-rule-fact"><span>決勝個人賞金（USD・地域別）</span><div class="source-rule-cash-grid">'+sections+'</div></div>'+
      '<div class="source-rule-fact"><span>予選コスメ報酬</span><strong>'+fmtNumber(rule.cosmeticPrizes.minimumPoints)+'pt以上で'+esc(rule.cosmeticPrizes.spray)+'（賞金には加算しない）</strong></div>'+
      '<div class="source-rule-fact"><span>同点時の優先順</span><strong>合計ポイント → VR数 → 平均キル → 平均順位 → 生存秒数</strong></div>'+
      '<p class="source-rule-warning">※ BRとZBは別EpicイベントID。予選通過は80位以内のみ。81位以下は本人・公式開催枠・確定順位が一致した場合に限り参加記録（賞金$0）。決勝の賞金は地域別の最終順位だけで判定し、VRに単価を掛けません。受給資格・支払とスプレー配布完了は別途確認が必要です。</p>';
  }
  // The Unreal Cup source table reports TEAM earnings. Each eligible duo member earns half.
  function unrealMarkup(rule){
    const award=rule.cashPrizes;
    const regions=state.region==='all'?['EU','NAC','NAW','BR','ME','ASIA','OCE']:[state.region];
    const sections=regions.map(region=>{
      const tiers=award?.tiers?.[region];
      if(!tiers?.length)return '<div class="source-rule-cash-region is-unknown"><strong>'+esc(region)+'</strong> 賞金表未登録</div>';
      let previous=0;
      const rows=tiers.map(tier=>{
        const from=previous+1;previous=tier.through;
        const label=from===tier.through?fmtNumber(from)+'位':fmtNumber(from)+'〜'+fmtNumber(tier.through)+'位';
        const each=tier.perTeam/award.teamSize;
        return '<div class="source-rule-cash-tier source-rule-unreal-tier"><span>'+esc(label)+'</span>'+
          '<div><strong>チーム $'+fmtNumber(tier.perTeam)+'</strong><small>1人 $'+fmtNumber(each)+'</small></div></div>';
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
      '賞金圏外は$0。全順位の取得完了・Epic ID・地域・開催回・既存記録が一致した場合に自動掲載し、未確認の候補は保留します。'+
      '本人の受給資格・支払い完了は別途確認が必要です。</p>';
  }

  function nvidiaMarkup(rule){
    const regions=state.region==='all'?['OCE','ASIA','ME','EU','BR','NAC','NAW']:[state.region];
    const sections=regions.map(region=>{
      const tiers=rule.cashPrizes?.tiers?.[region];
      if(!tiers?.length)return '<div class="source-rule-cash-region is-unknown"><strong>'+esc(region)+'</strong> 賞金表未登録</div>';
      let previous=0;
      const rows=tiers.map(tier=>{
        const from=previous+1;previous=tier.through;
        const label=from===tier.through?fmtNumber(from)+'位':fmtNumber(from)+'〜'+fmtNumber(tier.through)+'位';
        return '<div class="source-rule-cash-tier source-rule-unreal-tier"><span>'+esc(label)+'</span>'+
          '<div><strong>1人 $'+fmtNumber(tier.perPlayer)+'</strong></div></div>';
      }).join('');
      return '<div class="source-rule-cash-region"><h4>'+esc(region)+' · 上位'+fmtNumber(tiers.at(-1).through)+'名</h4>'+rows+'</div>';
    }).join('');
    const hardware=regions.map(region=>{
      const cutoff=rule.hardwarePrizes?.rankCutoffs?.[region];
      return '<div class="source-rule-cash-tier"><span>'+esc(region)+'</span><strong>'+fmtNumber(cutoff)+'位以内</strong></div>';
    }).join('');
    return '<div class="source-rule-fact"><span>地域別賞金表（USD・選手1人あたり）</span>'+
      '<div class="source-rule-cash-grid source-rule-unreal-grid">'+sections+'</div></div>'+
      '<div class="source-rule-fact"><span>RTX 5080 現物賞品</span>'+
      '<div class="source-rule-cash-grid source-rule-unreal-grid">'+hardware+'</div></div>'+
      '<div class="source-rule-fact"><span>コスメ報酬</span><strong>'+esc(rule.cosmeticPrizes.item)+
      ' · 8ポイント以上（受領状況は別途確認）</strong></div>'+
      '<div class="source-rule-fact"><span>参加条件</span><strong>ソロ / BR・ゼロビルド・Reloadのいずれかのランクでゴールド以上 / 13歳以上'+
      ' / Epicレベル350以上 / 2段階認証 / 過去180日間に異なる公式大会14回以上参加</strong></div>'+
      '<div class="source-rule-fact"><span>開催形式</span><strong>クロスプラットフォーム・単一ラウンド / 約'+
      fmtNumber(rule.sessionMinutes)+'分 / 最大'+fmtNumber(rule.matchCaps['単一ラウンド'])+'試合</strong></div>'+
      '<div class="source-rule-fact"><span>開催日</span><strong>公式規則：'+
      (rule.sessionDates||[]).map(esc).join('・')+'（地域ごとの現地日付。NAWは日本時間2025-12-22）</strong></div>'+
      '<div class="source-rule-fact"><span>ポイント・同点時</span><strong>順位/撃破の配点はゲーム内表示が公式。'+
      '同点時は総ポイント → VR数 → 平均キル → 平均順位 → 合計生存時間</strong></div>'+
      '<p class="source-rule-warning">※ 現金は各選手の規定額を記録し、圏外は$0。RTX 5080とRust Bucketは現金賞金に換算しません。'+
      '全順位表・本人Epic ID・開催地域・開催回・順位の完全照合が取れた場合のみ自動承認します。'+
      '賞金・賞品の実際の受給資格と支払・配布は別途審査が必要です。</p>';
  }
  function ruleMarkup(entry){
    const rule=state.rules.get(entry.id),present=Boolean(rule);
    const ids=rule?.eventIds?.length?rule.eventIds:entry.sourceEventIds||[];
    const url=safeUrl(rule?.source);
    const eventUrl=ids[0]?safeUrl('https://www.fortnite.com/competitive/events/'+encodeURIComponent(ids[0])+'/'):null;
    // Catalog evidence is a research lead, never an auto-approval rule.
    // Link only directly to Epic rule documents, never to untrusted hosts.
    const researchLinks=present?[]:[...new Set((entry.evidence||[]).map(e=>safeUrl(e.url))
      .filter(Boolean).filter(u=>{
        const pathname=new URL(u).pathname;
        return pathname.startsWith('/competitive/rules-guidelines/rules-library/')||
          pathname.startsWith('/news/');
      }))].slice(0,3);
    const conditions=rule?.series==='nvidia-cup'?nvidiaMarkup(rule):rule?.series==='unreal-cup'?unrealMarkup(rule):rule?.series==='cash-cup'?cashMarkup(rule):
      rule?.cosmeticRanks
      ?'<div class="source-rule-fact"><span>スキン獲得対象順位</span><div class="source-rule-regions">'+regionRows(rule.cosmeticRanks,'スキン獲得ライン')+'</div></div>'
      :'<div class="source-rule-fact"><span>予選突破の地域別条件</span><div class="source-rule-regions">'+regionRows(rule?.advance,'予選通過順位')+'</div></div>';
    const cash=['victory-cup','performance-evaluation'].includes(rule?.series)
      ?'<div class="source-rule-fact"><span>決勝賞金</span><strong>'+(
        Number.isFinite(rule.prizePerVictory)
          ?(['squad','duo'].includes(rule.team)&&Number.isFinite(rule.teamPrizePerVictory)
            ?'決勝1VRにつき各選手$'+fmtNumber(rule.prizePerVictory)+'（チーム合計$'+fmtNumber(rule.teamPrizePerVictory)+'）'
            :'決勝1VRにつき'+(rule.series==='performance-evaluation'?'各選手':'')+'$'+fmtNumber(rule.prizePerVictory)+'（規則上）')
          :'VRごとの賞金単価は未登録（0VRは$0で記録可能）'
      )+'</strong></div>':'';
    const evalNote=rule?.series==='performance-evaluation'?
      '<p class="source-rule-warning">※ S43開催枠の通過対象は上位26。公式規則本文の一般表記は33のため、現行イベントの報酬欄・ユーザー確認に基づき26を採用。決勝はVR100ポイントにつき個人$400、チーム$1,200です。支払・資格審査完了までは未確認。</p>':'';
    const squadsNote=rule?.id==='ch7s5-squads-victory-cup'?
      '<p class="source-rule-warning">※ Round 1は地域別通過枠で判定し賞金$0。Round 2はビクロイのみ1VR=100ptで、最大3VR。各選手$50/VR、4名チーム合計$200/VR（3VRなら個人$150・チーム$600）。予選・決勝とも本人IDと順位表を検証し、未確認の賞金は掲載しません。</p>':'';
    const cosmeticDetail=rule?.cosmeticPrizes?.rankRewards?.length?
      '<div class="source-rule-fact"><span>上位入賞のゲーム内報酬</span><strong>'+
      rule.cosmeticPrizes.rankRewards.map(esc).join(' / ')+'</strong></div>'+
      '<div class="source-rule-fact"><span>参加ポイント報酬</span><strong>'+
      fmtNumber(rule.cosmeticPrizes.minimumPoints)+'ptで'+esc(rule.cosmeticPrizes.spray)+'</strong></div>'+
      '<div class="source-rule-fact"><span>開催部門</span><strong>'+
      esc(rule.team==='solo'?'Mobile / タッチ操作限定・Reload Zero Build / ソロ':entry.mode==='zero-build'?'Zero Build / デュオ':'Battle Royale / デュオ')+
      (Number.isSafeInteger(rule.sessionMinutes)?' / 約'+fmtNumber(rule.sessionMinutes)+'分':'')+'</strong></div>'+
      '<p class="source-rule-warning">※ 3つのWidowmaker部門は各々別の大会ID・形式・報酬圏。現金賞金は$0。衣装等の実際の配布・受給資格は別途確認が必要です。本人Epic IDと保存済み順位表を照合した場合に限り順位報酬として掲載します。スプレーは順位賞とは別の獲得条件です。</p>':'';
    const matchCaps=Object.entries(rule?.matchCaps||{}).map(([stage,limit])=>esc(stage)+' 最大'+fmtNumber(limit)+'試合').join(' / ');
    const details=present?
      '<div class="source-rule-facts">'+conditions+cash+evalNote+squadsNote+cosmeticDetail+
      '<div class="source-rule-fact"><span>試合数の上限</span><strong>'+esc(matchCaps||'未登録')+'</strong></div></div>'
      :'<div class="source-rule-facts"><div class="source-rule-fact"><span>現在の調査状況</span>'+
        '<strong>'+(researchLinks.length?'Epic公式資料の参照先あり · 条件の登録待ち':'公式条件の調査待ち')+'</strong></div>'+
        '<p class="source-rule-warning">大会の名称・形式は大会カタログに登録済みですが、地域別通過・賞金・スキン獲得条件はルールマスター未登録です。'+
        '公式資料へのリンクがあっても自動承認は有効化されません。順位だけから報酬を認定しません。</p></div>';
    return '<article class="source-rule-card" data-rule-id="'+esc(entry.id)+'">'+
      '<div class="source-rule-title"><div><span class="source-rule-season">'+esc(entry.seasonId||'シーズン不明')+
      ' · '+esc(seriesLabel[entry.series]||entry.series||'大会')+'</span>'+
      '<h3>'+esc(entry.name)+'</h3>'+
      '<p>'+esc(modeLabel[entry.team]||entry.team||'形式未確認')+' / '+esc(entry.mode||'モード未確認')+'</p></div>'+
      '<span class="source-rule-state '+(present?'is-ready':'is-pending')+'">'+(present?(rule?.autoApproval==='verified-solo-rank'?'公式賞金表・本人ID照合で自動掲載':rule?.autoApproval==='review-only'?'公式規則登録済み・確認専用':rule?.autoApproval==='verified-team-rank'?(rule.series==='unreal-cup'?'公式賞金表で自動掲載・圏外$0':'公式規則登録済み・全順位を自動掲載'):rule?.autoApproval==='verified-performance-vr'?'予選突破・決勝VRを自動掲載':rule?.cashFinalAutoApproval==='verified-duo-round2-rank'?'予選突破・決勝賞金を自動掲載':rule?.autoApproval==='verified-duo-qualifier-only'?'予選突破・参加$0を自動掲載':'公式規則登録済み'):'ルール未登録')+'</span></div>'+
      details+
      '<details class="source-rule-identifiers"><summary>大会ID・適用範囲</summary><div>'+ids.map(id=>'<code>'+esc(id)+'</code>').join('')+
      '<p>公式規則が確認済みでも、本人Epic ID・地域・開催枠・順位表の検証が必要です</p></div></details>'+
      '<div class="source-rule-links">'+
      (url?'<a href="'+esc(url)+'" target="_blank" rel="noopener noreferrer">Epic公式大会ルール ↗</a>':'')+
      researchLinks.map((link,index)=>'<a href="'+esc(link)+'" target="_blank" rel="noopener noreferrer">公式ルール資料 '+(index+1)+' ↗</a>').join('')+
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
