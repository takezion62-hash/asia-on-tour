/* ASIA ON TOUR — read-only data verification engine.
 * Findings are review suggestions, never proof of duplication or a write action.
 */
(function(root,factory){
  'use strict';
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.AotVerification=api;
})(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  const REGIONS=['ME','EU','NAC','NAW','OCE','BR'];
  const text=v=>typeof v==='string'?v.trim():'';
  const members=r=>Array.isArray(r?.players)&&r.players.length?r.players.map(text).filter(Boolean):(text(r?.player)?[text(r.player)]:[]);
  const unique=a=>[...new Set(a)];
  const roundType=r=>{
    const k=text(r?.kind);
    if(k==='予選')return 'qualifier';
    if(k.includes('決勝'))return 'final';
    if(k==='スキン大会'||k==='コスメ大会')return 'skin';
    return 'single';
  };
  const eventKey=r=>text(r?.tournamentId)||text(r?.event).toLocaleLowerCase('ja-JP');
  function windowKey(r){
    const explicit=text(r?.source);
    try{
      const u=new URL(explicit);
      const round=u.searchParams.get('round')||u.searchParams.get('window')||u.searchParams.get('leaderboardEventWindowId');
      if(round)return round.toLowerCase();
    }catch{}
    const found=text(r?.round).match(/(?:event|session|week|day)\s*[-_#]?\s*[0-9]+/ig);
    if(found&&found.length)return found.map(s=>s.replace(/\s+/g,'').toLowerCase()).join('/');
    return '';
  }
  const issue=(category,severity,title,description,records)=>({
    category,severity,title,description,
    ids:unique(records.map(r=>text(r?.id)).filter(Boolean)),
    date:text(records[0]?.date),region:text(records[0]?.region),
    event:text(records[0]?.event),
    players:unique(records.flatMap(members))
  });
  function inspect(records){
    const rows=Array.isArray(records)?records.filter(r=>r&&typeof r==='object'):[];
    const issues=[],ids=new Map(),sameSlot=new Map(),finalGroups=new Map();
    for(const row of rows){
      const id=text(row.id);
      if(id){
        if(!ids.has(id))ids.set(id,[]);
        ids.get(id).push(row);
      }
      const errors=[];
      if(!id)errors.push('戦績IDがない');
      if(!/^\d{4}-\d{2}-\d{2}$/.test(text(row.date)))errors.push('開催日が不正');
      if(!REGIONS.includes(row.region))errors.push('対象地域が不正');
      if(!text(row.event))errors.push('大会名がない');
      if(!members(row).length)errors.push('選手名がない');
      for(const key of ['rank','points','kills','vrs']){
        if(row[key]!=null&&(!Number.isSafeInteger(row[key])||row[key]<(key==='rank'?1:0)))errors.push(key+'の数値が不正');
      }
      if(row.prize!=null&&(!Number.isFinite(row.prize)||row.prize<0))errors.push('賞金額が不正');
      if((row.kind==='スキン大会'||row.kind==='コスメ大会')&&Number(row.prize)>0)errors.push('スキン大会に現金賞金が登録されている');
      if(errors.length)issues.push(issue('format','error','基本データの不整合',errors.join('、'),[row]));
      if(row.verified!==true)continue;
      const key=JSON.stringify([row.date,row.region,eventKey(row),roundType(row),windowKey(row),members(row).slice().sort()]);
      if(!sameSlot.has(key))sameSlot.set(key,[]);
      sameSlot.get(key).push(row);
      if(roundType(row)==='final'){
        const session=windowKey(row);
        // If event/window information is missing, the finding remains a low-confidence suggestion.
        const g=JSON.stringify([row.date,row.region,eventKey(row),session.replace(/(?:round|r)[-_ ]?[12]$/,'')]);
        if(!finalGroups.has(g))finalGroups.set(g,[]);
        finalGroups.get(g).push(row);
      }
    }
    for(const [id,group] of ids){
      if(group.length<2)continue;
      const signatures=unique(group.map(r=>JSON.stringify(r)));
      issues.push(issue('duplicate',signatures.length===1?'warning':'error',
        signatures.length===1?'同一IDの完全重複':'同一IDの内容が衝突',
        '戦績ID '+id+' が '+group.length+' 件あります。元データと出典を照合してください。',group));
    }
    for(const group of sameSlot.values()){
      if(group.length<2||unique(group.map(r=>text(r.id))).length<2)continue;
      // A shared event is not enough to merge: this is only a review hint.
      issues.push(issue('duplicate','warning','同一選手・開催枠の複数レコード',
        '同一大会・地域・日付・段階・選手構成が一致。Event/Sessionや出典を照合し、異なるラウンドを統合しないでください。',group));
    }
    for(const group of finalGroups.values()){
      const kinds=unique(group.map(r=>text(r.kind)));
      if(kinds.includes('決勝')&&kinds.includes('賞金決勝')){
        issues.push(issue('split','warning','決勝と賞金決勝が別枠になっている可能性',
          '同日・同地域・同大会の決勝系レコードに複数区分があります。公式ウィンドウが同じ場合のみ表示枠を統合し、戦績自体は保持してください。',group));
      }
    }
    return issues.sort((a,b)=>(a.severity==='error'?-1:1)-(b.severity==='error'?-1:1)||b.date.localeCompare(a.date));
  }
  function proposals(recent,historic,records){
    const published=new Set((Array.isArray(records)?records:[]).map(r=>text(r?.id)));
    const seen=new Set(),out=[];
    for(const [origin,blob] of [['recent',recent],['history',historic]]){
      for(const row of (Array.isArray(blob?.proposals)?blob.proposals:[])){
        const id=text(row?.id);
        const key=id||JSON.stringify([row?.date,row?.region,row?.event,row?.round,row?.player]);
        if(seen.has(key))continue;
        seen.add(key);
        out.push({...row,origin,alreadyPublished:!!id&&published.has(id)});
      }
    }
    return out.sort((a,b)=>text(b.date).localeCompare(text(a.date))||text(a.player).localeCompare(text(b.player)));
  }
  function coverage(records,queue){
    const grouped=new Map();
    const ensure=(month,region)=>{
      const key=month+'|'+region;
      if(!grouped.has(key))grouped.set(key,{month,region,published:0,pending:0});
      return grouped.get(key);
    };
    for(const r of (Array.isArray(records)?records:[])){
      const date=text(r?.date),region=text(r?.region);
      if(/^\d{4}-\d{2}-\d{2}$/.test(date)&&REGIONS.includes(region))ensure(date.slice(0,7),region).published++;
    }
    for(const r of (Array.isArray(queue)?queue:[])){
      if(r.alreadyPublished)continue;
      const date=text(r?.date),region=text(r?.region);
      if(/^\d{4}-\d{2}-\d{2}$/.test(date)&&REGIONS.includes(region))ensure(date.slice(0,7),region).pending++;
    }
    return [...grouped.values()].sort((a,b)=>b.month.localeCompare(a.month)||REGIONS.indexOf(a.region)-REGIONS.indexOf(b.region));
  }
  function unregistered(statuses){
    const all=[];
    for(const status of statuses){
      if(Array.isArray(status?.unmappedEventIds))all.push(...status.unmappedEventIds.filter(x=>typeof x==='string'));
    }
    return unique(all).sort();
  }
  return Object.freeze({REGIONS,roundType,windowKey,inspect,proposals,coverage,unregistered});
});
