'use strict';
// Discover ONLY browser assets explicitly referenced by the public HTML pages.
// Data/archive JSON routes remain separately allowlisted in scripts/serve.cjs.
const fs = require('node:fs');
const path = require('node:path');

const PUBLIC_HTML = Object.freeze(['index.html', 'verification.html']);
const TEST_ORIGIN = 'http://aot.test';
const ASSET_PATH = /^(?:assets\/(?:[a-z0-9_-]+\/)*|)[a-z0-9][a-z0-9._-]*\.(?:js|mjs|css)$/i;
const ATTRIBUTE = /([a-z][a-z0-9:-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi;

function attributes(markup) {
  const values = {};
  for (const match of markup.matchAll(ATTRIBUTE)) {
    values[match[1].toLowerCase()] = match[2] ?? match[3] ?? match[4];
  }
  return values;
}

function localAssetReference(reference, kind, documentName) {
  const raw = String(reference).trim();
  if (!raw) throw new Error(documentName + ': empty local asset URL');
  // CDN assets are not served by the local server; it never proxies remote URLs.
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw) || raw.startsWith('//')) return null;
  const rawPath = raw.split(/[?#]/, 1)[0];
  let decoded;
  try { decoded = decodeURIComponent(rawPath); }
  catch { throw new Error(documentName + ': malformed asset URL: ' + raw); }
  if (decoded.includes('\\') || decoded.includes('\0') ||
      decoded.split('/').includes('..'))
    throw new Error(documentName + ': unsafe asset path: ' + raw);
  let url;
  try { url = new URL(raw, TEST_ORIGIN + '/'); }
  catch { throw new Error(documentName + ': invalid asset URL: ' + raw); }
  if (url.origin !== TEST_ORIGIN) return null;
  let pathname;
  try { pathname = decodeURIComponent(url.pathname); }
  catch { throw new Error(documentName + ': malformed asset pathname: ' + raw); }
  const relative = pathname.replace(/^\/+/, '');
  if (!ASSET_PATH.test(relative))
    throw new Error(documentName + ': asset must be a root JS/CSS file or live under assets/: ' + raw);
  if (kind === 'script' && !/\.(?:js|mjs)$/i.test(relative))
    throw new Error(documentName + ': script must reference JS: ' + raw);
  if (kind === 'style' && !/\.css$/i.test(relative))
    throw new Error(documentName + ': stylesheet must reference CSS: ' + raw);
  return ['/' + relative, relative];
}

function discoverPublicAssets(rootDir, htmlEntries = PUBLIC_HTML) {
  const routes = new Map();
  for (const documentName of htmlEntries) {
    const html = fs.readFileSync(path.join(rootDir, documentName), 'utf8');
    for (const tag of html.matchAll(/<(script|link)\b([^>]*?)>/gi)) {
      const type = tag[1].toLowerCase();
      const attrs = attributes(tag[2]);
      if (type === 'script' && !attrs.src) continue; // inline script
      if (type === 'link' && (!attrs.href ||
          !/\bstylesheet\b/i.test(attrs.rel || '') &&
          !/\.css(?:[?#]|$)/i.test(attrs.href))) continue;
      const reference = type === 'script' ? attrs.src : attrs.href;
      const asset = localAssetReference(reference, type === 'script' ? 'script' : 'style', documentName);
      if (!asset) continue;
      const [route, relative] = asset;
      const file = path.join(rootDir, relative);
      let stats;
      try { stats = fs.lstatSync(file); }
      catch { throw new Error(documentName + ': referenced site asset is missing: ' + relative); }
      if (!stats.isFile())
        throw new Error(documentName + ': site asset must be a regular file: ' + relative);
      routes.set(route, relative);
    }
  }
  return routes;
}

module.exports = { PUBLIC_HTML, localAssetReference, discoverPublicAssets };
if (require.main === module) {
  const routes = discoverPublicAssets(path.resolve(__dirname, '..'));
  console.log('Site asset preflight passed: ' + routes.size + ' JS/CSS files referenced by public HTML');
}
