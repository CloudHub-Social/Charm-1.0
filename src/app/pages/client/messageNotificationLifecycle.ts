export type MessageNotificationLifecycleState = {
  suppressForFocusedNotification: boolean;
  tabVisible: boolean;
};

export type MessageNotificationLifecycleStateMap = Map<string, MessageNotificationLifecycleState>;

export const createMessageNotificationLifecycleState = ({
  notificationSelected,
  tabVisible,
  windowFocused,
}: {
  notificationSelected: boolean;
  tabVisible: boolean;
  windowFocused: boolean;
}): MessageNotificationLifecycleState => ({
  suppressForFocusedNotification: windowFocused && notificationSelected,
  tabVisible,
});

export const resolveMessageNotificationLifecycleState = ({
  capturedState,
  currentState,
}: {
  capturedState?: MessageNotificationLifecycleState;
  currentState: MessageNotificationLifecycleState;
}): MessageNotificationLifecycleState => capturedState ?? currentState;

export const getMessageNotificationLifecycleState = ({
  currentState,
  eventId,
  isEncryptedArrival,
  lifecycleStateMap,
}: {
  currentState: MessageNotificationLifecycleState;
  eventId?: string | null;
  isEncryptedArrival: boolean;
  lifecycleStateMap: MessageNotificationLifecycleStateMap;
}): MessageNotificationLifecycleState => {
  const capturedState = eventId ? lifecycleStateMap.get(eventId) : undefined;
  if (!capturedState && eventId && isEncryptedArrival) {
    lifecycleStateMap.set(eventId, currentState);
  }

  return resolveMessageNotificationLifecycleState({
    capturedState,
    currentState,
  });
};
