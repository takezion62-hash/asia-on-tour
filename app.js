(async () => {
    'use strict';
    const baseUrl=new URL('.',document.currentScript?.src||document.baseURI);
    const loadJSON=async filename=>{
      const response=await fetch(new URL(filename,baseUrl),{cache:'no-cache'});
      if(!response.ok)throw new Error(filename+' could not be loaded (HTTP '+response.status+')');
      return response.json();
    };
    const [records,playerData,tournamentData,updateData,scheduleData,historyCalendarIndex]=await Promise.all([
      loadJSON('results.json'),loadJSON('players.json'),loadJSON('tournaments.json'),loadJSON('updates.json'),loadJSON('schedule.json'),loadJSON('calendar-history-index.json')
    ]);
    const siteData={results:records,players:playerData,tournaments:tournamentData,updates:updateData,schedule:scheduleData,calendarHistory:historyCalendarIndex};
    if(!Array.isArray(siteData.results)||!Array.isArray(siteData.players.candidates)||!Array.isArray(siteData.tournaments.catalog)||!Array.isArray(siteData.updates.entries)||!Array.isArray(siteData.schedule.sessions)||!Array.isArray(siteData.calendarHistory.months))
      throw new Error('Invalid ASIA ON TOUR data files');

    // CH7S4 / Override · 2026-08-20 through 2026-10-18 (snapshot, not exhaustive)
    // Every record includes the intended match-region in its source round ID; some official result URLs use a generic region query parameter.
    const builtIn=siteData.results;
    const updateEntries=siteData.updates?.entries||[];
    const candidates=siteData.players.candidates;
    const regions=['ME','EU','NAC','NAW','OCE','BR'];
    const $=s=>document.querySelector(s);
    const rawAll=()=>builtIn;
    let selectedSeason='S43';
    // Published records are immutable during a page session. Reuse each season's
    // filtered array instead of scanning the entire archive on every UI render.
    const seasonRowsCache=new Map();
    const all=()=>{
      if(selectedSeason==='all')return rawAll();
      if(!seasonRowsCache.has(selectedSeason)){
        seasonRowsCache.set(selectedSeason,rawAll().filter(e=>recordSeason(e).id===selectedSeason));
      }
      return seasonRowsCache.get(selectedSeason);
    };
    const seasonPlayerIndexes=new WeakMap();
    function seasonPlayerIndex(){
      const rows=all();
      if(!seasonPlayerIndexes.has(rows)){
        const byName=new Map();
        for(const row of rows){
          for(const name of new Set(names(row))){
            if(!byName.has(name))byName.set(name,[]);
            byName.get(name).push(row);
          }
        }
        seasonPlayerIndexes.set(rows,{byName});
      }
      return seasonPlayerIndexes.get(rows);
    }
    const escape=s=>String(s??'').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const format=n=>typeof n==='number'&&Number.isFinite(n)?n.toLocaleString('ja-JP'):'—';
    const names=e=>Array.isArray(e.players)&&e.players.length?e.players:[e.player];
    const verificationLabel=e=>e.reported?'報告あり・詳細未確認':e.partial?'通過確認・詳細未確認':e.verified?'出典確認':'詳細未確認';
    const rankLabel=e=>Number.isInteger(e.rank)?'#'+format(e.rank):e.reported?'確認中':'通過';
    const prizeLabel=e=>typeof e.prize==='number'?('$'+format(e.prize)+(e.prizePerPlayer?' チーム合計（各$'+format(e.prizePerPlayer)+'）':'')):'—';

    // Only explicitly verified cash payouts are counted. A duo payout MUST have
    // a known per-player share, otherwise it is not assigned to individuals.
    const isPrizeWin=e=>typeof e.prize==='number'&&e.prize>0&&e.verified===true&&!['予選','コスメ大会','スキン大会','Test Cup'].includes(e.kind);
    const individualPrize=e=>{
      if(!isPrizeWin(e))return 0;
      const roster=names(e);
      if(roster.length===1)return e.prize;
      if(typeof e.prizePerPlayer!=='number'||!Number.isFinite(e.prizePerPlayer)||e.prizePerPlayer<=0)return 0;
      if(e.prizePerPlayer*roster.length>e.prize+0.001)return 0;
      return e.prizePerPlayer;
    };
    // WeakMap caches follow the immutable array identity. Both ranking summaries
    // and hundreds of player cards can share one prize calculation per season.
    const prizeTotalsCache=new WeakMap();
    const prizeLookupCache=new WeakMap();
    function prizeTotals(rows=all()){
      const previous=prizeTotalsCache.get(rows);
      if(previous)return previous;
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
      const ranked=[...totals.values()].sort((a,b)=>b.total-a.total||b.events-a.events||a.name.localeCompare(b.name,'ja'));
      prizeTotalsCache.set(rows,ranked);
      return ranked;
    }
    function playerPrizeTotal(name,rows=all()){
      if(!prizeLookupCache.has(rows)){
        prizeLookupCache.set(rows,new Map(prizeTotals(rows).map(p=>[p.name,p.total])));
      }
      return prizeLookupCache.get(rows).get(name)||0;
    }
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
    const currentSeasonId='S43';
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
    let cachedSeasonOptions=null;
    function seasonOptions(){
      if(cachedSeasonOptions)return cachedSeasonOptions;
      const registered=new Map(rawAll().map(e=>{const info=recordSeason(e);return [info.id,info]}));
      cachedSeasonOptions=[{id:'all',label:'全期間'},...[...registered.values()].filter(s=>s.id!=='unknown').sort((a,b)=>b.chapter-a.chapter||b.season-a.season||a.id.localeCompare(b.id)),...(registered.has('unknown')?[unknownSeason()]:[])];
      return cachedSeasonOptions;
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
    const candidateNames=new Set(candidates.map(p=>p.name));
    function selectedSeasonPlayers(){
      const active=seasonPlayerIndex().byName;
      return playerRegistry().filter(p=>selectedSeason==='all'||active.has(p.name)||(selectedSeason===currentSeasonId&&candidateNames.has(p.name)));
    }
    function renderSeasonControl(){
      const scope=seasonScope();
      $('#season-select').innerHTML=seasonOptions().map(s=>`<option value="${escape(s.id)}"${s.id===selectedSeason?' selected':''}>${escape(s.label)}</option>`).join('');
      $('#season-select').value=selectedSeason;
      $('#season-scope').textContent=`集計対象：${scope}`;
      $('#home-season-label').textContent=selectedSeason==='all'?'ALL SEASONS · OVERSEAS ARCHIVE':`${seasonLabel()} · OVERSEAS ARCHIVE`;
      $('#home-season-description').textContent=`${scope}の海外サーバー挑戦を記録する`;
      $('#archive-season-description').textContent=`${scope}の海外大会アーカイブ。掲載済みの戦績を検索・閲覧できます。`;
      $('#players-season-description').textContent=`${scope}の掲載選手。今シーズンは追跡対象の選手を戦績0件でも表示します。紹介文は作成時点の情報で、集計値は選択期間に対応します。`;
      $('#home-earnings-title').innerHTML=`🏆 ${escape(seasonPrizeLabel())} <span style="color:#e8c383">TOP 5</span>`;
      $('#ranking-season-description').textContent=`${scope} · 個人の確認済み賞金額（USD）`;
      $('#ranking-completeness').textContent='このランキングは、ASIA ON TOURに掲載されている海外大会戦績をもとに集計しています。未掲載の大会があるため、選手の実際の全成績とは異なる場合があります。公式ランキングではありません。';
    }
    function changeSeason(value){
      const nextSeason=sanitizeSeason(value);
      if(nextSeason===selectedSeason)return;
      const previous=captureView();
      window.history.replaceState({aot:true,depth:routeDepth,view:previous},'',window.location.href);
      const next={...previous,season:nextSeason,results:{...previous.results,page:1}};
      archivePage=1;
      selectedSeason=nextSeason;
      // A different season may have no sessions in the old calendar month.
      if(next.page==='calendar'){
        const latestResult=all().map(e=>e.date).filter(validCalendarDate).sort().at(-1)||'';
        next.calendar={...sanitizeCalendarFilters(next.calendar),month:latestResult?latestResult.slice(0,7):calendarDefaultMonth(),date:latestResult};
        calendarBrowse={...next.calendar};
      }
      const url=new URL(window.location.href);url.searchParams.set('season',nextSeason);
      if(next.page==='calendar')url.hash=calendarHash(next.calendar);
      routeDepth++;
      window.history.pushState({aot:true,depth:routeDepth,view:next},'',url.href);
      refresh();showView(next,true);
    }

    const tournamentForRecord=classifyTournamentRecord;
    const tournamentDefaultFilters=()=>({series:'all',mode:'all',subtype:'all',team:'all',platform:'all',stage:'all',q:''});
    let tournamentBrowseFilters=tournamentDefaultFilters();
    function tournamentLabel(axis,value){return tournamentAxes.find(a=>a.key===axis)?.options.find(o=>o.id===value)?.label||'未確認'}
    const tournamentAxisValues=(t,key)=>key==='series'?[t.series,...(Array.isArray(t.additionalSeries)?t.additionalSeries:[])]:[t[key]];
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

    // Round labels describe the session; advancement and cash are per-player outcomes.
    // Keep explicit advancement evidence on each record (and in AotPR) while sharing
    // one calendar/tournament session for the same qualifying leaderboard.
    // A tournament session is a single leaderboard, regardless of the player's
    // cash/qualification/cosmetic outcome. Do not merge distinct numbered rounds.
    function canonicalTournamentRound(round,kind,tournamentId,date,region){
      let label=String(round||'').trim();
      if(tournamentId==='ch7s1-one-million-unreal-cup'&&/^(?:Session\s*1|単一開催枠)\s*\//iu.test(label))
        return 'Session 1 / 賞金決勝';
      if(['ch7s3-champion-aphrodite-fncs-cup-battle-royale','ch7s4-madison-beer-icon-cup-reload','ch7s5-one-piece-zoro-cup-battle-royale','ch7s5-one-piece-zoro-mobile-cup'].includes(tournamentId)
         &&/^(?:Session\s*1|単一開催枠)\s*\//iu.test(label))
        return 'Session 1 / スキン大会';
      if(tournamentId==='ch7s2-fncs-division-1'
         &&/^Week\s*\d+\s*·\s*Final\s*\//iu.test(label))
        return label.replace(/\/\s*(?:参加確認|賞金決勝)$/u,'/ 賞金決勝');
      if(kind==='予選')label=label.replace(/\/\s*予選(?:突破|通過)$/u,'/ 予選');
      const unnamed=label.match(/^Round\s*(\d+)\s*\/\s*賞金決勝（Event番号未確認）$/iu);
      if(unnamed&&date&&region&&tournamentId){
        // Adopt a numbered event ONLY when this date/region/tournament has exactly
        // one explicit match. Preserve uncertainty when multiple events exist.
        const numbered=new Set(rawAll().filter(x=>x.date===date&&x.region===region
          &&classifyTournamentRecord(x).id===tournamentId)
          .map(x=>String(x.round||'').match(new RegExp('^(Event\\s*\\d+\\s*·\\s*Round\\s*'+Number(unnamed[1])+')\\s*\\/','i'))?.[1])
          .filter(Boolean));
        if(numbered.size===1)label=[...numbered][0]+' / 賞金決勝';
      }
      if(kind==='決勝'&&/\/\s*(?:決勝(?:（賞金なし）)?|本戦（賞金なし）)$/u.test(label)){
        const series=tournamentCatalog.find(t=>t.id===tournamentId)?.series;
        if(['victory-cup','cash-cup','unreal-cup','playstation-cup'].includes(series)
          &&/(?:Round\s*2|Final|Session\s*1)/iu.test(label))
          label=label.replace(/\/\s*(?:決勝(?:（賞金なし）)?|本戦（賞金なし）)$/u,'/ 賞金決勝');
      }
      return label;
    }
    function canonicalTournamentKind(kind,tournamentId,round){
      if(tournamentId==='ch7s1-one-million-unreal-cup'&&/^(?:Session\s*1|単一開催枠)\s*\//iu.test(String(round||'')))return '賞金決勝';
      if(['ch7s3-champion-aphrodite-fncs-cup-battle-royale','ch7s4-madison-beer-icon-cup-reload','ch7s5-one-piece-zoro-cup-battle-royale','ch7s5-one-piece-zoro-mobile-cup'].includes(tournamentId)
        &&/^(?:Session\s*1|単一開催枠)\s*\//iu.test(String(round||'')))return 'スキン大会';
      if(tournamentId==='ch7s2-fncs-division-1'
        &&/^Week\s*\d+\s*·\s*Final\s*\//iu.test(String(round||'')))return '賞金決勝';
      if(kind==='決勝'){
        const series=tournamentCatalog.find(t=>t.id===tournamentId)?.series;
        if(['victory-cup','cash-cup','unreal-cup','playstation-cup'].includes(series)
          &&/(?:Round\s*2|Final|Session\s*1)/iu.test(String(round||'')))return '賞金決勝';
      }
      return kind;
    }
    // Calendar-only result scope; other tournament links remain full archive.
    function tournamentSessionScope(value,tournamentId=''){
      if(!value||!validCalendarDate(value.date)||!regions.includes(value.region)
         ||typeof value.round!=='string'||!value.round.trim()
         ||typeof value.kind!=='string'||!value.kind.trim())return null;
      const id=tournamentId||value.tournamentId||value.id||'';
      return {date:value.date,region:value.region,
        round:canonicalTournamentRound(value.round,value.kind,id,value.date,value.region),
        kind:canonicalTournamentKind(value.kind,id,value.round)};
    }
    function tournamentSessionKey(value){
      const session=tournamentSessionScope(value);
      return session?JSON.stringify([session.date,session.region,session.round,session.kind]):'';
    }
    function tournamentRecordInScope(row,scope){
      if(row.date!==scope.date||row.region!==scope.region)return false;
      const id=classifyTournamentRecord(row).id;
      return canonicalTournamentRound(row.round,row.kind,id,row.date,row.region)
          ===canonicalTournamentRound(scope.round,scope.kind,id,scope.date,scope.region)
        &&canonicalTournamentKind(row.kind,id,row.round)===canonicalTournamentKind(scope.kind,id,scope.round);
    }
    function tournamentHref(id,session=null,dateFilter=''){
      const base='#tournament='+encodeURIComponent(id),scope=tournamentSessionScope(session,id);
      if(scope){
        const params=new URLSearchParams();
        for(const key of ['date','region','round','kind'])params.set(key,scope[key]);
        return base+'?'+params.toString();
      }
      return validCalendarDate(dateFilter)?base+'?date='+encodeURIComponent(dateFilter):base;
    }
    function tournamentSearchHref(axis,value,context=currentView.page==='tournaments'){const base=context?{...currentView.filters}:tournamentDefaultFilters();base[axis]=base[axis]===value?'all':value;return tournamentSearchHash(base)}
    function tournamentTags(e){const t=classifyTournamentRecord(e);return `<div class="tournament-tags" data-record-classification="${escape(e.id)}">${tournamentAxes.flatMap(axis=>tournamentAxisValues(t,axis.key).map(value=>`<a class="tournament-tag${value==='unknown'?' is-unknown':''}" data-axis="${escape(axis.key)}" data-tournament-tag="${escape(axis.key+':'+value)}" href="${escape(tournamentSearchHref(axis.key,value,false))}" title="${escape(axis.label+'：'+tournamentLabel(axis.key,value))}"><span class="sr-only">${escape(axis.label)}：</span>${escape(tournamentLabel(axis.key,value))}</a>`)).join('')}</div>`}
    function tournamentRecordsMatch(e,filters,skipAxis){
      const t=classifyTournamentRecord(e);
      return tournamentAxes.every(axis=>axis.key===skipAxis||filters[axis.key]==='all'||tournamentAxisValues(t,axis.key).includes(filters[axis.key]))&&(filters.stage==='all'||e.kind===filters.stage)&&(!filters.q||[t.name,...tournamentAxes.flatMap(a=>tournamentAxisValues(t,a.key).map(value=>tournamentLabel(a.key,value))),t.seasonId].some(s=>String(s).toLowerCase().includes(filters.q.trim().toLowerCase())));
    }
    function tournamentFilterCounts(axis,filters={}){
      const f=sanitizeTournamentFilters(filters);return (tournamentAxes.find(a=>a.key===axis)?.options||[]).map(o=>({id:o.id,label:o.label,count:all().filter(e=>tournamentRecordsMatch(e,f,axis)&&tournamentAxisValues(classifyTournamentRecord(e),axis).includes(o.id)).length}));
    }
    function tournamentSessions(t,records){
      const groups=new Map();
      for(const e of records){
        const source=tournamentSource(e);
        const round=canonicalTournamentRound(e.round,e.kind,t.id,e.date,e.region);
        const kind=canonicalTournamentKind(e.kind,t.id,e.round);
        const explicitLabel=/(?:Event|Day|Week|Session)\s*\d+/i.test(round);
        const uncertain=!source.roundId&&!explicitLabel;
        const sourceId=source.roundId||(explicitLabel?'label:'+round:'unknown-round');
        // Without a source window, use the shared date/region/round label rather
        // than creating one bogus session card per player ID.
        const key=JSON.stringify([t.id,e.region,e.date,round||null,kind||null,explicitLabel?'labeled':sourceId]);
        if(!groups.has(key))groups.set(key,{id:key,label:round||'ラウンド未確認',region:e.region,date:e.date,round,kind,sourceId,uncertain,records:[]});
        else if(source.roundId&&!groups.get(key).sourceId?.startsWith('S'))groups.get(key).sourceId=source.roundId;
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

    // Archive dates and official future session times are different sources;
    // scheduled sessions have their own JST dates and never become results.
    const validCalendarDate=date=>{
      if(typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date))return false;
      const [year,month,day]=date.split('-').map(Number);
      return year>=2000&&year<=2100&&month>=1&&month<=12&&new Date(Date.UTC(year,month-1,day)).toISOString().slice(0,10)===date;
    };
    function calendarTokyoToday(){
      const parts=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
      const value=type=>parts.find(part=>part.type===type)?.value||'';
      return value('year')+'-'+value('month')+'-'+value('day');
    }
    function calendarDefaultMonth(){
      const today=calendarTokyoToday().slice(0,7);
      const dates=all().map(e=>e.date).filter(validCalendarDate).sort();
      const upcoming=siteData.schedule.sessions.filter(e=>validCalendarDate(e.dateJst)&&e.dateJst>=today).map(e=>e.dateJst).sort();
      if(upcoming.some(date=>date.startsWith(today)))return today;
      return dates.some(date=>date.startsWith(today))?today:upcoming[0]?.slice(0,7)||dates.at(-1)?.slice(0,7)||today;
    }
    const calendarDefaultFilters=()=>({month:calendarDefaultMonth(),date:'',region:'all',series:'all',mode:'all',stage:'all',scope:'all'});
    let calendarBrowse={month:'',date:'',region:'all',series:'all',mode:'all',stage:'all',scope:'all'};
    function sanitizeCalendarFilters(value={}){
      const f=calendarDefaultFilters();
      if(typeof value.month==='string'&&/^(20\d{2}|2100)-(0[1-9]|1[0-2])$/.test(value.month))f.month=value.month;
      if(validCalendarDate(value.date)&&value.date.startsWith(f.month+'-'))f.date=value.date;
      if(regions.includes(value.region))f.region=value.region;
      for(const axis of ['series','mode'])
        if(tournamentAxes.find(item=>item.key===axis)?.options.some(option=>option.id===value[axis])||(axis==='series'&&value[axis]==='ranked-cup'))f[axis]=value[axis];
      if(rawAll().some(e=>e.kind===value.stage)||value.stage==='単一ラウンド')f.stage=value.stage;
      if(['all','scheduled','results'].includes(value.scope))f.scope=value.scope;
      return f;
    }
    function calendarHash(filters={}){
      const f=sanitizeCalendarFilters(filters),params=new URLSearchParams();
      params.set('month',f.month);
      for(const key of ['date','region','series','mode','stage','scope'])if(f[key]&&f[key]!=='all')params.set(key,f[key]);
      return '#calendar?'+params.toString();
    }
    function calendarShiftMonth(month,offset){
      const [year,m]=month.split('-').map(Number);
      const date=new Date(Date.UTC(year,m-1+offset,1));
      return date.getUTCFullYear()+'-'+String(date.getUTCMonth()+1).padStart(2,'0');
    }
    function calendarSessions(filters){
      const groups=new Map();
      for(const record of all()){
        if(!validCalendarDate(record.date)||!record.date.startsWith(filters.month+'-'))continue;
        if(filters.region!=='all'&&record.region!==filters.region)continue;
        const info=classifyTournamentRecord(record);
        const kind=canonicalTournamentKind(record.kind,info.id,record.round);
        if(filters.stage!=='all'&&record.kind!==filters.stage&&kind!==filters.stage)continue;
        if(filters.series!=='all'&&!tournamentAxisValues(info,'series').includes(filters.series))continue;
        if(filters.mode!=='all'&&info.mode!==filters.mode)continue;
        const round=canonicalTournamentRound(record.round,record.kind,info.id,record.date,record.region);
        const key=JSON.stringify([record.date,record.region,info.id,round||'',kind||'']);
        if(!groups.has(key))groups.set(key,{date:record.date,region:record.region,id:info.id,name:info.name,round:round||'ラウンド未確認',kind:kind||'区分未確認',records:[]});
        groups.get(key).records.push(record);
      }
      return [...groups.values()].sort((a,b)=>a.date.localeCompare(b.date)||regions.indexOf(a.region)-regions.indexOf(b.region)||a.name.localeCompare(b.name,'ja')||a.round.localeCompare(b.round,'ja'));
    }
    function calendarSelectMarkup(label,key,options,selected){
      return '<div class="calendar-filter-field"><label for="calendar-'+key+'">'+escape(label)+'</label><select id="calendar-'+key+'" data-calendar-filter="'+escape(key)+'">'
        +options.map(option=>'<option value="'+escape(option.id)+'"'+(option.id===selected?' selected':'')+'>'+escape(option.label)+'</option>').join('')+'</select></div>';
    }

    // Distinct scheduled sessions: never passed to AOT PR, player profiles,
    // prize totals, tournament histories, achievements or registered results.
    // Read calendar history a month at a time, so the 11k+ historic sessions do
    // not slow down every visit to the homepage or a player profile.
    const calendarHistoryCache=new Map(),calendarHistoryLoading=new Set();
    function ensureCalendarHistoryMonth(month){
      if(calendarHistoryCache.has(month)||calendarHistoryLoading.has(month))return;
      const entry=siteData.calendarHistory.months.find(x=>x.month===month);
      if(!entry){calendarHistoryCache.set(month,[]);return}
      calendarHistoryLoading.add(month);
      loadJSON('calendar-history/'+month+'.json').then(data=>{
        if(data.version!==1||data.month!==month||!Array.isArray(data.sessions)||data.sessions.some(x=>x.dateJst.slice(0,7)!==month))throw Error('Invalid historic calendar month: '+month);
        calendarHistoryCache.set(month,data.sessions);
        if(currentView.page==='calendar'&&calendarBrowse.month===month){
          if(calendarBrowse.date===month+'-01'
             &&!data.sessions.some(x=>x.dateJst===calendarBrowse.date)
             &&!all().some(x=>x.date===calendarBrowse.date))calendarBrowse.date='';
          renderCalendar();
        }
      }).catch(err=>{console.warn('過去大会の開催履歴を取得できません',err)})
        .finally(()=>calendarHistoryLoading.delete(month));
    }
    // Historic tournament sessions are calendar metadata, never AOT match records.
    const calendarRoundSignature=value=>{
      const s=String(value||'');
      const day=s.match(/Day\s*(\d+).*Round\s*(\d+)/iu),event=s.match(/Event\s*(\d+).*Round\s*(\d+)/iu),week=s.match(/Week\s*(\d+).*Round\s*(\d+)/iu);
      if(day)return 'day'+Number(day[1])+'-round'+Number(day[2]);
      if(event)return 'event'+Number(event[1])+'-round'+Number(event[2]);
      if(week)return 'week'+Number(week[1])+'-round'+Number(week[2]);
      return s.replace(/\s*\/.*$/u,'').trim().toLowerCase();
    };
    function calendarUpcomingSessions(filters) {
      if(filters.scope==='results')return [];
      const published=calendarSessions({...filters,scope:'all'});
      const uniqueHistory=new Set();
      return [...(calendarHistoryCache.get(filters.month)||[]),...siteData.schedule.sessions].filter(e=>{
        if(!e||!validCalendarDate(e.dateJst)||!e.dateJst.startsWith(filters.month+'-'))return false;
        const historic=typeof e.sourceWindowId==='string'&&e.sourceWindowId.length>0;
        if(!historic&&e.seasonId!==siteData.schedule.seasonId)return false;
        if(!historic&&(calendarHistoryCache.get(filters.month)||[]).some(p=>p.eventId===e.eventId&&p.region===e.region&&p.startUtc===e.startUtc))return false;
        if(!regions.includes(e.region)||(/fncs/i.test(e.name)&&!/fncs\s+division\s*1/i.test(e.name)))return false;
        if((filters.region!=='all'&&e.region!==filters.region)
          ||(filters.series!=='all'&&e.series!==filters.series)
          ||(filters.mode!=='all'&&e.mode!==filters.mode)
          ||(filters.stage!=='all'&&e.stage!==filters.stage))return false;
        // Do not show a redundant schedule card when this exact round has published AOT results.
        if(historic&&published.some(p=>p.date===e.dateJst&&p.region===e.region&&p.id===e.tournamentId
          &&(calendarRoundSignature(p.round)===calendarRoundSignature(e.round)
            ||(e.round==='ラウンド詳細未確認'
              &&published.filter(q=>q.date===e.dateJst&&q.region===e.region&&q.id===e.tournamentId).length===1
              &&!/(?:Round\s*[12])/iu.test(p.round)))))return false;
        // Two API event aliases may resolve to the exact same official
        // start/end, tournament, region and stage. Display only one calendar card.
        const key=JSON.stringify([e.dateJst,e.region,e.tournamentId,e.startUtc,e.endUtc,e.round,e.stage,e.mode]);
        if(uniqueHistory.has(key))return false;
        uniqueHistory.add(key);
        return true;
      }).sort((a,b)=>a.startUtc.localeCompare(b.startUtc)||a.region.localeCompare(b.region));
    }
    function renderUpcomingCalendar(filters) {
      const root=$('#calendar-content'),scheduled=calendarUpcomingSessions(filters),byDate=new Map();
      for(const e of scheduled){
        if(!byDate.has(e.dateJst))byDate.set(e.dateJst,[]);
        byDate.get(e.dateJst).push(e);
      }
      const selector=root.querySelector('#calendar-series');
      if(selector){
        selector.insertAdjacentHTML('beforeend','<option value="ranked-cup">Ranked Cup</option>');
        selector.value=filters.series;
      }
      const stage=root.querySelector('#calendar-stage');
      if(stage){
        stage.insertAdjacentHTML('beforeend','<option value="単一ラウンド">単一ラウンド</option>');
        stage.value=filters.stage;
      }
      root.querySelector('.calendar-filter-grid').insertAdjacentHTML('beforeend',
        '<div class="calendar-filter-field"><label for="calendar-scope">表示内容</label>'
        +'<select id="calendar-scope" data-calendar-filter="scope">'
        +[['all','結果＋開催履歴＋予定'],['scheduled','開催日程・履歴のみ'],['results','登録済み結果のみ']]
          .map(([id,label])=>'<option value="'+id+'"'+(id===filters.scope?' selected':'')+'>'+label+'</option>').join('')
        +'</select></div>');
      const past=scheduled.filter(e=>!!e.sourceWindowId).length,future=scheduled.length-past;
      root.querySelector('.calendar-month-head small').textContent+=' · 開催履歴'+format(past)+'枠 · 予定'+format(future)+'枠';
      for(const button of root.querySelectorAll('[data-calendar-day]')){
        const day=button.dataset.calendarDay,items=byDate.get(day)||[];
        if(!items.length)continue;
        const pastItems=items.filter(e=>!!e.sourceWindowId).length,upcomingItems=items.length-pastItems;
        button.classList.add('has-upcoming');
        button.insertAdjacentHTML('beforeend','<span class="calendar-day-upcoming-count">'+(pastItems?'履歴 '+format(pastItems):'')+(pastItems&&upcomingItems?' · ':'')+(upcomingItems?'予定 '+format(upcomingItems):'')+'</span>');
        button.setAttribute('aria-label',button.getAttribute('aria-label')+'、開催履歴'+pastItems+'枠、今季予定'+upcomingItems+'枠');
      }
      const entries=byDate.get(filters.date)||[];
      if(filters.scope==='scheduled')for(const elem of root.querySelectorAll('.calendar-event,.calendar-day-count'))elem.hidden=true;
      const list=root.querySelector('.calendar-event-list');
      if(entries.length&&list.querySelector('.calendar-empty'))list.querySelector('.calendar-empty').remove();
      const cards=entries.map(e=>{
        const historic=!!e.sourceWindowId,status=historic?'開催履歴':Date.now()<Date.parse(e.startUtc)?'開催予定':'開始時刻経過';
        const link=safeUrl(e.url),time=typeof e.timeJst==='string'?e.timeJst:'—';
        return '<article class="calendar-upcoming-event'+(historic?' is-history':'')+'" data-scheduled-id="'+escape(e.id)+'">'
          +'<div class="calendar-event-top"><span class="calendar-event-tag '+(historic?'is-history':'is-upcoming')+'">'+status+'</span>'
          +'<span class="calendar-event-tag is-region">'+escape(e.region)+'</span>'
          +'<span class="calendar-event-tag">'+escape(e.stage)+'</span>'
          +(e.rewardType==='cosmetic'?'<span class="calendar-event-tag">コスメ報酬</span>':'')+'</div>'
          +'<h3>'+escape(e.name)+'</h3>'
          +'<p><strong>日本時間 '+escape(time)+' 開始</strong> · '+escape(e.round)+'</p>'
          +(link?'<p><a href="'+escape(link)+'" target="_blank" rel="noopener noreferrer">Epic大会ページ ↗</a></p>':'')
          +'<p class="calendar-upcoming-note">'+(historic?'過去の大会開催日をAPIで確認。ASIA選手の出場・戦績・賞金は未確認':'開催日程のみ確認。出場・結果・賞金獲得は未確認')+'</p></article>';
      }).join('');
      list.insertAdjacentHTML('beforeend',cards);
      root.querySelector('.calendar-detail-head h2').textContent=filters.date.replace(/-/g,'/')+' の大会';
      root.querySelector('.calendar-detail-head p').textContent+=' · 開催履歴'+format(entries.filter(e=>!!e.sourceWindowId).length)+'枠 · 予定'+format(entries.filter(e=>!e.sourceWindowId).length)+'枠';
      root.querySelector('.calendar-intro p:last-child').textContent='登録済みの海外戦績に加えて、過去の大会開催履歴と今シーズンの開催予定も確認できるよ。';
      root.querySelector('.calendar-note').textContent='※ 開催履歴はOsirion大会APIの終了済みウィンドウ、開催予定は今季の日程（'+siteData.schedule.checkedAt+'時点）から取得。公式大会ID・開始日時を根拠とし、FNCS Division 1以外のFNCS予選は対象外。開催履歴・予定は戦績や獲得賞金・AOT PR・称号に加算しません。';
      root.querySelector('.calendar-legend').textContent='掲載結果・過去の開催履歴・今季予定は別データ。開催履歴があることは、ASIA選手の参加や賞金獲得を意味しません。';
    }
    function renderCalendar(){
      const filters=sanitizeCalendarFilters(calendarBrowse);
      ensureCalendarHistoryMonth(filters.month);
      const sessions=filters.scope==='scheduled'?[]:calendarSessions(filters);
      const byDay=new Map();
      for(const session of sessions){
        if(!byDay.has(session.date))byDay.set(session.date,[]);
        byDay.get(session.date).push(session);
      }
      const today=calendarTokyoToday();
      const historyDates=calendarUpcomingSessions({...filters,scope:'scheduled'}).map(x=>x.dateJst);
      const dates=[...new Set([...byDay.keys(),...historyDates])].sort();
      const nextScheduled=siteData.schedule.sessions.filter(e=>e.dateJst>=today&&e.dateJst.startsWith(filters.month+'-')&&(!regions.includes(filters.region)||e.region===filters.region)).map(e=>e.dateJst).sort()[0];
      filters.date=(validCalendarDate(filters.date)&&filters.date.startsWith(filters.month+'-'))?filters.date:(nextScheduled||dates.at(-1)||((today.startsWith(filters.month+'-'))?today:filters.month+'-01'));
      calendarBrowse={...filters};
      if(currentView.page==='calendar')currentView.calendar={...filters};
      const [year,month]=filters.month.split('-').map(Number);
      const firstOffset=(new Date(Date.UTC(year,month-1,1)).getUTCDay()+6)%7;
      const lastDay=new Date(Date.UTC(year,month,0)).getUTCDate();
      const cellCount=Math.ceil((firstOffset+lastDay)/7)*7;
      const cells=[];
      for(let pos=0;pos<cellCount;pos++){
        const n=pos-firstOffset+1;
        if(n<1||n>lastDay){cells.push('<div class="calendar-cell is-outside" aria-hidden="true"></div>');continue}
        const date=filters.month+'-'+String(n).padStart(2,'0');
        const items=byDay.get(date)||[];
        const dayRegions=regions.filter(region=>items.some(item=>item.region===region));
        const classes='calendar-day'+(date===filters.date?' is-selected':'')+(date===today?' is-today':'')+(!items.length?' is-empty':'');
        cells.push('<div class="calendar-cell"><button type="button" class="'+classes+'" data-calendar-day="'+date+'" aria-pressed="'+(date===filters.date)+'"'
          +(date===today?' aria-current="date"':'')+' aria-label="'+escape(date+'、掲載'+items.length+'開催枠')+'"><span class="calendar-day-number">'+n+'</span>'
          +(items.length?'<span class="calendar-day-count">'+items.length+'開催枠</span><span class="calendar-day-regions">'+escape(dayRegions.join(' · '))+'</span>':'')
          +'</button></div>');
      }
      const selected=byDay.get(filters.date)||[];
      const seriesAxis=tournamentAxes.find(axis=>axis.key==='series');
      const modeAxis=tournamentAxes.find(axis=>axis.key==='mode');
      const filterMarkup=[
        calendarSelectMarkup('開催地域','region',[{id:'all',label:'全地域'},...regions.map(id=>({id,label:id}))],filters.region),
        calendarSelectMarkup('大会シリーズ','series',[{id:'all',label:'全シリーズ'},...(seriesAxis?.options||[])],filters.series),
        calendarSelectMarkup('ゲーム形式','mode',[{id:'all',label:'全形式'},...(modeAxis?.options||[])],filters.mode),
        calendarSelectMarkup('ラウンド区分','stage',[{id:'all',label:'全区分'},...tournamentViewStageOptions()],filters.stage)
      ].join('');
      const calendarMonths=[...new Set([
        ...siteData.calendarHistory.months.map(x=>x.month),
        ...rawAll().map(e=>String(e.date||'').slice(0,7)),
        ...siteData.schedule.sessions.map(e=>String(e.dateJst||'').slice(0,7))
      ])].filter(x=>/^\d{4}-(?:0[1-9]|1[0-2])$/.test(x)).sort().reverse();
      const monthOptions=calendarMonths.map(value=>{
        const count=siteData.calendarHistory.months.find(x=>x.month===value)?.count;
        const label=value.slice(0,4)+'年'+value.slice(5)+'月'+(count?'（開催履歴'+format(count)+'枠）':'');
        return '<option value="'+value+'"'+(value===filters.month?' selected':'')+'>'+escape(label)+'</option>';
      }).join('');
      const eventsMarkup=selected.map(item=>{
        const players=[...new Set(item.records.flatMap(names).filter(Boolean))];
        const links=players.slice(0,5).map(name=>'<a href="'+escape(profileHref(name))+'" data-open-profile="'+escape(name)+'">'+escape(name)+'</a>').join('');
        return '<article class="calendar-event"><div class="calendar-event-top"><span class="calendar-event-tag is-region">'+escape(item.region)+'</span>'
          +'<span class="calendar-event-tag">'+escape(item.kind)+'</span>'
          +'<span class="calendar-event-tag">'+escape(item.round)+'</span></div>'
          +'<h3><a href="'+escape(tournamentHref(item.id,item))+'" data-open-tournament="'+escape(item.id)+'" data-tournament-date="'+escape(item.date)+'" data-tournament-region="'+escape(item.region)+'" data-tournament-round="'+escape(item.round)+'" data-tournament-kind="'+escape(item.kind)+'">'+escape(item.name)+'</a></h3>'
          +'<p>掲載済み：'+format(item.records.length)+'戦績 / '+format(players.length)+'選手 · 地域・日付・ラウンド単位の集計</p>'
          +(links?'<div class="calendar-event-players">'+links+(players.length>5?'<span class="calendar-event-tag">ほか'+format(players.length-5)+'名</span>':'')+'</div>':'')
          +'</article>';
      }).join('');
      $('#calendar-content').innerHTML='<header class="calendar-intro"><p class="calendar-kicker">ASIA OVERSEAS / TOURNAMENT CALENDAR</p><h1>大会<span>カレンダー</span></h1>'
        +'<p>ASIA ON TOURに掲載された大会開催日を、地域・大会形式・ラウンドごとに確認。日付を選ぶとその日の記録を開けるよ。</p></header>'
        +'<section class="calendar-filter-panel" aria-label="大会カレンダーの絞り込み"><div class="calendar-filter-grid">'+filterMarkup+'</div>'
        +'<p class="calendar-note">※ 登録済みの海外遠征成績から自動生成。今後の未開催大会や未登録の大会日程は表示しません。時刻情報は扱わず、登録済みの開催日をそのまま表示します。</p></section>'
        +'<section class="calendar-month-panel" aria-label="月別の大会カレンダー"><div class="calendar-month-head"><div><h2>'+year+'年 '+month+'月</h2>'
        +'<small>'+format(sessions.length)+'開催枠 · '+format(sessions.reduce((sum,item)=>sum+item.records.length,0))+'戦績</small></div>'
        +'<div class="calendar-month-nav"><label class="calendar-month-jump">月を選ぶ <select data-calendar-filter="month" aria-label="開催月を選ぶ">'+monthOptions+'</select></label><button type="button" data-calendar-nav="-1" aria-label="前の月">← 前月</button><button type="button" data-calendar-today="true">最新月へ</button><button type="button" data-calendar-nav="1" aria-label="次の月">次月 →</button></div></div>'
        +'<div class="calendar-weekdays" aria-hidden="true">'+['月','火','水','木','金','土','日'].map(day=>'<span>'+day+'</span>').join('')+'</div>'
        +'<div class="calendar-grid">'+cells.join('')+'</div><p class="calendar-legend">各日付の「開催枠」は、同じ大会・地域・ラウンドに掲載された複数選手の戦績をまとめた数です。</p></section>'
        +'<section class="calendar-detail-panel" aria-label="選択した日の大会"><div class="calendar-detail-head"><h2>'+escape(filters.date.replace(/-/g,'/'))+' の掲載大会</h2>'
        +'<p>'+format(selected.length)+'開催枠 · '+format(selected.reduce((sum,item)=>sum+item.records.length,0))+'戦績</p></div>'
        +'<div class="calendar-event-list">'+(eventsMarkup||'<div class="calendar-empty"><strong>この日の掲載成績はまだないよ</strong>別の日付を選ぶか、地域・シリーズの絞り込みを変えてみてね</div>')+'</div></section>';
      renderUpcomingCalendar(filters);
    }
    function updateCalendarFilter(key,value){
      const next={...calendarBrowse};
      if(key==='month'){next.month=value;next.date=''}
      else if(key==='date'){next.date=value}
      else if(['region','series','mode','stage','scope'].includes(key)){next[key]=value;next.date=''}
      else return;
      calendarBrowse=sanitizeCalendarFilters(next);
      renderCalendar();
      const view={...captureView(),page:'calendar',calendar:{...calendarBrowse},scroll:window.scrollY||0};
      window.history.replaceState({aot:true,depth:routeDepth,view},'',calendarHash(calendarBrowse));
      routedHash=window.location.hash;
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
      return `<section class="tournament-session" data-tournament-session="${escape(session.id)}"><header class="tournament-session-heading"><div><h3>${regionPill(session.region)}<time datetime="${escape(session.date)}">${escape(friendlyDate(session.date))}</time><span>${escape(session.kind||'区分未確認')}</span></h3><p>${escape(session.round||'ラウンド未確認')}</p>${session.uncertain?'<p class="tournament-session-uncertain">ラウンドID未確認：同日・同地域・同じラウンド表記の記録をまとめて表示</p>':''}${source?`<a class="tournament-session-source" href="${escape(source)}" target="_blank" rel="noopener noreferrer">開催枠の出典 ↗</a>`:''}</div><span class="tournament-session-count">${format(session.records.length)}戦績</span></header><div class="tournament-session-records">${session.records.map(tournamentRecordCard).join('')}</div></section>`;
    }

    // A published qualifier record is not proof of advancement.
    // Only explicit round labels establish a confirmed qualifier in these summaries.
    const tournamentFinalKinds=new Set(['賞金決勝','Practice決勝','Performance決勝','決勝']);
    const tournamentIsConfirmedQualifier=e=>e.verified===true&&e.kind==='予選'&&!!AotPR.qualificationEvidence(e,classifyTournamentRecord(e));
    const tournamentPhase=e=>e.kind==='予選'?'qualifier':tournamentFinalKinds.has(e.kind)?'final':'other';
    let tournamentProgressMode='all',tournamentProgressId=null;
    function tournamentProgressSummary(records){
      const qualifiers=records.filter(e=>tournamentPhase(e)==='qualifier');
      const finals=records.filter(e=>tournamentPhase(e)==='final');
      const prizes=records.filter(isPrizeWin);
      const advancers=qualifiers.filter(tournamentIsConfirmedQualifier);
      const people=rows=>new Set(rows.flatMap(names)).size;
      return {qualifiers,finals,prizes,advancers,people};
    }
    function tournamentProgressFilter(e){
      if(tournamentProgressMode==='qualifier')return tournamentPhase(e)==='qualifier';
      if(tournamentProgressMode==='final')return tournamentPhase(e)==='final';
      if(tournamentProgressMode==='prize')return isPrizeWin(e);
      return true;
    }
    // Same exact published name, region, date and explicit Event/Week/Session token.
    // This indicates linked listed rounds, not independent confirmation of a qualification threshold.
    function tournamentProgressToken(e){
      const round=String(e.round||'');
      const src=tournamentSource(e),text=[round,String(src.roundId||'')];
      for(const part of text){
        const m=part.match(/(?:^|[^A-Za-z])(?:Event|Week|Session)[ _#-]*(\d+)/iu);
        if(m)return m[0].trim().replace(/^[^A-Za-z]+/,'').replace(/[ _#-]+/g,'').toLowerCase();
      }
      return null;
    }
    function tournamentProgressMatches(records){
      const grouped=new Map();
      for(const row of records){
        if(row.verified!==true||!['qualifier','final'].includes(tournamentPhase(row)))continue;
        const token=tournamentProgressToken(row);
        if(!token||!row.region||!row.date)continue;
        for(const name of new Set(names(row))){
          const id=JSON.stringify([name,row.region,row.date,token]);
          if(!grouped.has(id))grouped.set(id,{name,region:row.region,date:row.date,token,qualifiers:[],finals:[]});
          grouped.get(id)[tournamentPhase(row)==='qualifier'?'qualifiers':'finals'].push(row);
        }
      }
      return [...grouped.values()].filter(x=>x.qualifiers.length&&x.finals.length)
        .sort((a,b)=>b.date.localeCompare(a.date)||a.region.localeCompare(b.region)||a.name.localeCompare(b.name,'ja'));
    }
    function tournamentProgressHighlights(info,summary){
      const orderRank=(a,b)=>(a.rank??Infinity)-(b.rank??Infinity)||String(b.date||'').localeCompare(String(a.date||''));
      const quals=summary.advancers.slice().sort(orderRank).slice(0,4);
      const finals=summary.finals.filter(e=>e.verified===true&&Number.isInteger(e.rank)&&e.rank>0)
        .sort(orderRank).slice(0,4);
      const prizes=summary.prizes.slice().sort((a,b)=>individualPrize(b)-individualPrize(a)||String(b.date||'').localeCompare(String(a.date||''))).slice(0,4);
      function item(e,kind){
        const suffix=kind==='prize'?archivePrize(e):escape(rankLabel(e));
        return '<li data-tournament-highlight="'+escape(kind)+'" data-highlight-record="'+escape(e.id)+'">'
          +'<div class="tournament-highlight-name">'+profileNameLinks(e)+'</div>'
          +'<div class="tournament-highlight-facts">'+escape(friendlyDate(e.date))+' · '+escape(e.region)+' · '
          +escape(kind==='prize'?e.kind:e.round||e.kind)+'</div>'
          +'<strong class="tournament-highlight-value">'+suffix+'</strong></li>';
      }
      const block=(key,title,subtitle,rows)=>
        '<section class="tournament-highlight-block" data-tournament-highlight-group="'+key+'"><h3>'+title+'</h3>'
        +'<p>'+subtitle+'</p><ol>'+ (rows.length?rows.map(e=>item(e,key)).join(''):'<li class="tournament-progress-empty">該当する確認済み戦績はまだありません</li>')+'</ol></section>';
      return '<div class="tournament-highlights">'
        +block('qualifier','予選突破を確認','表記・公式通過順位・出典で確認した予選戦績',quals)
        +block('final','決勝の好成績','確認済みの総合順位がある決勝から抜粋',finals)
        +block('prize','賞金獲得','出典確認済みの現金賞金記録のみ',prizes)
        +'</div>';
    }
    function tournamentProgress(info){
      const summary=tournamentProgressSummary(info.records),matches=tournamentProgressMatches(info.records);
      const options=[
        {key:'all',label:'全戦績',count:info.records.length,description:'予選・決勝・スキン大会を含む'},
        {key:'qualifier',label:'予選',count:summary.qualifiers.length,description:'突破確認 '+format(summary.advancers.length)+'件'},
        {key:'final',label:'決勝',count:summary.finals.length,description:'各種決勝の掲載記録'},
        {key:'prize',label:'賞金獲得',count:summary.prizes.length,description:'確認済み現金賞金のみ'}
      ];
      const cards=options.map(option=>
        '<button type="button" class="tournament-phase-card" data-tournament-phase="'+option.key+'" aria-pressed="'+(tournamentProgressMode===option.key)+'" aria-controls="tournament-record-sessions">'
        +'<span>'+escape(option.label)+'</span><strong>'+format(option.count)+'<small>件</small></strong>'
        +'<small>'+escape(option.description)+'</small></button>').join('');
      const matchRows=matches.map(x=>{
        const qual=x.qualifiers.slice().sort((a,b)=>(a.rank??Infinity)-(b.rank??Infinity))[0];
        const final=x.finals.slice().sort((a,b)=>(a.rank??Infinity)-(b.rank??Infinity))[0];
        return '<li data-tournament-linked="'+escape(x.name)+'"><a href="'+escape(profileHref(x.name))+'" data-open-profile="'+escape(x.name)+'">'+escape(x.name)+'</a>'
          +'<span>'+escape(x.region)+' · '+escape(friendlyDate(x.date))+' · '+escape(x.token)+'</span>'
          +'<span>予選 '+escape(rankLabel(qual))+' → 決勝 '+escape(rankLabel(final))+'</span></li>';
      }).join('');
      return '<section class="tournament-progress" aria-labelledby="tournament-progress-title">'
        +'<header><p class="tournament-kicker">EVENT PROGRESSION / VERIFIED RECORDS</p>'
        +'<h2 id="tournament-progress-title">予選 → 決勝 → 賞金獲得</h2>'
        +'<p>大会内の掲載結果を段階別に確認。予選の掲載は突破を意味せず、決勝の掲載も賞金獲得を意味しません。</p></header>'
        +'<div class="tournament-phase-grid" role="group" aria-label="大会の表示段階">'+cards+'</div>'
        +'<p class="tournament-progress-totals">掲載対象：予選 '+format(summary.qualifiers.length)+'件（突破明記 '+format(summary.advancers.length)+'件） / 決勝 '+format(summary.finals.length)+'件 / 賞金獲得 '+format(summary.prizes.length)+'件 · '+format(summary.people(summary.prizes))+'名</p>'
        +tournamentProgressHighlights(info,summary)
        +'<details class="tournament-linked-progress"><summary>同じ開催枠で予選・決勝の両方が掲載されている選手（'+format(matches.length)+'件）</summary>'
        +'<p>掲載名の完全一致、開催地域・日付、明示されたEvent/Week/Session番号でのみ照合。異なる日付や識別不明の記録を推測で接続しません。通過ラインや未収録の戦績を保証するものではありません。</p>'
        +(matches.length?'<ul>'+matchRows+'</ul>':'<p>この条件で紐付けられる予選・決勝の掲載記録はありません。</p>')+'</details>'
        +'</section>';
    }


    function tournamentDateNavigator(fullInfo,selectedDate,scope){
      if(!fullInfo)return '';
      const buckets=new Map();
      for(const row of fullInfo.records){
        if(!validCalendarDate(row.date))continue;
        if(!buckets.has(row.date))buckets.set(row.date,{count:0,regions:new Set()});
        const b=buckets.get(row.date);b.count++;
        if(regions.includes(row.region))b.regions.add(row.region);
      }
      const dates=[...buckets.keys()].sort();
      const descending=dates.slice().reverse();
      const choices=['<option value="all"'+(!selectedDate?' selected':'')+'>全開催日（'+format(fullInfo.records.length)+'戦績）</option>']
        .concat(descending.map(date=>{
          const b=buckets.get(date),regionsLabel=regions.filter(region=>b.regions.has(region)).join('/');
          return '<option value="'+escape(date)+'"'+(date===selectedDate?' selected':'')+'>'
            +escape(date.replace(/-/g,'/'))+' · '+format(b.count)+'件'+(regionsLabel?' · '+escape(regionsLabel):'')+'</option>';
        }));
      if(selectedDate&&!buckets.has(selectedDate)){
        choices.push('<option value="'+escape(selectedDate)+'" selected>'+escape(selectedDate.replace(/-/g,'/'))+' · 掲載なし</option>');
      }
      const idx=dates.indexOf(selectedDate);
      let nav;
      if(!selectedDate){
        const latest=dates.at(-1);
        nav='<button type="button" data-tournament-date-nav="'+escape(latest||'')+'"'
          +(!latest?' disabled':'')+'>最新の開催日を見る →</button>';
      }else{
        const older=idx>0?dates[idx-1]:null,newer=idx>=0&&idx<dates.length-1?dates[idx+1]:null;
        nav='<button type="button" data-tournament-date-nav="'+escape(older||'')+'"'
          +(!older?' disabled':'')+'>← 前の開催日</button>'
          +'<button type="button" data-tournament-date-nav="'+escape(newer||'')+'"'
          +(!newer?' disabled':'')+'>次の開催日 →</button>';
      }
      const active=selectedDate
        ?'<p class="tournament-date-current">表示中：<strong>'+escape(selectedDate.replace(/-/g,'/'))+'</strong>'
          +(scope?' · カレンダーから選んだ地域・ラウンドに限定':' · この日の全地域・全ラウンド')
          +'</p>'
        :'<p class="tournament-date-current">すべての日付・地域・ラウンドを表示中</p>';
      return '<section class="tournament-date-navigator" aria-labelledby="tournament-date-title">'
        +'<div class="tournament-date-header"><div><span class="tournament-date-eyebrow">FIND BY DATE</span>'
        +'<h2 id="tournament-date-title">開催日から探す</h2></div>'
        +'<span class="tournament-date-total">登録済み '+format(dates.length)+'開催日</span></div>'
        +'<div class="tournament-date-toolbar"><div class="tournament-date-field">'
        +'<label for="tournament-date-filter">掲載結果の開催日</label>'
        +'<select id="tournament-date-filter" data-tournament-date-filter="true">'+choices.join('')+'</select></div>'
        +'<div class="tournament-date-nav" role="group" aria-label="前後の開催日">'+nav+'</div></div>'
        +active+'<p class="tournament-date-note">選択した日付に登録されている結果だけを表示します。'
        +'日付だけで探す場合は地域・予選／決勝をまとめて表示し、下のボタンでさらに絞り込めます。</p>'
        +'</section>';
    }

    function renderTournament(id,session=null,dateFilter=''){
      const scope=tournamentSessionScope(session,id);
      const selectedDate=scope?.date||(validCalendarDate(dateFilter)?dateFilter:'');
      const scopeIdentity=id+'|'+tournamentSessionKey(scope)+'|'+selectedDate;
      const subset=scope?all().filter(row=>tournamentRecordInScope(row,scope))
        :selectedDate?all().filter(row=>row.date===selectedDate):undefined;
      const info=tournamentInfo(id,subset),fullInfo=tournamentInfo(id);
      if(tournamentProgressId!==scopeIdentity){tournamentProgressId=scopeIdentity;tournamentProgressMode='all';}
      if(!info){$('#tournament-detail-content').innerHTML='<div class="tournament-detail-toolbar"><button type="button" class="btn sm ghost" data-tournament-back>← 戻る</button><a href="#tournaments" data-page="tournaments">大会を探す</a></div><div class="empty"><b>大会が見つかりません</b><p>URLを確認するか、大会検索から探してください。</p></div>';return}
      if(scope&&!info.recordCount){
        $('#tournament-detail-content').innerHTML='<div class="tournament-detail-toolbar"><button type="button" class="btn sm ghost" data-tournament-back>← 戻る</button>'
          +'<a class="tournament-show-all" data-open-tournament="'+escape(id)+'" href="'+escape(tournamentHref(id))+'">大会全体の戦績を見る →</a></div>'
          +'<div class="empty"><b>この開催枠の掲載結果はまだありません</b>'
          +'<p>'+escape(scope.date)+' · '+escape(scope.region)+' · '+escape(scope.round)+' · '+escape(scope.kind)+'</p>'
          +'<p>ほかの日付や地域の結果を代わりに表示せず、大会全体の戦績から確認できます。</p></div>';
        return;
      }
      const scopeHeading=scope?
        '<div class="tournament-selected-scope" data-tournament-scope="'+escape(tournamentSessionKey(scope))+'">'
        +'<strong>カレンダーで選択した開催枠</strong><span>'+escape(scope.date.replace(/-/g,'/'))+' · '+escape(scope.region)+' · '+escape(scope.round)+' · '+escape(scope.kind)+'</span></div>':'';
      const scopeLink=scope?'<a class="tournament-show-all" href="'+escape(tournamentHref(info.id))+'" data-open-tournament="'+escape(info.id)+'">大会全体の戦績を見る →</a>':'';
      const dateNavigator=tournamentDateNavigator(fullInfo,selectedDate,scope);
      const roster=new Set(info.records.flatMap(names));
      const visited=regions.filter(r=>info.records.some(e=>e.region===r));
      const visibleSessions=info.sessions.map(session=>({...session,records:session.records.filter(tournamentProgressFilter)})).filter(session=>session.records.length>0);
      const visibleCount=visibleSessions.reduce((sum,session)=>sum+session.records.length,0);
      $('#tournament-detail-content').innerHTML=`<div class="tournament-detail-toolbar"><button type="button" class="btn sm ghost" data-tournament-back>← 戻る</button><a href="${escape(tournamentHref(info.id,scope,selectedDate))}" title="このURLをコピーして共有できます">大会のURL ↗</a>${scopeLink}</div>${scopeHeading}<header class="tournament-detail-hero"><p class="tournament-kicker">TOURNAMENT / ASIA RESULTS</p><div class="tournament-detail-meta"><span class="tournament-season">${escape(tournamentViewSeason(info))}</span>${visited.map(regionPill).join('')}</div><h1 id="tournament-title" tabindex="-1">${escape(info.name)}</h1>${info.records.length?tournamentTags(info.records[0]):''}<dl class="tournament-detail-summary"><div><dt>掲載戦績</dt><dd>${format(info.recordCount??info.records.length)}<small>件</small></dd></div><div><dt>地域・日付・ラウンド</dt><dd>${format(info.sessions.length)}<small>枠</small></dd></div><div><dt>掲載選手</dt><dd>${format(roster.size)}<small>名</small></dd></div></dl>${tournamentViewEvidence(info)}</header>${dateNavigator}${tournamentProgress(info)}<div class="tournament-sessions-heading"><h2>開催枠ごとの戦績</h2><p aria-live="polite">全${format(info.recordCount)}件中 ${format(visibleCount)}件を表示 · 新しい順 · 地域・日付・ラウンド別 · 金色は賞金獲得</p></div><div class="tournament-sessions" id="tournament-record-sessions">${visibleSessions.length?visibleSessions.map(tournamentViewSession).join(''):'<div class="empty"><b>この表示条件に該当する戦績はありません</b><p>「全戦績」を選ぶと、スキン大会などの記録も確認できます。</p></div>'}</div>`;
    }
    function renderTournamentDetail(id){renderTournament(id)}

    const confirmedAliases=siteData.players.confirmedAliases;
    // Identity membership always uses exact published roster names. Aliases are
    // display-only evidence and never merge records or resolve another identity.
    const profileHref=name=>'#player='+encodeURIComponent(name);
    let registryCache=null;
    function playerRegistry(){
      if(registryCache)return registryCache;
      const known=new Set(candidates.map(p=>p.name));
      const extras=[...new Set(rawAll().flatMap(names))].filter(name=>!known.has(name)).map(name=>({name,initials:[...name].slice(0,2).join(''),desc:'登録済みの海外戦績がある選手'}));
      registryCache=[...candidates,...extras];
      return registryCache;
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


    // Comparisons are read-only and scoped to a common season, region,
    // format and series. Shares use exact registered player identities.
    let compareState=null;
    function compareAvailableNames(){
      return [...new Set(playerRegistry().map(player=>player.name))].sort((a,b)=>a.localeCompare(b,'ja'));
    }
    function compareSeriesOptions(){
      return [...new Set(tournamentAxes.find(axis=>axis.key==='series')?.options?.map(option=>option.id)||[])];
    }
    function compareDefaults(){
      const namesInPR=prReport('all').ranked.map(row=>row.name);
      const names=compareAvailableNames();
      return {players:[...new Set([...namesInPR,...names])].slice(0,2),region:'all',mode:'all',series:'all'};
    }
    function compareSanitize(value){
      const params=AsiaCompare.sanitize(value||{},compareSeriesOptions(),[]);
      return {players:AsiaCompare.cleanPlayers(value?.players,compareAvailableNames()),
        region:params.region,mode:params.mode,series:params.series};
    }
    function compareHash(value){
      const f=compareSanitize(value),params=new URLSearchParams();
      for(const name of f.players)params.append('player',name);
      if(!f.players.length)params.set('empty','1');
      for(const key of ['region','mode','series'])if(f[key]!=='all')params.set(key,f[key]);
      return '#compare?'+params.toString();
    }
    function compareFormat(value,metric){
      if(value==null)return '未確認';
      if(metric==='pr')return Number(value).toLocaleString('ja-JP',{minimumFractionDigits:1,maximumFractionDigits:1});
      if(metric==='cash')return '$'+Number(value).toLocaleString('ja-JP',{maximumFractionDigits:2});
      return format(value);
    }
    function renderComparison(){
      const host=$('#compare-content');if(!host)return;
      const state=compareSanitize(compareState||compareDefaults());
      compareState=state;
      const available=compareAvailableNames();
      const rows=AsiaCompare.build(rawAll(),state.players,{
        season:selectedSeason,region:state.region,mode:state.mode,series:state.series
      },{
        available,seasonOf:row=>recordSeason(row).id,
        classify:classifyTournamentRecord,names,individualPrize,
        confirmedPrizeFinalRank,prCalculate:(published,opts)=>{
          const extras=participationPRRows.filter(row=>
            (selectedSeason==='all'||row.seasonId===selectedSeason)&&
            (state.region==='all'||row.region===state.region)&&
            (state.mode==='all'||classifyTournamentRecord(row).mode===state.mode)&&
            (state.series==='all'||classifyTournamentRecord(row).series===state.series));
          return AotPR.calculate(mergeForPR(published,extras).records,opts);
        },
        series:compareSeriesOptions(),seasons:seasonOptions().map(option=>option.id)
      });
      const seasonChoices=seasonOptions().map(option=>'<option value="'+escape(option.id)+'"'
        +(selectedSeason===option.id?' selected':'')+'>'+escape(option.label)+'</option>').join('');
      const regionChoices=[{id:'all',label:'全地域'},...regions.map(id=>({id,label:id}))];
      const modeChoices=[{id:'all',label:'全形式'},...(tournamentAxes.find(axis=>axis.key==='mode')?.options||[]).filter(x=>x.id!=='unknown')];
      const seriesChoices=[{id:'all',label:'全シリーズ'},...(tournamentAxes.find(axis=>axis.key==='series')?.options||[]).filter(x=>x.id!=='unknown')];
      const filter=(id,label,options,selected)=>'<label class="compare-filter"><span>'+label+'</span>'
        +'<select id="compare-filter-'+id+'" data-compare-filter="'+id+'">'
        +options.map(item=>'<option value="'+escape(item.id)+'"'+(selected===item.id?' selected':'')+'>'+escape(item.label)+'</option>').join('')
        +'</select></label>';
      const inputChoices=available.map(name=>'<option value="'+escape(name)+'"></option>').join('');
      const selectedCards=rows.players.map((row,i)=>'<article class="compare-selected-player" data-compare-player="'+escape(row.name)+'" data-compare-slot="'+i+'">'
        +'<div class="compare-player-number">0'+(i+1)+'</div><div class="compare-player-details"><h3>'+escape(row.name)+'</h3>'
        +'<p>確認済みの掲載戦績 '+format(row.records)+'件</p>'
        +'<a href="'+escape(profileHref(row.name))+'" data-open-profile="'+escape(row.name)+'">プロフィールを見る →</a></div>'
        +'<button type="button" class="compare-remove" data-compare-remove="'+escape(row.name)+'" aria-label="'+escape(row.name)+'を比較から外す">×</button>'
        +'</article>').join('');
      const remaining=3-state.players.length;
      const add='<form id="compare-add-form" class="compare-add-form" aria-label="比較する選手を追加">'
        +'<label for="compare-player-input">選手名を検索して追加（'+format(state.players.length)+'/3人）</label>'
        +'<div class="compare-add-row"><input id="compare-player-input" type="search" list="compare-player-options" '
        +'placeholder="選手名を入力・候補から選択" autocomplete="off"'+(remaining?'':' disabled')+'>'
        +'<datalist id="compare-player-options">'+inputChoices+'</datalist>'
        +'<button type="submit"'+(remaining?'':' disabled')+'>＋ 追加</button></div>'
        +'<p id="compare-add-error" class="compare-add-error" role="status" aria-live="polite"></p>'
        +'</form>';
      const filters='<div class="compare-filter-grid">'
        +'<label class="compare-filter"><span>比較期間</span><select id="compare-filter-season">'
        +seasonChoices+'</select></label>'
        +filter('region','海外地域',regionChoices,state.region)
        +filter('mode','ゲーム形式',modeChoices,state.mode)
        +filter('series','大会シリーズ',seriesChoices,state.series)
        +'</div>';
      let overview='';
      if(rows.players.length<2){
        overview='<div class="compare-empty" data-compare-empty="true"><strong>比較する選手をあと'+format(2-rows.players.length)+'人追加してね</strong>'
          +'<p>2〜3人を選ぶと、AOT PR・個人賞金・VR・決勝実績・遠征先を横並びで比較できるよ</p></div>';
      }else{
        const palette=['#81dcec','#bb9bff','#ffc77e'];
        const cards=rows.players.map((p,i)=>'<article class="compare-summary-card" data-compare-summary="'+escape(p.name)+'" style="--compare-accent:'+palette[i]+'">'
          +'<span>PLAYER '+(i+1)+'</span><h3>'+escape(p.name)+'</h3>'
          +'<p>比較対象のAOT PR</p><strong data-compare-summary-pr="'+escape(p.name)+'">'+escape(compareFormat(p.values.pr,'pr'))+'</strong><small>pt</small>'
          +'<p class="compare-summary-cash">個人獲得賞金 <b>'+escape(compareFormat(p.values.cash,'cash'))+'</b></p></article>').join('');
        const rowMetrics=AsiaCompare.METRICS.map(metric=>{
          const vals=rows.players.map(row=>row.values[metric.id]);
          const valid=vals.filter(v=>typeof v==='number'&&Number.isFinite(v));
          const max=Math.max(0,...valid);
          const hasWinner=max>0;
          const cells=rows.players.map((player,index)=>{
            const value=vals[index],numeric=typeof value==='number'&&Number.isFinite(value);
            const pct=numeric&&max>0?Math.max(0,Math.min(100,value/max*100)):0;
            const isTop=hasWinner&&numeric&&Math.abs(value-max)<1e-9;
            return '<td data-compare-value="'+escape(metric.id)+'" data-compare-player="'+escape(player.name)+'">'
              +'<div class="compare-value'+(isTop?' is-highest':'')+'">'
              +'<strong>'+escape(compareFormat(value,metric.id))+'</strong>'
              +(isTop?'<span class="compare-leader">最多</span>':'')+'</div>'
              +'<div class="compare-bar" aria-hidden="true"><span style="width:'+pct.toFixed(1)+'%;background:'+palette[index]+'"></span></div></td>';
          }).join('');
          return '<tr data-compare-metric="'+escape(metric.id)+'"><th scope="row"><strong>'+escape(metric.label)+'</strong><small>'+escape(metric.unit)+'</small></th>'
            +cells+'</tr>';
        }).join('');
        const table='<div class="compare-table-scroll" tabindex="0" aria-label="2〜3人の戦績比較表。左右にスクロールできます">'
          +'<table class="compare-table"><thead><tr><th scope="col">比較項目</th>'
          +rows.players.map((p,i)=>'<th scope="col" style="--compare-accent:'+palette[i]+'">'+escape(p.name)+'</th>').join('')
          +'</tr></thead><tbody>'+rowMetrics+'</tbody></table></div>';
        const regional=regions.map(region=>{
          const details=rows.players.map((p,i)=>{
            const stats=p.byRegion[region];
            return '<td data-compare-region="'+region+'" data-compare-player="'+escape(p.name)+'">'
              +'<strong>'+escape(compareFormat(stats.cash,'cash'))+'</strong>'
              +'<small>掲載 '+format(stats.results)+'件</small></td>';
          }).join('');
          return '<tr><th scope="row">'+region+'</th>'+details+'</tr>';
        }).join('');
        const breakdown='<section class="compare-regions" aria-labelledby="compare-regions-title">'
          +'<h2 id="compare-regions-title">地域別の遠征実績</h2><p>各地域の確認済み個人賞金と掲載戦績数</p>'
          +'<div class="compare-table-scroll" tabindex="0" aria-label="地域ごとの選手比較表"><table class="compare-region-table">'
          +'<thead><tr><th scope="col">地域</th>'+rows.players.map(p=>'<th scope="col">'+escape(p.name)+'</th>').join('')+'</tr></thead>'
          +'<tbody>'+regional+'</tbody></table></div></section>';
        overview='<div class="compare-summary-grid">'+cards+'</div><section aria-labelledby="compare-metrics-title">'
          +'<h2 id="compare-metrics-title" class="compare-metrics-title">戦績を横並びで比較</h2>'
          +table+'</section>'+breakdown;
      }
      host.innerHTML='<header class="compare-hero"><div><p class="compare-kicker">PLAYER COMPARISON / OVERSEAS RESULTS</p>'
        +'<h1 id="compare-title" tabindex="-1">選手<span>比較</span></h1>'
        +'<p>海外遠征の強みを同じ条件で比べよう · 最大3選手</p></div>'
        +'<span class="compare-hero-symbol" aria-hidden="true">⚔️</span></header>'
        +'<section class="compare-picker-panel" aria-label="比較選手を選ぶ"><div class="compare-panel-heading">'
        +'<h2>比較したい選手を選択</h2><a id="compare-share" href="'+escape(compareHash(state))+'">この比較のURL ↗</a></div>'
        +'<div class="compare-player-grid">'+selectedCards+'</div>'+add+'</section>'
        +'<section class="compare-filter-panel" aria-label="比較条件"><h2>比較条件をそろえる</h2>'+filters+'</section>'
        +'<div id="compare-report" data-compare-selected="'+rows.players.length+'">'+overview+'</div>'
        +'<p class="compare-footnote">※ 比較はサイト掲載済みで出典確認された戦績だけを対象にしています。'
        +'個人賞金は確認済みの本人分のみで、チーム総額を個人へ割り当てません。VRは掲載されたソロまたはチームの記録で、'
        +'VR未確認の結果は合計に含めません。AOT PRは選んだ条件の戦績に現行の独自計算式を再適用した参考値で、'
        +'公式順位や選手間の勝率・大会参加回数を保証するものではありません。'
        +'決勝TOP3は順位を確認できる賞金決勝のみで、掲載されていない大会結果は補完しません。</p>';
      renderComparisonStyle(state);
    }
    function updateComparison(next,replace=false){
      const normalized=compareSanitize(next);
      if(currentView.page!=='compare')return;
      const previous=compareState||compareDefaults();
      const unchanged=compareHash(previous)===compareHash(normalized);
      if(unchanged)return;
      visitView({page:'compare',name:null,id:null,comparison:normalized},replace);
      $('#compare-player-input')?.focus?.({preventScroll:true});
    }
    function addComparisonPlayer(input){
      const text=String(input||'').trim(),available=compareAvailableNames();
      const error=$('#compare-add-error');
      const exact=available.find(name=>name===text);
      const aliases=available.filter(name=>(confirmedAliases[name]||[]).includes(text));
      const matches=exact?[exact]:aliases;
      if(!text||matches.length!==1){
        if(error)error.textContent=!text?'選手名を入力してね':matches.length>1?'同じ別名義の選手が複数います。登録名を選んでね':'候補一覧から登録されている選手名を選んでね';
        return;
      }
      const name=matches[0],selected=compareState?.players||[];
      if(selected.includes(name)){if(error)error.textContent='その選手はすでに比較に入っているよ';return;}
      if(selected.length>=3){if(error)error.textContent='比較は最大3人までだよ。1人外してから追加してね';return;}
      updateComparison({...compareState,players:[...selected,name]});
    }
    function compareFromProfile(name){
      if(!compareAvailableNames().includes(name))return;
      const present=compareState?.players||[];
      const players=present.includes(name)?present:present.length>=3?[...present.slice(0,2),name]:[...present,name];
      visitView({page:'compare',name:null,id:null,comparison:compareSanitize({
        players:compareState?players:[name],
        region:compareState?.region||'all',mode:compareState?.mode||'all',series:compareState?.series||'all'
      })});
    }

    let currentView={page:'home',name:null,id:null};
    let routeDepth=0;
    let routedHash='';
    let routingReady=false;
    function captureView(){
      return {...currentView,comparison:compareState?{...compareState,players:[...compareState.players]}:null,season:selectedSeason,scroll:window.scrollY||0,results:{search:$('#search-results').value,region:$('#region-filter').value,stage:$('#stage-filter').value,sort:$('#sort-results').value,prize:$('#prize-only').checked,player:selectedPlayer,page:archivePage},players:{search:$('#search-players').value,sort:$('#player-sort').value},tournaments:{...tournamentBrowseFilters},calendar:{...calendarBrowse},journey:{...journeyState},ranking:{filters:{...rankingFilters},limit:rankingLimit}};
    }
    function restoreBrowseState(view){
      if(view.journey)journeyState={...view.journey};
      if(view.ranking){rankingFilters=sanitizeRankingFilters(view.ranking.filters);rankingLimit=Number.isInteger(view.ranking.limit)&&view.ranking.limit>=30?view.ranking.limit:30;}
      if(view.results){const r=view.results;$('#search-results').value=r.search;$('#region-filter').value=r.region;$('#stage-filter').value=r.stage;$('#sort-results').value=r.sort;$('#prize-only').checked=r.prize;selectedPlayer=r.player;archivePage=Number.isInteger(r.page)&&r.page>0?r.page:1;}
      if(view.players){$('#search-players').value=view.players.search;$('#player-sort').value=view.players.sort;}
      if(view.tournaments)tournamentBrowseFilters=sanitizeTournamentFilters(view.tournaments);
      if(view.calendar)calendarBrowse=sanitizeCalendarFilters(view.calendar);
      if(view.comparison)compareState=compareSanitize(view.comparison);
    }
    function routeFromHash(){
      const hash=window.location.hash;
      if(hash.startsWith('#player=')){try{return {page:'profile',name:decodeURIComponent(hash.slice(8))}}catch{return {page:'profile',name:null,invalid:true}}}
      if(hash.startsWith('#tournament=')){
        try{
          const suffix=hash.slice(12),q=suffix.indexOf('?'),id=decodeURIComponent(q<0?suffix:suffix.slice(0,q));
          if(q<0)return {page:'tournament',id,session:null};
          const params=new URLSearchParams(suffix.slice(q+1));
          if(params.size===1&&params.has('date')&&validCalendarDate(params.get('date')))
            return {page:'tournament',id,session:null,dateFilter:params.get('date')};
          const session=params.size===4?tournamentSessionScope(Object.fromEntries(params)):null;
          return session?{page:'tournament',id,session,dateFilter:''}:{page:'tournament',id,session:null,invalid:true};
        }catch{return {page:'tournament',id:null,invalid:true}}
      }
      if(hash==='#compare'||hash.startsWith('#compare?')){
        const params=new URLSearchParams(hash.split('?').slice(1).join('?'));
        const comparison=compareSanitize({
          players:params.getAll('player'),region:params.get('region'),
          mode:params.get('mode'),series:params.get('series')
        });
        if(!params.has('player')&&!params.has('empty'))comparison.players=compareDefaults().players;
        return {page:'compare',comparison};
      }
      if(hash==='#calendar'||hash.startsWith('#calendar?')){const params=new URLSearchParams(hash.split('?').slice(1).join('?'));return {page:'calendar',calendar:sanitizeCalendarFilters(Object.fromEntries(params))}}
      if(hash==='#tournaments'||hash.startsWith('#tournaments?')){const params=new URLSearchParams(hash.split('?').slice(1).join('?'));return {page:'tournaments',filters:sanitizeTournamentFilters(Object.fromEntries(params))}}
      if(hash==='#players'||hash.startsWith('#players?')){const params=new URLSearchParams(hash.split('?').slice(1).join('?'));return {page:'players',ranking:{filters:sanitizeRankingFilters(Object.fromEntries(params)),limit:30}}}
      const page=hash.slice(1);
      return {page:['home','results','players','updates','about'].includes(page)?page:'home',name:null};
    }
    function routeHash(view){
      if(view.page==='profile')return view.invalid?window.location.hash:profileHref(view.name||'');
      if(view.page==='tournament')return view.invalid?window.location.hash:tournamentHref(view.id||'',view.session,view.dateFilter||'');
      if(view.page==='calendar')return calendarHash(view.calendar||calendarBrowse);
      if(view.page==='compare')return compareHash(view.comparison||compareState||compareDefaults());
      if(view.page==='tournaments')return tournamentSearchHash(view.filters);
      if(view.page==='players')return rankingSearchHash(view.ranking?.filters||rankingFilters);
      return '#'+view.page;
    }
    function showView(view,restore=false){
      const nextSeason=seasonFromUrl();
      if(nextSeason!==selectedSeason){selectedSeason=nextSeason;archivePage=1;refresh()}
      restoreBrowseState(view);
      currentView={page:view.page,name:view.name||null,id:view.id||null,session:tournamentSessionScope(view.session),dateFilter:validCalendarDate(view.dateFilter)?view.dateFilter:'',invalid:!!view.invalid};
      if(view.page==='tournaments'){tournamentBrowseFilters=sanitizeTournamentFilters(view.filters||tournamentBrowseFilters);currentView.filters={...tournamentBrowseFilters};renderTournamentSearch(currentView.filters)}
      if(view.page==='calendar'){calendarBrowse=sanitizeCalendarFilters(view.calendar||calendarBrowse);currentView.calendar={...calendarBrowse};renderCalendar()}
      if(view.page==='compare'){compareState=compareSanitize(view.comparison||compareState||compareDefaults());currentView.comparison={...compareState,players:[...compareState.players]};renderComparison()}
      if(view.page==='tournament')renderTournament(view.invalid?null:view.id,view.session,view.dateFilter);
      if(view.page==='profile'&&!renderProfile(view.name))$('#profile-content').innerHTML='<div class="profile-toolbar"><button type="button" class="btn sm ghost" id="profile-back" data-profile-back>← 戻る</button></div><div class="empty"><h1 id="profile-title" tabindex="-1">選手が見つかりません</h1><p>掲載済みの選手を名鑑から選んでください。</p><a class="text-link" href="#players" data-page="players">プレイヤー名鑑へ →</a></div>';
      document.querySelectorAll('.section').forEach(e=>e.classList.toggle('active',e.id==='page-'+view.page));
      document.querySelectorAll('.nav button').forEach(e=>{const active=e.dataset.page===(view.page==='profile'?'players':view.page==='tournament'?'tournaments':view.page);e.classList.toggle('active',active);e.setAttribute('aria-current',active?'page':'false')});
      if(view.page==='results')renderResults();
      if(view.page==='players'){renderPlayers();renderRanking()}
      document.title=view.page==='profile'&&profileInfo(view.name)?view.name+' · ASIA ON TOUR':view.page==='tournament'&&tournamentInfo(view.id)?tournamentInfo(view.id).name+' · ASIA ON TOUR':view.page==='calendar'?'大会カレンダー · ASIA ON TOUR':view.page==='compare'?'選手比較 · ASIA ON TOUR':view.page==='tournaments'?'大会を探す · ASIA ON TOUR':view.page==='updates'?'更新履歴 · ASIA ON TOUR':'ASIA ON TOUR — Fortnite海外遠征トラッカー';
      routedHash=window.location.hash;
      window.scrollTo({top:restore?(view.scroll||0):0,behavior:'instant'});
      if(!restore){if(view.page==='profile')$('#profile-title')?.focus?.({preventScroll:true});if(view.page==='tournament')$('#tournament-title')?.focus?.({preventScroll:true});}
    }
    function visitView(view,replace=false){
      if(routingReady)window.history.replaceState({aot:true,depth:routeDepth,view:captureView()},'',window.location.href);
      const same=currentView.page===view.page&&currentView.name===(view.name||null)&&currentView.id===(view.id||null)&&(view.page!=='tournaments'||tournamentSearchHash(currentView.filters)===tournamentSearchHash(view.filters))&&(view.page!=='tournament'||(tournamentSessionKey(currentView.session)===tournamentSessionKey(view.session)&&currentView.dateFilter===(view.dateFilter||'')))&&(view.page!=='compare'||compareHash(currentView.comparison||compareDefaults())===compareHash(view.comparison||compareDefaults()));
      const next={...captureView(),invalid:false,...view,scroll:0};
      if(!replace&&!same)routeDepth++;
      const state={aot:true,depth:routeDepth,view:next};
      if(replace||same)window.history.replaceState(state,'',routeHash(view));else window.history.pushState(state,'',routeHash(view));
      showView(next);
    }
    function navigate(page){visitView({page,name:null,id:null,...(page==='tournaments'?{filters:{...tournamentBrowseFilters}}:{}),...(page==='calendar'?{calendar:{...calendarBrowse}}:{}),...(page==='compare'?{comparison:compareState||compareDefaults()}:{}),...(page==='players'?{ranking:{filters:{...rankingFilters},limit:rankingLimit}}:{})})}
    function openProfile(name){visitView({page:'profile',name,id:null})}
    function openTournament(id,session=null){visitView({page:'tournament',id,name:null,session:tournamentSessionScope(session),dateFilter:''})}
    function showTournamentDate(date){
      if(currentView.page!=='tournament')return;
      const selected=date==='all'?'':validCalendarDate(date)?date:'';
      if(!currentView.session&&selected===currentView.dateFilter)return;
      visitView({page:'tournament',id:currentView.id,name:null,session:null,dateFilter:selected});
      const picker=$('#tournament-date-filter');
      picker?.focus?.({preventScroll:true});
      picker?.scrollIntoView?.({behavior:'instant',block:'center'});
    }
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
    let journeyState={name:null,mode:'highlights',limit:30};
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
      const prizeNote=row.cash>0?'確認済み個人分':skin?'スキン報酬・現金加算なし':e.kind==='予選'?'予選・現金加算なし':e.prize===0?'現金賞金なし':'個人現金賞金は未確認';
      return `<li class="journey-entry${row.cash>0?' is-prize-win':''}${skin?' is-cosmetic':''}" data-region="${escape(e.region)}" data-journey-record="${escape(e.id)}"><div class="journey-date">${date?`<time datetime="${escape(date)}">${escape(friendlyDate(date))}</time>`:'日付未確認'}${regionPill(regions.includes(e.region)?e.region:'未確認')}${seasonStamp(e)}</div><article class="journey-card"><div class="journey-record-top"><span class="journey-stage">${escape(e.kind||'区分未確認')}</span>${skin?'<span class="journey-cosmetic">スキン大会 · 現金とは別</span>':''}<span class="journey-verification">${escape(verificationLabel(e))}</span></div><h3><a href="${escape(tournamentHref(t.id))}" data-open-tournament="${escape(t.id)}">${escape(e.event||'大会名未確認')} <span aria-hidden="true">↗</span></a></h3><p class="journey-round">${escape(e.round||'ラウンド未確認')}</p>${tournamentTags(e)}${row.reasons.length?`<ul class="journey-milestones" aria-label="掲載記録のハイライト">${row.reasons.map(reason=>`<li>${escape(reason)}</li>`).join('')}</ul>`:''}<dl class="journey-metrics"><div><dt>順位</dt><dd data-journey-metric="rank">${journeyMetric(e.rank,true)}</dd></div><div><dt>PTS</dt><dd data-journey-metric="points">${journeyMetric(e.points)}</dd></div><div><dt>KILLS</dt><dd data-journey-metric="kills">${journeyMetric(e.kills)}</dd></div><div><dt>VR</dt><dd data-journey-metric="vrs">${journeyMetric(e.vrs)}</dd></div><div class="journey-cash"><dt>個人賞金 / USD</dt><dd data-journey-metric="prize">${prize}</dd><small>${prizeNote}${partners.length&&typeof e.prize==='number'?` · チーム合計 $${format(e.prize)}${e.verified?'':'（未確認）'}`:''}</small></div></dl>${partners.length?`<p class="journey-partners">相方：${partners.map(n=>`<a href="${escape(profileHref(n))}" data-open-profile="${escape(n)}">${escape(n)}</a>`).join(' / ')}</p>`:''}<div class="journey-record-links">${source?`<a href="${escape(source)}" target="_blank" rel="noopener noreferrer">大会の出典を見る ↗</a>`:'出典URL未確認'}<a href="${escape(tournamentHref(t.id))}" data-open-tournament="${escape(t.id)}">大会別の戦績 →</a></div></article></li>`;
    }
    function journeyRows(info){return buildJourney(info.events,rawAll().filter(e=>names(e).includes(info.name)))}
    function journeySection(info){
      if(journeyState.name!==info.name)journeyState={name:info.name,mode:'highlights',limit:30};
      const rows=journeyRows(info);
      return `<section class="profile-journey" id="profile-journey" aria-labelledby="journey-title"><header class="journey-heading"><div><p class="profile-kicker">OVERSEAS JOURNEY</p><h2 id="journey-title" tabindex="-1">海外遠征<span>年表</span></h2><p>${escape(seasonScope())} · 主な活躍を古い順に振り返る</p></div><a href="#profile-history-title" data-journey-history class="journey-history-jump">全成績を見る ↓</a></header><p class="journey-disclaimer">この年表は主な実績だけを抜粋しています。全成績は下の「海外大会履歴」で確認できます。初賞金・初スキン報酬・賞金の節目は、全期間のサイト掲載記録上の出来事です。実際の初獲得や生涯記録を意味しません。同日の前後関係は未確認です。</p>${journeyChart(rows)}<div class="journey-controls" role="group" aria-label="年表の表示モード">${[['highlights','主な実績'],['prize','賞金獲得']].map(([mode,label])=>`<button type="button" id="journey-mode-${mode}" data-journey-mode="${mode}" aria-pressed="${journeyState.mode===mode}" aria-controls="journey-list">${label}</button>`).join('')}</div><p class="journey-comparison-note">初賞金・賞金決勝の総合TOP3・累計個人賞金の節目（$1,000・$5,000・$10,000など）・初スキン報酬を掲載します。節目は同日分をまとめ、日付不明の獲得がある場合は初獲得日や到達日を断定しません。VR・予選通過・Practice入賞だけでは掲載しません。</p><p id="journey-count" class="journey-count" aria-live="polite"></p><ol id="journey-list" class="journey-list" tabindex="-1"></ol><button id="journey-more" class="btn ghost journey-more" type="button" data-journey-more hidden>さらに30件表示</button></section>`;
    }
    function renderJourney(info=profileInfo(currentView.name)){
      if(!info||!$('#journey-list'))return;
      const rows=journeyRows(info).filter(row=>journeyState.mode==='prize'?row.cash>0:row.reasons.length>0),shown=rows.slice(0,journeyState.limit);
      $('#journey-list').innerHTML=shown.length?shown.map(row=>journeyRecord(row,info.name)).join(''):'<li class="journey-empty">この期間に該当する主な実績はまだありません。下の海外大会履歴では全成績を確認できます。</li>';
      $('#journey-count').textContent=`${format(rows.length)}件中 ${format(shown.length)}件を表示 · ${seasonScope()}`;
      $('#journey-more').hidden=shown.length>=rows.length;
      ['highlights','prize'].forEach(mode=>$('#journey-mode-'+mode)?.setAttribute('aria-pressed',String(mode===journeyState.mode)));
    }


    // A player's summary is derived from explicitly published records only.
    // Team eliminations and VRs are team totals, not individual attribution.
    function profileSnapshotSection(info){
      const verified=info.events.filter(record=>record.verified===true);
      const kills=verified.filter(record=>Number.isInteger(record.kills)&&record.kills>=0);
      const vrRows=verified.filter(record=>Number.isInteger(record.vrs)&&record.vrs>=0);
      const totalKills=kills.reduce((sum,record)=>sum+record.kills,0);
      const totalVR=vrRows.reduce((sum,record)=>sum+record.vrs,0);
      const finals=verified.filter(record=>['賞金決勝','Practice決勝','Performance決勝','決勝'].includes(record.kind)&&Number.isInteger(record.rank)&&record.rank>0);
      const skins=verified.filter(confirmedSkinReward);
      const teamKillRecords=kills.filter(record=>names(record).length>1).length;
      const teamVRRecords=vrRows.filter(record=>names(record).length>1).length;
      const score=(label,value,description,key)=>
        '<article class="profile-snapshot-stat" data-profile-snapshot="'+key+'"><h3>'+escape(label)+'</h3>'
        +'<strong>'+escape(value)+'</strong><p>'+escape(description)+'</p></article>';
      const metrics=[
        score('確認済み KILLS',kills.length?format(totalKills):'—',
          '数値確認 '+format(kills.length)+' / '+format(info.events.length)+'戦績'+(teamKillRecords?' · チーム戦のキルを含む':''),'kills'),
        score('確認済み VR',vrRows.length?format(totalVR):'—',
          '数値確認 '+format(vrRows.length)+' / '+format(info.events.length)+'戦績'+(teamVRRecords?' · チーム戦のVRを含む':''),'vrs'),
        score('順位確認済み決勝',format(finals.length),
          '賞金・Practice・Performance等の決勝を含む','finals'),
        score('スキン報酬獲得',format(skins.length),
          '確認済みの獲得表記がある記録のみ','skins')
      ];
      const modes=[
        {id:'battle-royale',name:'通常BR'},
        {id:'zero-build',name:'ゼロビルド'},
        {id:'reload',name:'リロード'},
        {id:'reload-zero-build',name:'リロード ZB'},
        {id:'unknown',name:'形式未確認'}
      ];
      const counts=new Map(modes.map(mode=>[mode.id,0]));
      for(const record of info.events){
        const classified=classifyTournamentRecord(record);
        const mode=counts.has(classified.mode)?classified.mode:'unknown';
        counts.set(mode,counts.get(mode)+1);
      }
      const modeRows=modes.filter(mode=>counts.get(mode.id)>0);
      const modeMax=Math.max(0,...modeRows.map(mode=>counts.get(mode.id)));
      const modeHTML=modeRows.length?modeRows.map(mode=>{
        const count=counts.get(mode.id),percent=modeMax?count/modeMax*100:0;
        return '<li class="profile-mode-row" data-profile-mode="'+escape(mode.id)+'"><span>'+escape(mode.name)+'</span>'
          +'<span class="profile-mode-track" aria-hidden="true"><span style="width:'+percent+'%"></span></span>'
          +'<strong>'+format(count)+'件</strong></li>';
      }).join(''):'<li class="profile-snapshot-empty">この期間の掲載戦績はまだありません</li>';
      const teammates=new Map();
      for(const record of info.events){
        const members=names(record);
        if(members.length<2||!members.includes(info.name))continue;
        for(const other of new Set(members.filter(member=>member!==info.name))){
          teammates.set(other,(teammates.get(other)||0)+1);
        }
      }
      const partners=[...teammates].map(([name,count])=>({name,count}))
        .sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name,'ja'));
      const partnerHTML=partners.length?partners.slice(0,8).map(partner=>
        '<li class="profile-partner-row"><a href="'+escape(profileHref(partner.name))+'" data-open-profile="'+escape(partner.name)+'">'+escape(partner.name)+'</a>'
        +'<span>'+format(partner.count)+'件</span></li>'
      ).join(''):'<li class="profile-snapshot-empty">この期間に掲載されたチーム戦の相方はいません</li>';
      return '<section class="profile-snapshot" aria-labelledby="profile-snapshot-title">'
        +'<div class="profile-snapshot-heading"><h2 id="profile-snapshot-title">海外遠征<span>スタッツ</span></h2>'
        +'<p>'+escape(seasonScope())+' · 掲載済み戦績から集計</p></div>'
        +'<div class="profile-snapshot-stats">'+metrics.join('')+'</div>'
        +'<div class="profile-snapshot-details"><div class="profile-snapshot-panel" data-profile-modes>'
        +'<h3>大会形式別の掲載戦績</h3><ul class="profile-mode-list">'+modeHTML+'</ul>'
        +'<p class="profile-snapshot-note">大会開催形式が確認できない戦績は「形式未確認」に分類。順位や賞金の優劣ではなく、掲載された戦績の件数です。</p></div>'
        +'<div class="profile-snapshot-panel" data-profile-partners><h3>チーム戦で組んだ相方 <small>上位8名</small></h3>'
        +'<ul class="profile-partner-list">'+partnerHTML+'</ul>'
        +'<p class="profile-snapshot-note">同じチームとして掲載された戦績の件数で、固定デュオや所属を意味しません。別名義からの推測統合は行いません。</p></div></div>'
        +'<p class="profile-snapshot-note">※ 確認済みKILLS・VRはチーム戦の数値を含むため、個人が単独で記録した合計とは限りません。未確認値は0として加算していません。</p></section>';
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
    const achievementsByPlayer=new Map();
    function achievementsForPlayer(name){
      if(!achievementsByPlayer.has(name))achievementsByPlayer.set(name,AsiaAchievements.calculate(rawAll(),name,{catalog:tournamentCatalog}));
      return achievementsByPlayer.get(name);
    }
    // Badges are lifetime achievements: changing the season never revokes earned titles.
    // Use the same immutable archive and exact player roster names as the profile.
    function profileAchievementsSection(info){
      const data=achievementsForPlayer(info.name),evolution=data.evolution;
      const featured=evolution.featured;
      const tier=featured?.current?.tier||'locked';
      const tracks=evolution.tracks.map(track=>{
        const stage=track.current;
        const stageTone=stage?.tier||'locked';
        const steps=track.milestones.map((milestone,index)=>
          '<li class="'+(index<track.level?'is-earned':index===track.level?'is-next':'')+'">'
          +'<span class="evo-step-dot" aria-hidden="true"></span>'
          +'<span>'+escape(milestone.tierLabel)+' · '+format(milestone.goal)+' '+escape(track.unit)+'</span>'
          +'<strong>'+escape(milestone.title)+'</strong></li>'
        ).join('');
        const next=track.next
          ?'<span class="evo-next-text">次の'+escape(track.next.tierLabel)+'まで <strong>あと '+format(track.remaining)+' '+escape(track.unit)+'</strong></span>'
          :'<span class="evo-next-text is-max">最高ランク達成！ 👑</span>';
        return '<article class="evo-card" data-evolution-track="'+escape(track.id)+'" data-evolution-tier="'+escape(stageTone)+'" data-evolution-level="'+track.level+'">'
          +'<div class="evo-card-head"><div class="evo-medal" aria-hidden="true"><span class="evo-medal-symbol">'+escape(track.icon)+'</span>'
          +(track.level?'<span class="evo-medal-stars">'+('✦'.repeat(Math.min(5,track.level)))+'</span>':'')
          +'</div><div class="evo-card-identity"><p class="evo-family">'+escape(track.label)+'</p>'
          +'<span class="evo-tier">'+escape(stage?.tierLabel||'未獲得')+'</span>'
          +'<h3>'+escape(stage?.title||'挑戦中')+'</h3></div></div>'
          +'<p class="evo-description">'+escape(track.description)+'</p>'
          +'<div class="evo-current"><strong>'+format(track.value)+'</strong><span>'+escape(track.unit)+'</span>'
          +'<small>LEVEL '+track.level+' / '+track.milestones.length+'</small></div>'
          +'<div class="evo-rank-steps" aria-label="到達ランク">'
          +track.milestones.map((milestone,index)=>'<span class="'+(index<track.level?'is-earned':'')+'" title="'+escape(milestone.tierLabel)+'"></span>').join('')
          +'</div><div class="evo-next">'+next+'</div>'
          +'<div class="evo-bar" role="progressbar" aria-label="'+escape(track.label)+'の次ランクへの進捗" aria-valuemin="0" aria-valuemax="100" aria-valuenow="'+track.percent+'"><span style="width:'+track.percent+'%"></span></div>'
          +'<details class="evo-level-details"><summary>ランクの達成条件を見る</summary><ol>'+steps+'</ol></details></article>';
      }).join('');
      const specials=data.special,secret=data.secret;
      const specialGrowthMarkup=badge=>{
        if(!badge.growth)return '';
        const progress=badge.growth;
        const tierName=(badge.region||badge.id==='solo-kill-mastery')&&progress.level?AsiaAchievements.EVOLUTION_TIERS[progress.level-1]?.display:'';
        return '<div class="special-evolution" data-special-growth="'+escape(badge.id)+'" data-special-growth-level="'+progress.level+'">'
          +'<div class="special-evo-status"><span>'+escape(tierName||'達成段階')+'</span>'
          +'<strong>'+format(badge.progress)+' / '+format(badge.goal)+' '+escape(badge.unit)+'</strong></div>'
          +'<div class="special-evo-meter" role="progressbar" aria-label="'+escape(badge.title)+'の次ランクへの進捗" aria-valuemin="0" aria-valuemax="100" aria-valuenow="'+progress.percent+'">'
          +'<span style="width:'+progress.percent+'%"></span></div>'
          +'<p class="special-evo-next">'+(progress.next?'次の「'+escape(progress.next.title)+'」まで <strong>あと '+format(progress.remaining)+' '+escape(badge.unit)+'</strong>':'最高ランク達成！ 👑')+'</p>'
          +'<div class="special-evo-stages" aria-label="ランク達成条件">'
          +progress.stages.map((stage,i)=>'<span class="'+(i<progress.level?'is-earned':'')+'" title="'+escape(stage.title+'：'+format(stage.goal)+badge.unit)+'">'+escape(stage.title)+'</span>').join('')+'</div>'
          +'</div>';
      };
      const earnedSpecial=specials.unlocked.map(badge=>{
        const support=badge.evidence.map(row=>
          '<li data-special-evidence-id="'+escape(row.id)+'"><span>'+escape(row.date)+' · '+escape(row.region)+'</span> '+escape(row.event)
          +' <small>('+escape(row.kind)+')</small>'+(row.teamFormat?'<small class="special-format-proof"> · '+escape(AsiaAchievements.TEAM_FORMAT_LABELS[row.teamFormat]||row.teamFormat)+'</small>':'')+(row.killThreshold?'<small class="special-kill-proof"> · '+escape(({solo:'ソロ',duo:'デュオ',trio:'トリオ'})[row.killFormat]||'形式未確認')+' '+format(row.kills)+'K / 基準'+format(row.killThreshold)+'K</small>':'')
          +(badge.id==='solo-kill-mastery'?'<small class="special-kill-proof"> · ソロ '+format(row.kills)+'K</small>':'')
          +(badge.id==='final-kill-tyrant'?'<small class="special-kill-proof"> · ソロ決勝 '+format(row.kills)+'K</small>':'')
          +(badge.id==='cash-windfall'?'<small class="special-cash-proof"> · 個人賞金 $'+format(row.personalCash)+'</small>':'')+'</li>'
        ).join('');
        return '<article class="special-achievement" data-special-id="'+escape(badge.id)+'" data-special-rarity="'+escape(badge.rarity)+'" data-special-growth-level="'+(badge.growth?.level||0)+'" data-special-evolution-tier="'+escape((badge.region||badge.id==='solo-kill-mastery')&&badge.growth?.level?AsiaAchievements.EVOLUTION_TIERS[badge.growth.level-1].id:'none')+'" data-special-unlocked="true">'
          +'<div class="special-achievement-top"><span class="special-achievement-icon" aria-hidden="true">'+escape(badge.icon)+'</span>'
          +'<div class="special-achievement-ident"><span class="special-achievement-rarity">'+escape(badge.rarityLabel)+'</span>'
          +'<h4>'+escape(badge.title)+'</h4></div></div><p>'+escape(badge.description)+'</p>'
          +specialGrowthMarkup(badge)
          +'<details class="special-achievement-proof"><summary>達成した記録を見る</summary><ul>'+support+'</ul>'
          +'<small>'+(badge.id==='solo-kill-mastery'?'確認済みソロKILLSの全期間累計（根拠はキル上位3件を表示）':'掲載済み戦績から抽出')+' · '+format(badge.progress)+' / '+format(badge.goal)+' '+escape(badge.unit)+'</small></details></article>';
      }).join('');
      const missingSpecial=specials.locked.map(badge=>
        '<li class="special-locked-item" data-special-id="'+escape(badge.id)+'" data-special-rarity="'+escape(badge.rarity)+'" data-special-growth-level="'+(badge.growth?.level||0)+'" data-special-unlocked="false">'
        +'<span class="special-locked-icon" aria-hidden="true">'+escape(badge.icon)+'</span><div>'
        +'<strong>'+escape(badge.title)+'</strong><span class="special-locked-rarity">'+escape(badge.rarityLabel)+'</span>'
        +'<p>'+escape(badge.description)+'</p><small>'+format(Math.min(badge.progress,badge.goal))+' / '+format(badge.goal)+' '+escape(badge.unit)+'</small>'
        +(badge.growth?specialGrowthMarkup(badge):'')
        +'</div></li>'
      ).join('');
      const secretUnlocked=secret.unlocked.map(badge=>{
        const proof=badge.evidence.map(row=>'<li data-secret-evidence-id="'+escape(row.id)+'">'
          +'<span>'+escape(row.date)+' · '+escape(row.region)+'</span> '+escape(row.event)
          +'<small>('+escape(row.kind)+')</small>'
          +(row.kills!==undefined?'<small> · '+format(row.kills)+'K</small>':'')
          +(row.vrs!==undefined?'<small> · '+format(row.vrs)+'VR</small>':'')
          +(row.personalCash!==undefined?'<small> · 個人賞金 $'+format(row.personalCash)+'</small>':'')
          +'</li>').join('');
        return '<article class="secret-card secret-card-earned" data-secret-id="'+escape(badge.id)+'" data-secret-unlocked="true" data-secret-rarity="'+escape(badge.rarity)+'">'
          +'<div class="secret-card-top"><span class="secret-card-icon" aria-hidden="true">'+escape(badge.icon)+'</span>'
          +'<div><span class="secret-card-eyebrow">'+escape(badge.rarity==='legendary'?'LEGENDARY SECRET':'EPIC SECRET')+'</span>'
          +'<h4>'+escape(badge.title)+'</h4></div></div>'
          +'<p>'+escape(badge.description)+'</p>'
          +(badge.difficulty?'<span class="secret-difficulty">難易度 '+escape(badge.difficulty)+'</span>':'')
          +'<details class="secret-proof"><summary>解放した大会記録を見る</summary><ul>'+proof+'</ul></details>'
          +'</article>';
      }).join('');
      // Undiscovered names, IDs, conditions and progress are not rendered.
      // Two sealed awards have no locked placeholder at all.
      const secretLocked=secret.visibleLocked.map(badge=>
        '<li class="secret-card secret-card-locked" data-secret-locked="true">'
        +'<span class="secret-card-icon" aria-hidden="true">❔</span>'
        +'<div><span class="secret-card-eyebrow">SECRET ACHIEVEMENT</span>'
        +'<h4>？？？？？？</h4><p>ヒント：「'+escape(badge.hint)+'」</p>'
        +'<small>達成条件は非公開</small></div></li>'
      ).join('');
      const secretSection='<section class="secret-achievements" id="profile-secret-achievements" aria-labelledby="secret-achievements-title">'
        +'<div class="secret-header"><div><span class="achievement-eyebrow">SECRET ACHIEVEMENTS</span>'
        +'<h3 id="secret-achievements-title">秘密の<span>称号</span> 🔒</h3>'
        +'<p>手掛かりから謎を解き明かせ · 獲得すると称号と出典が公開</p></div>'
        +'<div class="secret-summary"><strong data-secret-count>'+format(secret.earned)+'</strong><span>発見済み</span></div></div>'
        +(secretUnlocked?'<div class="secret-earned-grid" aria-label="解放した隠し称号">'+secretUnlocked+'</div>':'')
        +(secretLocked?'<details class="secret-locked-details"><summary>未発見の手掛かりを見る</summary>'
          +'<ul class="secret-locked-grid">'+secretLocked+'</ul></details>':'')
        +'<p class="secret-note">※ 未解放の称号は名前・条件・レア度を公開しません。一部の完全シークレットは解放前には手掛かりも表示されません。日付・大会形式・個人賞金は確認済みの掲載データから判定します。</p>'
        +'</section>';
      return '<section class="achievement-section" id="profile-achievements" aria-labelledby="achievement-title">'
        +'<div class="achievement-heading"><div><span class="achievement-eyebrow">ASIA ON TOUR / EVOLVING BADGES</span>'
        +'<h2 id="achievement-title">進化する<span>実績バッジ</span></h2></div>'
        +'<p>全期間の確認済み戦績から自動進化 · 6系統</p></div>'
        +'<div class="achievement-featured" data-evolution-featured="'+escape(featured?.id||'none')+'" data-evolution-tier="'+escape(tier)+'">'
        +'<div class="achievement-featured-icon evo-medal" aria-hidden="true"><span class="evo-medal-symbol">'+escape(featured?.icon||'🔒')+'</span></div>'
        +'<div class="achievement-featured-copy"><span class="achievement-featured-label">MAIN TITLE · 最高到達ランクから選出</span>'
        +'<strong data-achievement-title>'+escape(featured?.current?.title||'挑戦中')+'</strong>'
        +'<small>'+escape(featured?featured.label+' · '+featured.current.tierLabel:'戦績が確認されるとバッジを獲得できるよ')+'</small></div></div>'
        +'<div class="achievement-progress"><span>獲得したランク</span><div class="achievement-progress-track" aria-hidden="true">'
        +'<span style="width:'+(evolution.totalStages?Math.round(evolution.earnedStages/evolution.totalStages*100):0)+'%"></span></div>'
        +'<strong data-achievement-count>'+format(evolution.earnedStages)+' / '+format(evolution.totalStages)+'</strong></div>'
        +'<details class="achievement-collection" data-achievement-collection>'
        +'<summary class="achievement-toggle" role="button"><span class="achievement-toggle-mark" aria-hidden="true">✦</span>'
        +'<span class="achievement-toggle-copy"><strong class="achievement-label-closed">すべての称号を見る</strong>'
        +'<strong class="achievement-label-open">称号を折りたたむ</strong>'
        +'<small>進化バッジ6系統 · 特別称号 '+format(specials.earned)+' / '+format(specials.total)+' 獲得</small></span>'
        +'<span class="achievement-toggle-chevron" aria-hidden="true">⌄</span></summary>'
        +'<div class="achievement-collection-body">'
        +'<div class="evo-grid" aria-label="進化バッジ一覧">'+tracks+'</div>'
        +'<section class="evo-special" id="profile-special-achievements" aria-labelledby="special-achievements-title">'
        +'<div class="special-header"><div><span class="achievement-eyebrow">SPECIAL ACHIEVEMENTS</span>'
        +'<h3 id="special-achievements-title">特別称号<span>コレクション</span></h3>'
        +'<p>珍記録・大会結果・海外挑戦の組み合わせで獲得</p></div>'
        +'<div class="special-summary"><strong data-special-count>'+format(specials.earned)+' / '+format(specials.total)+'</strong><span>獲得済み</span></div></div>'
        +'<div class="special-rarity-guide" aria-label="特別称号のレア度"><span data-rarity="rare">RARE</span><span data-rarity="epic">EPIC</span><span data-rarity="legendary">LEGENDARY</span></div>'
        +'<div class="special-unlocked-grid" aria-label="獲得した特別称号">'
        +(earnedSpecial||'<p class="special-none">まだ獲得した特別称号はないよ · 新しい記録が掲載されると自動で判定されます</p>')
        +'</div>'
        +(missingSpecial?'<details class="special-locked-details"><summary>未獲得の特別称号 '+format(specials.locked.length)+'種類と達成条件を見る</summary>'
        +'<ul class="special-locked-list">'+missingSpecial+'</ul></details>':'')
        +'</section>'
        +secretSection
        +'<p class="achievement-note">※ ASIA ON TOUR独自の非公式実績です。掲載された確認済み戦績のみで判定し、未確認や推測した別名義は加算しません。賞金は確認済みの個人現金受取額のみ。0・1キル称号はKILLSの数値が明記された場合だけです。KILLSとVRはチーム戦ではチーム合計、複数試合の大会戦績ではセッション合計であり、個人または1試合単位の達成とは限りません。スキンは獲得が明記された記録のみ。レア度はサイト独自の分類です。地域別スペシャリストと二刀流・三刀流・四刀流は全期間の掲載数／確認済み賞金獲得形式から自動進化します。ソロ累計キルの称号は、ソロ形式・本人のKILLSが確認できた戦績のみを対象とし、予選・決勝の掲載セッション合計を積み上げ、同一記録IDは重複計上しません。デュオ・トリオ・スクワッドのキル数は含めません。大会編成が不明な成績は形式数に含めません。追加の決勝・賞金・地域移動・Reload・Zero Build・FNCS称号も確認済みの掲載戦績から判定します。日付型称号は記録された開催日単位で集計し、同一大会の予選・決勝を別大会として二重に数えません。30日以内の賞金連鎖は両端の日付差30日以内、七日間の旅人は両端の日付差6日以内が条件です。シーズンを変えても全期間の実績が維持されます。</p></div></details></section>';
    }


    // Growth charts are all-time even when another season is selected, just
    // like the evolving titles. All values use the site's present calculation
    // rules and source-verified archive rather than estimated historic stats.

    // Playstyle is separate from AOT PR, achievements and financial records.
    // Use official published records plus the existing deduplicated Epic-ID participation bridge.
    const styleState={season:'all',team:'solo',mode:'battle-royale',series:'victory-cup',region:'all'};
    let styleCompareTeam='solo',styleRowsCache=null;
    const styleAnalysisCache=new Map();
    function styleInputRecords(){
      if(!styleRowsCache)styleRowsCache=mergeForPR(rawAll(),participationPRRows,'all').records;
      return styleRowsCache;
    }
    function styleReport(name,filters){
      const key=JSON.stringify([name,filters]);
      if(!styleAnalysisCache.has(key))styleAnalysisCache.set(key,AsiaPlayerStyle.analyze(styleInputRecords(),name,filters,{
        classify:classifyTournamentRecord,seasonOf:row=>recordSeason(row).id
      }));
      return styleAnalysisCache.get(key);
    }
    function styleChoices(key){
      return (tournamentAxes.find(axis=>axis.key===key)?.options||[])
        .filter(option=>option.id!=='unknown'&&option.id!=='all').map(option=>({id:option.id,label:option.label}));
    }
    function renderProfileStyle(name){
      const anchor=$('#profile-growth');
      if(!anchor||!window.AsiaPlayerStyle||!window.AsiaPlayerStyleView)return;
      const report=styleReport(name,styleState);
      const html=AsiaPlayerStyleView.profile(report,{
        modes:styleChoices('mode'),series:styleChoices('series'),
        seasons:seasonOptions().filter(item=>item.id!=='unknown'&&item.id!=='all')
          .map(item=>({id:item.id,label:item.label}))
      });
      const old=$('#profile-style');
      const wasOpen=old?.querySelector('#profile-style-fold')?.open===true;
      if(old)old.outerHTML=html;
      else anchor.insertAdjacentHTML('afterend',html);
      // Filtering replaces the panel, but must not accidentally close it.
      if(wasOpen)$('#profile-style-fold').open=true;
    }
    function renderComparisonStyle(state=compareState){
      const host=$('#compare-report');
      if(!host||!window.AsiaPlayerStyle||!window.AsiaPlayerStyleView)return;
      const stateFilters=state||compareDefaults();
      const filters={season:selectedSeason,team:styleCompareTeam,mode:stateFilters.mode,
        series:stateFilters.series,region:stateFilters.region};
      const reports=stateFilters.players.map(name=>styleReport(name,filters));
      const html=AsiaPlayerStyleView.comparison(reports,{team:styleCompareTeam});
      const old=$('#compare-style');
      const wasOpen=old?.querySelector('#compare-style-fold')?.open===true;
      // Use a predictable id so subsequent filter changes replace only this panel.
      if(old)old.outerHTML=html.replace('class="compare-style"','class="compare-style" id="compare-style"');
      else host.insertAdjacentHTML('afterend',html.replace('class="compare-style"','class="compare-style" id="compare-style"'));
      if(wasOpen)$('#compare-style-fold').open=true;
    }

    const growthState={grouping:'month',metric:'pr',mode:'cumulative',selectedKey:null};
    const growthCache=new Map();
    function growthReport(name,grouping=growthState.grouping){
      const key=name+'|'+grouping;
      if(!growthCache.has(key)){
        growthCache.set(key,AsiaGrowth.periods(mergeForPR(rawAll(),participationPRRows,'all').records,grouping,{
          player:name,season:recordSeason,cash:individualPrize,prizeFinalRank:confirmedPrizeFinalRank,
          prScore:rows=>AotPR.calculate(rows,{
            names,classify:classifyTournamentRecord,individualPrize
          }).byName.get(name)?.score||0
        }));
      }
      return growthCache.get(key);
    }
    const growthValue=(value,metric)=>metric==='pr'?prNumber(value):
      metric==='cash'?'$'+Number(value||0).toLocaleString('ja-JP',{maximumFractionDigits:2}):format(value);
    function profileGrowthSection(info){
      return '<section class="profile-growth" id="profile-growth" aria-labelledby="profile-growth-title">'
        +'<div class="growth-heading"><div><span class="growth-eyebrow">ASIA ON TOUR / PLAYER PROGRESSION</span>'
        +'<h2 id="profile-growth-title">海外遠征の<span>成長グラフ</span></h2>'
        +'<p>全期間の掲載済み戦績を月別・シーズン別に分析</p></div>'
        +'<span class="growth-live-mark" aria-hidden="true">📈</span></div>'
        +'<div id="growth-chart-content" aria-live="polite"></div></section>';
    }
    function renderProfileGrowth(name){
      const root=$('#growth-chart-content');
      if(!root)return;
      const report=growthReport(name),metric=AsiaGrowth.METRICS.find(x=>x.id===growthState.metric)||AsiaGrowth.METRICS[0];
      const points=AsiaGrowth.series(report,metric.id,growthState.mode);
      const controls='<div class="growth-controls">'
        +'<div class="growth-control-group" role="group" aria-label="集計単位">'
        +[['month','月別'],['season','シーズン別']].map(([id,label])=>'<button type="button" data-growth-grouping="'+id+'" aria-pressed="'+(growthState.grouping===id)+'">'+label+'</button>').join('')+'</div>'
        +'<div class="growth-control-group" role="group" aria-label="表示方法">'
        +[['cumulative','累計'],['period','期間別']].map(([id,label])=>'<button type="button" data-growth-mode="'+id+'" aria-pressed="'+(growthState.mode===id)+'">'+label+'</button>').join('')+'</div>'
        +'<div class="growth-control-group growth-metrics" role="group" aria-label="表示する成長指標">'
        +AsiaGrowth.METRICS.map(def=>'<button type="button" data-growth-metric="'+escape(def.id)+'" aria-pressed="'+(metric.id===def.id)+'">'+escape(def.label)+'</button>').join('')+'</div></div>';
      if(!points.length){
        root.innerHTML=controls+'<p class="growth-empty">この選手には、日付・シーズンを確認できる掲載戦績がまだありません。確認済み戦績が追加されると自動的にグラフへ反映されます。</p>';
        return;
      }
      const current=points.find(p=>p.key===growthState.selectedKey)||points.at(-1);
      const maxVal=Math.max(1,...points.map(point=>point.value));
      const width=Math.max(640,Math.min(9000,points.length*68+100)),height=284;
      const left=74,right=24,top=22,bottom=57,base=height-bottom;
      const x=i=>left+(points.length>1?(width-left-right)*i/(points.length-1):0);
      const y=value=>top+(base-top)*(1-value/maxVal);
      const coords=points.map((p,i)=>[Number(x(i).toFixed(2)),Number(y(p.value).toFixed(2))]);
      const poly=coords.map(([px,py],i)=>(i?'L':'M')+px+' '+py).join(' ');
      const area='M'+coords[0][0]+' '+base+' '+poly.replace(/^M/,'L')+' L'+coords.at(-1)[0]+' '+base+' Z';
      const activeIndex=points.indexOf(current),axisTicks=[0,.25,.5,.75,1].map(f=>{
        const value=maxVal*f,py=y(value);
        return '<line x1="'+left+'" y1="'+py+'" x2="'+(width-right)+'" y2="'+py+'" class="growth-gridline"/>'
          +'<text x="'+(left-12)+'" y="'+(py+4)+'" text-anchor="end" class="growth-axis-value">'+escape(metric.id==='cash'?'$'+format(Math.round(value)):metric.id==='pr'?format(Math.round(value)):format(Math.round(value)))+'</text>';
      }).join('');
      const every=Math.max(1,Math.ceil(points.length/8));
      const axisLabels=points.map((point,i)=>(i%every===0||i===points.length-1)
        ?'<text x="'+x(i)+'" y="'+(height-18)+'" text-anchor="middle" class="growth-axis-label">'+escape(point.label)+'</text>':'').join('');
      const dots=coords.map(([px,py],i)=>'<circle cx="'+px+'" cy="'+py+'" r="'+(points[i].key===current.key?6:3.5)+'" class="'+(points[i].key===current.key?'growth-dot is-selected':'growth-dot')+'"/>').join('');
      const activeX=x(activeIndex),activeY=y(current.value);
      const svg='<svg class="growth-svg" width="'+width+'" height="'+height+'" viewBox="0 0 '+width+' '+height+'" role="img" aria-labelledby="growth-svg-title growth-svg-desc">'
        +'<title id="growth-svg-title">'+escape(name)+' · '+escape(metric.label)+'の'+(growthState.mode==='cumulative'?'累計':'期間別')+'推移</title>'
        +'<desc id="growth-svg-desc">出典確認済みの掲載戦績を'+(growthState.grouping==='month'?'月別':'シーズン別')+'に集計した折れ線グラフ。下の期間ボタンから数値を確認できます。</desc>'
        +'<defs><linearGradient id="growth-area-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#83c7f3" stop-opacity=".34"/><stop offset="1" stop-color="#83c7f3" stop-opacity=".02"/></linearGradient></defs>'
        +axisTicks+axisLabels+'<path d="'+area+'" fill="url(#growth-area-fill)"/>'
        +(points.length>1?'<path d="'+poly+'" class="growth-trend-line"/>':'')
        +'<line x1="'+activeX+'" y1="'+top+'" x2="'+activeX+'" y2="'+base+'" class="growth-guide"/>'
        +dots+'<circle cx="'+activeX+'" cy="'+activeY+'" r="10" class="growth-dot-halo"/></svg>';
      const values=points.map(point=>'<button type="button" class="growth-period-button" data-growth-point="'+escape(point.key)+'" aria-pressed="'+(point.key===current.key)+'">'
        +'<span>'+escape(point.label)+'</span><strong>'+escape(growthValue(point.value,metric.id))+'</strong></button>').join('');
      const peak=points.reduce((best,p)=>(p.period[metric.id]>best.period[metric.id]?p:best),points[0]);
      const last=points.at(-1);
      const detail='<div class="growth-detail" aria-live="polite"><div><small>選択期間</small><strong>'+escape(current.label)+'</strong>'
        +'<span>掲載 '+format(current.records)+'件'+(!current.records?'（記録なし）':'')+'</span></div>'
        +'<div><small>'+(growthState.mode==='cumulative'?'その時点までの累計':'この期間の記録')+'</small><strong>'+escape(growthValue(current.value,metric.id))+'</strong>'
        +'<span>'+escape(metric.label)+'</span></div>'
        +'<div><small>期間別の最高記録</small><strong>'+escape(growthValue(peak.period[metric.id],metric.id))+'</strong>'
        +'<span>'+escape(peak.label)+'</span></div></div>';
      const table='<details class="growth-data-details"><summary>すべての期間の数値を表で見る</summary>'
        +'<div class="growth-table-wrap"><table><thead><tr><th>期間</th><th>掲載数</th><th>'+escape(metric.label)+'（'+(growthState.mode==='cumulative'?'累計':'期間別')+'）</th></tr></thead><tbody>'
        +points.map(point=>'<tr><th>'+escape(point.label)+'</th><td>'+format(point.records)+'件</td><td>'+escape(growthValue(point.value,metric.id))+'</td></tr>').join('')
        +'</tbody></table></div></details>';
      root.innerHTML=controls+detail
        +'<div class="growth-chart-scroll" tabindex="0" aria-label="期間推移のグラフ。横スクロールできます">'+svg+'</div>'
        +'<div class="growth-period-picker" role="group" aria-label="数値を確認する期間">'+values+'</div>'
        +table
        +'<p class="growth-footnote">※ グラフは選択中のシーズンに関係なく全期間の確認済み掲載戦績から計算します。未掲載の月は「掲載0件」であり大会への不参加を意味しません。AOT PRは現行の計算式を過去の掲載記録へ適用した参考推移であり、当時の公式PRや順位ではありません。賞金は確認済みの個人現金額のみ。決勝出場は順位が確認済みの決勝（Practice等を含む）、決勝TOP3は確認済みの賞金決勝のみ。シーズン未確認の戦績はシーズン別グラフには含めません。</p>';
      // Show the latest result on first open without disrupting later manual
      // point selection, and keep the drawn line legible on narrow screens.
      const chart=root.querySelector('.growth-chart-scroll');
      if(chart&&growthState.selectedKey===null)chart.scrollLeft=chart.scrollWidth;
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
      $('#profile-content').innerHTML=`<div class="profile-toolbar"><button class="btn sm ghost" id="profile-back" data-profile-back type="button">← 戻る</button><button type="button" class="profile-compare-action" data-compare-profile="${escape(info.name)}">⚔️ 他の選手と比較</button><button type="button" class="profile-compare-action" data-style-jump>🎯 プレイスタイルへ</button><a href="#journey-title" data-journey-jump>海外遠征年表へ ↓</a><a id="profile-share" href="${escape(shareUrl)}" title="このURLをコピーして共有できます">プロフィールのURL ↗</a></div><header class="profile-hero"><div><p class="profile-kicker">PLAYER PROFILE / ASIA OVERSEAS</p><div class="profile-identity"><div class="profile-avatar" aria-hidden="true">${escape(info.initials)}</div><div class="profile-identity-copy"><h1 class="profile-name" id="profile-title" tabindex="-1" data-profile="name">${escape(info.name)}</h1><p class="profile-alias-heading">確認済みの別名義</p><div class="profile-aliases" data-profile="aliases">${aliases}</div></div></div>${info.desc?`<p class="profile-description">${candidates.some(c=>c.name===info.name)?'<span class="season-biography-note">紹介文：CH7 S4時点</span>':''}${escape(info.desc)}</p>`:''}${external}</div><div class="profile-prize-total"><p class="profile-total-label">${escape(seasonPrizeLabel())}</p><div class="profile-total-value"><span data-profile="total">$${format(info.total)}</span><small>USD</small></div><p class="profile-total-hint">${escape(seasonScope())}の個人賞金累計<br>デュオは確認済みの個人分のみ集計<span class="profile-lifetime">全期間の確認済み個人賞金 <b data-profile="lifetime-total">$${format(info.lifetimeTotal)}</b></span></p></div></header><div class="profile-stats"><article class="profile-stat"><h2>賞金獲得記録</h2><div class="profile-stat-value"><span data-profile="prize-events">${format(info.prizeEvents)}</span><small>件</small></div><p class="profile-stat-context">個人賞金の獲得を確認した記録</p></article><article class="profile-stat"><h2>掲載されている海外戦績</h2><div class="profile-stat-value"><span data-profile="events">${format(info.events.length)}</span><small>件</small></div><p class="profile-stat-context">予選・決勝を含む全掲載記録</p></article>${profileBestCard('予選の最高順位',info.bestQualifying,'best-qualifying')}${profileBestCard('決勝の最高順位',info.bestFinal,'best-final')}</div>${profileAchievementsSection(info)}${profileGrowthSection(info)}${profileSnapshotSection(info)}${journeySection(info)}<section aria-labelledby="profile-region-title"><div class="profile-region-heading"><div><h2 id="profile-region-title">地域別の<span>実績</span></h2><p>${visited?'戦績掲載地域':'海外大会の戦績はまだ掲載されていません'}</p></div><div class="profile-regions-visited" aria-label="海外挑戦地域">${visited}</div></div><div class="profile-region-charts">${profileRegionChart(info,'count')}${profileRegionChart(info,'prize')}</div></section><section aria-labelledby="profile-history-title"><div class="profile-history-heading"><div><h2 id="profile-history-title">海外大会<span>履歴</span></h2><p>${escape(seasonScope())} · 新しい順 · 賞金獲得記録は金色で表示</p></div><span class="profile-history-count">${format(info.events.length)}件</span></div><div class="profile-history">${info.events.length?info.events.map(e=>profileHistoryRow(e,info.name)).join(''):'<div class="profile-empty"><h3>海外大会の戦績はまだ未登録です</h3><p>選手名鑑には掲載されていますが、確認済みの海外大会記録はまだ掲載されていません。</p></div>'}</div></section>`;
      renderJourney(info);
      renderProfileAotPR(info.name);
      renderProfileGrowth(info.name);
      renderProfileStyle(info.name);
      window.AOTParticipation?.renderProfile(info.name);
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
        vrs:'確認済みの掲載戦績にあるVRの合計です。予選・決勝・スキン大会を含みます。デュオ等のVRはチームとしての獲得を各選手に付与しており、個人の単独勝利回数とは異なります。未確認のVRは合計せず、確認済み0VRと区別します。',
        regions:'選択期間・大会形式・シリーズに掲載記録がある開催地域の種類数です。同じ地域は何件あっても1地域として数えます。全地域を選択したときだけ利用できます。',
        skins:'確認済みのスキン報酬獲得が明記された掲載記録だけを数えます。参加や順位だけでは獲得を推測せず、現金賞金にも加算しません。'
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
    // AOT PR v1.4: scoring is isolated in aot-pr.js and never mutates JSON.
    let aotPrRegion='all';
    const prNumber=n=>Number(n||0).toLocaleString('ja-JP',{minimumFractionDigits:1,maximumFractionDigits:1});
    // The loaded data is read-only; reuse reports while browsing this season.
    let aotPrReportSeason=null;
    const aotPrReports=new Map();
    let participationPRRows=[];
    const confirmedPRPlayers=new Set(candidates.map(p=>p.name));
    function mergeForPR(published,participation=participationPRRows,filterSeason=selectedSeason){
      if(!participation.length||typeof window.AotParticipationPR?.merge!=='function')return {records:published,creditedRows:0,creditedPlayers:0};
      const source=participation.filter(row=>filterSeason==='all'||row.seasonId===filterSeason);
      return window.AotParticipationPR.merge(published,source,{
        classify:classifyTournamentRecord,sessionKey:AotPR.sessionKey,knownPlayers:confirmedPRPlayers
      });
    }
    function prReport(region='all'){
      if(aotPrReportSeason!==selectedSeason){aotPrReports.clear();aotPrReportSeason=selectedSeason;}
      if(!aotPrReports.has(region))aotPrReports.set(region,AotPR.calculate(mergeForPR(all()).records,{region,names,classify:classifyTournamentRecord,individualPrize}));
      return aotPrReports.get(region);
    }
    function renderAotPR(){
      const target=$('#aot-pr-leaders');
      if(!target)return;
      const report=prReport(aotPrRegion);
      document.querySelectorAll('[data-aot-pr-region]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.aotPrRegion===aotPrRegion)));
      $('#aot-pr-status').textContent=`${seasonScope()} · ${aotPrRegion==='all'?'全地域':aotPrRegion} · ${format(report.playerCount)}名 / ${format(report.recordCount)}戦績（出場アーカイブ ${format(report.participationIncluded||0)}件） · 上位50名を表示`;
      target.innerHTML=report.ranked.length?report.ranked.slice(0,50).map(player=>`<li class="aot-pr-item" data-top="${player.rank<=3}"><span class="aot-pr-rank">#${format(player.rank)}</span><div><a class="aot-pr-name" href="${escape(profileHref(player.name))}" data-open-profile="${escape(player.name)}">${escape(player.name)}</a><span class="aot-pr-facts">参加 ${format(player.appearances)}枠 · 順位 ${prNumber(player.placement)} · キル ${prNumber(player.eliminations)} · 出場記録から ${prNumber(player.participationScore||0)} · 予選突破 ${prNumber(player.qualificationBonus)} · 賞金ボーナス ${prNumber(player.bonus)}</span></div><span class="aot-pr-score">${prNumber(player.score)}<small>AOT PR</small></span></li>`).join(''):'<li class="aot-pr-item">この条件で加点できる確認済み戦績はありません</li>';
    }
    function renderProfileAotPR(name){
      const anchor=$('#profile-content .profile-stats');
      if(!anchor)return;
      const report=prReport(),player=report.byName.get(name);
      if(!player){anchor.insertAdjacentHTML('afterend',`<section class="aot-pr-profile" aria-label="AOT PRの個人内訳"><h2>AOT PR · 未集計</h2><p class="aot-pr-method">${escape(seasonScope())}には、加点できる確認済み戦績がありません。大会分類などが未確認の記録は加点を保留しています。</p></section>`);return;}
      const rows=player.rows.map(row=>`<li><strong>+${prNumber(row.total)}pt</strong> ${escape(row.date)} · ${escape(row.region)} · ${escape(row.event)}<span>${escape(row.participationOnly?(row.participationStatus==='通過圏外'?'通過圏外（基本PRのみ）':'出場確認（基本PRのみ）'):row.kind)} · 参加 ${prNumber(row.attendance)} / 順位 ${prNumber(row.placement)} / キル ${prNumber(row.eliminations)}${row.bonus>0?` · 賞金ボーナス ${prNumber(row.bonus)}（${row.bonusMode==='vr'?`${row.bonusUnits}VR`:'賞金獲得1回'}）`:''}${row.qualificationBonus>0?` · 予選突破ボーナス ${prNumber(row.qualificationBonus)}（${row.qualificationEvidence==='official-cutoff'?'公式通過枠':row.qualificationEvidence==='verified-note'?'確認済み決勝進出記録':row.qualificationEvidence==='verified-screenshot'?'提供スクショ＋公式通過枠':row.qualificationEvidence==='verified-final'?'出典確認済み決勝進出':'予選突破明記'}）`:''}${row.rank===null?' · 順位未確認':''}${row.kills===null?' · キル未確認':''}${!row.modeKnown?' · 形式未確認・キル加点保留':''}</span>${safeUrl(row.source)?`<a href="${escape(safeUrl(row.source))}" target="_blank" rel="noopener noreferrer">出典 ↗</a>`:''}</li>`).join('');
      anchor.insertAdjacentHTML('afterend',`<section class="aot-pr-profile" aria-label="AOT PRの個人内訳"><h2>AOT PR v${escape(AotPR.VERSION)} · ${prNumber(player.score)} pt（総合 #${format(player.rank)}）</h2><dl class="aot-pr-overview"><div><dt>参加ポイント</dt><dd>${prNumber(player.attendance)}</dd></div><div><dt>順位ポイント</dt><dd>${prNumber(player.placement)}</dd></div><div><dt>キルポイント</dt><dd>${prNumber(player.eliminations)}</dd></div><div><dt>出場記録からのPR</dt><dd>${prNumber(player.participationScore||0)}</dd></div><div><dt>予選突破ボーナス</dt><dd>${prNumber(player.qualificationBonus)}</dd></div><div><dt>賞金ボーナス</dt><dd>${prNumber(player.bonus)}</dd></div><div><dt>参加した開催枠</dt><dd>${format(player.appearances)}</dd></div></dl><details class="aot-pr-breakdown"><summary>大会別のポイント内訳（${format(player.rows.length)}件）</summary><ol>${rows}</ol></details><p class="aot-pr-method">${escape(seasonScope())}の掲載済み・出典確認済み戦績から計算しています。確認済みの予選突破明記・公式の地域別通過枠・確認済み決勝進出記録に基づき、同じ選手・大会・開催枠につき1回だけ10pt×地域倍率を付与します。予選の掲載がなくても、当該大会の確定した決勝戦績が証拠となる場合があります。通過を確認できない場合は保留し、賞金ボーナスは別に計算します。本人IDが照合できる出場アーカイブは、重複のない開催枠で参加・順位・キルの基本PRのみ加点します。通過・賞金・称号ボーナスは付きません。大会の未掲載や情報未確認により、実際の活動を網羅するものではありません.</p></section>`);
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
    function resultCard(e){const v=verificationLabel(e);const src=safeUrl(e.source);const rankDigits=Number.isInteger(e.rank)?String(e.rank).length:0;const rankSizeClass=rankDigits>=5?' rank-five-digit':rankDigits>=4?' rank-four-digit':'';return `<article class="result-card${isPrizeWin(e)?' is-prize-win':''}"><div class="rank ${e.rank===1?'gold':e.rank<=3?'silver':''}${rankSizeClass}">${Number.isInteger(e.rank)?'<span class="hash">#</span>':''}${Number.isInteger(e.rank)?format(e.rank):'<span style="font-size:19px">'+(e.reported?'確認中':'通過')+'</span>'}</div><div class="result-content"><div class="result-title">${profileNameLinks(e)} <span style="color:#9fa7bf;font-weight:600;font-size:11px">/ ${escape(e.event)}</span></div>${isPrizeWin(e)||hasClaimedPrize(e)?`<div class="prize-ribbon">${winBadge(e,true)}</div>`:''}<div class="result-sub">${seasonStamp(e)} ${friendlyDate(e.date)} · ASIA → ${escape(e.region)} · ${escape(e.round||'大会結果')}</div><div class="result-meta">${regionPill(e.region)}<span class="pill">${escape(stageLabel(e))}</span><span class="pill ${e.partial?'orange':e.verified?'green':'orange'}">${e.reported?'△':e.partial?'△':e.verified?'✓':'✎'} ${v}</span><span class="pill">${format(e.kills)} KILLS</span><span class="pill">${format(e.vrs)} VR</span></div></div><div class="right-data"><div class="score">${format(e.points)} <small>PTS</small></div>${src?`<a class="external-link" href="${escape(src)}" target="_blank" rel="noopener noreferrer">出典を見る ↗</a>`:'<span class="fine">出典未登録</span>'}</div></article>`}


    // A registration date is recorded only when a GitHub addition is verified.
    let registrationLimit=20;
    const registrationCache=new WeakMap();
    function registeredRows(){
      const seasonRows=all();
      if(registrationCache.has(seasonRows))return registrationCache.get(seasonRows);
      const byId=new Map(rawAll().map(record=>[record.id,record]));
      const inSeason=new Set(seasonRows.map(record=>record.id));
      const seen=new Set(),registered=[];
      for(const entry of updateEntries){
        if(entry.type!=='records'||!Array.isArray(entry.recordIds))continue;
        for(const id of entry.recordIds){
          if(seen.has(id))continue;
          seen.add(id);
          const record=byId.get(id);
          if(record&&inSeason.has(id))registered.push({record,registeredAt:entry.date});
        }
      }
      registrationCache.set(seasonRows,registered);
      return registered;
    }
    function registrationItem(item){
      return '<div class="registration-item" data-registration-id="'+escape(item.record.id)+'">'
        +'<p class="registration-meta"><span>NEW · 登録日 <time datetime="'+escape(item.registeredAt)+'">'+escape(friendlyDate(item.registeredAt))+'</time></span>'
        +'<span class="competition-date">大会開催日 <time datetime="'+escape(item.record.date)+'">'+escape(friendlyDate(item.record.date))+'</time></span></p>'
        +resultCard(item.record)+'</div>';
    }
    function updateRecordLinks(entry,byId){
      const ids=Array.isArray(entry.recordIds)?entry.recordIds:[];
      if(!ids.length)return '';
      const records=ids.map(id=>byId.get(id)).filter(Boolean);
      return '<details><summary>今回追加した'+format(records.length)+'件の戦績を見る</summary><ul class="update-record-links">'
        +records.map(record=>'<li><a href="'+escape(profileHref(names(record)[0]))+'" data-open-profile="'+escape(names(record)[0])+'">'
          +escape(record.player)+'</a> · '+escape(record.region)+' · '+escape(record.kind)+' · '+escape(rankLabel(record))+'</li>').join('')
        +'</ul></details>';
    }
    function updateEntryItem(entry,byId){
      const category=entry.type==='records'?'新着戦績':'サイト改善';
      return '<article class="update-entry" data-update-id="'+escape(entry.id)+'"><div>'
        +'<span class="update-entry-label">'+escape(category)+'</span><time datetime="'+escape(entry.date)+'">'+escape(friendlyDate(entry.date))+'</time></div>'
        +'<h3 class="update-entry-title">'+escape(entry.title)+'</h3>'
        +'<p class="update-entry-description">'+escape(entry.description)+'</p>'
        +updateRecordLinks(entry,byId)+'</article>';
    }
    function renderUpdates(){
      const records=registeredRows(),byId=new Map(rawAll().map(record=>[record.id,record]));
      const empty='<div class="empty">登録日を確認できる新着戦績はまだありません。大会の開催日から推測して表示することはありません。</div>';
      $('#home-new-registrations').innerHTML=records.length?records.slice(0,4).map(registrationItem).join(''):empty;
      $('#new-entries-list').innerHTML=records.length?records.slice(0,registrationLimit).map(registrationItem).join(''):empty;
      $('#registration-more').hidden=registrationLimit>=records.length;
      $('#new-registration-count').textContent='登録日を確認できた '+format(records.length)+'戦績 · '+seasonScope()+' · '+format(Math.min(registrationLimit,records.length))+'件表示';
      $('#home-update-preview').innerHTML=updateEntries.slice(0,3).map(entry=>'<div class="update-preview-line"><time datetime="'+escape(entry.date)+'">'+escape(friendlyDate(entry.date))+'</time><p>'+escape(entry.title)+'</p></div>').join('');
      $('#updates-feed').innerHTML=updateEntries.length?updateEntries.map(entry=>updateEntryItem(entry,byId)).join(''):'<div class="empty">まだ更新履歴はありません</div>';
    }


    // Current-season highlights are derived from existing, verified records.
    function renderHomeShowcase(){
      const prize=prizeTotals()[0]||null;
      const pr=prReport().ranked.find(player=>player.score>0)||null;
      const vr=AsiaRankings.buildRankings(all(),{metric:'vrs'},{
        names,individualPrize,classifyTournamentRecord,confirmedPrizeFinalRank,confirmedSkinReward,
        series:rankingSeries().map(o=>o.id)
      }).rows.find(player=>player.value>0&&player.knownRecords>0)||null;
      const picks=[
        prize&&{id:'prize',label:'CONFIRMED EARNINGS LEADER',title:'確認済み個人賞金',name:prize.name,value:'$'+format(prize.total),note:'賞金獲得 '+format(prize.events)+'件 · デュオは個人分のみ'},
        pr&&{id:'pr',label:'AOT POWER RANKING',title:'独自PR・総合トップ',name:pr.name,value:prNumber(pr.score)+' pt',note:'総合 #'+format(pr.rank)+' · '+format(pr.appearances)+'開催枠 · 非公式'},
        vr&&{id:'vrs',label:'VERIFIED VICTORY ROYALES',title:'確認済み海外VR',name:vr.name,value:format(vr.value)+' VR',note:'数値確認 '+format(vr.knownRecords)+'戦績 · チーム戦を含む'}
      ].filter(Boolean);
      $('#home-showcase-players').innerHTML=picks.length?picks.map((p,i)=>
        '<a class="home-pick'+(!i?' is-lead':'')+'" data-home-feature="'+escape(p.id)+'" href="'+escape(profileHref(p.name))+'" data-open-profile="'+escape(p.name)+'">'
        +'<span class="home-pick-index">'+escape(p.label)+'</span><span class="home-pick-label">'+escape(p.title)+'</span>'
        +'<strong class="home-pick-name">'+escape(p.name)+'</strong><span class="home-pick-value">'+escape(p.value)+'</span>'
        +'<span class="home-pick-context">'+escape(p.note)+'</span><span class="home-pick-action">プロフィールを見る ↗</span></a>'
      ).join(''):'<div class="empty">この期間に注目選手として表示できる確認済み実績はまだありません。</div>';
    }
    function renderHomeRecords(){
      const rows=all(),used=new Set();
      const recent=(a,b)=>String(b.date||'').localeCompare(String(a.date||''))||String(a.id||'').localeCompare(String(b.id||''));
      const payout=rows.filter(r=>individualPrize(r)>0).sort((a,b)=>individualPrize(b)-individualPrize(a)||recent(a,b))[0];
      const highlights=[];
      if(payout){highlights.push({id:'payout',heading:'BIGGEST VERIFIED PAYOUT',label:'掲載内の最高個人賞金',value:'$'+format(individualPrize(payout)),row:payout});used.add(payout.id);}
      const podium=rows.filter(r=>{const rank=confirmedPrizeFinalRank(r);return rank!==null&&rank<=3;})
        .sort(recent).find(r=>!used.has(r.id));
      if(podium){highlights.push({id:'podium',heading:'PRIZE FINAL · TOP 3',label:'賞金決勝の総合TOP3',value:'#'+format(confirmedPrizeFinalRank(podium)),row:podium});used.add(podium.id);}
      const skin=rows.filter(confirmedSkinReward).sort(recent).find(r=>!used.has(r.id));
      if(skin)highlights.push({id:'skin',heading:'VERIFIED SKIN REWARD',label:'確認済みスキン報酬獲得',value:'SKIN',row:skin});
      $('#home-showcase-records').innerHTML=highlights.length?highlights.map(h=>{
        const e=h.row,t=classifyTournamentRecord(e),source=safeUrl(e.source);
        return '<article class="home-record" data-home-record="'+escape(h.id)+'" data-result-id="'+escape(e.id)+'">'
          +'<span class="home-record-label">'+escape(h.heading)+'</span><strong class="home-record-value">'+escape(h.value)+'</strong>'
          +'<p class="home-pick-label">'+escape(h.label)+'</p><h3><a href="'+escape(tournamentHref(t.id))+'" data-open-tournament="'+escape(t.id)+'">'+escape(e.event)+' ↗</a></h3>'
          +'<p class="home-record-detail">'+escape(friendlyDate(e.date))+' · '+escape(e.region)+' · '+escape(e.kind)+' · '+escape(rankLabel(e))+'</p>'
          +'<div class="home-record-people">'+[...new Set(names(e))].map(n=>'<a href="'+escape(profileHref(n))+'" data-open-profile="'+escape(n)+'">'+escape(n)+'</a>').join(' / ')+'</div>'
          +(source?'<a class="home-record-source" href="'+escape(source)+'" target="_blank" rel="noopener noreferrer">出典で確認 ↗</a>':'<span class="home-record-detail">出典URL未登録</span>')+'</article>';
      }).join(''):'<div class="empty">この期間に掲載できる確認済みの賞金・総合TOP3・スキン報酬記録はまだありません。</div>';
    }
    function renderHome(){const a=all();$('#stat-results').textContent=a.length;$('#stat-players').textContent=new Set(a.flatMap(names)).size;$('#stat-regions').textContent=new Set(a.map(e=>e.region)).size;$('#stat-top10').textContent=a.filter(e=>e.rank<=10).length;const latest=a.slice().sort((x,y)=>y.date.localeCompare(x.date)).slice(0,3);$('#latest-results').innerHTML=latest.length?latest.map(resultCard).join(''):'<div class="empty">まだ戦績が登録されていないよ</div>';$('#region-breakdown').innerHTML=regions.map(r=>{const n=a.filter(e=>e.region===r).length;const percent=a.length?(n/a.length*100):0;return `<div class="region-entry"><div class="reg-left"><div class="flag" data-region="${escape(r)}">${escape(r)}</div><div class="reg-details"><strong>${{ME:'中東',EU:'ヨーロッパ',NAC:'北米中部',NAW:'北米西部',OCE:'オセアニア',BR:'ブラジル'}[r]}</strong><small>${n?'登録あり':'未登録'}</small><div class="reg-bar"><span style="width:${percent}%"></span></div></div></div><span class="reg-count">${n}</span></div>`}).join('');renderHomeShowcase();renderHomeRecords()}
    function renderPlayerCard(p){const events=seasonPlayerIndex().byName.get(p.name)||[];const sum=playerPrizeTotal(p.name);const evolution=achievementsForPlayer(p.name).evolution;const featured=evolution.featured;return `<a class="player" href="${escape(profileHref(p.name))}" data-open-profile="${escape(p.name)}"><div class="player-top"><div class="avatar">${escape(p.initials)}</div><div><div class="player-name">${escape(p.name)}</div><div class="player-region">🌏 遠征関連選手 · ${events.length?'戦績掲載中':'海外結果を調査中'}</div></div></div><div class="player-blurb"><span class="season-biography-note">${candidates.some(c=>c.name===p.name)?'紹介文：CH7 S4時点':'掲載選手'}</span>${escape(p.desc)}</div><div class="player-achievement-preview" data-player-achievement="${escape(featured?.id||'none')}" data-evolution-tier="${escape(featured?.current?.tier||'locked')}"><span aria-hidden="true">${escape(featured?.icon||'🏅')}</span> ${escape(featured?.current?.title||'実績に挑戦中')} <small>· ${format(evolution.earnedStages)}/${format(evolution.totalStages)}</small></div><div class="player-earnings${sum?'':' zero'}"><span>🏆 ${escape(seasonLabel())}の確認済み賞金<br><small>掲載済み・確認済みの個人累計</small></span><strong>${events.length?'$'+format(sum):'未登録'}</strong></div><div class="player-bottom"><span>掲載された海外戦績 <strong>${events.length}</strong> 件</span><span class="player-card-action">プロフィールを見る →</span></div></a>`}
    let visible=[]; let selectedPlayer=null;
    const ARCHIVE_PAGE_SIZE=50;
    let archivePage=1;
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
    function renderArchivePagination(){
      const total=visible.length;
      const pages=Math.max(1,Math.ceil(total/ARCHIVE_PAGE_SIZE));
      archivePage=Math.min(Math.max(1,archivePage),pages);
      const from=total?(archivePage-1)*ARCHIVE_PAGE_SIZE+1:0;
      const to=Math.min(archivePage*ARCHIVE_PAGE_SIZE,total);
      const button=(page,label,disabled=false,active=false,aria='')=>'<button type="button" class="archive-pagination-btn'+(active?' is-current':'')+'" data-archive-page="'+page+'"'+(disabled?' disabled':'')+(active?' aria-current="page"':'')+(aria?' aria-label="'+aria+'"':'')+'>'+label+'</button>';
      const candidates=[1,pages,archivePage-2,archivePage-1,archivePage,archivePage+1,archivePage+2]
        .filter(page=>page>=1&&page<=pages).sort((a,b)=>a-b);
      const pageNumbers=[...new Set(candidates)];
      let previous=0;
      const numbered=pageNumbers.map(page=>{
        const gap=page-previous>1?'<span class="archive-pagination-gap" aria-hidden="true">…</span>':'';
        previous=page;
        return gap+button(page,format(page),false,page===archivePage,format(page)+'ページへ');
      }).join('');
      const controls=pages>1?'<div class="archive-pagination-controls">'
        +button(1,'« 最初',archivePage===1,false,'最初のページへ')
        +button(archivePage-1,'‹ 前へ',archivePage===1,false,'前のページへ')
        +numbered
        +button(archivePage+1,'次へ ›',archivePage===pages,false,'次のページへ')
        +button(pages,'最後 »',archivePage===pages,false,'最後のページへ')
        +'</div>':'';
      const status='全'+format(total)+'件中 '+format(from)+'〜'+format(to)+'件を表示 · '+format(archivePage)+' / '+format(pages)+'ページ';
      for(const id of ['result-pagination-top','result-pagination-bottom']){
        const target=$('#'+id);
        if(target)target.innerHTML='<nav class="archive-pagination" aria-label="遠征結果のページ切り替え"><p class="archive-pagination-status"'+(id==='result-pagination-top'?' role="status" aria-live="polite"':'')+'>'+status+'</p>'+controls+'</nav>';
      }
    }
    function renderResults(){
      const s=($('#search-results').value||'').trim().toLowerCase();
      const r=$('#region-filter').value;
      const prize=$('#prize-only').checked;
      const stage=$('#stage-filter').value;
      visible=all().filter(e=>(!selectedPlayer||names(e).includes(selectedPlayer))&&(r==='all'||e.region===r)&&(stage==='all'||e.kind===stage)&&(!prize||isPrizeWin(e))&&(!s||[e.player,...names(e),e.playerRaw,e.event,e.region,e.round,e.note].some(x=>String(x||'').toLowerCase().includes(s))));
      const order=$('#sort-results').value;
      const registrationDates=order==='registered'
        ?new Map(registeredRows().map(item=>[item.record.id,item.registeredAt]))
        :null;
      visible.sort((a,b)=>{
        if(order==='oldest')return a.date.localeCompare(b.date);
        if(order==='vrs')return (b.vrs??-1)-(a.vrs??-1)||b.date.localeCompare(a.date);
        if(order==='rank')return (a.rank??Infinity)-(b.rank??Infinity)||b.date.localeCompare(a.date);
        if(order==='kills')return (b.kills??-1)-(a.kills??-1);
        if(order==='prize')return (Number(b.prize)||0)-(Number(a.prize)||0)||b.date.localeCompare(a.date);
        if(order==='points')return (Number(b.points)||0)-(Number(a.points)||0)||b.date.localeCompare(a.date);
        if(order==='registered')return (registrationDates.get(b.id)||'').localeCompare(registrationDates.get(a.id)||'')||b.date.localeCompare(a.date);
        return b.date.localeCompare(a.date);
      });
      $('#result-count').textContent=format(visible.length)+'件';
      renderArchivePagination();
      if(!visible.length){
        $('#result-table').innerHTML='<div class="empty"><div class="emoji">🔎</div><b>条件に合う戦績がまだないよ</b><p>検索条件や絞り込みを変えてみてね</p></div>';
        return;
      }
      const shown=visible.slice((archivePage-1)*ARCHIVE_PAGE_SIZE,archivePage*ARCHIVE_PAGE_SIZE);
      $('#result-table').innerHTML='<div class="archive-head" aria-hidden="true"><span>日付</span><span>選手名</span><span>地域</span><span>大会名</span><span>順位</span><span>KILLS</span><span>VR</span><span>賞金 / USD</span></div><div class="archive-list">'+shown.map(archiveRow).join('')+'</div>';
    }
    function renderPlayers(){
      const s=($('#search-players').value||'').trim().toLowerCase();
      const shown=selectedSeasonPlayers().filter(p=>[p.name,...(confirmedAliases[p.name]||[])].some(n=>n.toLowerCase().includes(s)));
      const sort=$('#player-sort').value;
      const byName=seasonPlayerIndex().byName;
      shown.sort((a,b)=>sort==='name'?a.name.localeCompare(b.name,'ja')
        :sort==='events'?(byName.get(b.name)?.length||0)-(byName.get(a.name)?.length||0)||a.name.localeCompare(b.name,'ja')
        :playerPrizeTotal(b.name)-playerPrizeTotal(a.name)||a.name.localeCompare(b.name,'ja'));
      $('#all-players').innerHTML=shown.length?shown.map(renderPlayerCard).join(''):'<div class="empty">一致する選手はまだいないよ</div>';
    }

    // Archive and player cards are expensive and belong to hidden pages at startup.
    // showView() already renders each on demand, including deep links and season changes.
    function refresh(){renderSeasonControl();renderHome();renderEarnings();renderAotPR();renderUpdates()}
    function csvText(rows){const cols=['date','player','players','region','event','round','rank','points','kills','vrs','prize','prizePerPlayer','kind','source','verified','note','chapter','season','seasonId'];const cell=x=>'"'+String(x??'').replace(/"/g,'""')+'"';return '\ufeff'+cols.join(',')+'\r\n'+rows.map(e=>cols.map(k=>cell(k==='players'?names(e).join(' / '):['chapter','season','seasonId'].includes(k)?recordSeason(e)[k]:e[k])).join(',')).join('\r\n')}
    function download(name,content,type){const b=new Blob([content],{type});const url=URL.createObjectURL(b);const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)}
    document.addEventListener('click',e=>{
      const remove=e.target.closest('[data-compare-remove]');
      if(remove&&currentView.page==='compare'){
        updateComparison({...compareState,players:compareState.players.filter(name=>name!==remove.dataset.compareRemove)});
        return;
      }
      const profileCompare=e.target.closest('[data-compare-profile]');
      if(profileCompare){compareFromProfile(profileCompare.dataset.compareProfile);return;}
      const archiveButton=e.target.closest('[data-archive-page]');
      if(archiveButton&&currentView.page==='results'&&!archiveButton.disabled){
        const next=Number(archiveButton.dataset.archivePage);
        const max=Math.max(1,Math.ceil(visible.length/ARCHIVE_PAGE_SIZE));
        if(Number.isInteger(next)&&next>=1&&next<=max){
          archivePage=next;
          renderResults();
          $('#page-results .panel-header')?.scrollIntoView({behavior:'auto',block:'start'});
        }
        return;
      }
      const calendarDay=e.target.closest('[data-calendar-day]');
      if(calendarDay&&currentView.page==='calendar'){updateCalendarFilter('date',calendarDay.dataset.calendarDay);return}
      const calendarNav=e.target.closest('[data-calendar-nav]');
      if(calendarNav&&currentView.page==='calendar'){updateCalendarFilter('month',calendarShiftMonth(calendarBrowse.month,Number(calendarNav.dataset.calendarNav)));return}
      if(e.target.closest('[data-calendar-today]')&&currentView.page==='calendar'){updateCalendarFilter('month',calendarDefaultMonth());return}
      const prRegion=e.target.closest('[data-aot-pr-region]');
      if(prRegion&&currentView.page==='players'){aotPrRegion=prRegion.dataset.aotPrRegion;renderAotPR();return}
      const rankingRegion=e.target.closest('[data-ranking-region]');
      if(rankingRegion&&currentView.page==='players'){updateRankingFilter('region',rankingRegion.dataset.rankingRegion);return}
      if(e.target.closest('[data-ranking-more]')&&currentView.page==='players'){rankingLimit+=30;renderRanking();return}
      if(e.target.closest('[data-registrations-more]')&&currentView.page==='updates'){registrationLimit+=20;renderUpdates();return}
      const styleSeasonButton=e.target.closest('[data-style-season-pick]');
      if(styleSeasonButton&&currentView.page==='profile'){
        e.preventDefault();const season=styleSeasonButton.dataset.styleSeasonPick;
        if(seasonOptions().some(option=>option.id===season)){
          styleState.season=season;renderProfileStyle(currentView.name);
        }
        return;
      }
      if(e.target.closest('[data-style-jump]')&&currentView.page==='profile'){
        e.preventDefault();
        const fold=$('#profile-style-fold');
        if(fold)fold.open=true;
        $('#profile-style')?.scrollIntoView({behavior:'smooth',block:'start'});
        return;
      }
      if(e.target.closest('[data-style-growth-jump]')&&currentView.page==='profile'){e.preventDefault();$('#profile-growth')?.scrollIntoView({behavior:'smooth',block:'start'});return}
      if(e.target.closest('[data-journey-jump]')){e.preventDefault();$('#journey-title')?.focus?.({preventScroll:true});$('#profile-journey')?.scrollIntoView?.({behavior:'instant',block:'start'});return}
      if(currentView.page==='profile'){
        const control=e.target.closest('[data-growth-grouping],[data-growth-mode],[data-growth-metric],[data-growth-point]');
        if(control){
          if(control.hasAttribute('data-growth-grouping')&&['month','season'].includes(control.dataset.growthGrouping)){
            growthState.grouping=control.dataset.growthGrouping;growthState.selectedKey=null;
          }else if(control.hasAttribute('data-growth-mode')&&['cumulative','period'].includes(control.dataset.growthMode)){
            growthState.mode=control.dataset.growthMode;
          }else if(control.hasAttribute('data-growth-metric')&&AsiaGrowth.METRICS.some(x=>x.id===control.dataset.growthMetric)){
            growthState.metric=control.dataset.growthMetric;
          }else if(control.hasAttribute('data-growth-point')){
            growthState.selectedKey=control.dataset.growthPoint;
          }
          renderProfileGrowth(currentView.name);
          return;
        }
      }
      const journeyMode=e.target.closest('[data-journey-mode]');
      if(journeyMode&&currentView.page==='profile'){
        if(['highlights','prize'].includes(journeyMode.dataset.journeyMode)){journeyState.mode=journeyMode.dataset.journeyMode;journeyState.limit=30;renderJourney()}
        return;
      }
      if(e.target.closest('[data-journey-more]')&&currentView.page==='profile'){journeyState.limit+=30;renderJourney();return}
      if(e.target.closest('[data-journey-history]')){e.preventDefault();$('#profile-history-title')?.scrollIntoView?.({behavior:'smooth',block:'start'});return}

      const dateNav=e.target.closest('[data-tournament-date-nav]');
      if(dateNav&&currentView.page==='tournament'){
        if(!dateNav.disabled&&dateNav.dataset.tournamentDateNav)showTournamentDate(dateNav.dataset.tournamentDateNav);
        return;
      }
      const tournamentPhaseButton=e.target.closest('[data-tournament-phase]');
      if(tournamentPhaseButton&&currentView.page==='tournament'){
        const mode=tournamentPhaseButton.dataset.tournamentPhase;
        if(['all','qualifier','final','prize'].includes(mode)){
          tournamentProgressMode=mode;
          renderTournament(currentView.id,currentView.session,currentView.dateFilter);
        }
        return;
      }
      if(e.target.closest('[data-tournament-back]')){tournamentBack();return}
      if(e.target.closest('[data-profile-back]')){profileBack();return}
      const tournament=e.target.closest('[data-open-tournament]');
      const tag=e.target.closest('[data-tournament-tag]');
      const reset=e.target.closest('[data-tournament-reset]');
      if(tournament||tag||reset){
        if(e.ctrlKey||e.metaKey||e.shiftKey||e.altKey||e.button>0)return;e.preventDefault();
        if(tournament){
          const session=tournament.hasAttribute('data-tournament-date')?{
            date:tournament.dataset.tournamentDate,
            region:tournament.dataset.tournamentRegion,
            round:tournament.dataset.tournamentRound,
            kind:tournament.dataset.tournamentKind
          }:null;
          openTournament(tournament.dataset.openTournament,session);
        }
        else if(tag){const [axis,value]=tag.dataset.tournamentTag.split(':');tournamentTagNavigate(axis,value,tag.dataset.tournamentContext)}
        else visitView({page:'tournaments',name:null,id:null,filters:tournamentDefaultFilters()});
        return;
      }
      const profile=e.target.closest('[data-open-profile]');
      if(profile){if(e.ctrlKey||e.metaKey||e.shiftKey||e.altKey||e.button>0)return;e.preventDefault();openProfile(profile.dataset.openProfile);return}
      const nav=e.target.closest('[data-page]');
      if(nav){if(e.ctrlKey||e.metaKey||e.shiftKey||e.altKey||e.button>0)return;e.preventDefault();navigate(nav.dataset.page);return}
      const p=e.target.closest('[data-player]');if(p){selectedPlayer=p.dataset.player;archivePage=1;$('#search-results').value=p.dataset.player;$('#region-filter').value='all';$('#stage-filter').value='all';$('#prize-only').checked=false;navigate('results')}
    });
    // Native iOS select controls reliably send 'change' when the picker is confirmed.
// Listen for both event types so every browser refreshes the sorted archive.
    const refreshArchiveFilters=()=>{archivePage=1;renderResults()};
    ['#region-filter','#stage-filter','#sort-results','#prize-only'].forEach(s=>{
      const control=$(s);
      control.addEventListener('input',refreshArchiveFilters);
      control.addEventListener('change',refreshArchiveFilters);
    });
    $('#search-results').addEventListener('input',()=>{selectedPlayer=null;refreshArchiveFilters()});$('#search-players').addEventListener('input',renderPlayers);$('#player-sort').addEventListener('change',renderPlayers);$('#export-csv').addEventListener('click',()=>download('asia-on-tour-results.csv',csvText(visible),'text/csv;charset=utf-8'));
    document.addEventListener('submit',e=>{
      if(e.target.id!=='compare-add-form')return;
      e.preventDefault();
      addComparisonPlayer($('#compare-player-input')?.value);
    });
    document.addEventListener('input',e=>{if(e.target.id==='tournament-query')updateTournamentFilters('q',e.target.value)});
    document.addEventListener('change',e=>{if(e.target.dataset.styleFilter&&currentView.page==='profile'){const key=e.target.dataset.styleFilter;if(Object.hasOwn(styleState,key)){styleState[key]=e.target.value;renderProfileStyle(currentView.name)}return}
      if(e.target.id==='compare-style-team'&&currentView.page==='compare'){if(AsiaPlayerStyle.TEAMS.includes(e.target.value)){styleCompareTeam=e.target.value;renderComparisonStyle(compareState)}return}
      if(e.target.id==='season-select'){changeSeason(e.target.value);return}if(e.target.id==='tournament-date-filter'&&currentView.page==='tournament'){showTournamentDate(e.target.value);return}
      if(e.target.id==='compare-filter-season'&&currentView.page==='compare'){changeSeason(e.target.value);return}
      if(e.target.dataset.compareFilter&&currentView.page==='compare'){
        const key=e.target.dataset.compareFilter;
        if(['region','mode','series'].includes(key))updateComparison({...compareState,[key]:e.target.value},true);
        return;
      }if(e.target.dataset.calendarFilter&&currentView.page==='calendar'){updateCalendarFilter(e.target.dataset.calendarFilter,e.target.value);return}const rankingKey={'ranking-metric':'metric','ranking-mode':'mode','ranking-series':'series','ranking-final-kind':'finalKind'}[e.target.id];if(rankingKey&&currentView.page==='players'){updateRankingFilter(rankingKey,e.target.value);return}if(e.target.dataset.tournamentFilter)updateTournamentFilters(e.target.dataset.tournamentFilter,e.target.value)});
    selectedSeason=seasonFromUrl();
    refresh();
    initializeRouting();
    window.AOTParticipation?.subscribePR?.(rows=>{
      if(!Array.isArray(rows))return;
      participationPRRows=rows;
      styleRowsCache=null;styleAnalysisCache.clear();
      aotPrReports.clear();
      growthCache.clear();
      renderAotPR();
      if(currentView.page==='profile'&&currentView.name){
        $('#profile-content .aot-pr-profile')?.remove();
        renderProfileAotPR(currentView.name);
        renderProfileGrowth(currentView.name);
        renderProfileStyle(currentView.name);
      }
      if(currentView.page==='compare')renderComparison();
    });
  })().catch(err=>{
  console.error('ASIA ON TOUR could not initialize:',err);
  const notice=document.createElement('div');
  notice.setAttribute('role','alert');
  notice.style.cssText='background:#492129;color:#fff0e6;padding:16px 22px;font:14px sans-serif;position:relative;z-index:9999';
  notice.textContent='サイトデータを読み込めませんでした。GitHub Pagesで全ファイルを同じ場所に配置し、再読み込みしてください。';
  document.body.prepend(notice);
});
