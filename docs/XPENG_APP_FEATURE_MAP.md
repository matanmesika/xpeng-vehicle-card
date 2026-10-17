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
| Driver heated seat | `driver_seat_heat_select` (`select`) | Tap red seat heat icon cycles Off → Heat 1 → Heat 2 → Heat 3 → Off |
| Front passenger heated seat | `passenger_seat_heat_select` (`select`) | Heat levels 1–3 cycle; Off is blocked because Xpengtk reports that the G6 rejected the command; no false success claim |
| Driver ventilated seat | `driver_seat_ventilation_select` (`select`) | Tap blue vent icon cycles Off → Ventilation 1 → 2 → 3 → Off |
| Front passenger ventilated seat | `passenger_seat_ventilation_select` (`select`) | Built when available |
| Left/right rear heated seats | `left_rear_seat_heat_select` / `right_rear_seat_heat_select` (`select`) | Built when available |
| Left/right rear ventilation | `left_rear_seat_ventilation_select` / `right_rear_seat_ventilation_select` (`select`) | Disabled upstream by default; hardware-dependent; hide when absent |
| Steering-wheel heater | `steering_wheel_heat_select` (`select`) | Direct wheel icon cycles Off → Low → Medium → High → Off |
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

## Automatic parking and remote movement

Official XPENG G6 material (including regional availability caveats) describes APA, AEP and remote parking. The Xpengtk `services.py`, `button.py` and `command_policy.py` inspected for this change contain **no documented or verified park/move/remote summon command**. The card must not infer movement commands from MQTT internals or pretend that service success implies movement safety. No remote parking command is added. Future support requires an upstream supported API with appropriate user presence, safety supervision and jurisdiction/vehicle compatibility checks.


## Climate page feature parity with owner-supplied XPENG screenshot (2026-10-17)

**Interior colour is chosen exclusively in the vehicle card editor** (`Interior finish · צבע פנים הרכב`), or card `interior` YAML, not inside the climate panel. `xpCabinView()` displays the matching `light_gray` or `dark_gray` interior automatically; the generated photo WebP assets are still missing from this draft branch and the already-committed SVG art is the fallback.

| OEM-app feature | Verified Xpengtk entity/API | Card behaviour |
| --- | --- | --- |
| A/C toggle | `climate.cabin_climate` (`turn_on`, `turn_off`) | Action tile below cabin + target temperature controls |
| Target temperature | `climate.cabin_climate` (`set_temperature`) | 0.5°C incremental controls, 16–32°C when available |
| Fan level | `number.fan_speed_control` (`set_value`) | Native slider with entity min/max/step |
| Front windscreen defrost | `switch.defrost_switch` (`toggle`) | Action tile with live on/off state |
| HVAC schedule | `calendar.hvac_schedule_calendar` / `sensor.hvac_schedules`, and `switch.hvac_schedule_<appointment_id>` | View existing schedules; enable/disable individual schedules where a matching native switch exists. No invented schedule creation |
| Front/rear seat heat and ventilation, steering heat | Native Xpengtk `select` entities | Direct in-image 1→2→3→Off on each supported control, with passenger front heat Off limited by upstream |
| Heating MAX / Cooling MAX | No distinct Xpengtk *command* verified. Some telemetry may describe quick warm/cool *state*. | No actionable tile |
| Refresh / sterilisation / A/C cleaning | No verified Xpengtk entity/service action | Hidden, never send undocumented MQTT |
| Rear window defroster | No verified separate Xpengtk remote *switch* | Hidden; mirror-heating status is not a rear-defrost command |
| Pet Mode | No verified Xpengtk command | Hidden |

These checks are based on the current upstream `climate.py`, `switch.py`, `number.py`, `button.py`, `select.py`, `calendar.py`, and documented `services.yaml`. OEM-app features can exist on the car without being available as remote controls to Home Assistant. The card never upgrades display-only telemetry to a button.
