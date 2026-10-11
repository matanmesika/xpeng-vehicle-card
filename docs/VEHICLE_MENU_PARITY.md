# XPENG single-card flow — reference review and implementation boundaries

Reference: community vehicle-card menu layout reviewed for navigation behaviour. Code and assets are independently implemented.

**Intent:** Match the reference vehicle card's single-vehicle experience and interaction flow
with original XPENG code and original XPENG-compatible visual assets.

## Reference behavior

- Compact vehicle header with name, small battery display and range.
- Main vehicle image; quick controls below it.
- Rows for Controls, Climate, Location and Charging.
- Opening a row replaces the landing view with the corresponding submenu;
  Back returns to the vehicle.
- Controls: vehicle top view, locks/frunk/trunk zones, bottom quick control row,
  tyre-pressure switch.
- Climate: cabin overview, fan/temp controls, seat and steering wheel heat.
- Charging: battery, charge limit slider, charging current stepper, charge port.
- Adaptive portrait/landscape and optional full screen.

## Existing XPENG implementation

All interactions are independent implementations. Visual presets and vehicle
models use the repository's own assets. The dashboard YAML continues to use
`dashboard_layout: cockpit`, `prefix: my_xpeng`, a configured model, year,
trim, color and cabin interior. Exterior and upholstery editing remains
**card editor only**.

The source reference currently has **no LICENSE file** at the GitHub root,
so its code, third-party artwork and SVG button library are NOT copied or redistributed.
Visual consistency and XPENG-specific imagery must be improved with
properly licensed assets before claiming pixel-perfect parity.

## Blockers versus reference

- Exact dynamic opening-door/frunk/charging-port photo composites for XPENG
  do not exist in the current asset library. The present top view is schematic.
- The cabin diagram is original but remains stylized rather than 3D photoreal.
- All remote commands are disabled unless a real authorized XPENG API and
  Home Assistant entity/service mapping have been verified per model.
- A signed-off user review of 7 real Chromium renders is required before
  publishing, not just tests passing or design mockups.

## Acceptance criteria

- No dashboard sidebar, telemetry rail, multi-card grid, or duplicate header.
- Full-width vehicle image on landing; four quick action positions with
  unverified lock disabled.
- Controls, Climate and Charging are single replacement panels, and Back works.
- G6 2026 Core Performance AWD Arctic White and Dark Gray cabin.
- 390px and 1200px screenshots from the **actual bundled script** in CI.
- No fake telemetry, no command success simulation, no exterior API calls.
- All paint/cabin options set via Lovelace Edit Card/YAML only.
- Existing `navbar-card` main_nav remains separate, unchanged.
