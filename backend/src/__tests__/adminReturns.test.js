/**
 * adminReturns.test.js — #108
 *
 * Tests for GET /api/admin/returns, POST /api/admin/returns/:id/approve,
 * and POST /api/admin/returns/:id/reject in src/routes/admin.js.
 */

jest.mock('../db/schema');
jest.mock('../utils/auditLog', () => ({
  writeAuditLog: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../utils/crypto', () => ({
  decryptUserSecretKey: jest.fn(async (secret) => secret),
}));

// Default: authenticated as an admin. Individual tests override via jest.doMock + resetModules
// where a non-admin user is required.
let mockCurrentUser = { id: 1, role: 'admin' };
jest.mock('../middleware/auth', () => (req, res, next) => {
  req.user = mockCurrentUser;
  next();
});

const db = require('../db/schema');
const { sendPayment } = require('../utils/stellar');
const { decryptUserSecretKey } = require('../utils/crypto');
const { writeAuditLog } = require('../utils/auditLog');
const request = require('supertest');
const app = require('../app');

describe('Admin returns routes', () => {
  beforeEach(() => {
    mockCurrentUser = { id: 1, role: 'admin' };
    decryptUserSecretKey.mockImplementation(async (secret) => secret);
    writeAuditLog.mockResolvedValue(undefined);
  });

  test('non-admin request is rejected with 403', async () => {
    mockCurrentUser = { id: 2, role: 'buyer' };

    const res = await request(app).get('/api/admin/returns');

    expect(res.status).toBe(403);
    expect(sendPayment).not.toHaveBeenCalled();
  });

  test('GET /api/admin/returns lists all return requests', async () => {
    db.query.mockResolvedValueOnce({
      rows: [
        { id: 1, status: 'pending', total_price: 10, shipping_cost: 2, product_name: 'Apples', buyer_name: 'Bob', buyer_email: 'bob@test.com' },
      ],
    });

    const res = await request(app).get('/api/admin/returns');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBe(1);
  });

  test('approve on a missing return id returns 404', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app).post('/api/admin/returns/999/approve');

    expect(res.status).toBe(404);
    expect(sendPayment).not.toHaveBeenCalled();
  });

  test('approve on a non-pending return returns 400 with status in the message', async () => {
    db.query.mockResolvedValueOnce({
      rows: [{ id: 5, status: 'approved', total_price: 10, shipping_cost: 2 }],
    });

    const res = await request(app).post('/api/admin/returns/5/approve');

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('approved');
    expect(sendPayment).not.toHaveBeenCalled();
  });

  test('successful approve calls sendPayment with total_price + shipping_cost and records the tx hash', async () => {
    db.query.mockResolvedValueOnce({
      rows: [{
        id: 7,
        status: 'pending',
        total_price: 20,
        shipping_cost: 5,
        buyer_wallet: 'GBUYER',
        farmer_secret: 'encrypted-farmer-secret',
      }],
    });
    sendPayment.mockResolvedValueOnce('TXHASH123');
    db.query.mockResolvedValueOnce({ rows: [] }); // UPDATE returns ...

    const res = await request(app).post('/api/admin/returns/7/approve');

    expect(res.status).toBe(200);
    expect(sendPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        receiverPublicKey: 'GBUYER',
        amount: 25,
      })
    );
    expect(decryptUserSecretKey).toHaveBeenCalledWith('encrypted-farmer-secret');

    const updateCall = db.query.mock.calls.find((call) =>
      typeof call[0] === 'string' && call[0].includes('UPDATE returns')
    );
    expect(updateCall).toBeTruthy();
    expect(updateCall[1]).toEqual(['approved', 'TXHASH123', 7]);
    expect(res.body.txHash).toBe('TXHASH123');
  });

  test('sendPayment rejection results in a 500 with the Refund transaction failed prefix', async () => {
    db.query.mockResolvedValueOnce({
      rows: [{
        id: 9,
        status: 'pending',
        total_price: 20,
        shipping_cost: 5,
        buyer_wallet: 'GBUYER',
        farmer_secret: 'encrypted-farmer-secret',
      }],
    });
    sendPayment.mockRejectedValueOnce(new Error('insufficient balance'));

    const res = await request(app).post('/api/admin/returns/9/approve');

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Refund transaction failed: insufficient balance');
  });

  test('reject on a missing return id returns 404', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app).post('/api/admin/returns/999/reject');

    expect(res.status).toBe(404);
  });

  test('reject on a non-pending return returns 400 with status in the message', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 3, status: 'rejected' }] });

    const res = await request(app).post('/api/admin/returns/3/reject');

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('rejected');
  });

  test('successful reject marks the return rejected', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 4, status: 'pending' }] });
    db.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app).post('/api/admin/returns/4/reject');

    expect(res.status).toBe(200);
    const updateCall = db.query.mock.calls.find((call) =>
      typeof call[0] === 'string' && call[0].includes('UPDATE returns')
    );
    expect(updateCall[1]).toEqual(['rejected', 4]);
  });
});
