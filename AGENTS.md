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
- **Visual fidelity**: both screens must render successfully using real HTML and explicitly labelled DEMO sensor data in screenshots. Initial v0.1.1 permits visibly marked illustrative vehicle art; pixel-identical manufacturer render parity is a separate enhancement gate.
- **Model-year fidelity**: exact year/trim render only when verified; otherwise mark image as illustrative preview and never claim it is factory-accurate.
- **Verified vehicle palettes**: G6/G9 2026 official catalogue included; do not claim older or other model palettes have been independently verified.
- **Assets**: every available profile must have a bundled source asset or a clearly labelled SVG silhouette; missing files must not silently break the dashboard. Initial v0.1.1 treats illustrative art as provisional. Future production-grade pixel-fidelity releases require verified photography.
- **Privacy**: never commit VINs, tokens, locations or real car telemetry.
- **Sync**: `dist/xpeng-vehicle-card.js` and `xpeng-vehicle-card.js` must be identical.
- **No backend edits**: a missing integration profile entity is an integration feature gap to track separately, not an excuse to scrape HA internals.

Initial v0.1.1 status: all 53 model-year configurations and fallback visual profiles function; exact manufacturer-accurate artwork for all years/trim/paint variants and pixel-identical visual parity remain tracked improvements.
