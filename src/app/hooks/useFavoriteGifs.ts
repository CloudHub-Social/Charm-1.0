import { useMemo } from 'react';
import type { AccountDataEvents } from 'matrix-js-sdk';
import { MATRIX_SABLE_UNSTABLE_FAVORITE_GIFS } from '../../unstable/prefixes';
import { useAccountData } from './useAccountData';

export const useFavoriteGifs =
  (): AccountDataEvents[typeof MATRIX_SABLE_UNSTABLE_FAVORITE_GIFS] => {
    const favoritedGifsData = useAccountData(MATRIX_SABLE_UNSTABLE_FAVORITE_GIFS);
    const favoritedContent = useMemo(() => {
      const content: Partial<AccountDataEvents[typeof MATRIX_SABLE_UNSTABLE_FAVORITE_GIFS]> =
        favoritedGifsData?.getContent<
          AccountDataEvents[typeof MATRIX_SABLE_UNSTABLE_FAVORITE_GIFS]
        >() ?? {};
      const gifs = Array.isArray(content.gifs) ? content.gifs : [];

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
