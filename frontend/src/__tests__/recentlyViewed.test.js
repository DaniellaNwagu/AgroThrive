import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  addRecentlyViewed,
  getRecentlyViewed,
  clearRecentlyViewed,
} from '../utils/recentlyViewed.js';

// Mirrors MAX_ITEMS in utils/recentlyViewed.js. Kept as a literal on purpose:
// the module does not export the constant, and these tests are meant to pin
// the cap as documented behaviour rather than re-derive it from the source.
const MAX_ITEMS = 10;
const STORAGE_KEY = 'recently_viewed';

const product = (id, overrides = {}) => ({
  id,
  name: `Product ${id}`,
  image_url: `https://example.com/${id}.png`,
  price: id * 10,
  ...overrides,
});

describe('recentlyViewed', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getRecentlyViewed', () => {
    it('returns an empty array when nothing has been stored', () => {
      expect(getRecentlyViewed()).toEqual([]);
    });

    it('returns what was previously stored', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([{ id: 42, name: 'Saved' }]));
      expect(getRecentlyViewed()).toEqual([{ id: 42, name: 'Saved' }]);
    });

    it('returns an empty array instead of throwing on corrupted JSON', () => {
      localStorage.setItem(STORAGE_KEY, '{not json at all');
      expect(() => getRecentlyViewed()).not.toThrow();
      expect(getRecentlyViewed()).toEqual([]);
    });

    it('recovers after corrupted JSON is replaced with a valid list', () => {
      localStorage.setItem(STORAGE_KEY, 'garbage');
      expect(getRecentlyViewed()).toEqual([]);

      addRecentlyViewed(product(1));

      expect(getRecentlyViewed()).toHaveLength(1);
      expect(getRecentlyViewed()[0].id).toBe(1);
    });
  });

  describe('addRecentlyViewed', () => {
    it('puts a newly viewed product at the front', () => {
      addRecentlyViewed(product(1));
      expect(getRecentlyViewed().map(p => p.id)).toEqual([1]);

      addRecentlyViewed(product(2));
      expect(getRecentlyViewed().map(p => p.id)).toEqual([2, 1]);
    });

    it('stores only the projected fields and prefers image_url over image', () => {
      addRecentlyViewed(
        product(7, { image: 'https://example.com/fallback.png', extra: 'dropped' }),
      );
      addRecentlyViewed({ id: 8, name: 'No image_url', image: 'https://example.com/i.png', price: 5 });

      expect(getRecentlyViewed()).toEqual([
        { id: 8, name: 'No image_url', image_url: 'https://example.com/i.png', price: 5 },
        { id: 7, name: 'Product 7', image_url: 'https://example.com/7.png', price: 70 },
      ]);
    });

    it('moves an already-viewed product to the front without duplicating it', () => {
      addRecentlyViewed(product(1));
      addRecentlyViewed(product(2));
      addRecentlyViewed(product(3));
      addRecentlyViewed(product(1));

      const ids = getRecentlyViewed().map(p => p.id);
      expect(ids).toEqual([1, 3, 2]);
      expect(ids.filter(id => id === 1)).toHaveLength(1);
    });

    it('refreshes the stored fields when a product is re-viewed', () => {
      addRecentlyViewed(product(1, { price: 10 }));
      addRecentlyViewed(product(1, { price: 99, name: 'Renamed' }));

      expect(getRecentlyViewed()).toEqual([
        { id: 1, name: 'Renamed', image_url: 'https://example.com/1.png', price: 99 },
      ]);
    });

    it(`caps the list at ${MAX_ITEMS} entries, keeping the most recent`, () => {
      for (let id = 1; id <= MAX_ITEMS + 5; id += 1) {
        addRecentlyViewed(product(id));
      }

      const stored = getRecentlyViewed();
      expect(stored).toHaveLength(MAX_ITEMS);
      // Newest first: the last five viewed push the earliest five off the list.
      expect(stored[0].id).toBe(MAX_ITEMS + 5);
      expect(stored[MAX_ITEMS - 1].id).toBe(6);
    });

    it('does not exceed the cap when re-viewing an item already past the trim point', () => {
      for (let id = 1; id <= MAX_ITEMS; id += 1) {
        addRecentlyViewed(product(id));
      }
      addRecentlyViewed(product(MAX_ITEMS + 1));

      expect(getRecentlyViewed()).toHaveLength(MAX_ITEMS);
      expect(getRecentlyViewed()[0].id).toBe(MAX_ITEMS + 1);
    });

    it('does not throw when reading storage fails (e.g. private mode)', () => {
      const getItemSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('SecurityError: storage is not available');
      });

      expect(() => addRecentlyViewed(product(1))).not.toThrow();

      // Drop the throwing mock on reads so the write can be inspected.
      getItemSpy.mockRestore();

      // The read failed, so the caller starts from an empty list rather than
      // losing the write altogether.
      expect(JSON.parse(localStorage.getItem(STORAGE_KEY))).toHaveLength(1);
    });

    it('propagates a storage failure when clearing (clear is not wrapped)', () => {
      // Unlike the read path, clearRecentlyViewed has no try/catch. This pins
      // the current contract so a future change that swallows the error is a
      // deliberate decision rather than an accident.
      const failure = new Error('SecurityError: storage is not available');
      vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
        throw failure;
      });

      expect(() => clearRecentlyViewed()).toThrow(failure);
    });
  });

  describe('clearRecentlyViewed', () => {
    it('removes the stored list', () => {
      addRecentlyViewed(product(1));
      expect(getRecentlyViewed()).toHaveLength(1);

      clearRecentlyViewed();

      expect(getRecentlyViewed()).toEqual([]);
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    });

    it('is a no-op when nothing was stored', () => {
      expect(() => clearRecentlyViewed()).not.toThrow();
      expect(getRecentlyViewed()).toEqual([]);
    });
  });
});
