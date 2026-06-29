const RECENT_GIF_SEARCHES_KEY = 'sable-recent-gif-searches';
const MAX_RECENT_GIF_SEARCHES = 6;

type RecentGifSearchesStore = Record<string, string[]>;

const normalizeGifSearchTerm = (term: string): string => term.trim();

export function getRecentGifSearches(userId: string): string[] {
  try {
    const stored = localStorage.getItem(RECENT_GIF_SEARCHES_KEY);
    if (!stored) return [];

    const data: unknown = JSON.parse(stored);
    if (typeof data !== 'object' || data === null || Array.isArray(data)) return [];

    const userSearches = (data as Record<string, unknown>)[userId];
    if (!Array.isArray(userSearches)) return [];

    return userSearches.filter((search): search is string => typeof search === 'string');
  } catch {
    return [];
  }
}

export function addRecentGifSearch(userId: string, term: string): string[] {
  const normalizedTerm = normalizeGifSearchTerm(term);
  if (!normalizedTerm) return getRecentGifSearches(userId);

  try {
    const stored = localStorage.getItem(RECENT_GIF_SEARCHES_KEY);
    const data: RecentGifSearchesStore = stored ? JSON.parse(stored) : {};

    let userSearches = data[userId] ?? [];
    userSearches = userSearches.filter(
      (search) => normalizeGifSearchTerm(search).toLowerCase() !== normalizedTerm.toLowerCase()
    );
    userSearches.unshift(normalizedTerm);

    if (userSearches.length > MAX_RECENT_GIF_SEARCHES) {
      userSearches = userSearches.slice(0, MAX_RECENT_GIF_SEARCHES);
    }

    data[userId] = userSearches;
    localStorage.setItem(RECENT_GIF_SEARCHES_KEY, JSON.stringify(data));
    return userSearches;
  } catch {
    return getRecentGifSearches(userId);
  }
}
