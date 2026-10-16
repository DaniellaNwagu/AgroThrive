process.env.JWT_SECRET = 'test-secret';
const { encryptMnemonic, decryptMnemonic } = require('../routes/auth');

test('versioned mnemonic encryption round trips', async () => {
  const encrypted = await encryptMnemonic('alpha beta gamma', 'password');
  await expect(decryptMnemonic(encrypted, 'password')).resolves.toBe('alpha beta gamma');
  await expect(decryptMnemonic(encrypted, 'wrong')).resolves.toBeNull();
  await expect(decryptMnemonic('01', 'password')).resolves.toBeNull();
  await expect(decryptMnemonic(`ff${encrypted.slice(2)}`, 'password')).resolves.toBeNull();
});
