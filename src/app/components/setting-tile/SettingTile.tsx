import { Children, cloneElement, Fragment, isValidElement, useId, type ReactNode } from 'react';
import { Box, IconButton, Text } from 'folds';
import { Check, Link, sizedIcon } from '$components/icons/phosphor';
import { BreakWord } from '$styles/Text.css';
import { buildSettingsLink } from '$features/settings/settingsLink';
import { copyToClipboard } from '$utils/dom';
import { ScreenSize, useScreenSizeContext } from '$hooks/useScreenSize';
import { useTimeoutToggle } from '$hooks/useTimeoutToggle';
import { useSettingsLinkContext } from '$features/settings/SettingsLinkContext';
import { type SettingsSectionId } from '$features/settings/routes';
import {
  settingTileSettingLinkAction,
  settingTileSettingLinkActionDesktopHidden,
  settingTileSettingLinkActionMobileVisible,
  settingTileSettingLinkActionTransparentBackground,
  settingTileRoot,
  settingTileTitleRow,
} from './SettingTile.css';

type SettingTileProps = {
  focusId?: string;
  showSettingLinkAction?: boolean;
  className?: string;
  title?: ReactNode;
  description?: ReactNode;
  before?: ReactNode;
  after?: ReactNode;
  children?: ReactNode;
};

function SettingTileSettingLinkAction({
  baseUrl,
  section,
  focusId,
}: {
  baseUrl: string;
  section: SettingsSectionId;
  focusId: string;
}) {
  const screenSize = useScreenSizeContext();
  const [copied, setCopied] = useTimeoutToggle();
  const copyPath = buildSettingsLink(baseUrl, section, focusId);

  return (
    <IconButton
      aria-label={copied ? 'Copied settings link' : 'Copy settings link'}
      className={[
        settingTileSettingLinkAction,
        settingTileSettingLinkActionTransparentBackground,
        screenSize === ScreenSize.Desktop
          ? settingTileSettingLinkActionDesktopHidden
          : settingTileSettingLinkActionMobileVisible,
      ].join(' ')}
      onClick={async () => {
        if (await copyToClipboard(copyPath)) setCopied();
      }}
      size="300"
      variant="Surface"
      fill="None"
      radii="Inherit"
    >
      {sizedIcon(copied ? Check : Link, '50')}
    </IconButton>
  );
}

/**
 * Whether `element` is itself eligible to receive `aria-labelledby`: it
 * hasn't already declared its own `aria-label`/`aria-labelledby` (don't
 * override a caller that already self-labels), and has no `children` (don't
 * override an element like a `<Button>` that already derives its accessible
 * name from visible text content - only childless controls like folds'
 * `<Switch>` have nothing to name them).
 */
function isLabelableControl(element: React.ReactElement<Record<string, unknown>>): boolean {
  const existingLabel = element.props['aria-label'];
  const existingLabelledBy = element.props['aria-labelledby'];
  if (existingLabel != null || existingLabelledBy != null) return false;

  return element.props.children == null;
}

/**
 * Clones `after` (the trailing control, e.g. a Switch) to inject
 * `aria-labelledby={titleId}` so it picks up the tile's title as its
 * accessible name.
 *
 * Handles two shapes:
 *  - `after` is itself the labelable control (see `isLabelableControl`).
 *  - `after` is a plain wrapper (a `Fragment` or an element with no
 *    `aria-label`/`aria-labelledby` of its own, e.g. a layout `<Box>`) around
 *    exactly one labelable control, possibly alongside other elements that
 *    already have their own accessible name (text content or an explicit
 *    label) or non-element children from conditional expressions. In that
 *    case the wrapper is returned with that one child labeled instead.
 *
 * Only unwraps a single level - deeper nesting is left untouched rather than
 * guessed at. If a wrapper contains zero or more than one labelable
 * candidate, nothing is labeled (avoids mislabeling the wrong control).
 */
function labelAfterWithTitle(after: ReactNode, titleId: string): ReactNode {
  if (!isValidElement<Record<string, unknown>>(after)) return after;

  if (isLabelableControl(after)) {
    return cloneElement(after, { 'aria-labelledby': titleId });
  }

  const isPlainWrapper =
    after.type === Fragment ||
    (after.props['aria-label'] == null && after.props['aria-labelledby'] == null);
  if (!isPlainWrapper) return after;

  const children = Children.toArray(after.props.children as ReactNode);
  const candidates = children.filter(
    (child): child is React.ReactElement<Record<string, unknown>> =>
      isValidElement<Record<string, unknown>>(child) && isLabelableControl(child)
  );
  if (candidates.length !== 1) return after;

  const target = candidates[0];
  const labeledChildren = children.map((child) =>
    child === target ? cloneElement(target, { 'aria-labelledby': titleId }) : child
  );

  return cloneElement(after, undefined, ...labeledChildren);
}

export function SettingTile({
  focusId,
  showSettingLinkAction = true,
  className,
  title,
  description,
  before,
  after,
  children,
}: SettingTileProps) {
  const settingsLink = useSettingsLinkContext();
  const generatedTitleId = useId();
  const titleId = focusId ? `${focusId}-title` : generatedTitleId;
  const copyAction =
    settingsLink && focusId && showSettingLinkAction ? (
      <SettingTileSettingLinkAction
        baseUrl={settingsLink.baseUrl}
        section={settingsLink.section}
        focusId={focusId}
      />
    ) : null;
  const titleAction = title ? copyAction : null;
  const trailingCopyAction = title ? null : copyAction;

  const labeledAfter = title ? labelAfterWithTitle(after, titleId) : after;

  const trailing =
    after || trailingCopyAction ? (
      <Box shrink="No" alignItems="Center" gap="200">
        {labeledAfter}
        {trailingCopyAction}
      </Box>
    ) : null;

  return (
    <Box
      id={focusId}
      data-settings-focus={focusId}
      className={[settingTileRoot, className].filter(Boolean).join(' ')}
      alignItems="Center"
      gap="300"
    >
      {before && <Box shrink="No">{before}</Box>}
      <Box grow="Yes" direction="Column" gap="100">
        {title && (
          <Box
            data-setting-tile-title-row="true"
            className={settingTileTitleRow}
            alignItems="Center"
            gap="100"
          >
            <Text id={titleId} className={BreakWord} size="T300">
              {title}
            </Text>
            {titleAction}
          </Box>
        )}
        {description && (
          <Text className={BreakWord} size="T200" priority="300">
            {description}
          </Text>
        )}
        {children}
      </Box>
      {trailing}
    </Box>
  );
}
