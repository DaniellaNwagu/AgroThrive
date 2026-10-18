// Money utilities for XLM amounts.
//
// XLM has 7 decimal places (1 XLM = 10,000,000 stroops). Doing arithmetic with
// JavaScript floats produces rounding errors (e.g. 0.1 + 0.2 = 0.30000000000000004),
// so all amount math is performed on integer stroops using BigInt.

const STROOPS_PER_XLM = 10000000n;
const XLM_DECIMALS = 7;

/**
 * Parse a decimal string/number into integer stroops (BigInt).
 * Accepts up to 7 decimal places; throws on invalid input or excess precision.
 * @param {string|number|bigint} value
 * @returns {bigint}
 */
export function toStroops(value) {
  if (typeof value === 'bigint') return value;
  if (value === null || value === undefined || value === '') {
    throw new Error('Invalid amount: empty value');
  }

  const str = String(value).trim();
  if (!/^-?\d+(\.\d+)?$/.test(str)) {
    throw new Error(`Invalid amount: ${value}`);
  }

  const negative = str.startsWith('-');
  const unsigned = negative ? str.slice(1) : str;
  const [whole, fraction = ''] = unsigned.split('.');

  if (fraction.length > XLM_DECIMALS) {
    throw new Error(`Amount has more than ${XLM_DECIMALS} decimal places: ${value}`);
  }

  const paddedFraction = fraction.padEnd(XLM_DECIMALS, '0');
  const stroops = BigInt(whole) * STROOPS_PER_XLM + BigInt(paddedFraction || '0');
  return negative ? -stroops : stroops;
}

/**
 * Convert integer stroops (BigInt) back to a decimal string in XLM.
 * @param {bigint|string|number} stroops
 * @returns {string}
 */
export function fromStroops(stroops) {
  const value = typeof stroops === 'bigint' ? stroops : toStroops(stroops);
  const negative = value < 0n;
  const abs = negative ? -value : value;
  const whole = abs / STROOPS_PER_XLM;
  const fraction = (abs % STROOPS_PER_XLM).toString().padStart(XLM_DECIMALS, '0');
  const result = `${whole}.${fraction}`;
  return negative ? `-${result}` : result;
}

/**
 * Add two amounts (in stroops or XLM) and return stroops.
 * @param {bigint|string|number} a
 * @param {bigint|string|number} b
 * @returns {bigint}
 */
export function add(a, b) {
  return toStroops(a) + toStroops(b);
}

/**
 * Multiply an amount by a decimal quantity and return stroops, rounding
 * toward zero when the exact product is smaller than one stroop.
 * @param {bigint|string|number} value
 * @param {bigint|string|number} qty
 * @returns {bigint}
 */
export function mul(value, qty) {
  const qtyStroops = toStroops(qty);
  return toStroops(value) * qtyStroops / STROOPS_PER_XLM;
}

/**
 * Format an amount as XLM with up to 7 decimal places, trimming trailing zeros.
 * @param {bigint|string|number} value
 * @param {string} [locale]
 * @returns {string}
 */
export function formatXlm(value, locale) {
  const stroops = typeof value === 'bigint' ? value : toStroops(value);
  const decimal = fromStroops(stroops);
  const [whole, fraction = ''] = decimal.split('.');
  const trimmed = fraction.replace(/0+$/, '');
  const wholeFormatted = Number(whole).toLocaleString(locale);
  return trimmed ? `${wholeFormatted}.${trimmed}` : wholeFormatted;
}

// Base reserve Stellar locks on every account, mirrored from
// backend/src/routes/wallet.js's BASE_RESERVE_XLM so the two stay in sync.
export const BASE_RESERVE_XLM = 1;

// Stellar's real per-subentry reserve (trustlines, offers, signers, data
// entries, ...) is 0.5 XLM each. Nothing in this codebase tracked subentries
// before this helper, so this constant documents the rule being applied
// rather than reusing an existing one.
export const SUBENTRY_RESERVE_XLM = 0.5;

/**
 * Pure helper for the Wallet send form's spendable-balance check.
 *
 * Returns the amount of XLM (as a number) that may be withdrawn from an
 * account without dropping it below Stellar's minimum reserve. The base
 * reserve is always withheld; each subentry (trustline, offer, signer, ...)
 * withholds an additional SUBENTRY_RESERVE_XLM. The result is never negative.
 *
 * Arithmetic is done in integer stroops (via toStroops/fromStroops) so the
 * equality boundary (amount === spendable) is not corrupted by floating
 * point error.
 *
 * @param {string|number} balance - total XLM balance
 * @param {number} [subentries] - number of subentries on the account
 * @returns {number} spendable XLM amount, >= 0
 */
export function calculateSpendableBalance(balance, subentries = 0) {
  const numBalance = Number(balance);
  if (!Number.isFinite(numBalance)) return 0;

  const safeSubentries = Number.isFinite(Number(subentries)) && Number(subentries) > 0
    ? Number(subentries)
    : 0;
  const reserve = BASE_RESERVE_XLM + safeSubentries * SUBENTRY_RESERVE_XLM;

  const balanceStroops = toStroops(numBalance.toFixed(XLM_DECIMALS));
  const reserveStroops = toStroops(reserve.toFixed(XLM_DECIMALS));
  const spendableStroops = balanceStroops - reserveStroops;

  if (spendableStroops <= 0n) return 0;
  return Number(fromStroops(spendableStroops));
}

/**
 * Format a fiat amount with 2 decimal places.
 * @param {number|string} value
 * @param {string} [locale]
 * @param {string} [currency]
 * @returns {string}
 */
export function formatFiat(value, locale, currency = 'USD') {
  const num = typeof value === 'number' ? value : parseFloat(value);
  if (Number.isNaN(num)) return '';
  return num.toLocaleString(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
