const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const { loadData, summarize, seasonFor, tournamentFor, tournamentKey } = require('../scripts/data-checks.cjs');
const data = loadData(path.join(__dirname, '..')).data;
const records = data.results;
// The real asynchronous loader is exercised by Playwright. The DOM harness
// substitutes only its input data so these exhaustive rendering tests stay fast.
const script = (() => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  const start = source.indexOf('    // CH7S4');
  const end = source.lastIndexOf('  })().catch');
  assert.ok(start >= 0 && end > start, 'Application bootstrap boundary changed');
  let body = source.slice(start, end);
  const literal = value => JSON.stringify(value).replace(/\]$/, '\n    ]');
  for (const [name, reference, value] of [
    ['builtIn', 'siteData.results', records], ['candidates', 'siteData.players.candidates', data.players.candidates],
    ['tournamentAxes', 'siteData.tournaments.axes', data.tournaments.axes], ['tournamentCatalog', 'siteData.tournaments.catalog', data.tournaments.catalog],
    ['confirmedAliases', 'siteData.players.confirmedAliases', data.players.confirmedAliases]
  ]) body = body.replace('const ' + name + '=' + reference + ';', () => 'const ' + name + '=' + (Array.isArray(value) ? literal(value) : JSON.stringify(value)) + ';');
  return '(() => {\n' + body + '\n})();';
})();
const sampleRecord = { id:'unit-fixture', date:'2026-09-01', region:'ME', player:'Fixture', playerRaw:'Fixture', event:'Solo Victory Cup Battle Royale', round:'Event 1 · Round 2 / 賞金決勝', rank:17, points:100, kills:2, vrs:1, prize:100, kind:'賞金決勝', source:'https://fortnitetracker.com/events/epicgames_S42_SoloVictoryCup_ME', verified:true, note:'単体テスト専用データ' };
const decode = value => value.replace(/&(amp|lt|gt|quot|#39);/g,
  (_, entity) => ({ amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'" }[entity]));
const plain = value => decode(value.replace(/<[^>]*>/g, ''));

class Element {
  constructor(tag, attributes = '') {
    this.tagName = tag;
    this.attributes = Object.fromEntries([...attributes.matchAll(/([\w-]+)(?:="([^"]*)")?/g)]
      .map(([, name, value]) => [name, decode(value || '')]));
    this.id = this.attributes.id;
    this.dataset = Object.fromEntries(Object.entries(this.attributes)
      .filter(([name]) => name.startsWith('data-'))
      .map(([name, value]) => [name.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase()), value]));
    const classes = new Set((this.attributes.class || '').split(/\s+/));
    this.classList = {
      contains: name => classes.has(name),
      toggle: (name, force) => {
        const enabled = force === undefined ? !classes.has(name) : force;
        if (enabled) classes.add(name); else classes.delete(name);
        return enabled;
      }
    };
    this.value = this.attributes.value || '';
    this.checked = Object.hasOwn(this.attributes, 'checked');
    this.innerHTML = '';
    this.textContent = '';
    this.events = new Map();
  }
  addEventListener(type, callback) {
    this.events.set(type, [...(this.events.get(type) || []), callback]);
  }
  dispatch(type, target = this, details = {}) {
    const event = { target, button: 0, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false,
      defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, ...details };
    for (const callback of this.events.get(type) || []) callback(event);
  }
  setAttribute(name, value) { this.attributes[name] = value; }
  set innerHTML(value) { this.markup = value; this.onHTML?.(value); }
  get innerHTML() { return this.markup; }
  closest(selector) {
    const attribute = selector.match(/^\[([\w-]+)\]$/)?.[1];
    return attribute && Object.hasOwn(this.attributes, attribute) ? this : this.parent?.closest(selector) || null;
  }
}

// Only the DOM operations used by this static site are emulated. Missing IDs
// return null, so stale handlers for removed form elements fail at startup.
function boot(source = script, { hash = '', search = '?season=all' } = {}) {
  const elements = [...html.matchAll(/<([\w-]+)\b([^>]*)>/g)]
    .map(([, tag, attributes]) => new Element(tag, attributes));
  const ids = new Map(elements.filter(element => element.id).map(element => [element.id, element]));
  const initialiseSelects = markup => {
    for (const [, attributes, content] of markup.matchAll(/<select\b([^>]*)>([\s\S]*?)<\/select>/g)) {
      const id = attributes.match(/id="([^"]+)"/)?.[1];
      const options = [...content.matchAll(/<option\b([^>]*)>([\s\S]*?)<\/option>/g)];
      const selected = options.find(([, attributes]) => /\bselected\b/.test(attributes)) || options[0];
      if (id && selected) ids.get(id).value = selected[1].match(/value="([^"]*)"/)?.[1] ?? plain(selected[2]);
    }
  };
  // Tournament search controls are a rendered view, so newly inserted elements
  // become queryable just as they do in the browser.
  const registerMarkup = markup => {
    for (const [, tag, attributes] of markup.matchAll(/<([\w-]+)\b([^>]*)>/g)) {
      const element = new Element(tag, attributes);
      if (element.id) { element.onHTML = registerMarkup; ids.set(element.id, element); }
    }
    initialiseSelects(markup);
  };
  for (const element of elements) element.onHTML = registerMarkup;
  initialiseSelects(html);
  const navSource = html.match(/<nav\b[^>]*>([\s\S]*?)<\/nav>/)[1];
  const nav = [...navSource.matchAll(/<button\b([^>]*)>/g)]
    .map(([, attributes]) => new Element('button', attributes));
  const sections = elements.filter(element => element.classList.contains('section'));
  const document = new Element('document');
  document.querySelector = selector => {
    assert.ok(selector.startsWith('#'), `Unsupported selector ${selector}`);
    return ids.get(selector.slice(1)) || null;
  };
  document.querySelectorAll = selector => {
    if (selector === '.section') return sections;
    if (selector === '.nav button') return nav;
    throw new Error(`Unsupported selector ${selector}`);
  };
  const blobs = new Map();
  const downloads = [];
  const revoked = [];
  const scrolls = [];
  document.body = { append() {} };
  document.createElement = tag => {
    assert.equal(tag, 'a');
    return { click() { downloads.push({ name: this.download, blob: blobs.get(this.href) }); }, remove() {} };
  };
  class BrowserURL extends URL {}
  BrowserURL.createObjectURL = blob => { const url = `blob:${blobs.size}`; blobs.set(url, blob); return url; };
  BrowserURL.revokeObjectURL = url => revoked.push(url);
  const window = new Element('window');
  let location = new BrowserURL(`https://takezion62-hash.github.io/asia-on-tour/${search}${hash}`);
  const historyEntries = [{ url: location.href, state: null }];
  let historyIndex = 0;
  window.scrollY = 0;
  window.scrollTo = options => { scrolls.push(options); window.scrollY = options.top; };
  Object.defineProperty(window, 'location', { get: () => location });
  window.history = {
    get state() { return historyEntries[historyIndex].state; },
    get length() { return historyEntries.length; },
    pushState(state, unused, url) {
      location = new BrowserURL(url, location.href);
      historyEntries.splice(historyIndex + 1, Infinity, { url: location.href, state });
      historyIndex++;
    },
    replaceState(state, unused, url) {
      location = new BrowserURL(url, location.href);
      historyEntries[historyIndex] = { url: location.href, state };
    },
    back() {
      if (historyIndex === 0) return;
      const previous = location.href;
      historyIndex--;
      location = new BrowserURL(historyEntries[historyIndex].url);
      window.dispatch('popstate', window, { state: historyEntries[historyIndex].state });
      if (new BrowserURL(previous).hash !== location.hash) window.dispatch('hashchange', window, { oldURL: previous, newURL: location.href });
    }
  };
  const sandbox = {
    document, window,
    URL: BrowserURL, URLSearchParams, Blob, setTimeout: callback => { callback(); return 1; }
  };
  Object.defineProperty(sandbox, 'location', { get: () => location });
  sandbox.history = window.history;
  let storageAccesses = 0;
  Object.defineProperty(sandbox, 'localStorage', { get() { storageAccesses++; throw new Error('Storage is unavailable'); } });
  for (const name of ['sessionStorage', 'indexedDB', 'FileReader', 'FormData', 'confirm']) {
    Object.defineProperty(sandbox, name, { get() { throw new Error(`Unexpected write feature: ${name}`); } });
  }
  vm.runInNewContext(source, sandbox, { filename: 'index.html', timeout: 5000 });
  const get = id => { assert.ok(ids.has(id), `Missing element ${id}`); return ids.get(id); };
  const click = element => {
    element.dispatch('click');
    const child = new Element('span'); child.parent = element;
    document.dispatch('click', child);
  };
  return {
    get, nav, sections, scrolls, downloads, revoked, window,
    storageAccesses: () => storageAccesses,
    set(id, value, type = 'input') {
      const element = get(id);
      if (typeof value === 'boolean') element.checked = value; else element.value = value;
      element.dispatch(type);
      document.dispatch(type, element);
    },
    click,
    navigate(page) { click(nav.find(element => element.dataset.page === page)); },
    player(name) { click(new Element('button', `data-player="${name}"`)); },
    profile(name) { click(new Element('a', `data-open-profile="${name}" href="#player=${encodeURIComponent(name)}"`)); },
    profileBack() { click(new Element('button', 'data-profile-back=""')); },
    tournament(id) { click(new Element('a', `data-open-tournament="${id}" href="#tournament=${encodeURIComponent(id)}"`)); },
    tag(axis, value) { click(new Element('a', `data-tournament-tag="${axis}:${value}" href="#tournaments?${axis}=${encodeURIComponent(value)}"`)); },
    tournamentBack() { click(new Element('button', 'data-tournament-back=""')); },
    browserBack() { window.history.back(); },
    hash(value) {
      const oldURL = location.href;
      const next = new BrowserURL(location.href); next.hash = value;
      window.history.pushState(null, '', next.href);
      window.dispatch('hashchange', window, { oldURL, newURL: next.href });
    },
    spotlight() { click(elements.find(element => Object.hasOwn(element.dataset, 'spotlight'))); }
  };
}

function renderedArticles(app) {
  return [...app.get('result-table').innerHTML.matchAll(/<article\b([^>]*)>([\s\S]*?)<\/article>/g)]
    .filter(([, attributes]) => /class="[^"]*\barchive-row\b/.test(attributes))
    .map(([, attributes, content]) => ({
      id: decode(attributes.match(/data-result-id="([^"]+)"/)[1]), content, attributes
    }));
}

// Read a marked value while allowing nested markup of the same tag. These
// assertions inspect the user-facing content, not a duplicate rendering path.
const regexLiteral = value => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function markedContent(content, attribute, name) {
  const start = new RegExp(`<([\\w-]+)\\b[^>]*\\b${regexLiteral(attribute)}="${regexLiteral(name)}"[^>]*>`).exec(content);
  assert.ok(start, `Missing ${attribute}="${name}"`);
  const tag = start[1];
  const position = start.index + start[0].length;
  const tags = new RegExp(`<\\/?${tag}\\b[^>]*>`, 'g');
  tags.lastIndex = position;
  let depth = 1;
  for (let next; (next = tags.exec(content));) {
    depth += next[0].startsWith('</') ? -1 : 1;
    if (!depth) return content.slice(position, next.index);
  }
  assert.fail(`Unclosed ${attribute}="${name}"`);
}
function markedContents(content, attribute, name) {
  return [...content.matchAll(new RegExp(`<([\\w-]+)\\b[^>]*\\b${regexLiteral(attribute)}="${regexLiteral(name)}"[^>]*>`, 'g'))]
    .map(match => markedContent(content.slice(match.index), attribute, name));
}
const field = (content, name) => plain(markedContent(content, 'data-field', name));
const detail = (content, name) => plain(markedContent(content, 'data-detail', name));

function renderedRows(app) {
  return renderedArticles(app).map(({ content }) => [
    field(content, 'date').replaceAll('.', '-'), field(content, 'player'),
    field(content, 'region'), field(content, 'event'), field(content, 'rank')
  ]);
}

const key = record => [record.date, record.player, record.region, record.event,
  Number.isInteger(record.rank) ? `#${record.rank.toLocaleString('ja-JP')}` : record.reported ? '確認中' : '通過'];
const newest = rows => rows.slice().sort((a, b) => b.date.localeCompare(a.date));
const roster = record => record.players?.length ? record.players : [record.player];
const publishedPlayers = [...new Set(records.flatMap(roster))];
const personalCash = record => {
  if (record.verified !== true || !Number.isFinite(record.prize) || record.prize <= 0) return 0;
  if (roster(record).length === 1) return record.prize;
  const share = record.prizePerPlayer;
  return Number.isFinite(share) && share > 0 && share * roster(record).length <= record.prize + 0.001 ? share : 0;
};
const playerResults = name => newest(records.filter(record => roster(record).includes(name)));
const expectedPlayerCash = name => currency(playerResults(name).reduce((sum, row) => sum + personalCash(row), 0));
const currency = value => '$' + value.toLocaleString('ja-JP');
const profileField = (app, name) => plain(markedContent(app.get('profile-content').innerHTML, 'data-profile', name));
const profileCount = (app, name) => Number(profileField(app, name).replace(/[^\d]/g, ''));
function profileHistory(app) {
  return [...app.get('profile-content').innerHTML.matchAll(/<article\b([^>]*)>([\s\S]*?)<\/article>/g)]
    .filter(([, attributes]) => /class="[^"]*\bprofile-history-row\b/.test(attributes))
    .map(([, attributes, content]) => ({
      id: decode(attributes.match(/data-result-id="([^"]+)"/)[1]), attributes, content
    }));
}
function profileLinks(markup) {
  return [...markup.matchAll(/<a\b([^>]*)>/g)]
    .filter(([, attributes]) => /data-open-profile="/.test(attributes))
    .map(([, attributes]) => ({
      name: decode(attributes.match(/data-open-profile="([^"]+)"/)[1]),
      href: decode(attributes.match(/href="([^"]+)"/)[1])
    }));
}
function assertRows(app, expected) {
  assert.deepEqual(renderedRows(app), expected.map(key));
  assert.equal(String(app.get('result-count').textContent), `${expected.length}件`);
}

test('entry, import, and delete controls are absent; only browse inputs remain', () => {
  const markup = html.slice(0, html.indexOf('<script>'));
  assert.doesNotMatch(markup, /<form\b|data-add\b|data-delete\b|type="(?:file|submit)"|id="(?:entry-form|modal-backdrop|import-button|import-file|export-json)"/);
  assert.deepEqual([...markup.matchAll(/<input\b[^>]*type="([^"]+)"/g)].map(match => match[1]).sort(),
    ['checkbox', 'search', 'search']);
  assert.match(markup, /閲覧専用/);
});

test('startup renders published data when browser storage is inaccessible', () => {
  const app = boot();
  assert.ok(records.length > 0);
  assert.equal(Number(app.get('stat-results').textContent), records.length);
  assertRows(app, newest(records));
  assert.equal(app.storageAccesses(), 0);
  assert.doesNotMatch(app.get('result-table').innerHTML, /data-delete|自分で追加/);
  assert.match(app.get('latest-results').innerHTML, /result-card/);
  assert.match(app.get('home-earnings-leaders').innerHTML, /data-open-profile=/);
});

test('the compact archive preserves every published record, player and verified individual payout', () => {
  const app = boot();
  // The tournament catalog adds metadata beside the published records. This
  // baseline covers every record field, including identity, source and shares.
  assert.ok(records.length > 0, 'Published records are present');
  assert.equal(new Set(records.flatMap(record => record.players || [record.player])).size, publishedPlayers.length);
  assert.equal(Number(app.get('stat-players').textContent), publishedPlayers.length);
  assert.equal(app.get('home-earnings-sum').textContent, currency(summarize(data).total));
  assert.equal(app.get('player-earnings-sum').textContent, currency(summarize(data).total));
  const articles = renderedArticles(app);
  assert.equal(articles.length, records.length);
  assert.equal(new Set(articles.map(article => article.id)).size, records.length);
  const byId = new Map(records.map(record => [record.id, record]));
  for (const { id, content } of articles) {
    const record = byId.get(id);
    assert.ok(record, `Unexpected result ${id}`);
    for (const [name, value] of [['kills', record.kills], ['vrs', record.vrs]]) {
      assert.equal(field(content, name), typeof value === 'number' ? value.toLocaleString('ja-JP') : '—');
    }
    // Cash is highlighted by the row and amount, without repeating the old
    // trophy badge under the name, stage and amount on every record.
    assert.doesNotMatch(content, /class="win-badge\b/);
    const overview = content.slice(0, content.indexOf('<details'));
    assert.ok((plain(overview).match(/賞金獲得/g) || []).length <= 1);
  }
  assert.doesNotMatch(app.get('result-table').innerHTML, /<table\b|<thead\b|<tbody\b/);
});

test('every result has a native disclosure retaining points, round, display names, evidence and profiles', () => {
  const app = boot();
  const byId = new Map(records.map(record => [record.id, record]));
  for (const { id, content } of renderedArticles(app)) {
    const record = byId.get(id);
    assert.equal((content.match(/<details\b/g) || []).length, 1, id);
    assert.match(content, /<details\b[^>]*class="result-details"/);
    assert.match(content, /<summary\b[^>]*>[\s\S]*?詳細を見る[\s\S]*?<\/summary>/);
    assert.doesNotMatch(content, /<details\b[^>]*\bopen(?:\s|>)/);
    assert.equal(detail(content, 'points'), typeof record.points === 'number' ? record.points.toLocaleString('ja-JP') : '—', id);
    assert.equal(detail(content, 'round'), record.round, id);
    assert.equal(detail(content, 'playerRaw'), record.playerRaw || record.player, id);
    assert.equal(detail(content, 'note'), record.note, id);
    const expectedLinks = [record.source, record.profileUrl, ...(record.profiles || []).map(profile => profile.url)]
      .filter(Boolean).map(url => new URL(url).href);
    const links = [...content.matchAll(/<a\b([^>]*)>/g)]
      .filter(([, attributes]) => /href="https?:/.test(attributes)).map(([, attributes]) => {
      assert.match(attributes, /target="_blank"/);
      assert.match(attributes, /rel="noopener noreferrer"/);
      const url = decode(attributes.match(/href="([^"]+)"/)[1]);
      assert.ok(['https:', 'http:'].includes(new URL(url).protocol));
      return url;
    });
    assert.deepEqual(links.sort(), expectedLinks.sort(), id);
    assert.ok(detail(content, 'source').includes(new URL(record.source).href), id);
    for (const profile of record.profiles || []) {
      assert.ok(detail(content, 'profiles').includes(profile.name), id);
      assert.ok(detail(content, 'profiles').includes(new URL(profile.url).href), id);
    }
    if (record.profileUrl) assert.ok(detail(content, 'profiles').includes(new URL(record.profileUrl).href), id);
    if (record.players?.length > 1 && record.prize > 0) {
      const prize = detail(content, 'prize');
      assert.match(prize, /チーム合計/);
      assert.ok(prize.includes(`$${record.prize.toLocaleString('ja-JP')}`), id);
      assert.match(prize, /各選手/);
      assert.ok(prize.includes(`$${record.prizePerPlayer.toLocaleString('ja-JP')}`), id);
    }
    if (record.prize === null) assert.match(detail(content, 'prize'), /未設定/);
    if (record.prize === 0) assert.match(detail(content, 'prize'), /賞金なし/);
  }
});

function fixtureScript(rows) {
  return script.replace(/const builtIn=(\[[\s\S]*?\n    \]);/, () => `const builtIn=${JSON.stringify(rows)};`);
}

test('detail text is escaped and non-web source or profile links are not rendered', () => {
  const unsafe = '\"><img src=x onerror=alert(1)> & <script>alert(1)</script>';
  const url = 'https://example.com/profile?player=%22%3E&mode=events';
  const fixture = {
    ...sampleRecord, id: 'escaped-result', player: unsafe, playerRaw: unsafe,
    event: unsafe, round: unsafe, note: unsafe, points: null,
    source: 'javascript:alert(1)', profileUrl: 'data:text/html,unsafe',
    profiles: [{ name: unsafe, url }, { name: 'unsafe', url: 'javascript:alert(2)' }]
  };
  const app = boot(fixtureScript([fixture]));
  const [{ content }] = renderedArticles(app);
  for (const name of ['player', 'event']) assert.equal(field(content, name), unsafe);
  for (const name of ['playerRaw', 'round', 'note']) assert.equal(detail(content, name), unsafe);
  assert.equal(detail(content, 'points'), '—');
  assert.doesNotMatch(content, /<img\b|<script\b|href="(?:javascript|data):/);
  assert.match(content, /&lt;img/);
  const links = [...content.matchAll(/<a\b([^>]*)>/g)]
    .filter(([, attributes]) => /href="https?:/.test(attributes))
    .map(([, attributes]) => decode(attributes.match(/href="([^"]+)"/)[1]));
  assert.deepEqual(links, [url]);
  assert.ok(detail(content, 'profiles').includes(unsafe));
  const profileApp = boot(fixtureScript([fixture]), { hash: `#player=${encodeURIComponent(unsafe)}` });
  const profileMarkup = profileApp.get('profile-content').innerHTML;
  assert.doesNotMatch(profileMarkup, /<img\b|<script\b|href="(?:javascript|data):/);
  assert.match(profileMarkup, /&lt;img/);
  assert.ok(plain(profileMarkup).includes(unsafe));
});

test('unknown duo shares, unverified prizes, zero and unset prizes remain distinct without personal credit', () => {
  const base = { ...sampleRecord, players: ['first', 'second'], player: 'first / second', prizePerPlayer: undefined };
  const fixtures = [
    { ...base, id: 'unknown-duo-share', prize: 400 },
    { ...base, id: 'invalid-duo-share', prize: 400, prizePerPlayer: 300 },
    { ...base, id: 'unverified-cash', prize: 200, verified: false },
    { ...base, id: 'zero-cash', prize: 0 },
    { ...base, id: 'unset-cash', prize: null }
  ];
  const app = boot(fixtureScript(fixtures));
  assert.equal(app.get('home-earnings-sum').textContent, '$0');
  assert.equal(app.get('player-earnings-sum').textContent, '$0');
  const rows = new Map(renderedArticles(app).map(article => [article.id, article.content]));
  for (const id of ['unknown-duo-share', 'invalid-duo-share']) {
    assert.match(field(rows.get(id), 'prize'), /チーム合計/);
    assert.match(detail(rows.get(id), 'prize'), /チーム合計/);
    assert.match(detail(rows.get(id), 'prize'), /\$400/);
    assert.match(detail(rows.get(id), 'prize'), /個人内訳未確認/);
    assert.doesNotMatch(detail(rows.get(id), 'prize'), /各選手/);
  }
  assert.match(detail(rows.get('unverified-cash'), 'prize'), /未確認/);
  assert.match(detail(rows.get('zero-cash'), 'prize'), /賞金なし/);
  assert.match(detail(rows.get('unset-cash'), 'prize'), /未設定/);
});

test('all navigation pages remain usable with accurate active state', () => {
  const app = boot();
  const initialScrolls = app.scrolls.length;
  for (const page of ['results', 'players', 'tournaments', 'about', 'home']) {
    app.navigate(page);
    assert.deepEqual(app.sections.filter(element => element.classList.contains('active')).map(element => element.id), [`page-${page}`]);
    assert.equal(app.nav.find(element => element.dataset.page === page).attributes['aria-current'], 'page');
  }
  assert.equal(app.scrolls.length - initialScrolls, 5);
  assert.equal(app.storageAccesses(), 0);
});

test('result search, region and stage filters compose and empty results give browse guidance', () => {
  const app = boot();
  app.navigate('results');
  app.set('search-results', 'solo');
  app.set('region-filter', 'NAW');
  app.set('stage-filter', '予選');
  const expected = records.filter(record => record.region === 'NAW' && record.kind === '予選' && /solo/i.test(record.event));
  assert.ok(expected.length > 0);
  assertRows(app, newest(expected));
  app.set('search-results', 'no-player-will-match-this-9718');
  assertRows(app, []);
  assert.match(app.get('result-table').innerHTML, /検索条件や絞り込みを変えて/);
  assert.doesNotMatch(app.get('result-table').innerHTML, /登録して|追加して/);
});

test('rank and kill sorting and confirmed-prize filter retain archive results', () => {
  const app = boot();
  app.set('prize-only', true);
  const paid = records.filter(record => record.verified === true && record.prize > 0);
  assert.ok(paid.length > 0 && paid.length < records.length);
  assertRows(app, newest(paid));
  app.set('sort-results', 'rank');
  assertRows(app, paid.slice().sort((a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity) || b.date.localeCompare(a.date)));
  app.set('sort-results', 'kills');
  assertRows(app, paid.slice().sort((a, b) => (b.kills ?? -1) - (a.kills ?? -1)));
  app.set('prize-only', false);
  app.set('sort-results', 'date');
  assertRows(app, newest(records));
});

test('player drilldown includes duo records and typing a new search clears the selection', () => {
  const app = boot();
  const duo = records.find(record => record.players?.includes('meath'));
  assert.ok(duo);
  app.set('region-filter', 'ME');
  app.set('stage-filter', '予選');
  app.set('prize-only', true);
  app.player('meath');
  assert.equal(app.get('region-filter').value, 'all');
  assert.equal(app.get('stage-filter').value, 'all');
  assert.equal(app.get('prize-only').checked, false);
  assertRows(app, newest(records.filter(record => (record.players || [record.player]).includes('meath'))));
  app.set('search-results', '');
  assertRows(app, newest(records));
  app.set('search-players', 'meath');
  const playerNames = [...new Set([...app.get('all-players').innerHTML.matchAll(/data-open-profile="([^"]+)"/g)].map(match => decode(match[1])))];
  assert.deepEqual(playerNames, ['meath']);
  app.set('player-sort', 'name', 'change');
  assert.match(app.get('all-players').innerHTML, /data-open-profile="meath"/);
});

test('spotlight opens its region and player result view', () => {
  const app = boot();
  app.spotlight();
  assert.equal(app.get('search-results').value, 'Karf');
  assert.equal(app.get('region-filter').value, 'ME');
  assertRows(app, newest(records.filter(record => record.region === 'ME' && record.player.includes('Karf'))));
});

function parseCSV(text) {
  const rows = []; let row = []; let cell = ''; let quoted = false;
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (char === '"') {
      if (quoted && text[index + 1] === '"') { cell += '"'; index++; }
      else quoted = !quoted;
    } else if (!quoted && (char === ',' || char === '\n')) {
      row.push(cell.replace(/\r$/, '')); cell = '';
      if (char === '\n') { rows.push(row); row = []; }
    } else cell += char;
  }
  row.push(cell); rows.push(row);
  return rows;
}

test('CSV downloads only filtered published records with duo shares and sources', async () => {
  const app = boot();
  app.player('meath');
  app.set('prize-only', true);
  const expected = newest(records.filter(record => (record.players || [record.player]).includes('meath') && record.verified === true && record.prize > 0));
  assert.ok(expected.length > 0);
  app.click(app.get('export-csv'));
  assert.equal(app.downloads.length, 1);
  assert.equal(app.downloads[0].name, 'asia-on-tour-results.csv');
  assert.equal(app.downloads[0].blob.type, 'text/csv;charset=utf-8');
  const [headers, ...rows] = parseCSV(await app.downloads[0].blob.text());
  const exported = rows.map(row => Object.fromEntries(headers.map((name, index) => [name, row[index]])));
  assert.equal(exported.length, expected.length);
  assert.deepEqual(exported.map(row => row.player), expected.map(row => row.player));
  assert.deepEqual(exported.map(row => Number(row.prize)), expected.map(row => row.prize));
  assert.deepEqual(exported.map(row => Number(row.prizePerPlayer)), expected.map(row => row.prizePerPlayer || 0));
  assert.deepEqual(exported.map(row => row.source), expected.map(row => row.source));
  assert.ok(exported.every(row => row.verified === 'true'));
  assert.equal(app.revoked.length, 1);
  assert.equal(app.storageAccesses(), 0);
});

test('every published player profile preserves its complete history and only verified personal cash', () => {
  const app = boot();
  let total = 0;
  for (const name of publishedPlayers) {
    app.profile(name);
    const expected = playerResults(name);
    const cash = expected.reduce((sum, record) => sum + personalCash(record), 0);
    assert.deepEqual(app.sections.filter(element => element.classList.contains('active')).map(element => element.id), ['page-profile'], name);
    assert.equal(app.window.location.hash, `#player=${encodeURIComponent(name)}`, name);
    assert.equal(profileField(app, 'total'), currency(cash), name);
    assert.equal(profileCount(app, 'events'), expected.length, name);
    assert.equal(profileCount(app, 'prize-events'), expected.filter(record => personalCash(record) > 0).length, name);
    assert.deepEqual(profileHistory(app).map(record => record.id), expected.map(record => record.id), name);
    total += cash;
    for (const region of ['ME', 'EU', 'NAC', 'NAW', 'OCE', 'BR']) {
      const rows = markedContents(app.get('profile-content').innerHTML, 'data-profile-region', region);
      const countMarkup = rows.find(markup => /data-region-stat="count"/.test(markup));
      const prizeMarkup = rows.find(markup => /data-region-stat="prize"/.test(markup));
      assert.ok(countMarkup && prizeMarkup, `${name}: ${region} count and prize charts`);
      const regional = expected.filter(record => record.region === region);
      assert.equal(Number(plain(markedContent(countMarkup, 'data-region-stat', 'count')).replace(/[^\d]/g, '')), regional.length, `${name}: ${region}`);
      assert.equal(plain(markedContent(prizeMarkup, 'data-region-stat', 'prize')), currency(regional.reduce((sum, record) => sum + personalCash(record), 0)), `${name}: ${region}`);
    }
  }
  assert.equal(total, summarize(data).total);
  assert.equal(app.get('stat-results').textContent, records.length);
  assert.equal(app.get('home-earnings-sum').textContent, currency(summarize(data).total));
  assert.equal(app.get('player-earnings-sum').textContent, currency(summarize(data).total));
});

test('repeat winners retain exact cumulative totals and qualification or cosmetic rewards add no cash', () => {
  const app = boot();
  for (const name of ['Shiroka', 'miru', 'でーもんくらげǃ', 'meath']) {
    const rows = playerResults(name), total = rows.reduce((sum, row) => sum + personalCash(row), 0), count = rows.length, paid = rows.filter(row => personalCash(row) > 0).length;
    app.profile(name);
    assert.equal(profileField(app, 'total'), currency(total), name);
    assert.equal(profileCount(app, 'events'), count, name);
    assert.equal(profileCount(app, 'prize-events'), paid, name);
  }
  const qualifier = { ...sampleRecord, id:'unit-qualifier', player:'Qualifying Fixture', playerRaw:'Qualifying Fixture', kind:'予選', vrs:9, prize:null };
  const qualifyingApp = boot(fixtureScript([qualifier]));
  qualifyingApp.profile(qualifier.player);
  assert.equal(profileField(qualifyingApp, 'total'), '$0');
  assert.equal(profileCount(qualifyingApp, 'prize-events'), 0);
});

test('profile histories retain all result metrics, evidence and clickable duo partners with personal prize amounts', () => {
  const app = boot();
  for (const name of publishedPlayers) {
    app.profile(name);
    const rows = profileHistory(app);
    for (const { id, attributes, content } of rows) {
      const record = records.find(result => result.id === id);
      for (const metric of ['points', 'kills', 'vrs']) {
        assert.equal(plain(markedContent(content, 'data-profile-event', metric)),
          Number.isFinite(record[metric]) ? record[metric].toLocaleString('ja-JP') : '—', `${name}: ${id} ${metric}`);
      }
      assert.equal(plain(markedContent(content, 'data-profile-event', 'rank')), key(record)[4], id);
      const cash = personalCash(record);
      assert.equal(plain(markedContent(content, 'data-profile-event', 'prize')), cash > 0 ? currency(cash) : record.prize === 0 ? '$0' : '—', id);
      assert.equal(/\bis-prize-win\b/.test(attributes), cash > 0, id);
      for (const text of [record.event, record.round, record.kind, record.region, record.date.replaceAll('-', '.')]) {
        assert.ok(plain(content).includes(text), `${id}: ${text}`);
      }
      assert.ok([...content.matchAll(/<a\b[^>]*href="([^"]+)"/g)].some(([, href]) => decode(href) === new URL(record.source).href), id);
      for (const partner of roster(record).filter(player => player !== name)) {
        assert.ok(profileLinks(content).some(link => link.name === partner && link.href === `#player=${encodeURIComponent(partner)}`), `${id}: ${partner}`);
        assert.ok(plain(content).includes('相方'), id);
        if (record.prize > 0) {
          assert.ok(plain(content).includes(`チーム合計 ${currency(record.prize)}`), id);
          assert.equal(cash, record.prizePerPlayer, id);
        }
      }
    }
  }
});

test('qualifying and final best placements are labelled and calculated separately', () => {
  const app = boot();
  for (const name of publishedPlayers) {
    app.profile(name);
    const expected = playerResults(name);
    for (const [field, predicate] of [
      ['best-qualifying', record => record.kind === '予選'],
      ['best-final', record => String(record.kind).includes('決勝')]
    ]) {
      const ranks = expected.filter(predicate).map(record => record.rank).filter(Number.isInteger);
      assert.equal(profileField(app, field), ranks.length ? `#${Math.min(...ranks).toLocaleString('ja-JP')}` : '未登録', `${name}: ${field}`);
    }
    const text = plain(app.get('profile-content').innerHTML);
    assert.ok(text.includes('予選の最高順位') && text.includes('決勝の最高順位'), name);
  }
});

test('canonical identities keep p1ng separate from RGN p1ng and retain confirmed miru aliases', () => {
  const app = boot();
  app.profile('p1ng');
  assert.deepEqual(profileHistory(app).map(record => record.id), playerResults('p1ng').map(record => record.id));
  assert.equal(profileField(app, 'total'), expectedPlayerCash('p1ng'));
  const p1ngHash = app.window.location.hash;
  app.profile('RGN p1ng');
  assert.deepEqual(profileHistory(app).map(record => record.id), playerResults('RGN p1ng').map(record => record.id));
  assert.equal(profileField(app, 'total'), expectedPlayerCash('RGN p1ng'));
  assert.notEqual(app.window.location.hash, p1ngHash);
  app.profile('miru');
  assert.match(profileField(app, 'aliases'), /ᵗᶻᵈ 否定から入ります〆/);
  assert.equal(profileField(app, 'total'), expectedPlayerCash('miru'));
  assert.equal(profileHistory(app).length, playerResults('miru').length);
  assert.ok(profileHistory(app).every(({ id }) => records.find(record => record.id === id).player === 'miru'));
});

test('directory, earnings and archive entry links use canonical shareable profile URLs', () => {
  const app = boot();
  const directory = profileLinks(app.get('all-players').innerHTML);
  assert.ok(directory.length >= publishedPlayers.length);
  for (const name of publishedPlayers) assert.ok(directory.some(link => link.name === name), name);
  const sources = ['all-players', 'player-earnings-leaders', 'home-earnings-leaders', 'result-table'];
  for (const id of sources) {
    const links = profileLinks(app.get(id).innerHTML);
    assert.ok(links.length, `Missing profile entry in ${id}`);
    for (const link of links) assert.equal(link.href, `#player=${encodeURIComponent(link.name)}`);
  }
  const articles = renderedArticles(app);
  for (const { id, content } of articles) {
    const record = records.find(result => result.id === id);
    assert.deepEqual([...new Set(profileLinks(content).map(link => link.name))].sort(), [...new Set(roster(record))].sort(), id);
  }
});

test('direct profile URLs and hash changes render without requiring earlier navigation', () => {
  const name = 'でーもんくらげǃ';
  const app = boot(script, { hash: `#player=${encodeURIComponent(name)}` });
  assert.deepEqual(app.sections.filter(element => element.classList.contains('active')).map(element => element.id), ['page-profile']);
  assert.equal(profileField(app, 'total'), expectedPlayerCash(name));
  assert.equal(profileCount(app, 'events'), playerResults(name).length);
  const share = app.get('profile-content').innerHTML.match(/<a\b[^>]*id="profile-share"[^>]*>/)?.[0];
  assert.ok(share, 'Missing share link');
  assert.equal(decode(share.match(/href="([^"]+)"/)[1]), `https://takezion62-hash.github.io/asia-on-tour/${app.window.location.search}#player=${encodeURIComponent(name)}`);
  app.hash('#player=miru');
  assert.equal(profileField(app, 'total'), expectedPlayerCash('miru'));
  assert.equal(profileCount(app, 'events'), playerResults('miru').length);
  app.hash('#players');
  assert.deepEqual(app.sections.filter(element => element.classList.contains('active')).map(element => element.id), ['page-players']);
});

test('profile back controls and browser back restore the original screen and browse filters', () => {
  const app = boot();
  app.navigate('results');
  app.set('search-results', 'solo');
  app.set('region-filter', 'NAW');
  app.set('stage-filter', '予選');
  app.set('sort-results', 'rank');
  const before = renderedRows(app);
  app.window.scrollY = 380;
  app.profile('Shiroka');
  app.profileBack();
  assert.deepEqual(app.sections.filter(element => element.classList.contains('active')).map(element => element.id), ['page-results']);
  assert.equal(app.get('search-results').value, 'solo');
  assert.equal(app.get('region-filter').value, 'NAW');
  assert.equal(app.get('stage-filter').value, '予選');
  assert.equal(app.get('sort-results').value, 'rank');
  assert.deepEqual(renderedRows(app), before);
  assert.equal(app.window.scrollY, 380);
  app.navigate('players');
  app.set('search-players', 'miru');
  app.set('player-sort', 'name', 'change');
  app.profile('miru');
  app.profile('Shiroka');
  app.browserBack();
  assert.equal(app.window.location.hash, '#player=miru');
  app.profileBack();
  assert.deepEqual(app.sections.filter(element => element.classList.contains('active')).map(element => element.id), ['page-players']);
  assert.equal(app.get('search-players').value, 'miru');
  assert.equal(app.get('player-sort').value, 'name');
  assert.deepEqual([...new Set(profileLinks(app.get('all-players').innerHTML).map(link => link.name))], ['miru']);
});

test('unknown and malformed profile URLs show a recoverable view instead of another player', () => {
  for (const hash of ['#player=no-such-player-9718', '#player=%E0%A4%A', '#player=']) {
    const app = boot(script, { hash });
    assert.deepEqual(app.sections.filter(element => element.classList.contains('active')).map(element => element.id), ['page-profile']);
    assert.match(plain(app.get('profile-content').innerHTML), /見つかりません|見つから|確認できません/);
    assert.equal(profileHistory(app).length, 0);
    app.profileBack();
    assert.deepEqual(app.sections.filter(element => element.classList.contains('active')).map(element => element.id), ['page-players']);
  }
});

test('profile totals never credit unconfirmed, missing or excessive duo shares', () => {
  const base = { ...sampleRecord, player: 'first / second', players: ['first', 'second'], prize: 400, verified: true };
  const fixtures = [
    { ...base, id: 'missing-share', prizePerPlayer: undefined },
    { ...base, id: 'excessive-share', prizePerPlayer: 300 },
    { ...base, id: 'unverified-share', prizePerPlayer: 200, verified: false },
    { ...base, id: 'zero-share', prize: 0, prizePerPlayer: 0 },
    { ...base, id: 'valid-share', prizePerPlayer: 200 }
  ];
  const app = boot(fixtureScript(fixtures));
  for (const name of ['first', 'second']) {
    app.profile(name);
    assert.equal(profileField(app, 'total'), '$200');
    assert.equal(profileCount(app, 'events'), 5);
    assert.equal(profileCount(app, 'prize-events'), 1);
    assert.equal(new Set(profileHistory(app).map(({ id }) => id)).size, 5);
  }
  assert.equal(app.get('home-earnings-sum').textContent, '$400');
});

test('the complete individual prize ranking keeps its original order, amounts and paid-record counts', () => {
  const totals = new Map();
  for (const record of records) {
    const amount = personalCash(record);
    if (!amount) continue;
    for (const name of new Set(roster(record))) {
      const current = totals.get(name) || { name, total: 0, events: 0 };
      current.total += amount;
      current.events++;
      totals.set(name, current);
    }
  }
  const expected = [...totals.values()].sort((a, b) => b.total - a.total || b.events - a.events || a.name.localeCompare(b.name, 'ja'));
  assert.equal(expected.reduce((sum, player) => sum + player.total, 0), summarize(data).total);
  const app = boot();
  for (const [id, limit] of [['home-earnings-leaders', 5], ['player-earnings-leaders', expected.length]]) {
    const rows = [...app.get(id).innerHTML.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)]
      .filter(([, attributes]) => /data-open-profile=/.test(attributes));
    assert.deepEqual(rows.map(([, attributes, content]) => [
      decode(attributes.match(/data-open-profile="([^"]+)"/)[1]),
      plain(content.match(/<strong\b[^>]*class="amount"[^>]*>([\s\S]*?)<\/strong>/)[1])
    ]), expected.slice(0, limit).map(player => [player.name, currency(player.total)]));
    if (limit === expected.length) {
      assert.deepEqual(rows.map(([, , content]) => Number(plain(content).match(/賞金獲得 (\d+)件/)[1])), expected.map(player => player.events));
    }
  }
});

const tournamentAxes = ['series', 'mode', 'subtype', 'team', 'platform'];
// Audited against the season-specific source pages and rules. Similar names
// intentionally occupy separate rows instead of sharing a guessed classifier.
function tournamentTags(markup) {
  return [...markup.matchAll(/<a\b([^>]*)>/g)]
    .filter(([, attributes]) => /data-tournament-tag="/.test(attributes))
    .map(([, attributes]) => {
      const [axis, value] = decode(attributes.match(/data-tournament-tag="([^"]+)"/)[1]).split(':');
      return { axis, value, href: decode(attributes.match(/href="([^"]+)"/)[1]), attributes };
    });
}
function tournamentCards(app) {
  return [...app.get('tournament-list').innerHTML.matchAll(/<article\b([^>]*)>([\s\S]*?)<\/article>/g)]
    .filter(([, attributes]) => /data-tournament-id=/.test(attributes))
    .map(([, attributes, content]) => ({ id: decode(attributes.match(/data-tournament-id="([^"]+)"/)[1]), content }));
}
function tournamentRecordIds(app) {
  return [...app.get('tournament-detail-content').innerHTML.matchAll(/data-tournament-record="([^"]+)"/g)]
    .map(([, id]) => decode(id));
}
function activePage(app) {
  return app.sections.filter(element => element.classList.contains('active')).map(element => element.id);
}

test('all published archive records and every player history expose the same five independent tournament facets', () => {
  const app = boot();
  const archive = new Map();
  for (const { id, content } of renderedArticles(app)) {
    const tags = tournamentTags(content);
    assert.deepEqual(tags.map(tag => tag.axis).sort(), tournamentAxes.slice().sort(), id);
    for (const tag of tags) {
      assert.ok(tag.value, `${id}: ${tag.axis}`);
      const url = new URL(tag.href, app.window.location.href);
      assert.ok(url.hash.startsWith('#tournaments?'), `${id}: ${tag.href}`);
      assert.equal(new URLSearchParams(url.hash.split('?')[1]).get(tag.axis), tag.value, id);
    }
    archive.set(id, tags.map(tag => `${tag.axis}:${tag.value}`).sort());
  }
  assert.equal(archive.size, records.length);
  for (const name of publishedPlayers) {
    app.profile(name);
    for (const { id, content } of profileHistory(app)) {
      assert.deepEqual(tournamentTags(content).map(tag => `${tag.axis}:${tag.value}`).sort(), archive.get(id), `${name}: ${id}`);
    }
  }
});

test('tournament catalog and detail routes retain all records once and separate regions, dates and rounds', () => {
  const app = boot(script, { hash: '#tournaments' });
  assert.deepEqual(activePage(app), ['page-tournaments']);
  assert.equal(app.get('tournament-query').attributes.type, 'search');
  const catalog = tournamentCards(app);
  assert.equal(catalog.length, new Set(records.map(row => tournamentKey(row, data))).size);
  assert.equal(new Set(catalog.map(card => card.id)).size, catalog.length);
  assert.equal(app.get('tournament-count').textContent, `${tournamentCards(app).length}大会 · ${records.length}戦績`);
  const allIds = [];
  for (const card of catalog) {
    const direct = boot(script, { hash: `#tournament=${encodeURIComponent(card.id)}` });
    assert.deepEqual(activePage(direct), ['page-tournament'], card.id);
    const ids = tournamentRecordIds(direct);
    assert.ok(ids.length, card.id);
    assert.equal(new Set(ids).size, ids.length, card.id);
    allIds.push(...ids);
    const markup = direct.get('tournament-detail-content').innerHTML;
    const rendered = [...markup.matchAll(/<article\b([^>]*)>([\s\S]*?)<\/article>/g)]
      .filter(([, attributes]) => /data-tournament-record=/.test(attributes));
    for (const [, attributes, content] of rendered) {
      const id = decode(attributes.match(/data-tournament-record="([^"]+)"/)[1]);
      const record = records.find(record => record.id === id);
      assert.equal(plain(markedContent(content, 'data-tournament-metric', 'rank')), key(record)[4], id);
      for (const metric of ['points', 'kills', 'vrs']) {
        assert.equal(plain(markedContent(content, 'data-tournament-metric', metric)),
          Number.isFinite(record[metric]) ? record[metric].toLocaleString('ja-JP') : '—', `${id}: ${metric}`);
      }
      assert.equal(/\bis-prize-win\b/.test(attributes), record.verified === true && record.prize > 0, id);
      assert.deepEqual([...new Set(profileLinks(content).map(link => link.name))].sort(), [...new Set(roster(record))].sort(), id);
      assert.ok(detail(content, 'source').includes(new URL(record.source).href), id);
      assert.equal(detail(content, 'round'), record.round, id);
      assert.equal(detail(content, 'playerRaw'), record.playerRaw || record.player, id);
      if (record.players?.length > 1 && record.prize > 0) {
        assert.ok(detail(content, 'prize').includes(currency(record.prizePerPlayer)), id);
        assert.match(detail(content, 'prize'), /チーム合計/);
      }
    }
    const sessions = [...markup.matchAll(/<section\b[^>]*data-tournament-session="([^"]+)"[^>]*>/g)]
      .map(match => markedContent(markup.slice(match.index), 'data-tournament-session', match[1]));
    assert.ok(sessions.length, card.id);
    const sessionDates = [];
    for (const session of sessions) {
      const sessionIds = [...session.matchAll(/data-tournament-record="([^"]+)"/g)].map(([, id]) => decode(id));
      assert.ok(sessionIds.length, card.id);
      const rows = sessionIds.map(id => records.find(record => record.id === id));
      assert.ok(rows.every(Boolean), card.id);
      for (const axis of ['date', 'region', 'kind']) assert.equal(new Set(rows.map(record => record[axis])).size, 1, `${card.id}: ${axis}`);
      const windows = rows.map(record => new URL(record.source).searchParams.get('window') || new URL(record.source).searchParams.get('round')).filter(Boolean);
      assert.ok(new Set(windows).size <= 1, `${card.id}: distinct known event rounds were merged`);
      sessionDates.push(rows[0].date);
    }
    assert.deepEqual(sessionDates, sessionDates.slice().sort((a, b) => b.localeCompare(a)), card.id);
  }
  assert.deepEqual(allIds.sort(), records.map(record => record.id).sort());
});

test('unknown tournament metadata stays unconfirmed instead of being guessed from a suggestive name', () => {
  const fixture = { ...sampleRecord, id: 'unconfirmed-format', event: 'Mystery Reload ZB Duo Cup',
    round: '未確認', source: 'https://example.com/no-event-metadata' };
  const app = boot(fixtureScript([fixture]));
  const [{ content }] = renderedArticles(app);
  const tags = tournamentTags(content);
  assert.deepEqual(tags.map(tag => tag.axis).sort(), tournamentAxes.slice().sort());
  assert.ok(tags.every(tag => tag.value === 'unknown'), 'Unconfirmed names must not supply format, team or platform restrictions');
});

test('all existing tournament assignments match the audited season-specific taxonomy', () => {
  const app = boot();
  const counts = Object.fromEntries(tournamentAxes.map(axis => [axis, {}]));
  for (const { id, content } of renderedArticles(app)) {
    const record = records.find(record => record.id === id);
    const expected = tournamentFor(record, data) || Object.fromEntries(tournamentAxes.map(axis => [axis, 'unknown']));
    assert.ok(expected, record.event);
    for (const { axis, value } of tournamentTags(content)) {
      assert.equal(value, expected[axis], `${id}: ${axis}`);
      counts[axis][value] = (counts[axis][value] || 0) + 1;
    }
  }
  assert.deepEqual(counts.mode, records.reduce((sum, row) => { const value = tournamentFor(row, data)?.mode || 'unknown'; sum[value] = (sum[value] || 0) + 1; return sum; }, {}));
  assert.deepEqual(counts.series, records.reduce((sum, row) => { const value = tournamentFor(row, data)?.series || 'unknown'; sum[value] = (sum[value] || 0) + 1; return sum; }, {}));
  assert.deepEqual(counts.team, records.reduce((sum, row) => { const value = tournamentFor(row, data)?.team || 'unknown'; sum[value] = (sum[value] || 0) + 1; return sum; }, {}));
  assert.deepEqual(counts.platform, records.reduce((sum, row) => { const value = tournamentFor(row, data)?.platform || 'unknown'; sum[value] = (sum[value] || 0) + 1; return sum; }, {}));
});

test('all five tournament facets and free text use AND filtering with stage separate from game mode', () => {
  const app = boot(script, { hash: '#tournaments' });
  const assertCatalog = filters => {
    const expectedRecords = records.filter(record => {
      const meta = tournamentFor(record, data) || Object.fromEntries(tournamentAxes.map(axis => [axis, 'unknown']));
      return tournamentAxes.every(axis => !filters[axis] || filters[axis] === 'all' || meta[axis] === filters[axis]) &&
        (!filters.stage || filters.stage === 'all' || record.kind === filters.stage) &&
        (!filters.q || record.event.toLowerCase().includes(filters.q.toLowerCase()));
    });
    const expectedNames = [...new Map(expectedRecords.map(record => [tournamentKey(record, data), record.event])).values()].sort();
    const shown = tournamentCards(app);
    assert.deepEqual(shown.map(card => plain(card.content.match(/<h3[^>]*>([\s\S]*?)<\/h3>/)[1])).sort(), expectedNames);
    assert.equal(app.get('tournament-count').textContent, `${expectedNames.length}大会 · ${expectedRecords.length}戦績`);
    const query = new URLSearchParams(app.window.location.hash.split('?')[1] || '');
    for (const [axis, value] of Object.entries(filters)) if (value !== 'all' && value !== '') assert.equal(query.get(axis), value, axis);
  };
  const filters = {};
  for (const [axis, value] of [
    ['series', 'victory-cup'], ['mode', 'reload'], ['team', 'solo'], ['platform', 'cross-platform'],
    ['subtype', 'solo-reload-victory-cup'], ['stage', '予選']
  ]) {
    filters[axis] = value;
    app.set(`tournament-${axis}`, value, 'change');
    assertCatalog(filters);
  }
  filters.q = 'Solo Reload';
  app.set('tournament-query', filters.q);
  assertCatalog(filters);
  filters.q = 'no-such-event-9718';
  app.set('tournament-query', filters.q);
  assertCatalog(filters);
  assert.match(plain(app.get('tournament-list').innerHTML), /条件に合う大会がありません/);
  assert.doesNotMatch(app.get('tournament-list').innerHTML, /登録して|追加して/);
});

test('FNCS practice, normal Division 1, Major, Heats, LCQ, Performance and Champion Focus stay separate', () => {
  for (const subtype of ['fncs-division-1-practice','performance-evaluation','champion-focus-fncs-cup','fncs-division-1','fncs-major','fncs-heats','fncs-lcq']) {
    const app = boot(script, { hash: '#tournaments?subtype=' + subtype });
    const expected = records.filter(row => tournamentFor(row, data)?.subtype === subtype);
    const ids = [...new Set(expected.map(row => tournamentKey(row, data)))];
    assert.equal(app.get('tournament-count').textContent, ids.length + '大会 · ' + expected.length + '戦績');
    assert.deepEqual(tournamentCards(app).map(t => t.id).sort(), ids.sort());
    assert.equal(app.get('tournament-subtype').value, subtype);
  }
});

test('archive and profile tags navigate to search and browser back restores their original view and filters', () => {
  const app = boot();
  app.navigate('results');
  app.set('search-results', 'solo');
  app.set('region-filter', 'NAW');
  app.set('stage-filter', '予選');
  app.set('sort-results', 'rank');
  const before = renderedRows(app);
  app.window.scrollY = 420;
  const archiveTag = tournamentTags(renderedArticles(app)[0].content).find(tag => tag.axis === 'mode');
  app.click(new Element('a', archiveTag.attributes));
  assert.deepEqual(activePage(app), ['page-tournaments']);
  assert.equal(app.get('tournament-mode').value, archiveTag.value);
  app.browserBack();
  assert.deepEqual(activePage(app), ['page-results']);
  assert.deepEqual(renderedRows(app), before);
  assert.equal(app.get('search-results').value, 'solo');
  assert.equal(app.get('region-filter').value, 'NAW');
  assert.equal(app.get('stage-filter').value, '予選');
  assert.equal(app.get('sort-results').value, 'rank');
  assert.equal(app.window.scrollY, 420);
  app.profile('miru');
  const ids = profileHistory(app).map(record => record.id);
  const profileTag = tournamentTags(profileHistory(app)[0].content).find(tag => tag.axis === 'series');
  app.click(new Element('a', profileTag.attributes));
  assert.deepEqual(activePage(app), ['page-tournaments']);
  assert.equal(app.get('tournament-series').value, profileTag.value);
  app.browserBack();
  assert.deepEqual(activePage(app), ['page-profile']);
  assert.equal(profileField(app, 'name'), 'miru');
  assert.equal(profileField(app, 'total'), expectedPlayerCash('miru'));
  assert.deepEqual(profileHistory(app).map(record => record.id), ids);
});

test('search tag chips combine with active filters, toggle their selection and restore after tournament detail back', () => {
  const app = boot(script, { hash: '#tournaments?series=victory-cup&mode=reload' });
  const clickDuo = () => {
    const tag = tournamentTags(app.get('tournament-facet-team').innerHTML).find(tag => tag.value === 'duo');
    assert.ok(tag);
    app.click(new Element('a', tag.attributes));
  };
  clickDuo();
  assert.equal(app.get('tournament-series').value, 'victory-cup');
  assert.equal(app.get('tournament-mode').value, 'reload');
  assert.equal(app.get('tournament-team').value, 'duo');
  assert.equal(app.get('tournament-count').textContent, `1大会 · ${records.filter(row => tournamentFor(row, data)?.subtype === 'reload-duos-victory-cup').length}戦績`);
  const card = tournamentCards(app)[0];
  app.window.scrollY = 570;
  app.tournament(card.id);
  assert.deepEqual(activePage(app), ['page-tournament']);
  assert.equal(tournamentRecordIds(app).length, records.filter(row => tournamentFor(row, data)?.subtype === 'reload-duos-victory-cup').length);
  app.tournamentBack();
  assert.deepEqual(activePage(app), ['page-tournaments']);
  assert.equal(app.get('tournament-count').textContent, `1大会 · ${records.filter(row => tournamentFor(row, data)?.subtype === 'reload-duos-victory-cup').length}戦績`);
  assert.equal(app.get('tournament-team').value, 'duo');
  assert.equal(app.window.scrollY, 570);
  clickDuo();
  assert.equal(app.get('tournament-team').value, 'all');
  assert.equal(app.get('tournament-count').textContent, `${tournamentCards(app).length}大会 · ${records.filter(e => { const t = tournamentFor(e, data); return t?.series === 'victory-cup' && t.mode === 'reload'; }).length}戦績`);
});

test('direct malformed or unknown tournament URLs are recoverable and query text is escaped', () => {
  for (const hash of ['#tournament=no-such-event-9718', '#tournament=%E0%A4%A', '#tournament=']) {
    const app = boot(script, { hash });
    assert.deepEqual(activePage(app), ['page-tournament']);
    assert.match(plain(app.get('tournament-detail-content').innerHTML), /大会が見つかりません/);
    assert.equal(tournamentRecordIds(app).length, 0);
    app.tournamentBack();
    assert.deepEqual(activePage(app), ['page-tournaments']);
  }
  const unsafe = '"><img src=x onerror=alert(1)> & <script>alert(1)</script>';
  const hash = '#tournaments?series=fncs&mode=not-a-mode&stage=not-a-stage&q=' + encodeURIComponent(unsafe);
  const app = boot(script, { hash });
  assert.deepEqual(activePage(app), ['page-tournaments']);
  assert.equal(app.get('tournament-series').value, 'fncs');
  assert.equal(app.get('tournament-mode').value, 'all');
  assert.equal(app.get('tournament-stage').value, 'all');
  assert.equal(app.get('tournament-query').value, unsafe);
  assert.doesNotMatch(app.get('tournament-content').innerHTML, /<img\b|<script\b/);
  assert.doesNotMatch(app.get('tournament-active-filters').innerHTML, /<img\b|<script\b/);
  assert.ok(plain(app.get('tournament-active-filters').innerHTML).includes(unsafe));
});

test('a future season with the same event name keeps a separate tournament identity and unconfirmed classification', () => {
  const current = { ...sampleRecord, id: 'season-s42-fixture' };
  const future = { ...sampleRecord, id: 'season-s43-fixture', date: '2027-01-01',
    source: sampleRecord.source.replaceAll('S42', 'S43') };
  const source = fixtureScript([current, future]);
  const app = boot(source, { search: '?season=all' });
  const rows = new Map(renderedArticles(app).map(record => [record.id, record.content]));
  const futureTags = tournamentTags(rows.get(future.id));
  assert.ok(futureTags.every(tag => tag.value === 'unknown'), 'A new season must not inherit unverified rules from S42');
  app.navigate('tournaments');
  const catalog = tournamentCards(app);
  assert.equal(catalog.length, 2);
  assert.equal(new Set(catalog.map(card => card.id)).size, 2);
  const histories = catalog.map(card => {
    const direct = boot(source, { search: '?season=all', hash: `#tournament=${encodeURIComponent(card.id)}` });
    return tournamentRecordIds(direct);
  });
  assert.deepEqual(histories.map(ids => ids.slice().sort()).sort((a, b) => a[0].localeCompare(b[0])), [[current.id], [future.id]]);
  assert.ok(catalog.some(card => plain(card.content).includes('S43')), 'Unconfirmed season keeps its known source season identifier');
});

test('visible facet counts reflect matching records and exclude only their own axis from the current filters', () => {
  const app = boot(script, { hash: '#tournaments' });
  const assertCounts = filters => {
    for (const axis of tournamentAxes) {
      const chips = [...app.get(`tournament-facet-${axis}`).innerHTML.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)]
        .filter(([, attributes]) => /data-tournament-tag=/.test(attributes));
      assert.ok(chips.length, axis);
      let sum = 0;
      for (const [, attributes, content] of chips) {
        const [tagAxis, value] = decode(attributes.match(/data-tournament-tag="([^"]+)"/)[1]).split(':');
        assert.equal(tagAxis, axis);
        const expected = records.filter(record => {
          const meta = tournamentFor(record, data) || Object.fromEntries(tournamentAxes.map(axis => [axis, 'unknown']));
          return meta[axis] === value && tournamentAxes.every(other => other === axis || !filters[other] || meta[other] === filters[other]) &&
            (!filters.stage || record.kind === filters.stage);
        }).length;
        const actual = Number(plain(content.match(/<b[^>]*>([\s\S]*?)<\/b>/)[1]).replaceAll(',', ''));
        assert.equal(actual, expected, `${axis}:${value}`);
        sum += actual;
      }
      const expectedTotal = records.filter(record => {
        const meta = tournamentFor(record, data) || Object.fromEntries(tournamentAxes.map(axis => [axis, 'unknown']));
        return tournamentAxes.every(other => other === axis || !filters[other] || meta[other] === filters[other]) &&
          (!filters.stage || record.kind === filters.stage);
      }).length;
      assert.equal(sum, expectedTotal, `${axis}: all facet options count every matching record once`);
    }
  };
  assertCounts({});
  const filters = {};
  for (const [axis, value] of [['series', 'victory-cup'], ['mode', 'reload'], ['stage', '予選']]) {
    filters[axis] = value;
    app.set(`tournament-${axis}`, value, 'change');
    assertCounts(filters);
  }
});

test('copied event slugs on untrusted hosts and conflicting source seasons never receive confirmed tags', () => {
  const mixed = new URL(sampleRecord.source);
  mixed.searchParams.set('window', 'S43_SoloVictoryCup_Event1Round2_ME');
  const sources = [
    sampleRecord.source.replace('fortnitetracker.com', 'example.com'),
    sampleRecord.source.replace('fortnitetracker.com', 'fortnitetracker.com.example.com'),
    mixed.href
  ];
  for (const [index, source] of sources.entries()) {
    const fixture = { ...sampleRecord, id: `untrusted-identity-${index}`, source };
    const app = boot(fixtureScript([fixture]));
    const [{ content }] = renderedArticles(app);
    const tags = tournamentTags(content);
    assert.equal(tags.length, 5, source);
    assert.ok(tags.every(tag => tag.value === 'unknown'), source);
  }
});

function seasonChoices(app) {
  return [...app.get('season-select').innerHTML.matchAll(/<option value="([^"]+)"[^>]*>([^<]+)<\/option>/g)]
    .map(([, id, label]) => ({ id, label: decode(label) }));
}
function chooseSeason(app, id) { app.set('season-select', id, 'change'); }
const seasonFixtures = () => {
  const base = sampleRecord;
  const past = { ...base, chapter: 7, season: 3, seasonId: 'S41', date: '2026-07-01',
    source: base.source.replaceAll('S42', 'S41') };
  return [
    { ...base, id: 'current-p1ng', player: 'p1ng', prize: 100 },
    { ...base, id: 'current-rgn', player: 'RGN p1ng', prize: 50 },
    { ...past, id: 'past-duo', player: 'p1ng / miru', players: ['p1ng', 'miru'], prize: 400, prizePerPlayer: 200 },
    { ...past, id: 'past-qualifying', player: 'RGN p1ng', kind: '予選', rank: 2, prize: null, vrs: 3 },
    { ...past, id: 'past-cosmetic', player: 'miru', kind: 'コスメ大会', event: 'Past Cosmetic Cup', prize: null,
      source: 'https://fortnitetracker.com/events/epicgames_S41_CosmeticCup_ME' },
    { ...base, id: 'unknown-season', player: 'Unmapped', prize: 25, source: 'https://example.com/no-season' }
  ];
};

test('season choices and aggregate values follow the registered JSON without fixed counts or totals', () => {
  const app = boot(script, { search: '' });
  const registered = new Set(records.map(row => seasonFor(row, data)));
  assert.deepEqual(new Set(seasonChoices(app).map(s => s.id)), new Set(['all', ...registered]));
  for (const period of ['all', ...registered]) {
    chooseSeason(app, period);
    const expected = summarize(data, period);
    assert.equal(Number(app.get('stat-results').textContent), expected.records);
    assert.equal(Number(app.get('stat-players').textContent), expected.players);
    assert.equal(app.get('home-earnings-sum').textContent, currency(expected.total));
    assert.equal(app.get('player-earnings-sum').textContent, currency(expected.total));
  }
});

test('registered past seasons and unknown records partition dashboards, directory and rankings without synthetic choices', () => {
  const fixtures = seasonFixtures();
  const source = fixtureScript(fixtures).replace('const tournamentCatalog=[',
    'const tournamentCatalog=[{"id":"empty-season-catalog","chapter":7,"season":2,"seasonId":"S40"},');
  const app = boot(source, { search: '?season=S42' });
  assert.deepEqual(seasonChoices(app), [
    { id: 'all', label: '全期間' }, { id: 'S42', label: 'CH7 S4' },
    { id: 'S41', label: 'CH7 S3' }, { id: 'unknown', label: '未確認' }
  ]);
  assertRows(app, newest(fixtures.slice(0, 2)));
  assert.equal(app.get('stat-players').textContent, 2);
  assert.equal(app.get('home-earnings-sum').textContent, '$150');
  assert.ok(!profileLinks(app.get('all-players').innerHTML).some(p => p.name === 'Unmapped'));
  app.profile('Unmapped');
  assert.equal(profileCount(app, 'events'), 0);
  assert.equal(profileField(app, 'total'), '$0');
  assert.equal(profileField(app, 'lifetime-total'), '$25');
  chooseSeason(app, 'S41');
  assertRows(app, newest(fixtures.slice(2, 5)));
  assert.equal(app.get('stat-results').textContent, 3);
  assert.equal(app.get('stat-players').textContent, 3);
  assert.equal(app.get('home-earnings-sum').textContent, '$400');
  assert.equal(app.get('home-spotlight').hidden, true);
  assert.deepEqual(profileLinks(app.get('all-players').innerHTML).map(p => p.name).sort(), ['RGN p1ng', 'miru', 'p1ng'].sort());
  assert.match(plain(app.get('player-earnings-leaders').innerHTML), /p1ng\$200/);
  assert.doesNotMatch(plain(app.get('player-earnings-leaders').innerHTML), /RGN p1ng/);
  chooseSeason(app, 'all');
  assert.equal(app.get('stat-results').textContent, 6);
  assert.equal(app.get('home-earnings-sum').textContent, '$575');
  chooseSeason(app, 'unknown');
  assertRows(app, [fixtures[5]]);
  assert.equal(app.get('home-earnings-sum').textContent, '$25');
  assert.match(app.get('season-scope').textContent, /未確認/);
});

test('profiles, best placements, region charts and exact identities follow the selected season while lifetime totals remain global', () => {
  const app = boot(fixtureScript(seasonFixtures()), { search: '?season=S41', hash: '#player=p1ng' });
  assert.equal(profileField(app, 'total'), '$200');
  assert.equal(profileField(app, 'lifetime-total'), '$300');
  assert.equal(profileCount(app, 'events'), 1);
  assert.deepEqual(profileHistory(app).map(e => e.id), ['past-duo']);
  const region = markedContents(app.get('profile-content').innerHTML, 'data-profile-region', 'ME');
  assert.equal(plain(markedContent(region.find(s => /data-region-stat="prize"/.test(s)), 'data-region-stat', 'prize')), '$200');
  assert.match(app.get('profile-content').innerHTML, /チーム合計 \$400/);
  app.profile('RGN p1ng');
  assert.equal(profileField(app, 'total'), '$0');
  assert.equal(profileField(app, 'lifetime-total'), '$50');
  assert.equal(profileField(app, 'best-qualifying'), '#2');
  assert.equal(profileField(app, 'best-final'), '未登録');
  app.profile('miru');
  assert.match(profileField(app, 'aliases'), /ᵗᶻᵈ 否定から入ります〆/);
  assert.equal(profileField(app, 'total'), '$200');
  chooseSeason(app, 'S42');
  assert.equal(profileCount(app, 'events'), 0);
  assert.equal(profileField(app, 'total'), '$0');
  assert.equal(profileField(app, 'lifetime-total'), '$200');
  assert.equal(profileHistory(app).length, 0);
  assert.match(app.get('profile-content').innerHTML, /\?season=S42#player=miru/);
});

test('season changes preserve navigation, browse filters, tournament facets and browser back including same-hash history', () => {
  const app = boot(fixtureScript(seasonFixtures()), { search: '?season=S42', hash: '#results' });
  app.set('search-results', 'p1ng'); app.set('region-filter', 'ME'); app.set('prize-only', true);
  chooseSeason(app, 'S41');
  assert.deepEqual(renderedArticles(app).map(row => row.id), ['past-duo']);
  app.profile('p1ng');
  assert.equal(app.window.location.search, '?season=S41');
  assert.match(app.get('profile-content').innerHTML, /\?season=S41#player=p1ng/);
  chooseSeason(app, 'all');
  assert.equal(profileField(app, 'total'), '$300');
  app.browserBack();
  assert.equal(app.get('season-select').value, 'S41');
  assert.equal(profileField(app, 'total'), '$200');
  app.profileBack();
  assert.equal(app.get('search-results').value, 'p1ng');
  assert.equal(app.get('prize-only').checked, true);
  assert.deepEqual(renderedArticles(app).map(row => row.id), ['past-duo']);
  app.navigate('tournaments');
  app.set('tournament-mode', 'unknown', 'change');
  assert.equal(app.get('tournament-count').textContent, '2大会 · 3戦績');
  chooseSeason(app, 'S42');
  assert.equal(app.get('tournament-mode').value, 'unknown');
  assert.equal(app.get('tournament-count').textContent, '0大会 · 0戦績');
  app.browserBack();
  assert.equal(app.get('season-select').value, 'S41');
  assert.equal(app.get('tournament-count').textContent, '2大会 · 3戦績');
  for (const card of tournamentCards(app)) {
    app.tournament(card.id);
    assert.ok(tournamentRecordIds(app).every(id => id.startsWith('past-')));
    assert.equal(app.window.location.search, '?season=S41');
    app.tournamentBack();
  }
});

test('CSV contains only the selected season and current search/filter results with explicit season metadata', async () => {
  const app = boot(fixtureScript(seasonFixtures()), { search: '?season=S41' });
  app.set('search-results', 'p1ng'); app.set('prize-only', true);
  app.click(app.get('export-csv'));
  const [headers, ...rows] = parseCSV(await app.downloads[0].blob.text());
  assert.deepEqual(headers.slice(-3), ['chapter', 'season', 'seasonId']);
  const exported = rows.map(row => Object.fromEntries(headers.map((name, i) => [name, row[i]])));
  assert.equal(exported.length, 1);
  assert.equal(exported[0].player, 'p1ng / miru');
  assert.equal(exported[0].prize, '400');
  assert.equal(exported[0].prizePerPlayer, '200');
  assert.deepEqual([exported[0].chapter, exported[0].season, exported[0].seasonId], ['7', '3', 'S41']);
});

test('missing or conflicting season evidence is unconfirmed and unsupported URL seasons never create phantom data', () => {
  const base = sampleRecord;
  const mixed = new URL(base.source); mixed.searchParams.set('window', 'S41_Other_Round1_ME');
  const fixtures = [base,
    { ...base, id: 's42-in-name-only', source: 'https://example.com/S42_Other' },
    { ...base, id: 'new-source-unmapped', source: base.source.replaceAll('S42', 'S43') },
    { ...base, id: 'conflicting-season', source: mixed.href }
  ];
  const app = boot(fixtureScript(fixtures), { search: '?season=unknown' });
  assert.deepEqual(renderedArticles(app).map(e => e.id).sort(), fixtures.slice(1).map(e => e.id).sort());
  assert.ok(renderedArticles(app).every(e => e.content.includes('data-record-season="unknown"')));
  assert.ok(!seasonChoices(app).some(s => s.id === 'S43'));
  const invalid = boot(script, { search: '?season=S999', hash: '#player=miru' });
  assert.equal(invalid.get('season-select').value, 'S42');
  assert.equal(profileField(invalid, 'total'), currency(records.filter(r => seasonFor(r, data) === 'S42' && roster(r).includes('miru')).reduce((sum, r) => sum + personalCash(r), 0)));
  assert.equal(invalid.get('stat-results').textContent, summarize(data, 'S42').records);
  assert.equal(invalid.storageAccesses(), 0);
});

test('older chapter options come from registered catalog metadata and conflicting record seasons do not inherit current classification', () => {
  const earlier = { ...sampleRecord, id: 'chapter-two-fixture', date: '2020-09-01', source: sampleRecord.source.replaceAll('S42', 'S14') };
  const conflict = { ...sampleRecord, id: 'explicit-conflict-fixture', seasonId: 'S42', chapter: 7, season: 4,
    source: sampleRecord.source.replaceAll('S42', 'S41') };
  const catalogEntry = { id: 'ch2s4-solo-fixture', name: earlier.event, chapter: 2, season: 4, seasonId: 'S14',
    sourceEventIds: ['S14_SoloVictoryCup'], series: 'victory-cup', mode: 'battle-royale', subtype: 'solo-victory-cup', team: 'solo', platform: 'unknown' };
  const source = fixtureScript([sampleRecord, earlier, conflict]).replace('const tournamentCatalog=[',
    `const tournamentCatalog=[${JSON.stringify(catalogEntry)},`);
  const app = boot(source, { search: '?season=S14', hash: '#tournaments' });
  assert.ok(seasonChoices(app).some(s => s.id === 'S14' && s.label === 'CH2 S4'));
  assert.equal(app.get('tournament-count').textContent, '1大会 · 1戦績');
  app.tournament(catalogEntry.id);
  assert.deepEqual(tournamentRecordIds(app), [earlier.id]);
  assert.match(plain(app.get('tournament-detail-content').innerHTML), /CH2 · SEASON 4/);
  chooseSeason(app, 'unknown'); app.navigate('results');
  const [row] = renderedArticles(app);
  assert.equal(row.id, conflict.id);
  assert.ok(tournamentTags(row.content).every(tag => tag.value === 'unknown'));
});
