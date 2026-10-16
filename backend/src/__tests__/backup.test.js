jest.mock('../logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));
const fs = require('fs');
const os = require('os');
const path = require('path');
const logger = require('../logger');
const { cleanupOldBackups } = require('../../scripts/backup');

test('keeps seven newest matching backups', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'backups-'));
  for (let index = 0; index < 10; index += 1) {
    const file = path.join(directory, `market-${index}.db`); fs.writeFileSync(file, 'x'); fs.utimesSync(file, index, index);
  }
  fs.writeFileSync(path.join(directory, 'other.db'), 'x');
  await cleanupOldBackups(directory);
  expect(fs.readdirSync(directory).filter((name) => name.startsWith('market-'))).toHaveLength(7);
  expect(fs.existsSync(path.join(directory, 'other.db'))).toBe(true);
});

test('logs and swallows cleanup errors', async () => {
  jest.spyOn(fs, 'readdirSync').mockImplementationOnce(() => { throw new Error('boom'); });
  await expect(cleanupOldBackups('/missing')).resolves.toBeUndefined();
  expect(logger.warn).toHaveBeenCalled();
});
