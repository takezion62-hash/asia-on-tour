'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { discoverPublicAssets } = require('../scripts/site-assets.cjs');
const { buildFileMap } = require('../scripts/serve.cjs');
const project = path.join(__dirname, '..');

function fixture(t, html, verification = '') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aot-assets-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.writeFileSync(path.join(root, 'index.html'), html);
  fs.writeFileSync(path.join(root, 'verification.html'), verification);
  return {
    root,
    add(name, text = '// test asset\n') {
      fs.mkdirSync(path.dirname(path.join(root, name)), { recursive: true });
      fs.writeFileSync(path.join(root, name), text);
    }
  };
}

test('production HTML asset references are all present and served without a hand-written JS/CSS list', () => {
  const assets = discoverPublicAssets(project);
  const routes = buildFileMap(project);
  assert.ok(assets.has('/discovery.js'));
  assert.ok(assets.has('/discovery-ui.js'));
  assert.ok(assets.has('/discovery-ui.css'));
  assert.ok(assets.has('/verification-core.js'));
  for (const [url, file] of assets) {
    assert.equal(routes.get(url), file);
    assert.ok(fs.statSync(path.join(project, file)).isFile());
  }
  assert.equal(routes.has('/scripts/serve.cjs'), false);
  assert.equal(routes.has('/tests/site-asset-sync.test.cjs'), false);
  assert.equal(routes.has('/package.json'), false);
  assert.equal(routes.has('/.github/workflows/tests.yml'), false);
});

test('new JS/CSS on both HTML pages auto-registers and query strings do not affect route names', t => {
  const f = fixture(t,
    '<link rel="stylesheet" href="./next-theme.css?v=2027-01">' +
    '<script defer src="./new-feature.js?cache=hello"></script>' +
    '<script src="https://cdn.example.test/external.js"></script>' +
    '<link rel="icon" href="./favicon.png">',
    '<link rel="stylesheet" href="./assets/widgets/panel.css?v=1">' +
    '<script src="./verification-next.mjs#main"></script>');
  for (const file of ['next-theme.css','new-feature.js','assets/widgets/panel.css','verification-next.mjs'])
    f.add(file);
  const routes = buildFileMap(f.root);
  for (const file of ['next-theme.css','new-feature.js','assets/widgets/panel.css','verification-next.mjs'])
    assert.equal(routes.get('/' + file), file);
  assert.equal(routes.has('/external.js'), false);
  assert.equal(routes.has('/favicon.png'), false);
});

test('missing files referenced by HTML fail immediately rather than making every browser test time out', t => {
  const f = fixture(t, '<script src="./future-feature.js?v=1"></script>');
  assert.throws(() => buildFileMap(f.root), /index\.html: referenced site asset is missing: future-feature\.js/);
});

test('unsafe and private paths are not added to the local public asset allowlist', t => {
  const f = fixture(t, '<script src="../scripts/private.js"></script>');
  assert.throws(() => buildFileMap(f.root), /unsafe asset path/);
  fs.writeFileSync(path.join(f.root, 'index.html'), '<script src="./scripts/private.js"></script>');
  assert.throws(() => buildFileMap(f.root), /root JS\/CSS file or live under assets/);
  fs.writeFileSync(path.join(f.root, 'index.html'), '<link rel="stylesheet" href="./assets/%2e%2e/private.css">');
  assert.throws(() => buildFileMap(f.root), /unsafe asset path/);
  fs.writeFileSync(path.join(f.root, 'index.html'), '<script src="./.env.js"></script>');
  assert.throws(() => buildFileMap(f.root), /root JS\/CSS file or live under assets/);
  fs.writeFileSync(path.join(f.root, 'index.html'), '<script src="./not-a-script.css"></script>');
  assert.throws(() => buildFileMap(f.root), /script must reference JS/);
});

test('a symlink to any other file cannot be exposed as a browser asset', t => {
  const f = fixture(t, '<script src="./secrets.js"></script>');
  const outside = path.join(f.root, 'private.txt');
  fs.writeFileSync(outside, 'do not expose');
  fs.symlinkSync(outside, path.join(f.root, 'secrets.js'));
  assert.throws(() => buildFileMap(f.root), /must be a regular file/);
});
