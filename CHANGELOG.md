# Changelog

## v1.0.0-alpha.1 (2026-10-11)
- Rebuild Home as an at-a-glance vehicle dashboard rather than an application menu.
- Automatically prioritize active charging telemetry: SOC, power, ETA, energy, target, plug state.
- Distinguish offline, idle plugged-in, active charging and stale charging states without fabricated data.
- Fix mapping to 25 actual XPENG Direct sensor/binary entity fields; preserve legacy aliases/YAML overrides.
- Include full browser tests and actual desktop/phone screenshots for offline and test charging states.
- Keep editor-only paint/upholstery, existing navbar and safe read-only commands.


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
