# XPENG Dashboard

**Dashboard v0.1.1** — a standalone, read-only Home Assistant frontend card for XPENG vehicles.

![Vehicle artwork used by the dashboard](dist/assets/g6-studio.webp)

*Illustrative G6 artwork. The two dynamic dashboard screens are rendered by the Lovelace card, not by this static image.*

This repository contains the **dashboard**, not the XPENG integration. The integration is responsible for connecting to the vehicle and exposing Home Assistant entities. The dashboard only reads those entities and displays them. Updating this repository never updates the integration.

## Two screens only

- **Vehicle status** — XPENG vehicle artwork, battery percentage, estimated range, odometer, combined tire-pressure display and vehicle location.
- **Charging** — the same vehicle artwork in a charging scene, live battery percentage, estimated range, charging power, estimated time remaining and charge limit.

The card switches automatically from Vehicle status to Charging when `binary_sensor.<prefix>_is_charging` becomes `on`, and returns when it becomes `off`. A Home button allows viewing the status screen manually. The Full Screen button expands the card to the available browser viewport, with an iOS-compatible CSS fallback.

There are **no** separate climate, controls, doors, seats, weather, settings or other dashboard pages. Appearance and entity configuration are managed only in Home Assistant's card editor or YAML.

**The numerical values in the reference screenshots are illustrative, not hardcoded.** Missing, unknown or unavailable Home Assistant data is displayed as an em dash (—), never as a fabricated measurement. This is a display-only component; it does not send control commands to the vehicle.

## Installation (HACS custom repository)

1. Open HACS → Custom repositories and enter `https://github.com/matanmesika/xpeng-vehicle-card`.
2. Select category **Dashboard**, download the card and reload the Home Assistant frontend.
3. Add the card in a full-width section:

```yaml
type: custom:xpeng-vehicle-card
prefix: my_xpeng
model: G6
year: '2026'
trim: core_plus_rwd
color: arctic_white
grid_options:
  columns: full
  rows: auto
```

The optional `image_path` may point to the installed local directory if installed manually. HACS defaults to `/hacsfiles/xpeng-vehicle-card/assets`. For manual installation copy `dist/xpeng-vehicle-card.js` and `dist/assets/` into your local Home Assistant `www` directory and register the JavaScript module.

## Entity mapping

The card reads the following Home Assistant entities through `prefix` (legacy suffix aliases continue to be accepted). Exact entity IDs may be overridden with `entities:` in card YAML.

| Data | Default entity |
| --- | --- |
| Charging state | `binary_sensor.<prefix>_is_charging` |
| Battery % | `sensor.<prefix>_soc` |
| Estimated range | `sensor.<prefix>_range_km` |
| Odometer | `sensor.<prefix>_odometer_km` |
| Tire pressure | `sensor.<prefix>_tire_pressure_front_left_kpa` and the remaining three corners |
| Vehicle location | `device_tracker.<prefix>_location` |
| Charging power | `sensor.<prefix>_charge_power_kw` |
| Charging time remaining (minutes) | `sensor.<prefix>_charge_remaining_min` |
| Charging target % | `sensor.<prefix>_charge_target` |
| Latest update | `sensor.<prefix>_last_update` |
| Connection indicator | `sensor.<prefix>_api_connection_status` |

The tire-pressure figure is the mean of four *available* kPa tire readings expressed in bar; if any corner is missing, the summary is unavailable. No geocoding is performed: location displays the Home Assistant tracker state as provided.

The dashboard supports model, trim and exterior paint configuration. The supplied G6 artwork is illustrative; it is not guaranteed to reproduce every model/paint combination. The charging cable/charger and mountain-night environment are decorative only and **do not represent a real charging session**.

## Scope and version policy

- **Dashboard version:** 0.1.1 (new baseline defined by the two reference screenshots).
- **XPENG integration version:** entirely separate; no changes to it in this release.
- The existing Git history is retained to permit rollback, but the old dashboard pages are removed from the active card.
- Card verification: JavaScript syntax, automated data/transition tests and a real Home Assistant/HACS visual check are separate release gates. See [release checklist](RELEASE_CHECKLIST.md).

[Hebrew guide](README_HE.md) · [Changelog](CHANGELOG.md) · [Dashboard YAML](dashboards/xpeng-g6-cockpit.yaml) · [Entity mapping](docs/ENTITY_MAPPING.md)

_Not an official XPENG product. XPENG trademarks belong to their respective owners._

## v0.1.1 developer preview — not release-ready

- The status/charging UI is the **same two-screen frontend**; last-update text is now hidden behind an accessible information icon. The icon also presents a schematic cabin finish preview.
- Appearance metadata is read from Home Assistant entity state or whitelisted attributes **when available** (model, year, trim, exterior paint and interior). Dashboard YAML/editor settings remain the fallback, not a duplicate permanent colour preference.
- The companion XPENG integration **currently does not expose year/trim/exterior/interior as HA entities**; choosing colours during its setup does not automatically synchronize until its backend exposes those profile fields. No backend files were changed in this dashboard branch.
- Officially published 2026 G6 and G9 exterior/interior display palettes are model-specific. Other model years and profiles retain *illustrative*, non-factory-certified choices until a region-specific catalogue is reviewed.
- Art must be installed per exact `assets/vehicles/<model>/<year>/<trim>/<color>.webp`. Missing art shows a clearly labelled SVG **preview**, not a misleading older model-year photo. This is intentional but **not visually acceptable as a final release**.
- Existing HACS assets do **not yet** cover every exact combination. This branch is for review, not a completed/pixel-perfect dashboard. See `AGENTS.md` for release gates.
- Native cabin material/finish visuals and the mountain/night scene still require designer-approved production assets. The current schematic cabin is only a selectable-colour preview, not manufacturer-accurate interior photography.

Manufacturer catalogue references: [XPENG New G6](https://www.xpeng.com/model/g6) and [XPENG New G9](https://www.xpeng.com/model/g9).
