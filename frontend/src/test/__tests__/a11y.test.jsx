import React from 'react';
import { render } from '@testing-library/react';
import { test, expect } from 'vitest';
import { axe, flushAsync, expectNoA11yViolations } from '../a11y';

test('flushAsync resolves after pending microtasks and timers', async () => {
  let resolved = false;
  const pending = Promise.resolve().then(() => {
    resolved = true;
  });

  await flushAsync();
  await pending;

  expect(resolved).toBe(true);
});

test('expectNoA11yViolations resolves for an accessible container', async () => {
  const { container } = render(
    <label htmlFor="name">
      Name
      <input id="name" type="text" />
    </label>
  );

  await expect(expectNoA11yViolations(container)).resolves.toBeUndefined();
});

test('expectNoA11yViolations rejects for a container with a known violation', async () => {
  const { container } = render(<input type="text" />);

  await expect(expectNoA11yViolations(container)).rejects.toThrow();
});

test('the exported axe instance has the color-contrast rule disabled', () => {
  const colorContrast = axe.configure().rules.find(
    (rule) => rule.id === 'color-contrast'
  );

  expect(colorContrast).toBeDefined();
  expect(colorContrast.enabled).toBe(false);
});
