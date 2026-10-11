# XPENG Vehicle Card

[![Open in HACS](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=matanmesika&repository=xpeng-vehicle-card&category=plugin)

**Custom Home Assistant Lovelace card for XPENG electric vehicles.** A dedicated dark vehicle interface with model-aware visuals, dedicated status pages, and a configurable exterior and full-cabin interior appearance.

> **Alpha • Community project • Read-only.** This card is **not an official XPENG product** and is not affiliated with XPENG Motors. It does not log in to the vehicle or implement remote commands. The companion `Xpeng` backend is a separate experimental project; a production-ready, authorized XPENG cloud connection has **not yet been verified**.

![XPENG G6 2026 dashboard preview](previews/g6-2026-default.png)

## Features

- Category-aware central artwork: a cabin for climate/interior, annotated car for doors/tires and distinct charging/location overlays.
- Dedicated **Overview**, **Charging**, **Climate**, **Interior & seats**, **Controls**, **Vehicle information**, **Location** and **Tire pressure** pages.
- XPENG G6 2026 facelift visual with hood-mounted X mark, configurable trim and exterior paint.
- Interior finish option **Dark Gray** / **Light Gray**. The choice changes the dashboard, wheel, door inserts, centre console and all seats *together* in a vector cabin illustration. Exterior and interior styles are independent.
- Expandable full-window display with a dedicated Exit full screen button; this affects presentation only.
- Multiple XPENG models, model years and configurable vehicles. **Non-G6 model art is illustrative**; not manufacturer-accurate for every model or region.
- Reads configured Home Assistant states; `unknown`, `unavailable` and absent entities display as unavailable, **not as zero or fabricated vehicle values**.
- Vehicle controls are deliberately disabled. Steering-wheel heat, seat heating/ventilation/massage and other advanced actions are not treated as remotely controllable without a validated integration.
- Display-only personalisation; changing paint, trim or interior finish never changes the physical car.
- Language: initial card UI is English; Hebrew setup documentation is provided.

## Screenshots

| Vehicle | Charging & appearance | Interior finish |
|---|---|---|
| ![G6 overview](previews/g6-2026-white-home.png) | Editor-only appearance configuration | ![Light Gray interior](previews/interior-2026-light-gray.png) |

Preview screenshots contain **demonstration data** and do not establish any live manufacturer API support.

## Installation

### HACS (custom repository — early-access alpha)

1. Open **HACS → ⋮ → Custom repositories** and enter this repository URL.
2. Select **Dashboard** category, download the card, then confirm the `xpeng-vehicle-card.js` resource is registered as a JavaScript module. HACS may register the resource automatically depending on the installed version.
3. Reload the browser (a hard refresh may be needed).
4. Edit your dashboard → Add Card → **Manual** and use the configuration below.

This repository declares `hacs.json` and packages the JS and images together under `dist/`. The default image URL is `/hacsfiles/xpeng-vehicle-card/assets`.

### Manual installation

1. Copy `dist/xpeng-vehicle-card.js` into `/config/www/xpeng-vehicle-card.js`.
2. Copy the **contents** of `dist/assets/` into `/config/www/xpeng/` (including subfolders).
3. In Home Assistant, add a Dashboard Resource: `/local/xpeng-vehicle-card.js`, type **JavaScript module**.
4. Set `image_path: /local/xpeng` on the card and reload the dashboard.

### Example configuration

```yaml
type: custom:xpeng-vehicle-card
prefix: my_xpeng
year: '2026'
model: G6
trim: core_plus_rwd
color: arctic_white
interior: light_gray
theme: dark
# image_path: /local/xpeng   # ONLY when installed manually
```

`prefix` should match entity IDs produced by your integration (for example, `sensor.my_xpeng_battery`). The default backend entity names are provisional: see [entity mapping and limitations](docs/ENTITY_MAPPING.md). You can also set individual entity mappings using `entities` in your card configuration.

## Personalisation

All five studio paints and both cabin finishes are offered through the visual appearance catalogue, with trim-specific options where relevant. This is a worldwide display feature, not a claim of official factory availability.


The built-in card editor allows choosing model year, XPENG model, trim, exterior paint, and interior finish. Appearance is configured **only through Home Assistant dashboard Edit → Edit card** or the saved card YAML, never inside the dashboard. Interior settings affect dashboard, wheel, door inserts, console, and all seats together. Old per-browser appearance overrides are now ignored. Available paint and trim options are approximations and **must not be mistaken for a verified local sales catalogue**.

## Live data and limitations

The card is a **frontend component**. It cannot generate new sensors or discover undocumented endpoints. Live values require functioning entities supplied by Home Assistant. No authorized XPENG production API has been validated for this project. The visual vehicle controls are not functional; there are no hidden API requests. [Read the supported mapping principles](docs/ENTITY_MAPPING.md).

## Release status

- Version: `v0.7.0-alpha.1` — preview-quality release candidate, **not stable**.
- Checks: JS/JSON validation, asset verification, and browser regression tests defined in GitHub Actions.
- Remaining gate: green CI, real Home Assistant installation test, HACS custom-repository installation test, and future XPENG API verification for controls.
- Files: [Hebrew documentation](README_HE.md), [release checklist](RELEASE_CHECKLIST.md), [changes](CHANGELOG.md), [contributing](CONTRIBUTING.md), [security](SECURITY.md), [trademark statement](TRADEMARK.md).

## License and attribution

MIT for original project code (see `LICENSE`). XPENG brand names and marks remain the property of their owners. Original illustrative model images are **not guaranteed factory-accurate**. No affiliation or endorsement is claimed.

## Cockpit for 2026 XPENG G6

Version `v0.7.0-alpha.1` introduces an **opt-in**, vehicle-centered `dashboard_layout: cockpit` with large model-aware car art, navigation, charging, climate, vehicle status, tires, fullscreen and Comfort (steering wheel heating, seat heating, ventilation and massage). Existing configurations keep the `classic` layout.

The owner's full sections-view YAML retaining the `main_nav` navbar and the `core_performance_awd` trim is available at [`dashboards/xpeng-g6-cockpit.yaml`](dashboards/xpeng-g6-cockpit.yaml).

**Safety:** all comfort remote controls are disabled. There is no validated consumer-account XPENG direct API; disconnected readings remain unavailable. The visual interface is not proof of feature support or actual connected status.

## Appearance editing policy

Version `v0.7.0-alpha.1` removes the in-card Settings/Appearance page and paint/upholstery buttons. Select `color` and `interior` using the Home Assistant card editor or YAML only. The read-only Interior page shows the chosen whole-cabin finish, including upholstery and dashboard trim. No localStorage preferences can override the shared configuration on iPhone, desktop, or other clients.

## v0.7 Studio Cockpit actual implementation

The previous concept screenshots were **not browser captures of the implementation**; this release replaces the generic box layouts with a cohesive car-centered layout. The main `G6 2026` image stays prominent in each section, with per-page overlays, a contextual right rail and native Home Assistant telemetry. No fabricated SOC, location, climate or remote command success.

Screenshots from the actual Chromium-rendered card are attached to the [v0.7 alpha release](https://github.com/matanmesika/xpeng-vehicle-card/releases/tag/v0.7.0-alpha.1), covering desktop and mobile Overview, Controls, Climate, Comfort, Charging, Tires and Interior. The owner YAML with the existing `main_nav` is in `dashboards/xpeng-g6-cockpit.yaml`.


## Rebuild preview (v0.9.0-alpha.1, not yet released)

A clean single-card vehicle app with four home menu rows, large XPENG car image, Controls, Climate (including steering wheel heat and seat functions), Charging and Location. No sidebars or multiple dashboard panels. Uses editor-only paint/upholstery and the same G6 2026 YAML. See [preview specification](docs/REBUILD_FROM_SCRATCH.md) and browser screenshots in PR CI artifacts. XPENG cloud API remains unverified; commands stay disabled.
