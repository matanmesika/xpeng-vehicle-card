# XPENG application → Xpengtk → vehicle card mapping

Status: 2026-10-16 G6 2026 pilot; **not** an APK binary decompilation or access-control bypass.
Sources: [XPENG G6 owner manual](https://manuals.plus/wp-content/uploads/2024/11/Xpeng-G6-User-Manual.pdf),
[XPENG G6 international specifications](https://xpeng.keyelement.cloud/assets/1/brochures/xpeng_g6_my25.pdf),
[XPENG Israel G6 specification](https://heyxpeng.co.il/g6/configurator-25/),
and the Xpengtk integration source (`custom_components/xpeng`).

## Implementation principle

The vehicle card is a Home Assistant frontend. It reads entity states and calls
built-in Home Assistant services, **not** undocumented XPENG endpoints. Stable
Xpengtk unique IDs (`xpeng_<VIN>_<key>`) determine which user-renamed entity ID
belongs to which control. One vehicle is selected by its GPS tracker device.
Opt-in `show_controls: true` preserves the preexisting vehicle/charging artwork.

| User action | Xpengtk stable key (domain) | UI / policy |
| --- | --- | --- |
| Cabin A/C on/off and target temperature | `cabin_climate` (`climate`) | Built: `turn_on`, `turn_off`, `set_temperature` |
| Fan speed | `fan_speed_control` (`number`) | Built: `set_value` |
| Front defrost | `defrost_switch` (`switch`) | Built: `toggle` |
| Driver heated seat | `driver_seat_heat_select` (`select`) | Built: choose levels from entity options |
| Front passenger heated seat | `passenger_seat_heat_select` (`select`) | Built; upstream front passenger `Off` unsupported in some telemetry, disabled in UI |
| Driver ventilated seat | `driver_seat_ventilation_select` (`select`) | Built when entity available |
| Front passenger ventilated seat | `passenger_seat_ventilation_select` (`select`) | Built when available |
| Left/right rear heated seats | `left_rear_seat_heat_select` / `right_rear_seat_heat_select` (`select`) | Built when available |
| Left/right rear ventilation | `left_rear_seat_ventilation_select` / `right_rear_seat_ventilation_select` (`select`) | Disabled upstream by default; hardware-dependent; hide when absent |
| Steering-wheel heater | `steering_wheel_heat_select` (`select`) | Built when available |
| Charging target | `charge_limit_control` (`number`) | Built: native slider |
| Stop active charging | `stop_charge` (`button`) | Built: press with confirmation |
| Open charge flap | `open_charge_port` (`button`) | Built on main scene with confirmation |
| Automatic return on unplug | `plugged_in` / `charging` (`binary_sensor`) | Built: real telemetry decides view |
| Door lock | `door_lock` (`lock`) | Built: securing action with confirmation |
| Unlock the vehicle | `door_lock` (`lock`) | Doors popup: disabled by default, requires `enable_access_controls: true` AND Xpengtk Access policy |
| Close windows | `close_windows` (`button`) | Windows popup, native HA button.press with confirmation |
| Close trunk | `close_trunk` (`button`) | Built in securing panel with confirmation |
| Flash lights, sound horn | `flash_lights`, `honk_horn` (`button`) | Built in securing panel with confirmation |
| Arm X-Guard | `sentinel_switch` (`switch`) | Built only when state off |
| Disarm X-Guard | `sentinel_switch` (`switch`) | Not shown; Access permission required |
| Vehicle GPS | `location` (`device_tracker`) | Native HA entity detail, never guessed location |
| Charge-cable release latch | no distinct verified Xpengtk entity or action | **Not implemented**; `stop_charge` and `open_charge_port` do not unlock the cable |
| Pet mode, MAX A/C, sterilisation, rear separate temperature | no verified independent entity in Xpengtk | Not offered as fake controls |
| Seat massage | model equipment may support it; no verified control entity | Not offered until real command is measured |
| Exterior door opening | no verified direct per-door control | Not offered |

## Interior imagery and models

Two **original illustrative SVGs** are shipped for `G6/2026`:

- `assets/interiors/g6/2026/light_gray.svg`
- `assets/interiors/g6/2026/dark_gray.svg`

Both share the same 800×500 geometry and five normalized interactive hotspots
(wheel, driver, passenger, rear-left, rear-right). The selector is driven only
by the per-car `interior` setting; it never uses the paint of the exterior.
These are **not manufacturer photos**. Images obtained from XPENG's public
site are visual references only; do not copy/rehost without permission.
Manufacturer-verified or properly licensed photographs may replace these
illustrations later, but must be prepared with matching seat coordinates.
Other models use the preexisting color-matched generic schematic until
their model-specific asset pair is available. Never silently show G6 artwork
as a G9/P7/etc interior.

## Safety and deployment

Xpengtk `safe_plus` includes Comfort, Lights, Charging and Securing, not
Access. The dashboard does not grant rights and must not misrepresent an
optimistic service response as proof of action. Disabled entities and absent
model hardware are hidden. Commands use explicit service allowlists and
confirmation for potentially disruptive physical actions.

QA requires tests in desktop window, narrow HA Sections card and iOS Safari
(portrait). This PR remains in draft until the model-specific imagery and
command results are checked against a real vehicle.
