/**
 * admin-users-filter.test.js
 * Tests for GET /api/admin/users with active filter
 */

jest.mock('../db/schema');
jest.mock('../middleware/auth', () => (req, res, next) => {
  req.user = { id: 1, role: 'admin' };
  next();
});
jest.mock('../middleware/requireAdmin', () => (req, res, next) => {
  next();
});

const db = require('../db/schema');
const request = require('supertest');
const app = require('../app');

describe('GET /api/admin/users - Active Filter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should return all users when no active filter is provided', async () => {
    db.query.mockResolvedValueOnce({
      rows: [{ count: 3 }],
    });
    db.query.mockResolvedValueOnce({
      rows: [
        { id: 1, name: 'User 1', email: 'user1@test.com', role: 'buyer', active: true },
        { id: 2, name: 'User 2', email: 'user2@test.com', role: 'farmer', active: false },
        { id: 3, name: 'User 3', email: 'user3@test.com', role: 'buyer', active: true },
      ],
    });

    const res = await request(app).get('/api/admin/users');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(3);
    expect(res.body.pagination.total).toBe(3);
  });

  test('should filter for active users when active=1', async () => {
    db.query.mockResolvedValueOnce({
      rows: [{ count: 2 }],
    });
    db.query.mockResolvedValueOnce({
      rows: [
        { id: 1, name: 'User 1', email: 'user1@test.com', role: 'buyer', active: true },
        { id: 3, name: 'User 3', email: 'user3@test.com', role: 'buyer', active: true },
      ],
    });

    const res = await request(app).get('/api/admin/users?active=1');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.pagination.total).toBe(2);
    expect(res.body.data.every((u) => u.active === true)).toBe(true);
  });

  test('should filter for deactivated users when active=0', async () => {
    db.query.mockResolvedValueOnce({
      rows: [{ count: 1 }],
    });
    db.query.mockResolvedValueOnce({
      rows: [
        { id: 2, name: 'User 2', email: 'user2@test.com', role: 'farmer', active: false },
      ],
    });

    const res = await request(app).get('/api/admin/users?active=0');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.pagination.total).toBe(1);
    expect(res.body.data[0].active).toBe(false);
  });

  test('should support active=true string', async () => {
    db.query.mockResolvedValueOnce({
      rows: [{ count: 2 }],
    });
    db.query.mockResolvedValueOnce({
      rows: [
        { id: 1, name: 'User 1', email: 'user1@test.com', role: 'buyer', active: true },
        { id: 3, name: 'User 3', email: 'user3@test.com', role: 'buyer', active: true },
      ],
    });

    const res = await request(app).get('/api/admin/users?active=true');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
  });

  test('should work with pagination and active filter', async () => {
    db.query.mockResolvedValueOnce({
      rows: [{ count: 5 }],
    });
    db.query.mockResolvedValueOnce({
      rows: [
        { id: 1, name: 'User 1', email: 'user1@test.com', role: 'buyer', active: true },
        { id: 3, name: 'User 3', email: 'user3@test.com', role: 'buyer', active: true },
      ],
    });

    const res = await request(app).get('/api/admin/users?active=1&page=1&limit=2');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.pagination.page).toBe(1);
    expect(res.body.pagination.limit).toBe(2);
    expect(res.body.pagination.total).toBe(5);
  });

  test('should filter by role alone', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ count: 1 }] });
    db.query.mockResolvedValueOnce({
      rows: [{ id: 2, name: 'User 2', email: 'user2@test.com', role: 'farmer', active: false }],
    });

    const res = await request(app).get('/api/admin/users?role=farmer');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.pagination.total).toBe(1);

    const [countSql, countParams] = db.query.mock.calls[0];
    expect(countSql).toContain('role = $1');
    expect(countParams.slice(0, 1)).toEqual(['farmer']);
  });

  test('should filter by verified alone (no SQL params pushed)', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ count: 2 }] });
    db.query.mockResolvedValueOnce({
      rows: [
        { id: 1, name: 'User 1', email: 'user1@test.com', role: 'buyer', active: true },
        { id: 3, name: 'User 3', email: 'user3@test.com', role: 'buyer', active: true },
      ],
    });

    const res = await request(app).get('/api/admin/users?verified=true');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);

    const [countSql, countParams] = db.query.mock.calls[0];
    expect(countSql).toContain('email_verified_at IS NOT NULL');
    // The route reuses the same params array for the count and list queries, pushing
    // limit/offset onto it afterwards — so by the time we inspect it, it holds those too.
    expect(countParams.slice(0, countParams.length - 2)).toEqual([]);
  });

  test('should filter by banned alone (no SQL params pushed)', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ count: 1 }] });
    db.query.mockResolvedValueOnce({
      rows: [{ id: 4, name: 'User 4', email: 'user4@test.com', role: 'buyer', active: true }],
    });

    const res = await request(app).get('/api/admin/users?banned=false');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);

    const [countSql, countParams] = db.query.mock.calls[0];
    expect(countSql).toContain('banned_at IS NULL');
    expect(countParams.slice(0, countParams.length - 2)).toEqual([]);
  });

  test('should combine active, role, verified, and banned filters with correct param ordering', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ count: 1 }] });
    db.query.mockResolvedValueOnce({
      rows: [{ id: 5, name: 'User 5', email: 'user5@test.com', role: 'farmer', active: true }],
    });

    const res = await request(app).get(
      '/api/admin/users?active=true&role=farmer&verified=true&banned=false'
    );

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);

    const [countSql, countParams] = db.query.mock.calls[0];
    // active and role push params (in that order); verified/banned push raw SQL only.
    expect(countSql).toContain('active = $1');
    expect(countSql).toContain('role = $2');
    expect(countSql).toContain('email_verified_at IS NOT NULL');
    expect(countSql).toContain('banned_at IS NULL');
    expect(countParams.slice(0, 2)).toEqual([true, 'farmer']);

    const [listSql, listParams] = db.query.mock.calls[1];
    // limit/offset placeholders come after the active + role params.
    expect(listSql).toContain('LIMIT $3 OFFSET $4');
    expect(listParams).toEqual([true, 'farmer', 50, 0]);
  });

  test('limit above 200 clamps to 200', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ count: 0 }] });
    db.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app).get('/api/admin/users?limit=500');

    expect(res.status).toBe(200);
    expect(res.body.pagination.limit).toBe(200);

    const [, listParams] = db.query.mock.calls[1];
    expect(listParams).toEqual([200, 0]);
  });

  test('missing limit defaults to 50', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ count: 0 }] });
    db.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app).get('/api/admin/users');

    expect(res.status).toBe(200);
    expect(res.body.pagination.limit).toBe(50);

    const [, listParams] = db.query.mock.calls[1];
    expect(listParams).toEqual([50, 0]);
  });

  test('page=2&limit=10 produces the correct offset and pagination totals', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ count: 25 }] });
    db.query.mockResolvedValueOnce({
      rows: Array.from({ length: 10 }, (_, i) => ({
        id: i + 11,
        name: `User ${i + 11}`,
        email: `user${i + 11}@test.com`,
        role: 'buyer',
        active: true,
      })),
    });

    const res = await request(app).get('/api/admin/users?page=2&limit=10');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(10);
    expect(res.body.pagination.page).toBe(2);
    expect(res.body.pagination.limit).toBe(10);
    expect(res.body.pagination.total).toBe(25);
    expect(res.body.pagination.pages).toBe(3);

    const [, listParams] = db.query.mock.calls[1];
    expect(listParams).toEqual([10, 10]); // limit=10, offset=(page-1)*limit=10
  });

  test('an unknown role value returns an empty array and total 0', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ count: 0 }] });
    db.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app).get('/api/admin/users?role=nonexistent-role');

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.pagination.total).toBe(0);

    const [countSql, countParams] = db.query.mock.calls[0];
    expect(countSql).toContain('role = $1');
    expect(countParams.slice(0, 1)).toEqual(['nonexistent-role']);
  });
});
