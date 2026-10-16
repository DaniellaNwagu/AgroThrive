const { rewriteImageUrl } = require('../utils/cdn');

afterEach(() => { delete process.env.CDN_URL; });

test('rewrites only relative image paths', () => {
  expect(rewriteImageUrl(null)).toBeNull();
  expect(rewriteImageUrl('/uploads/a.png')).toBe('/uploads/a.png');
  process.env.CDN_URL = 'https://cdn.example.com/';
  expect(rewriteImageUrl('https://origin/a.png')).toBe('https://origin/a.png');
  expect(rewriteImageUrl('http://origin/a.png')).toBe('http://origin/a.png');
  expect(rewriteImageUrl('/uploads/a.png')).toBe('https://cdn.example.com/uploads/a.png');
});
