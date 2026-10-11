# XPENG Vehicle Card v0.1.0 — Baseline monitor

## One dashboard, two automatic visual states

- Vehicle status: XPENG model illustration, battery %, estimated range, odometer, tire pressure summary, available location.
- Charging: shown only when the charging binary sensor is on and the connection reports online, with charging power, estimated remaining time, target, constant battery/range and an animated energy indication.
- No manual state navigation, sidebar, weather, door/climate controls or bottom status cards. Last update is small and unobtrusive.
- Supports 16 model entries and paint/year/trim selection through Lovelace Edit Card. No in-card configuration controls.
- Dedicated Chromium visual QA screenshots and model artwork duplication audit.

## Limitations
Some model assets use shared generic silhouettes, not photoreal manufacturer-approved depictions. Passing code/geometry tests does not establish visual parity with an image-generation concept.
No verified official consumer XPENG API is available; unsupported telemetry stays unavailable. All test screenshots use test data only.

Use the included dashboards/xpeng-g6-cockpit.yaml for a standalone full-width monitor.
