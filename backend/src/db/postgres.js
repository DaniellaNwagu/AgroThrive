const { Pool } = require('pg');

const DEFAULT_STATEMENT_TIMEOUT_MS = 10000;

function resolveStatementTimeout(value) {
  const parsed = parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_STATEMENT_TIMEOUT_MS;
  return parsed;
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  statement_timeout: resolveStatementTimeout(process.env.DB_QUERY_TIMEOUT_POSTGRES),
});

module.exports = pool;
