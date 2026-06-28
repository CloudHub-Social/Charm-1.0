import { describe, expect, it } from 'vitest';
import {
  createMessageNotificationLifecycleState,
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
});
