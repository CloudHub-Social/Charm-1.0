---
'charm': patch
---

fix(mobile): stop the Home/Direct/Space room lists from clearing and re-rendering for ~half a second every time they are opened. The mobile nav was kept mounted but `display: none` while hidden, which collapsed the virtualized list's scroll element to zero height and forced a full re-measure/re-render on reveal. Unmount the off-route nav on mobile instead so it mounts at the correct size and renders correctly on first paint (#482).
