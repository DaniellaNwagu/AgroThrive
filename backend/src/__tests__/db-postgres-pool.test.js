/**
 * db-postgres-pool.test.js — #100
 *
 * Validates that the Postgres pool's statement_timeout is parsed safely:
 * non-numeric, zero, or negative env values fall back to the 10000ms default,
 * while a valid positive value is passed through unchanged.
 */

jest.mock('pg', () => ({ Pool: jest.fn() }));

function loadPoolWithEnv(value) {
  jest.resetModules();
  const prev = process.env.DB_QUERY_TIMEOUT_POSTGRES;
  if (value === undefined) {
    delete process.env.DB_QUERY_TIMEOUT_POSTGRES;
  } else {
    process.env.DB_QUERY_TIMEOUT_POSTGRES = value;
  }
  require('../db/postgres');
  process.env.DB_QUERY_TIMEOUT_POSTGRES = prev;
  // Re-require after resetModules() re-evaluates the mocked 'pg' module factory,
  // producing a fresh Pool jest.fn() each time.
  return require('pg').Pool;
}

describe('Postgres pool statement_timeout', () => {
  test('falls back to 10000 for a non-numeric value', () => {
    const Pool = loadPoolWithEnv('abc');
    expect(Pool).toHaveBeenCalledWith(
      expect.objectContaining({ statement_timeout: 10000 })
    );
  });

  test('falls back to 10000 for 0', () => {
    const Pool = loadPoolWithEnv('0');
    expect(Pool).toHaveBeenCalledWith(
      expect.objectContaining({ statement_timeout: 10000 })
    );
  });

  test('falls back to 10000 for a negative value', () => {
    const Pool = loadPoolWithEnv('-5');
    expect(Pool).toHaveBeenCalledWith(
      expect.objectContaining({ statement_timeout: 10000 })
    );
  });

  test('passes through a valid positive value unchanged', () => {
    const Pool = loadPoolWithEnv('25000');
    expect(Pool).toHaveBeenCalledWith(
      expect.objectContaining({ statement_timeout: 25000 })
    );
  });
});
