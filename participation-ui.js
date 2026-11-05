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
    +'<td>'+esc(members(r).join(' / '))+'</td><td><strong>'+esc(r.event)+'</strong><small>'+esc(r.round)+'</small></td>'
    +'<td>'+fmt(r.points)+'</td><td>'+fmt(r.kills)+'</td><td>'+fmt(r.vrs)+'</td><td>'+fmt(r.matches)+'</td>'
    +'<td><span class="participation-tag">'+esc(heading(r))+'</span></td>'
    +'<td><a target="_blank" rel="noopener noreferrer" href="'+esc(r.source)+'">出典 ↗</a></td></tr>';
  const buildTable=rows=>{
    if(!rows.length)return '<p class="participation-empty">この条件の出場戦績はまだありません</p>';
    return '<div class="participation-scroll"><table class="participation-table"><thead><tr><th>日付</th><th>地域</th><th>順位</th><th>選手</th><th>大会 / ラウンド</th><th>Pt</th><th>キル</th><th>VR</th><th>試合</th><th>区分</th><th>出典</th></tr></thead><tbody>'+rows.map(rowHtml).join('')+'</tbody></table></div>';
  };
  const sortRows=rows=>rows.slice().sort((a,b)=>b.date.localeCompare(a.date)||a.rank-b.rank||a.event.localeCompare(b.event));
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
        [r.event,r.player,...members(r),r.round,String(r.rank)].some(s=>String(s||'').toLocaleLowerCase().includes(query)))));
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
      if(m.length)renderMonth();else{target.textContent='現在、出場戦績の初回自動調査を待っています';picker.disabled=true}
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
      +'<p class="participation-note">予選通過圏外と、通過未確認の出場記録を分けて掲載。賞金・AOT PR・称号の集計には加算されません。</p>'
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
  window.AOTParticipation={renderProfile};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{initArchive();loadStatus()},{once:true});
  else{initArchive();loadStatus()}
})();
