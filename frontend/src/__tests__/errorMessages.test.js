import { describe, it, expect } from 'vitest';
import { getErrorMessage } from '../utils/errorMessages';

describe('getErrorMessage', () => {
  it('maps an auth domain error', () => {
    expect(getErrorMessage(new Error('invalid credentials')))
      .toBe('Incorrect email or password. Please try again.');
  });

  it('maps a wallet/Stellar domain error', () => {
    expect(getErrorMessage(new Error('insufficient balance')))
      .toBe('Insufficient XLM balance. Please fund your wallet and try again.');
  });

  it('maps an orders domain error', () => {
    expect(getErrorMessage(new Error('out of stock')))
      .toBe('This product is out of stock or doesn\'t have enough quantity for your order.');
  });

  it('maps a products domain error', () => {
    expect(getErrorMessage(new Error('invalid price')))
      .toBe('Invalid price. Please enter a positive number.');
  });

  it('maps a network/server domain error', () => {
    expect(getErrorMessage(new Error('Failed to fetch')))
      .toBe('Unable to reach the server. Check your internet connection and try again.');
  });

  it('resolves an ambiguous input in favor of the earlier ERROR_MAP entry', () => {
    // This message matches BOTH the first auth entry ("invalid credentials") and a
    // later wallet entry ("insufficient balance"). Since the auth entry appears earlier
    // in ERROR_MAP, its message must win regardless of the wallet entry also matching.
    const raw = 'invalid credentials, insufficient balance';
    expect(getErrorMessage(new Error(raw)))
      .toBe('Incorrect email or password. Please try again.');
  });

  it('returns the documented generic fallback for an unrecognized string', () => {
    expect(getErrorMessage(new Error('some totally unrecognized gibberish xyz')))
      .toBe('some totally unrecognized gibberish xyz');
  });

  it('returns the generic fallback message when there is no message at all', () => {
    // An empty string has no `.message` property and stringifies to '',
    // so the mapper has nothing to match and falls back to the generic copy.
    expect(getErrorMessage('')).toBe('An unexpected error occurred. Please try again.');
  });

  it('does not throw for undefined input', () => {
    expect(() => getErrorMessage(undefined)).not.toThrow();
    expect(getErrorMessage(undefined)).toBe('An unexpected error occurred. Please try again.');
  });

  it('does not throw for null input', () => {
    expect(() => getErrorMessage(null)).not.toThrow();
    expect(getErrorMessage(null)).toBe('An unexpected error occurred. Please try again.');
  });

  it('does not throw for an Error object input', () => {
    const err = new Error('timeout');
    expect(() => getErrorMessage(err)).not.toThrow();
    expect(getErrorMessage(err)).toBe('The request timed out. Check your connection and try again.');
  });
});
