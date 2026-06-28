import type { AccountDataEvents } from 'matrix-js-sdk';
import { MATRIX_SABLE_UNSTABLE_FAVORITE_GIFS } from '../../unstable/prefixes';
import { useAccountData } from './useAccountData';

export const useFavoriteGifs =
  (): AccountDataEvents[typeof MATRIX_SABLE_UNSTABLE_FAVORITE_GIFS] => {
    const favoritedGifsData = useAccountData(MATRIX_SABLE_UNSTABLE_FAVORITE_GIFS);
    const favoritedContent = favoritedGifsData?.getContent<
      AccountDataEvents[typeof MATRIX_SABLE_UNSTABLE_FAVORITE_GIFS]
    >() ?? { gifs: [] };

    return {
      ...favoritedContent,
      gifs: favoritedContent.gifs.map((gif) => ({
        ...gif,
        id: gif.id ?? gif.url,
      })),
    };
  };
