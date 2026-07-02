---
default: patch
---

Fix soft keyboard overlapping the timeline when selecting from autocomplete menus (slash commands, emoji, mentions) on mobile. Autocomplete item buttons now prevent mousedown default, keeping editor focus and the keyboard open during selection.
