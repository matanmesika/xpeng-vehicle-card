# Xpengtk entity catalogue and automatic mapping

Snapshot of the official `xpengtoolkit/xpengtoolkit` integration source at commit `56fd4e59f569544a199ac786a340d730559c5618` (26 October 2026). This is the integration entity catalogue; entities can be hidden by vehicle capability, command policy, configuration, disabled registry entries, or missing telemetry.

The card resolves entities from Home Assistant’s Entity Registry using Xpengtk’s stable `unique_id` (`xpeng_<VIN>_<key>`) and groups the selected vehicle by Home Assistant `device_id`. It then uses the current `entity_id` from the registry. A friendly-name or user-assigned entity-ID change therefore does not break the semantic mapping. If Xpengtk changes a stable key, known historical aliases are tried; unknown new keys are surfaced in Entity Diagnostics and are not guessed into a control.

For multiple vehicles, set `xpeng_device_id` per card/vehicle profile. If one vehicle is configured, discovery can select it automatically. No vehicle is chosen arbitrarily when more than one remains ambiguous.

## `sensor` (76)

| Stable key / unique-ID suffix | English entity name |
|---|---|
| `battery_soc` | Battery |
| `range` | Range |
| `odometer` | Odometer |
| `charging_state` | Charging state |
| `charge_power` | Charge power |
| `charge_voltage` | Charge voltage |
| `charge_current` | Charge current |
| `charge_rate` | Charge rate |
| `discharge_capacity` | Discharge capacity |
| `charge_limit` | Charge current limit |
| `max_charge` | Max charge |
| `charge_time_remaining` | Charge time remaining |
| `slow_charge_port` | Charge port |
| `fast_charge_added_range` | Fast charge added range |
| `charge_schedule_start` | Charge schedule start |
| `charge_schedule_end` | Charge schedule end |
| `cabin_temperature` | Cabin temperature |
| `set_temperature` | Set temperature |
| `hvac_fan_speed` | HVAC fan speed |
| `latitude` | Latitude |
| `longitude` | Longitude |
| `speed` | Speed |
| `heading` | Heading |
| `shift_state` | Shift state |
| `vehicle_mode` | Vehicle mode |
| `car_power_state` | Power state |
| `tyre_pressure_fl` | Tyre pressure front left |
| `tyre_pressure_fr` | Tyre pressure front right |
| `tyre_pressure_rl` | Tyre pressure rear left |
| `tyre_pressure_rr` | Tyre pressure rear right |
| `driver_seat_heat` | Driver seat heating |
| `passenger_seat_heat` | Passenger seat heating |
| `steering_wheel_heat` | Steering wheel heating |
| `trunk_power_timer` | Trunk power timer |
| `last_charge_energy` | Last charge energy |
| `last_charge_range` | Last charge range added |
| `last_charge_duration` | Last charge duration |
| `sentinel_sensitivity` | Sentinel sensitivity |
| `ota_status` | OTA status |
| `ota_last_checked` | OTA last checked |
| `hvac_quick_warm` | HVAC quick warm |
| `hvac_quick_cool` | HVAC quick cool |
| `range_type` | Range type |
| `credential_age` | Credential age |
| `last_renewal` | Last renewal |
| `last_update` | Last data update |
| `last_data_update` | Last data timestamp |
| `xos_version` | XOS version |
| `mqtt_listener` | MQTT listener |
| `mqtt_discovery` | MQTT discovery |
| `capture` | Raw capture |
| `command_feedback` | Command feedback |
| `last_notification` | Last notification |
| `maintenance` | Next maintenance |
| `xcombos` | X-Combos |
| `parked_consumption` | Parked consumption |
| `ota_upgrade` | OTA update |
| `beta_program` | Beta program |
| `remote_capabilities` | Remote capabilities |
| `vehicle_extension` | Vehicle extension |
| `left_comfort_preon_seconds` | Left-comfort preon countdown |
| `hvac_schedules` | HVAC schedules |
| `cdu_id` | CDU ID |
| `cdu_partition` | CDU partition |
| `vehicle_identity` | Vehicle identity |
| `iccid` | TBox ICCID |
| `weather` | Weather at vehicle |
| `polling_status` | Polling status |
| `next_poll` | Next poll |
| `account` | Account |
| `driver_seat_ventilation` | Driver seat ventilation |
| `passenger_seat_ventilation` | Passenger seat ventilation |
| `left_rear_seat_heat` | Left rear seat heating |
| `right_rear_seat_heat` | Right rear seat heating |
| `left_rear_seat_ventilation` | Left rear seat ventilation |
| `right_rear_seat_ventilation` | Right rear seat ventilation |

## `binary_sensor` (21)

| Stable key / unique-ID suffix | English entity name |
|---|---|
| `locked` | Lock |
| `charging` | Charging |
| `plugged_in` | Plugged in |
| `hvac_on` | Climate |
| `hvac_auto` | Climate auto |
| `defrost` | Defrost |
| `mirror_heat` | Mirror heating |
| `any_door_open` | Doors |
| `driver_door` | Driver door |
| `passenger_door` | Passenger door |
| `rear_left_door` | Rear left door |
| `rear_right_door` | Rear right door |
| `trunk` | Trunk |
| `bonnet` | Bonnet |
| `any_window_open` | Windows |
| `sentinel_mode` | Sentinel mode |
| `trunk_power` | Trunk power |
| `xguard` | X-Guard camera |
| `temp_lock` | Temporary lock |
| `credentials_valid` | Credentials valid |
| `mqtt_connected` | MQTT connected |

## `device_tracker` (1)

| Stable key / unique-ID suffix | English entity name |
|---|---|
| `location` | Location |

## `climate` (1)

| Stable key / unique-ID suffix | English entity name |
|---|---|
| `cabin_climate` | Climate |

## `switch` (14)

| Stable key / unique-ID suffix | English entity name |
|---|---|
| `sentinel_switch` | X-Guard |
| `trunk_power_switch` | Trunk power |
| `defrost_switch` | Front defrost |
| `parking_lights_switch` | Parking lights |
| `auto_upgrade_switch` | OTA auto-upgrade |
| `charging` | Charging |
| `climate_max_heating` | Maximum heating |
| `climate_max_cooling` | Maximum cooling |
| `climate_refresh` | Refresh |
| `climate_sterilisation` | Sterilisation |
| `climate_ac_cleaning` | A/C cleaning |
| `climate_rear_defrost` | Rear window defroster |
| `climate_pet_mode` | Pet mode |
| `climate_silent_mode` | Silent mode |

## `number` (4)

| Stable key / unique-ID suffix | English entity name |
|---|---|
| `sentinel_sensitivity_control` | Sentinel sensitivity |
| `trunk_power_timer_control` | Trunk power timer |
| `charge_limit_control` | Charge limit |
| `fan_speed_control` | Fan speed |

## `select` (9)

| Stable key / unique-ID suffix | English entity name |
|---|---|
| `driver_seat_heat_select` | Driver seat heating |
| `passenger_seat_heat_select` | Passenger seat heating |
| `steering_wheel_heat_select` | Steering wheel heating |
| `driver_seat_ventilation_select` | Driver seat ventilation |
| `passenger_seat_ventilation_select` | Passenger seat ventilation |
| `left_rear_seat_heat_select` | Left rear seat heating |
| `right_rear_seat_heat_select` | Right rear seat heating |
| `left_rear_seat_ventilation_select` | Left rear seat ventilation |
| `right_rear_seat_ventilation_select` | Right rear seat ventilation |

## `button` (14)

| Stable key / unique-ID suffix | English entity name |
|---|---|
| `flash_lights` | Flash lights |
| `honk_horn` | Honk horn |
| `close_windows` | Close windows |
| `vent_windows` | Vent windows |
| `force_update` | Force update |
| `wake_vehicle` | Wake vehicle |
| `query_xguard` | Query X-Guard |
| `open_trunk` | Open trunk |
| `close_trunk` | Close trunk |
| `start_charge` | Start charging |
| `stop_charge` | Stop charging |
| `open_charge_port` | Open charge port |
| `close_charge_port` | Close charge port |
| `open_windows` | Open windows |

## `lock` (1)

| Stable key / unique-ID suffix | English entity name |
|---|---|
| `door_lock` | Door lock |

## `calendar` (1)

| Stable key / unique-ID suffix | English entity name |
|---|---|
| `hvac_schedule_calendar` | HVAC schedule |

## `cover` (3)

| Stable key / unique-ID suffix | English entity name |
|---|---|
| `trunk` | Trunk |
| `windows` | Windows |
| `charge_port` | Charge port |

## `image` (1)

| Stable key / unique-ID suffix | English entity name |
|---|---|
| `vehicle_picture` | Vehicle picture |

## Dynamic entities

- HVAC appointment switches are created dynamically as `switch.hvac_schedule_<appointment_id>` for the selected vehicle’s schedules.
- Some diagnostic sensors and command buttons are created only when the relevant Xpengtk option, policy, vehicle capability, or source data is present.
- `cover` entities are defined for `trunk`, `windows`, and `charge_port`; the charge-port cover operates the flap and is not evidence of a cable-release command.

Source files: `custom_components/xpeng/entity_names.py`, `const.py`, and the platform modules under `custom_components/xpeng/`.
