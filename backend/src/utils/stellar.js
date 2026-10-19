// Backward-compatible barrel — callers may continue to require('./utils/stellar').
// Internals live in the domain modules below; only a couple of small helpers that
// span modules are defined here.
const config = require('./stellar-config');
const accounts = require('./stellar-accounts');
const payments = require('./stellar-payments');
const contracts = require('./stellar-contracts');

const { sorobanServer } = config;

// Health check for Soroban RPC endpoint
async function checkSorobanRPC() {
  const startTime = Date.now();
  try {
    // Use getHealth method from SorobanRpc.Server
    const healthResponse = await sorobanServer.getHealth();
    const responseTime = Date.now() - startTime;
    
    return {
      status: 'healthy',
      responseTime,
      details: {
        status: healthResponse.status,
        latestLedger: healthResponse.latestLedger,
        oldestLedger: healthResponse.oldestLedger,
        ledgerRetentionWindow: healthResponse.ledgerRetentionWindow
      }
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;
    return {
      status: 'unhealthy',
      responseTime,
      error: error.message || 'Unknown error',
      details: {
        code: error.code,
        type: error.constructor.name
      }
    };
  }
}

// EscrowError codes from contracts/escrow/src/lib.rs. Codes are append-only;
// keep in sync with the README "Error Codes" table. (#1291)
const ESCROW_ERRORS = {
  1: { code: 'escrow_not_found', message: 'No escrow exists for this order.' },
  2: { code: 'escrow_already_settled', message: 'This escrow has already been released or refunded.' },
  3: { code: 'escrow_in_dispute', message: 'This order is in dispute and can only be settled by an arbitrator.' },
  4: { code: 'escrow_unauthorized', message: 'You are not allowed to perform this escrow action.' },
  5: { code: 'escrow_invalid_amount', message: 'The escrow amount is invalid.' },
  6: { code: 'escrow_already_exists', message: 'An escrow already exists for this order.' },
  7: { code: 'escrow_timeout_not_reached', message: 'The escrow timeout has not passed yet.' },
  8: { code: 'escrow_invalid_wasm_hash', message: 'The contract upgrade hash is invalid.' },
  9: { code: 'escrow_no_pending_admin', message: 'There is no pending admin transfer to accept.' },
  10: { code: 'escrow_invalid_token', message: 'The token does not match the one used for this escrow.' },
  11: { code: 'escrow_migration_failed', message: 'The escrow record could not be migrated.' },
  12: { code: 'escrow_not_enough_signatures', message: 'Not enough cooperative signatures to release this escrow.' },
  13: { code: 'escrow_coop_not_configured', message: 'Cooperative signers are not configured.' },
  14: { code: 'escrow_already_initialized', message: 'The escrow contract is already initialized.' },
  15: { code: 'escrow_not_admin', message: 'Only the platform admin can perform this action.' },
  16: { code: 'escrow_below_min_deposit', message: 'The deposit is below the minimum escrow amount.' },
  17: { code: 'escrow_batch_too_large', message: 'Too many escrows in one batch.' },
  18: { code: 'escrow_snapshot_not_found', message: 'No escrow snapshot exists for that ledger.' },
  19: { code: 'escrow_not_yet_releasable', message: 'This pre-order cannot be released before its unlock date.' },
  20: { code: 'escrow_submission_window_closed', message: 'The 48-hour evidence submission window has closed.' },
  21: { code: 'escrow_auto_release_not_reached', message: 'The auto-release time has not been reached yet.' },
  22: { code: 'escrow_too_many_coop_signers', message: 'Too many cooperative signers configured.' },
  23: { code: 'escrow_invalid_timeout', message: 'The escrow timeout is too short.' },
  24: { code: 'escrow_invalid_order_id', message: 'The order ID is out of range for the escrow contract.' },
  25: { code: 'escrow_invalid_royalty', message: 'The cooperative royalty cannot exceed 100%.' },
  26: { code: 'escrow_evidence_limit_reached', message: 'You have already submitted the maximum amount of evidence.' },
  27: { code: 'escrow_not_disputed', message: 'This order is not in dispute.' },
  28: { code: 'escrow_not_initialized', message: 'The escrow contract has not been initialized.' },
};

/**
 * Map a Soroban failure carrying `Error(Contract, #N)` to a user-facing escrow error.
 * @returns {{ code: string, message: string } | null}
 */
function parseEscrowError(error) {
  const match = /Error\(Contract, #(\d+)\)/.exec(error?.message || String(error));
  return match ? ESCROW_ERRORS[Number(match[1])] || null : null;
}

module.exports = {
  ...config,
  ...accounts,
  ...payments,
  ...contracts,
  checkSorobanRPC,
  parseEscrowError,
};
