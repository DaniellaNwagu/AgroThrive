import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';

import AppContent from '../App.jsx';
import { AuthProvider } from '../context/AuthContext.jsx';
import { LoadingProvider } from '../context/LoadingContext.jsx';
import { ThemeProvider } from '../context/ThemeContext.jsx';
import { FavoritesProvider } from '../context/FavoritesContext.jsx';
import { CompareProvider } from '../context/CompareContext.jsx';
import { NetworkProvider } from '../context/NetworkContext.jsx';

vi.mock('../api/client.js', () => ({
  default: {
    get: vi.fn().mockResolvedValue({ data: {} }),
    post: vi.fn().mockResolvedValue({ data: {} }),
    put: vi.fn().mockResolvedValue({ data: {} }),
    delete: vi.fn().mockResolvedValue({ data: {} }),
  },
}));

function NavigateButton({ to }) {
  const navigate = useNavigate();
  return (
    <button type="button" onClick={() => navigate(to)}>
      go
    </button>
  );
}

function renderApp(initialPath = '/') {
  return render(
    <HelmetProvider>
      <MemoryRouter initialEntries={[initialPath]}>
        <AuthProvider>
          <LoadingProvider>
            <ThemeProvider>
              <FavoritesProvider>
                <CompareProvider>
                  <NetworkProvider>
                    <AppContent />
                    <NavigateButton to="/other" />
                  </NetworkProvider>
                </CompareProvider>
              </FavoritesProvider>
            </ThemeProvider>
          </LoadingProvider>
        </AuthProvider>
      </MemoryRouter>
    </HelmetProvider>
  );
}

describe('AppContent accessibility', () => {
  let announcer;

  beforeEach(() => {
    announcer = document.createElement('div');
    announcer.id = 'page-announcer';
    document.body.appendChild(announcer);
  });

  afterEach(() => {
    if (announcer && announcer.parentNode) {
      announcer.parentNode.removeChild(announcer);
    }
  });

  it('updates the #page-announcer textContent on a route change', async () => {
    renderApp('/');

    await waitFor(() => {
      expect(announcer.textContent).toMatch(/Navigated to/);
    });

    const before = announcer.textContent;
    fireEvent.click(screen.getByRole('button', { name: 'go' }));

    await waitFor(() => {
      expect(announcer.textContent).toMatch(/Navigated to/);
      expect(announcer.textContent).not.toBe(before);
    });
  });

  it('moves focus to #main-content when the skip link is clicked', async () => {
    renderApp('/');

    const skipLink = screen.getByRole('link', { name: /skip/i });
    fireEvent.click(skipLink);

    await waitFor(() => {
      expect(document.activeElement).toBe(document.getElementById('main-content'));
    });
  });
});
