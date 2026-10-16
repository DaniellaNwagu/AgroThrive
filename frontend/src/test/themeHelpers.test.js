import { describe, it, expect } from 'vitest';
import {
  DATA_THEME_ATTRIBUTE,
  THEME_STORAGE_KEY,
  USER_STORAGE_KEY,
  readDataTheme,
  readStoredTheme,
  buildUserPayload,
  writeUser,
} from './e2e/themeHelpers.js';

/** Minimal in-memory storage stub matching the Web Storage surface we use. */
function createStorageStub(initial = {}) {
  const store = { ...initial };
  return {
    getItem: (key) => (key in store ? store[key] : null),
    setItem: (key, value) => {
      store[key] = String(value);
    },
    removeItem: (key) => {
      delete store[key];
    },
    _store: store,
  };
}

/** Minimal document stub exposing documentElement.getAttribute. */
function createDocumentStub(attributes = {}) {
  return {
    documentElement: {
      getAttribute: (name) => (name in attributes ? attributes[name] : null),
    },
  };
}

describe('theme e2e helpers', () => {
  it('exposes the contract constants', () => {
    expect(DATA_THEME_ATTRIBUTE).toBe('data-theme');
    expect(THEME_STORAGE_KEY).toBe('theme');
    expect(USER_STORAGE_KEY).toBe('user');
  });

  describe('readDataTheme', () => {
    it('returns the attribute value set on the document element', () => {
      const doc = createDocumentStub({ [DATA_THEME_ATTRIBUTE]: 'dark' });
      expect(readDataTheme(doc)).toBe('dark');
    });

    it('returns null when the attribute is absent', () => {
      const doc = createDocumentStub();
      expect(readDataTheme(doc)).toBeNull();
    });
  });

  describe('readStoredTheme', () => {
    it('returns null when the theme key is absent', () => {
      const storage = createStorageStub();
      expect(readStoredTheme(storage)).toBeNull();
    });

    it('returns the stored string when present', () => {
      const storage = createStorageStub({ [THEME_STORAGE_KEY]: 'dark' });
      expect(readStoredTheme(storage)).toBe('dark');
    });
  });

  describe('injectUser / writeUser', () => {
    it('writes a JSON payload with id, name, email and the requested role under the user key', () => {
      const storage = createStorageStub();
      writeUser(storage, 'seller');

      const raw = storage.getItem(USER_STORAGE_KEY);
      expect(raw).not.toBeNull();

      const payload = JSON.parse(raw);
      expect(payload).toEqual({
        id: 1,
        name: 'Test User',
        email: 'test@example.com',
        role: 'seller',
      });
    });

    it('defaults the role to buyer', () => {
      const storage = createStorageStub();
      writeUser(storage);

      expect(JSON.parse(storage.getItem(USER_STORAGE_KEY)).role).toBe('buyer');
    });

    it('buildUserPayload produces the same shape as writeUser', () => {
      const storage = createStorageStub();
      writeUser(storage, 'admin');
      expect(storage.getItem(USER_STORAGE_KEY)).toBe(buildUserPayload('admin'));
    });
  });
});
