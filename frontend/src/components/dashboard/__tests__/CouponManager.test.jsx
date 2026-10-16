import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CouponManager from '../CouponManager';
import api from '../../api/client';
import useConfirm from '../../hooks/useConfirm';

vi.mock('../../api/client', () => ({
  default: {
    getMyCoupons: vi.fn(),
    createCoupon: vi.fn(),
    deleteCoupon: vi.fn(),
  },
}));

vi.mock('../../hooks/useConfirm', () => ({
  default: vi.fn(),
}));

describe('CouponManager', () => {
  let confirmMock;

  beforeEach(() => {
    vi.clearAllMocks();
    confirmMock = vi.fn();
    useConfirm.mockReturnValue(confirmMock);
    api.getMyCoupons.mockResolvedValue([]);
    api.createCoupon.mockResolvedValue({ id: 1 });
    api.deleteCoupon.mockResolvedValue({});
  });

  it('submits the createCoupon payload with uppercased code and numeric values', async () => {
    const user = userEvent.setup();
    render(<CouponManager />);

    await waitFor(() => expect(api.getMyCoupons).toHaveBeenCalled());

    await user.type(screen.getByLabelText('Code'), '  save10  ');
    await user.type(screen.getByLabelText('Discount value'), '12.5');
    await user.type(screen.getByLabelText('Max uses'), '25');
    await user.type(screen.getByLabelText('Expires at'), '2030-01-01');

    await user.click(screen.getByRole('button', { name: /create/i }));

    await waitFor(() =>
      expect(api.createCoupon).toHaveBeenCalledWith({
        code: 'SAVE10',
        discount_value: 12.5,
        max_uses: 25,
        expires_at: '2030-01-01',
      })
    );
  });

  it('sends null for max_uses and expires_at when left blank', async () => {
    const user = userEvent.setup();
    render(<CouponManager />);

    await waitFor(() => expect(api.getMyCoupons).toHaveBeenCalled());

    await user.type(screen.getByLabelText('Code'), 'blank');
    await user.type(screen.getByLabelText('Discount value'), '5');

    await user.click(screen.getByRole('button', { name: /create/i }));

    await waitFor(() =>
      expect(api.createCoupon).toHaveBeenCalledWith({
        code: 'BLANK',
        discount_value: 5,
        max_uses: null,
        expires_at: null,
      })
    );
  });

  it('shows a success alert and reloads the list after a successful create', async () => {
    const user = userEvent.setup();
    render(<CouponManager />);

    await waitFor(() => expect(api.getMyCoupons).toHaveBeenCalledTimes(1));

    await user.type(screen.getByLabelText('Code'), 'reload');
    await user.type(screen.getByLabelText('Discount value'), '10');

    await user.click(screen.getByRole('button', { name: /create/i }));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/success/i));
    await waitFor(() => expect(api.getMyCoupons).toHaveBeenCalledTimes(2));
  });

  it('does not delete when the confirm dialog is cancelled', async () => {
    const user = userEvent.setup();
    api.getMyCoupons.mockResolvedValue([
      { id: 7, code: 'KEEP', discount_value: 10, max_uses: null, expires_at: null },
    ]);
    confirmMock.mockResolvedValue(false);

    render(<CouponManager />);

    await waitFor(() => expect(screen.getByText('KEEP')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /delete/i }));

    await waitFor(() => expect(confirmMock).toHaveBeenCalled());
    expect(api.deleteCoupon).not.toHaveBeenCalled();
  });

  it('deletes the coupon with its id when the confirm dialog is accepted', async () => {
    const user = userEvent.setup();
    api.getMyCoupons.mockResolvedValue([
      { id: 7, code: 'GONE', discount_value: 10, max_uses: null, expires_at: null },
    ]);
    confirmMock.mockResolvedValue(true);

    render(<CouponManager />);

    await waitFor(() => expect(screen.getByText('GONE')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /delete/i }));

    await waitFor(() => expect(api.deleteCoupon).toHaveBeenCalledWith(7));
  });
});
