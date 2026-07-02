---
default: patch
---

Fix mobile audio recorder failing to start or recording silence on the 2nd+ attempt on iOS Safari PWA. An AudioContext is now pre-created and resumed synchronously inside the mic button's onPointerDown handler (within the user-gesture callstack), so iOS permits the context to run when the async recording path later consumes it.
