# G6 Visual Refresh V2 — Owner Review (Not a Release)

## Purpose

This design-only branch starts from the *published* `v1.0.4-beta.11` tag. It does not change entity lookup, service calls, command permissions, charging state transitions, user actions, photos, dynamic English/Hebrew localization, or navigation.

### Single design source

**Only** `src/design/xpeng-vehicle-card.css` is maintained for visual changes. Build with `node tools/build_vehicle_card.mjs` and verify with `node tools/build_vehicle_card.mjs --check`. The generated `src/xpeng-vehicle-card.js` and `dist/xpeng-vehicle-card.js` are byte-identical. No new Home Assistant resource is needed.

## New visual direction

**Midnight Slate / Mineral Glass / Soft Cyan** — a coherent premium automotive surface language that keeps the owner's existing night-lakeside background and approved vehicle and cabin images.

- **Header:** unified translucent tool rail. The existing connectivity icon and top-right gear stay beside each other.
- **Home:** a battery card with clearer percentage/range hierarchy and a proportionate official MDI glyph; range bar is secondary, readable and charged-state-aware through existing binding.
- **Charging:** same seven live action shortcuts and auto-charging scene, with clearer glass cards while preserving the actual owner charging car orientation, station and active-green thin ground cable.
- **Controls/dock:** seven existing quick actions become a consistent, legible control rail, with clear disabled/focus styles. Actions remain state-aware.
- **Climate:** a genuine visual reset of control surfaces, hierarchy, temperature steppers, AUTO/power, real fan steps and warm/cool seat/wheel hotspots, without changing actual owner cabin art or unsupported functionality.
- **Maintenance:** consistent tire reading materials and a calmer data-detail grid *below* the four original wheel-positioned TPMS readings.
- **Custom Functions:** seven existing options styled as a coordinated grid, with their current explanations inside destination pages — **not on the launcher tiles**.
- **Help:** integrated information surfaces and easy-to-read real min/max labels, never hard-coded fictional ranges.
- **Responsive:** one card from wide desktop to narrow HA Sections and 320px mobile; no second mobile dashboard, artificial fixed phone switch or clipped controls.

## Mandatory approval / release gates

- All five design-agent CI roles and the full Xpengtk regression suite pass against the rebuilt JS.
- Playwright captures the **actual running frontend**, including Home, Charging, Climate, Maintenance, Map, charge-limit and diagnostics on desktop/phone, and validates navigation, accessibility and no lost controls.
- Independently compare V2 screenshots with the published Beta 11 screenshots; measurable and clearly recognizable design differences should be visible. Do not present AI mockups as implementation screenshots.
- **No merge to main and no new HACS release until owner visually approves**.

The screenshots are simulated data and browser captures, not a claim of actual vehicle commands. Physical command validation remains separate with the car safely parked.

[Design branch](https://github.com/matanmesika/xpeng-vehicle-card/tree/design/g6-v2-surface-redesign-20261018) · [Beta 11 (rollback)](https://github.com/matanmesika/xpeng-vehicle-card/releases/tag/v1.0.4-beta.11)
