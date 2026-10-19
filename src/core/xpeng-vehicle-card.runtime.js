/**
 * XPENG Dashboard v1.0.2 — two-screen vehicle status and charging dashboard (read-only).
 * Independent implementation. Uses no external vehicle-control APIs.
 * Reads only Home Assistant state. Does not send vehicle commands.
 */
const XP_INVALID = new Set(['unknown','unavailable','none','null','']);
const XP_KEYS = Object.freeze({
 model:['sensor','vehicle_model'],name:['sensor','vehicle_name'],powertrain:['sensor','vehicle_powertrain'],
 connection:['sensor','api_connection_status'],soc:['sensor','soc','battery'],range:['sensor','range_km','estimated_range'],
 charging:['binary_sensor','is_charging','charging'],plugged:['binary_sensor','is_plugged_in','plugged_in'],target:['sensor','charge_target','charging_target'],
 power:['sensor','charge_power_kw','charging_power'],energy:['sensor','charge_session_energy_kwh','charge_session_energy'],remaining:['sensor','charge_remaining_min','charge_remaining'],
 current:['sensor','charge_current_a','charge_current'],voltage:['sensor','charge_voltage_v','charge_voltage'],odometer:['sensor','odometer_km','odometer'],
 locked:['binary_sensor','is_locked','locked'],door_fl:['binary_sensor','door_front_left_open'],
 door_fr:['binary_sensor','door_front_right_open'],door_rl:['binary_sensor','door_rear_left_open'],
 door_rr:['binary_sensor','door_rear_right_open'],trunk:['binary_sensor','trunk_open'],hood:['binary_sensor','hood_open'],
 climate:['binary_sensor','climate_active'],cabin:['sensor','cabin_temperature_c','cabin_temperature'],outside:['sensor','outside_temperature_c','outside_temperature'],
 health:['sensor','battery_soh','battery_health'],battery_voltage:['sensor','battery_voltage'],
 battery_current:['sensor','battery_current'],battery_12v:['sensor','battery_12v_voltage_v','12v_supply_voltage'],
 tire_fl:['sensor','tire_pressure_front_left_kpa','front_left_tire_pressure'],tire_fr:['sensor','tire_pressure_front_right_kpa','front_right_tire_pressure'],
 tire_rl:['sensor','tire_pressure_rear_left_kpa','rear_left_tire_pressure'],tire_rr:['sensor','tire_pressure_rear_right_kpa','rear_right_tire_pressure'],
 fuel:['sensor','fuel_level_pct','fuel_level'],fuel_range:['sensor','fuel_range_km','fuel_powered_range'],combined:['sensor','total_range_km','combined_range'],
 last_update:['sensor','last_update','last_vehicle_update'],location:['device_tracker','location'],
 speed:['sensor','vehicle_speed_kmh','vehicle_speed']
});
/* Xpengtk (xpengtoolkit/xpengtoolkit) aliases.
 * Home Assistant creates entity IDs from translated names, not unique_id keys.
 * These aliases are additional automatic read-only sources. Never infer commands
 * from a matching name, and keep manual mappings authoritative.
 */
const XP_XPENGTK_KEYS = Object.freeze({
 connection:[['binary_sensor','mqtt_connected']],
 soc:[['sensor','battery']],
 range:[['sensor','range']],
 charging:[['binary_sensor','charging']],
 plugged:[['binary_sensor','plugged_in']],
 target:[['number','charge_limit'],['sensor','max_charge']],
 power:[['sensor','charge_power']],
 remaining:[['sensor','charge_time_remaining']],
 current:[['sensor','charge_current']],
 voltage:[['sensor','charge_voltage']],
 odometer:[['sensor','odometer']],
 tire_fl:[['sensor','tyre_pressure_front_left']],
 tire_fr:[['sensor','tyre_pressure_front_right']],
 tire_rl:[['sensor','tyre_pressure_rear_left']],
 tire_rr:[['sensor','tyre_pressure_rear_right']],
 last_update:[['sensor','last_data_timestamp'],['sensor','last_data_update']],
 cabin:[['sensor','cabin_temperature']],
 speed:[['sensor','speed']],
 location:[['device_tracker','location']]
});


function xpNextSeatOption(current,choices,suffix){
 if(!Array.isArray(choices)||!choices.includes('Off'))return null;
 const levels=suffix==='steering_wheel_heat_select'?['Low','Medium','High']
   :suffix.includes('ventilation')?['Ventilation 1','Ventilation 2','Ventilation 3']
   :['Heat 1','Heat 2','Heat 3'];
 const valid=levels.filter(o=>choices.includes(o));
 if(!valid.length)return null;
 if(current==='Off')return valid[0];
 const i=valid.indexOf(current);
 if(i<0)return null;
 return i===valid.length-1?'Off':valid[i+1];
}
function xpSeatLevel(option){
 if(option==='Off')return '0';
 return ({Low:'1',Medium:'2',High:'3'})[option]||/ [123]$/.exec(option||'')?.[0]?.trim()||'—';
}

const XP_UNIQUE_KEYS=Object.freeze({
 soc:[['sensor','battery_soc']],range:[['sensor','range']],odometer:[['sensor','odometer']],
 connection:[['binary_sensor','mqtt_connected']],charging:[['binary_sensor','charging']],
 plugged:[['binary_sensor','plugged_in']],target:[['number','charge_limit_control'],['sensor','max_charge']],
 power:[['sensor','charge_power']],remaining:[['sensor','charge_time_remaining']],
 current:[['sensor','charge_current']],voltage:[['sensor','charge_voltage']],
 tire_fl:[['sensor','tyre_pressure_fl']],tire_fr:[['sensor','tyre_pressure_fr']],
 tire_rl:[['sensor','tyre_pressure_rl']],tire_rr:[['sensor','tyre_pressure_rr']],
 last_update:[['sensor','last_data_update'],['sensor','last_update']],
 cabin:[['sensor','cabin_temperature']],speed:[['sensor','speed']],
 location:[['device_tracker','location']],locked:[['binary_sensor','locked']],
 climate:[['binary_sensor','hvac_on']],door_fl:[['binary_sensor','driver_door']],
 door_fr:[['binary_sensor','passenger_door']],door_rl:[['binary_sensor','rear_left_door']],
 door_rr:[['binary_sensor','rear_right_door']],trunk:[['binary_sensor','trunk']],
 hood:[['binary_sensor','bonnet']]
});
/* Resolves Xpengtk stable unique IDs from HA Entity Registry so user-renamed
 * entity IDs work automatically. Never mingle different XPENG devices.
 */
function xpVehicleRegistryRows(rows,prefix,deviceSelector){
 const own=Array.isArray(rows)?rows.filter(e=>e?.platform==='xpeng'
   && typeof e.unique_id==='string'&&e.unique_id.startsWith('xpeng_')
   && typeof e.entity_id==='string'&&/^[a-z_]+\.[a-z0-9_]+$/.test(e.entity_id)):[];
 const gps=own.filter(e=>e.unique_id.endsWith('_location')&&e.entity_id.startsWith('device_tracker.'));
 const matchingGps=gps.find(e=>e.entity_id.startsWith('device_tracker.'+prefix+'_'));
 const chosen=gps.find(e=>deviceSelector&&e.device_id===deviceSelector)
   ||matchingGps||(gps.length===1?gps[0]:null);
 if(!chosen)return {byKey:Object.create(null),entries:[],message:gps.length>1?'multiple_vehicles':'no_vehicle'};
 const marker=chosen.unique_id.slice(0,-'_location'.length)+'_';
 const sameVehicle=own.filter(e=>e.unique_id.startsWith(marker)&&e.device_id===chosen.device_id);
 const byKey=Object.create(null);
 for(const e of sameVehicle){
   const suffix=e.unique_id.slice(marker.length);
   byKey[e.entity_id.split('.')[0]+'.'+suffix]=e.entity_id;
 }
 return {byKey,entries:sameVehicle,message:null};
}

/* Local ID aliases only when HA Entity Registry is not readable. */
const XP_CONTROL_FALLBACKS=Object.freeze({
 'climate.cabin_climate':'climate',
 'number.charge_limit_control':'charge_limit','number.fan_speed_control':'fan_speed',
 'button.start_charge':'start_charging','button.stop_charge':'stop_charging',
 'select.driver_seat_heat_select':'driver_seat_heating',
 'select.passenger_seat_heat_select':'passenger_seat_heating',
 'select.driver_seat_ventilation_select':'driver_seat_ventilation',
 'select.passenger_seat_ventilation_select':'passenger_seat_ventilation',
 'select.left_rear_seat_heat_select':'left_rear_seat_heating',
 'select.right_rear_seat_heat_select':'right_rear_seat_heating',
 'select.left_rear_seat_ventilation_select':'left_rear_seat_ventilation',
 'select.right_rear_seat_ventilation_select':'right_rear_seat_ventilation',
 'select.steering_wheel_heat_select':'steering_wheel_heating',
 'sensor.slow_charge_port':'slow_charge_port',
 'binary_sensor.windows':'windows',
 'switch.defrost_switch':'front_defrost',
 'switch.sentinel_switch':'x_guard',
 'number.sentinel_sensitivity_control':'sentinel_sensitivity',
 'switch.trunk_power_switch':'trunk_power',
 'number.trunk_power_timer_control':'trunk_power_timer',
 'switch.auto_upgrade_switch':'ota_auto_upgrade',
 'sensor.maintenance':'next_maintenance',
 'sensor.vehicle_identity':'vehicle_identity',
 'sensor.charge_schedule_start':'charge_schedule_start',
 'sensor.charge_schedule_end':'charge_schedule_end',
 'sensor.ota_upgrade':'ota_update',
 'calendar.hvac_schedule_calendar':'hvac_schedule'
});

/* Official Home Assistant Material Design Icons only.
 * Outlined UI icons for a contemporary, consistent glass interface.
 * Seat/tire/HVAC pictograms retain the exact official specialised MDI glyphs.
 * For Hebrew (RTL), the contextual Back arrow points right.
 */
const XP_ICONS = Object.freeze({
 home:'mdi:home-outline',
 // Genuine vehicle-door security symbols distinguish the next action.
 lock:'mdi:car-door-lock',
 unlock:'mdi:car-door-lock-open',
 car:'mdi:car-outline',
 // Official automotive MDI pictograms, no house-window glyphs.
 // MDI has no dedicated power-side-window-open glyph; the dynamic
 // Hebrew action labels still distinguish opening from closing.
 windows:'mdi:car-door',
 windows_open:'mdi:car-door',
 // Side-profile SUV with official MDI lift/lower action badge: no front view.
 trunk:'mdi:car-back',
 trunk_open:'mdi:car-back',
 trunk_close:'mdi:car-back',
 trunk_lift:'mdi:arrow-up-bold',
 trunk_lower:'mdi:arrow-down-bold',
 horn:'mdi:bullhorn-outline',
 flash:'mdi:car-light-high',
 auto:'mdi:autorenew',
 windscreen:'mdi:car-defrost-front',
 port_open:'mdi:power-plug-outline',
 fan:'mdi:fan',
 bolt:'mdi:lightning-bolt',
 pin:'mdi:map-marker-outline',
 arrow:'mdi:chevron-right',
 back:'mdi:arrow-right',
 refresh:'mdi:refresh',
 settings:'mdi:cog-outline',
 maintenance:'mdi:wrench-outline',
 thermometer:'mdi:thermometer',
 tire:'mdi:tire',
 seat_heat:'mdi:car-seat-heater',
 seat_vent:'mdi:car-seat-cooler',
 wheel_heat:'mdi:steering',
 info:'mdi:information-outline',
 clock:'mdi:clock-outline',
 battery:'mdi:battery-outline',
 power:'mdi:power',
 plug:'mdi:power-plug-outline',
 check:'mdi:check-circle-outline',
 carfront:'mdi:car-outline',
 shield:'mdi:shield-check-outline',
 sun:'mdi:white-balance-sunny',
 gauge:'mdi:speedometer',
 station:'mdi:ev-station',
 wifi:'mdi:wifi'
});
/** Render native Home Assistant MDI glyphs, never home-made SVG icons. */
function xpIcon(name,size=22){
 const mdi=XP_ICONS[name]||XP_ICONS.info;
 const px=Math.max(12,Math.min(80,Number(size)||22));
 const glyph='<ha-icon class="xp-mdi-icon" icon="'+mdi+'" style="--xp-icon-size:'+px+'px" aria-hidden="true"></ha-icon>';
 // Purpose-built accessible side-profile icon for the owner's open-tailgate
 // reference. A vector in the distributed bundle, no third-party image fetch.
 // Real action labels still come from the live vehicle state.
 if(['trunk','trunk_open','trunk_close'].includes(name)){
   return '<svg class="xp-mdi-icon xp-tailgate-icon" viewBox="0 0 64 36" role="img"'+
     ' aria-label="Open trunk" style="--xp-icon-size:'+px+'px" xmlns="http://www.w3.org/2000/svg">'+
     '<g fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">'+
       '<path d="M5 26v-6c0-2.4 1.8-4 4.3-4H20l6.9-8.1h12.2c2.4 0 3.9 1.1 5.3 3.3l4.6 6.8h4.2v-4"/>'+
       '<path d="M53.2 14 59.8 5.5h3.1M53.2 14.5c3.5.6 5.6 3 5.6 6v5.5h-5.7M14.5 26H5M43.6 26H28.2"/>'+
       '<circle cx="21.4" cy="26" r="4.2"/><circle cx="49.1" cy="26" r="4.2"/>'+
       '<path d="M26.6 8.7v7.3h19.2M37 8.7v7.3M9.3 16h11.2"/>'+
     '</g></svg>';
 }
 return glyph;
}
function xpEsc(v){return String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));}

/* Dual-language UI: Home Assistant's user locale controls labels; no separate dashboard. */
const XP_EN_TRANSLATIONS=Object.freeze([["נתוני הצמיגים מתקבלים מ־Home Assistant, והיחידות נקבעות בהגדרות הכרטיס.","Tire data is provided by Home Assistant; units are configured in the card settings."],["אין כרגע נתוני טיפול זמינים באינטגרציה.","No upcoming service data is currently available from the integration."],["נתוני הרכב אינם זמינים כרגע.","Vehicle details are currently unavailable."],["נתוני טיפול אמיתיים","Live vehicle service data"],["מספר שלדה מוסתר","Masked VIN"],["פרטי הרכב","Vehicle details"],["לחצי הצמיגים מתקבלים מחיישני הרכב דרך Home Assistant. ערך חסר נשאר לא זמין; יחידות הלחץ נקבעות בהגדרות הכרטיס.","Tire pressure comes from the vehicle sensors through Home Assistant. Missing values stay unavailable; units are configured in the card editor."],["חיישן unavailable אינו ניתן לתיקון באמצעות ציור הכרטיס. בדוק את מקור הנתון באינטגרציה. כפתורי פעולה מסוג button אינם מדווחים מצב רגיל.","An unavailable sensor cannot be fixed by the card. Check Xpengtk. Action buttons do not report a normal state."],["לא מוצגות פקודות פתיחת נעילה, פתיחת חלונות או תא מטען. פעולות רגישות דורשות אישור ויעברו דרך הרשאות Xpengtk.","Unlock/open actions are hidden. Sensitive commands require confirmation and Xpengtk permissions."],["Xpengtk מספקת חיישני תזמון טעינה לקריאה בלבד. אין כרגע פקודת שינוי תזמון טעינה מאומתת.","Xpengtk provides read-only charging schedules. Schedule changes are not supported."],["פתיחת תא המטען מחייבת הרשאת Access. אם החיישן לא מדווח מצב ברור, לא תישלח פקודה.","Opening the tailgate requires Access permission. No command is sent with unknown status."],["השינוי נשלח ל־Home Assistant רק אחרי בחירת ערך בסרגל. יש לוודא שהרכב קיבל אותו.","Changes are sent to Home Assistant only after selecting a slider value. Confirm the vehicle accepted it."],["עדיין לא זוהו ישויות Xpengtk. בדוק חיבור, קידומת VIN והרשאות Entity Registry.","No Xpengtk entities detected. Check the connection, VIN prefix and Entity Registry permissions."],["כיבוי חימום מושב הנוסע הקדמי אינו נתמך כרגע ב־Xpengtk. ניתן לכבות מתוך הרכב.","Turning off front passenger seat heating is not supported by Xpengtk. Use the vehicle controls."],["המפה אינה זמינה בתוך הכרטיס כרגע. אפשר לפתוח את פרטי המיקום דרך הכפתור למטה.","The map is unavailable in this card. Open the vehicle's location details below."],["נעילה ושחרור נעילה מתבצעים בלחיצה אחת, בהתאם למצב. שחרור מחייב הרשאת Access.","Lock/unlock uses a single tap according to state. Unlocking requires Access permission."],["המידע מגיע מ־Xpengtk. הפקודות פועלות לפי הרשאות Home Assistant והרכב בלבד.","Data comes from Xpengtk. Commands use Home Assistant and vehicle permissions."],["הערכים מתעדכנים לפי Home Assistant. מספר השלדה המלא אינו חשוף באינטגרציה.","Values are provided by Home Assistant. The full VIN is not exposed by the integration."],["תמונת פנים G6 בצבע שנבחר עדיין לא צורפה לפרויקט. לא מוצגת הדמיה חלופית.","The selected G6 interior photo is unavailable. No substitute illustration is displayed."],["לחיצה אחת הופכת את מצב הדלתית על סמך חיווי Xpengtk. אין שחרור כבל.","One tap toggles the charging flap according to Xpengtk status. No cable release."],["פתיחת חלונות דורשת הרשאת Access. אין פקודה כאשר מצבם אינו ידוע.","Opening windows requires Access permission. No command is sent with unknown status."],["אפשרויות נוספות לרכב — שבעת קיצורי הדרך נשארים במסך הבית בלבד.","Additional vehicle options. The seven shortcuts remain on the home screen."],["הפקודה נשלחה ל־Home Assistant. יש לוודא שהרכב אישר את הפעולה.","Command sent to Home Assistant. Verify that the vehicle confirmed the action."],["אין לוח תזמוני מיזוג זמין באינטגרציה. לא ניצור תזמון מדומה.","No climate schedule calendar is available through the integration; no schedule is simulated."],["בקרות V2L אינן זמינות בדגם או בהרשאות האינטגרציה.","V2L controls are not available for this model or permissions."],["המפה המובנית אינה זמינה בכרטיס זה כרגע.","The built-in map is currently unavailable in this card."],["דיווח Connected • חיבור הכבל אינו מאומת","Connected reported • Cable connection unverified"],["הגבלת הטעינה אינה זמינה כעת באינטגרציה.","Charging limit is currently unavailable through the integration."],["כיבוי חימום נוסע אינו מאומת באינטגרציה","Passenger heating off is not supported by the integration"],["לא נמצאו בקרות מושבים נתמכות לרכב זה.","No supported seat controls were found for this vehicle."],["לא נמצאו ישויות אבטחה זמינות לרכב זה.","No security entities are available for this vehicle."],["רמת החימום או האוורור אינה זמינה כעת.","Heating or ventilation level unavailable."],["אין כרגע פקודות זמינות באינטגרציה.","No commands are currently available through the integration."],["כבל מחובר • אין לסגור את הדלתית","Cable connected • Do not close the flap"],["תמונת פנים בעל הרכב · XPENG G6","Owner-provided G6 interior photograph"],["אין כרגע נתוני אנרגיה זמינים.","Energy data is currently unavailable."],["בקרת המיזוג אינה זמינה כרגע.","Climate controls are unavailable."],["פרטי תחזוקה ב־Home Assistant","Maintenance details in Home Assistant"],["תמונת פנים לא זמינה לדגם זה.","No interior image is available for this model."],["פרטי מיקום ב־Home Assistant","Location details in Home Assistant"],["טיימר לכיבוי אוטומטי (דקות)","Auto-off timer (minutes)"],["החלף כיוון זרימת אוויר אל ","Change airflow direction to "],["חיישנים, מצב ומזהי Xpengtk","Sensors, states and Xpengtk IDs"],["תמונת פנים לפי הגדרות הרכב","Interior photograph from vehicle settings"],["פעולות הרכב וקיצורי מסכים","Vehicle controls and shortcuts"],["תמונת פנים לפי הגדרת הצבע","Interior photo chosen by color"],["הפעלת מיזוג ומצב אוטומטי","Climate and automatic mode controls"],["לחץ אוויר בארבעת הצמיגים","Tire pressure · All four tires"],["שנת דגם (מהגדרות הכרטיס)","Model year (card settings)"],[" ישויות משויכות לרכב • "," vehicle entities • "],["אין שינוי בפעולות הרכב","No change to vehicle commands"],["הפעל עדכונים אוטומטיים","Enable automatic updates"],["צריכה והיסטוריית טעינה","Consumption and charging history"],["הדרגה אינה נתמכת כעת.","This level is currently unsupported."],["שגיאה בשליחת הפקודה: ","Error sending command: "],["כיוון זרימת אוויר אל ","Set airflow direction to "],["שנת דגם (מהאינטגרציה)","Model year (integration)"],["צריכה ממוצעת ב־7 ימים","7-day average consumption"],["אנרגיה בטעינה האחרונה","Last charge energy"],["כבה עדכונים אוטומטיים","Disable automatic updates"],["לשלוח את הפקודה לרכב?","Send this command to the vehicle?"],["מצב הדלתית אינו זמין","Flap status unavailable"],["הצג לוח תזמוני מיזוג","View climate schedules"],["אבטחה ורגישות השמירה","Security sensitivity"],[" זמינות או פעולות • "," available or actions • "],["רשימת ישויות Xpengtk","Xpengtk entity list"],["שירות HA אינו זמין.","Home Assistant service unavailable."],["פקודת המושב נכשלה: ","Seat command failed: "],["טמפרטורת תא הנוסעים","Cabin temperature"],["הצג תזמונים קיימים","View existing schedules"],["נדרשת הרשאת Access","Access permission required"],["צריכת אנרגיה בחניה","Parked energy consumption"],["משך הטעינה האחרונה","Last charge duration"],["שקע חשמל בתא המטען","Tailgate power outlet"],["פעיל • חיווי בלבד","On • Status only"],["כבוי • חיווי בלבד","Off • Status only"],["ק״מ שנותרו לטיפול","Kilometers until service"],["מספר שלדה (מוסתר)","Masked VIN"],["טווח שנוסף בטעינה","Range added during last charge"],["פתיחת תחזוקת הרכב","Open vehicle maintenance"],["יחידות לחץ צמיגים","Tire pressure unit"],["הפשרת שמשה קדמית","Windshield defrost"],["דרושה הרשאת גישה","Access permission required"],["דלתית שקע הטעינה","Charging port flap"],["תחזוקה ופרטי רכב","Maintenance and vehicle details"],["חזרה לחלון הקודם","Back to previous screen"],["חזרה לתצוגת הרכב","Back to vehicle view"],["טמפרטורה נוכחית","Current temperature"],["סגירת שקע טעינה","Close charging port"],["פתיחת שקע טעינה","Open charging port"],["אפשרויות נוספות","More options"],["שעת התחלת טעינה","Charging start time"],["תזמונים מוגדרים","Configured schedules"],["קילומטרים נותרו","Distance remaining"],["תצוגה מאוירת · ","Illustration · "],["פונקציות מיזוג","Climate functions"],["המצב אינו ידוע","Status unknown"],["מפת מיקום הרכב","Vehicle location map"],["שעת סיום טעינה","Charging end time"],["חשמל בתא המטען","Tailgate power"],["תזמונים קיימים","Existing schedules"],["חזרה למסך הבית","Back to dashboard"],["איור פנים רכב ","Vehicle cabin illustration "],["הורד חצי מעלה","Decrease by half a degree"],["העלה חצי מעלה","Increase by half a degree"],["מהירות מאוורר","Fan speed"],["סגירת תא מטען","Close Trunk"],["פתיחת תא מטען","Open Trunk"],["רגישות השמירה","Security sensitivity"],["הפעלת X-Guard","Enable X-Guard"],["פעולות זמינות","Available actions"],["צבע פנים הרכב","Vehicle interior color"],["טמפרטורת יעד","Target temperature"],["סגירת חלונות","Close windows"],["פתיחת חלונות","Open windows"],["סגור תא מטען","Close Trunk"],["הפעל שקע V2L","Enable V2L outlet"],["עדכוני תוכנה","Software updates"],["הפעל X-Guard","Enable X-Guard"],["נתוני אנרגיה","Energy data"],["אבחון ישויות","Entity diagnostics"],["הפעלת מיזוג","Climate power"],["כיוון אוויר","Airflow direction"],["חימום מראות","Mirror heating"],["מצב אוטומטי","Automatic mode"],["שחרור נעילה","Unlock vehicle"],["פתח תא מטען","Open Trunk"],["סגור חלונות","Close windows"],["מצב לא ידוע","Status unknown"],["תחזוקת הרכב","Vehicle maintenance"],["הגבלת טעינה","Charge limit"],["תזמון טעינה","Charge schedule"],["מצב נוכחי: ","Current status: "],["דלתית פתוחה","Flap open"],["דלתית סגורה","Flap closed"],["מיזוג אוויר","Climate control"],["פעיל / פתוח","On / Open"],["כבוי / סגור","Off / Closed"],["כפתור פעולה","Action button"],["הבהוב אורות","Flash lights"],["תאריך טיפול","Service date"],["בקרות טעינה","Charging controls"],["נסועה כוללת","Total distance"],["כבה שקע V2L","Disable V2L outlet"],["כבה X-Guard","Disable X-Guard"],["נעילת דלתות","Lock doors"],["רמת מאוורר","Fan level"],["בקרת אקלים","Climate controls"],["מצב AUTO: ","AUTO mode: "],["נעילת הרכב","Lock vehicle"],["פתח חלונות","Open windows"],["מיקום הרכב","Vehicle location"],["אחורי שמאל","Rear left"],["אחורי ימין","Rear right"],["קילומטראז׳","Odometer"],["הטיפול הבא","Next service"],["עצור טעינה","Stop charging"],["הפסק טעינה","Stop charging"],["הפעל תזמון","Enable schedule"],["השבת תזמון","Disable schedule"],["ימים נותרו","Days remaining"],[" לא זמינות"," unavailable"],["חיווי בלבד","Status only"],["פתח נעילה","Unlock"],["נעילת רכב","Vehicle locking"],["קדמי שמאל","Front left"],["קדמי ימין","Front right"],["חימום הגה","Heated steering wheel"],["שקע טעינה","Charging port"],["טוען מפה…","Loading map…"],["XOS ו־OTA","XOS and OTA"],["פנים רכב ","Vehicle interior "],["סגור שקע","Close port"],["דלת נוסע","Passenger door"],["גרסת XOS","XOS version"],["פתח שקע","Open port"],["דלת נהג","Driver door"],["תא מטען","Tailgate"],["לא זמין","Unavailable"],["לא ידוע","Unknown"],["לא נעול","Unlocked"],["שנת דגם","Model year"],["נסה שוב","Try again"],["חלונות","Windows"],["תחזוקה","Maintenance"],["פתוחים","Open"],["סגורים","Closed"],["נמצאו ","Found "],[" בצבע "," in "],["אוורור","Ventilation"],["מיזוג","Climate"],["נעילה","Lock"],["דלתות","Doors"],["מיקום","Location"],["פתוחה","Open"],["סגורה","Closed"],["הבהוב","Flash lights"],["צפירה","Honk horn"],["תזמון","Schedule"],["דרגה ","Level "],["שגיאה","Error"],["חימום","Heating"],["פתוח","Open"],["סגור","Closed"],["פעיל","On"],["כבוי","Off"],["חסרה","Missing"],["נעול","Locked"],["נועל","Locking"],["פותח","Unlocking"],["צופר","Horn"],["יצרן","Manufacturer"],["נוסע","Passenger"],["דגם","Model"],["נהג","Driver"],["הגה","Steering wheel"],["טמפרטורה","Temperature"],["אינו זמין","Unavailable"],["תא המטען","The tailgate"],["פרטי עדכון","Update details"],["תזמון מיזוג","Schedule climate"],["אין נתוני גרסה או עדכונים זמינים.","No update data available."]]);
function xpIsEnglish(hass){
 const lang=String(hass?.locale?.language||hass?.language||'he').toLowerCase();
 return !/^he(?:-|$)/.test(lang);
}
function xpLocalizeMarkup(value,hass){
 if(!xpIsEnglish(hass))return String(value);
 let valueEn=String(value);
 for(const [he,en] of XP_EN_TRANSLATIONS)valueEn=valueEn.replaceAll(he,en);
 return valueEn.replaceAll('dir="rtl"','dir="ltr"').replaceAll('icon="mdi:arrow-right"','icon="mdi:arrow-left"');
}
let XP_MAP_HELPERS_PROMISE=null;
function xpNum(v,dec=0){if(v===null||v===undefined||v===''||!Number.isFinite(Number(v)))return '—';return Number(v).toLocaleString('en-US',{maximumFractionDigits:dec});}
function xpConnText(v){
  const raw=String(v??'').trim().toLowerCase();
  if(!raw || ['not_configured','not_connected','unavailable','unknown','none','null','offline'].includes(raw))return 'Not connected';
  if(['connected','online','on','true','1'].includes(raw))return 'Connected';
  if(['off','false','0'].includes(raw))return 'Not connected';
  if(['error','connection_error','auth_error'].includes(raw))return 'Connection error';
  return String(v).replace(/_/g,' ');
}
function xpBool(v){
  const state=String(v??'').trim().toLowerCase();
  if(['on','true','1'].includes(state))return true;
  if(['off','false','0'].includes(state))return false;
  return null;
}
// Accept status sensors from other integrations without confusing 'plugged in' with charging.
function xpChargingActive(v){
  const state=String(v??'').trim().toLowerCase().replace(/[ -]+/g,'_');
  if(['on','true','1','charging','charging_now','charging_active','in_progress','active'].includes(state))return true;
  if(['off','false','0','idle','paused','ready','stopped','not_charging','disconnected','plugged_in','connected','complete','finished'].includes(state))return false;
  return null;
}
// Explicit mappings can read an entity state or one of its HA attributes.
// Examples: sensor.vehicle_soc  or  sensor.ev_status|charging_state.
function xpParseEntityMapping(value){
  const text=String(value??'').trim();
  const match=/^([a-z][a-z0-9_]*\.[a-z0-9_]+)(?:\|([A-Za-z_][A-Za-z0-9_]*))?$/.exec(text);
  if(!match)return null;
  if(match[2]&&['__proto__','prototype','constructor'].includes(match[2]))return null;
  return {id:match[1],attribute:match[2]||null};
}
function xpPercent(v){if(v===null||v===undefined||v===''||!Number.isFinite(Number(v)))return null;return Math.max(0,Math.min(100,Number(v)));}
const XP_CATALOG = Object.freeze({"models":[{"id":"G3","name":"G3","start":2018,"end":2021,"shape":"crossover","trim":"catalog"},{"id":"G3i","name":"G3i","start":2021,"end":2023,"shape":"crossover","trim":"catalog"},{"id":"P5","name":"P5","start":2021,"end":2024,"shape":"compact_sedan","trim":"catalog"},{"id":"P7","name":"P7 (Original)","start":2020,"end":2022,"shape":"fastback","trim":"catalog"},{"id":"P7i","name":"P7i","start":2023,"end":2025,"shape":"fastback","trim":"catalog"},{"id":"Next P7","name":"Next P7","start":2025,"end":2026,"shape":"fastback","trim":"catalog"},{"id":"P7+","name":"P7+","start":2024,"end":2026,"shape":"fastback","trim":"catalog"},{"id":"G6","name":"G6","start":2023,"end":2026,"shape":"g6","trim":"catalog"},{"id":"G7","name":"G7","start":2025,"end":2026,"shape":"crossover","trim":"catalog"},{"id":"G9","name":"G9","start":2022,"end":2026,"shape":"suv","trim":"catalog"},{"id":"G9L","name":"G9L","start":2026,"end":2026,"shape":"suv","trim":"catalog"},{"id":"X9","name":"X9","start":2024,"end":2026,"shape":"mpv","trim":"catalog"},{"id":"MONA M03","name":"MONA M03","start":2024,"end":2026,"shape":"compact_sedan","trim":"catalog"},{"id":"L03","name":"L03","start":2026,"end":2026,"shape":"fastback","trim":"catalog"},{"id":"GX","name":"GX","start":2026,"end":2026,"shape":"suv","trim":"catalog"}],"paints":[{"id":"arctic_white","label":"Arctic White","hex":"#F2F4F2"},{"id":"graphite_gray","label":"Graphite Gray","hex":"#66717B"},{"id":"midnight_black","label":"Midnight Black","hex":"#15191F"},{"id":"silver_frost","label":"Silver Frost","hex":"#BCC4C9"},{"id":"stellar_purple","label":"Stellar Purple","hex":"#867592"},{"id":"fiery_orange","label":"Fiery Orange","hex":"#C95D2A"},{"id":"kaitoke_green_matte","label":"Kaitoke Green Matte","hex":"#526F64"},{"id":"jet_black","label":"Jet Black","hex":"#111316"},{"id":"space_gray","label":"Space Gray","hex":"#727A82"},{"id":"lambent_cyan","label":"Lambent Cyan","hex":"#7BAFB2"},{"id":"polar_violet","label":"Polar Violet","hex":"#8D7F9D"},{"id":"matte_gray","label":"Matte Gray","hex":"#777B7E"},{"id":"phantom_purple","label":"Phantom Purple","hex":"#77637F"},{"id":"rock_gray","label":"Rock Gray","hex":"#6F7375"},{"id":"black_edition","label":"Black Edition","hex":"#0D1013"},{"id":"diamond_black","label":"Diamond Black","hex":"#111214"},{"id":"mirror_gray","label":"Mirror Gray","hex":"#8C9194"},{"id":"waving_green","label":"Waving Green","hex":"#667C70"},{"id":"everest_white","label":"Everest White","hex":"#F4F4F1"},{"id":"matte_desert_gold","label":"Matte Desert Gold","hex":"#B5A083"},{"id":"two_tone_gray_silver","label":"Two Tone Grey & Silver","hex":"#8A9298"},{"id":"coral_green","label":"Coral Green","hex":"#75A49C"},{"id":"red","label":"Red","hex":"#A72C35"},{"id":"green","label":"Green","hex":"#476B5C"},{"id":"nebula_white","label":"G7 Nebula White (2025/2026)","hex":"#F0F0EC"},{"id":"starday_gray","label":"G7 Star Day Gray (2025/2026)","hex":"#7B8390"},{"id":"crescent_silver","label":"G7 Crescent Silver (2025/2026)","hex":"#B6BDC4"},{"id":"night_black","label":"G7 Night Black (2025/2026)","hex":"#17191B"},{"id":"cloud_beige","label":"G7 Cloud Beige (2025)","hex":"#BEB4A1"},{"id":"interstellar_green","label":"G7 Interstellar Green (2025)","hex":"#596C63"},{"id":"twilight_purple","label":"G7 Twilight Purple (2026)","hex":"#827690"},{"id":"new_moon_silver","label":"New Moon Silver","hex":"#B3B8BC"},{"id":"rhythm_yellow","label":"Rhythm Yellow","hex":"#E3C449"},{"id":"stellar_green","label":"Stellar Green","hex":"#6A8072"},{"id":"dusk_purple","label":"Dusk Purple","hex":"#86778B"},{"id":"micro_star_gray","label":"Micro Star Gray","hex":"#777D83"},{"id":"starburst_blue","label":"Starburst Blue","hex":"#456B8D"},{"id":"star_red","label":"Star Red","hex":"#A73F40"},{"id":"matte_new_moon_silver","label":"Matte New Moon Silver","hex":"#A7AAAB"},{"id":"star_gray","label":"Star Gray","hex":"#82868A"},{"id":"starlight_beige","label":"Starlight Beige","hex":"#CCBFAA"},{"id":"star_blue","label":"Star Blue","hex":"#6792AC"},{"id":"roland_purple","label":"Roland Purple","hex":"#8C7A99"},{"id":"avocado_green","label":"Avocado Green","hex":"#95B39D"},{"id":"micro_moon_gray","label":"Micro Moon Gray","hex":"#909497"},{"id":"cherry_pink","label":"Cherry Pink","hex":"#E5A6B4"},{"id":"starry_dusk_purple","label":"Starry Dusk Purple","hex":"#806F91"}]});
const XP_MODELS = XP_CATALOG.models;
const XP_PAINTS = XP_CATALOG.paints;
const XP_INTERIORS = Object.freeze([{"id":"dark_gray","label":"Dark Gray","hex":"#40454b","secondary":"#252a30"},{"id":"light_gray","label":"Light Gray","hex":"#d8d9d4","secondary":"#aeb1b4"},{"id":"coffee","label":"Coffee","hex":"#93725b","secondary":"#574338"},{"id":"saddle","label":"Saddle","hex":"#aa704d","secondary":"#724934"},{"id":"meteorite_black","label":"Meteorite Black","hex":"#25272b","secondary":"#121417"},{"id":"tangerine","label":"Tangerine","hex":"#a96a46","secondary":"#6c432d"}]);
const XP_YEAR_GROUPS = Object.freeze({"G3":[{"id":"2018-2021","label":"2018-2021","years":[2018,2019,2020,2021],"trims":[{"id":"long_range","label":"Long Range"},{"id":"market_dependent","label":"Other / market-dependent"}],"colors":["arctic_white","graphite_gray","midnight_black"],"catalog_status":"historic_market_dependent","colors_by_year":{"2018":["arctic_white","graphite_gray","midnight_black"],"2019":["arctic_white","graphite_gray","midnight_black"],"2020":["arctic_white","graphite_gray","midnight_black"],"2021":["arctic_white","graphite_gray","midnight_black"]},"year_palette_sources":{"2018":{"confidence":"provisional_historical","source":null,"notes":"Inherits group palette. Factory paint availability for this individual year/market not independently verified."},"2019":{"confidence":"provisional_historical","source":null,"notes":"Inherits group palette. Factory paint availability for this individual year/market not independently verified."},"2020":{"confidence":"provisional_historical","source":null,"notes":"Inherits group palette. Factory paint availability for this individual year/market not independently verified."},"2021":{"confidence":"provisional_historical","source":null,"notes":"Inherits group palette. Factory paint availability for this individual year/market not independently verified."}}}],"G3i":[{"id":"2021-2023","label":"2021-2023","years":[2021,2022,2023],"trims":[{"id":"long_range","label":"Long Range"},{"id":"market_dependent","label":"Other / market-dependent"}],"colors":["arctic_white","graphite_gray","midnight_black","coral_green"],"catalog_status":"historic_market_dependent","colors_by_year":{"2021":["arctic_white","graphite_gray","midnight_black","coral_green"],"2022":["arctic_white","graphite_gray","midnight_black","coral_green"],"2023":["arctic_white","graphite_gray","midnight_black","coral_green"]},"year_palette_sources":{"2021":{"confidence":"provisional_historical","source":null,"notes":"Inherits group palette. Factory paint availability for this individual year/market not independently verified."},"2022":{"confidence":"provisional_historical","source":null,"notes":"Inherits group palette. Factory paint availability for this individual year/market not independently verified."},"2023":{"confidence":"provisional_historical","source":null,"notes":"Inherits group palette. Factory paint availability for this individual year/market not independently verified."}}}],"P5":[{"id":"2021-2024","label":"2021-2024","years":[2021,2022,2023,2024],"trims":[{"id":"standard","label":"Standard / market-dependent"},{"id":"max","label":"Max / market-dependent"}],"colors":["arctic_white","graphite_gray","midnight_black"],"catalog_status":"historic_market_dependent","colors_by_year":{"2021":["arctic_white","graphite_gray","midnight_black"],"2022":["arctic_white","graphite_gray","midnight_black"],"2023":["arctic_white","graphite_gray","midnight_black"],"2024":["arctic_white","graphite_gray","midnight_black"]},"year_palette_sources":{"2021":{"confidence":"provisional_historical","source":null,"notes":"Inherits group palette. Factory paint availability for this individual year/market not independently verified."},"2022":{"confidence":"provisional_historical","source":null,"notes":"Inherits group palette. Factory paint availability for this individual year/market not independently verified."},"2023":{"confidence":"provisional_historical","source":null,"notes":"Inherits group palette. Factory paint availability for this individual year/market not independently verified."},"2024":{"confidence":"provisional_historical","source":null,"notes":"Inherits group palette. Factory paint availability for this individual year/market not independently verified."}}}],"P7":[{"id":"2020-2022","label":"2020-2022","years":[2020,2021,2022],"trims":[{"id":"rwd_super_long_range","label":"RWD Super Long Range"},{"id":"awd_high_performance","label":"4WD High Performance"},{"id":"wing_edition","label":"Wing Edition"}],"colors":["arctic_white","jet_black","space_gray","red","green"],"catalog_status":"official_global","colors_by_year":{"2020":["arctic_white","jet_black","space_gray","red","green"],"2021":["arctic_white","jet_black","space_gray","red","green"],"2022":["arctic_white","jet_black","space_gray","red","green"]},"year_palette_sources":{"2020":{"confidence":"inherited_group_market_specific","source":null,"notes":"Inherits group palette. Factory paint availability for this individual year/market not independently verified."},"2021":{"confidence":"inherited_group_market_specific","source":null,"notes":"Inherits group palette. Factory paint availability for this individual year/market not independently verified."},"2022":{"confidence":"inherited_group_market_specific","source":null,"notes":"Inherits group palette. Factory paint availability for this individual year/market not independently verified."}}}],"P7i":[{"id":"2023-2025","label":"2023-2025","years":[2023,2024,2025],"trims":[{"id":"rwd_long_range","label":"RWD Long Range"},{"id":"awd_performance","label":"AWD Performance"},{"id":"wing_edition","label":"Wing Edition / market-dependent"}],"colors":["arctic_white","jet_black","space_gray","silver_frost","kaitoke_green_matte","starry_dusk_purple","star_blue"],"catalog_status":"official_global","colors_by_year":{"2023":["arctic_white","jet_black","space_gray","silver_frost","kaitoke_green_matte"],"2024":["arctic_white","jet_black","space_gray","silver_frost","kaitoke_green_matte","starry_dusk_purple","star_blue"],"2025":["arctic_white","jet_black","space_gray","silver_frost","kaitoke_green_matte"]},"year_palette_sources":{"2023":{"confidence":"international_baseline","source":"https://www.xpeng.com/model/p7","notes":"International P7i colour names; market dependent."},"2024":{"confidence":"manufacturer_reported","source":"https://www.xiaopeng.com/news/company_news/5267.html","notes":"Starry Dusk Purple and Star Blue introduced in 2024 Wing Edition; trim selection remains display-only."},"2025":{"confidence":"baseline_unverified","source":"https://www.xpeng.com/model/p7","notes":"Baseline palette only; 2024 limited paints not asserted for 2025."}}}],"Next P7":[{"id":"2025","label":"2025","years":[2025],"trims":[{"id":"market_dependent","label":"Variant / market-dependent"}],"colors":["new_moon_silver","rhythm_yellow","stellar_green","dusk_purple","micro_star_gray","starburst_blue"],"catalog_status":"official_cn_launch","source_url":"https://www.xiaopeng.com/news/company_news/5489.html","market":"China","artwork_status":"pending_model_specific_views","colors_by_year":{"2025":["new_moon_silver","rhythm_yellow","stellar_green","dusk_purple","micro_star_gray","starburst_blue"]},"year_palette_sources":{"2025":{"confidence":"inherited_group_market_specific","source":"https://www.xiaopeng.com/news/company_news/5489.html","notes":"Inherits group palette. Factory paint availability for this individual year/market not independently verified."}}},{"id":"2026","label":"2026","years":[2026],"trims":[{"id":"market_dependent","label":"Variant / market-dependent"}],"colors":["new_moon_silver","rhythm_yellow","stellar_green","dusk_purple","micro_star_gray","starburst_blue","night_black","nebula_white","star_red","matte_new_moon_silver"],"catalog_status":"official_cn_configurator","source_url":"https://www.xiaopeng.com/p7n/configuration.html","market":"China","artwork_status":"pending_model_specific_views","colors_by_year":{"2026":["new_moon_silver","rhythm_yellow","stellar_green","dusk_purple","micro_star_gray","starburst_blue","night_black","nebula_white","star_red","matte_new_moon_silver"]},"year_palette_sources":{"2026":{"confidence":"inherited_group_market_specific","source":"https://www.xiaopeng.com/p7n/configuration.html","notes":"Inherits group palette. Factory paint availability for this individual year/market not independently verified."}}}],"P7+":[{"id":"2024-2026","label":"2024-2026","years":[2024,2025,2026],"trims":[{"id":"rwd_standard_range","label":"RWD Standard Range"},{"id":"rwd_long_range","label":"RWD Long Range"},{"id":"awd_performance","label":"AWD Performance"}],"colors":["arctic_white","graphite_gray","midnight_black","silver_frost","stellar_purple"],"catalog_status":"official_global","colors_by_year":{"2024":["arctic_white","graphite_gray","midnight_black","silver_frost","stellar_purple"],"2025":["arctic_white","graphite_gray","midnight_black","silver_frost","stellar_purple"],"2026":["arctic_white","graphite_gray","midnight_black","silver_frost","stellar_purple"]},"year_palette_sources":{"2024":{"confidence":"inherited_group_market_specific","source":null,"notes":"Inherits group palette. Factory paint availability for this individual year/market not independently verified."},"2025":{"confidence":"inherited_group_market_specific","source":null,"notes":"Inherits group palette. Factory paint availability for this individual year/market not independently verified."},"2026":{"confidence":"inherited_group_market_specific","source":null,"notes":"Inherits group palette. Factory paint availability for this individual year/market not independently verified."}}}],"G6":[{"id":"2023-2025","label":"2023-2025","years":[2023,2024,2025],"trims":[{"id":"rwd_standard_range","label":"RWD Standard Range"},{"id":"rwd_long_range","label":"RWD Long Range"},{"id":"awd_performance","label":"AWD Performance"}],"colors":["arctic_white","graphite_gray","midnight_black","silver_frost","fiery_orange"],"interiors":["dark_gray","light_gray"],"catalog_status":"official_global","colors_by_year":{"2023":["arctic_white","graphite_gray","midnight_black","silver_frost","fiery_orange"],"2024":["arctic_white","graphite_gray","midnight_black","silver_frost","fiery_orange"],"2025":["arctic_white","graphite_gray","midnight_black","silver_frost","fiery_orange"]},"year_palette_sources":{"2023":{"confidence":"inherited_group_market_specific","source":null,"notes":"Inherits group palette. Factory paint availability for this individual year/market not independently verified."},"2024":{"confidence":"inherited_group_market_specific","source":null,"notes":"Inherits group palette. Factory paint availability for this individual year/market not independently verified."},"2025":{"confidence":"inherited_group_market_specific","source":null,"notes":"Inherits group palette. Factory paint availability for this individual year/market not independently verified."}}},{"id":"2026","label":"2026","years":[2026],"trims":[{"id":"core_rwd","label":"Core RWD"},{"id":"core_plus_rwd","label":"Core+ RWD"},{"id":"core_performance_awd","label":"Core Performance AWD"},{"id":"black_edition","label":"Black Edition"}],"colors":["arctic_white","graphite_gray","midnight_black","silver_frost","stellar_purple","black_edition"],"interiors":["dark_gray","light_gray"],"catalog_status":"official_global","colors_by_year":{"2026":["arctic_white","graphite_gray","midnight_black","silver_frost","stellar_purple","black_edition"]},"year_palette_sources":{"2026":{"confidence":"inherited_group_market_specific","source":null,"notes":"Inherits group palette. Factory paint availability for this individual year/market not independently verified."}}}],"G7":[{"id":"2025","label":"2025","years":[2025],"trims":[{"id":"market_dependent","label":"Variant / market-dependent"}],"colors":["starday_gray","crescent_silver","cloud_beige","interstellar_green","night_black","nebula_white"],"catalog_status":"official_cn","colors_by_year":{"2025":["starday_gray","crescent_silver","cloud_beige","interstellar_green","night_black","nebula_white"]},"year_palette_sources":{"2025":{"confidence":"inherited_group_market_specific","source":null,"notes":"Inherits group palette. Factory paint availability for this individual year/market not independently verified."}}},{"id":"2026","label":"2026","years":[2026],"trims":[{"id":"market_dependent","label":"Variant / market-dependent"}],"colors":["twilight_purple","starday_gray","crescent_silver","night_black","nebula_white"],"catalog_status":"official_cn","colors_by_year":{"2026":["twilight_purple","starday_gray","crescent_silver","night_black","nebula_white"]},"year_palette_sources":{"2026":{"confidence":"inherited_group_market_specific","source":null,"notes":"Inherits group palette. Factory paint availability for this individual year/market not independently verified."}}}],"G9":[{"id":"2022-2024","label":"2022-2024","years":[2022,2023,2024],"trims":[{"id":"rwd_standard_range","label":"RWD Standard Range"},{"id":"rwd_long_range","label":"RWD Long Range"},{"id":"awd_performance","label":"AWD Performance"}],"colors":["arctic_white","graphite_gray","midnight_black","silver_frost","kaitoke_green_matte"],"catalog_status":"official_global","colors_by_year":{"2022":["arctic_white","graphite_gray","midnight_black","silver_frost","kaitoke_green_matte"],"2023":["arctic_white","graphite_gray","midnight_black","silver_frost","kaitoke_green_matte"],"2024":["arctic_white","graphite_gray","midnight_black","silver_frost","kaitoke_green_matte"]},"year_palette_sources":{"2022":{"confidence":"inherited_group_market_specific","source":null,"notes":"Inherits group palette. Factory paint availability for this individual year/market not independently verified."},"2023":{"confidence":"inherited_group_market_specific","source":null,"notes":"Inherits group palette. Factory paint availability for this individual year/market not independently verified."},"2024":{"confidence":"inherited_group_market_specific","source":null,"notes":"Inherits group palette. Factory paint availability for this individual year/market not independently verified."}}},{"id":"2025-2026","label":"2025-2026","years":[2025,2026],"trims":[{"id":"rwd_standard_range","label":"RWD Standard Range"},{"id":"rwd_long_range","label":"RWD Long Range"},{"id":"awd_performance","label":"AWD Performance"},{"id":"black_edition","label":"Black Edition"}],"colors":["arctic_white","graphite_gray","midnight_black","silver_frost","kaitoke_green_matte","black_edition"],"interiors":["dark_gray","coffee","saddle","light_gray"],"catalog_status":"official_global","colors_by_year":{"2025":["arctic_white","graphite_gray","midnight_black","silver_frost","kaitoke_green_matte","black_edition"],"2026":["arctic_white","graphite_gray","midnight_black","silver_frost","kaitoke_green_matte","black_edition"]},"year_palette_sources":{"2025":{"confidence":"inherited_group_market_specific","source":null,"notes":"Inherits group palette. Factory paint availability for this individual year/market not independently verified."},"2026":{"confidence":"inherited_group_market_specific","source":null,"notes":"Inherits group palette. Factory paint availability for this individual year/market not independently verified."}}}],"G9L":[{"id":"2026","label":"2026","years":[2026],"trims":[{"id":"awd_performance_ultra_6","label":"6-seater AWD Performance Ultra"},{"id":"rwd_long_range_ultra_7","label":"7-seater RWD Long Range Ultra"},{"id":"awd_performance_ultra_7","label":"7-seater AWD Performance Ultra"}],"colors":["arctic_white","diamond_black","mirror_gray","waving_green"],"interiors":["meteorite_black","tangerine"],"catalog_status":"official_global","colors_by_year":{"2026":["arctic_white","diamond_black","mirror_gray","waving_green"]},"year_palette_sources":{"2026":{"confidence":"inherited_group_market_specific","source":null,"notes":"Inherits group palette. Factory paint availability for this individual year/market not independently verified."}}}],"X9":[{"id":"2024-2025","label":"2024-2025","years":[2024,2025],"trims":[{"id":"fwd_long_range","label":"FWD Long Range"},{"id":"awd_performance","label":"AWD Performance"}],"colors":["arctic_white","midnight_black","silver_frost","matte_gray"],"catalog_status":"official_global","colors_by_year":{"2024":["arctic_white","midnight_black","silver_frost","matte_gray"],"2025":["arctic_white","midnight_black","silver_frost","matte_gray"]},"year_palette_sources":{"2024":{"confidence":"inherited_group_market_specific","source":null,"notes":"Inherits group palette. Factory paint availability for this individual year/market not independently verified."},"2025":{"confidence":"inherited_group_market_specific","source":null,"notes":"Inherits group palette. Factory paint availability for this individual year/market not independently verified."}}},{"id":"2026","label":"2026","years":[2026],"trims":[{"id":"fwd_standard_range","label":"FWD Standard Range"},{"id":"fwd_long_range","label":"FWD Long Range"},{"id":"awd_performance","label":"AWD Performance"}],"colors":["arctic_white","midnight_black","silver_frost","matte_gray","lambent_cyan","polar_violet"],"interiors":["meteorite_black","coffee"],"catalog_status":"official_global","colors_by_year":{"2026":["arctic_white","midnight_black","silver_frost","matte_gray","lambent_cyan","polar_violet"]},"year_palette_sources":{"2026":{"confidence":"inherited_group_market_specific","source":null,"notes":"Inherits group palette. Factory paint availability for this individual year/market not independently verified."}}}],"MONA M03":[{"id":"2024-2025","label":"2024-2025","years":[2024,2025],"trims":[{"id":"market_dependent","label":"Variant / market-dependent"}],"colors":["night_black","nebula_white","star_gray","starlight_beige","star_blue"],"catalog_status":"official_cn_launch_baseline","source_url":"https://bbs.xiaopeng.com/article/2764153","market":"China","artwork_status":"pending_model_specific_views","colors_by_year":{"2024":["night_black","nebula_white","star_gray","starlight_beige","star_blue"],"2025":["night_black","nebula_white","star_gray","starlight_beige","star_blue"]},"year_palette_sources":{"2024":{"confidence":"inherited_group_market_specific","source":"https://bbs.xiaopeng.com/article/2764153","notes":"Inherits group palette. Factory paint availability for this individual year/market not independently verified."},"2025":{"confidence":"inherited_group_market_specific","source":"https://bbs.xiaopeng.com/article/2764153","notes":"Inherits group palette. Factory paint availability for this individual year/market not independently verified."}}},{"id":"2026","label":"2026","years":[2026],"trims":[{"id":"market_dependent","label":"Variant / market-dependent"}],"colors":["roland_purple","avocado_green","micro_moon_gray","night_black","nebula_white","starlight_beige","cherry_pink"],"catalog_status":"official_cn_configurator","source_url":"https://www.xiaopeng.com/m03_2026.html","market":"China","artwork_status":"pending_model_specific_views","colors_by_year":{"2026":["roland_purple","avocado_green","micro_moon_gray","night_black","nebula_white","starlight_beige","cherry_pink"]},"year_palette_sources":{"2026":{"confidence":"inherited_group_market_specific","source":"https://www.xiaopeng.com/m03_2026.html","notes":"Inherits group palette. Factory paint availability for this individual year/market not independently verified."}}}],"L03":[{"id":"2026","label":"2026","years":[2026],"trims":[{"id":"rwd_standard_range","label":"RWD Standard Range"},{"id":"rwd_long_range","label":"RWD Long Range"},{"id":"awd_performance","label":"AWD Performance"},{"id":"awd_performance_ultra","label":"AWD Performance Ultra"},{"id":"reev","label":"REEV / Range Extender"}],"colors":["arctic_white","midnight_black","silver_frost","rock_gray","phantom_purple","black_edition"],"interiors":["dark_gray","light_gray"],"catalog_status":"official_global","colors_by_year":{"2026":["arctic_white","midnight_black","silver_frost","rock_gray","phantom_purple","black_edition"]},"year_palette_sources":{"2026":{"confidence":"inherited_group_market_specific","source":null,"notes":"Inherits group palette. Factory paint availability for this individual year/market not independently verified."}}}],"GX":[{"id":"2026","label":"2026","years":[2026],"trims":[{"id":"preorder","label":"Pre-order / market-dependent"}],"colors":["diamond_black","everest_white","matte_desert_gold","graphite_gray","two_tone_gray_silver"],"catalog_status":"official_regional","colors_by_year":{"2026":["diamond_black","everest_white","matte_desert_gold","graphite_gray","two_tone_gray_silver"]},"year_palette_sources":{"2026":{"confidence":"inherited_group_market_specific","source":null,"notes":"Inherits group palette. Factory paint availability for this individual year/market not independently verified."}}}]});
const XP_ALIASES={space_grey:'space_gray',space_gray:'space_gray',graphite_grey:'graphite_gray',jet_black:'jet_black',black:'dark_gray',dark:'dark_gray',light_grey:'light_gray',white:'light_gray'};
function xpAppearanceId(v,kind='color'){
 const k=String(v??'').trim().toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'');
 if(kind==='interior'&&k==='black')return 'dark_gray';
 if(kind==='interior'&&k==='white')return 'light_gray';
 if(kind==='color'&&k==='black')return 'midnight_black';
 if(kind==='color'&&k==='white')return 'arctic_white';
 return XP_ALIASES[k]||k;
}
function xpModel(model){return XP_MODELS.find(m=>m.id===model)||XP_MODELS.find(m=>m.id==='G6');}
function xpAllowedModels(){return [...XP_MODELS].sort((a,b)=>Math.max(...xpAllowedYearGroups(b.id).flatMap(g=>g.years))-Math.max(...xpAllowedYearGroups(a.id).flatMap(g=>g.years))||a.name.localeCompare(b.name));}
function xpAllowedYearGroups(model){return XP_YEAR_GROUPS[String(model)]||[];}
function xpYearGroupFor(model,value){
 const groups=xpAllowedYearGroups(model);if(!groups.length)return null;
 const raw=String(value??'').trim();
 return groups.find(g=>g.id===raw)||groups.find(g=>g.years.includes(Number(raw)))||groups[groups.length-1];
}
function xpAllowedYears(model){
 const years=new Set(xpAllowedYearGroups(model).flatMap(g=>g.years));
 return [...years].sort((a,b)=>b-a).map(year=>({id:String(year),label:String(year)}));
}
function xpYearGroupChoices(model){
 return [...xpAllowedYearGroups(model)].sort((a,b)=>Math.max(...b.years)-Math.max(...a.years))
  .map(g=>({id:g.id,label:g.id.replace('-', '–')+(model==='G6'?(g.id==='2026'?' · Facelift':' · Original G6'):'')}));
}
function xpYearNeedsSpecificChoice(model,year){
 const g=xpYearGroupFor(model,year);
 return Boolean(g&&g.years.length>1&&new Set(g.years.map(y=>JSON.stringify(g.colors_by_year?.[String(y)]||g.colors))).size>1);
}
function xpYearsWithinGroup(model,year){
 const g=xpYearGroupFor(model,year);
 return g?[...g.years].sort((a,b)=>b-a).map(y=>({id:String(y),label:String(y)})):[];
}
function xpAllowedTrims(model,year){return xpYearGroupFor(model,year)?.trims||[{id:'market_dependent',label:'Variant / market-dependent'}];}
function xpAllowedPaints(model,year){
 const group=xpYearGroupFor(model,year),raw=String(year??'');
 const byYear=group?.colors_by_year;
 const ids=byYear&&Object.prototype.hasOwnProperty.call(byYear,raw)?byYear[raw]:byYear?group.colors.filter(id=>group.years.every(y=>byYear[String(y)]?.includes(id))):group?.colors||[];
 return ids.map(id=>XP_PAINTS.find(p=>p.id===id)).filter(Boolean);
}
function xpAllowedInteriors(model,year){
 const ids=xpYearGroupFor(model,year)?.interiors||['dark_gray','light_gray'];
 return ids.map(id=>XP_INTERIORS.find(p=>p.id===id)).filter(Boolean);
}
function xpIsVerifiedPalette(model,year){return Boolean(xpYearGroupFor(model,year)?.catalog_status?.startsWith('official'));}
function xpNormalizeAppearance(value){
 const v=value||{};
 const incoming=String(v.model??'G6').replace(/^XPENG\s+/i,'').trim();
 const mdl=XP_MODELS.some(m=>m.id===incoming)?incoming:'G6';
 const group=xpYearGroupFor(mdl,v.year)||xpAllowedYearGroups(mdl)[0];
 const rawYear=String(v.year??'');
 const availableYears=xpAllowedYears(mdl).map(x=>x.id);
  const yr=availableYears.includes(rawYear)||xpAllowedYearGroups(mdl).some(g=>g.id===rawYear)?rawYear:(availableYears[0]||'2026');
 const trims=xpAllowedTrims(mdl,yr),requestedTrim=String(v.trim??'');
 const trim=trims.some(x=>x.id===requestedTrim)?requestedTrim:(trims[0]?.id||'market_dependent');
 const paints=xpAllowedPaints(mdl,yr),requestedPaint=xpAppearanceId(v.color);
 const color=paints.some(x=>x.id===requestedPaint)?requestedPaint:(paints[0]?.id||'arctic_white');
 const interiors=xpAllowedInteriors(mdl,yr),requestedInterior=xpAppearanceId(v.interior,'interior');
 const interior=interiors.some(x=>x.id===requestedInterior)?requestedInterior:(interiors[0]?.id||'dark_gray');
 return {...v,year:yr,model:mdl,trim,color,interior};
}
function xpAssetModel(model){return String(model).toLowerCase().replace(/\s+/g,'_').replace(/\+/g,'_plus').replace(/[^a-z0-9_]/g,'');}
const XP_ARTWORK_INDEX = new Set(["vehicles/g6/2023-2025/arctic_white/charging.webp","vehicles/g6/2023-2025/arctic_white/front.webp","vehicles/g6/2023-2025/arctic_white/top.webp","vehicles/g6/2023-2025/fiery_orange/charging.webp","vehicles/g6/2023-2025/fiery_orange/front.webp","vehicles/g6/2023-2025/fiery_orange/top.webp","vehicles/g6/2023-2025/graphite_gray/charging.webp","vehicles/g6/2023-2025/graphite_gray/front.webp","vehicles/g6/2023-2025/graphite_gray/top.webp","vehicles/g6/2023-2025/midnight_black/charging.webp","vehicles/g6/2023-2025/midnight_black/front.webp","vehicles/g6/2023-2025/midnight_black/top.webp","vehicles/g6/2023-2025/silver_frost/charging.webp","vehicles/g6/2023-2025/silver_frost/front.webp","vehicles/g6/2023-2025/silver_frost/top.webp","vehicles/g6/2026/arctic_white/charging.webp","vehicles/g6/2026/arctic_white/front.webp","vehicles/g6/2026/arctic_white/top.webp","vehicles/g6/2026/graphite_gray/charging.webp","vehicles/g6/2026/graphite_gray/front.webp","vehicles/g6/2026/graphite_gray/top.webp","vehicles/g6/2026/midnight_black/charging.webp","vehicles/g6/2026/midnight_black/front.webp","vehicles/g6/2026/midnight_black/top.webp","vehicles/g6/2026/silver_frost/charging.webp","vehicles/g6/2026/silver_frost/front.webp","vehicles/g6/2026/silver_frost/top.webp","vehicles/g6/2026/stellar_purple/charging.webp","vehicles/g6/2026/stellar_purple/front.webp","vehicles/g6/2026/stellar_purple/top.webp","vehicles/g7/2025/cloud_beige/charging.webp","vehicles/g7/2025/cloud_beige/front.webp","vehicles/g7/2025/cloud_beige/top.webp","vehicles/g7/2025/crescent_silver/charging.webp","vehicles/g7/2025/crescent_silver/front.webp","vehicles/g7/2025/crescent_silver/top.webp","vehicles/g7/2025/interstellar_green/charging.webp","vehicles/g7/2025/interstellar_green/front.webp","vehicles/g7/2025/interstellar_green/top.webp","vehicles/g7/2025/nebula_white/charging.webp","vehicles/g7/2025/nebula_white/front.webp","vehicles/g7/2025/nebula_white/top.webp","vehicles/g7/2025/night_black/charging.webp","vehicles/g7/2025/night_black/front.webp","vehicles/g7/2025/night_black/top.webp","vehicles/g7/2025/starday_gray/charging.webp","vehicles/g7/2025/starday_gray/front.webp","vehicles/g7/2025/starday_gray/top.webp","vehicles/g9/2025-2026/arctic_white/charging.webp","vehicles/g9/2025-2026/arctic_white/front.webp","vehicles/g9/2025-2026/arctic_white/top.webp","vehicles/g9/2025-2026/graphite_gray/charging.webp","vehicles/g9/2025-2026/graphite_gray/front.webp","vehicles/g9/2025-2026/graphite_gray/top.webp","vehicles/g9/2025-2026/kaitoke_green_matte/charging.webp","vehicles/g9/2025-2026/kaitoke_green_matte/front.webp","vehicles/g9/2025-2026/kaitoke_green_matte/top.webp","vehicles/g9/2025-2026/midnight_black/charging.webp","vehicles/g9/2025-2026/midnight_black/front.webp","vehicles/g9/2025-2026/midnight_black/top.webp","vehicles/g9/2025-2026/silver_frost/charging.webp","vehicles/g9/2025-2026/silver_frost/front.webp","vehicles/g9/2025-2026/silver_frost/top.webp","vehicles/p7i/2023-2025/arctic_white/front.webp"]);
const XP_ILLUSTRATIVE_ARTWORK_INDEX = new Set(["vehicles/g6/2023-2025/arctic_white/charging.webp","vehicles/g6/2023-2025/arctic_white/front.webp","vehicles/g6/2023-2025/arctic_white/top.webp","vehicles/g6/2023-2025/fiery_orange/charging.webp","vehicles/g6/2023-2025/fiery_orange/front.webp","vehicles/g6/2023-2025/fiery_orange/top.webp","vehicles/g6/2023-2025/graphite_gray/charging.webp","vehicles/g6/2023-2025/graphite_gray/front.webp","vehicles/g6/2023-2025/graphite_gray/top.webp","vehicles/g6/2023-2025/midnight_black/charging.webp","vehicles/g6/2023-2025/midnight_black/front.webp","vehicles/g6/2023-2025/midnight_black/top.webp","vehicles/g6/2023-2025/silver_frost/charging.webp","vehicles/g6/2023-2025/silver_frost/front.webp","vehicles/g6/2023-2025/silver_frost/top.webp","vehicles/g7/2025/cloud_beige/charging.webp","vehicles/g7/2025/cloud_beige/front.webp","vehicles/g7/2025/cloud_beige/top.webp","vehicles/g7/2025/crescent_silver/charging.webp","vehicles/g7/2025/crescent_silver/front.webp","vehicles/g7/2025/crescent_silver/top.webp","vehicles/g7/2025/interstellar_green/charging.webp","vehicles/g7/2025/interstellar_green/front.webp","vehicles/g7/2025/interstellar_green/top.webp","vehicles/g7/2025/nebula_white/charging.webp","vehicles/g7/2025/nebula_white/front.webp","vehicles/g7/2025/nebula_white/top.webp","vehicles/g7/2025/night_black/charging.webp","vehicles/g7/2025/night_black/front.webp","vehicles/g7/2025/night_black/top.webp","vehicles/g7/2025/starday_gray/charging.webp","vehicles/g7/2025/starday_gray/front.webp","vehicles/g7/2025/starday_gray/top.webp","vehicles/g9/2025-2026/arctic_white/charging.webp","vehicles/g9/2025-2026/arctic_white/front.webp","vehicles/g9/2025-2026/arctic_white/top.webp","vehicles/g9/2025-2026/graphite_gray/charging.webp","vehicles/g9/2025-2026/graphite_gray/front.webp","vehicles/g9/2025-2026/graphite_gray/top.webp","vehicles/g9/2025-2026/kaitoke_green_matte/charging.webp","vehicles/g9/2025-2026/kaitoke_green_matte/front.webp","vehicles/g9/2025-2026/kaitoke_green_matte/top.webp","vehicles/g9/2025-2026/midnight_black/charging.webp","vehicles/g9/2025-2026/midnight_black/front.webp","vehicles/g9/2025-2026/midnight_black/top.webp","vehicles/g9/2025-2026/silver_frost/charging.webp","vehicles/g9/2025-2026/silver_frost/front.webp","vehicles/g9/2025-2026/silver_frost/top.webp","vehicles/p7i/2023-2025/arctic_white/front.webp"]);
function xpVehicleAssetPath(a,view){
 if(!['front','charging','top'].includes(view))return null;
 const group=xpYearGroupFor(a.model,a.year);
 return group?'vehicles/'+xpAssetModel(a.model)+'/'+group.id+'/'+a.color+'/'+view+'.webp':null;
}
const XP_SCENE_BACKGROUND = 'https://raw.githubusercontent.com/matanmesika/xpeng-vehicle-card/main/assets/xpeng-approved-lakeside-background.webp';
const XP_HACS_BASE='/hacsfiles/xpeng-vehicle-card/';
function xpPackagedUrl(relative){return 'https://raw.githubusercontent.com/matanmesika/xpeng-vehicle-card/main/assets/'+relative;}
function xpLocalArtworkPath(value){return typeof value==='string'&&/^\/(?:local|hacsfiles)\/[a-zA-Z0-9/_\-.]+$/.test(value);}
const XP_CSS = "__XPENG_STYLES_FROM_THEME__";
// Retain legacy manual entity mapping for older YAML; new configs are automatic.
function xpSensorMappingMode(cfg,profile){
 const mode=profile?.sensor_mapping_mode??cfg?.sensor_mapping_mode;
 if(mode==='auto'||mode==='manual')return mode;
 return Object.keys(profile?.entities||{}).length||Object.keys(cfg?.entities||{}).length?'manual':'auto';
}
class XpengVehicleCard extends HTMLElement{
 constructor(){
  super();this.attachShadow({mode:'open'});this._config={};this._hass=null;this._view='overview';this._expanded=false;this._vehicleIndex=0;this._infoOpen=false;this._tireOpen=false;this._failedArtwork=new Set();this._xpNavStack=[];this._xpMapElement=null;this._xpMapEntityId=null;this._xpTogglePending=Object.create(null);
  this.shadowRoot.addEventListener('error',ev=>{
      const img=ev.target;
      if(!img?.matches?.('img[data-car-art],img[data-top-art],img[data-cabin-art]'))return;
      const failed=img.getAttribute('src');
      if(!failed||this._failedArtwork.has(failed))return;
      this._failedArtwork.add(failed);
      this.render();
    },true);
   this.shadowRoot.addEventListener('click',ev=>{
    const b=ev.target?.closest?.('button');
    // Outside a modal, return to Home regardless of the nested navigation stack.
    const modal=this.shadowRoot?.querySelector?.('.xp-ux-modal');
    const outside=!!this._xpPanel&&!!modal&&!ev.composedPath().includes(modal);
    if(outside&&!b?.hasAttribute('data-xp-more')&&!b?.hasAttribute('data-meta-toggle')){
      this.xpBackToHome();return;
    }
    if(!b)return;
     
     if(b.hasAttribute('data-xp-close')){this.xpBackPanel();return;}
     if(b.hasAttribute('data-xp-home')){this.xpBackToHome();return;}
     if(b.hasAttribute('data-xp-page')){this.xpNavigatePanel(b.dataset.xpPage);return;}
     if(b.hasAttribute('data-xp-cycle')){this.xpCycleSeat(b.dataset.xpCycle);return;}
      
     if(b.hasAttribute('data-xp-open')){
       const action=b.dataset.xpOpen;
       if(['climate','port','doors','windows','trunk','map','maintenance','charge_controls','charge_schedule'].includes(action)){
         this.xpNavigatePanel(action);
       }
       return;
      }
      if(b.hasAttribute('data-xp-toggle')){
       const action=b.dataset.xpToggle;
       if(['doors','windows','port','trunk'].includes(action))this.xpToggle(action);
       return;
     }
     if(b.hasAttribute('data-xp-port')){
       const suffix=b.dataset.xpPort==='open'?'open_charge_port':b.dataset.xpPort==='close'?'close_charge_port':null;
       if(suffix)this.xpSend('button','press',suffix);
       return;
     }
     if(b.hasAttribute('data-xp-command')){
       if(b.dataset.xpCommand==='stop_charge')this.xpSend('button','press','stop_charge');
       return;
     }
     if(b.hasAttribute('data-xp-vehicle')){
       const actions={
         'lock.lock.door_lock':['lock','lock','door_lock'],
         'button.press.close_windows':['button','press','close_windows'],
         'button.press.close_trunk':['button','press','close_trunk'],
         'button.press.flash_lights':['button','press','flash_lights'],
         'button.press.honk_horn':['button','press','honk_horn'],
         'switch.turn_on.sentinel_switch':['switch','turn_on','sentinel_switch']
       };
       const command=actions[b.dataset.xpVehicle];
       if(command)this.xpSend(...command);
       return;
     }
     if(b.hasAttribute('data-xp-access')){
        const act=b.dataset.xpAccess;
        const enabled=this.vehicle()?.enable_access_controls??this._config.enable_access_controls??false;
        const allowed=enabled===true||enabled==='true';
        if(!allowed)return;
        if(act==='unlock')this.xpSend('lock','unlock','door_lock');
        if(act==='open_windows')this.xpSend('button','press','open_windows');
        return;
      }
      if(b.hasAttribute('data-xp-door-lock')){this.xpSend('lock','lock','door_lock');return;}
      if(b.hasAttribute('data-xp-window-close')){this.xpSend('button','press','close_windows');return;}
      if(b.hasAttribute('data-xp-map-details')){this.xpDetails('location','device_tracker');return;}
      if(b.hasAttribute('data-xp-map-action')){
        const action=b.dataset.xpMapAction;
        if(['honk_horn','flash_lights'].includes(action))this.xpMapDirectAction(action);
        return;
      }
      if(b.hasAttribute('data-xp-temp')){this.xpDoTemperature(Number(b.dataset.xpTemp));return;}
     if(b.hasAttribute('data-xp-climate')){
       this.xpSend('climate',b.dataset.xpClimate==='on'?'turn_on':'turn_off','cabin_climate');return;
     }
     if(b.hasAttribute('data-xp-switch')){
       if(b.dataset.xpSwitch==='defrost_switch')this.xpSend('switch','toggle','defrost_switch');
       return;
     }
     if(b.hasAttribute('data-xp-hvac-mode')){
       const mode=b.dataset.xpHvacMode,c=this.xpLive('climate','cabin_climate');
       if(c&&Array.isArray(c.state.attributes?.hvac_modes)&&c.state.attributes.hvac_modes.includes(mode))
         this.xpSend('climate','set_hvac_mode','cabin_climate',mode);
       return;
     }
     if(b.hasAttribute('data-xp-swing-mode')){
       const mode=b.dataset.xpSwingMode,c=this.xpLive('climate','cabin_climate');
       if(c&&Array.isArray(c.state.attributes?.swing_modes)&&c.state.attributes.swing_modes.includes(mode))
         this.xpSend('climate','set_swing_mode','cabin_climate',mode);
       return;
     }
     if(b.hasAttribute('data-xp-select')){
       const suffix=b.dataset.xpSelect,option=b.dataset.xpOption;
       const permitted=new Set(['driver_seat_heat_select','passenger_seat_heat_select',
         'driver_seat_ventilation_select','passenger_seat_ventilation_select',
         'left_rear_seat_heat_select','right_rear_seat_heat_select',
         'left_rear_seat_ventilation_select','right_rear_seat_ventilation_select',
         'steering_wheel_heat_select']);
       const ent=permitted.has(suffix)?this.xpLive('select',suffix):null;
       if(ent?.state?.attributes?.options?.includes(option) && !(suffix==='passenger_seat_heat_select'&&option==='Off')){
         this.xpSend('select','select_option',suffix,option);
       }
       return;
     }

     if(b.hasAttribute('data-xp-more')){
       this.xpNavigatePanel('extras');return;
     }
     if(b.hasAttribute('data-xp-extra-page')){
       const page=b.dataset.xpExtraPage;
       if(page==='maintenance'){this.xpNavigatePanel('maintenance');return;}
       if(['security','energy','schedule','power','updates','diagnostics'].includes(page)){
         this.xpNavigatePanel('extras',page);
       }
       return;
     }
     if(b.hasAttribute('data-xp-extra-back')){
       this.xpBackPanel();return;
     }
     if(b.hasAttribute('data-xp-hvac-schedule')){
       const id=b.dataset.xpHvacSchedule;
       const schedule=this.xpLive('sensor','hvac_schedules');
       const matches=Array.isArray(schedule?.state.attributes?.schedules)?
         schedule.state.attributes.schedules.some(item=>item&&item.appointment_id!=null&&String(item.appointment_id)===id):false;
       if(!matches)return;
       const suffix='hvac_schedule_'+id,entity=this.xpLive('switch',suffix);
       if(!entity||!['on','off'].includes(entity.state.state))return;
       this.xpSend('switch',entity.state.state==='on'?'turn_off':'turn_on',suffix);
       return;
     }
     if(b.hasAttribute('data-xp-extra-detail')){
       const lookup={
         schedules:['sensor','hvac_schedules'], calendar:['calendar','hvac_schedule_calendar'],
         maintenance:['sensor','maintenance'], ota:['sensor','ota_upgrade']
       };
       const key=lookup[b.dataset.xpExtraDetail];
       if(key)this.xpDetails(key[1],key[0]);
       return;
     }
     if(b.hasAttribute('data-xp-extra-action')){
       const cmds={
         'guard_on':['switch','turn_on','sentinel_switch'],
         'guard_off':['switch','turn_off','sentinel_switch'],
         'v2l_on':['switch','turn_on','trunk_power_switch'],
         'v2l_off':['switch','turn_off','trunk_power_switch'],
         'ota_on':['switch','turn_on','auto_upgrade_switch'],
         'ota_off':['switch','turn_off','auto_upgrade_switch']
       };
       const action=b.dataset.xpExtraAction;
       if(action==='guard_off'&&!this.xpAccessAllowed())return;
       const command=cmds[action];
       if(command&&this.xpLive(command[0],command[2]))this.xpSend(...command);
       return;
     }
     if(b.hasAttribute('data-meta-toggle')){this._infoOpen=!this._infoOpen;this.render();return;}
     if(b.hasAttribute('data-tire-toggle')){this._tireOpen=!this._tireOpen;this._infoOpen=false;this.render();return;}
    if(b.hasAttribute('data-cycle')){this._vehicleIndex=(this._vehicleIndex+1)%this.vehicles().length;this._tireOpen=false;this._xpPanel=null;this._xpExtraSection=null;this._xpNavStack=[];this._xpengRegistryLoaded=false;this._xpengByKey=null;this._xpMapElement=null;this._xpMapEntityId=null;this.ensureXpengRegistry();this.render();}
  });
   this.shadowRoot.addEventListener('input',ev=>{
     const slider=ev.target.closest('input[data-xp-range]');
     if(!slider)return;
     const label=slider.closest('label'),output=label?.querySelector('span b');
     if(output)output.textContent=slider.value+(slider.dataset.xpRange==='charge_limit_control'?'%':'');
   });
   this.shadowRoot.addEventListener('change',ev=>{
     const slider=ev.target.closest('input[data-xp-range]');
     if(!slider)return;
     const key=slider.dataset.xpRange;
     if(!['charge_limit_control','fan_speed_control','sentinel_sensitivity_control','trunk_power_timer_control'].includes(key))return;
     const entity=this.xpLive('number',key);
     if(!entity)return;
     const attrs=entity.state.attributes||{};
     const lo=Number(attrs.min??(key==='charge_limit_control'?50:1));
     const hi=Number(attrs.max??(key==='charge_limit_control'?100:8));
     const step=Number(attrs.step??(key==='charge_limit_control'?5:1));
     const raw=Number(slider.value);
     if(!Number.isFinite(raw)||!Number.isFinite(lo)||!Number.isFinite(hi)||!Number.isFinite(step)||step<=0)return;
     const value=Math.max(lo,Math.min(hi,Math.round((raw-lo)/step)*step+lo));
     this.xpSend('number','set_value',key,value);
   });
 }

 async ensureXpengRegistry(){
  if(this._xpengRegistryPending||this._xpengRegistryLoaded)return;
  const conn=this._hass?.connection;
  if(typeof conn?.sendMessagePromise!=='function')return;
  this._xpengRegistryPending=true;
  try{
   const entries=await conn.sendMessagePromise({type:'config/entity_registry/list'});
   const selection=xpVehicleRegistryRows(entries,this.prefix(),this.vehicle()?.xpeng_device_id??this._config.xpeng_device_id);
   this._xpengByKey=selection.byKey;
   this._xpengEntities=selection.entries;
   this._xpengRegistryMessage=selection.message;
   this._xpengRegistryLoaded=true;
   this.render();
  }catch(error){
   this._xpengRegistryMessage='registry_unavailable';
  }finally{
   this._xpengRegistryPending=false;
  }
 }
 /* Discover a single vehicle's standard Xpengtk VIN-based entity prefix.
  * Never guess when more than one vehicle is present. Renames use Entity Registry.
  */
 xpAutoVehiclePrefix(){
  const ids=Object.keys(this._hass?.states||{});
  const find=pattern=>[...new Set(ids.map(id=>pattern.exec(id)?.[1]).filter(Boolean))];
  const trackers=find(/^device_tracker\.(xpeng_[a-z0-9]{6})_location$/);
  if(trackers.length>1)return null;
  if(trackers.length===1)return trackers[0];
  const batteries=find(/^sensor\.(xpeng_[a-z0-9]{6})_battery$/);
  return batteries.length===1?batteries[0]:null;
 }
 xpPrefixes(){return [...new Set([this.prefix(),this.xpAutoVehiclePrefix()].filter(Boolean))];}
 xpengEntity(domain,suffix){
  const key=domain+'.'+suffix;
  const extra={
   'binary_sensor.windows':['any_window_open'],
   'binary_sensor.locked':['lock'],
   'sensor.slow_charge_port':['charge_port'],
   'sensor.maintenance':['next_maintenance']
  }[key]||[];
  const tails=[XP_CONTROL_FALLBACKS[key],suffix,...extra].filter(Boolean);
  const registryKeys=[key,...extra.map(x=>domain+'.'+x)];
  const candidates=[...new Set([
   ...registryKeys.map(k=>this._xpengByKey?.[k]),
   ...this.xpPrefixes().flatMap(prefix=>tails.map(t=>domain+'.'+prefix+'_'+t))
  ].filter(Boolean))];
  const states=this._hass?.states||{};
  return candidates.find(id=>states[id]&&!XP_INVALID.has(String(states[id].state).trim().toLowerCase()))
    ||candidates.find(id=>states[id])||null;
 }

 xpUiEnabled(){const v=this.vehicle()?.show_controls??this._config.show_controls;return v===undefined?this.model()==='G6':v===true||v==='true';}
 xpLive(domain,suffix){
  const id=this.xpengEntity(domain,suffix);
  const state=id?this._hass?.states?.[id]:null;
  return state&&state.state!=='unavailable'&&(domain==='button'||state.state!=='unknown')?{id,state}:null;
 }
 xpChargingActive(){
  // A confirmed unplugged cable overrides stale charging telemetry.
  if(this.bool('plugged')===false)return false;
  return xpChargingActive(this.val('charging'))===true;
 }
 xpActionState(action){
   if(action==='doors'){
     const state=this.xpLive('lock','door_lock')?.state?.state;
     if(state==='locked'||state==='unlocked')return state==='locked'?'closed':'open';
     // In Xpengtk binary_sensor.locked: ON means *unlocked*, OFF means locked.
     const sensor=this.xpLive('binary_sensor','locked')?.state?.state;
     return sensor==='on'?'open':sensor==='off'?'closed':null;
   }
   if(action==='trunk'){
     const state=this.xpLive('binary_sensor','trunk')?.state?.state;
     return state==='off'?'closed':state==='on'?'open':null;
   }
   if(action==='windows'){
     const state=this.xpLive('binary_sensor','windows')?.state?.state;
     return state==='off'?'closed':state==='on'?'open':null;
   }
   if(action==='port'){
     // Xpengtk slow-charge-port enum: Closed / Open / Connected (with optional raw 0/1/2).
     const raw=this.xpLive('sensor','slow_charge_port')||this.xpLive('sensor','charge_port');
     const val=String(raw?.state?.state??'').trim().toLowerCase();
     return ['closed','0'].includes(val)?'closed':['open','1'].includes(val)?'open':null;
   }
   return null;
 }
 xpToggleTarget(action){
   const state=this.xpActionState(action);
   if(state===null)return null;
   if(action==='doors')return state==='open'
     ?{domain:'lock',service:'lock',suffix:'door_lock',label:'נעילת הרכב'}
     :this.xpAccessAllowed()?{domain:'lock',service:'unlock',suffix:'door_lock',label:'שחרור נעילה'}:null;
   if(action==='windows')return state==='open'
     ?{domain:'button',service:'press',suffix:'close_windows',label:'סגירת חלונות'}
     :this.xpAccessAllowed()?{domain:'button',service:'press',suffix:'open_windows',label:'פתיחת חלונות'}:null;
   if(action==='trunk')return state==='open'
     ?{domain:'button',service:'press',suffix:'close_trunk',label:'סגירת תא מטען'}
     :this.xpAccessAllowed()?{domain:'button',service:'press',suffix:'open_trunk',label:'פתיחת תא מטען'}:null;
   if(action==='port')return state==='open'
     ?{domain:'button',service:'press',suffix:'close_charge_port',label:'סגירת שקע טעינה'}
     :{domain:'button',service:'press',suffix:'open_charge_port',label:'פתיחת שקע טעינה'};
   return null;
 }
 xpPendingToggle(action){
   const pending=this._xpTogglePending?.[action];
   if(!pending)return null;
   const elapsed=Date.now()-pending.at;
   if(elapsed>=12000||(elapsed>=1800&&this.xpActionState(action)===pending.expected)){
     delete this._xpTogglePending[action];
     return null;
   }
   return pending;
 }
 xpToggle(action){
   // Lock out double taps and stale alternating entity reports while an actual
   // vehicle command is being processed. Sensor updates never send commands.
   if(this.xpPendingToggle(action))return;
   const target=this.xpToggleTarget(action);
   if(!target||!this.xpLive(target.domain,target.suffix))return;
   this._xpTogglePending??=Object.create(null);
   const marker={target,expected:this.xpActionState(action)==='open'?'closed':'open',at:Date.now()};
   this._xpTogglePending[action]=marker;
   this.render();
   const sent=this.xpSend(target.domain,target.service,target.suffix,undefined,true);
   Promise.resolve(sent).then(ok=>{
     if(ok===false&&this._xpTogglePending[action]===marker){
       delete this._xpTogglePending[action];
       this.render();
     }
   });
   if(typeof setTimeout==='function')setTimeout(()=>{
     if(this._xpTogglePending?.[action]===marker){
       delete this._xpTogglePending[action];this.render();
     }
   },12000);
 }
 xpToggleButton(action){
   const pending=this.xpPendingToggle(action);
   const target=pending?.target||this.xpToggleTarget(action);
   const usable=!pending&&target&&this.xpLive(target.domain,target.suffix);
   const title=target?.label||(this.xpActionState(action)===null?'המצב אינו ידוע':'נדרשת הרשאת Access');
   return '<button type="button" data-xp-toggle="'+action+'" '+(usable?'':'disabled')+
     ' aria-label="'+xpEsc(title)+'" title="'+xpEsc(title)+'">'+
     xpIcon(action==='doors'?(target?.service==='unlock'?'unlock':'lock'):action==='trunk'?(target?.suffix==='open_trunk'?'trunk_open':target?.suffix==='close_trunk'?'trunk_close':'trunk'):action==='port'?(target?.suffix==='open_charge_port'?'port_open':'plug'):(target?.suffix==='open_windows'?'windows_open':'windows'),20)+'<span>'+xpEsc(title)+'</span></button>';
 }
 xpDock(){
   if(!this.xpUiEnabled())return '';
   const items=[
     ['climate','fan','מיזוג'],
     ['doors','lock','נעילה'],['windows','windows','חלונות'],
     ['port','plug','שקע טעינה'],['trunk','trunk','תא מטען'],
     ['maintenance','maintenance','תחזוקה'],['map','pin','מיקום']
   ];
   return '<nav class="xp-ux-dock xp-ux-dock-seven" aria-label="פעולות הרכב וקיצורי מסכים" dir="rtl">'+
     items.map(([action,icon,title])=>{
       const toggle=['doors','windows','port','trunk'].includes(action);
       const pending=toggle?this.xpPendingToggle(action):null;
       const target=toggle?(pending?.target||this.xpToggleTarget(action)):null;
       const available=toggle?!pending&&!!(target&&this.xpLive(target.domain,target.suffix)):
         action==='climate'?!!this.xpLive('climate','cabin_climate'):true;
       const label=toggle?(target?.label||(this.xpActionState(action)===null?'מצב לא ידוע':'דרושה הרשאת גישה')):title;
       const compact=toggle?({
         'נעילת הרכב':'נעל','שחרור נעילה':'פתח נעילה',
         'סגירת חלונות':'סגור חלונות','פתיחת חלונות':'פתח חלונות',
         'סגירת שקע טעינה':'סגור שקע','פתיחת שקע טעינה':'פתח שקע',
         'סגירת תא מטען':'סגור תא מטען','פתיחת תא מטען':'פתח תא מטען'
       }[label]||'לא זמין'):title;
       const ico=action==='doors'?(target?.service==='unlock'?'unlock':'lock'):
         action==='windows'?(target?.suffix==='open_windows'?'windows_open':'windows'):
         action==='port'?(target?.suffix==='open_charge_port'?'port_open':'plug'):
         action==='trunk'?(target?.suffix==='open_trunk'?'trunk_open':target?.suffix==='close_trunk'?'trunk_close':'trunk'):icon;
       return '<button class="xp-ux-dock-action" type="button" '+
         (toggle?'data-xp-toggle="'+action+'"':'data-xp-open="'+action+'"')+
         ' aria-label="'+xpEsc(label)+'" '+(pending?'aria-busy="true" ':'')+(available?'':'disabled')+'>'+
         xpIcon(ico,27)+'<small>'+xpEsc(compact)+'</small></button>';
     }).join('')+'</nav>';
 }
 xpSeatShownState(suffix){
   const e=this.xpLive('select',suffix);if(!e)return null;
   const old=e.state.state,pending=this._xpSeatPending?.[suffix];
   if(!pending)return old;
   if((pending.sent===true&&old===pending.option)||Date.now()-pending.at>90000){
     delete this._xpSeatPending[suffix];return old;
   }
   return pending.option;
 }
 xpSeatButtons(){
   const zones=[
     ['wheel','הגה',['steering_wheel_heat_select']],
     ['driver','נהג',['driver_seat_heat_select','driver_seat_ventilation_select']],
     ['passenger','נוסע',['passenger_seat_heat_select','passenger_seat_ventilation_select']],
     ['rear_left','אחורי שמאל',['left_rear_seat_heat_select','left_rear_seat_ventilation_select']],
     ['rear_right','אחורי ימין',['right_rear_seat_heat_select','right_rear_seat_ventilation_select']]
   ];
   return zones.map(([zone,label,keys])=>{
     const buttons=keys.map(key=>{
       const e=this.xpLive('select',key);
       if(!e)return '';
       const state=this.xpSeatShownState(key);
       const active=state&&state!=='Off';
       const vent=key.includes('ventilation');
       const type=vent?'xp-ux-cycle-vent':'xp-ux-cycle-heat';
       const title=(vent?'אוורור ':'חימום ')+label;
       const busy=this._xpSeatBusy?.[key];
       const icon=zone==='wheel'?'wheel_heat':vent?'seat_vent':'seat_heat';
       return '<button type="button" class="xp-ux-cycle '+type
         +(active?' xp-ux-cycle-on':'')+(busy?' xp-ux-cycle-busy':'')
         +'" data-xp-cycle="'+xpEsc(key)+'" aria-label="'+xpEsc(title+', דרגה '+xpSeatLevel(state))
         +'" title="'+xpEsc(title)+'" aria-pressed="'+String(!!active)+'">'
         +xpIcon(icon,20)+'<span class="xp-ux-level">'+xpSeatLevel(state)+'</span>'
         +'<small class="xp-cabin-action-label">'+(zone==='wheel'?'הגה':vent?'אוורור':'חימום')+'</small>'
         +'</button>';
     }).filter(Boolean).join('');
     return buttons?'<div class="xp-ux-hotspot-zone xp-ux-'+zone+'" data-xp-zone="'+zone
       +'" role="group" aria-label="'+label+'">'+buttons+'</div>':'';
   }).join('');
 }
 async xpCycleSeat(suffix){
   const allowed=new Set([
     'driver_seat_heat_select','passenger_seat_heat_select',
     'driver_seat_ventilation_select','passenger_seat_ventilation_select',
     'left_rear_seat_heat_select','right_rear_seat_heat_select',
     'left_rear_seat_ventilation_select','right_rear_seat_ventilation_select',
     'steering_wheel_heat_select'
   ]);
   if(!allowed.has(suffix))return;
   const e=this.xpLive('select',suffix);
   const choices=e?.state.attributes?.options;
   if(!e||!Array.isArray(choices))return;
   const next=xpNextSeatOption(this.xpSeatShownState(suffix),choices,suffix);
   if(!next){this._xpNotice='רמת החימום או האוורור אינה זמינה כעת.';this.render();return;}
   if(suffix==='passenger_seat_heat_select'&&next==='Off'){
     this._xpNotice='כיבוי חימום מושב הנוסע הקדמי אינו נתמך כרגע ב־Xpengtk. ניתן לכבות מתוך הרכב.';
     this.render();return;
   }
   this._xpSeatPending??=Object.create(null);
   this._xpSeatPending[suffix]={option:next,at:Date.now()};
   this._xpNotice='';
   this.render();
   if(this._xpSeatBusy?.[suffix])return;
   this._xpSeatBusy??=Object.create(null);
   this._xpSeatBusy[suffix]=true;
   let lastSent=null;
   try{
     while(this._xpSeatPending?.[suffix]){
       const target=this._xpSeatPending[suffix].option;
       if(target===lastSent)break;
       const ent=this.xpLive('select',suffix);
       if(!ent?.state.attributes?.options?.includes(target))throw Error('הדרגה אינה נתמכת כעת.');
       if(typeof this._hass?.callService!=='function')throw Error('שירות HA אינו זמין.');
       await this._hass.callService('select','select_option',{entity_id:ent.id,option:target});
       if(this._xpSeatPending?.[suffix]?.option===target)this._xpSeatPending[suffix].sent=true;
       lastSent=target;
     }
   }catch(error){
     delete this._xpSeatPending[suffix];
     this._xpNotice='פקודת המושב נכשלה: '+(error?.message||'שגיאה');
   }finally{
     delete this._xpSeatBusy[suffix];
     this.render();
   }
 }
 xpCabinHotspots(){
   return this.xpSeatButtons();
 }
 // Xpengtk currently does not publish an interior-colour sensor.
 // Only a colour from the selected vehicle's actual entity registry may
 // supersede the editor setting, otherwise the editor stays authoritative.
 xpCabinFinish(){
   const selected=this.appearance().interior;
   if(this.model()!=='G6')return selected;
   if(this.paint()==='black_edition')return 'dark_gray'; // Black Edition mandates a black/dark cabin.
   const entityId=this._xpengByKey?.['sensor.interior_color']||this._xpengByKey?.['sensor.cabin_color'];
   const entry=entityId?this._hass?.states?.[entityId]:null;
   const raw=String(entry?.state??'').trim().toLowerCase().replace(/[ -]+/g,'_');
   if(['white','light','light_gray','light_grey'].includes(raw))return 'light_gray';
   if(['black','dark','dark_gray','dark_grey'].includes(raw))return 'dark_gray';
   return selected;
 }
 xpCabinView(){
   const a={...this.appearance(),interior:this.xpCabinFinish()};
   const finish=XP_INTERIORS.find(x=>x.id===a.interior)||XP_INTERIORS[0];
   const multi=Array.isArray(this._config.vehicles)&&this._config.vehicles.length>0;
   const photos=multi?this.vehicle()?.interior_images:this._config.interior_images;
   const custom=photos&&typeof photos==='object'?photos[a.interior]:null;
   // Both owner photos are shared by every G6 year/trim and never replaced by SVG.
   const known=a.model==='G6';
   const photo=known?this.artworkUrl('vehicles/g6/interior_'+a.interior+'.webp'):null;
   const candidates=[
     ...(xpLocalArtworkPath(custom)?[{src:custom,portrait:!(this._config.interior_images_landscape===true)}]:[]),
     ...(photo?[{src:photo,portrait:true}]:[])
   ];
   const found=candidates.find(x=>!this._failedArtwork.has(x.src));
   if(!found&&known)return '<div class="xp-ux-cabin xp-ux-cabin-art xp-ux-cabin-missing" role="status" dir="rtl">תמונת פנים G6 בצבע שנבחר עדיין לא צורפה לפרויקט. לא מוצגת הדמיה חלופית.</div>';
   if(!found)return this.xpCabinFallback();
   const orientation=found.portrait?' xp-ux-cabin-portrait':'';
   return '<div class="xp-ux-cabin xp-ux-cabin-art'+orientation+'" dir="ltr"><img class="xp-ux-cabin-picture" data-cabin-art src="'+xpEsc(found.src)
     +'" alt="'+xpEsc(a.model+' '+a.year+', '+finish.label+' interior')+'" loading="eager">'
     +this.xpCabinHotspots()+'</div>';
 }
 xpCabinFallback(){
  const a=this.appearance();
  const finish=XP_INTERIORS.find(x=>x.id===a.interior)||XP_INTERIORS[0];
  const pictures=Array.isArray(this._config.vehicles)&&this._config.vehicles.length?this.vehicle()?.interior_images:this._config.interior_images;
  const selected=pictures&&typeof pictures==='object'?pictures[a.interior]:null;
  if(xpLocalArtworkPath(selected))return '<div class="xp-ux-cabin"><img src="'+xpEsc(selected)+'" loading="lazy" alt="'+xpEsc('פנים רכב '+a.model+' בצבע '+finish.label)+'" class="xp-ux-cabin-picture">'
    +'</div>';
  const seat=xpEsc(finish.hex),shade=xpEsc(finish.secondary);
  // Honest, colour-matched illustration, never an invented factory photograph.
  const seatShape=(x,y,w,h)=>'<g><rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" rx="24" fill="'+shade+'" stroke="#87a4b9" stroke-opacity=".48" stroke-width="2"/>'
   +'<rect x="'+(x+9)+'" y="'+(y+9)+'" width="'+(w-18)+'" height="'+(h-18)+'" rx="18" fill="'+seat+'" stroke="#a8b9bf" stroke-opacity=".35"/>'
   +'<path d="M'+(x+15)+' '+(y+h*.48)+'h'+(w-30)+'" stroke="'+shade+'" stroke-width="6" opacity=".48"/></g>';
  const seatHtml=seatShape(105,112,130,151)+seatShape(447,112,130,151)
    +seatShape(105,278,130,87)+seatShape(276,278,130,87)+seatShape(447,278,130,87);
  return '<div class="xp-ux-cabin xp-ux-cabin-art xp-ux-cabin-fallback" dir="ltr"><svg viewBox="0 0 680 390" role="img" aria-label="'+xpEsc('איור פנים רכב '+a.model+' — '+finish.label)+'">'
    +'<rect x="43" y="7" width="594" height="375" rx="87" fill="#0c1e30" stroke="#6c859c" stroke-width="4"/>'
    +'<path d="M91 55Q340 5 589 55L605 104H75Z" fill="#1b324a" stroke="#5c819c" stroke-width="3"/>'
    +'<rect x="294" y="78" width="92" height="39" rx="8" fill="#101620" stroke="#407197" stroke-width="2"/>'
    +'<circle cx="170" cy="87" r="31" fill="none" stroke="'+seat+'" stroke-width="10"/>'
    +'<path d="M151 77h38m-19 0v30" stroke="'+shade+'" stroke-width="4"/>'
    +'<rect x="288" y="122" width="104" height="153" rx="18" fill="#1c2c39" stroke="#5a778d"/>'
    +seatHtml+'</svg>'
    +this.xpSeatButtons()
    +'</div>';
 }
 xpTempControl(){
  const c=this.xpLive('climate','cabin_climate');
  if(!c)return '<p>בקרת המיזוג אינה זמינה כרגע.</p>';
  const attrs=c.state.attributes||{};
  const target=attrs.temperature===null||attrs.temperature===undefined||attrs.temperature===''?null:Number(attrs.temperature);
  const inside=attrs.current_temperature===null||attrs.current_temperature===undefined||attrs.current_temperature===''?null:Number(attrs.current_temperature);
  const insideText=inside!==null&&Number.isFinite(inside)?xpNum(inside,1)+'°C':this.num('cabin','°C',1);
  const known=target!==null&&Number.isFinite(target)&&target>=Number(attrs.min_temp??16)&&target<=Number(attrs.max_temp??32);
  const value=known?xpNum(target,1)+'°C':'—';
  return '<section class="xp-ux-climate-card xp-climate-temp-panel" aria-label="טמפרטורת תא הנוסעים">'
   +'<div class="xp-ux-climate-caption"><strong>טמפרטורה</strong></div>'
   +'<div class="xp-climate-thermometers"><div class="xp-climate-inside"><small>טמפרטורה נוכחית</small><b>'+xpEsc(insideText)+'</b></div>'
   +'<div class="xp-climate-target"><small>טמפרטורת יעד</small>'
   +'<div class="xp-ux-temp-line"><button type="button" data-xp-temp="-1" aria-label="הורד חצי מעלה" '+(known?'':'disabled')+'>−</button>'
   +'<b>'+value+'</b><button type="button" data-xp-temp="1" aria-label="העלה חצי מעלה" '+(known?'':'disabled')+'>+</button></div></div></div>'
   +'</section>';
 }
 xpFanControl(){
  const c=this.xpLive('number','fan_speed_control');
  if(!c)return '';
  const a=c.state.attributes||{},min=Number(a.min??1),max=Number(a.max??8),step=Number(a.step??1);
  const v=Number(c.state.state);
  if(!Number.isFinite(v)||!Number.isFinite(min)||!Number.isFinite(max)||step<=0)return '';
  // One segment per REAL HA fan step; never present a fictional 10-level
  // control when Xpengtk actually advertises 8.
  const count=Math.min(12,Math.max(1,Math.round((max-min)/step)+1));
  const bars=Array.from({length:count},(_,i)=>{
    const threshold=min+i*step;
    return '<i class="'+(v+0.001>=threshold?'xp-fan-bar-on':'')+'" aria-hidden="true"></i>';
  }).join('');
  return '<label class="xp-ux-range-row xp-climate-fan-panel">'
    +'<span>'+xpIcon('fan',24)+' <span>רמת מאוורר</span> <b dir="ltr">'+xpEsc(xpNum(v))+' / '+xpEsc(xpNum(max))+'</b></span>'
    +'<div class="xp-fan-bars" aria-hidden="true">'+bars+'</div>'
    +'<input type="range" min="'+min+'" max="'+max+'" step="'+step+'" value="'+v+'" data-xp-range="fan_speed_control" aria-label="מהירות מאוורר"></label>';
 }
 xpClimatePrimaryControls(){
  const climate=this.xpLive('climate','cabin_climate');
  if(!climate)return '';
  const running=climate.state.state!=='off';
  const a=climate.state.attributes||{}, modes=Array.isArray(a.hvac_modes)?a.hvac_modes:[];
  let auto='';
  if(modes.includes('auto')){
    const active=climate.state.state==='auto';
    auto='<button type="button" class="xp-climate-primary'+(active?' xp-ux-selected':'')
      +'" data-xp-hvac-mode="auto" aria-pressed="'+String(active)+'">'+xpIcon('auto',27)
      +'<b>AUTO</b><small>'+(active?'פעיל':'מצב אוטומטי')+'</small></button>';
  }else{
    const status=this.xpLive('binary_sensor','climate_auto');
    if(status&&['on','off'].includes(status.state.state)){
      const active=status.state.state==='on';
      auto='<span class="xp-climate-primary xp-ux-climate-readonly'+(active?' xp-ux-selected':'')
        +'" role="status" aria-label="מצב AUTO: '+(active?'פעיל':'כבוי')+'">'+xpIcon('auto',27)
        +'<b>AUTO</b><small>'+(active?'פעיל • חיווי בלבד':'כבוי • חיווי בלבד')+'</small></span>';
    }
  }
  return '<div class="xp-climate-primary-controls" role="group" aria-label="הפעלת מיזוג ומצב אוטומטי">'
   +'<button type="button" class="xp-climate-primary xp-climate-power'+(running?' xp-ux-selected':'')
   +'" data-xp-climate="'+(running?'off':'on')+'" aria-pressed="'+String(running)+'">'
   +xpIcon('power',32)+'<b>הפעלת מיזוג</b><small>'+(running?'פעיל':'כבוי')+'</small></button>'
   +auto+'</div>';
 }

 xpClimateFeatures(){
  // Secondary climate functions only. Main ON/OFF and AUTO are above temperature.
  const climate=this.xpLive('climate','cabin_climate');
  const defrost=this.xpLive('switch','defrost_switch');
  const schedule=this.xpLive('calendar','hvac_schedule_calendar')||
    this.xpLive('sensor','hvac_schedules');
  const tiles=[];
  if(climate){
    const a=climate.state.attributes||{};
    if(Array.isArray(a.swing_modes)&&a.swing_modes.length>1){
      const current=String(a.swing_mode||a.swing_modes[0]),n=a.swing_modes.indexOf(current);
      const next=a.swing_modes[(n+1)%a.swing_modes.length];
      tiles.push('<button type="button" class="xp-ux-climate-feature" data-xp-swing-mode="'+xpEsc(next)
        +'" title="'+xpEsc('החלף כיוון זרימת אוויר אל '+next)+'">'+xpIcon('refresh',25)
        +'<span>כיוון אוויר</span><small>'+xpEsc(current)+'</small></button>');
    }
  }
   const mirror=this.xpLive('binary_sensor','mirror_heating');
   if(mirror&&['on','off'].includes(mirror.state.state)){
     tiles.push('<span class="xp-ux-climate-feature xp-ux-climate-readonly" role="status">'+
       xpIcon('windscreen',25)+'<span>חימום מראות</span><small>'+
       (mirror.state.state==='on'?'פעיל • חיווי בלבד':'כבוי • חיווי בלבד')+'</small></span>');
   }
   if(defrost){
     const active=defrost.state.state==='on';
     tiles.push('<button type="button" class="xp-ux-climate-feature'
       +(active?' xp-ux-selected':'')+'" data-xp-switch="defrost_switch" aria-pressed="'
       +String(active)+'">'+xpIcon('windscreen',25)
       +'<span>הפשרת שמשה קדמית</span><small>'
       +(active?'פעיל':'כבוי')+'</small></button>');
   }
   if(schedule){
     tiles.push('<button type="button" class="xp-ux-climate-feature" data-xp-extra-page="schedule">'
       +xpIcon('clock',25)+'<span>תזמון מיזוג</span><small>הצג תזמונים קיימים</small></button>');
   }
   return tiles.length?'<div class="xp-ux-climate-features" role="group" aria-label="פונקציות מיזוג">'
     +tiles.join('')+'</div>':'';
 }

 xpSeatControls(){
  const slots=[
    ['driver','נהג','driver_seat_heat_select','driver_seat_ventilation_select'],
    ['passenger','נוסע','passenger_seat_heat_select','passenger_seat_ventilation_select'],
    ['rear_left','אחורי שמאל','left_rear_seat_heat_select','left_rear_seat_ventilation_select'],
    ['rear_right','אחורי ימין','right_rear_seat_heat_select','right_rear_seat_ventilation_select'],
    ['wheel','חימום הגה','steering_wheel_heat_select',null]
  ];
  const focus=this._xpSeatFocus;
  const controls=slots.filter(r=>!focus||r[0]===focus).map(([zone,title,heat,cool])=>{
    const rows=[['חימום',heat],['אוורור',cool]].filter(([,suffix])=>suffix&&this.xpLive('select',suffix));
    if(!rows.length)return '';
    return '<article class="xp-ux-seat"><h3>'+title+'</h3>'+rows.map(([label,suffix])=>{
      const ent=this.xpLive('select',suffix),current=ent.state.state;
      const choices=(Array.isArray(ent.state.attributes?.options)?ent.state.attributes.options:[]).filter(s=>typeof s==='string');
      // The passenger front heat Off command is not supported by the current integration.
      const options=choices.map(choice=>{
        const unsupported=title==='נוסע'&&suffix==='passenger_seat_heat_select'&&choice==='Off';
        const short=choice==='Off'?'כבוי':(/[1-3]/.exec(choice)?.[0]||choice);
        const active=choice===current?' xp-ux-selected':'';
        return '<button type="button" data-xp-select="'+xpEsc(suffix)+'" data-xp-option="'+xpEsc(choice)+'" class="'+active+'" '+(unsupported?'disabled title="כיבוי חימום נוסע אינו מאומת באינטגרציה"':'')+' aria-pressed="'+(choice===current)+'">'+xpEsc(short)+'</button>';
      }).join('');
      return '<div class="xp-ux-seat-line"><span>'+label+'</span><div class="xp-ux-seat-options">'+options+'</div></div>';
    }).join('')+'</article>';
  }).filter(Boolean).join('');
  return '<div class="xp-ux-seats-grid">'+(controls||'<p>לא נמצאו בקרות מושבים נתמכות לרכב זה.</p>')+'</div>';
 }
 xpPortPanel(){
   const status=this.xpLive('sensor','slow_charge_port')||this.xpLive('sensor','charge_port');
   const readable=this.xpActionState('port');
   const portValue=String(status?.state?.state??'').trim().toLowerCase();
   const msg=readable!==null?(readable==='open'?'דלתית פתוחה':'דלתית סגורה')
     :portValue==='connected'?(this.bool('plugged')===true?'כבל מחובר • אין לסגור את הדלתית':'דיווח Connected • חיבור הכבל אינו מאומת')
     :'מצב הדלתית אינו זמין';
   return '<div class="xp-ux-port-panel"><div class="xp-ux-port-state">'+xpIcon('plug',34)+
     '<div><strong>דלתית שקע הטעינה</strong><small>'+xpEsc(msg)+'</small></div></div>'+
     '<div class="xp-ux-port-actions">'+this.xpToggleButton('port')+'</div>'+
     '<p class="xp-ux-note">לחיצה אחת הופכת את מצב הדלתית על סמך חיווי Xpengtk. אין שחרור כבל.</p></div>';
 }
 xpAccessAllowed(){
   const opt=this.vehicle()?.enable_access_controls??this._config.enable_access_controls??false;
   return opt===true||opt==='true';
 }
 xpDoorsPanel(){
   const entry=this.xpLive('lock','door_lock');
   const doors=[['driver_door','דלת נהג'],['passenger_door','דלת נוסע'],['rear_left_door','אחורי שמאל'],['rear_right_door','אחורי ימין']];
   const status=doors.map(([key,label])=>{
     const e=this.xpLive('binary_sensor',key);if(!e)return '';
     return '<div class="xp-ux-access-state"><span>'+label+'</span><strong>'+
       (e.state.state==='on'?'פתוחה':e.state.state==='off'?'סגורה':xpEsc(e.state.state))+'</strong></div>';
   }).join('');
   return '<div class="xp-ux-access-panel"><div class="xp-ux-access-head">'+xpIcon('lock',36)+
     '<div><h3>נעילת רכב</h3><p>'+xpEsc(entry?.state?.state||'לא זמין')+'</p></div></div>'+
     '<div class="xp-ux-access-states">'+status+'</div><div class="xp-ux-access-buttons">'+
     this.xpToggleButton('doors')+'</div>'+
     '<p class="xp-ux-note">נעילה ושחרור נעילה מתבצעים בלחיצה אחת, בהתאם למצב. שחרור מחייב הרשאת Access.</p></div>';
 }
 xpWindowsPanel(){
   const status=this.xpActionState('windows');
   return '<div class="xp-ux-access-panel"><div class="xp-ux-access-head">'+xpIcon('car',36)+
     '<div><h3>חלונות</h3><p>'+xpEsc(status===null?'מצב לא ידוע':status==='open'?'פתוחים':'סגורים')+'</p></div></div>'+
     '<div class="xp-ux-access-buttons">'+this.xpToggleButton('windows')+'</div>'+
     '<p class="xp-ux-note">פתיחת חלונות דורשת הרשאת Access. אין פקודה כאשר מצבם אינו ידוע.</p></div>';
 }
 xpTrunkPanel(){
   const state=this.xpActionState('trunk');
   const status=state==='open'?'פתוח':state==='closed'?'סגור':'לא ידוע';
   return '<div class="xp-ux-access-panel"><div class="xp-ux-access-head">'+xpIcon(state==='closed'?'trunk_open':state==='open'?'trunk_close':'trunk',36)+
     '<div><h3>תא המטען</h3><p>מצב נוכחי: '+xpEsc(status)+'</p></div></div>'+
     '<div class="xp-ux-access-buttons">'+this.xpToggleButton('trunk')+'</div>'+
     '<p class="xp-ux-note">פתיחת תא המטען מחייבת הרשאת Access. אם החיישן לא מדווח מצב ברור, לא תישלח פקודה.</p></div>';
 }
 xpMapPanel(){
   const location=this.xpLive('device_tracker','location');
   const horn=this.xpLive('button','honk_horn');
   const lights=this.xpLive('button','flash_lights');
   return '<div class="xp-ux-map-panel"><div class="xp-ux-map-stage" role="region" aria-label="מפת מיקום הרכב" data-xp-map-host>'
    +(location?'טוען מפה…':'מיקום הרכב אינו זמין')+'</div>'
    +'<div class="xp-ux-map-actions">'
    +'<button type="button" data-xp-map-action="honk_horn" '+(horn?'':'disabled')
    +'>'+xpIcon('horn',20)+' צופר</button>'
    +'<button type="button" data-xp-map-action="flash_lights" '+(lights?'':'disabled')
    +'>'+xpIcon('flash',20)+' הבהוב</button>'
    +'<button class="xp-map-native-details" type="button" data-xp-map-details '+(location?'':'disabled')+'>'
    +xpIcon('pin',18)+' פרטי מיקום ב־Home Assistant</button></div></div>';
 }

 xpFitModalContent(){
   const modal=this.shadowRoot?.querySelector?.('.xp-ux-modal');
   const area=modal?.querySelector?.('.xp-ux-modal-content');
   const inner=area?.querySelector?.('.xp-ux-modal-content-inner');
   if(!inner||!area)return;
   // Map and diagnostic list already fill via flex. Never resize their internals.
   if(this._xpPanel==='map'||(this._xpPanel==='extras'&&this._xpExtraSection==='diagnostics')){
     inner.style.zoom='';inner.style.width='';return;
   }
   // An in-page explanation must never force the physical cabin photo or
   // control buttons to shrink. These panels scroll at their own modal surface.
   const isNarrow=modal.getBoundingClientRect().width<850;
   if(isNarrow&&this._xpPanel&&!(this._xpPanel==='extras'&&this._xpExtraSection==='diagnostics')){
     inner.style.zoom='';inner.style.width='100%';inner.dataset.xpFitScale='1';
     return;
   }
   inner.style.zoom='1';inner.style.width='100%';
   const available=area.clientHeight,needed=inner.scrollHeight;
   if(!available||!needed||needed<=available+1){inner.dataset.xpFitScale='1';return;}
   const ratio=Math.max(.62,Math.min(1,(available-3)/needed));
   inner.style.zoom=String(ratio);
   inner.style.width='100%'; // Never expand modal contents horizontally when scaling for height.
   inner.dataset.xpFitScale=String(ratio);
 }
 xpWarmMapHelpers(){
   // Warm the native Home Assistant map helper code once, before first Location tap.
   // Do not attach a map or retrieve any new location coordinates in the background.
   if(typeof window==='undefined'||typeof window.loadCardHelpers!=='function')return Promise.resolve(null);
   if(!XP_MAP_HELPERS_PROMISE){
     XP_MAP_HELPERS_PROMISE=Promise.resolve().then(()=>window.loadCardHelpers()).catch(()=>{
       XP_MAP_HELPERS_PROMISE=null;return null;
     });
   }
   return XP_MAP_HELPERS_PROMISE;
 }

 xpMapDisplayHass(gps){
   const original=this._hass;
   const state=original?.states?.[gps.id]||gps.state;
   if(!original||!state)return original;
   const attributes={...(state.attributes||{}),icon:'mdi:car-back'};
   delete attributes.entity_picture;
   const presented={...state,attributes};
   return {...original,states:{...original.states,[gps.id]:presented}};
 }
 xpCenterMapOnVehicle(map,gps){
   const attrs=gps?.state?.attributes||{};
   if(attrs.latitude==null||attrs.longitude==null)return;
   const lat=Number(attrs.latitude),lon=Number(attrs.longitude),zoom=16;
   if(!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180)return;
   if(typeof window==='undefined')return;
   const fit=()=>{
     if(this._xpPanel!=='map'||this._xpMapElement!==map)return false;
     const host=this.shadowRoot?.querySelector?.('[data-xp-map-host]');
     if(!host||!host.contains?.(map))return false;
     const surface=map.shadowRoot?.querySelector?.('ha-map')||map.querySelector?.('ha-map');
     const engine=surface?._map||surface?.map||map?._map;
     const region=surface||map;
     if((region.getBoundingClientRect?.().width||host.getBoundingClientRect?.().width||0)<20)return false;
     engine?.resize?.();engine?.invalidateSize?.({pan:false});
     if(typeof surface?.setView==='function'){surface.setView([lat,lon],zoom);return true;}
     if(typeof engine?.setView==='function'){engine.setView([lat,lon],zoom,{animate:false});return true;}
     if(typeof engine?.jumpTo==='function'){engine.jumpTo({center:[lon,lat],zoom});return true;}
     return !!surface;
   };
   let attempts=0;
   const attempt=()=>{
     if(this._xpPanel!=='map'||this._xpMapElement!==map)return;
     if(fit())return;
     if(++attempts<5&&typeof window.setTimeout==='function')
       window.setTimeout(attempt,[80,190,350,650,1000][attempts]);
   };
   if(typeof window.requestAnimationFrame==='function')
     window.requestAnimationFrame(()=>window.requestAnimationFrame(attempt));
   else attempt();
 }
 async xpMountMap(){
   if(this._xpPanel!=='map')return;
   const host=this.shadowRoot?.querySelector?.('[data-xp-map-host]');
   const gps=this.xpLive('device_tracker','location');
   if(!host||!gps)return;
   try{
     // Retain the actual HA map card instance and tiles across sensor updates.
     // Recreating Leaflet with innerHTML on each HA hass tick causes flashing.
     if(this._xpMapElement&&this._xpMapEntityId===gps.id){
       this._xpMapElement.hass=this.xpMapDisplayHass(gps);
       if(!host.contains?.(this._xpMapElement))host.replaceChildren(this._xpMapElement);
       return;
     }
     const helper=await this.xpWarmMapHelpers();
     if(!helper){host.textContent=xpLocalizeMarkup('המפה המובנית אינה זמינה בכרטיס זה כרגע.',this._hass);return;}
     if(this._xpPanel!=='map'||!this.shadowRoot?.contains?.(host)||
        this.xpLive('device_tracker','location')?.id!==gps.id)return;
     const map=helper.createCardElement({type:'map',entities:[{entity:gps.id,label_mode:'icon',focus:true}],
       default_zoom:16,auto_fit:true,fit_zones:false,hours_to_show:0,theme_mode:'dark',aspect_ratio:'4:3'});
     map.hass=this.xpMapDisplayHass(gps);
     this._xpMapElement=map;this._xpMapEntityId=gps.id;
     host.replaceChildren(map);
     this.xpCenterMapOnVehicle(map,gps);
   }catch(err){
     host.textContent=xpLocalizeMarkup('המפה אינה זמינה בתוך הכרטיס כרגע. אפשר לפתוח את פרטי המיקום דרך הכפתור למטה.',this._hass);
   }
 }
 xpModal(){
   if(!this._xpPanel||(!this.xpUiEnabled()&&!['maintenance','map'].includes(this._xpPanel)))return '';
   const page=this._xpPanel;
   if(!['climate','port','doors','windows','trunk','map','maintenance','charge_controls','charge_schedule','extras'].includes(page))return '';
   const labels={climate:'מיזוג אוויר',port:'שקע טעינה',doors:'דלתות',windows:'חלונות',charge_controls:'הגבלת טעינה',charge_schedule:'תזמון טעינה',maintenance:'תחזוקת הרכב',trunk:'תא מטען',map:'מיקום הרכב',extras:'אפשרויות נוספות'};
   let body='';
   if(page==='climate'){
     body='<div class="xp-climate-layout">'+
       '<section class="xp-ux-climate-bottom" aria-label="בקרת אקלים">'+
       this.xpTempControl()+this.xpClimatePrimaryControls()+this.xpFanControl()+
       this.xpClimateFeatures()+'</section>'+
       this.xpCabinView()+'</div>';
   }else if(page==='charge_controls')body='<div class="xp-ux-charging-panel">'+this.xpChargeLimitPanel()+'</div>';
   else if(page==='charge_schedule')body=this.xpChargeSchedulesPanel();
   else if(page==='maintenance')body=this.xpMaintenancePanel();
   else if(page==='port')body=this.xpPortPanel();
   else if(page==='doors')body=this.xpDoorsPanel();
   else if(page==='windows')body=this.xpWindowsPanel();
   else if(page==='trunk')body=this.xpTrunkPanel();
   else if(page==='map')body=this.xpMapPanel();
   else if(page==='extras')body=this.xpExtrasPanel();
   return '<section class="xp-ux-modal xp-ux-modal-'+page+(page==='charge_controls'||page==='charge_schedule'?' xp-charge-compact-modal':'')+'" role="dialog" aria-modal="true" aria-label="'+labels[page]+'" dir="rtl">'
    +'<header class="xp-ux-modal-head"><button type="button" data-xp-close aria-label="'+(this._xpNavStack?.length?'חזרה לחלון הקודם':'חזרה למסך הבית')+'">'+xpIcon('back',24)+'</button>'
    +'<h2>'+labels[page]+'</h2></header>'
    +'<div class="xp-ux-modal-content"><div class="xp-ux-modal-content-inner">'+this.xpModalGuide(page)+body+'</div></div>'+(this._xpNotice?'<p class="xp-ux-notice" role="status">'+xpEsc(this._xpNotice)+'</p>':'')
    +'</section>';
 }

 xpMaintenancePanel(){
   // Display only real mapped Home Assistant vehicle values.
   const maintenance=this.xpLive('sensor','maintenance');
   const odometer=this.xpLive('sensor','odometer');
   const identity=this.xpLive('sensor','vehicle_identity');
   const attrs=maintenance?.state?.attributes||{};
   const info=identity?.state?.attributes||{};
   const line=(label,value,unit='')=>{
     if(value===null||value===undefined||!String(value).trim()||XP_INVALID.has(String(value).toLowerCase()))return '';
     return '<div class="xp-maint-service-row"><span>'+xpEsc(label)+'</span><b dir="auto">'+xpEsc(value)+(unit?' <small>'+xpEsc(unit)+'</small>':'')+'</b></div>';
   };
   const service=line('הטיפול הבא',maintenance?.state?.state)
       +line('תאריך טיפול',attrs.next_date)
       +line('ימים נותרו',attrs.days_remaining)
       +line('קילומטרים נותרו',attrs.km_remaining,'km');
   const details=line('נסועה כוללת',odometer?.state?.state,odometer?.state?.attributes?.unit_of_measurement||'')
       +line('דגם',info.model_family||info.vehicle_type_name)
       +line('שנת דגם',info.model_year)
       +line('מספר שלדה מוסתר',info.vin_masked);
   return '<div class="xp-maintenance-page xp-tpms-only xp-maintenance-v4"><div class="xp-maintenance-split">'+
    '<section class="xp-maintenance-tires"><h3>לחץ אוויר בארבעת הצמיגים</h3>'+this.tireScreen(false)+
    '<p class="xp-ux-note xp-tire-source-note">נתוני הצמיגים מתקבלים מ־Home Assistant, והיחידות נקבעות בהגדרות הכרטיס.</p></section>'+
    '<section class="xp-maintenance-service" aria-label="נתוני טיפול אמיתיים">'+
     '<h3>תחזוקת הרכב</h3><div class="xp-maint-service-group"><h4>הטיפול הבא</h4>'+
       (service||'<p class="xp-ux-note">אין כרגע נתוני טיפול זמינים באינטגרציה.</p>')+'</div>'+
     '<div class="xp-maint-service-group"><h4>פרטי הרכב</h4>'+
       (details||'<p class="xp-ux-note">נתוני הרכב אינם זמינים כרגע.</p>')+'</div>'+
    '</section></div></div>';
 }

 xpChargeLimitPanel(){
   // A focused slider, not an unrelated port/stop-charging page. Write only
   // when the real Xpengtk number entity exists with numeric current state.
   const entity=this.xpLive('number','charge_limit_control');
   const current=Number(entity?.state?.state);
   if(!entity||!Number.isFinite(current))
     return '<p class="xp-ux-note" role="status">הגבלת הטעינה אינה זמינה כעת באינטגרציה.</p>';
   const attrs=entity.state.attributes||{};
   const min=Number.isFinite(Number(attrs.min))?Number(attrs.min):50;
   const max=Number.isFinite(Number(attrs.max))?Number(attrs.max):100;
   const step=Number.isFinite(Number(attrs.step))&&Number(attrs.step)>0?Number(attrs.step):5;
   return '<label class="xp-ux-charge-limit xp-charge-compact-limit"><span>הגבלת טעינה <b>'+
     xpEsc(xpNum(current))+'%</b></span><input type="range" data-xp-range="charge_limit_control" min="'+
     min+'" max="'+max+'" step="'+step+'" value="'+current+'" aria-label="הגבלת טעינה">'+
     '</label><p class="xp-ux-note">השינוי נשלח ל־Home Assistant רק אחרי בחירת ערך בסרגל. יש לוודא שהרכב קיבל אותו.</p>';
 }
 xpChargeSchedulesPanel(){
   const start=this.xpLive('sensor','charge_schedule_start');
   const end=this.xpLive('sensor','charge_schedule_end');
   const row=(label,v)=>'<div class="xp-extra-line"><span>'+label+'</span><b>'+xpEsc(v)+'</b></div>';
   return '<div class="xp-ux-charge-schedule">'+
     row('שעת התחלת טעינה',start?.state?.state||'—')+
     row('שעת סיום טעינה',end?.state?.state||'—')+
     '<p class="xp-ux-note">Xpengtk מספקת חיישני תזמון טעינה לקריאה בלבד. אין כרגע פקודת שינוי תזמון טעינה מאומתת.</p></div>';
 }

 xpExtraLive(domain,suffix){return this.xpLive(domain,suffix);}
 xpExtraValue(domain,suffix){
   const e=this.xpExtraLive(domain,suffix);
   return e?xpEsc(e.state.state):'—';
 }
 xpExtraLine(label,domain,suffix,unit=''){
   const e=this.xpExtraLive(domain,suffix);
   if(!e)return '';
   const u=unit||e.state.attributes?.unit_of_measurement||'';
   return '<div class="xp-extra-line"><span>'+xpEsc(label)+'</span><b>'
     +xpEsc(e.state.state)+(u?' <small>'+xpEsc(u)+'</small>':'')+'</b></div>';
 }
 xpExtraNumber(label,suffix){
   const e=this.xpExtraLive('number',suffix);
   if(!e)return '';
   const attrs=e.state.attributes||{},now=Number(e.state.state);
   const min=Number(attrs.min),max=Number(attrs.max),step=Number(attrs.step);
   if(!Number.isFinite(now)||!Number.isFinite(min)||!Number.isFinite(max)||!Number.isFinite(step)||step<=0)return '';
   return '<label class="xp-extra-range"><span>'+xpEsc(label)+' <b>'+xpEsc(now)
     +'</b></span><input type="range" data-xp-range="'+xpEsc(suffix)
     +'" min="'+min+'" max="'+max+'" step="'+step+'" value="'+now
     +'" aria-label="'+xpEsc(label)+'"></label>';
 }
 xpExtraAction(label,action,domain,suffix,restricted=false){
   const e=this.xpExtraLive(domain,suffix);
   if(!e)return '';
   const disabled=restricted&&!this.xpAccessAllowed();
   return '<button type="button" class="xp-extra-action" data-xp-extra-action="'+xpEsc(action)+'" '
     +(disabled?'disabled title="פעולה זו דורשת הרשאת Access באינטגרציה ובהגדרות הכרטיס"':'')
     +'>'+xpEsc(label)+'</button>';
 }
 xpExtraSectionContent(section){
   if(section==='diagnostics')return this.xpSensorDiagnosticsPanel();
   if(section==='security'){
     const guard=this.xpExtraLive('switch','sentinel_switch');
     let out=this.xpExtraLine('X-Guard','switch','sentinel_switch');
     if(guard?.state.state==='off')out+=this.xpExtraAction('הפעל X-Guard','guard_on','switch','sentinel_switch');
     else if(guard?.state.state==='on')out+=this.xpExtraAction('כבה X-Guard','guard_off','switch','sentinel_switch',true);
     out+=this.xpExtraNumber('רגישות השמירה','sentinel_sensitivity_control');
     return out||'<p>לא נמצאו ישויות אבטחה זמינות לרכב זה.</p>';
   }
   if(section==='energy'){
     const lines=[
       ['צריכה ממוצעת ב־7 ימים','energy_consumption_7_day_avg'],
       ['צריכת אנרגיה בחניה','parked_consumption'],
       ['אנרגיה בטעינה האחרונה','last_charge_energy'],
       ['משך הטעינה האחרונה','last_charge_duration'],
       ['טווח שנוסף בטעינה','last_charge_range_added'],
       ['נסועה כוללת','odometer']
     ].map(([title,key])=>this.xpExtraLine(title,'sensor',key)).join('');
     return lines||'<p>אין כרגע נתוני אנרגיה זמינים.</p>';
   }
   if(section==='schedule'){
     const schedule=this.xpExtraLive('sensor','hvac_schedules');
     const calendar=this.xpExtraLive('calendar','hvac_schedule_calendar');
     let out=schedule?this.xpExtraLine('תזמונים מוגדרים','sensor','hvac_schedules'):'';
     const items=schedule?.state.attributes?.schedules;
     if(Array.isArray(items)){
       out+=items.slice(0,8).map(x=>{
         if(!x||typeof x!=='object')return '';
         const time=x.start_time||'—',days=Array.isArray(x.days)?x.days.join(', '):'';
         const id=x.appointment_id==null?'':String(x.appointment_id);
         const control=id?this.xpLive('switch','hvac_schedule_'+id):null;
         const active=control?.state.state==='on';
         const available=control&&['on','off'].includes(control.state.state);
         return '<div class="xp-extra-schedule-line"><div class="xp-extra-line"><span>'
           +xpEsc(days||'תזמון מיזוג')+'</span><b>'+xpEsc(time)+'</b></div>'
           +(available?'<button type="button" class="xp-extra-schedule-toggle" data-xp-hvac-schedule="'
             +xpEsc(id)+'" aria-label="'+(active?'השבת תזמון':'הפעל תזמון')+'">'
             +(active?'פעיל · השבת':'כבוי · הפעל')+'</button>':'')
           +'</div>';
       }).join('');
     }
     if(calendar)out+='<button type="button" class="xp-extra-action" data-xp-extra-detail="calendar">הצג לוח תזמוני מיזוג</button>';
     return out||'<p>אין לוח תזמוני מיזוג זמין באינטגרציה. לא ניצור תזמון מדומה.</p>';
   }
   if(section==='power'){
     const power=this.xpExtraLive('switch','trunk_power_switch');
     let out=this.xpExtraLine('שקע חשמל בתא המטען','switch','trunk_power_switch');
     if(power?.state.state==='off')out+=this.xpExtraAction('הפעל שקע V2L','v2l_on','switch','trunk_power_switch');
     else if(power?.state.state==='on')out+=this.xpExtraAction('כבה שקע V2L','v2l_off','switch','trunk_power_switch');
     out+=this.xpExtraNumber('טיימר לכיבוי אוטומטי (דקות)','trunk_power_timer_control');
     return out||'<p>בקרות V2L אינן זמינות בדגם או בהרשאות האינטגרציה.</p>';
   }
   if(section==='maintenance'){
     const maintenance=this.xpExtraLive('sensor','maintenance');
     let out=this.xpExtraLine('הטיפול הבא','sensor','maintenance');
     if(maintenance){
       const attrs=maintenance.state.attributes||{};
       for(const [field,label] of [['next_date','תאריך טיפול'],['days_remaining','ימים נותרו'],
         ['km_remaining','קילומטרים נותרו']]){
         const v=attrs[field];
         if(v!==null&&v!==undefined&&v!=='')out+='<div class="xp-extra-line"><span>'+label+'</span><b>'+xpEsc(v)+'</b></div>';
       }
       out+='<button type="button" class="xp-extra-action" data-xp-extra-detail="maintenance">פרטי תחזוקה ב־Home Assistant</button>';
     }
     return this.xpMaintenancePanel();
   }
   if(section==='updates'){
     const version=this.xpExtraLive('sensor','xos_version');
     const status=this.xpExtraLive('sensor','ota_upgrade');
     const auto=this.xpExtraLive('switch','auto_upgrade_switch');
     let out='<div class="xp-ota-summary">';
     if(version)out+=this.xpExtraLine('גרסת XOS','sensor','xos_version');
     if(status)out+=this.xpExtraLine('סטטוס תוכנה','sensor','ota_upgrade');
     out+='</div><div class="xp-ota-actions">';
     if(auto&&['on','off'].includes(auto.state.state))
       out+=this.xpExtraAction(auto.state.state==='on'?'כבה עדכונים אוטומטיים':'הפעל עדכונים אוטומטיים',
         auto.state.state==='on'?'ota_off':'ota_on','switch','auto_upgrade_switch');
     // No confirmed API command exists to check for updates on demand.
     out+='<span class="xp-ota-status" role="status">סטטוס העדכון מוצג למעלה</span></div>';
     return out;
   }
   return '';
 }
 xpSensorDiagnosticsPanel(){
  const states=this._hass?.states||{};
  // Registry rows are already restricted to exactly one selected XPENG device.
  // When HA denies registry access, use the explicitly configured prefix or an
  // unambiguous single-car prefix. Never list another car as part of this one.
  const registry=Array.isArray(this._xpengEntities)?this._xpengEntities:[];
  const ids=registry.length?registry.map(x=>x.entity_id).filter(Boolean)
    :Object.keys(states).filter(id=>/^(?:sensor|binary_sensor|button|number|select|switch|lock|climate|device_tracker|calendar|image)\./.test(id)
      &&this.xpPrefixes().some(prefix=>id.split('.')[1]?.startsWith(prefix+'_')));
  const entries=[...new Set(ids)].sort();
  if(!entries.length)return '<p>עדיין לא זוהו ישויות Xpengtk. בדוק חיבור, קידומת VIN והרשאות Entity Registry.</p>';
  const unknown=entries.filter(id=>!states[id]||['unavailable','unknown','none'].includes(String(states[id].state).toLowerCase())&& !id.startsWith('button.'));
  const ok=entries.length-unknown.length;
  const line=id=>{
   const entity=states[id],state=entity?.state;
   const status=!entity?'חסרה':id.startsWith('button.')&&state==='unknown'?'כפתור פעולה'
     :state==='unavailable'||state==='unknown'||state==='none'?'לא זמין':String(state??'חסרה');
   return '<div class="xp-extra-line xp-entity-diagnostic"><span dir="ltr" tabindex="0" title="'+xpEsc(id)+'" aria-label="'+xpEsc(id)+'">'+xpEsc(id)+'</span><b>'+
     xpEsc(status)+'</b></div>';
  };
  return '<div class="xp-entity-diagnostics"><p role="status">נמצאו '+entries.length+
    ' ישויות משויכות לרכב • '+ok+' זמינות או פעולות • '+unknown.length+' לא זמינות</p>'+
    '<div class="xp-diagnostics-scroll" role="region" aria-label="רשימת ישויות Xpengtk">'+
    entries.map(line).join('')+'</div>'+
    '<p class="xp-ux-note">חיישן unavailable אינו ניתן לתיקון באמצעות ציור הכרטיס. בדוק את מקור הנתון באינטגרציה. כפתורי פעולה מסוג button אינם מדווחים מצב רגיל.</p></div>';
 }

 // Guide copy is intentionally separate from sensor mappings and service
 // actions. Values are read from real HA entities, never invented.
 xpGuideNumber(suffix,unit=''){
   const entity=this.xpExtraLive('number',suffix);
   const raw=entity?.state?.state;
   if(!entity||!Number.isFinite(Number(raw)))return 'Current value: Unavailable. Range: Not provided by the integration.';
   const attributes=entity.state.attributes||{};
   const min=attributes.min===null||attributes.min===undefined?null:Number(attributes.min);
   const max=attributes.max===null||attributes.max===undefined?null:Number(attributes.max);
   const format=value=>xpEsc(xpNum(value))+(unit?' '+xpEsc(unit):'');
   return 'Current: '+format(Number(raw))+
     ' · Minimum: '+(Number.isFinite(min)?format(min):'Not provided')+
     ' · Maximum: '+(Number.isFinite(max)?format(max):'Not provided');
 }
 xpGuidePanel(title,description,specification='',note=''){
   const copy='<strong>'+xpEsc(title)+'</strong><p>'+xpEsc(description)+'</p>';
   const spec=specification?'<div class="xp-help-spec">'+specification+'</div>':'';
   const detail=note?'<small>'+xpEsc(note)+'</small>':'';
   return '<aside class="xp-help-intro" aria-label="Function explanation">'+copy+spec+detail+'</aside>';
 }
 xpExtraSectionGuide(section){
   const s={
     security:['What is X-Guard?','X-Guard is the vehicle security monitoring mode. The switch enables or disables this function. Sensitivity is a separate setting: the minimum is the lowest supported setting and the maximum is the highest.','The exact events detected at each level are determined by XPENG firmware.'],
     schedule:['Climate schedules','Shows the climate schedules reported by the integration. You can enable or disable an individual schedule only if its corresponding Xpengtk switch is available.','Schedule count and time limits are not supplied as a numeric control range.'],
     energy:['Energy data','Shows reported energy consumption, parked consumption and the latest charging session. These values are read-only measurements, not selectable settings.','Measurements and their units depend on the available Xpengtk sensors.'],
     power:['Vehicle-to-load (V2L)','Controls the existing tailgate power outlet if Xpengtk exposes a switch. The timer sets when that outlet turns off automatically; it does not change the outlet power rating.','Use the car manufacturer’s safety instructions for connected appliances.'],
     maintenance:['Maintenance information','Shows service data reported by the vehicle. Odometer and dates are informational values; there is no editable minimum or maximum.','Service intervals come from the integration and vehicle, not from this card.'],
     updates:['Software updates','Shows the installed XOS version and update status. Automatic updating can be toggled only when the Xpengtk switch exists.','Software version numbers and update status are not numeric ranges.'],
     diagnostics:['Entity diagnostics','Lists the entities mapped to this car and their current Home Assistant states, including unknown and unavailable sensors.','Read-only diagnostic information; no minimum or maximum applies.']
   }[section];
   if(!s)return '';
   let spec='Read-only / State: See live entities';
   if(section==='security')spec=this.xpGuideNumber('sentinel_sensitivity_control');
   if(section==='power')spec='Auto-off timer: '+this.xpGuideNumber('trunk_power_timer_control','min');
   if(section==='schedule')spec='Individual schedules: Off / On when an entity is available';
   if(section==='updates')spec='Automatic updates: Off / On when an entity is available';
   if(section==='maintenance')spec='Service distance and time: values from the vehicle, not user-selectable limits';
   return this.xpGuidePanel(s[0],s[1],xpEsc(spec),s[2]);
 }
 xpModalGuide(page){
   const guide={
     climate:['Climate controls','Climate power, AUTO, target temperature and fan settings operate only with mapped Home Assistant entities. Seat and steering-wheel controls cycle the supported levels directly on the cabin image.','Fan and temperature limits depend on the available entities.'],
     charge_controls:['Charge limit','Sets the target maximum battery percentage for charging. A lower limit stops at a lower target SOC; a higher limit allows a higher target SOC.','Changes are sent to Home Assistant and should be confirmed in the vehicle.'],
     charge_schedule:['Charging schedule','Displays the charging start and end times published by Xpengtk. This page does not invent an unsupported schedule editing action.','Read-only start and end times; no editable numeric limits.'],
     maintenance:['Tire pressure and vehicle maintenance','Four live TPMS values appear around the original vehicle image. The next-service, odometer and vehicle details are displayed only when their Home Assistant entities report them.','Tire pressure units come from card settings; no universal minimum or maximum is assumed. Service dates and mileage are never invented.'],
     port:['Charge port','Opens or closes the charge port when the vehicle reports a known state and the corresponding command exists.','Do not close the port while a cable is connected.'],
     doors:['Door locks','The action changes with the live state: Unlock when locked and Lock when unlocked. If the state is unknown, the action is unavailable.','Access permission may be required for unlocking.'],
     windows:['Windows','Shows the currently available open/close action for the vehicle windows. The command depends on a known sensor state.','No intermediate opening percentage is assumed unless the integration exposes one.'],
     trunk:['Tailgate','Opens or closes the trunk according to the reported state and available command.','Keep people and objects clear of the moving tailgate.'],
     map:['Vehicle location','Displays the position reported by the configured vehicle tracker using the native Home Assistant map.','Horn and flash actions appear only when their matching entities are supported.']
   }[page];
   if(!guide)return '';
   let spec='';
   if(page==='charge_controls')spec=this.xpGuideNumber('charge_limit_control','%');
   if(page==='climate'){
     const entity=this.xpLive('climate','cabin_climate');
     const attrs=entity?.state?.attributes||{};
     const lo=attrs.min_temp===undefined?'Not provided':xpNum(attrs.min_temp);
     const hi=attrs.max_temp===undefined?'Not provided':xpNum(attrs.max_temp);
     spec='Temperature: Min '+lo+' °C · Max '+hi+' °C (integration values)';
   }
   if(['doors','windows','trunk','port'].includes(page))spec='State: Open / Closed; actions require real sensor feedback';
   if(page==='maintenance')spec='TPMS: '+['tire_fl','tire_fr','tire_rl','tire_rr'].filter(k=>this.tirePressureBar(k)!==null).length+'/4 live readings';
   if(page==='charge_schedule')spec='Editable range: None (read-only entities)';
   return this.xpGuidePanel(guide[0],guide[1],xpEsc(spec),guide[2]);
 }
 xpExtrasPanel(){
   const sections=[
     ['security','shield','X-Guard','אבטחה ורגישות השמירה'],
     ['schedule','clock','תזמון מיזוג','תזמונים קיימים'],
     ['energy','gauge','נתוני אנרגיה','צריכה והיסטוריית טעינה'],
     ['power','plug','V2L','חשמל בתא המטען'],
     ['maintenance','settings','תחזוקה','הטיפול הבא'],
     ['updates','refresh','עדכוני תוכנה','XOS ו־OTA'],
     ['diagnostics','info','אבחון ישויות','חיישנים, מצב ומזהי Xpengtk']
   ];
   const section=sections.find(x=>x[0]===this._xpExtraSection);
   if(section){
     return '<div class="xp-extra-body'+(section[0]==='diagnostics'?' xp-extra-diagnostics-layout':'')+'"><div class="xp-extra-heading"><strong>'+xpEsc(section[2])+'</strong></div>'
       +'<div class="xp-extra-details">'+(section[0]==='updates'?'':this.xpExtraSectionGuide(section[0]))+this.xpExtraSectionContent(section[0])+'</div>'
       +(['diagnostics','updates'].includes(section[0])?'':'<p class="xp-ux-note">המידע מגיע מ־Xpengtk. הפקודות פועלות לפי הרשאות Home Assistant והרכב בלבד.</p>')+'</div>';
   }
   return '<div class="xp-extra-body"><p class="xp-extra-subtitle">אפשרויות נוספות לרכב — שבעת קיצורי הדרך נשארים במסך הבית בלבד.</p>'
     +'<div class="xp-extra-grid">'+sections.map(([id,icon,title,detail])=>
       '<button type="button" class="xp-extra-tile" data-xp-extra-page="'+id+'">'
       +xpIcon(icon,30)+'<b>'+title+'</b><small>'+detail+'</small></button>').join('')
     +'</div></div>';
 }

 xpVehiclePanel(){
   // Display status only if Xpengtk provides the associated entity.
   const statuses=[
     ['lock','door_lock','נעילת דלתות'],
     ['binary_sensor','windows','חלונות'],
     ['binary_sensor','doors','דלתות'],
     ['binary_sensor','trunk','תא מטען'],
     ['sensor','charge_port','שקע טעינה'],
     ['binary_sensor','sentinel_mode','מצב X-Guard']
   ].map(([domain,suffix,label])=>{
     const e=this.xpLive(domain,suffix);
     if(!e)return '';
     const raw=e.state.state, state=domain==='lock'
       ?({locked:'נעול',unlocked:'לא נעול',locking:'נועל',unlocking:'פותח'}[raw]||raw)
       :domain==='binary_sensor'?({on:'פעיל / פתוח',off:'כבוי / סגור'}[raw]||raw):raw;
     return '<article class="xp-ux-vehicle-state"><small>'+label+'</small><strong>'+xpEsc(state)+'</strong></article>';
   }).filter(Boolean).join('');
   // Safe / securing controls only; Access (unlock, open doors,
   // open trunk, open windows, disarm security) is deliberately not here.
   const buttons=[
      ['lock','lock','door_lock','נעילת דלתות','lock'],
      ['button','press','close_windows','סגירת חלונות','car'],
      ['button','press','close_trunk','סגירת תא מטען','car'],
      ['button','press','flash_lights','הבהוב אורות','sun'],
      ['button','press','honk_horn','צפירה','info']
   ].filter(([domain,service,suffix])=>!!this.xpLive(domain,suffix));
   const xGuard=this.xpLive('switch','sentinel_switch');
   if(xGuard?.state?.state==='off')buttons.push(['switch','turn_on','sentinel_switch','הפעלת X-Guard','shield']);
   const actionHtml=buttons.map(([domain,service,suffix,label,icon])=>
     '<button type="button" data-xp-vehicle="'+xpEsc(domain+'.'+service+'.'+suffix)+'">'
       +xpIcon(icon,18)+'<span>'+label+'</span></button>').join('');
   return '<div class="xp-ux-vehicle-panel">'
     +(statuses?'<div class="xp-ux-vehicle-statuses">'+statuses+'</div>':'')
     +(actionHtml?'<h3>פעולות זמינות</h3><div class="xp-ux-vehicle-buttons">'+actionHtml+'</div>':'<p>אין כרגע פקודות זמינות באינטגרציה.</p>')
     +'<p class="xp-ux-note">לא מוצגות פקודות פתיחת נעילה, פתיחת חלונות או תא מטען. פעולות רגישות דורשות אישור ויעברו דרך הרשאות Xpengtk.</p>'
     +'</div>';
 }
 xpChargeControls(){
  if(!this.xpUiEnabled())return '';
  const stop=this.xpLive('button','stop_charge');
  const limit=this.xpLive('number','charge_limit_control');
  const controls=[];
  if(stop)controls.push('<button class="xp-ux-charge-stop" type="button" data-xp-command="stop_charge">'+xpIcon('plug',19)+' הפסק טעינה</button>');
  if(limit){
    const n=Number(limit.state.state),a=limit.state.attributes||{};
    if(Number.isFinite(n))controls.push('<label class="xp-ux-charge-limit"><span>הגבלת טעינה <b>'+xpEsc(xpNum(n))+'%</b></span>'
      +'<input type="range" data-xp-range="charge_limit_control" min="'+Number(a.min??50)+'" max="'+Number(a.max??100)+'" step="'+Number(a.step??5)+'" value="'+n+'" aria-label="הגבלת טעינה"></label>');
  }
  return controls.length?'<div class="xp-ux-charge-actions" dir="rtl">'+controls.join('')+'</div>':'';
 }
 xpDetails(suffix,domain){
  const entity=this.xpLive(domain,suffix);
  if(!entity)return;
  this.dispatchEvent(new CustomEvent('hass-more-info',{detail:{entityId:entity.id},bubbles:true,composed:true}));
 }
 async xpMapDirectAction(suffix){
   if(!['honk_horn','flash_lights'].includes(suffix))return false;
   if(!this._xpMapPending)this._xpMapPending=new Set();
   if(this._xpMapPending.has(suffix))return false;
   if(!this.xpLive('button',suffix)||!this._hass?.callService)return false;
   this._xpMapPending.add(suffix);
   const b=this.shadowRoot?.querySelector?.('[data-xp-map-action="'+suffix+'"]');
   if(b){b.disabled=true;b.setAttribute('aria-busy','true');}
   try{return await this.xpSend('button','press',suffix,undefined,true);}
   finally{
     this._xpMapPending.delete(suffix);
     const current=this.shadowRoot?.querySelector?.('[data-xp-map-action="'+suffix+'"]');
     if(current){current.disabled=!this.xpLive('button',suffix);current.removeAttribute('aria-busy');}
   }
 }
 async xpSend(domain,service,suffix,value,verifiedDirectTap=false){
  const entity=this.xpLive(domain,suffix);
  if(!entity||typeof this._hass?.callService!=='function')return false;
  const data={entity_id:entity.id};
  if(service==='set_value')data.value=value;
  else if(service==='set_temperature')data.temperature=value;
  else if(service==='select_option')data.option=value;
  else if(service==='set_hvac_mode')data.hvac_mode=value;
  else if(service==='set_swing_mode')data.swing_mode=value;
  const sensitive=(domain==='lock'||suffix==='stop_charge'||suffix==='open_trunk'||suffix==='open_charge_port'||suffix==='close_charge_port'||suffix==='close_trunk'||suffix==='close_windows'||suffix==='open_windows'||suffix==='honk_horn'||suffix==='flash_lights'||suffix==='sentinel_switch'||suffix.startsWith('hvac_schedule_'));
  // One-tap means one click for verified status-driven lock/windows/flap actions.
  // Never bypass confirmation for arbitrary callers or other sensitive operations.
  const directAllowed=verifiedDirectTap&&(
    (domain==='lock'&&suffix==='door_lock'&&['lock','unlock'].includes(service))||
    (domain==='button'&&service==='press'&&
      ['open_windows','close_windows','open_charge_port','close_charge_port','open_trunk','close_trunk','honk_horn','flash_lights'].includes(suffix))
  );
  if((sensitive||['trunk_power_switch','auto_upgrade_switch','sentinel_sensitivity_control','trunk_power_timer_control'].includes(suffix))
     &&!directAllowed&&typeof window.confirm==='function'
     &&!window.confirm(xpLocalizeMarkup('לשלוח את הפקודה לרכב?',this._hass)))return false;
  let succeeded=false;
  try{
    await this._hass.callService(domain,service,data);
    succeeded=true;
    this._xpNotice=''; // Normal success is silent; live sensor state is confirmation.
  }catch(err){
    this._xpNotice='שגיאה בשליחת הפקודה: '+(err?.message||'נסה שוב');
  }
  this.render();
  return succeeded;
 }
 xpDoTemperature(direction){
  const c=this.xpLive('climate','cabin_climate');
  if(!c)return;
  const a=c.state.attributes||{};
  if(a.temperature===null||a.temperature===undefined||a.temperature==='')return;
  const now=Number(a.temperature),step=Number(a.target_temp_step)||.5;
  if(!Number.isFinite(now)||now<Number(a.min_temp??16)||now>Number(a.max_temp??32))return;
  const target=Math.round(Math.max(Number(a.min_temp??16),Math.min(Number(a.max_temp??32),now+direction*step))*10)/10;
  if(target!==now)this.xpSend('climate','set_temperature','cabin_climate',target);
 }

 // Explicit navigation stack: a modal opened from Climate, Extras or another
 // subpage returns to that exact source view, never directly to Home.
 xpNavigatePanel(panel,extraSection=null){
   const available=['climate','port','doors','windows','trunk','map','maintenance','charge_controls','charge_schedule','extras'];
   if(!available.includes(panel))return;
   const currentPanel=this._xpPanel||null,currentSection=this._xpExtraSection||null;
   if(panel===currentPanel&&(panel!=='extras'||extraSection===currentSection))return;
   if(currentPanel){
     const scrollTop=this.shadowRoot?.querySelector?.('.xp-ux-modal')?.scrollTop||0;
     this._xpNavStack.push({panel:currentPanel,extraSection:currentSection,seatFocus:this._xpSeatFocus||null,scrollTop});
   }else this._xpNavStack=[];
   this._xpPanel=panel;this._xpExtraSection=panel==='extras'?extraSection:null;
   this._xpSeatFocus=null;this._xpNotice='';
   this.render();
 }
 xpBackPanel(){
   const previous=this._xpNavStack?.pop();
   if(previous){
     this._xpPanel=previous.panel;
     this._xpExtraSection=previous.extraSection;
     this._xpSeatFocus=previous.seatFocus;
   }else{
     this._xpPanel=null;this._xpExtraSection=null;this._xpSeatFocus=null;
     this._xpNavStack=[];
   }
   this._xpNotice='';
   this.render();
   if(previous){
     const modal=this.shadowRoot?.querySelector?.('.xp-ux-modal');
     if(modal)modal.scrollTop=previous.scrollTop||0;
   }
 }
 xpBackToHome(){
   this._xpPanel=null;this._xpExtraSection=null;this._xpSeatFocus=null;this._xpNavStack=[];
   this._xpManualCharging=false;this._xpChargingDismissed=this.xpChargingActive();
   this._xpNotice='';this.render();
 }
 connectedCallback(){if(this._hass)this.xpWarmMapHelpers();
  if(typeof ResizeObserver!=='undefined'&&!this._xpFitResizeObserver){
   this._xpFitResizeObserver=new ResizeObserver(()=>this.xpFitModalContent());
  }if(!this._fullscreenHandler){this._fullscreenHandler=()=>{if(!document.fullscreenElement&&this._expanded){this._expanded=false;this.render();}};}document.addEventListener('fullscreenchange',this._fullscreenHandler);}
 disconnectedCallback(){this._xpFitResizeObserver?.disconnect();this._xpFitResizeObserver=null;this._xpObservedCard=null;if(this._fullscreenHandler)document.removeEventListener('fullscreenchange',this._fullscreenHandler);}
 toggleFullScreen(){this._expanded=!this._expanded;if(this._expanded&&this.requestFullscreen){this.requestFullscreen().catch(()=>{});}else if(!this._expanded&&document.fullscreenElement===this){document.exitFullscreen().catch(()=>{});}this.render();}
 setConfig(config){
  if(!config||typeof config!=='object')throw Error('XPENG card configuration required');
  if(config.prefix&&!/^[a-z0-9_]+$/.test(config.prefix))throw Error('XPENG prefix must be a slug');
  if(config.image_path&&!/^\/(?:local|hacsfiles)\/[a-zA-Z0-9/_-]+\/?$/.test(config.image_path))throw Error('Invalid local image_path');
  if(config.background_image&&!xpLocalArtworkPath(config.background_image))throw Error('Invalid local background_image');
  const v={prefix:'my_xpeng',year:'2026',model:'G6',trim:'core_plus_rwd',color:'graphite_gray',interior:'dark_gray',theme:'dark',...config};
  const next=xpNormalizeAppearance(v);
  const oldVehicle=JSON.stringify([this._config.prefix,this._config.model,this._config.year,
    (this._config.vehicles||[]).map(x=>[x.prefix,x.model,x.year])]);
  const nextVehicle=JSON.stringify([next.prefix,next.model,next.year,
    (next.vehicles||[]).map(x=>[x.prefix,x.model,x.year])]);
  // Editor-only changes (interior colour, image, appearance) must not collapse a
  // nested HVAC page. Switching to a different vehicle resets the navigation.
  if(oldVehicle!==nextVehicle){
    this._xpPanel=null;this._xpExtraSection=null;this._xpNavStack=[];this._xpSeatFocus=null;
  }
  if(oldVehicle!==nextVehicle)this._xpTogglePending=Object.create(null);
  this._config=next;this._infoOpen=false;this._tireOpen=false;this._xpManualCharging=false;this._xpChargingDismissed=false;this._xpLastActualCharging=false;this.render();
 }
 set hass(hass){
  const oldCharging=this.xpChargingActive();
  const oldMapGps=this._xpPanel==='map'?this.xpLive('device_tracker','location')?.id:null;
  this._hass=hass;
  this.xpWarmMapHelpers();
  if(!this._xpengRegistryLoaded)this.ensureXpengRegistry();
  const actualCharging=this.xpChargingActive();
  if(actualCharging&&!this._xpLastActualCharging){
    this._xpChargingDismissed=false;this._xpManualCharging=false;
    this._xpPanel=null;this._xpSeatFocus=null;this._xpExtraSection=null;this._xpNavStack=[];
  }
  if(!actualCharging){
    this._xpChargingDismissed=false;
    // A completed/disconnected charge returns to the regular dashboard,
    // even if the user was viewing a small charging-only control overlay.
    if(['charge_controls','charge_schedule'].includes(this._xpPanel)){
      this._xpPanel=null;this._xpExtraSection=null;this._xpNavStack=[];this._xpNotice='';
    }
  }
  this._xpLastActualCharging=actualCharging;
  if(actualCharging&&!this._xpChargingDismissed)this._tireOpen=false;
  if(this._xpPanel==='map'&&actualCharging===oldCharging&&
     oldMapGps===this.xpLive('device_tracker','location')?.id&&
     this.shadowRoot?.querySelector?.('[data-xp-map-host]')){
    // The map's viewport must not be destroyed by frequent HA sensor ticks.
    if(this._xpMapElement){
      const loc=this.xpLive('device_tracker','location');
      this._xpMapElement.hass=loc?this.xpMapDisplayHass(loc):hass;
    }
    for(const [suffix,action] of [['honk_horn','honk_horn'],['flash_lights','flash_lights']]){
      const button=this.shadowRoot.querySelector('[data-xp-map-action="'+action+'"]');
      if(button)button.disabled=!this.xpLive('button',suffix)||!!this._xpMapPending?.has(suffix);
    }
    return;
  }
  this.render();
 }
 get hass(){return this._hass;}
 getCardSize(){return 8;}
 getGridOptions(){return {columns:12,min_columns:12,rows:'auto'};}
 static getConfigElement(){return document.createElement('xpeng-vehicle-card-editor');}
 static getStubConfig(){return {type:'custom:xpeng-vehicle-card',prefix:'my_xpeng',model:'G6',year:'2026',trim:'core_plus_rwd',color:'graphite_gray',interior:'dark_gray'};}
 vehicles(){return Array.isArray(this._config.vehicles)&&this._config.vehicles.length?this._config.vehicles:[this._config];}
 vehicle(){return this.vehicles()[Math.min(this._vehicleIndex,this.vehicles().length-1)];}
 prefix(){return this.vehicle()?.prefix||this._config.prefix||'my_xpeng';}
 // Vehicle model, year, trim and both colours are MANUALLY selected in the card editor/YAML only.
 appearance(){return xpNormalizeAppearance({...this._config,...this.vehicle()});}
 model(){return this.appearance().model;}
 year(){return this.appearance().year;}
 paint(){return this.appearance().color;}
 data(key){
   const spec=XP_KEYS[key];if(!spec)return null;
   const override=xpSensorMappingMode(this._config,this.vehicle())==='manual'?(this.vehicle()?.entities?.[key]??this._config.entities?.[key]):null;
   const custom=override?xpParseEntityMapping(override):null;
   const ids=custom?[custom.id]:[
     ...(XP_UNIQUE_KEYS[key]||[]).map(([domain,suffix])=>this._xpengByKey?.[domain+'.'+suffix]).filter(Boolean),
     ...this.xpPrefixes().flatMap(prefix=>[
       ...spec.slice(1).map(s=>spec[0]+'.'+prefix+'_'+s),
       ...(XP_XPENGTK_KEYS[key]||[]).map(([domain,suffix])=>domain+'.'+prefix+'_'+suffix)
     ])
   ];
   const id=ids.find(x=>this._hass?.states?.[x]&&!XP_INVALID.has(String(this._hass.states[x].state).trim().toLowerCase()))
     ||ids.find(x=>this._hass?.states?.[x])||ids[0];
   const entity=this._hass?.states?.[id];
   const attribute=custom?.attribute;
   const attrs=entity?.attributes;
   const raw=attribute
     ?(attrs&&Object.prototype.hasOwnProperty.call(attrs,attribute)?attrs[attribute]:null)
     :(entity?.state??null);
   const valid=raw!==null&&raw!==undefined&&!(typeof raw==='string'&&XP_INVALID.has(raw.trim().toLowerCase()));
   return {id,entity,attribute,value:valid?raw:null};
 }
 val(key){return this.data(key)?.value??null;}
 number(key){const v=this.val(key);return v===null||v===''||!Number.isFinite(Number(v))?null:Number(v);}
 bool(key){return xpBool(this.val(key));}
 num(key,unit='',dec=0){const v=this.number(key);return v===null?'—':xpNum(v,dec)+(unit?' '+unit:'');}
 artworkUrl(relative){
    const configuredBase=this._config.image_path;
    const base=(!configuredBase||configuredBase==='/hacsfiles/xpeng-vehicle-card/assets')?null:configuredBase.replace(/\/$/,'');
    return base?base+'/'+relative:xpPackagedUrl(relative);
  }
  assetSpec(){
    const bundled=relative=>this.artworkUrl(relative);
    const profileArt=key=>Array.isArray(this._config.vehicles)&&this._config.vehicles.length
      ?this.vehicle()?.[key]:this.vehicle()?.[key]||this._config[key];
    const chosen=this._view==='charging'?profileArt('charging_image'):profileArt('image');
    const a=this.appearance(),model=xpAssetModel(a.model),view=this._view==='charging'?'rear':'front';
    if(xpLocalArtworkPath(chosen)&&!this._failedArtwork.has(chosen))
      return {src:chosen,illustrative:false,studio:false,tier:'manual',view,view_status:'owner_supplied',
        description:'Owner-supplied artwork for '+a.model+' '+a.color};
    // Prefer separately packaged and verified three-view assets when present.
    // A view must never silently reuse a front render as a rear or overhead render.
    // Preserve the existing separately supplied charging artwork and geometry.
    // Owner-selected charging baseline for 2026 G6 is the graphite-gray,
    // rear-three-quarter charging.webp with its real cable already pictured.
    // A user-configured charging_image (above) may still override this choice.
    // The overview continues to respect the editor's selected exterior paint.
    const ownerCharging=a.model==='G6'&&String(a.year)==='2026'&&view==='rear'&&a.color!=='black_edition';
    const chargingAppearance=ownerCharging?{...a,color:'graphite_gray'}:a;
    const candidate=xpVehicleAssetPath(chargingAppearance,view==='rear'?'charging':'front');
    if(candidate&&XP_ARTWORK_INDEX.has(candidate)&&!this._failedArtwork.has(bundled(candidate))){
      const generated=XP_ILLUSTRATIVE_ARTWORK_INDEX.has(candidate);
      return {src:bundled(candidate),illustrative:generated,studio:false,tier:generated?'generated-preview':'exact-view',view,
        view_status:generated?'ai_generated_preview':'matching_view',description:(generated?'AI-generated illustration (not official photography): ':'Matched ')+a.model+' '+a.year+' '+a.color+' '+view};
    }
    return {src:this.placeholderArt(),illustrative:true,studio:false,tier:'silhouette',view,
      view_status:'image_pending',description:'Transparent model+paint preview pending for '+a.model+' '+a.color};
  }
  asset(){return this.assetSpec().src;}
  placeholderArt(){
    const a=this.appearance(),colour=XP_PAINTS.find(x=>x.id===a.color)?.hex||'#b6bdc2';
    const shape=xpModel(a.model)?.shape||'suv';
    const roof=shape==='mpv'?'M140 220L200 83H613L735 225':shape.includes('sedan')||shape==='fastback'?'M140 220L298 125H558L735 225':'M140 220L246 105H607L735 225';
    const label=xpEsc(a.model);
    const svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 850 420">'+
      '<path d="'+roof+'L785 254L774 324H67L65 253Z" fill="'+colour+'" stroke="#9dbad4" stroke-width="4"/>'+
      '<circle cx="223" cy="325" r="61" fill="#08101e" stroke="#8297ad" stroke-width="11"/>'+
      '<circle cx="649" cy="325" r="61" fill="#08101e" stroke="#8297ad" stroke-width="11"/>'+
      '<text x="425" y="397" text-anchor="middle" fill="#c2d9f1" font-family="Arial" font-size="20">'+label+' • Preview artwork</text>'+
      '</svg>';
    return 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);
  }
  lastUpdate(){
   // Home Assistant's last_updated is not necessarily a vehicle refresh.
   const t=this.val('last_update');if(!t)return 'Unavailable';
   const parsed=Date.parse(String(t));if(!Number.isFinite(parsed))return String(t);
   return new Date(parsed).toLocaleString(this._hass?.locale?.language||undefined,{dateStyle:'medium',timeStyle:'short'});
 }
  tirePressureBar(key){
    const d=this.data(key),n=this.number(key);
    if(n===null||n<0)return null;
    const unit=String(d?.entity?.attributes?.unit_of_measurement||'kPa').trim().toLowerCase();
    let bar=null;
    if(unit==='kpa')bar=n/100;
    else if(unit==='bar')bar=n;
    else if(unit==='psi')bar=n*0.0689475729;
    else if(unit==='pa')bar=n/100000;
    return bar!==null&&bar>=0.5&&bar<=6?bar:null;
  }

 tirePressureUnit(){
  const raw=String(this.vehicle()?.tire_pressure_unit||this._config.tire_pressure_unit||'bar').toLowerCase();
  return ['bar','psi','kpa'].includes(raw)?raw:'bar';
 }
 tirePressureDisplay(key){
  const bar=this.tirePressureBar(key),unit=this.tirePressureUnit();
  if(bar===null)return {value:'—',unit};
  return {value:xpNum(unit==='psi'?bar*14.5037738:unit==='kpa'?bar*100:bar,unit==='bar'?2:0),unit};
 }
 tireSummary(){
  const values=['tire_fl','tire_fr','tire_rl','tire_rr'].map(k=>this.tirePressureBar(k));
  if(values.some(v=>v===null))return '—';
  const bar=values.reduce((a,b)=>a+b,0)/4,unit=this.tirePressureUnit();
  return xpNum(unit==='psi'?bar*14.5037738:unit==='kpa'?bar*100:bar,unit==='bar'?2:0)+' '+(unit==='kpa'?'kPa':unit==='psi'?'PSI':'bar');
 }
 locationText(){
  const d=this.data('location');const raw=d?.value;
  if(!raw)return 'Unavailable';
  if(raw==='not_home')return 'Away';
  return String(raw).replace(/_/g,' ');
 }
 remainingText(){
   const min=this.number('remaining');
   if(min===null||min<0)return '—';
   return Math.floor(min/60)+'h '+Math.round(min%60)+'m';
 }
 chargeStatus(){
  const v=xpChargingActive(this.val('charging')),plug=this.bool('plugged');
  if(v===true)return 'Charging now';
  if(plug===true)return 'Plugged in';
  if(v===false)return 'Not charging';
  return 'Charging unavailable';
 }
 title(){
  return `<div class="xp-title"><h1>XPENG <em>${xpEsc(this.model())}</em></h1><div class="xp-subtitle">${this._view==='charging'?xpEsc(this.chargeStatus()):this._tireOpen?'Tire pressure':'Vehicle status'}</div></div>`;
 }
 sceneBackdrop(){
    // The scenic background belongs to the DASHBOARD, not to a model image folder.
    // Identical pixel source and placement in both vehicle status and charging.
    // One real image layer, shared for charging and overview. No CSS mountain or sky illustration.
    // A manual dashboard-wide background never changes when vehicle/colour/charging changes.
    const source=this._config.background_image||XP_SCENE_BACKGROUND;
    return `<div class="xp-night-photo" aria-hidden="true"
      style="background-image:url(&quot;${xpEsc(source)}&quot;)"></div>`;
  }
 header(){
   const connection=this.val('connection'),status=xpConnText(connection);
   const stateClass=status==='Connected'?'xp-connected':status==='Connection error'?'xp-error':'xp-disconnected';
   return `<header class="xp-header">
     <div class="xp-header-right"><div class="xp-meta-tools">
        ${this.xpUiEnabled()&&this._view!=='charging'?'<button type="button" class="xp-more-trigger" data-xp-more aria-label="אפשרויות נוספות" title="אפשרויות נוספות">'+xpIcon('settings',21)+'</button>':''}
       <button class="xp-wifi ${stateClass}" type="button" data-meta-toggle
         aria-label="Vehicle communication details" aria-expanded="${this._infoOpen?'true':'false'}"
         aria-controls="xp-last-update-details" title="Vehicle communication details">
         ${xpIcon('wifi',24)}</button>
       ${this._infoOpen?`<div id="xp-last-update-details" class="xp-meta-popover" role="region"
         aria-label="Vehicle connection and last update">
           <div class="xp-meta-field"><small>Connection</small><strong>${xpEsc(status)}</strong></div>
           <div class="xp-meta-field"><small>Last vehicle update</small><strong>${xpEsc(this.lastUpdate())}</strong></div>
         </div>`:''}
     </div></div></header>`;
 }
 progress(){
   const soc=xpPercent(this.val('soc'));
   return `<div class="xp-progress" role="progressbar" aria-label="Battery state of charge" aria-valuemin="0" aria-valuemax="100" ${soc===null?'':'aria-valuenow="'+soc+'"'}>
      <div style="width:${soc??0}%"></div></div>`;
 }
 socHtml(){
  const v=this.number('soc');return v===null?'—':xpNum(v)+'<span class="xp-unit">%</span>';
 }
 xpBatteryGauge(){
   const raw=this.number('soc'),valid=raw!==null&&Number.isFinite(raw)&&raw>=0&&raw<=100;
   const percent=valid?Math.round(raw):null;
   const level=percent===null?'unknown':percent<=20?'low':percent<=50?'medium':'good';
   const charging=this.xpChargingActive();
   const decile=percent===null?null:Math.min(100,Math.max(10,Math.round(percent/10)*10));
   const glyph=percent===null?'mdi:battery-unknown':percent===0?'mdi:battery-outline':
     percent<=10?'mdi:battery-10':decile===100?'mdi:battery':
     'mdi:battery-'+decile;
   const chargingGlyph=charging&&percent!==null&&percent>0
     ?(decile===100?'mdi:battery-charging-100':'mdi:battery-charging-'+Math.max(10,Math.ceil(percent/10)*10)):glyph;
   return '<div class="xp-batt-glyph" role="img" data-xp-battery-icon data-level="'+level+
     '" data-xp-battery-percent="'+(percent??'unknown')+
     '" aria-label="'+(percent===null?'Battery level unavailable':'Battery '+percent+'%')+
     '"><ha-icon class="xp-mdi-icon xp-battery-level-icon" icon="'+chargingGlyph+
     '" style="--xp-icon-size:64px" aria-hidden="true"></ha-icon></div>';
 }

 interiorPreview(){
    const a=this.appearance(),finish=XP_INTERIORS.find(x=>x.id===a.interior)||XP_INTERIORS[0];
    const override=Array.isArray(this._config.vehicles)&&this._config.vehicles.length
      ?this.vehicle()?.interior_image:this.vehicle()?.interior_image||this._config.interior_image;
    const image=a.model==='G6'?this.artworkUrl('vehicles/g6/interior_'+a.interior+'.webp'):override;
    if(a.model==='G6'||xpLocalArtworkPath(image))
      return '<img class="xp-cabin-mini" src="'+xpEsc(image)+'" loading="lazy" alt="'+xpEsc(a.model+' '+finish.label+' interior')+'">';
    return '<p class="xp-cabin-mini" role="status">תמונת פנים לא זמינה לדגם זה.</p>';
 }
  carArt(){
    const a=this.appearance(),spec=this.assetSpec();
    const referenceCutout=a.model==='G6'&&a.color==='arctic_white'&&(spec.tier==='highest-trim-preview'||/\/xpeng-g6-2026-white-cutout\.(?:png|webp)$/.test(spec.src));
    return `<img class="xp-car ${referenceCutout?'xp-reference-cutout':''} ${spec.studio?'xp-studio-car':''}" data-car-art
      src="${xpEsc(spec.src)}"
      title="${xpEsc(spec.description)}" data-view-status="${xpEsc(spec.view_status)}"
      data-art-tier="${xpEsc(spec.tier)}"
      alt="${xpEsc('XPENG '+a.model+', '+a.color.replaceAll('_',' ')+(spec.illustrative?' (illustrative artwork)':''))}" loading="eager">
      `;
  }
 
  topCarArt(){
    const a=this.appearance(),photo=Array.isArray(this._config.vehicles)&&this._config.vehicles.length
      ?this.vehicle()?.top_image:this.vehicle()?.top_image||this._config.top_image;
    if(xpLocalArtworkPath(photo)&&!this._failedArtwork.has(photo))return `<img class="xp-top-cutout" data-top-art src="${xpEsc(photo)}" alt="${xpEsc('Top-down view of '+a.model)}" loading="eager">`;
    const candidate=xpVehicleAssetPath(a,'top');
    if(candidate&&XP_ARTWORK_INDEX.has(candidate)&&!this._failedArtwork.has(this.artworkUrl(candidate)))
      return `<img class="xp-top-cutout" data-top-art src="${xpEsc(this.artworkUrl(candidate))}" alt="${xpEsc((XP_ILLUSTRATIVE_ARTWORK_INDEX.has(candidate)?'AI-generated illustrative ':'')+'Top-down view of '+a.model)}" loading="eager">`;
    const paint=XP_PAINTS.find(p=>p.id===a.color)?.hex||'#f2f4f2';
    return `<svg class="xp-top-car" viewBox="0 0 300 600" role="img" aria-label="${xpEsc('Illustrative overhead view of '+a.model)}">
    <defs><linearGradient id="xp-top-body"><stop offset="0" stop-color="#647381"/><stop offset=".2" stop-color="${xpEsc(paint)}"/><stop offset=".8" stop-color="${xpEsc(paint)}"/><stop offset="1" stop-color="#546576"/></linearGradient>
    <linearGradient id="xp-top-window" x2="1" y2="1"><stop stop-color="#2e4b64"/><stop offset="1" stop-color="#0b1728"/></linearGradient></defs>
    <ellipse cx="150" cy="301" rx="119" ry="270" fill="#000" opacity=".35"/>
    <g fill="#111820" stroke="#8597a4" stroke-width="3">
      <rect x="17" y="135" width="45" height="111" rx="14"/><rect x="238" y="135" width="45" height="111" rx="14"/>
      <rect x="17" y="362" width="45" height="111" rx="14"/><rect x="238" y="362" width="45" height="111" rx="14"/></g>
    <path d="M109 33Q150 9 191 33L239 95Q255 145 255 200V451Q255 504 231 546Q150 573 69 546Q45 504 45 451V200Q45 145 61 95Z" fill="url(#xp-top-body)" stroke="#b1c7d5" stroke-width="3"/>
    <path d="M77 143Q150 104 223 143L228 199Q150 221 72 199Z" fill="url(#xp-top-window)" stroke="#abc0ca" stroke-width="3"/>
    <path d="M75 222Q150 211 225 222V406Q150 423 75 406Z" fill="url(#xp-top-window)" stroke="#abbac4" stroke-width="3"/>
    <path d="M80 434Q150 422 220 434L211 488Q150 497 89 488Z" fill="url(#xp-top-window)" stroke="#9cabb6" stroke-width="2"/>
    <path d="M73 60L106 46M194 46L227 60" stroke="#f3fcff" stroke-width="9" stroke-linecap="round"/>
    <path d="M70 537Q150 554 230 537" stroke="#fa4047" stroke-width="9" fill="none" stroke-linecap="round"/>
    </svg>`;
  }
  xpTireExtra(key){
    const a=this.data(key)?.entity?.attributes||{};
    const temperature=a.tire_temperature_c??a.temperature_celsius??a.temperature_c??null;
    const airLife=a.air_life_percent??a.air_life??null;
    const extra=[];
    if(temperature!==null&&String(temperature).trim()!==''&&Number.isFinite(Number(temperature))
       &&Number(temperature)>=-40&&Number(temperature)<=100){
      extra.push('<span class="xp-tire-temp" dir="ltr">'+xpEsc(xpNum(temperature,1))+' °C</span>');
    }
    if(airLife!==null&&String(airLife).trim()!==''&&Number.isFinite(Number(airLife))
       &&Number(airLife)>=0&&Number(airLife)<=100){
      extra.push('<span class="xp-tire-life" dir="ltr">Air life '+xpEsc(xpNum(airLife))+'%</span>');
    }
    return extra.length?'<div class="xp-tire-extras">'+extra.join('')+'</div>':'';
  }
  tireScreen(showBack=true){
    const a=this.appearance(),photo=Array.isArray(this._config.vehicles)&&this._config.vehicles.length
      ?this.vehicle()?.top_image:this.vehicle()?.top_image||this._config.top_image;
    const unit=this.tirePressureUnit();
    const wheel=(key,label)=>{const reading=this.tirePressureDisplay(key);
      return `<div class="xp-tire-reading" data-wheel="${key}" role="group" aria-label="${xpEsc(label)}">
        ${xpIcon('tire',20)}<div class="xp-tire-reading-body"><small>${xpEsc(label)}</small>
        <strong dir="ltr">${xpEsc(reading.value)} <span>${reading.value==='—'?'לא זמין':unit==='kpa'?'kPa':unit==='psi'?'PSI':'bar'}</span></strong>${this.xpTireExtra(key)}</div>
      </div>`;};
    return `<section class="xp-tire-screen" role="region" aria-label="Tire pressure from above">
       ${showBack?`<div class="xp-tire-actions"><button type="button" data-tire-toggle aria-label="חזרה לתצוגת הרכב" title="חזרה לתצוגת הרכב">${xpIcon('back',22)}</button></div>`:''}
       <div class="xp-tire-stage"><div class="xp-tire-center">${this.topCarArt()}<i class="xp-wheel-highlight xp-wheel-fl" aria-hidden="true"></i><i class="xp-wheel-highlight xp-wheel-fr" aria-hidden="true"></i><i class="xp-wheel-highlight xp-wheel-rl" aria-hidden="true"></i><i class="xp-wheel-highlight xp-wheel-rr" aria-hidden="true"></i></div>
         ${wheel('tire_fl',showBack?'Front left':'קדמי שמאל')}${wheel('tire_fr',showBack?'Front right':'קדמי ימין')}
         ${wheel('tire_rl',showBack?'Rear left':'אחורי שמאל')}${wheel('tire_rr',showBack?'Rear right':'אחורי ימין')}</div>
       ${!xpLocalArtworkPath(photo)?'<div class="xp-tire-disclaimer">Illustrative overhead view · exact model artwork pending</div>':''}
     </section>`;
  }
 overview(){
  // Home contains no location information overlay. The Map is accessible
  // through its dedicated dock button only, on both desktop and phone.
  return `${this.title()}${this.carArt()}
    <section class="xp-overview-stat" aria-label="Battery and estimated range">
     <div class="xp-batt-line">${this.xpBatteryGauge()}
       <div><div class="xp-stat-label">Battery</div><div class="xp-soc">${this.socHtml()}</div></div></div>
     ${this.progress()}<div class="xp-overview-range"><div class="xp-stat-label">Estimated range</div><div class="xp-range-num">${xpIcon('gauge',36)}<span>${xpEsc(this.num('range','km'))}</span></div></div>
    </section>
    ${!this.xpUiEnabled()?'<button type="button" class="xp-maintenance-home-button" data-xp-open="maintenance" aria-label="פתיחת תחזוקת הרכב">'+xpIcon('maintenance',21)+'<span>תחזוקה</span></button>':''}`;
 }
 charging(){
  return `${this.title()}
    <div class="xp-station xp-station-v3 xp-station-xpeng19" aria-hidden="true">
     <svg class="xp-xpeng-pedestal" viewBox="0 0 100 250" preserveAspectRatio="xMidYMid meet">
      <defs>
       <linearGradient id="xp19-case" x1="0" x2="1" y1="0" y2=".14"><stop offset="0" stop-color="#b4c6d2"/><stop offset=".15" stop-color="#64788b"/><stop offset=".32" stop-color="#243343"/><stop offset=".78" stop-color="#111c29"/><stop offset="1" stop-color="#070f18"/></linearGradient>
       <linearGradient id="xp19-panel" x1="0" x2="1"><stop stop-color="#081524"/><stop offset=".55" stop-color="#182d3c"/><stop offset="1" stop-color="#03080d"/></linearGradient>
       <linearGradient id="xp19-edge" x1="0" x2="1"><stop stop-color="#c9ddeb"/><stop offset=".6" stop-color="#6a8b9f"/><stop offset="1" stop-color="#1c2939"/></linearGradient>
       <linearGradient id="xp19-led" x1="0" x2="1"><stop stop-color="#39bdf7"/><stop offset=".5" stop-color="#f5ffff"/><stop offset="1" stop-color="#1597d1"/></linearGradient>
      </defs>
      <ellipse cx="54" cy="243" rx="39" ry="4" fill="#01050d" opacity=".6"/>
      <path d="M27 10Q27 5 35 4L73 1Q82 1 83 11L86 223Q87 229 79 233L34 237Q26 236 25 228Z" fill="url(#xp19-case)" stroke="#74899c" stroke-width="1.3"/>
      <path d="M32 11Q32 9 36 9L73 6Q78 6 79 12L81 226Q80 230 76 230L36 232Q31 230 31 226Z" fill="url(#xp19-panel)" stroke="#3a5b73" stroke-width=".6"/>
      <path d="M25 20L25 225Q27 234 33 236" stroke="url(#xp19-edge)" stroke-width="4" fill="none"/>
      <rect x="37" y="13" width="38" height="93" rx="11" fill="#06111e" stroke="#2a3f51" stroke-width="1"/>
      <path d="M43 36L52 45L61 36M43 45L52 36L61 45" stroke="#d6f2ff" stroke-width="3.4" fill="none" stroke-linecap="round"/>
      <text x="56" y="60" fill="#d9eafa" text-anchor="middle" font-size="8" letter-spacing="1.2" font-family="Arial,sans-serif">XPENG</text>
      <rect x="53" y="134" width="4" height="74" rx="2" fill="#20b9f5" opacity=".21"/>
      <rect x="54.4" y="134" width="2" height="74" rx="1" fill="url(#xp19-led)"/>
      <path d="M31 113L21 114Q17 115 17 122V132Q17 137 21 138L31 139" fill="#172736" stroke="#8ba9bd" stroke-width="1.7"/>
      <circle cx="18.5" cy="126" r="5" fill="#091622" stroke="#8ba9bd" stroke-width="1.5"/>
      <circle cx="18.5" cy="126" r="1.8" fill="#28e7c7"/>
      <path d="M82 30L84 216" stroke="#91a7b5" stroke-opacity=".35" stroke-width="1.5"/>
     </svg>
     <span class="xp-station-display">${xpIcon('station',24)}</span><span class="xp-station-charge-light"></span><span class="xp-station-side-light"></span>
    </div>${this.carArt()}
    ${this.model()==='G6'&&this.xpChargingActive()?
      '<svg class="xp-charge-cable xp-charge-cable-live xp-cable-desktop" data-xp-cable="desktop" aria-hidden="true" viewBox="0 0 1400 788" preserveAspectRatio="none"><path class="xp-charge-cable-halo" d="M935 460 C950 499 960 555 998 589 C1038 623 1095 629 1145 632 S1235 635 1277 610 C1301 590 1296 538 1287 474"/><path class="xp-charge-cable-core" d="M935 460 C950 499 960 555 998 589 C1038 623 1095 629 1145 632 S1235 635 1277 610 C1301 590 1296 538 1287 474"/></svg>'+
      '<svg class="xp-charge-cable xp-charge-cable-live xp-cable-mobile" data-xp-cable="mobile" aria-hidden="true" viewBox="0 0 390 780" preserveAspectRatio="none"><path class="xp-charge-cable-halo" d="M171 489 C190 515 191 558 211 581 C236 609 270 612 301 603 C333 596 349 573 358 551 C359 540 353 530 346 516"/><path class="xp-charge-cable-core" d="M171 489 C190 515 191 558 211 581 C236 609 270 612 301 603 C333 596 349 573 358 551 C359 540 353 530 346 516"/></svg>':''}
    <section class="xp-charge-card" aria-label="Charging information">
       <div class="xp-charge-heading">${xpIcon('bolt',42)}<span>${xpEsc(this.chargeStatus())}</span></div>
       ${this.progress()}
       <div class="xp-charge-main">
         <div class="xp-soc" aria-label="Battery percentage">${this.socHtml()}</div>
         <div class="xp-charge-divider"></div>
         <div class="xp-charge-range"><div class="xp-stat-label">Estimated range</div>
           <b>${xpIcon('gauge',25)}${xpEsc(this.num('range','km'))}</b></div>
       </div>
       <div class="xp-charge-meta">
         <div>${xpIcon('bolt',23)}<small>Charging power</small><b>${xpEsc(this.num('power','kW',1))}</b></div>
         <div>${xpIcon('clock',23)}<small>Time remaining</small><b>${xpEsc(this.remainingText())}</b></div>
         <div>${xpIcon('battery',23)}<small>Charge limit</small><b>${xpEsc(this.num('target','%'))}</b></div>
       </div>
       ${this.xpUiEnabled()&&!this._xpPanel?'<nav class="xp-charge-panel-actions" aria-label="בקרות טעינה" dir="rtl">'+
        '<button type="button" data-xp-open="charge_controls">'+xpIcon('battery',22)+'<span>הגבלת טעינה</span></button>'+
        '<button type="button" data-xp-open="charge_schedule">'+xpIcon('clock',22)+'<span>תזמון</span></button>'+
        '<button type="button" data-xp-command="stop_charge" '+(this.xpLive('button','stop_charge')?'':'disabled title="פקודת עצירת טעינה אינה זמינה"')+'>'+xpIcon('power',22)+'<span>עצור טעינה</span></button>'+
        '</nav>':''}
    </section>`;
 }
 // Update matching nodes in place instead of replacing the entire shadow tree
 // on every Home Assistant state tick. This preserves active iPhone touches,
 // native map tiles, focus, and the modal's scroll container.
 xpReconcileChildren(current,next){
   let existing=current.firstChild;
   for(let fresh=next.firstChild;fresh;fresh=fresh.nextSibling){
     if(!existing){current.appendChild(fresh.cloneNode(true));continue;}
     if(existing.nodeType!==fresh.nodeType||existing.nodeName!==fresh.nodeName){
       const replacement=fresh.cloneNode(true);
       current.replaceChild(replacement,existing);
       existing=replacement.nextSibling;
       continue;
     }
     const after=existing.nextSibling;
     if(existing.nodeType===3){
       if(existing.nodeValue!==fresh.nodeValue)existing.nodeValue=fresh.nodeValue;
     }else if(existing.nodeType===1){
       const oldAttrs=[...existing.attributes];
       for(const attr of oldAttrs)if(!fresh.hasAttribute(attr.name))existing.removeAttribute(attr.name);
       for(const attr of fresh.attributes){
         if(existing.getAttribute(attr.name)!==attr.value)existing.setAttribute(attr.name,attr.value);
       }
       // Only the real map owns this slot after the first mount. Its internals
       // must never be reconciled against the "loading" placeholder.
       const mountedMap=existing.hasAttribute('data-xp-map-host')&&
         this._xpPanel==='map'&&this._xpMapElement&&
         existing.contains(this._xpMapElement);
       if(!mountedMap)this.xpReconcileChildren(existing,fresh);
     }
     existing=after;
   }
   while(existing){const following=existing.nextSibling;current.removeChild(existing);existing=following;}
 }
 render(){
  if(!this.shadowRoot)return;
  this.toggleAttribute('data-expanded',this._expanded);
  // The charging entity is the single source of truth for choosing the screen.
  // Only an explicit 'on' shows Charging. 'off', unknown and unavailable show Overview.
  const actualCharging=this.xpChargingActive();
  const isCharging=actualCharging&&!this._xpChargingDismissed;
  this._view=isCharging?'charging':'overview';
  if(isCharging)this._tireOpen=false;
  const onHome=!isCharging&&!this._tireOpen&&!this._xpPanel;
  const homeSurface=!isCharging&&!this._tireOpen&&this.xpUiEnabled();
  const onChargeHome=isCharging&&!this._xpPanel;
  const chargeLayout=isCharging&&this.xpUiEnabled();
  const showDock=this.xpUiEnabled()&&(onHome||onChargeHome);
  const oldModal=this.shadowRoot.querySelector?.('.xp-ux-modal');
  const oldPanel=oldModal?.className||'';
  const oldScroll=oldModal?.scrollTop||0;
  const oldDiagnostics=oldModal?.querySelector?.('.xp-diagnostics-scroll')?.scrollTop||0;
  const html=xpLocalizeMarkup(`<style>${XP_CSS}</style><ha-card><div class="xp-scene ${isCharging?'xp-charge':this._tireOpen?'xp-overview xp-tire-mode':'xp-overview'} ${this.xpUiEnabled()?'xp-has-controls':''} ${homeSurface?'xp-home-navigation':''} ${chargeLayout?'xp-charge-navigation':''} ${xpIsEnglish(this._hass)?'xp-locale-en':''} ${this.paint()==='black_edition'?'xp-black-edition':''}">
   ${this.sceneBackdrop()}${this.header()}${isCharging?this.charging():this._tireOpen?this.title()+this.tireScreen():this.overview()}${showDock?this.xpDock():""}${this.xpModal()}
   
   </div></ha-card>`,this._hass);
  if(typeof document!=='undefined'&&typeof document.createElement==='function'&&
     this.shadowRoot.childNodes?.length){
    const template=document.createElement('template');
    template.innerHTML=html;
    this.xpReconcileChildren(this.shadowRoot,template.content);
  }else this.shadowRoot.innerHTML=html;
  const newModal=this.shadowRoot.querySelector?.('.xp-ux-modal');
  if(newModal&&oldPanel===newModal.className){
    newModal.scrollTop=oldScroll;
    const diagnostics=newModal.querySelector('.xp-diagnostics-scroll');
    if(diagnostics)diagnostics.scrollTop=oldDiagnostics;
  }
  if(this._xpFitResizeObserver){
   const haCard=this.shadowRoot?.querySelector?.('ha-card');
   if(haCard&&haCard!==this._xpObservedCard){
    this._xpFitResizeObserver.disconnect();this._xpFitResizeObserver.observe(haCard);this._xpObservedCard=haCard;
   }
  }
  this.xpFitModalContent();
  if(this._xpPanel==='map')this.xpMountMap();
 }
}
const XP_MAPPABLE_FIELDS = Object.freeze([{"key":"charging","label":"Charging state"},{"key":"soc","label":"Battery level (%)"},{"key":"range","label":"Estimated range (km)"},{"key":"power","label":"Charging power (kW)"},{"key":"remaining","label":"Time remaining (minutes)"},{"key":"target","label":"Charging limit (%)"},{"key":"plugged","label":"Cable connected"},{"key":"odometer","label":"Odometer (km)"},{"key":"tire_fl","label":"Tire front left (kPa)"},{"key":"tire_fr","label":"Tire front right (kPa)"},{"key":"tire_rl","label":"Tire rear left (kPa)"},{"key":"tire_rr","label":"Tire rear right (kPa)"},{"key":"location","label":"Vehicle location"},{"key":"last_update","label":"Last update"},{"key":"connection","label":"Connection status"}]);
class XpengVehicleCardEditor extends HTMLElement{
 constructor(){
  super();this.attachShadow({mode:'open'});
  this._cfg=xpNormalizeAppearance({prefix:'my_xpeng',year:'2026',model:'G6',trim:'core_plus_rwd',color:'graphite_gray',interior:'dark_gray'});this._hass=null;this._entitySignature='';
  this.shadowRoot.addEventListener('change',e=>{
   const el=e.target.closest('[data-key],[data-entity]');if(!el)return;
   if(el.hasAttribute('data-entity'))el.setCustomValidity('');
   if(el.hasAttribute('data-entity')){
     if(xpSensorMappingMode(this._cfg)!=='manual')return;
     const field=el.dataset.entity,raw=String(el.value||'').trim();
     if(!XP_MAPPABLE_FIELDS.some(x=>x.key===field))return;
     if(raw&&!xpParseEntityMapping(raw)){
       el.setCustomValidity('Enter a valid Home Assistant entity ID');el.reportValidity();return;
     }
     const mapping={...(this._cfg.entities||{})};
     if(raw)mapping[field]=raw;else delete mapping[field];
     this._cfg={...this._cfg,entities:mapping};
     this.render();
     this.dispatchEvent(new CustomEvent('config-changed',{detail:{config:this._cfg},bubbles:true,composed:true}));
     return;
   }
   const key=el.dataset.key;
    let cfg={...this._cfg,[key==='year_group'?'year':key]:el.value};
    // Model, generation, exact model-year and colour select image; trim stays display-only.
    if(['model','year_group','year','color'].includes(key)){delete cfg.image;delete cfg.charging_image;delete cfg.top_image;}
    if(['model','interior'].includes(key))delete cfg.interior_image;
    if(cfg.prefix&&!/^[a-z0-9_]+$/.test(cfg.prefix))return;
    if(key==='model')cfg.year=xpYearGroupChoices(cfg.model)[0]?.id||cfg.year;
    if(key==='year_group'&&xpYearNeedsSpecificChoice(cfg.model,cfg.year)){
      const group=xpYearGroupFor(cfg.model,cfg.year);
      cfg.year=String(group.years[group.years.length-1]);
    }
    if(['model','year_group','year'].includes(key)){
      cfg.trim=xpAllowedTrims(cfg.model,cfg.year)[0]?.id||cfg.trim;
      cfg.color=xpAllowedPaints(cfg.model,cfg.year)[0]?.id||cfg.color;
      cfg.interior=xpAllowedInteriors(cfg.model,cfg.year)[0]?.id||cfg.interior;
    }
    this._cfg=xpNormalizeAppearance(cfg);this.render();
   this.dispatchEvent(new CustomEvent('config-changed',{detail:{config:this._cfg},bubbles:true,composed:true}));
  });
 }
 setConfig(cfg){this._cfg=xpNormalizeAppearance({...cfg});this.render();}
 set hass(value){
   this._hass=value;
   const signature=String(value?.locale?.language||value?.language||'he')+'|'+Object.keys(value?.states||{}).sort().join('|');
   if(signature!==this._entitySignature){this._entitySignature=signature;this.render();}
 }
 get hass(){return this._hass;}
 render(){
  const v=xpNormalizeAppearance(this._cfg);
  const select=(key,label,values,selected=v[key])=>`<label>${xpEsc(label)}<select data-key="${key}">${values.map(x=>`<option value="${xpEsc(x.id)}" ${selected===x.id?'selected':''}>${xpEsc(x.label)}</option>`).join('')}</select></label>`;
  const prefix=v.prefix||'my_xpeng';
  const mappingMode=xpSensorMappingMode(v);
  const states=this._hass?.states||{};
  const dataList=Object.keys(states).filter(id=>xpParseEntityMapping(id)).sort().map(id=>'<option value="'+xpEsc(id)+'"></option>').join('');
  const mappingRows=XP_MAPPABLE_FIELDS.map(field=>{
   const spec=XP_KEYS[field.key];
   const auto=spec[0]+'.'+prefix+'_'+spec[1];
   return '<label class="xp-map-row"><span>'+xpEsc(field.label)+'</span><input data-entity="'+xpEsc(field.key)+'" list="xp-entity-choices" autocomplete="off" value="'+xpEsc(v.entities?.[field.key]||'')+'" placeholder="Auto: '+xpEsc(auto)+'" title="Leave blank for automatic mapping. Supports entity_id or entity_id|attribute_name"></label>';
  }).join('');
  this.shadowRoot.innerHTML=xpLocalizeMarkup(`<style>section{display:grid;gap:13px;padding:14px;font:inherit}label{display:grid;gap:5px;font-size:13px}input,select{border:1px solid #8b959e;border-radius:7px;padding:10px;background:var(--card-background-color,#fff);color:var(--primary-text-color,#111)}p{font-size:12px;opacity:.8;line-height:1.5}
   h3{margin:8px 0 0;font-size:15px}
   details{border:1px solid var(--divider-color,#7d879a77);border-radius:9px;padding:11px}
   summary{cursor:pointer;font-weight:600}
   .xp-map-fields{display:grid;gap:9px;margin-top:12px}
   .xp-map-row{display:grid;grid-template-columns:minmax(105px,1fr) minmax(145px,2fr);gap:9px;align-items:center}
   .xp-map-row input{font-size:12px}
   @media(max-width:460px){.xp-map-row{grid-template-columns:1fr}}
   </style><section>
    <h3>Vehicle appearance</h3>
     ${select('model','Model',xpAllowedModels().map(m=>({id:m.id,label:m.name})))}
     ${select('year_group','Generation / facelift',xpYearGroupChoices(v.model),xpYearGroupFor(v.model,v.year)?.id)}
      ${xpYearNeedsSpecificChoice(v.model,v.year)?select('year','Model year · paint availability',xpYearsWithinGroup(v.model,v.year),xpYearsWithinGroup(v.model,v.year).some(y=>y.id===v.year)?v.year:xpYearsWithinGroup(v.model,v.year)[0]?.id):''}
     ${select('trim','Trim · display only',xpAllowedTrims(v.model,v.year))}
     ${select('color','Exterior paint',xpAllowedPaints(v.model,v.year))}
     ${select('interior','Interior finish · צבע פנים הרכב',xpAllowedInteriors(v.model,v.year))}
     ${select('tire_pressure_unit','יחידות לחץ צמיגים',[{id:'bar',label:'bar'},{id:'psi',label:'PSI'},{id:'kpa',label:'kPa'}],v.tire_pressure_unit||'bar')}
     ${select('show_controls','Control buttons', [{id:'true',label:'Visible · seven main actions'},{id:'false',label:'Hidden · original status-only view'}],String(v.show_controls===undefined?v.model==='G6':v.show_controls===true||v.show_controls==='true'))}
     ${select('enable_access_controls','Access actions (unlock / windows)',[{id:'false',label:'Off (safe default)'},{id:'true',label:'On (requires Xpengtk Access permission)'}],String(v.enable_access_controls===true||v.enable_access_controls==='true'))}
     <p>Years sharing the same exterior/facelift are grouped. Select a specific year only when paint availability differs. Trim labels never change vehicle pictures.</p>
    <h3>Sensor mapping</h3>
     <label>Mapping mode<select data-key="sensor_mapping_mode">
       <option value="auto" ${mappingMode==='auto'?'selected':''}>Automatic · XPENG integration</option>
       <option value="manual" ${mappingMode==='manual'?'selected':''}>Manual · choose sensors</option>
     </select></label>
     ${mappingMode==='manual'? `<div class="xp-map-fields" data-mappings>
       <p>Choose any of the ${XP_MAPPABLE_FIELDS.length} Home Assistant sensors. A blank field uses automatic integration mapping. Entity attributes: entity_id|attribute_name.</p>
       ${mappingRows}
       <datalist id="xp-entity-choices">${dataList}</datalist>
     </div>`:`<p data-auto-mapping>Vehicle sensors are matched automatically using the XPENG integration. Choose Manual to show and assign individual sensor entities.</p>`}
     <p>Vehicle status and automatic Charging remain the two principal scenes. Optional in-card overlays show climate and seat controls and use native Home Assistant services. The cabin illustration reflects the selected interior colour.</p>
  </section>`,this._hass);
 }
}
if(!customElements.get('xpeng-vehicle-card'))customElements.define('xpeng-vehicle-card',XpengVehicleCard);
if(!customElements.get('xpeng-vehicle-card-editor'))customElements.define('xpeng-vehicle-card-editor',XpengVehicleCardEditor);
window.customCards=window.customCards||[];
if(!window.customCards.some(c=>c.type==='xpeng-vehicle-card'))window.customCards.push({type:'xpeng-vehicle-card',name:'XPENG Dashboard',description:'Two-screen vehicle status and charging dashboard (read-only)'});
