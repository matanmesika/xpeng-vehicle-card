# Changelog

## v0.9.0-alpha.1 (preview, pending visual approval)
- Clean rewrite of XPENG Cockpit as one vehicle-app style card, four quick actions, four main menu rows and replacing subpages.
- Owner model/year/trim/paint/upholstery remains editor-only; Home Assistant navbar retained separately.
- Original XPENG top-down controls, cabin visual, charging view, and safe read-only entity mapping.
- Desktop and phone Chromium screenshot tests, HACS packaging and brand independence checks.
- Not yet released: awaits owner visual approval and authorized XPENG API before enabling remote commands.


## v0.7.0-alpha.1 (2026-10-11)
- Large actual G6 vehicle image across every Studio cockpit page; contextual cabin/doors/tires overlays and reorganized status cards.
- Responsive composition with photo-led stage, side nav, right telemetry rail and bottom dashboard modules.
- Eliminate broken logo dependency and duplicated Home Assistant markdown header; keep the existing navbar template with safe padding.
- Real rendered screenshots of desktop/mobile seven-page flows attached as release assets.
- No invented vehicle values or OEM command API.


## v0.6.0-alpha.2 (2026-10-11)
- Move exterior paint and interior upholstery/dashboard finish exclusively into Home Assistant card editor/YAML.
- Remove in-card Settings/Appearance page and customization button; Interior page becomes read-only.
- Remove localStorage overrides so device appearance is consistent across phone and desktop.
- Update browser regressions and publication workflow for new pre-release.


## v0.6.0-alpha.1 (2026-10-11)
- Released opt-in Cockpit layout and owner G6 2026 dashboard YAML; previous classic layout remains default.
- New responsive desktop/mobile vehicle navigation, central artwork, current status rail and fullscreen.
- New Comfort panel includes steering-wheel heating, seat heat, ventilation and massage as disabled, unverified functions.
- Fixed HACS distribution source parity; added browser tests and a version-correct release workflow.


## v0.5.0-alpha.5 (2026-10-11)
- Central category-specific visual, fully wired fullscreen button and browser regression.
- HACS release automation updated to publish current alpha, not older alpha.3.

## v0.5.0-alpha.4 (2026-10-11)
- Worldwide presentation catalogue: 16 listed model profiles, 5 exterior paints, 2 interior themes; removed country-specific trim labels.
- Added dashboard full-window expansion and exit control. No remote vehicle commands.
- Continued explicit warnings: public XPENG cloud account API and consumer login are not verified.

## v0.5.0-alpha.3 — public repository preparation

- Expanded English/Hebrew setup and feature documentation.
- Explicit mapping evidence policy and read-only safety limitations.
- Removed unrelated manufacturer references from presentation and metadata.
- HACS distributable JS and bundled assets, workflows and packaging checks.

## v0.5.0-alpha.2 — HACS distribution preparation

- Packaged original illustrative car images under `dist/assets/`.
- Added browser regression checks and release-readiness checklist.

## v0.5.0-alpha.1 — Interior visual selector

- Dark Gray and Light Gray full-cabin visual theme for G6 2026.
- Separate Interior & Seats page, model-aware paint/trim options.
