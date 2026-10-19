const { sendWithRetry } = require('../utils/mailer');
const logger = require('../logger');

function smtpConfigured() {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

async function sendVerificationEmail({ to, name, token }) {
  if (!smtpConfigured()) {
    logger.warn('[emailService] SMTP not configured — skipping verification email');
    return null;
  }
  const verifyUrl = `${process.env.APP_URL || 'http://localhost:3000'}/verify-email?token=${token}`;
  return sendWithRetry(
    {
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject: 'Verify your AgroThrive account',
      text: `Hi ${name},\n\nPlease verify your email by visiting:\n${verifyUrl}\n\nAgroThrive`,
    },
    'email_verification'
  );
}

async function sendPasswordResetEmail({ to, name, token }) {
  if (!smtpConfigured()) {
    logger.warn('[emailService] SMTP not configured — skipping password reset email');
    return null;
  }
  const resetUrl = `${process.env.APP_URL || 'http://localhost:3000'}/reset-password?token=${token}`;
  return sendWithRetry(
    {
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject: 'Reset your AgroThrive password',
      text: `Hi ${name},\n\nReset your password by visiting:\n${resetUrl}\n\nAgroThrive`,
    },
    'password_reset'
  );
}

module.exports = {
  smtpConfigured,
  sendVerificationEmail,
  sendPasswordResetEmail,
};
