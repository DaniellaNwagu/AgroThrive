'use strict';

/**
 * Tests for the XLM/USDC order-book cache and stale-fallback behaviour in
 * backend/src/routes/market.js (getXlmUsdc, mounted on /xlm-usdc and /).
 *
 * Each test requires a fresh instance of the market router (via
 * jest.isolateModules) so the module-level `_cache` starts cold, with
 * getOrderBook (backend/src/utils/stellar) mocked so we can control
 * success/failure deterministically, and fake timers to cross the
 * 60s CACHE_TTL boundary.
 */

function buildFreshRouter(getOrderBookImpl) {
  let router;
  let stellar;

  jest.isolateModules(() => {
    jest.doMock('../utils/stellar', () => ({
      getOrderBook: jest.fn(),
    }));
    jest.doMock('../db/schema', () => ({
      query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    }));

    stellar = require('../utils/stellar');
    stellar.getOrderBook.mockImplementation(
      getOrderBookImpl ||
        (() =>
          Promise.resolve({
            bids: [{ price: '0.10', amount: '100' }],
            asks: [{ price: '0.11', amount: '200' }],
            base: 'XLM',
            counter: 'USDC',
          }))
    );

    router = require('../routes/market');
  });

  return { router, stellar };
}

function buildApp(router) {
  const express = require('express');
  const app = express();
  app.use('/api/market', router);
  return app;
}

describe('GET /api/market/xlm-usdc — order book cache and stale fallback', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('cold-cache request calls getOrderBook once and responds cached:false', async () => {
    const { router, stellar } = buildFreshRouter();
    const request = require('supertest');
    const app = buildApp(router);

    const res = await request(app).get('/api/market/xlm-usdc');

    expect(res.status).toBe(200);
    expect(res.body.cached).toBe(false);
    expect(res.body.base).toBe('XLM');
    expect(stellar.getOrderBook).toHaveBeenCalledTimes(1);
  });

  it('a second request within the TTL does not call getOrderBook again and responds cached:true', async () => {
    const { router, stellar } = buildFreshRouter();
    const request = require('supertest');
    const app = buildApp(router);

    const first = await request(app).get('/api/market/xlm-usdc');
    expect(first.body.cached).toBe(false);

    const second = await request(app).get('/api/market/xlm-usdc');
    expect(second.status).toBe(200);
    expect(second.body.cached).toBe(true);
    expect(stellar.getOrderBook).toHaveBeenCalledTimes(1);
  });

  it('a request after the TTL expires calls getOrderBook again', async () => {
    const { router, stellar } = buildFreshRouter();
    const request = require('supertest');
    const app = buildApp(router);

    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
    const start = Date.now();
    jest.setSystemTime(start);

    const first = await request(app).get('/api/market/xlm-usdc');
    expect(first.body.cached).toBe(false);
    expect(stellar.getOrderBook).toHaveBeenCalledTimes(1);

    // Still within the 60s TTL.
    jest.setSystemTime(start + 30 * 1000);
    const withinTtl = await request(app).get('/api/market/xlm-usdc');
    expect(withinTtl.body.cached).toBe(true);
    expect(stellar.getOrderBook).toHaveBeenCalledTimes(1);

    // Past the 60s TTL: must re-fetch.
    jest.setSystemTime(start + 61 * 1000);
    const afterTtl = await request(app).get('/api/market/xlm-usdc');
    expect(afterTtl.status).toBe(200);
    expect(afterTtl.body.cached).toBe(false);
    expect(stellar.getOrderBook).toHaveBeenCalledTimes(2);
  });

  it('on fetch failure with a warm cache, responds with the previous data plus stale:true', async () => {
    const { router, stellar } = buildFreshRouter();
    const request = require('supertest');
    const app = buildApp(router);

    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
    const start = Date.now();
    jest.setSystemTime(start);

    const warm = await request(app).get('/api/market/xlm-usdc');
    expect(warm.body.cached).toBe(false);
    const previousData = { bids: warm.body.bids, asks: warm.body.asks, base: warm.body.base, counter: warm.body.counter };

    // Advance past the 60s TTL so the next request attempts a real re-fetch
    // (otherwise it would be served straight from the still-fresh cache).
    jest.setSystemTime(start + 61 * 1000);
    stellar.getOrderBook.mockRejectedValueOnce(new Error('DEX down'));
    const res = await request(app).get('/api/market/xlm-usdc');

    expect(res.status).toBe(200);
    expect(res.body.cached).toBe(true);
    expect(res.body.stale).toBe(true);
    expect(res.body.bids).toEqual(previousData.bids);
    expect(res.body.asks).toEqual(previousData.asks);
    expect(res.body.base).toBe(previousData.base);
    expect(res.body.counter).toBe(previousData.counter);
  });

  it('on fetch failure with a cold cache, responds 503 with code dex_unavailable', async () => {
    const { router } = buildFreshRouter(() => Promise.reject(new Error('DEX down')));
    const request = require('supertest');
    const app = buildApp(router);

    const res = await request(app).get('/api/market/xlm-usdc');

    expect(res.status).toBe(503);
    expect(res.body.code).toBe('dex_unavailable');
  });

  it('is also reachable via the bare "/" mount', async () => {
    const { router, stellar } = buildFreshRouter();
    const request = require('supertest');
    const app = buildApp(router);

    const res = await request(app).get('/api/market/');

    expect(res.status).toBe(200);
    expect(res.body.cached).toBe(false);
    expect(stellar.getOrderBook).toHaveBeenCalledTimes(1);
  });
});
