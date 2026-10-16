# Entity mapping, validation and command policy

## Evidence categories

1. **Verified remote API**: manufacturer-authorized endpoint and response verified with permission and real data. **Current count: 0.**
2. **Home Assistant entity present**: entity is actually available in `hass.states`. This permits **read-only display only**.
3. **Manufacturer vehicle feature**: hardware/UI supports a feature, but this does **not** imply an accessible remote command or cloud field.
4. **Community/OBD reference**: may help research but is **not** proof of public XPENG cloud availability.

## Read-only Home Assistant entity aliases

Default entity IDs are formed as `<domain>.<prefix>_<field>`; the user may configure explicit `entities` aliases. Some example aliases (provisional, not guaranteed):

| Page | Signal | Default expected entity |
|---|---|---|
| Overview | SOC | `sensor.my_xpeng_battery` |
| Overview | Range | `sensor.my_xpeng_estimated_range` |
| Charging | Charging | `binary_sensor.my_xpeng_charging` |
| Charging | Power (kW) | `sensor.my_xpeng_charging_power` |
| Charging | Energy (kWh) | `sensor.my_xpeng_charge_session_energy` |
| Climate | Cabin temperature | `sensor.my_xpeng_cabin_temperature` |
| Controls | Locked | `binary_sensor.my_xpeng_locked` |
| Info | Odometer | `sensor.my_xpeng_odometer` |

A matching field name is **not** evidence of a working XPENG API field. Entity presence may come from any legitimate Home Assistant integration.

## Commands deliberately unavailable

The card does not call remote control services. Steering wheel heating, driver/passenger seat heat, ventilation and massage have **no verified direct XPENG cloud control mapping** in this project. Do not enable controls by constructing arbitrary entity IDs or assuming app UI buttons correspond to public endpoints.

## Appearance is not telemetry

`year`, `model`, `trim`, `color` and `interior` are saved UI settings and must not create device sensor entities. The cabin diagram is conceptual, not a certified factory rendering.

## Direct Xpengtk auto-discovery (rename safe)

The XPENG Vehicle Card now uses Home Assistant Entity Registry to discover entities
registered by the Xpengtk integration (platform = xpeng). It reads their stable
unique_id, not the user-editable entity_id. For example, xpeng_<VIN>_battery_soc
continues to identify the battery when the user changes the entity ID from
sensor.xpeng_g6_battery to sensor.my_car_battery.

Example for the G6 2026:

    type: custom:xpeng-vehicle-card
    prefix: xpeng_g6
    model: G6
    year: "2026"
    sensor_mapping_mode: auto

The prefix is used as a fallback only, so registry-based discovery is independent
of the user's chosen entity IDs. Manual mappings still take precedence.
Discovery uses an authenticated HA websocket registry read; it does not handle
XPENG credentials, tokens, certificates or the XPENG cloud API.

If the entity registry is unavailable to the current Home Assistant user
(possibly due to administrator permissions), the card falls back to conventional
prefix lookups. Multiple XPENG cars are not selected arbitrarily: use
xpeng_device_id to select a specific Home Assistant device registry ID,
or a distinct conventional prefix if the existing tracker ID still matches.

Control entities (climate, lock, charge flap buttons, charging buttons,
number and select) are provided by Xpengtk. This revision fixes automatic
sensor discovery; the card remains read-only. Physical commands must be
rendered with authorized HA controls in a later UI revision. The charge-port
flap command is not proof of a separate charge-cable release command.
