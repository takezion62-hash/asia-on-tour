(() => {
  'use strict';
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
  const fmt=v=>Number.isSafeInteger(v)?v.toLocaleString('ja-JP'):'—';
  const root=new URL('.',document.currentScript?.src||document.baseURI);
  const load=async file=>{
    const response=await fetch(new URL(file,root),{cache:'no-store'});
    if(!response.ok)throw Error('記録を取得できません ('+response.status+')');
    return response.json();
  };
  let indexPromise=null,profileSequence=0,currentPage=1;
  const months=new Map();
  const getIndex=()=>indexPromise||(indexPromise=load('participation-index.json').then(data=>{
    if(data.version!==1||!Array.isArray(data.months)||!Array.isArray(data.players))throw Error('出場記録の形式が不正です');
    return data;
  }).catch(error=>{indexPromise=null;throw error}));
  const getMonth=month=>{
    if(!/^\d{4}-\d{2}$/.test(month))return Promise.reject(Error('月の指定が不正です'));
    if(!months.has(month))months.set(month,load('participation/'+month+'.json').then(data=>{
      if(data.version!==1||data.month!==month||!Array.isArray(data.entries))throw Error('月別データの形式が不正です');
      return data.entries;
    }).catch(error=>{months.delete(month);throw error}));
    return months.get(month);
  };
  const members=r=>Array.isArray(r.players)&&r.players.length?r.players:[r.player];
  const heading=r=>r.qualification==='outside-cutoff'?'通過圏外':'出場確認';
  const rowHtml=r=>'<tr><td>'+esc(r.date)+'</td><td>'+esc(r.region)+'</td><td>#'+fmt(r.rank)+'</td>'
    +'<td>'+esc(members(r).join(' / '))+'</td><td><strong>'+esc(r.event)+'</strong><small>'+esc(r.round)+'</small>'
    +(typeof AotTrackerSummary!=='undefined'?'<details class="participation-tracker-details"><summary>基本スタッツ</summary>'+AotTrackerSummary.render(r)+'</details>':'')+'</td>'
    +'<td>'+fmt(r.points)+'</td><td>'+fmt(r.kills)+'</td><td>'+fmt(r.vrs)+'</td><td>'+fmt(r.matches)+'</td>'
    +'<td><span class="participation-tag">'+esc(heading(r))+'</span></td>'
    +'<td><a target="_blank" rel="noopener noreferrer" href="'+esc(r.source)+'">出典 ↗</a></td></tr>';
  const buildTable=rows=>{
    if(!rows.length)return '<p class="participation-empty">この条件の出場戦績はまだありません</p>';
    return '<div class="participation-scroll"><table class="participation-table"><thead><tr><th>日付</th><th>地域</th><th>順位</th><th>選手</th><th>大会 / ラウンド</th><th>Pt</th><th>キル</th><th>VR</th><th>試合</th><th>区分</th><th>出典</th></tr></thead><tbody>'+rows.map(rowHtml).join('')+'</tbody></table></div>';
  };
  const sortRows=rows=>rows.slice().sort((a,b)=>b.date.localeCompare(a.date)||a.rank-b.rank||a.event.localeCompare(b.event));

  // Search verified participation alongside the main "遠征結果" search without
  // adding below-cutoff contestants to results.json, awards or achievements.
  let mainSearchSequence=0,mainArchiveRows=null;
  async function searchFromMainResults(){
    const host=document.getElementById('participation-main-search');
    const search=document.getElementById('search-results');
    if(!host||!search)return;
    const sequence=++mainSearchSequence;
    const q=search.value.trim().toLocaleLowerCase();
    const region=document.getElementById('region-filter')?.value||'all';
    const stage=document.getElementById('stage-filter')?.value||'all';
    const prizeOnly=document.getElementById('prize-only')?.checked;
    if(q.length<2||prizeOnly||(stage!=='all'&&stage!=='予選')){
      host.hidden=true;host.replaceChildren();return;
    }
    host.hidden=false;host.textContent='出場確認アーカイブも検索中…';
    try{
      if(!mainArchiveRows){
        const index=await getIndex();
        const entries=await Promise.all(index.months.filter(m=>m.count>0).map(m=>getMonth(m.month)));
        mainArchiveRows=entries.flat();
      }
      if(sequence!==mainSearchSequence)return;
      const found=sortRows(mainArchiveRows.filter(r=>(region==='all'||region===r.region)&&
        [r.player,...members(r),r.event,r.round,String(r.rank),r.date].some(value=>
         String(value||'').toLocaleLowerCase().includes(q))));
      const visible=found.slice(0,30);
      if(!found.length){host.hidden=true;host.replaceChildren();return}
      const month=visible[0].date.slice(0,7);
      host.innerHTML='<div class="participation-heading"><div><p class="participation-kicker">OTHER VERIFIED RESULTS</p>'
        +'<h2>出場アーカイブにも '+fmt(found.length)+'件の一致</h2></div></div>'
        +'<p class="participation-note">以下は予選敗退・通過未確認を含む別枠の出場記録です。通常の賞金・称号・正式戦績には加算しません。シーズン選択に関係なく全期間を検索しています。</p>'
        +buildTable(visible)
        +(found.length>visible.length?'<p class="participation-note">先頭30件を表示。詳しくは下の月別出場アーカイブを確認してください。</p>':'')
        +'<p class="participation-note"><a href="#results" data-participation-month-open="'+esc(month)+'">月別の出場記録へ移動 ↗</a></p>';
    }catch(error){
      if(sequence===mainSearchSequence){
        host.hidden=false;host.textContent='出場アーカイブの検索に失敗しました。下の出場記録欄から再確認してください。';
      }
    }
  }
  function connectMainResultsSearch(){
    const search=document.getElementById('search-results');
    const filter=document.querySelector('#page-results .prize-row-note');
    if(!search||!filter)return;
    const host=document.createElement('section');
    host.id='participation-main-search';
    host.className='participation-panel participation-search-results';
    host.setAttribute('aria-live','polite');
    host.hidden=true;
    filter.after(host);
    search.addEventListener('input',searchFromMainResults);
    for(const id of ['region-filter','stage-filter','prize-only'])
      document.getElementById(id)?.addEventListener('change',searchFromMainResults);
    searchFromMainResults();
  }

  // Make newly added archived participation discoverable from the main results
  // page and update history without mixing it into cash/prize statistics.
  async function revealLatestPublished(index,picker){
    try{
      const log=await load('updates.json');
      const entry=(log.entries||[]).find(e=>e.type==='participation'&&Array.isArray(e.participationIds)&&e.participationIds.length);
      if(!entry||!/^[0-9]{4}-[0-9]{2}$/.test(entry.participationMonth||'')||
          !index.months.some(m=>m.month===entry.participationMonth))return;
      const candidates=await getMonth(entry.participationMonth);
      const ids=new Set(entry.participationIds);
      const rows=candidates.filter(row=>ids.has(row.id));
      if(!rows.length)return;
      const summary=document.getElementById('participation-summary');
      const recent=document.createElement('div');
      recent.className='participation-recent';
      const sameDate=rows.every(r=>r.date===rows[0].date);
      const sameEvent=rows.every(r=>r.event===rows[0].event);
      const sameRegion=rows.every(r=>r.region===rows[0].region);
      const title=[sameDate?rows[0].date:entry.participationMonth,sameRegion?rows[0].region:'',
        sameEvent?rows[0].event:'複数大会'].filter(Boolean).join(' · ');
      const recentAttributes=' data-participation-month-open="'+esc(entry.participationMonth)+'"'
        +(sameRegion?' data-participation-region="'+esc(rows[0].region)+'"':'')
        +(sameDate?' data-participation-search="'+esc(rows[0].date)+'"':'');
      recent.innerHTML='<strong>最近追加した出場戦績 '+fmt(rows.length)+'件</strong>'
        +'<span>'+esc(title)+' · 順位・キル・VRを照合済み</span>'
        +'<a href="#results"'+recentAttributes+'>今回の出場戦績を表示 ↗</a>'
        +'<div class="participation-recent-names">'+rows.map(r=>'<span>'+esc(r.player)+'：'+fmt(r.rank)+'位 / '+fmt(r.kills)+'K / '+fmt(r.vrs)+'VR</span>').join('')+'</div>';
      summary?.after(recent);
      const shortcut=document.createElement('div');
      shortcut.className='participation-shortcut';
      shortcut.innerHTML='<strong>追加済み：'+esc(title)+' · '+fmt(rows.length)+'件</strong>'
        +'<p class="participation-note">予選敗退を含む確認済み出場戦績（賞金・称号の集計対象外）</p>'
        +buildTable(sortRows(rows))
        +'<p><a href="#results"'+recentAttributes+'>出場アーカイブで絞り込んで表示 ↗</a></p>';
      document.querySelector('#page-results .prize-row-note')?.after(shortcut);
      // Keep the latest populated month as the default for all visitors.
      // The newly published historical month is opened only via its shortcut.
    }catch(error){
      console.warn('Recent participation update was not available:',error);
    }
  }
  document.addEventListener('click',event=>{
    const link=event.target.closest('[data-participation-month-open]');
    if(!link)return;
    event.preventDefault();
    const month=link.dataset.participationMonthOpen;
    const picker=document.getElementById('participation-month');
    if(!picker||!Array.from(picker.options).some(o=>o.value===month))return;
    picker.value=month;
    const region=document.getElementById('participation-region');
    if(region)region.value=link.dataset.participationRegion||'all';
    const query=document.getElementById('participation-search');
    if(query)query.value=link.dataset.participationSearch||'';
    currentPage=1;
    renderMonth();
    if(location.hash!=='#results')location.hash='#results';
    window.setTimeout(()=>document.getElementById('participation-archive')?.scrollIntoView({block:'start',behavior:'smooth'}),80);
  });

  async function renderMonth(){
    const target=document.getElementById('participation-table');
    const picker=document.getElementById('participation-month');
    if(!target||!picker)return;
    const chosen=picker.value;
    target.textContent='出場戦績を読み込み中…';
    try{
      const entries=await getMonth(chosen);
      if(picker.value!==chosen||!target.isConnected)return;
      const region=document.getElementById('participation-region')?.value||'all';
      const query=(document.getElementById('participation-search')?.value||'').trim().toLocaleLowerCase();
      const filtered=sortRows(entries.filter(r=>(region==='all'||r.region===region)&&(!query||
        [r.date,r.event,r.player,...members(r),r.round,String(r.rank)].some(s=>String(s||'').toLocaleLowerCase().includes(query)))));
      const begin=(currentPage-1)*100;
      target.innerHTML=buildTable(filtered.slice(begin,begin+100));
      const count=document.getElementById('participation-count');
      if(count)count.textContent=filtered.length.toLocaleString('ja-JP')+'件中 '+(filtered.length?fmt(begin+1)+'〜'+fmt(Math.min(filtered.length,begin+100)):'0')+'件を表示';
      const prev=document.getElementById('participation-prev'),next=document.getElementById('participation-next');
      if(prev){prev.hidden=currentPage<=1;prev.disabled=currentPage<=1}
      if(next){next.hidden=begin+100>=filtered.length;next.disabled=begin+100>=filtered.length}
    }catch(error){if(target.isConnected)target.textContent=error.message}
  }
  async function initArchive(){
    const picker=document.getElementById('participation-month');
    const target=document.getElementById('participation-table');
    if(!picker||!target)return;
    const reset=()=>{currentPage=1;renderMonth()};
    picker.addEventListener('change',reset);
    document.getElementById('participation-region')?.addEventListener('change',reset);
    document.getElementById('participation-search')?.addEventListener('input',reset);
    document.getElementById('participation-prev')?.addEventListener('click',()=>{if(currentPage>1){currentPage--;renderMonth()}});
    document.getElementById('participation-next')?.addEventListener('click',()=>{currentPage++;renderMonth()});
    try{
      const index=await getIndex();
      const m=index.months.slice().sort((a,b)=>b.month.localeCompare(a.month));
      picker.replaceChildren(...m.map(month=>{
        const option=document.createElement('option');option.value=month.month;
        option.textContent=month.month.replace('-','年')+'月 · '+fmt(month.count)+'件';
        return option;
      }));
      const summary=document.getElementById('participation-summary');
      if(summary)summary.textContent='本人IDで確認した出場戦績 '+fmt(index.total)+'件 · '+fmt(index.players.length)+'選手 · '+fmt(m.length)+'か月';
      if(m.length){
        // Scanner checkpoints may contain empty months. Open the latest month
        // that actually has results, while keeping zero-result months selectable.
        const firstWithRecords=m.find(month=>month.count>0);
        if(firstWithRecords)picker.value=firstWithRecords.month;
        await revealLatestPublished(index,picker);
        renderMonth();
      }else{target.textContent='現在、出場戦績の初回自動調査を待っています';picker.disabled=true}
    }catch(error){target.textContent=error.message}
  }
  async function renderProfile(name){
    const host=document.getElementById('profile-content');
    if(!host)return;
    profileSequence++;
    const requestId=profileSequence;
    const section=document.createElement('section');
    section.className='participation-panel participation-profile';
    section.id='participation-profile';
    section.innerHTML='<div class="participation-heading"><div><p class="participation-kicker">AUTO-VERIFIED PARTICIPATION</p><h2>海外大会の出場戦績 <span>（予選敗退も収録）</span></h2></div></div>'
      +'<p class="participation-note">予選通過圏外と、通過未確認の出場記録を分けて掲載。賞金・称号には加算されません。AOT PRには、正式戦績との重複を除いた参加・順位・キルの基本ポイントのみ反映します。</p>'
      +'<div class="participation-profile-body" aria-live="polite">出場記録を確認中…</div>';
    host.append(section);
    const target=section.querySelector('.participation-profile-body');
    try{
      const index=await getIndex();
      const player=index.players.find(p=>p.name===name);
      if(!player){if(requestId===profileSequence&&section.isConnected)target.textContent='まだ出場記録の登録はありません';return}
      const results=await Promise.all(player.months.map(getMonth));
      if(requestId!==profileSequence||!section.isConnected)return;
      const rows=sortRows(results.flat().filter(r=>members(r).includes(name)));
      target.innerHTML='<p class="participation-count">'+fmt(rows.length)+'件の出場戦績</p>'+buildTable(rows.slice(0,40));
      if(rows.length>40)target.insertAdjacentHTML('beforeend','<p class="participation-note">新しい順に40件表示。全件は月別の出場戦績アーカイブで確認できます。</p>');
    }catch(error){if(requestId===profileSequence&&section.isConnected)target.textContent=error.message}
  }
  async function loadStatus(){
    const node=document.getElementById('participation-status');
    if(!node)return;
    try{
      const [status,index]=await Promise.all([load('participation-status.json'),getIndex()]);
      if(status.version!==1)throw Error('形式不正');
      const checked=status.checkedAt?new Date(status.checkedAt).toLocaleString('ja-JP',{timeZone:'Asia/Tokyo'}):'初回実行待ち';
      node.textContent='出場記録 '+fmt(index.total)+'件 / 照合ID '+fmt(status.linkedPlayers)+' / 取得ページ '+fmt(status.pagesScanned)+' / 部分調査で終了 '+fmt(status.partialWindows)+'開催枠 / 最終確認 '+checked;
    }catch{node.textContent='調査状況を読み込めません'}
  }
  let prRows=[],prLoaded=false;
  const prSubscribers=new Set();
  const subscribePR=callback=>{
    if(typeof callback!=='function')return ()=>{};
    prSubscribers.add(callback);
    if(prLoaded)callback(prRows);
    return ()=>prSubscribers.delete(callback);
  };
  const getPRRecords=()=>prRows;
  async function loadForPR(){
    try{
      const index=await getIndex();
      const list=index.months.map(x=>x.month).filter(m=>/^\d{4}-\d{2}$/.test(m));
      const gathered=[];
      // Four months at a time keeps network and memory load bounded as the
      // historical archive grows. Everything remains read-only on the site.
      for(let start=0;start<list.length;start+=4){
        const group=await Promise.all(list.slice(start,start+4).map(getMonth));
        for(const entries of group)gathered.push(...entries);
      }
      prRows=gathered;
      prLoaded=true;
      for(const callback of prSubscribers)callback(prRows);
    }catch(error){
      console.warn('AOT PR participation could not be loaded; verified results remain available:',error);
      const target=document.getElementById('participation-summary');
      if(target)target.setAttribute('title','AOT PR用出場記録の取得に失敗しました');
    }
  }
  window.AOTParticipation={renderProfile,subscribePR,getPRRecords};
  const initialize=()=>{connectMainResultsSearch();initArchive();loadStatus();loadForPR()};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initialize,{once:true});
  else initialize()
})();
