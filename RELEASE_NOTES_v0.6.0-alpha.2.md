# XPENG Vehicle Card v0.6.0-alpha.2 — Editor-only appearance

- Exterior paint and interior upholstery are editable **only** via Home Assistant dashboard Edit → Edit card, or saved card YAML `color` and `interior`.
- Cabin finish applies to dashboard trim, steering wheel, door panels, console, front seats and rear seats together.
- Removed in-card paint controls and the Settings/Appearance menu. Interior now displays the configured finish without editing it.
- Discarded browser-local preferences; dashboard configuration is the sole source across mobile and desktop.
- Keeps responsive Cockpit, full-screen, safe read-only telemetry and disabled unsupported remote commands.
- Experimental alpha. Install with HACS prerelease option, then refresh Home Assistant frontend.
