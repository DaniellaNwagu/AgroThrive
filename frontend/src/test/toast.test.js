import { beforeEach, describe, expect, it } from 'vitest';
import { showToast } from '../utils/toast';

describe('showToast', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  it('closes idempotently and removes an empty container', () => {
    const close = showToast('Saved');
    expect(() => { close(); close(); }).not.toThrow();
    expect(document.getElementById('toast-notifications')).toBeNull();
    expect(document.querySelectorAll('#toast-animations')).toHaveLength(1);
  });
});
