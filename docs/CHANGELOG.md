# XPENG Dashboard changelog

## v1.0.4 — Stable (2026-10-19)

- Rebuilt one charging-information component for desktop, phone and narrow Sections cards, with true MDI icons and centered icon+label groups.
- Preserved the original G6 scenery, charging pedestal, green cable, vehicle and interior images and all existing supported Xpengtk controls.
- Re-captured the 14-image canonical Chromium gallery, with simulated Home Assistant data, for the GitHub and HACS README.
- Updated English HACS, installation and release documentation; removed obsolete beta publishing workflows, duplicate screenshots and redundant asset placeholders.
- Kept historical releases and artwork provenance records; automated tests cannot replace real vehicle command, GPS and iPhone Safari acceptance.

---


## Unreleased — October 18 owner screenshot fixes

- Replaced ambiguous trunk glyph with official `mdi:car-hatchback`; English action reads **Open Trunk** exactly.
- Responsive maintenance data remains below car/TPMS diagram; iPhone climate panels fit available width without horizontal clipping.
- Seat/wheel heat/vent buttons use transparent backgrounds at real photo positions; touch targets remain functional.
- Dynamic official MDI battery fill/charging icon and red/amber/mint colors reflect live SOC instead of a fixed small icon.
- Diagnostics entity rows fit on single centered pills in scroll area; important explanation stays visible.
- Added missing English Update details translation, removed generic successful-command notice, and reserved room for Home Assistant's host chrome.
- Black Edition selects dark cabin treatment but lacks approved dedicated black exterior/cabin photography; still an **open release blocker** for full authenticity.
- Not yet tagged/released/merged: automated Chromium simulation must be reviewed in real iPhone and Home Assistant first.

## Unreleased — G6 release-readiness, documentation and gallery (2026-10-18)

- Removed the caption over the G6 interior photo in Climate, preserving accessible image alt text and the actual seat/wheel control hotspot labels.
- Refreshed the English/Hebrew README, visual gallery and G6 installation/release-readiness docs to accurately describe Beta 9's no-dashboard-scroll sizing, Wi-Fi centering, location map, diagnostics and supported English UI.
- Re-captured the existing 12 curated desktop and mobile screenshots from the running card in Chromium with synthetic Xpengtk data; standalone native map tiles remain a marked stub.
- Removed discontinued pre-v1 regression tests and obsolete alpha/prerelease publishing workflows. Preserved current frontend tests, HACS build/QA, historical release tags, all vehicle image assets, generation mapping data and artwork/provenance queues.
- Completed **G6 functional UI/entity mapping** (pending real-vehicle acceptance), with a separate outstanding **G6 artwork gap of 3 out of 33 camera views**. Next art characterization priority: remaining XPENG model families, generations, colors and views. No fabricated completeness claims for other vehicles.
- This is **unreleased branch work**. Stable HACS remains `v1.0.3`; the latest published beta is `v1.0.4-beta.9`. No main merge.


## Unreleased — full model/year-group catalog

- Added `data/vehicle-catalog.json` as the canonical model, year-group, trim-title and exterior-colour catalog.
- The card editor now exposes Model, Model years, Trim (display only), Exterior paint and Interior finish.
- Artwork selection is strictly `model + year-group + exterior colour`; trim never changes an image path.
- Consecutive years with the same exterior generation use one range key such as `2023-2025`.
- Prepared the folder convention `assets/vehicles/{model}/{year-group}/{color}/{front,charging,top}.webp`.
- G6 2026 is mapped for Arctic White, Graphite Gray, Midnight Black, Silver Frost, Stellar Purple and Black Edition; Black Edition artwork is still pending a dedicated approved render.
- Historic/market-specific catalog entries that are not fully verified are labelled market-dependent instead of inventing trim claims.

## v1.0.0-beta.2 — model/year/color artwork hierarchy (2026-10-12)

- Standardize vehicle artwork paths as `assets/vehicles/{model}/{year}/{color}/{front,charging,top}.webp`.
- Remove trim from the artwork filesystem hierarchy and runtime image lookup.
- Move the current G6 Graphite Gray assets to `assets/vehicles/g6/2026/graphite_gray/`.
- Keep the approved lakeside dashboard background unchanged.
- Keep `src` and `dist` synchronized and retain normal image compositing without the temporary multiply blend.
- Prepare a dedicated beta prerelease workflow for this version.

## v1.0.0-beta.1 — initial beta candidate (2026-10-12)

- Artwork hierarchy corrected to `assets/vehicles/{model}/{year}/{color}/...`; removed trim from vehicle-image paths and moved the G6 Graphite Gray set to `assets/vehicles/g6/2026/graphite_gray/`.
- Repository cleanup: removed obsolete `RELEASE_NOTES_*.md` files, moved project/reference documents under `docs/`, removed obsolete alpha-specific workflows, and consolidated publishing around a single beta prerelease workflow.
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
- Aligned `data/model-artwork.json` and `data/vehicle-art-inventory.json` with the existing runtime artwork paths.
- This is a repository update, **not a new GitHub Release**. The image is loaded from GitHub at runtime; the frontend JavaScript bundle and HACS release artifact were not rebuilt for this change.
- Visual verification in a live Home Assistant dashboard and CI checks for this merge are still outstanding.

## v1.0.0-alpha.6 — UI-only prerelease planned (2026-10-12)

- Simplify all vehicle illustrations to **one highest-available-trim image per model+exterior colour**, shared across every year and selected trim. Trim selections carry no visual effect; year affects only trim names.
- Replace the old model/year/trim/shape image chooser with the model+paint mapping in `data/model-artwork.json`; keep available year ranges in the editor.
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
