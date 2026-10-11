# XPENG Vehicle Card — clean rebuild v1 (preview / not released)

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
