---
default: patch
---

Fix a bootstrap race that could send you to the home screen instead of the room from a tapped push notification: the launch-target recovery is now awaited by the router before any redirect decision is made, instead of racing a separate default-landing redirect.
