type KeyboardCloseArgs = {
  heightDelta: number;
  isKeyboardVisible: boolean;
  prevKeyboardHeight: number;
  prevKeyboardVisible: boolean;
};

export const didKeyboardJustClose = ({
  heightDelta,
  isKeyboardVisible,
  prevKeyboardHeight,
  prevKeyboardVisible,
}: KeyboardCloseArgs): boolean =>
  prevKeyboardVisible &&
  !isKeyboardVisible &&
  heightDelta > 0 &&
  prevKeyboardHeight > 0 &&
  Math.abs(heightDelta - prevKeyboardHeight) < 50;

export const shouldRepinBottomAfterKeyboardClose = (
  keyboardJustClosed: boolean,
  keyboardSessionWasBottomPinned: boolean
): boolean => keyboardJustClosed && keyboardSessionWasBottomPinned;
