/* ASIA ON TOUR — progressive evidence-based overseas playstyle analytics, v2.
 * Performance statistics, not inferred tactical roles or player skill rankings.
 * All calculations are read-only and ignore unpublished suggestions.
 */
(function(root,factory){
  'use strict';
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.AsiaPlayerStyle=api;
})(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  const REGIONS=Object.freeze(['ME','EU','NAC','NAW','OCE','BR']);
  const TEAMS=Object.freeze(['solo','duo','trio','squad']);
  const STYLES=Object.freeze({attack:'高火力型',victory:'勝ち切り型',balanced:'バランス型',unrated:'分析データ不足'});
  const FILTER_DEFAULTS=Object.freeze({season:'all',team:'all',mode:'all',series:'all',region:'all'});
  const good=n=>Number.isSafeInteger(n)&&n>=0;
  const roster=row=>Array.isArray(row?.players)&&row.players.length?row.players:[row?.player];
  const stable=row=>JSON.stringify(Object.keys(row||{}).sort().map(k=>[k,row[k]]));
  function dedupe(records){
    const ids=new Map(),out=[],conflicts=[];
    for(const row of Array.isArray(records)?records:[]){
      if(!row||typeof row.id!=='string'||!row.id||row.verified!==true||row.reported||row.partial||row.reviewOnly===true)continue;
      if(!ids.has(row.id))ids.set(row.id,[]);
      ids.get(row.id).push(row);
    }
    for(const [id,rows] of ids){
      if(rows.every(row=>stable(row)===stable(rows[0])))out.push(rows[0]);
      else conflicts.push(id);
    }
    return {rows:out,conflicts};
  }
  function windowKey(row){
    try{
      const url=new URL(row.source);
      const source=url.searchParams.get('round')||url.searchParams.get('window');
      if(source)return source;
    }catch{}
    const round=String(row.round||'');
    const stage=round.match(/(?:Event|Day|Week|Session)\s*\d+/i);
    const roundNo=round.match(/Round\s*[12]/i);
    return [stage?.[0]||'',roundNo?.[0]||'',round.split('/').at(-1)?.trim()||''].join(':');
  }
  function select(records,filters={},helpers={}){
    const opts={...FILTER_DEFAULTS,...filters};
    const unique=dedupe(records);
    const selected=[];
    for(const row of unique.rows){
      if(!REGIONS.includes(row.region))continue;
      const category=typeof helpers.classify==='function'?helpers.classify(row):null;
      if(!category||!TEAMS.includes(category.team)||!category.mode||category.mode==='unknown'||category.series==='unknown')continue;
      if(opts.team!=='all'&&category.team!==opts.team)continue;
      if(opts.mode!=='all'&&category.mode!==opts.mode)continue;
      if(opts.series!=='all'&&category.series!==opts.series)continue;
      const season=typeof helpers.seasonOf==='function'?helpers.seasonOf(row):row.seasonId;
      if(opts.season!=='all'&&season!==opts.season)continue;
      if(opts.region!=='all'&&row.region!==opts.region)continue;
      selected.push({...row,_aotStyleCategory:category});
    }
    return {rows:selected,conflicts:unique.conflicts};
  }
  // Same player's one tournament/date/region/stage must not be credited twice
  // when an extra participation record or repeated API candidate overlaps.
  // Ambiguous duplicate sessions are excluded completely, never averaged.
  function forPlayer(selected,name){
    const own=selected.filter(row=>roster(row).includes(name)&&
      (!row.prEligiblePlayers||row.prEligiblePlayers.includes(name)));
    const slots=new Map();
    for(const r of own){
      const slot=JSON.stringify([r.date,r.region,r._aotStyleCategory.id||r.tournamentId,
        windowKey(r),name]);
      if(!slots.has(slot))slots.set(slot,[]);
      slots.get(slot).push(r);
    }
    const rows=[],overlapping=[];
    for(const pair of slots.values()){
      if(pair.length===1)rows.push(pair[0]);
      else overlapping.push(...pair.map(x=>x.id));
    }
    return {rows,overlapping};
  }
  function summarize(rows){
    const all=Array.isArray(rows)?rows:[];
    const validMatches=all.filter(r=>good(r.matches)&&r.matches>0);
    const kills=validMatches.filter(r=>good(r.kills));
    const wins=validMatches.filter(r=>good(r.vrs)&&r.vrs<=r.matches);
    const killMatches=kills.reduce((a,r)=>a+r.matches,0);
    const vrMatches=wins.reduce((a,r)=>a+r.matches,0);
    const finalRows=all.filter(r=>['賞金決勝','決勝','Practice決勝','Performance決勝'].includes(r.kind)&&good(r.rank)&&r.rank>0);
    const podiumRows=finalRows.filter(r=>r.kind==='賞金決勝'&&r.rank<=3);
    const bySeries=new Set(all.map(r=>r._aotStyleCategory?.series).filter(Boolean));
    return {
      records:all.length,knownMatchRecords:validMatches.length,
      unknownMatchRecords:all.length-validMatches.length,
      matchTotal:validMatches.reduce((a,r)=>a+r.matches,0),
      kills: kills.reduce((a,r)=>a+r.kills,0),
      killMatches,killRecords:kills.length,kpm:killMatches?kills.reduce((a,r)=>a+r.kills,0)/killMatches:null,
      vrs:wins.reduce((a,r)=>a+r.vrs,0),
      vrMatches,vrRecords:wins.length,vrRate:vrMatches?wins.reduce((a,r)=>a+r.vrs,0)/vrMatches:null,
      finalRecords:finalRows.length,prizeFinalTop3:podiumRows.length,
      regionCount:new Set(all.map(r=>r.region)).size,
      series:[...bySeries].sort(),
      ids:all.map(r=>r.id)
    };
  }
  function slotsCount(rows){
    return new Set(rows.map(r=>JSON.stringify([
      r.date,r.region,r._aotStyleCategory?.id||r.tournamentId,windowKey(r)
    ]))).size;
  }
  function adequacy(rows,metric='both'){
    const a=summarize(rows),slotCount=slotsCount(rows);
    const num=metric==='kills'?a.killMatches:metric==='vrs'?a.vrMatches:Math.min(a.killMatches,a.vrMatches);
    return {level:slotCount>=5&&num>=30?'qualified':slotCount>=3&&num>=10?'provisional':'insufficient',
      windows:slotCount,matches:num};
  }
  function regionStats(selected,name){
    const own=forPlayer(selected,name);
    return REGIONS.map(region=>{
      const rows=own.rows.filter(r=>r.region===region),metrics=summarize(rows);
      return {region,...metrics,windows:slotsCount(rows),
        level:adequacy(rows).level,rows};
    });
  }
  // Regional sub-specialties are descriptive efficiency comparisons, not skill
  // or tactical-role claims. Require separate observed denominators and 2 peers.
  // One recorded VR is not a guarantee that the region is objectively easier.
  function regionalLeaders(regions,filters={}){
    const comparable=filters.team!=='all'&&filters.mode!=='all'&&filters.series!=='all'&&
      filters.season!=='all';
    if(!comparable)return {
      attack:null,victory:null,attackReason:'シーズン・人数・形式・大会シリーズを統一してね',
      victoryReason:'シーズン・人数・形式・大会シリーズを統一してね',attackCandidates:0,victoryCandidates:0
    };
    function decide(metric,denominator){
      const candidates=regions.filter(r=>r.windows>=3&&r[denominator]>=15&&Number.isFinite(r[metric]));
      const name=metric==='kpm'?'キル効率':'VR率';
      if(candidates.length<2)return {region:null,reason:name+'の比較対象は2地域以上・各3枠15試合以上が必要',candidates:candidates.length};
      const ranked=candidates.slice().sort((a,b)=>b[metric]-a[metric]||REGIONS.indexOf(a.region)-REGIONS.indexOf(b.region));
      const top=ranked[0][metric],runner=ranked[1][metric];
      if(top<=0)return {region:null,reason:name+'が全候補地域で0のため優位は未判定',candidates:candidates.length};
      if((top-runner)/top<.10)return {region:null,reason:name+'の上位2地域の差が10%未満',candidates:candidates.length};
      return {region:ranked[0].region,reason:'掲載済みの実測'+name+'で差が10%以上',candidates:candidates.length,
        value:top,runnerUp:ranked[1].region};
    }
    const attack=decide('kpm','killMatches'),victory=decide('vrRate','vrMatches');
    return {attack:attack.region,victory:victory.region,
      attackReason:attack.reason,victoryReason:victory.reason,
      attackCandidates:attack.candidates,victoryCandidates:victory.candidates};
  }

  // Stage 1 starts from a single verified competition record. Stages 2/3
  // only describe stronger evidence; they never turn team K/VR into individual
  // kill or win contributions, and never guess a tactical IGL/fragging role.
  function progressiveInsights(rows,stats,adequate){
    const total=stats?.records||0,windows=adequate?.windows||0;
    const stage=!total?'none':adequate.level==='qualified'?'detailed':
      adequate.level==='provisional'?'provisional':'basic';
    const meta={
      none:{label:'対象データなし',detail:'現在の絞り込みに該当する確認済み戦績がありません'},
      basic:{label:'基本分析',detail:'確認できた大会記録の事実のみを表示。比較による強弱は未判定'},
      provisional:{label:'暫定分析',detail:'3開催枠・10試合以上の実測。効率値は参考として表示'},
      detailed:{label:'詳細分析',detail:'5開催枠・30試合以上の実測。比較評価は別途同条件の対象選手が必要'}
    }[stage];
    const tags=[];
    const add=(key,label,detail)=>tags.push({key,label,detail});
    const regions=REGIONS.filter(x=>rows.some(r=>r.region===x));
    const awards=rows.filter(r=>Number.isFinite(r.prize)&&r.prize>0);
    const skin=rows.filter(r=>r.kind==='スキン大会');
    if(regions.length>1)add('multi-region','複数地域に参戦',regions.join(' / ')+'に掲載記録あり');
    if(stats.finalRecords>0)add('final','決勝経験あり','確認できた決勝 '+stats.finalRecords+'件');
    if(stats.vrs>0)add('victory','VR実績あり',stats.vrs+'VRを記録（チーム戦はチーム合計）');
    if(awards.length>0)add('cash','賞金獲得記録あり','賞金付き記録 '+awards.length+'件（チーム賞金と個人額は区別）');
    if(skin.length>0)add('cosmetic','スキン大会で実績あり','対象の掲載記録 '+skin.length+'件');
    if(windows>=5)add('experience','遠征大会への継続参加',windows+'開催枠の出場記録を確認');
    if(stats.kpm!=null&&adequate.level!=='insufficient'){
      add('kill-rate','K/試合 '+stats.kpm.toFixed(2),
        '出典から確認できた'+stats.killMatches+'試合の効率（個人/チームは選択条件による）');
    }
    if(!tags.length&&total)add('attendance','大会参加記録あり',windows+'開催枠、'+total+'戦績を確認');
    const progress=stage==='none'?0:stage==='basic'?1:stage==='provisional'?2:3;
    return {stage,label:meta.label,detail:meta.detail,tags,windows,records:total,
      matches:adequate.matches,progress,maxProgress:3};
  }
  // Descriptive geography does not need a same-season peer cohort; a single
  // documented appearance can establish where a player appeared. Ties in cash
  // or VR counts are left undecided, not used to declare a "best region".
  function regionHighlights(regions){
    const records=regions.filter(r=>r.records>0);
    const active=records.slice().sort((a,b)=>b.windows-a.windows||b.records-a.records||
      REGIONS.indexOf(a.region)-REGIONS.indexOf(b.region))[0];
    const awardCounts=records.map(r=>({
      region:r.region,count:r.rows.filter(x=>Number.isFinite(x.prize)&&x.prize>0).length
    }));
    const winCounts=records.map(r=>({region:r.region,count:r.vrs||0}));
    const uniqueMax=list=>{
      const max=Math.max(0,...list.map(x=>x.count));
      const tied=list.filter(x=>x.count===max);
      return max>0&&tied.length===1?tied[0]:null;
    };
    const cash=uniqueMax(awardCounts),vr=uniqueMax(winCounts);
    return {
      active:active?{region:active.region,windows:active.windows,records:active.records}:null,
      cash:cash?{region:cash.region,records:cash.count}:null,
      victory:vr?{region:vr.region,vrs:vr.count}:null,
      // Do not expose total prize dollars as personal winnings for duo/trio.
      awardsByRegion:awardCounts,vrByRegion:winCounts
    };
  }
  function recommendedScope(rows,helpers){
    const groups=new Map();
    for(const row of rows){
      const c=row._aotStyleCategory,season=typeof helpers.seasonOf==='function'?
        helpers.seasonOf(row):row.seasonId;
      if(!c||!/^S\d+$/.test(String(season||''))||!TEAMS.includes(c.team)||
        !c.mode||c.mode==='unknown'||!c.series||c.series==='unknown')continue;
      const scope={season,team:c.team,mode:c.mode,series:c.series};
      const key=JSON.stringify(scope),prev=groups.get(key)||{scope,records:0,windows:new Set(),
        matches:0,latest:''};
      prev.records++;
      prev.windows.add(JSON.stringify([row.date,row.region,c.id||row.tournamentId,windowKey(row)]));
      prev.matches+=good(row.matches)?row.matches:0;
      if(String(row.date||'')>prev.latest)prev.latest=String(row.date);
      groups.set(key,prev);
    }
    const top=[...groups.values()].sort((a,b)=>b.windows.size-a.windows.size||
      b.matches-a.matches||b.records-a.records||b.latest.localeCompare(a.latest))[0];
    return top?{...top.scope,windows:top.windows.size,records:top.records,matches:top.matches}:null;
  }

  function quality(stats,overlapping=[],conflicts=[]){
    const total=stats.records;
    return {recordCount:total,killCoverage:total?stats.killRecords/total:null,
      vrCoverage:total?stats.vrRecords/total:null,
      missingMatches:stats.unknownMatchRecords,
      missingKillRecords:Math.max(0,total-stats.killRecords),
      missingVrRecords:Math.max(0,total-stats.vrRecords),
      overlappingIds:[...new Set(overlapping)],conflictingIds:[...new Set(conflicts)]};
  }
  function momentum(rows){
    const ordered=(Array.isArray(rows)?rows:[]).slice()
      .sort((a,b)=>String(b.date).localeCompare(String(a.date))||String(b.id).localeCompare(String(a.id)));
    if(ordered.length<10)return {ready:false,reason:'同条件の10開催枠以上の実測が必要',recent:[],previous:[]};
    const recent=ordered.slice(0,5),previous=ordered.slice(5,10);
    const now=summarize(recent),was=summarize(previous);
    if(now.killMatches<15||now.vrMatches<15||was.killMatches<15||was.vrMatches<15)
      return {ready:false,reason:'直近5枠と前5枠それぞれに実測15試合以上が必要',recent:recent.map(x=>x.id),previous:previous.map(x=>x.id)};
    return {ready:true,reason:'直近5開催枠と、その前の5開催枠の実測値の差',
      recent:recent.map(x=>x.id),previous:previous.map(x=>x.id),
      current:now,prior:was,
      deltaKpm:now.kpm-was.kpm,deltaVrRate:now.vrRate-was.vrRate};
  }
  function evidence(rows,max=15){
    return (Array.isArray(rows)?rows:[]).slice().sort((a,b)=>String(b.date).localeCompare(String(a.date))||
      String(b.id).localeCompare(String(a.id))).slice(0,max).map(r=>({
        id:r.id,date:r.date,region:r.region,event:r.event,round:r.round,
        matches:good(r.matches)&&r.matches>0?r.matches:null,
        kills:good(r.kills)?r.kills:null,
        vrs:good(r.vrs)?r.vrs:null,
        rank:good(r.rank)?r.rank:null,
        source:typeof r.source==='string'?r.source:''
    }));
  }
  function scoreRegional(a,maxKill,maxVr){
    if(a.kpm===null||a.vrRate===null)return null;
    const kill=maxKill>0?a.kpm/maxKill:1;
    const vr=maxVr>0?a.vrRate/maxVr:1;
    return Math.max(0,Math.min(100,100*(maxVr>0?(.70*kill+.30*vr):kill)));
  }
  function regionAffinity(regions,filters={}){
    // Never compare different official series or modes through unweighted raw scores:
    // when "all" is requested the UI must say only descriptive stats are available.
    if(filters.series==='all'||filters.mode==='all'||filters.team==='all'||filters.season==='all')
      return {region:null,reason:'シーズン・大会シリーズ・形式・チーム人数を揃えると判定できます',adaptation:null,qualified:0};
    const eligible=regions.filter(r=>r.level!=='insufficient'&&r.kpm!=null&&r.vrRate!=null);
    if(eligible.length<2)return {region:null,reason:'比較可能な地域が2つ以上必要（各3開催枠・15試合以上）',adaptation:null,qualified:eligible.length};
    const maxKill=Math.max(...eligible.map(r=>r.kpm)),maxVr=Math.max(...eligible.map(r=>r.vrRate));
    const ranked=eligible.map(r=>({region:r.region,score:scoreRegional(r,maxKill,maxVr),level:r.level}))
      .sort((a,b)=>b.score-a.score||REGIONS.indexOf(a.region)-REGIONS.indexOf(b.region));
    const close=ranked.length>1&&ranked[0].score-ranked[1].score<10;
    const consistent=ranked.filter(r=>r.score>=.75*ranked[0].score);
    return {region:close?null:ranked[0].region,
      reason:close?'上位地域の差が10点未満のため判定保留':'同条件の掲載戦績における暫定的な優勢地域',
      ranked,adaptation:{qualifiedRegions:eligible.length,consistentRegions:consistent.length,
        label:consistent.length>=2?'複数地域で比較的安定':'地域差が見られる'},
      qualified:eligible.length};
  }
  function percentile(value,others){
    if(value==null||!Number.isFinite(value)||!others.length)return null;
    const less=others.filter(x=>x<value).length,equal=others.filter(x=>x===value).length;
    return Math.round(100*(less+equal/2)/others.length);
  }
  function cohort(players,opts,helpers){
    const selected=select(players,opts,helpers).rows;
    const allNames=new Set(selected.flatMap(roster));
    const summaries=[];
    for(const name of allNames){
      const own=forPlayer(selected,name).rows,quality=adequacy(own);
      if(quality.level!=='qualified')continue;
      const summary=summarize(own);
      if(summary.kpm!=null&&summary.vrRate!=null)summaries.push({name,...summary});
    }
    return summaries;
  }
  function classifyStyle(summary,rows,allRows,filters,helpers){
    const adequate=adequacy(rows);
    if(adequate.level!=='qualified')return {key:'unrated',label:STYLES.unrated,reason:'5開催枠・30試合以上の実測データが必要',confidence:adequate.level};
    if(filters.season==='all')return {key:'unrated',label:STYLES.unrated,reason:'相対比較では同じシーズンを指定してね',confidence:'incomparable'};
    if(filters.mode==='all'||filters.series==='all'||filters.team==='all')
      return {key:'unrated',label:STYLES.unrated,reason:'ゲーム形式・大会シリーズ・チーム人数を指定してください',confidence:'incomparable'};
    const peers=cohort(allRows,filters,helpers);
    if(peers.length<20)return {key:'unrated',label:STYLES.unrated,reason:'同条件で分析可能な比較対象が20名以上必要',confidence:'low',peers:peers.length};
    const attack=percentile(summary.kpm,peers.map(r=>r.kpm));
    const victory=percentile(summary.vrRate,peers.map(r=>r.vrRate));
    let key='balanced';
    if(attack-victory>=15&&attack>=60)key='attack';
    else if(victory-attack>=15&&victory>=60)key='victory';
    else if(attack<50||victory<50)return {key:'unrated',label:STYLES.unrated,reason:'比較対象内で攻撃・勝利の両面が高いとは言えず、タイプを保留',confidence:'incomparable',attack,victory,peers:peers.length};
    const breadth=filters.region==='all'?percentile(summary.regionCount,peers.map(r=>r.regionCount)):null;
    return {key,label:STYLES[key],attack,victory,breadth,peers:peers.length,
      reason:'同じシーズン・地域・チーム・ゲーム形式・大会シリーズの実測効率の相対位置'};
  }

  // Scouting v1: descriptive evidence only, never an inferred IGL/fragging role
  // or a subjective power rating. Unknown values stay unknown.
  function scouting(rows,stats,recent,filters,style){
    const windows=slotsCount(rows),sample=(matches,records)=>records>=5&&matches>=30?'評価可能':records>=3&&matches>=15?'暫定':'データ不足';
    const killRows=rows.filter(r=>good(r.matches)&&r.matches>0&&good(r.kills));
    const validMatches=killRows.reduce((sum,r)=>sum+r.matches,0);
    let killSpread=null;
    // Weighted standard deviation across *recorded event windows*, not individual match K/D.
    if(windows>=5&&killRows.length>=5&&validMatches>=30){
      const mean=killRows.reduce((sum,r)=>sum+r.kills,0)/validMatches;
      const variance=killRows.reduce((sum,r)=>sum+r.matches*Math.pow(r.kills/r.matches-mean,2),0)/validMatches;
      killSpread=Math.sqrt(Math.max(0,variance));
    }
    return {
      scope:'掲載済み・本人確認済み戦績に限る',
      team:filters.team,windows,regions:stats.regionCount,
      documentedFinals:stats.finalRecords,documentedPodiums:stats.prizeFinalTop3,
      attack:{value:stats.kpm,matches:stats.killMatches,records:stats.killRecords,level:sample(stats.killMatches,stats.killRecords)},
      victory:{value:stats.vrRate,matches:stats.vrMatches,records:stats.vrRecords,level:sample(stats.vrMatches,stats.vrRecords)},
      stability:{spread:killSpread,matches:validMatches,records:killRows.length,
        level:killSpread===null?'データ不足':'実測値'},
      momentum:{ready:recent.ready,reason:recent.reason,deltaKpm:recent.ready?recent.deltaKpm:null,
        deltaVrRate:recent.ready?recent.deltaVrRate:null},
      relative:style.key==='unrated'?null:{label:style.label,peers:style.peers},
      comparable:filters.season!=='all'&&filters.team!=='all'&&filters.mode!=='all'&&filters.series!=='all',
      limitations:'大会難易度・Ping・対面勝率・戦術ロールは未測定。キルとVRはチーム戦ではチーム合計。'
    };
  }
  function analyze(records,name,filters={},helpers={}){
    const f={...FILTER_DEFAULTS,...filters};
    const selection=select(records,{...f,region:'all'},helpers);
    const ownAll=forPlayer(selection.rows,name);
    const allRegionMetrics=regionStats(selection.rows,name);
    const chosen=forPlayer(f.region==='all'?selection.rows:selection.rows.filter(r=>r.region===f.region),name);
    const stats=summarize(chosen.rows);
    const affinity=regionAffinity(allRegionMetrics,f);
    const style=classifyStyle(stats,chosen.rows,records,f,helpers);
    const regionalSpecialties=regionalLeaders(allRegionMetrics,f);
    const monthly=new Map();
    for(const r of chosen.rows){
      const month=String(r.date||'').slice(0,7);
      if(!/^\d{4}-\d{2}$/.test(month))continue;
      if(!monthly.has(month))monthly.set(month,[]);
      monthly.get(month).push(r);
    }
    const trend=[...monthly].sort(([a],[b])=>a.localeCompare(b)).map(([month,rows])=>({month,...summarize(rows)}));
    const seasonCounts=new Map();
    for(const r of ownAll.rows){
      const season=typeof helpers.seasonOf==='function'?helpers.seasonOf(r):r.seasonId;
      if(!/^S\d+$/.test(String(season||'')))continue;
      const current=seasonCounts.get(season)||{season,matches:0,records:0};
      current.records++;
      if(good(r.matches)&&r.matches>0)current.matches+=r.matches;
      seasonCounts.set(season,current);
    }
    const recommendedSeason=[...seasonCounts.values()]
      .sort((a,b)=>b.matches-a.matches||Number(b.season.slice(1))-Number(a.season.slice(1)))[0]?.season||null;
    const overlapping=[...new Set([...ownAll.overlapping,...chosen.overlapping])];
    const recent=momentum(chosen.rows);
    return {player:name,filters:f,stats,style,regions:allRegionMetrics,affinity,trend,
      insights:progressiveInsights(chosen.rows,stats,adequacy(chosen.rows)),
      regionHighlights:regionHighlights(allRegionMetrics),
      recommendedScope:recommendedScope(ownAll.rows,helpers),
      specialties:regionalSpecialties,momentum:recent,scouting:scouting(chosen.rows,stats,recent,f,style),
      evidence:evidence(chosen.rows),recommendedSeason,
      available:ownAll.rows.length,overlapping,conflicts:selection.conflicts,
      quality:adequacy(chosen.rows),coverage:quality(stats,overlapping,selection.conflicts)};
  }
  return Object.freeze({VERSION:2,REGIONS,TEAMS,FILTER_DEFAULTS,STYLES,dedupe,windowKey,select,forPlayer,
    summarize,slotsCount,adequacy,progressiveInsights,regionHighlights,recommendedScope,regionAffinity,regionalLeaders,quality,momentum,evidence,percentile,cohort,scouting,analyze});
});
