jest.mock('../db/schema', () => ({ isPostgres: true, query: jest.fn() }));
jest.mock('../utils/stellar', () => ({ sendPayment: jest.fn(() => 'tx') }));
jest.mock('../utils/crypto', () => ({ decryptUserSecretKey: jest.fn(() => 'secret') }));
jest.mock('../utils/mailer', () => ({ sendAuctionNoSaleEmail: jest.fn(() => Promise.resolve()), sendAuctionWinnerEmail: jest.fn(() => Promise.resolve()), sendAuctionSaleEmail: jest.fn(() => Promise.resolve()) }));
const db = require('../db/schema');
const mailer = require('../utils/mailer');
const { sendPayment } = require('../utils/stellar');
const { closeExpiredAuctions } = require('../jobs/auctionCron');

const auction = { id: 1, product_id: 2, reserve_price: 10, farmer_wallet: 'GABC' };

beforeEach(() => jest.clearAllMocks());

test('cancels an auction with no bids', async () => {
  db.query.mockResolvedValueOnce({ rows: [auction] }).mockResolvedValueOnce({ rows: [] }).mockResolvedValue({ rows: [] });
  await closeExpiredAuctions();
  expect(db.query).toHaveBeenCalledWith(expect.stringContaining("status = 'cancelled'"), [1]);
  expect(mailer.sendAuctionNoSaleEmail).not.toHaveBeenCalled();
});

test('ends without sale and notifies distinct bidders below reserve', async () => {
  db.query.mockResolvedValueOnce({ rows: [auction] }).mockResolvedValueOnce({ rows: [{ buyer_id: 2, amount: 5 }] }).mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [{ email: 'a@x', name: 'A' }, { email: 'b@x', name: 'B' }] });
  await closeExpiredAuctions();
  expect(mailer.sendAuctionNoSaleEmail).toHaveBeenCalledTimes(2);
});

test('closes a sale when reserve is met', async () => {
  db.query.mockResolvedValueOnce({ rows: [auction] }).mockResolvedValueOnce({ rows: [{ buyer_id: 2, amount: 10, buyer_secret: 'encrypted' }] }).mockResolvedValue({ rows: [] });
  await closeExpiredAuctions();
  expect(sendPayment).toHaveBeenCalled();
  expect(db.query).toHaveBeenCalledWith(expect.stringContaining("status = 'ended'"), [2, 1]);
});
