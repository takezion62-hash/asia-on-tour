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
    function confirmedSkinReward(e){return e.verified===true&&['スキン大会','コスメ大会'].includes(e.kind)&&String(e.round||'').split(/[\/／·・|｜]/u).some(part=>/^(?:スキン|スキン報酬)獲得(?:済み)?$/.test(part.trim()))}
    function confirmedPrizeFinalRank(e){
      if(e.verified!==true||e.kind!=='賞金決勝'||!Number.isInteger(e.rank)||e.rank<1)return null;
      const t=classifyTournamentRecord(e);
      return /practice/i.test(t.subtype||'')||t.series==='skin-cup'?null:e.rank;
    }
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
      $('#ranking-completeness').textContent='このランキングは、ASIA ON TOURに掲載されている海外大会戦績をもとに集計しています。未掲載の大会があるため、選手の実際の全成績とは異なる場合があります。公式ランキングではありません。';
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
      return {...currentView,season:selectedSeason,scroll:window.scrollY||0,results:{search:$('#search-results').value,region:$('#region-filter').value,stage:$('#stage-filter').value,sort:$('#sort-results').value,prize:$('#prize-only').checked,player:selectedPlayer},players:{search:$('#search-players').value,sort:$('#player-sort').value},tournaments:{...tournamentBrowseFilters},journey:{...journeyState},ranking:{filters:{...rankingFilters},limit:rankingLimit}};
    }
    function restoreBrowseState(view){
      if(view.journey)journeyState={...view.journey};
      if(view.ranking){rankingFilters=sanitizeRankingFilters(view.ranking.filters);rankingLimit=Number.isInteger(view.ranking.limit)&&view.ranking.limit>=30?view.ranking.limit:30;}
      if(view.results){const r=view.results;$('#search-results').value=r.search;$('#region-filter').value=r.region;$('#stage-filter').value=r.stage;$('#sort-results').value=r.sort;$('#prize-only').checked=r.prize;selectedPlayer=r.player;}
      if(view.players){$('#search-players').value=view.players.search;$('#player-sort').value=view.players.sort;}
      if(view.tournaments)tournamentBrowseFilters=sanitizeTournamentFilters(view.tournaments);
    }
    function routeFromHash(){
      const hash=window.location.hash;
      if(hash.startsWith('#player=')){try{return {page:'profile',name:decodeURIComponent(hash.slice(8))}}catch{return {page:'profile',name:null,invalid:true}}}
      if(hash.startsWith('#tournament=')){try{return {page:'tournament',id:decodeURIComponent(hash.slice(12))}}catch{return {page:'tournament',id:null,invalid:true}}}
      if(hash==='#tournaments'||hash.startsWith('#tournaments?')){const params=new URLSearchParams(hash.split('?').slice(1).join('?'));return {page:'tournaments',filters:sanitizeTournamentFilters(Object.fromEntries(params))}}
      if(hash==='#players'||hash.startsWith('#players?')){const params=new URLSearchParams(hash.split('?').slice(1).join('?'));return {page:'players',ranking:{filters:sanitizeRankingFilters(Object.fromEntries(params)),limit:30}}}
      const page=hash.slice(1);
      return {page:['home','results','players','about'].includes(page)?page:'home',name:null};
    }
    function routeHash(view){
      if(view.page==='profile')return view.invalid?window.location.hash:profileHref(view.name||'');
      if(view.page==='tournament')return view.invalid?window.location.hash:tournamentHref(view.id||'');
      if(view.page==='tournaments')return tournamentSearchHash(view.filters);
      if(view.page==='players')return rankingSearchHash(view.ranking?.filters||rankingFilters);
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
      if(view.page==='players'){renderPlayers();renderRanking()}
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
    function navigate(page){visitView({page,name:null,id:null,...(page==='tournaments'?{filters:{...tournamentBrowseFilters}}:{}),...(page==='players'?{ranking:{filters:{...rankingFilters},limit:rankingLimit}}:{})})}
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

    // JOURNEY MODEL START
    // Membership is supplied by profileInfo's exact published roster names.
    // Dates have no start times: milestones and closing balances use day batches.
    function journeyDate(e){
      const value=e?.date;
      return typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value?value:null;
    }
    function buildJourney(events,history=events){
      const sort=(a,b)=>(journeyDate(a)||'9999').localeCompare(journeyDate(b)||'9999')||String(a.id||'').localeCompare(String(b.id||''));
      const ordered=events.filter(e=>e&&typeof e==='object').slice().sort(sort);
      const past=history.filter(e=>e&&typeof e==='object').slice().sort(sort);
      const reasons=new Map();
      const cash=e=>{const cents=Math.round(individualPrize(e)*100);return Number.isFinite(cents)?Math.max(0,cents):0};
      // A cosmetic event is not proof that a reward was earned. Only an explicit
      // obtained-skin label counts; placement/VR and reward rules are not inferred.
      const skinReward=confirmedSkinReward;
      const cashDatesKnown=past.every(e=>cash(e)===0||journeyDate(e));
      const skinDatesKnown=past.every(e=>!skinReward(e)||journeyDate(e));
      const firstCash=cashDatesKnown?journeyDate(past.find(e=>cash(e)>0)):null;
      const firstSkin=skinDatesKnown?journeyDate(past.find(skinReward)):null;
      let lifetimeCents=0;
      for(let i=0;i<past.length;){
        const date=journeyDate(past[i]);let end=i+1;
        while(end<past.length&&journeyDate(past[end])===date)end++;
        const batch=past.slice(i,end),previousCents=lifetimeCents;
        if(date)lifetimeCents+=batch.reduce((sum,e)=>sum+cash(e),0);
        const milestones=[];
        if(date&&cashDatesKnown){
          // $1k, $5k, $10k, $50k, $100k, ...; integer cents avoid rounding drift.
          for(let unit=100000;Number.isSafeInteger(unit)&&unit<=lifetimeCents;unit*=10){
            for(const multiple of [1,5]){
              const target=unit*multiple;
              if(Number.isSafeInteger(target)&&previousCents<target&&lifetimeCents>=target)milestones.push(`掲載記録の累計個人賞金 $${format(target/100)}到達`);
            }
          }
        }
        for(const e of batch){
          const labels=[];
          if(date){
            if(date===firstCash&&cash(e)>0)labels.push('サイト掲載初の賞金獲得日');
            if(cash(e)>0)labels.push(...milestones);
            if(date===firstSkin&&skinReward(e))labels.push('サイト掲載初のスキン報酬獲得日');
          }
          const finalRank=confirmedPrizeFinalRank(e);
          if(finalRank!==null&&finalRank<=3)labels.push(finalRank===1?'賞金決勝で総合優勝':'賞金決勝で総合TOP3');
          reasons.set(e.id,labels);
        }
        i=end;
      }
      let cents=0;
      const result=[];
      for(let i=0;i<ordered.length;){
        const date=journeyDate(ordered[i]);let end=i+1;
        while(end<ordered.length&&journeyDate(ordered[end])===date)end++;
        const batch=ordered.slice(i,end);cents+=batch.reduce((sum,e)=>sum+cash(e),0);
        for(const record of batch)result.push({record,reasons:reasons.get(record.id)||[],cash:cash(record)/100,cumulative:cents/100});
        i=end;
      }
      return result;
    }
    // JOURNEY MODEL END
    let journeyState={name:null,mode:'all',limit:30};
    function journeyMetric(n,rank=false){return typeof n==='number'&&Number.isFinite(n)?(rank?'#':'')+format(n):'未確認'}
    function journeyChart(rows){
      const days=new Map();let datedCents=0,undatedCents=0;
      for(const row of rows){
        const date=journeyDate(row.record);
        if(!date){undatedCents+=Math.round(row.cash*100);continue}
        datedCents+=Math.round(row.cash*100);days.set(date,datedCents/100);
      }
      const points=[...days].map(([date,total])=>({date,total})),total=(datedCents+undatedCents)/100;
      const max=Math.max(1,...points.map(p=>p.total));
      const start=points.length?Date.parse(points[0].date):0,end=points.length?Date.parse(points.at(-1).date):0;
      const x=p=>48+(end===start?0:(Date.parse(p.date)-start)/(end-start)*596);
      const y=p=>142-p.total/max*110;
      const line=points.map((p,i)=>`${i?'H '+x(p)+' V':'M '+x(p)} ${y(p)}`).join(' ');
      return `<section class="journey-chart" id="journey-chart" aria-labelledby="journey-chart-heading"><div class="journey-chart-heading"><div><h3 id="journey-chart-heading">掲載記録の累計個人賞金</h3><p>${escape(seasonScope())} · USD · 各日終了時点</p></div><strong data-journey-total>$${format(total)}</strong></div>${points.length?`<svg viewBox="0 0 680 190" role="img" aria-labelledby="journey-chart-svg-title journey-chart-svg-desc"><title id="journey-chart-svg-title">${escape(seasonScope())}の累計個人賞金推移</title><desc id="journey-chart-svg-desc">${escape(friendlyDate(points[0].date))}から${escape(friendlyDate(points.at(-1).date))}まで。日付が確認できる記録の累計は${format(datedCents/100)} USD。日別の数値は下の一覧から確認できます。</desc><path class="journey-chart-grid" d="M48 32H644 M48 87H644 M48 142H644"/><text x="48" y="21">$${format(max===1&&datedCents===0?0:max)}</text><path class="journey-chart-line" d="${line}"/>${points.length===1?`<circle cx="${x(points[0])}" cy="${y(points[0])}" r="4"/>`:''}<text x="48" y="175">${escape(friendlyDate(points[0].date))}</text><text x="644" y="175" text-anchor="end">${escape(friendlyDate(points.at(-1).date))}</text></svg><details class="journey-chart-data"><summary>日付ごとの累計を見る（${points.length}日）</summary><div><table><caption>選択期間の掲載記録から集計した日次累計（USD）</caption><thead><tr><th scope="col">日付</th><th scope="col">累計個人賞金</th></tr></thead><tbody>${points.map(p=>`<tr><th scope="row">${escape(friendlyDate(p.date))}</th><td>$${format(p.total)}</td></tr>`).join('')}</tbody></table></div></details>`:'<p class="journey-empty">日付が確認できる掲載記録はありません。</p>'}<p class="journey-chart-note">確認済みの個人分のみ。予選VR・スキン・未確認賞金は加算しません。表示モードを切り替えてもグラフの対象は変わりません。${undatedCents?` 日付未確認の$${format(undatedCents/100)}はグラフに含めていません。`:''}</p></section>`;
    }
    function journeyRecord(row,name){
      const e=row.record,date=journeyDate(e),t=classifyTournamentRecord(e),source=safeUrl(e.source);
      const partners=names(e).filter(n=>n!==name),skin=['コスメ大会','スキン大会'].includes(e.kind);
      const prize=row.cash>0?`$${format(row.cash)}`:e.prize===0?'$0':'未確認';
      const prizeNote=row.cash>0?'確認済み個人分':skin?'コスメ報酬・現金加算なし':e.kind==='予選'?'予選・現金加算なし':e.prize===0?'現金賞金なし':'個人現金賞金は未確認';
      return `<li class="journey-entry${row.cash>0?' is-prize-win':''}${skin?' is-cosmetic':''}" data-region="${escape(e.region)}" data-journey-record="${escape(e.id)}"><div class="journey-date">${date?`<time datetime="${escape(date)}">${escape(friendlyDate(date))}</time>`:'日付未確認'}${regionPill(regions.includes(e.region)?e.region:'未確認')}${seasonStamp(e)}</div><article class="journey-card"><div class="journey-record-top"><span class="journey-stage">${escape(e.kind||'区分未確認')}</span>${skin?'<span class="journey-cosmetic">コスメ大会 · 現金とは別</span>':''}<span class="journey-verification">${escape(verificationLabel(e))}</span></div><h3><a href="${escape(tournamentHref(t.id))}" data-open-tournament="${escape(t.id)}">${escape(e.event||'大会名未確認')} <span aria-hidden="true">↗</span></a></h3><p class="journey-round">${escape(e.round||'ラウンド未確認')}</p>${tournamentTags(e)}${row.reasons.length?`<ul class="journey-milestones" aria-label="掲載記録のハイライト">${row.reasons.map(reason=>`<li>${escape(reason)}</li>`).join('')}</ul>`:''}<dl class="journey-metrics"><div><dt>順位</dt><dd data-journey-metric="rank">${journeyMetric(e.rank,true)}</dd></div><div><dt>PTS</dt><dd data-journey-metric="points">${journeyMetric(e.points)}</dd></div><div><dt>KILLS</dt><dd data-journey-metric="kills">${journeyMetric(e.kills)}</dd></div><div><dt>VR</dt><dd data-journey-metric="vrs">${journeyMetric(e.vrs)}</dd></div><div class="journey-cash"><dt>個人賞金 / USD</dt><dd data-journey-metric="prize">${prize}</dd><small>${prizeNote}${partners.length&&typeof e.prize==='number'?` · チーム合計 $${format(e.prize)}${e.verified?'':'（未確認）'}`:''}</small></div></dl>${partners.length?`<p class="journey-partners">相方：${partners.map(n=>`<a href="${escape(profileHref(n))}" data-open-profile="${escape(n)}">${escape(n)}</a>`).join(' / ')}</p>`:''}<div class="journey-record-links">${source?`<a href="${escape(source)}" target="_blank" rel="noopener noreferrer">大会の出典を見る ↗</a>`:'出典URL未確認'}<a href="${escape(tournamentHref(t.id))}" data-open-tournament="${escape(t.id)}">大会別の戦績 →</a></div></article></li>`;
    }
    function journeyRows(info){return buildJourney(info.events,rawAll().filter(e=>names(e).includes(info.name)))}
    function journeySection(info){
      if(journeyState.name!==info.name)journeyState={name:info.name,mode:'all',limit:30};
      const rows=journeyRows(info);
      return `<section class="profile-journey" id="profile-journey" aria-labelledby="journey-title"><header class="journey-heading"><div><p class="profile-kicker">OVERSEAS JOURNEY</p><h2 id="journey-title" tabindex="-1">海外遠征<span>年表</span></h2><p>${escape(seasonScope())} · 古い日付から振り返る</p></div><a href="#profile-history-title" data-journey-history class="journey-history-jump">従来の大会履歴へ ↓</a></header><p class="journey-disclaimer">初賞金・初スキン報酬・賞金の節目は、全期間のサイト掲載記録上の出来事です。実際の初獲得や生涯記録を意味しません。同日の前後関係は未確認です。</p>${journeyChart(rows)}<div class="journey-controls" role="group" aria-label="年表の表示モード">${[['all','全戦績'],['highlights','ハイライト'],['prize','賞金獲得']].map(([mode,label])=>`<button type="button" id="journey-mode-${mode}" data-journey-mode="${mode}" aria-pressed="${journeyState.mode===mode}" aria-controls="journey-list">${label}</button>`).join('')}</div><p class="journey-comparison-note">初賞金・賞金決勝の総合TOP3・累計個人賞金の節目（$1,000・$5,000・$10,000など）・初スキン報酬を掲載します。節目は同日分をまとめ、日付不明の獲得がある場合は初獲得日や到達日を断定しません。VR・予選通過・Practice入賞だけでは掲載しません。</p><p id="journey-count" class="journey-count" aria-live="polite"></p><ol id="journey-list" class="journey-list" tabindex="-1"></ol><button id="journey-more" class="btn ghost journey-more" type="button" data-journey-more hidden>さらに30件表示</button></section>`;
    }
    function renderJourney(info=profileInfo(currentView.name)){
      if(!info||!$('#journey-list'))return;
      const rows=journeyRows(info).filter(row=>journeyState.mode==='prize'?row.cash>0:journeyState.mode==='highlights'?row.reasons.length>0:true),shown=rows.slice(0,journeyState.limit);
      $('#journey-list').innerHTML=shown.length?shown.map(row=>journeyRecord(row,info.name)).join(''):'<li class="journey-empty">この表示条件に一致する掲載記録はありません。</li>';
      $('#journey-count').textContent=`${format(rows.length)}件中 ${format(shown.length)}件を表示 · ${seasonScope()}`;
      $('#journey-more').hidden=shown.length>=rows.length;
      ['all','highlights','prize'].forEach(mode=>$('#journey-mode-'+mode)?.setAttribute('aria-pressed',String(mode===journeyState.mode)));
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
      $('#profile-content').innerHTML=`<div class="profile-toolbar"><button class="btn sm ghost" id="profile-back" data-profile-back type="button">← 戻る</button><a href="#journey-title" data-journey-jump>海外遠征年表へ ↓</a><a id="profile-share" href="${escape(shareUrl)}" title="このURLをコピーして共有できます">プロフィールのURL ↗</a></div><header class="profile-hero"><div><p class="profile-kicker">PLAYER PROFILE / ASIA OVERSEAS</p><div class="profile-identity"><div class="profile-avatar" aria-hidden="true">${escape(info.initials)}</div><div class="profile-identity-copy"><h1 class="profile-name" id="profile-title" tabindex="-1" data-profile="name">${escape(info.name)}</h1><p class="profile-alias-heading">確認済みの別名義</p><div class="profile-aliases" data-profile="aliases">${aliases}</div></div></div>${info.desc?`<p class="profile-description">${candidates.some(c=>c.name===info.name)?'<span class="season-biography-note">紹介文：CH7 S4時点</span>':''}${escape(info.desc)}</p>`:''}${external}</div><div class="profile-prize-total"><p class="profile-total-label">${escape(seasonPrizeLabel())}</p><div class="profile-total-value"><span data-profile="total">$${format(info.total)}</span><small>USD</small></div><p class="profile-total-hint">${escape(seasonScope())}の個人賞金累計<br>デュオは確認済みの個人分のみ集計<span class="profile-lifetime">全期間の確認済み個人賞金 <b data-profile="lifetime-total">$${format(info.lifetimeTotal)}</b></span></p></div></header><div class="profile-stats"><article class="profile-stat"><h2>賞金獲得記録</h2><div class="profile-stat-value"><span data-profile="prize-events">${format(info.prizeEvents)}</span><small>件</small></div><p class="profile-stat-context">個人賞金の獲得を確認した記録</p></article><article class="profile-stat"><h2>掲載されている海外戦績</h2><div class="profile-stat-value"><span data-profile="events">${format(info.events.length)}</span><small>件</small></div><p class="profile-stat-context">予選・決勝を含む全掲載記録</p></article>${profileBestCard('予選の最高順位',info.bestQualifying,'best-qualifying')}${profileBestCard('決勝の最高順位',info.bestFinal,'best-final')}</div>${journeySection(info)}<section aria-labelledby="profile-region-title"><div class="profile-region-heading"><div><h2 id="profile-region-title">地域別の<span>実績</span></h2><p>${visited?'戦績掲載地域':'海外大会の戦績はまだ掲載されていません'}</p></div><div class="profile-regions-visited" aria-label="海外挑戦地域">${visited}</div></div><div class="profile-region-charts">${profileRegionChart(info,'count')}${profileRegionChart(info,'prize')}</div></section><section aria-labelledby="profile-history-title"><div class="profile-history-heading"><div><h2 id="profile-history-title">海外大会<span>履歴</span></h2><p>${escape(seasonScope())} · 新しい順 · 賞金獲得記録は金色で表示</p></div><span class="profile-history-count">${format(info.events.length)}件</span></div><div class="profile-history">${info.events.length?info.events.map(e=>profileHistoryRow(e,info.name)).join(''):'<div class="profile-empty"><h3>海外大会の戦績はまだ未登録です</h3><p>選手名鑑には掲載されていますが、確認済みの海外大会記録はまだ掲載されていません。</p></div>'}</div></section>`;
      renderJourney(info);
      return true;
    }

    function renderEarner(p,index,compact=false){return `<a class="earner" href="${escape(profileHref(p.name))}" data-open-profile="${escape(p.name)}"><span class="position">#${p.rank??index+1}</span><span class="earner-name">${escape(p.name)}</span><strong class="amount">$${format(p.total)}</strong>${compact?'':`<span class="earner-events">賞金獲得 ${p.events}件 ↗</span>`}</a>`}
    let rankingFilters={...AsiaRankings.DEFAULT_FILTERS},rankingLimit=30;
    function rankingSeries(){return tournamentAxes.find(axis=>axis.key==='series')?.options||[]}
    function sanitizeRankingFilters(filters={}){return AsiaRankings.sanitizeFilters(filters,{series:rankingSeries().map(option=>option.id)})}
    function rankingSearchHash(filters=rankingFilters){
      const values=sanitizeRankingFilters(filters),params=new URLSearchParams();
      for(const key of Object.keys(AsiaRankings.DEFAULT_FILTERS))if(values[key]!==AsiaRankings.DEFAULT_FILTERS[key])params.set(key,values[key]);
      return '#players'+(params.size?'?'+params.toString():'');
    }
    function rankingFinalLabel(kind){return kind==='決勝'?'その他の決勝（賞金区分未確認）':kind==='all'?'すべての掲載済み決勝':kind}
    function rankingDefinition(metric){
      return {
        prize:'確認済みの個人現金賞金だけを合計します。デュオは確認済みの個人配分を使い、予選・スキン報酬・未確認賞金は含めません。',
        prizeCount:'確認済みの個人現金賞金を獲得した掲載記録の件数です。デュオは各選手に1件、予選・スキン報酬・未確認賞金は対象外です。',
        finals:'確認済みで順位・ポイントなどの実戦績が掲載された決勝記録の件数です。予選通過や出場報告だけの記録は含めません。賞金・Practice・Performance・その他の決勝を区別して表示します。未収録の出場は含みません。',
        wins:'確認済みの賞金決勝で総合順位が1位の掲載記録です。試合単位のVR、予選・Practice・Performance・スキン大会の1位は含めません。',
        podiums:'確認済みの賞金決勝で総合順位が1〜3位の掲載記録です。順位未確認、予選・Practice・Performance・スキン大会の順位は含めません。',
        vrs:'確認済みの掲載戦績にあるVRの合計です。予選・決勝・コスメ大会を含みます。デュオ等のVRはチームとしての獲得を各選手に付与しており、個人の単独勝利回数とは異なります。未確認のVRは合計せず、確認済み0VRと区別します。',
        regions:'選択期間・大会形式・シリーズに掲載記録がある開催地域の種類数です。同じ地域は何件あっても1地域として数えます。全地域を選択したときだけ利用できます。',
        skins:'確認済みのスキン報酬獲得が明記された掲載記録だけを数えます。旧表記のコスメ大会にも対応し、参加や順位だけでは獲得を推測しません。現金賞金には加算しません。'
      }[metric];
    }
    function rankingRow(player,metric){
      const amount=metric.id==='prize'?'$'+format(player.value):format(player.value)+' '+metric.unit;
      const facts=[];
      if(metric.id==='vrs'){
        facts.push(`確認済み ${format(player.knownRecords)}件`, `未確認 ${format(player.unknownRecords)}件（合計対象外）`);
        if(player.teamRecords)facts.push(`チーム戦 ${format(player.teamRecords)}件を含む`);
      }
      if(metric.id==='finals')facts.push(...AsiaRankings.FINAL_KINDS.filter(kind=>player.finalKinds[kind]>0).map(kind=>`${kind==='決勝'?'その他の決勝':kind} ${format(player.finalKinds[kind])}件`));
      if(metric.id==='regions')facts.push(player.regions.join(' / '));
      return `<div role="listitem"><a class="earner" href="${escape(profileHref(player.name))}" data-open-profile="${escape(player.name)}" data-ranking-player="${escape(player.name)}" data-ranking-value="${escape(player.value)}" data-ranking-rank="${escape(player.rank)}" data-ranking-top="${player.rank<=3}"><span class="position" aria-label="${escape(player.rank)}位">#${format(player.rank)}</span><span class="earner-name">${escape(player.name)}</span><strong class="amount">${escape(amount)}</strong><span class="earner-events">${['prize','prizeCount'].includes(metric.id)?`賞金獲得 ${format(player.prizeEvents)}件`:`掲載 ${format(player.knownRecords)}件`} ↗</span>${facts.length?`<small class="ranking-row-note">${escape(facts.join(' · '))}</small>`:''}</a></div>`;
    }
    function renderRanking(){
      rankingFilters=sanitizeRankingFilters(rankingFilters);
      const report=AsiaRankings.buildRankings(all(),rankingFilters,{names,individualPrize,classifyTournamentRecord,confirmedPrizeFinalRank,confirmedSkinReward,series:rankingSeries().map(option=>option.id)});
      const metric=AsiaRankings.METRICS.find(item=>item.id===rankingFilters.metric),shown=report.rows.slice(0,rankingLimit),unknown=report.unranked.slice(0,rankingLimit);
      $('#ranking-title').textContent=metric.label+'ランキング';
      $('#ranking-season-description').textContent='掲載記録を条件別に集計 · 同値は同順位（1位・1位・3位）';
      $('#ranking-metric-title').textContent=metric.label;
      $('#ranking-metric').value=metric.id;$('#ranking-mode').value=rankingFilters.mode;
      $('#ranking-series').innerHTML='<option value="all">全シリーズ</option>'+rankingSeries().map(option=>`<option value="${escape(option.id)}"${option.id===rankingFilters.series?' selected':''}>${escape(option.label)}</option>`).join('');
      $('#ranking-series').value=rankingFilters.series;
      $('#ranking-final-kind').value=rankingFilters.finalKind;$('#ranking-final-field').hidden=metric.id!=='finals';
      $('#ranking-metric-regions').disabled=rankingFilters.region!=='all';$('#ranking-metric-regions').hidden=rankingFilters.region!=='all';
      for(const region of ['all',...regions])$('#ranking-region-'+region).setAttribute('aria-pressed',String(region===rankingFilters.region));
      const regionLabel=rankingFilters.region==='all'?'全地域（ALL）':rankingFilters.region;
      const modeLabel=rankingFilters.mode==='all'?'全形式':rankingFilters.mode==='battle-royale'?'通常バトルロイヤル':tournamentLabel('mode',rankingFilters.mode);
      const seriesLabel=rankingFilters.series==='all'?'全シリーズ':tournamentLabel('series',rankingFilters.series);
      $('#ranking-scope').textContent=`集計対象：${seasonScope()} · ${regionLabel} · ${modeLabel} · ${seriesLabel}${metric.id==='finals'?' · '+rankingFinalLabel(rankingFilters.finalKind):''}`;
      $('#ranking-definition').textContent=rankingDefinition(metric.id);
      $('#player-earnings-sum').textContent='$'+format(report.totalPrize);
      $('#ranking-count').textContent=`${format(report.rows.length)}名中 ${format(shown.length)}名を表示 · 対象 ${format(report.recordCount)}戦績${report.unranked.length?' · VR未確認のみ '+format(report.unranked.length)+'名は順位なし':''}`;
      $('#player-earnings-leaders').innerHTML=shown.length?shown.map(player=>rankingRow(player,metric)).join(''):report.unranked.length?'<div class="empty" role="listitem"><b>VRを確認できる掲載記録はありません</b><p>未確認の選手は下の一覧に、順位なしで表示しています。</p></div>':'<div class="empty" role="listitem"><b>この条件に一致する掲載実績はありません</b><p>地域・大会形式・集計期間を変更して確認できます。</p></div>';
      $('#ranking-unknown').hidden=!report.unranked.length;
      $('#ranking-unknown').innerHTML=report.unranked.length?`<summary>VR未確認のみの選手 ${format(report.unranked.length)}名（順位なし）</summary><p>確認できるVR値がないため、0VRとは表示していません。</p><ul>${unknown.map(player=>`<li><a href="${escape(profileHref(player.name))}" data-open-profile="${escape(player.name)}" data-ranking-unknown-player="${escape(player.name)}">${escape(player.name)}</a> · VR未確認 ${format(player.unknownRecords)}件</li>`).join('')}</ul>${unknown.length<report.unranked.length?'<p>さらに表示ボタンで続きを表示できます。</p>':''}`:'';
      $('#ranking-more').hidden=shown.length>=report.rows.length&&unknown.length>=report.unranked.length;
      $('#ranking-integrity').hidden=!report.duplicateCount;
      $('#ranking-integrity').textContent=report.duplicateCount?`選択シーズン全体で重複する ${format(report.duplicateCount)}件を集計対象から除外しました。${report.conflictingDuplicateCount?'内容が一致しない重複IDの記録は、対応確認までいずれも加算していません。':''}`:'';
    }
    function updateRankingFilter(key,value){
      rankingFilters=sanitizeRankingFilters({...rankingFilters,[key]:value});rankingLimit=30;
      renderRanking();
      window.history.replaceState({aot:true,depth:routeDepth,view:captureView()},'',rankingSearchHash());routedHash=window.location.hash;
    }
    function renderEarnings(){
      const ranked=prizeTotals();let position=0;
      const leaders=ranked.map((player,index)=>{if(!index||player.total!==ranked[index-1].total)position=index+1;return {...player,rank:position}});
      $('#home-earnings-sum').textContent='$'+format(ranked.reduce((sum,player)=>sum+player.total,0));
      $('#home-earnings-leaders').innerHTML=leaders.length?leaders.slice(0,5).map((player,index)=>renderEarner(player,index,true)).join(''):'<div class="empty">賞金獲得の確定記録はまだないよ</div>';
      renderRanking();
    }

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
      const rankingRegion=e.target.closest('[data-ranking-region]');
      if(rankingRegion&&currentView.page==='players'){updateRankingFilter('region',rankingRegion.dataset.rankingRegion);return}
      if(e.target.closest('[data-ranking-more]')&&currentView.page==='players'){rankingLimit+=30;renderRanking();return}
      if(e.target.closest('[data-journey-jump]')){e.preventDefault();$('#journey-title')?.focus?.({preventScroll:true});$('#profile-journey')?.scrollIntoView?.({behavior:'instant',block:'start'});return}
      const journeyMode=e.target.closest('[data-journey-mode]');
      if(journeyMode&&currentView.page==='profile'){
        if(['all','highlights','prize'].includes(journeyMode.dataset.journeyMode)){journeyState.mode=journeyMode.dataset.journeyMode;journeyState.limit=30;renderJourney()}
        return;
      }
      if(e.target.closest('[data-journey-more]')&&currentView.page==='profile'){journeyState.limit+=30;renderJourney();return}
      if(e.target.closest('[data-journey-history]')){e.preventDefault();$('#profile-history-title')?.scrollIntoView?.({behavior:'smooth',block:'start'});return}

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
    document.addEventListener('change',e=>{if(e.target.id==='season-select'){changeSeason(e.target.value);return}const rankingKey={'ranking-metric':'metric','ranking-mode':'mode','ranking-series':'series','ranking-final-kind':'finalKind'}[e.target.id];if(rankingKey&&currentView.page==='players'){updateRankingFilter(rankingKey,e.target.value);return}if(e.target.dataset.tournamentFilter)updateTournamentFilters(e.target.dataset.tournamentFilter,e.target.value)});
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
