# XPENG Dashboard changelog

## Dashboard v0.1.1 — 2026-10-11 (initial multi-model release)

- Support 53 manual model-year appearance profiles across 16 catalogue entries (including generic/research profiles).
- Only the Home Assistant card editor controls model, year, trim, exterior paint, interior finish, and 15 manual sensor mappings.
- Unmapped telemetry is resolved automatically from HA entities; missing sensors remain unavailable.
- Keep exactly two auto-switching screens (Vehicle status and Charging), full-screen mode, and a small metadata icon replacing the Last update label.
- Bundle year/colour G6 2026 art with transparent backgrounds and capture actual desktop/mobile browser screenshots using labelled demo readings.
- Guarantee an illustration or clearly marked silhouette for every offered profile, **without claiming exact factory-year imagery where unverified**.
- Remain fully separate from the XPENG integration/backend.


## Dashboard v0.1.0 — 2026-10-11

- Establish a new **dashboard-only** baseline independent of the XPENG vehicle integration.
- Replace all old frontend pages with precisely two screens: Vehicle status and Charging.
- Auto-switch screens using the Home Assistant charging binary sensor.
- Retain battery, estimated range, odometer, average tire pressure, location, charging power, charging ETA and charge target when the corresponding entities exist.
- Implement full-viewport presentation, responsive desktop/mobile UI and a night/mountain visual inspired by the supplied reference images.
- Remove old detailed climate, doors, controls, seats, location-map, tire-detail and settings screens, including old navigation menus.
- Keep vehicle and image configuration in the card editor only; never fabricate data or enable unverified remote controls.
- Preserve the existing Git history for rollback. Previous tag numbering relates to earlier dashboard prototypes, not to the separate XPENG integration.
