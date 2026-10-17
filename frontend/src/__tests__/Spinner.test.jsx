import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import Spinner from '../components/Spinner';

function mockMatchMedia(matches) {
  vi.spyOn(window, 'matchMedia').mockReturnValue({
    matches,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
  });
}

describe('Spinner reduced-motion guard (#116)', () => {
  it('renders no infinite rotation animation when the user prefers reduced motion', () => {
    mockMatchMedia(true);
    render(<Spinner />);
    const spinnerCircle = screen.getByRole('status').querySelector('div');
    expect(spinnerCircle.style.animation).not.toMatch(/spin/);
  });

  it('applies the rotation animation when motion is allowed', () => {
    mockMatchMedia(false);
    render(<Spinner />);
    const spinnerCircle = screen.getByRole('status').querySelector('div');
    expect(spinnerCircle.style.animation).toMatch(/spin/);
  });

  it('still exposes the loading message to assistive technology when motion is reduced', () => {
    mockMatchMedia(true);
    render(<Spinner message="Please wait" />);
    expect(screen.getByRole('status')).toHaveTextContent('Please wait');
  });

  it('still exposes the loading message to assistive technology when motion is allowed', () => {
    mockMatchMedia(false);
    render(<Spinner message="Please wait" />);
    expect(screen.getByRole('status')).toHaveTextContent('Please wait');
  });
});
