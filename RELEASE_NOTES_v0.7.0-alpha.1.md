# XPENG Vehicle Card v0.7.0-alpha.1 — Studio Cockpit redesign

The Cockpit interface has been visually rebuilt to use **the real detailed G6 vehicle artwork already shipped with the card** instead of replacing it with simplified top-down/cabin diagrams. The mockup shown during concept discussion was not an actual functional screenshot; this release includes actual **Playwright Chromium screenshots** from the running card as release assets.

### User-visible changes
- Large, detailed G6 car photo appears in the central stage on every page.
- Separate overlay illustrations for cabin, doors, and tire monitoring are contextual helpers — they no longer replace the main car.
- One strong XPENG title, smaller connection banner, clean side navigation, compact quick navigation cards and 4 dashboard panels below.
- Eliminated broken logo-image dependency with a simple local text-and-X wordmark.
- Improved responsive desktop and phone composition, fullscreen, and safe clearance for the existing Home Assistant `main_nav`.
- Avoids redundant diagrams / long duplicate status lists inside the central illustration.
- Paint `color` and interior `interior` remain configured **only** in the Home Assistant card editor.
- Includes revised owner view file: `dashboards/xpeng-g6-cockpit.yaml` (no duplicate Markdown header, keeps `navbar-card: main_nav`).

### Truthful availability
- Connection, SOC, range, charging, climate, doors, tire pressure, location and odometer only show actual HA values. Unknown values remain unavailable.
- All manufacturer-unverified commands remain disabled; screens, not car controls, are navigable. Comfort includes steering-wheel heat and seat heat / ventilation / massage.
- Neither a verified XPENG International user login nor remote commands are provided by this card.

### Screenshots and installation
- Actual browser screenshots: `desktop-overview.png`, `desktop-controls.png`, `desktop-climate.png`, `desktop-comfort.png`, `desktop-charging.png`, `desktop-tires.png`, `desktop-interior.png`; equivalent `phone-*.png` variants are attached as release assets.
- Install custom repository in HACS as a Dashboard; select the Alpha pre-release; refresh frontend. Do not mistake concept imagery for the real card.
- This is still an *alpha*: live HA owner environment verification and OEM API documentation remain outstanding.
