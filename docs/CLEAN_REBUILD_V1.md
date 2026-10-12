> **ARCHIVED CONCEPT — NOT THE ACTIVE DASHBOARD SPECIFICATION.** This file describes an abandoned multi-page UI prototype. For the current owner-approved two-screen status/charging card with top-down TPMS and click-only network info, see [DESIGN_LOCK.md](../DESIGN_LOCK.md) and [README_HE.md](../README_HE.md). Do not implement older navigation, climate, or interior preview concepts from this page.

---

# XPENG Vehicle Card — clean rebuild v1 (preview / not released)

This iteration is a **status-first Home Assistant vehicle dashboard**.
The landing page prioritizes the car illustration, SOC, range, charging
information, vehicle lock/door status, climate and location; secondary
detail screens use navigation buttons at the bottom.

Charging states are derived from matching Home Assistant entities:
active charge, plugged in but idle, unknown and stale are never conflated.
All numerical values are omitted when missing. The artwork remains illustrative.

This implementation is a new self-contained vehicle user interface. It reuses
only the existing XPENG vehicle data key mapping, authored G6/other-model
illustrations, model selection catalogue and Home Assistant card editor.

Unlike the previous sidebar dashboards, the new card has a **single** landing
screen with one car image, four icon shortcuts and a four-row vehicle menu.
Selecting Controls / Climate / Charging opens an in-card panel; Back returns
to the landing screen. There is no separate dashboard rail, two-column status
grid, duplicated page heading, or in-card exterior paint picker.

Visual / interaction acceptance criteria:
- The car image loads and matches the model/year/paint configuration.
- An iPhone and desktop have the same four menu choices and button order.
- Controls has top-down door diagram, read-only state labels and disabled
  remote buttons, plus tyre-pressure view.
- Climate shows the configured Dark Gray / Light Gray cabin and steering
  wheel heating and seat heating/ventilation/massage controls visibly
  unavailable until XPENG authorizes an API.
- Charging displays current SOC/range/charging information only when HA
  provides valid state; edit sliders and charging-port actions are disabled.
- Exterior/interior settings are changed **only** in Home Assistant card editor.
- Card can enter and exit full screen, and the owner's navbar-card remains
  outside it in the existing view.
- No API requests, secret capture, fake sensor values or remote service calls.

The existing manufacturer-independent UI layout is original work. The reference
vehicle dashboard's source and imagery are not used or redistributed. Exact
pixel parity and dynamic photo overlays for open doors, climate effects and
charge-port states require **new licensed assets**, not mock state changes.

No code should be merged/released before screenshots from the real bundled JS
have been inspected against the approved reference and the owner has approved
the direction.

For the owner's G6 2026 Performance AWD, use
`dashboards/xpeng-g6-cockpit.yaml`, retaining `main_nav`.
