import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('../api/client', () => ({
  api: {
    getAddresses: vi.fn(),
    deleteAddress: vi.fn(),
    createAddress: vi.fn(),
    updateAddress: vi.fn(),
    setDefaultAddress: vi.fn(),
  },
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { role: 'buyer' } }),
}));

import { api } from '../api/client';
import AddressBook from '../pages/AddressBook';

const mockAddress = {
  id: 1,
  label: 'Home',
  street: '123 Main St',
  city: 'Nairobi',
  country: 'Kenya',
  postal_code: '00100',
  is_default: false,
};

describe('AddressBook modal focus trap and restoration (#111)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.getAddresses.mockResolvedValue({ data: [mockAddress], limit: 10 });
  });

  it('wraps focus from last to first element with Tab, and first to last with Shift+Tab', async () => {
    const user = userEvent.setup();
    render(<AddressBook />);

    const addBtn = await screen.findByRole('button', { name: /\+ add address/i });
    await user.click(addBtn);

    const dialog = screen.getByRole('dialog');
    const focusable = dialog.querySelectorAll(
      'input, select, button, [tabindex]:not([tabindex="-1"])'
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    last.focus();
    expect(document.activeElement).toBe(last);
    await user.tab();
    expect(document.activeElement).toBe(first);

    first.focus();
    expect(document.activeElement).toBe(first);
    await user.tab({ shift: true });
    expect(document.activeElement).toBe(last);
  });

  it('returns focus to the button that opened the modal when closed via Cancel', async () => {
    const user = userEvent.setup();
    render(<AddressBook />);

    const addBtn = await screen.findByRole('button', { name: /\+ add address/i });
    addBtn.focus();
    await user.click(addBtn);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /cancel/i }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(document.activeElement).toBe(addBtn);
  });

  it('returns focus to the button that opened the modal when closed via Escape', async () => {
    render(<AddressBook />);

    const addBtn = await screen.findByRole('button', { name: /\+ add address/i });
    addBtn.focus();
    fireEvent.click(addBtn);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(document.activeElement).toBe(addBtn);
  });
});
