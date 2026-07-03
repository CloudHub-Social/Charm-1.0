import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PersistedLaunchContext } from '../../launch-context-persistence';

const { mockConsumeLaunchContext } = vi.hoisted(() => ({
  mockConsumeLaunchContext: vi.fn<() => Promise<PersistedLaunchContext | undefined>>(),
}));

vi.mock('../../launch-context-persistence', () => ({
  consumeLaunchContext: mockConsumeLaunchContext,
}));

const { recoverNotificationLaunchPath } = await import('./notificationLaunchRecovery');

describe('recoverNotificationLaunchPath', () => {
  const originalLocation = window.location;

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    });
    mockConsumeLaunchContext.mockReset();
  });

  it('returns undefined when there is no persisted launch context', async () => {
    mockConsumeLaunchContext.mockResolvedValue(undefined);

    await expect(recoverNotificationLaunchPath()).resolves.toBeUndefined();
  });

  it('returns undefined when the launch context has no targetUrl', async () => {
    mockConsumeLaunchContext.mockResolvedValue({
      source: 'notification_click',
      clickedAt: Date.now(),
    });

    await expect(recoverNotificationLaunchPath()).resolves.toBeUndefined();
  });

  it('resolves the in-app path for a fresh, same-origin launch context', async () => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: new URL('https://charm.example/#/app/home'),
    });
    mockConsumeLaunchContext.mockResolvedValue({
      source: 'notification_click',
      clickedAt: Date.now(),
      userId: '@alice:example.org',
      roomId: '!room:example.org',
      targetUrl: 'https://charm.example/#/app/to/%40alice%3Aexample.org/!room%3Aexample.org',
    });

    await expect(
      recoverNotificationLaunchPath({ enabled: true, basename: '/app' })
    ).resolves.toEqual({
      path: '/to/%40alice%3Aexample.org/!room%3Aexample.org',
      launchAgeMs: expect.any(Number),
      hasUserId: true,
      hasRoomId: true,
      hasEventId: false,
    });
  });

  it('returns undefined once the launch context is older than 15 seconds', async () => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: new URL('https://charm.example/#/app/home'),
    });
    mockConsumeLaunchContext.mockResolvedValue({
      source: 'notification_click',
      clickedAt: Date.now() - 20_000,
      targetUrl: 'https://charm.example/#/app/to/%40alice%3Aexample.org/!room%3Aexample.org',
    });

    await expect(
      recoverNotificationLaunchPath({ enabled: true, basename: '/app' })
    ).resolves.toBeUndefined();
  });

  it('returns undefined for a cross-origin targetUrl', async () => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: new URL('https://charm.example/#/app/home'),
    });
    mockConsumeLaunchContext.mockResolvedValue({
      source: 'notification_click',
      clickedAt: Date.now(),
      targetUrl: 'https://attacker.example/#/app/to/%40alice%3Aexample.org/!room%3Aexample.org',
    });

    await expect(
      recoverNotificationLaunchPath({ enabled: true, basename: '/app' })
    ).resolves.toBeUndefined();
  });
});
