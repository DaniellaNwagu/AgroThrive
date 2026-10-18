import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import Wallet from '../Wallet';
import { api } from '../../api/client';

// Wallet.jsx imports `api` from '../api/client' (not '../../services/client' —
// that module does not exist in this codebase).
vi.mock('../../api/client', () => ({
  api: {
    getWallet: vi.fn(),
    getTransactions: vi.fn(),
    getAlerts: vi.fn(),
    getClaimableBalances: vi.fn(),
    getPaymentStreams: vi.fn(),
    getBudget: vi.fn(),
    setBudget: vi.fn(),
    fundWallet: vi.fn(),
    withdrawFunds: vi.fn(),
    addTrustline: vi.fn(),
    removeTrustline: vi.fn(),
    markAlertRead: vi.fn(),
    cancelPaymentStream: vi.fn(),
    decreasePaymentStreamRate: vi.fn(),
    withdrawPaymentStream: vi.fn(),
    claimBalance: vi.fn(),
    refresh: vi.fn(),
  },
}));

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1', publicKey: 'GABC' } }),
}));

vi.mock('../../context/NetworkContext', () => ({
  useNetwork: () => ({ network: 'testnet', explorerUrl: () => 'https://stellar.expert' }),
}));

vi.mock('../../utils/useXlmRate', () => ({
  useXlmRate: () => ({ usd: () => null }),
}));

vi.mock('../../hooks/useConfirm', () => ({
  useConfirm: () => ({ confirm: vi.fn().mockResolvedValue(true), confirmDialog: null }),
}));

vi.mock('../../utils/toast', () => ({ showToast: vi.fn() }));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k) => k }),
}));

function renderWallet() {
  return render(
    <HelmetProvider>
      <MemoryRouter>
        <Wallet />
      </MemoryRouter>
    </HelmetProvider>
  );
}

// The Destination/Amount/Memo labels in Wallet.jsx aren't programmatically
// associated with their inputs (no htmlFor/id), so query by placeholder text
// instead of label text.
async function fillAndSubmit({ destination = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', amount = '10', memo = '' } = {}) {
  const destInput = await screen.findByPlaceholderText(/G\.\.\. or name\*domain/i);
  const amountInput = screen.getByPlaceholderText('0.00');
  fireEvent.change(destInput, { target: { value: destination } });
  fireEvent.change(amountInput, { target: { value: amount } });
  if (memo) {
    const memoInput = screen.getByPlaceholderText(/payment for order/i);
    fireEvent.change(memoInput, { target: { value: memo } });
  }
  fireEvent.click(screen.getByRole('button', { name: /withdraw xlm/i }));
}

beforeEach(() => {
  vi.clearAllMocks();
  api.getWallet.mockResolvedValue({ publicKey: 'GABC', balance: 100, assets: [] });
  api.getTransactions.mockResolvedValue([]);
  api.getClaimableBalances.mockResolvedValue([]);
  api.getPaymentStreams.mockResolvedValue([]);
  api.getAlerts.mockResolvedValue({ data: [], unreadCount: 0 });
  api.getBudget.mockResolvedValue(null);
  api.withdrawFunds.mockResolvedValue({ amount: '10', txHash: 'abc123' });
});

describe('Wallet send form', () => {
  it('blocks submission when the amount exceeds the spendable balance', async () => {
    renderWallet();
    await fillAndSubmit({ amount: '999999' });
    await waitFor(() => expect(screen.getByText(/insufficient balance/i)).toBeInTheDocument());
    expect(api.withdrawFunds).not.toHaveBeenCalled();
  });

  it('allows submission when the amount exactly equals the spendable balance (equality boundary)', async () => {
    // balance 100, base reserve 1 XLM -> spendable is exactly 99.
    renderWallet();
    await fillAndSubmit({ amount: '99' });
    await waitFor(() => expect(api.withdrawFunds).toHaveBeenCalledWith('GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', 99));
  });

  it('blocks submission when the amount is one stroop above the spendable balance', async () => {
    // spendable is 99; 99.0000001 is one stroop over.
    renderWallet();
    await fillAndSubmit({ amount: '99.0000001' });
    await waitFor(() => expect(screen.getByText(/insufficient balance/i)).toBeInTheDocument());
    expect(api.withdrawFunds).not.toHaveBeenCalled();
  });

  it('reduces the spendable amount when the wallet reports subentries', async () => {
    // balance 100, base reserve 1 XLM + 2 subentries * 0.5 XLM = 2 XLM reserve -> spendable 98.
    api.getWallet.mockResolvedValue({ publicKey: 'GABC', balance: 100, subentries: 2, assets: [] });
    renderWallet();
    await fillAndSubmit({ amount: '98.5' });
    await waitFor(() => expect(screen.getByText(/insufficient balance/i)).toBeInTheDocument());
    expect(api.withdrawFunds).not.toHaveBeenCalled();
  });

  it('surfaces an error and keeps the entered values when api.withdrawFunds rejects', async () => {
    api.withdrawFunds.mockRejectedValueOnce(new Error('network down'));
    renderWallet();
    await fillAndSubmit({ destination: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', amount: '10' });
    await waitFor(() => expect(api.withdrawFunds).toHaveBeenCalled());
    await waitFor(() =>
      expect(screen.getByText(/error|failed|invalid|network down/i)).toBeInTheDocument()
    );
    expect(screen.getByPlaceholderText(/G\.\.\. or name\*domain/i)).toHaveValue('GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA');
    expect(screen.getByPlaceholderText('0.00')).toHaveValue(10);
  });

  it('does not call api.withdrawFunds when the destination is empty', async () => {
    renderWallet();
    await fillAndSubmit({ destination: '', amount: '10' });
    await waitFor(() => expect(screen.getByText(/destination address is required/i)).toBeInTheDocument());
    expect(api.withdrawFunds).not.toHaveBeenCalled();
  });

  it('does not call api.withdrawFunds when the amount is non-positive', async () => {
    renderWallet();
    await fillAndSubmit({ destination: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', amount: '0' });
    await waitFor(() => expect(screen.getByText(/amount must be greater than 0/i)).toBeInTheDocument());
    expect(api.withdrawFunds).not.toHaveBeenCalled();
  });

  it('does not call api.withdrawFunds when the amount is non-numeric', async () => {
    renderWallet();
    await fillAndSubmit({ destination: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', amount: 'abc' });
    await waitFor(() => expect(screen.getByText(/amount must be greater than 0/i)).toBeInTheDocument());
    expect(api.withdrawFunds).not.toHaveBeenCalled();
  });
});
