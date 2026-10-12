# XPENG Dashboard changelog

## v1.0.0-beta.1 — initial beta candidate (2026-10-12)

- Removed the temporary `mix-blend-mode: multiply` vehicle-layer workaround so the new transparent/front artwork renders normally over the approved background; `src` and `dist` remain synchronized.
- First beta candidate of the standalone XPENG Home Assistant dashboard card (frontend only).
- Vehicle status and sensor-driven charging view; owner-approved lakeside background and G6 artwork for front, charging and overhead views.
- Includes merged [PR #28](https://github.com/matanmesika/xpeng-vehicle-card/pull/28) updating the G6 front three-quarter WebP image.
- HACS entry point: `dist/xpeng-vehicle-card.js` as declared by `hacs.json`.
- **Beta limitations:** actual Home Assistant/HACS installation and responsive visual acceptance are not yet verified; remote GitHub artwork requires network access; not every XPENG model/color has verified artwork.
- **Publication status:** candidate documented in `main`; GitHub tag/Release must be published separately. Do not treat this heading as evidence of a published release.

## Unreleased — G6 front artwork refresh (2026-10-12)

- Merged [PR #28](https://github.com/matanmesika/xpeng-vehicle-card/pull/28) into `main` (commit `17fd199`), replacing `assets/vehicles/g6/2026/core_performance_awd/front.webp` with the user-uploaded front three-quarter view.
- Retained the existing approved lakeside backdrop, charging artwork and overhead artwork without changes in this PR.
- Aligned `model-artwork.json` and `vehicle-art-inventory.json` with the existing runtime artwork paths.
- This is a repository update, **not a new GitHub Release**. The image is loaded from GitHub at runtime; the frontend JavaScript bundle and HACS release artifact were not rebuilt for this change.
- Visual verification in a live Home Assistant dashboard and CI checks for this merge are still outstanding.

## v1.0.0-alpha.6 — UI-only prerelease planned (2026-10-12)

- Simplify all vehicle illustrations to **one highest-available-trim image per model+exterior colour**, shared across every year and selected trim. Trim selections carry no visual effect; year affects only trim names.
- Replace the old model/year/trim/shape image chooser with the model+paint mapping in `model-artwork.json`; keep available year ranges in the editor.
- Keep the owner-approved lakeside photo separate from car layers in Vehicle status, Charging and Tire pressures.
- Add full-size Tire pressure detail mode: overhead car with independent FL/FR/RL/RR sensor readings in bar and Back to vehicle.
- Put live connection indicator and info icon on one responsive header row. Popup **closed by default**, opens only on info click, displays **Connection and Last vehicle update only**, closes on second click.
- Remove unused legacy info/tire-popup CSS and update contributor/user documentation to the current product rules.
- Preserve all sensor readings as read-only and keep XPENG integration backend unchanged.
- **Car files not changed:** No new/replaced vehicle or backdrop image binaries. The existing images may be illustrative/unverified. Real licensed highest-trim G6 images, rear/top assets, real-HA testing and owner visual sign-off remain a separate follow-up.

## Published prerelease — v1.0.0-alpha.5 (2026-10-12)

- Package the approved landscape and existing G6/G9 vehicle image assets as direct HACS downloadable files; this release does **not** include the unreleased changes above.

## Dashboard v0.1.0 — 2026-10-11

- Establish a new **dashboard-only** baseline independent of the XPENG vehicle integration.
- Replace old frontend pages with Vehicle status and Charging.
- Auto-switch charging screen using a mapped Home Assistant charging sensor.
- Retain battery/range, odometer, tire-pressure, location and charging telemetry only when HA entities provide real data.
- Preserve Git history for rollback and separate the frontend version from backend integration versions.
