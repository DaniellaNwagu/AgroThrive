/**
 * Example usage of WaitlistService
 * Demonstrates how to integrate the service with existing API patterns
 */

const WaitlistService = require('../services/WaitlistService');

// Example: How to use WaitlistService in an API route
async function exampleApiUsage() {
  const service = new WaitlistService();

  // Example 1: Join waitlist
  console.log('Example 1: Joining waitlist');
  const joinResult = await service.joinWaitlist(123, 456, 2);
  console.log('Join result:', joinResult);

  // Example 2: Get waitlist status
  console.log('\nExample 2: Getting waitlist status');
  const statusResult = await service.getWaitlistStatus(123, 456);
  console.log('Status result:', statusResult);

  // Example 3: Leave waitlist
  console.log('\nExample 3: Leaving waitlist');
  const leaveResult = await service.leaveWaitlist(123, 456);
  console.log('Leave result:', leaveResult);

  // Example 4: Get buyer's all waitlist entries
  console.log('\nExample 4: Getting buyer waitlist entries');
  const entriesResult = await service.getBuyerWaitlistEntries(123);
  console.log('Entries result:', entriesResult);
}

// Example: Integration with existing route patterns
function exampleRouteIntegration() {
  const router = require('express').Router();
  const auth = require('../middleware/auth');
  const { err } = require('../middleware/error');

  // POST /api/products/:id/waitlist - Join waitlist
  router.post('/:id/waitlist', auth, async (req, res) => {
    if (req.user.role !== 'buyer') {
      return err(res, 403, 'Only buyers can join waitlists', 'forbidden');
    }

    const service = new WaitlistService();
    const { quantity } = req.body;

    if (!quantity || !Number.isInteger(quantity) || quantity <= 0) {
      return err(res, 400, 'Quantity must be a positive integer', 'validation_error');
    }

    const result = await service.joinWaitlist(req.user.id, parseInt(req.params.id), quantity);

    if (result.success) {
      res.json({
        success: true,
        position: result.position,
        totalWaiting: result.totalWaiting,
        message: 'Successfully joined waitlist',
      });
    } else {
      return err(res, 400, result.error, 'waitlist_error');
    }
  });

  // DELETE /api/products/:id/waitlist - Leave waitlist
  router.delete('/:id/waitlist', auth, async (req, res) => {
    if (req.user.role !== 'buyer') {
      return err(res, 403, 'Only buyers can leave waitlists', 'forbidden');
    }

    const service = new WaitlistService();
    const result = await service.leaveWaitlist(req.user.id, parseInt(req.params.id));

    if (result.success) {
      res.json({
        success: true,
        message: result.message,
      });
    } else {
      return err(res, 400, result.error, 'waitlist_error');
    }
  });

  // GET /api/products/:id/waitlist/status - Get waitlist status
  router.get('/:id/waitlist/status', auth, async (req, res) => {
    if (req.user.role !== 'buyer') {
      return err(res, 403, 'Only buyers can check waitlist status', 'forbidden');
    }

    const service = new WaitlistService();
    const result = await service.getWaitlistStatus(req.user.id, parseInt(req.params.id));

    if (result.success) {
      res.json({
        success: true,
        onWaitlist: result.onWaitlist,
        position: result.position,
        totalWaiting: result.totalWaiting,
      });
    } else {
      return err(res, 500, result.error, 'waitlist_error');
    }
  });

  return router;
}

/**
 * Pure FIFO allocation helper for restock processing.
 * Walks waitlist entries in order, allocating each entry's quantity while
 * enough stock remains, and stops at the first entry that cannot be fully
 * satisfied (preserving FIFO fairness).
 *
 * @param {Array<{buyer_id: number, quantity: number}>} entries - FIFO-ordered waitlist entries
 * @param {number} newQuantity - stock available for allocation
 * @returns {{allocations: Array<{buyer_id: number, quantity: number}>, remainingStock: number}}
 */
function allocateWaitlistStock(entries, newQuantity) {
  const allocations = [];
  let remainingStock = newQuantity;

  for (const entry of entries) {
    if (remainingStock >= entry.quantity) {
      allocations.push({ buyer_id: entry.buyer_id, quantity: entry.quantity });
      remainingStock -= entry.quantity;
    } else {
      break;
    }
  }

  return { allocations, remainingStock };
}

// Example: Integration with restock functionality
async function exampleRestockIntegration(productId, newQuantity) {
  const service = new WaitlistService();

  // Get waitlist entries in FIFO order
  const entriesResult = await service.getProductWaitlistEntries(productId);

  if (!entriesResult.success) {
    console.error('Failed to get waitlist entries:', entriesResult.error);
    return;
  }

  console.log(`Processing ${entriesResult.data.length} waitlist entries for product ${productId}`);

  // This would be integrated into the actual restock endpoint
  // For now, just log what would happen
  const { allocations, remainingStock } = allocateWaitlistStock(
    entriesResult.data,
    newQuantity
  );

  for (const allocation of allocations) {
    console.log(
      `Would create order for buyer ${allocation.buyer_id}, quantity ${allocation.quantity}`
    );
    // In real implementation: create order, remove waitlist entry, send notification
  }

  const allocatedCount = allocations.length;
  if (allocatedCount < entriesResult.data.length) {
    const skipped = entriesResult.data[allocatedCount];
    console.log(
      `Insufficient stock for buyer ${skipped.buyer_id} (needs ${skipped.quantity}, have ${remainingStock})`
    );
  }

  console.log(`Remaining stock after processing waitlist: ${remainingStock}`);
}

module.exports = {
  exampleApiUsage,
  exampleRouteIntegration,
  exampleRestockIntegration,
  allocateWaitlistStock,
};
