'use strict';

/**
 * Drop-in replacement for src/middleware/auth for route suites that script
 * db.query call-by-call: verifies the JWT but skips the middleware's
 * `SELECT active FROM users` lookup, which would otherwise consume the first
 * scripted response. The real middleware is covered by auth.middleware.test.js.
 *
 *   jest.mock('../src/middleware/auth', () => require('./helpers/jwtOnlyAuth'));
 */
const jwt = require('jsonwebtoken');

module.exports = function jwtOnlyAuth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided', code: 'missing_token' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token', code: 'invalid_token' });
  }
};
