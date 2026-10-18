import { describe, it, expect, beforeEach, vi } from 'vitest';
import { addRecentlyViewed, getRecentlyViewed, clearRecentlyViewed } from '../utils/recentlyViewed';

const MAX_ITEMS = 10;

function makeProduct(id) {
  return { id, name: `Product ${id}`, image_url: `/img/${id}.png`, price: id * 10 };
}

describe('recentlyViewed', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('adds a product to the front of the list', () => {
    addRecentlyViewed(makeProduct(1));
    addRecentlyViewed(makeProduct(2));

    const list = getRecentlyViewed();
    expect(list[0].id).toBe(2);
    expect(list[1].id).toBe(1);
  });

  it('re-adding an existing product moves it to the front without duplicating', () => {
    addRecentlyViewed(makeProduct(1));
    addRecentlyViewed(makeProduct(2));
    addRecentlyViewed(makeProduct(1));

    const list = getRecentlyViewed();
    expect(list).toHaveLength(2);
    expect(list[0].id).toBe(1);
    expect(list[1].id).toBe(2);
  });

  it('caps the list at the module max length', () => {
    for (let i = 1; i <= MAX_ITEMS + 5; i++) {
      addRecentlyViewed(makeProduct(i));
    }

    const list = getRecentlyViewed();
    expect(list).toHaveLength(MAX_ITEMS);
    expect(list[0].id).toBe(MAX_ITEMS + 5);
  });

  it('recovers from corrupted JSON in storage without throwing', () => {
    localStorage.setItem('recently_viewed', '{not valid json');

    expect(() => getRecentlyViewed()).not.toThrow();
    expect(getRecentlyViewed()).toEqual([]);
  });

  it('does not throw when getItem is unavailable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage unavailable');
    });

    expect(() => getRecentlyViewed()).not.toThrow();
    expect(getRecentlyViewed()).toEqual([]);
  });

  it('does not throw when setItem is unavailable', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded');
    });

    expect(() => addRecentlyViewed(makeProduct(1))).not.toThrow();
  });

  it('clears the stored list', () => {
    addRecentlyViewed(makeProduct(1));
    clearRecentlyViewed();

    expect(getRecentlyViewed()).toEqual([]);
  });
});
