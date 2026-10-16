import { act, renderHook } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { useReviewForm } from '../useReviewForm';
const api = { getOrders: vi.fn(), submitReview: vi.fn() };
vi.mock('../../api/client', () => ({ api }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key) => key }) }));

it('reports and retries order loading failures', async () => {
  api.getOrders.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ data: [] });
  const { result } = renderHook(() => useReviewForm('12', {}));
  await act(() => result.current.loadPaidOrders()); expect(result.current.ordersLoadError).toBe(true);
  await act(() => result.current.handleReviewSubmit({ preventDefault() {} })); expect(result.current.reviewError).toMatch(/ordersLoadError/); expect(api.submitReview).not.toHaveBeenCalled();
  await act(() => result.current.loadPaidOrders()); expect(result.current.ordersLoadError).toBe(false);
});

it('ignores partially numeric product ids', async () => {
  const { result } = renderHook(() => useReviewForm('12abc', {}));
  await act(() => result.current.loadPaidOrders()); expect(result.current.reviewOrderId).toBe(''); expect(api.getOrders).not.toHaveBeenCalled();
});
