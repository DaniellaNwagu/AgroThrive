// Shared constants and pure helpers for the theme E2E spec.
//
// These encode the contract between ThemeContext/AuthContext and the E2E
// tests: the data-theme attribute name, the 'theme' localStorage key, and
// the shape of the injected user object. Keeping them in one module lets a
// unit test verify the contract without importing Playwright.

export const DATA_THEME_ATTRIBUTE = 'data-theme';
export const THEME_STORAGE_KEY = 'theme';
export const USER_STORAGE_KEY = 'user';

/**
 * Read the theme attribute from a document-like object.
 * @param {{ documentElement: { getAttribute: (name: string) => string | null } }} doc
 * @returns {string | null}
 */
export function getDataTheme(doc) {
  return doc.documentElement.getAttribute(DATA_THEME_ATTRIBUTE);
}

/**
 * Read the persisted theme from a storage-like object.
 * @param {{ getItem: (key: string) => string | null }} storage
 * @returns {string | null}
 */
export function getStoredTheme(storage) {
  return storage.getItem(THEME_STORAGE_KEY);
}

/**
 * Seed the authenticated user payload into a storage-like object.
 * @param {{ setItem: (key: string, value: string) => void }} storage
 * @param {string} role
 * @param {{ id?: string, name?: string, email?: string }} [overrides]
 */
export function injectUser(storage, role, overrides = {}) {
  const user = {
    id: overrides.id ?? 'test-user-id',
    name: overrides.name ?? 'Test User',
    email: overrides.email ?? 'test@example.com',
    role,
  };
  storage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
  return user;
}
