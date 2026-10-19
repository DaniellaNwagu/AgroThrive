#!/usr/bin/env node
/**
 * migrate.js — CLI migration runner
 *
 * Usage:
 *   npm run migrate              # apply all pending migrations
 *   npm run migrate:rollback     # revert the last applied migration
 *
 * Migration files: backend/migrations/NNN_description.sql
 * Rollback files:  backend/migrations/NNN_description.undo.sql
 *
 * Applied migrations are tracked in a `migrations` table.
 * Running migrate twice is safe — already-applied migrations are skipped.
 */

require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const fs = require('fs');
const path = require('path');
const { runMigrations, ensureMigrationsTable, getApplied } = require('./src/db/migrationRunner');

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');
const USE_POSTGRES = !!process.env.DATABASE_URL;

/**
 * Build a database adapter for the active dialect.
 *
 * Accepts an optional `dbPath` (SQLite only) or an injected `Database`
 * instance so tests can supply an in-memory database instead of the
 * hardcoded `market.db` file.
 */
function getAdapter(options = {}) {
  const { dbPath, database } = options;
  if (USE_POSTGRES) {
    const { Pool } = require('pg');
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    return {
      async query(sql, params = []) {
        return pool.query(sql, params);
      },
      async exec(sql) {
        return pool.query(sql);
      },
      async close() {
        await pool.end();
      },
      placeholder: (i) => `$${i}`,
      isPostgres: true,
    };
  } else {
    const Database = require('better-sqlite3');
    const db = database || new Database(dbPath || path.join(__dirname, 'market.db'));
    return {
      async query(sql, params = []) {
        if (/^\s*(SELECT|WITH)/i.test(sql)) {
          return { rows: db.prepare(sql).all(...params) };
        }
        const info = db.prepare(sql).run(...params);
        return { rows: [], rowCount: info.changes };
      },
      async exec(sql) {
        db.exec(sql);
      },
      async close() {
        db.close();
      },
      placeholder: () => '?',
      isPostgres: false,
    };
  }
}

/**
 * Resolve the undo file to use for a given applied migration.
 *
 * Prefers a dialect-specific undo file (`NNN_description.undo.postgres` or
 * `NNN_description.undo.sqlite`) and falls back to the generic
 * `NNN_description.undo.sql`. Logs and exits with code 1 when neither exists,
 * since there is no safe way to roll the migration back.
 */
function resolveUndoPath(migrationsDir, lastMigration, dialect) {
  const dialectUndoPath = path.join(
    migrationsDir,
    `${lastMigration.slice(0, -4)}.undo.${dialect}`
  );
  if (fs.existsSync(dialectUndoPath)) {
    return dialectUndoPath;
  }
  const undoName = lastMigration.replace(/\.sql$/, '.undo.sql');
  const undoPath = path.join(migrationsDir, undoName);
  if (!fs.existsSync(undoPath)) {
    console.error(`[migrate] No rollback file found: ${undoName}`);
    process.exit(1);
  }
  return undoPath;
}

async function rollback() {
  const db = await getAdapter();
  await ensureMigrationsTable(db);
  const applied = await getApplied(db);

  if (applied.size === 0) {
    console.log('[migrate] Nothing to roll back.');
    await db.close();
    return;
  }

  const last = [...applied].sort().at(-1);
  const dialect = db.isPostgres ? 'postgres' : 'sqlite';
  const undoPath = resolveUndoPath(MIGRATIONS_DIR, last, dialect);

  console.log(`[migrate] Rolling back ${last}...`);
  const sql = fs.readFileSync(undoPath, 'utf8');
  await db.exec(sql);

  const p = db.placeholder(1);
  await db.query(`DELETE FROM migrations WHERE name = ${p}`, [last]);
  console.log(`[migrate] ✓ Rolled back ${last}`);
  await db.close();
}

async function migrate() {
  const db = await getAdapter();
  await runMigrations(db);
  await db.close();
}

if (require.main === module) {
  const command = process.argv[2];
  (command === 'rollback' ? rollback() : migrate()).catch((err) => {
    console.error('[migrate] Error:', err.message);
    process.exit(1);
  });
}

module.exports = { getAdapter, resolveUndoPath, rollback, migrate };
