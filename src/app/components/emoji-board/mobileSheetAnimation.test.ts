import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  MOBILE_SHEET_ANIMATION_DURATION_MS,
  MOBILE_SHEET_ANIMATION_EASING,
  getMobileSheetCloseKeyframes,
  getMobileSheetOpenKeyframes,
  prefersReducedMotion,
} from './mobileSheetAnimation';

function mockMatchMedia(matches: boolean) {
  window.matchMedia = vi.fn<(query: string) => MediaQueryList>((query) => {
    const mediaQueryList = {
      matches,
      media: query,
      onchange: null,
      addEventListener: vi.fn<MediaQueryList['addEventListener']>(),
      removeEventListener: vi.fn<MediaQueryList['removeEventListener']>(),
      addListener: vi.fn<(handler: () => void) => void>(),
      removeListener: vi.fn<(handler: () => void) => void>(),
      dispatchEvent: vi.fn<MediaQueryList['dispatchEvent']>(),
    } as unknown as MediaQueryList;

    return mediaQueryList;
  });
}

describe('mobile sheet animation keyframes', () => {
  it('open keyframes slide up from 40% translateY while fading in', () => {
    const frames = getMobileSheetOpenKeyframes('');
    expect(frames).toEqual([
      { opacity: '0', transform: 'translateY(40%)' },
      { opacity: '1', transform: 'translateY(0)' },
    ]);
  });

  it('close keyframes are the exact reverse of the open keyframes', () => {
    const xCenter = ' translateX(-50%)';
    expect(getMobileSheetCloseKeyframes(xCenter)).toEqual(
      getMobileSheetOpenKeyframes(xCenter).toReversed()
    );
  });

  it('preserves the phone-layout centering transform in every frame', () => {
    const xCenter = ' translateX(-50%)';
    const allFrames = [
      ...getMobileSheetOpenKeyframes(xCenter),
      ...getMobileSheetCloseKeyframes(xCenter),
    ];
    allFrames.forEach((frame) => {
      expect(String(frame.transform)).toContain(xCenter);
    });
  });

  it('exposes a fixed duration and easing shared by open and close', () => {
    expect(MOBILE_SHEET_ANIMATION_DURATION_MS).toBe(280);
    expect(MOBILE_SHEET_ANIMATION_EASING).toBe('cubic-bezier(0.32, 0.72, 0, 1)');
  });
});

describe('prefersReducedMotion', () => {
  const originalMatchMedia = window.matchMedia;

  afterEach(() => {
    document.body.classList.remove('reduced-motion');
    window.matchMedia = originalMatchMedia;
  });

  it('is false when neither the OS nor the app setting request reduced motion', () => {
    mockMatchMedia(false);
    expect(prefersReducedMotion()).toBe(false);
  });

  it('is true when the OS media query matches', () => {
    mockMatchMedia(true);
    expect(prefersReducedMotion()).toBe(true);
  });

  it('is true when the app applies the reduced-motion body class, even if the OS query does not match', () => {
    mockMatchMedia(false);
    document.body.classList.add('reduced-motion');
    expect(prefersReducedMotion()).toBe(true);
  });
});
