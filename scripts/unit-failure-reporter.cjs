'use strict';
// Node's test reporter is a streaming hook; keep a machine-readable, portable
// failure manifest alongside the normal human-readable spec reporter.
const path = require('node:path');

function safeTestFile(raw) {
  if (typeof raw !== 'string') return null;
  const unix = raw.replace(/\\/g, '/');
  const match = unix.match(/(?:^|\/)(tests\/[a-z0-9._-]+\.test\.cjs)$/i);
  return match ? match[1] : null;
}

async function* failureReporter(source) {
  const failures = [];
  for await (const event of source) {
    if (event.type !== 'test:fail') continue;
    const info = event.data || {};
    const file = safeTestFile(info.file) || safeTestFile(info.name);
    failures.push({ file, name: String(info.name || ''), nesting: info.nesting ?? null });
  }
  // Do not silently drop unrecognized failure locations. The focused runner
  // will fail closed and request a full run when a filename is missing.
  yield JSON.stringify({ version: 1, failedTests: failures }, null, 2) + '\n';
}

failureReporter.safeTestFile = safeTestFile;
module.exports = failureReporter;
