'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { discoverPublicAssets } = require('./site-assets.cjs');
const root = path.join(__dirname, '..');

function buildFileMap(projectRoot = root) {
  // JSON is kept on an exact allowlist; HTML cannot grant access to private
  // source files, tests, workflows or arbitrary files inside the repository.
  const files = new Map([
    ['/', 'index.html'], ['/index.html', 'index.html'],
    ['/verification.html', 'verification.html'],
    ['/schedule.json', 'schedule.json'],
    ...['results', 'players', 'tournaments', 'updates'].map(name => ['/' + name + '.json', name + '.json'])
  ]);
  for (const name of [
    'participation-index.json', 'participation-status.json',
    'calendar-history-index.json', 'calendar-history-status.json',
    'auto-sync-status.json', 'auto-sync-review.json',
    'history-sync-status.json', 'history-sync-review.json',
    'candidate-triage.json', 'tournament-rules.json',
    'history-sync-reviewed.json', 'approval-history.json'
  ]) files.set('/' + name, name);

  // JS/CSS references for both public entrypoints are auto-synced at startup.
  // A missing/unsafe HTML asset is an immediate test-server failure.
  for (const [route, file] of discoverPublicAssets(projectRoot))
    files.set(route, file);

  for (const [directory, pattern] of [
    ['season-data', /^(?:S\d+|unknown|manifest|ranking-(?:S\d+|unknown|all))\.json$/],
    ['calendar-history', /^\d{4}-\d{2}\.json$/],
    ['participation', /^\d{4}-\d{2}\.json$/]
  ]) {
    const target = path.join(projectRoot, directory);
    if (!fs.existsSync(target)) continue;
    for (const name of fs.readdirSync(target)) {
      if (pattern.test(name)) files.set('/' + directory + '/' + name, directory + '/' + name);
    }
  }
  return files;
}

function createServer(projectRoot = root) {
  const files = buildFileMap(projectRoot);
  return http.createServer((req, res) => {
    const file = files.get(new URL(req.url, 'http://localhost').pathname);
    // Optional generated JSON files may not exist until the first builder run.
    if (!file || !['GET', 'HEAD'].includes(req.method) ||
        !fs.existsSync(path.join(projectRoot, file))) {
      res.writeHead(404); res.end(); return;
    }
    const type = file.endsWith('.json') ? 'application/json' :
      /\.(?:js|mjs)$/i.test(file) ? 'text/javascript' :
      file.endsWith('.css') ? 'text/css' : 'text/html';
    res.writeHead(200, { 'Content-Type': type + '; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(req.method === 'HEAD' ? undefined : fs.readFileSync(path.join(projectRoot, file)));
  });
}

if (require.main === module) {
  const server = createServer();
  server.listen(4173, '127.0.0.1', () => console.log('閲覧用テストサーバー http://127.0.0.1:4173'));
  for (const signal of ['SIGINT', 'SIGTERM'])
    process.on(signal, () => server.close(() => process.exit(0)));
}
module.exports = { buildFileMap, createServer };
