# XPENG Dashboard

**Dashboard v0.1.1** — a standalone, read-only Home Assistant frontend card for XPENG vehicles.

## Actual dashboard screenshots (demo HA readings)

These are **real Chromium screenshots of the working Lovelace dashboard**, not mockups. All values are **demo Home Assistant sensor states**, not live XPENG data.

| Vehicle status | Charging |
| --- | --- |
| ![XPENG G6 status view with illustrative artwork and demo telemetry](previews/dashboard-v011/desktop-overview-DEMO.png) | ![XPENG G6 charging view with illustrative artwork and demo telemetry](previews/dashboard-v011/desktop-charging-DEMO.png) |

[Phone status](previews/dashboard-v011/phone-overview-DEMO.png) · [Phone charging](previews/dashboard-v011/phone-charging-DEMO.png)

The 2026 G6 image is now supplied with a transparent background to blend into the existing mountain scene. It remains **illustrative**, rather than a manufacturer-certified render for every paint or trim.

## All-model/year visual profiles

The configuration editor covers **16 catalogue entries and 53 model-year profiles** from 2018 through 2026, including a research/fleet profile and an Other/Future fallback. See [the machine-readable model/year catalogue](profiles/year-profiles.json).

- Each profile includes manually chosen model, year, trim, exterior colour and interior finish; options appear **only in the card editor**.
- Remaining measurements update automatically from Home Assistant entities and have **15 manual override fields**, independent of the experimental integration.
- For G6 2026, bundled studio illustrations now use transparent backgrounds in the 2026 paths. For the remaining models and years, generic model-family artwork or a clearly labelled colour-silhouette preview is used when exact imagery is unavailable. **Do not interpret preview art as the exact factory bodywork for that year.**
- Market-specific paint and interior availability is not fully verified for all model-year combinations.


This repository contains the **dashboard**, not the XPENG integration. The integration is responsible for connecting to the vehicle and exposing Home Assistant entities. The dashboard only reads those entities and displays them. Updating this repository never updates the integration.

## Two screens only

- **Vehicle status** — XPENG vehicle artwork, battery percentage, estimated range, odometer, combined tire-pressure display and vehicle location.
- **Charging** — the same vehicle artwork in a charging scene, live battery percentage, estimated range, charging power, estimated time remaining and charge limit.

The card switches automatically from Vehicle status to Charging when `binary_sensor.<prefix>_is_charging` becomes `on`, and returns when it becomes `off`. A Home button allows viewing the status screen manually. The Full Screen button expands the card to the available browser viewport, with an iOS-compatible CSS fallback.

There are **no** separate climate, controls, doors, seats, weather, settings or other dashboard pages. **All appearance choices** (model, year, trim, exterior and interior finish) are **manual and exist ONLY in Home Assistant’s card editor or YAML**, never as controls on either dashboard screen. Home Assistant telemetry can be mapped automatically or overridden individually in the card editor.

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
interior: light_gray
grid_options:
  columns: full
  rows: auto
```

### Card editor: appearance and sensor assignment

In Home Assistant open **Edit dashboard → Edit XPENG Dashboard card**. The **Vehicle appearance** section lets you manually select model, model year, trim, exterior paint and interior finish. No XPENG account login is needed. These settings will not be replaced by sensor data.

Open **Manual sensor mapping** in the *same card editor* to search your Home Assistant entities and assign each field. The editor currently provides **15 assignments**: charging state, battery, range, charging power, time remaining, charge target, cable connection, odometer, four tire pressures, location, last update and connection status. Leave an assignment **empty** to use auto-mapping based on the configured prefix. A manually selected entity always takes priority.

Example YAML for direct assignment (the visual editor provides the same option):

```yaml
type: custom:xpeng-vehicle-card
prefix: my_xpeng
model: G6
year: '2026'
trim: core_plus_rwd
color: arctic_white
interior: light_gray
entities:
  soc: sensor.your_battery_percent
  range: sensor.your_range_km
  charging: binary_sensor.your_charging_status
  power: sensor.your_charging_kw
  target: number.your_charge_limit
```

All readings (including changes of charging state and screen switching) update automatically from their mapped Home Assistant entities. A missing or unavailable sensor displays **—**, never a fake live value. This card is presentation-only: it does not require or alter the experimental XPENG backend.

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

The editor supports manual model, year, trim, exterior paint and cabin finish configuration as well as optional per-field Home Assistant sensor mapping. The supplied G6 artwork is illustrative; it is not guaranteed to reproduce every model/paint combination. The charging cable/charger and mountain-night environment are decorative only and **do not represent a real charging session**.

## Scope and version policy

- **Dashboard version:** 0.1.1 — initial version with 53 selectable model-year visual profiles. Exact manufacturer imagery is a separately tracked enhancement.
- **XPENG integration version:** entirely separate; no changes to it in this release.
- The existing Git history is retained to permit rollback, but the old dashboard pages are removed from the active card.
- Card verification: JavaScript syntax, automated data/transition tests and a real Home Assistant/HACS visual check are separate release gates. See [release checklist](RELEASE_CHECKLIST.md).

[Hebrew guide](README_HE.md) · [Changelog](CHANGELOG.md) · [Dashboard YAML](dashboards/xpeng-g6-cockpit.yaml) · [Entity mapping](docs/ENTITY_MAPPING.md)

_Not an official XPENG product. XPENG trademarks belong to their respective owners._

## v0.1.1 initial release scope and limitations

This version is installable as a standalone dashboard frontend via HACS and reads existing Home Assistant entities, even if no XPENG backend is connected. The two view screenshots above are recorded in a real browser using **demo** data.

- All appearance selections remain manually configured in the Home Assistant card editor. There is no on-screen vehicle appearance selector.
- All 53 model-year profiles are selectable. Bodywork, paint and interior illustrations outside verified asset coverage are intentionally labelled as previews.
- Manual mappings are supported for 15 Home Assistant sensors, with automatic prefix matching when unset.
- No direct XPENG login, cloud API or vehicle controls are provided.
- **Pixel-identical visual fidelity and correct manufacturer photography for every model, year, colour and trim are not claimed by this initial release.** Track future imagery in [issue #14](https://github.com/matanmesika/xpeng-vehicle-card/issues/14).

See [AGENTS.md](AGENTS.md) for the higher-fidelity visual release gates.
