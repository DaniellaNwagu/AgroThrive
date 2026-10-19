'use strict';

jest.mock('../db/schema', () => ({ query: jest.fn() }));

const express = require('express');
const jwt = require('jsonwebtoken');
const request = require('supertest');
const db = require('../db/schema');
const { jwtSecret } = require('../config');
const sseAuth = require('../middleware/sseAuth');

function buildApp() {
  const app = express();
  app.get('/events', sseAuth, (req, res) => res.json({ user: req.user, userId: req.userId }));
  return app;
}

const streamToken = (claims = {}) => jwt.sign({ id: 7, scope: 'stream', ...claims }, jwtSecret, { expiresIn: '60s' });

describe('sseAuth', () => {
  beforeEach(() => jest.clearAllMocks());

  it('rejects a request without a token', async () => {
    const res = await request(buildApp()).get('/events');
    expect(res.status).toBe(401);
    expect(db.query).not.toHaveBeenCalled();
  });

  it('rejects a full access token (no stream scope)', async () => {
    const accessToken = jwt.sign({ id: 7, role: 'buyer' }, jwtSecret);
    const res = await request(buildApp()).get(`/events?token=${accessToken}`);
    expect(res.status).toBe(403);
    expect(db.query).not.toHaveBeenCalled();
  });

  it('rejects a token signed with another secret', async () => {
    const forged = jwt.sign({ id: 7, scope: 'stream' }, 'not-the-secret');
    const res = await request(buildApp()).get(`/events?token=${forged}`);
    expect(res.status).toBe(401);
  });

  it('accepts a stream token for an active account', async () => {
    db.query.mockResolvedValue({ rows: [{ id: 7, role: 'buyer', active: 1, banned_at: null }] });

    const res = await request(buildApp()).get(`/events?token=${streamToken()}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ user: { id: 7, role: 'buyer' }, userId: 7 });
    expect(db.query).toHaveBeenCalledWith(
      'SELECT id, role, active, banned_at FROM users WHERE id = $1',
      [7]
    );
  });

  it.each([
    ['unknown user', [], 401],
    ['banned user', [{ id: 7, role: 'buyer', active: 1, banned_at: '2026-10-01T00:00:00Z' }], 403],
    ['deactivated user', [{ id: 7, role: 'buyer', active: 0, banned_at: null }], 403],
  ])('rejects a stream token for an %s', async (_label, rows, status) => {
    db.query.mockResolvedValue({ rows });
    const res = await request(buildApp()).get(`/events?token=${streamToken()}`);
    expect(res.status).toBe(status);
  });
});
