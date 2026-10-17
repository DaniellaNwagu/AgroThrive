/**
 * alerts.test.js (#114)
 * Covers the crop-alert radius filter and the nearby-farmer notification
 * query in src/routes/alerts.js. Mounts the router directly (it is not part
 * of the global app mock in tests/jest.setup.js) with db.query mocked so we
 * can capture the exact SQL and params passed for each request.
 */

const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');

const mockDb = require('../db/schema');
const alertsRouter = require('../routes/alerts');

const SECRET = process.env.JWT_SECRET || 'test-secret-for-jest';
const farmerToken = jwt.sign({ id: 1, role: 'farmer' }, SECRET);
const buyerToken = jwt.sign({ id: 2, role: 'buyer' }, SECRET);

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/alerts', alertsRouter);
  return app;
}

describe('crop alert routes (#114)', () => {
  let app;

  const ACTIVE_USER = { rows: [{ active: 1 }], rowCount: 1 };

  beforeEach(() => {
    app = buildApp();
    mockDb.query.mockReset();
    mockDb.query.mockResolvedValue({ rows: [], rowCount: 0 });
  });

  describe('GET /api/alerts', () => {
    it('returns all alerts without a WHERE radius clause when lat/lng are omitted', async () => {
      const res = await request(app).get('/api/alerts');

      expect(res.status).toBe(200);
      const [sql, params] = mockDb.query.mock.calls[0];
      expect(sql).not.toMatch(/WHERE/i);
      expect(params).toEqual([]);
    });

    it('binds lat/radiusDegrees/lng in the order the SQL placeholders expect', async () => {
      const res = await request(app).get('/api/alerts').query({ lat: '1.5', lng: '2.5', radius: '111' });

      expect(res.status).toBe(200);
      const [sql, params] = mockDb.query.mock.calls[0];
      expect(sql).toMatch(/ABS\(a\.latitude - \$1\) < \$2 AND ABS\(a\.longitude - \$3\) < \$2/);
      expect(params).toEqual([1.5, 1, 2.5]);
    });
  });

  describe('POST /api/alerts', () => {
    const body = {
      alert_type: 'pest',
      description: 'Aphids spreading across the east field quickly',
    };

    it('returns 403 for a non-farmer and inserts nothing', async () => {
      mockDb.query.mockResolvedValueOnce(ACTIVE_USER);

      const res = await request(app)
        .post('/api/alerts')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send(body);

      expect(res.status).toBe(403);
      expect(mockDb.query).not.toHaveBeenCalledWith(expect.stringMatching(/INSERT INTO crop_alerts/i), expect.anything());
    });

    it('triggers the nearby-farmer lookup when latitude and longitude are provided', async () => {
      mockDb.query
        .mockResolvedValueOnce(ACTIVE_USER)
        .mockResolvedValueOnce({ rows: [{ id: 5, farmer_id: 1, alert_type: 'pest', latitude: 1, longitude: 2 }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const res = await request(app)
        .post('/api/alerts')
        .set('Authorization', `Bearer ${farmerToken}`)
        .send({ ...body, latitude: 1, longitude: 2 });

      expect(res.status).toBe(201);
      await new Promise((resolve) => setImmediate(resolve));
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringMatching(/FROM users u/i),
        expect.anything()
      );
    });

    it('does not run the nearby-farmer query when coordinates are omitted', async () => {
      mockDb.query
        .mockResolvedValueOnce(ACTIVE_USER)
        .mockResolvedValueOnce({
          rows: [{ id: 6, farmer_id: 1, alert_type: 'pest' }],
          rowCount: 1,
        });

      const res = await request(app)
        .post('/api/alerts')
        .set('Authorization', `Bearer ${farmerToken}`)
        .send(body);

      expect(res.status).toBe(201);
      await new Promise((resolve) => setImmediate(resolve));
      // Only the auth lookup and the alert INSERT ran — the nearby-farmer
      // query (and therefore any notification email) never fired.
      expect(mockDb.query).toHaveBeenCalledTimes(2);
    });
  });

  describe('DELETE /api/alerts/:id', () => {
    it('returns 403 for a user who is neither the owner nor an admin', async () => {
      mockDb.query
        .mockResolvedValueOnce(ACTIVE_USER)
        .mockResolvedValueOnce({ rows: [{ farmer_id: 1 }], rowCount: 1 });

      const res = await request(app)
        .delete('/api/alerts/5')
        .set('Authorization', `Bearer ${buyerToken}`);

      expect(res.status).toBe(403);
      expect(mockDb.query).not.toHaveBeenCalledWith(expect.stringMatching(/DELETE FROM crop_alerts/i), expect.anything());
    });
  });
});
