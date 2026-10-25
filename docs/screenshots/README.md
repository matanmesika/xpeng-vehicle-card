# XPENG G6 — Screenshot gallery

The fourteen PNGs show the **actual card running in Chromium**, driven by simulated Xpengtk entities. They are neither AI mockups nor proof of working live car commands. The Location screenshot uses a map stub; real tiles and native tracker centering require live Home Assistant.

| View | Desktop | iPhone-sized |
| --- | --- | --- |
| Home | [Desktop](home-desktop.png) | [Mobile](home-mobile.png) |
| Charging — grouped Power, Current, Voltage; time and charge limit | [Desktop](charging-desktop.png) | [Mobile](charging-mobile.png) |
| Climate and seat controls | [Desktop](climate-desktop.png) | [Mobile](climate-mobile.png) |
| Maintenance and TPMS | [Desktop](maintenance-desktop.png) | [Mobile](maintenance-mobile.png) |
| Native map placeholder, Honk and Flash | [Desktop](map-desktop.png) | [Mobile](map-mobile.png) |
| More options | [Desktop](functions-desktop.png) | [Mobile](functions-mobile.png) |

Also: [Charge controls](charge-controls-mobile.png) and [Diagnostics](diagnostics-mobile.png). Windows, lock, trunk and charge port are direct actions rather than separate permanent pages.

The Charging desktop/mobile PNGs are updated from the **v1.0.6 Chromium capture** to match the stable electrical grouping, rather than reusing older charging screenshots. Missing Current/Voltage demo readings display `0.0 A` and `0.0 V`; this is a placeholder, not a live measurement.

Regenerate with [the Chromium capture script](../../scripts/capture-dashboard.cjs) using [the screenshot workflow](../../.github/workflows/capture-dashboard.yml). Exactly these fourteen files are replaced. Vehicle artwork, the night background, and cabin photos in `assets/` must not change.

**Real-device acceptance remains pending:** Safari scroll, modal header layering, GPS recentering, charging and native vehicle commands.

[README](../../README.md) · [Release acceptance](../G6_FINAL_STABILIZATION.md)
