(() => {
  'use strict';
  const engine=window.AotVerification;
  const $=id=>document.getElementById(id);
  const base=new URL('.',document.currentScript?.src||document.baseURI);
  const n=v=>Number.isFinite(v)?v.toLocaleString('ja-JP'):'—';
  const s=v=>v==null?'':String(v);
  const data={};
  // Full integrity checks are computed once per data refresh, not on every
  // tab change, search keystroke, region selection or pagination click.
  let cachedAuditRows=null;
  const state={tab:'queue',page:0,search:'',region:'all',year:'all',tournament:'all',triage:'all',loaded:false,selected:new Set()};
  const labels={queue:'確認待ち',duplicates:'重複・大会枠',errors:'不整合',unmapped:'未登録大会',coverage:'収集状況',history:'検証履歴'};
  const required=['published-results','auto-sync-review.json','history-sync-review.json','auto-sync-status.json','history-sync-status.json'];
  const files=[...required,'history-sync-reviewed.json','updates.json','calendar-history-status.json','calendar-history-index.json','approval-history.json','candidate-triage.json'];
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
    if(state.tab==='queue'&&item.id&&!item.alreadyPublished&&
      !['evidence-conflict','duplicate-risk'].includes(item.triageStatus)){
      const choice=dom('label','audit-select');
      const input=dom('input');input.type='checkbox';input.checked=state.selected.has(item.id);
      input.addEventListener('change',()=>{
        if(input.checked&&state.selected.size>=20){
          input.checked=false;
          $('audit-selected-count').textContent='一度の申請は最大20件まで。候補を絞り込んでね';
          return;
        }
        if(input.checked)state.selected.add(item.id);else state.selected.delete(item.id);
        updateSelected();
      });
      choice.append(input,dom('span','','掲載申請用に候補IDを選択'));
      d.append(choice);
    }
    if(item.meta)d.append(dom('div','sub',item.meta));
    if(item.description)d.append(dom('div','sub',item.description));
    if(item.evidenceText){
      const note=dom('div','evidence-note '+(item.level==='danger'?'danger':item.level==='warn'?'warn':''),item.evidenceText);
      d.append(note);
    }
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
  function updateSelected(){
    $('audit-selected-count').textContent='選択中 '+n(state.selected.size)+'件';
    $('audit-copy-ids').disabled=state.selected.size===0;
  }
  async function copyIds(){
    if(!state.selected.size)return;
    const value=[...state.selected].join(',');
    try{
      await navigator.clipboard.writeText(value);
      $('audit-selected-count').textContent=n(state.selected.size)+'件のIDをコピーしました';
    }catch{
      $('audit-selected-count').textContent='コピーできません。候補ID：'+value;
    }
  }
  function timeText(raw){
    const t=Date.parse(s(raw));
    return Number.isFinite(t)?new Date(t).toLocaleString('ja-JP',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'})+' JST':'未実行';
  }
  async function read(name){
    // Revalidate on every refresh, but allow ETag/304 to reuse unchanged JSON.
    const resp=await fetch(new URL(name,base),{cache:'no-cache'});
    if(!resp.ok)throw Error(name+' HTTP '+resp.status);
    return resp.json();
  }
  async function readPublishedResults(){
    const manifest=await read('source-results/manifest.json');
    if(!manifest||!Number.isSafeInteger(manifest.count)||!Array.isArray(manifest.recordOrder)||
       !Array.isArray(manifest.shards))throw Error('成績データの索引形式が不正');
    const groups=await Promise.all(manifest.shards.map(async entry=>{
      if(typeof entry.file!=='string'||!entry.file.startsWith('source-results/')||
         !/^(?:S[1-9][0-9]*|unknown)[.]json$/.test(entry.file.slice('source-results/'.length)))
        throw Error('不正なシーズンファイル');
      const rows=await read(entry.file);
      if(!Array.isArray(rows)||rows.length!==entry.count)
        throw Error('シーズン別の戦績件数が一致しません');
      return rows;
    }));
    const byId=new Map();
    let teamCents=0,unknown=0;
    for(const row of groups.flat()){
      if(typeof row?.id!=='string'||byId.has(row.id))
        throw Error('シーズン別の戦績IDが重複しています');
      byId.set(row.id,row);
      if(row.prize==null)unknown++;
      else {
        const amount=Math.round(row.prize*100);
        if(!Number.isSafeInteger(amount)||amount<0)
          throw Error('不正な賞金額');
        teamCents+=amount;
      }
    }
    if(byId.size!==manifest.count||manifest.recordOrder.length!==manifest.count||
       teamCents!==manifest.teamPrizeCents||unknown!==manifest.unconfirmedPrizeRecords)
      throw Error('公開戦績とシーズン索引の集計が一致しません');
    const records=manifest.recordOrder.map(id=>byId.get(id));
    if(records.some(row=>!row))throw Error('シーズン別の戦績IDが欠落しています');
    return records;
  }
  function getRows(){
    if(!state.loaded)return [];
    if(cachedAuditRows)return cachedAuditRows[state.tab]||[];
    const records=Array.isArray(data['published-results'])?data['published-results']:[];
    const queue=engine.proposals(data['auto-sync-review.json'],data['history-sync-review.json'],records);
    const issues=engine.inspect(records);
    const historic=data['history-sync-status.json']||{};
    const recent=data['auto-sync-status.json']||{};
    const historyReviewed=data['history-sync-reviewed.json']?.entries||[];
    const reviewApprovals=data['approval-history.json']?.entries||[];
    const updates=data['updates.json']?.entries||[];
    const out={queue:[],duplicates:[],errors:[],unmapped:[],coverage:[],history:[]};
    // Only accept an index belonging to the current review snapshot. A stale
    // generated file must never override the live pending list.
    const snapshot=data['candidate-triage.json'];
    const active=queue.filter(p=>!p.alreadyPublished);
    const ids=new Set(active.map(p=>p.id));
    const fresh=snapshot?.version===1&&Array.isArray(snapshot.queue)&&snapshot.queue.length===ids.size&&
      snapshot.queue.every(p=>ids.has(p.id))&&
      snapshot.sourceCheckedAt===[recent.checkedAt,historic.checkedAt].filter(Boolean).sort().at(-1);
    const triage=new Map(fresh?snapshot.queue.map(p=>[p.id,p]):[]);
    data.triageFresh=fresh;
    const statuses={
      'rules-review':['規則確認待ち','warn'],
      'partial-scan':['順位表の調査途中','info'],
      'duplicate-risk':['重複疑い','danger'],
      'evidence-conflict':['根拠不足・不一致','danger']
    };
    for(const p of queue){
      const triageRow=triage.get(p.id),currentStatus=triageRow?.status||'not-indexed';
      const [statusLabel,level]=p.alreadyPublished?['掲載済み','ok']:statuses[currentStatus]||['追加調査待ち','warn'];
      const evidence=triageRow?.evidence;
      const evidenceText=triageRow?[
        '保存済み順位表：'+(evidence?.exactCheckpoint?'数値とIDを照合':'要再確認'),
        evidence?.scanComplete?'取得完了':evidence?.observedPartial?'取得途中（確認済みページのみ）':'調査未完了',
        triageRow.action
      ].join(' · '):
        '候補はまだ機械的な照合段階。Epic ID・出典・賞金規則の追加確認が必要';
      out.queue.push({
        badge:statusLabel,level,
        title:s(p.player)|| (Array.isArray(p.players)?p.players.join(' / '):'選手不明'),
        description:s(p.reviewReason)||(p.prize==null?'賞金未確認：確定前に公式ルールと本人IDを照合':'追加検証が必要'),
        evidenceText,
        meta:[p.origin==='history'?'過去大会':'直近',p.date,p.region,p.event,p.round,p.rank!=null?'#'+n(p.rank):'',p.alreadyPublished?'同一IDが掲載済み':''].filter(Boolean).join(' · '),
        id:p.id,alreadyPublished:p.alreadyPublished,region:p.region,year:s(p.date).slice(0,4),
        tournamentId:p.tournamentId||p.event,triageStatus:currentStatus,
        searchText:JSON.stringify(p)+' '+evidenceText,ids:p.id?[p.id]:[],link:p.source
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
    const cov=engine.coverage(records,queue,data['calendar-history-index.json']?.months);
    for(const c of cov){
      out.coverage.push({badge:c.published>0?'掲載あり':'掲載未確認',level:c.published>0?'ok':'info',
        title:c.month+' / '+c.region,meta:'確認済みを含む掲載戦績 '+n(c.published)+'件 · 現在の確認待ち '+n(c.pending)+'件',
        description:'カレンダー対象月と掲載状況の突合。掲載0件でも、その地域で大会が開催されなかった・未調査だったとは断定できません。調査完了を意味しません。',
        region:c.region,searchText:c.month+' '+c.region});
    }
    for(const x of updates){
      out.history.push({badge:'サイト更新',level:'ok',title:s(x.title)||'変更履歴',
        description:s(x.description),meta:s(x.date)+' · '+s(x.type)+' · '+n(Array.isArray(x.recordIds)?x.recordIds.length:0)+'件の戦績ID',
        searchText:[x.date,x.title,x.description,x.id].join(' '),region:'',ids:Array.isArray(x.recordIds)?x.recordIds:[]});
    }
    for(const x of reviewApprovals){
      out.history.push({badge:'管理者の掲載承認',level:'ok',title:'掲載確認 '+s(x.id),
        description:x.policy==='attendance-only'?'出場確認のみ・賞金と通過は未認定':'公式ルールで確認済みの突破・0VR',
        meta:'承認日時：'+timeText(x.approvedAt)+' · '+s(x.policy),
        searchText:[x.id,x.recordId,x.policy,x.approvedAt].join(' '),
        ids:[x.id,x.recordId].filter(Boolean),link:x.source,source:x.rule,region:''});
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
    cachedAuditRows=out;
    return out[state.tab]||[];
  }
  function populateQueueFilters(){
    const queue=data.audit?.queue||[];
    const populate=(id,items,defaultLabel)=>{
      const select=$(id),selected=select.value;
      select.replaceChildren(new Option(defaultLabel,'all'));
      for(const [value,label] of items)select.append(new Option(label,value));
      select.value=items.some(([value])=>value===selected)?selected:'all';
      return select.value;
    };
    const years=[...new Set(queue.map(p=>p.year).filter(Boolean))].sort().reverse().map(year=>[year,year+'年']);
    const events=[...new Map(queue.map(p=>[p.tournamentId,[p.tournamentId,
      (p.meta.split(' · ')[3]||p.tournamentId)]]))].map(([,v])=>v).sort((a,b)=>a[1].localeCompare(b[1],'ja'));
    state.year=populate('audit-year',years,'全年代');
    state.tournament=populate('audit-tournament',events,'全大会');
  }
  function renderGroups(items){
    const target=$('audit-groups');target.replaceChildren();
    if(state.tab!=='queue')return;
    const summaries=[
      ['開催年',x=>x.year],
      ['地域',x=>x.region],
      ['大会',x=>x.meta.split(' · ')[3]||x.tournamentId||'未分類']
    ];
    for(const [title,getKey] of summaries){
      const counts=new Map();
      for(const item of items){
        const name=getKey(item)||'未確認';
        counts.set(name,(counts.get(name)||0)+1);
      }
      const section=dom('section','audit-group');
      section.append(dom('strong','',title+'別：'+n(items.length)+'件'));
      const sorted=[...counts].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],'ja'));
      for(const [name,count] of sorted.slice(0,5))section.append(dom('p','',name+' · '+n(count)+'件'));
      if(sorted.length>5)section.append(dom('p','muted','ほか'+n(sorted.length-5)+'分類'));
      target.append(section);
    }
  }
  function render(){
    if(!state.loaded)return;
    const full=getRows();
    const needle=state.search.toLocaleLowerCase('ja-JP');
    const queueTab=state.tab==='queue';
    for(const id of ['audit-year','audit-tournament','audit-triage'])$(id).disabled=!queueTab;
    const found=full.filter(x=>(state.region==='all'||x.region===state.region)&&
      (!queueTab||((state.year==='all'||x.year===state.year)&&
       (state.tournament==='all'||x.tournamentId===state.tournament)&&
       (state.triage==='all'||x.triageStatus===state.triage)))&&
      (!needle||s(x.searchText||[x.title,x.description,x.meta,x.ids?.join(' ')].join(' ')).toLocaleLowerCase('ja-JP').includes(needle)));
    renderGroups(queueTab?found:[]);
    const size=50,pages=Math.max(1,Math.ceil(found.length/size));
    state.page=Math.min(state.page,pages-1);
    const shown=found.slice(state.page*size,(state.page+1)*size);
    const target=$('audit-items');target.replaceChildren(...shown.map(details));
    if(!shown.length)target.append(dom('div','empty',full.length?'この条件に一致する項目はありません':'現在、該当する項目はありません'));
    $('audit-summary').textContent=labels[state.tab]+'：'+n(found.length)+'項目（全'+n(full.length)+'項目）';
    if(state.tab==='unmapped')$('audit-summary').textContent+=' ／ 記録されたIDの一覧のみ。過去調査で検出した大会種類数：'+n(data['history-sync-status.json']?.unmappedEvents||0)+'、直近：'+n(data['auto-sync-status.json']?.unmappedEvents||0);
    $('audit-pagination').textContent=n(state.page+1)+' / '+n(pages)+'ページ';
    $('audit-prev').disabled=state.page===0;
    $('audit-next').disabled=state.page>=pages-1;
    target.setAttribute('aria-labelledby','tab-'+state.tab);
    for(const el of document.querySelectorAll('[data-tab]'))el.setAttribute('aria-selected',String(el.dataset.tab===state.tab));
  }
  async function refresh(){
    const button=$('audit-refresh'),loading=$('audit-loading');
    button.disabled=true;cachedAuditRows=null;loading.hidden=false;loading.className='notice';loading.textContent='公開データを照合しています…';
    const results=await Promise.allSettled(files.map(name=>name==='published-results'?readPublishedResults():read(name)));
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
      getRows(); // Populate the immutable snapshot before filtering selection.
      const valid=new Set((data.audit.queue||[]).filter(x=>!x.alreadyPublished&&
        !['evidence-conflict','duplicate-risk'].includes(x.triageStatus)).map(x=>x.id));
      for(const key of state.selected)if(!valid.has(key))state.selected.delete(key);
      populateQueueFilters();
      updateSelected();
      const recent=data['auto-sync-status.json'],historic=data['history-sync-status.json'];
      const checked=[recent.checkedAt,historic.checkedAt].filter(Boolean).sort().at(-1);
      $('audit-last-check').textContent='自動調査の最終チェック：'+timeText(checked);
      const cal=data['calendar-history-status.json'];
      $('audit-data-date').textContent='過去大会の確認範囲：'+(historic.fromDate||'未確認')+' ～ '+(historic.toDate||'未確認');
      loading.className='notice';loading.textContent='掲載済み戦績と自動収集候補を読み込みました。これは機械的な照合候補であり、実際の大会記録の真偽を保証するものではありません。';
      if(failed.length)loading.textContent+=' 補助ファイル未取得：'+failed.join('、');
      if(!data.triageFresh)loading.textContent+=' 根拠別の詳細分類は更新待ちのため、候補の元データを優先して表示しています。';
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
  for(const [id,key] of [['audit-year','year'],['audit-tournament','tournament'],['audit-triage','triage']]){
    $(id).addEventListener('change',e=>{state[key]=e.target.value;state.page=0;render()});
  }
  $('audit-prev').addEventListener('click',()=>{if(state.page>0){state.page--;render()}});
  $('audit-next').addEventListener('click',()=>{state.page++;render()});
  $('audit-refresh').addEventListener('click',refresh);
  $('audit-copy-ids').addEventListener('click',copyIds);
  const hash=location.hash.slice(1);
  if(Object.prototype.hasOwnProperty.call(labels,hash))state.tab=hash;
  refresh();
})();
