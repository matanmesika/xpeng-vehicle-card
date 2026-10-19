# G6 Charging Visual QA — v1.0.4

This document defines an executable review gate for the owner's approved charging composition. The dashboard remains the original XPENG G6 Home Assistant card, with the approved night-lakeside background, rear-three-quarter vehicle art, live Xpengtk telemetry and vehicle commands. Do not replace the screenshot with a newly generated dashboard image.

## Accepted visual composition

- Charging station: photographic XPENG pedestal, at the front-right of the visible vehicle, slightly farther forward and higher in the scene. Its physical size must remain proportional to the car.
- Depth order: **night background (0) < charging pedestal (5) < vehicle (7) < live cable (11) < charging telemetry (12)**.
- Cable: one thin, uninterrupted, green charging wire from the exposed vehicle port to the real pedestal connector. Separate responsive SVG paths are used, not a green cable baked into the car photograph.
- Desktop: the original charging information panel stays on the left and all seven vehicle action shortcuts remain unchanged.
- iPhone and Sections: compact charging telemetry stays above the car, without hiding the pedestal or controls. The dock remains reachable.
- Charging state: only the live HA charging sensor turns the scene on and shows the green cable; stop/disconnect returns to Home.

## Automated visual QA agent

The GitHub Actions workflow `.github/workflows/g6-charging-visual-agent.yml` runs on relevant source changes, pull requests and manually. It uses **real Chromium + official Material Design Icons**, not generated display mockups.

The Chromium script `scripts/capture-dashboard.cjs` measures actual element bounds at desktop width 1400, phone widths 390/320 and Home Assistant Sections width 420. The gate checks the station/car height ratio, relative position near the vehicle's front-right, cable start/end touching their respective objects, clipping/overlap, stacking order, the mobile information panel and the real decoded photographic image. All supported vehicle commands and other screens must also survive the regression tests.

Screenshots and logs are uploaded as run artifacts. Only a **successful** run against the current candidate commit can be considered an automated pass; old screenshots do not count. An automated geometric pass is not a substitute for reviewing a real Home Assistant dashboard on the owner's desktop and iPhone.

## Stable release gate

Do not tag or publish `v1.0.4`, change the HACS default/release metadata, or merge to `main` until:
1. The latest candidate has passing Frontend, HACS, artwork, complete regression and charging visual QA jobs.
2. All 14 gallery PNGs were newly captured and inspected; no outdated screenshots.
3. The owner has approved the final desktop and iPhone results from **the actual dashboard**, including the cable connection and image proportions.
4. The current `main` branch changes have been reconciled non-destructively and verified.
5. The stable tag is immutable and its release contains the verified JS bundle and review gallery.

This is a frontend dashboard, not an XPENG API backend. Commands and entity availability depend on the user's Xpengtk integration and Home Assistant permissions.
