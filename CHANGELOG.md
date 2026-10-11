# XPENG Dashboard changelog

## Dashboard v0.1.0 — 2026-10-11

- Establish a new **dashboard-only** baseline independent of the XPENG vehicle integration.
- Replace all old frontend pages with precisely two screens: Vehicle status and Charging.
- Auto-switch screens using the Home Assistant charging binary sensor.
- Retain battery, estimated range, odometer, average tire pressure, location, charging power, charging ETA and charge target when the corresponding entities exist.
- Implement full-viewport presentation, responsive desktop/mobile UI and a night/mountain visual inspired by the supplied reference images.
- Remove old detailed climate, doors, controls, seats, location-map, tire-detail and settings screens, including old navigation menus.
- Keep vehicle and image configuration in the card editor only; never fabricate data or enable unverified remote controls.
- Preserve the existing Git history for rollback. Previous tag numbering relates to earlier dashboard prototypes, not to the separate XPENG integration.
