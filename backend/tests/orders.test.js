const jwt = require('jsonwebtoken');

// These tests script db.query for the order flow itself; the auth and email
// verification layers have their own suites.
jest.mock('../src/middleware/auth', () => require('./helpers/jwtOnlyAuth'));
jest.mock('../src/middleware/requireEmailVerified', () => (req, res, next) => next());

const { randomUUID } = require('crypto');
const { request, app, mockQuery, mockDb } = require('./setup');
const stellar = jest.requireMock('../src/utils/stellar');

beforeEach(() => {
  jest.resetAllMocks();
  mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
  stellar.getBalance.mockResolvedValue(1000);
  stellar.sendPayment.mockResolvedValue('TXHASH123');
  stellar.createClaimableBalance.mockResolvedValue({
    txHash: 'ESCROW_TX',
    balanceId: 'BALANCE_ID_001',
  });
  stellar.claimBalance.mockResolvedValue('CLAIM_TX_001');
  stellar.getPlatformFeeInfo.mockReturnValue({ feePercent: 0, feeAmount: 0, farmerAmount: 10 });
  stellar.generatePaymentLink.mockReturnValue('web+stellar:pay?destination=GFARMER');
  stellar.mintRewardTokens.mockResolvedValue({});
  const idempotency = jest.requireMock('../src/utils/idempotency');
  idempotency.claimIdempotencyKey.mockResolvedValue({ status: 'claimed' });
  idempotency.releaseIdempotencyKey.mockResolvedValue(undefined);
  idempotency.cacheResponse.mockResolvedValue(undefined);
  const geocheck = jest.requireMock('../src/utils/geocheck');
  geocheck.checkGeoFence.mockResolvedValue({ allowed: true });
  geocheck.checkCoordinateGeoFence.mockReturnValue({ allowed: true });
});

const SECRET = process.env.JWT_SECRET || 'test-secret-for-jest';
const farmerToken = jwt.sign({ id: 1, role: 'farmer' }, SECRET);
const buyerToken = jwt.sign({ id: 2, role: 'buyer' }, SECRET);

const product = {
  id: 10,
  name: 'Apples',
  price: 5.0,
  quantity: 10,
  farmer_id: 1,
  farmer_wallet: 'GFARMER',
};
const buyer = {
  id: 2,
  name: 'Bob',
  email: 'bob@test.com',
  stellar_secret_key: 'SSECRET',
  stellar_public_key: 'GBUYER',
  referred_by: null,
  referral_bonus_sent: 0,
};

/**
 * Answers order-flow queries by SQL shape rather than call order. `overrides`
 * can replace any answer, keyed by the same names used below.
 */
function mockOrderFlow({ prod = product, orderId = 99, bundleItems: items, coupon, ...overrides } = {}) {
  const answers = {
    product: { rows: [prod], rowCount: 1 },
    buyer: { rows: [buyer], rowCount: 1 },
    bundle: { rows: [], rowCount: 0 },
    bundleItems: { rows: items || [], rowCount: (items || []).length },
    lockedProducts: {
      rows: (items || []).map((i) => ({ id: i.product_id, name: i.product_name, quantity: i.stock })),
    },
    reserve: { rows: [{ quantity: prod.quantity - 1 }], rowCount: 1 },
    coupon: { rows: coupon ? [coupon] : [], rowCount: coupon ? 1 : 0 },
    ...overrides,
  };
  let nextOrderId = orderId;
  mockQuery.mockImplementation(async (sql) => {
    if (sql.includes('FROM products p JOIN users u')) return answers.product;
    if (sql.startsWith('SELECT * FROM users WHERE id')) return answers.buyer;
    if (sql.includes('FROM bundles b JOIN users u')) return answers.bundle;
    if (sql.includes('FROM bundle_items bi')) return answers.bundleItems;
    if (sql.startsWith('SELECT id, name, quantity FROM products WHERE id IN')) return answers.lockedProducts;
    if (sql.includes('FROM price_tiers')) return { rows: [], rowCount: 0 };
    if (sql.startsWith('SELECT price FROM products')) return { rows: [{ price: prod.price }], rowCount: 1 };
    if (sql.includes('COUNT(DISTINCT product_id)')) return { rows: [{ cnt: '0' }], rowCount: 1 };
    if (sql.includes('SET quantity = quantity - $1\n')) return answers.reserve;
    if (sql.includes('FROM coupons WHERE code')) return answers.coupon;
    if (sql.includes('FROM coupon_uses')) return { rows: [{ cnt: 0 }], rowCount: 1 };
    if (sql.includes('INSERT INTO orders')) return { rows: [{ id: nextOrderId++ }], rowCount: 1 };
    if (sql.startsWith('SELECT id, name, email, stellar_public_key FROM users')) {
      return { rows: [{ id: 1, name: 'Farmer', email: 'f@test.com' }], rowCount: 1 };
    }
    if (sql.startsWith('SELECT quantity, low_stock_threshold')) {
      return { rows: [{ quantity: 8, low_stock_threshold: 5, low_stock_alerted: 0 }], rowCount: 1 };
    }
    if (sql.includes('RETURNING')) return { rows: [{ id: 1, used_count: 1 }], rowCount: 1 }; // coupon reservation
    return { rows: [], rowCount: 1 };
  });
}

function postOrder(body, { token = buyerToken, key = randomUUID() } = {}) {
  return request(app)
    .post('/api/orders')
    .set('X-Idempotency-Key', key)
    .set('Authorization', `Bearer ${token}`)
    .send(body);
}

describe('POST /api/orders idempotency', () => {
  const idempotency = jest.requireMock('../src/utils/idempotency');

  it('first request processes normally and caches the success response', async () => {
    mockOrderFlow({ orderId: 99 });
    stellar.sendPayment.mockResolvedValue('TXHASH_OK');
    const key = randomUUID();

    const res = await postOrder({ product_id: 10, quantity: 2 }, { key });

    expect(res.status).toBe(201);
    expect(res.body.orderId).toBe(99);
    expect(res.body.status).toBe('paid');
    expect(idempotency.claimIdempotencyKey).toHaveBeenCalledWith(2, key);
    expect(idempotency.cacheResponse).toHaveBeenCalledWith(
      key,
      expect.objectContaining({ orderId: 99, status: 'paid', _status: 201 }),
      undefined,
      2
    );
  });

  it('second request with same key returns the cached response without paying again', async () => {
    idempotency.claimIdempotencyKey.mockResolvedValueOnce({
      status: 'cached',
      response: { success: true, orderId: 99, status: 'paid', txHash: 'TXHASH_OK', totalPrice: 10, _status: 201 },
    });

    const res = await postOrder({ product_id: 10, quantity: 2 });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ orderId: 99, status: 'paid', txHash: 'TXHASH_OK', totalPrice: 10 });
    expect(stellar.sendPayment).not.toHaveBeenCalled();
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('rejects a concurrent request while the first is still in progress', async () => {
    idempotency.claimIdempotencyKey.mockResolvedValueOnce({ status: 'in_progress' });

    const res = await postOrder({ product_id: 10, quantity: 2 });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('idempotency_in_progress');
  });

  it('returns 402 for insufficient balance without reserving stock', async () => {
    mockOrderFlow();
    stellar.getBalance.mockResolvedValue(0);

    const res = await postOrder({ product_id: 10, quantity: 1 });

    expect(res.status).toBe(402);
    expect(res.body.code).toBe('insufficient_balance');
    expect(mockQuery.mock.calls.some(([sql]) => sql.includes('quantity = quantity -'))).toBe(false);
  });
});

describe('POST /api/orders with bundle', () => {
  const bundle = {
    id: 100,
    farmer_id: 1,
    name: 'Veggie Bundle',
    price: 15.0,
    farmer_wallet: 'GFARMER',
  };

  const bundleItems = [
    { product_id: 10, quantity: 2, product_name: 'Apples', stock: 10, product_price: 5.0 },
    { product_id: 11, quantity: 1, product_name: 'Carrots', stock: 5, product_price: 10.0 },
  ];
  const bundleFound = { rows: [bundle], rowCount: 1 };

  it('buyer places a bundle order successfully', async () => {
    stellar.sendPayment.mockResolvedValueOnce('TXHASH_BUNDLE');
    mockOrderFlow({ bundle: bundleFound, bundleItems, orderId: 101 });

    const res = await postOrder({ bundle_id: 100 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.status).toBe('paid');
    expect(res.body.bundleId).toBe(100);
    expect(res.body.orderIds).toEqual([101, 102]);
    expect(res.body.bundlePrice).toBe(15.0);
    expect(res.body.individualTotal).toBe(20.0); // 5*2 + 10*1
    expect(res.body.savings).toBe(5.0);
  });

  it('rejects bundle order with insufficient stock', async () => {
    const insufficientStockItems = [
      { product_id: 10, quantity: 2, product_name: 'Apples', stock: 1, product_price: 5.0 },
      { product_id: 11, quantity: 1, product_name: 'Carrots', stock: 5, product_price: 10.0 },
    ];
    mockOrderFlow({ bundle: bundleFound, bundleItems: insufficientStockItems });

    const res = await postOrder({ bundle_id: 100 });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('insufficient_stock');
    expect(res.body.message).toContain('Insufficient stock for "Apples"');
  });

  it('returns 409 when stock runs out between the check and the locked re-read', async () => {
    mockOrderFlow({
      bundle: bundleFound,
      bundleItems,
      lockedProducts: { rows: [{ id: 10, name: 'Apples', quantity: 0 }, { id: 11, name: 'Carrots', quantity: 5 }] },
    });

    const res = await postOrder({ bundle_id: 100 });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('insufficient_stock');
    expect(res.body.outOfStock).toEqual([
      { product_id: 10, product_name: 'Apples', available: 0, required: 2 },
    ]);
    expect(stellar.sendPayment).not.toHaveBeenCalled();
  });

  it('rejects bundle order for non-existent bundle', async () => {
    mockOrderFlow();

    const res = await postOrder({ bundle_id: 999 });

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('not_found');
  });

  it('rejects order with both product_id and bundle_id', async () => {
    const res = await postOrder({ product_id: 10, quantity: 2, bundle_id: 100 });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('validation_error');
  });

  it('rejects order with neither product_id nor bundle_id', async () => {
    const res = await postOrder({});

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('validation_error');
  });

  it('applies coupon discount to bundle order', async () => {
    mockDb.isPostgres = false;
    stellar.sendPayment.mockResolvedValueOnce('TXHASH_BUNDLE');
    const coupon = {
      id: 50,
      code: 'BUNDLE20',
      discount_type: 'percent',
      discount_value: 20,
      max_uses_per_user: 10,
    };
    mockOrderFlow({ bundle: bundleFound, bundleItems, coupon, orderId: 101 });

    const res = await postOrder({ bundle_id: 100, coupon_code: 'BUNDLE20' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.discount).toBe(3.0); // 20% of 15.0
    expect(res.body.totalPrice).toBe(12.0); // 15.0 - 3.0
    expect(res.body.coupon).toEqual({ code: 'BUNDLE20', discount_type: 'percent' });

    const couponLookup = mockQuery.mock.calls.find(([sql]) => sql.includes('FROM coupons WHERE code'));
    expect(couponLookup[0]).toContain("datetime('now')");
    expect(couponLookup[0]).not.toContain('NOW()');
  });

  it('rolls back stock exactly once on payment failure for bundle order', async () => {
    stellar.sendPayment.mockRejectedValue(new Error('Payment failed'));
    mockOrderFlow({ bundle: bundleFound, bundleItems, orderId: 101 });

    const res = await postOrder({ bundle_id: 100 });

    expect(res.status).toBe(402);
    expect(res.body.code).toBe('payment_failed');
    expect(res.body.orderIds).toEqual([101, 102]);
    const restocks = mockQuery.mock.calls.filter(([sql]) => sql.includes('SET quantity = quantity + $1'));
    expect(restocks.map(([, params]) => params)).toEqual([[2, 10], [1, 11]]);
  });
});

describe('POST /api/orders', () => {
  it('buyer places an order successfully', async () => {
    stellar.sendPayment.mockResolvedValueOnce('TXHASH_OK');
    mockOrderFlow();

    const res = await postOrder({ product_id: 10, quantity: 2 });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('paid');
  });

  it('returns 403 when a farmer tries to order', async () => {
    const res = await postOrder({ product_id: 10, quantity: 1 }, { token: farmerToken });
    expect(res.status).toBe(403);
  });

  it('returns 404 for non-existent product', async () => {
    mockOrderFlow({ product: { rows: [], rowCount: 0 } });

    const res = await postOrder({ product_id: 9999, quantity: 1 });
    expect(res.status).toBe(404);
  });

  it('returns 402 when buyer has insufficient balance', async () => {
    mockOrderFlow();
    stellar.getBalance.mockResolvedValue(0);

    const res = await postOrder({ product_id: 10, quantity: 1 });
    expect(res.status).toBe(402);
  });

  it('returns 409 when stock is insufficient', async () => {
    mockOrderFlow();

    const res = await postOrder({ product_id: 10, quantity: 999 });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('out_of_stock');
  });

  it('returns 409 when the atomic stock reservation loses a race', async () => {
    mockOrderFlow({ reserve: { rows: [], rowCount: 0 } });

    const res = await postOrder({ product_id: 10, quantity: 1 });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('out_of_stock');
  });

  it('marks order failed when payment throws', async () => {
    stellar.sendPayment.mockRejectedValueOnce(new Error('network error'));
    mockOrderFlow();

    const res = await postOrder({ product_id: 10, quantity: 1 });
    expect(res.status).toBe(402);
    expect(mockQuery).toHaveBeenCalledWith('UPDATE orders SET status = $1 WHERE id = $2', ['failed', 99]);
  });

  it('returns 422 when PWYW custom_price is below min_price', async () => {
    mockOrderFlow({ prod: { ...product, pricing_model: 'pwyw', min_price: 5.0 } });

    const res = await postOrder({ product_id: 10, quantity: 1, custom_price: 3.0 });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('below_min_price');
    expect(res.body.message).toContain('minimum of 5');
  });

  it('accepts PWYW order when custom_price meets min_price', async () => {
    stellar.sendPayment.mockResolvedValueOnce('TXHASH_OK');
    mockOrderFlow({ prod: { ...product, pricing_model: 'pwyw', min_price: 5.0 } });

    const res = await postOrder({ product_id: 10, quantity: 1, custom_price: 5.0 });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('paid');
  });

  it('returns 422 when flash sale has ended', async () => {
    mockOrderFlow({
      prod: {
        ...product,
        flash_sale_price: 3.0,
        flash_sale_ends_at: new Date(Date.now() - 1000).toISOString(), // Ended 1 second ago
      },
    });

    const res = await postOrder({ product_id: 10, quantity: 1 });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('flash_sale_ended');
    expect(res.body.message).toContain('Flash sale has ended');
  });

  it('returns 422 when flash sale has not started yet', async () => {
    mockOrderFlow({
      prod: {
        ...product,
        flash_sale_price: 3.0,
        flash_sale_starts_at: new Date(Date.now() + 3600000).toISOString(), // Starts in 1 hour
        flash_sale_ends_at: new Date(Date.now() + 7200000).toISOString(), // Ends in 2 hours
      },
    });

    const res = await postOrder({ product_id: 10, quantity: 1 });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('flash_sale_not_started');
    expect(res.body.message).toContain('Flash sale has not started yet');
  });

  it('accepts order when flash sale is active within time window', async () => {
    stellar.sendPayment.mockResolvedValueOnce('TXHASH_OK');
    mockOrderFlow({
      prod: {
        ...product,
        flash_sale_price: 3.0,
        flash_sale_starts_at: new Date(Date.now() - 3600000).toISOString(), // Started 1 hour ago
        flash_sale_ends_at: new Date(Date.now() + 3600000).toISOString(), // Ends in 1 hour
      },
    });

    const res = await postOrder({ product_id: 10, quantity: 1 });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('paid');
    expect(res.body.totalPrice).toBe(3.0);
  });

  it('returns 400 for zero quantity', async () => {
    const res = await postOrder({ product_id: 10, quantity: 0 });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('validation_error');
    expect(res.body.message).toBe('quantity must be a positive integer');
  });

  it('returns 400 for negative quantity', async () => {
    const res = await postOrder({ product_id: 10, quantity: -5 });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('validation_error');
    expect(res.body.message).toBe('quantity must be a positive integer');
  });
});

describe('GET /api/orders', () => {
  it('returns paginated buyer order history', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ count: '1' }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ id: 1, product_name: 'Apples' }], rowCount: 1 });
    const res = await request(app).get('/api/orders').set('Authorization', `Bearer ${buyerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.total).toBe(1);
    expect(res.body.page).toBe(1);
    expect(res.body.limit).toBe(20);
    expect(res.body.totalPages).toBe(1);
  });

  it('respects page and limit query params', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ count: '50' }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 });
    const res = await request(app)
      .get('/api/orders?page=2&limit=10')
      .set('Authorization', `Bearer ${buyerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.page).toBe(2);
    expect(res.body.limit).toBe(10);
    expect(res.body.totalPages).toBe(5);
  });

  it('clamps limit to 100', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 });
    const res = await request(app)
      .get('/api/orders?limit=999')
      .set('Authorization', `Bearer ${buyerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.limit).toBe(100);
  });

  it('defaults to page 1 when page param is omitted', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 });
    const res = await request(app).get('/api/orders').set('Authorization', `Bearer ${buyerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.page).toBe(1);
  });
});

describe('SEP-0007 payment links', () => {
  it('creates a pending order for sep7 payment', async () => {
    mockOrderFlow({ orderId: 99 });

    const res = await postOrder({ product_id: 10, quantity: 2, payment_method: 'sep7' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('pending');
    expect(res.body.orderId).toBe(99);
  });

  it('returns a SEP-0007 payment link for pending order and 30-minute valid', async () => {
    const createdAt = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    mockQuery.mockResolvedValueOnce({ rows: [{
      id: 99,
      buyer_id: 2,
      product_id: 10,
      quantity: 2,
      total_price: 10.0,
      status: 'pending',
      created_at: createdAt,
      is_preorder: false,
      preorder_delivery_date: null,
      farmer_wallet: 'GFARMER',
    }], rowCount: 1 });

    const res = await request(app)
      .get('/api/orders/99/payment-link')
      .set('Authorization', `Bearer ${buyerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.paymentLink).toContain('web+stellar:pay');
    expect(res.body.expiresAt).toBeDefined();
  });

  it('returns 410 when payment link is expired', async () => {
    const createdAt = new Date(Date.now() - 31 * 60 * 1000).toISOString();
    mockQuery.mockResolvedValueOnce({ rows: [{
      id: 99,
      buyer_id: 2,
      product_id: 10,
      quantity: 2,
      total_price: 10.0,
      status: 'pending',
      created_at: createdAt,
      is_preorder: false,
      preorder_delivery_date: null,
      farmer_wallet: 'GFARMER',
    }], rowCount: 1 });

    const res = await request(app)
      .get('/api/orders/99/payment-link')
      .set('Authorization', `Bearer ${buyerToken}`);

    expect(res.status).toBe(410);
  });
});

describe('GET /api/orders/sales', () => {
  it('returns paginated farmer sales', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ count: '1' }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ id: 1, product_name: 'Apples' }], rowCount: 1 });
    const res = await request(app)
      .get('/api/orders/sales')
      .set('Authorization', `Bearer ${farmerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.total).toBe(1);
    expect(res.body.page).toBe(1);
    expect(res.body.totalPages).toBe(1);
  });

  it('returns 403 for buyers', async () => {
    const res = await request(app)
      .get('/api/orders/sales')
      .set('Authorization', `Bearer ${buyerToken}`);
    expect(res.status).toBe(403);
  });
});
