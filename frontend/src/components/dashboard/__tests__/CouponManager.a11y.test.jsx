import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi, test, expect, beforeEach } from 'vitest';
import CouponManager from '../CouponManager';
import { expectNoA11yViolations } from '../../../test/a11y';

vi.mock('../../api/client', () => ({
  getMyCoupons: vi.fn(),
}));

import { getMyCoupons } from '../../api/client';

const sampleCoupons = [
  { id: 1, code: 'SAVE10', discount: '10%', status: 'active' },
  { id: 2, code: 'FREESHIP', discount: 'Free shipping', status: 'expired' },
];

beforeEach(() => {
  vi.clearAllMocks();
});

test('has no accessibility violations for the empty coupon list state', async () => {
  getMyCoupons.mockResolvedValue([]);

  const { container } = render(<CouponManager />);

  await screen.findByText(/no coupons/i);
  await expectNoA11yViolations(container);
});

test('has no accessibility violations for a populated coupon list state', async () => {
  getMyCoupons.mockResolvedValue(sampleCoupons);

  const { container } = render(<CouponManager />);

  await screen.findByText('SAVE10');
  await expectNoA11yViolations(container);
});
