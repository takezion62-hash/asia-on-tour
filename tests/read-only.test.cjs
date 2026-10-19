const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const records = JSON.parse(JSON.stringify(vm.runInNewContext(
  script.match(/const builtIn=(\[[\s\S]*?\n    \]);/)[1]
)));
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
  closest(selector) {
    const attribute = selector.match(/^\[([\w-]+)\]$/)?.[1];
    return attribute && Object.hasOwn(this.attributes, attribute) ? this : this.parent?.closest(selector) || null;
  }
}

// Only the DOM operations used by this static site are emulated. Missing IDs
// return null, so stale handlers for removed form elements fail at startup.
function boot(source = script, { hash = '' } = {}) {
  const elements = [...html.matchAll(/<([\w-]+)\b([^>]*)>/g)]
    .map(([, tag, attributes]) => new Element(tag, attributes));
  const ids = new Map(elements.filter(element => element.id).map(element => [element.id, element]));
  for (const [, attributes, content] of html.matchAll(/<select\b([^>]*)>([\s\S]*?)<\/select>/g)) {
    const id = attributes.match(/id="([^"]+)"/)[1];
    const first = content.match(/<option\b([^>]*)>([\s\S]*?)<\/option>/);
    ids.get(id).value = first[1].match(/value="([^"]*)"/)?.[1] ?? plain(first[2]);
  }
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
  let location = new BrowserURL(`https://takezion62-hash.github.io/asia-on-tour/${hash}`);
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
    URL: BrowserURL, Blob, setTimeout: callback => { callback(); return 1; }
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
    },
    click,
    navigate(page) { click(nav.find(element => element.dataset.page === page)); },
    player(name) { click(new Element('button', `data-player="${name}"`)); },
    profile(name) { click(new Element('a', `data-open-profile="${name}" href="#player=${encodeURIComponent(name)}"`)); },
    profileBack() { click(new Element('button', 'data-profile-back=""')); },
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
function markedContent(content, attribute, name) {
  const start = new RegExp(`<([\\w-]+)\\b[^>]*\\b${attribute}="${name}"[^>]*>`).exec(content);
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
  return [...content.matchAll(new RegExp(`<([\\w-]+)\\b[^>]*\\b${attribute}="${name}"[^>]*>`, 'g'))]
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

test('the compact archive preserves all 136 records, 86 players and $9,000 of verified individual earnings', () => {
  const app = boot();
  assert.equal(records.length, 136);
  assert.equal(new Set(records.flatMap(record => record.players || [record.player])).size, 86);
  assert.equal(Number(app.get('stat-players').textContent), 86);
  assert.equal(app.get('home-earnings-sum').textContent, '$9,000');
  assert.equal(app.get('player-earnings-sum').textContent, '$9,000');
  const articles = renderedArticles(app);
  assert.equal(articles.length, 136);
  assert.equal(new Set(articles.map(article => article.id)).size, 136);
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
    assert.equal(detail(content, 'playerRaw'), record.playerRaw, id);
    assert.equal(detail(content, 'note'), record.note, id);
    const expectedLinks = [record.source, record.profileUrl, ...(record.profiles || []).map(profile => profile.url)]
      .filter(Boolean).map(url => new URL(url).href);
    const links = [...content.matchAll(/<a\b([^>]*)>/g)]
      .filter(([, attributes]) => !/data-open-profile=/.test(attributes)).map(([, attributes]) => {
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
    ...records[0], id: 'escaped-result', player: unsafe, playerRaw: unsafe,
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
    .filter(([, attributes]) => !/data-open-profile=/.test(attributes))
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
  const base = { ...records[0], players: ['first', 'second'], player: 'first / second', prizePerPlayer: undefined };
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
  for (const page of ['results', 'players', 'about', 'home']) {
    app.navigate(page);
    assert.deepEqual(app.sections.filter(element => element.classList.contains('active')).map(element => element.id), [`page-${page}`]);
    assert.equal(app.nav.find(element => element.dataset.page === page).attributes['aria-current'], 'page');
  }
  assert.equal(app.scrolls.length - initialScrolls, 4);
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
  assert.equal(total, 9000);
  assert.equal(app.get('stat-results').textContent, records.length);
  assert.equal(app.get('home-earnings-sum').textContent, '$9,000');
  assert.equal(app.get('player-earnings-sum').textContent, '$9,000');
});

test('repeat winners retain exact cumulative totals and qualification or cosmetic rewards add no cash', () => {
  const app = boot();
  for (const [name, total, count, paid] of [
    ['Shiroka', 400, 8, 3], ['miru', 700, 6, 6], ['でーもんくらげǃ', 600, 7, 6], ['meath', 100, 3, 1]
  ]) {
    app.profile(name);
    assert.equal(profileField(app, 'total'), currency(total), name);
    assert.equal(profileCount(app, 'events'), count, name);
    assert.equal(profileCount(app, 'prize-events'), paid, name);
  }
  const qualifier = records.find(record => record.kind === '予選' && record.vrs > 0 && playerResults(record.player).every(result => !personalCash(result)));
  assert.ok(qualifier);
  app.profile(qualifier.player);
  assert.equal(profileField(app, 'total'), '$0');
  assert.equal(profileCount(app, 'prize-events'), 0);
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
  assert.equal(profileField(app, 'total'), '$100');
  const p1ngHash = app.window.location.hash;
  app.profile('RGN p1ng');
  assert.deepEqual(profileHistory(app).map(record => record.id), playerResults('RGN p1ng').map(record => record.id));
  assert.equal(profileField(app, 'total'), '$100');
  assert.notEqual(app.window.location.hash, p1ngHash);
  app.profile('miru');
  assert.match(profileField(app, 'aliases'), /ᵗᶻᵈ 否定から入ります〆/);
  assert.equal(profileField(app, 'total'), '$700');
  assert.equal(profileHistory(app).length, 6);
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
  assert.equal(profileField(app, 'total'), '$600');
  assert.equal(profileCount(app, 'events'), 7);
  const share = app.get('profile-content').innerHTML.match(/<a\b[^>]*id="profile-share"[^>]*>/)?.[0];
  assert.ok(share, 'Missing share link');
  assert.equal(decode(share.match(/href="([^"]+)"/)[1]), `https://takezion62-hash.github.io/asia-on-tour/#player=${encodeURIComponent(name)}`);
  app.hash('#player=miru');
  assert.equal(profileField(app, 'total'), '$700');
  assert.equal(profileCount(app, 'events'), 6);
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
  const base = { ...records[0], player: 'first / second', players: ['first', 'second'], prize: 400, verified: true };
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
