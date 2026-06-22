import { describe, expect, it } from 'vitest';
import {
  didKeyboardJustClose,
  shouldRepinBottomAfterKeyboardClose,
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
});
