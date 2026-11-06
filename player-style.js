/* ASIA ON TOUR — evidence-limited overseas playstyle analytics, v1.
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
  const FILTER_DEFAULTS=Object.freeze({season:'all',team:'solo',mode:'all',series:'all',region:'all'});
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
    return {level:slotCount>=5&&num>=30?'qualified':slotCount>=3&&num>=15?'provisional':'insufficient',
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
  function scoreRegional(a,maxKill,maxVr){
    if(a.kpm===null||a.vrRate===null)return null;
    const kill=maxKill>0?a.kpm/maxKill:1;
    const vr=maxVr>0?a.vrRate/maxVr:1;
    return Math.max(0,Math.min(100,100*(maxVr>0?(.70*kill+.30*vr):kill)));
  }
  function regionAffinity(regions,filters={}){
    // Never compare different official series or modes through unweighted raw scores:
    // when "all" is requested the UI must say only descriptive stats are available.
    if(filters.series==='all'||filters.mode==='all'||filters.team==='all')
      return {region:null,reason:'大会シリーズ・形式・チーム人数を揃えると判定できます',adaptation:null,qualified:0};
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
    if(filters.mode==='all'||filters.series==='all'||filters.team==='all')
      return {key:'unrated',label:STYLES.unrated,reason:'ゲーム形式・大会シリーズ・チーム人数を指定してください',confidence:'incomparable'};
    const peers=cohort(allRows,filters,helpers);
    if(peers.length<20)return {key:'unrated',label:STYLES.unrated,reason:'同条件で分析可能な比較対象が20名以上必要',confidence:'low',peers:peers.length};
    const attack=percentile(summary.kpm,peers.map(r=>r.kpm));
    const victory=percentile(summary.vrRate,peers.map(r=>r.vrRate));
    let key='balanced';
    if(attack-victory>=15&&attack>=60)key='attack';
    if(victory-attack>=15&&victory>=60)key='victory';
    const breadth=filters.region==='all'?percentile(summary.regionCount,peers.map(r=>r.regionCount)):null;
    return {key,label:STYLES[key],attack,victory,breadth,peers:peers.length,
      reason:'同じシーズン・地域・チーム・ゲーム形式・大会シリーズの実測効率の相対位置'};
  }
  function analyze(records,name,filters={},helpers={}){
    const f={...FILTER_DEFAULTS,...filters};
    const selection=select(records,{...f,region:'all'},helpers);
    const ownAll=forPlayer(selection.rows,name);
    const allRegionMetrics=regionStats(selection.rows,name);
    const chosen=forPlayer(select(records,f,helpers).rows,name);
    const stats=summarize(chosen.rows);
    const affinity=regionAffinity(allRegionMetrics,f);
    const style=classifyStyle(stats,chosen.rows,records,f,helpers);
    const monthly=new Map();
    for(const r of chosen.rows){
      const month=String(r.date||'').slice(0,7);
      if(!/^\d{4}-\d{2}$/.test(month))continue;
      if(!monthly.has(month))monthly.set(month,[]);
      monthly.get(month).push(r);
    }
    const trend=[...monthly].sort(([a],[b])=>a.localeCompare(b)).map(([month,rows])=>({month,...summarize(rows)}));
    return {player:name,filters:f,stats,style,regions:allRegionMetrics,affinity,trend,
      available:ownAll.rows.length,overlapping:[...new Set([...ownAll.overlapping,...chosen.overlapping])],
      conflicts:selection.conflicts,quality:adequacy(chosen.rows)};
  }
  return Object.freeze({VERSION:1,REGIONS,TEAMS,FILTER_DEFAULTS,STYLES,dedupe,windowKey,select,forPlayer,
    summarize,slotsCount,adequacy,regionAffinity,percentile,cohort,analyze});
});
