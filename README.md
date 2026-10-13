# XPENG Dashboard — Home Assistant vehicle card

**[📊 Artwork progress dashboard](docs/ARTWORK_STATUS.md)** — current completion by XPENG model and generation, missing views, and verified checks. Counts update when new assets are committed; this is not a live rendering indicator.

A standalone, **read-only Home Assistant dashboard card** for XPENG vehicles. This repository contains **frontend/UI only**; the XPENG Home Assistant integration is a separate project and is not modified here.

**Updates and release history:** [CHANGELOG.md](CHANGELOG.md) is the single canonical history for this project. Obsolete per-release note files were removed; installable versions are published separately under [GitHub Releases](https://github.com/matanmesika/xpeng-vehicle-card/releases).

**Current candidate (2026-10-12):** **v1.0.0-beta.2**. It includes the current dashboard/UI, the approved lakeside backdrop, and the current G6 front/charging/top artwork. The temporary `mix-blend-mode: multiply` workaround has been removed so the updated front artwork renders normally.

## User-approved design

- One **fixed approved night-time lake/house/mountain photo** as the full-screen background. Vehicle artwork is a separate foreground layer. Do not change the background without owner approval.
- Two principal modes: **Vehicle status**, and **Charging** only when the mapped Home Assistant charging sensor reports active charging. No extra control, weather, climate, seat, door or map pages.
- In Vehicle status, tapping **Tire pressure** keeps the same approved scenic background, brand header and vehicle title, while replacing the central car with a colour-matched overhead view and four independently measured pressure values near the corresponding wheels. The readings use the same dark-glass style as the main information panel; **Back to vehicle** restores the hero. This is a detail mode within Vehicle status, not a third dashboard page. Until a verified overhead image is obtained, the vehicle artwork is explicitly labelled illustrative.
- The top-right header has **one Wi-Fi button** (no separate connection text or info icon) on desktop and mobile. Its colour indicates the mapped connection state, without assuming a connection when the sensor is missing. Tap the Wi-Fi icon to open a popup with only **Connection** and **Last vehicle update** from mapped Home Assistant sensors. The date/time is shown explicitly when supplied by the vehicle-update sensor; a Home Assistant entity's generic `last_updated` metadata is not treated as a vehicle refresh. Tap the same icon to close. No cabin, model, paint or artwork metadata in the popup.
- No hardcoded SOC, range, TPMS, charging data, location or update times. Missing values are displayed as unavailable/—.

## Artwork storage policy: model → year group → exterior paint

`vehicle-catalog.json` is the canonical appearance catalog. Trim is display-only and does not select artwork.\n\nVehicle artwork files use one canonical hierarchy: `assets/vehicles/{model}/{year}/{color}/{front,charging,top}.webp`. There is **no trim folder** in the artwork path. Trim may remain informational in configuration, but it never selects a different image file.

- **Model** changes vehicle artwork and its available selections.
- **Exterior colour** changes the vehicle artwork (and any colour-matched preview).
- **Model year** is part of the artwork storage key. The current approved G6 artwork is mapped under year `2026`.
- **Trim** is informational only. Each year group always selects its own geometry; no substitution of newer or older generations.
- **Interior finish** is an editor-only future-facing visual setting; it does not appear in the information popup.

The mapping is recorded in [model-artwork.json](model-artwork.json). The current G6 set covers five 2026 colours in separate `front.webp`, `charging.webp`, and `top.webp` files. Other model/year/paint folders are prepared but currently pending real artwork. Trim names are not part of the filesystem path. See [complete artwork mapping](docs/ARTWORK_MAPPING.md).

See [artwork and tire view policy](docs/SHAPE_ASSETS_AND_TPMS.md) and [design lock](docs/DESIGN_LOCK.md).

## Installation through HACS

Add `https://github.com/matanmesika/xpeng-vehicle-card` to **HACS → Custom repositories**, category **Dashboard**. Install the most recent published beta and reload Home Assistant. The current release candidate is `v1.0.0-beta.2`; check GitHub Releases for actual publication status.

Example configuration:

```yaml
type: custom:xpeng-vehicle-card
prefix: my_xpeng
model: G6
year: "2026"
trim: core_plus_rwd
color: arctic_white
interior: light_gray
grid_options:
  columns: full
  rows: auto
```

Choose **Edit dashboard → Edit card** to select model, year, informational trim, paint and cabin finish. All appearance selectors stay **in the card editor**, never on the dashboard. The entire old **Data source** / picture-URL section was removed: car/charging/overhead/background image URLs, asset directories and the automatic prefix are no longer editable controls. Images are sourced from the packaged dashboard assets; old custom YAML paths remain supported for compatibility, but they are not shown in the visual editor. This is a read-only view; it neither authenticates with XPENG nor issues vehicle commands.

### Sensor mapping — Automatic or Manual

The editor now has one **Sensor mapping** dropdown: **Automatic · XPENG integration** (default) or **Manual · choose sensors**. Automatic hides all 15 individual sensor fields and uses the integration's conventional Home Assistant entity names under the configured `prefix` (default `my_xpeng`, retained from YAML). Selecting Manual opens **all 15 sensor fields at once** with searchable Home Assistant entity suggestions. Each field can use any integration/entity, including `entity_id|attribute_name`; leaving a field empty falls back to its automatic lookup. Switching back to Automatic hides the fields and ignores stored manual choices without deleting them. Existing configurations with `entities:` and no mapping mode are treated as Manual for backward compatibility.

| Display | Default entity |
| --- | --- |
| Network connection | `sensor.<prefix>_api_connection_status` |
| Last vehicle update | `sensor.<prefix>_last_update` |
| Charging | `binary_sensor.<prefix>_is_charging` |
| Battery SOC | `sensor.<prefix>_soc` |
| Estimated range | `sensor.<prefix>_range_km` |
| Odometer | `sensor.<prefix>_odometer_km` |
| Charging power | `sensor.<prefix>_charge_power_kw` |
| Remaining time | `sensor.<prefix>_charge_remaining_min` |
| Charge target | `sensor.<prefix>_charge_target` |
| Four tire pressures | `sensor.<prefix>_tire_pressure_front_left_kpa`, corresponding remaining three corners |
| Location | `device_tracker.<prefix>_location` |

Per-field manual overrides:

```yaml
sensor_mapping_mode: manual
entities:
  connection: sensor.my_xpeng_api_connection_status
  last_update: sensor.my_xpeng_last_update
  charging: binary_sensor.my_xpeng_is_charging
  tire_fl: sensor.my_xpeng_tire_pressure_front_left_kpa
```

The charging sensor determines the view; an available charging cable alone does not imply active charging. Tire units kPa, bar, psi and Pa are supported, and unavailable values are not guessed. For full mapping details, see [ENTITY_MAPPING](docs/ENTITY_MAPPING.md).

## Files and quality gates

- `src/xpeng-vehicle-card.js` is the development source; `dist/xpeng-vehicle-card.js` is the identical HACS delivery file.
- `dist/` also contains the approved backdrop and the flat `xpeng-asset-*` image files required by HACS packaging.
- `model-artwork.json` and `vehicle-art-inventory.json` use the canonical `model/year/color` artwork hierarchy. Trim is not part of artwork selection.
- `tests/` covers appearance invariants, real sensor mapping, network info popup, charging and tire modes, responsive desktop/phone browser rendering, image inventory and HACS packaging.

The tested UI improvements originated in [PR #21](https://github.com/matanmesika/xpeng-vehicle-card/pull/21); image research continues separately. See [release checklist](docs/RELEASE_CHECKLIST.md) and [changelog](CHANGELOG.md). Final real-vehicle photography, licence checks, owner visual sign-off, and installation testing in an actual Home Assistant instance remain separate release gates.

*Independent community dashboard; not an official XPENG product.*


## Full model/year-group/paint image inventory

The [artwork map](vehicle-art-map.json) covers all current catalog combinations and explicitly marks missing image views. Run `python tools/sync_vehicle_artwork.py` after adding correctly licensed WebP images to the corresponding folder; see [mapping instructions](docs/ARTWORK_MAPPING.md). Until the file is available, the dashboard displays a labelled illustration. No trim-specific photos or guessed vehicle/paint substitutions are used.


### G6 original generation artwork

A first pack for G6 **2023–2025** adds five exterior paints × front, charging/rear and top views (15 WebPs). These are **AI-generated illustrative cutouts**, not manufacturer-confirmed photographs, and must be treated as previews. See `sources/ai-generated-vehicle-art.json` and `docs/ARTWORK_MAPPING.md`. Runtime raw GitHub URLs point to `main`, so PR-only uploads become live after merging.


## Complete multi-model artwork matrix

[Final 15-model year/paint artwork matrix](docs/FULL_MODEL_COVERAGE.md) tracks all 15 catalogue models, 21 year groups, 113 exterior paint choices and three independent image slots per combination. The [CSV build backlog](artwork-backlog.csv) identifies pending versus uploaded real files. Some historical/region-specific paint lists remain provisional; see source notes. 43 actual WebP assets are currently uploaded — the remaining slots **are not pictures**. Model/year/paint choose the asset; trim is display-only and never affects artwork or telemetry. Run `python tools/export_vehicle_artwork_backlog.py --check` to verify the CSV before merging.


## Remaining model-specific camera angles

The [master-view work queue](master-view-queue.json) tracks missing independent front, rear/charging and vertical-overhead photos for all 21 body-generation groups. [Build order](docs/ARTWORK_MASTER_PLAN.md). Generating correctly shaped master trios precedes any mass colour derivation; a missing camera view is never replaced with an alternate angle.
