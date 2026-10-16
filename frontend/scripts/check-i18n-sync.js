#!/usr/bin/env node
/**
 * CI script: fails if sw.json is missing any keys present in en.json.
 * Usage: node scripts/check-i18n-sync.js
 */
const en = require('../src/i18n/en.json');
const sw = require('../src/i18n/sw.json');
const { getMissingKeys } = require('./i18n-sync-utils');
const missing = getMissingKeys(en, sw);

if (missing.length > 0) {
  console.error('❌ sw.json is missing the following keys from en.json:');
  missing.forEach(k => console.error(`  - ${k}`));
  process.exit(1);
}

console.log('✅ sw.json is in sync with en.json');
