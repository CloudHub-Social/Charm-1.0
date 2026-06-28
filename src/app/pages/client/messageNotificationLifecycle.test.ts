import { describe, expect, it } from 'vitest';
import {
  createMessageNotificationLifecycleState,
  getMessageNotificationLifecycleState,
  resolveMessageNotificationLifecycleState,
} from './messageNotificationLifecycle';

describe('messageNotificationLifecycle', () => {
  it('captures the arrival-time focus suppression and tab visibility state together', () => {
    expect(
      createMessageNotificationLifecycleState({
        notificationSelected: true,
        tabVisible: false,
        windowFocused: true,
      })
    ).toEqual({
      suppressForFocusedNotification: true,
      tabVisible: false,
    });
  });

  it('reuses the encrypted event arrival lifecycle state during decrypt replay', () => {
    const arrivalState = createMessageNotificationLifecycleState({
      notificationSelected: false,
      tabVisible: true,
      windowFocused: false,
    });
    const decryptState = createMessageNotificationLifecycleState({
      notificationSelected: false,
      tabVisible: false,
      windowFocused: false,
    });

    expect(
      resolveMessageNotificationLifecycleState({
        capturedState: arrivalState,
        currentState: decryptState,
      })
    ).toEqual(arrivalState);
  });

  it('stores encrypted arrival state before a suppression return so later replay stays suppressed', () => {
    const lifecycleStateMap = new Map();
    const arrivalState = createMessageNotificationLifecycleState({
      notificationSelected: true,
      tabVisible: true,
      windowFocused: true,
    });

    expect(
      getMessageNotificationLifecycleState({
        currentState: arrivalState,
        eventId: '$event',
        isEncryptedArrival: true,
        lifecycleStateMap,
      })
    ).toEqual(arrivalState);
    expect(lifecycleStateMap.get('$event')).toEqual(arrivalState);

    const replayState = createMessageNotificationLifecycleState({
      notificationSelected: false,
      tabVisible: false,
      windowFocused: false,
    });

    expect(
      getMessageNotificationLifecycleState({
        currentState: replayState,
        eventId: '$event',
        isEncryptedArrival: false,
        lifecycleStateMap,
      })
    ).toEqual(arrivalState);
    expect(lifecycleStateMap.has('$event')).toBe(false);
  });

  it('clears captured encrypted lifecycle state on the first non-encrypted replay', () => {
    const lifecycleStateMap = new Map();
    const arrivalState = createMessageNotificationLifecycleState({
      notificationSelected: false,
      tabVisible: true,
      windowFocused: false,
    });

    getMessageNotificationLifecycleState({
      currentState: arrivalState,
      eventId: '$event',
      isEncryptedArrival: true,
      lifecycleStateMap,
    });

    const replayState = createMessageNotificationLifecycleState({
      notificationSelected: false,
      tabVisible: false,
      windowFocused: false,
    });

    expect(
      getMessageNotificationLifecycleState({
        currentState: replayState,
        eventId: '$event',
        isEncryptedArrival: false,
        lifecycleStateMap,
      })
    ).toEqual(arrivalState);
    expect(lifecycleStateMap.has('$event')).toBe(false);
  });

  it('falls back to the current lifecycle state for unencrypted events', () => {
    const currentState = createMessageNotificationLifecycleState({
      notificationSelected: false,
      tabVisible: false,
      windowFocused: false,
    });

    expect(
      resolveMessageNotificationLifecycleState({
        capturedState: undefined,
        currentState,
      })
    ).toEqual(currentState);
  });

  it('does not store lifecycle state for unencrypted arrivals', () => {
    const lifecycleStateMap = new Map();
    const currentState = createMessageNotificationLifecycleState({
      notificationSelected: false,
      tabVisible: true,
      windowFocused: false,
    });

    expect(
      getMessageNotificationLifecycleState({
        currentState,
        eventId: '$event',
        isEncryptedArrival: false,
        lifecycleStateMap,
      })
    ).toEqual(currentState);
    expect(lifecycleStateMap.has('$event')).toBe(false);
  });
});
