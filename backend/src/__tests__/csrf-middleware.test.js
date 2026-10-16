const { csrfProtect, parseCookie } = require('../middleware/csrf');
const response = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn() });

test('parses cookie values containing equals', () => expect(parseCookie('csrf_token=a=b;c=d', 'csrf_token')).toBe('a=b'));
test('allows reads and exempt API versions', () => {
  const next = jest.fn(); csrfProtect({ method: 'GET', path: '/x', headers: {} }, response(), next); expect(next).toHaveBeenCalled();
  const old = process.env.NODE_ENV; process.env.NODE_ENV = 'production'; csrfProtect({ method: 'POST', path: '/api/v1/auth/login', headers: {} }, response(), next); process.env.NODE_ENV = old; expect(next).toHaveBeenCalledTimes(2);
});
test('rejects missing and mismatched tokens but accepts matching tokens', () => {
  const old = process.env.NODE_ENV; process.env.NODE_ENV = 'production';
  let res = response(); csrfProtect({ method: 'POST', path: '/api/orders', headers: {} }, res, jest.fn()); expect(res.status).toHaveBeenCalledWith(403);
  res = response(); csrfProtect({ method: 'POST', path: '/api/orders', headers: { cookie: 'csrf_token=a', 'x-csrf-token': 'b' } }, res, jest.fn()); expect(res.status).toHaveBeenCalledWith(403);
  const next = jest.fn(); csrfProtect({ method: 'POST', path: '/api/orders', headers: { cookie: 'csrf_token=a=b', 'x-csrf-token': 'a=b' } }, response(), next); expect(next).toHaveBeenCalled(); process.env.NODE_ENV = old;
});
