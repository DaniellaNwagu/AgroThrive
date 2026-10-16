jest.mock('../db/schema', () => ({ query: jest.fn() }));
jest.mock('jsonwebtoken', () => ({ verify: jest.fn(() => ({ id: 1 })), TokenExpiredError: class extends Error {} }));
const db = require('../db/schema');
const auth = require('../middleware/auth');

function response() { return { status: jest.fn().mockReturnThis(), json: jest.fn(), set: jest.fn() }; }

test.each([true, 1])('accepts active value %s', async (active) => {
  db.query.mockResolvedValue({ rows: [{ active }] }); const next = jest.fn(); await auth({ headers: { authorization: 'Bearer x' } }, response(), next); expect(next).toHaveBeenCalled();
});

test.each([false, 0, null])('rejects inactive value %s', async (active) => {
  db.query.mockResolvedValue({ rows: active === null ? [] : [{ active }] }); const res = response(); await auth({ headers: { authorization: 'Bearer x' } }, res, jest.fn()); expect(res.status).toHaveBeenCalledWith(401);
});
