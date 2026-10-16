/**
 * Unit tests for utils/carbon.js — carbon footprint estimation
 */

const {
  estimateCarbonFootprint,
  calculateDistance,
  CATEGORY_DEFAULTS,
  getCategoryDefault,
  calculateTransportEmissions,
  calculateSavingsPercent,
} = require('../utils/carbon');

describe('carbon.js — estimateCarbonFootprint', () => {
  it('calculates carbon footprint using category defaults when carbon_kg_per_unit is not provided', () => {
    const product = { category: 'vegetables' };
    const result = estimateCarbonFootprint(product, 10, 0);
    
    // vegetables default is 0.4 kg per unit, 10 units = 4 kg
    expect(result.carbonKg).toBe(4.0);
    expect(result.supermarketCarbonKg).toBe(10.0); // 4 * 2.5 multiplier
    expect(result.savingsPercent).toBe(60); // (10 - 4) / 10 * 100
  });

  it('uses farmer-provided carbon_kg_per_unit when available', () => {
    const product = { category: 'vegetables', carbon_kg_per_unit: 0.3 };
    const result = estimateCarbonFootprint(product, 10, 0);
    
    expect(result.carbonKg).toBe(3.0);
    expect(result.supermarketCarbonKg).toBe(7.5);
    expect(result.savingsPercent).toBe(60);
  });

  it('adds transport emissions when distance is provided', () => {
    const product = { category: 'fruits', carbon_kg_per_unit: 0.5 };
    // 0.5 base + (100 km * 0.1 / 5 quantity) = 0.5 + 2 = 2.5 per unit
    // 5 units * 2.5 = 12.5 kg
    const result = estimateCarbonFootprint(product, 5, 100);
    
    expect(result.carbonKg).toBe(12.5);
  });

  it('returns zero for zero quantity (avoids NaN/Infinity)', () => {
    const product = { category: 'meat', carbon_kg_per_unit: 5.0 };
    const result = estimateCarbonFootprint(product, 0, 100);
    
    expect(result.carbonKg).toBe(0);
    expect(result.supermarketCarbonKg).toBe(0);
    expect(result.savingsPercent).toBe(0);
  });

  it('returns zero for negative quantity', () => {
    const product = { category: 'meat', carbon_kg_per_unit: 5.0 };
    const result = estimateCarbonFootprint(product, -5, 100);
    
    expect(result.carbonKg).toBe(0);
    expect(result.supermarketCarbonKg).toBe(0);
    expect(result.savingsPercent).toBe(0);
  });

  it('uses "other" category default for unknown categories', () => {
    const product = { category: 'unknown_category' };
    const result = estimateCarbonFootprint(product, 10, 0);
    
    expect(result.carbonKg).toBe(8.0); // 0.8 * 10
  });

  it('handles all standard categories correctly', () => {
    const categories = ['vegetables', 'fruits', 'grains', 'dairy', 'meat', 'eggs'];
    
    categories.forEach(category => {
      const product = { category };
      const result = estimateCarbonFootprint(product, 1, 0);
      expect(result.carbonKg).toBe(CATEGORY_DEFAULTS[category]);
    });
  });

  it('rounds carbonKg to 2 decimal places', () => {
    const product = { category: 'vegetables', carbon_kg_per_unit: 0.333 };
    const result = estimateCarbonFootprint(product, 3, 0);
    
    expect(result.carbonKg).toBe(1.0); // 0.333 * 3 = 0.999 → 1.00
  });

  it('calculates savings percentage correctly', () => {
    const product = { category: 'vegetables', carbon_kg_per_unit: 0.4 };
    const result = estimateCarbonFootprint(product, 10, 0);
    
    // carbonKg = 4, supermarket = 10, savings = (10-4)/10 = 0.6 = 60%
    expect(result.savingsPercent).toBe(60);
  });

  it('handles fractional quantities', () => {
    const product = { category: 'fruits', carbon_kg_per_unit: 0.5 };
    const result = estimateCarbonFootprint(product, 2.5, 0);
    
    expect(result.carbonKg).toBe(1.25);
  });

  it('handles very long distances', () => {
    const product = { category: 'vegetables', carbon_kg_per_unit: 0.4 };
    const result = estimateCarbonFootprint(product, 1, 1000);
    
    // base 0.4 + (1000 * 0.1 / 1) = 0.4 + 100 = 100.4
    expect(result.carbonKg).toBe(100.4);
  });

  it('ignores negative distance', () => {
    const product = { category: 'vegetables', carbon_kg_per_unit: 0.4 };
    const result = estimateCarbonFootprint(product, 10, -50);
    
    // Negative distance treated as 0
    expect(result.carbonKg).toBe(4.0);
  });
});

describe('carbon.js — calculateDistance', () => {
  it('calculates distance between two points using Haversine formula', () => {
    // Distance from New York to London approximately 5570 km
    const nyLat = 40.7128, nyLng = -74.0060;
    const lonLat = 51.5074, lonLng = -0.1278;
    
    const distance = calculateDistance(nyLat, nyLng, lonLat, lonLng);
    
    // Should be close to 5570 km (within 100 km tolerance due to rounding)
    expect(distance).toBeGreaterThan(5400);
    expect(distance).toBeLessThan(5700);
  });

  it('returns zero for identical coordinates', () => {
    const distance = calculateDistance(40.7128, -74.0060, 40.7128, -74.0060);
    expect(distance).toBe(0);
  });

  it('calculates short distances accurately', () => {
    // ~10 km apart
    const distance = calculateDistance(40.7128, -74.0060, 40.7228, -73.9960);
    expect(distance).toBeGreaterThan(5);
    expect(distance).toBeLessThan(15);
  });

  it('handles equator crossing', () => {
    const distance = calculateDistance(10, 0, -10, 0);
    expect(distance).toBeGreaterThan(2000);
    expect(distance).toBeLessThan(2300);
  });

  it('handles date line crossing', () => {
    const distance = calculateDistance(0, 170, 0, -170);
    expect(distance).toBeGreaterThan(2000);
    expect(distance).toBeLessThan(2500);
  });
});

describe('carbon.js — CATEGORY_DEFAULTS', () => {
  it('exports all expected categories', () => {
    expect(CATEGORY_DEFAULTS).toHaveProperty('vegetables');
    expect(CATEGORY_DEFAULTS).toHaveProperty('fruits');
    expect(CATEGORY_DEFAULTS).toHaveProperty('grains');
    expect(CATEGORY_DEFAULTS).toHaveProperty('dairy');
    expect(CATEGORY_DEFAULTS).toHaveProperty('meat');
    expect(CATEGORY_DEFAULTS).toHaveProperty('eggs');
    expect(CATEGORY_DEFAULTS).toHaveProperty('other');
  });

  it('has positive values for all categories', () => {
    Object.values(CATEGORY_DEFAULTS).forEach(value => {
      expect(value).toBeGreaterThan(0);
    });
  });
});

describe('carbon.js — getCategoryDefault', () => {
  it('returns the configured default for a known category', () => {
    expect(getCategoryDefault('vegetables')).toBe(CATEGORY_DEFAULTS.vegetables);
    expect(getCategoryDefault('meat')).toBe(CATEGORY_DEFAULTS.meat);
  });

  it('falls back to the "other" default for unknown or missing categories', () => {
    expect(getCategoryDefault('unknown_category')).toBe(CATEGORY_DEFAULTS.other);
    expect(getCategoryDefault(undefined)).toBe(CATEGORY_DEFAULTS.other);
    expect(getCategoryDefault(null)).toBe(CATEGORY_DEFAULTS.other);
  });
});

describe('carbon.js — calculateTransportEmissions', () => {
  it('returns zero when distance is zero or negative', () => {
    expect(calculateTransportEmissions(0, 10)).toBe(0);
    expect(calculateTransportEmissions(-50, 10)).toBe(0);
  });

  it('returns zero when quantity is zero or negative (avoids division by zero)', () => {
    expect(calculateTransportEmissions(100, 0)).toBe(0);
    expect(calculateTransportEmissions(100, -5)).toBe(0);
  });

  it('scales transport emissions with distance and quantity', () => {
    // 100 km * 0.1 / 5 units = 2 kg per unit
    expect(calculateTransportEmissions(100, 5)).toBe(2);
    // 1000 km * 0.1 / 1 unit = 100 kg per unit
    expect(calculateTransportEmissions(1000, 1)).toBe(100);
  });

  it('rounds transport emissions to 2 decimal places', () => {
    // 33 km * 0.1 / 7 units = 0.4714... → 0.47
    expect(calculateTransportEmissions(33, 7)).toBe(0.47);
  });
});

describe('carbon.js — calculateSavingsPercent', () => {
  it('returns the percentage saved versus the supermarket baseline', () => {
    expect(calculateSavingsPercent(4, 10)).toBe(60);
    expect(calculateSavingsPercent(0, 10)).toBe(100);
  });

  it('returns zero when the supermarket baseline is zero or negative', () => {
    expect(calculateSavingsPercent(4, 0)).toBe(0);
    expect(calculateSavingsPercent(4, -10)).toBe(0);
  });

  it('clamps to zero when the local footprint exceeds the baseline', () => {
    expect(calculateSavingsPercent(15, 10)).toBe(0);
  });

  it('rounds the savings percentage to the nearest integer', () => {
    // (10 - 3.33) / 10 = 0.667 → 67
    expect(calculateSavingsPercent(3.33, 10)).toBe(67);
  });
});

describe('input validation', () => {
  test('coerces numeric carbon values', () => {
    expect(estimateCarbonFootprint({ carbon_kg_per_unit: '0.4', category: 'fruits' }, 2))
      .toEqual(estimateCarbonFootprint({ carbon_kg_per_unit: 0.4, category: 'fruits' }, 2));
  });

  test('falls back for negative carbon values', () => {
    const result = estimateCarbonFootprint({ carbon_kg_per_unit: -1, category: 'fruits' }, 2);
    expect(result.carbonKg).toBe(1);
    expect(result.savingsPercent).toBeGreaterThanOrEqual(0);
    expect(result.savingsPercent).toBeLessThanOrEqual(100);
  });

  test('rejects non-finite coordinates', () => {
    expect(() => calculateDistance(NaN, 0, 0, 0)).toThrow(TypeError);
  });
});
