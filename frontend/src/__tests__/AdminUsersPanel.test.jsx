import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import AdminUsersPanel from '../components/admin/AdminUsersPanel';

it('wires filters and pagination', () => {
  const handlers = { onSearchChange: vi.fn(), onSearch: vi.fn(), onRoleChange: vi.fn(), onVerifiedChange: vi.fn(), onBannedChange: vi.fn(), onPageChange: vi.fn() };
  const { rerender } = render(<AdminUsersPanel pagination={{ page: 1, pages: 2, total: 0 }} {...handlers} />);
  const search = screen.getByPlaceholderText(/Search by email/i);
  fireEvent.change(search, { target: { value: 'alice' } }); fireEvent.keyDown(search, { key: 'Enter' });
  fireEvent.change(screen.getByLabelText('Filter by role'), { target: { value: 'admin' } });
  fireEvent.change(screen.getByLabelText('Filter by verified status'), { target: { value: 'true' } });
  fireEvent.change(screen.getByLabelText('Filter by banned status'), { target: { value: 'false' } });
  expect(handlers.onSearchChange).toHaveBeenCalledWith('alice'); expect(handlers.onSearch).toHaveBeenCalled();
  expect(screen.getByRole('button', { name: /Prev/i })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: /Next/i })); expect(handlers.onPageChange).toHaveBeenCalledWith(2);
  rerender(<AdminUsersPanel pagination={{ page: 2, pages: 2, total: 0 }} {...handlers} />);
  expect(screen.getByRole('button', { name: /Next/i })).toBeDisabled();
});
