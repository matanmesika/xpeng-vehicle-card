# XPENG Vehicle Card v0.6.0-alpha.1 — Cockpit

This experimental prerelease contains the owner's **vehicle-centered XPENG G6 cockpit** presentation. It remains an unofficial **read-only Home Assistant dashboard**; no direct consumer XPENG account authentication or vehicle remote-control API has been verified.

### Added / fixed

- Opt-in `dashboard_layout: cockpit` gives a full-width, responsive vehicle dashboard with sidebar, overview, charging, climate, door status, tires, location and vehicle details; `classic` remains the default.
- Comfort screen shows **steering wheel heating**, seat heating, seat ventilation and seat massage. All controls are explicitly **disabled** pending an authorized and verified manufacturer cloud API.
- Supports configured **2026 G6 Core Performance AWD** appearance, Arctic White paint and Dark Gray upholstery. This does not assert hardware control availability.
- Includes exact owner Lovelace view YAML in `dashboards/xpeng-g6-cockpit.yaml`, preserving `navbar-card` template `main_nav`, path `xpeng-g6`, HACS file paths and iPhone safe-area padding.
- Fixed previous packaging bug: source and distributable JavaScript are now byte-identical, with browser regressions for desktop/mobile, custom appearance and fullscreen.
- Never populates missing vehicle data with fabricated values and does not send commands to a vehicle or third-party cloud.

### Installation

Add this repository to HACS as a **Dashboard** custom repository; install prerelease `v0.6.0-alpha.1`, refresh browser/app frontend cache, then paste the YAML from `dashboards/xpeng-g6-cockpit.yaml`. If your navbar template has a different name, adjust only `template: main_nav`.

Check the installed frontend script at `/hacsfiles/xpeng-vehicle-card/xpeng-vehicle-card.js` after update. Existing `v0.5.0-alpha.5` cannot display the new Cockpit layout.

### Current limitations

No real XPENG International app direct API login, charging commands, remote climate/seat functions, or steering wheel commands are available. Disabled UI deliberately never simulates command success. Live data requires appropriately mapped, real Home Assistant entities.
