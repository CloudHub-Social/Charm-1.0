const KEYBOARD_SETTLE_TIMEOUT_MS = 260;
const VIEWPORT_STABLE_DELTA_PX = 1;
const VIEWPORT_STABLE_FRAMES = 2;
let userSelectSuppressionCount = 0;
let previousUserSelect = "";
let previousWebkitUserSelect = "";
let previousWebkitTouchCallout = "";

const isEditableElement = (element: Element | null): element is HTMLElement => {
  if (!(element instanceof HTMLElement)) return false;

  const tagName = element.tagName.toLowerCase();
  return (
    element.isContentEditable ||
    tagName === "textarea" ||
    (tagName === "input" &&
      ![
        "button",
        "checkbox",
        "file",
        "hidden",
        "radio",
        "range",
        "reset",
        "submit",
      ].includes((element as HTMLInputElement).type))
  );
};

export const clearTextSelection = () => {
  window.getSelection()?.removeAllRanges();
};

export const dismissActiveKeyboard = () => {
  const activeElement = document.activeElement;
  if (isEditableElement(activeElement)) {
    activeElement.blur();
  }
};

export const waitForMobileViewportStabilize = (
  timeoutMs = KEYBOARD_SETTLE_TIMEOUT_MS,
): Promise<void> =>
  new Promise((resolve) => {
    const viewport = window.visualViewport;

    dismissActiveKeyboard();

    if (!viewport) {
      window.setTimeout(resolve, 120);
      return;
    }

    let frameId = 0;
    let stableFrames = 0;
    let lastHeight = viewport.height;
    let resolveOnce: (() => void) | null = resolve;

    const finish = () => {
      const currentResolve = resolveOnce;
      if (!currentResolve) return;
      resolveOnce = null;
      if (frameId) cancelAnimationFrame(frameId);
      currentResolve();
    };

    const timeoutId = window.setTimeout(finish, timeoutMs);

    const check = () => {
      if (!resolveOnce) return;

      const currentHeight = viewport.height;
      const activeEditable = isEditableElement(document.activeElement);

      if (Math.abs(currentHeight - lastHeight) <= VIEWPORT_STABLE_DELTA_PX) {
        stableFrames += 1;
      } else {
        stableFrames = 0;
        lastHeight = currentHeight;
      }

      if (!activeEditable && stableFrames >= VIEWPORT_STABLE_FRAMES) {
        window.clearTimeout(timeoutId);
        finish();
        return;
      }

      frameId = requestAnimationFrame(check);
    };

    frameId = requestAnimationFrame(check);
  });

export const suppressUserSelect = () => {
  const { style } = document.body;
  const touchCalloutStyle = style as CSSStyleDeclaration & {
    webkitTouchCallout?: string;
  };
  if (userSelectSuppressionCount === 0) {
    previousUserSelect = style.userSelect;
    previousWebkitUserSelect = style.webkitUserSelect;
    previousWebkitTouchCallout = touchCalloutStyle.webkitTouchCallout ?? "";
    style.userSelect = "none";
    style.webkitUserSelect = "none";
    touchCalloutStyle.webkitTouchCallout = "none";
  }
  userSelectSuppressionCount += 1;

  return () => {
    if (userSelectSuppressionCount === 0) return;
    userSelectSuppressionCount -= 1;
    if (userSelectSuppressionCount > 0) return;

    style.userSelect = previousUserSelect;
    style.webkitUserSelect = previousWebkitUserSelect;
    touchCalloutStyle.webkitTouchCallout = previousWebkitTouchCallout;
  };
};
