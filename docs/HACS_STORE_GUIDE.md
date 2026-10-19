# XPENG Vehicle Card — HACS Store and Installation Guide

This page is the **English product copy and screenshot guide** for the HACS Dashboard listing. HACS is configured to render the repository README (`hacs.json`: `render_readme: true`), so the screenshots and instructions in [README](../README.md) are the content users can see. The GitHub repository **About** description is maintained separately; changing this Markdown file alone does not change GitHub metadata.

## Proposed listing copy

**Name:** XPENG Vehicle Card

**Suggested GitHub About description:**
> Responsive XPENG vehicle dashboard for Home Assistant using Xpengtk entities, with live charging, climate, vehicle actions, TPMS and location.

**Short introduction:**
> A single, modern vehicle card for desktop, iPhone and Home Assistant Sections. Automatically switches to a dedicated charging scene and displays live information supplied by your existing Xpengtk integration.

**Compatibility:** Home Assistant dashboard custom card (frontend). Requires an existing compatible, authenticated Xpengtk integration and supported Home Assistant entities. G6 is the actively developed and visually reviewed model. Other models/paint-year artwork are incomplete or not yet independently approved.

## Gallery — real browser captures

These are **real Chromium captures of the running JavaScript card**, with *simulated sensor data*. The graphics are not screenshots from a user's live car; the map is a test placeholder, and some static vehicle art can be illustrative.

[Desktop overview](screenshots/home-desktop.png) · [Mobile overview](screenshots/home-mobile.png)

[Desktop charging](screenshots/charging-desktop.png) · [Mobile charging](screenshots/charging-mobile.png)

[Desktop climate](screenshots/climate-desktop.png) · [Mobile climate](screenshots/climate-mobile.png)

[Desktop maintenance](screenshots/maintenance-desktop.png) · [Mobile maintenance](screenshots/maintenance-mobile.png)

[Desktop location](screenshots/map-desktop.png) · [Mobile location](screenshots/map-mobile.png)

[Desktop More Options](screenshots/functions-desktop.png) · [Mobile More Options](screenshots/functions-mobile.png)

[Charge controls](screenshots/charge-controls-mobile.png) · [Diagnostics](screenshots/diagnostics-mobile.png)

## Features explained clearly

| Feature | What it does | Important conditions |
| --- | --- | --- |
| Live vehicle dashboard | Battery, range and applicable vehicle state | Uses configured Xpengtk entities; never fabricates unknown measurements |
| Automatic charging view | Live charging information, charging station visual and live green cable | Shows only when the charging sensor confirms active charging; the cable is a visual overlay |
| Charge limit / scheduling | Displays and controls supported charging entities | Actions require matching Xpengtk entities and permissions; schedules may be read-only |
| Cabin climate | HVAC, fan, temperatures, supported seat and wheel comfort controls | Functions only where exposed by the vehicle integration |
| Doors, windows, trunk and charge port | Supported direct vehicle actions | Check real entity state, Access permissions and command feedback |
| Tire and maintenance view | Four individual tire readings, units and available service information | Only supported live readings; no invented tire/service thresholds |
| Vehicle location | Native Home Assistant tracker map and supported horn/flash | Actual GPS rendering and permission checks require live HA |
| More Options | Available vehicle settings, OTA status information and diagnostics | Read-only OTA where no real update action is provided |

## Install

1. Install and configure the Xpengtk integration independently in Home Assistant.
2. In HACS, add this GitHub URL as a custom repository in category **Dashboard**: `https://github.com/matanmesika/xpeng-vehicle-card`.
3. Install a stable version, or deliberately choose an opt-in Beta with **Redownload → Need a different version?**
4. Reload the Home Assistant frontend. If old UI remains, hard-refresh the browser or app cache.
5. Add `custom:xpeng-vehicle-card` to a Lovelace dashboard, choose the correct model, year, paint and interior, and verify your entity prefix or mappings.
6. Start with Access controls disabled. Enable them only after confirming exactly which entity IDs and commands your Xpengtk integration supports.

## Frequently asked questions

**Does the card connect to XPENG directly?** No. It consumes existing Home Assistant entities; Xpengtk handles vehicle communication separately.

**Why is a value unavailable or old?** The upstream entity may be unavailable or its vehicle/integration connection may be stale. Check its latest update and state in Developer Tools.

**Will the card force charging?** No. A charge command is only sent through a supported Home Assistant service, subject to the integration's permissions and physical vehicle state.

**Can I use my own car image?** The card respects supported configured artwork and its model/paint mapping. Missing officially approved views are kept explicitly missing rather than using incorrect vehicles.

**Are screenshots proof of live commands?** No. Browser QA uses fake entity states; actual car operations require owner testing.

**Which language does the interface use?** English for current card and help text, irrespective of Home Assistant's selected language.

**What is the current release?** Stable `v1.0.3`, published beta `v1.0.4-beta.21`. The next `v1.0.4` requires owner-approved live acceptance.

## Pre-publication checklist

- [ ] Final desktop and iPhone charging photos and cable endpoints approved by owner
- [ ] Current fourteen screenshot links render and describe simulated states accurately
- [ ] `README.md`, HACS guide and release notes match the released commit
- [ ] GitHub repository About description manually updated if needed (the current connector cannot edit repository metadata)
- [ ] HACS `hacs.json` stays valid and points to existing `xpeng-vehicle-card.js`
- [ ] Stable tag is created only after main-branch reconciliation and explicit owner approval
- [ ] No real location, VIN, tokens or private car states appear in published screenshots

*XPENG Vehicle Card is a community project and is not affiliated with XPENG.*
