/**
 * Tiny diagnostic helper for tracking which code path triggered a page reload.
 *
 * We use localStorage (not sessionStorage) because Vivaldi's PWA mode handles
 * window.location.reload() by closing and relaunching the window entirely,
 * which creates a fresh browsing context and wipes sessionStorage.  localStorage
 * persists across that relaunch, so the reason survives.
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
    localStorage.setItem(
      RELOAD_REASON_KEY,
      JSON.stringify({ reason, time: new Date().toISOString() })
    );
  } catch {
    // localStorage unavailable — ignore
  }
}

export function consumeReloadReason(): { reason: string; time: string } | null {
  try {
    const raw = localStorage.getItem(RELOAD_REASON_KEY);
    if (!raw) return null;
    localStorage.removeItem(RELOAD_REASON_KEY);
    return JSON.parse(raw) as { reason: string; time: string };
  } catch {
    return null;
  }
}
