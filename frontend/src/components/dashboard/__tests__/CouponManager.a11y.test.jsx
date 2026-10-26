import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi, test, beforeEach } from 'vitest';
import CouponManager from '../CouponManager';
import { expectNoA11yViolations } from '../../../test/a11y';

const { getMyCoupons: mockGetMyCoupons } = vi.hoisted(() => ({ getMyCoupons: vi.fn() }));

vi.mock('../../../api/client', () => ({
  api: { getMyCoupons: mockGetMyCoupons },
}));

const sampleCoupons = [
  { id: 1, code: 'SAVE10', discount_type: 'percent', discount_value: 10 },
  { id: 2, code: 'FREESHIP', discount_type: 'fixed', discount_value: 5 },
];

beforeEach(() => {
  vi.clearAllMocks();
});

test('has no accessibility violations for the empty coupon list state', async () => {
  mockGetMyCoupons.mockResolvedValue({ data: [] });

  const { container } = render(<CouponManager />);

  await screen.findByText('No coupon codes yet.');
  await expectNoA11yViolations(container);
});

test('has no accessibility violations for a populated coupon list state', async () => {
  mockGetMyCoupons.mockResolvedValue({ data: sampleCoupons });

  const { container } = render(<CouponManager />);

  await screen.findByText('SAVE10');
  await expectNoA11yViolations(container);
});
