import { describe, it, expect } from 'vitest';
import {
  toStroops,
  fromStroops,
  add,
  mul,
  formatXlm,
  formatFiat,
} from '../utils/money.js';

describe('money utilities', () => {
  describe('toStroops', () => {
    it('returns BigInt values unchanged', () => {
      expect(toStroops(100n)).toBe(100n);
      expect(toStroops(0n)).toBe(0n);
      expect(toStroops(-50n)).toBe(-50n);
    });

    it('throws error for empty, null, and undefined values', () => {
      expect(() => toStroops(null)).toThrow('Invalid amount: empty value');
      expect(() => toStroops(undefined)).toThrow('Invalid amount: empty value');
      expect(() => toStroops('')).toThrow('Invalid amount: empty value');
    });

    it('throws error for non-numeric input', () => {
      expect(() => toStroops('abc')).toThrow('Invalid amount: abc');
      expect(() => toStroops('12.34.56')).toThrow('Invalid amount: 12.34.56');
      expect(() => toStroops('--5')).toThrow('Invalid amount: --5');
    });

    it('throws error for precision exceeding 7 decimal places', () => {
      expect(() => toStroops('0.12345678')).toThrow(
        'Amount has more than 7 decimal places: 0.12345678'
      );
    });

    it('converts zero correctly', () => {
      expect(toStroops('0')).toBe(0n);
      expect(toStroops(0)).toBe(0n);
      expect(toStroops('0.0')).toBe(0n);
    });

    it('converts positive decimals and integers', () => {
      expect(toStroops('1')).toBe(10000000n);
      expect(toStroops(1)).toBe(10000000n);
      expect(toStroops('0.0000001')).toBe(1n);
      expect(toStroops('12.34567')).toBe(123456700n);
    });

    it('converts negative decimals and integers', () => {
      expect(toStroops('-1')).toBe(-10000000n);
      expect(toStroops(-1)).toBe(-10000000n);
      expect(toStroops('-0.5')).toBe(-5000000n);
    });

    it('converts very large numbers', () => {
      expect(toStroops('1000000')).toBe(10000000000000n);
    });
  });

  describe('fromStroops', () => {
    it('formats BigInt stroops into exact decimal string representation', () => {
      expect(fromStroops(0n)).toBe('0.0000000');
      expect(fromStroops(10000000n)).toBe('1.0000000');
      expect(fromStroops(1n)).toBe('0.0000001');
      expect(fromStroops(123456700n)).toBe('12.3456700');
    });

    it('formats negative stroops correctly', () => {
      expect(fromStroops(-10000000n)).toBe('-1.0000000');
      expect(fromStroops(-5000000n)).toBe('-0.5000000');
    });

    it('accepts string and number inputs via toStroops', () => {
      expect(fromStroops('2')).toBe('2.0000000');
      expect(fromStroops(10)).toBe('10.0000000');
    });
  });

  describe('add', () => {
    it('adds two amounts in XLM and returns stroops', () => {
      expect(add(1, 2)).toBe(30000000n);
      expect(add('0.5', '0.25')).toBe(7500000n);
    });

    it('handles zero and negative amounts', () => {
      expect(add(0, 0)).toBe(0n);
      expect(add('10', '-5')).toBe(50000000n);
      expect(add('-2', '-3')).toBe(-50000000n);
    });
  });

  describe('mul', () => {
    it('multiplies value by quantity and returns stroops', () => {
      expect(mul(2, 3)).toBe(60000000n);
      expect(mul('1.5', 2)).toBe(30000000n);
      expect(mul('0.25', '4')).toBe(10000000n);
    });

    it('preserves fractional quantity precision', () => {
      expect(mul('2.5', '0.5')).toBe(12500000n);
      expect(mul('1', '3')).toBe(30000000n);
      expect(mul('3', '1')).toBe(30000000n);
      expect(mul('-2.5', '0.5')).toBe(-12500000n);
    });

    it('handles zero and negative inputs', () => {
      expect(mul(0, 5)).toBe(0n);
      expect(mul(5, 0)).toBe(0n);
      expect(mul('-2', 3)).toBe(-60000000n);
    });
  });

  describe('formatXlm', () => {
    it('formats zero correctly', () => {
      expect(formatXlm(0)).toBe('0');
      expect(formatXlm('0')).toBe('0');
      expect(formatXlm(0n)).toBe('0');
    });

    it('formats positive numbers and trims trailing zeros', () => {
      expect(formatXlm(1)).toBe('1');
      expect(formatXlm('1.5')).toBe('1.5');
      expect(formatXlm('1.5000000')).toBe('1.5');
      expect(formatXlm('0.0000001')).toBe('0.0000001');
      expect(formatXlm(10000000n)).toBe('1');
    });

    it('formats negative numbers correctly', () => {
      expect(formatXlm(-5)).toBe('-5');
      expect(formatXlm('-1.25')).toBe('-1.25');
    });

    it('formats large numbers with locale separators', () => {
      expect(formatXlm('1000000', 'en-US')).toBe('1,000,000');
      expect(formatXlm('1000000.123', 'en-US')).toBe('1,000,000.123');
    });
  });

  describe('formatFiat', () => {
    it('formats zero amount', () => {
      expect(formatFiat(0, 'en-US', 'USD')).toBe('$0.00');
      expect(formatFiat('0', 'en-US', 'USD')).toBe('$0.00');
    });

    it('formats standard fiat values', () => {
      expect(formatFiat(25.5, 'en-US', 'USD')).toBe('$25.50');
      expect(formatFiat('100', 'en-US', 'USD')).toBe('$100.00');
    });

    it('rounds values to two decimal places', () => {
      expect(formatFiat(12.345, 'en-US', 'USD')).toBe('$12.35');
      expect(formatFiat(12.341, 'en-US', 'USD')).toBe('$12.34');
      expect(formatFiat(99.999, 'en-US', 'USD')).toBe('$100.00');
    });

    it('formats negative amounts', () => {
      expect(formatFiat(-50, 'en-US', 'USD')).toBe('-$50.00');
      expect(formatFiat('-12.5', 'en-US', 'USD')).toBe('-$12.50');
    });

    it('formats very large amounts with locale grouping', () => {
      expect(formatFiat(1000000, 'en-US', 'USD')).toBe('$1,000,000.00');
    });

    it('returns empty string for null, undefined, NaN, and invalid inputs', () => {
      expect(formatFiat(null, 'en-US', 'USD')).toBe('');
      expect(formatFiat(undefined, 'en-US', 'USD')).toBe('');
      expect(formatFiat(NaN, 'en-US', 'USD')).toBe('');
      expect(formatFiat('not-a-number', 'en-US', 'USD')).toBe('');
    });

    it('supports custom currency codes', () => {
      expect(formatFiat(10, 'en-US', 'EUR')).toBe('€10.00');
    });
  });
});
