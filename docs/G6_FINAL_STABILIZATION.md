# XPENG G6 — Final v1.0.4 release handoff

The owner approved the shared desktop/iPhone charging control block and authorized the final release on October 19, 2026. The release candidate is PR #59 from `release/v1.0.4` to `main`.

## Approved layout and functionality
- [x] One Charging markup with the same data, controls, arrangement and MDI icon style across desktop, phone and HA Sections. Only responsive sizing differs.
- [x] All three charging controls maintain native entity/service bindings and accessibility labels.
- [x] Preserve lakeside background, approved vehicle/cabin art, realistic XPENG station position, conditional thin green charging cable, and the seven main shortcuts.
- [x] Keep live entity-based SOC, range, charging power, remaining time, charge limit, climate/comfort, diagnostics, location and TPMS without inventing unsupported data.

## Automated QA
- [x] Frontend, HACS, artwork/provenance and responsive Chromium screenshot checks were green on the approved visual candidate.
- [x] The canonical fourteen-image gallery is captured from the actual card using simulated HA/Xpengtk entities.
- [ ] Confirm all final release-commit checks and stable publishing workflow green after cleanup.
- [ ] Confirm GitHub release URL and downloadable files.

## Scope not proved by browser tests
Home Assistant/Xpengtk live reconnecting, actual commands and their feedback, GPS map tiles, native iPhone Safari scrolling and security permission behavior require real on-device testing. Browser acceptance and a successful service call do not certify physical car execution.

## Publication
The workflow `.github/workflows/publish-v1.0.4-stable.yml` is triggered on `main` when the `.release/v1.0.4` marker is introduced, validates the package and produces GitHub Release `v1.0.4` with the frontend JavaScript and verified screenshots ZIP.

[Release notes](releases/v1.0.4.md) · [HACS guide](HACS_STORE_GUIDE.md) · [Gallery](screenshots/README.md)
