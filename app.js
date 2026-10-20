(async () => {
    'use strict';
    const baseUrl=new URL('.',document.currentScript?.src||document.baseURI);
    const loadJSON=async filename=>{
      const response=await fetch(new URL(filename,baseUrl),{cache:'no-store'});
      if(!response.ok)throw new Error(filename+' could not be loaded (HTTP '+response.status+')');
      return response.json();
    };
    const [records,playerData,tournamentData]=await Promise.all([
      loadJSON('results.json'),loadJSON('players.json'),loadJSON('tournaments.json')
    ]);
    const siteData={results:records,players:playerData,tournaments:tournamentData};
    if(!Array.isArray(siteData.results)||!Array.isArray(siteData.players.candidates)||!Array.isArray(siteData.tournaments.catalog))
      throw new Error('Invalid ASIA ON TOUR data files');

    // CH7S4 / Override · 2026-08-20 through 2026-10-18 (snapshot, not exhaustive)
    // Every record includes the intended match-region in its source round ID; some official result URLs use a generic region query parameter.
    const builtIn=siteData.results;
    const candidates=siteData.players.candidates;
    const regions=['ME','EU','NAC','NAW','OCE','BR'];
    const $=s=>document.querySelector(s);
    const rawAll=()=>builtIn;
    let selectedSeason='S42';
    const all=()=>selectedSeason==='all'?rawAll():rawAll().filter(e=>recordSeason(e).id===selectedSeason);
    const escape=s=>String(s??'').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const format=n=>typeof n==='number'&&Number.isFinite(n)?n.toLocaleString('ja-JP'):'—';
    const names=e=>Array.isArray(e.players)&&e.players.length?e.players:[e.player];
    const verificationLabel=e=>e.reported?'報告あり・詳細未確認':e.partial?'通過確認・詳細未確認':e.verified?'出典確認':'詳細未確認';
    const rankLabel=e=>Number.isInteger(e.rank)?'#'+format(e.rank):e.reported?'確認中':'通過';
    const prizeLabel=e=>typeof e.prize==='number'?('$'+format(e.prize)+(e.prizePerPlayer?' チーム合計（各$'+format(e.prizePerPlayer)+'）':'')):'—';

    // Only explicitly verified cash payouts are counted. A duo payout MUST have
    // a known per-player share, otherwise it is not assigned to individuals.
    const isPrizeWin=e=>typeof e.prize==='number'&&e.prize>0&&e.verified===true&&!['予選','コスメ大会','スキン大会'].includes(e.kind);
    const individualPrize=e=>{
      if(!isPrizeWin(e))return 0;
      const roster=names(e);
      if(roster.length===1)return e.prize;
      if(typeof e.prizePerPlayer!=='number'||!Number.isFinite(e.prizePerPlayer)||e.prizePerPlayer<=0)return 0;
      if(e.prizePerPlayer*roster.length>e.prize+0.001)return 0;
      return e.prizePerPlayer;
    };
    function prizeTotals(rows=all()){
      const totals=new Map();
      for(const e of rows){
        const amount=individualPrize(e);
        if(!amount)continue;
        for(const n of new Set(names(e))){
          const current=totals.get(n)||{name:n,total:0,events:0};
          current.total+=amount;
          current.events++;
          totals.set(n,current);
        }
      }
      return [...totals.values()].sort((a,b)=>b.total-a.total||b.events-a.events||a.name.localeCompare(b.name,'ja'));
    }
    function playerPrizeTotal(name,rows=all()){return prizeTotals(rows).find(p=>p.name===name)?.total||0}
    const tournamentAxes=siteData.tournaments.axes;
    const tournamentCatalog=siteData.tournaments.catalog;
    // Classification is separate from immutable published results. Match both
    // the explicit season/source identity and exact registered tournament name.
    function tournamentSource(e){
      try{
        const u=new URL(e.source);const parts=u.pathname.split('/').filter(Boolean);
        if(!['https:','http:'].includes(u.protocol)||!['fortnite.com','www.fortnite.com','fortnitetracker.com','www.fortnitetracker.com'].includes(u.hostname.toLowerCase()))return {eventId:null,roundId:null,seasonId:'unknown'};
        let eventId=parts.find(p=>/^S\d+_/i.test(p))||parts.find(p=>/^epicgames_S\d+_/i.test(p))?.replace(/^epicgames_/i,'')||null;
        if(eventId){const suffix=eventId.split('_').at(-1);if(regions.includes(suffix))eventId=eventId.slice(0,-suffix.length-1)}
        const roundId=u.searchParams.get('window')||u.searchParams.get('round')||null;
        const eventSeason=eventId?.match(/^S\d+/i)?.[0]?.toUpperCase();
        const roundSeason=roundId?.match(/^S\d+/i)?.[0]?.toUpperCase();
        if(eventSeason&&roundSeason&&eventSeason!==roundSeason)return {eventId:null,roundId:null,seasonId:'unknown',seasonConflict:true};
        const seasonId=(eventId||roundId||'').match(/^S\d+/i)?.[0]?.toUpperCase()||'unknown';
        return {eventId,roundId,seasonId};
      }catch{return {eventId:null,roundId:null,seasonId:'unknown'}}
    }
    function classifyTournamentRecord(e){
      const source=tournamentSource(e);
      const known=tournamentCatalog.find(t=>t.seasonId===source.seasonId&&t.name===e.event&&t.sourceEventIds.includes(source.eventId));
      const period=recordSeason(e);
      if(known&&period.id===known.seasonId)return known;
      const periodId=period.id==='unknown'?source.seasonId:period.seasonId;
      return {id:'unconfirmed-'+encodeURIComponent([periodId,e.event,source.eventId||e.id].join('|')),name:e.event||'大会名未確認',chapter:period.chapter,season:period.season,seasonId:periodId,sourceEventIds:source.eventId?[source.eventId]:[],series:'unknown',mode:'unknown',subtype:'unknown',team:'unknown',platform:'unknown',evidence:[{text:'登録名・出典の識別子に一致する確認済み分類がないため、各項目を未確認としています。'}]};
    }
    // Season identity is explicit metadata, never inferred from dates or S-number arithmetic.
    const currentSeasonId='S42';
    const unknownSeason=()=>({id:'unknown',seasonId:'unknown',chapter:null,season:null,label:'未確認'});
    function buildSeasonMetadata(){
      const definitions=new Map(),conflicts=new Set();
      for(const row of [...tournamentCatalog,...rawAll()]){
        if(!/^S\d+$/.test(row.seasonId||'')||!Number.isInteger(row.chapter)||row.chapter<1||!Number.isInteger(row.season)||row.season<1)continue;
        const item={id:row.seasonId,seasonId:row.seasonId,chapter:row.chapter,season:row.season,label:`CH${row.chapter} S${row.season}`};
        const previous=definitions.get(item.id);
        if(previous&&(previous.chapter!==item.chapter||previous.season!==item.season))conflicts.add(item.id);
        else definitions.set(item.id,item);
      }
      for(const id of conflicts)definitions.delete(id);
      return definitions;
    }
    const seasonMetadata=buildSeasonMetadata();
    const recordSeasonCache=new WeakMap();
    function recordSeason(e){
      if(!recordSeasonCache.has(e))recordSeasonCache.set(e,resolveRecordSeason(e));
      return recordSeasonCache.get(e);
    }
    function resolveRecordSeason(e){
      const source=tournamentSource(e);
      if(source.seasonConflict)return unknownSeason();
      const explicit=e.seasonId;
      if(explicit!=null&&!/^S\d+$/.test(explicit))return unknownSeason();
      if(explicit&&source.seasonId!=='unknown'&&explicit!==source.seasonId)return unknownSeason();
      const definition=seasonMetadata.get(explicit||source.seasonId);
      if(!definition||(e.chapter!=null&&e.chapter!==definition.chapter)||(e.season!=null&&e.season!==definition.season))return unknownSeason();
      return definition;
    }
    function seasonOptions(){
      const registered=new Map(rawAll().map(e=>{const info=recordSeason(e);return [info.id,info]}));
      return [{id:'all',label:'全期間'},...[...registered.values()].filter(s=>s.id!=='unknown').sort((a,b)=>b.chapter-a.chapter||b.season-a.season||a.id.localeCompare(b.id)),...(registered.has('unknown')?[unknownSeason()]:[])];
    }
    function defaultSeason(){return seasonOptions().some(s=>s.id===currentSeasonId)?currentSeasonId:'all'}
    function sanitizeSeason(value){return seasonOptions().some(s=>s.id===value)?value:defaultSeason()}
    function seasonFromUrl(){return sanitizeSeason(new URL(window.location.href).searchParams.get('season'))}
    function seasonLabel(){return seasonOptions().find(s=>s.id===selectedSeason)?.label||'未確認'}
    function seasonScope(){return selectedSeason==='all'?'全期間（登録済み全シーズン）':selectedSeason==='unknown'?'シーズン未確認の記録':seasonLabel()}
    function seasonPrizeLabel(){return selectedSeason==='all'?'全期間の確認済み海外獲得賞金':`${seasonLabel()}の確認済み海外獲得賞金`}
    function seasonStamp(e){return `<span class="record-season" data-record-season="${escape(recordSeason(e).id)}">${escape(recordSeason(e).label)}</span>`}
    function selectedSeasonPlayers(){
      const active=new Set(all().flatMap(names));
      return playerRegistry().filter(p=>selectedSeason==='all'||active.has(p.name)||(selectedSeason===currentSeasonId&&candidates.some(c=>c.name===p.name)));
    }
    function renderSeasonControl(){
      const scope=seasonScope();
      $('#season-select').innerHTML=seasonOptions().map(s=>`<option value="${escape(s.id)}"${s.id===selectedSeason?' selected':''}>${escape(s.label)}</option>`).join('');
      $('#season-select').value=selectedSeason;
      $('#season-scope').textContent=`集計対象：${scope}`;
      $('#home-season-label').textContent=selectedSeason==='all'?'ALL SEASONS · OVERSEAS ARCHIVE':`${seasonLabel()} · OVERSEAS ARCHIVE`;
      $('#home-season-description').textContent=`${scope}の海外サーバー挑戦を記録する`;
      $('#archive-season-description').textContent=`${scope}の海外大会アーカイブ。掲載済みの戦績を検索・閲覧できます。`;
      $('#players-season-description').textContent=`${scope}の掲載選手。CH7 S4の追跡候補は戦績0件でも掲載しています。紹介文はCH7 S4時点の記録で、集計値は選択期間に対応します。`;
      $('#home-earnings-title').innerHTML=`🏆 ${escape(seasonPrizeLabel())} <span style="color:#e8c383">TOP 5</span>`;
      $('#ranking-season-description').textContent=`${scope} · 個人の確認済み賞金額（USD）`;
      $('#ranking-completeness').textContent='未掲載の大会があるため、実際の獲得賞金総額とは一致しない場合があります。';
      $('#home-spotlight').hidden=!all().some(e=>e.region==='ME'&&e.date==='2026-08-25'&&names(e).includes('Karf'));
    }
    function changeSeason(value){
      const nextSeason=sanitizeSeason(value);
      if(nextSeason===selectedSeason)return;
      const previous=captureView();
      window.history.replaceState({aot:true,depth:routeDepth,view:previous},'',window.location.href);
      const next={...previous,season:nextSeason};
      const url=new URL(window.location.href);url.searchParams.set('season',nextSeason);
      routeDepth++;
      window.history.pushState({aot:true,depth:routeDepth,view:next},'',url.href);
      selectedSeason=nextSeason;
      refresh();showView(next,true);
    }

    const tournamentForRecord=classifyTournamentRecord;
    const tournamentDefaultFilters=()=>({series:'all',mode:'all',subtype:'all',team:'all',platform:'all',stage:'all',q:''});
    let tournamentBrowseFilters=tournamentDefaultFilters();
    function tournamentLabel(axis,value){return tournamentAxes.find(a=>a.key===axis)?.options.find(o=>o.id===value)?.label||'未確認'}
    function sanitizeTournamentFilters(filters={}){
      const result=tournamentDefaultFilters();
      for(const axis of tournamentAxes)if(axis.options.some(o=>o.id===filters[axis.key]))result[axis.key]=filters[axis.key];
      if(rawAll().some(e=>e.kind===filters.stage))result.stage=filters.stage;
      result.q=typeof filters.q==='string'?filters.q:'';
      return result;
    }
    function tournamentSearchHash(filters={}){
      const f=sanitizeTournamentFilters(filters),params=new URLSearchParams();
      for(const key of [...tournamentAxes.map(a=>a.key),'stage','q'])if(f[key]&&f[key]!=='all')params.set(key,f[key]);
      return '#tournaments'+(params.size?'?'+params.toString():'');
    }
    const tournamentHref=id=>'#tournament='+encodeURIComponent(id);
    function tournamentSearchHref(axis,value,context=currentView.page==='tournaments'){const base=context?{...currentView.filters}:tournamentDefaultFilters();base[axis]=base[axis]===value?'all':value;return tournamentSearchHash(base)}
    function tournamentTags(e){const t=classifyTournamentRecord(e);return `<div class="tournament-tags" data-record-classification="${escape(e.id)}">${tournamentAxes.map(axis=>`<a class="tournament-tag${t[axis.key]==='unknown'?' is-unknown':''}" data-axis="${escape(axis.key)}" data-tournament-tag="${escape(axis.key+':'+t[axis.key])}" href="${escape(tournamentSearchHref(axis.key,t[axis.key],false))}" title="${escape(axis.label+'：'+tournamentLabel(axis.key,t[axis.key]))}"><span class="sr-only">${escape(axis.label)}：</span>${escape(tournamentLabel(axis.key,t[axis.key]))}</a>`).join('')}</div>`}
    function tournamentRecordsMatch(e,filters,skipAxis){
      const t=classifyTournamentRecord(e);
      return tournamentAxes.every(axis=>axis.key===skipAxis||filters[axis.key]==='all'||t[axis.key]===filters[axis.key])&&(filters.stage==='all'||e.kind===filters.stage)&&(!filters.q||[t.name,...tournamentAxes.map(a=>tournamentLabel(a.key,t[a.key])),t.seasonId].some(s=>String(s).toLowerCase().includes(filters.q.trim().toLowerCase())));
    }
    function tournamentFilterCounts(axis,filters={}){
      const f=sanitizeTournamentFilters(filters);return (tournamentAxes.find(a=>a.key===axis)?.options||[]).map(o=>({id:o.id,label:o.label,count:all().filter(e=>tournamentRecordsMatch(e,f,axis)&&classifyTournamentRecord(e)[axis]===o.id).length}));
    }
    function tournamentSessions(t,records){
      const groups=new Map();
      for(const e of records){
        const source=tournamentSource(e);
        const explicitLabel=/(?:Event|Week|Session)\s*\d+/i.test(e.round||'');
        const uncertain=!source.roundId&&!explicitLabel;
        const sourceId=source.roundId||(explicitLabel?'label:'+e.round:'unconfirmed:'+e.id);
        const key=JSON.stringify([t.id,e.region,e.date,e.round||null,e.kind||null,sourceId]);
        if(!groups.has(key))groups.set(key,{id:key,label:e.round||'ラウンド未確認',region:e.region,date:e.date,round:e.round,kind:e.kind,sourceId,uncertain,records:[]});
        groups.get(key).records.push(e);
      }
      return [...groups.values()].sort((a,b)=>b.date.localeCompare(a.date)||a.region.localeCompare(b.region)||String(a.round).localeCompare(String(b.round),'ja'));
    }
    function tournamentInfo(id,subset){
      const records=(subset||all()).filter(e=>classifyTournamentRecord(e).id===id);
      const catalog=tournamentCatalog.find(t=>t.id===id)||records[0]&&classifyTournamentRecord(records[0]);
      if(!catalog)return null;
      const sorted=records.slice().sort((a,b)=>b.date.localeCompare(a.date)||(a.rank??Infinity)-(b.rank??Infinity));
      return {...catalog,records:sorted,recordCount:sorted.length,sessions:tournamentSessions(catalog,sorted),regions:regions.filter(r=>sorted.some(e=>e.region===r)),latestDate:sorted[0]?.date||''};
    }
    function tournamentSummaries(filters={}){
      const f=sanitizeTournamentFilters(filters),rows=all().filter(e=>tournamentRecordsMatch(e,f));
      return [...new Set(rows.map(e=>classifyTournamentRecord(e).id))].map(id=>tournamentInfo(id,rows)).sort((a,b)=>b.latestDate.localeCompare(a.latestDate)||a.name.localeCompare(b.name));
    }
    function tournamentRecordCard(e){return `<article class="tournament-result${isPrizeWin(e)?' is-prize-win':''}" data-tournament-record="${escape(e.id)}"><div class="tournament-result-heading"><h4 class="tournament-result-player">${profileNameLinks(e)}</h4><span class="tournament-result-stage">${escape(verificationLabel(e))}</span></div><dl class="tournament-result-metrics"><div><dt>順位</dt><dd data-tournament-metric="rank"${Number.isInteger(e.rank)?'':' class="unknown"'}>${escape(rankLabel(e))}</dd></div><div><dt>PTS</dt><dd data-tournament-metric="points">${format(e.points)}</dd></div><div><dt>KILLS</dt><dd data-tournament-metric="kills">${format(e.kills)}</dd></div><div><dt>VR</dt><dd data-tournament-metric="vrs">${format(e.vrs)}</dd></div><div class="tournament-result-prize"><dt>賞金 / USD</dt><dd data-tournament-metric="prize">${archivePrize(e)}</dd></div></dl>${archiveDetails(e)}</article>`}

    function tournamentViewSeason(t){
      if(t.chapter!=null&&t.season!=null)return `CH${t.chapter} · SEASON ${t.season}`;
      return t.seasonId||'シーズン未確認';
    }
    function tournamentViewStageOptions(){
      return [...new Set(rawAll().map(e=>e.kind).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ja')).map(id=>({id,label:id}));
    }
    function tournamentViewSelect(axis,filters){
      const selected=filters[axis.key]||'all';
      return `<div class="tournament-filter-field"><label for="tournament-${escape(axis.key)}">${escape(axis.label)}</label><select id="tournament-${escape(axis.key)}" data-tournament-filter="${escape(axis.key)}"><option value="all"${selected==='all'?' selected':''}>すべての${escape(axis.label)}</option>${axis.options.map(o=>`<option value="${escape(o.id)}"${selected===o.id?' selected':''}>${escape(o.label)}</option>`).join('')}</select></div>`;
    }
    function renderTournamentSearch(filters={}){
      const axes=[...tournamentAxes,{key:'stage',label:'大会ラウンド区分',options:tournamentViewStageOptions()}];
      $('#tournament-content').innerHTML=`<header class="tournament-intro"><p class="tournament-kicker">TOURNAMENTS / ASIA OVERSEAS</p><h1>大会を<span>探す</span></h1><p>大会の形式から、ASIA勢の海外戦績を探す。</p></header><section class="tournament-search-panel" aria-label="大会の検索と絞り込み"><label class="tournament-search-input" for="tournament-query"><span>大会名で検索</span><input id="tournament-query" type="search" value="${escape(filters.q||'')}" placeholder="大会名を入力" aria-label="大会名で検索"></label><div class="tournament-filter-grid">${axes.map(axis=>tournamentViewSelect(axis,filters)).join('')}</div><p class="tournament-round-note">ゲーム形式と予選・決勝は別々に絞り込めます。形式や機種条件を確認できない大会は「未確認」と表示します。</p></section><div class="tournament-browse-heading"><h2>掲載大会</h2><span class="tournament-count" id="tournament-count" aria-live="polite"></span><a class="tournament-reset" href="#tournaments" data-tournament-reset>条件をリセット</a></div><div class="tournament-active-filters" id="tournament-active-filters" aria-label="適用中の条件"></div><details class="tournament-facets"><summary>タグから絞り込む・掲載戦績数を見る</summary><p class="tournament-facet-caption">タグの数字は、ほかの絞り込み条件に一致する戦績の件数です。</p>${tournamentAxes.map(axis=>`<section class="tournament-facet"><h3>${escape(axis.label)}</h3><div class="tournament-facet-options" id="tournament-facet-${escape(axis.key)}"></div></section>`).join('')}</details><div class="tournament-list" id="tournament-list"></div>`;
      renderTournamentList(filters);
    }
    function tournamentViewCard(t){
      const roster=new Set(t.records.flatMap(names));
      const visited=regions.filter(r=>t.records.some(e=>e.region===r));
      return `<article class="tournament-card" data-tournament-id="${escape(t.id)}"><div class="tournament-card-top"><span class="tournament-season">${escape(tournamentViewSeason(t))}</span><span class="tournament-card-arrow" aria-hidden="true">↗</span></div><h3><a href="${escape(tournamentHref(t.id))}" data-open-tournament="${escape(t.id)}">${escape(t.name)}</a></h3>${t.records.length?tournamentTags(t.records[0]):''}<div class="tournament-card-regions" aria-label="開催地域">${visited.map(regionPill).join('')}</div><dl class="tournament-card-stats"><div><dt>掲載戦績</dt><dd>${format(t.recordCount??t.records.length)}<small>件</small></dd></div><div><dt>開催枠</dt><dd>${format(t.sessions.length)}<small>枠</small></dd></div><div><dt>掲載選手</dt><dd>${format(roster.size)}<small>名</small></dd></div></dl><p class="tournament-card-latest">最新の掲載日 ${escape(friendlyDate(t.latestDate||''))}<br>地域・日付・ラウンド別の戦績を見る →</p></article>`;
    }
    function renderTournamentList(filters={}){
      const shown=tournamentSummaries(filters);
      const recordCount=shown.reduce((sum,t)=>sum+(t.recordCount??t.records.length),0);
      $('#tournament-count').textContent=`${format(shown.length)}大会 · ${format(recordCount)}戦績`;
      const active=[];
      for(const axis of tournamentAxes){
        const value=filters[axis.key];
        if(value&&value!=='all')active.push(`${axis.label}：${tournamentLabel(axis.key,value)}`);
        const counts=tournamentFilterCounts(axis.key,filters);
        $(`#tournament-facet-${axis.key}`).innerHTML=counts.map(option=>`<a class="tournament-facet-chip${option.count?'':' is-empty'}" href="${escape(tournamentSearchHref(axis.key,option.id))}" data-tournament-tag="${escape(axis.key+':'+option.id)}" data-tournament-context="search" aria-current="${value===option.id?'true':'false'}"><span>${escape(option.label)}</span><b>${format(option.count)}</b></a>`).join('');
      }
      if(filters.stage&&filters.stage!=='all')active.push(`大会ラウンド区分：${filters.stage}`);
      if(filters.q)active.push(`検索：${filters.q}`);
      $('#tournament-active-filters').innerHTML=active.map(value=>`<span class="tournament-active-filter">${escape(value)}</span>`).join('');
      $('#tournament-list').innerHTML=shown.length?shown.map(tournamentViewCard).join(''):'<div class="empty"><div class="emoji">⌕</div><b>条件に合う大会がありません</b><p>大会名やタグの条件を変えるか、条件をリセットしてください。</p></div>';
    }
    function tournamentViewEvidence(info){
      const items=Array.isArray(info.evidence)?info.evidence:[];
      if(!items.length)return '<details class="tournament-evidence"><summary>分類の確認根拠</summary><ul><li>分類を確定できない項目は「未確認」と表示しています。大会ごとの出典は各戦績の詳細から確認できます。</li></ul></details>';
      return `<details class="tournament-evidence"><summary>分類の確認根拠 · ${items.length}件</summary><ul>${items.map(item=>{const url=safeUrl(item.url);return `<li>${escape(item.text||'大会情報')}${url?`<br><a href="${escape(url)}" target="_blank" rel="noopener noreferrer">出典を開く ↗</a>`:''}</li>`}).join('')}</ul></details>`;
    }
    function tournamentViewSession(session){
      const source=session.records.map(e=>safeUrl(e.source)).find(Boolean);
      return `<section class="tournament-session" data-tournament-session="${escape(session.id)}"><header class="tournament-session-heading"><div><h3>${regionPill(session.region)}<time datetime="${escape(session.date)}">${escape(friendlyDate(session.date))}</time><span>${escape(session.kind||'区分未確認')}</span></h3><p>${escape(session.round||'ラウンド未確認')}</p>${session.uncertain?'<p class="tournament-session-uncertain">ラウンドID未確認のため、ほかの記録とは分けて表示</p>':''}${source?`<a class="tournament-session-source" href="${escape(source)}" target="_blank" rel="noopener noreferrer">開催枠の出典 ↗</a>`:''}</div><span class="tournament-session-count">${format(session.records.length)}戦績</span></header><div class="tournament-session-records">${session.records.map(tournamentRecordCard).join('')}</div></section>`;
    }
    function renderTournament(id){
      const info=tournamentInfo(id);
      if(!info){$('#tournament-detail-content').innerHTML='<div class="tournament-detail-toolbar"><button type="button" class="btn sm ghost" data-tournament-back>← 戻る</button><a href="#tournaments" data-page="tournaments">大会を探す</a></div><div class="empty"><b>大会が見つかりません</b><p>URLを確認するか、大会検索から探してください。</p></div>';return}
      const roster=new Set(info.records.flatMap(names));
      const visited=regions.filter(r=>info.records.some(e=>e.region===r));
      $('#tournament-detail-content').innerHTML=`<div class="tournament-detail-toolbar"><button type="button" class="btn sm ghost" data-tournament-back>← 戻る</button><a href="${escape(tournamentHref(info.id))}" title="このURLをコピーして共有できます">大会のURL ↗</a></div><header class="tournament-detail-hero"><p class="tournament-kicker">TOURNAMENT / ASIA RESULTS</p><div class="tournament-detail-meta"><span class="tournament-season">${escape(tournamentViewSeason(info))}</span>${visited.map(regionPill).join('')}</div><h1 id="tournament-title" tabindex="-1">${escape(info.name)}</h1>${info.records.length?tournamentTags(info.records[0]):''}<dl class="tournament-detail-summary"><div><dt>掲載戦績</dt><dd>${format(info.recordCount??info.records.length)}<small>件</small></dd></div><div><dt>地域・日付・ラウンド</dt><dd>${format(info.sessions.length)}<small>枠</small></dd></div><div><dt>掲載選手</dt><dd>${format(roster.size)}<small>名</small></dd></div></dl>${tournamentViewEvidence(info)}</header><div class="tournament-sessions-heading"><h2>開催枠ごとの戦績</h2><p>新しい順 · 地域・日付・ラウンドを分けて表示 · ラウンドID未確認は個別表示 · 金色は賞金獲得</p></div><div class="tournament-sessions">${info.sessions.length?info.sessions.map(tournamentViewSession).join(''):'<div class="empty"><b>戦績はまだ掲載されていません</b></div>'}</div>`;
    }
    function renderTournamentDetail(id){renderTournament(id)}

    const confirmedAliases=siteData.players.confirmedAliases;
    // Identity membership always uses exact published roster names. Aliases are
    // display-only evidence and never merge records or resolve another identity.
    const profileHref=name=>'#player='+encodeURIComponent(name);
    function playerRegistry(){
      const known=new Set(candidates.map(p=>p.name));
      const extras=[...new Set(rawAll().flatMap(names))].filter(name=>!known.has(name)).map(name=>({name,initials:[...name].slice(0,2).join(''),desc:'登録済みの海外戦績がある選手'}));
      return [...candidates,...extras];
    }
    function profileNameLinks(e){
      return names(e).map(name=>`<a class="player-name-link" href="${escape(profileHref(name))}" data-open-profile="${escape(name)}">${escape(name)}</a>`).join(' / ');
    }
    function profileInfo(name){
      const player=playerRegistry().find(p=>p.name===name);
      if(!player)return null;
      const events=all().filter(e=>names(e).includes(name)).slice().sort((a,b)=>b.date.localeCompare(a.date));
      const best=predicate=>events.filter(e=>predicate(e)&&Number.isInteger(e.rank)&&e.rank>0).sort((a,b)=>a.rank-b.rank||b.date.localeCompare(a.date))[0]||null;
      const links=[];
      const seen=new Set();
      for(const e of rawAll().filter(e=>names(e).includes(name))){
        const owned=[...(names(e).length===1&&safeUrl(e.profileUrl)?[{name,url:e.profileUrl}]:[]),...(Array.isArray(e.profiles)?e.profiles.filter(p=>p.name===name||names(e).length===1):[])];
        for(const p of owned){const url=safeUrl(p.url);if(url&&!seen.has(url)){seen.add(url);links.push({name:p.name,url});}}
      }
      return {...player,aliases:confirmedAliases[name]||[],events,total:playerPrizeTotal(name),lifetimeTotal:playerPrizeTotal(name,rawAll()),prizeEvents:events.filter(e=>individualPrize(e)>0).length,bestQualifying:best(e=>e.kind==='予選'),bestFinal:best(e=>String(e.kind||'').includes('決勝')),regionStats:regions.map(region=>{const rows=events.filter(e=>e.region===region);return {region,count:rows.length,prize:rows.reduce((sum,e)=>sum+individualPrize(e),0)}}),links};
    }

    let currentView={page:'home',name:null,id:null};
    let routeDepth=0;
    let routedHash='';
    let routingReady=false;
    function captureView(){
      return {...currentView,season:selectedSeason,scroll:window.scrollY||0,results:{search:$('#search-results').value,region:$('#region-filter').value,stage:$('#stage-filter').value,sort:$('#sort-results').value,prize:$('#prize-only').checked,player:selectedPlayer},players:{search:$('#search-players').value,sort:$('#player-sort').value},tournaments:{...tournamentBrowseFilters}};
    }
    function restoreBrowseState(view){
      if(view.results){const r=view.results;$('#search-results').value=r.search;$('#region-filter').value=r.region;$('#stage-filter').value=r.stage;$('#sort-results').value=r.sort;$('#prize-only').checked=r.prize;selectedPlayer=r.player;}
      if(view.players){$('#search-players').value=view.players.search;$('#player-sort').value=view.players.sort;}
      if(view.tournaments)tournamentBrowseFilters=sanitizeTournamentFilters(view.tournaments);
    }
    function routeFromHash(){
      const hash=window.location.hash;
      if(hash.startsWith('#player=')){try{return {page:'profile',name:decodeURIComponent(hash.slice(8))}}catch{return {page:'profile',name:null,invalid:true}}}
      if(hash.startsWith('#tournament=')){try{return {page:'tournament',id:decodeURIComponent(hash.slice(12))}}catch{return {page:'tournament',id:null,invalid:true}}}
      if(hash==='#tournaments'||hash.startsWith('#tournaments?')){const params=new URLSearchParams(hash.split('?').slice(1).join('?'));return {page:'tournaments',filters:sanitizeTournamentFilters(Object.fromEntries(params))}}
      const page=hash.slice(1);
      return {page:['home','results','players','about'].includes(page)?page:'home',name:null};
    }
    function routeHash(view){
      if(view.page==='profile')return view.invalid?window.location.hash:profileHref(view.name||'');
      if(view.page==='tournament')return view.invalid?window.location.hash:tournamentHref(view.id||'');
      if(view.page==='tournaments')return tournamentSearchHash(view.filters);
      return '#'+view.page;
    }
    function showView(view,restore=false){
      const nextSeason=seasonFromUrl();
      if(nextSeason!==selectedSeason){selectedSeason=nextSeason;refresh()}
      restoreBrowseState(view);
      currentView={page:view.page,name:view.name||null,id:view.id||null,invalid:!!view.invalid};
      if(view.page==='tournaments'){tournamentBrowseFilters=sanitizeTournamentFilters(view.filters||tournamentBrowseFilters);currentView.filters={...tournamentBrowseFilters};renderTournamentSearch(currentView.filters)}
      if(view.page==='tournament')renderTournament(view.id);
      if(view.page==='profile'&&!renderProfile(view.name))$('#profile-content').innerHTML='<div class="profile-toolbar"><button type="button" class="btn sm ghost" id="profile-back" data-profile-back>← 戻る</button></div><div class="empty"><h1 id="profile-title" tabindex="-1">選手が見つかりません</h1><p>掲載済みの選手を名鑑から選んでください。</p><a class="text-link" href="#players" data-page="players">プレイヤー名鑑へ →</a></div>';
      document.querySelectorAll('.section').forEach(e=>e.classList.toggle('active',e.id==='page-'+view.page));
      document.querySelectorAll('.nav button').forEach(e=>{const active=e.dataset.page===(view.page==='profile'?'players':view.page==='tournament'?'tournaments':view.page);e.classList.toggle('active',active);e.setAttribute('aria-current',active?'page':'false')});
      if(view.page==='results')renderResults();
      if(view.page==='players')renderPlayers();
      document.title=view.page==='profile'&&profileInfo(view.name)?view.name+' · ASIA ON TOUR':view.page==='tournament'&&tournamentInfo(view.id)?tournamentInfo(view.id).name+' · ASIA ON TOUR':view.page==='tournaments'?'大会を探す · ASIA ON TOUR':'ASIA ON TOUR — Fortnite海外遠征トラッカー';
      routedHash=window.location.hash;
      window.scrollTo({top:restore?(view.scroll||0):0,behavior:'instant'});
      if(!restore){if(view.page==='profile')$('#profile-title')?.focus?.({preventScroll:true});if(view.page==='tournament')$('#tournament-title')?.focus?.({preventScroll:true});}
    }
    function visitView(view,replace=false){
      if(routingReady)window.history.replaceState({aot:true,depth:routeDepth,view:captureView()},'',window.location.href);
      const same=currentView.page===view.page&&currentView.name===(view.name||null)&&currentView.id===(view.id||null)&&(view.page!=='tournaments'||tournamentSearchHash(currentView.filters)===tournamentSearchHash(view.filters));
      const next={...captureView(),invalid:false,...view,scroll:0};
      if(!replace&&!same)routeDepth++;
      const state={aot:true,depth:routeDepth,view:next};
      if(replace||same)window.history.replaceState(state,'',routeHash(view));else window.history.pushState(state,'',routeHash(view));
      showView(next);
    }
    function navigate(page){visitView({page,name:null,id:null,...(page==='tournaments'?{filters:{...tournamentBrowseFilters}}:{})})}
    function openProfile(name){visitView({page:'profile',name,id:null})}
    function openTournament(id){visitView({page:'tournament',id,name:null})}
    function profileBack(){if(routeDepth>0)window.history.back();else visitView({page:'players',name:null,id:null},true)}
    function tournamentBack(){if(routeDepth>0)window.history.back();else visitView({page:currentView.page==='tournaments'?'home':'tournaments',name:null,id:null,filters:tournamentDefaultFilters()},true)}
    function tournamentTagNavigate(axis,value,context){
      if(!tournamentAxes.some(a=>a.key===axis&&a.options.some(o=>o.id===value)))return;
      const filters=context==='search'?{...currentView.filters}:tournamentDefaultFilters();filters[axis]=context==='search'&&filters[axis]===value?'all':value;
      visitView({page:'tournaments',name:null,id:null,filters:sanitizeTournamentFilters(filters)});
    }
    function updateTournamentFilters(key,value){
      const filters=sanitizeTournamentFilters({...currentView.filters,[key]:value});
      tournamentBrowseFilters=filters;currentView.filters={...filters};
      window.history.replaceState({aot:true,depth:routeDepth,view:captureView()},'',tournamentSearchHash(filters));routedHash=window.location.hash;
      if(key==='q')renderTournamentList(filters);else renderTournamentSearch(filters);
    }
    function initializeRouting(){
      const view=routeFromHash();
      routeDepth=0;
      window.history.replaceState({aot:true,depth:0,view},'',window.location.href);
      routingReady=true;
      showView(view);
      window.addEventListener('popstate',event=>{const state=event.state;if(state?.aot){routeDepth=state.depth;showView(state.view,true)}else{routeDepth=0;showView(routeFromHash())}});
      window.addEventListener('hashchange',()=>{if(window.location.hash===routedHash)return;routeDepth=0;const next=routeFromHash();window.history.replaceState({aot:true,depth:0,view:next},'',window.location.href);showView(next)});
    }

    function profileBestCard(label,record,field){
      return `<article class="profile-stat"><h2>${escape(label)}</h2><div class="profile-stat-value${record?'':' is-empty'}" data-profile="${field}">${record?escape(rankLabel(record)):'未登録'}</div><p class="profile-stat-context">${record?`<span class="profile-best-context">${escape(record.event)}</span>${escape(record.region)} · ${escape(friendlyDate(record.date))}<br>${escape(record.kind||'未分類')}`:'順位が確認できる戦績は未登録'}</p></article>`;
    }
    function profileRegionChart(info,metric){
      const count=metric==='count';
      const maximum=Math.max(0,...info.regionStats.map(r=>r[metric]));
      const rows=info.regionStats.map(r=>{
        const value=r[metric];
        const width=maximum?Math.max(0,Math.min(100,value/maximum*100)):0;
        return `<li class="profile-chart-row${value?'':' is-zero'}" data-region="${escape(r.region)}" data-profile-region="${escape(r.region)}"><span class="profile-chart-region">${escape(r.region)}</span><span class="profile-chart-track" aria-hidden="true"><span class="profile-chart-bar" style="width:${width}%"></span></span><span class="profile-chart-number" data-region-stat="${metric}">${count?`${format(value)}件`:`$${format(value)}`}</span></li>`;
      }).join('');
      return `<section class="profile-chart" aria-label="${count?'地域別の掲載戦績数':'地域別の確認済み個人賞金'}"><div class="profile-chart-heading"><h3>${count?'掲載戦績数':'確認済み個人賞金'}</h3><p>${escape(seasonLabel())} · ${count?'件数':'USD'} / 最大 ${count?`${format(maximum)}件`:`$${format(maximum)}`}</p></div><ul class="profile-chart-list">${rows}</ul><p class="profile-chart-hint">${count?'掲載されている海外大会の結果を地域別に集計。':'個人分が確認できた現金賞金のみを地域別に集計。'}</p></section>`;
    }
    function profileHistoryPrize(e){
      const amount=individualPrize(e);
      const duo=names(e).length>1;
      let value=amount?`$${format(amount)}`:e.prize===0?'$0':'—';
      let description=amount?'確認済み個人賞金':e.prize===0?'賞金なし':typeof e.prize==='number'&&e.prize>0?(isPrizeWin(e)?'個人内訳未確認':'賞金未確認'):'賞金未設定';
      if(duo&&typeof e.prize==='number')description+=` / チーム合計 $${format(e.prize)}${e.verified===true?'':'（未確認）'}`;
      return `<strong data-profile-event="prize">${value}</strong><small>${escape(description)}</small>`;
    }
    function profileHistoryRow(e,name){
      const source=safeUrl(e.source);
      const partners=names(e).filter(n=>n!==name);
      const partnerLinks=partners.map(n=>`<a href="${escape(profileHref(n))}" data-open-profile="${escape(n)}">${escape(n)}</a>`).join(' / ');
      return `<article class="profile-history-row${individualPrize(e)>0?' is-prize-win':''}" data-result-id="${escape(e.id)}"><div class="profile-history-meta"><time datetime="${escape(e.date)}">${escape(friendlyDate(e.date))}</time>${seasonStamp(e)}${regionPill(e.region)}<span class="profile-history-stage">${escape(e.kind||'未分類')}</span></div><h3 class="profile-history-event">${escape(e.event)}</h3><p class="profile-history-round">${escape(e.round||'大会ラウンド未登録')}</p>${tournamentTags(e)}${partners.length?`<p class="profile-history-partners">相方：${partnerLinks}</p>`:''}<dl class="profile-history-metrics"><div><dt>順位</dt><dd data-profile-event="rank"${Number.isInteger(e.rank)?'':' class="profile-metric-unknown"'}>${escape(rankLabel(e))}</dd></div><div><dt>PTS</dt><dd data-profile-event="points">${format(e.points)}</dd></div><div><dt>KILLS</dt><dd data-profile-event="kills">${format(e.kills)}</dd></div><div><dt>VR</dt><dd data-profile-event="vrs">${format(e.vrs)}</dd></div><div class="profile-history-prize"><dt>個人賞金 / USD</dt><dd>${profileHistoryPrize(e)}</dd></div></dl><p class="profile-history-source">${source?`<a href="${escape(source)}" target="_blank" rel="noopener noreferrer">大会の出典を見る ↗</a>`:'出典URL未登録'}</p>${archiveDetails(e)}</article>`;
    }
    function renderProfile(name){
      const info=profileInfo(name);
      if(!info){
        $('#profile-content').innerHTML='<div class="profile-toolbar"><button class="btn sm ghost" id="profile-back" data-profile-back type="button">← 戻る</button></div><div class="profile-empty"><h2>選手プロフィールが見つかりません</h2><p>掲載されている選手名からプロフィールを開いてください。</p></div>';
        return false;
      }
      const shareUrl=new URL(profileHref(info.name),window.location.href).href;
      const aliases=info.aliases.length?info.aliases.map(alias=>`<span class="profile-alias">${escape(alias)}</span>`).join(''):'確認済み別名義は未登録';
      const visited=info.regionStats.filter(r=>r.count>0).map(r=>regionPill(r.region)).join('');
      const links=info.links.filter(link=>safeUrl(link.url));
      const external=links.length?`<details class="profile-external"><summary>確認済み外部プロフィール · ${format(links.length)}件</summary><ul class="profile-external-links">${links.map(link=>`<li><a href="${escape(safeUrl(link.url))}" target="_blank" rel="noopener noreferrer">${escape(link.name)} ↗</a><span>${escape(link.url)}</span></li>`).join('')}</ul></details>`:'';
      $('#profile-content').innerHTML=`<div class="profile-toolbar"><button class="btn sm ghost" id="profile-back" data-profile-back type="button">← 戻る</button><a id="profile-share" href="${escape(shareUrl)}" title="このURLをコピーして共有できます">プロフィールのURL ↗</a></div><header class="profile-hero"><div><p class="profile-kicker">PLAYER PROFILE / ASIA OVERSEAS</p><div class="profile-identity"><div class="profile-avatar" aria-hidden="true">${escape(info.initials)}</div><div class="profile-identity-copy"><h1 class="profile-name" id="profile-title" tabindex="-1" data-profile="name">${escape(info.name)}</h1><p class="profile-alias-heading">確認済みの別名義</p><div class="profile-aliases" data-profile="aliases">${aliases}</div></div></div>${info.desc?`<p class="profile-description">${candidates.some(c=>c.name===info.name)?'<span class="season-biography-note">紹介文：CH7 S4時点</span>':''}${escape(info.desc)}</p>`:''}${external}</div><div class="profile-prize-total"><p class="profile-total-label">${escape(seasonPrizeLabel())}</p><div class="profile-total-value"><span data-profile="total">$${format(info.total)}</span><small>USD</small></div><p class="profile-total-hint">${escape(seasonScope())}の個人賞金累計<br>デュオは確認済みの個人分のみ集計<span class="profile-lifetime">全期間の確認済み個人賞金 <b data-profile="lifetime-total">$${format(info.lifetimeTotal)}</b></span></p></div></header><div class="profile-stats"><article class="profile-stat"><h2>賞金獲得記録</h2><div class="profile-stat-value"><span data-profile="prize-events">${format(info.prizeEvents)}</span><small>件</small></div><p class="profile-stat-context">個人賞金の獲得を確認した記録</p></article><article class="profile-stat"><h2>掲載されている海外戦績</h2><div class="profile-stat-value"><span data-profile="events">${format(info.events.length)}</span><small>件</small></div><p class="profile-stat-context">予選・決勝を含む全掲載記録</p></article>${profileBestCard('予選の最高順位',info.bestQualifying,'best-qualifying')}${profileBestCard('決勝の最高順位',info.bestFinal,'best-final')}</div><section aria-labelledby="profile-region-title"><div class="profile-region-heading"><div><h2 id="profile-region-title">地域別の<span>実績</span></h2><p>${visited?'戦績掲載地域':'海外大会の戦績はまだ掲載されていません'}</p></div><div class="profile-regions-visited" aria-label="海外挑戦地域">${visited}</div></div><div class="profile-region-charts">${profileRegionChart(info,'count')}${profileRegionChart(info,'prize')}</div></section><section aria-labelledby="profile-history-title"><div class="profile-history-heading"><div><h2 id="profile-history-title">海外大会<span>履歴</span></h2><p>${escape(seasonScope())} · 新しい順 · 賞金獲得記録は金色で表示</p></div><span class="profile-history-count">${format(info.events.length)}件</span></div><div class="profile-history">${info.events.length?info.events.map(e=>profileHistoryRow(e,info.name)).join(''):'<div class="profile-empty"><h3>海外大会の戦績はまだ未登録です</h3><p>選手名鑑には掲載されていますが、確認済みの海外大会記録はまだ掲載されていません。</p></div>'}</div></section>`;
      return true;
    }

    function renderEarner(p,index,compact=false){return `<a class="earner" href="${escape(profileHref(p.name))}" data-open-profile="${escape(p.name)}"><span class="position">#${index+1}</span><span class="earner-name">${escape(p.name)}</span><strong class="amount">$${format(p.total)}</strong>${compact?'':`<span class="earner-events">賞金獲得 ${p.events}件 ↗</span>`}</a>`}
    function renderEarnings(){const ranked=prizeTotals();const total=ranked.reduce((sum,p)=>sum+p.total,0);$('#home-earnings-sum').textContent='$'+format(total);$('#player-earnings-sum').textContent='$'+format(total);$('#home-earnings-leaders').innerHTML=ranked.length?ranked.slice(0,5).map((p,i)=>renderEarner(p,i,true)).join(''):'<div class="empty">賞金獲得の確定記録はまだないよ</div>';$('#player-earnings-leaders').innerHTML=ranked.length?ranked.map((p,i)=>renderEarner(p,i)).join(''):'<div class="empty">賞金獲得の確定記録はまだないよ</div>'}

    const hasClaimedPrize=e=>typeof e.prize==='number'&&e.prize>0&&!e.verified;
    const stageLabel=e=>isPrizeWin(e)?'🏆 賞金獲得':hasClaimedPrize(e)?'賞金未確認':e.kind==='賞金決勝'?(e.prize===0?'決勝・賞金なし':'決勝・賞金未確認'):(e.kind||'未分類');
    const winBadge=(e,compact=false)=>`<span class="win-badge${compact?' compact':''}${!isPrizeWin(e)?' pending':''}">${isPrizeWin(e)?'🏆 賞金獲得':'△ 賞金未確認'} <b>$${format(e.prize)}</b>${e.prizePerPlayer?' <small>（各$'+format(e.prizePerPlayer)+'）</small>':''}</span>`;
    const prizeCell=e=>isPrizeWin(e)?`<span class="prize-value">$${format(e.prize)}${e.prizePerPlayer?`<small>チーム合計 / 各$${format(e.prizePerPlayer)}</small>`:''}</span>`:hasClaimedPrize(e)?`<span class="win-badge pending">未検証 $${format(e.prize)}</span>`:e.prize===0?'<span class="prize-zero">$0 · 賞金なし</span>':'<span class="prize-zero">—</span>';

    const safeUrl=s=>{try{const u=new URL(s);return ['https:','http:'].includes(u.protocol)?u.href:null}catch{return null}};
    const friendlyDate=s=>s?String(s).replace(/-/g,'.'):'—';
    function regionPill(r){return `<span class="pill" data-region="${escape(r)}">🌐 ${escape(r)}</span>`}
    function resultCard(e){const v=verificationLabel(e);const src=safeUrl(e.source);return `<article class="result-card${isPrizeWin(e)?' is-prize-win':''}"><div class="rank ${e.rank===1?'gold':e.rank<=3?'silver':''}">${Number.isInteger(e.rank)?'<span class="hash">#</span>':''}${Number.isInteger(e.rank)?format(e.rank):'<span style="font-size:19px">'+(e.reported?'確認中':'通過')+'</span>'}</div><div><div class="result-title">${profileNameLinks(e)} <span style="color:#9fa7bf;font-weight:600;font-size:11px">/ ${escape(e.event)}</span></div>${isPrizeWin(e)||hasClaimedPrize(e)?`<div class="prize-ribbon">${winBadge(e,true)}</div>`:''}<div class="result-sub">${seasonStamp(e)} ${friendlyDate(e.date)} · ASIA → ${escape(e.region)} · ${escape(e.round||'大会結果')}</div><div class="result-meta">${regionPill(e.region)}<span class="pill">${escape(stageLabel(e))}</span><span class="pill ${e.partial?'orange':e.verified?'green':'orange'}">${e.reported?'△':e.partial?'△':e.verified?'✓':'✎'} ${v}</span><span class="pill">${format(e.kills)} KILLS</span><span class="pill">${format(e.vrs)} VR</span></div></div><div class="right-data"><div class="score">${format(e.points)} <small>PTS</small></div>${src?`<a class="external-link" href="${escape(src)}" target="_blank" rel="noopener noreferrer">出典を見る ↗</a>`:'<span class="fine">出典未登録</span>'}</div></article>`}

    function renderHome(){const a=all();$('#stat-results').textContent=a.length;$('#stat-players').textContent=new Set(a.flatMap(names)).size;$('#stat-regions').textContent=new Set(a.map(e=>e.region)).size;$('#stat-top10').textContent=a.filter(e=>e.rank<=10).length;const latest=a.slice().sort((x,y)=>y.date.localeCompare(x.date)).slice(0,3);$('#latest-results').innerHTML=latest.length?latest.map(resultCard).join(''):'<div class="empty">まだ戦績が登録されていないよ</div>';$('#region-breakdown').innerHTML=regions.map(r=>{const n=a.filter(e=>e.region===r).length;const percent=a.length?(n/a.length*100):0;return `<div class="region-entry"><div class="reg-left"><div class="flag" data-region="${escape(r)}">${escape(r)}</div><div class="reg-details"><strong>${{ME:'中東',EU:'ヨーロッパ',NAC:'北米中部',NAW:'北米西部',OCE:'オセアニア',BR:'ブラジル'}[r]}</strong><small>${n?'登録あり':'未登録'}</small><div class="reg-bar"><span style="width:${percent}%"></span></div></div></div><span class="reg-count">${n}</span></div>`}).join('');$('#featured-players').innerHTML=selectedSeasonPlayers().slice(0,3).map(renderPlayerCard).join('')}
    function renderPlayerCard(p){const events=all().filter(e=>names(e).includes(p.name));const sum=playerPrizeTotal(p.name);return `<a class="player" href="${escape(profileHref(p.name))}" data-open-profile="${escape(p.name)}"><div class="player-top"><div class="avatar">${escape(p.initials)}</div><div><div class="player-name">${escape(p.name)}</div><div class="player-region">🌏 遠征関連選手 · ${events.length?'戦績掲載中':'海外結果を調査中'}</div></div></div><div class="player-blurb"><span class="season-biography-note">${candidates.some(c=>c.name===p.name)?'紹介文：CH7 S4時点':'掲載選手'}</span>${escape(p.desc)}</div><div class="player-earnings${sum?'':' zero'}"><span>🏆 ${escape(seasonLabel())}の確認済み賞金<br><small>掲載済み・確認済みの個人累計</small></span><strong>${events.length?'$'+format(sum):'未登録'}</strong></div><div class="player-bottom"><span>掲載された海外戦績 <strong>${events.length}</strong> 件</span><span class="player-card-action">プロフィールを見る →</span></div></a>`}
    let visible=[]; let selectedPlayer=null;
    function archivePrize(e){
      const duo=names(e).length>1;
      const share=typeof e.prizePerPlayer==='number'&&Number.isFinite(e.prizePerPlayer)&&e.prizePerPlayer>0&&e.prizePerPlayer*names(e).length<=e.prize+0.001?e.prizePerPlayer:null;
      const scope=duo?'チーム合計':'個人賞金';
      const breakdown=duo?(share?`各選手 $${format(share)}`:'個人内訳未確認'):'';
      if(isPrizeWin(e)||hasClaimedPrize(e))return `<span class="${isPrizeWin(e)?'prize-value':'prize-pending'}"><small>${scope}${hasClaimedPrize(e)?'・未確認':''}</small>$${format(e.prize)}${duo?`<small>${breakdown}</small>`:''}</span>`;
      return `<span class="prize-zero">${e.prize===0?'$0':'—'}</span><small>${e.prize===0?'賞金なし':'未設定'}</small>`;
    }
    function archiveDetails(e){
      const src=safeUrl(e.source);
      const profiles=[...(safeUrl(e.profileUrl)?[{name:e.player,url:e.profileUrl}]:[]),...(Array.isArray(e.profiles)?e.profiles.filter(p=>safeUrl(p.url)):[])];
      return `<details class="result-details"><summary><span class="sr-only">${escape(e.player)}・${escape(friendlyDate(e.date))}・${escape(e.event)}の</span><span class="open-label">詳細を見る</span><span class="close-label">詳細を閉じる</span></summary><dl class="result-detail-grid">
        <div><dt>ポイント / PTS</dt><dd data-detail="points">${format(e.points)}</dd></div>
        <div><dt>大会区分</dt><dd>${escape(e.kind||'未分類')}</dd></div>
        <div><dt>確認状況</dt><dd>${escape(verificationLabel(e))}</dd></div>
        <div><dt>シーズン</dt><dd>${seasonStamp(e)}</dd><dt>大会ラウンド</dt><dd data-detail="round">${escape(e.round||'未登録')}</dd></div>
        <div><dt>大会での表示名</dt><dd data-detail="playerRaw">${escape(e.playerRaw||e.player)}</dd></div>
        <div><dt>賞金内訳 / USD</dt><dd data-detail="prize">${archivePrize(e)}</dd></div>
        <div class="detail-wide"><dt>出典URL</dt><dd data-detail="source">${src?`<a href="${escape(src)}" target="_blank" rel="noopener noreferrer">${escape(e.source)} ↗</a>`:'未登録'}</dd></div>
        <div class="detail-wide detail-links"><dt>選手プロフィール</dt><dd data-detail="profiles">${profiles.length?profiles.map(p=>`<a class="result-profile" href="${escape(safeUrl(p.url))}" target="_blank" rel="noopener noreferrer">${escape(p.name)} ↗<span>${escape(p.url)}</span></a>`).join(''):'未登録'}</dd></div>
        <div class="detail-wide"><dt>補足・確認根拠</dt><dd data-detail="note">${escape(e.note||'補足なし')}</dd></div>
      </dl></details>`;
    }
    function archiveRow(e){
      return `<article class="archive-row${isPrizeWin(e)?' is-prize-win':''}" data-result-id="${escape(e.id)}" aria-labelledby="result-player-${escape(e.id)}"><div class="archive-overview">
        <div class="archive-date"><span class="field-label">日付</span><time data-field="date" datetime="${escape(e.date)}">${escape(friendlyDate(e.date))}</time>${seasonStamp(e)}</div>
        <h3 class="archive-player" id="result-player-${escape(e.id)}" data-field="player">${profileNameLinks(e)}</h3>
        <div class="archive-region"><span class="field-label">地域</span><span class="region-tag" data-field="region" data-region="${escape(e.region)}">${escape(e.region)}</span></div>
        <div class="archive-event"><span class="field-label">大会名</span><p data-field="event">${escape(e.event)}</p><small>${escape(e.kind||'未分類')}</small></div>
        <div class="archive-stat"><span class="field-label">順位</span><strong data-field="rank"${Number.isInteger(e.rank)?'':' class="unknown"'}>${rankLabel(e)}</strong></div>
        <div class="archive-stat"><span class="field-label">KILLS</span><strong data-field="kills">${format(e.kills)}</strong></div>
        <div class="archive-stat"><span class="field-label">VR</span><strong data-field="vrs">${format(e.vrs)}</strong></div>
        <div class="archive-stat archive-prize"><span class="field-label">賞金 / USD</span><div data-field="prize">${archivePrize(e)}</div></div>
      </div>${tournamentTags(e)}${archiveDetails(e)}</article>`;
    }
    function renderResults(){const s=($('#search-results').value||'').trim().toLowerCase();const r=$('#region-filter').value;const prize=$('#prize-only').checked;const stage=$('#stage-filter').value;visible=all().filter(e=>(!selectedPlayer||names(e).includes(selectedPlayer))&&(r==='all'||e.region===r)&&(stage==='all'||e.kind===stage)&&(!prize||isPrizeWin(e))&&(!s||[e.player,...names(e),e.playerRaw,e.event,e.region,e.round,e.note].some(x=>String(x||'').toLowerCase().includes(s))));const order=$('#sort-results').value;visible.sort((a,b)=>order==='rank'?((a.rank??Infinity)-(b.rank??Infinity)||b.date.localeCompare(a.date)):order==='kills'?((b.kills??-1)-(a.kills??-1)):b.date.localeCompare(a.date));$('#result-count').textContent=`${visible.length}件`;
      if(!visible.length){$('#result-table').innerHTML='<div class="empty"><div class="emoji">🔎</div><b>条件に合う戦績がまだないよ</b><p>検索条件や絞り込みを変えてみてね</p></div>';return}
      $('#result-table').innerHTML=`<div class="archive-head" aria-hidden="true"><span>日付</span><span>選手名</span><span>地域</span><span>大会名</span><span>順位</span><span>KILLS</span><span>VR</span><span>賞金 / USD</span></div><div class="archive-list">${visible.map(archiveRow).join('')}</div>`;
    }
    function renderPlayers(){const s=($('#search-players').value||'').trim().toLowerCase();const shown=selectedSeasonPlayers().filter(p=>[p.name,...(confirmedAliases[p.name]||[])].some(n=>n.toLowerCase().includes(s)));const sort=$('#player-sort').value;shown.sort((a,b)=>sort==='name'?a.name.localeCompare(b.name,'ja'):sort==='events'?all().filter(e=>names(e).includes(b.name)).length-all().filter(e=>names(e).includes(a.name)).length||a.name.localeCompare(b.name,'ja'):playerPrizeTotal(b.name)-playerPrizeTotal(a.name)||a.name.localeCompare(b.name,'ja'));$('#all-players').innerHTML=shown.length?shown.map(renderPlayerCard).join(''):'<div class="empty">一致する選手はまだいないよ</div>'}

    function refresh(){renderSeasonControl();renderHome();renderResults();renderEarnings();renderPlayers()}
    function csvText(rows){const cols=['date','player','players','region','event','round','rank','points','kills','vrs','prize','prizePerPlayer','kind','source','verified','note','chapter','season','seasonId'];const cell=x=>'"'+String(x??'').replace(/"/g,'""')+'"';return '\ufeff'+cols.join(',')+'\r\n'+rows.map(e=>cols.map(k=>cell(k==='players'?names(e).join(' / '):['chapter','season','seasonId'].includes(k)?recordSeason(e)[k]:e[k])).join(',')).join('\r\n')}
    function download(name,content,type){const b=new Blob([content],{type});const url=URL.createObjectURL(b);const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)}
    document.addEventListener('click',e=>{
      if(e.target.closest('[data-tournament-back]')){tournamentBack();return}
      if(e.target.closest('[data-profile-back]')){profileBack();return}
      const tournament=e.target.closest('[data-open-tournament]');
      const tag=e.target.closest('[data-tournament-tag]');
      const reset=e.target.closest('[data-tournament-reset]');
      if(tournament||tag||reset){
        if(e.ctrlKey||e.metaKey||e.shiftKey||e.altKey||e.button>0)return;e.preventDefault();
        if(tournament)openTournament(tournament.dataset.openTournament);
        else if(tag){const [axis,value]=tag.dataset.tournamentTag.split(':');tournamentTagNavigate(axis,value,tag.dataset.tournamentContext)}
        else visitView({page:'tournaments',name:null,id:null,filters:tournamentDefaultFilters()});
        return;
      }
      const profile=e.target.closest('[data-open-profile]');
      if(profile){if(e.ctrlKey||e.metaKey||e.shiftKey||e.altKey||e.button>0)return;e.preventDefault();openProfile(profile.dataset.openProfile);return}
      const nav=e.target.closest('[data-page]');
      if(nav){if(e.ctrlKey||e.metaKey||e.shiftKey||e.altKey||e.button>0)return;e.preventDefault();navigate(nav.dataset.page);return}
      if(e.target.closest('[data-spotlight]')){$('#search-results').value='Karf';$('#region-filter').value='ME';$('#stage-filter').value='all';$('#prize-only').checked=false;navigate('results');return}
      const p=e.target.closest('[data-player]');if(p){selectedPlayer=p.dataset.player;$('#search-results').value=p.dataset.player;$('#region-filter').value='all';$('#stage-filter').value='all';$('#prize-only').checked=false;navigate('results')}
    });
    ['#region-filter','#stage-filter','#sort-results','#prize-only'].forEach(s=>$(s).addEventListener('input',renderResults));$('#search-results').addEventListener('input',()=>{selectedPlayer=null;renderResults()});$('#search-players').addEventListener('input',renderPlayers);$('#player-sort').addEventListener('change',renderPlayers);$('#export-csv').addEventListener('click',()=>download('asia-on-tour-results.csv',csvText(visible),'text/csv;charset=utf-8'));
    document.addEventListener('input',e=>{if(e.target.id==='tournament-query')updateTournamentFilters('q',e.target.value)});
    document.addEventListener('change',e=>{if(e.target.id==='season-select'){changeSeason(e.target.value);return}if(e.target.dataset.tournamentFilter)updateTournamentFilters(e.target.dataset.tournamentFilter,e.target.value)});
    selectedSeason=seasonFromUrl();
    refresh();
    initializeRouting();
  })().catch(err=>{
  console.error('ASIA ON TOUR could not initialize:',err);
  const notice=document.createElement('div');
  notice.setAttribute('role','alert');
  notice.style.cssText='background:#492129;color:#fff0e6;padding:16px 22px;font:14px sans-serif;position:relative;z-index:9999';
  notice.textContent='サイトデータを読み込めませんでした。GitHub Pagesで全ファイルを同じ場所に配置し、再読み込みしてください。';
  document.body.prepend(notice);
});
