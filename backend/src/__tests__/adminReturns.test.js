/**
 * Tests for the admin returns handlers (#108).
 *
 * Covers:
 *   - GET /api/admin/returns (admin-only listing)
 *   - POST /api/admin/returns/:id/approve (refund via sendPayment)
 *   - POST /api/admin/returns/:id/reject
 */

jest.mock('../utils/crypto', () => ({
  decryptUserSecretKey: jest.fn(),
}));

const jwt = require('jsonwebtoken');
const { request, app, mockQuery } = require('../../tests/setup');
// ../utils/stellar is already mocked globally by tests/jest.setup.js; just
// grab the shared mock function so we can control its behavior per test.
const { sendPayment } = jest.requireMock('../utils/stellar');
const { decryptUserSecretKey } = require('../utils/crypto');

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret-for-jest';
const adminToken = jwt.sign({ id: 99, role: 'admin' }, JWT_SECRET, { expiresIn: '1h' });
const buyerToken = jwt.sign({ id: 1, role: 'buyer' }, JWT_SECRET, { expiresIn: '1h' });

const pendingReturn = {
  id: 5,
  status: 'pending',
  order_id: 10,
  buyer_id: 1,
  total_price: 20,
  shipping_cost: 3,
  buyer_wallet: 'GBUYERWALLET',
  farmer_secret: 'encrypted-farmer-secret',
};

// Route every db.query call based on the SQL text, so the active-user check
// performed by the `auth` middleware never collides with route-level queries.
function installDbMock({ returnRow = pendingReturn } = {}) {
  mockQuery.mockReset();
  mockQuery.mockImplementation(async (sql) => {
    if (/SELECT active FROM users/i.test(sql)) {
      return { rows: [{ active: true }], rowCount: 1 };
    }
    if (/UPDATE returns/i.test(sql)) {
      return { rows: [], rowCount: 1 };
    }
    if (/FROM returns r/i.test(sql) || /FROM returns WHERE/i.test(sql)) {
      return { rows: returnRow ? [returnRow] : [], rowCount: returnRow ? 1 : 0 };
    }
    return { rows: [], rowCount: 0 };
  });
}

beforeEach(() => {
  installDbMock();
  sendPayment.mockReset();
  sendPayment.mockResolvedValue('TXHASH_REFUND');
  decryptUserSecretKey.mockReset();
  decryptUserSecretKey.mockResolvedValue('decrypted-farmer-secret');
});

describe('GET /api/admin/returns', () => {
  it('returns 403 for a non-admin user', async () => {
    const res = await request(app)
      .get('/api/admin/returns')
      .set('Authorization', `Bearer ${buyerToken}`);
    expect(res.status).toBe(403);
  });

  it('returns 401 without a token', async () => {
    const res = await request(app).get('/api/admin/returns');
    expect(res.status).toBe(401);
  });

  it('returns the list of returns for an admin', async () => {
    const res = await request(app)
      .get('/api/admin/returns')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe('POST /api/admin/returns/:id/approve', () => {
  it('returns 404 when the return does not exist', async () => {
    installDbMock({ returnRow: null });
    const res = await request(app)
      .post('/api/admin/returns/999/approve')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
    expect(sendPayment).not.toHaveBeenCalled();
  });

  it('returns 400 and does not call sendPayment when the return is not pending', async () => {
    installDbMock({ returnRow: { ...pendingReturn, status: 'approved' } });
    const res = await request(app)
      .post('/api/admin/returns/5/approve')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/approved/);
    expect(sendPayment).not.toHaveBeenCalled();
  });

  it('approves a pending return, refunds total_price + shipping_cost, and marks it approved', async () => {
    const res = await request(app)
      .post('/api/admin/returns/5/approve')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(sendPayment).toHaveBeenCalledTimes(1);
    const callArg = sendPayment.mock.calls[0][0];
    expect(callArg.amount).toBe(pendingReturn.total_price + pendingReturn.shipping_cost);
    expect(callArg.receiverPublicKey).toBe(pendingReturn.buyer_wallet);

    const updateCall = mockQuery.mock.calls.find(([sql]) => /UPDATE returns/i.test(sql));
    expect(updateCall).toBeDefined();
    expect(updateCall[1]).toEqual(['approved', 'TXHASH_REFUND', pendingReturn.id]);
  });

  it('returns 500 and leaves status pending when sendPayment rejects', async () => {
    sendPayment.mockRejectedValueOnce(new Error('insufficient balance'));

    const res = await request(app)
      .post('/api/admin/returns/5/approve')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/^Refund transaction failed: /);

    const updateCall = mockQuery.mock.calls.find(([sql]) => /UPDATE returns/i.test(sql));
    expect(updateCall).toBeUndefined();
  });
});

describe('POST /api/admin/returns/:id/reject', () => {
  it('returns 404 when the return does not exist', async () => {
    installDbMock({ returnRow: null });
    const res = await request(app)
      .post('/api/admin/returns/999/reject')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });

  it('returns 400 when the return is not pending', async () => {
    installDbMock({ returnRow: { ...pendingReturn, status: 'rejected' } });
    const res = await request(app)
      .post('/api/admin/returns/5/reject')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/rejected/);
  });

  it('rejects a pending return', async () => {
    const res = await request(app)
      .post('/api/admin/returns/5/reject')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/rejected/i);
  });
});
