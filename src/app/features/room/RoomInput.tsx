import type { KeyboardEventHandler, MouseEvent, RefObject } from 'react';
import {
  forwardRef,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useMemo,
} from 'react';
import { createPortal } from 'react-dom';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';

import { isKeyHotkey } from 'is-hotkey';
import type {
  IContent,
  MatrixEvent,
  Room,
  IEventRelation,
  RoomMessageEventContent,
  StickerEventContent,
} from '$types/matrix-sdk';
import { MatrixError } from '$types/matrix-sdk';
import { EventStatus, EventType, MsgType, RelationType } from '$types/matrix-sdk';
import { ReactEditor } from 'slate-react';
import { Editor, Point, Range, Transforms, Text as SlateText } from 'slate';
import type { RectCords } from 'folds';
import {
  Box,
  color,
  config,
  Dialog,
  Icon,
  Icons,
  IconButton,
  Menu,
  MenuItem,
  Overlay,
  OverlayBackdrop,
  OverlayCenter,
  PopOut,
  Scroll,
  Text,
  toRem,
} from 'folds';

import { useMatrixClient } from '$hooks/useMatrixClient';
import type { AutocompleteQuery } from '$components/editor';
import {
  AutocompletePrefix,
  createEmoticonElement,
  CustomEditor,
  customHtmlEqualsPlainText,
  getAutocompleteQuery,
  getPrevWorldRange,
  resetEditor,
  RoomMentionAutocomplete,
  toMatrixCustomHTML,
  toPlainText,
  trimCustomHtml,
  UserMentionAutocomplete,
  EmoticonAutocomplete,
  moveCursor,
  resetEditorHistory,
  isEmptyEditor,
  getBeginCommand,
  trimCommand,
  getMentions,
  ANYWHERE_AUTOCOMPLETE_PREFIXES,
  BEGINNING_AUTOCOMPLETE_PREFIXES,
  getLinks,
  MarkdownFormattingToolbarBottom,
  MarkdownFormattingToolbarToggle,
  replaceWithElement,
  BlockType,
} from '$components/editor';
import { plainToEditorInput } from '$components/editor/input';
import { htmlToMarkdown } from '$plugins/markdown';
import type { GifData } from '$components/emoji-board';
import { EmojiBoard, EmojiBoardTab } from '$components/emoji-board';
import {
  MOBILE_SHEET_ANIMATION_DURATION_MS,
  MOBILE_SHEET_ANIMATION_EASING,
  getMobileSheetCloseKeyframes,
  getMobileSheetOpenKeyframes,
  prefersReducedMotion,
} from '$components/emoji-board/mobileSheetAnimation';
import { getKlipyRemoteId, isKlipyProxyMxc, normalizeGifProxyHost } from '$utils/gifs';
import type { TUploadContent } from '$utils/matrix';
import { encryptFile, getImageInfo, mxcUrlToHttp, toggleReaction } from '$utils/matrix';
import { useTypingStatusUpdater } from '$hooks/useTypingStatusUpdater';
import { useFilePicker } from '$hooks/useFilePicker';
import { useFilePasteHandler } from '$hooks/useFilePasteHandler';
import { useFileDropZone } from '$hooks/useFileDrop';
import type { TUploadItem, TUploadMetadata, IReplyDraft } from '$state/room/roomInputDrafts';
import {
  roomIdToMsgDraftAtomFamily,
  roomIdToReplyDraftAtomFamily,
  roomIdToUploadItemsAtomFamily,
  roomUploadAtomFamily,
  roomIdToEditDraftAtomFamily,
} from '$state/room/roomInputDrafts';
import { UploadCardRenderer } from '$components/upload-card';
import type { UploadBoardImperativeHandlers } from '$components/upload-board';
import { UploadBoard, UploadBoardContent, UploadBoardHeader } from '$components/upload-board';
import type { Upload, UploadSuccess } from '$state/upload';
import { UploadStatus, createUploadFamilyObserverAtom } from '$state/upload';
import { loadImageElementFromMediaUrl } from '$utils/dom';
import { safeFile } from '$utils/mimeTypes';
import { fulfilledPromiseSettledResult } from '$utils/common';
import { useSetting } from '$state/hooks/settings';
import { settingsAtom } from '$state/settings';
import {
  getMentionContent,
  isThreadRelationEvent,
  reactionOrEditEvent,
  getEditedEvent,
} from '$utils/room';
import { Command, SHRUG, TABLEFLIP, UNFLIP, useCommands } from '$hooks/useCommands';
import { isPhoneLayoutDevice, mobileOrTablet } from '$utils/user-agent';
import { useElementSizeObserver } from '$hooks/useElementSizeObserver';
import { Reply, ThreadIndicator } from '$components/message';
import { roomToParentsAtom } from '$state/room/roomToParents';
import { nicknamesAtom } from '$state/nicknames';
import { useMediaAuthentication } from '$hooks/useMediaAuthentication';
import { useImagePackRooms } from '$hooks/useImagePackRooms';
import { useComposingCheck } from '$hooks/useComposingCheck';
import { createLogger } from '$utils/debug';
import { createDebugLogger } from '$utils/debugLogger';
import {
  buildNotificationBreadcrumb,
  buildNotificationMetricAttributes,
} from '$utils/notificationTelemetry';
import FocusTrap from 'focus-trap-react';
import { useQueryClient } from '@tanstack/react-query';
import * as Sentry from '@sentry/react';
import {
  delayedEventsSupportedAtom,
  roomIdToScheduledTimeAtomFamily,
  roomIdToEditingScheduledDelayIdAtomFamily,
  serverMaxDelayMsAtom,
} from '$state/scheduledMessages';
import {
  sendDelayedMessage,
  sendDelayedMessageE2EE,
  computeDelayMs,
  cancelDelayedEvent,
} from '$utils/delayedEvents';
import { timeHourMinute, timeDayMonthYear, daysToMs } from '$utils/time';
import {
  closeKeyboardBeforeOpeningOverlay,
  primeKeyboardCloseForOverlayOpen,
  stopPropagation,
} from '$utils/keyboard';

import { usePowerLevelsContext } from '$hooks/usePowerLevels';
import { useRoomCreators } from '$hooks/useRoomCreators';
import { useRoomPermissions } from '$hooks/useRoomPermissions';
import { AutocompleteNotice } from '$components/editor/autocomplete/AutocompleteNotice';
import { getEmojiBoardRightOffset, getEmojiBoardWidth } from './emojiBoardPosition';
import {
  convertPerMessageProfileToBeeperFormat,
  getCurrentlyUsedPerMessageProfileForRoom,
} from '$hooks/usePerMessageProfile';
import {
  Bell,
  BellSlash,
  CaretDown,
  chipIcon,
  Clock,
  composerIcon,
  dropzoneIcon,
  File as FileIcon,
  ListBullets,
  MapPinPlusIcon,
  menuIcon,
  Microphone,
  PaperPlaneTilt,
  getPhosphorIconSize,
  PlusCircle,
  Smiley,
  Sticker,
  Stop,
  X,
} from '$components/icons/phosphor';
import { getSupportedAudioExtension } from '$plugins/voice-recorder-kit/supportedCodec';
import { ErrorCode } from '$app/cs-errorcode';
import { sanitizeText } from '$utils/sanitize';
import { PKitCommandMessageHandler } from '$plugins/pluralkit-handler/PKitCommandMessageHandler';
import { PKitProxyMessageHandler } from '$plugins/pluralkit-handler/PKitProxyMessageHandler';
import type { IGenericMSC4459, MSC4459ImagePackReference } from '$types/matrix/common';
import {
  getImagePackReferencesForMxc,
  getImagePackReferencesForMxcWrappedInMap,
} from '$utils/msc4459helper';
import { ImageUsage } from '$plugins/custom-emoji';
import { SerializableMap } from '$types/wrapper/SerializableMap';
import { useSettingsLinkBaseUrl } from '$features/settings/useSettingsLinkBaseUrl';
import { useKeyboardHeight, useScrollLock } from '$hooks/ios-keyboard-fix';
import { SchedulePickerDialog } from './schedule-send';
import * as css from './schedule-send/SchedulePickerDialog.css';
import {
  getAudioMsgContent,
  getFileMsgContent,
  getImageMsgContent,
  getVideoMsgContent,
} from './msgContent';
import { outgoingMessageTransforms } from './outgoingMessageTransforms';
import { CommandAutocomplete } from './CommandAutocomplete';
import type {
  AudioMessageRecorderHandle,
  AudioRecordingCompletePayload,
} from './AudioMessageRecorder';
import { AudioMessageRecorder } from './AudioMessageRecorder';
import { primeAudioContext } from '$plugins/voice-recorder-kit';
import { PollCreator } from './PollCreator';
import { sendImmediateMessage } from './sendImmediateMessage';
import {
  applyAttachmentSendPlan,
  createAttachmentSendPlan,
  type ComposerAttachmentCaption,
} from './attachmentSendPlan';
import * as prefix from '$unstable/prefixes';
import { LocationDialog } from './location-modal';
import {
  applyEmojiAutoReplacementAtEnd,
  findEmojiAutoReplacement,
  getStructuredMarkdownAction,
  shouldInsertBreakAfterStructuredReplacement,
} from './composerInputAssist';
import { gifSearchConfigured, useClientConfig } from '$hooks/useClientConfig';
import { GifIcon } from '@phosphor-icons/react';

// Returns the event ID of the most recent non-reaction/non-edit event in a thread,
// falling back to the thread root if no replies exist yet.
export const getLatestThreadEventId = (room: Room, threadRootId: string): string => {
  const thread = room.getThread(threadRootId);
  const threadEvents: MatrixEvent[] = thread?.events ?? [];
  const filtered = threadEvents.filter(
    (ev) =>
      ev.getId() !== threadRootId &&
      !reactionOrEditEvent(ev) &&
      isThreadRelationEvent(ev, threadRootId)
  );
  if (filtered.length > 0) {
    return filtered[filtered.length - 1]!.getId() ?? threadRootId;
  }
  // Fall back to the live timeline if the Thread object hasn't been registered yet
  const liveEvents = room
    .getUnfilteredTimelineSet()
    .getLiveTimeline()
    .getEvents()
    .filter(
      (ev) =>
        ev.getId() !== threadRootId &&
        !reactionOrEditEvent(ev) &&
        isThreadRelationEvent(ev, threadRootId)
    );
  if (liveEvents.length > 0) {
    return liveEvents.at(-1)!.getId() ?? threadRootId;
  }
  return threadRootId;
};

export const getReplyContent = (
  replyDraft: IReplyDraft | undefined,
  room?: Room
): IEventRelation => {
  if (!replyDraft) return {};

  const relatesTo: IEventRelation = {};

  // If this is a thread relation
  if (replyDraft.relation?.rel_type === RelationType.Thread) {
    relatesTo.event_id = replyDraft.relation.event_id;
    relatesTo.rel_type = RelationType.Thread;

    // If the user explicitly clicked "reply" on a message (including the thread root),
    // we must set is_falling_back=false and target that message directly.
    // (replyDraft.body being empty means it's just a seeded thread draft)
    if (replyDraft.body) {
      // Explicit reply — per spec, is_falling_back must be false
      relatesTo['m.in_reply_to'] = {
        event_id: replyDraft.eventId,
      };
      relatesTo.is_falling_back = false;
    } else {
      // Regular thread message — per spec, include fallback m.in_reply_to pointing to the
      // most recent thread message so unthreaded clients can display it as a reply chain
      const threadRootId = replyDraft.relation.event_id ?? replyDraft.eventId;
      const latestEventId = room ? getLatestThreadEventId(room, threadRootId) : threadRootId;
      relatesTo['m.in_reply_to'] = {
        event_id: latestEventId,
      };
      relatesTo.is_falling_back = true;
    }
  } else {
    // Regular reply (not in a thread)
    relatesTo['m.in_reply_to'] = {
      event_id: replyDraft.eventId,
    };
  }

  return relatesTo;
};

const getReplyMentionData = (
  replyDraft: IReplyDraft | undefined,
  replyEvent: MatrixEvent | undefined,
  silentReply: boolean,
  roomMention = false
) => {
  if (!replyDraft || silentReply) return undefined;

  return getMentionContent(
    [replyDraft.userId],
    roomMention || replyEvent?.getContent()['m.mentions']?.room === true
  );
};

const log = createLogger('RoomInput');
const debugLog = createDebugLogger('RoomInput');

const serializeReplyDraft = (draft: IReplyDraft | undefined): string =>
  JSON.stringify(draft ?? null);

interface ReplyEventContent {
  'm.relates_to'?: IEventRelation;
}

const createUploadItemKey = () =>
  globalThis.crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const toBase64Url = (value: string): string => {
  const bytes = new TextEncoder().encode(value);
  let binary = '';

  for (const byte of bytes) {
    binary += String.fromCodePoint(byte);
  }

  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll(/=+$/g, '');
};

const toMatrixMediaId = (value: string, providerPrefix: string): string =>
  providerPrefix + toBase64Url(value);

interface RoomInputProps {
  editor: Editor;
  fileDropContainerRef: RefObject<HTMLElement>;
  roomId: string;
  room: Room;
  threadRootId?: string;
  onEditLastMessage?: () => void;
}

export const RoomInput = forwardRef<HTMLDivElement, RoomInputProps>(
  ({ editor, fileDropContainerRef, roomId, room, threadRootId, onEditLastMessage }, ref) => {
    // When in thread mode, isolate drafts by thread root ID so thread replies
    // don't clobber the main room draft (and vice versa).
    const draftKey = threadRootId ?? roomId;
    const mx = useMatrixClient();
    const clientConfig = useClientConfig();
    const [enableGifPicker] = useSetting(settingsAtom, 'enableGifPicker');
    const gifsEnabled = enableGifPicker && gifSearchConfigured(clientConfig);
    const useAuthentication = useMediaAuthentication();
    const [enterForNewline] = useSetting(settingsAtom, 'enterForNewline');
    const [editorOldAddFile] = useSetting(settingsAtom, 'editorOldAddFile');
    const [structuredMarkdownAssist] = useSetting(settingsAtom, 'structuredMarkdownAssist');
    const [emojiAutoExpand] = useSetting(settingsAtom, 'emojiAutoExpand');
    const [showTouchSpacing] = useSetting(settingsAtom, 'showTouchSpacing');
    const touchTargetSize = showTouchSpacing ? '500' : '300';

    const [hideActivity] = useSetting(settingsAtom, 'hideActivity');
    const [mentionInReplies] = useSetting(settingsAtom, 'mentionInReplies');
    const settingsLinkBaseUrl = useSettingsLinkBaseUrl();
    const commands = useCommands(mx, room);
    const imagePacksUsedRef = useRef(new SerializableMap<string, MSC4459ImagePackReference>());
    /**
     * handle pluralkit-style messages
     */
    const pluralkitCmdMessageHandler = useMemo(
      () => new PKitCommandMessageHandler(mx, room),
      [mx, room]
    );
    const pluralkitProxyMessageHandler = useMemo(() => new PKitProxyMessageHandler(mx), [mx]);
    useEffect(() => {
      pluralkitProxyMessageHandler.init();
    }, [pluralkitProxyMessageHandler]);

    const [pkCompatEnable] = useSetting(settingsAtom, 'pkCompat');
    const [pmpProxyingEnable] = useSetting(settingsAtom, 'pmpProxying');
    const isMobileLayout = mobileOrTablet();
    const emojiBtnRef = useRef<HTMLButtonElement>(null);
    // Hoisted from the UseStateProvider in JSX so EmojiBoard can be kept mounted
    // after first open (avoids re-initializing virtualizer on every open).
    const [emojiBoardTab, setEmojiBoardTab] = useState<EmojiBoardTab | undefined>(undefined);
    const [emojiBoardAnchorRect, setEmojiBoardAnchorRect] = useState<DOMRect | null>(null);
    const overlayOpenSequenceRef = useRef(0);
    const prepareComposerOverlayTrigger = useCallback(() => {
      if (!isMobileLayout) return;
      primeKeyboardCloseForOverlayOpen();
    }, [isMobileLayout]);
    const openComposerOverlay = useCallback(
      async (openOverlay: () => void) => {
        const openSequence = ++overlayOpenSequenceRef.current;
        if (isMobileLayout) {
          await closeKeyboardBeforeOpeningOverlay();
        }

        if (overlayOpenSequenceRef.current !== openSequence) return;
        openOverlay();
      },
      [isMobileLayout]
    );
    const openEmojiBoard = useCallback(
      async (tab: EmojiBoardTab) => {
        await openComposerOverlay(() => {
          const rect = emojiBtnRef.current?.getBoundingClientRect() ?? null;
          setEmojiBoardAnchorRect(rect);
          setEmojiBoardTab(tab);
        });
      },
      [openComposerOverlay]
    );
    // Keep the emoji/sticker picker position in sync with viewport changes (e.g.
    // the iOS virtual keyboard appearing/disappearing while the board is open).
    useEffect(() => {
      if (emojiBoardTab === undefined) return undefined;
      const updateRect = () => {
        setEmojiBoardAnchorRect(emojiBtnRef.current?.getBoundingClientRect() ?? null);
      };
      const vp = window.visualViewport;
      if (vp) {
        vp.addEventListener('resize', updateRect);
        vp.addEventListener('scroll', updateRect);
        return () => {
          vp.removeEventListener('resize', updateRect);
          vp.removeEventListener('scroll', updateRect);
        };
      }
      return undefined;
    }, [emojiBoardTab]);
    const closeEmojiBoard = useCallback(() => {
      setEmojiBoardTab((t) => {
        if (t) {
          if (!mobileOrTablet()) ReactEditor.focus(editor);
          return undefined;
        }
        return t;
      });
    }, [editor]);
    const micBtnRef = useRef<HTMLButtonElement>(null);
    const emojiPickerRef = useRef<HTMLDivElement>(null);
    const prevEmojiBoardTabRef = useRef<EmojiBoardTab | undefined>(emojiBoardTab);
    // Bumped whenever the sheet genuinely opens from closed, or is kept open
    // (tab switch, reopen) while a close animation is still in flight. Lets
    // a pending close's `.finally()` (below) tell whether it's still closing
    // the same "session" it started against, or whether the sheet was
    // reopened/re-engaged while it was playing -- in which case it must not
    // go on to hide the sheet the user is now interacting with.
    const emojiBoardOpenGenerationRef = useRef(0);
    // The generation a close animation is currently in flight for, or null.
    // Scoped to the generation (rather than a plain boolean) so a dismiss
    // that arrives after a reopen isn't dropped as "already closing" -- the
    // in-flight animation belongs to a stale generation and no longer counts.
    const closingGenerationRef = useRef<number | null>(null);
    const closeAnimationRef = useRef<Animation | null>(null);
    // Drives pointer-events on the mobile sheet portal (below) so a rapid
    // double-tap during the ~280ms close fade can't land a second selection
    // on content that's already being dismissed.
    const [isClosingMobileEmojiBoard, setIsClosingMobileEmojiBoard] = useState(false);

    // Slide-in animation for the mobile emoji/GIF/sticker picker — same motion
    // as the long-press context menu. Only plays when the picker opens
    // (undefined → tab), not on tab switches. The close half of this motion
    // lives in closeMobileEmojiBoard below, sharing the same keyframes/timing
    // so open and close mirror each other instead of close being an instant cut.
    useLayoutEffect(() => {
      const wasOpen = prevEmojiBoardTabRef.current !== undefined;
      prevEmojiBoardTabRef.current = emojiBoardTab;

      if (emojiBoardTab !== undefined && closingGenerationRef.current !== null) {
        // The sheet is being kept open/re-engaged (reopened, or switched tabs
        // via the keyboard shortcut or the picker's own tab bar) while a
        // previous close animation is still playing. `emojiBoardTab` never
        // passed through `undefined` here, so the `!wasOpen` check below
        // wouldn't catch this -- cancel the stale close immediately instead
        // of leaving its fill-forwards effect (opacity/translateY) applied
        // until that animation finishes on its own.
        closeAnimationRef.current?.cancel();
        closeAnimationRef.current = null;
        closingGenerationRef.current = null;
        setIsClosingMobileEmojiBoard(false);
        emojiBoardOpenGenerationRef.current += 1;
      }
      if (emojiBoardTab !== undefined && !wasOpen) {
        emojiBoardOpenGenerationRef.current += 1;
      }

      const el = emojiPickerRef.current;
      if (!el || emojiBoardTab === undefined || wasOpen) return;
      // Skip animation if either the OS or the app's own Reduced Motion
      // setting is on. The swipe gesture itself is unaffected by this guard.
      if (prefersReducedMotion()) return;
      // On phone layouts the element is centered with translateX(-50%); include
      // it in every keyframe so the horizontal centering is preserved throughout.
      const xCenter = isPhoneLayoutDevice() ? ' translateX(-50%)' : '';
      const anim = el.animate(getMobileSheetOpenKeyframes(xCenter), {
        duration: MOBILE_SHEET_ANIMATION_DURATION_MS,
        easing: MOBILE_SHEET_ANIMATION_EASING,
        fill: 'forwards',
      });
      return () => anim.cancel();
    }, [emojiBoardTab]);

    // Mirrors the open animation above so dismissing the mobile sheet (tap
    // outside, escape, selecting an emoji, or dragging past the dismiss
    // threshold) slides/fades it fully off-screen instead of instantly
    // cutting to hidden. Used only for the mobile sheet's requestClose --
    // the desktop PopOut keeps the plain, unanimated closeEmojiBoard.
    const closeMobileEmojiBoard = useCallback(() => {
      const generationAtClose = emojiBoardOpenGenerationRef.current;
      if (closingGenerationRef.current === generationAtClose) return;

      const el = emojiPickerRef.current;
      if (!el || emojiBoardTab === undefined || prefersReducedMotion()) {
        closeEmojiBoard();
        return;
      }

      closingGenerationRef.current = generationAtClose;
      setIsClosingMobileEmojiBoard(true);
      const xCenter = isPhoneLayoutDevice() ? ' translateX(-50%)' : '';
      const anim = el.animate(getMobileSheetCloseKeyframes(xCenter), {
        duration: MOBILE_SHEET_ANIMATION_DURATION_MS,
        easing: MOBILE_SHEET_ANIMATION_EASING,
        fill: 'forwards',
      });
      closeAnimationRef.current = anim;
      anim.finished
        .catch(() => undefined)
        .finally(() => {
          // Always clear the filled effect once the animation is done playing
          // -- "fill: forwards" otherwise leaves its final opacity/transform
          // applied indefinitely, which could leave a later reduced-motion
          // reopen looking invisible since nothing would create a new
          // animation to override it.
          anim.cancel();
          if (closeAnimationRef.current === anim) {
            closeAnimationRef.current = null;
          }
          if (closingGenerationRef.current === generationAtClose) {
            closingGenerationRef.current = null;
          }
          setIsClosingMobileEmojiBoard(false);
          // If the sheet was reopened (or kept open via a tab switch) while
          // this animation was playing, that bumped the generation counter --
          // don't let this stale close request hide the sheet the user just
          // interacted with.
          if (emojiBoardOpenGenerationRef.current !== generationAtClose) return;
          closeEmojiBoard();
        });
    }, [closeEmojiBoard, emojiBoardTab]);

    // Preserve stable list keys across metadata/description replacements without
    // storing UI-only IDs in the upload draft state.
    const uploadItemKeysRef = useRef(new WeakMap<TUploadContent, string>());
    const roomToParents = useAtomValue(roomToParentsAtom);
    /**
     * Nickname someone set for another user
     * this nickname should be treated as private
     */
    const nicknames = useAtomValue(nicknamesAtom);

    const powerLevels = usePowerLevelsContext();
    const creators = useRoomCreators(room);
    const permissions = useRoomPermissions(creators, powerLevels);
    const canSendReaction = permissions.event(EventType.Reaction, mx.getSafeUserId());

    const [msgDraft, setMsgDraft] = useAtom(roomIdToMsgDraftAtomFamily(draftKey));
    const [replyDraft, setReplyDraft] = useAtom(roomIdToReplyDraftAtomFamily(draftKey));
    const [editDraft, setEditDraft] = useAtom(roomIdToEditDraftAtomFamily(draftKey));
    const latestReplyDraftRef = useRef(replyDraft);
    const restoredSilentReplyRef = useRef<boolean | null>(null);
    const isMountedRef = useRef(true);
    const submitInFlightRef = useRef(false);
    const uploadSendInFlightRef = useRef(false);

    const [uploadBoard, setUploadBoard] = useState(true);
    const [selectedFiles, setSelectedFiles] = useAtom(roomIdToUploadItemsAtomFamily(draftKey));
    const uploadFamilyObserverAtom = useMemo(
      () =>
        createUploadFamilyObserverAtom(
          roomUploadAtomFamily,
          selectedFiles.map((f) => f.file)
        ),
      [selectedFiles]
    );
    const uploadStates = useAtomValue(uploadFamilyObserverAtom);
    const uploadBoardHandlers = useRef<UploadBoardImperativeHandlers>();
    const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const suppressNextSendClickSequenceRef = useRef<number | null>(null);
    const longPressTriggeredRef = useRef(false);
    const longPressPointerId = useRef<number | null>(null);
    const longPressPressSequenceRef = useRef<number | null>(null);
    const sendClickSequenceRef = useRef(0);
    const longPressStartPoint = useRef<{ x: number; y: number } | null>(null);

    const imagePackRooms: Room[] = useImagePackRooms(roomId, roomToParents);

    const [showAudioRecorder, setShowAudioRecorder] = useState(false);
    const audioRecorderRef = useRef<AudioMessageRecorderHandle>(null);
    const micHoldStartRef = useRef(0);
    const HOLD_THRESHOLD_MS = 400;
    const [autocompleteQuery, setAutocompleteQuery] =
      useState<AutocompleteQuery<AutocompletePrefix>>();
    const [isQuickTextReact, setQuickTextReact] = useState(false);

    const replyDraftBase = useMemo(
      () =>
        threadRootId
          ? {
              userId: mx.getUserId() ?? '',
              eventId: threadRootId,
              body: '',
              relation: {
                rel_type: RelationType.Thread,
                event_id: threadRootId,
              },
            }
          : undefined,
      [mx, threadRootId]
    );

    const sendTypingStatus = useTypingStatusUpdater(mx, roomId, {
      disabled: !!threadRootId,
    });

    const [inputKey, setInputKey] = useState(0);
    const getUploadItemKey = useCallback((fileItem: TUploadItem): string => {
      const existingKey = uploadItemKeysRef.current.get(fileItem.originalFile);
      if (existingKey) return existingKey;

      const nextKey = createUploadItemKey();
      uploadItemKeysRef.current.set(fileItem.originalFile, nextKey);
      return nextKey;
    }, []);

    const handleFiles = useCallback(
      async (files: File[], audioMeta?: { waveform: number[]; audioDuration: number }) => {
        setUploadBoard(true);
        const safeFiles = files.map(safeFile);
        const fileItems: TUploadItem[] = [];

        if (room.hasEncryptionStateEvent()) {
          const encryptFiles = fulfilledPromiseSettledResult(
            await Promise.allSettled(safeFiles.map((f) => encryptFile(f)))
          );
          encryptFiles.forEach((ef) =>
            fileItems.push({
              ...ef,
              metadata: {
                markedAsSpoiler: false,
                waveform: audioMeta?.waveform,
                audioDuration: audioMeta?.audioDuration,
              },
            })
          );
          // If all files failed to encrypt (e.g. iCloud file not yet downloaded
          // on iOS), surface an error rather than silently producing no items.
          if (fileItems.length === 0 && safeFiles.length > 0) {
            setSendError('Could not read the file. Try downloading it first, then try again.');
            return;
          }
        } else {
          safeFiles.forEach((f) =>
            fileItems.push({
              file: f,
              originalFile: f,
              encInfo: undefined,
              metadata: {
                markedAsSpoiler: false,
                waveform: audioMeta?.waveform,
                audioDuration: audioMeta?.audioDuration,
              },
            })
          );
        }
        setSelectedFiles({
          type: 'PUT',
          item: fileItems,
        });
      },
      [setSelectedFiles, room]
    );
    const pickFile = useFilePicker(handleFiles, true);
    const handlePaste = useFilePasteHandler(handleFiles);
    const dropZoneVisible = useFileDropZone(fileDropContainerRef, handleFiles);
    const [hideStickerBtn, setHideStickerBtn] = useState(document.body.clientWidth < 500);

    const isComposing = useComposingCheck();

    const queryClient = useQueryClient();
    const delayedEventsSupported = useAtomValue(delayedEventsSupportedAtom);
    const [scheduledTime, setScheduledTime] = useAtom(roomIdToScheduledTimeAtomFamily(roomId));
    const [editingScheduledDelayId, setEditingScheduledDelayId] = useAtom(
      roomIdToEditingScheduledDelayIdAtomFamily(roomId)
    );
    const [AddMenuAnchor, setAddMenuAnchor] = useState<RectCords>();
    const [showLocationPicker, setShowLocationPicker] = useState(false);
    const [scheduleMenuAnchor, setScheduleMenuAnchor] = useState<RectCords>();
    const [showSchedulePicker, setShowSchedulePicker] = useState(false);
    const [pollCreatorOpen, setPollCreatorOpen] = useState(false);
    const [silentReply, setSilentReply] = useState(!mentionInReplies);
    const [hour24Clock] = useSetting(settingsAtom, 'hour24Clock');
    const setServerMaxDelayMs = useSetAtom(serverMaxDelayMsAtom);
    const [sendError, setSendError] = useState<string | undefined>();
    const isEncrypted = room.hasEncryptionStateEvent();

    const { triggerPreLift } = useKeyboardHeight();
    const handleMobilePreLift = useCallback(
      (evt: React.SyntheticEvent) => {
        if (!isMobileLayout) return;
        // Skip pre-lift when the user taps a button or interactive control.
        // Pre-lift is only meaningful when focus is moving to an editable element
        // (opening the keyboard). Triggering it on button taps causes a React
        // state update between pointerdown and click, which can shift the layout
        // enough that iOS drops the click entirely — requiring a second tap.
        const target = evt.target as Element | null;
        if (target?.closest?.('button, [role="button"], input, select')) return;
        triggerPreLift();
      },
      [isMobileLayout, triggerPreLift]
    );
    // Always active on mobile: iOS can apply window.scrollY even with overflow:hidden
    // on body (scroll-prediction bug). The lock snaps scrollY back to 0 immediately
    // on any scroll event, preventing the "header scrolls up then snaps" jank.
    // useKeyboardHeight now manages --sable-visible-height synchronously in its own
    // event handler, so no useEffect here is needed for CSS variable management.
    useScrollLock(isMobileLayout);

    const closeSchedulePicker = useCallback(() => {
      setShowSchedulePicker(false);
      setScheduleMenuAnchor(undefined);
      suppressNextSendClickSequenceRef.current = null;
    }, []);

    const clearLongPressTimer = useCallback(() => {
      if (longPressTimer.current !== null) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }
      longPressPointerId.current = null;
      longPressPressSequenceRef.current = null;
      longPressStartPoint.current = null;
    }, []);

    const resetLongPressState = useCallback(() => {
      clearLongPressTimer();
      longPressTriggeredRef.current = false;
    }, [clearLongPressTimer]);

    const openSchedulePicker = useCallback(async () => {
      await openComposerOverlay(() => {
        setSendError(undefined);
        setScheduleMenuAnchor(undefined);
        setShowSchedulePicker(true);
      });
    }, [openComposerOverlay]);
    const openAddMenu = useCallback(
      async (anchorElement: HTMLElement) => {
        await openComposerOverlay(() => {
          setAddMenuAnchor(anchorElement.getBoundingClientRect());
        });
      },
      [openComposerOverlay]
    );
    const openPollCreator = useCallback(async () => {
      await openComposerOverlay(() => {
        setPollCreatorOpen(true);
      });
    }, [openComposerOverlay]);
    const openLocationPicker = useCallback(async () => {
      await openComposerOverlay(() => {
        setShowLocationPicker(true);
      });
    }, [openComposerOverlay]);

    useEffect(() => resetLongPressState, [resetLongPressState]);

    useEffect(() => {
      const handleVisibilityChange = () => {
        if (document.visibilityState !== 'visible') {
          suppressNextSendClickSequenceRef.current = null;
          resetLongPressState();
        }
      };

      document.addEventListener('visibilitychange', handleVisibilityChange);
      return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, [resetLongPressState]);

    useElementSizeObserver(
      useCallback(() => fileDropContainerRef.current, [fileDropContainerRef]),
      useCallback((width) => setHideStickerBtn(width < 500), [])
    );

    const replyEvent = replyDraft ? room.findEventById(replyDraft.eventId) : undefined;

    // Seed the reply draft with the thread relation whenever we're in thread
    // mode (e.g. on first render or when the thread root changes). We use the
    // current user's ID as userId so that the mention logic skips it.
    useEffect(() => {
      if (!threadRootId) return;
      setReplyDraft((prev) => {
        if (
          prev?.relation?.rel_type === RelationType.Thread &&
          prev.relation.event_id === threadRootId
        )
          return prev;
        return {
          userId: mx.getUserId() ?? '',
          eventId: threadRootId,
          body: '',
          relation: { rel_type: RelationType.Thread, event_id: threadRootId },
        };
      });
    }, [threadRootId, setReplyDraft, mx]);

    useEffect(() => {
      Transforms.insertFragment(editor, msgDraft);
    }, [editor, msgDraft]);

    useEffect(
      () => () => {
        if (isEmptyEditor(editor)) {
          setMsgDraft([]);
        } else {
          const parsedDraft = structuredClone(editor.children);
          setMsgDraft(parsedDraft);
        }
        resetEditor(editor);
        resetEditorHistory(editor);
      },
      [draftKey, editor, setMsgDraft]
    );

    useEffect(() => {
      if (replyDraft !== undefined) {
        if (restoredSilentReplyRef.current !== null) {
          setSilentReply(restoredSilentReplyRef.current);
          restoredSilentReplyRef.current = null;
        } else {
          setSilentReply(replyDraft.userId === mx.getUserId() || !mentionInReplies);
        }
      }
    }, [mentionInReplies, mx, replyDraft]);

    useEffect(() => {
      latestReplyDraftRef.current = replyDraft;
    }, [replyDraft]);

    useEffect(
      () => () => {
        isMountedRef.current = false;
      },
      []
    );

    const prevReplyEventId = useRef(replyDraft?.eventId);
    useEffect(() => {
      if (replyDraft?.eventId !== prevReplyEventId.current) {
        prevReplyEventId.current = replyDraft?.eventId;

        if (replyDraft?.eventId) {
          requestAnimationFrame(() => {
            try {
              ReactEditor.focus(editor);
              moveCursor(editor);
            } catch {
              // Ignore focus errors
            }
          });
        }
      }
    }, [replyDraft?.eventId, editor]);

    const prevEditEventId = useRef(editDraft?.eventId);
    useEffect(() => {
      if (editDraft?.eventId === prevEditEventId.current) return;
      prevEditEventId.current = editDraft?.eventId;

      if (!editDraft) {
        // Edit was cancelled — editor was already reset by the cancel handler
        return;
      }

      const editEvent = room.findEventById(editDraft.eventId);
      if (!editEvent) return;

      const evtId = editEvent.getId();
      const evtTimeline = evtId ? room.getTimelineForEvent(evtId) : undefined;
      const editedVersion =
        evtTimeline && evtId
          ? getEditedEvent(evtId, editEvent, evtTimeline.getTimelineSet())
          : undefined;
      const content = editedVersion?.getContent()['m.new_content'] ?? editEvent.getContent();
      const body = typeof content.body === 'string' ? content.body : '';
      const formattedBody =
        typeof content.formatted_body === 'string' ? content.formatted_body : undefined;

      const initialValue = plainToEditorInput(formattedBody ? htmlToMarkdown(formattedBody) : body);

      resetEditor(editor);
      resetEditorHistory(editor);
      Transforms.insertFragment(editor, initialValue);
      requestAnimationFrame(() => {
        try {
          ReactEditor.focus(editor);
          moveCursor(editor);
        } catch {
          // ignore focus errors
        }
      });
    }, [editDraft, editor, room]);

    const handleFileMetadata = useCallback(
      (fileItem: TUploadItem, metadata: TUploadMetadata) => {
        setSelectedFiles({
          type: 'REPLACE',
          item: fileItem,
          replacement: { ...fileItem, metadata },
        });
      },
      [setSelectedFiles]
    );
    const setDesc = useCallback(
      (fileItem: TUploadItem, body: string, formatted_body: string) => {
        setSelectedFiles({
          type: 'REPLACE',
          item: fileItem,
          replacement: { ...fileItem, body, formatted_body },
        });
      },
      [setSelectedFiles]
    );
    const handleRemoveUpload = useCallback(
      (upload: TUploadContent | TUploadContent[]) => {
        const uploads = Array.isArray(upload) ? upload : [upload];
        setSelectedFiles({
          type: 'DELETE',
          item: selectedFiles.filter((f) => uploads.find((u) => u === f.file)),
        });
        uploads.forEach((u) => roomUploadAtomFamily.remove(u));
      },
      [setSelectedFiles, selectedFiles]
    );

    const handleAudioRecordingComplete = useCallback(
      (payload: AudioRecordingCompletePayload) => {
        const extension = getSupportedAudioExtension(payload.audioCodec);
        const file = new File(
          [payload.audioBlob],
          `sable-audio-message-${Date.now()}.${extension}`,
          {
            type: payload.audioCodec,
          }
        );
        handleFiles([file], {
          waveform: payload.waveform,
          audioDuration: payload.audioLength,
        });
        setShowAudioRecorder(false);
      },
      [handleFiles]
    );

    const audioRecorder = showAudioRecorder ? (
      <AudioMessageRecorder
        ref={audioRecorderRef}
        onRequestClose={() => setShowAudioRecorder(false)}
        onRecordingComplete={handleAudioRecordingComplete}
        onAudioLengthUpdate={() => {}}
        onWaveformUpdate={() => {}}
      />
    ) : undefined;

    const handleCancelUpload = (uploads: Upload[]) => {
      uploads.forEach((upload) => {
        if (upload.status === UploadStatus.Loading) {
          mx.cancelUpload(upload.promise);
        }
      });
      handleRemoveUpload(uploads.map((upload) => upload.file));
    };

    const clearSentMessageContext = (
      sentReplyDraftSnapshot?: string,
      sentImagePacksSnapshot?: string
    ) => {
      if (
        sentImagePacksSnapshot === undefined ||
        JSON.stringify(imagePacksUsedRef.current.toJSON()) === sentImagePacksSnapshot
      ) {
        imagePacksUsedRef.current.clear();
      }

      if (
        sentReplyDraftSnapshot !== undefined &&
        serializeReplyDraft(latestReplyDraftRef.current) === sentReplyDraftSnapshot
      ) {
        setReplyDraft(replyDraftBase);
      }
    };

    const restoreFailedImmediateSendContext = (
      sentMsgDraftSnapshot: typeof editor.children,
      sentReplyDraftSnapshot: string,
      sentImagePacksSnapshot: string,
      sentSilentReplySnapshot: boolean
    ) => {
      if (!isMountedRef.current) return;

      if (isEmptyEditor(editor)) {
        const restoredMsgDraft = structuredClone(sentMsgDraftSnapshot);
        setMsgDraft(restoredMsgDraft);
        requestAnimationFrame(() => {
          try {
            ReactEditor.focus(editor);
            moveCursor(editor);
          } catch {
            // Ignore focus errors
          }
        });
      }

      const currentReplyDraftSnapshot = serializeReplyDraft(latestReplyDraftRef.current);
      if (
        currentReplyDraftSnapshot === serializeReplyDraft(replyDraftBase) ||
        currentReplyDraftSnapshot === sentReplyDraftSnapshot
      ) {
        const restoredReplyDraft = JSON.parse(sentReplyDraftSnapshot) as IReplyDraft | null;
        restoredSilentReplyRef.current = restoredReplyDraft ? sentSilentReplySnapshot : null;
        setReplyDraft(restoredReplyDraft ?? replyDraftBase);
      }

      if (imagePacksUsedRef.current.size === 0) {
        const restoredImagePacks = JSON.parse(sentImagePacksSnapshot) as Record<
          string,
          MSC4459ImagePackReference
        >;
        Object.entries(restoredImagePacks).forEach(([key, value]) => {
          imagePacksUsedRef.current.set(key, value);
        });
      }

      sendTypingStatus(false);
    };

    const resetInput = (
      sentReplyDraftSnapshot?: string,
      sentImagePacksSnapshot?: string,
      options?: { refocus?: boolean },
      sentMsgDraftSnapshot?: typeof editor.children
    ) => {
      const shouldClearEditor =
        sentMsgDraftSnapshot === undefined ||
        JSON.stringify(editor.children) === JSON.stringify(sentMsgDraftSnapshot);

      if (shouldClearEditor) {
        setMsgDraft([]);
        resetEditor(editor);
        resetEditorHistory(editor);
        setInputKey((prev) => prev + 1);
      }

      clearSentMessageContext(sentReplyDraftSnapshot, sentImagePacksSnapshot);
      sendTypingStatus(false);

      if (options?.refocus) {
        requestAnimationFrame(() => {
          try {
            ReactEditor.focus(editor);
            moveCursor(editor);
          } catch {
            // Ignore focus errors
          }
        });
      }
    };

    const focusComposer = () => {
      requestAnimationFrame(() => {
        try {
          ReactEditor.focus(editor);
          moveCursor(editor);
        } catch {
          // Ignore focus errors
        }
      });
    };

    const getNicknameReplacementMap = () => {
      const nicknameReplacement = new Map<RegExp, string>();

      if (replyEvent) {
        const senderId = replyEvent.getSender();
        if (senderId) {
          const nick = nicknames[senderId];
          if (typeof nick === 'string' && nick.length > 0) {
            nicknameReplacement.set(
              new RegExp(`@?${nick}`, 'g'),
              room.getMember(senderId)?.rawDisplayName ?? senderId
            );
          }
        }
      }

      const mentions = getMentions(mx, roomId, editor);
      if (mentions?.users) {
        mentions.users.forEach((id) => {
          const nick = nicknames[id];
          if (typeof nick === 'string' && nick.length > 0) {
            nicknameReplacement.set(
              new RegExp(`@?${nick}`, 'g'),
              room.getMember(id)?.rawDisplayName ?? id
            );
          }
        });
      }

      return nicknameReplacement;
    };

    const getSharedComposerCaption = (): ComposerAttachmentCaption | undefined => {
      const nicknameReplacement = getNicknameReplacementMap();
      const plainText = toPlainText(editor.children, true, nicknameReplacement).trim();
      if (plainText.length === 0) return undefined;

      const formattedCaption = trimCustomHtml(
        toMatrixCustomHTML(editor.children, {
          stripNickname: true,
          nickNameReplacement: nicknameReplacement,
          room,
        })
      );

      return {
        body: plainText,
        formattedBody: customHtmlEqualsPlainText(formattedCaption, plainText)
          ? undefined
          : formattedCaption,
      };
    };

    const handleSendUpload = async (
      uploads: UploadSuccess[],
      options?: {
        sharedCaption?: ComposerAttachmentCaption;
        perMessageProfile?: Awaited<ReturnType<typeof getCurrentlyUsedPerMessageProfileForRoom>>;
      }
    ) => {
      if (uploadSendInFlightRef.current) return;
      uploadSendInFlightRef.current = true;

      try {
        const sharedCaption = options?.sharedCaption ?? getSharedComposerCaption();
        const sentMsgDraftSnapshot = structuredClone(editor.children);
        const sentReplyDraftSnapshot = serializeReplyDraft(replyDraft);
        const clearSentUploadReplyDraft = () => {
          if (serializeReplyDraft(latestReplyDraftRef.current) === sentReplyDraftSnapshot) {
            setReplyDraft(replyDraftBase);
          }
        };

        const matchingFiles = uploads
          .map((upload) => selectedFiles.find((f) => f.file === upload.file))
          .filter((fileItem): fileItem is TUploadItem => !!fileItem);
        const sendPlan = createAttachmentSendPlan(matchingFiles, sharedCaption);
        const plannedFiles = applyAttachmentSendPlan(matchingFiles, sharedCaption);
        const sharedCaptionApplied = sendPlan.some((caption) => !!caption);
        const hasDeferredComposerText = Boolean(sharedCaption && !sharedCaptionApplied);

        const preparedUploadsPromises = uploads.map(async (upload) => {
          const fileItem = plannedFiles.find((f) => f.file === upload.file);
          if (!fileItem) throw new Error('Broken upload');

          if (fileItem.file.type.startsWith('image')) {
            return { upload, content: await getImageMsgContent(mx, fileItem, upload.mxc) };
          }
          if (fileItem.file.type.startsWith('video')) {
            return { upload, content: await getVideoMsgContent(mx, fileItem, upload.mxc) };
          }
          if (fileItem.file.type.startsWith('audio')) {
            return { upload, content: getAudioMsgContent(fileItem, upload.mxc) };
          }
          return { upload, content: getFileMsgContent(fileItem, upload.mxc) };
        });
        const preparedUploads = fulfilledPromiseSettledResult(
          await Promise.allSettled(preparedUploadsPromises)
        );
        const contents = preparedUploads.map(({ content }) => content);

        /**
         * the currently with the room associated per-message profile, if any, so that it can be included in the message content when sending.
         * This allows the server to apply the correct profile-based transformations (e.g. font size adjustments) when processing the message,
         * and also allows clients to display an accurate preview of how the message will look with the profile applied while it's being composed.
         */
        const perMessageProfile =
          options?.perMessageProfile ??
          (await getCurrentlyUsedPerMessageProfileForRoom(mx, roomId));

        if (perMessageProfile) {
          contents.forEach((c) => {
            // We intentionally mutate the objects here to avoid unnecessary copying
            // mutating should be unproblematic here, since contents isn't a react component,
            // or used for rendering
            c[prefix.MATRIX_UNSTABLE_PER_MESSAGE_PROFILE_PROPERTY_NAME] =
              convertPerMessageProfileToBeeperFormat(perMessageProfile, false);
          });
        }

        if (contents.length > 0) {
          const replyContent = getReplyContent(replyDraft, room);
          if (Object.keys(replyContent).length > 0) {
            contents[0]!['m.relates_to'] = replyContent;
          }

          const mentionData = sharedCaptionApplied
            ? getMentions(mx, roomId, editor)
            : { room: false, users: new Set<string>() };
          const replyMentions = getReplyMentionData(
            hasDeferredComposerText ? undefined : replyDraft,
            replyEvent,
            silentReply,
            sharedCaptionApplied ? mentionData.room : false
          );
          if (replyMentions?.user_ids) {
            replyMentions.user_ids.forEach((id) => mentionData.users.add(id));
          }

          if (mentionData.users.size > 0 || mentionData.room || replyMentions?.room === true) {
            contents[0]!['m.mentions'] = getMentionContent(
              Array.from(mentionData.users),
              mentionData.room || replyMentions?.room === true
            );
          }

          if (sharedCaptionApplied) {
            contents[0]![prefix.MATRIX_UNSTABLE_IMAGE_SOURCE_PACK_PROPERTY_NAME] =
              imagePacksUsedRef.current.toJSON();

            const links = getLinks(editor.children);
            contents[0]![prefix.MATRIX_UNSTABLE_EMBEDDED_LINK_PREVIEW_PROPERTY_NAME] = [];
            links?.forEach((link) =>
              contents[0]![prefix.MATRIX_UNSTABLE_EMBEDDED_LINK_PREVIEW_PROPERTY_NAME].push({
                matched_url: link,
              })
            );
          }
        }

        const invalidate = () =>
          queryClient.invalidateQueries({ queryKey: ['delayedEvents', roomId] });
        const sendPreparedUploadsSequentially = async (
          sendContent: (preparedUpload: {
            upload: UploadSuccess;
            content: IContent;
          }) => Promise<void>
        ) => {
          await preparedUploads.reduce(
            (promise, preparedUpload) => promise.then(() => sendContent(preparedUpload)),
            Promise.resolve()
          );
        };

        const sentImagePacksSnapshot = JSON.stringify(imagePacksUsedRef.current.toJSON());
        const successfulUploads: UploadSuccess[] = [];
        const clearConsumedUploadSendContext = (contextOptions?: { refocus?: boolean }) => {
          if (sharedCaptionApplied) {
            resetInput(
              sentReplyDraftSnapshot,
              sentImagePacksSnapshot,
              contextOptions,
              sentMsgDraftSnapshot
            );
            return;
          }

          if (hasDeferredComposerText) {
            if (contextOptions?.refocus) focusComposer();
            return;
          }

          clearSentUploadReplyDraft();
          clearSentMessageContext(sentReplyDraftSnapshot, sentImagePacksSnapshot);
          sendTypingStatus(false);
          if (contextOptions?.refocus) focusComposer();
        };
        const handlePartialUploadBatchSuccess = () => {
          if (successfulUploads.length === 0) return;

          handleCancelUpload(successfulUploads);
          clearConsumedUploadSendContext();
        };
        const handleUploadSendFailure = () => {
          if (successfulUploads.length > 0) {
            handlePartialUploadBatchSuccess();
            return;
          }

          handleCancelUpload(uploads);
        };

        if (scheduledTime) {
          try {
            const delayMs = computeDelayMs(scheduledTime);
            if (editingScheduledDelayId) {
              await cancelDelayedEvent(mx, editingScheduledDelayId);
            }

            await sendPreparedUploadsSequentially(async ({ upload, content }) => {
              if (isEncrypted) {
                await sendDelayedMessageE2EE(mx, roomId, room, content, delayMs);
              } else {
                await sendDelayedMessage(mx, roomId, content, delayMs);
              }
              successfulUploads.push(upload);
            });

            invalidate();
            handleCancelUpload(uploads);
            clearConsumedUploadSendContext({ refocus: true });
            setEditingScheduledDelayId(null);
            if (!hasDeferredComposerText) {
              setScheduledTime(null);
            }
          } catch (error) {
            invalidate();
            handleUploadSendFailure();
            debugLog.error('message', 'Failed to schedule uploaded file message', {
              roomId,
              error: error instanceof Error ? error.message : String(error),
            });
            log.error('failed to schedule uploaded message', { roomId }, error);
            throw error;
          }
        } else {
          if (editingScheduledDelayId) {
            try {
              await cancelDelayedEvent(mx, editingScheduledDelayId);
              invalidate();
              setEditingScheduledDelayId(null);
            } catch {
              debugLog.error(
                'message',
                'Failed to cancel scheduled event before immediate file send',
                { roomId }
              );
            }
          }

          try {
            await sendPreparedUploadsSequentially(async ({ upload, content }) => {
              const sendStartTime = Date.now();
              const span = Sentry.startInactiveSpan({
                name: 'message.send',
                op: 'message',
                attributes: {
                  'message.room_id': roomId,
                  'message.type': content.msgtype ?? 'm.text',
                  'message.is_encrypted': isEncrypted,
                  'message.body_length': content.body?.length ?? 0,
                  'message.is_thread': !!threadRootId,
                },
              });

              try {
                const res = await mx.sendMessage(
                  roomId,
                  threadRootId ?? null,
                  content as RoomMessageEventContent
                );
                debugLog.info('message', 'Uploaded file message sent', {
                  roomId,
                  eventId: res.event_id,
                  msgtype: content.msgtype,
                });
                successfulUploads.push(upload);
                span.setAttribute('message.event_id', res.event_id);
                span.setAttribute('message.send_duration_ms', Date.now() - sendStartTime);
              } catch (error: unknown) {
                debugLog.error('message', 'Failed to send uploaded file message', {
                  roomId,
                  error: error instanceof Error ? error.message : String(error),
                });
                log.error('failed to send uploaded message', { roomId }, error);
                span.setAttribute(
                  'message.error',
                  error instanceof Error ? error.message : String(error)
                );
                throw error;
              } finally {
                span.end();
              }
            });
          } catch (error) {
            handleUploadSendFailure();
            throw error;
          }

          handleCancelUpload(uploads);
          clearConsumedUploadSendContext({ refocus: true });
        }
      } finally {
        uploadSendInFlightRef.current = false;
      }
    };

    const handleCloseAutocomplete = useCallback(() => {
      setAutocompleteQuery(undefined);
      ReactEditor.focus(editor);
    }, [editor]);

    const handleQuickReact = useCallback(
      (key: string, shortcode?: string) => {
        if (key.length > 0) {
          const lastMessage = room
            .getLiveTimeline()
            .getEvents()
            .findLast((event) =>
              (
                [
                  EventType.RoomMessage,
                  EventType.RoomMessageEncrypted,
                  EventType.Sticker,
                ] as string[]
              ).includes(event.getType())
            );
          const lastMessageId = lastMessage?.getId();

          if (lastMessageId) {
            toggleReaction(mx, room, lastMessageId, key, shortcode);
          }
        }

        resetEditor(editor);
        resetEditorHistory(editor);
        sendTypingStatus(false);
        handleCloseAutocomplete();
      },
      [editor, handleCloseAutocomplete, mx, room, sendTypingStatus]
    );

    const submit = async () => {
      if (submitInFlightRef.current) return;
      submitInFlightRef.current = true;

      try {
        const commandName = getBeginCommand(editor);
        /**
         * a map of regex patterns to replace nicknames with,
         * used when stripNickname is true in toMatrixCustomHTML
         * during HTML generation for the message content.
         * This is necessary because the HTML generation needs to know
         * which nicknames to strip in order to generate the correct formatted_body,
         * and the plain text generation needs to replace those same nicknames with
         * the original user IDs so that the message content remains consistent and
         * mentions are correctly processed by the server and clients.
         */
        const nicknameReplacement = getNicknameReplacementMap();
        /**
         * the plain text we will send
         */
        let serializedChildren = editor.children;
        if (commandName) {
          // Strip the empty text node and command node from the beginning of the first paragraph
          const firstPara = serializedChildren[0];
          if (
            firstPara &&
            'type' in firstPara &&
            firstPara.type === BlockType.Paragraph &&
            firstPara.children.length >= 2
          ) {
            serializedChildren = [
              {
                ...firstPara,
                children: firstPara.children.slice(2),
              },
              ...serializedChildren.slice(1),
            ];
          }
        }
        const outgoingTransformContext = {
          isMarkdown: true,
          settingsLinkBaseUrl,
        };

        outgoingMessageTransforms.forEach((transform) => {
          if (!transform.shouldApply(serializedChildren, outgoingTransformContext)) return;
          serializedChildren = transform.apply(serializedChildren, outgoingTransformContext);
        });

        let plainText = toPlainText(serializedChildren, true, nicknameReplacement).trim();

        /**
         * the html we will send
         */
        let customHtml = trimCustomHtml(
          toMatrixCustomHTML(serializedChildren, {
            stripNickname: true,
            nickNameReplacement: nicknameReplacement,
            forEmote: commandName === Command.Me,
            room,
          })
        );

        let msgType = MsgType.Text;

        // quick text react
        if (canSendReaction && plainText.startsWith('+#')) {
          handleQuickReact(plainText.substring(2));
          return;
        }

        // check if its a pk command
        if (pkCompatEnable && PKitCommandMessageHandler.isPKCommand(plainText)) {
          await pluralkitCmdMessageHandler.handleMessage(plainText);
          resetEditor(editor); // clear the editor
          return; // don't do anything besides handling the command
        }

        if (commandName) {
          plainText = trimCommand(commandName, plainText);
          customHtml = trimCommand(commandName, customHtml);
        }
        if (commandName === Command.Me) {
          msgType = MsgType.Emote;
        } else if (commandName === Command.Notice) {
          msgType = MsgType.Notice;
        } else if (commandName === Command.Shrug) {
          plainText = `${SHRUG} ${plainText}`;
          customHtml = `${SHRUG} ${customHtml}`;
        } else if (commandName === Command.TableFlip) {
          plainText = `${TABLEFLIP} ${plainText}`;
          customHtml = `${TABLEFLIP} ${customHtml}`;
        } else if (commandName === Command.UnFlip) {
          plainText = `${UNFLIP} ${plainText}`;
          customHtml = `${UNFLIP} ${customHtml}`;
        } else if (commandName === Command.CreatePoll) {
          prepareComposerOverlayTrigger();
          await openPollCreator();
          resetEditor(editor);
          resetEditorHistory(editor);
          sendTypingStatus(false);
          return;
        } else if (commandName) {
          if ((commandName as Command) === Command.Location && plainText.trim().length === 0) {
            prepareComposerOverlayTrigger();
            await openLocationPicker();
          } else {
            const commandContent = commands[commandName as Command];
            if (commandContent) {
              commandContent.exe(plainText, customHtml);
            }
          }
          resetEditor(editor);
          resetEditorHistory(editor);
          sendTypingStatus(false);

          return;
        }

        if (emojiAutoExpand) {
          const nextPlainText = applyEmojiAutoReplacementAtEnd(plainText);
          if (nextPlainText !== plainText && customHtmlEqualsPlainText(customHtml, plainText)) {
            customHtml = trimCustomHtml(
              toMatrixCustomHTML(plainToEditorInput(nextPlainText), {
                stripNickname: true,
                nickNameReplacement: nicknameReplacement,
                forEmote: commandName === Command.Me,
                room,
              })
            );
            plainText = nextPlainText;
          }
        }

        // Discord-style edit: when an editDraft is active, send an m.replace event
        // instead of a new message and clear the edit state.
        if (editDraft && plainText === '') return;
        if (editDraft) {
          const editEvent = room.findEventById(editDraft.eventId);
          if (editEvent) {
            const oldContent = editEvent.getContent();
            const msgtype = (oldContent.msgtype as string) ?? MsgType.Text;

            const newContent: IContent = { msgtype, body: plainText };
            if (!customHtmlEqualsPlainText(customHtml, plainText)) {
              newContent.format = 'org.matrix.custom.html';
              newContent.formatted_body = customHtml;
            }
            // Preserve media and extension fields from the original event so
            // that image/file/sticker captions retain their attachments, and
            // vendor extensions (spoiler, link previews, per-message profile)
            // are not silently dropped.
            for (const key of [
              'filename',
              'info',
              'file',
              'url',
              'page.codeberg.everypizza.msc4193.spoiler',
              'com.beeper.linkpreviews',
              'com.beeper.per_message_profile',
            ] as const) {
              if (key in oldContent) {
                newContent[key as string] = oldContent[key as string];
              }
            }
            const mentionData = getMentions(mx, roomId, editor);
            newContent['m.mentions'] = getMentionContent(
              Array.from(mentionData.users),
              mentionData.room
            );

            const sendContent: IContent = {
              ...oldContent,
              'm.relates_to': {
                event_id: editDraft.eventId,
                rel_type: RelationType.Replace,
              },
              body: `* ${plainText}`,
              'm.new_content': newContent,
              'm.mentions': newContent['m.mentions'],
            };
            if (newContent.format) {
              sendContent.format = newContent.format;
              sendContent.formatted_body = `* ${newContent.formatted_body as string}`;
            }

            resetEditor(editor);
            resetEditorHistory(editor);
            setInputKey((prev) => prev + 1);
            setEditDraft(undefined);
            sendTypingStatus(false);

            mx.sendMessage(roomId, sendContent as RoomMessageEventContent).catch(
              (error: unknown) => {
                log.error('failed to send edit', { roomId }, error);
              }
            );
          } else {
            // Original event evicted from timeline — cannot send edit.
            // Clear the edit state so the user is not stuck.
            log.error('failed to send edit: original event not found', {
              roomId,
              eventId: editDraft.eventId,
            });
            setEditDraft(undefined);
            resetEditor(editor);
            resetEditorHistory(editor);
            sendTypingStatus(false);
          }
          return;
        }

        // PluralKit-style proxy wrappers (per-message profile proxies) must be stripped
        // *before* building `content`, otherwise we end up sending the wrapper verbatim.
        let proxiedPerMessageProfile:
          | Awaited<ReturnType<(typeof pluralkitProxyMessageHandler)['getPmpBasedOnMessage']>>
          | undefined;
        if (pmpProxyingEnable) {
          proxiedPerMessageProfile =
            await pluralkitProxyMessageHandler.getPmpBasedOnMessage(plainText);
          if (proxiedPerMessageProfile) {
            const stripped = pluralkitProxyMessageHandler.stripProxyFromMessage(plainText);
            if (stripped !== undefined) {
              // Re-run the normal outgoing pipeline on the stripped content so the message
              // goes through the same transforms/parsers as any other message.
              serializedChildren = plainToEditorInput(stripped);

              outgoingMessageTransforms.forEach((transform) => {
                if (!transform.shouldApply(serializedChildren, outgoingTransformContext)) return;
                serializedChildren = transform.apply(serializedChildren, outgoingTransformContext);
              });

              plainText = toPlainText(serializedChildren, true, nicknameReplacement).trim();
              customHtml = trimCustomHtml(
                toMatrixCustomHTML(serializedChildren, {
                  stripNickname: true,
                  nickNameReplacement: nicknameReplacement,
                  forEmote: commandName === Command.Me,
                  room,
                })
              );
            }
          }
        }

        if (selectedFiles.length > 0) {
          const uploadsReady =
            uploadStates.length === selectedFiles.length &&
            uploadStates.every((upload) => upload.status === UploadStatus.Success);

          if (uploadsReady) {
            let attachmentPerMessageProfile = await getCurrentlyUsedPerMessageProfileForRoom(
              mx,
              roomId
            );
            if (pmpProxyingEnable && proxiedPerMessageProfile) {
              attachmentPerMessageProfile = proxiedPerMessageProfile;
            }

            const successfulUploads = uploadStates.filter(
              (upload): upload is UploadSuccess => upload.status === UploadStatus.Success
            );
            await handleSendUpload(successfulUploads, {
              sharedCaption:
                plainText.length > 0
                  ? {
                      body: plainText,
                      formattedBody: customHtmlEqualsPlainText(customHtml, plainText)
                        ? undefined
                        : customHtml,
                    }
                  : undefined,
              perMessageProfile: attachmentPerMessageProfile,
            });
          } else {
            setSendError('Please wait for uploads to finish before sending.');
          }
          return;
        }

        if (plainText === '') return;

        const body = plainText;
        const formattedBody = customHtml;
        const mentionData = getMentions(mx, roomId, editor);

        const content: IContent & Pick<RoomMessageEventContent, 'msgtype' | 'body'> = {
          msgtype: msgType,
          body,
        };

        const replyMentions = getReplyMentionData(
          replyDraft,
          replyEvent,
          silentReply,
          mentionData.room
        );
        if (replyMentions?.user_ids) {
          replyMentions.user_ids.forEach((id) => mentionData.users.add(id));
        }

        content['m.mentions'] = getMentionContent(
          Array.from(mentionData.users),
          mentionData.room || replyMentions?.room === true
        );
        content[prefix.MATRIX_UNSTABLE_IMAGE_SOURCE_PACK_PROPERTY_NAME] =
          imagePacksUsedRef.current.toJSON();

        const links = getLinks(serializedChildren);
        content[prefix.MATRIX_UNSTABLE_EMBEDDED_LINK_PREVIEW_PROPERTY_NAME] = [];
        links?.forEach((link) =>
          content[prefix.MATRIX_UNSTABLE_EMBEDDED_LINK_PREVIEW_PROPERTY_NAME].push({
            matched_url: link,
          })
        );

        if (replyDraft || !customHtmlEqualsPlainText(formattedBody, body)) {
          content.format = 'org.matrix.custom.html';
          content.formatted_body = formattedBody;
        }

        /**
         * the currently with the room associated per-message profile, if any, so that it can be included in the message content when sending.
         * This allows the server to apply the correct profile-based transformations (e.g. font size adjustments) when processing the message,
         * and also allows clients to display an accurate preview of how the message will look with the profile applied while it's being composed.
         */
        let perMessageProfile = await getCurrentlyUsedPerMessageProfileForRoom(mx, roomId);
        if (pmpProxyingEnable) {
          if (proxiedPerMessageProfile) perMessageProfile = proxiedPerMessageProfile;
        }
        if (perMessageProfile) {
          content[prefix.MATRIX_UNSTABLE_PER_MESSAGE_PROFILE_PROPERTY_NAME] =
            convertPerMessageProfileToBeeperFormat(
              perMessageProfile,
              perMessageProfile.name.trim() !== ''
            );

          if (perMessageProfile.name.trim() !== '') {
            // if a per-message profile is used, it must per spec include a fallback
            const pmpPrefix = `${perMessageProfile.name}: `;

            if (!content.body.startsWith(pmpPrefix)) {
              // to prevent double-prefixing when the fallback is already present
              content.body = pmpPrefix + content.body;
            }

            /**
             * html escaped version of the display name
             */
            const escapedName = sanitizeText(perMessageProfile.name);

            const htmlPrefix = `<strong data-mx-profile-fallback>${escapedName}: </strong>`;

            if (content.formatted_body && !content.formatted_body.startsWith(htmlPrefix)) {
              content.formatted_body = htmlPrefix + content.formatted_body;
            } else {
              // we don't have a formatted body, but we need one
              content.format = 'org.matrix.custom.html';
              const escapedBody = sanitizeText(plainText).replaceAll('\n', '<br/>');
              content.formatted_body = `${htmlPrefix}${escapedBody}`;
            }
          }
        }

        if (replyDraft) {
          content['m.relates_to'] = getReplyContent(replyDraft, room);
        }
        const invalidate = () =>
          queryClient.invalidateQueries({
            queryKey: ['delayedEvents', roomId],
          });
        if (scheduledTime) {
          try {
            const delayMs = computeDelayMs(scheduledTime);
            if (editingScheduledDelayId) {
              await cancelDelayedEvent(mx, editingScheduledDelayId);
            }
            if (isEncrypted) {
              await sendDelayedMessageE2EE(mx, roomId, room, content, delayMs);
            } else {
              await sendDelayedMessage(mx, roomId, content as RoomMessageEventContent, delayMs);
            }
            setSendError(undefined);
            invalidate();
            setEditingScheduledDelayId(null);
            setScheduledTime(null);
            resetInput();
          } catch (e: unknown) {
            if (
              e instanceof MatrixError &&
              (e.errcode === ErrorCode.M_MAX_DELAY_EXCEEDED ||
                e.data?.['org.matrix.msc4140.errcode'] === 'M_MAX_DELAY_EXCEEDED')
            ) {
              const maxDelay =
                (e.data as { max_delay?: number })?.max_delay ??
                e.data?.['org.matrix.msc4140.max_delay'];
              if (typeof maxDelay === 'number') setServerMaxDelayMs(maxDelay);
              const maxDelayDays = maxDelay / daysToMs(1);
              setSendError(
                `Scheduled time exceeds the maximum delay allowed by this server. Please choose an earlier time. The Maximum Delay is of ${maxDelayDays} day${maxDelayDays > 1 ? 's' : ''}.`
              );
            } else {
              setSendError('Failed to schedule message. Please try again.');
            }
          }
        } else if (editingScheduledDelayId) {
          try {
            await cancelDelayedEvent(mx, editingScheduledDelayId);
            debugLog.info('message', 'Sending message after cancelling scheduled event', {
              roomId,
              scheduledDelayId: editingScheduledDelayId,
            });
            const res = await mx.sendMessage(
              roomId,
              threadRootId ?? null,
              content as RoomMessageEventContent
            );
            debugLog.info('message', 'Message sent successfully', {
              roomId,
              eventId: res.event_id,
            });
            invalidate();
            setEditingScheduledDelayId(null);
            resetInput();
          } catch (error) {
            debugLog.error('message', 'Failed to send message after cancelling scheduled event', {
              roomId,
              error: error instanceof Error ? error.message : String(error),
            });
            // Cancel failed — leave state intact for retry
          }
        } else {
          const msgSendStart = performance.now();
          const sentMsgDraftSnapshot = structuredClone(editor.children);
          const sentReplyDraftSnapshot = serializeReplyDraft(replyDraft);
          const sentImagePacksSnapshot = JSON.stringify(imagePacksUsedRef.current.toJSON());
          const sentSilentReplySnapshot = silentReply;
          const txnId = mx.makeTxnId();
          setSendError(undefined);
          resetInput(sentReplyDraftSnapshot, sentImagePacksSnapshot, { refocus: true });
          debugLog.info('message', 'Sending message', {
            roomId,
            msgtype: content.msgtype,
          });
          try {
            const res = await sendImmediateMessage({
              content: content as RoomMessageEventContent,
              isEncrypted,
              mx,
              roomId,
              threadRootId: threadRootId ?? undefined,
              txnId,
            });
            debugLog.info('message', 'Message sent successfully', {
              roomId,
              eventId: res.event_id,
            });
            Sentry.metrics.distribution(
              'sable.message.send_latency_ms',
              performance.now() - msgSendStart,
              { attributes: { encrypted: String(isEncrypted) } }
            );
          } catch (error: unknown) {
            setSendError('Failed to send message. Please try again.');
            const pendingImmediateEvent = room.getEventForTxnId(txnId);
            const pendingImmediateEventStatus = pendingImmediateEvent?.getAssociatedStatus();

            if (
              pendingImmediateEventStatus !== EventStatus.ENCRYPTING &&
              pendingImmediateEventStatus !== EventStatus.SENDING &&
              pendingImmediateEventStatus !== EventStatus.QUEUED &&
              pendingImmediateEventStatus !== EventStatus.NOT_SENT
            ) {
              restoreFailedImmediateSendContext(
                sentMsgDraftSnapshot,
                sentReplyDraftSnapshot,
                sentImagePacksSnapshot,
                sentSilentReplySnapshot
              );
            }
            const sendErrMsg = error instanceof Error ? error.message : String(error);
            const isSendNetworkError = /load failed|failed to fetch|fetch failed|network/i.test(
              sendErrMsg
            );
            if (isSendNetworkError) {
              // debugLog.warn is a no-op in production; add breadcrumb directly and skip
              // creating a Sentry issue for expected connectivity failures.
              Sentry.addBreadcrumb({
                category: 'message.send',
                message: 'Failed to send message',
                level: 'warning',
                data: { roomId, error: sendErrMsg },
              });
            } else {
              debugLog.error('message', 'Failed to send message', {
                roomId,
                error: sendErrMsg,
              });
            }
            Sentry.metrics.count('sable.message.send_error', 1, {
              attributes: {
                encrypted: String(isEncrypted),
                network_error: String(isSendNetworkError),
              },
            });
            log.error('failed to send message', { roomId }, error);
          }
        }
      } finally {
        submitInFlightRef.current = false;
      }
    };

    const handleKeyDown: KeyboardEventHandler = (evt) => {
      const autocompleteMenu = document.querySelector('[data-autocomplete-menu]');
      const isMenuVisible = !!(autocompleteQuery && autocompleteMenu);

      if (isMenuVisible) {
        if (isKeyHotkey('arrowdown', evt)) {
          evt.preventDefault();
          autocompleteMenu.dispatchEvent(
            new CustomEvent('autocomplete-navigate', {
              detail: { direction: 1 },
            })
          );
          return;
        }
        if (isKeyHotkey('arrowup', evt)) {
          evt.preventDefault();
          autocompleteMenu.dispatchEvent(
            new CustomEvent('autocomplete-navigate', {
              detail: { direction: -1 },
            })
          );
          return;
        }

        if ((isKeyHotkey('enter', evt) || isKeyHotkey('tab', evt)) && !isComposing(evt)) {
          const selectedItem =
            autocompleteMenu.querySelector<HTMLButtonElement>('button[data-selected="true"]') ??
            autocompleteMenu.querySelector<HTMLButtonElement>('button');

          if (selectedItem) {
            evt.preventDefault();
            selectedItem.click();
            return;
          }
        }
      }

      if (isKeyHotkey('arrowup', evt) && isEmptyEditor(editor)) {
        const { selection } = editor;
        if (selection && Editor.isStart(editor, selection.anchor, [])) {
          evt.preventDefault();
          onEditLastMessage?.();
          return;
        }
      }

      if (structuredMarkdownAssist && isKeyHotkey('enter', evt) && !isComposing(evt)) {
        const { selection } = editor;
        if (selection && Range.isCollapsed(selection)) {
          const blockIndex = selection.anchor.path[0];
          if (typeof blockIndex === 'number') {
            const lines = editor.children.map((_, index) => Editor.string(editor, [index]));
            const action = getStructuredMarkdownAction(lines, blockIndex);

            if (action) {
              evt.preventDefault();
              if (action.kind === 'continue') {
                editor.insertBreak();
                editor.insertText(action.prefix);
                return;
              }
              if (action.kind === 'continue_fence') {
                editor.insertBreak();
                return;
              }

              const blockPath = [blockIndex];
              Transforms.select(editor, {
                anchor: Editor.start(editor, blockPath),
                focus: Editor.end(editor, blockPath),
              });
              Transforms.insertText(editor, action.replacement);
              if (shouldInsertBreakAfterStructuredReplacement(action)) {
                editor.insertBreak();
              }
              return;
            }
          }
        }
      }
      if (
        (isKeyHotkey('mod+enter', evt) || (!enterForNewline && isKeyHotkey('enter', evt))) &&
        !isComposing(evt)
      ) {
        evt.preventDefault();
        submit().catch((error) => {
          log.error('submit failed', { roomId }, error);
        });
        return;
      }
      if (isKeyHotkey('escape', evt)) {
        evt.preventDefault();
        if (showAudioRecorder) {
          audioRecorderRef.current?.cancel();
          return;
        }
        if (autocompleteQuery) {
          setAutocompleteQuery(undefined);
          return;
        }
        if (editDraft) {
          setEditDraft(undefined);
          resetEditor(editor);
          resetEditorHistory(editor);
          return;
        }
        setReplyDraft(undefined);
      }

      if (isKeyHotkey('mod+e', evt)) {
        evt.preventDefault();
        setEmojiBoardTab(EmojiBoardTab.Sticker);
      }
    };

    const handleKeyUp: KeyboardEventHandler = useCallback(
      (evt) => {
        if (isKeyHotkey('escape', evt)) {
          evt.preventDefault();
          return;
        }

        if (!hideActivity) {
          sendTypingStatus(!isEmptyEditor(editor));
        }

        if (
          emojiAutoExpand &&
          (evt.key === ' ' ||
            evt.key === 'Tab' ||
            evt.key === '.' ||
            evt.key === ',' ||
            evt.key === '!' ||
            evt.key === '?' ||
            evt.key === ':' ||
            evt.key === ';')
        ) {
          const { selection } = editor;
          if (selection && Range.isCollapsed(selection)) {
            const [node] = Editor.node(editor, selection.anchor.path);
            if (SlateText.isText(node)) {
              const replacement = findEmojiAutoReplacement(node.text, selection.anchor.offset, {
                consumeTrailingSeparator: evt.key !== 'Tab',
              });
              if (replacement) {
                Transforms.select(editor, {
                  anchor: {
                    path: selection.anchor.path,
                    offset: replacement.start,
                  },
                  focus: {
                    path: selection.anchor.path,
                    offset: replacement.end,
                  },
                });
                Transforms.insertText(editor, replacement.replacement);
              }
            }
          }
        }

        const firstPosition = Editor.start(editor, []);
        const secondChar = Editor.after(editor, firstPosition, {
          distance: 2,
          unit: 'character',
        });
        const quickReactPrefix = Editor.string(
          editor,
          Editor.range(editor, firstPosition, secondChar)
        );
        if (quickReactPrefix === '+#') {
          setQuickTextReact(true);
          setAutocompleteQuery(undefined);
          return;
        }
        setQuickTextReact(false);

        const prevWordRange = getPrevWorldRange(editor);
        if (!prevWordRange) {
          setAutocompleteQuery(undefined);
          return;
        }

        const isRangeAtBeginning = !Point.isAfter(Range.start(prevWordRange), firstPosition);
        const query =
          (isRangeAtBeginning
            ? getAutocompleteQuery(editor, prevWordRange, BEGINNING_AUTOCOMPLETE_PREFIXES)
            : undefined) ??
          getAutocompleteQuery(editor, prevWordRange, ANYWHERE_AUTOCOMPLETE_PREFIXES);

        setAutocompleteQuery(query);
      },
      [editor, sendTypingStatus, hideActivity, emojiAutoExpand]
    );

    const handleEmoticonSelect = (key: string, shortcode: string) => {
      const emoticonEl = createEmoticonElement(key, shortcode);
      if (autocompleteQuery) {
        replaceWithElement(editor, autocompleteQuery.range, emoticonEl);
      } else {
        editor.insertNode(emoticonEl);
      }
      if (!imagePacksUsedRef.current.has(key)) {
        const imgPkRef = getImagePackReferencesForMxc(key, mx, ImageUsage.Emoticon, room);
        if (imgPkRef?.room_id && imgPkRef?.shortcode) imagePacksUsedRef.current.set(key, imgPkRef);
      }
      moveCursor(editor);
      handleCloseAutocomplete();
    };

    const handleStickerSelect = async (mxc: string, shortcode: string, label: string) => {
      const stickerUrl = mxcUrlToHttp(mx, mxc, useAuthentication);
      if (!stickerUrl) return;

      const { blob, image } = await loadImageElementFromMediaUrl(stickerUrl);
      const info = getImageInfo(image, blob);

      const content: StickerEventContent & ReplyEventContent & IContent & IGenericMSC4459 = {
        body: label,
        url: mxc,
        info,
      };

      // add the image pack reference
      content[prefix.MATRIX_UNSTABLE_IMAGE_SOURCE_PACK_PROPERTY_NAME] =
        getImagePackReferencesForMxcWrappedInMap(mxc, mx, ImageUsage.Sticker, room);

      /**
       * the currently with the room associated per-message profile, if any, so that it can be included in the message content when sending.
       * This allows the server to apply the correct profile-based transformations (e.g. font size adjustments) when processing the message,
       * and also allows clients to display an accurate preview of how the message will look with the profile applied while it's being composed.
       */
      const perMessageProfile = await getCurrentlyUsedPerMessageProfileForRoom(mx, roomId);

      if (perMessageProfile) {
        content[prefix.MATRIX_UNSTABLE_PER_MESSAGE_PROFILE_PROPERTY_NAME] =
          convertPerMessageProfileToBeeperFormat(perMessageProfile, false);
      }
      content[prefix.MATRIX_UNSTABLE_IMAGE_SOURCE_PACK_PROPERTY_NAME] =
        getImagePackReferencesForMxcWrappedInMap(mxc, mx, ImageUsage.Sticker, room);

      if (replyDraft) {
        content['m.relates_to'] = getReplyContent(replyDraft, room);
        const replyMentions = getReplyMentionData(replyDraft, replyEvent, silentReply);
        if (replyMentions) content['m.mentions'] = replyMentions;
        setReplyDraft(replyDraftBase);
      }
      mx.sendEvent(roomId, EventType.Sticker, content);
    };

    const handleGifSelect = async (gif: GifData | null) => {
      if (!gifsEnabled) return;
      if (!gif) return;
      if (gif.url.trim().length === 0) return;

      const gifUrl = gif.url.trim();
      const gifProxyHost = normalizeGifProxyHost(clientConfig.gifs?.proxyUrl);
      let url = gifUrl;
      // Fresh Klipy CDN pick: convert CDN URL → mxc://. getKlipyRemoteId only
      // works on CDN HTTP URLs, so the conversion block must NOT run for
      // favorited Klipy GIFs whose gif.url is already an mxc:// URL.
      const isKlipyFreshCdn = !gifUrl.startsWith('mxc://');
      // Favorited Klipy GIFs arrive as mxc://<proxyHost>/klipy_* — detect them
      // so we can apply the same body/MIME treatment as fresh picks.
      const isKlipyProxyFavorite =
        !isKlipyFreshCdn && isKlipyProxyMxc(gifUrl, clientConfig.gifs?.proxyUrl);
      const isKlipyProxy = isKlipyFreshCdn || isKlipyProxyFavorite;
      if (isKlipyFreshCdn) {
        const remoteId = getKlipyRemoteId(gifUrl);

        if (!gifProxyHost || !remoteId) {
          setSendError('Failed to send GIF. Please try selecting another GIF.');
          return;
        }

        url = `mxc://${gifProxyHost}/${toMatrixMediaId(remoteId, 'klipy_')}`;
      }

      // For Klipy proxy GIFs (both fresh CDN picks and mxc:// favorites), use a
      // .gif body extension so Discord's mautrix bridge renders them animated —
      // Discord animates .gif files but treats .webp as stills. The MIME stays
      // image/webp because the payload is animated WebP. Strip any existing image
      // extension first so a title like "name.gif" or "name.webp" never produces
      // a double-suffix.
      const baseTitle = gif.title.replace(/\.(gif|webp)$/i, '');
      const body = isKlipyProxy ? `${baseTitle}.gif` : gif.title;
      const mimetype = isKlipyProxy ? 'image/webp' : 'image/gif';

      const content: RoomMessageEventContent & IContent = {
        body,
        url: url,
        msgtype: MsgType.Image,
        info: {
          w: gif.width,
          h: gif.height,
          mimetype,
        },
      };

      const perMessageProfile = await getCurrentlyUsedPerMessageProfileForRoom(mx, roomId);
      if (perMessageProfile) {
        content[prefix.MATRIX_UNSTABLE_PER_MESSAGE_PROFILE_PROPERTY_NAME] =
          convertPerMessageProfileToBeeperFormat(perMessageProfile, false);
      }

      if (replyDraft) {
        const replyContent = getReplyContent(replyDraft, room);
        if (Object.keys(replyContent).length > 0) {
          content['m.relates_to'] = replyContent as RoomMessageEventContent['m.relates_to'];
        }
        const replyMentions = getReplyMentionData(replyDraft, replyEvent, silentReply);
        if (replyMentions) content['m.mentions'] = replyMentions;
      }

      const invalidate = () =>
        queryClient.invalidateQueries({ queryKey: ['delayedEvents', roomId] });

      try {
        setSendError(undefined);
        if (scheduledTime) {
          const delayMs = computeDelayMs(scheduledTime);
          if (editingScheduledDelayId) {
            await cancelDelayedEvent(mx, editingScheduledDelayId);
          }

          if (isEncrypted) {
            await sendDelayedMessageE2EE(mx, roomId, room, content, delayMs, threadRootId ?? null);
          } else {
            await sendDelayedMessage(mx, roomId, content, delayMs, threadRootId ?? null);
          }

          invalidate();
          setEditingScheduledDelayId(null);
          setScheduledTime(null);
          setReplyDraft(replyDraftBase);
        } else if (editingScheduledDelayId) {
          await cancelDelayedEvent(mx, editingScheduledDelayId);
          invalidate();
          setEditingScheduledDelayId(null);
          await mx.sendMessage(roomId, threadRootId ?? null, content);
          setReplyDraft(replyDraftBase);
        } else {
          await mx.sendMessage(roomId, threadRootId ?? null, content);
          setReplyDraft(replyDraftBase);
        }
      } catch {
        setSendError(
          scheduledTime
            ? 'Failed to schedule GIF. Please try again.'
            : 'Failed to send GIF. Please try again.'
        );
      }
    };

    return (
      // eslint-disable-next-line jsx-a11y/no-static-element-interactions
      <div
        ref={ref}
        onMouseDown={handleMobilePreLift}
        onPointerDownCapture={handleMobilePreLift}
        onTouchStartCapture={handleMobilePreLift}
      >
        {selectedFiles.length > 0 && (
          <UploadBoard
            header={
              <UploadBoardHeader
                open={uploadBoard}
                onToggle={() => setUploadBoard(!uploadBoard)}
                uploadFamilyObserverAtom={uploadFamilyObserverAtom}
                onSend={async () => submit()}
                imperativeHandlerRef={uploadBoardHandlers}
                onCancel={handleCancelUpload}
              />
            }
          >
            {uploadBoard && (
              <Scroll size="300" hideTrack visibility="Hover">
                <UploadBoardContent>
                  {Array.from(selectedFiles)
                    .toReversed()
                    .map((fileItem) => (
                      <UploadCardRenderer
                        key={getUploadItemKey(fileItem)}
                        isEncrypted={!!fileItem.encInfo}
                        fileItem={fileItem}
                        setMetadata={handleFileMetadata}
                        onRemove={handleRemoveUpload}
                        setDesc={setDesc}
                        roomId={roomId}
                      />
                    ))}
                </UploadBoardContent>
              </Scroll>
            )}
          </UploadBoard>
        )}
        <Overlay
          open={dropZoneVisible}
          backdrop={<OverlayBackdrop />}
          style={{ pointerEvents: 'none' }}
        >
          <OverlayCenter>
            <Dialog variant="Primary">
              <Box
                direction="Column"
                justifyContent="Center"
                alignItems="Center"
                gap="500"
                style={{ padding: toRem(60) }}
              >
                {dropzoneIcon(FileIcon)}
                <Text size="H4" align="Center">
                  {`Drop Files in "${room?.name || 'Room'}"`}
                </Text>
                <Text align="Center">Drag and drop files here or click for selection dialog</Text>
              </Box>
            </Dialog>
          </OverlayCenter>
        </Overlay>
        {autocompleteQuery?.prefix === AutocompletePrefix.RoomMention && (
          <RoomMentionAutocomplete
            roomId={roomId}
            editor={editor}
            query={autocompleteQuery}
            requestClose={handleCloseAutocomplete}
          />
        )}
        {autocompleteQuery?.prefix === AutocompletePrefix.UserMention && (
          <UserMentionAutocomplete
            room={room}
            editor={editor}
            query={autocompleteQuery}
            requestClose={handleCloseAutocomplete}
          />
        )}
        {autocompleteQuery?.prefix === AutocompletePrefix.Emoticon && (
          <EmoticonAutocomplete
            imagePackRooms={imagePackRooms}
            editor={editor}
            query={autocompleteQuery}
            requestClose={handleCloseAutocomplete}
            onEmoticonSelected={handleEmoticonSelect}
          />
        )}
        {autocompleteQuery?.prefix === AutocompletePrefix.Reaction &&
          (canSendReaction ? (
            <EmoticonAutocomplete
              title={`React with :${autocompleteQuery.text}`}
              imagePackRooms={imagePackRooms}
              editor={editor}
              query={autocompleteQuery}
              requestClose={handleCloseAutocomplete}
              onEmoticonSelected={handleQuickReact}
            />
          ) : (
            <AutocompleteNotice>
              You do not have permission to send reactions in this room
            </AutocompleteNotice>
          ))}
        {autocompleteQuery?.prefix === AutocompletePrefix.Command && (
          <CommandAutocomplete
            room={room}
            editor={editor}
            query={autocompleteQuery}
            requestClose={handleCloseAutocomplete}
          />
        )}
        {isQuickTextReact &&
          (canSendReaction ? (
            <AutocompleteNotice>Sending as text reaction to the latest message</AutocompleteNotice>
          ) : (
            <AutocompleteNotice>
              You do not have permission to send reactions in this room
            </AutocompleteNotice>
          ))}
        <CustomEditor
          editableName="RoomInput"
          editor={editor}
          key={inputKey}
          placeholder="Send a message..."
          onKeyDown={handleKeyDown}
          onKeyUp={handleKeyUp}
          onPaste={handlePaste}
          responsiveAfter={audioRecorder}
          forceMultilineLayout={showAudioRecorder}
          moveAfterToFooter={isMobileLayout}
          top={
            <>
              {scheduledTime && (
                <div>
                  <Box
                    alignItems="Center"
                    gap="300"
                    style={{
                      padding: `${config.space.S200} ${config.space.S300} 0`,
                    }}
                  >
                    <IconButton
                      onClick={() => {
                        setScheduledTime(null);
                        setEditingScheduledDelayId(null);
                        setSendError(undefined);
                      }}
                      variant="SurfaceVariant"
                      size={touchTargetSize}
                      radii="300"
                      title="Cancel scheduled send"
                      aria-label="Cancel scheduled send"
                    >
                      {chipIcon(X)}
                    </IconButton>
                    <Box direction="Row" gap="200" alignItems="Center">
                      {menuIcon(Clock)}
                      <Text size="T300">
                        Scheduled for {timeDayMonthYear(scheduledTime.getTime())} at{' '}
                        {timeHourMinute(scheduledTime.getTime(), hour24Clock)}
                      </Text>
                    </Box>
                  </Box>
                </div>
              )}
              {editDraft && (
                <div>
                  <Box
                    alignItems="Center"
                    gap="300"
                    style={{
                      padding: `${config.space.S200} ${config.space.S300} 0`,
                    }}
                  >
                    <IconButton
                      onClick={() => {
                        setEditDraft(undefined);
                        resetEditor(editor);
                        resetEditorHistory(editor);
                      }}
                      variant="SurfaceVariant"
                      size={touchTargetSize}
                      radii="300"
                      aria-label="Cancel edit"
                      title="Cancel edit"
                    >
                      <Icon src={Icons.Cross} size={showTouchSpacing ? '200' : '50'} />
                    </IconButton>
                    <Box
                      direction="Row"
                      gap="200"
                      alignItems="Center"
                      grow="Yes"
                      style={{ minWidth: 0 }}
                    >
                      <Icon size="100" src={Icons.Pencil} />
                      <Text size="T300" truncate>
                        Editing message
                      </Text>
                    </Box>
                  </Box>
                </div>
              )}
              {sendError && (
                <div>
                  <Box
                    alignItems="Center"
                    gap="300"
                    style={{
                      padding: `${config.space.S200} ${config.space.S300} 0`,
                    }}
                  >
                    <Text style={{ color: color.Critical.Main }} size="T300">
                      {sendError}
                    </Text>
                  </Box>
                </div>
              )}
              {replyDraft && (!threadRootId || replyDraft.body) && (
                <div>
                  <Box
                    alignItems="Center"
                    gap="300"
                    style={{
                      padding: `${config.space.S200} ${config.space.S300} 0`,
                    }}
                  >
                    <IconButton
                      onClick={() => {
                        if (threadRootId) {
                          setReplyDraft({
                            userId: mx.getUserId() ?? '',
                            eventId: threadRootId,
                            body: '',
                            relation: {
                              rel_type: RelationType.Thread,
                              event_id: threadRootId,
                            },
                          });
                        } else {
                          setReplyDraft(undefined);
                        }
                      }}
                      variant="SurfaceVariant"
                      size={touchTargetSize}
                      radii="300"
                      aria-label="Cancel reply"
                      title="Cancel reply"
                    >
                      {chipIcon(X)}
                    </IconButton>
                    <Box
                      direction="Row"
                      gap="200"
                      alignItems="Center"
                      grow="Yes"
                      style={{ minWidth: 0 }}
                    >
                      <Box
                        direction="Row"
                        gap="200"
                        alignItems="Center"
                        grow="Yes"
                        style={{ minWidth: 0 }}
                      >
                        {replyDraft.relation?.rel_type === RelationType.Thread && !threadRootId && (
                          <ThreadIndicator />
                        )}
                        <Reply room={room} replyEventId={replyDraft.eventId} />
                      </Box>
                      <IconButton
                        variant="SurfaceVariant"
                        size={touchTargetSize}
                        radii="300"
                        title={
                          silentReply ? 'Unmute reply notifications' : 'Mute reply notifications'
                        }
                        aria-pressed={silentReply}
                        aria-label={
                          silentReply ? 'Unmute reply notifications' : 'Mute reply notifications'
                        }
                        onClick={() => setSilentReply(!silentReply)}
                      >
                        {!silentReply && composerIcon(Bell)}
                        {silentReply && composerIcon(BellSlash)}
                      </IconButton>
                    </Box>
                  </Box>
                </div>
              )}
            </>
          }
          before={
            <>
              <PopOut
                anchor={AddMenuAnchor}
                position="Top"
                align="Start"
                offset={5}
                content={
                  <FocusTrap
                    focusTrapOptions={{
                      initialFocus: false,
                      onDeactivate: () => setAddMenuAnchor(undefined),
                      clickOutsideDeactivates: true,
                      escapeDeactivates: stopPropagation,
                    }}
                  >
                    <Menu>
                      <Box direction="Column" gap="100" style={{ padding: config.space.S100 }}>
                        <MenuItem
                          size="300"
                          radii="300"
                          onClick={() => {
                            setAddMenuAnchor(undefined);
                            void openPollCreator();
                          }}
                          before={menuIcon(ListBullets)}
                        >
                          <Text size="B300">Create Poll</Text>
                        </MenuItem>
                        <MenuItem
                          size="300"
                          radii="300"
                          onClick={() => {
                            setAddMenuAnchor(undefined);
                            void openLocationPicker();
                          }}
                          before={menuIcon(MapPinPlusIcon)}
                        >
                          <Text size="B300">Add Location</Text>
                        </MenuItem>
                        <MenuItem
                          size="300"
                          radii="300"
                          onClick={() => {
                            pickFile('*');
                            setAddMenuAnchor(undefined);
                          }}
                          before={menuIcon(PlusCircle)}
                        >
                          <Text size="B300">Add File</Text>
                        </MenuItem>
                      </Box>
                    </Menu>
                  </FocusTrap>
                }
              />
              <IconButton
                onPointerDownCapture={!editorOldAddFile ? prepareComposerOverlayTrigger : undefined}
                onClick={(evt) => {
                  if (editorOldAddFile) {
                    pickFile('*');
                    return;
                  }

                  void openAddMenu(evt.currentTarget);
                }}
                variant="SurfaceVariant"
                size={touchTargetSize}
                radii="300"
                title={editorOldAddFile ? 'Upload File' : 'Add'}
                aria-label={editorOldAddFile ? 'Upload and attach a File' : 'Add new Item'}
              >
                {composerIcon(PlusCircle)}
              </IconButton>
            </>
          }
          after={
            <>
              {/* ── Mic button — always present; icon swaps to Stop while recording ── */}
              <IconButton
                ref={micBtnRef}
                variant={showAudioRecorder ? 'Critical' : 'SurfaceVariant'}
                size={touchTargetSize}
                radii="300"
                title={showAudioRecorder ? 'Stop recording' : 'Record audio message'}
                aria-label={showAudioRecorder ? 'Stop recording' : 'Record audio message'}
                aria-pressed={showAudioRecorder}
                onClick={() => {
                  if (mobileOrTablet() && !showAudioRecorder) return;
                  if (showAudioRecorder) {
                    audioRecorderRef.current?.stop();
                  } else {
                    setShowAudioRecorder(true);
                  }
                }}
                onPointerDown={() => {
                  if (!mobileOrTablet()) return;
                  if (showAudioRecorder) return;
                  // Pre-create and resume an AudioContext synchronously while we
                  // are still inside the user-gesture callstack. iOS Safari will
                  // refuse to resume an AudioContext that is created after an
                  // await (e.g. inside the getUserMedia async path), causing the
                  // recorder to produce silence or nothing on the 2nd+ attempt.
                  primeAudioContext();
                  micHoldStartRef.current = Date.now();
                  setShowAudioRecorder(true);

                  function onUp() {
                    cleanup();
                    const held = Date.now() - micHoldStartRef.current;
                    if (held >= HOLD_THRESHOLD_MS) {
                      setTimeout(() => {
                        audioRecorderRef.current?.stop();
                      }, 50);
                    } else {
                      setTimeout(() => {
                        audioRecorderRef.current?.cancel();
                      }, 50);
                    }
                  }
                  function cleanup() {
                    window.removeEventListener('pointerup', onUp);
                    window.removeEventListener('pointercancel', cleanup);
                  }
                  window.addEventListener('pointerup', onUp);
                  window.addEventListener('pointercancel', cleanup);
                }}
              >
                {showAudioRecorder ? (
                  <Stop
                    size={getPhosphorIconSize('toolbar')}
                    weight="fill"
                    style={{ color: color.Critical.Main }}
                  />
                ) : (
                  composerIcon(Microphone)
                )}
              </IconButton>

              <MarkdownFormattingToolbarToggle variant="SurfaceVariant" size={touchTargetSize} />
              {isMobileLayout &&
                emojiBoardAnchorRect &&
                createPortal(
                  (() => {
                    const isWideGifBoard = emojiBoardTab === EmojiBoardTab.Gif;
                    const mobileBoardWidth = getEmojiBoardWidth(window.innerWidth, isWideGifBoard);
                    // Phone: center via transform so JS/CSS width rounding never causes drift.
                    const phoneBoardPosition = {
                      left: '50%',
                      transform: 'translateX(-50%)',
                    };
                    const tabletBoardPosition = {
                      right: getEmojiBoardRightOffset(
                        emojiBoardAnchorRect.right,
                        window.innerWidth,
                        isWideGifBoard
                      ),
                    };

                    return (
                      <div
                        ref={emojiPickerRef}
                        style={{
                          position: 'fixed',
                          zIndex: 999,
                          // Position above the emoji button (mirrors PopOut position="Top" offset=16).
                          bottom: window.innerHeight - emojiBoardAnchorRect.top + 16,
                          ...(isPhoneLayoutDevice() ? phoneBoardPosition : tabletBoardPosition),
                          ...(isPhoneLayoutDevice() && {
                            width: isWideGifBoard
                              ? mobileBoardWidth
                              : getEmojiBoardWidth(window.innerWidth),
                          }),
                          display: emojiBoardTab !== undefined ? undefined : 'none',
                          // Blocks a rapid double-tap during the close fade
                          // from landing a second emoji/sticker/GIF selection
                          // on content that's already being dismissed.
                          pointerEvents: isClosingMobileEmojiBoard ? 'none' : undefined,
                        }}
                      >
                        <EmojiBoard
                          active={emojiBoardTab !== undefined}
                          tab={emojiBoardTab ?? EmojiBoardTab.Emoji}
                          onTabChange={setEmojiBoardTab}
                          imagePackRooms={imagePackRooms}
                          returnFocusOnDeactivate={false}
                          onEmojiSelect={handleEmoticonSelect}
                          onCustomEmojiSelect={handleEmoticonSelect}
                          onStickerSelect={handleStickerSelect}
                          onGifSelect={handleGifSelect}
                          isMobileSheet
                          requestClose={closeMobileEmojiBoard}
                        />
                      </div>
                    );
                  })(),
                  document.body
                )}
              <PopOut
                offset={16}
                alignOffset={-44}
                position="Top"
                align="End"
                anchor={
                  !isMobileLayout && emojiBoardTab !== undefined
                    ? (emojiBtnRef.current?.getBoundingClientRect() ?? undefined)
                    : undefined
                }
                content={
                  !isMobileLayout ? (
                    <EmojiBoard
                      tab={emojiBoardTab}
                      onTabChange={setEmojiBoardTab}
                      imagePackRooms={imagePackRooms}
                      returnFocusOnDeactivate={false}
                      onEmojiSelect={handleEmoticonSelect}
                      onCustomEmojiSelect={handleEmoticonSelect}
                      onStickerSelect={handleStickerSelect}
                      onGifSelect={handleGifSelect}
                      requestClose={closeEmojiBoard}
                    />
                  ) : undefined
                }
              >
                {!hideStickerBtn && (
                  <IconButton
                    aria-pressed={emojiBoardTab === EmojiBoardTab.Sticker}
                    onPointerDownCapture={prepareComposerOverlayTrigger}
                    onClick={() => void openEmojiBoard(EmojiBoardTab.Sticker)}
                    variant="SurfaceVariant"
                    size={touchTargetSize}
                    radii="300"
                    title="open sticker picker"
                    aria-label="Open sticker picker"
                  >
                    {composerIcon(Sticker, {
                      weight: emojiBoardTab === EmojiBoardTab.Sticker ? 'fill' : 'regular',
                    })}
                  </IconButton>
                )}
                {gifsEnabled && (
                  <IconButton
                    aria-pressed={emojiBoardTab === EmojiBoardTab.Gif}
                    onPointerDownCapture={prepareComposerOverlayTrigger}
                    onClick={() => void openEmojiBoard(EmojiBoardTab.Gif)}
                    variant="SurfaceVariant"
                    size={touchTargetSize}
                    radii="300"
                    title="open GIF picker"
                    aria-label="Open GIF picker"
                  >
                    {composerIcon(GifIcon, {
                      weight: emojiBoardTab === EmojiBoardTab.Gif ? 'fill' : 'regular',
                    })}
                  </IconButton>
                )}
                <IconButton
                  ref={emojiBtnRef}
                  aria-pressed={
                    hideStickerBtn ? !!emojiBoardTab : emojiBoardTab === EmojiBoardTab.Emoji
                  }
                  onPointerDownCapture={prepareComposerOverlayTrigger}
                  onClick={() => void openEmojiBoard(EmojiBoardTab.Emoji)}
                  variant="SurfaceVariant"
                  size={touchTargetSize}
                  radii="300"
                  title="open emoji picker"
                  aria-label="Open emoji picker"
                >
                  {composerIcon(Smiley, {
                    weight: hideStickerBtn
                      ? emojiBoardTab
                        ? 'fill'
                        : 'regular'
                      : emojiBoardTab === EmojiBoardTab.Emoji
                        ? 'fill'
                        : 'regular',
                  })}
                </IconButton>
              </PopOut>
              <PopOut
                anchor={scheduleMenuAnchor}
                position="Top"
                align="End"
                offset={5}
                content={
                  <FocusTrap
                    focusTrapOptions={{
                      initialFocus: false,
                      onDeactivate: () => {
                        setScheduleMenuAnchor(undefined);
                        suppressNextSendClickSequenceRef.current = null;
                      },
                      clickOutsideDeactivates: true,
                      escapeDeactivates: stopPropagation,
                    }}
                  >
                    <Menu>
                      <Box direction="Column" gap="100" style={{ padding: config.space.S100 }}>
                        <MenuItem
                          size="300"
                          radii="300"
                          onClick={() => {
                            setScheduleMenuAnchor(undefined);
                            submit();
                          }}
                          before={menuIcon(PaperPlaneTilt)}
                        >
                          <Text size="B300">Send Now</Text>
                        </MenuItem>
                        <MenuItem
                          size="300"
                          radii="300"
                          onClick={() => {
                            void openSchedulePicker();
                          }}
                          before={menuIcon(Clock)}
                        >
                          <Text size="B300">Schedule Send</Text>
                        </MenuItem>
                      </Box>
                    </Menu>
                  </FocusTrap>
                }
              />
              <Box display="Flex" alignItems="Center">
                <IconButton
                  title="Send Message"
                  aria-label="Send your composed Message"
                  onClick={() => {
                    clearLongPressTimer();
                    if (
                      suppressNextSendClickSequenceRef.current !== null &&
                      suppressNextSendClickSequenceRef.current === sendClickSequenceRef.current
                    ) {
                      suppressNextSendClickSequenceRef.current = null;
                      longPressTriggeredRef.current = false;
                      Sentry.addBreadcrumb(
                        buildNotificationBreadcrumb('send', 'send_click_suppressed', {
                          room_id: roomId,
                          press_sequence: sendClickSequenceRef.current,
                          reason: 'schedule_long_press',
                        })
                      );
                      Sentry.metrics.count('sable.message.send_click_suppressed', 1, {
                        attributes: buildNotificationMetricAttributes({
                          room_id: roomId,
                          trigger: 'schedule_long_press',
                        }),
                      });
                      return;
                    }
                    Sentry.addBreadcrumb(
                      buildNotificationBreadcrumb('send', 'send_click_submitted', {
                        room_id: roomId,
                        press_sequence: sendClickSequenceRef.current,
                        trigger: 'tap',
                      })
                    );
                    Sentry.metrics.count('sable.message.send_click_submitted', 1, {
                      attributes: buildNotificationMetricAttributes({
                        room_id: roomId,
                        trigger: 'tap',
                      }),
                    });
                    submit();
                  }}
                  onMouseDown={(e: MouseEvent) => e.preventDefault()}
                  onPointerDown={(evt) => {
                    clearLongPressTimer();
                    if (!isMobileLayout || !delayedEventsSupported || evt.pointerType === 'mouse') {
                      return;
                    }

                    const pressSequence = sendClickSequenceRef.current + 1;
                    sendClickSequenceRef.current = pressSequence;
                    longPressPointerId.current = evt.pointerId;
                    longPressPressSequenceRef.current = pressSequence;
                    longPressStartPoint.current = {
                      x: evt.clientX,
                      y: evt.clientY,
                    };
                    longPressTriggeredRef.current = false;
                    longPressTimer.current = setTimeout(() => {
                      if (
                        longPressPointerId.current !== evt.pointerId ||
                        longPressPressSequenceRef.current !== pressSequence
                      )
                        return;
                      longPressTriggeredRef.current = true;
                      suppressNextSendClickSequenceRef.current = pressSequence;
                      longPressPointerId.current = null;
                      longPressPressSequenceRef.current = null;
                      longPressStartPoint.current = null;
                      Sentry.addBreadcrumb(
                        buildNotificationBreadcrumb('send', 'send_long_press_armed', {
                          room_id: roomId,
                          press_sequence: pressSequence,
                        })
                      );
                      Sentry.metrics.count('sable.message.send_long_press_armed', 1, {
                        attributes: buildNotificationMetricAttributes({
                          room_id: roomId,
                        }),
                      });
                      prepareComposerOverlayTrigger();
                      if (longPressTimer.current !== null) {
                        clearTimeout(longPressTimer.current);
                        longPressTimer.current = null;
                      }
                      void openSchedulePicker();
                    }, 700);
                  }}
                  onPointerMove={(evt) => {
                    if (longPressPointerId.current !== evt.pointerId) return;
                    const start = longPressStartPoint.current;
                    if (!start) return;
                    const movedX = Math.abs(evt.clientX - start.x);
                    const movedY = Math.abs(evt.clientY - start.y);
                    if (movedX > 12 || movedY > 12) {
                      clearLongPressTimer();
                    }
                  }}
                  onPointerUp={() => {
                    resetLongPressState();
                  }}
                  onPointerCancel={() => {
                    suppressNextSendClickSequenceRef.current = null;
                    resetLongPressState();
                  }}
                  onPointerLeave={() => {
                    if (!longPressTriggeredRef.current) {
                      resetLongPressState();
                    }
                  }}
                  variant={scheduledTime ? 'Primary' : 'SurfaceVariant'}
                  size={touchTargetSize}
                  radii="0"
                  className={
                    delayedEventsSupported && !isMobileLayout ? css.SplitSendButton : undefined
                  }
                >
                  {scheduledTime ? composerIcon(Clock) : composerIcon(PaperPlaneTilt)}
                </IconButton>
                {delayedEventsSupported && !isMobileLayout && (
                  <IconButton
                    onClick={(evt: MouseEvent<HTMLButtonElement>) => {
                      setScheduleMenuAnchor(evt.currentTarget.getBoundingClientRect());
                    }}
                    title="Schedule Message"
                    aria-label="Schedule message send"
                    aria-haspopup="menu"
                    aria-expanded={!!scheduleMenuAnchor}
                    variant={scheduledTime ? 'Primary' : 'SurfaceVariant'}
                    size={touchTargetSize}
                    radii="0"
                    className={css.SplitChevronButton}
                  >
                    {chipIcon(CaretDown)}
                  </IconButton>
                )}
              </Box>
            </>
          }
          bottom={<MarkdownFormattingToolbarBottom />}
        />
        {showSchedulePicker && (
          <SchedulePickerDialog
            initialTime={scheduledTime?.getTime()}
            showEncryptionWarning={isEncrypted}
            onCancel={closeSchedulePicker}
            onSubmit={(date) => {
              setScheduledTime(date);
              closeSchedulePicker();
              setSendError(undefined);
            }}
          />
        )}
        {pollCreatorOpen && (
          <PollCreator
            room={room}
            onClose={() => setPollCreatorOpen(false)}
            replyDraft={replyDraft}
            silentReply={silentReply}
            threadRootId={threadRootId}
            clearReplyDraft={() => setReplyDraft(replyDraftBase)}
          />
        )}
        {showLocationPicker && (
          <LocationDialog
            onCancel={() => setShowLocationPicker(false)}
            mx={mx}
            room={room}
            replyDraft={replyDraft}
            clearReplyDraft={() => setReplyDraft(replyDraftBase)}
          />
        )}
      </div>
    );
  }
);
