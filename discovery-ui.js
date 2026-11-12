/* ASIA ON TOUR | Fast, season-scoped discovery and local player favorites.
 * No network request is made for favorites and no result records are changed.
 */
(function (root) {
  'use strict';
  var core=root.AOTDiscovery;
  if (!core || core.VERSION!==1) return;
  var bridge=null, favorites=[], revision=0, timer=null;
  var $=function(sel){return document.querySelector(sel);};
  var esc=function(value){return String(value==null?'':value).replace(/[&<>"']/g,function(ch){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','"':'&#39;'}[ch];
  });};
  var has=function(name){return favorites.includes(name);};
  var safeStorage=function(){try{return root.localStorage;}catch{return null;}};
  function known(){return bridge?bridge.players().map(function(p){return p.name;}):[];}
  function button(name,extra){
    var selected=has(name);
    return '<button type="button" class="favorite-toggle'+(extra?' '+extra:'')+
      '" data-favorite-player="'+esc(name)+'" aria-pressed="'+selected+
      '" aria-label="'+esc(name)+(selected?'をお気に入りから解除':'をお気に入りに登録')+
      '" title="'+(selected?'お気に入りを解除':'お気に入りに追加')+'">'+(selected?'★':'☆')+'</button>';
  }
  function syncButtons(){
    document.querySelectorAll('[data-favorite-player]').forEach(function(el){
      var name=el.dataset.favoritePlayer,selected=has(name);
      el.textContent=selected?'★':'☆';
      el.setAttribute('aria-pressed',String(selected));
      el.setAttribute('aria-label',name+(selected?'をお気に入りから解除':'をお気に入りに登録'));
      el.title=selected?'お気に入りを解除':'お気に入りに追加';
    });
  }
  function favoritesMarkup(){
    var target=$('#quickfind-favorites');
    if(!target||!bridge)return;
    var valid=new Set(known());
    var items=favorites.filter(function(name){return valid.has(name);});
    target.innerHTML='<div class="quickfind-row-heading"><h2>★ お気に入りの選手 <span>'+items.length+'/'+core.MAX_FAVORITES+'</span></h2>'+
      '<p>この端末のブラウザに保存 · タップでプロフィールへ</p></div>'+
      (items.length?'<div class="quickfind-favorite-list">'+items.map(function(name){
        return '<span class="quickfind-favorite-chip"><a href="'+esc(bridge.profileHref(name))+
          '" data-open-profile="'+esc(name)+'">'+esc(name)+'</a>'+button(name,'favorite-inline')+'</span>';
      }).join('')+'</div>':'<p class="quickfind-favorite-empty">選手名鑑やプロフィールの ☆ を押すと、ここに表示されるよ</p>');
  }
  function decoratePlayers(){
    if(!bridge)return;
    document.querySelectorAll('#all-players > a.player[data-open-profile]').forEach(function(link){
      var shell=document.createElement('div');
      shell.className='player-card-shell';
      link.parentNode.insertBefore(shell,link);
      shell.appendChild(link);
      shell.insertAdjacentHTML('beforeend',button(link.dataset.openProfile,'favorite-card-button'));
    });
    syncButtons();
  }
  function decorateProfile(name){
    var toolbar=$('#profile-content .profile-toolbar');
    if(!toolbar||!name)return;
    var old=toolbar.querySelector('[data-favorite-player]');
    if(!old)toolbar.insertAdjacentHTML('beforeend',button(name,'favorite-profile-button'));
    syncButtons();
  }
  function dateLabel(value){return String(value||'').replace(/-/g,'/');}
  function hitPlayer(player,count){
    var name=player.name;
    return '<article class="quickfind-result-card quickfind-person"><div class="quickfind-result-copy">'+
      '<span class="quickfind-type">選手</span><h3><a href="'+esc(bridge.profileHref(name))+
      '" data-open-profile="'+esc(name)+'">'+esc(name)+'</a></h3><p>掲載戦績の一致 '+count+'件 · プロフィールを開く →</p></div>'+
      button(name,'favorite-result-button')+'</article>';
  }
  function hitTournament(entry){
    return '<article class="quickfind-result-card"><span class="quickfind-type">大会</span>'+
      '<h3><a href="'+esc(bridge.tournamentHref(entry.id))+'" data-open-tournament="'+esc(entry.id)+'">'+
      esc(entry.name)+'</a></h3><p>'+esc(dateLabel(entry.date))+' · '+esc(entry.region)+
      ' · 条件に一致 '+entry.count+'戦績</p></article>';
  }
  function hitRecord(row,t){
    var names=[...new Set(core.members(row))];
    var people=names.map(function(name){return '<a href="'+esc(bridge.profileHref(name))+
      '" data-open-profile="'+esc(name)+'">'+esc(name)+'</a>';}).join(' / ');
    return '<article class="quickfind-result-card"><span class="quickfind-type">戦績</span>'+
      '<p>'+esc(dateLabel(row.date))+' · '+esc(row.region)+' · '+esc(row.kind||'')+'</p>'+
      '<h3><a href="'+esc(bridge.tournamentHref(t.id))+'" data-open-tournament="'+esc(t.id)+'">'+
      esc(t.name||row.event||'大会')+'</a></h3><p class="quickfind-record-players">'+people+
      ' · '+(Number.isInteger(row.rank)?'#'+row.rank:'順位未確認')+'</p></article>';
  }
  function group(heading,count,html,empty){
    return '<section class="quickfind-result-group"><div class="quickfind-row-heading"><h2>'+heading+
      ' <span>'+count+'件</span></h2></div><div class="quickfind-result-grid">'+
      (html||'<p class="quickfind-no-match">'+empty+'</p>')+'</div></section>';
  }
  function renderSearch(){
    if(!bridge)return;
    var input=$('#quickfind-query'),host=$('#quickfind-results');
    if(!input||!host)return;
    favoritesMarkup();
    var q=input.value.trim().slice(0,160),date=$('#quickfind-date').value,region=$('#quickfind-region').value;
    $('#quickfind-period').textContent=bridge.seasonLabel()+'の掲載記録を検索中';
    if(!q&&!date&&(region==='all'||!region)){
      var counts=$('#quickfind-counts');if(counts)counts.textContent='';
      host.innerHTML='<div class="quickfind-prompt"><h2>大会も選手も、ここから一度に探せるよ</h2>'+
        '<p>名前・大会名・開催日・地域を組み合わせて入力。例： <button type="button" data-quick-example="ME 2026/09/22">ME 2026/09/22</button> '+
        '<button type="button" data-quick-example="Victory Cup">Victory Cup</button></p>'+
        '<p>過去シーズンも探すときは、上の「集計期間」を全期間に切り替えてね</p>'+
        '<div class="quickfind-shortcuts"><button type="button" data-page="players">選手名鑑へ →</button>'+
        '<button type="button" data-page="tournaments">大会を探す →</button></div></div>';
      return;
    }
    var roster=bridge.players(),aliases=bridge.aliases(),byName=new Map(roster.map(function(p){return [p.name,p];}));
    var options={q:q,date:date||'',region:region||'all'};
    var found=[],tournaments=new Map();
    for(var row of bridge.rows()){
      var t=bridge.tournament(row);
      if(!core.matchRecord(row,options,{tournament:t,aliases:aliases}))continue;
      found.push({row:row,tournament:t});
      if(!tournaments.has(t.id))tournaments.set(t.id,{id:t.id,name:t.name||row.event,count:0,date:row.date,region:row.region});
      var item=tournaments.get(t.id);
      item.count++;
      if(row.date>item.date){item.date=row.date;item.region=row.region;}
    }
    found.sort(function(a,b){return b.row.date.localeCompare(a.row.date)||(a.row.rank||Infinity)-(b.row.rank||Infinity);});
    var ranked=core.matchingPlayers(found.map(function(item){return item.row;}),roster,favorites,12);
    // Also match registry names even when there is no result this season.
    if(q&&!date&&(region==='all'||!region)){
      var needle=core.text(q);
      roster.forEach(function(p){
        if(ranked.some(function(x){return x.name===p.name;}))return;
        if([p.name].concat(Array.isArray(aliases[p.name])?aliases[p.name]:[]).some(function(n){return core.text(n).includes(needle);}))
          ranked.push({name:p.name,records:0,favorite:has(p.name)});
      });
    }
    ranked.sort(function(a,b){return Number(b.favorite)-Number(a.favorite)||b.records-a.records||a.name.localeCompare(b.name,'ja');});
    var tournamentHits=[...tournaments.values()].sort(function(a,b){return b.date.localeCompare(a.date)||b.count-a.count;});
    var notice=$('#quickfind-counts');
    if(notice)notice.textContent=ranked.length+'選手 · '+tournamentHits.length+'大会 · '+found.length+'戦績';
    host.innerHTML=group('選手',ranked.length,ranked.slice(0,10).map(function(x){
      return hitPlayer(byName.get(x.name)||{name:x.name},x.records);
    }).join(''),'一致する選手は見つからなかったよ')+
      group('大会',tournamentHits.length,tournamentHits.slice(0,12).map(hitTournament).join(''),'一致する大会は見つからなかったよ')+
      group('遠征戦績',found.length,found.slice(0,12).map(function(x){return hitRecord(x.row,x.tournament);}).join(''),'一致する戦績は見つからなかったよ')+
      (found.length>12?'<p class="quickfind-overflow">表示は最新12件まで。詳しくは「遠征結果」の検索から確認できるよ</p>':'');
    syncButtons();
  }
  function updateFavorites(name){
    var result=core.toggleFavorite(favorites,name,known());
    if(result.limit){var status=$('#quickfind-save-status');if(status)status.textContent='お気に入りは最大'+core.MAX_FAVORITES+'名まで登録できるよ';return;}
    if(!result.changed)return;
    favorites=result.items;revision++;
    var status=$('#quickfind-save-status');if(status)status.textContent='';
    core.saveFavorites(safeStorage(),favorites,known());
    syncButtons();
    favoritesMarkup();
    if(bridge.onFavoritesChanged)bridge.onFavoritesChanged();
    if($('#page-search')?.classList.contains('active'))renderSearch();
  }
  function bind(adapter){
    bridge=adapter;
    favorites=core.readFavorites(safeStorage(),known());
    $('#quickfind-query')?.addEventListener('input',function(){
      root.clearTimeout(timer);timer=root.setTimeout(renderSearch,110);
    });
    ['#quickfind-date','#quickfind-region'].forEach(function(id){
      $(id)?.addEventListener('change',renderSearch);
    });
    $('#quickfind-clear')?.addEventListener('click',function(){
      $('#quickfind-query').value='';$('#quickfind-date').value='';$('#quickfind-region').value='all';
      renderSearch();$('#quickfind-query').focus();
    });
    document.addEventListener('click',function(ev){
      var favorite=ev.target.closest('[data-favorite-player]');
      if(favorite){ev.preventDefault();ev.stopPropagation();updateFavorites(favorite.dataset.favoritePlayer);return;}
      var example=ev.target.closest('[data-quick-example]');
      if(example){ev.preventDefault();$('#quickfind-query').value=example.dataset.quickExample;renderSearch();$('#quickfind-query').focus();}
    },true);
  }
  root.AOTQuickFind=Object.freeze({bind:bind,renderSearch:renderSearch,decoratePlayers:decoratePlayers,
    decorateProfile:decorateProfile,isFavorite:has,version:function(){return revision;}});
})(window);
