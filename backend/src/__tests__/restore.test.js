jest.mock('../../src/logger', () => ({ info: jest.fn(), error: jest.fn() }));
jest.mock('fs');

const fs = require('fs');
const { restoreFromBackup } = require('../../scripts/restore');

describe('restoreFromBackup', () => {
  let exit;

  beforeEach(() => {
    jest.clearAllMocks();
    exit = jest.spyOn(process, 'exit').mockImplementation(() => undefined);
  });

  afterEach(() => exit.mockRestore());

  it('rejects missing and invalid backup files', async () => {
    fs.existsSync.mockReturnValue(false);
    await restoreFromBackup('/tmp/missing.db');
    expect(exit).toHaveBeenCalledWith(1);
  });

  it('rejects backup files with an invalid name', async () => {
    fs.existsSync.mockReturnValue(true);
    await restoreFromBackup('/tmp/database.db');
    expect(exit).toHaveBeenCalledWith(1);
    expect(fs.copyFileSync).not.toHaveBeenCalled();
  });

  it('creates a safety copy before restoring', async () => {
    fs.existsSync.mockReturnValue(true);
    await restoreFromBackup('/tmp/market-2026-01-01.db');
    expect(fs.copyFileSync).toHaveBeenNthCalledWith(1, expect.stringContaining('market.db'), expect.stringContaining('market.db.backup'));
    expect(fs.copyFileSync).toHaveBeenNthCalledWith(2, '/tmp/market-2026-01-01.db', expect.stringContaining('market.db'));
  });
});
