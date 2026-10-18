#!/usr/bin/env node
/**
 * check-e2e-matrix.js  (#89)
 *
 * frontend/src/test/e2e/theme.e2e.js and browser-compat.e2e.js document a
 * browser project matrix in their file headers and are run via
 * frontend/playwright.config.js (testDir: ./src/test/e2e, testMatch: **\/*.e2e.js).
 * The actual cross-browser CI execution of that matrix happens in
 * .github/workflows/browser-tests.yml, which fans out one job per
 * `matrix.project` and invokes `playwright test --project=<name>`.
 *
 * This script fails when:
 *   - A project named in EXPECTED_PROJECTS is missing from
 *     frontend/playwright.config.js's `projects` list.
 *   - A project named in EXPECTED_PROJECTS is missing from the
 *     browser-tests.yml matrix (so it would silently never run in CI).
 *   - Either documented spec file is missing from the testDir that
 *     playwright.config.js's testMatch actually covers.
 *
 * Update EXPECTED_PROJECTS/EXPECTED_SPECS here when the matrix legitimately
 * changes, so the spec headers, the config, and the workflow stay in sync.
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FRONTEND_ROOT = join(__dirname, '..');
const REPO_ROOT = join(FRONTEND_ROOT, '..');

const EXPECTED_PROJECTS = [
  'chromium',
  'firefox',
  'webkit',
  'edge',
  'mobile-chrome-android',
  'mobile-safari-ios',
  'mobile-safari-ipad',
];

const EXPECTED_SPECS = ['theme.e2e.js', 'browser-compat.e2e.js'];

const PLAYWRIGHT_CONFIG_PATH = join(FRONTEND_ROOT, 'playwright.config.js');
const WORKFLOW_PATH = join(REPO_ROOT, '.github', 'workflows', 'browser-tests.yml');

const errors = [];

// ── playwright.config.js: project names ─────────────────────────────────────
const configSource = readFileSync(PLAYWRIGHT_CONFIG_PATH, 'utf8');
const configProjectNames = [...configSource.matchAll(/name:\s*'([^']+)'/g)].map((m) => m[1]);

for (const project of EXPECTED_PROJECTS) {
  if (!configProjectNames.includes(project)) {
    errors.push(`playwright.config.js is missing expected project "${project}"`);
  }
}

// ── playwright.config.js: testDir/testMatch cover the documented specs ─────
const testDirMatch = configSource.match(/testDir:\s*'([^']+)'/);
const testDir = testDirMatch ? join(FRONTEND_ROOT, testDirMatch[1]) : null;

for (const spec of EXPECTED_SPECS) {
  if (!testDir || !existsSync(join(testDir, spec))) {
    errors.push(`Expected spec "${spec}" was not found under playwright.config.js's testDir ("${testDirMatch ? testDirMatch[1] : 'unknown'}")`);
  }
}

// ── browser-tests.yml: matrix projects ──────────────────────────────────────
const workflowSource = readFileSync(WORKFLOW_PATH, 'utf8');
const workflowProjectNames = [...workflowSource.matchAll(/project:\s*([A-Za-z0-9-]+)/g)].map((m) => m[1]);

for (const project of EXPECTED_PROJECTS) {
  if (!workflowProjectNames.includes(project)) {
    errors.push(`.github/workflows/browser-tests.yml matrix is missing expected project "${project}" — it would never run in CI`);
  }
}

if (errors.length > 0) {
  console.error('[check-e2e-matrix] Browser matrix drift detected:\n');
  for (const error of errors) console.error(`  - ${error}`);
  process.exit(1);
}

console.log('[check-e2e-matrix] theme/browser-compat spec matrix matches playwright.config.js and browser-tests.yml.');
