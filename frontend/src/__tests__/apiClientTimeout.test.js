import { describe, it, expect, vi, afterEach } from 'vitest';
import { request } from '../api/client';
import { getErrorMessage } from '../utils/errorMessages';

// A fetch mock that behaves like the real thing with respect to its
// AbortSignal: it never settles on its own, but rejects with
// `signal.reason` the moment the signal aborts — exactly what the
// client's withTimeout() relies on. "Never resolves" (per the issue's
// guidance) means never resolves *on its own*, not that abort can't
// reach it.
//
// Real timers with small millisecond values are used throughout this
// file rather than vi.useFakeTimers() — AbortController's 'abort' event
// dispatch and fake-timer-driven promise rejection interact badly enough
// (an unhandled-rejection warning that can still fire even with the
// handler attached beforehand) that real, short timeouts are both
// simpler and more faithful to how this actually runs in a browser.
function neverResolvingFetch() {
  return vi.fn((url, opts) => new Promise((resolve, reject) => {
    const signal = opts?.signal;
    if (!signal) return;
    if (signal.aborted) {
      reject(signal.reason);
      return;
    }
    signal.addEventListener('abort', () => reject(signal.reason));
  }));
}

describe('api client request() — timeout and abort handling', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('rejects with a "timed out" error once the configured timeout elapses', async () => {
    global.fetch = neverResolvingFetch();

    await expect(request('/slow', { timeoutMs: 20 })).rejects.toThrow(/timed out/i);
  });

  it('maps the timeout error through getErrorMessage to the existing friendly copy', async () => {
    global.fetch = neverResolvingFetch();

    let caught;
    try {
      await request('/slow', { timeoutMs: 20 });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(Error);
    expect(getErrorMessage(caught)).toBe('The request timed out. Check your connection and try again.');
  });

  it('applies the default timeout (15000ms) when no per-request timeout is supplied', async () => {
    global.fetch = neverResolvingFetch();
    const timeoutSpy = vi.spyOn(global, 'setTimeout');

    request('/slow', {}).catch(() => {});

    // The withTimeout() call is the first setTimeout scheduled by this
    // request; confirm it used the documented 15000ms default rather than
    // actually waiting 15s in real time.
    expect(timeoutSpy).toHaveBeenCalledWith(expect.any(Function), 15000);
  });

  it('still honours a caller-supplied AbortSignal independently of the timeout', async () => {
    global.fetch = neverResolvingFetch();
    const controller = new AbortController();

    const pending = request('/slow', { timeoutMs: 60000, signal: controller.signal });
    controller.abort(new Error('caller cancelled'));

    await expect(pending).rejects.toThrow('caller cancelled');
  });

  it('clears the timer on success — no stray abort after a resolved request', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    });
    const clearSpy = vi.spyOn(global, 'clearTimeout');

    const result = await request('/fast', { timeoutMs: 20 });

    expect(result).toEqual({ ok: true });
    expect(clearSpy).toHaveBeenCalled();
  });
});
