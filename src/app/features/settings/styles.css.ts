import { globalStyle, style } from '@vanilla-extract/css';
import { config } from 'folds';
import { messageJumpHighlight } from '$components/message/layout/layout.css';
import * as pageCss from '$components/page/style.css';

export const SequenceCardStyle = style({
  padding: config.space.S300,
});

export const settingsHeader = style({
  paddingLeft: config.space.S300,
  paddingRight: config.space.S200,
});

export const settingsSectionPage = style({});

globalStyle(`${settingsSectionPage} .${pageCss.PageContent}`, {
  paddingBottom: `calc(${config.space.S400} + var(--sable-safe-area-bottom, 0px))`,
});

export const focusedSettingTile = messageJumpHighlight;
