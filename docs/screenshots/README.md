# Screenshots of the running dashboard

These are **real browser captures of the shipped XPENG Vehicle Card** using
the checked-out JavaScript, checked-out artwork and a mocked Home Assistant
sensor object. They are not AI renders and they contain no user's vehicle data.

- `g6-2026-vehicle-status.png`: regular status screen.
- `g6-2026-charging.png`: charging screen with connected cable image.
- `g6-2026-tire-pressure.png`: tire pressure view with top artwork.

The numeric values in the screenshots are **demo telemetry** and must never
be presented as data read from an actual vehicle.

To regenerate these in the GitHub workflow, run
`Capture actual XPENG dashboard views` (or edit
`scripts/capture-dashboard.cjs` on its feature branch).
