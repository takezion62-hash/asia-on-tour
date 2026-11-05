(() => {
  'use strict';
  const area=document.getElementById('auto-sync-status'),btn=document.getElementById('auto-sync-refresh'),candidates=document.getElementById('auto-sync-proposals');
  if(!area||!btn||!candidates)return;
  const base=new URL('.',document.currentScript?.src||document.baseURI);
  const fmt=v=>Number.isFinite(v)?v.toLocaleString('ja-JP'):'—';
  const field=(label,value)=>{const d=document.createElement('div');d.className='auto-sync-stat';const a=document.createElement('span');a.textContent=label;const b=document.createElement('strong');b.textContent=value;d.append(a,b);return d};
  async function refresh(){
    btn.disabled=true;area.textContent='確認中…';candidates.textContent='候補を確認中…';
    try{
      const r=await fetch(new URL('auto-sync-status.json',base),{cache:'no-store'});
      if(!r.ok)throw Error('status HTTP '+r.status);
      const s=await r.json();if(s.version!==1)throw Error('unknown version');
      const time=s.checkedAt?new Date(s.checkedAt).toLocaleString('ja-JP',{timeZone:'Asia/Tokyo'}):'未実行';
      area.replaceChildren(field('状態',s.state==='setup'?'初期設定待ち':s.mode==='publish'?'自動反映':'確認のみ'),field('最終チェック',time),field('連携済み選手',fmt(s.linkedPlayers)+'名'),field('直近の終了済みラウンド',fmt(s.trackedWindows)+'件'),field('新規候補',fmt(s.found)+'件'),field('今回の登録',fmt(s.imported)+'件'),field('未登録Victory Cup',fmt(s.unmappedEvents||0)+'種類'));
      const info=document.createElement('p');info.className='auto-sync-message';info.textContent=s.message||'';area.append(info);
      try{
        const q=await fetch(new URL('auto-sync-review.json',base),{cache:'no-store'});
        if(!q.ok)throw Error('review');
        const v=await q.json();if(v.version!==1||!Array.isArray(v.proposals))throw Error('format');
        if(!v.proposals.length)candidates.textContent='確認待ちの候補はありません';
        else {
          const ul=document.createElement('ul');ul.className='auto-sync-proposals';
          for(const x of v.proposals.slice(0,20)){
            const li=document.createElement('li');li.textContent=[x.date,x.region,x.player,x.event,x.rank?'#'+fmt(x.rank):'',x.prize==null?'賞金未確認':'$'+fmt(x.prize)].filter(Boolean).join(' · ');ul.append(li);
          }
          candidates.replaceChildren(ul);
          if(v.proposals.length>20){const p=document.createElement('p');p.textContent='先頭20件のみ表示。全候補はGitHubで確認してください。';candidates.append(p);}
        }
      }catch{candidates.textContent='候補ファイルを読み込めませんでした';}
    }catch{area.textContent='更新情報を取得できません。ページを再表示してください。';candidates.textContent='—';}
    finally{btn.disabled=false;}
  }
  btn.addEventListener('click',refresh);refresh();
})();
