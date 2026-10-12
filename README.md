# XPENG Dashboard

**Dashboard v0.1.1** — a standalone, read-only Home Assistant frontend card for XPENG vehicles.

> **Image status:** current bundled G6 art and old preview screenshots are **not** an approved match for the owner's 2026 design reference. The new vehicle-year/trim/paint-specific art set and new actual screenshots must be delivered before a stable release. We do not promote the old images as the current dashboard.

This repository contains the **dashboard**, not the XPENG integration. The integration is responsible for connecting to the vehicle and exposing Home Assistant entities. The dashboard only reads those entities and displays them. Updating this repository never updates the integration.

## Two screens only

- **Vehicle status** — XPENG vehicle artwork, battery percentage, estimated range, odometer, combined tire-pressure display and vehicle location.
- **Charging** — the same vehicle artwork in a charging scene, live battery percentage, estimated range, charging power, estimated time remaining and charge limit.

The card switches automatically from Vehicle status to Charging when `binary_sensor.<prefix>_is_charging` becomes `on`, and returns when it becomes `off`. **The charging-state entity is the only screen-switch trigger.** There is no Home button, clock or Full Screen icon in the header. The card continues to fill its configured Lovelace grid width and adapts to mobile screens.

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

Open **Manual sensor mapping** in the *same card editor* to search your Home Assistant entities and assign each field. The editor currently provides **15 assignments**: charging state, battery, range, charging power, time remaining, charge target, cable connection, odometer, four tire pressures, location, last update and connection status. Leave an assignment **empty** to use auto-mapping based on the configured prefix. A manually selected entity from **any HA integration/domain** takes priority; you can optionally read an entity attribute with `entity_id|attribute_name` (for example `select.my_car_charge|charging_state`). Manual and automatic mappings can be mixed independently across the 15 fields.

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

Readings update automatically from the mapped Home Assistant entities. **Only an active charging state** (`on`, `true`, `1`, `charging`, `in_progress` or `active`) displays the charging screen. An idle, paused, connected-only or unavailable charging state displays Vehicle status. A missing or unavailable sensor displays **—**, never a fake live value. This card is presentation-only: it does not require or alter the experimental XPENG backend.

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

- **Dashboard version:** 0.1.1 (new baseline defined by the two reference screenshots).
- **XPENG integration version:** entirely separate; no changes to it in this release.
- The existing Git history is retained to permit rollback, but the old dashboard pages are removed from the active card.
- Card verification: JavaScript syntax, automated data/transition tests and a real Home Assistant/HACS visual check are separate release gates. See [release checklist](RELEASE_CHECKLIST.md).

[Hebrew guide](README_HE.md) · [Changelog](CHANGELOG.md) · [Dashboard YAML](dashboards/xpeng-g6-cockpit.yaml) · [Entity mapping](docs/ENTITY_MAPPING.md)

_Not an official XPENG product. XPENG trademarks belong to their respective owners._

## v0.1.1 developer preview — not release-ready

- Manual vehicle model/year/trim/exterior/interior choices are kept entirely in the card editor or YAML; there are **no selectors in the dashboard**.
- Auto-detect telemetry from the HA entity prefix, or manually assign 15 individual Home Assistant entities using autocomplete in the card editor.
- Auto-switch between Vehicle status and Charging via the mapped charging binary sensor; no remote vehicle commands.
- The large Last update display is hidden behind the small information icon.
- Candidate per-model/year paint palettes exist, but factory options must be verified market-by-market.
- Year/trim/colour art paths are now separate. Production car renders and interiors for all combinations are **not yet provided**; missing art shows a labelled placeholder instead of a false model-year image.
- Previous PNG previews in `previews/` are legacy design explorations. They are not current screenshots of v0.1.1, and will be replaced only after real browser captures pass visual review.

For contribution and release gates see [AGENTS.md](AGENTS.md) and [artwork blocker #14](https://github.com/matanmesika/xpeng-vehicle-card/issues/14). **The project is a separate dashboard repository and makes no changes to the XPENG integration.**
