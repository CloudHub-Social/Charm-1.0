import { useMemo } from 'react';
import type { AccountDataEvents } from '$types/matrix-sdk';
import type { GifData } from '$components/emoji-board/types';
import { MATRIX_SABLE_UNSTABLE_FAVORITE_GIFS } from '../../unstable/prefixes';
import { useAccountData } from './useAccountData';

const isValidFavoriteGif = (
  value: unknown
): value is Partial<GifData> & { url: string; title: string } => {
  if (!value || typeof value !== 'object') return false;

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.url === 'string' &&
    candidate.url.length > 0 &&
    typeof candidate.title === 'string'
  );
};

export const useFavoriteGifs =
  (): AccountDataEvents[typeof MATRIX_SABLE_UNSTABLE_FAVORITE_GIFS] => {
    const favoritedGifsData = useAccountData(MATRIX_SABLE_UNSTABLE_FAVORITE_GIFS);
    const favoritedContent = useMemo(() => {
      const content: Partial<AccountDataEvents[typeof MATRIX_SABLE_UNSTABLE_FAVORITE_GIFS]> =
        favoritedGifsData?.getContent<
          AccountDataEvents[typeof MATRIX_SABLE_UNSTABLE_FAVORITE_GIFS]
        >() ?? {};
      const gifs = Array.isArray(content.gifs) ? content.gifs.filter(isValidFavoriteGif) : [];

      return {
        ...content,
        gifs,
      };
    }, [favoritedGifsData]);

    return useMemo(
      () => ({
        ...favoritedContent,
        gifs: favoritedContent.gifs.map((gif) => ({
          ...gif,
          id: gif.id ?? gif.url,
        })),
      }),
      [favoritedContent]
    );
  };
