(() => {
  'use strict';
  const engine=window.AotVerification;
  const $=id=>document.getElementById(id);
  const base=new URL('.',document.currentScript?.src||document.baseURI);
  const n=v=>Number.isFinite(v)?v.toLocaleString('ja-JP'):'—';
  const s=v=>v==null?'':String(v);
  const data={};
  const state={tab:'queue',page:0,search:'',region:'all',loaded:false};
  const labels={queue:'確認待ち',duplicates:'重複・大会枠',errors:'不整合',unmapped:'未登録大会',coverage:'収集状況',history:'検証履歴'};
  const required=['results.json','auto-sync-review.json','history-sync-review.json','auto-sync-status.json','history-sync-status.json'];
  const files=[...required,'history-sync-reviewed.json','updates.json','calendar-history-status.json'];
  const dom=(tag,cls,content)=>{
    const el=document.createElement(tag);
    if(cls)el.className=cls;
    if(content!=null)el.textContent=s(content);
    return el;
  };
  const validLink=url=>{
    try{
      const u=new URL(s(url));
      return u.protocol==='https:'&&['fortnite.com','www.fortnite.com','fortnitetracker.com','www.fortnitetracker.com','osirion.gg','fnapi.osirion.gg','github.com'].includes(u.hostname)?u.href:null;
    }catch{return null;}
  };
  function extLink(label,url){
    const href=validLink(url);
    if(!href)return dom('span','muted',label);
    const a=dom('a','',label+' ↗');a.href=href;a.target='_blank';a.rel='noopener noreferrer';return a;
  }
  function playerLink(name){
    const a=dom('a','',name);a.href='./index.html#player='+encodeURIComponent(name);return a;
  }
  function details(item){
    const d=dom('div','issue'),top=dom('div','itemtop');
    if(item.badge)top.append(dom('span','badge '+(item.level||'info'),item.badge));
    top.append(dom('span','itemtitle',item.title||'確認項目'));
    d.append(top);
    if(item.meta)d.append(dom('div','sub',item.meta));
    if(item.description)d.append(dom('div','sub',item.description));
    if(item.people?.length){
      const p=dom('div','source');
      for(const name of item.people.slice(0,5))p.append(playerLink(name));
      if(item.people.length>5)p.append(dom('span','muted','ほか'+n(item.people.length-5)+'名'));
      d.append(p);
    }
    if(item.ids?.length){
      const ids=dom('details');
      ids.append(dom('summary','','対象ID：'+n(item.ids.length)+'件（展開）'));
      ids.append(dom('div','sub',item.ids.slice(0,80).join(' / ')+(item.ids.length>80?' …':'') ));
      d.append(ids);
    }
    if(item.link||item.source){
      const l=dom('div','source');if(item.link)l.append(extLink('出典を確認',item.link));if(item.source)l.append(extLink('公式ルール',item.source));d.append(l);
    }
    return d;
  }
  function timeText(raw){
    const t=Date.parse(s(raw));
    return Number.isFinite(t)?new Date(t).toLocaleString('ja-JP',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'})+' JST':'未実行';
  }
  async function read(name){
    const resp=await fetch(new URL(name,base),{cache:'no-store'});
    if(!resp.ok)throw Error(name+' HTTP '+resp.status);
    return resp.json();
  }
  function getRows(){
    if(!state.loaded)return [];
    const records=Array.isArray(data['results.json'])?data['results.json']:[];
    const queue=engine.proposals(data['auto-sync-review.json'],data['history-sync-review.json'],records);
    const issues=engine.inspect(records);
    const historic=data['history-sync-status.json']||{};
    const recent=data['auto-sync-status.json']||{};
    const historyReviewed=data['history-sync-reviewed.json']?.entries||[];
    const updates=data['updates.json']?.entries||[];
    const out={queue:[],duplicates:[],errors:[],unmapped:[],coverage:[],history:[]};
    for(const p of queue){
      out.queue.push({
        badge:p.alreadyPublished?'掲載ID一致':'確認待ち',
        level:p.alreadyPublished?'ok':'warn',
        title:s(p.player)|| (Array.isArray(p.players)?p.players.join(' / '):'選手不明'),
        description:s(p.reviewReason)||(p.prize==null?'賞金未確認：確定前に公式ルールと本人IDを照合':'追加検証が必要'),
        meta:[p.origin==='history'?'過去大会':'直近',p.date,p.region,p.event,p.round,p.rank!=null?'#'+n(p.rank):'',p.alreadyPublished?'同一IDが掲載済み':''].filter(Boolean).join(' · '),
        id:p.id,region:p.region,searchText:JSON.stringify(p),ids:p.id?[p.id]:[],link:p.source
      });
    }
    for(const x of issues){
      const it={
        badge:x.category==='split'?'開催枠の分裂疑い':x.severity==='error'?'要修正':'要照合',
        level:x.severity==='error'?'danger':'warn',
        title:x.title,description:x.description,
        meta:[x.date,x.region,x.event].filter(Boolean).join(' · '),
        region:x.region,ids:x.ids,people:x.players,searchText:[x.title,x.description,x.ids.join(' '),x.players.join(' '),x.event].join(' ')
      };
      (x.category==='format'?out.errors:out.duplicates).push(it);
    }
    for(const id of engine.unregistered([recent,historic])){
      out.unmapped.push({badge:'要分類',level:'warn',title:id,
        description:'公式大会ID・地域・競技形式・チーム人数を照合するまで自動登録しません。',
        meta:'自動収集対象で検出 · 最新の保存済みステータス',searchText:id,region:''});
    }
    const cov=engine.coverage(records,queue);
    for(const c of cov){
      out.coverage.push({badge:c.published>0?'掲載あり':'掲載未確認',level:c.published>0?'ok':'info',
        title:c.month+' / '+c.region,meta:'確認済みを含む掲載戦績 '+n(c.published)+'件 · 現在の確認待ち '+n(c.pending)+'件',
        description:'記録が存在する月・地域の確認状況。未収録大会が存在する可能性があります。調査完了を意味しません。',
        region:c.region,searchText:c.month+' '+c.region});
    }
    for(const x of updates){
      out.history.push({badge:'サイト更新',level:'ok',title:s(x.title)||'変更履歴',
        description:s(x.description),meta:s(x.date)+' · '+s(x.type)+' · '+n(Array.isArray(x.recordIds)?x.recordIds.length:0)+'件の戦績ID',
        searchText:[x.date,x.title,x.description,x.id].join(' '),region:'',ids:Array.isArray(x.recordIds)?x.recordIds:[]});
    }
    for(const x of historyReviewed){
      out.history.push({badge:x.decision==='published'?'掲載判断':x.decision==='already-published'?'重複解決':'確認済み',
        level:x.decision==='published'?'ok':'info',title:'過去調査候補 '+s(x.id),
        description:x.decision==='already-published'?'既存の戦績に照合：'+s(x.existingId):x.decision==='published'?'確認した成績を正式戦績へ掲載':s(x.decision),
        meta:'履歴スナップショット：'+timeText(data['history-sync-reviewed.json']?.reviewedAt),
        searchText:[x.id,x.existingId,x.recordId,x.decision].join(' '),
        ids:[x.id,x.existingId,x.recordId].filter(Boolean),source:x.rule,region:''});
    }
    out.history.sort((a,b)=>{
      // Items with a verified update date take precedence over dated review snapshots.
      const aa=(a.meta||'').slice(0,10),bb=(b.meta||'').slice(0,10);
      return bb.localeCompare(aa);
    });
    $('metric-queue').textContent=n(queue.filter(p=>!p.alreadyPublished).length);
    $('metric-duplicate').textContent=n(out.duplicates.length);
    $('metric-error').textContent=n(out.errors.length);
    $('metric-unmapped').textContent=n(out.unmapped.length);
    data.audit=out;data.queue=queue;data.issues=issues;
    return out[state.tab]||[];
  }
  function render(){
    if(!state.loaded)return;
    const full=getRows();
    const needle=state.search.toLocaleLowerCase('ja-JP');
    const found=full.filter(x=>(state.region==='all'||x.region===state.region)&&(!needle||s(x.searchText||[x.title,x.description,x.meta,x.ids?.join(' ')].join(' ')).toLocaleLowerCase('ja-JP').includes(needle)));
    const size=50,pages=Math.max(1,Math.ceil(found.length/size));
    state.page=Math.min(state.page,pages-1);
    const shown=found.slice(state.page*size,(state.page+1)*size);
    const target=$('audit-items');target.replaceChildren(...shown.map(details));
    if(!shown.length)target.append(dom('div','empty',full.length?'この条件に一致する項目はありません':'現在、該当する項目はありません'));
    $('audit-summary').textContent=labels[state.tab]+'：'+n(found.length)+'項目（全'+n(full.length)+'項目）';
    $('audit-pagination').textContent=n(state.page+1)+' / '+n(pages)+'ページ';
    $('audit-prev').disabled=state.page===0;
    $('audit-next').disabled=state.page>=pages-1;
    target.setAttribute('aria-labelledby','tab-'+state.tab);
    for(const el of document.querySelectorAll('[data-tab]'))el.setAttribute('aria-selected',String(el.dataset.tab===state.tab));
  }
  async function refresh(){
    const button=$('audit-refresh'),loading=$('audit-loading');
    button.disabled=true;loading.hidden=false;loading.className='notice';loading.textContent='公開データを照合しています…';
    const results=await Promise.allSettled(files.map(read));
    const failed=[];
    for(let i=0;i<files.length;i++){
      const result=results[i];
      if(result.status==='fulfilled')data[files[i]]=result.value;
      else {delete data[files[i]];failed.push(files[i]);}
    }
    const requiredFailed=required.filter(f=>failed.includes(f));
    if(requiredFailed.length){
      loading.className='notice warn';loading.textContent='検証に必要なファイルを取得できません：'+requiredFailed.join('、')+'。数値は表示しません。';
      state.loaded=false;for(const id of ['queue','duplicate','error','unmapped'])$('metric-'+id).textContent='—';
      $('audit-items').replaceChildren(dom('div','empty','ページを再読み込みするか、後ほど検証してください'));
      $('audit-summary').textContent='取得エラー';$('audit-pagination').textContent='—';
    }else{
      state.loaded=true;
      const recent=data['auto-sync-status.json'],historic=data['history-sync-status.json'];
      const checked=[recent.checkedAt,historic.checkedAt].filter(Boolean).sort().at(-1);
      $('audit-last-check').textContent='自動調査の最終チェック：'+timeText(checked);
      const cal=data['calendar-history-status.json'];
      $('audit-data-date').textContent='過去大会の確認範囲：'+(historic.fromDate||'未確認')+' ～ '+(historic.toDate||'未確認');
      loading.className='notice';loading.textContent='掲載済み戦績と自動収集候補を読み込みました。これは機械的な照合候補であり、実際の大会記録の真偽を保証するものではありません。';
      if(failed.length)loading.textContent+=' 補助ファイル未取得：'+failed.join('、');
      if(cal?.dates?.length===2){
        const note=dom('div','sub','大会カレンダーが参照する過去開催枠の期間：'+cal.dates.join(' ～ ')+'（全件を成績収集済みという意味ではありません）');
        loading.append(note);
      }
      render();
    }
    button.disabled=false;
  }
  for(const tab of document.querySelectorAll('[data-tab]'))tab.addEventListener('click',()=>{
    state.tab=tab.dataset.tab;state.page=0;render();
    history.replaceState(null,'','#'+state.tab);
  });
  $('audit-search').addEventListener('input',e=>{state.search=e.target.value;state.page=0;render()});
  $('audit-region').addEventListener('change',e=>{state.region=e.target.value;state.page=0;render()});
  $('audit-prev').addEventListener('click',()=>{if(state.page>0){state.page--;render()}});
  $('audit-next').addEventListener('click',()=>{state.page++;render()});
  $('audit-refresh').addEventListener('click',refresh);
  const hash=location.hash.slice(1);
  if(Object.prototype.hasOwnProperty.call(labels,hash))state.tab=hash;
  refresh();
})();
