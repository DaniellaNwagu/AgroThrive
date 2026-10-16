import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import Wallet from '../Wallet';
import { api } from '../../services/client';

vi.mock('../../services/client', () => ({
  api: {
    getWallet: vi.fn(),
    getTransactions: vi.fn(),
    sendXLM: vi.fn(),
    withdrawFunds: vi.fn(),
    resolveFederation: vi.fn(),
    fundTestnet: vi.fn(),
    getClaimableBalances: vi.fn(),
    claimBalance: vi.fn(),
    getStreams: vi.fn(),
    getAlerts: vi.fn(),
    getBudget: vi.fn(),
    setBudget: vi.fn(),
    addTrustline: vi.fn(),
    removeTrustline: vi.fn(),
  },
}));

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1', publicKey: 'GABC' } }),
}));

vi.mock('../../context/NetworkContext', () => ({
  useNetwork: () => ({ network: 'testnet', explorerUrl: 'https://stellar.expert' }),
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

async function fillAndSubmit({ destination = 'GDEST', amount = '10', memo = '' } = {}) {
  const destInput = await screen.findByLabelText(/destination/i);
  const amountInput = screen.getByLabelText(/amount/i);
  fireEvent.change(destInput, { target: { value: destination } });
  fireEvent.change(amountInput, { target: { value: amount } });
  if (memo) {
    const memoInput = screen.getByLabelText(/memo/i);
    fireEvent.change(memoInput, { target: { value: memo } });
  }
  fireEvent.click(screen.getByRole('button', { name: /send/i }));
}

beforeEach(() => {
  vi.clearAllMocks();
  api.getWallet.mockResolvedValue({ publicKey: 'GABC', balance: '100', assets: [] });
  api.getTransactions.mockResolvedValue([]);
  api.getClaimableBalances.mockResolvedValue([]);
  api.getStreams.mockResolvedValue([]);
  api.getAlerts.mockResolvedValue([]);
  api.getBudget.mockResolvedValue(null);
  api.resolveFederation.mockResolvedValue({ address: 'GDEST' });
  api.sendXLM.mockResolvedValue({ hash: 'abc123' });
});

describe('Wallet send form', () => {
  it('passes the memo to api.sendXLM and not api.withdrawFunds', async () => {
    renderWallet();
    await fillAndSubmit({ memo: 'hello memo' });
    await waitFor(() => expect(api.sendXLM).toHaveBeenCalled());
    expect(api.sendXLM).toHaveBeenCalledWith(
      expect.objectContaining({ memo: 'hello memo' })
    );
    expect(api.withdrawFunds).not.toHaveBeenCalled();
  });

  it('resolves a federation address via api.resolveFederation before submission', async () => {
    api.resolveFederation.mockResolvedValueOnce({ address: 'GRESOLVED' });
    renderWallet();
    await fillAndSubmit({ destination: 'user*example.com' });
    await waitFor(() => expect(api.resolveFederation).toHaveBeenCalled());
    await waitFor(() => expect(api.sendXLM).toHaveBeenCalled());
    expect(api.sendXLM).toHaveBeenCalledWith(
      expect.objectContaining({ destination: 'GRESOLVED' })
    );
  });

  it('blocks submission when the amount exceeds the spendable balance', async () => {
    renderWallet();
    await fillAndSubmit({ amount: '999999' });
    await waitFor(() => expect(screen.getByText(/error|failed|invalid/i)).toBeInTheDocument());
    expect(api.sendXLM).not.toHaveBeenCalled();
  });

  it('surfaces an error and keeps the entered values when api.sendXLM rejects', async () => {
    api.sendXLM.mockRejectedValueOnce(new Error('network down'));
    renderWallet();
    await fillAndSubmit({ destination: 'GDEST', amount: '10' });
    await waitFor(() => expect(api.sendXLM).toHaveBeenCalled());
    await waitFor(() =>
      expect(screen.getByText(/error|failed|invalid/i)).toBeInTheDocument()
    );
    expect(screen.getByLabelText(/destination/i)).toHaveValue('GDEST');
    expect(screen.getByLabelText(/amount/i)).toHaveValue('10');
  });

  it('surfaces an error and does not call api.sendXLM when api.resolveFederation rejects', async () => {
    api.resolveFederation.mockRejectedValueOnce(new Error('federation failed'));
    renderWallet();
    await fillAndSubmit({ destination: 'user*example.com' });
    await waitFor(() => expect(api.resolveFederation).toHaveBeenCalled());
    await waitFor(() =>
      expect(screen.getByText(/error|failed|invalid/i)).toBeInTheDocument()
    );
    expect(api.sendXLM).not.toHaveBeenCalled();
  });

  it('does not call api.sendXLM when the destination is empty', async () => {
    renderWallet();
    await fillAndSubmit({ destination: '', amount: '10' });
    await waitFor(() => expect(screen.getByText(/error|failed|invalid/i)).toBeInTheDocument());
    expect(api.sendXLM).not.toHaveBeenCalled();
  });

  it('does not call api.sendXLM when the amount is non-positive', async () => {
    renderWallet();
    await fillAndSubmit({ destination: 'GDEST', amount: '0' });
    await waitFor(() => expect(screen.getByText(/error|failed|invalid/i)).toBeInTheDocument());
    expect(api.sendXLM).not.toHaveBeenCalled();
  });

  it('does not call api.sendXLM when the amount is non-numeric', async () => {
    renderWallet();
    await fillAndSubmit({ destination: 'GDEST', amount: 'abc' });
    await waitFor(() => expect(screen.getByText(/error|failed|invalid/i)).toBeInTheDocument());
    expect(api.sendXLM).not.toHaveBeenCalled();
  });
});
