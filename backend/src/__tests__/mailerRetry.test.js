/**
 * mailerRetry.test.js
 * Covers the gaps in sendWithRetry's retry/persistence/skip behaviour that
 * mailer.test.js does not exercise: first-attempt success, third-attempt
 * success, the non-critical skip path, and the swallowed DB-insert failure.
 */

jest.mock('nodemailer');
// jest.setup.js auto-mocks this module globally for route tests; use the real implementation here.
jest.unmock('../utils/mailer');

describe('sendWithRetry — retry, persistence and non-critical skip paths', () => {
  const mailOptions = { to: 'buyer@test.com', subject: 'Order Confirmed', text: 'body' };
  let mailer;
  let sendMail;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.resetModules();
    process.env.SMTP_HOST = 'smtp.test.com';
    process.env.SMTP_USER = 'user@test.com';
    process.env.SMTP_PASS = 'pass';

    sendMail = jest.fn();
    const nodemailer = require('nodemailer');
    nodemailer.createTransport = jest.fn(() => ({ sendMail }));

    mailer = require('../utils/mailer');
  });

  afterEach(() => {
    jest.useRealTimers();
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
  });

  test('success on the first attempt calls sendMail once and writes no failed_emails row', async () => {
    sendMail.mockResolvedValueOnce({});
    const mockDb = { prepare: jest.fn(() => ({ run: jest.fn() })) };

    await mailer.sendWithRetry(mailOptions, 'password_reset', mockDb);

    expect(sendMail).toHaveBeenCalledTimes(1);
    expect(mockDb.prepare).not.toHaveBeenCalled();
  });

  test('success on the third attempt calls sendMail three times and still writes no row', async () => {
    sendMail
      .mockRejectedValueOnce(new Error('temporary'))
      .mockRejectedValueOnce(new Error('temporary'))
      .mockResolvedValueOnce({});
    const mockDb = { prepare: jest.fn(() => ({ run: jest.fn() })) };

    const promise = mailer.sendWithRetry(mailOptions, 'password_reset', mockDb);

    await jest.advanceTimersByTimeAsync(1000);
    await jest.advanceTimersByTimeAsync(2000);

    await promise;

    expect(sendMail).toHaveBeenCalledTimes(3);
    expect(mockDb.prepare).not.toHaveBeenCalled();
  });

  test('three failures for a critical type write exactly one failed_emails row', async () => {
    sendMail.mockRejectedValue(new Error('SMTP down'));
    const mockRun = jest.fn();
    const mockDb = { prepare: jest.fn(() => ({ run: mockRun })) };

    const promise = mailer.sendWithRetry(mailOptions, 'password_reset', mockDb);

    await jest.advanceTimersByTimeAsync(1000);
    await jest.advanceTimersByTimeAsync(2000);

    await promise;

    expect(sendMail).toHaveBeenCalledTimes(3);
    expect(mockDb.prepare).toHaveBeenCalledTimes(1);
    expect(mockDb.prepare).toHaveBeenCalledWith(
      'INSERT INTO failed_emails (recipient, subject, error, type) VALUES (?, ?, ?, ?)'
    );
    expect(mockRun).toHaveBeenCalledWith('buyer@test.com', 'Order Confirmed', 'SMTP down', 'password_reset');
  });

  test('three failures for a non-critical type write no row', async () => {
    sendMail.mockRejectedValue(new Error('SMTP down'));
    const mockDb = { prepare: jest.fn(() => ({ run: jest.fn() })) };

    const promise = mailer.sendWithRetry(mailOptions, 'low_stock', mockDb);

    await jest.advanceTimersByTimeAsync(1000);
    await jest.advanceTimersByTimeAsync(2000);

    await promise;

    expect(sendMail).toHaveBeenCalledTimes(3);
    expect(mockDb.prepare).not.toHaveBeenCalled();
  });

  test('a throwing db.prepare does not propagate out of sendWithRetry', async () => {
    sendMail.mockRejectedValue(new Error('SMTP down'));
    const mockDb = {
      prepare: jest.fn(() => {
        throw new Error('db unavailable');
      }),
    };

    const promise = mailer.sendWithRetry(mailOptions, 'order_confirmation', mockDb);

    await jest.advanceTimersByTimeAsync(1000);
    await jest.advanceTimersByTimeAsync(2000);

    await expect(promise).resolves.toBeUndefined();
    expect(mockDb.prepare).toHaveBeenCalledTimes(1);
  });
});
