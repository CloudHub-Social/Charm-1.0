---
default: minor
---

Sync upstream/dev: call stack rewrite, ringtone settings, push notification call handling

- Replaced `useCallSignaling` with upstream's complete rewrite (`useIncomingCallSignaling` + `features/call/*` modules): `callNotificationBridge`, `callIncomingIngress`, `callOutgoingEgress`, `CallEmbed`, `callActiveSession`, `callActiveUtils`, `callIncomingSound`
- Added `incomingCallAtom`, `callSoundBlockedAtom`, `callEmbedStartErrorAtom` to call embed state
- Extended `ToRoomEvent` to resolve incoming calls from URL search params (notification tap-to-answer)
- Added ringtone/ringback settings: `callRingtoneId`, `callRingbackTone`, `callRingtoneVolume`, `callSoundOverrideGlobalNotifications`, `incomingCallSoundEnabled`, `outgoingRingbackEnabled` with migration and sanitization
- Extended push notification `MatrixPushData` with structured `content` (sender_ts, lifetime, call intent, relates_to) and added `isCallNotificationType`/`getCallTiming` helpers
- Added `enableGifPicker` setting (default true)
- Added Mod+B keyboard shortcut to navigate to bookmarks
- Synced `sable-call-embedded` package bump (1.1.4 → 1.1.6 in upstream)
