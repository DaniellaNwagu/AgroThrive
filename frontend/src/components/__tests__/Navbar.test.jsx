import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import Navbar from '../Navbar';

const api = { getUnreadMessageCount: vi.fn(), getMessagesStreamUrl: vi.fn(() => '/stream') };
vi.mock('../../api/client', () => ({ api }));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: { name: 'A', role: 'buyer' }, logout: vi.fn() }) }));
vi.mock('../../context/ThemeContext', () => ({ useTheme: () => ({ theme: 'light', toggleTheme: vi.fn(), useSystemTheme: vi.fn(), isUsingSystemTheme: false }) }));
vi.mock('../../context/NetworkContext', () => ({ useNetwork: () => ({ network: 'mainnet' }) }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ i18n: { language: 'en', changeLanguage: vi.fn() } }) }));

let stream;
class FakeEventSource { constructor() { this.listeners = {}; this.close = vi.fn(); stream = this; } addEventListener(name, fn) { this.listeners[name] = fn; } }

beforeEach(() => { global.EventSource = FakeEventSource; api.getUnreadMessageCount.mockResolvedValue({ count: 2 }); });

it('handles unread updates and drawer dismissal', async () => {
  const { unmount } = render(<MemoryRouter><Navbar /></MemoryRouter>);
  await screen.findByLabelText('2 unread messages');
  fireEvent(stream.listeners.new_message, new Event('new_message'));
  await screen.findByLabelText('3 unread messages');
  api.getUnreadMessageCount.mockResolvedValueOnce({ count: 0 }); fireEvent(window, new Event('messages:read'));
  await waitFor(() => expect(screen.queryByLabelText(/unread message/)).toBeNull());
  const toggle = screen.getByLabelText('Toggle menu'); fireEvent.click(toggle); fireEvent.keyDown(document, { key: 'Escape' });
  expect(toggle).toHaveFocus();
  fireEvent.click(toggle); fireEvent.mouseDown(document.body); expect(toggle).toHaveAttribute('aria-expanded', 'false');
  unmount(); expect(stream.close).toHaveBeenCalled();
});
