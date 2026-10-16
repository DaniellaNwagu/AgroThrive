import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useDebounce } from '../utils/useDebounce';
import { isPublicCachePath } from '../utils/cachePolicy';
import { ALL_STATUSES, STATUS_ICON, STATUS_STYLE, getTimeline } from '../utils/orderStatus';

it('debounces rapid values and cleans up on unmount', () => {
  vi.useFakeTimers();
  const { result, rerender, unmount } = renderHook(({ value }) => useDebounce(value, 100), { initialProps: { value: 'a' } });
  rerender({ value: 'b' }); rerender({ value: 'c' });
  expect(result.current).toBe('a');
  act(() => vi.advanceTimersByTime(100));
  expect(result.current).toBe('c');
  unmount(); act(() => vi.runAllTimers()); vi.useRealTimers();
});

it('only permits exact public API path families', () => {
  expect(isPublicCachePath('/api/v1/products')).toBe(true);
  expect(isPublicCachePath('/api/v1/rates')).toBe(true);
  expect(isPublicCachePath('/api/v1/wallet')).toBe(false);
  expect(isPublicCachePath('/api/v1/orders')).toBe(false);
  expect(isPublicCachePath('/api/v1/products-private')).toBe(false);
});

describe('order statuses', () => {
  for (const status of ALL_STATUSES) it(`defines ${status}`, () => {
    expect(STATUS_STYLE[status]).toBeTruthy(); expect(STATUS_ICON[status]).toBeTruthy(); expect(getTimeline(status)).toHaveLength(5);
  });
});
