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

The XPENG Vehicle Card reads Home Assistant Entity Registry rows registered by
Xpengtk (platform = xpeng). It maps stable unique-ID suffixes
(xpeng_<VIN>_<key>) to the current entity IDs. For example,
xpeng_<VIN>_battery_soc continues to identify the battery after the user
renames its entity ID to sensor.my_car_battery. The registry mapping covers all
domains returned for the selected Xpengtk device, not only the dashboard's
current set of fields. Known previous key/domain aliases are checked after the
canonical key.

The mapping refreshes when a previously visible Xpengtk entity disappears from
Home Assistant state, which lets the card pick up its replacement entity ID
after a rename or integration reload. An administrator-level registry read is
used where available; if Home Assistant rejects it, the card falls back to
known Xpengtk prefixes and does not guess from friendly names.

Example for the G6 2026:

    type: custom:xpeng-vehicle-card
    prefix: xpeng_g6
    model: G6
    year: "2026"
    sensor_mapping_mode: auto

The prefix is used as a fallback only, so registry-based discovery is independent
of the user's chosen entity IDs. In automatic mode, registry mappings are
preferred. Manual mappings remain explicit overrides. When there is exactly one
Xpengtk vehicle, it can be selected without relying on a location entity. With
multiple vehicles, set xpeng_device_id per card/vehicle profile; the card will
not combine entities from different vehicles or select one arbitrarily.

The complete current entity catalogue is documented in
[XPENGTK_ENTITY_CATALOG.md](XPENGTK_ENTITY_CATALOG.md). The live Entity
Diagnostics panel shows the actual entity IDs for the selected car, including
disabled, unavailable, and action entities where Home Assistant exposes them.
Discovery does not handle XPENG credentials, tokens, certificates, or the XPENG
cloud API.

Control entities (climate, lock, charge flap buttons, charging buttons, number,
select and switch) are provided by Xpengtk. A matching entity is not proof that
an action is permitted or supported: control rendering still requires the
Xpengtk capability and command-policy checks. The charge-port flap is not a
separate charge-cable release command.
