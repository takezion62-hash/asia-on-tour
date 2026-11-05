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
      area.replaceChildren(field('状態',s.state==='setup'?'初期設定待ち':s.mode==='publish'?'自動反映':'確認のみ'),field('最終チェック',time),field('連携済み選手',fmt(s.linkedPlayers)+'名'),field('直近の終了済みラウンド',fmt(s.trackedWindows)+'件'),field('新規候補',fmt(s.found)+'件'),field('今回の登録',fmt(s.imported)+'件'),field('VC以外の確認対象',fmt(s.reviewOnlyWindows||0)+'開催枠'),field('VC以外の確認待ち',fmt(s.reviewOnlyCandidates||0)+'件'),field('未登録の対象大会',fmt(s.unmappedEvents||0)+'種類'));
      const info=document.createElement('p');info.className='auto-sync-message';info.textContent=s.message||'';area.append(info);
      try{
        const q=await fetch(new URL('auto-sync-review.json',base),{cache:'no-store'});
        if(!q.ok)throw Error('review');
        const v=await q.json();if(v.version!==1||!Array.isArray(v.proposals))throw Error('format');
        if(!v.proposals.length)candidates.textContent='確認待ちの候補はありません';
        else {
          const ul=document.createElement('ul');ul.className='auto-sync-proposals';
          for(const x of v.proposals.slice(0,20)){
            const li=document.createElement('li');li.textContent=[x.date,x.region,x.player,x.event,x.rank?'#'+fmt(x.rank):'',x.reviewReason|| (x.prize==null?'賞金未確認':'].filter(Boolean).join(' · ');ul.append(li);
          }
          candidates.replaceChildren(ul);
          if(v.proposals.length>20){const p=document.createElement('p');p.textContent='先頭20件のみ表示。全候補はGitHubで確認してください。';candidates.append(p);}
        }
      }catch{candidates.textContent='候補ファイルを読み込めませんでした';}
    }catch{area.textContent='更新情報を取得できません。ページを再表示してください。';candidates.textContent='—';}
    finally{btn.disabled=false;}
  }
  btn.addEventListener('click',refresh);refresh();
  const historyArea=document.getElementById('history-sync-status');
  const historyCandidates=document.getElementById('history-sync-proposals');
  const historyBtn=document.getElementById('history-sync-refresh');
  async function refreshHistory(){
    if(!historyArea||!historyCandidates||!historyBtn)return;
    historyBtn.disabled=true;
    historyArea.textContent='過去大会の調査状況を確認中…';
    try{
      const response=await fetch(new URL('history-sync-status.json',base),{cache:'no-store'});
      if(!response.ok)throw Error('history status HTTP '+response.status);
      const status=await response.json();
      if(status.version!==1||status.scope!=='history')throw Error('unknown history status');
      const checked=status.checkedAt?new Date(status.checkedAt).toLocaleString('ja-JP',{timeZone:'Asia/Tokyo'}):'未実行';
      historyArea.replaceChildren(
        field('対象期間',(status.fromDate||'—')+' ～ '+(status.toDate||'—')),
        field('最終チェック',checked),
        field('確認待ち候補',fmt(status.found)+'件'),
        field('今回の自動承認',fmt(status.imported||0)+'件'),
        field('累計自動承認',fmt(status.autoApprovedTotal||0)+'件'),
        field('数値矛盾の保留',fmt(status.invalidCachedCandidates||0)+'件'),
        field('照合後に登録済み',fmt(status.alreadyRegistered||0)+'件'),
        field('調査したページ（今回）',fmt(status.scannedPages)+'ページ'),
        field('調査対象ラウンド',fmt(status.trackedWindows)+'件'),
        field('VC以外の調査対象',fmt(status.reviewOnlyWindows||0)+'開催枠'),
        field('VC以外の確認候補',fmt(status.reviewOnlyCandidates||0)+'件'),
        field('完了ラウンド',fmt(status.completedWindows)+'件')
      );
      const message=document.createElement('p');message.className='auto-sync-message';
      message.textContent=status.message||'';historyArea.append(message);
      const response2=await fetch(new URL('history-sync-review.json',base),{cache:'no-store'});
      if(!response2.ok)throw Error('history review HTTP '+response2.status);
      const review=await response2.json();
      if(review.version!==1||!Array.isArray(review.proposals))throw Error('history review format');
      if(!review.proposals.length){historyCandidates.textContent='現在、確認候補はありません';}
      else{
        const ul=document.createElement('ul');ul.className='auto-sync-proposals';
        for(const item of review.proposals.slice(0,20)){
          const li=document.createElement('li');
          li.textContent=[item.date,item.region,item.player,item.event,item.round,'#'+fmt(item.rank),item.reviewReason|| (item.kind==='予選'?'通過未確認':item.prize==null?'賞金未確認':'賞金要確認')].join(' · ');
          ul.append(li);
        }
        historyCandidates.replaceChildren(ul);
        if(review.proposals.length>20){
          const p=document.createElement('p');p.textContent='先頭20件のみ表示。残りはGitHubの確認候補データを参照してください。';
          historyCandidates.append(p);
        }
      }
    }catch{
      historyArea.textContent='過去大会の調査状況を取得できません。';
      historyCandidates.textContent='—';
    }finally{historyBtn.disabled=false;}
  }
  if(historyBtn){historyBtn.addEventListener('click',refreshHistory);refreshHistory();}

})();
+fmt(x.prize))].filter(Boolean).join(' · ');ul.append(li);
          }
          candidates.replaceChildren(ul);
          if(v.proposals.length>20){const p=document.createElement('p');p.textContent='先頭20件のみ表示。全候補はGitHubで確認してください。';candidates.append(p);}
        }
      }catch{candidates.textContent='候補ファイルを読み込めませんでした';}
    }catch{area.textContent='更新情報を取得できません。ページを再表示してください。';candidates.textContent='—';}
    finally{btn.disabled=false;}
  }
  btn.addEventListener('click',refresh);refresh();
  const historyArea=document.getElementById('history-sync-status');
  const historyCandidates=document.getElementById('history-sync-proposals');
  const historyBtn=document.getElementById('history-sync-refresh');
  async function refreshHistory(){
    if(!historyArea||!historyCandidates||!historyBtn)return;
    historyBtn.disabled=true;
    historyArea.textContent='過去大会の調査状況を確認中…';
    try{
      const response=await fetch(new URL('history-sync-status.json',base),{cache:'no-store'});
      if(!response.ok)throw Error('history status HTTP '+response.status);
      const status=await response.json();
      if(status.version!==1||status.scope!=='history')throw Error('unknown history status');
      const checked=status.checkedAt?new Date(status.checkedAt).toLocaleString('ja-JP',{timeZone:'Asia/Tokyo'}):'未実行';
      historyArea.replaceChildren(
        field('対象期間',(status.fromDate||'—')+' ～ '+(status.toDate||'—')),
        field('最終チェック',checked),
        field('確認待ち候補',fmt(status.found)+'件'),
        field('今回の自動承認',fmt(status.imported||0)+'件'),
        field('累計自動承認',fmt(status.autoApprovedTotal||0)+'件'),
        field('数値矛盾の保留',fmt(status.invalidCachedCandidates||0)+'件'),
        field('照合後に登録済み',fmt(status.alreadyRegistered||0)+'件'),
        field('調査したページ（今回）',fmt(status.scannedPages)+'ページ'),
        field('調査対象ラウンド',fmt(status.trackedWindows)+'件'),
        field('VC以外の調査対象',fmt(status.reviewOnlyWindows||0)+'開催枠'),
        field('VC以外の確認候補',fmt(status.reviewOnlyCandidates||0)+'件'),
        field('完了ラウンド',fmt(status.completedWindows)+'件')
      );
      const message=document.createElement('p');message.className='auto-sync-message';
      message.textContent=status.message||'';historyArea.append(message);
      const response2=await fetch(new URL('history-sync-review.json',base),{cache:'no-store'});
      if(!response2.ok)throw Error('history review HTTP '+response2.status);
      const review=await response2.json();
      if(review.version!==1||!Array.isArray(review.proposals))throw Error('history review format');
      if(!review.proposals.length){historyCandidates.textContent='現在、確認候補はありません';}
      else{
        const ul=document.createElement('ul');ul.className='auto-sync-proposals';
        for(const item of review.proposals.slice(0,20)){
          const li=document.createElement('li');
          li.textContent=[item.date,item.region,item.player,item.event,item.round,'#'+fmt(item.rank),item.reviewReason|| (item.kind==='予選'?'通過未確認':item.prize==null?'賞金未確認':'賞金要確認')].join(' · ');
          ul.append(li);
        }
        historyCandidates.replaceChildren(ul);
        if(review.proposals.length>20){
          const p=document.createElement('p');p.textContent='先頭20件のみ表示。残りはGitHubの確認候補データを参照してください。';
          historyCandidates.append(p);
        }
      }
    }catch{
      historyArea.textContent='過去大会の調査状況を取得できません。';
      historyCandidates.textContent='—';
    }finally{historyBtn.disabled=false;}
  }
  if(historyBtn){historyBtn.addEventListener('click',refreshHistory);refreshHistory();}

})();
