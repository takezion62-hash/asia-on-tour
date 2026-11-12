'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const files = new Map([['/', 'index.html'], ['/index.html', 'index.html'], ['/app.js', 'app.js'], ['/rankings.js', 'rankings.js'], ['/aot-pr.js', 'aot-pr.js'], ['/aot-pr.css', 'aot-pr.css'], ['/achievements.js', 'achievements.js'], ['/achievements.css', 'achievements.css'], ['/growth.js', 'growth.js'], ['/growth.css', 'growth.css'], ['/compare.js', 'compare.js'], ['/compare.css', 'compare.css'], ['/schedule.json', 'schedule.json'], ...['results', 'players', 'tournaments', 'updates'].map(name => ['/' + name + '.json', name + '.json'])]);
// Keep the browser-test allowlist in sync with assets loaded by the live site.
// The monthly archive is deliberately restricted to YYYY-MM.json names.
for(const name of ['calendar.css','auto-sync-ui.js','auto-sync-ui.css','participation-ui.js','participation-pr.js','participation.css','participation-index.json','participation-status.json','calendar-history-index.json','calendar-history-status.json','auto-sync-status.json','auto-sync-review.json','history-sync-status.json','history-sync-review.json','candidate-triage.json',
  // Mirror all public site entrypoints and their dependencies in browser tests.
  'player-style.js','player-style-view.js','player-style.css','tracker-summary.js','tracker-summary.css','profile-layout.js','profile-layout.css',
  'discovery.js','discovery-ui.js','discovery-ui.css',
  'verification.html','verification-core.js','verification.js','verification.css',
  'source-rules.js','source-rules.css','tournament-rules.json','history-sync-reviewed.json','approval-history.json'])files.set('/'+name,name);
if(fs.existsSync(path.join(root,'season-data'))){
  for(const name of fs.readdirSync(path.join(root,'season-data'))){
    if(/^(?:S\d+|unknown|manifest|ranking-(?:S\d+|unknown|all))\.json$/.test(name))
      files.set('/season-data/'+name,'season-data/'+name);
  }
}
for(const name of fs.readdirSync(path.join(root,'calendar-history'))){
  if(/^\d{4}-\d{2}\.json$/.test(name))files.set('/calendar-history/'+name,'calendar-history/'+name);
}
if(fs.existsSync(path.join(root,'participation'))){
  for(const name of fs.readdirSync(path.join(root,'participation'))){
    if(/^\d{4}-\d{2}\.json$/.test(name))files.set('/participation/'+name,'participation/'+name);
  }
}
const server = http.createServer((req, res) => {
  const file = files.get(new URL(req.url, 'http://localhost').pathname);
  // Optional generated indexes may not exist in a fresh checkout until the
  // first builder run. Return 404 instead of crashing the shared test server.
  if (!file || !['GET', 'HEAD'].includes(req.method) || !fs.existsSync(path.join(root, file))) {
    res.writeHead(404); res.end(); return;
  }
  const type = file.endsWith('.json') ? 'application/json' : file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html';
  res.writeHead(200, { 'Content-Type': type + '; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(req.method === 'HEAD' ? undefined : fs.readFileSync(path.join(root, file)));
});
server.listen(4173, '127.0.0.1', () => console.log('閲覧用テストサーバー http://127.0.0.1:4173'));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)));
