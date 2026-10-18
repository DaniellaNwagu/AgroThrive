import { describe, it, expect } from 'vitest';
import { calculateHaversineDistance } from '../utils/distance';

describe('calculateHaversineDistance', () => {
  it('returns 0 for identical coordinates', () => {
    expect(calculateHaversineDistance(40.7128, -74.0060, 40.7128, -74.0060)).toBeCloseTo(0, 6);
  });

  it('is symmetric: distance(a, b) === distance(b, a)', () => {
    const ab = calculateHaversineDistance(40.7128, -74.0060, 51.5074, -0.1278);
    const ba = calculateHaversineDistance(51.5074, -0.1278, 40.7128, -74.0060);
    expect(ab).toBeCloseTo(ba, 9);
  });

  it('matches the known great-circle distance between New York City and London', () => {
    // NYC (40.7128 N, 74.0060 W) to London (51.5074 N, 0.1278 W).
    // The real-world great-circle distance is ~5570 km; allow a 5 km
    // tolerance for the spherical-earth approximation this helper uses.
    const distance = calculateHaversineDistance(40.7128, -74.0060, 51.5074, -0.1278);
    expect(distance).toBeCloseTo(5570, -1); // within ~5 km
  });

  it('does not throw for undefined, NaN, or null coordinates (NaN propagates instead)', () => {
    expect(() => calculateHaversineDistance(undefined, undefined, undefined, undefined)).not.toThrow();
    expect(() => calculateHaversineDistance(NaN, 0, 1, 1)).not.toThrow();
    expect(() => calculateHaversineDistance(null, null, null, null)).not.toThrow();

    expect(Number.isNaN(calculateHaversineDistance(undefined, undefined, undefined, undefined))).toBe(true);
    expect(Number.isNaN(calculateHaversineDistance(NaN, 0, 1, 1))).toBe(true);
  });
});
