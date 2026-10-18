import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import Settings from '../pages/Settings';
import { api } from '../api/client';

vi.mock('../api/client', () => ({
  api: {
    deleteAccount: vi.fn(),
    updateProfile: vi.fn(),
    changePassword: vi.fn(),
    mergeWallet: vi.fn(),
    getSeedPhrase: vi.fn(),
    recoverAccount: vi.fn(),
    get2FAStatus: vi.fn(),
    setup2FA: vi.fn(),
    verify2FA: vi.fn(),
    disable2FA: vi.fn(),
  },
}));

const mockLogout = vi.fn();
const mockNavigate = vi.fn();

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'u1', name: 'Test User', email: 'test@example.com', role: 'buyer', publicKey: 'GABCDEF' },
    logout: mockLogout,
    login: vi.fn(),
  }),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

function renderSettings() {
  return render(
    <MemoryRouter>
      <Settings />
    </MemoryRouter>
  );
}

async function openDeleteModalAndConfirmPhrase() {
  fireEvent.click(screen.getByRole('button', { name: /delete account/i }));
  const input = await screen.findByPlaceholderText('delete my account');
  fireEvent.change(input, { target: { value: 'delete my account' } });
}

beforeEach(() => {
  vi.clearAllMocks();
  api.get2FAStatus.mockResolvedValue({ enabled: false });
});

describe('Settings account deletion', () => {
  it('keeps the modal open and shows an error, re-enabling the confirm button, when delete-account rejects', async () => {
    api.deleteAccount.mockRejectedValueOnce(new Error('Server exploded'));
    renderSettings();
    await openDeleteModalAndConfirmPhrase();

    const confirmBtn = screen.getByRole('button', { name: /delete my account/i });
    expect(confirmBtn).not.toBeDisabled();
    fireEvent.click(confirmBtn);

    // Modal stays open and the error is surfaced.
    await waitFor(() => expect(screen.getAllByText(/server exploded/i)[0]).toBeInTheDocument());
    expect(screen.getByRole('dialog', { name: /delete account/i })).toBeInTheDocument();
    expect(mockLogout).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();

    // The confirm button is re-enabled (not stuck in "Deleting...").
    expect(screen.getByRole('button', { name: /delete my account/i })).not.toBeDisabled();
  });

  it('does not render the balance warning box when the balance in the error payload is not a finite number', async () => {
    const err = new Error('Balance warning');
    err.status = 409;
    err.data = { code: 'balance_warning', balance: undefined, publicKey: 'GABCDEF' };
    api.deleteAccount.mockRejectedValueOnce(err);
    renderSettings();
    await openDeleteModalAndConfirmPhrase();

    fireEvent.click(screen.getByRole('button', { name: /delete my account/i }));

    // Should not show the "Wallet Balance Detected" step with an undefined amount.
    await waitFor(() => expect(screen.queryByText(/wallet balance detected/i)).not.toBeInTheDocument());
    // An error should be surfaced instead, and the modal stays open.
    await waitFor(() => expect(screen.getAllByText(/could not determine your wallet balance/i)[0]).toBeInTheDocument());
  });

  it('on success, logs out and redirects as before', async () => {
    api.deleteAccount.mockResolvedValueOnce({ success: true });
    renderSettings();
    await openDeleteModalAndConfirmPhrase();

    fireEvent.click(screen.getByRole('button', { name: /delete my account/i }));

    await waitFor(() => expect(mockLogout).toHaveBeenCalled());
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/login', { replace: true }));
  });
});
