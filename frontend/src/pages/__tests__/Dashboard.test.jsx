import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { HelmetProvider } from 'react-helmet-async';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import Dashboard from '../Dashboard';
import { api } from '../../api/client';

vi.mock('../../api/client', () => ({
  api: {
    getMyProducts: vi.fn(),
    getSales: vi.fn(),
    getFarmer: vi.fn(),
    getBundles: vi.fn(),
    getCooperatives: vi.fn(),
    getHarvestBatches: vi.fn(),
    getForecast: vi.fn(),
    getWaitlistAnalytics: vi.fn(),
    getBundleDiscounts: vi.fn(),
    getCreatorEarnings: vi.fn(),
    getMyCoupons: vi.fn(),
    getPendingMultisigTxs: vi.fn(),
    createProduct: vi.fn(),
    deleteProduct: vi.fn(),
    uploadProductImage: vi.fn(),
    createHarvestBatch: vi.fn(),
  },
}));

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'farmer-1', role: 'farmer' } }),
}));

const mockConfirm = vi.fn().mockResolvedValue(true);
vi.mock('../../hooks/useConfirm', () => ({
  useConfirm: () => ({ confirm: mockConfirm, confirmDialog: null }),
}));

vi.mock('../../utils/useXlmRate', () => ({
  useXlmRate: () => ({ rate: null, usd: () => null }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k) => k }),
}));

vi.mock('../../utils/toast', () => ({ showToast: vi.fn() }));

function renderDashboard() {
  return render(
    <HelmetProvider>
      <Dashboard />
    </HelmetProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockConfirm.mockResolvedValue(true);
  api.getMyProducts.mockResolvedValue({ data: [] });
  api.getSales.mockResolvedValue({ data: [] });
  api.getFarmer.mockResolvedValue({});
  api.getBundles.mockResolvedValue({ data: [] });
  api.getCooperatives.mockResolvedValue({ data: [] });
  api.getHarvestBatches.mockResolvedValue({ data: [] });
  api.getForecast.mockResolvedValue({ data: [] });
  api.getWaitlistAnalytics.mockResolvedValue({ data: [] });
  api.getBundleDiscounts.mockResolvedValue({ data: [] });
  api.getCreatorEarnings.mockResolvedValue({ data: null });
  api.getMyCoupons.mockResolvedValue({ data: [] });
  api.getPendingMultisigTxs.mockResolvedValue({ data: [] });
  api.createProduct.mockResolvedValue({ id: 1 });
  api.deleteProduct.mockResolvedValue({ success: true });
});

describe('Dashboard - product form validation', () => {
  it('shows field error styling and does not call createProduct for invalid price/quantity', async () => {
    renderDashboard();

    const nameInput = await screen.findByLabelText('Product Name');
    const priceInput = screen.getByLabelText('Price (XLM)');
    const quantityInput = screen.getByLabelText('Quantity');

    fireEvent.change(nameInput, { target: { value: 'Tomatoes' } });
    fireEvent.change(priceInput, { target: { value: 'not-a-number' } });
    fireEvent.change(quantityInput, { target: { value: 'abc' } });

    fireEvent.click(screen.getByRole('button', { name: /listProduct/i }));

    await waitFor(() => {
      expect(priceInput).toHaveAttribute('aria-invalid', 'true');
      expect(quantityInput).toHaveAttribute('aria-invalid', 'true');
    });

    expect(screen.getByText(/price must be a positive number/i)).toBeInTheDocument();
    expect(screen.getByText(/quantity must be a non-negative whole number/i)).toBeInTheDocument();
    expect(api.createProduct).not.toHaveBeenCalled();
  });

  it('calls createProduct with correctly parsed numeric values for a valid submission', async () => {
    renderDashboard();

    const nameInput = await screen.findByLabelText('Product Name');
    const priceInput = screen.getByLabelText('Price (XLM)');
    const quantityInput = screen.getByLabelText('Quantity');
    const unitInput = screen.getByLabelText('Unit (kg, bunch, etc.)');

    fireEvent.change(nameInput, { target: { value: 'Tomatoes' } });
    fireEvent.change(priceInput, { target: { value: '2.5' } });
    fireEvent.change(quantityInput, { target: { value: '10' } });
    fireEvent.change(unitInput, { target: { value: 'kg' } });

    fireEvent.click(screen.getByRole('button', { name: /listProduct/i }));

    await waitFor(() => expect(api.createProduct).toHaveBeenCalled());

    expect(api.createProduct).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Tomatoes',
        price: 2.5,
        quantity: 10,
      })
    );
  });
});

describe('Dashboard - delete confirmation flow', () => {
  it('opens a confirmation modal and only calls deleteProduct when confirmed', async () => {
    api.getMyProducts.mockResolvedValue({
      data: [{ id: 42, name: 'Carrots', price: 3, quantity: 5, unit: 'kg' }],
    });

    renderDashboard();

    const removeButton = await screen.findByRole('button', { name: /remove carrots/i });
    fireEvent.click(removeButton);

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/delete carrots/i)).toBeInTheDocument();
    expect(api.deleteProduct).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole('button', { name: /confirm delete/i }));

    await waitFor(() => expect(api.deleteProduct).toHaveBeenCalledWith(42));
  });

  it('does not call deleteProduct when the modal is cancelled', async () => {
    api.getMyProducts.mockResolvedValue({
      data: [{ id: 43, name: 'Beets', price: 3, quantity: 5, unit: 'kg' }],
    });

    renderDashboard();

    const removeButton = await screen.findByRole('button', { name: /remove beets/i });
    fireEvent.click(removeButton);

    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: /^cancel$/i }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(api.deleteProduct).not.toHaveBeenCalled();
  });
});
