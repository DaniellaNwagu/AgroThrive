import { describe, it, expect } from 'vitest';
import { fitsWithinViewport } from './e2e/browser-compat.e2e.js';

describe('fitsWithinViewport', () => {
  it('passes on an exact fit', () => {
    expect(fitsWithinViewport(320, 320, 2)).toBe(true);
  });

  it('passes when overflow is within the tolerance', () => {
    expect(fitsWithinViewport(322, 320, 2)).toBe(true);
  });

  it('fails when overflow exceeds the tolerance', () => {
    expect(fitsWithinViewport(323, 320, 2)).toBe(false);
  });

  it('passes when the edge is inside the viewport', () => {
    expect(fitsWithinViewport(300, 320, 2)).toBe(true);
  });
});
