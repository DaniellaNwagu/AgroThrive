import { describe, it, expect } from 'vitest';
import { getStellarErrorMessage } from '../stellarErrors';

describe('getStellarErrorMessage', () => {
  it('returns the unfunded-account message with a /wallet link when code is unfunded_account', () => {
    const message = getStellarErrorMessage({ code: 'unfunded_account' });
    expect(message).toContain('/wallet');
    expect(message).toContain('<a href="/wallet"');
  });

  it('prefers the error-code map over a message that would also match a regex', () => {
    // message text ("insufficient balance") would match STELLAR_ERROR_MAP's
    // "insufficient balance" regex entry, but the explicit code should win.
    const err = { code: 'tx_bad_seq', message: 'insufficient balance' };
    expect(getStellarErrorMessage(err))
      .toBe('Invalid transaction sequence number. Please try again.');
  });

  it('falls back to the regex map when the code is unknown but the message matches', () => {
    const err = { code: 'some_unmapped_code', message: 'insufficient balance' };
    expect(getStellarErrorMessage(err))
      .toBe('Insufficient XLM balance. Please fund your wallet first.');
  });

  it('returns err.message when there is no code and no regex match', () => {
    const err = { message: 'a totally unrelated error message' };
    expect(getStellarErrorMessage(err)).toBe('a totally unrelated error message');
  });

  it('returns the generic fallback containing the code placeholder when there is neither code nor message', () => {
    const message = getStellarErrorMessage({});
    expect(message).toContain('unknown');
    expect(message).toMatch(/unexpected error/i);
  });
});
