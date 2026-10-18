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
      .filter(([name]) => name.startsWith('data-')).map(([name, value]) => [name.slice(5), value]));
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
  dispatch(type, target = this) {
    for (const callback of this.events.get(type) || []) callback({ target });
  }
  setAttribute(name, value) { this.attributes[name] = value; }
  closest(selector) {
    const attribute = selector.match(/^\[([\w-]+)\]$/)?.[1];
    return attribute && Object.hasOwn(this.attributes, attribute) ? this : this.parent?.closest(selector) || null;
  }
}

// Only the DOM operations used by this static site are emulated. Missing IDs
// return null, so stale handlers for removed form elements fail at startup.
function boot() {
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
  const sandbox = {
    document, window: { scrollTo: options => scrolls.push(options) },
    URL: BrowserURL, Blob, setTimeout: callback => { callback(); return 1; }
  };
  let storageAccesses = 0;
  Object.defineProperty(sandbox, 'localStorage', { get() { storageAccesses++; throw new Error('Storage is unavailable'); } });
  for (const name of ['sessionStorage', 'indexedDB', 'FileReader', 'FormData', 'confirm']) {
    Object.defineProperty(sandbox, name, { get() { throw new Error(`Unexpected write feature: ${name}`); } });
  }
  vm.runInNewContext(script, sandbox, { filename: 'index.html', timeout: 5000 });
  const get = id => { assert.ok(ids.has(id), `Missing element ${id}`); return ids.get(id); };
  const click = element => {
    element.dispatch('click');
    const child = new Element('span'); child.parent = element;
    document.dispatch('click', child);
  };
  return {
    get, nav, sections, scrolls, downloads, revoked,
    storageAccesses: () => storageAccesses,
    set(id, value, type = 'input') {
      const element = get(id);
      if (typeof value === 'boolean') element.checked = value; else element.value = value;
      element.dispatch(type);
    },
    click,
    navigate(page) { click(nav.find(element => element.dataset.page === page)); },
    player(name) { click(new Element('button', `data-player="${name}"`)); },
    spotlight() { click(elements.find(element => Object.hasOwn(element.dataset, 'spotlight'))); }
  };
}

function renderedRows(app) {
  const body = app.get('result-table').innerHTML.match(/<tbody>([\s\S]*?)<\/tbody>/)?.[1] || '';
  return [...body.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/g)].map(([, row]) => {
    const cells = [...row.matchAll(/<td>([\s\S]*?)<\/td>/g)].map(match => match[1]);
    const strong = index => plain(cells[index].match(/<strong>([\s\S]*?)<\/strong>/)[1]);
    return [strong(0).replaceAll('.', '-'), strong(1), plain(cells[2]), strong(3), strong(5)];
  });
}

const key = record => [record.date, record.player, record.region, record.event,
  Number.isInteger(record.rank) ? `#${record.rank.toLocaleString('ja-JP')}` : record.reported ? '確認中' : '通過'];
const newest = rows => rows.slice().sort((a, b) => b.date.localeCompare(a.date));
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
  assert.match(app.get('home-earnings-leaders').innerHTML, /data-player=/);
});

test('all navigation pages remain usable with accurate active state', () => {
  const app = boot();
  for (const page of ['results', 'players', 'about', 'home']) {
    app.navigate(page);
    assert.deepEqual(app.sections.filter(element => element.classList.contains('active')).map(element => element.id), [`page-${page}`]);
    assert.equal(app.nav.find(element => element.dataset.page === page).attributes['aria-current'], 'page');
  }
  assert.equal(app.scrolls.length, 4);
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
  const playerNames = [...app.get('all-players').innerHTML.matchAll(/class="player-name">([^<]+)</g)].map(match => decode(match[1]));
  assert.deepEqual(playerNames, ['meath']);
  app.set('player-sort', 'name', 'change');
  assert.match(app.get('all-players').innerHTML, /data-player="meath"/);
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
