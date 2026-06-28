import { beforeEach, describe, expect, it } from 'vitest';
import { createStore } from 'jotai';
import {
  getRoomToParentsCacheKey,
  roomToParentsAtom,
  roomToParentsCacheKeyAtom,
  roomToParentsReadyAtom,
} from './roomToParents';

describe('roomToParents cache scoping', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('writes room hierarchy caches under the active user key', () => {
    const store = createStore();
    const aliceCacheKey = getRoomToParentsCacheKey('@alice:example.com');
    const bobCacheKey = getRoomToParentsCacheKey('@bob:example.com');

    store.set(roomToParentsCacheKeyAtom, aliceCacheKey);
    store.set(roomToParentsAtom, {
      type: 'INITIALIZE',
      roomToParents: new Map([['!room:example.com', new Set(['!space:example.com'])]]),
    });

    store.set(roomToParentsCacheKeyAtom, bobCacheKey);
    store.set(roomToParentsAtom, {
      type: 'INITIALIZE',
      roomToParents: new Map([['!dm:example.com', new Set(['!space:other.com'])]]),
    });

    expect(localStorage.getItem(aliceCacheKey)).toBe(
      JSON.stringify([['!room:example.com', ['!space:example.com']]])
    );
    expect(localStorage.getItem(bobCacheKey)).toBe(
      JSON.stringify([['!dm:example.com', ['!space:other.com']]])
    );
    expect(localStorage.getItem('roomToParents')).toBeNull();
  });

  it('does not migrate legacy shared caches into a different user scope', () => {
    const store = createStore();
    const bobCacheKey = getRoomToParentsCacheKey('@bob:example.com');

    localStorage.setItem(
      'roomToParents',
      JSON.stringify([['!room:example.com', ['!space:example.com']]])
    );

    store.set(roomToParentsCacheKeyAtom, bobCacheKey);
    store.set(roomToParentsAtom, {
      type: 'INITIALIZE',
      roomToParents: new Map(),
    });

    expect(localStorage.getItem(bobCacheKey)).toBe(JSON.stringify([]));
    expect(localStorage.getItem('roomToParents')).toBeNull();
  });

  it('clears stale in-memory hierarchy when a scoped cache initializes empty', () => {
    const store = createStore();
    const aliceCacheKey = getRoomToParentsCacheKey('@alice:example.com');
    const bobCacheKey = getRoomToParentsCacheKey('@bob:example.com');

    store.set(roomToParentsCacheKeyAtom, aliceCacheKey);
    store.set(roomToParentsAtom, {
      type: 'INITIALIZE',
      roomToParents: new Map([['!room:example.com', new Set(['!space:example.com'])]]),
    });

    store.set(roomToParentsCacheKeyAtom, bobCacheKey);
    store.set(roomToParentsAtom, {
      type: 'INITIALIZE',
      roomToParents: new Map(),
    });

    expect(store.get(roomToParentsAtom)).toEqual(new Map());
    expect(localStorage.getItem(bobCacheKey)).toBe(JSON.stringify([]));
  });

  it('drops stale in-memory hierarchy and readiness when switching scopes before hydrate', () => {
    const store = createStore();
    const aliceCacheKey = getRoomToParentsCacheKey('@alice:example.com');
    const bobCacheKey = getRoomToParentsCacheKey('@bob:example.com');

    store.set(roomToParentsCacheKeyAtom, aliceCacheKey);
    store.set(roomToParentsAtom, {
      type: 'INITIALIZE',
      roomToParents: new Map([['!room:example.com', new Set(['!space:example.com'])]]),
    });

    expect(store.get(roomToParentsReadyAtom)).toBe(true);

    store.set(roomToParentsCacheKeyAtom, bobCacheKey);
    store.set(roomToParentsAtom, { type: 'RESET' });

    expect(store.get(roomToParentsAtom)).toEqual(new Map());
    expect(store.get(roomToParentsReadyAtom)).toBe(false);
    expect(localStorage.getItem(bobCacheKey)).toBeNull();
  });
});
