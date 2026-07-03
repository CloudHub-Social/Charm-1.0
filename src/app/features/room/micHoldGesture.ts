export const MIC_HOLD_THRESHOLD_MS = 400;

export type MicHoldRecorderHandle = {
  stop: () => void;
  cancel: () => void;
};

type BindMicHoldGestureOptions = {
  getRecorder: () => MicHoldRecorderHandle | null | undefined;
  holdThresholdMs?: number;
  target?: EventTarget;
};

/**
 * Wires up the press-and-hold-to-record gesture started on the mic button's
 * `onPointerDown`. A normal release (`pointerup`) stops or cancels the
 * recording depending on how long the button was held; an interrupted
 * gesture (`pointercancel` — OS gesture takeover, scroll interrupt, etc.)
 * always cancels. Both paths go through the same listener cleanup so an
 * interrupted hold can't leave a recording running unnoticed (#546).
 */
export function bindMicHoldGesture({
  getRecorder,
  holdThresholdMs = MIC_HOLD_THRESHOLD_MS,
  target = window,
}: BindMicHoldGestureOptions): void {
  const startedAt = Date.now();

  function onUp() {
    cleanup();
    const held = Date.now() - startedAt;
    setTimeout(() => {
      if (held >= holdThresholdMs) {
        getRecorder()?.stop();
      } else {
        getRecorder()?.cancel();
      }
    }, 50);
  }

  function onCancel() {
    cleanup();
    setTimeout(() => {
      getRecorder()?.cancel();
    }, 50);
  }

  function cleanup() {
    target.removeEventListener('pointerup', onUp);
    target.removeEventListener('pointercancel', onCancel);
  }

  target.addEventListener('pointerup', onUp);
  target.addEventListener('pointercancel', onCancel);
}
