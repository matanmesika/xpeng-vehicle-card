# XPENG Dashboard — contributor quality instructions

## Repository boundary
This repository is the **frontend Lovelace XPENG dashboard only**. The companion integration is independent. Never modify integration code, change its entities, send car controls, use private XPENG APIs or place user secrets in screenshots/tests.

## Current product specification (owner-approved)
- Two primary screens: Vehicle status and sensor-triggered Charging.
- Approved nighttime landscape is one immutable shared background; actual car is a separate overlay.
- Tire pressure opens a large top-down detail in the Vehicle status area, four live pressures around the wheels, with Back to vehicle.
- **Image selection uses model + year group + exterior paint**. Year-group selection filters allowed trim labels but trim is always informational and has zero effect on artwork or telemetry. Different generations MUST NOT reuse one another's images. Year/model/paint changes may invalidate manually supplied artwork; trim changes never do.
- Connection indicator and info icon share the header row. **Only click on info opens** the transient popup with exactly Connection and Last vehicle update. No model/trim/cabin/image metadata in the popup.
- No new climate/controls/doors/weather/navigation screens or dashboard appearance selectors.
- Missing Home Assistant data must remain unavailable; no invented pressures, SOC or charging values.
- Do not claim model-family illustrations are verified highest-trim photos. Rear and overhead transparent manufacturer photos are a known gap.

## Review workstreams (instructions, not background autonomous agents)
1. **Design review:** inspect real desktop/mobile Playwright browser renders against the owner-approved composite references. Check fixed landscape, vehicle size/placement, tyre-detail layout and popover alignment.
2. **Asset review:** verify model/paint, copyright permission, file transparency and provenance. Label uncertain renderings illustrative.
3. **Data review:** confirm the mapping uses only public Home Assistant entity/attribute data, charging is sensor-triggered, and missing values are not guessed.
4. **Accessibility review:** network status text, popup labels, keyboard button focus, click-only activation, phone width and readable status/error messages.
5. **Release review:** Node tests, Python audits, Chromium visual tests, HACS flat-asset packaging, source/dist parity, and rollback path.

## Release checklist
- Keep `src/xpeng-vehicle-card.js` and `dist/xpeng-vehicle-card.js` byte-identical.
- Do not alter the SHA of the user-approved background.
- Check `data/model-artwork.json` records and actual flat HACS assets.
- Verify two fields only inside the info popup in disconnected, connected and connection-error states; popup never auto-opens.
- Check the frozen background on Overview and Charging and on mobile.
- The owner approved separating **UI fixes** from **new vehicle image delivery**. UI-only experimental alpha.6 may be merged/published if all checks pass and the approved background and car image binaries remain exactly unchanged from alpha.5. Manufacturer-authentic photo replacements, licensing and visual sign-off are a separate subsequent task.
