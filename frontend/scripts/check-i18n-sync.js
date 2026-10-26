#!/usr/bin/env node
/**
 * CI script: fails if sw.json is missing any keys present in en.json.
 * Usage: node scripts/check-i18n-sync.js
 */
const en = require('../src/i18n/en.json');
const sw = require('../src/i18n/sw.json');
const { getMissingKeys } = require('./i18n-sync-utils');
const missing = getMissingKeys(en, sw);
const print = (message = '') => process.stdout.write(`${message}\n`);
const printError = (message = '') => process.stderr.write(`${message}\n`);

if (missing.length > 0) {
  printError('❌ sw.json is missing the following keys from en.json:');
  missing.forEach(k => printError(`  - ${k}`));
  process.exit(1);
}

print('✅ sw.json is in sync with en.json');
