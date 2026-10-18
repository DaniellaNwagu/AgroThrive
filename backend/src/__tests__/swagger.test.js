/**
 * swagger.test.js — Issue #99
 *
 * backend/src/swagger.js merges buildSpaPaths() into the swagger-jsdoc-derived
 * spec with `spec.paths[path] = { ...operations, ...(spec.paths[path] || {}) }`,
 * so JSDoc-defined operations must win over SPA stub operations when both
 * define the same path + method.
 */

'use strict';

describe('swagger spec merge', () => {
  afterEach(() => {
    jest.resetModules();
  });

  test('every path returned by buildSpaPaths() is present in the exported spec.paths', () => {
    const { buildSpaPaths } = require('../openapi/spaPaths');
    const spec = require('../swagger');

    for (const path of Object.keys(buildSpaPaths())) {
      expect(spec.paths).toHaveProperty(path);
    }
  });

  test('JSDoc-defined operation fields survive the merge when a path collides with buildSpaPaths()', () => {
    jest.resetModules();
    jest.mock('../openapi/spaPaths', () => ({
      buildSpaPaths: () => ({
        '/api/v1/categories': {
          get: { operationId: 'spaStub', summary: 'SPA stub summary' },
        },
        '/api/v1/brand-new-spa-endpoint': {
          get: { operationId: 'brandNewSpaEndpoint', summary: 'Brand new SPA endpoint' },
        },
      }),
    }));

    const spec = require('../swagger');

    // JSDoc-derived operation (routes/categories.js) wins over the colliding SPA stub.
    expect(spec.paths['/api/v1/categories'].get.summary).toBe('List all categories with product counts');
    expect(spec.paths['/api/v1/categories'].get.operationId).not.toBe('spaStub');

    // A path only present in buildSpaPaths() is still added to the spec.
    expect(spec.paths['/api/v1/brand-new-spa-endpoint'].get.operationId).toBe('brandNewSpaEndpoint');
  });
});
