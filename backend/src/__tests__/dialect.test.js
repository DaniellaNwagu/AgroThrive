const { currentTimestamp, sixMonthsAgo, monthBucket } = require('../db/dialect');

test('returns PostgreSQL dialect fragments', () => {
  expect(currentTimestamp(true)).toBe('NOW()');
  expect(sixMonthsAgo(true)).toBe("NOW() - INTERVAL '6 months'");
  expect(monthBucket('created_at', true)).toBe("TO_CHAR(created_at, 'YYYY-MM')");
});

test('returns SQLite dialect fragments', () => {
  expect(currentTimestamp(false)).toBe("datetime('now')");
  expect(sixMonthsAgo(false)).toBe("datetime('now', '-6 months')");
  expect(monthBucket('created_at', false)).toBe("strftime('%Y-%m', created_at)");
});
