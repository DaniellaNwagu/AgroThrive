const { allocateWaitlistStock } = require('../examples/waitlist-usage');

describe('allocateWaitlistStock (FIFO restock allocation)', () => {
  const entries = [
    { id: 1, userId: 101, quantity: 2 },
    { id: 2, userId: 102, quantity: 3 },
    { id: 3, userId: 103, quantity: 1 },
  ];

  test('allocates every entry when stock exactly covers all entries', () => {
    const { allocations, remainingStock } = allocateWaitlistStock(entries, 6);

    expect(allocations).toHaveLength(3);
    expect(allocations.map((a) => a.entry.id)).toEqual([1, 2, 3]);
    expect(allocations.map((a) => a.allocated)).toEqual([2, 3, 1]);
    expect(remainingStock).toBe(0);
  });

  test('allocates only the first N entries when stock is partial', () => {
    const { allocations, remainingStock } = allocateWaitlistStock(entries, 4);

    expect(allocations).toHaveLength(2);
    expect(allocations.map((a) => a.entry.id)).toEqual([1, 2]);
    expect(allocations.map((a) => a.allocated)).toEqual([2, 2]);
    expect(remainingStock).toBe(0);
  });

  test('skips entries that cannot be fully covered by remaining stock', () => {
    const { allocations, remainingStock } = allocateWaitlistStock(entries, 2);

    expect(allocations).toHaveLength(1);
    expect(allocations[0].entry.id).toBe(1);
    expect(allocations[0].allocated).toBe(2);
    expect(remainingStock).toBe(0);
  });

  test('returns no allocations and the full leftover when stock is zero', () => {
    const { allocations, remainingStock } = allocateWaitlistStock(entries, 0);

    expect(allocations).toEqual([]);
    expect(remainingStock).toBe(0);
  });

  test('handles an empty waitlist', () => {
    const { allocations, remainingStock } = allocateWaitlistStock([], 5);

    expect(allocations).toEqual([]);
    expect(remainingStock).toBe(5);
  });
});
