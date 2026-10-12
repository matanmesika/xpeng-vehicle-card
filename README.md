# XPENG Dashboard — Home Assistant vehicle card

A standalone, **read-only Home Assistant dashboard card** for XPENG vehicles. This repository contains **frontend/UI only**; the XPENG Home Assistant integration is a separate project and is not modified here.

**עדכונים והיסטוריית גרסאות:** [CHANGELOG.md](CHANGELOG.md) הוא המקור המרכזי והמתעדכן לשינויים בפרויקט. קובצי Release Notes היסטוריים, ככל שקיימים, אינם משמשים לניהול עדכונים שוטפים. פרסום גרסה להתקנה מתבצע בנפרד דרך [GitHub Releases](https://github.com/matanmesika/xpeng-vehicle-card/releases).

**Release plan (2026-10-12):** The already-tested dashboard and sensor-mapping fixes are being shipped independently of missing photos as **v1.0.0-alpha.6**. Check [GitHub Releases](https://github.com/matanmesika/xpeng-vehicle-card/releases) to confirm publication. The previously published v1.0.0-alpha.5 was the baseline. **No replacement car images or approved background changes are included in alpha.6.**

## User-approved design

- One **fixed approved night-time lake/house/mountain photo** as the full-screen background. Vehicle artwork is a separate foreground layer. Do not change the background without owner approval.
- Two principal modes: **Vehicle status**, and **Charging** only when the mapped Home Assistant charging sensor reports active charging. No extra control, weather, climate, seat, door or map pages.
- In Vehicle status, tapping **Tire pressure** keeps the same approved scenic background, brand header and vehicle title, while replacing the central car with a colour-matched overhead view and four independently measured pressure values near the corresponding wheels. The readings use the same dark-glass style as the main information panel; **Back to vehicle** restores the hero. This is a detail mode within Vehicle status, not a third dashboard page. Until a verified overhead image is obtained, the vehicle artwork is explicitly labelled illustrative.
- The top-right header has **one Wi-Fi button** (no separate connection text or info icon) on desktop and mobile. Its colour indicates the mapped connection state, without assuming a connection when the sensor is missing. Tap the Wi-Fi icon to open a popup with only **Connection** and **Last vehicle update** from mapped Home Assistant sensors. The date/time is shown explicitly when supplied by the vehicle-update sensor; a Home Assistant entity's generic `last_updated` metadata is not treated as a vehicle refresh. Tap the same icon to close. No cabin, model, paint or artwork metadata in the popup.
- No hardcoded SOC, range, TPMS, charging data, location or update times. Missing values are displayed as unavailable/—.

## Artwork selection policy: model + exterior paint

**The pictured vehicle is determined by MODEL and EXTERIOR COLOUR ONLY.** Every supported model/year/trim selection shares **one highest-available-trim image** for the chosen model and colour.

- **Model** changes vehicle artwork and its available selections.
- **Exterior colour** changes the vehicle artwork (and any colour-matched preview).
- **Model year** changes only the *names offered in the trim list*. It never changes the vehicle image, chosen colour, cabin preview, charging/overhead photo or telemetry.
- **Trim** is informational only, with no visual or sensor effect. Older years deliberately display the same current model picture.
- **Interior finish** is an editor-only future-facing visual setting; it does not appear in the information popup.

The mapping is recorded in [model-artwork.json](model-artwork.json). Currently, G6 uses its available `core_performance_awd` artwork, G9 uses `performance_awd`, and other models fall back to their available model-colour illustrations. **Existing artwork is illustrative/unverified, not confirmed manufacturer photography of every highest trim.** The card does not falsely claim a rear or overhead manufacturer cutout exists: rear images are pending, and TPMS uses a labelled overhead illustration until a suitable owner-provided `top_image` is configured.

See [artwork and tire view policy](docs/SHAPE_ASSETS_AND_TPMS.md) and [design lock](DESIGN_LOCK.md).

## Installation through HACS

Add `https://github.com/matanmesika/xpeng-vehicle-card` to **HACS → Custom repositories**, category **Dashboard**. Install the most recent published preview and reload Home Assistant. For the new UI and sensor editor, install alpha.6 once it appears on GitHub Releases. **Image improvements will be a separate later update.**

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
- `model-artwork.json` is the simplified model+paint mapping; `vehicle-art-inventory.json` lists the actual packaged files, including historical source paths (which **do not** control runtime year/trim selection).
- `tests/` covers appearance invariants, real sensor mapping, network info popup, charging and tire modes, responsive desktop/phone browser rendering, image inventory and HACS packaging.

The tested UI improvements originated in [PR #21](https://github.com/matanmesika/xpeng-vehicle-card/pull/21); image research continues separately. See [release checklist](RELEASE_CHECKLIST.md) and [changelog](CHANGELOG.md). Final real-vehicle photography, licence checks, owner visual sign-off, and installation testing in an actual Home Assistant instance remain separate release gates.

*Independent community dashboard; not an official XPENG product.*
