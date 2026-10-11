# XPENG Vehicle Card — clean rebuild v0.9.0-alpha.1

This branch is a **separate preview**, not a published release. The existing
0.7 HACS version remains unchanged until the vehicle owner approves actual
Chromium screenshots.

## Architecture

A single, independent Home Assistant card implementing a compact vehicle-app
flow. Only its current internal screen is rendered.

- Landing: large configured XPENG car illustration, battery/range, status,
  four action positions, navigation rows (Controls, Climate, Location, Charging).
- Controls: top-down XPENG drawing, four live door indicators, lock/trunk and
  frunk read-outs, tyre pressure screen, unavailable-only action controls.
- Climate: unified cabin upholstery visual with steering wheel, heated seat,
  ventilation and massage labels, safe unavailable target temperature controls.
- Charging: G6 asset, battery progress, charging power/range, disabled target
  limit/amp controls.
- Location: only reports availability of real Home Assistant GPS, no requests.
- Full-screen: supported browser Fullscreen API and CSS fallback.
- Vehicle selection, year, trim, paint and interior **only via Edit card/YAML**.
- All telemetry comes from real HA entities via per-model prefix or explicit
  per-vehicle entity mapping; **unknown values are not fabricated**.

## Deliverables & regression protection

- HACS root `xpeng-vehicle-card.js` and `dist/` are byte-identical.
- Bundled model artwork stays in place.
- `dashboards/xpeng-g6-cockpit.yaml` retains `main_nav`, all G6 Performance
  options, 2026, Arctic White, Dark Gray, no redundant Lovelace header.
- Browser tests generate actual desktop/mobile screenshots under
  `previews/clean-rebuild-v090/` and CI uploads screenshot artifact.
- Existing old browser tests reflect historical UI structures; new CI exercises
  the rewritten UI through `tests/test_clean_rebuild.py` and also runs HACS
  package and brand-independence checks.

## Explicit limitations

This is independently written XPENG UI. The third-party vehicle card that
inspired the requested navigation has no root license file, so we have **not**
copied its source or its other-brand images. Matching navigation and broad screen
layout does not guarantee pixel-identical images. We do not yet have XPENG
model-specific open-door/frunk/charge-port visual composites.

No approved direct XPENG International account login, live read schema, or
remote command endpoint has been verified. All control actions stay disabled.
