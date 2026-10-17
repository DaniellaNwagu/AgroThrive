'use strict';

/**
 * Tests for the bounded size + eviction policy of the escrow state cache in
 * backend/src/routes/escrow.js (GET /api/escrow/:orderId/state).
 *
 * Each test builds a fresh instance of the escrow router (via
 * jest.isolateModules) so the module-level cache Map starts empty, with a
 * lightweight mocked auth middleware (skips JWT/DB lookups) and mocked
 * db/schema + stellar utils so we can control the order lookup and the
 * on-chain escrow response independently per test.
 */

function buildFreshApp({ dbImpl, stellarImpl } = {}) {
  let app;
  let db;
  let stellar;

  jest.isolateModules(() => {
    jest.doMock('../src/middleware/auth', () => (req, res, next) => {
      req.user = { id: 1, role: 'buyer' };
      next();
    });
    jest.doMock('../src/db/schema', () => ({ query: jest.fn() }));
    jest.doMock('../src/utils/stellar', () => ({ getEscrowState: jest.fn() }));

    const express = require('express');
    db = require('../src/db/schema');
    stellar = require('../src/utils/stellar');

    db.query.mockImplementation(
      dbImpl ||
        (() => Promise.resolve({ rows: [{ id: 1, buyer_id: 1, farmer_id: 2 }] }))
    );
    stellar.getEscrowState.mockImplementation(
      stellarImpl ||
        ((orderId) =>
          Promise.resolve({
            status: 'funded',
            buyer: 'GBUYER',
            farmer: 'GFARMER',
            amount: orderId,
            timeoutUnix: null,
            escrowAddress: 'GESCROW' + orderId,
            lastUpdatedLedger: 1,
          }))
    );

    const escrowRouter = require('../src/routes/escrow');
    app = express();
    app.use('/api/escrow', escrowRouter);
  });

  return { app, db, stellar };
}

describe('GET /api/escrow/:orderId/state — cache bounds and eviction', () => {
  // MAX_CACHE_ENTRIES in backend/src/routes/escrow.js
  const MAX_CACHE_ENTRIES = 500;

  jest.setTimeout(30000);

  it('keeps the cache at MAX_CACHE_ENTRIES and evicts the oldest entry once the limit is exceeded', async () => {
    const { app, stellar } = buildFreshApp();
    const request = require('supertest');

    const totalInserted = MAX_CACHE_ENTRIES + 1;
    for (let orderId = 1; orderId <= totalInserted; orderId++) {
      // eslint-disable-next-line no-await-in-loop
      const res = await request(app).get(`/api/escrow/${orderId}/state`);
      expect(res.status).toBe(200);
    }
    expect(stellar.getEscrowState).toHaveBeenCalledTimes(totalInserted);

    // A fresh request for the oldest orderId (1) must have been evicted,
    // so it triggers a brand new getEscrowState call rather than being
    // served from cache.
    stellar.getEscrowState.mockClear();
    const res = await request(app).get('/api/escrow/1/state');
    expect(res.status).toBe(200);
    expect(stellar.getEscrowState).toHaveBeenCalledTimes(1);
    expect(res.body.data.escrow_address).toBe('GESCROW1');

    // The most recently inserted orderId should still be cached: a repeat
    // request must NOT call getEscrowState again.
    stellar.getEscrowState.mockClear();
    const res2 = await request(app).get(`/api/escrow/${totalInserted}/state`);
    expect(res2.status).toBe(200);
    expect(stellar.getEscrowState).toHaveBeenCalledTimes(0);
  });

  it('deletes an expired entry on the next insert rather than retaining it', async () => {
    const { app, stellar } = buildFreshApp();
    const request = require('supertest');

    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
    const start = Date.now();
    jest.setSystemTime(start);

    let res = await request(app).get('/api/escrow/42/state');
    expect(res.status).toBe(200);
    expect(stellar.getEscrowState).toHaveBeenCalledTimes(1);

    // Still within the 30s TTL: should be served from cache.
    jest.setSystemTime(start + 10 * 1000);
    res = await request(app).get('/api/escrow/42/state');
    expect(res.status).toBe(200);
    expect(stellar.getEscrowState).toHaveBeenCalledTimes(1);

    // Past the 30s TTL: the entry has expired, so inserting a new entry
    // (for a different orderId) should purge it rather than keep it around,
    // and re-requesting the expired orderId must trigger a fresh fetch.
    jest.setSystemTime(start + 31 * 1000);
    res = await request(app).get('/api/escrow/43/state');
    expect(res.status).toBe(200);

    res = await request(app).get('/api/escrow/42/state');
    expect(res.status).toBe(200);
    expect(stellar.getEscrowState).toHaveBeenCalledTimes(3);

    jest.useRealTimers();
  });

  it('serves a cached response unchanged, and refetches on an uncached/expired orderId with correct payload', async () => {
    const { app, stellar } = buildFreshApp();
    const request = require('supertest');

    const first = await request(app).get('/api/escrow/7/state');
    expect(first.status).toBe(200);
    expect(first.body).toEqual({
      success: true,
      data: {
        status: 'funded',
        buyer: 'GBUYER',
        farmer: 'GFARMER',
        amount_xlm: 7,
        timeout_at: null,
        escrow_address: 'GESCROW7',
        last_updated_ledger: 1,
      },
    });

    stellar.getEscrowState.mockClear();
    const cachedHit = await request(app).get('/api/escrow/7/state');
    expect(cachedHit.status).toBe(200);
    expect(cachedHit.body).toEqual(first.body);
    expect(stellar.getEscrowState).toHaveBeenCalledTimes(0);

    const fresh = await request(app).get('/api/escrow/8/state');
    expect(fresh.status).toBe(200);
    expect(fresh.body.data.escrow_address).toBe('GESCROW8');
    expect(fresh.body.data.amount_xlm).toBe(8);
  });
});
