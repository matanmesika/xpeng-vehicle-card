# XPENG G6 Dashboard — Installation and Testing Guide (English)

This is the **XPENG Vehicle Card** frontend for Home Assistant. It depends on the separate Xpengtk vehicle integration, which must already expose your car's entities.

## Install

1. Open **Home Assistant → HACS → Custom repositories**.
2. Add `https://github.com/matanmesika/xpeng-vehicle-card`, category **Dashboard**.
3. Install **XPENG Vehicle Card**. The latest stable release is `v1.0.3`.
4. Edit a Lovelace dashboard and add a **Manual** card with type `custom:xpeng-vehicle-card`.
5. Select the model/year/exterior/cabin colours in the card editor. The G6 night-lakeside composition is preserved.
6. Set your Xpengtk entity prefix or use the card's mapping interface, then verify actual entity IDs in **Developer Tools → States**.
7. Refresh Home Assistant or the companion app after a card update to prevent cached JavaScript.

Example:

```yaml
type: custom:xpeng-vehicle-card
model: G6
year: "2026"
prefix: xpeng_g6
color: graphite_gray
interior: light_gray
show_controls: true
enable_access_controls: false
grid_options:
  columns: full
  rows: auto
```

## Try the updated visual beta

HACS → XPENG Vehicle Card → **⋮ → Redownload → Need a different version?** → **v1.0.4-beta.10**. Reload the dashboard. To roll back, redownload stable **v1.0.3** the same way.

Beta.10 is intended for layout review. It is not a change to the Xpengtk integration and does not add undocumented car commands.

## G6 feature overview

**Home / Vehicle status:** real battery percentage, estimated range and seven direct actions.

**Automatic charging:** confirmed active charging switches to the dedicated charging scene. Green cable color indicates active charging only; limits and schedules are in the charging data panel. Schedules may be read-only if no writable entity is present.

**Climate:** current/target cabin temperature, actual supported fan range, heating/ventilation on front seats, rear-seat heating, steering wheel heat and available defrost. The real cabin photograph has touch areas on the corresponding physical seats/wheel. Cabin color is selected in the editor.

**Maintenance:** tire readings beside their respective wheels, plus available odometer/service/identity details. Tire pressure unit selection is editor-only.

**Location:** Home Assistant's native map uses the configured car's location tracker. Horn and flash show only for available Xpengtk services.

**Diagnostics:** the card lists assigned XPENG entities and their actual Home Assistant states. Unknown/unavailable states are not replaced with guessed values.

## Command and safety checks

Opening, unlocking, closing and other vehicle controls are state- and permission-dependent. Enable Access only if both the card and integration advertise the needed rights. Never test potentially hazardous functions with people near moving windows, doors or trunk.

A successful Home Assistant `callService` call does **not** confirm the car executed the action. Inspect the corresponding sensor and command-feedback entity and verify at the parked car.

## Visual testing checklist

- Compare desktop (wide), narrow Sections card, 390px iPhone and 320px screen using the same card configuration.
- Ensure the scene stays clear of Home Assistant's top and bottom bars.
- Open all major subpages and check that buttons, text and scroll regions are not clipped.
- Verify four tire readings do not overlap service details.
- Verify that climate target temperature and both +/- buttons are visible on mobile.
- Confirm that the live Home Assistant map loads tiles; preview screenshots use placeholder tiles.
- Verify English LTR and Hebrew RTL behave correctly without changing the user's HA language for documentation purposes.
- Preserve the night background, original vehicle images, owner cabin photos and automatic charging design.

## Screenshots and release information

The [English gallery](gallery-en/README.md) contains 12 rendered screenshots with simulated data. The [Beta 10 GitHub release](https://github.com/matanmesika/xpeng-vehicle-card/releases/tag/v1.0.4-beta.10) includes release notes and the tested frontend JavaScript.

Black Edition approved all-black exterior/interior photography remains unavailable; an appearance filter is not an authentic replacement.

[Back to README](../README.md)
