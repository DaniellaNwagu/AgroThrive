const PUBLIC_API_PATHS = ['/api/v1/products', '/api/v1/categories', '/api/v1/rates'];

export function isPublicCachePath(path) {
  return PUBLIC_API_PATHS.some((prefix) => path === prefix || path.startsWith(`${prefix}/`) || path.startsWith(`${prefix}?`));
}
