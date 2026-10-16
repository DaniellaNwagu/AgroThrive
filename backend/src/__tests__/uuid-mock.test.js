jest.mock('uuid');

const { v4 } = require('uuid');

test('uuid mock increments deterministic identifiers', () => {
  const first = v4();
  const second = v4();
  expect(first).toMatch(/^test-uuid-\d+$/);
  expect(second).toMatch(/^test-uuid-\d+$/);
  expect(first).not.toBe(second);
  expect(require('uuid').v4()).toMatch(/^test-uuid-\d+$/);
});
