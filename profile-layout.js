/* ASIA ON TOUR | Four-section, progressively disclosed player profiles.
 * Pure presentation layer: all results, awards, PR and analysis remain owned
 * by app.js and their existing verified-data modules.
 */
(function (root) {
  'use strict';
  var TABS = [
    { id: 'overview', label: '概要', icon: '◈', desc: '主要記録と注目ポイント' },
    { id: 'season', label: '今季の成績', icon: '▥', desc: '選択中の期間・地域別実績' },
    { id: 'history', label: '海外遠征履歴', icon: '◎', desc: '年表と大会別の全記録' },
    { id: 'analysis', label: '詳細分析', icon: '◇', desc: '称号・成長・プレイスタイル' }
  ];
  var state = { name: null, active: 'overview' };

  function element(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function section(id, title, description) {
    var panel = element('section', 'profile-section-panel');
    panel.id = 'profile-panel-' + id;
    panel.dataset.profilePanel = id;
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('aria-labelledby', 'profile-tab-' + id);
    panel.tabIndex = 0;
    var header = element('header', 'profile-section-heading');
    header.append(element('h2', '', title), element('p', '', description));
    panel.append(header);
    return panel;
  }
  function detailWrap(label, subtitle, child, id) {
    var fold = element('details', 'profile-analysis-fold');
    fold.dataset.analysisFold = id;
    var summary = element('summary', '');
    summary.append(element('strong', '', label), element('span', '', subtitle));
    fold.append(summary, child);
    return fold;
  }
  function quickFact(label, value, note) {
    var card = element('article', 'profile-quick-fact');
    card.append(element('span', 'profile-quick-label', label), element('strong', '', value), element('p', '', note));
    return card;
  }
  function switchTab(host, tabId, focusButton) {
    if (!TABS.some(function (x) { return x.id === tabId; })) return;
    state.active = tabId;
    TABS.forEach(function (item) {
      var btn = host.querySelector('#profile-tab-' + item.id);
      var panel = host.querySelector('#profile-panel-' + item.id);
      if (!btn || !panel) return;
      var current = item.id === tabId;
      btn.setAttribute('aria-selected', String(current));
      btn.tabIndex = current ? 0 : -1;
      panel.hidden = !current;
      if (current && focusButton) btn.focus({ preventScroll: true });
    });
  }
  function setupInteractions(host) {
    if (host.dataset.profileLayoutWired === 'true') return;
    host.dataset.profileLayoutWired = 'true';
    host.addEventListener('click', function (event) {
      var switcher = event.target.closest('[data-profile-tab], [data-profile-tab-target]');
      if (!switcher || !host.contains(switcher)) return;
      var target = switcher.dataset.profileTab || switcher.dataset.profileTabTarget;
      if (!TABS.some(function (tab) { return tab.id === target; })) return;
      event.preventDefault();
      switchTab(host, target, switcher.hasAttribute('data-profile-tab'));
      if (switcher.hasAttribute('data-profile-tab-target')) {
        host.querySelector('#profile-section-nav').scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
    host.addEventListener('keydown', function (event) {
      var current = event.target.closest('[data-profile-tab]');
      if (!current || !host.contains(current)) return;
      var index = TABS.findIndex(function (tab) { return tab.id === current.dataset.profileTab; });
      var next = index;
      if (event.key === 'ArrowRight') next = (index + 1) % TABS.length;
      else if (event.key === 'ArrowLeft') next = (index + TABS.length - 1) % TABS.length;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = TABS.length - 1;
      else return;
      event.preventDefault();
      switchTab(host, TABS[next].id, true);
    });
  }
  // The existing app.js delegated actions run in bubble phase. Reveal their
  // destination before they focus/scroll it; don't replace their actual action.
  document.addEventListener('click', function (event) {
    var host = document.getElementById('profile-content');
    if (!host || !host.contains(event.target) || !host.querySelector('#profile-section-nav')) return;
    if (event.target.closest('[data-style-jump]')) {
      switchTab(host, 'analysis', false);
      return;
    }
    if (event.target.closest('[data-style-growth-jump]')) {
      switchTab(host, 'analysis', false);
      var growth = host.querySelector('[data-analysis-fold="growth"]');
      if (growth) growth.open = true;
      return;
    }
    if (event.target.closest('[data-journey-jump], [data-journey-history]')) {
      switchTab(host, 'history', false);
      if (event.target.closest('[data-journey-history]')) {
        var records = host.querySelector('.profile-records-fold');
        if (records) records.open = true;
      }
    }
  }, true);

  function mount(name, periodLabel) {
    var host = document.getElementById('profile-content');
    if (!host) return false;
    var hero = host.querySelector(':scope > .profile-hero');
    var stats = host.querySelector(':scope > .profile-stats');
    if (!hero || !stats) return false;
    var samePlayer = state.name === name;
    if (!samePlayer) state.active = 'overview';
    state.name = name;
    var awards = host.querySelector('#profile-achievements');
    var growth = host.querySelector('#profile-growth');
    var style = host.querySelector('#profile-style');
    var snapshot = host.querySelector('.profile-snapshot');
    var journey = host.querySelector('#profile-journey');
    var regionsTitle = host.querySelector('#profile-region-title');
    var historyTitle = host.querySelector('#profile-history-title');
    var regions = regionsTitle && regionsTitle.closest('section');
    var history = historyTitle && historyTitle.closest('section');
    var pr = host.querySelector('.aot-pr-profile');
    var participation = host.querySelector('#participation-profile');
    if (!awards || !growth || !style || !snapshot || !journey || !regions || !history) return false;

    var regionNames = Array.prototype.map.call(
      regions.querySelectorAll('.profile-regions-visited .pill'),
      function (pill) { return pill.textContent.replace(/^[^\wA-Z]+/, '').trim(); }
    ).filter(Boolean);
    var featured = awards.querySelector('[data-achievement-title]');
    var featuredName = featured && featured.textContent.trim() || '挑戦中';
    var nav = element('nav', 'profile-section-nav');
    nav.id = 'profile-section-nav';
    nav.setAttribute('aria-label', '選手プロフィールの表示切替');
    var tabList = element('div', 'profile-section-tabs');
    tabList.setAttribute('role', 'tablist');
    tabList.setAttribute('aria-label', 'プロフィールの4つのセクション');
    TABS.forEach(function (tab) {
      var btn = element('button', 'profile-section-tab');
      btn.type = 'button';
      btn.id = 'profile-tab-' + tab.id;
      btn.dataset.profileTab = tab.id;
      btn.setAttribute('role', 'tab');
      btn.setAttribute('aria-controls', 'profile-panel-' + tab.id);
      btn.append(element('span', 'profile-tab-icon', tab.icon), element('span', 'profile-tab-label', tab.label));
      tabList.append(btn);
    });
    nav.append(tabList);

    var overview = section('overview', '選手概要', 'まずは確認済みの主要記録をチェック');
    overview.append(stats);
    var facts = element('div', 'profile-quick-facts');
    facts.append(
      quickFact('代表称号', featuredName, '全期間の獲得済み実績から表示'),
      quickFact('遠征先', regionNames.length ? regionNames.join(' · ') : '未登録', '選択中の期間に戦績が掲載された地域')
    );
    overview.append(facts);
    var shortcuts = element('div', 'profile-section-shortcuts');
    [['season', '今季の成績を詳しく見る'], ['history', '海外遠征の記録を見る'], ['analysis', '称号と分析を見る']].forEach(function (entry) {
      var btn = element('button', 'profile-shortcut', entry[1] + ' →');
      btn.type = 'button';
      btn.dataset.profileTabTarget = entry[0];
      shortcuts.append(btn);
    });
    overview.append(shortcuts);
    overview.append(element('p', 'profile-section-note', '※ 金額・順位は確認済み掲載記録に基づく値です。チーム戦のキルやVRを個人の記録とはみなしません。'));

    var season = section('season', '今季の成績', (periodLabel || '選択中の期間') + ' · 登録済みの海外戦績から集計');
    season.append(snapshot, regions);
    if (pr) season.append(pr);

    var historyPanel = section('history', '海外遠征履歴', (periodLabel || '選択中の期間') + ' · 年表から大会別の記録まで');
    historyPanel.append(journey);
    var list = history.querySelector('.profile-history');
    if (list) {
      var allDetails = element('details', 'profile-records-fold');
      var count = history.querySelector('.profile-history-count');
      var summary = element('summary', '', '大会別の全成績を開く（' + (count ? count.textContent.trim() : '掲載分') + '）');
      allDetails.append(summary);
      list.replaceWith(allDetails);
      allDetails.append(list);
    }
    historyPanel.append(history);
    if (participation) historyPanel.append(participation);

    var analysis = section('analysis', '詳細分析', '詳しく知りたい情報だけを開いて確認');
    analysis.append(
      detailWrap('🏅 称号と実績バッジ', '進化バッジ・特別称号・達成条件', awards, 'awards'),
      detailWrap('📈 成長グラフ', '月別・シーズン別の推移', growth, 'growth'),
      style
    );

    host.append(nav, overview, season, historyPanel, analysis);
    setupInteractions(host);
    switchTab(host, samePlayer ? state.active : 'overview', false);
    return true;
  }
  root.AsiaProfileLayout = Object.freeze({ mount: mount });
})(typeof window !== 'undefined' ? window : this);
