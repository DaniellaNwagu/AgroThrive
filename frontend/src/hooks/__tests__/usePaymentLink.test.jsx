import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

const api = { placeOrder: vi.fn(), getOrderPaymentLink: vi.fn() };
vi.mock('../../api/client', () => ({ api }));

const showToast = vi.fn();
vi.mock('../../utils/toast', () => ({ showToast: (...args) => showToast(...args) }));

const keyFor = vi.fn((inputs) => `key-for-${JSON.stringify(inputs)}`);
const settle = vi.fn();
vi.mock('../useIdempotencyKey', () => ({
  useIdempotencyKey: () => ({ keyFor, settle }),
}));

import { usePaymentLink } from '../usePaymentLink';

beforeEach(() => {
  vi.clearAllMocks();
  keyFor.mockImplementation((inputs) => `key-for-${JSON.stringify(inputs)}`);
});

describe('usePaymentLink', () => {
  it('places the order with payment_method sep7 and the idempotency key, then fetches the payment link', async () => {
    api.placeOrder.mockResolvedValue({ orderId: 42 });
    api.getOrderPaymentLink.mockResolvedValue({ paymentUrl: 'web+stellar:pay?x', qrUrl: '/qr/42' });

    const { result } = renderHook(() => usePaymentLink());

    await act(async () => {
      await result.current.generatePaymentLink({ productId: 7, quantity: 2, addressId: 9, couponCode: 'SAVE10' });
    });

    expect(api.placeOrder).toHaveBeenCalledTimes(1);
    const [orderBody, idempotencyKey] = api.placeOrder.mock.calls[0];
    expect(orderBody).toMatchObject({
      product_id: 7,
      quantity: 2,
      address_id: 9,
      coupon_code: 'SAVE10',
      payment_method: 'sep7',
    });
    expect(idempotencyKey).toBe(keyFor.mock.results[0].value);

    expect(api.getOrderPaymentLink).toHaveBeenCalledWith(42);

    expect(result.current.paymentLinkData).toEqual({
      orderId: 42,
      paymentUrl: 'web+stellar:pay?x',
      qrUrl: '/qr/42',
    });
    expect(result.current.paymentLinkError).toBe('');
    expect(result.current.paymentLinkLoading).toBe(false);

    // settle() called with no arg on the placeOrder success path
    expect(settle).toHaveBeenCalledTimes(1);
    expect(settle.mock.calls[0]).toEqual([]);
  });

  it('sets paymentLinkError and shows an error toast when placeOrder rejects, and settles with the error', async () => {
    const error = new Error('insufficient funds');
    error.code = 'unfunded_account';
    api.placeOrder.mockRejectedValue(error);

    const { result } = renderHook(() => usePaymentLink());

    await act(async () => {
      await result.current.generatePaymentLink({ productId: 1, quantity: 1 });
    });

    expect(api.getOrderPaymentLink).not.toHaveBeenCalled();
    expect(result.current.paymentLinkLoading).toBe(false);
    expect(result.current.paymentLinkError).toBeTruthy();
    expect(result.current.paymentLinkData).toBeNull();

    expect(settle).toHaveBeenCalledTimes(1);
    expect(settle.mock.calls[0][0]).toBe(error);

    expect(showToast).toHaveBeenCalledTimes(1);
    expect(showToast.mock.calls[0][0]).toBe(result.current.paymentLinkError);
    expect(showToast.mock.calls[0][1]).toBe('error');
  });

  it('sets paymentLinkLoading while the request is in flight and clears it afterwards', async () => {
    let resolvePlaceOrder;
    api.placeOrder.mockReturnValue(
      new Promise((resolve) => {
        resolvePlaceOrder = resolve;
      })
    );

    const { result } = renderHook(() => usePaymentLink());

    let generatePromise;
    act(() => {
      generatePromise = result.current.generatePaymentLink({ productId: 3, quantity: 1 });
    });
    expect(result.current.paymentLinkLoading).toBe(true);

    api.getOrderPaymentLink.mockResolvedValue({ paymentUrl: 'x' });
    await act(async () => {
      resolvePlaceOrder({ orderId: 3 });
      await generatePromise;
    });

    expect(result.current.paymentLinkLoading).toBe(false);
  });
});
