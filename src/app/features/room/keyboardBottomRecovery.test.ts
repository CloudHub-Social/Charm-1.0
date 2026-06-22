import { describe, expect, it } from 'vitest';
import {
  didKeyboardJustClose,
  shouldRepinBottomAfterKeyboardClose,
  shouldClearKeyboardBottomSessionOnUserIntent,
} from './keyboardBottomRecovery';

describe('keyboardBottomRecovery', () => {
  it('detects viewport expansion that matches a closing keyboard', () => {
    expect(
      didKeyboardJustClose({
        heightDelta: 302,
        isKeyboardVisible: false,
        prevKeyboardHeight: 320,
        prevKeyboardVisible: true,
      })
    ).toBe(true);
  });

  it('ignores viewport changes that are not a keyboard close', () => {
    expect(
      didKeyboardJustClose({
        heightDelta: 302,
        isKeyboardVisible: true,
        prevKeyboardHeight: 320,
        prevKeyboardVisible: true,
      })
    ).toBe(false);
    expect(
      didKeyboardJustClose({
        heightDelta: 120,
        isKeyboardVisible: false,
        prevKeyboardHeight: 320,
        prevKeyboardVisible: true,
      })
    ).toBe(false);
  });

  it('only repins when the keyboard session started from live bottom', () => {
    expect(shouldRepinBottomAfterKeyboardClose(true, true)).toBe(true);
    expect(shouldRepinBottomAfterKeyboardClose(true, false)).toBe(false);
    expect(shouldRepinBottomAfterKeyboardClose(false, true)).toBe(false);
  });

  it('keeps tap-to-dismiss from clearing the keyboard bottom session', () => {
    expect(shouldClearKeyboardBottomSessionOnUserIntent('pointerdown', true)).toBe(false);
    expect(shouldClearKeyboardBottomSessionOnUserIntent('wheel', true)).toBe(true);
    expect(shouldClearKeyboardBottomSessionOnUserIntent('touchmove', true)).toBe(true);
    expect(shouldClearKeyboardBottomSessionOnUserIntent('keyboard', true)).toBe(true);
    expect(shouldClearKeyboardBottomSessionOnUserIntent('wheel', false)).toBe(false);
  });
});
