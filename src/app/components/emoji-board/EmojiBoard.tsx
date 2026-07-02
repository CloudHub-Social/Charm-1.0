import type {
  ChangeEventHandler,
  FocusEventHandler,
  MouseEventHandler,
  PointerEventHandler,
  ReactNode,
} from 'react';
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Box, Chip, Text, config } from 'folds';
import { AuthenticatedImg } from '$components/AuthenticatedImg';
import { ClockCounterClockwise } from '$components/icons/phosphor';
import FocusTrap from 'focus-trap-react';
import { isKeyHotkey } from 'is-hotkey';
import type { MatrixClient, Room } from '$types/matrix-sdk';
import type { PrimitiveAtom } from 'jotai';
import { atom, useAtom, useSetAtom } from 'jotai';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { IEmoji } from '$plugins/emoji';
import { emojiGroups, emojis } from '$plugins/emoji';
import { preventScrollWithArrowKey, stopPropagation } from '$utils/keyboard';
import { useRelevantImagePacks } from '$hooks/useImagePacks';
import { useMatrixClient } from '$hooks/useMatrixClient';
import { useRecentEmoji } from '$hooks/useRecentEmoji';
import { isUserId, mxcUrlToHttp } from '$utils/matrix';
import { editableActiveElement, targetFromEvent } from '$utils/dom';
import type { UseAsyncSearchOptions } from '$hooks/useAsyncSearch';
import { useAsyncSearch } from '$hooks/useAsyncSearch';
import { useThrottle } from '$hooks/useThrottle';
import { addRecentEmoji } from '$plugins/recent-emoji';
import { useMediaAuthentication } from '$hooks/useMediaAuthentication';
import { prewarmRenderableMediaUrls } from '$hooks/useRenderableMediaUrl';
import type { ImagePack, PackImageReader } from '$plugins/custom-emoji';
import { ImageUsage } from '$plugins/custom-emoji';
import { getEmoticonSearchStr } from '$plugins/utils';
import { VirtualTile } from '$components/virtualizer';
import { useSetting } from '$state/hooks/settings';
import { settingsAtom } from '$state/settings';
import { useEmojiGroupIcons } from './useEmojiGroupIcons';
import { useEmojiGroupLabels } from './useEmojiGroupLabels';
import type { PreviewData } from './components';
import {
  SearchInput,
  EmojiBoardTabs,
  SidebarStack,
  SidebarDivider,
  Sidebar,
  NoStickerPacks,
  GifStatus,
  createPreviewDataAtom,
  Preview,
  EmojiItem,
  StickerItem,
  GifItem,
  GifSearchItem,
  CustomEmojiItem,
  ImageGroupIcon,
  GroupIcon,
  getPackImageSrc,
  getEmojiItemInfo,
  EmojiGroup,
  EmojiBoardLayout,
} from './components';
import type { GifData } from './types';
import { EmojiBoardTab, EmojiType } from './types';
import { getMobileSheetHeights } from './mobileSheetHeights';
import { shouldDismissMobileSheet } from './mobileSheetDismiss';
import {
  addGifSentBreadcrumb,
  addGifTabOpenedBreadcrumb,
  captureGifDiscoveryError,
  captureGifSearchError,
  recordGifDiscoveryMs,
  recordGifSearchMs,
} from '$utils/gifTelemetry';
import { useClientConfig } from '$hooks/useClientConfig';
import { gifSearchConfigured } from '$hooks/useClientConfig';
import { useFavoriteGifs } from '$hooks/useFavoriteGifs';
import * as componentCss from './components/styles.css';
import { addRecentGifSearch, getRecentGifSearches } from '$utils/recentGifSearches';

const RECENT_GROUP_ID = 'recent_group';
const SEARCH_GROUP_ID = 'search_group';

type EmojiGroupItem = {
  id: string;
  name: string;
  items: Array<IEmoji | PackImageReader>;
};
type StickerGroupItem = {
  id: string;
  name: string;
  items: Array<PackImageReader>;
};
type GifGroupItem = {
  id: string;
  name: string;
  items: GifData[];
};

type GifDiscoveryItem = {
  term: string;
  gif?: GifData;
};

type KlipyGifVariant = {
  url?: string;
  width?: number;
  height?: number;
  size?: number;
};

type KlipyGifFileSet = {
  xs?: { gif?: KlipyGifVariant };
  sm?: { gif?: KlipyGifVariant };
  md?: { gif?: KlipyGifVariant } | KlipyGifVariant;
  hd?: { gif?: KlipyGifVariant };
};

type KlipyGifResult = {
  id: string;
  title?: string;
  file?: KlipyGifFileSet;
  files?: KlipyGifFileSet;
};

const hasGifVariant = (
  value: KlipyGifFileSet['md']
): value is {
  gif?: KlipyGifVariant;
} => typeof value === 'object' && value !== null && 'gif' in value;

const parseKlipyResult = (klipyResult: KlipyGifResult): GifData => {
  const SIZE_LIMIT = 3 * 1024 * 1024; // 3MB

  const formats = klipyResult.files || klipyResult.file || {};
  const mdGif = hasGifVariant(formats.md) ? formats.md.gif : formats.md;
  const preview = formats.xs?.gif || formats.sm?.gif || mdGif;

  let fullRes = formats.hd?.gif;
  if (fullRes && fullRes.size && fullRes.size > SIZE_LIMIT && mdGif) {
    fullRes = mdGif;
  }

  if (!fullRes) {
    fullRes = mdGif || preview;
  }

  const width = fullRes?.width || preview?.width || 0;
  const height = fullRes?.height || preview?.height || 0;

  return {
    id: klipyResult.id,
    title: klipyResult.title || 'GIF',
    url: fullRes?.url || '',
    preview_url: preview?.url || fullRes?.url || '',
    width,
    height,
  };
};

const hasUsableGifUrl = (gif: GifData): boolean =>
  gif.url.trim().length > 0 || !!gif.preview_url?.trim();

const POPULAR_GIF_SEARCH_TERMS = [
  'kiss',
  'love',
  'happy',
  'lol',
  'good morning',
  'good night',
  'confused',
  'sad',
] as const;

function useGifSearch(
  favoriteGifs: GifData[],
  gifSearch: (query: string) => void,
  klipyApiKey: string,
  gifsEnabled: boolean
) {
  const [gifs, setGifs] = useState<{
    gifs: GifData[];
    favorites: GifData[];
  }>({
    gifs: [],
    favorites: favoriteGifs,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    setGifs((old) => ({
      ...old,
      favorites: favoriteGifs,
    }));
  }, [favoriteGifs]);

  const resetSearchGifs = useCallback(() => {
    requestIdRef.current += 1;
    setLoading(false);
    setError(null);
    setGifs((old) => ({
      ...old,
      gifs: [],
    }));
  }, []);

  const searchGifs = useCallback(
    async (query: string) => {
      const trimmedQuery = query.trim();
      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;

      if (!gifsEnabled) {
        setLoading(false);
        setError('GIF search is not configured');
        setGifs((old) => ({
          ...old,
          gifs: [],
        }));
        return;
      }

      setLoading(true);
      setError(null);
      setGifs((old) => ({
        ...old,
        gifs: [],
      }));

      gifSearch(trimmedQuery);

      const searchStartedAt = performance.now();
      try {
        const url = new URL('https://api.klipy.com');
        url.pathname = `/api/v1/${klipyApiKey}/gifs/search`;
        url.searchParams.set('q', trimmedQuery);
        url.searchParams.set('per_page', '50');

        const response = await fetch(url.toString());

        if (response.status === 200) {
          const data = await response.json();
          const results = data.data.data as KlipyGifResult[] | undefined;
          if (requestIdRef.current !== requestId) {
            recordGifSearchMs(performance.now() - searchStartedAt, { result: 'cancelled' });
            return;
          }

          recordGifSearchMs(performance.now() - searchStartedAt, { result: 'ok' });
          setGifs((old) => ({
            ...old,
            gifs: results ? results.map(parseKlipyResult).filter(hasUsableGifUrl) : [],
          }));
        } else {
          throw new Error(`HTTP ${response.status}`);
        }
      } catch (err) {
        if (requestIdRef.current !== requestId) return;
        recordGifSearchMs(performance.now() - searchStartedAt, { result: 'error' });
        captureGifSearchError(err, trimmedQuery);
        setError('Failed to search GIFs');
        setGifs((old) => ({
          ...old,
          gifs: [],
        }));
      } finally {
        if (requestIdRef.current === requestId) {
          setLoading(false);
        }
      }
    },
    [gifSearch, gifsEnabled, klipyApiKey]
  );

  return { gifs, loading, error, searchGifs, resetSearchGifs };
}

// Module-level cache so discovery results survive tab switches and re-mounts.
const gifDiscoveryCache = new Map<string, GifDiscoveryItem[]>();

function useGifDiscovery(klipyApiKey: string, gifsEnabled: boolean, active: boolean) {
  const [items, setItems] = useState<GifDiscoveryItem[]>(
    POPULAR_GIF_SEARCH_TERMS.map((term) => ({ term }))
  );
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (!active || !gifsEnabled) {
      setItems(POPULAR_GIF_SEARCH_TERMS.map((term) => ({ term })));
      return undefined;
    }

    const cached = gifDiscoveryCache.get(klipyApiKey);
    if (cached) {
      recordGifDiscoveryMs(0, { cached: true });
      setItems(cached);
      return undefined;
    }

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    let cancelled = false;
    const discoveryStartedAt = performance.now();

    Promise.all(
      POPULAR_GIF_SEARCH_TERMS.map(async (term) => {
        try {
          const url = new URL('https://api.klipy.com');
          url.pathname = `/api/v1/${klipyApiKey}/gifs/search`;
          url.searchParams.set('q', term);
          url.searchParams.set('per_page', '1');

          const response = await fetch(url.toString());
          if (response.status !== 200) return { term };

          const data = await response.json();
          const result = (data.data.data as KlipyGifResult[] | undefined)?.[0];
          const gif = result ? parseKlipyResult(result) : undefined;
          return gif && hasUsableGifUrl(gif) ? { term, gif } : { term };
        } catch (err) {
          captureGifDiscoveryError(err, term);
          return { term };
        }
      })
    ).then((results) => {
      if (cancelled || requestIdRef.current !== requestId) return;
      recordGifDiscoveryMs(performance.now() - discoveryStartedAt, { cached: false });
      gifDiscoveryCache.set(klipyApiKey, results);
      setItems(results);
    });

    return () => {
      cancelled = true;
    };
  }, [active, gifsEnabled, klipyApiKey]);

  return items;
}

const useGroups = (
  tab: EmojiBoardTab,
  imagePacks: ImagePack[],
  data: {
    gifs: GifData[];
    favorites: GifData[];
  }
): [EmojiGroupItem[], StickerGroupItem[], GifGroupItem[]] => {
  const mx = useMatrixClient();

  const recentEmojis = useRecentEmoji(mx, 21);
  const labels = useEmojiGroupLabels();

  const emojiGroupItems = useMemo(() => {
    const g: EmojiGroupItem[] = [];
    if (tab !== EmojiBoardTab.Emoji) return g;

    g.push({
      id: RECENT_GROUP_ID,
      name: 'Recent',
      items: recentEmojis,
    });

    imagePacks.forEach((pack) => {
      let label = pack.meta.name;
      if (!label) label = isUserId(pack.id) ? 'Personal Pack' : mx.getRoom(pack.id)?.name;

      g.push({
        id: pack.id,
        name: label ?? 'Unknown',
        items: pack
          .getImages(ImageUsage.Emoticon)
          .toSorted((a, b) => a.shortcode.localeCompare(b.shortcode)),
      });
    });

    emojiGroups.forEach((group) => {
      g.push({
        id: group.id,
        name: labels[group.id],
        items: group.emojis,
      });
    });

    return g;
  }, [mx, recentEmojis, labels, imagePacks, tab]);

  const stickerGroupItems = useMemo(() => {
    const g: StickerGroupItem[] = [];
    if (tab !== EmojiBoardTab.Sticker) return g;

    imagePacks.forEach((pack) => {
      let label = pack.meta.name;
      if (!label) label = isUserId(pack.id) ? 'Personal Pack' : mx.getRoom(pack.id)?.name;

      g.push({
        id: pack.id,
        name: label ?? 'Unknown',
        items: pack
          .getImages(ImageUsage.Sticker)
          .toSorted((a, b) => a.shortcode.localeCompare(b.shortcode)),
      });
    });

    return g;
  }, [mx, imagePacks, tab]);

  const gifGroupItems = useMemo(() => {
    if (tab !== EmojiBoardTab.Gif) return [];
    return [
      {
        id: 'gif_group',
        name: 'GIFs',
        items: data.gifs,
      },
    ];
  }, [tab, data]);

  return [emojiGroupItems, stickerGroupItems, gifGroupItems];
};

const useItemRenderer = (tab: EmojiBoardTab, saveStickerEmojiBandwidth: boolean) => {
  const mx = useMatrixClient();
  const useAuthentication = useMediaAuthentication();

  const renderItem = (item: IEmoji | PackImageReader | GifData, index: number) => {
    if (tab === EmojiBoardTab.Gif) {
      const gif = item as GifData;

      let initialGifUrl = gif.preview_url ?? gif.url;
      let gifUrl = initialGifUrl.startsWith('mxc://')
        ? (mxcUrlToHttp(mx, initialGifUrl, useAuthentication) ?? '')
        : initialGifUrl;
      const aspectRatio =
        gif.width && gif.height && gif.width > 0 && gif.height > 0
          ? `${gif.width} / ${gif.height}`
          : '1 / 1';

      return (
        <GifItem
          key={`${gif.id ?? gif.url}:${index}`}
          label={gif.title}
          type={EmojiType.Gif}
          data={gif.url}
          shortcode={gif.title}
          gif={gif}
          style={{ aspectRatio }}
        >
          <AuthenticatedImg
            loading="lazy"
            alt=""
            aria-hidden
            src={gifUrl}
            style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </GifItem>
      );
    }

    if ('unicode' in item) {
      return <EmojiItem key={item.unicode + index} emoji={item} />;
    }

    const emoji = item as PackImageReader;

    if (tab === EmojiBoardTab.Sticker) {
      return (
        <StickerItem
          key={emoji.shortcode + index}
          mx={mx}
          useAuthentication={useAuthentication}
          image={emoji}
          saveStickerEmojiBandwidth={saveStickerEmojiBandwidth}
        />
      );
    }
    return (
      <CustomEmojiItem
        key={emoji.shortcode + index}
        mx={mx}
        useAuthentication={useAuthentication}
        image={emoji}
        saveStickerEmojiBandwidth={saveStickerEmojiBandwidth}
      />
    );
  };

  return renderItem;
};

type EmojiSidebarPinnedProps = {
  activeGroupAtom: PrimitiveAtom<string | undefined>;
  packs: ImagePack[];
  saveStickerEmojiBandwidth: boolean;
  onScrollToGroup: (groupId: string) => void;
};
// All emoji sidebar navigation is pinned outside the shared scroll so it is
// always reachable regardless of scroll position. Recent + custom packs are
// rendered above the standard emoji-group categories.
//
// Previously EmojiSidebar (Recent + packs) lived inside the shared
// content+sidebar scroll while EmojiSidebarPinned (standard groups) was
// pinned via position:absolute at the bottom. The pinned footer (~380 px
// for 9 groups) covered the full height of the 450 px picker, hiding user
// pack icons entirely — issue #520.
function EmojiSidebarPinned({
  activeGroupAtom,
  packs,
  saveStickerEmojiBandwidth,
  onScrollToGroup,
}: Readonly<EmojiSidebarPinnedProps>) {
  const mx = useMatrixClient();
  const useAuthentication = useMediaAuthentication();
  const [activeGroupId, setActiveGroupId] = useAtom(activeGroupAtom);
  const labels = useEmojiGroupLabels();
  const icons = useEmojiGroupIcons();
  const usage = ImageUsage.Emoticon;

  const handleScrollToGroup = (groupId: string) => {
    setActiveGroupId(groupId);
    onScrollToGroup(groupId);
  };

  return (
    <Sidebar>
      {/* Recent + user packs — above the standard groups so they are never
          obscured by the pinned footer itself. PinnedSidebarFooter already
          has overflowY:auto so the whole column scrolls if packs overflow. */}
      <SidebarStack>
        <GroupIcon
          active={activeGroupId === RECENT_GROUP_ID}
          id={RECENT_GROUP_ID}
          label="Recent"
          icon={ClockCounterClockwise}
          onClick={handleScrollToGroup}
        />
      </SidebarStack>
      {packs.length > 0 && (
        <SidebarStack>
          <SidebarDivider />
          {packs.map((pack) => {
            let label = pack.meta.name;
            if (!label) label = isUserId(pack.id) ? 'Personal Pack' : mx.getRoom(pack.id)?.name;

            // Limit to 36 px to prevent oversized custom pack icons breaking layout.
            const url = saveStickerEmojiBandwidth
              ? mxcUrlToHttp(mx, pack.getAvatarUrl(usage) ?? '', useAuthentication, 36, 36)
              : mxcUrlToHttp(mx, pack.getAvatarUrl(usage) ?? '', useAuthentication);

            return (
              <ImageGroupIcon
                key={pack.id}
                active={activeGroupId === pack.id}
                id={pack.id}
                label={label ?? 'Unknown Pack'}
                url={url ?? undefined}
                onClick={handleScrollToGroup}
              />
            );
          })}
        </SidebarStack>
      )}
      {/* Standard emoji-group categories below */}
      <SidebarStack>
        <SidebarDivider />
        {emojiGroups.map((group) => (
          <GroupIcon
            key={group.id}
            active={activeGroupId === group.id}
            id={group.id}
            label={labels[group.id]}
            icon={icons[group.id]}
            onClick={handleScrollToGroup}
          />
        ))}
      </SidebarStack>
    </Sidebar>
  );
}

type StickerSidebarProps = {
  activeGroupAtom: PrimitiveAtom<string | undefined>;
  packs: ImagePack[];
  saveStickerEmojiBandwidth: boolean;
  onScrollToGroup: (groupId: string) => void;
};
function StickerSidebar({
  activeGroupAtom,
  packs,
  saveStickerEmojiBandwidth,
  onScrollToGroup,
}: Readonly<StickerSidebarProps>) {
  const mx = useMatrixClient();
  const useAuthentication = useMediaAuthentication();

  const [activeGroupId, setActiveGroupId] = useAtom(activeGroupAtom);
  const usage = ImageUsage.Sticker;

  const handleScrollToGroup = (groupId: string) => {
    setActiveGroupId(groupId);
    onScrollToGroup(groupId);
  };

  return (
    <Sidebar>
      <SidebarStack>
        {packs.map((pack) => {
          let label = pack.meta.name;
          if (!label) label = isUserId(pack.id) ? 'Personal Pack' : mx.getRoom(pack.id)?.name;

          // limit width and height to 36 to prevent very large icons from breaking the layout, since custom emoji pack icons can be of any size
          // trying to get close to the render target size of the icons in the sidebar, which is around 24px
          const url = saveStickerEmojiBandwidth
            ? mxcUrlToHttp(mx, pack.getAvatarUrl(usage) ?? '', useAuthentication, 36, 36)
            : mxcUrlToHttp(mx, pack.getAvatarUrl(usage) ?? '', useAuthentication);

          return (
            <ImageGroupIcon
              key={pack.id}
              active={activeGroupId === pack.id}
              id={pack.id}
              label={label ?? 'Unknown Pack'}
              url={url ?? undefined}
              onClick={handleScrollToGroup}
            />
          );
        })}
      </SidebarStack>
    </Sidebar>
  );
}