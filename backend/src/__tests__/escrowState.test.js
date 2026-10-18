/**
 * escrowState.test.js — Issue #113
 *
 * Covers backend/src/routes/escrow.js's GET /api/escrow/:orderId/state:
 *   - invalid/unknown orderId
 *   - access control (admin/buyer/farmer only)
 *   - the module-level cache's 30s TTL (hit, then re-fetch after expiry)
 *   - the rpc_error path
 *
 * Each test uses its own orderId so the shared, module-level cache Map in
 * escrow.js can never leak state between tests — no jest.resetModules()
 * needed as long as no two tests reuse an id.
 */

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-for-jest';
process.env.NODE_ENV = 'test';

const jwt = require('jsonwebtoken');
const request = require('supertest');
const app = require('../app');

jest.mock('../middleware/auth', () => {
  const jwt = require('jsonwebtoken');
  return (req, res, next) => {
    const header = req.headers['authorization'];
    if (!header) return res.status(401).json({ error: 'unauthorized' });
    try {
      req.user = jwt.verify(header.replace('Bearer ', ''), process.env.JWT_SECRET);
      next();
    } catch {
      res.status(401).json({ error: 'unauthorized' });
    }
  };
});

const mockDb = jest.requireMock('../db/schema');
const stellar = jest.requireMock('../utils/stellar');

const SECRET = process.env.JWT_SECRET;
const buyerToken = jwt.sign({ id: 2, role: 'buyer' }, SECRET);
const farmerToken = jwt.sign({ id: 1, role: 'farmer' }, SECRET);
const adminToken = jwt.sign({ id: 99, role: 'admin' }, SECRET);
const strangerToken = jwt.sign({ id: 404, role: 'buyer' }, SECRET);

const ORDER_ROW = { id: 0, buyer_id: 2, farmer_id: 1 };

function mockOrderRow(orderId) {
  mockDb.query = jest.fn().mockResolvedValue({ rows: [{ ...ORDER_ROW, id: orderId }], rowCount: 1 });
}

const ESCROW_PAYLOAD = {
  status: 'funded',
  buyer: 'GBUYER',
  farmer: 'GFARMER',
  amount: 20,
  timeoutUnix: 1_700_000_000,
  escrowAddress: 'GESCROW',
  lastUpdatedLedger: 1,
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.useRealTimers();
  // escrow.js does `const { getEscrowState } = require('../utils/stellar')`
  // — a destructure at import time — so reassigning `stellar.getEscrowState`
  // to a brand new jest.fn() here would be invisible to the route (it holds
  // the original function reference). Mutating the existing mock's
  // resolved value instead reaches it.
  stellar.getEscrowState.mockResolvedValue({ ...ESCROW_PAYLOAD });
  mockDb.query = jest.fn().mockResolvedValue({ rows: [], rowCount: 0 });
});

describe('GET /api/escrow/:orderId/state — validation', () => {
  // Note: '1.5' is deliberately not included — parseInt('1.5', 10) === 1,
  // a valid positive integer, so the route treats it as orderId 1 rather
  // than rejecting it. That's the route's actual (lenient) behavior, not
  // a gap this test suite should paper over.
  it.each([['abc'], ['0'], ['-5']])(
    'rejects orderId=%s with 400 invalid_order_id',
    async (orderId) => {
      const res = await request(app)
        .get(`/api/escrow/${orderId}/state`)
        .set('Authorization', `Bearer ${buyerToken}`);
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('invalid_order_id');
      expect(stellar.getEscrowState).not.toHaveBeenCalled();
    },
  );

  it('returns 404 order_not_found for an unknown order', async () => {
    mockDb.query = jest.fn().mockResolvedValue({ rows: [], rowCount: 0 });
    const res = await request(app)
      .get('/api/escrow/1001/state')
      .set('Authorization', `Bearer ${buyerToken}`);
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('order_not_found');
    expect(stellar.getEscrowState).not.toHaveBeenCalled();
  });
});

describe('GET /api/escrow/:orderId/state — access control', () => {
  it('forbids a user who is neither buyer, farmer nor admin, without calling getEscrowState', async () => {
    mockOrderRow(1002);
    const res = await request(app)
      .get('/api/escrow/1002/state')
      .set('Authorization', `Bearer ${strangerToken}`);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('forbidden');
    expect(stellar.getEscrowState).not.toHaveBeenCalled();
  });

  it('allows the buyer and returns the mapped payload with an ISO timeout_at', async () => {
    mockOrderRow(1003);
    const res = await request(app)
      .get('/api/escrow/1003/state')
      .set('Authorization', `Bearer ${buyerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      status: 'funded',
      buyer: 'GBUYER',
      farmer: 'GFARMER',
      amount_xlm: 20,
      escrow_address: 'GESCROW',
      last_updated_ledger: 1,
    });
    expect(res.body.data.timeout_at).toBe(new Date(ESCROW_PAYLOAD.timeoutUnix * 1000).toISOString());
    expect(stellar.getEscrowState).toHaveBeenCalledTimes(1);
    expect(stellar.getEscrowState).toHaveBeenCalledWith(1003);
  });

  it('allows the farmer', async () => {
    mockOrderRow(1004);
    const res = await request(app)
      .get('/api/escrow/1004/state')
      .set('Authorization', `Bearer ${farmerToken}`);
    expect(res.status).toBe(200);
    expect(stellar.getEscrowState).toHaveBeenCalledTimes(1);
  });

  it('allows an admin regardless of buyer/farmer id', async () => {
    mockOrderRow(1005);
    const res = await request(app)
      .get('/api/escrow/1005/state')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(stellar.getEscrowState).toHaveBeenCalledTimes(1);
  });

  it('maps a null timeoutUnix to a null timeout_at', async () => {
    mockOrderRow(1006);
    stellar.getEscrowState.mockResolvedValueOnce({ ...ESCROW_PAYLOAD, timeoutUnix: null });
    const res = await request(app)
      .get('/api/escrow/1006/state')
      .set('Authorization', `Bearer ${buyerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.timeout_at).toBeNull();
  });
});

describe('GET /api/escrow/:orderId/state — cache TTL', () => {
  it('serves a second request inside the 30s TTL from cache (getEscrowState called once)', async () => {
    mockOrderRow(1007);

    const first = await request(app)
      .get('/api/escrow/1007/state')
      .set('Authorization', `Bearer ${buyerToken}`);
    expect(first.status).toBe(200);

    const second = await request(app)
      .get('/api/escrow/1007/state')
      .set('Authorization', `Bearer ${buyerToken}`);
    expect(second.status).toBe(200);
    expect(second.body.data).toEqual(first.body.data);

    expect(stellar.getEscrowState).toHaveBeenCalledTimes(1);
  });

  it('re-fetches after the TTL (30s) has elapsed', async () => {
    jest.useFakeTimers();
    mockOrderRow(1008);

    const first = await request(app)
      .get('/api/escrow/1008/state')
      .set('Authorization', `Bearer ${buyerToken}`);
    expect(first.status).toBe(200);
    expect(stellar.getEscrowState).toHaveBeenCalledTimes(1);

    // Advance just past the 30s TTL defined in escrow.js.
    jest.advanceTimersByTime(30 * 1000 + 1);

    const second = await request(app)
      .get('/api/escrow/1008/state')
      .set('Authorization', `Bearer ${buyerToken}`);
    expect(second.status).toBe(200);
    expect(stellar.getEscrowState).toHaveBeenCalledTimes(2);

    jest.useRealTimers();
  });
});

describe('GET /api/escrow/:orderId/state — rpc_error path', () => {
  it('returns 500 rpc_error when getEscrowState rejects', async () => {
    mockOrderRow(1009);
    stellar.getEscrowState.mockRejectedValueOnce(new Error('soroban rpc unavailable'));

    const res = await request(app)
      .get('/api/escrow/1009/state')
      .set('Authorization', `Bearer ${buyerToken}`);

    expect(res.status).toBe(500);
    expect(res.body.code).toBe('rpc_error');
    expect(res.body.message).toContain('soroban rpc unavailable');
  });

  it('returns 404 escrow_not_found when getEscrowState resolves falsy', async () => {
    mockOrderRow(1010);
    stellar.getEscrowState.mockResolvedValueOnce(null);

    const res = await request(app)
      .get('/api/escrow/1010/state')
      .set('Authorization', `Bearer ${buyerToken}`);

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('escrow_not_found');
  });
});
