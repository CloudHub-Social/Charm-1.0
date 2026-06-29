const EMOJI_BOARD_MAX_WIDTH = 432;
const GIF_BOARD_MAX_WIDTH = 480;
const EMOJI_BOARD_VIEWPORT_GUTTER = 32;
const GIF_BOARD_VIEWPORT_GUTTER = 16;

export const getEmojiBoardWidth = (viewportWidth: number, preferWide = false): number => {
  const maxWidth = preferWide ? GIF_BOARD_MAX_WIDTH : EMOJI_BOARD_MAX_WIDTH;
  const gutter = preferWide ? GIF_BOARD_VIEWPORT_GUTTER : EMOJI_BOARD_VIEWPORT_GUTTER;

  return Math.min(maxWidth, Math.max(0, viewportWidth - gutter));
};

export const getEmojiBoardRightOffset = (
  anchorRight: number,
  viewportWidth: number,
  preferWide = false
): number => {
  const boardWidth = getEmojiBoardWidth(viewportWidth, preferWide);
  const maxWidth = preferWide ? GIF_BOARD_MAX_WIDTH : EMOJI_BOARD_MAX_WIDTH;
  const availableSlack = Math.max(0, viewportWidth - boardWidth);

  // On narrow viewports the responsive picker already fills the screen minus a
  // fixed gutter, so centering it preserves even left/right spacing.
  if (boardWidth < maxWidth) {
    return availableSlack / 2;
  }

  const rawRight = viewportWidth - anchorRight;
  return Math.max(0, Math.min(rawRight, availableSlack));
};
