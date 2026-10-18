# XPENG G6 — English Dashboard Screenshot Gallery

All 12 screenshots below were captured by **Playwright Chromium running the actual XPENG Vehicle Card JavaScript**. The simulated Xpengtk/Home Assistant vehicle states are demonstration values, not the owner's live telemetry. The dashboard UI and labels were switched to **English** for documentation screenshots only. This does not change the dashboard's Hebrew/English support.

> These are genuine browser screenshots, **not generated mockups**. Location map tiles in the standalone test are placeholders; the native Home Assistant map appears only in a real HA installation.

## Main dashboard and charging

| View | Desktop | Phone |
| --- | --- | --- |
| Vehicle status, battery and range | ![Vehicle dashboard desktop](home-desktop.png) | ![Vehicle dashboard phone](home-mobile.png) |
| Automatic charging | ![Charging desktop](charging-desktop.png) | ![Charging phone](charging-mobile.png) |

## Vehicle control pages

| View | Desktop | Phone |
| --- | --- | --- |
| Climate, seats and steering wheel | ![Climate desktop](climate-desktop.png) | ![Climate phone](climate-mobile.png) |
| Tire pressure and maintenance | ![Maintenance desktop](maintenance-desktop.png) | ![Maintenance phone](maintenance-mobile.png) |
| Location, horn and flash | ![Location desktop, mock map](map-desktop.png) | ![Location phone, mock map](map-mobile.png) |

## Other screenshots

| Charge limit and schedule | Entity diagnostics |
| --- | --- |
| ![Mobile charge controls](charge-controls-mobile.png) | ![Mobile list of XPENG sensor entities and states](diagnostics-mobile.png) |

## What the screenshots demonstrate

- The same card adapts automatically to wide desktop, phone and narrow Home Assistant Sections containers.
- Vehicle status and charging mode switch according to confirmed live charging signals.
- Home and Charging share seven direct shortcuts; the charging controls are inside the dedicated charging panel.
- The maintenance view presents four pressure sensors beside the correct wheels.
- Climate controls are placed around the original owner-provided cabin image; the light/dark cabin setting belongs in the card editor.
- Direct access actions (windows, doors, port and tailgate) are not separate permanent pages.
- Location map rendering in this gallery is a **test placeholder**, not a claim of native live GPS tile verification.
- Real vehicle commands, authorization, sensor recovery and iPhone Safari behavior must be tested inside Home Assistant with the car safely parked.

**Source and generation:** `scripts/capture-dashboard.cjs`, Material Design Icons (`@mdi/js` for browser preview), Playwright. Original vehicle artworks and background files under `assets/` were **not modified or removed** to generate this gallery.

[Back to the English GitHub/HACS description](../../README.md) · [Beta 10 release notes](https://github.com/matanmesika/xpeng-vehicle-card/releases/tag/v1.0.4-beta.10)
