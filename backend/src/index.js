require('./config'); // validate env vars before anything else
const { validateStellarConfig } = require('./utils/stellar-config');
validateStellarConfig(); // fail fast on missing Stellar/Soroban config
const app = require('./app');
const db = require('./db/schema');
const logger = require('./logger');
const { startJobs } = require('./jobs');
const PORT = process.env.PORT || 4000;

async function start() {
  // Don't accept traffic until startup migrations have been applied.
  await db.ready;
  app.listen(PORT, () => {
    logger.info(`Backend running on http://localhost:${PORT}`);
    // Background jobs (incl. the daily backup) are registered in jobs/index.js and
    // run only in the process started with RUN_JOBS=true (#1367).
    startJobs();
  });
}

start().catch((error) => {
  logger.error('Backend startup failed:', { error: error.message });
  process.exitCode = 1;
});
