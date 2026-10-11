# XPENG Vehicle Card v1.0.0-alpha.1 — Dashboard-first vehicle overview

This is an **experimental read-only UI update**, not an XPENG cloud API release.
A fresh version of the card replaces the old Studio sidebar and app-style
landing menu with a Home Assistant status-focused vehicle dashboard.

### What is new
- Main G6 and other XPENG model illustration remains front and centre.
- **Battery level, estimated range and charging status are visible on Home.**
- When a valid Home Assistant sensor reports that charging is active, the Home
  battery panel automatically displays charging power (kW), remaining minutes
  in hours/minutes and energy added (kWh), where available.
- Plugged-in but idle, disconnected/unknown and known stale connection states
  are kept distinct — no fabricated green charging badge.
- Target charging percentage, port status, vehicle lock/door summary, cabin
  temperature, location and last vehicle update are visible at a glance.
- Detailed Controls, Climate, Charging and Location screens remain accessible
  but secondary; unsupported command buttons remain disabled.
- Fixed 25 backend entity IDs to align with actual XPENG Direct entity keys,
  preserving fallback compatibility for old entity IDs and explicit YAML
  `entities` overrides.
- Exact owner's Lovelace view is preserved:
  `dashboards/xpeng-g6-cockpit.yaml` (G6 2026 Performance AWD,
  Arctic White, Dark Gray, `main_nav`).
- Exterior and cabin colour selection remains exclusively in Edit Card / YAML.
- Includes real Chromium desktop and phone previews for **offline** and
  **charging-state simulation**; filenames containing TEST-DATA are fixtures,
  not live vehicle readings.

### Limitations
No verified official XPENG International account login, live cloud API
or remote commands have been integrated. Until real vehicle telemetry is
available, values are displayed as unavailable, not invented.
For actual Home Assistant installations where generated entity IDs differ,
map them explicitly with `entities` in the card YAML.

### Installation
Install this pre-release from HACS as a custom Dashboard repository,
clear the browser cache and paste the supplied dashboard YAML.
