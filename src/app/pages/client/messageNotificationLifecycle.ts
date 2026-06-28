export type MessageNotificationLifecycleState = {
  suppressForFocusedNotification: boolean;
  tabVisible: boolean;
};

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
