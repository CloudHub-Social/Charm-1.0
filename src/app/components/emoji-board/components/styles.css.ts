import { style } from '@vanilla-extract/css';
import { recipe } from '@vanilla-extract/recipes';
import { toRem, color, config, DefaultReset, FocusOutline } from 'folds';

/**
 * Layout
 */

export const Base = recipe({
  base: [
    {
      maxWidth: toRem(432),
      width: `calc(100vw - 2 * ${config.space.S400})`,
      height: toRem(450),
      backgroundColor: color.Surface.Container,
      color: color.Surface.OnContainer,
      border: `${config.borderWidth.B300} solid ${color.Surface.ContainerLine}`,
      borderRadius: config.radii.R400,
      boxShadow: config.shadow.E200,
      overflow: 'hidden',
    },
  ],
  variants: {
    isFullWidth: {
      true: {
        maxWidth: '100vw',
        width: `calc(100vw - ${config.borderWidth.B300})`,
      },
    },
    isGifLayout: {
      true: {
        maxWidth: toRem(480),
        // On mobile the GIF board uses a 16px viewport gutter (vs 32px for emoji).
        // Override the base width so the CSS matches the JS positioning calculation.
        width: `calc(100vw - ${config.space.S400})`,
        height: toRem(520),
        borderRadius: config.radii.R500,
        boxShadow: config.shadow.E300,
      },
    },
  },
});

export const Header = style({
  padding: config.space.S300,
  paddingBottom: 0,
});

export const GifHeaderShell = style({
  paddingTop: config.space.S100,
});

export const MobileSheetHandleShell = style({
  paddingTop: config.space.S100,
  paddingBottom: config.space.S200,
  touchAction: 'none',
  userSelect: 'none',
});

export const MobileSheetHandle = style([
  DefaultReset,
  FocusOutline,
  {
    display: 'block',
    width: toRem(44),
    height: toRem(5),
    borderRadius: config.radii.Pill,
    backgroundColor: color.SurfaceVariant.ContainerLine,
    margin: '0 auto',
    cursor: 'ns-resize',
    border: 'none',
    touchAction: 'none',
  },
]);

export const GifHandle = style({
  width: toRem(44),
  height: toRem(5),
  borderRadius: config.radii.Pill,
  backgroundColor: color.SurfaceVariant.ContainerLine,
  margin: `0 auto ${config.space.S200}`,
});

export const GifHeader = style({
  padding: `${config.space.S200} ${config.space.S200} ${config.space.S100}`,
  borderRadius: config.radii.R500,
  background: `linear-gradient(180deg, ${color.SurfaceVariant.Container} 0%, ${color.Surface.Container} 100%)`,
  border: `${config.borderWidth.B300} solid ${color.Surface.ContainerLine}`,
});

export const GifSearchMeta = style({
  padding: `${config.space.S100} ${config.space.S100} 0`,
  rowGap: config.space.S100,
});

export const GifDiscovery = style({
  padding: `${config.space.S200} ${config.space.S200} ${config.space.S300}`,
});

export const GifDiscoverySection = style({
  paddingTop: config.space.S100,
});

export const GifChipRow = style({
  display: 'flex',
  flexWrap: 'wrap',
  gap: config.space.S100,
});

export const GifPromptGrid = style({
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: config.space.S200,
});

export const GifAttribution = style({
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  textAlign: 'right',
  lineHeight: toRem(14),
  whiteSpace: 'normal',
});

/**
 * Sidebar
 */

export const Sidebar = style({
  width: toRem(54),
  backgroundColor: color.Surface.Container,
  color: color.Surface.OnContainer,
  position: 'relative',
});

export const SidebarContent = style({
  padding: `${config.space.S200} 0`,
});

export const SidebarStack = style({
  width: '100%',
  backgroundColor: color.Surface.Container,
});

export const SidebarDivider = style({
  width: toRem(18),
});

export const SidebarBtnImg = style({
  width: toRem(24),
  height: toRem(24),
  objectFit: 'contain',
});

/**
 * Preview
 */

export const Preview = style({
  padding: config.space.S200,
  margin: config.space.S300,
  marginTop: 0,
  minHeight: toRem(40),

  borderRadius: config.radii.R400,
  backgroundColor: color.SurfaceVariant.Container,
  color: color.SurfaceVariant.OnContainer,
});

export const PreviewEmoji = style([
  DefaultReset,
  {
    width: toRem(32),
    height: toRem(32),
    fontSize: toRem(32),
    lineHeight: toRem(32),
  },
]);
export const PreviewImg = style([
  DefaultReset,
  {
    width: toRem(32),
    height: toRem(32),
    objectFit: 'contain',
  },
]);

/**
 * Group
 */

export const EmojiGroup = style({
  position: 'relative',
  padding: `${config.space.S300} 0`,
});

export const EmojiGroupLabel = style({
  position: 'sticky',
  top: config.space.S200,
  zIndex: 1,

  margin: 'auto',
  padding: `${config.space.S100} ${config.space.S200}`,
  borderRadius: config.radii.Pill,
  backgroundColor: color.SurfaceVariant.Container,
  color: color.SurfaceVariant.OnContainer,
});

export const EmojiGroupContent = style([
  DefaultReset,
  {
    padding: `0 ${config.space.S200}`,
  },
]);

export const GifGroupContent = style([
  DefaultReset,
  {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: config.space.S200,
    padding: `0 ${config.space.S200} ${config.space.S200}`,
  },
]);

/**
 * Item
 */

export const EmojiItem = style([
  DefaultReset,
  FocusOutline,
  {
    width: toRem(48),
    height: toRem(48),
    fontSize: toRem(32),
    lineHeight: toRem(32),
    borderRadius: config.radii.R400,
    cursor: 'pointer',

    ':hover': {
      backgroundColor: color.Surface.ContainerHover,
    },
  },
]);

export const EmojiGlyph = style({
  width: toRem(32),
  height: toRem(32),
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontFamily:
    'var(--font-emoji), "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif',
  fontSize: toRem(32),
  lineHeight: toRem(32),
  textAlign: 'center',
});

export const StickerItem = style([
  EmojiItem,
  {
    width: toRem(112),
    height: toRem(112),
  },
]);

export const CustomEmojiImg = style([
  DefaultReset,
  {
    width: toRem(32),
    height: toRem(32),
    objectFit: 'contain',
  },
]);

export const StickerImg = style([
  DefaultReset,
  {
    width: toRem(96),
    height: toRem(96),
    objectFit: 'contain',
  },
]);

export const GifContainer = style({
  columnCount: 3,
  columnGap: toRem(8),
  padding: toRem(16),

  '@media': {
    '(max-width: 768px)': {
      columnCount: 2,
    },
    '(max-width: 480px)': {
      columnCount: 1,
    },
  },
});

export const GifItem = style([
  DefaultReset,
  FocusOutline,
  {
    width: '100%',
    borderRadius: config.radii.R500,
    cursor: 'pointer',
    overflow: 'hidden',
    display: 'block',
    position: 'relative',
    minHeight: toRem(132),
    backgroundColor: color.SurfaceVariant.Container,
    border: `${config.borderWidth.B300} solid ${color.SurfaceVariant.ContainerLine}`,
    transition: 'transform 120ms ease, box-shadow 120ms ease, border-color 120ms ease',

    ':hover': {
      transform: 'translateY(-1px)',
      borderColor: color.Primary.Main,
      boxShadow: config.shadow.E200,
    },
  },
]);

export const GifSearchItem = style([
  GifItem,
  {
    minHeight: toRem(112),
  },
]);

export const GifImg = style({
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  borderRadius: 'inherit',
});

export const GifScrim = style({
  position: 'absolute',
  inset: 0,
  background:
    'linear-gradient(180deg, rgba(0, 0, 0, 0.02) 0%, rgba(0, 0, 0, 0.12) 38%, rgba(0, 0, 0, 0.72) 100%)',
  pointerEvents: 'none',
});

export const GifMeta = style({
  position: 'absolute',
  left: 0,
  right: 0,
  bottom: 0,
  padding: `${config.space.S200} ${config.space.S200} ${config.space.S200}`,
  color: '#fff',
});

export const GifSearchMetaOverlay = style([
  GifMeta,
  {
    top: 0,
    bottom: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: config.space.S300,
    textAlign: 'center',
  },
]);

export const GifMetaTitle = style({
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

export const GifMetaBadge = style({
  padding: `${config.space.S100} ${config.space.S100}`,
  borderRadius: config.radii.Pill,
  backgroundColor: 'rgba(0, 0, 0, 0.48)',
  color: '#fff',
  width: 'fit-content',
});

export const GifFavoriteBtn = style([
  DefaultReset,
  FocusOutline,
  {
    position: 'absolute',
    top: config.space.S200,
    right: config.space.S200,
    width: toRem(32),
    height: toRem(32),
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: config.radii.Pill,
    backgroundColor: 'rgba(0, 0, 0, 0.52)',
    color: '#fff',
    cursor: 'pointer',
    border: 'none',
    backdropFilter: 'blur(6px)',
  },
]);
