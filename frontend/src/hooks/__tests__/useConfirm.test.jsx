import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useConfirm } from '../useConfirm';

describe('useConfirm', () => {
  it('supersedes a pending request and confirms the active request', async () => {
    const { result } = renderHook(() => useConfirm());
    let first;
    let second;
    act(() => {
      first = result.current.confirm('First');
      second = result.current.confirm('Second');
    });
    await expect(first).resolves.toBe(false);
    act(() => result.current.confirmDialog.props.onConfirm());
    await expect(second).resolves.toBe(true);
  });

  it('resolves a pending request on unmount', async () => {
    const { result, unmount } = renderHook(() => useConfirm());
    let pending;
    act(() => { pending = result.current.confirm('Pending'); });
    unmount();
    await expect(pending).resolves.toBe(false);
  });
});
