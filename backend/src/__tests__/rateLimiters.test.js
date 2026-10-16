const express = require('express');
const request = require('supertest');

function appWith(limiter) {
  const app = express();
  app.get('/', limiter, (_req, res) => res.json({ success: true }));
  return app;
}

async function expectLimited(limiter, requestCount) {
  const app = appWith(limiter);
  let response;
  for (let count = 0; count < requestCount; count += 1) response = await request(app).get('/');
  expect(response.status).toBe(429);
  expect(response.body.code).toBe('rate_limited');
}

describe('route rate limiters', () => {
  beforeEach(() => {
    jest.resetModules();
    process.env.RATE_LIMIT_AUTH_MAX = '2';
    process.env.RATE_LIMIT_GENERAL_MAX = '2';
  });

  it('honours the auth limit override', async () => {
    await expectLimited(require('../routes').limiters.authLimiter, 3);
  });

  it('limits funding on the sixth request', async () => {
    await expectLimited(require('../routes').limiters.fundLimiter, 6);
  });

  it('honours the general limit override', async () => {
    await expectLimited(require('../routes').limiters.generalLimiter, 3);
  });
});
