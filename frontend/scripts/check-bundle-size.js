#!/usr/bin/env node
/**
 * check-bundle-size.js  (#1056)
 *
 * Reads the Vite production build output from dist/assets/, measures the
 * total size of all JS chunks and the combined initial-load chunk size
 * (vendor + index), then fails with a non-zero exit code when either budget
 * is exceeded.
 *
 * Budgets (uncompressed bytes):
 *   INITIAL_BUDGET_KB  – vendor + index chunks that every page must download
 *   TOTAL_BUDGET_KB    – all JS chunks combined
 *
 * Override budgets for a deliberate one-off increase:
 *   BUNDLE_INITIAL_BUDGET_KB=600 BUNDLE_TOTAL_BUDGET_KB=6000 node scripts/check-bundle-size.js
 */

import { readdirSync, statSync, writeFileSync } from 'fs';
import { join, basename } from 'path';
import { classifyChunks, exceedsBudget, parseBudget } from './bundle-size-utils.js';

const DIST_ASSETS = join(process.cwd(), 'dist', 'assets');
const print = (message = '') => process.stdout.write(`${message}\n`);
const printError = (message = '') => process.stderr.write(`${message}\n`);

// Budgets in kibibytes (1 KiB = 1024 bytes).
let INITIAL_BUDGET_KB;
let TOTAL_BUDGET_KB;
try {
  INITIAL_BUDGET_KB = parseBudget('BUNDLE_INITIAL_BUDGET_KB', process.env.BUNDLE_INITIAL_BUDGET_KB, 500);
  TOTAL_BUDGET_KB = parseBudget('BUNDLE_TOTAL_BUDGET_KB', process.env.BUNDLE_TOTAL_BUDGET_KB, 5000);
} catch (error) { printError(`[bundle-size] ${error.message}`); process.exit(1); }

function kib(bytes) {
  return (bytes / 1024).toFixed(1);
}

let files;
try {
  files = readdirSync(DIST_ASSETS);
} catch {
  printError('[bundle-size] dist/assets not found — run "npm run build" first.');
  process.exit(1);
}

const jsFiles = files
  .filter(f => f.endsWith('.js'))
  .map(f => ({ name: f, size: statSync(join(DIST_ASSETS, f)).size }))
  .sort((a, b) => b.size - a.size);

if (jsFiles.length === 0) {
  printError('[bundle-size] No JS files found in dist/assets.');
  process.exit(1);
}

// Initial chunks = vendor chunk + index/main chunk (everything a user must
// download before React can render, regardless of which route they visit).
let initialChunks; let initialBytes; let totalBytes;
try { ({ initial: initialChunks, initialBytes, totalBytes } = classifyChunks(jsFiles)); }
catch (error) { printError(`[bundle-size] ${error.message}`); process.exit(1); }

// ── Report ──────────────────────────────────────────────────────────────────
print('\n── Bundle size report ──────────────────────────────────────');
print('Chunk                                        Size');
print('─'.repeat(52));
for (const f of jsFiles) {
  const flag = initialChunks.some(c => c.name === f.name) ? ' ◀ initial' : '';
  print(`  ${basename(f.name).padEnd(42)} ${kib(f.size).padStart(7)} KiB${flag}`);
}
print('─'.repeat(52));
print(`  Initial load total${' '.repeat(23)} ${kib(initialBytes).padStart(7)} KiB  (budget: ${INITIAL_BUDGET_KB} KiB)`);
print(`  All chunks total  ${' '.repeat(23)} ${kib(totalBytes).padStart(7)} KiB  (budget: ${TOTAL_BUDGET_KB} KiB)`);
print();

// ── Write GitHub step summary if running in CI ───────────────────────────────
const summaryFile = process.env.GITHUB_STEP_SUMMARY;
if (summaryFile) {
  const rows = jsFiles
    .map(f => `| \`${f.name}\` | ${kib(f.size)} KiB | ${initialChunks.some(c => c.name === f.name) ? '✅ initial' : ''} |`)
    .join('\n');
  const md = [
    '## 📦 Frontend Bundle Size Report',
    '',
    `| Chunk | Size | Initial? |`,
    `|-------|------|----------|`,
    rows,
    '',
    `**Initial load**: ${kib(initialBytes)} KiB (budget: ${INITIAL_BUDGET_KB} KiB)`,
    `**Total JS**: ${kib(totalBytes)} KiB (budget: ${TOTAL_BUDGET_KB} KiB)`,
  ].join('\n');
  writeFileSync(summaryFile, md + '\n', { flag: 'a' });
}

// ── Budget enforcement ───────────────────────────────────────────────────────
let failed = false;

if (exceedsBudget(initialBytes, INITIAL_BUDGET_KB)) {
  printError(
    `[bundle-size] ❌ Initial chunk ${kib(initialBytes)} KiB exceeds budget of ${INITIAL_BUDGET_KB} KiB.`
  );
  printError('   To raise the budget deliberately, set BUNDLE_INITIAL_BUDGET_KB in the CI workflow.');
  failed = true;
} else {
  print(`[bundle-size] ✅ Initial chunk ${kib(initialBytes)} KiB is within budget (${INITIAL_BUDGET_KB} KiB).`);
}

if (exceedsBudget(totalBytes, TOTAL_BUDGET_KB)) {
  printError(
    `[bundle-size] ❌ Total bundle ${kib(totalBytes)} KiB exceeds budget of ${TOTAL_BUDGET_KB} KiB.`
  );
  printError('   To raise the budget deliberately, set BUNDLE_TOTAL_BUDGET_KB in the CI workflow.');
  failed = true;
} else {
  print(`[bundle-size] ✅ Total bundle ${kib(totalBytes)} KiB is within budget (${TOTAL_BUDGET_KB} KiB).`);
}

process.exit(failed ? 1 : 0);
