import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { bindMicHoldGesture, MIC_HOLD_THRESHOLD_MS } from './micHoldGesture';

describe('bindMicHoldGesture', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('cancels the recording on a short tap (pointerup before the hold threshold)', () => {
    const recorder = { stop: vi.fn<() => void>(), cancel: vi.fn<() => void>() };
    bindMicHoldGesture({ getRecorder: () => recorder });

    vi.advanceTimersByTime(MIC_HOLD_THRESHOLD_MS - 100);
    window.dispatchEvent(new Event('pointerup'));
    vi.advanceTimersByTime(50);

    expect(recorder.cancel).toHaveBeenCalledTimes(1);
    expect(recorder.stop).not.toHaveBeenCalled();
  });

  it('stops the recording on release after the hold threshold', () => {
    const recorder = { stop: vi.fn<() => void>(), cancel: vi.fn<() => void>() };
    bindMicHoldGesture({ getRecorder: () => recorder });

    vi.advanceTimersByTime(MIC_HOLD_THRESHOLD_MS + 100);
    window.dispatchEvent(new Event('pointerup'));
    vi.advanceTimersByTime(50);

    expect(recorder.stop).toHaveBeenCalledTimes(1);
    expect(recorder.cancel).not.toHaveBeenCalled();
  });

  it('cancels the recording when the gesture is interrupted by pointercancel (#546)', () => {
    const recorder = { stop: vi.fn<() => void>(), cancel: vi.fn<() => void>() };
    bindMicHoldGesture({ getRecorder: () => recorder });

    // Held well past the threshold — a genuine pointerup here would `stop()`,
    // but an interrupted gesture (OS takeover, scroll interrupt) must still
    // cancel rather than leave the recording running.
    vi.advanceTimersByTime(MIC_HOLD_THRESHOLD_MS + 500);
    window.dispatchEvent(new Event('pointercancel'));
    vi.advanceTimersByTime(50);

    expect(recorder.cancel).toHaveBeenCalledTimes(1);
    expect(recorder.stop).not.toHaveBeenCalled();
  });

  it('does not throw and does not call the recorder if it never mounted', () => {
    bindMicHoldGesture({ getRecorder: () => null });

    expect(() => {
      window.dispatchEvent(new Event('pointercancel'));
      vi.advanceTimersByTime(50);
    }).not.toThrow();
  });

  it('removes both listeners after the gesture completes, so a stray follow-up event is a no-op', () => {
    const recorder = { stop: vi.fn<() => void>(), cancel: vi.fn<() => void>() };
    bindMicHoldGesture({ getRecorder: () => recorder });

    window.dispatchEvent(new Event('pointerup'));
    vi.advanceTimersByTime(50);
    expect(recorder.cancel).toHaveBeenCalledTimes(1);

    // A pointercancel firing after pointerup already resolved the gesture
    // (e.g. browser quirk) should not trigger a second cancel.
    window.dispatchEvent(new Event('pointercancel'));
    vi.advanceTimersByTime(50);
    expect(recorder.cancel).toHaveBeenCalledTimes(1);
  });
});
