# XPENG Vehicle Card — Home Assistant Dashboard

A responsive Lovelace card for XPENG vehicles. The G6 includes automatic charging mode, live climate and seat controls, vehicle maintenance/TPMS, location, horn and flash, and status-dependent access commands. This is the FRONTEND card; it does not change Xpengtk vehicle integration or install it for you.

[Install via HACS](https://my.home-assistant.io/redirect/hacs_repository/?owner=matanmesika&repository=xpeng-vehicle-card&category=plugin) · [Release v1.0.3](https://github.com/matanmesika/xpeng-vehicle-card/releases/tag/v1.0.3) · [מדריך בעברית](docs/G6_DASHBOARD_GUIDE_HE.md) · [Release notes](docs/releases/v1.0.3.md)

## Screenshots from the real card code (synthetic HA telemetry)

All images below were captured by Chromium while running the actual card JavaScript with test sensor values, NOT an image-generator mockup or the owner's real car telemetry. The standalone location test substitutes a clearly marked placeholder for the native Home Assistant map card: real tiles appear only after installing inside HA.

| Page | Desktop | Phone |
| --- | --- | --- |
| **Home (four direct vehicle actions + three page shortcuts)** | ![G6 dashboard desktop](docs/screenshots/home-desktop.png) | ![G6 dashboard mobile](docs/screenshots/home-mobile.png) |
| **Charging (automatic)** | ![G6 charging desktop](docs/screenshots/charging-desktop.png) | ![G6 charging mobile](docs/screenshots/charging-mobile.png) |
| **Climate & seat controls** | ![Climate desktop](docs/screenshots/climate-desktop.png) | ![Climate mobile](docs/screenshots/climate-mobile.png) |
| **Maintenance & wheel-adjacent TPMS** | ![Maintenance desktop](docs/screenshots/maintenance-desktop.png) | ![Maintenance mobile](docs/screenshots/maintenance-mobile.png) |
| **Location, horn & flash** | ![Map desktop (test placeholder)](docs/screenshots/map-desktop.png) | ![Map mobile (test placeholder)](docs/screenshots/map-mobile.png) |

Additional real browser captures: [charging controls](docs/screenshots/charge-controls-mobile.png) · [Xpengtk sensor diagnostics](docs/screenshots/diagnostics-mobile.png).

**[Open the single curated screenshot gallery](docs/screenshots/README.md).** It contains only 12 current captures; direct buttons (locks, windows, trunk, charge port) do not have fictitious page screenshots.

## Install and update

Home Assistant → HACS → custom repositories → add https://github.com/matanmesika/xpeng-vehicle-card with type **Dashboard**. Install the latest stable **v1.0.3** and reload the companion app or browser to clear its cached JS module.

Example Lovelace card settings (change the prefix to match YOUR actual entities):

    type: custom:xpeng-vehicle-card
    model: G6
    year: "2026"
    prefix: xpeng_g6
    color: arctic_white
    interior: light_gray
    show_controls: true
    enable_access_controls: false
    grid_options:
      columns: full
      rows: auto

The Xpengtk vehicle integration is a separate prerequisite; the card only sends services when HA entities exist. Open and unlock operations require explicit card Access opt-in as well as Xpengtk Access permission. Choose the interior colour inside the editor, not the dashboard. The existing night-lakeside photo background is retained.

## What each G6 Home button does

| Home shortcut | Behaviour |
| --- | --- |
| Climate / מיזוג | Temperature, HA-provided fan speed, power, front defrost, supported seat/wheel controls, AUTO feedback |
| Lock / נעילה | Lock or unlock based on actual lock state |
| Windows / חלונות | Open or close based on actual window state |
| Charge port / שקע טעינה | Open or close based on actual port sensor; do not close with connected cable |
| Tailgate / תא מטען | Open or close in one tap, requires known open/closed sensor state; Access for opening |
| Maintenance / תחזוקה | Four TPMS readings, odometer, service, masked VIN |
| Location / מיקום | HA native dark map, zoom 11, car tracker; two finder controls: צופר (horn) and הבהוב (flash) |

On all other pages only a Back to Home navigation control remains. The same card adapts automatically to desktop, mobile and narrow Home Assistant Sections layouts.

The G6 cabin uses the two owner-provided photos, shared across all G6 year groups:
- assets/vehicles/g6/interior_light_gray.webp
- assets/vehicles/g6/interior_dark_gray.webp

Supported front seats have heat and ventilation; each rear seat independently supports heat; wheel heat uses its own integration entity. Controls only show for available HA entities. AUTO and mirror heat may be **read-only indicators**, not executable actions. Remote AUTO / airflow direction appears only if a writable climate mode is reported by HA. Fan range comes from HA attributes (often 1–8, never a fictional forced 1–10).

The charging view opens **automatically** only when the real charging sensor is ON, with the original model/paint **charging.webp** photograph (never substituted with front.webp) and a green cable glow while charging. There is no manual Charging button on Home. The original live metrics card remains unchanged, and the two small buttons are Charge Limit and read-only Schedules. Scheduled charging is read-only unless Xpengtk supplies a verified edit service.

On a phone, swipe **inside the opened Climate or Maintenance page** to reach all controls and vehicle details; the page scrolls vertically and keeps the Back button visible. In phone Maintenance, the car appears above a 2×2 tire-pressure grid with physically consistent left/right placement and Hebrew tire labels.

## Testing / what must be verified on the actual Home Assistant installation

The [full G6 acceptance workflow](https://github.com/matanmesika/xpeng-vehicle-card/actions/workflows/g6-full-acceptance.yml) validates source/distributable, screenshots, HA mock service calls, responsive views, map native integration request, Access gating and actual command labels. These tests are browser simulations; no real car controls were sent.

The real installation must still confirm the native HA map loads tiles and GPS, the Xpengtk permissions, horn and flash commands, seat availability, and the updated frontend module. Read the [Hebrew installation and control guide](docs/G6_DASHBOARD_GUIDE_HE.md).

## Models, generation art and provenance

The same card retains the complete model-year/paint catalogue. Original non-G6 artwork policy and source tracking:
[Artwork status](docs/ARTWORK_STATUS.md) · [G6 generations](docs/G6_GENERATIONS.md) · [Artwork map](docs/ARTWORK_MAPPING.md) · [Release history](docs/CHANGELOG.md).

## Sensor mapping

**Sensor mapping:** the card automatically resolves available Xpengtk entities by the configured prefix. For legacy setups you can keep manual entity mapping in existing YAML; never invent live readings when a sensor is missing. Update the prefix to match your G6 entities. Opening/unlocking operations require explicit Access opt-in.

## Xpengtk G6 entity mapping checks (mobile hotfix)

When a sensor is displayed as `unavailable`, first check its actual state in Home Assistant **Developer Tools → States**, then ensure Xpengtk itself is current and successfully receiving vehicle data. This frontend resolves both renamed registry entities and these verified Xpengtk unique IDs:

| Reading / action | Xpengtk stable unique ID suffix | HA type |
| --- | --- | --- |
| Any window open | `any_window_open` | `binary_sensor` |
| Driver/passenger/rear doors | `driver_door`, `passenger_door`, `rear_left_door`, `rear_right_door` | `binary_sensor` |
| Door lock control | `door_lock` | `lock` |
| Fallback lock status (ON means **unlocked**) | `locked` | `binary_sensor` |
| Charging-port flap / cable | `slow_charge_port` | `sensor` |
| Actual charging | `charging` | `binary_sensor` |
| Cable physically present | `plugged_in` | `binary_sensor` |
| Tires (FL/FR/RL/RR) | `tyre_pressure_fl`, `tyre_pressure_fr`, `tyre_pressure_rl`, `tyre_pressure_rr` | `sensor` |

The dashboard **cannot repair an integration sensor that is itself unavailable**; it only fixes wrong alias selection and avoids preferring stale unavailable entities over live equivalents. A connected charge cable never allows the flap to close.
