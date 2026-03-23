/**
 * Tiny diagnostic helper for tracking which code path triggered a page reload.
 *
 * sessionStorage survives window.location.reload() AND survives
 * window.localStorage.clear() (they are separate storage namespaces), so we
 * can use it to pass a "reason" from the reloading page to the next one.
 *
 * Usage example:
 *   markReloadReason('SessionLoggedOut');
 *   window.location.reload();
 *
 * Then on startup call consumeReloadReason() to get (and clear) the reason.
 */

const RELOAD_REASON_KEY = 'sable_reload_reason';

export function markReloadReason(reason: string): void {
  try {
    sessionStorage.setItem(
      RELOAD_REASON_KEY,
      JSON.stringify({ reason, time: new Date().toISOString() })
    );
  } catch {
    // sessionStorage unavailable (e.g. private-mode restrictions) — ignore
  }
}

export function consumeReloadReason(): { reason: string; time: string } | null {
  try {
    const raw = sessionStorage.getItem(RELOAD_REASON_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(RELOAD_REASON_KEY);
    return JSON.parse(raw) as { reason: string; time: string };
  } catch {
    return null;
  }
}
