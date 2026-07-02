---
default: patch
---

Fix buttons requiring multiple taps on mobile by skipping pre-lift layout update when the tapped target is an interactive element (button, input, etc.). The pre-lift state update was shifting layout between pointerdown and click, causing iOS to miss the click.
