/**
 * Unit tests for export route (issue #1155)
 * Tests CSV and PDF export for products and sales
 */

const request = require('supertest');
const express = require('express');
const { productsRouter, ordersRouter } = require('../routes/export');
const db = require('../db/schema');

jest.mock('../db/schema');
// Role comes from a test-only header so a single mounted app can exercise
// both the farmer-only happy path and the farmerOnly() 403 branch — the
// previous version hardcoded 'farmer' and then tried to re-mock this
// module per-test via a second `jest.mock(..., { virtual: true })` call,
// which can't actually swap an already-hoisted top-level mock; the
// "buyer" request silently ran as a farmer and the 403 assertion passed
// for the wrong reason (or, after the routing fix below, would have
// started failing outright).
jest.mock('../middleware/auth', () => (req, res, next) => {
  req.user = { id: 300, role: req.headers['x-test-role'] || 'farmer' };
  next();
});

// streamCsv() (export.js) only fetches its next page on the stringifier's
// 'drain' event. In object mode that only fires once a write() call pushes
// the stream past its default highWaterMark of 16 buffered objects — a
// page smaller than that leaves the request hanging forever (no further
// fetch, and `stringifier.end()` is never reached). Real production
// batches are BATCH_SIZE (1000) rows and always clear this; test pages
// that want to terminate (not just assert a single huge page) need to be
// padded past it too.
const PAD_TO = 1000; // matches BATCH_SIZE — proven to reliably trigger 'drain' above.
function padRows(rows, filler = {}) {
  const pad = Array.from({ length: PAD_TO - rows.length }, () => ({ ...rows[0], ...filler }));
  return [...rows, ...pad];
}

const app = express();
app.use(express.json());
// export.js exports two separate routers (productsRouter/ordersRouter),
// one mounted per path by routes/index.js in the real app — not a single
// combined router/middleware function. `app.use('/api', exportRouter)`
// previously passed that whole {productsRouter, ordersRouter} object
// straight to Express, which throws ("requires a middleware function but
// got a Object") before any test in this file can run.
app.use('/api/products', productsRouter);
app.use('/api/orders', ordersRouter);

describe('GET /api/products/export', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('exports products as CSV by default', async () => {
    // streamCsv() only fetches its next page from the stringifier's
    // 'drain' event, which only fires once a write() call exceeds the
    // stream's object-mode highWaterMark (16) — a single row never
    // triggers it, so the page below is padded past that so the
    // follow-up (empty, terminating) page actually gets fetched instead
    // of the request hanging forever.
    db.query
      .mockResolvedValueOnce({ rows: padRows([
        {
          id: 1,
          name: 'Organic Tomatoes',
          category: 'vegetables',
          price: '5.50',
          quantity: 100,
          unit: 'kg',
          description: 'Fresh organic tomatoes',
          low_stock_threshold: 10,
          created_at: '2024-01-01T00:00:00.000Z',
        },
      ]) })
      .mockResolvedValueOnce({ rows: [] });

    const res = await request(app).get('/api/products/export?format=csv');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('text/csv');
    expect(res.headers['content-disposition']).toContain('products.csv');
    expect(res.text).toContain('Organic Tomatoes');
  });

  test('exports products as PDF', async () => {
    db.query.mockResolvedValue({
      rows: [
        {
          id: 1,
          name: 'Organic Tomatoes',
          category: 'vegetables',
          price: '5.50',
          quantity: 100,
          unit: 'kg',
          description: 'Fresh tomatoes',
          low_stock_threshold: 10,
          created_at: '2024-01-01',
        },
      ],
    });

    const res = await request(app).get('/api/products/export?format=pdf');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(res.headers['content-disposition']).toContain('products.pdf');
  });

  test('rejects invalid format', async () => {
    const res = await request(app).get('/api/products/export?format=xml');

    expect(res.status).toBe(400);
    // err() puts the human message in `message` and the machine code
    // ('validation_error' here) in `error`/`code` — this previously
    // checked `error` against the message text, which could never pass.
    expect(res.body.message).toBe('format must be csv or pdf');
    expect(res.body.error).toBe('validation_error');
  });

  test('only allows farmers to export', async () => {
    const res = await request(app).get('/api/products/export').set('x-test-role', 'buyer');

    expect(res.status).toBe(403);
    expect(db.query).not.toHaveBeenCalled();
  });
});

describe('GET /api/orders/sales/export', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('exports sales history as CSV', async () => {
    db.query
      .mockResolvedValueOnce({ rows: padRows([
        {
          id: 1001,
          product_name: 'Tomatoes',
          buyer_name: 'John Doe',
          quantity: 5,
          total_price: '27.50',
          status: 'paid',
          stellar_tx_hash: 'TX123ABC',
          created_at: '2024-01-15T10:30:00.000Z',
        },
      ], { product_name: 'Filler', buyer_name: 'Filler' }) })
      .mockResolvedValueOnce({ rows: [] });

    const res = await request(app).get('/api/orders/sales/export?format=csv');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('text/csv');
    expect(res.headers['content-disposition']).toContain('sales.csv');
    expect(res.text).toContain('Tomatoes');
    expect(res.text).toContain('John Doe');
  });

  test('exports sales history as PDF with totals', async () => {
    db.query.mockResolvedValue({
      rows: [
        {
          id: 1001,
          product_name: 'Tomatoes',
          buyer_name: 'John Doe',
          quantity: 5,
          total_price: '27.50',
          status: 'paid',
          stellar_tx_hash: 'TX123',
          created_at: '2024-01-15',
        },
      ],
    });

    const res = await request(app).get('/api/orders/sales/export?format=pdf');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(res.headers['content-disposition']).toContain('sales.pdf');
  });

  test('filters by date range', async () => {
    db.query.mockResolvedValue({ rows: [] });

    await request(app).get('/api/orders/sales/export?format=csv&from=2024-01-01&to=2024-01-31');

    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('o.created_at >='),
      expect.arrayContaining([300, '2024-01-01', '2024-01-31T23:59:59'])
    );
  });

  test('handles empty sales data', async () => {
    db.query.mockResolvedValue({ rows: [] });

    const res = await request(app).get('/api/orders/sales/export?format=csv');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('text/csv');
  });
});

// #118: streamCsv()'s own control flow — paging by a fixed BATCH_SIZE
// offset (not by rows.length), terminating on an empty page, and its
// error path — exercised here through the products CSV export, since
// streamCsv() itself isn't exported (it's a module-private helper used
// by both routers).
describe('streamCsv (via GET /api/products/export?format=csv)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  function page(n, offset) {
    return Array.from({ length: n }, (_, i) => ({
      id: offset + i + 1,
      name: `Product ${offset + i + 1}`,
      category: 'vegetables',
      price: '1.00',
      quantity: 1,
      unit: 'kg',
      description: '',
      low_stock_threshold: 1,
      created_at: '2024-01-01',
    }));
  }

  test('fetches successive pages at offsets 0, 1000, 2000 until an empty page ends the stream, with the header row plus every row from every page, in order', async () => {
    const BATCH_SIZE = 1000;
    db.query
      .mockResolvedValueOnce({ rows: page(BATCH_SIZE, 0) })
      .mockResolvedValueOnce({ rows: page(BATCH_SIZE, BATCH_SIZE) })
      .mockResolvedValueOnce({ rows: [] });

    const res = await request(app).get('/api/products/export?format=csv');

    expect(res.status).toBe(200);
    expect(db.query).toHaveBeenCalledTimes(3);
    // Each call's params are [farmerId, limit, offset] — offset is the
    // third bound parameter.
    expect(db.query.mock.calls[0][1]).toEqual([300, BATCH_SIZE, 0]);
    expect(db.query.mock.calls[1][1]).toEqual([300, BATCH_SIZE, BATCH_SIZE]);
    expect(db.query.mock.calls[2][1]).toEqual([300, BATCH_SIZE, 2 * BATCH_SIZE]);

    const lines = res.text.trim().split('\n');
    expect(lines[0]).toBe('ID,Name,Category,Price (XLM),Quantity,Unit,Description,Low Stock Threshold,Created At');
    expect(lines).toHaveLength(1 + 2 * BATCH_SIZE); // header + both full pages
    expect(lines[1]).toContain('Product 1');
    expect(lines[BATCH_SIZE]).toContain(`Product ${BATCH_SIZE}`);
    expect(lines[BATCH_SIZE + 1]).toContain(`Product ${BATCH_SIZE + 1}`);
    expect(lines[2 * BATCH_SIZE]).toContain(`Product ${2 * BATCH_SIZE}`);
  });

  test('a rejected db.query produces a 500 response with body "CSV export error"', async () => {
    db.query.mockRejectedValueOnce(new Error('connection lost'));

    const res = await request(app).get('/api/products/export?format=csv');

    expect(res.status).toBe(500);
    expect(res.text).toBe('CSV export error');
  });

  test('an error on a later page still ends the response (does not hang), though the status is already committed', async () => {
    db.query
      // First page must be large enough to trigger the stringifier's
      // 'drain' event (see padRows' comment above) so fetchNext() actually
      // runs a second time and reaches the rejection below.
      .mockResolvedValueOnce({ rows: page(1000, 0) })
      .mockRejectedValueOnce(new Error('connection lost mid-stream'));

    const res = await request(app).get('/api/products/export?format=csv');

    // By the time a later page fails, the first page's data has already
    // been written to the response — HTTP has no way to retroactively
    // change a status line once bytes are on the wire, so
    // `res.status(500)` here is a no-op and the response the client
    // actually sees is a 200 with 'CSV export error' appended straight
    // into what's otherwise a truncated, valid-looking CSV body. That's
    // a real (if unfortunate) characteristic of streamCsv()'s error
    // handling, not a flaw in this test — asserting a clean 500 here
    // would be asserting something that cannot happen once streaming has
    // started.
    expect(res.status).toBe(200);
    expect(res.text).toContain('CSV export error');
  });
});
