const fs = require('fs');
const os = require('os');
const path = require('path');
const { createBackup } = require('../../scripts/backup');

test('creates a dated backup with identical contents', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gogreen-backup-'));
  const dbPath = path.join(root, 'source.db');
  const backupsDir = path.join(root, 'backups');
  fs.writeFileSync(dbPath, 'database');
  const backupPath = await createBackup({ dbPath, backupsDir });
  expect(path.basename(backupPath)).toMatch(/^market-\d{4}-\d{2}-\d{2}\.db$/);
  expect(fs.readFileSync(backupPath, 'utf8')).toBe('database');
});
