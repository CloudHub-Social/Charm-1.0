// Shared open/close motion for the mobile emoji/GIF/sticker picker sheet.
// Extracted so the close animation (RoomInput) is guaranteed to mirror the
// open animation (RoomInput) instead of drifting out of sync, and so the
// timing/keyframes have direct unit coverage.

export const MOBILE_SHEET_ANIMATION_DURATION_MS = 280;
export const MOBILE_SHEET_ANIMATION_EASING = 'cubic-bezier(0.32, 0.72, 0, 1)';

export function prefersReducedMotion(): boolean {
  return (
    window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
    document.body.classList.contains('reduced-motion')
  );
}

// xCenter is the phone-layout centering transform (' translateX(-50%)' or '')
// that must be present in every keyframe so it isn't clobbered mid-animation.
export function getMobileSheetOpenKeyframes(xCenter: string): Keyframe[] {
  return [
    { opacity: '0', transform: `translateY(40%)${xCenter}` },
    { opacity: '1', transform: `translateY(0)${xCenter}` },
  ];
}

export function getMobileSheetCloseKeyframes(xCenter: string): Keyframe[] {
  return [
    { opacity: '1', transform: `translateY(0)${xCenter}` },
    { opacity: '0', transform: `translateY(40%)${xCenter}` },
  ];
}
