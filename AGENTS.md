# XPENG Dashboard – contributor and agent instructions

## Strict repository boundary
This repository is the **Lovelace dashboard frontend**. Never change or publish XPENG integration/backend code from this repository. The companion integration remains `matanmesika/xpeng-direct-homeassistant`.

## Required specialist reviews (workstreams, not autonomous running services)
1. **Design parity reviewer**: compare real Chromium/HA screenshots with the two supplied 1536x864 reference images (status and charging). Block release if the car/year, background, lighting, layout or mobile rendering differs materially.
2. **Vehicle catalogue reviewer**: use manufacturer model/year/market sources for each factory exterior/interior choice. Flag any unverified mapping as a preview, not a factory option.
3. **Vehicle image reviewer**: verify exterior artwork represents the **exact** model year and exterior paint; interior art must match dashboard, steering wheel, door trims, console and seats as a group. Do not silently reuse another year/model.
4. **Home Assistant state reviewer**: model, year, trim, exterior colour and interior finish are manual editor/YAML settings only. Telemetry is read from Home Assistant sensors; individual entity overrides live exclusively in the card editor/YAML. Never read XPENG integration private config or use its identity sensors to override visual settings.
5. **QA reviewer**: run JS syntax/Node tests/Playwright desktop+mobile, image load checks, accessibility/info popover tests, full-window mode, and HACS package verification before approval.

## Approved views
- Vehicle status
- Charging when `binary_sensor.<prefix>_is_charging` is on
No third page, no vehicle commands. Interior preview may appear only in the transient metadata popover until a new layout is expressly approved.

## Critical release gates
- **Visual fidelity**: both screenshots reviewed; no fake live SOC/ETA/location values.
- **Model-year fidelity**: correct shape and trim details, not an older G6/G9 image relabelled as 2026.
- **Verified vehicle palettes**: G6/G9 2026 official catalogue included; do not claim older or other model palettes have been independently verified.
- **Assets**: all selected `assets/vehicles/<model>/<year>/<trim>/<color>.webp` available and reviewed (unless deliberately declared unsupported). A generated SVG silhouette is only a visible missing-asset placeholder, never release-quality art.
- **Privacy**: never commit VINs, tokens, locations or real car telemetry.
- **Sync**: `dist/xpeng-vehicle-card.js` and `xpeng-vehicle-card.js` must be identical.
- **No backend edits**: a missing integration profile entity is an integration feature gap to track separately, not an excuse to scrape HA internals.

Current status: layout/metadata plumbing is under review. Manufacturer-accurate artwork for all model/year/trim/paint variants and full visual parity are **not complete**.
