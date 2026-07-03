#!/usr/bin/env node
/* oxlint-disable no-console */

// Guards against a new e2e/smoke or e2e/live spec silently never feeding
// Sentry Snapshots: every spec file must either call `captureSnapshot(` at
// least once, or explicitly opt out with a `// snapshot-exempt: <reason>`
// comment (see e2e/smoke/focus-visible.spec.ts for an example -- specs that
// only assert computed styles against synthetic DOM nodes, or e2e/live/
// liveGif.spec.ts, which is a pure API contract test with no browser page
// at all, have no meaningful visual state to capture).

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const SPEC_DIRS = [path.join('e2e', 'smoke'), path.join('e2e', 'live')];
const SNAPSHOT_CALL_PATTERN = /captureSnapshot\(/;
const EXEMPTION_PATTERN = /snapshot-exempt:\s*\S/;

async function main() {
  const specFileLists = await Promise.all(
    SPEC_DIRS.map(async (dir) => {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      return entries
        .filter((entry) => entry.isFile() && entry.name.endsWith('.spec.ts'))
        .map((entry) => path.join(dir, entry.name));
    })
  );
  const specFiles = specFileLists.flat();

  const fileContents = await Promise.all(
    specFiles.map((filePath) => fs.readFile(filePath, 'utf8'))
  );

  const violations = specFiles.filter((_filePath, index) => {
    const contents = fileContents[index];
    return !SNAPSHOT_CALL_PATTERN.test(contents) && !EXEMPTION_PATTERN.test(contents);
  });

  if (violations.length > 0) {
    console.error('Missing Sentry Snapshot coverage in:');
    for (const filePath of violations) {
      console.error(`  - ${filePath}`);
    }
    console.error(
      '\nEach e2e/smoke or e2e/live spec must call captureSnapshot() at least once, or carry a ' +
        '`// snapshot-exempt: <reason>` comment explaining why it has no meaningful visual state to capture.'
    );
    process.exitCode = 1;
    return;
  }

  console.log(`Sentry Snapshot coverage OK (${specFiles.length} spec file(s) checked).`);
}

await main();
