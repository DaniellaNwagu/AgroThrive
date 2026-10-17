import { describe, it, expect } from 'vitest';
import { buildSrcSet } from '../imageUtils';

describe('buildSrcSet', () => {
  it('returns undefined when no url is given', () => {
    expect(buildSrcSet(undefined)).toBeUndefined();
  });

  it('returns undefined for an empty string', () => {
    expect(buildSrcSet('')).toBeUndefined();
  });

  it('builds Cloudinary-style transform candidates for /upload/ URLs', () => {
    const url = 'https://res.cloudinary.com/demo/image/upload/sample.jpg';
    const result = buildSrcSet(url);
    expect(result).toBe(
      [
        'https://res.cloudinary.com/demo/image/upload/w_200,q_auto,f_auto/sample.jpg 200w',
        'https://res.cloudinary.com/demo/image/upload/w_400,q_auto,f_auto/sample.jpg 400w',
        'https://res.cloudinary.com/demo/image/upload/w_800,q_auto,f_auto/sample.jpg 800w',
      ].join(', ')
    );
  });

  it('strips an existing query string before appending ?w= for each breakpoint', () => {
    const url = 'https://example.com/images/tomato.jpg?foo=bar&baz=1';
    const result = buildSrcSet(url);
    expect(result).toBe(
      [
        'https://example.com/images/tomato.jpg?w=200 200w',
        'https://example.com/images/tomato.jpg?w=400 400w',
        'https://example.com/images/tomato.jpg?w=800 800w',
      ].join(', ')
    );
  });
});
