const sendWithRetry = jest.fn();

jest.mock('../utils/mailer', () => ({
  sendWithRetry: (...args) => sendWithRetry(...args),
}));

const {
  sendVerificationEmail,
  sendPasswordResetEmail,
} = require('../services/emailService');

const SMTP_ENV_KEYS = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS'];

const setSmtpConfigured = () => {
  process.env.SMTP_HOST = 'smtp.example.com';
  process.env.SMTP_USER = 'user@example.com';
  process.env.SMTP_PASS = 'secret';
};

const clearSmtp = () => {
  SMTP_ENV_KEYS.forEach((key) => {
    delete process.env[key];
  });
};

describe('emailService', () => {
  beforeEach(() => {
    sendWithRetry.mockReset();
    clearSmtp();
  });

  afterEach(() => {
    clearSmtp();
  });

  describe('sendVerificationEmail', () => {
    it('returns null and does not send when SMTP is unconfigured', async () => {
      const result = await sendVerificationEmail('recipient@example.com', 'token-123');

      expect(result).toBeNull();
      expect(sendWithRetry).not.toHaveBeenCalled();
    });

    it('returns null when any SMTP variable is missing', async () => {
      process.env.SMTP_HOST = 'smtp.example.com';
      process.env.SMTP_USER = 'user@example.com';
      delete process.env.SMTP_PASS;

      const result = await sendVerificationEmail('recipient@example.com', 'token-123');

      expect(result).toBeNull();
      expect(sendWithRetry).not.toHaveBeenCalled();
    });

    it('delegates to sendWithRetry with the expected payload when SMTP is configured', async () => {
      setSmtpConfigured();
      sendWithRetry.mockResolvedValue({ messageId: 'verification-1' });

      const result = await sendVerificationEmail('recipient@example.com', 'token-123');

      expect(sendWithRetry).toHaveBeenCalledTimes(1);
      const [payload, tag] = sendWithRetry.mock.calls[0];
      expect(payload.to).toBe('recipient@example.com');
      expect(payload.subject).toBe('Verify your email');
      expect(payload.from).toBe(process.env.SMTP_USER);
      expect(payload.text).toContain('token-123');
      expect(tag).toBe('email_verification');
      expect(result).toEqual({ messageId: 'verification-1' });
    });
  });

  describe('sendPasswordResetEmail', () => {
    it('returns null and does not send when SMTP is unconfigured', async () => {
      const result = await sendPasswordResetEmail('recipient@example.com', 'reset-token');

      expect(result).toBeNull();
      expect(sendWithRetry).not.toHaveBeenCalled();
    });

    it('returns null when any SMTP variable is missing', async () => {
      process.env.SMTP_HOST = 'smtp.example.com';
      delete process.env.SMTP_USER;
      process.env.SMTP_PASS = 'secret';

      const result = await sendPasswordResetEmail('recipient@example.com', 'reset-token');

      expect(result).toBeNull();
      expect(sendWithRetry).not.toHaveBeenCalled();
    });

    it('delegates to sendWithRetry with the expected payload when SMTP is configured', async () => {
      setSmtpConfigured();
      sendWithRetry.mockResolvedValue({ messageId: 'reset-1' });

      const result = await sendPasswordResetEmail('recipient@example.com', 'reset-token');

      expect(sendWithRetry).toHaveBeenCalledTimes(1);
      const [payload, tag] = sendWithRetry.mock.calls[0];
      expect(payload.to).toBe('recipient@example.com');
      expect(payload.subject).toBe('Reset your password');
      expect(payload.from).toBe(process.env.SMTP_USER);
      expect(payload.text).toContain('reset-token');
      expect(tag).toBe('password_reset');
      expect(result).toEqual({ messageId: 'reset-1' });
    });
  });
});
