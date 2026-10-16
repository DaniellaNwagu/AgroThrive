import { expect, it } from 'vitest';
import { classifyChunks, exceedsBudget, parseBudget } from '../../scripts/bundle-size-utils';

it('validates budgets and classifies initial chunks', () => {
  expect(() => parseBudget('BUNDLE_INITIAL_BUDGET_KB', 'abc', 500)).toThrow(/BUNDLE_INITIAL/);
  expect(() => classifyChunks([{ name: 'lazy.js', size: 1 }])).toThrow(/No initial/);
  const result = classifyChunks([{ name: 'index-a.js', size: 1024 }, { name: 'lazy.js', size: 2048 }]);
  expect(result.initialBytes).toBe(1024); expect(result.totalBytes).toBe(3072);
  expect(exceedsBudget(result.totalBytes, 2)).toBe(true);
});
