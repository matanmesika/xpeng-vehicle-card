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
 return '<ha-icon class="xp-mdi-icon" icon="'+mdi+'" style="--xp-icon-size:'+px+'px" aria-hidden="true"></ha-icon>';
}
function xpEsc(v){return String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));}

/* Dual-language UI: Home Assistant's user locale controls labels; no separate dashboard. */
const XP_EN_TRANSLATIONS=Object.freeze([["חיישן unavailable אינו ניתן לתיקון באמצעות ציור הכרטיס. בדוק את מקור הנתון באינטגרציה. כפתורי פעולה מסוג button אינם מדווחים מצב רגיל.","An unavailable sensor cannot be fixed by the card. Check Xpengtk. Action buttons do not report a normal state."],["לא מוצגות פקודות פתיחת נעילה, פתיחת חלונות או תא מטען. פעולות רגישות דורשות אישור ויעברו דרך הרשאות Xpengtk.","Unlock/open actions are hidden. Sensitive commands require confirmation and Xpengtk permissions."],["Xpengtk מספקת חיישני תזמון טעינה לקריאה בלבד. אין כרגע פקודת שינוי תזמון טעינה מאומתת.","Xpengtk provides read-only charging schedules. Schedule changes are not supported."],["פתיחת תא המטען מחייבת הרשאת Access. אם החיישן לא מדווח מצב ברור, לא תישלח פקודה.","Opening the tailgate requires Access permission. No command is sent with unknown status."],["השינוי נשלח ל־Home Assistant רק אחרי בחירת ערך בסרגל. יש לוודא שהרכב קיבל אותו.","Changes are sent to Home Assistant only after selecting a slider value. Confirm the vehicle accepted it."],["עדיין לא זוהו ישויות Xpengtk. בדוק חיבור, קידומת VIN והרשאות Entity Registry.","No Xpengtk entities detected. Check the connection, VIN prefix and Entity Registry permissions."],["כיבוי חימום מושב הנוסע הקדמי אינו נתמך כרגע ב־Xpengtk. ניתן לכבות מתוך הרכב.","Turning off front passenger seat heating is not supported by Xpengtk. Use the vehicle controls."],["המפה אינה זמינה בתוך הכרטיס כרגע. אפשר לפתוח את פרטי המיקום דרך הכפתור למטה.","The map is unavailable in this card. Open the vehicle's location details below."],["נעילה ושחרור נעילה מתבצעים בלחיצה אחת, בהתאם למצב. שחרור מחייב הרשאת Access.","Lock/unlock uses a single tap according to state. Unlocking requires Access permission."],["המידע מגיע מ־Xpengtk. הפקודות פועלות לפי הרשאות Home Assistant והרכב בלבד.","Data comes from Xpengtk. Commands use Home Assistant and vehicle permissions."],["הערכים מתעדכנים לפי Home Assistant. מספר השלדה המלא אינו חשוף באינטגרציה.","Values are provided by Home Assistant. The full VIN is not exposed by the integration."],["תמונת פנים G6 בצבע שנבחר עדיין לא צורפה לפרויקט. לא מוצגת הדמיה חלופית.","The selected G6 interior photo is unavailable. No substitute illustration is displayed."],["לחיצה אחת הופכת את מצב הדלתית על סמך חיווי Xpengtk. אין שחרור כבל.","One tap toggles the charging flap according to Xpengtk status. No cable release."],["פתיחת חלונות דורשת הרשאת Access. אין פקודה כאשר מצבם אינו ידוע.","Opening windows requires Access permission. No command is sent with unknown status."],["אפשרויות נוספות לרכב — שבעת קיצורי הדרך נשארים במסך הבית בלבד.","Additional vehicle options. The seven shortcuts remain on the home screen."],["הפקודה נשלחה ל־Home Assistant. יש לוודא שהרכב אישר את הפעולה.","Command sent to Home Assistant. Verify that the vehicle confirmed the action."],["אין לוח תזמוני מיזוג זמין באינטגרציה. לא ניצור תזמון מדומה.","No climate schedule calendar is available through the integration; no schedule is simulated."],["בקרות V2L אינן זמינות בדגם או בהרשאות האינטגרציה.","V2L controls are not available for this model or permissions."],["המפה המובנית אינה זמינה בכרטיס זה כרגע.","The built-in map is currently unavailable in this card."],["דיווח Connected • חיבור הכבל אינו מאומת","Connected reported • Cable connection unverified"],["הגבלת הטעינה אינה זמינה כעת באינטגרציה.","Charging limit is currently unavailable through the integration."],["כיבוי חימום נוסע אינו מאומת באינטגרציה","Passenger heating off is not supported by the integration"],["לא נמצאו בקרות מושבים נתמכות לרכב זה.","No supported seat controls were found for this vehicle."],["לא נמצאו ישויות אבטחה זמינות לרכב זה.","No security entities are available for this vehicle."],["רמת החימום או האוורור אינה זמינה כעת.","Heating or ventilation level unavailable."],["אין כרגע פקודות זמינות באינטגרציה.","No commands are currently available through the integration."],["כבל מחובר • אין לסגור את הדלתית","Cable connected • Do not close the flap"],["תמונת פנים בעל הרכב · XPENG G6","Owner-provided G6 interior photograph"],["אין כרגע נתוני אנרגיה זמינים.","Energy data is currently unavailable."],["בקרת המיזוג אינה זמינה כרגע.","Climate controls are unavailable."],["פרטי תחזוקה ב־Home Assistant","Maintenance details in Home Assistant"],["תמונת פנים לא זמינה לדגם זה.","No interior image is available for this model."],["פרטי מיקום ב־Home Assistant","Location details in Home Assistant"],["טיימר לכיבוי אוטומטי (דקות)","Auto-off timer (minutes)"],["החלף כיוון זרימת אוויר אל ","Change airflow direction to "],["חיישנים, מצב ומזהי Xpengtk","Sensors, states and Xpengtk IDs"],["תמונת פנים לפי הגדרות הרכב","Interior photograph from vehicle settings"],["פעולות הרכב וקיצורי מסכים","Vehicle controls and shortcuts"],["תמונת פנים לפי הגדרת הצבע","Interior photo chosen by color"],["הפעלת מיזוג ומצב אוטומטי","Climate and automatic mode controls"],["לחץ אוויר בארבעת הצמיגים","Tire pressure · All four tires"],["שנת דגם (מהגדרות הכרטיס)","Model year (card settings)"],[" ישויות משויכות לרכב • "," vehicle entities • "],["אין שינוי בפעולות הרכב","No change to vehicle commands"],["הפעל עדכונים אוטומטיים","Enable automatic updates"],["צריכה והיסטוריית טעינה","Consumption and charging history"],["הדרגה אינה נתמכת כעת.","This level is currently unsupported."],["שגיאה בשליחת הפקודה: ","Error sending command: "],["כיוון זרימת אוויר אל ","Set airflow direction to "],["שנת דגם (מהאינטגרציה)","Model year (integration)"],["צריכה ממוצעת ב־7 ימים","7-day average consumption"],["אנרגיה בטעינה האחרונה","Last charge energy"],["כבה עדכונים אוטומטיים","Disable automatic updates"],["לשלוח את הפקודה לרכב?","Send this command to the vehicle?"],["מצב הדלתית אינו זמין","Flap status unavailable"],["הצג לוח תזמוני מיזוג","View climate schedules"],["אבטחה ורגישות השמירה","Security sensitivity"],[" זמינות או פעולות • "," available or actions • "],["רשימת ישויות Xpengtk","Xpengtk entity list"],["שירות HA אינו זמין.","Home Assistant service unavailable."],["פקודת המושב נכשלה: ","Seat command failed: "],["טמפרטורת תא הנוסעים","Cabin temperature"],["הצג תזמונים קיימים","View existing schedules"],["נדרשת הרשאת Access","Access permission required"],["צריכת אנרגיה בחניה","Parked energy consumption"],["משך הטעינה האחרונה","Last charge duration"],["שקע חשמל בתא המטען","Tailgate power outlet"],["פעיל • חיווי בלבד","On • Status only"],["כבוי • חיווי בלבד","Off • Status only"],["ק״מ שנותרו לטיפול","Kilometers until service"],["מספר שלדה (מוסתר)","Masked VIN"],["טווח שנוסף בטעינה","Range added during last charge"],["פתיחת תחזוקת הרכב","Open vehicle maintenance"],["יחידות לחץ צמיגים","Tire pressure unit"],["הפשרת שמשה קדמית","Windshield defrost"],["דרושה הרשאת גישה","Access permission required"],["דלתית שקע הטעינה","Charging port flap"],["תחזוקה ופרטי רכב","Maintenance and vehicle details"],["חזרה לחלון הקודם","Back to previous screen"],["חזרה לתצוגת הרכב","Back to vehicle view"],["טמפרטורה נוכחית","Current temperature"],["סגירת שקע טעינה","Close charging port"],["פתיחת שקע טעינה","Open charging port"],["אפשרויות נוספות","More options"],["שעת התחלת טעינה","Charging start time"],["תזמונים מוגדרים","Configured schedules"],["קילומטרים נותרו","Distance remaining"],["תצוגה מאוירת · ","Illustration · "],["פונקציות מיזוג","Climate functions"],["המצב אינו ידוע","Status unknown"],["מפת מיקום הרכב","Vehicle location map"],["שעת סיום טעינה","Charging end time"],["חשמל בתא המטען","Tailgate power"],["תזמונים קיימים","Existing schedules"],["חזרה למסך הבית","Back to dashboard"],["איור פנים רכב ","Vehicle cabin illustration "],["הורד חצי מעלה","Decrease by half a degree"],["העלה חצי מעלה","Increase by half a degree"],["מהירות מאוורר","Fan speed"],["סגירת תא מטען","Close Trunk"],["פתיחת תא מטען","Open Trunk"],["רגישות השמירה","Security sensitivity"],["הפעלת X-Guard","Enable X-Guard"],["פעולות זמינות","Available actions"],["צבע פנים הרכב","Vehicle interior color"],["טמפרטורת יעד","Target temperature"],["סגירת חלונות","Close windows"],["פתיחת חלונות","Open windows"],["סגור תא מטען","Close Trunk"],["הפעל שקע V2L","Enable V2L outlet"],["עדכוני תוכנה","Software updates"],["הפעל X-Guard","Enable X-Guard"],["נתוני אנרגיה","Energy data"],["אבחון ישויות","Entity diagnostics"],["הפעלת מיזוג","Climate power"],["כיוון אוויר","Airflow direction"],["חימום מראות","Mirror heating"],["מצב אוטומטי","Automatic mode"],["שחרור נעילה","Unlock vehicle"],["פתח תא מטען","Open Trunk"],["סגור חלונות","Close windows"],["מצב לא ידוע","Status unknown"],["תחזוקת הרכב","Vehicle maintenance"],["הגבלת טעינה","Charge limit"],["תזמון טעינה","Charge schedule"],["מצב נוכחי: ","Current status: "],["דלתית פתוחה","Flap open"],["דלתית סגורה","Flap closed"],["מיזוג אוויר","Climate control"],["פעיל / פתוח","On / Open"],["כבוי / סגור","Off / Closed"],["כפתור פעולה","Action button"],["הבהוב אורות","Flash lights"],["תאריך טיפול","Service date"],["בקרות טעינה","Charging controls"],["נסועה כוללת","Total distance"],["כבה שקע V2L","Disable V2L outlet"],["כבה X-Guard","Disable X-Guard"],["נעילת דלתות","Lock doors"],["רמת מאוורר","Fan level"],["בקרת אקלים","Climate controls"],["מצב AUTO: ","AUTO mode: "],["נעילת הרכב","Lock vehicle"],["פתח חלונות","Open windows"],["מיקום הרכב","Vehicle location"],["אחורי שמאל","Rear left"],["אחורי ימין","Rear right"],["קילומטראז׳","Odometer"],["הטיפול הבא","Next service"],["עצור טעינה","Stop charging"],["הפסק טעינה","Stop charging"],["הפעל תזמון","Enable schedule"],["השבת תזמון","Disable schedule"],["ימים נותרו","Days remaining"],[" לא זמינות"," unavailable"],["חיווי בלבד","Status only"],["פתח נעילה","Unlock"],["נעילת רכב","Vehicle locking"],["קדמי שמאל","Front left"],["קדמי ימין","Front right"],["חימום הגה","Heated steering wheel"],["שקע טעינה","Charging port"],["טוען מפה…","Loading map…"],["XOS ו־OTA","XOS and OTA"],["פנים רכב ","Vehicle interior "],["סגור שקע","Close port"],["דלת נוסע","Passenger door"],["גרסת XOS","XOS version"],["פתח שקע","Open port"],["דלת נהג","Driver door"],["תא מטען","Tailgate"],["לא זמין","Unavailable"],["לא ידוע","Unknown"],["לא נעול","Unlocked"],["שנת דגם","Model year"],["נסה שוב","Try again"],["חלונות","Windows"],["תחזוקה","Maintenance"],["פתוחים","Open"],["סגורים","Closed"],["נמצאו ","Found "],[" בצבע "," in "],["אוורור","Ventilation"],["מיזוג","Climate"],["נעילה","Lock"],["דלתות","Doors"],["מיקום","Location"],["פתוחה","Open"],["סגורה","Closed"],["הבהוב","Flash lights"],["צפירה","Honk horn"],["תזמון","Schedule"],["דרגה ","Level "],["שגיאה","Error"],["חימום","Heating"],["פתוח","Open"],["סגור","Closed"],["פעיל","On"],["כבוי","Off"],["חסרה","Missing"],["נעול","Locked"],["נועל","Locking"],["פותח","Unlocking"],["צופר","Horn"],["יצרן","Manufacturer"],["נוסע","Passenger"],["דגם","Model"],["נהג","Driver"],["הגה","Steering wheel"],["טמפרטורה","Temperature"],["אינו זמין","Unavailable"],["תא המטען","The tailgate"],["פרטי עדכון","Update details"],["תזמון מיזוג","Schedule climate"],["אין נתוני גרסה או עדכונים זמינים.","No update data available."]]);
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
const XP_CSS = `
:host{display:block;color:#fff;font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;--xp-mint:#00efbe;--xp-sky:#6aaaff}
*{box-sizing:border-box}
ha-card{display:block;width:100%;container-type:inline-size;container-name:xpeng-layout;background:transparent!important;border:0!important;box-shadow:none!important;overflow:visible!important}
button{font:inherit;color:inherit;cursor:pointer}
button:focus-visible{outline:2px solid #81bbff;outline-offset:3px}
.xp-scene{position:relative;width:100%;min-height:620px;aspect-ratio:16/9;overflow:hidden;background:#020b16;isolation:isolate;direction:ltr}

.xp-night-photo{position:absolute;inset:0;z-index:0;pointer-events:none;background-color:#020d1b;background-size:cover;background-position:center center;background-repeat:no-repeat}
.xp-header{position:absolute;z-index:8;top:3.2%;left:4.5%;right:3%;display:flex;align-items:center;justify-content:space-between;gap:16px}
.xp-brand{display:flex;align-items:center;gap:14px;font-weight:600;letter-spacing:.31em;font-size:clamp(14px,1.4vw,23px);white-space:nowrap}
.xp-x-mark{font-size:26px;letter-spacing:-.13em;transform:scaleX(1.4)}
.xp-header-right{display:flex;align-items:center;gap:12px;min-width:0;font-size:clamp(12px,1.2vw,20px)}
.xp-mdi-icon{display:inline-flex;align-items:center;justify-content:center;vertical-align:middle;flex:0 0 auto;width:var(--xp-icon-size,22px);height:var(--xp-icon-size,22px);--mdc-icon-size:var(--xp-icon-size,22px);color:inherit}
.xp-wifi{display:grid;place-items:center;width:42px;height:42px;flex:none;padding:8px;border-radius:13px;border:1px solid #7399c077;background:#03172bba;color:#a8b3c4;transition:background .15s,border-color .15s}
.xp-wifi ha-icon{display:block;flex:none}
.xp-wifi.xp-connected{color:#66a9ff;border-color:#4e96d699}
.xp-wifi.xp-error{color:#ffb16a;border-color:#d99b6388}
.xp-wifi:hover,.xp-wifi:focus-visible{background:#194465;border-color:#8bc1fa}

.xp-title{position:absolute;z-index:5;left:5.4%;top:17%;display:flex;flex-direction:column;gap:3px}
.xp-title h1{font-size:clamp(32px,3.7vw,62px);line-height:1.02;letter-spacing:.035em;font-weight:730;margin:0;white-space:nowrap}
.xp-title h1 em{font-style:normal;color:#7eaeff}
.xp-subtitle{font-size:clamp(15px,2vw,30px);color:#8192b6;font-weight:400}
.xp-car{position:absolute;z-index:3;width:57%;height:auto;max-height:73%;object-fit:contain;left:21%;bottom:16%;filter:drop-shadow(0 20px 20px #000b) brightness(1.6) contrast(1.00)}
.xp-car.xp-paint-silver_frost{filter:drop-shadow(0 20px 20px #000b) brightness(1.13)}
.xp-car.xp-paint-space_grey{filter:drop-shadow(0 20px 20px #000b) brightness(.78) hue-rotate(4deg)}
.xp-car.xp-paint-jet_black{filter:drop-shadow(0 20px 20px #000b) brightness(.45)}
.xp-car.xp-paint-stellar_purple{filter:drop-shadow(0 20px 20px #000b) brightness(.84) sepia(.13) hue-rotate(190deg)}
.xp-overview-stat{position:absolute;left:5.3%;top:42%;z-index:5;width:18%;max-width:290px;display:flex;flex-direction:column;gap:4px}
.xp-batt-line{display:flex;align-items:center;gap:18px}
.xp-batt-glyph{width:62px;height:90px;border:3px solid #cad7e7;border-radius:11px;position:relative;padding:7px;flex:none;display:flex;align-items:flex-end}
.xp-batt-glyph:before{content:"";position:absolute;width:22px;height:8px;border:3px solid #cad7e7;border-bottom:0;top:-10px;left:calc(50% - 11px);border-radius:4px 4px 0 0}
.xp-batt-fill{width:100%;background:linear-gradient(180deg,#7cefb1,#00ba84);border-radius:4px;min-height:0;box-shadow:0 0 12px #00e4a941}
.xp-stat-label{font-size:clamp(13px,1.3vw,21px);color:#b0c1dd}
.xp-soc{font-size:clamp(42px,5vw,76px);line-height:1.08;font-weight:730;white-space:nowrap}
.xp-unit{font-size:.55em}
.xp-progress{height:12px;background:#294767;border-radius:40px;overflow:hidden;width:100%;position:relative;box-shadow:inset 0 1px 3px #0007}
.xp-progress div{height:100%;background:linear-gradient(90deg,#00da91,#0ceec2);border-radius:40px;box-shadow:0 0 15px #00ffb85a}
.xp-overview-range{margin-top:28px}
.xp-range-num{display:flex;gap:12px;align-items:center;font-size:clamp(27px,3vw,49px);white-space:nowrap;font-weight:700;line-height:1.2;margin-top:8px}
.xp-range-num small{font-size:.54em}
.xp-status-panel{position:absolute;z-index:6;right:2.7%;bottom:11%;width:22%;min-width:264px;background:linear-gradient(125deg,#091a2bda,#051020eb);border:1px solid #6782a058;backdrop-filter:blur(17px);border-radius:24px;padding:0 17px}
.xp-info-row{display:flex;align-items:center;gap:16px;min-height:77px;border-bottom:1px solid #56708a43}
.xp-info-row:last-child{border-bottom:0}
.xp-info-icon{width:38px;flex:none;color:#f0f8ff}
.xp-info-copy{min-width:0;flex:1;display:flex;flex-direction:column;gap:4px}
.xp-info-copy small{font-size:clamp(10px,.99vw,15px);color:#c8d5e7}
.xp-info-copy b{font-size:clamp(12px,1.1vw,18px);font-weight:450;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.xp-status-panel .xp-chevron{color:#dceeff;opacity:.75}
.xp-charge-card{position:absolute;z-index:6;left:2.8%;top:33.5%;width:40.8%;border:1px solid #2089ce88;border-radius:22px;background:linear-gradient(130deg,#041422e8,#06162acb);backdrop-filter:blur(14px);box-shadow:0 10px 55px #0007;padding:clamp(16px,2.4vw,36px) clamp(17px,2.7vw,43px)}
.xp-charge-heading{display:flex;align-items:center;gap:17px;color:var(--xp-mint);font-weight:630;font-size:clamp(17px,2.6vw,40px);margin:0 0 22px}
.xp-charge-heading ha-icon{flex:none;width:clamp(26px,3.6vw,56px);height:clamp(26px,3.6vw,56px);--mdc-icon-size:clamp(26px,3.6vw,56px)}
.xp-charge-card .xp-progress{height:20px}
.xp-charge-main{display:flex;align-items:center;gap:18px;justify-content:space-between;margin-top:23px}
.xp-charge-main .xp-soc{font-size:clamp(40px,5.4vw,86px)}
.xp-charge-divider{height:65px;border-left:1px solid #56708a88}
.xp-charge-range{flex:1;min-width:0}
.xp-charge-range b{display:block;font-size:clamp(22px,2.1vw,36px);margin-top:8px;white-space:nowrap}
.xp-charge-meta{border-top:1px solid #4268878a;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));margin-top:25px;padding-top:22px}
.xp-charge-meta>div{min-width:0;display:flex;flex-direction:column;gap:8px;padding:0 13px;border-right:1px solid #52719066}
.xp-charge-meta>div:first-child{padding-left:0}
.xp-charge-meta>div:last-child{padding-right:0;border-right:0}
.xp-charge-meta small{font-size:clamp(10px,1vw,16px);color:#9eb3d0;white-space:nowrap}
.xp-charge-meta b{font-size:clamp(12px,1.5vw,25px);font-weight:560;white-space:nowrap}
.xp-charge .xp-car{width:52%;left:41%;bottom:12%;height:auto;max-height:70%;z-index:7}
.xp-charge .xp-title{left:5.3%;top:17%}
.xp-station{position:absolute;z-index:2;right:3%;bottom:30%;width:5.3%;height:23%;min-width:45px;border:2px solid #55c8fb;border-radius:13px 13px 6px 6px;background:linear-gradient(90deg,#013861,#041b32 55%,#0b3150);box-shadow:0 0 18px #00c6ff85,inset 0 0 13px #08cafa74;display:grid;place-items:start center;padding-top:25px;font-size:26px;color:#e1f7ff}
.xp-station:before{content:"";position:absolute;bottom:-5px;width:110%;height:7px;background:#03d7cf;filter:blur(4px)}
:host([data-expanded]){position:fixed!important;inset:0!important;width:100vw!important;height:100dvh!important;z-index:2147483100!important;background:#020b15!important;overflow:auto!important}
:host([data-expanded]) ha-card,:host([data-expanded]) .xp-scene{width:100%!important;height:100dvh!important;min-height:550px!important;aspect-ratio:auto!important}
@media(max-width:850px){
.xp-scene{min-height:800px;aspect-ratio:auto}
.xp-header{top:16px;left:4%;right:4%}
.xp-brand{font-size:13px;letter-spacing:.12em}
.xp-header-right{gap:9px}
.xp-title{left:5%;top:89px}
.xp-title h1{font-size:34px}
.xp-subtitle{font-size:18px}
.xp-car{width:106%;left:-2%;bottom:29%;max-height:48%;object-fit:contain}
.xp-overview-stat{left:5%;top:220px;width:43%}
.xp-batt-glyph{height:56px;width:37px;border-width:2px;padding:4px}
.xp-batt-glyph:before{height:5px;top:-7px;border-width:2px}
.xp-batt-line{gap:9px}
.xp-soc{font-size:40px}
.xp-stat-label{font-size:13px}
.xp-progress{height:8px}
.xp-overview-range{margin-top:14px}
.xp-range-num{font-size:26px;margin-top:4px}
.xp-status-panel{width:90%;min-width:0;left:5%;right:5%;bottom:24px;border-radius:16px;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));padding:7px}
.xp-info-row{min-width:0;display:block;padding:7px 10px;border-bottom:0;border-right:1px solid #56708a43;min-height:88px}
.xp-info-row:last-child{border-right:0}
.xp-info-icon{display:none}
.xp-info-copy small{font-size:11px}
.xp-info-copy b{font-size:12px;white-space:normal;overflow-wrap:anywhere}
.xp-status-panel .xp-chevron{display:none}
.xp-charge .xp-title{left:5%;top:83px}
.xp-charge-card{top:225px;left:5%;width:90%;padding:18px}
.xp-charge-heading{font-size:22px;margin-bottom:15px}
.xp-charge-card .xp-progress{height:13px}
.xp-charge-main{margin-top:13px}
.xp-charge-main .xp-soc{font-size:42px}
.xp-charge-range b{font-size:20px}
.xp-charge-divider{height:45px}
.xp-charge-meta{margin-top:15px;padding-top:15px}
.xp-charge-meta small{font-size:10px;white-space:normal}
.xp-charge-meta b{font-size:14px}
.xp-charge .xp-car{width:96%;left:2%;bottom:9%;max-height:36%}
.xp-station{right:5%;bottom:22%;height:13%;min-width:40px;font-size:16px}
}
.xp-meta-tools{position:relative;z-index:25;flex:none;display:flex;align-items:center}
.xp-meta-popover{position:absolute;right:0;top:calc(100% + 9px);width:min(275px,82vw);border:1px solid #6580a388;border-radius:12px;background:#061829f3;padding:12px 14px;box-shadow:0 12px 35px #000b;backdrop-filter:blur(12px);display:flex;flex-direction:column;gap:9px}
.xp-meta-field{display:flex;align-items:center;justify-content:space-between;gap:12px}
.xp-meta-field+.xp-meta-field{padding-top:9px;border-top:1px solid #7399c044}
.xp-meta-popover small{font-size:11px;color:#b1c0d3}
.xp-meta-popover strong{font-size:13px;font-weight:600;color:#f0f7ff;text-align:right;white-space:nowrap}
.xp-cabin-mini{width:100%;height:auto;max-height:140px;margin-top:10px;display:block}
@media(max-width:850px){.xp-header-right{gap:8px}.xp-wifi{width:38px;height:38px;padding:7px}.xp-meta-popover{top:calc(100% + 8px)}}
.xp-car,.xp-car.xp-paint-silver_frost,.xp-car.xp-paint-space_grey,.xp-car.xp-paint-jet_black,.xp-car.xp-paint-stellar_purple{filter:drop-shadow(0 20px 20px #000b)}
.xp-studio-car{mask-image:none;-webkit-mask-image:none}

.xp-tire-screen{position:absolute;z-index:7;inset:26% 4% 4%;display:flex;flex-direction:column}
.xp-tire-actions{position:absolute;right:0;top:-76px;z-index:2;display:flex;justify-content:flex-end}
.xp-tire-actions button{display:flex;align-items:center;gap:8px;border:1px solid #6782a088;background:linear-gradient(125deg,#091a2bda,#051020eb);backdrop-filter:blur(17px);border-radius:13px;padding:11px 15px;color:#f2faff;white-space:nowrap}
.xp-tire-actions button:hover,.xp-tire-actions button:focus-visible{background:#194465}
.xp-tire-stage{width:min(900px,100%);flex:1;min-height:0;align-self:center;display:grid;grid-template-columns:minmax(92px,1fr) minmax(170px,43%) minmax(92px,1fr);grid-template-rows:1fr 1fr;gap:10px;align-items:center}
.xp-tire-center{grid-area:1/2/3/3;min-height:0;height:100%;display:flex;align-items:center;justify-content:center;filter:drop-shadow(0 16px 20px #0009)}
.xp-top-car,.xp-top-cutout{width:100%;max-width:325px;height:100%;max-height:100%;object-fit:contain}
.xp-tire-reading{background:linear-gradient(125deg,#091a2bda,#051020eb);border:1px solid #6782a058;backdrop-filter:blur(17px);border-radius:20px;padding:14px 9px;text-align:center;display:flex;flex-direction:column;gap:4px;min-width:0}
.xp-tire-reading small{color:#c8d5e7;font-size:clamp(10px,1.15vw,15px)}
.xp-tire-reading strong{font-size:clamp(24px,3vw,45px);color:#fff;line-height:1.1}
.xp-tire-reading span{color:#75f4c5;font-size:clamp(11px,1.2vw,17px)}
.xp-tire-reading[data-wheel="tire_fl"]{grid-area:1/1}.xp-tire-reading[data-wheel="tire_fr"]{grid-area:1/3}
.xp-tire-reading[data-wheel="tire_rl"]{grid-area:2/1}.xp-tire-reading[data-wheel="tire_rr"]{grid-area:2/3}
.xp-tire-disclaimer{text-align:center;font-size:10px;color:#b9c9d8;padding-bottom:5px}
@media(max-width:850px){.xp-tire-screen{inset:23% 3% 4%}.xp-tire-actions{top:-52px;right:3px}
.xp-tire-actions button{font-size:12px;padding:8px 10px}
.xp-tire-stage{grid-template-columns:minmax(80px,1fr) minmax(116px,40%) minmax(80px,1fr);gap:5px}
.xp-tire-reading{padding:12px 4px;border-radius:13px}.xp-tire-reading strong{font-size:24px}.xp-tire-reading small{font-size:11px}.xp-tire-reading span{font-size:12px}}
@media(max-width:400px){.xp-tire-stage{grid-template-columns:minmax(70px,1fr) minmax(107px,40%) minmax(70px,1fr)}.xp-tire-reading strong{font-size:21px}}


/* The approved 2026 white G6 cutout is already tightly cropped: frame its pixels to the reference shot. */
.xp-overview .xp-car.xp-reference-cutout{left:25.5%;bottom:26.6%;width:51.4%;max-height:none;filter:drop-shadow(0 13px 13px #0005)}
@media(max-width:850px){.xp-overview .xp-car.xp-reference-cutout{left:-3%;bottom:27%;width:108%;max-height:42%}}
@media(max-width:400px){.xp-charge-meta>div{padding:0 7px}.xp-charge-heading{font-size:19px}.xp-charge-meta b{font-size:12px}.xp-overview-stat{top:219px}.xp-status-panel{grid-template-columns:repeat(3,minmax(0,1fr))}}

/* Opt-in XPENG controls. Keep all existing hero and charging artwork unchanged. */
.xp-ux-dock{position:absolute;z-index:12;bottom:2.5%;left:50%;transform:translateX(-50%);display:flex;align-items:center;justify-content:center;gap:10px;padding:8px 12px;border:1px solid #6598b45c;border-radius:40px;background:#06162acb;backdrop-filter:blur(18px);max-width:96%}
.xp-ux-dock-action{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;min-width:60px;min-height:58px;border:1px solid #78a1b84b;background:#132b4587;border-radius:24px;color:#effbff}
.xp-ux-dock-action ha-icon{color:#99caff}
.xp-ux-dock-action small{font-size:10px;white-space:nowrap}
.xp-ux-dock-action:hover,.xp-ux-dock-action:focus-visible{border-color:#1debca;background:#124965}
.xp-ux-modal{position:absolute;z-index:35;inset:2% 2.5%;padding:16px 20px 25px;overflow:auto;overscroll-behavior:contain;border:1px solid #5e91b078;border-radius:23px;background:linear-gradient(165deg,#060d19f8,#081e34fa);box-shadow:0 28px 75px #000d;backdrop-filter:blur(22px);direction:rtl}
.xp-ux-modal-head{display:flex;align-items:center;gap:15px}
.xp-ux-modal-head h2{margin:0;flex:1;font-size:clamp(18px,2.1vw,29px)}
.xp-ux-modal-head span{color:#b4c8df;font-size:13px}
.xp-ux-modal-head button{border:1px solid #60849d82;background:#12334d;border-radius:12px;padding:8px;display:grid;place-items:center;min-width:43px;min-height:43px}
.xp-ux-tabs{display:flex;gap:10px;margin:13px 0}
.xp-ux-tabs button{border:1px solid #557b9f88;border-radius:18px;padding:10px 19px;background:#1b2b42;color:#bdcee0}
.xp-ux-selected{background:#124c86!important;color:#fff!important;border-color:#54b9ff!important;box-shadow:0 0 0 1px #54b9ff3a inset}
.xp-ux-cabin{position:relative;margin:8px auto 12px;width:min(690px,100%);max-height:350px;border-radius:18px;overflow:hidden;background:linear-gradient(180deg,#06121e,#19304b);border:1px solid #6a81994f}
.xp-ux-cabin svg,.xp-ux-cabin-picture{display:block;width:100%;max-height:325px;object-fit:contain}
.xp-ux-cabin small{display:block;text-align:center;color:#b2c4d9;padding:4px;font-size:10px}
.xp-ux-hotspot{position:absolute;border:1px solid #88c5ff;color:#fff;background:#194879db;border-radius:50%;width:37px;height:37px;display:grid;place-items:center;box-shadow:0 0 17px #007ee95b}
.xp-ux-wheel{top:12%;left:21%}.xp-ux-driver{top:49%;left:25%}.xp-ux-passenger{top:49%;right:25%}.xp-ux-rear{bottom:8%;left:50%}
.xp-ux-climate-card,.xp-ux-range-row,.xp-ux-seat{border:1px solid #6787a165;border-radius:16px;background:#12253bca;padding:14px}
.xp-ux-climate-caption{display:flex;justify-content:space-between;gap:9px;align-items:center}
.xp-ux-climate-caption span{font-size:12px;color:#afc7e2}
.xp-ux-temp-line{display:flex;gap:18px;align-items:center;justify-content:center;margin:12px auto}
.xp-ux-temp-line b{font-size:clamp(29px,3vw,43px);min-width:115px;text-align:center}
.xp-ux-temp-line button{border:1px solid #668ab3;background:#1d344d;width:45px;height:45px;border-radius:50%;font-size:26px}
.xp-ux-pill-row{display:flex;flex-wrap:wrap;gap:10px}
.xp-ux-pill-row button,.xp-ux-nav-seats{display:inline-flex;align-items:center;justify-content:center;gap:8px;border:1px solid #5783a5;border-radius:14px;padding:10px 16px;background:#1b334c}
.xp-ux-range-row{display:flex;flex-direction:column;gap:10px;margin-top:10px}
.xp-ux-range-row span{display:flex;justify-content:space-between;align-items:center;gap:10px}
.xp-ux-nav-seats{margin-top:10px;width:100%}
.xp-ux-modal input[type=range],.xp-ux-charge-limit input[type=range]{width:100%;accent-color:#19dec4;cursor:pointer}
.xp-ux-seats-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.xp-ux-seat h3{margin:0 0 11px;font-size:16px}
.xp-ux-seat-line{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:8px}
.xp-ux-seat-line>span{color:#bcd3e7;font-size:12px}
.xp-ux-seat-options{display:flex;gap:5px}
.xp-ux-seat-options button{min-width:35px;min-height:39px;border-radius:10px;border:1px solid #567491;background:#15263d;padding:5px 8px}
.xp-ux-seat-options button:disabled{opacity:.3;cursor:not-allowed}
.xp-ux-notice{margin:12px 0 0;border-radius:12px;background:#12374f;padding:9px;font-size:12px}
.xp-ux-charge-actions{position:absolute;z-index:12;bottom:3.2%;left:3%;right:3%;display:flex;justify-content:flex-start;gap:10px;align-items:center}
.xp-ux-charge-stop{border:1px solid #11ddc1;border-radius:14px;background:#033b3ebd;color:#9ff7eb;min-height:50px;padding:9px 16px;display:inline-flex;gap:9px;align-items:center;justify-content:center;white-space:nowrap}
.xp-ux-charge-limit{border:1px solid #6f9abb73;background:#081e37e3;border-radius:14px;min-height:50px;display:flex;flex:1;max-width:450px;min-width:150px;flex-direction:column;gap:3px;padding:7px 13px}
.xp-ux-charge-limit span{display:flex;justify-content:space-between;font-size:13px}
.xp-ux-charge-limit input{height:17px}
@media(max-width:850px){
 .xp-overview .xp-ux-dock{bottom:133px;gap:5px;padding:5px 7px}
 .xp-ux-dock-action{min-width:49px;min-height:51px;border-radius:18px;gap:2px}
 .xp-ux-dock-action small{font-size:9px}
 .xp-ux-modal{inset:1.5% 2%;padding:13px}
 .xp-ux-cabin{max-height:290px}
 .xp-ux-cabin svg,.xp-ux-cabin-picture{max-height:285px}
 .xp-ux-seats-grid{grid-template-columns:1fr}
 .xp-ux-charge-actions{bottom:8%;left:4%;right:4%;gap:8px}
 .xp-ux-charge-stop{font-size:12px;padding:6px 10px}
 .xp-ux-charge-limit{min-width:0}
 .xp-charge.xp-has-controls .xp-car{bottom:21%;max-height:26%}
}
@media(max-width:390px){
 .xp-ux-dock{gap:3px}
 .xp-ux-dock-action{min-width:46px;min-height:48px}
 .xp-ux-dock-action small{font-size:8.5px}
 .xp-ux-charge-actions{flex-wrap:wrap;bottom:3%}
 .xp-ux-charge-stop,.xp-ux-charge-limit{flex:1 1 100%}
 .xp-charge.xp-has-controls .xp-car{bottom:29%;max-height:24%}
 .xp-ux-seat-line{align-items:flex-start;flex-direction:column}
}
@media(pointer:coarse){.xp-ux-seat-options button,.xp-ux-dock-action,.xp-ux-pill-row button{min-height:44px}}

/* Matching G6 cabin image hotspot alignment, consistent across both palettes. */
.xp-ux-cabin-art{aspect-ratio:8/5;max-height:none!important}
.xp-ux-cabin-art{aspect-ratio:8/5}
.xp-ux-cabin-art .xp-ux-cabin-picture{display:block;max-height:none!important;width:100%;height:100%;object-fit:contain}
.xp-ux-cabin-art .xp-ux-hotspot{z-index:2;transform:translate(-50%,-50%);width:38px;height:38px}
.xp-ux-cabin-art .xp-ux-wheel{left:27.25%;top:18%}
.xp-ux-cabin-art .xp-ux-driver{left:27%;top:53%}
.xp-ux-cabin-art .xp-ux-passenger{left:72%;top:53%}
.xp-ux-cabin-art .xp-ux-rear_left{left:27.5%;top:86%}
.xp-ux-cabin-art .xp-ux-rear_right{left:72.5%;top:86%}
.xp-ux-active-heat{background:#7b2534e9!important;border-color:#ff8b8b!important;box-shadow:0 0 14px #ff505085!important}
.xp-ux-active-vent{background:#064c89ed!important;border-color:#79cfff!important;box-shadow:0 0 14px #18acff85!important}
@media(max-width:600px){.xp-ux-cabin-art .xp-ux-hotspot{width:32px;height:32px;padding:5px}}
@media(pointer:coarse){.xp-ux-cabin-art .xp-ux-hotspot{min-width:44px;min-height:44px}}

/* Adaptive card-width layout for HA Sections, desktop and mobile browsers. */
@supports (container-type:inline-size){.xp-scene.xp-has-controls{container-name:xpeng-card;container-type:inline-size}}
@container xpeng-card (max-width:650px){
 .xp-ux-dock{bottom:127px;gap:5px;padding:5px 7px;max-width:94%}
 .xp-ux-dock-action{min-width:49px;min-height:50px;border-radius:18px;gap:2px}
 .xp-ux-dock-action small{font-size:9px}
 .xp-ux-modal{inset:1.5% 2%;padding:13px}
 .xp-ux-seats-grid,.xp-ux-vehicle-statuses,.xp-ux-vehicle-buttons{grid-template-columns:repeat(2,minmax(0,1fr))}
 .xp-ux-seat-line{align-items:flex-start;flex-direction:column}
}
@container xpeng-card (max-width:430px){
 .xp-ux-dock{bottom:134px;gap:2px;padding:4px}
 .xp-ux-dock-action{min-width:44px;min-height:48px}
 .xp-ux-dock-action small{font-size:8px}
 .xp-ux-seats-grid{grid-template-columns:1fr}
 .xp-ux-vehicle-buttons{grid-template-columns:repeat(2,minmax(0,1fr))}
 .xp-ux-charge-actions{bottom:8%;gap:6px}
 .xp-ux-charge-stop{padding:6px 9px;font-size:12px}
}
/* Native XPENG securing/lighting controls: no direct Access actions. */
.xp-ux-vehicle-panel{margin-top:10px}
.xp-ux-vehicle-panel h3{font-size:16px;margin:18px 0 10px}
.xp-ux-vehicle-statuses{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px}
.xp-ux-vehicle-state{border:1px solid #517a977c;background:#11233a;border-radius:14px;padding:12px;display:flex;flex-direction:column;gap:7px;min-width:0}
.xp-ux-vehicle-state small{font-size:12px;color:#a4bcce}
.xp-ux-vehicle-state strong{font-size:14px;overflow-wrap:anywhere}
.xp-ux-vehicle-buttons{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
.xp-ux-vehicle-buttons button{display:flex;align-items:center;justify-content:center;gap:9px;padding:15px 10px;min-height:56px;border:1px solid #4a92ba92;border-radius:14px;background:#103149a8}
.xp-ux-vehicle-buttons button:hover{background:#12546e}
.xp-ux-note{color:#a9bac8;font-size:12px;line-height:1.6;margin-top:22px}
@media(max-width:600px){.xp-ux-vehicle-statuses,.xp-ux-vehicle-buttons{grid-template-columns:repeat(2,minmax(0,1fr))}.xp-ux-vehicle-buttons button{min-height:50px;padding:9px 7px;font-size:12px}}

/* New G6 photo: portrait cabin top view; hotspots line up with the actual seats. */
.xp-ux-cabin-art.xp-ux-cabin-portrait{aspect-ratio:480/853;width:min(420px,100%);max-height:none!important;margin:10px auto 18px;overflow:hidden}
.xp-ux-cabin-portrait .xp-ux-cabin-picture{display:block;width:100%;height:auto;max-height:none!important;object-fit:contain}
.xp-ux-cabin-portrait .xp-ux-wheel{left:27%;top:21%}
.xp-ux-cabin-portrait .xp-ux-driver{left:28%;top:41%}
.xp-ux-cabin-portrait .xp-ux-passenger{left:72%;top:41%}
.xp-ux-cabin-portrait .xp-ux-rear_left{left:28%;top:77%}
.xp-ux-cabin-portrait .xp-ux-rear_right{left:72%;top:77%}
.xp-ux-port-panel{padding:12px;max-width:590px;margin:auto}
.xp-ux-port-state{display:flex;align-items:center;gap:18px;border:1px solid #4b77976e;border-radius:18px;background:#122640;padding:20px}
.xp-ux-port-state>div{display:flex;flex-direction:column;gap:6px}
.xp-ux-port-state small{opacity:.75}
.xp-ux-port-actions{display:flex;flex-wrap:wrap;gap:12px;margin:18px 0}
.xp-ux-port-action{display:flex;align-items:center;justify-content:center;gap:10px;border-radius:18px;background:#145069;border:1px solid #36a6bc;padding:14px 18px;min-height:48px;flex:1}
@media(max-width:450px){.xp-ux-port-panel{padding:5px}.xp-ux-port-action{font-size:13px}.xp-ux-cabin-portrait .xp-ux-hotspot{width:44px;height:44px}}

.xp-ux-dock-action:disabled{opacity:.4;cursor:not-allowed}
.xp-ux-climate-bottom{margin-top:12px}
.xp-ux-seat-sheet{margin:12px 0;padding:12px;background:#14253adf;border:1px solid #4a88ad;border-radius:18px}
.xp-ux-sheet-title{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}
.xp-ux-sheet-title button{border:1px solid #507d99;background:#19354b;padding:8px 12px;border-radius:12px}
.xp-ux-access-panel{padding:16px 3px}
.xp-ux-access-head{display:flex;align-items:center;gap:15px;border-bottom:1px solid #51748c50;padding:12px}
.xp-ux-access-head h3{margin:0 0 6px;font-size:21px}
.xp-ux-access-head p{margin:0;color:#abc1d2}
.xp-ux-access-states{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin:12px 0}
.xp-ux-access-state{border:1px solid #61849a59;background:#173047ab;border-radius:12px;padding:11px;display:flex;justify-content:space-between;gap:7px}
.xp-ux-access-state span{color:#aec4d5}
.xp-ux-access-buttons{display:flex;gap:10px;flex-wrap:wrap;margin-top:18px}
.xp-ux-access-buttons button{border:1px solid #467e9a;background:#12445a;padding:12px 16px;border-radius:14px;display:inline-flex;align-items:center;gap:8px;min-height:48px;flex:1}
.xp-ux-access-buttons button:disabled{opacity:.4;cursor:not-allowed}
.xp-ux-map-stage{min-height:260px;border-radius:14px;overflow:hidden;background:#0c2237;display:flex;align-items:center;justify-content:center}
.xp-ux-map-stage hui-map-card{display:block;width:100%;min-height:300px}
.xp-ux-modal-map .xp-ux-map-panel{width:100%;margin:12px auto 0}
.xp-ux-modal-map .xp-ux-map-stage{min-height:clamp(350px,51vh,520px)}
.xp-ux-modal-map .xp-ux-map-stage hui-map-card{display:block;align-self:stretch;width:100%;min-height:clamp(350px,51vh,520px)}
@container xpeng-layout (max-width:600px){
 .xp-ux-modal-map .xp-ux-map-stage{min-height:260px}
 .xp-ux-modal-map .xp-ux-map-stage hui-map-card{min-height:260px}
}
.xp-ux-map-actions{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:14px 0 7px}
.xp-ux-map-actions button{display:flex;align-items:center;justify-content:center;gap:10px;padding:14px;border:1px solid #4d89ae;background:#133b5b;border-radius:14px;min-height:48px}
.xp-ux-map-actions button:disabled{opacity:.4;cursor:not-allowed}
@media(max-width:600px){
 .xp-ux-access-panel{padding:8px 0}
 .xp-ux-map-stage{min-height:250px}
 .xp-ux-map-actions button{font-size:12px;padding:10px 6px}
}


/* Tap to cycle each seat's actual Xpengtk select entity (not another page).
 * Zones line up with both paired cabin image palettes and shrink with the card.
 */
.xp-ux-cabin-art .xp-ux-hotspot-zone{position:absolute;z-index:4;display:flex;align-items:center;justify-content:center;gap:4px;transform:translate(-50%,-50%);width:auto;height:auto;max-width:44%;background:transparent;box-shadow:none}
.xp-ux-cycle{border:1px solid #608ead;background:#0c243fdc;color:#ebf6ff;width:42px;height:44px;min-width:42px;min-height:44px;border-radius:14px;display:flex;align-items:center;justify-content:center;gap:3px;box-shadow:0 3px 15px #06111e70;cursor:pointer;touch-action:manipulation}
.xp-ux-cycle ha-icon{width:17px;height:17px;--mdc-icon-size:17px}
.xp-ux-cycle .xp-ux-level{font-size:13px;font-weight:800;font-variant-numeric:tabular-nums;min-width:8px}
.xp-ux-cycle-heat.xp-ux-cycle-on{background:#963746ed;border-color:#ff8b8b;color:#fff;box-shadow:0 0 12px #ff5b5780}
.xp-ux-cycle-vent.xp-ux-cycle-on{background:#145b9de9;border-color:#6cd3ff;color:#fff;box-shadow:0 0 12px #47aeff80}
.xp-ux-cycle-busy{outline:1px dotted #dce9f2;outline-offset:2px}
.xp-ux-cycle:focus-visible{outline:3px solid #fff;outline-offset:3px}
.xp-ux-cabin-fallback .xp-ux-wheel{top:21%;left:26%}
.xp-ux-cabin-fallback .xp-ux-driver{top:49%;left:26%}
.xp-ux-cabin-fallback .xp-ux-passenger{top:49%;left:74%}
.xp-ux-cabin-fallback .xp-ux-rear_left{top:86%;left:26%}
.xp-ux-cabin-fallback .xp-ux-rear_right{top:86%;left:74%}
@media(max-width:600px){
 .xp-ux-cabin-art .xp-ux-hotspot-zone{gap:2px}
 .xp-ux-cycle{width:37px;min-width:37px;height:44px;min-height:44px;padding:3px;gap:2px}
 .xp-ux-cycle ha-icon{width:15px;height:15px;--mdc-icon-size:15px}
 .xp-ux-cycle .xp-ux-level{font-size:12px}
}
@container xpeng-card (max-width:430px){
 .xp-ux-cycle{width:33px;min-width:33px;height:44px;min-height:44px;padding:2px}
 .xp-ux-hotspot-zone{gap:2px}
}

/* Opt-in extra controls: reuse the approved XPENG background and in-card overlay. */
.xp-more-trigger{width:42px;height:42px;display:grid;place-items:center;cursor:pointer;
 border:1px solid #7aa0bc81;border-radius:14px;color:#e9f9ff;background:#122a43b8}
.xp-more-trigger:focus-visible,.xp-extra-tile:focus-visible{outline:2px solid #a0ecff;outline-offset:2px}
.xp-extra-body{width:min(760px,100%);margin:16px auto 0}
.xp-extra-subtitle{font-size:13px;color:#aac7df;margin:0 0 20px}
.xp-extra-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
.xp-extra-tile{display:flex;align-items:center;justify-content:center;flex-direction:column;gap:12px;
 text-align:center;min-height:150px;padding:14px 8px;border:1px solid #4c87ab9c;border-radius:19px;
 background:linear-gradient(155deg,#142b44e3,#071a2eea);color:#f0f8ff;cursor:pointer}
.xp-extra-tile:hover{background:#163959}
.xp-extra-tile ha-icon{color:#77d7fb}
.xp-extra-tile b{font-size:16px}
.xp-extra-tile small{font-size:11px;color:#a8c6de;line-height:1.4}
.xp-extra-heading{display:flex;align-items:center;gap:14px;font-size:19px;margin-bottom:15px}
.xp-extra-heading button{border:1px solid #5d88a7;background:#1a3753;color:#fff;border-radius:11px;
 padding:10px;display:grid;place-items:center}
.xp-extra-details{display:grid;gap:9px}
.xp-extra-line{display:flex;justify-content:space-between;align-items:center;gap:15px;
 border:1px solid #6387aa60;background:#10283bdf;padding:13px 15px;border-radius:14px;min-height:29px}
.xp-extra-line span{color:#acc8dd;font-size:13px}
.xp-extra-line b{font-size:15px;overflow-wrap:anywhere;min-width:0;text-align:end}
.xp-extra-line small{font-size:11px;color:#a6bfd5}
.xp-extra-action{border:1px solid #23b5d6;background:#134e67d9;color:#f2fcff;
 padding:13px;border-radius:14px;min-height:48px;cursor:pointer}
.xp-extra-action:disabled{opacity:.35;cursor:not-allowed}
.xp-extra-range{display:flex;flex-direction:column;gap:11px;padding:13px 15px;
 border:1px solid #6387aa60;background:#10283bdf;border-radius:14px}
.xp-extra-range span{display:flex;align-items:center;justify-content:space-between;gap:12px;color:#c8dfec}
.xp-extra-range input{width:100%;accent-color:#29d9bd}
@media(max-width:600px){.xp-more-trigger{width:40px;height:40px}.xp-extra-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}
 .xp-extra-tile{min-height:120px;padding:11px 6px;gap:8px}.xp-extra-tile b{font-size:14px}
 .xp-extra-body{margin:10px auto 0}}
@container xpeng-card (max-width:430px){.xp-extra-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
 .xp-extra-tile{min-height:116px}.xp-extra-line{padding:11px;gap:8px}}

/* A portrait cabin must not push the A/C temperature completely off-screen on phones. */
@media(max-width:600px){
 .xp-ux-modal-climate .xp-ux-cabin-art.xp-ux-cabin-portrait{width:min(280px,100%);margin:5px auto 10px}
 .xp-ux-modal-climate .xp-ux-temp-line{margin:8px auto}
 .xp-ux-modal-climate .xp-ux-climate-card{padding:11px}
 .xp-ux-modal-climate .xp-ux-cycle{min-height:44px}
}
@container xpeng-card (max-width:430px){
 .xp-ux-modal-climate .xp-ux-cabin-art.xp-ux-cabin-portrait{width:min(270px,100%)}
}

/* Verified Xpengtk A/C actions, intentionally excluding unsupported app tiles. */
.xp-ux-climate-features{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:11px;margin:13px 0 8px}
.xp-ux-climate-feature{display:flex;flex-direction:column;align-items:center;justify-content:center;
 gap:9px;min-height:105px;padding:12px 8px;border:1px solid #658cab80;border-radius:16px;
 background:#0f2942dd;color:#f0f8ff;cursor:pointer;text-align:center}
.xp-ux-climate-feature ha-icon{color:#bbdbfa}
.xp-ux-climate-feature span{font-size:14px;font-weight:650}
.xp-ux-climate-feature small{font-size:11px;color:#b0c9db}
.xp-ux-climate-feature:focus-visible{outline:2px solid #9ddaff;outline-offset:2px}
@media(max-width:600px){.xp-ux-climate-features{grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}
 .xp-ux-climate-feature{min-height:95px;padding:9px 4px;gap:7px}
 .xp-ux-climate-feature span{font-size:11px}
 .xp-ux-climate-feature small{font-size:9px;line-height:1.3}}
@container xpeng-card (max-width:390px){.xp-ux-climate-feature span{font-size:10px}}

.xp-extra-schedule-line{display:flex;align-items:center;gap:8px}
.xp-extra-schedule-line .xp-extra-line{flex:1}
.xp-extra-schedule-toggle{min-height:44px;padding:10px 12px;border:1px solid #38c0d6;
 border-radius:13px;color:#d9faf5;background:#0c4e5de6;cursor:pointer;white-space:nowrap}
@media(max-width:600px){.xp-extra-schedule-line{flex-wrap:wrap}
 .xp-extra-schedule-line .xp-extra-line{flex-basis:100%}
 .xp-extra-schedule-toggle{width:100%}}


/* Automatic card-width adaptation even when Home Assistant Sections renders a narrow
   card on a wide desktop monitor. Legacy viewport media rules above remain as fallback. */
@container xpeng-layout (max-width:850px){
.xp-scene{min-height:800px;aspect-ratio:auto}
.xp-header{top:16px;left:4%;right:4%}
.xp-brand{font-size:13px;letter-spacing:.12em}
.xp-header-right{gap:9px}
.xp-title{left:5%;top:89px}
.xp-title h1{font-size:34px}
.xp-subtitle{font-size:18px}
.xp-car{width:106%;left:-2%;bottom:29%;max-height:48%;object-fit:contain}
.xp-overview-stat{left:5%;top:220px;width:43%}
.xp-batt-glyph{height:56px;width:37px;border-width:2px;padding:4px}
.xp-batt-glyph:before{height:5px;top:-7px;border-width:2px}
.xp-batt-line{gap:9px}
.xp-soc{font-size:40px}
.xp-stat-label{font-size:13px}
.xp-progress{height:8px}
.xp-overview-range{margin-top:14px}
.xp-range-num{font-size:26px;margin-top:4px}
.xp-status-panel{width:90%;min-width:0;left:5%;right:5%;bottom:24px;border-radius:16px;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));padding:7px}
.xp-info-row{min-width:0;display:block;padding:7px 10px;border-bottom:0;border-right:1px solid #56708a43;min-height:88px}
.xp-info-row:last-child{border-right:0}
.xp-info-icon{display:none}
.xp-info-copy small{font-size:11px}
.xp-info-copy b{font-size:12px;white-space:normal;overflow-wrap:anywhere}
.xp-status-panel .xp-chevron{display:none}
.xp-charge .xp-title{left:5%;top:83px}
.xp-charge-card{top:225px;left:5%;width:90%;padding:18px}
.xp-charge-heading{font-size:22px;margin-bottom:15px}
.xp-charge-card .xp-progress{height:13px}
.xp-charge-main{margin-top:13px}
.xp-charge-main .xp-soc{font-size:42px}
.xp-charge-range b{font-size:20px}
.xp-charge-divider{height:45px}
.xp-charge-meta{margin-top:15px;padding-top:15px}
.xp-charge-meta small{font-size:10px;white-space:normal}
.xp-charge-meta b{font-size:14px}
.xp-charge .xp-car{width:96%;left:2%;bottom:9%;max-height:36%}
.xp-station{right:5%;bottom:22%;height:13%;min-width:40px;font-size:16px}
}
@container xpeng-layout (max-width:850px){.xp-header-right{gap:8px}.xp-wifi{width:38px;height:38px;padding:7px}.xp-meta-popover{top:calc(100% + 8px)}}
@container xpeng-layout (max-width:850px){.xp-tire-screen{inset:23% 3% 4%}.xp-tire-actions{top:-52px;right:3px}
.xp-tire-actions button{font-size:12px;padding:8px 10px}
.xp-tire-stage{grid-template-columns:minmax(80px,1fr) minmax(116px,40%) minmax(80px,1fr);gap:5px}
.xp-tire-reading{padding:12px 4px;border-radius:13px}.xp-tire-reading strong{font-size:24px}.xp-tire-reading small{font-size:11px}.xp-tire-reading span{font-size:12px}}
@container xpeng-layout (max-width:400px){.xp-tire-stage{grid-template-columns:minmax(70px,1fr) minmax(107px,40%) minmax(70px,1fr)}.xp-tire-reading strong{font-size:21px}}
@container xpeng-layout (max-width:850px){.xp-overview .xp-car.xp-reference-cutout{left:-3%;bottom:27%;width:108%;max-height:42%}}
@container xpeng-layout (max-width:400px){.xp-charge-meta>div{padding:0 7px}.xp-charge-heading{font-size:19px}.xp-charge-meta b{font-size:12px}.xp-overview-stat{top:219px}.xp-status-panel{grid-template-columns:repeat(3,minmax(0,1fr))}}
@container xpeng-layout (max-width:850px){
 .xp-overview .xp-ux-dock{bottom:133px;gap:5px;padding:5px 7px}
 .xp-ux-dock-action{min-width:49px;min-height:51px;border-radius:18px;gap:2px}
 .xp-ux-dock-action small{font-size:9px}
 .xp-ux-modal{inset:1.5% 2%;padding:13px}
 .xp-ux-cabin{max-height:290px}
 .xp-ux-cabin svg,.xp-ux-cabin-picture{max-height:285px}
 .xp-ux-seats-grid{grid-template-columns:1fr}
 .xp-ux-charge-actions{bottom:8%;left:4%;right:4%;gap:8px}
 .xp-ux-charge-stop{font-size:12px;padding:6px 10px}
 .xp-ux-charge-limit{min-width:0}
 .xp-charge.xp-has-controls .xp-car{bottom:21%;max-height:26%}
}
@container xpeng-layout (max-width:390px){
 .xp-ux-dock{gap:3px}
 .xp-ux-dock-action{min-width:46px;min-height:48px}
 .xp-ux-dock-action small{font-size:8.5px}
 .xp-ux-charge-actions{flex-wrap:wrap;bottom:3%}
 .xp-ux-charge-stop,.xp-ux-charge-limit{flex:1 1 100%}
 .xp-charge.xp-has-controls .xp-car{bottom:29%;max-height:24%}
 .xp-ux-seat-line{align-items:flex-start;flex-direction:column}
}
@container xpeng-layout (max-width:600px){.xp-ux-cabin-art .xp-ux-hotspot{width:32px;height:32px;padding:5px}}
@container xpeng-layout (max-width:600px){.xp-ux-vehicle-statuses,.xp-ux-vehicle-buttons{grid-template-columns:repeat(2,minmax(0,1fr))}.xp-ux-vehicle-buttons button{min-height:50px;padding:9px 7px;font-size:12px}}
@container xpeng-layout (max-width:450px){.xp-ux-port-panel{padding:5px}.xp-ux-port-action{font-size:13px}.xp-ux-cabin-portrait .xp-ux-hotspot{width:44px;height:44px}}
@container xpeng-layout (max-width:600px){
 .xp-ux-access-panel{padding:8px 0}
 .xp-ux-map-stage{min-height:250px}
 .xp-ux-map-actions button{font-size:12px;padding:10px 6px}
}
@container xpeng-layout (max-width:600px){
 .xp-ux-cabin-art .xp-ux-hotspot-zone{gap:2px}
 .xp-ux-cycle{width:37px;min-width:37px;height:44px;min-height:44px;padding:3px;gap:2px}
 .xp-ux-cycle ha-icon{width:15px;height:15px;--mdc-icon-size:15px}
 .xp-ux-cycle .xp-ux-level{font-size:12px}
}
@container xpeng-layout (max-width:600px){.xp-more-trigger{width:40px;height:40px}.xp-extra-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}
 .xp-extra-tile{min-height:120px;padding:11px 6px;gap:8px}.xp-extra-tile b{font-size:14px}
 .xp-extra-body{margin:10px auto 0}}
@container xpeng-layout (max-width:600px){
 .xp-ux-modal-climate .xp-ux-cabin-art.xp-ux-cabin-portrait{width:min(280px,100%);margin:5px auto 10px}
 .xp-ux-modal-climate .xp-ux-temp-line{margin:8px auto}
 .xp-ux-modal-climate .xp-ux-climate-card{padding:11px}
 .xp-ux-modal-climate .xp-ux-cycle{min-height:44px}
}
@container xpeng-layout (max-width:600px){.xp-ux-climate-features{grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}
 .xp-ux-climate-feature{min-height:95px;padding:9px 4px;gap:7px}
 .xp-ux-climate-feature span{font-size:11px}
 .xp-ux-climate-feature small{font-size:9px;line-height:1.3}}
@container xpeng-layout (max-width:600px){.xp-extra-schedule-line{flex-wrap:wrap}
 .xp-extra-schedule-line .xp-extra-line{flex-basis:100%}
 .xp-extra-schedule-toggle{width:100%}}
@container xpeng-layout (max-width:520px){
 .xp-scene{min-height:780px}
 .xp-title{top:84px}
 .xp-title h1{font-size:30px}
 .xp-overview-stat{left:5%;top:207px;width:53%;max-width:none}
 .xp-overview .xp-car{left:0;width:100%;bottom:29%;max-height:38%}
 .xp-overview .xp-car.xp-reference-cutout{left:0;width:100%;bottom:29%;max-height:38%}
 .xp-status-panel{left:4%;right:4%;width:92%;bottom:14px;grid-template-columns:repeat(2,minmax(0,1fr));gap:0;padding:5px 10px}
 .xp-info-row{min-height:57px;padding:8px 7px}
 .xp-info-row:nth-child(2){border-right:0}
 .xp-info-row:last-child{grid-column:1/-1;min-height:48px;border-top:1px solid #56708a43;padding-left:10px;border-right:0}
 .xp-info-copy b{font-size:12px}
 .xp-charge-card{left:4%;width:92%;top:206px;padding:16px 14px}
 .xp-charge-heading{margin-bottom:15px}
 .xp-charge .xp-car{width:100%;left:0;bottom:5%;max-height:30%}
 .xp-station{right:4%;bottom:16%;height:12%}
 .xp-ux-dock{bottom:177px}
}
@container xpeng-layout (max-width:360px){
 .xp-title h1{font-size:28px}
 .xp-overview-stat{width:58%}
 .xp-charge-main{gap:10px}
 .xp-charge-range b{font-size:17px}
 .xp-charge-meta>div{padding:0 5px}
 .xp-charge-meta b{font-size:12px}
 .xp-status-panel{padding:5px 7px}
}

/* Keep the G6 Charging-now composition unchanged while still allowing an accessible
   control modal when the user taps the original visible heading. */
.xp-charge-heading-action{background:transparent;border:0;padding:0;text-align:left;width:auto;cursor:pointer;color:var(--xp-mint)}
.xp-charge-heading-action:focus-visible{outline:2px solid #82dbfe;outline-offset:4px;border-radius:8px}
.xp-ux-modal-charge_controls .xp-ux-charge-actions{position:static;inset:auto;display:flex;flex-wrap:wrap;margin:12px 0 20px}
.xp-ux-modal-charge_controls .xp-ux-charge-limit{max-width:none}
.xp-ux-modal-charge_controls .xp-ux-port-panel{margin-top:15px}
.xp-maintenance-page{max-width:940px;margin:0 auto}
.xp-maintenance-page h3{font-size:17px;margin:15px 0 8px;color:#d8f5fa}
.xp-ux-modal-maintenance .xp-tire-screen{position:relative;inset:auto;display:block;height:300px;min-height:260px;margin:0 auto 16px;width:100%}
.xp-ux-modal-maintenance .xp-tire-stage{width:min(690px,100%);height:100%;min-height:0;grid-template-columns:minmax(60px,1fr) minmax(100px,43%) minmax(60px,1fr);grid-template-rows:1fr 1fr;gap:7px}
.xp-ux-modal-maintenance .xp-tire-reading{padding:7px 4px;border-radius:12px}
.xp-ux-modal-maintenance .xp-tire-reading strong{font-size:clamp(17px,2vw,27px)}
.xp-maint-info{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
.xp-ux-modal-maintenance .xp-extra-line{overflow-wrap:anywhere;gap:9px}
.xp-ux-charge-schedule{max-width:590px;margin:20px auto}
.xp-ux-access-buttons button:disabled,.xp-ux-port-actions button:disabled{opacity:.45;cursor:not-allowed}
@container xpeng-layout (max-width:520px){
 .xp-maint-info{grid-template-columns:1fr}
 .xp-ux-modal-maintenance .xp-tire-screen{height:250px;min-height:240px}
 .xp-ux-modal-maintenance .xp-tire-reading strong{font-size:18px}
}

/* The home dashboard owns the only navigation menu. Subpages show Back only. */
.xp-ux-dock-seven{gap:clamp(4px,.6vw,10px);max-width:96%;padding:8px 10px;bottom:2.3%;border-radius:26px}
.xp-ux-dock-seven .xp-ux-dock-action{flex:0 1 84px;min-width:66px;max-width:88px;min-height:63px;padding:6px 4px;border-radius:17px}
.xp-ux-dock-seven .xp-ux-dock-action small{font-size:11px}
.xp-page-back{position:absolute;z-index:22;top:10%;right:3.5%;min-height:44px;border:1px solid #6d9dbbba;border-radius:13px;background:#0b2c48e9;color:#effaff;display:flex;align-items:center;gap:9px;padding:8px 13px;cursor:pointer;direction:rtl}
.xp-page-back:hover,.xp-page-back:focus-visible{background:#145371;border-color:#17dfcd}
.xp-ux-modal-head{position:sticky;top:-16px;z-index:9;padding:8px 0 12px;background:linear-gradient(180deg,#071626 78%,#07162600)}
@container xpeng-layout (max-width:850px){
 .xp-home-navigation .xp-ux-dock-seven{bottom:22px;left:50%;max-width:94%;width:min(550px,94%);display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:5px;padding:7px;border-radius:18px}
 .xp-home-navigation .xp-ux-dock-seven .xp-ux-dock-action{width:100%;min-width:0;max-width:none;min-height:53px;padding:4px;gap:3px}
 .xp-home-navigation .xp-ux-dock-seven .xp-ux-dock-action small{font-size:10px;white-space:normal;line-height:1.15}
 .xp-page-back{top:22px;right:4%;padding:6px 10px}
}
@container xpeng-layout (max-width:360px){
 .xp-home-navigation .xp-ux-dock-seven{bottom:20px;gap:3px}
 .xp-home-navigation .xp-ux-dock-seven .xp-ux-dock-action{min-height:49px}
 .xp-home-navigation .xp-ux-dock-seven .xp-ux-dock-action small{font-size:9px}
}

/* Home content parity: controls and status exist at every card width.
 * Scale rather than hide; width is the HA card container, not browser viewport.
 */
.xp-home-navigation .xp-title h1{font-size:clamp(25px,3.25cqw,46px)}
.xp-home-navigation .xp-subtitle{font-size:clamp(13px,1.35cqw,19px)}
.xp-home-navigation .xp-overview .xp-car{width:50%;left:25%;bottom:18%;max-height:62%}
.xp-home-navigation .xp-overview-stat{width:19%;top:38%;max-width:250px}
.xp-home-navigation .xp-overview-stat .xp-batt-glyph{height:64px;width:44px}
.xp-home-navigation .xp-overview-stat .xp-soc{font-size:clamp(32px,4cqw,59px)}
.xp-home-navigation .xp-overview-stat .xp-range-num{font-size:clamp(21px,2.5cqw,34px)}
.xp-home-navigation .xp-overview-stat .xp-range-num ha-icon{width:clamp(18px,2.1cqw,28px);height:clamp(18px,2.1cqw,28px);--mdc-icon-size:clamp(18px,2.1cqw,28px)}
.xp-home-navigation .xp-status-panel{display:flex;flex-direction:column;right:3%;bottom:15%;width:21%;min-width:0;padding:3px 11px;border-radius:15px}
.xp-home-navigation .xp-status-panel .xp-info-row{min-height:60px;gap:8px}
.xp-home-navigation .xp-status-panel .xp-info-icon{width:24px}
.xp-home-navigation .xp-status-panel .xp-info-icon ha-icon{width:23px;height:23px;--mdc-icon-size:23px}
.xp-home-navigation .xp-status-panel .xp-info-copy small{font-size:clamp(10px,.9cqw,13px)}
.xp-home-navigation .xp-status-panel .xp-info-copy b{font-size:clamp(11px,1cqw,15px)}
.xp-home-navigation .xp-ux-dock-seven{max-width:94%;width:max-content;gap:6px;padding:5px 8px;bottom:2.5%;border-radius:19px}
.xp-home-navigation .xp-ux-dock-seven .xp-ux-dock-action{flex:0 1 70px;min-width:61px;max-width:76px;min-height:54px;padding:4px 5px;border-radius:14px}
.xp-home-navigation .xp-ux-dock-seven .xp-ux-dock-action small{font-size:10px;line-height:1.15}
.xp-home-navigation .xp-ux-dock-seven ha-icon{width:19px;height:19px;--mdc-icon-size:19px!important;--xp-icon-size:19px!important}
@container xpeng-layout (max-width:850px){
 .xp-home-navigation .xp-overview .xp-car{width:94%;left:3%;bottom:36%;max-height:31%}
 .xp-home-navigation .xp-overview-stat{top:205px;left:5%;width:52%;max-width:none}
 .xp-home-navigation .xp-status-panel{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));width:92%;left:4%;right:4%;bottom:153px;padding:5px 8px}
 .xp-home-navigation .xp-status-panel .xp-info-row{display:flex;min-height:62px;padding:6px 8px;border-right:1px solid #56708a43;gap:4px}
 .xp-home-navigation .xp-status-panel .xp-info-row:last-child{border-right:0}
 .xp-home-navigation .xp-status-panel .xp-info-icon{display:none}
 .xp-home-navigation .xp-status-panel .xp-info-copy b{font-size:11px;white-space:normal}
 .xp-home-navigation .xp-ux-dock-seven{bottom:19px;width:min(550px,94%);gap:5px;padding:7px;display:grid;grid-template-columns:repeat(4,minmax(0,1fr))}
 .xp-home-navigation .xp-ux-dock-seven .xp-ux-dock-action{width:100%;min-width:0;max-width:none;min-height:53px;padding:4px;gap:3px}
}
@container xpeng-layout (max-width:520px){
 .xp-home-navigation .xp-overview .xp-car{left:0;width:100%;bottom:34%;max-height:23%}
 .xp-home-navigation .xp-overview-stat{top:201px;width:55%}
 .xp-home-navigation .xp-status-panel{grid-template-columns:repeat(2,minmax(0,1fr));bottom:155px;padding:5px 9px}
 .xp-home-navigation .xp-status-panel .xp-info-row{min-height:51px;border-right:1px solid #56708a43;padding:5px 7px}
 .xp-home-navigation .xp-status-panel .xp-info-row:nth-child(2){border-right:0}
 .xp-home-navigation .xp-status-panel .xp-info-row:last-child{grid-column:1/-1;min-height:40px;border-right:0;border-top:1px solid #56708a43}
 .xp-home-navigation .xp-ux-dock-seven{bottom:18px}
}
@container xpeng-layout (max-width:360px){
 .xp-home-navigation .xp-overview .xp-car{bottom:35%;max-height:22%}
 .xp-home-navigation .xp-status-panel{bottom:144px}
 .xp-home-navigation .xp-ux-dock-seven{bottom:14px}
 .xp-home-navigation .xp-ux-dock-seven .xp-ux-dock-action{min-height:48px}
 .xp-home-navigation .xp-ux-dock-seven .xp-ux-dock-action small{font-size:9px}
}
/* Maintenance is reached via one navigation button only: never render a Home
 * maintenance summary card. Keep the location status as a small independent row.
 * In legacy status-only configuration, expose one dedicated Maintenance button. */
.xp-maintenance-home-button{position:absolute;z-index:12;right:3%;bottom:3%;min-height:46px;display:flex;gap:7px;align-items:center;justify-content:center;padding:8px 16px;border-radius:14px;background:#102e47e8;border:1px solid #6a9db775;color:#e9fcff;cursor:pointer}
.xp-maintenance-home-button:hover,.xp-maintenance-home-button:focus-visible{border-color:#20e1ca;background:#164b64}
.xp-overview:not(.xp-has-controls) .xp-status-panel{bottom:14%}
.xp-home-navigation .xp-status-panel{min-height:44px}
@container xpeng-layout (max-width:850px){
 .xp-home-navigation .xp-status-panel{display:block;left:4%;right:4%;width:92%;bottom:151px;padding:3px 9px}
 .xp-home-navigation .xp-status-panel .xp-info-row{display:flex;align-items:center;grid-column:auto;min-height:43px;border:0;padding:5px 8px}
 .xp-overview:not(.xp-has-controls) .xp-status-panel{bottom:84px}
 .xp-overview:not(.xp-has-controls) .xp-maintenance-home-button{bottom:16px;right:4%}
}
@container xpeng-layout (max-width:360px){
 .xp-home-navigation .xp-status-panel{bottom:148px}
}
/* Desktop climate = cabin + controls side by side; mobile = one scrolling page.
   The two owner photos remain unchanged and preserve their proportions. */
.xp-ux-modal-climate .xp-climate-layout{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(300px,.9fr);gap:clamp(14px,2.5vw,42px);align-items:start;max-width:1180px;margin:12px auto 0;direction:ltr}
.xp-ux-modal-climate .xp-climate-layout>.xp-ux-cabin-art.xp-ux-cabin-portrait{width:min(354px,100%);margin:0 auto;height:auto;max-height:none}
.xp-ux-modal-climate .xp-climate-layout>.xp-ux-climate-bottom{margin:0;direction:rtl;min-width:0;display:flex;flex-direction:column;gap:10px}
.xp-ux-modal-climate .xp-climate-layout .xp-ux-climate-card,
.xp-ux-modal-climate .xp-climate-layout .xp-ux-range-row{margin:0}
.xp-ux-modal-climate .xp-climate-layout .xp-ux-climate-features{grid-template-columns:repeat(2,minmax(0,1fr));margin:0}
.xp-ux-modal-climate .xp-climate-layout .xp-ux-climate-feature{min-height:89px}
@container xpeng-layout (max-width:850px){
 .xp-ux-modal-climate .xp-climate-layout{display:flex;flex-direction:column;align-items:center;gap:8px;margin:6px auto 0}
 .xp-ux-modal-climate .xp-climate-layout>.xp-ux-cabin-art.xp-ux-cabin-portrait{width:min(258px,100%);margin:0 auto}
 .xp-ux-modal-climate .xp-climate-layout>.xp-ux-climate-bottom{width:100%;max-width:530px;gap:8px}
 .xp-ux-modal-climate .xp-climate-layout .xp-ux-climate-features{grid-template-columns:repeat(3,minmax(0,1fr))}
 .xp-ux-modal-climate .xp-climate-layout .xp-ux-climate-feature{min-height:82px}
}
@container xpeng-layout (max-width:390px){
 .xp-ux-modal-climate .xp-climate-layout>.xp-ux-cabin-art.xp-ux-cabin-portrait{width:min(230px,100%)}
}
/* Final owner acceptance: responsive charging uses FRONT G6 and a decorative
   glowing cable; telemetry remains DOM/HA-driven, never baked into image art. */
.xp-charge-cable{position:absolute;inset:0;width:100%;height:100%;z-index:8;pointer-events:none;overflow:visible}
.xp-charge-cable-halo,.xp-charge-cable-core{fill:none;stroke-linecap:round}
.xp-charge-cable-halo{stroke:#00da88;stroke-width:5.2;opacity:.55;filter:drop-shadow(0 0 5px #00ed91)}
.xp-charge-cable-core{stroke:#65ffc8;stroke-width:2.2;opacity:.92}
.xp-charge-cable.xp-cable-mobile{display:none}
@container xpeng-layout (max-width:850px){
 .xp-charge-cable.xp-cable-desktop{display:none}
 .xp-charge-cable.xp-cable-mobile{display:block}
}
.xp-ux-dock-seven .xp-ux-dock-action small{font-size:10px;white-space:normal;line-height:1.12}
.xp-ux-dock-seven .xp-ux-dock-action:disabled{opacity:.48}
/* Use live HA state for labels and icon; status-only climate feedback stays inert. */
.xp-ux-climate-readonly{cursor:default;opacity:.80;border-style:dashed}
.xp-ux-dock-seven .xp-ux-dock-action{flex-basis:78px;min-width:61px;max-width:84px}
.xp-ux-map-actions button{display:inline-flex;align-items:center;justify-content:center;gap:10px;min-height:48px}
.xp-ux-modal-trunk .xp-ux-access-buttons button{min-height:48px}

.xp-diagnostics-scroll{max-height:min(440px,55vh);overflow-y:auto;overscroll-behavior:contain;display:grid;gap:5px;direction:ltr}
.xp-entity-diagnostic{min-width:0;display:grid;grid-template-columns:minmax(0,3fr) minmax(70px,1fr);gap:9px;align-items:center;text-align:left}
.xp-entity-diagnostic span{font-size:11px;overflow-wrap:anywhere}
.xp-entity-diagnostic b{font-size:12px;text-align:right}
@container xpeng-layout (max-width:430px){.xp-entity-diagnostic{grid-template-columns:minmax(0,1fr)}.xp-entity-diagnostic b{text-align:left}}
/* Mobile scroll: modal is an independent touch-scrolling surface inside the scene. */
.xp-ux-modal{overflow-x:hidden;overflow-y:auto;-webkit-overflow-scrolling:touch;
 touch-action:pan-y;overscroll-behavior-y:contain;max-height:96%;box-sizing:border-box}
.xp-ux-modal-head{position:sticky;top:-16px;z-index:5;padding:4px 2px 12px;
 background:linear-gradient(180deg,#07182b 80%,#07182b00)}
@container xpeng-layout (max-width:600px){
 .xp-ux-modal{inset:1% 1%;height:auto;min-height:0;max-height:98%;
   padding:11px 11px 38px;touch-action:pan-y}
 .xp-ux-modal-head{top:-11px}
 .xp-ux-modal-maintenance .xp-tire-screen{position:relative;inset:auto;
    height:auto!important;min-height:0!important;margin:8px 0 22px;overflow:visible}
 .xp-ux-modal-maintenance .xp-tire-stage{display:grid;width:100%;height:auto;direction:ltr;
    grid-template-columns:minmax(0,1fr) minmax(0,1fr);
    grid-template-rows:auto auto auto;gap:10px;align-items:stretch}
 .xp-ux-modal-maintenance .xp-tire-center{grid-area:1/1/2/3;height:195px;
    width:100%;max-width:220px;justify-self:center;filter:none}
 .xp-ux-modal-maintenance .xp-tire-reading[data-wheel="tire_fl"]{grid-area:2/1}
 .xp-ux-modal-maintenance .xp-tire-reading[data-wheel="tire_fr"]{grid-area:2/2}
 .xp-ux-modal-maintenance .xp-tire-reading[data-wheel="tire_rl"]{grid-area:3/1}
 .xp-ux-modal-maintenance .xp-tire-reading[data-wheel="tire_rr"]{grid-area:3/2}
 .xp-ux-modal-maintenance .xp-tire-reading{min-width:0;padding:12px 8px}
 .xp-ux-modal-maintenance .xp-tire-reading strong{font-size:clamp(21px,6vw,29px)}
 .xp-ux-modal-maintenance .xp-maint-info{grid-template-columns:minmax(0,1fr)}
 .xp-ux-modal-maintenance .xp-extra-line{min-width:0;overflow-wrap:anywhere}
 .xp-ux-modal-climate .xp-climate-layout{padding-bottom:55px}
}
.xp-charge-cable-live .xp-charge-cable-halo{stroke:#00df90;stroke-width:5.2;
 filter:drop-shadow(0 0 5px #00ed91)}
.xp-charge-cable-live .xp-charge-cable-core{stroke:#a5ffda;stroke-width:2.2}

/* XPENG G6 | Modern Glass UI v2.
 * Pure presentation: original night art, actual vehicle images, entity bindings,
 * and one-tap Home Assistant actions are untouched.
 * Everything scales to the HA Sections card container, not device user-agent.
 */
:host{
 --xp-mint:#19efb3;
 --xp-sky:#53acff;
 --xp-glass:#06192cdd;
 --xp-stroke:#8cb9e566;
 --xp-glow:#31a5ff42;
}
.xp-scene.xp-overview.xp-home-navigation{
 background:#031024;
}
.xp-home-navigation .xp-title{left:5.5%;top:16.5%;gap:8px}
.xp-home-navigation .xp-title h1{
 font-size:clamp(31px,3.8cqw,59px);
 font-weight:790;
 letter-spacing:.045em;
 text-shadow:0 3px 20px #031121cc;
}
.xp-home-navigation .xp-title h1 em{color:#59b7ff;text-shadow:0 0 22px #319aff33}
.xp-home-navigation .xp-subtitle{
 color:#b1bdd8;font-size:clamp(15px,1.7cqw,24px);
 letter-spacing:.01em;
}
.xp-home-navigation .xp-header .xp-wifi,
.xp-home-navigation .xp-header .xp-more-trigger{
 background:linear-gradient(145deg,#173b58cc,#07182ce8);
 border:1px solid #84bdf57d;
 border-radius:15px;
 box-shadow:inset 0 1px 0 #e0f5ff22,0 6px 16px #0010225c;
 backdrop-filter:blur(16px);
}
.xp-home-navigation .xp-wifi.xp-connected{color:#62baff}
.xp-scene.xp-overview.xp-home-navigation .xp-car{
 left:39%;width:58%;bottom:16%;
 max-height:70%;
 filter:drop-shadow(0 20px 22px #0009) brightness(1.14) contrast(1.03);
}
.xp-home-navigation .xp-overview-stat{
 left:5.1%;top:32.5%;width:min(34%,465px);max-width:none;
 padding:clamp(16px,1.8cqw,27px) clamp(17px,2cqw,30px);
 gap:0;
 border:1px solid #55aff4ac;
 border-radius:clamp(18px,1.8cqw,26px);
 background:linear-gradient(145deg,#071d34eb 0%,#041225dd 68%,#071f36dd 100%);
 box-shadow:0 20px 44px #0008,inset 0 1px 0 #e1f7ff24,0 0 27px #3289d42c;
 backdrop-filter:blur(20px) saturate(1.25);
 -webkit-backdrop-filter:blur(20px) saturate(1.25);
}
.xp-home-navigation .xp-batt-line{gap:clamp(12px,1.3cqw,20px);align-items:center}
.xp-home-navigation .xp-batt-glyph{
 width:clamp(36px,3.6cqw,53px);
 height:clamp(54px,5.1cqw,73px);
 padding:5px;border:2px solid #27f3b7;
 border-radius:9px;
 box-shadow:0 0 18px #13e8a93b;
}
.xp-home-navigation .xp-batt-glyph:before{
 width:36%;height:6px;top:-8px;left:32%;
 border:2px solid #27f3b7;border-bottom:0;
}
.xp-home-navigation .xp-batt-fill{
 background:linear-gradient(180deg,#64ffc2,#06c98d);
 box-shadow:0 0 20px #00e6a68c;
}
.xp-home-navigation .xp-stat-label{font-size:clamp(12px,1.03cqw,15px);color:#aabed9}
.xp-home-navigation .xp-soc{font-size:clamp(39px,4.9cqw,65px);font-weight:770;letter-spacing:-.03em}
.xp-home-navigation .xp-progress{
 height:clamp(9px,1cqw,13px);margin-top:14px;border-radius:99px;
 background:#29496f;
 box-shadow:inset 0 2px 5px #0007;
}
.xp-home-navigation .xp-progress>div{
 background:linear-gradient(90deg,#15eb9b,#24e6cb 80%,#42c9ff);
 box-shadow:0 0 15px #0af7b87a;
}
.xp-home-navigation .xp-overview-range{
 margin-top:18px;padding-top:15px;border-top:1px solid #91c5ec4d;
}
.xp-home-navigation .xp-range-num{
 font-size:clamp(26px,3cqw,43px);margin-top:5px;gap:13px;
 letter-spacing:-.015em;
}
.xp-home-navigation .xp-range-num ha-icon{
 color:#e9f6ff;opacity:.98;
 --mdc-icon-size:clamp(23px,2.5cqw,33px);
 width:clamp(23px,2.5cqw,33px);height:clamp(23px,2.5cqw,33px);
}
.xp-home-navigation .xp-ux-dock-seven{
 width:max-content;max-width:95%;gap:clamp(6px,.8cqw,12px);
 bottom:2.7%;padding:10px 12px;
 border-radius:27px;
 border:1px solid #6db7f3a1;
 background:linear-gradient(155deg,#0b2b4be8,#061a30f0);
 backdrop-filter:blur(24px) saturate(1.25);
 -webkit-backdrop-filter:blur(24px) saturate(1.25);
 box-shadow:0 13px 34px #000a,inset 0 1px 0 #dcf4ff31,0 0 20px #2797f723;
}
.xp-home-navigation .xp-ux-dock-seven .xp-ux-dock-action{
 position:relative;flex:0 1 110px;
 width:clamp(76px,7.3cqw,110px);
 max-width:110px;min-width:0;min-height:clamp(65px,6.8cqw,86px);
 padding:9px 7px;gap:8px;border-radius:21px;
 background:linear-gradient(165deg,#193d60ee,#08182eea);
 border:1px solid #77baf28c;
 box-shadow:inset 0 1px 0 #d7eeff26,0 3px 9px #0006;
 color:#f4f9ff;transition:background .18s,border-color .18s,transform .18s,box-shadow .18s;
}
.xp-home-navigation .xp-ux-dock-seven .xp-ux-dock-action ha-icon{
 color:#e9f4ff;width:clamp(23px,2.5cqw,31px)!important;
 height:clamp(23px,2.5cqw,31px)!important;
 --xp-icon-size:clamp(23px,2.5cqw,31px)!important;
 --mdc-icon-size:clamp(23px,2.5cqw,31px)!important;
 filter:drop-shadow(0 0 6px #4aa8fc42);
}
.xp-home-navigation .xp-ux-dock-seven .xp-ux-dock-action small{
 font-size:clamp(10px,1.05cqw,13px);font-weight:600;
 white-space:normal;line-height:1.13;letter-spacing:0;
 text-align:center;
}
.xp-home-navigation .xp-ux-dock-seven .xp-ux-dock-action:hover,
.xp-home-navigation .xp-ux-dock-seven .xp-ux-dock-action:focus-visible{
 background:linear-gradient(160deg,#20537c,#0b2846);
 border-color:#48c7ff;
 box-shadow:0 0 20px #2496fa60,inset 0 1px 0 #e7faff33;
 transform:translateY(-2px);
}
.xp-home-navigation .xp-ux-dock-seven .xp-ux-dock-action:active{transform:translateY(1px)}
.xp-home-navigation .xp-ux-dock-seven .xp-ux-dock-action:disabled{opacity:.49;filter:saturate(.65);transform:none}
.xp-ux-modal,.xp-charge-card{
 border-color:#6badde85!important;
 background:linear-gradient(150deg,#061c32f3,#061427f5)!important;
 box-shadow:0 20px 48px #0009,inset 0 1px 0 #d1f4ff18;
 backdrop-filter:blur(19px);
}
.xp-ux-modal button:not(:disabled){
 transition:border-color .16s,background .16s,box-shadow .16s;
}
.xp-ux-modal button:not(:disabled):hover{border-color:#45b7e7;box-shadow:0 0 12px #238ceb29}
.xp-ux-modal-head h2{letter-spacing:-.015em;font-weight:750}
.xp-ux-climate-card,.xp-ux-climate-feature,.xp-extra-tile,
.xp-extra-line,.xp-tire-reading,.xp-ux-access-panel{
 border-radius:15px;
}
@container xpeng-layout (max-width:850px){
 .xp-home-navigation .xp-title{left:5%;top:85px;gap:3px}
 .xp-home-navigation .xp-title h1{font-size:clamp(28px,7.3cqw,39px)}
 .xp-home-navigation .xp-subtitle{font-size:15px}
 .xp-home-navigation .xp-overview-stat{
   left:4.5%;top:182px;width:91%;max-width:none;
   padding:14px 18px;border-radius:21px;
 }
 .xp-home-navigation .xp-batt-glyph{width:34px;height:45px;padding:4px}
 .xp-home-navigation .xp-batt-line{gap:12px}
 .xp-home-navigation .xp-soc{font-size:clamp(31px,8.8cqw,42px)}
 .xp-home-navigation .xp-progress{margin-top:9px;height:9px}
 .xp-home-navigation .xp-overview-range{margin-top:10px;padding-top:10px}
 .xp-home-navigation .xp-range-num{font-size:clamp(22px,6.5cqw,29px);margin-top:2px}
 .xp-home-navigation .xp-stat-label{font-size:11px}
 .xp-scene.xp-overview.xp-home-navigation .xp-car{
   left:0;width:100%;bottom:25%;max-height:34%;
 }
 .xp-home-navigation .xp-ux-dock-seven{
   bottom:17px;width:min(560px,94%);max-width:94%;
   display:grid;grid-template-columns:repeat(4,minmax(0,1fr));
   gap:6px;padding:8px;border-radius:22px;
 }
 .xp-home-navigation .xp-ux-dock-seven .xp-ux-dock-action{
   width:100%;max-width:none;min-width:0;min-height:57px;
   padding:6px 4px;gap:4px;border-radius:15px;
 }
 .xp-home-navigation .xp-ux-dock-seven .xp-ux-dock-action ha-icon{
   width:25px!important;height:25px!important;
   --xp-icon-size:25px!important;--mdc-icon-size:25px!important;
 }
 .xp-home-navigation .xp-ux-dock-seven .xp-ux-dock-action small{font-size:10px}
}
@container xpeng-layout (max-width:520px){
 .xp-home-navigation .xp-title{top:80px}
 .xp-home-navigation .xp-overview-stat{top:179px;padding:12px 15px}
 .xp-scene.xp-overview.xp-home-navigation .xp-car{
   left:0;width:100%;bottom:25%;max-height:31%;
 }
 .xp-home-navigation .xp-ux-dock-seven{bottom:15px;gap:5px}
 .xp-home-navigation .xp-ux-dock-seven .xp-ux-dock-action{min-height:55px}
}
@container xpeng-layout (max-width:360px){
 .xp-home-navigation .xp-overview-stat{top:178px;padding:11px 13px}
 .xp-home-navigation .xp-batt-glyph{height:42px;width:32px}
 .xp-home-navigation .xp-ux-dock-seven{bottom:13px;gap:4px;padding:6px}
 .xp-home-navigation .xp-ux-dock-seven .xp-ux-dock-action{min-height:51px;padding:5px 3px}
 .xp-home-navigation .xp-ux-dock-seven .xp-ux-dock-action small{font-size:9px}
 .xp-scene.xp-overview.xp-home-navigation .xp-car{bottom:25%;max-height:29%}
}
@media(prefers-reduced-motion:reduce){
 .xp-home-navigation .xp-ux-dock-seven .xp-ux-dock-action{transition:none}
}


/* Shared XPENG glass design language for real pages and action buttons.
 * Doors/windows/trunk/port remain one-tap Home dock actions, not navigation.
 * All of these rules are presentation-only: no backend command changes.
 */
.xp-ux-modal{
 border:1px solid var(--xp-stroke)!important;
 border-radius:clamp(18px,2.2cqw,28px);
 background:linear-gradient(155deg,#081e35f5,#041326f7 65%,#0b2640f4)!important;
 box-shadow:0 30px 55px #000b,inset 0 1px 0 #dff7ff24,0 0 21px #268ae72a;
 backdrop-filter:blur(20px) saturate(1.17);
 -webkit-backdrop-filter:blur(20px) saturate(1.17);
}
.xp-ux-modal-head{
 border-bottom:1px solid #79b9ee46;
 margin-bottom:14px;
}
.xp-ux-modal-head h2{
 color:#f3faff;letter-spacing:.01em;
 font-size:clamp(20px,2.25cqw,31px);
 font-weight:770;text-shadow:0 2px 14px #001020a9;
}
.xp-ux-modal-head button,.xp-page-back,
.xp-ux-map-actions button{
 border:1px solid #69b8ef9b;
 border-radius:15px;
 background:linear-gradient(150deg,#163d5dcc,#091b31ed);
 box-shadow:inset 0 1px 0 #dbf4ff31,0 5px 13px #00102266;
 color:#eaf8ff;
}
.xp-ux-modal-head button ha-icon,.xp-page-back ha-icon,
.xp-ux-map-actions button ha-icon{color:#88d6ff}
.xp-ux-modal-climate .xp-climate-layout,
.xp-ux-modal-maintenance .xp-maintenance-page,
.xp-ux-modal-map .xp-ux-map-panel,
.xp-ux-modal-charge_controls .xp-ux-charging-panel,
.xp-ux-modal-extras .xp-extra-body{color:#f4f9ff}
.xp-ux-climate-card,.xp-ux-range-row,.xp-ux-seat,
.xp-ux-climate-feature,.xp-extra-tile,.xp-extra-line,
.xp-maint-info .xp-extra-line,.xp-ux-vehicle-state,.xp-ux-access-state,
.xp-ux-port-state,.xp-ux-charge-limit{
 border:1px solid #699bc48a;
 background:linear-gradient(150deg,#193b5cbb,#081c33e8);
 box-shadow:inset 0 1px 0 #d6efff20,0 8px 18px #0011256a;
 border-radius:17px;
}
.xp-ux-temp-line b{font-weight:780;color:#f5fbff;text-shadow:0 0 16px #82c7ff26}
.xp-ux-temp-line button,.xp-ux-seat-options button,
.xp-ux-cycle,.xp-ux-port-action,.xp-ux-access-buttons button,
.xp-ux-vehicle-buttons button{
 border:1px solid #72addb9f;
 background:linear-gradient(160deg,#1b4568,#0b253e);
 box-shadow:inset 0 1px 0 #e6f7ff26,0 4px 11px #00122564;
 color:#f0f9ff;border-radius:14px;
}
.xp-ux-temp-line button{border-radius:50%;width:46px;height:46px}
.xp-ux-climate-feature{
 border:1px solid #6bafd695;
 background:linear-gradient(155deg,#173752ee,#0d2441e5);
 min-height:88px;
}
.xp-ux-climate-feature ha-icon{
 color:#79d8ff;
 width:29px;height:29px;--mdc-icon-size:29px;--xp-icon-size:29px;
 filter:drop-shadow(0 0 7px #27adff57);
}
.xp-ux-climate-feature.xp-ux-selected,
.xp-ux-cycle-on,
.xp-ux-seat-options button[aria-pressed="true"]{
 border-color:#49ead2;
 box-shadow:0 0 16px #1ec4ba50,inset 0 1px 0 #d1f9ff29;
}
.xp-ux-cycle-heat.xp-ux-cycle-on{
 background:linear-gradient(145deg,#813044,#401c37);
 border-color:#ff8888;
 box-shadow:0 0 12px #ff5b5780;
}
.xp-ux-cycle-vent.xp-ux-cycle-on{
 background:linear-gradient(145deg,#1f6da2,#0b355c);
 border-color:#64d5ff;
 box-shadow:0 0 12px #47aeff80;
}
.xp-ux-cycle ha-icon{
 color:#e4f8ff;
 width:19px;height:19px;--mdc-icon-size:19px;
}
.xp-ux-range-row input[type="range"],.xp-ux-modal input[type="range"]{
 accent-color:#20e9c7;
}
.xp-charge-card{
 border:1px solid #53a7e9a4!important;
 border-radius:25px;
 background:linear-gradient(145deg,#071d33ed,#061529e8)!important;
 box-shadow:0 20px 48px #0009,inset 0 1px 0 #dcf8ff1d,0 0 18px #2a9ce52c;
}
.xp-charge-heading{color:#36f0c3}
.xp-charge-heading ha-icon{
 color:#24f5c7;filter:drop-shadow(0 0 7px #14e6a37c);
}
.xp-charge-card .xp-progress{border-radius:99px;box-shadow:inset 0 2px 6px #0008}
.xp-charge-card .xp-progress>div{
 background:linear-gradient(90deg,#11d78a,#35f5cf);
 box-shadow:0 0 17px #08ffb06b;
}
.xp-charge-stop{
 min-height:47px;
 border:1px solid #3dc8d0b6;
 background:linear-gradient(150deg,#10475cde,#092239ed);
 border-radius:14px;color:#ddfcf5;
}
.xp-tire-reading{
 border:1px solid #77acd399;
 border-radius:16px;
 background:linear-gradient(150deg,#173755e9,#081a2eea);
 box-shadow:inset 0 1px 0 #c4eaff22,0 5px 17px #0013227a;
}
.xp-tire-reading strong{font-weight:770;color:#f4fbff;letter-spacing:-.02em}
.xp-tire-reading span{color:#47ecc4;font-weight:620}
.xp-ux-modal-maintenance .xp-tire-reading[data-wheel]{
 outline:1px solid #23efb923;outline-offset:-5px;
}
.xp-ux-modal-maintenance .xp-tire-center{
 filter:drop-shadow(0 12px 15px #0009);
}
.xp-ux-map-stage{
 border-radius:20px;border:1px solid #6ba4d284;
 box-shadow:0 12px 25px #0007;overflow:hidden;
}
.xp-ux-map-actions button ha-icon{color:#81d9ff}
.xp-ux-map-actions .xp-map-native-details{grid-column:1/-1;min-height:42px;font-size:12px;background:#0b3450b8}
.xp-ux-dock-action[aria-busy="true"],button[data-xp-toggle][aria-busy="true"]{opacity:.78;transition:none;font-weight:inherit}
.xp-ux-modal button:disabled,.xp-ux-modal .xp-ux-climate-readonly{
 opacity:.5;cursor:not-allowed;
}
@container xpeng-layout (max-width:520px){
 .xp-ux-modal{padding:12px 12px 40px}
 .xp-ux-modal-head{gap:10px;margin-bottom:10px}
 .xp-ux-modal-head h2{font-size:21px}
 .xp-ux-climate-feature ha-icon{width:23px;height:23px;--mdc-icon-size:23px;--xp-icon-size:23px}
 .xp-ux-cycle ha-icon{width:17px;height:17px;--mdc-icon-size:17px}
 .xp-tire-reading{border-radius:12px}
}
@media(prefers-reduced-motion:reduce){
 .xp-ux-modal button{transition:none}
}


/* Owner reference: charging information/actions live together at left.
 * The original G6 charging photo, charging cable and live Xpengtk data remain.
 */
.xp-charge-card{
 left:4.3%;top:27.3%;width:39.3%;
 padding:clamp(15px,1.8cqw,26px);
 border-radius:23px;
 background:linear-gradient(145deg,#06182bec,#04172dec)!important;
 border:1px solid #479cde96!important;
 box-shadow:0 18px 40px #0008,inset 0 1px 0 #d9f6ff23;
}
.xp-charge-heading{margin-bottom:14px;font-size:clamp(22px,2.5cqw,35px);gap:12px}
.xp-charge-card .xp-progress{height:clamp(10px,1.15cqw,16px)}
.xp-charge-main{margin-top:16px;gap:16px}
.xp-charge-main .xp-soc{font-size:clamp(39px,5cqw,76px)}
.xp-charge-range b{display:flex;align-items:center;gap:10px;font-size:clamp(22px,2.2cqw,35px)}
.xp-charge-range b ha-icon{color:#f8fbff;--mdc-icon-size:25px}
.xp-charge-meta{margin-top:17px;padding-top:14px}
.xp-charge-meta>div{align-items:flex-start;padding:0 9px;gap:6px}
.xp-charge-meta>div>ha-icon{color:#f0fbff;--mdc-icon-size:23px}
.xp-charge-meta b{font-size:clamp(16px,1.5cqw,24px)}
.xp-charge-meta small{font-size:clamp(11px,.95cqw,14px)}
.xp-charge-panel-actions{
 display:grid;grid-template-columns:repeat(3,minmax(0,1fr));
 gap:9px;margin-top:17px;direction:rtl;
}
.xp-charge-panel-actions button{
 display:flex;flex-direction:column;align-items:center;justify-content:center;gap:7px;
 border:1px solid #569bcc9c;border-radius:15px;
 min-width:0;min-height:68px;padding:9px 5px;
 color:#f0faff;background:linear-gradient(150deg,#173957d9,#08182bf0);
 font-size:clamp(11px,.9cqw,14px);font-weight:600;
 cursor:pointer;box-shadow:inset 0 1px 0 #e4f8ff19;
}
.xp-charge-panel-actions button ha-icon{color:#d9f4ff;--mdc-icon-size:23px}
.xp-charge-panel-actions button:hover,.xp-charge-panel-actions button:focus-visible{
 border-color:#36dfbd;background:#174c66;box-shadow:0 0 13px #00eeab42;
}
@container xpeng-layout (max-width:850px){
 .xp-charge-card{left:4%;top:196px;width:92%;padding:14px 15px;border-radius:19px}
 .xp-charge-heading{font-size:21px;margin-bottom:10px}
 .xp-charge-main{gap:12px;margin-top:12px}
 .xp-charge-main .xp-soc{font-size:clamp(33px,9cqw,46px)}
 .xp-charge-range b{font-size:clamp(18px,5cqw,25px);gap:5px}
 .xp-charge-range b ha-icon{--mdc-icon-size:21px}
 .xp-charge-meta{margin-top:12px;padding-top:11px}
 .xp-charge-meta>div{padding:0 5px;gap:3px}
 .xp-charge-meta>div>ha-icon{--mdc-icon-size:17px}
 .xp-charge-meta small{font-size:10px}
 .xp-charge-meta b{font-size:clamp(12px,3.7cqw,16px)}
 .xp-charge-panel-actions{margin-top:12px;gap:6px}
 .xp-charge-panel-actions button{min-height:58px;padding:6px 3px;gap:3px;font-size:10px;border-radius:12px}
 .xp-charge-panel-actions button ha-icon{--mdc-icon-size:19px}
}
@container xpeng-layout (max-width:360px){
 .xp-charge-card{top:186px;padding:12px}
 .xp-charge-heading{margin-bottom:8px}
 .xp-charge-meta{margin-top:8px;padding-top:8px}
 .xp-charge-panel-actions button{min-height:52px}
}
/* Owner reference: four live pressure badges immediately beside all four
 * wheels, not detached in outer side columns or stacked below the car.
 */
.xp-ux-modal-maintenance .xp-tire-screen{
 position:relative;inset:auto;width:100%;height:auto;
 margin:0 auto;padding:0;
}
.xp-ux-modal-maintenance .xp-tire-stage{
 display:block!important;position:relative;
 width:min(720px,100%);height:clamp(300px,41cqw,470px);
 margin:0 auto;min-height:0;overflow:visible;
}
.xp-ux-modal-maintenance .xp-tire-center{
 position:absolute;left:33%;top:1%;width:34%;height:98%;
 display:flex;align-items:center;justify-content:center;
}
.xp-ux-modal-maintenance .xp-tire-center img,
.xp-ux-modal-maintenance .xp-tire-center svg{
 width:100%;height:100%;max-height:100%;object-fit:contain;
}
.xp-ux-modal-maintenance .xp-tire-reading{
 position:absolute!important;z-index:2;
 width:26%;min-width:0;min-height:61px;
 padding:7px 9px;display:flex;flex-direction:row;
 align-items:center;justify-content:center;gap:8px;
 background:#071e36dd;box-shadow:0 7px 20px #0008,0 0 12px #168eff2c;
}
.xp-ux-modal-maintenance .xp-tire-reading ha-icon{
 flex:0 0 24px;color:#21edb2;--mdc-icon-size:24px;
}
.xp-ux-modal-maintenance .xp-tire-reading-body{min-width:0;text-align:start}
.xp-ux-modal-maintenance .xp-tire-reading small{display:block;font-size:11px}
.xp-ux-modal-maintenance .xp-tire-reading strong{
 display:block;font-size:clamp(19px,2.3cqw,31px);
 white-space:nowrap;font-variant-numeric:tabular-nums;
}
.xp-ux-modal-maintenance .xp-tire-reading strong span{
 font-size:.55em;color:#b7cce1;font-weight:500;
}
.xp-ux-modal-maintenance .xp-tire-reading[data-wheel="tire_fl"]{left:5%;top:19%}
.xp-ux-modal-maintenance .xp-tire-reading[data-wheel="tire_fr"]{right:5%;top:19%}
.xp-ux-modal-maintenance .xp-tire-reading[data-wheel="tire_rl"]{left:5%;top:67%}
.xp-ux-modal-maintenance .xp-tire-reading[data-wheel="tire_rr"]{right:5%;top:67%}
.xp-ux-modal-maintenance .xp-tire-reading:after{
 content:"";position:absolute;top:50%;width:13%;height:1px;background:#5bc8ffcc;
}
.xp-ux-modal-maintenance .xp-tire-reading[data-wheel="tire_fl"]:after,
.xp-ux-modal-maintenance .xp-tire-reading[data-wheel="tire_rl"]:after{right:-13%}
.xp-ux-modal-maintenance .xp-tire-reading[data-wheel="tire_fr"]:after,
.xp-ux-modal-maintenance .xp-tire-reading[data-wheel="tire_rr"]:after{left:-13%}
@container xpeng-layout (max-width:520px){
 .xp-ux-modal-maintenance .xp-tire-stage{height:clamp(290px,95cqw,390px)}
 .xp-ux-modal-maintenance .xp-tire-center{left:29%;width:42%}
 .xp-ux-modal-maintenance .xp-tire-reading{width:29%;min-height:48px;padding:5px 3px;gap:3px;border-radius:10px}
 .xp-ux-modal-maintenance .xp-tire-reading ha-icon{flex:0 0 15px;--mdc-icon-size:15px}
 .xp-ux-modal-maintenance .xp-tire-reading small{font-size:9px}
 .xp-ux-modal-maintenance .xp-tire-reading strong{font-size:clamp(14px,4cqw,19px)}
 .xp-ux-modal-maintenance .xp-tire-reading[data-wheel="tire_fl"],
 .xp-ux-modal-maintenance .xp-tire-reading[data-wheel="tire_fr"]{top:19%}
 .xp-ux-modal-maintenance .xp-tire-reading[data-wheel="tire_rl"],
 .xp-ux-modal-maintenance .xp-tire-reading[data-wheel="tire_rr"]{top:69%}
}


/* Reference HVAC: full control console on the left, owner-provided G6 cabin
 * photograph on the right. Every button uses existing verified HA services.
 */
.xp-ux-modal-climate .xp-climate-layout{
 grid-template-columns:minmax(0,1fr) minmax(0,1.12fr);gap:clamp(12px,1.6cqw,27px);
 max-width:1280px;align-items:start;direction:ltr;
}
.xp-ux-modal-climate .xp-climate-layout>.xp-ux-climate-bottom{
 width:100%;max-width:none;direction:rtl;gap:11px;
}
.xp-climate-primary-controls{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
.xp-climate-primary{
 display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;
 min-width:0;min-height:100px;padding:12px;
 border:1px solid #669fd7a9;border-radius:18px;
 background:linear-gradient(145deg,#102d4be5,#071a31ed);color:#f1f9ff;
 box-shadow:0 7px 19px #0013228c,inset 0 1px 0 #c7ecff28;
}
.xp-climate-primary ha-icon{--mdc-icon-size:31px;color:#82ceff}
.xp-climate-primary.xp-ux-selected ha-icon{color:#57d6ff;filter:drop-shadow(0 0 8px #1c9efe9c)}
.xp-climate-primary b{font-size:15px}
.xp-climate-primary small{font-size:11px;color:#acc8df;text-align:center}
.xp-climate-primary.xp-ux-climate-readonly{cursor:default}
.xp-climate-temp-panel{margin:0!important;padding:13px 18px}
.xp-climate-thermometers{
 display:grid;grid-template-columns:1fr 1.4fr;gap:12px;
 align-items:center;text-align:center;
}
.xp-climate-thermometers>div+div{border-right:1px solid #648bad69}
.xp-climate-thermometers small{display:block;color:#b4cbe2;font-size:12px;margin-top:8px}
.xp-climate-inside b{display:block;font-size:clamp(26px,3cqw,42px);margin-top:10px}
.xp-climate-target .xp-ux-temp-line{margin:7px auto 0;gap:7px;justify-content:space-between}
.xp-climate-target .xp-ux-temp-line b{min-width:0;white-space:nowrap;font-size:clamp(25px,2.7cqw,36px)}
.xp-climate-target .xp-ux-temp-line button{
 width:40px;height:40px;flex:0 0 40px;border-radius:13px;
}
.xp-climate-fan-panel{margin:0!important;padding:13px 17px}
.xp-climate-fan-panel>span{font-size:15px}
.xp-climate-fan-panel>span ha-icon{color:#b5e5ff;--mdc-icon-size:23px}
.xp-fan-bars{display:flex;gap:6px;align-items:end;height:32px;direction:ltr}
.xp-fan-bars i{
 display:block;height:28px;flex:1;border-radius:5px;
 background:#1c3553;border:1px solid #51799b45;
}
.xp-fan-bars i.xp-fan-bar-on{background:linear-gradient(180deg,#54b5ff,#197de9);box-shadow:0 0 7px #248ffc55}
.xp-climate-fan-panel input{margin-top:3px}
.xp-ux-modal-climate .xp-climate-layout>.xp-ux-cabin-art.xp-ux-cabin-portrait{
 width:min(510px,100%);max-height:none;align-self:center;
}
.xp-ux-modal-climate .xp-climate-layout .xp-ux-climate-features{grid-template-columns:repeat(2,minmax(0,1fr))}
@container xpeng-layout (max-width:850px){
 .xp-ux-modal-climate .xp-climate-layout{
   display:flex;flex-direction:column;align-items:stretch;gap:10px;
 }
 .xp-ux-modal-climate .xp-climate-layout>.xp-ux-climate-bottom{
   order:2;width:100%;max-width:none;
 }
 .xp-ux-modal-climate .xp-climate-layout>.xp-ux-cabin-art.xp-ux-cabin-portrait{
   order:1;width:min(310px,100%);margin:0 auto;
 }
 .xp-climate-primary{min-height:77px;padding:9px}
 .xp-climate-primary ha-icon{--mdc-icon-size:27px}
 .xp-climate-thermometers{gap:5px}
 .xp-climate-inside b{font-size:29px}
 .xp-climate-target .xp-ux-temp-line b{font-size:29px}
 .xp-climate-target .xp-ux-temp-line button{width:37px;height:37px;flex-basis:37px}
}
@container xpeng-layout (max-width:390px){
 .xp-climate-primary-controls{gap:6px}
 .xp-climate-primary b{font-size:12px}
 .xp-climate-temp-panel{padding:10px}
 .xp-climate-thermometers small{font-size:10px}
 .xp-climate-target .xp-ux-temp-line button{width:30px;height:33px;flex-basis:30px}
 .xp-climate-target .xp-ux-temp-line b,.xp-climate-inside b{font-size:24px}
}


/* Scale the complete owner cabin photo to fit the desktop climate viewport:
 * preserve aspect ratio and four rear/front zones, without cutting rear seats.
 */
@container xpeng-layout (min-width:851px){
 .xp-ux-modal-climate .xp-climate-layout>.xp-ux-cabin-art.xp-ux-cabin-portrait{
  width:min(338px,100%);max-width:338px;height:auto;max-height:none;
  margin:0 auto;
 }
}
/* Physical seat/steering location is the ONLY controls surface for heating and
 * ventilation: no duplicate buttons outside the photo.
 */
.xp-ux-modal-climate .xp-ux-cabin-art{overflow:visible}
.xp-ux-modal-climate .xp-ux-cabin-art .xp-ux-hotspot-zone{z-index:8;gap:5px;white-space:nowrap}
.xp-ux-modal-climate .xp-ux-cabin-art .xp-ux-cycle{
 width:clamp(40px,4cqw,57px);min-width:40px;
 height:clamp(56px,5.1cqw,69px);min-height:56px;
 flex-direction:column;gap:3px;padding:5px 3px;border-radius:13px;
 box-shadow:0 3px 12px #0009,inset 0 1px 0 #d5f4ff23;
}
.xp-ux-modal-climate .xp-ux-cycle ha-icon{
 color:#e5f8ff;width:23px;height:23px;--xp-icon-size:23px;--mdc-icon-size:23px;
}
.xp-ux-modal-climate .xp-ux-cycle-heat.xp-ux-cycle-on ha-icon{color:#ffb2aa}
.xp-ux-modal-climate .xp-ux-cycle-vent.xp-ux-cycle-on ha-icon{color:#8aeaff}
.xp-ux-modal-climate .xp-cabin-action-label{font-size:9px;line-height:1;white-space:nowrap;font-weight:650}
.xp-ux-modal-climate .xp-ux-cycle .xp-ux-level{font-size:12px;line-height:1}
.xp-ux-modal-climate .xp-ux-cycle-busy{opacity:.65}
@container xpeng-layout (max-width:520px){
 .xp-ux-modal-climate .xp-ux-cabin-art .xp-ux-hotspot-zone{gap:2px}
 .xp-ux-modal-climate .xp-ux-cabin-art .xp-ux-cycle{
  width:40px;min-width:40px;height:54px;min-height:54px;padding:4px 2px;gap:2px;
 }
 .xp-ux-modal-climate .xp-ux-cycle ha-icon{
  width:20px;height:20px;--xp-icon-size:20px;--mdc-icon-size:20px;
 }
 .xp-ux-modal-climate .xp-cabin-action-label{font-size:8px}
}


/* Mobile object-level composition v3 (not merely a reduced viewport).
 * Keep source art and vehicle actions unchanged; use card container units so
 * narrow Home Assistant Sections get exactly the same scaling as an iPhone.
 * Never scale the whole scene: photo hotspots and the charging cable need
 * stable coordinate systems and physical buttons need usable touch targets.
 */
@container xpeng-layout (max-width:600px){
 .xp-home-navigation .xp-title{top:clamp(76px,19cqw,89px)}
 .xp-home-navigation .xp-title h1{font-size:clamp(26px,6.8cqw,33px)}
 .xp-home-navigation .xp-subtitle{font-size:clamp(12px,3.2cqw,14px)}
 .xp-home-navigation .xp-overview-stat{
  left:5%;width:90%;top:clamp(154px,42cqw,180px);
  padding:clamp(9px,2.6cqw,13px) clamp(12px,3.5cqw,16px);
  border-radius:clamp(14px,4cqw,19px);
 }
 .xp-home-navigation .xp-batt-line{gap:9px}
 .xp-home-navigation .xp-batt-glyph{height:clamp(35px,10cqw,42px);width:clamp(26px,7.7cqw,32px);padding:3px}
 .xp-home-navigation .xp-soc{font-size:clamp(26px,7.3cqw,35px)}
 .xp-home-navigation .xp-progress{height:7px;margin-top:7px}
 .xp-home-navigation .xp-overview-range{margin-top:8px;padding-top:8px}
 .xp-home-navigation .xp-range-num{font-size:clamp(18px,5.7cqw,24px)}
 .xp-scene.xp-overview.xp-home-navigation .xp-car{
  left:7%;width:86%;bottom:25%;max-height:28%;object-fit:contain;
 }
 .xp-home-navigation .xp-ux-dock-seven{
  bottom:12px;width:94%;padding:6px;gap:5px;border-radius:17px;
 }
 .xp-home-navigation .xp-ux-dock-seven .xp-ux-dock-action{
  min-height:52px;padding:5px 3px;gap:3px;border-radius:12px;
 }
 .xp-home-navigation .xp-ux-dock-seven .xp-ux-dock-action ha-icon{
  width:clamp(20px,5.7cqw,24px)!important;
  height:clamp(20px,5.7cqw,24px)!important;
  --xp-icon-size:clamp(20px,5.7cqw,24px)!important;
  --mdc-icon-size:clamp(20px,5.7cqw,24px)!important;
 }
 .xp-home-navigation .xp-ux-dock-seven .xp-ux-dock-action small{
  font-size:clamp(9px,2.6cqw,10px);line-height:1.15;
 }
 /* Keep the original rear charging photo and its precisely drawn green cable:
    compact the panel, rather than separately transforming the car/cable. */
 .xp-charge-card{
  top:clamp(176px,48cqw,196px);
  padding:clamp(10px,2.8cqw,14px);border-radius:17px;
 }
 .xp-charge-heading{font-size:clamp(17px,4.9cqw,21px);margin-bottom:8px;gap:7px}
 .xp-charge-heading ha-icon{--mdc-icon-size:22px}
 .xp-charge-main{margin-top:9px;gap:8px}
 .xp-charge-main .xp-soc{font-size:clamp(29px,8.4cqw,39px)}
 .xp-charge-meta{margin-top:9px;padding-top:9px}
 .xp-charge-meta>div>ha-icon{--mdc-icon-size:16px}
 .xp-charge-panel-actions{margin-top:8px;gap:5px}
 .xp-charge-panel-actions button{min-height:49px;font-size:10px;padding:5px 3px;gap:3px}
 .xp-charge-panel-actions button ha-icon{--mdc-icon-size:18px}
 /* Subpages remain scrollable, but the content itself is now proportioned. */
 .xp-ux-modal{padding:clamp(8px,2.4cqw,12px) clamp(8px,2.5cqw,12px) 32px}
 .xp-ux-modal-head{padding-bottom:6px;margin-bottom:8px}
 .xp-ux-modal-head h2{font-size:clamp(18px,5cqw,21px)}
 .xp-ux-modal-climate .xp-climate-layout>.xp-ux-cabin-art.xp-ux-cabin-portrait{
  width:clamp(240px,70cqw,278px);max-width:100%;margin:0 auto;
 }
 .xp-ux-modal-climate .xp-ux-cabin-art .xp-ux-hotspot-zone{gap:2px}
 /* Reset legacy right:25% anchoring: with left:72% it squeezes the passenger flex pair into a 3%-wide column. */
 .xp-ux-modal-climate .xp-ux-cabin-portrait .xp-ux-passenger{right:auto;max-width:none}
 .xp-ux-modal-climate .xp-ux-cabin-art .xp-ux-cycle{
  width:clamp(36px,10cqw,40px);min-width:0;
  height:clamp(46px,12.3cqw,52px);min-height:0;
  padding:3px 2px;gap:2px;border-radius:11px;
 }
 .xp-ux-modal-climate .xp-ux-cycle ha-icon{
  width:18px;height:18px;--xp-icon-size:18px;--mdc-icon-size:18px;
 }
 .xp-ux-modal-climate .xp-cabin-action-label{font-size:8px}
 .xp-climate-primary{min-height:65px;padding:8px 5px;gap:4px}
 .xp-climate-primary ha-icon{--mdc-icon-size:23px}
 .xp-climate-primary small{font-size:10px}
 .xp-climate-temp-panel,.xp-climate-fan-panel{padding:9px 11px}
 .xp-fan-bars{height:23px}
 .xp-ux-modal-maintenance .xp-tire-stage{height:clamp(260px,73cqw,315px)}
 .xp-ux-modal-maintenance .xp-tire-reading{
  width:28%;min-height:46px;padding:4px;gap:3px;
 }
 .xp-ux-modal-maintenance .xp-tire-reading strong{font-size:clamp(13px,3.7cqw,17px)}
 .xp-ux-modal-maintenance .xp-tire-reading small{font-size:clamp(8px,2.2cqw,10px)}
 .xp-ux-modal-maintenance .xp-tire-reading ha-icon{
  width:14px;height:14px;--mdc-icon-size:14px;
 }
 .xp-ux-modal-map .xp-ux-map-stage{min-height:230px}
}
@container xpeng-layout (max-width:360px){
 .xp-scene.xp-overview.xp-home-navigation .xp-car{left:8%;width:84%;max-height:26%}
 .xp-home-navigation .xp-ux-dock-seven{gap:4px;padding:5px}
 .xp-home-navigation .xp-ux-dock-seven .xp-ux-dock-action{min-height:49px}
 .xp-charge-card{top:174px}
 .xp-ux-modal-climate .xp-climate-layout>.xp-ux-cabin-art.xp-ux-cabin-portrait{
  width:min(240px,76cqw);
 }
}


/* Charging is an automatic dashboard scene, not an alternate stripped-down page.
 * Reuse the identical seven-button Dock/handlers on desktop, Sections and iPhone.
 * Keep control overlays short and station unobstructed; never alter car artwork.
 */
.xp-charge-navigation .xp-ux-dock-seven{
 bottom:2%;left:50%;width:max-content;max-width:94%;
 gap:6px;padding:6px 9px;border-radius:21px;
 border:1px solid #6db7f3a1;
 background:linear-gradient(155deg,#0b2b4be8,#061a30f0);
 box-shadow:0 13px 34px #000a,inset 0 1px 0 #dcf4ff31;
}
.xp-charge-navigation .xp-ux-dock-seven .xp-ux-dock-action{
 min-width:61px;max-width:78px;min-height:58px;
 flex:0 1 78px;padding:5px 4px;gap:4px;border-radius:15px;
 background:linear-gradient(165deg,#193d60ee,#08182eea);
 border:1px solid #77baf28c;
}
.xp-charge-navigation .xp-ux-dock-seven .xp-ux-dock-action ha-icon{
 width:25px!important;height:25px!important;
 --xp-icon-size:25px!important;--mdc-icon-size:25px!important;
}
.xp-charge-navigation .xp-ux-dock-seven .xp-ux-dock-action small{
 font-size:10px;white-space:normal;line-height:1.13;text-align:center;
}
.xp-charge-navigation .xp-charge-card{z-index:9}
.xp-scene.xp-charge.xp-charge-navigation .xp-car{
 width:42%;left:43%;bottom:17%;max-height:56%;
}
/* Lift the station above the car image; retain the original charging photograph. */
.xp-charge-navigation .xp-station{
 z-index:10;right:3%;bottom:28%;height:18%;width:5.4%;
}
.xp-charge-navigation .xp-charge-cable{z-index:11}
.xp-charge-navigation .xp-charge-panel-actions button:disabled{
 opacity:.42;cursor:not-allowed;box-shadow:none;
}
.xp-charge-compact-modal{
 inset:auto!important;top:27%!important;left:auto!important;right:3%!important;
 width:min(420px,40%)!important;height:auto!important;min-height:0!important;
 max-height:48%!important;padding:15px 16px 19px!important;overflow-y:auto!important;
 box-shadow:0 15px 55px #000d!important;
}
.xp-charge-compact-modal .xp-ux-modal-head{position:static;top:auto;margin:0 0 9px;padding:0 0 10px}
.xp-charge-compact-modal .xp-ux-modal-head h2{font-size:19px}
.xp-charge-compact-modal .xp-ux-modal-head button{min-height:40px;min-width:40px}
.xp-charge-compact-modal .xp-ux-charging-panel{padding:4px 0}
.xp-charge-compact-modal .xp-ux-charge-limit{display:flex;flex-direction:column;gap:14px;width:100%;max-width:none}
.xp-charge-compact-modal input[type="range"]{width:100%;min-height:40px}
.xp-charge-compact-modal .xp-ux-charge-schedule{margin:4px auto 0}
@container xpeng-layout (max-width:850px){
 .xp-charge-navigation .xp-ux-dock-seven{
  width:min(560px,94%);max-width:94%;bottom:14px;display:grid;
  grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;padding:7px;
  border-radius:19px;
 }
 .xp-charge-navigation .xp-ux-dock-seven .xp-ux-dock-action{
  width:100%;max-width:none;min-width:0;min-height:56px;padding:5px 3px;
 }
 .xp-charge-navigation .xp-ux-dock-seven .xp-ux-dock-action ha-icon{
  width:23px!important;height:23px!important;
  --xp-icon-size:23px!important;--mdc-icon-size:23px!important;
 }
 .xp-scene.xp-charge.xp-charge-navigation .xp-car{
  width:80%;left:3%;bottom:23%;max-height:27%;object-fit:contain;
 }
 .xp-charge-navigation .xp-station{
  right:3%;bottom:29%;height:15%;width:9%;min-width:35px;
 }
 .xp-charge-compact-modal{
  top:36%!important;left:4%!important;right:4%!important;
  width:92%!important;max-height:48%!important;
  padding:12px!important;
 }
}
@container xpeng-layout (max-width:520px){
 .xp-charge-navigation .xp-ux-dock-seven{bottom:12px;gap:5px;padding:6px}
 .xp-charge-navigation .xp-ux-dock-seven .xp-ux-dock-action{min-height:51px}
 .xp-charge-navigation .xp-ux-dock-seven .xp-ux-dock-action small{font-size:9px}
 .xp-scene.xp-charge.xp-charge-navigation .xp-car{
  width:77%;left:3%;bottom:24%;max-height:25%;
 }
 .xp-charge-navigation .xp-station{bottom:29%;height:15%}
 .xp-charge-compact-modal{top:33%!important;max-height:51%!important}
}
@container xpeng-layout (max-width:360px){
 .xp-charge-navigation .xp-ux-dock-seven{gap:4px;padding:5px}
 .xp-charge-navigation .xp-ux-dock-seven .xp-ux-dock-action{min-height:48px}
 .xp-scene.xp-charge.xp-charge-navigation .xp-car{width:76%;left:2%;bottom:25%;max-height:24%}
 .xp-charge-navigation .xp-station{right:2%;bottom:30%}
}


/* Live HA interaction fixes: one scroll owner per modal, no touch-scroll chains
 * or nested diagnostics scrollers that trap iPhone swipes. */
.xp-ux-modal.xp-ux-modal-extras .xp-diagnostics-scroll{
 max-height:none!important;height:auto!important;overflow:visible!important;
 overscroll-behavior:auto;display:grid;gap:5px;touch-action:auto;
}
.xp-ux-modal .xp-extra-body,.xp-ux-modal .xp-extra-details,.xp-ux-modal .xp-entity-diagnostics{
 min-height:0;overflow:visible;
}
.xp-ux-modal{
 overflow-y:auto;-webkit-overflow-scrolling:touch;
 touch-action:pan-y;overscroll-behavior-y:contain;
}
.xp-ux-modal-extras .xp-extra-body{width:min(900px,100%);}
.xp-ux-modal-map .xp-ux-map-stage{
 position:relative;isolation:isolate;overflow:hidden;
}
.xp-header .xp-wifi{
 display:flex;align-items:center;justify-content:center;
 padding:0;line-height:1;vertical-align:middle;
}
.xp-header .xp-wifi .xp-mdi-icon{
 display:flex;align-items:center;justify-content:center;
 width:24px;height:24px;--xp-icon-size:24px;--mdc-icon-size:24px;
 margin:0;transform:translateY(-2px);
}
@container xpeng-layout (max-width:850px){
 .xp-header .xp-wifi .xp-mdi-icon{
  width:22px;height:22px;--xp-icon-size:22px;--mdc-icon-size:22px;transform:none;
 }
}


/* Genuine MDI-only control icon polish. No home-made action SVGs or emoji.
 * The original vehicle artwork, fallback illustrations and curved charging
 * cable are non-control visuals and remain unchanged. */
.xp-scene .xp-mdi-icon{
 flex-shrink:0;vertical-align:middle;
 line-height:1;overflow:visible;
 -webkit-font-smoothing:antialiased;
}
.xp-ux-dock-action .xp-mdi-icon,
.xp-ux-modal-head button .xp-mdi-icon,
.xp-ux-climate-feature .xp-mdi-icon,
.xp-extra-tile .xp-mdi-icon,
.xp-ux-map-actions button .xp-mdi-icon,
.xp-charge-panel-actions button .xp-mdi-icon{
 color:#b6e4ff;filter:drop-shadow(0 1px 5px #59baff28);
 transition:color .18s ease,filter .18s ease;
}
.xp-ux-dock-action:hover .xp-mdi-icon,
.xp-ux-modal-head button:hover .xp-mdi-icon,
.xp-ux-climate-feature:hover .xp-mdi-icon,
.xp-extra-tile:hover .xp-mdi-icon,
.xp-charge-panel-actions button:hover .xp-mdi-icon{
 color:#84f3e3;filter:drop-shadow(0 1px 5px #38e7cf54);
}
.xp-ux-dock-action:disabled .xp-mdi-icon,
.xp-ux-climate-feature:disabled .xp-mdi-icon{
 filter:none;opacity:.55;
}
/* Standard back navigation: one official RTL arrow, no visible text.
   aria-label / title remain readable to assistive technologies. */
.xp-ux-modal-head button[data-xp-close],
.xp-tire-actions button[data-tire-toggle]{
 width:46px;height:46px;min-width:46px;min-height:46px;
 display:inline-flex;align-items:center;justify-content:center;
 flex:none;gap:0;padding:0;border-radius:14px;
}
.xp-ux-modal-head button[data-xp-close] .xp-mdi-icon,
.xp-tire-actions button[data-tire-toggle] .xp-mdi-icon{
 --xp-icon-size:24px!important;--mdc-icon-size:24px!important;
 width:24px!important;height:24px!important;
 color:#bfe8ff;
}
.xp-tire-actions button[data-tire-toggle]{min-width:46px}
.xp-batt-glyph{
 border:0!important;padding:0!important;border-radius:0!important;
 background:none!important;box-shadow:none!important;
 display:flex!important;align-items:center!important;justify-content:center!important;
 flex:none;color:#60f8ba;
}
.xp-batt-glyph:before{display:none!important;content:none!important}
.xp-batt-glyph>.xp-mdi-icon{
 width:100%!important;height:100%!important;
 --xp-icon-size:100%!important;--mdc-icon-size:100%!important;
 color:#6dfdc1;filter:drop-shadow(0 0 9px #13e0a560);
}
.xp-station .xp-mdi-icon{
 color:#9fe9ff;filter:drop-shadow(0 0 7px #58cfff);
 --xp-icon-size:24px!important;--mdc-icon-size:24px!important;
}
@container xpeng-layout (max-width:600px){
 .xp-ux-modal-head button[data-xp-close],
 .xp-tire-actions button[data-tire-toggle]{
  width:44px;height:44px;min-width:44px;min-height:44px;
 }
 .xp-ux-modal-head button[data-xp-close] .xp-mdi-icon{
  width:22px!important;height:22px!important;
  --xp-icon-size:22px!important;--mdc-icon-size:22px!important;
 }
}
@media(prefers-reduced-motion:reduce){
 .xp-ux-dock-action .xp-mdi-icon,
 .xp-ux-modal-head button .xp-mdi-icon,
 .xp-ux-climate-feature .xp-mdi-icon,
 .xp-extra-tile .xp-mdi-icon,
 .xp-ux-map-actions button .xp-mdi-icon,
 .xp-charge-panel-actions button .xp-mdi-icon{transition:none}
}

/* Beta 7: consistent icon color across all seven vehicle actions.
 * The only deliberate semantic accents are status indicators such as
 * battery charge, vehicle connectivity and confirmed charging.
 * Disabled buttons keep their reduced opacity: unavailable is NOT enabled. */
.xp-home-navigation .xp-ux-dock-seven .xp-ux-dock-action ha-icon,
.xp-charge-navigation .xp-ux-dock-seven .xp-ux-dock-action ha-icon{
  color:#e9f4ff;
}
/* Use the same soft mint highlight for hover/focus, never a random
 * category-dependent permanent color on one shortcut. */
.xp-home-navigation .xp-ux-dock-seven .xp-ux-dock-action:hover ha-icon,
.xp-home-navigation .xp-ux-dock-seven .xp-ux-dock-action:focus-visible ha-icon,
.xp-charge-navigation .xp-ux-dock-seven .xp-ux-dock-action:hover ha-icon,
.xp-charge-navigation .xp-ux-dock-seven .xp-ux-dock-action:focus-visible ha-icon{
  color:#84f3e3;
}
/* Header tools are siblings inside xp-meta-tools: .xp-header-right gap
 * does not separate Wi-Fi from the cog. Distinguish desktop and sections. */
.xp-header .xp-meta-tools{gap:14px}
@container xpeng-layout (max-width:850px){
  .xp-header .xp-meta-tools{gap:8px}
}
@container xpeng-layout (min-width:851px){
  /* Shift the Wi-Fi glyph, not its hit target, 2px farther up on desktop. */
  .xp-header .xp-wifi .xp-mdi-icon{transform:translateY(-4px)}
}

/* English mode follows HA's locale, with natural LTR reading order.
   Vehicle artwork, hotspot positions and charging cable never move. */
.xp-scene.xp-locale-en .xp-ux-modal,
.xp-scene.xp-locale-en .xp-charge-panel-actions,
.xp-scene.xp-locale-en .xp-ux-charge-actions,
.xp-scene.xp-locale-en .xp-ux-dock-seven{
 direction:ltr;
}
.xp-scene.xp-locale-en .xp-ux-modal-climate .xp-climate-layout>.xp-ux-climate-bottom{
 direction:ltr;
}

/* Home Assistant Sections: size within the CARD container, not the host window. */
.xp-header .xp-wifi{display:grid!important;place-items:center!important;padding:0!important}
.xp-header .xp-wifi .xp-mdi-icon{
 display:grid;place-items:center;margin:0!important;position:static;inset:auto;
 transform:none!important;
}
@container xpeng-layout (max-width:850px){
 .xp-scene{min-height:0;height:clamp(660px,calc(100dvh - 90px),800px);aspect-ratio:auto}
}
@container xpeng-layout (max-width:600px){
 .xp-scene{height:clamp(630px,calc(100dvh - 84px),780px)}
}
/* Overlay content stays inside the card; diagnostics rows own their one scroll area. */
.xp-scene .xp-ux-modal{
 display:flex;flex-direction:column;min-height:0;height:auto;max-height:none;
 inset:1.2% 1.8%;overflow:hidden!important;touch-action:manipulation;
 padding:clamp(8px,1.2cqw,16px)!important;gap:0
}
.xp-scene .xp-ux-modal-head{
 position:relative;top:auto;flex:0 0 auto;
 margin-bottom:clamp(4px,.8cqw,10px);padding:2px 1px 7px
}
.xp-ux-modal>.xp-ux-modal-content{
 flex:1 1 auto;min-width:0;min-height:0;
 display:flex;flex-direction:column;position:relative;overflow:hidden
}
.xp-ux-modal>.xp-ux-notice{flex:0 0 auto}
.xp-ux-modal-map .xp-ux-map-panel{
 display:grid;grid-template-rows:minmax(0,1fr) auto;
 flex:1 1 auto;min-height:0;min-width:0;height:100%;width:100%;
 margin:0 auto!important;gap:clamp(5px,.9cqw,11px)
}
.xp-ux-modal-map .xp-ux-map-stage{
 min-height:0!important;min-width:0;height:100%;align-self:stretch;
 display:block;overflow:hidden
}
.xp-ux-modal-map .xp-ux-map-stage hui-map-card{
 display:block!important;width:100%!important;height:100%!important;
 min-height:0!important;max-height:100%!important;overflow:hidden!important
}
.xp-ux-modal-map .xp-ux-map-actions{
 display:grid;grid-template-columns:repeat(2,minmax(0,1fr));
 margin:0!important;gap:7px;align-self:stretch;min-width:0
}
.xp-ux-modal-map .xp-ux-map-actions button{
 min-width:0;min-height:42px;padding:7px 8px;font-size:clamp(10px,1.15cqw,14px)
}
.xp-ux-modal-map .xp-ux-map-actions .xp-map-native-details{
 grid-column:1/-1;min-height:39px;padding:6px 8px
}
/* The entity list, not the dashboard/modal, scrolls. Explanation stays visible. */
.xp-ux-modal-extras .xp-extra-diagnostics-layout{
 display:flex;flex:1 1 auto;flex-direction:column;
 width:min(740px,100%);height:100%;min-height:0;
 margin:0 auto!important;gap:7px;overflow:hidden
}
.xp-ux-modal-extras .xp-extra-diagnostics-layout .xp-extra-heading{flex:0 0 auto;margin:0}
.xp-ux-modal-extras .xp-extra-diagnostics-layout .xp-extra-details{
 flex:1 1 auto;display:flex;flex-direction:column;
 min-height:0;max-height:100%;overflow:hidden!important
}
.xp-ux-modal-extras .xp-extra-diagnostics-layout .xp-entity-diagnostics{
 flex:1 1 auto;display:flex;flex-direction:column;
 min-height:0;max-height:100%;overflow:hidden!important;gap:7px
}
.xp-ux-modal-extras .xp-extra-diagnostics-layout .xp-entity-diagnostics>p[role="status"]{
 flex:0 0 auto;margin:2px 0 0
}
.xp-ux-modal-extras .xp-extra-diagnostics-layout .xp-diagnostics-scroll{
 flex:1 1 auto;display:grid!important;align-content:start;
 min-height:0!important;height:auto!important;
 max-height:min(292px,37dvh)!important;
 overflow-y:auto!important;overflow-x:hidden!important;
 overscroll-behavior:contain;touch-action:pan-y!important;
 border:1px solid #618eb078;border-radius:12px;
 background:#071f35b3;padding:7px;gap:5px;scrollbar-gutter:stable
}
.xp-ux-modal-extras .xp-extra-diagnostics-layout .xp-entity-diagnostics>.xp-ux-note,
.xp-ux-modal-extras .xp-extra-diagnostics-layout>.xp-ux-note{
 flex:0 0 auto;margin:4px 0 0;font-size:clamp(10px,1cqw,12px)
}
@container xpeng-layout (max-width:600px){
 .xp-scene .xp-ux-modal{inset:1% 1.5%;padding:9px!important}
 .xp-ux-modal-map .xp-ux-map-actions{gap:5px}
 .xp-ux-modal-map .xp-ux-map-actions button{min-height:40px;gap:4px;padding:5px;font-size:11px}
 .xp-ux-modal-extras .xp-extra-diagnostics-layout .xp-diagnostics-scroll{
   max-height:min(230px,31dvh)!important;padding:5px
 }
 .xp-ux-modal-maintenance .xp-tire-screen{
   height:clamp(160px,26dvh,212px)!important;min-height:0!important;
   margin:0 auto 7px!important
 }
 .xp-ux-modal-maintenance .xp-tire-center{height:clamp(110px,20dvh,150px)!important}
 .xp-ux-modal-maintenance .xp-tire-stage{gap:5px!important}
 .xp-ux-modal-maintenance .xp-tire-reading{padding:5px 4px!important}
 .xp-ux-modal-climate .xp-climate-layout{
   padding-bottom:0!important;gap:6px!important;margin:0 auto!important
 }
 .xp-ux-modal-climate .xp-climate-layout>.xp-ux-cabin-art.xp-ux-cabin-portrait{
   width:min(204px,53cqw)!important;margin:0 auto!important
 }
 .xp-ux-modal-climate .xp-climate-layout>.xp-ux-climate-bottom{gap:5px!important}
 .xp-ux-modal-climate .xp-climate-layout .xp-ux-climate-features{gap:4px!important}
 .xp-ux-modal-climate .xp-climate-layout .xp-ux-climate-feature{
   padding:5px 3px!important;min-height:62px!important;gap:3px!important
 }
}

/* Beta 9: make maintenance compact before applying measured content-only fit. */
.xp-ux-modal>.xp-ux-modal-content>.xp-ux-modal-content-inner{
 width:100%;min-width:0;transform-origin:top center;flex:0 0 auto
}
.xp-ux-modal-map .xp-ux-modal-content-inner,
.xp-ux-modal-extras:has(.xp-extra-diagnostics-layout) .xp-ux-modal-content-inner{
 display:flex;flex:1 1 auto;flex-direction:column;min-height:0;height:100%
}
.xp-ux-modal-maintenance .xp-maint-info{
 grid-template-columns:repeat(2,minmax(0,1fr));gap:clamp(4px,.7cqw,8px)
}
.xp-ux-modal-maintenance .xp-maint-info .xp-extra-line{
 min-width:0;min-height:0;padding:clamp(5px,.55cqw,8px)!important;
 font-size:clamp(10px,1.1cqw,13px)
}
.xp-ux-modal-maintenance .xp-tire-screen{
 height:clamp(180px,28dvh,245px)!important;min-height:0!important;margin:0 auto 8px!important
}
@container xpeng-layout (max-width:600px){
 .xp-ux-modal-maintenance .xp-maint-info{grid-template-columns:repeat(2,minmax(0,1fr))}
 .xp-ux-modal-maintenance .xp-maint-info .xp-extra-line{padding:5px!important}
 .xp-ux-modal-maintenance .xp-maintenance-page h3{font-size:14px;margin:3px 0}
}

/* G6 final visual review: use the screen's real available height, not 800px behind HA tabs. */
.xp-scene{max-height:calc(100dvh - 96px)}
@container xpeng-layout (max-width:850px){
 .xp-scene{height:clamp(610px,calc(100dvh - 116px),750px);min-height:0}
}
@container xpeng-layout (max-width:520px){
 .xp-scene{height:clamp(590px,calc(100dvh - 120px),725px);min-height:0}
}
/* Battery housing and inner fill are a single gauge driven by actual SOC. */
.xp-batt-glyph{
 box-sizing:border-box;flex:none;position:relative;display:flex;
 align-items:flex-end;justify-content:center;
 padding:5px!important;border-color:var(--xp-battery-color,#28eebc);
 background:#051527ca;color:var(--xp-battery-color,#28eebc);
}
.xp-batt-glyph:before{border-color:var(--xp-battery-color,#28eebc)}
.xp-batt-fill{
 width:100%;height:var(--xp-battery-level,0%);
 min-height:0;background:var(--xp-battery-color,#28eebc);
 border-radius:3px;box-shadow:0 0 9px currentColor;
 transition:height .25s ease,background-color .25s ease
}
.xp-batt-glyph[data-level="unknown"]{--xp-battery-color:#8096ad}
.xp-batt-glyph[data-level="low"]{--xp-battery-color:#ff526a}
.xp-batt-glyph[data-level="medium"]{--xp-battery-color:#ffc44e}
.xp-batt-glyph[data-level="good"]{--xp-battery-color:#24f2bd}
.xp-home-navigation .xp-batt-glyph{
 width:39px!important;height:57px!important;min-width:39px;
 border-width:3px!important;padding:4px!important
}
.xp-home-navigation .xp-batt-line{min-height:57px}
/* Maintenance: physical tire overlay cannot invade the detail cards. */
.xp-ux-modal-maintenance .xp-maintenance-page{
 display:flex;flex-direction:column;gap:4px;width:100%;min-width:0
}
.xp-ux-modal-maintenance .xp-maintenance-page>h3{
 margin:5px 0!important;position:relative;flex:0 0 auto
}
.xp-ux-modal-maintenance .xp-tire-screen{
 flex:0 0 auto;height:clamp(210px,31dvh,310px)!important;
 min-height:0!important;max-height:310px;margin:0 auto 13px!important;
 width:100%;position:relative
}
.xp-ux-modal-maintenance .xp-tire-stage{
 height:100%!important;min-height:0!important;max-height:100%!important
}
.xp-ux-modal-maintenance .xp-tire-center{
 height:98%!important;max-height:98%!important
}
.xp-ux-modal-maintenance .xp-maint-info{
 display:grid;grid-template-columns:repeat(2,minmax(0,1fr));
 position:relative;z-index:1;width:100%;min-width:0;gap:6px
}
.xp-ux-modal-maintenance .xp-maint-info .xp-extra-line{
 min-width:0;min-height:39px;box-sizing:border-box;
 gap:7px;padding:6px 9px!important;overflow:hidden
}
.xp-ux-modal-maintenance .xp-maint-info .xp-extra-line span{
 flex:0 1 43%;min-width:0;overflow-wrap:normal;word-break:normal
}
.xp-ux-modal-maintenance .xp-maint-info .xp-extra-line b{
 flex:0 1 57%;max-width:57%;min-width:0;
 font-size:clamp(11px,1.2cqw,14px);
 overflow-wrap:anywhere;word-break:normal;text-align:end;line-height:1.35
}
@container xpeng-layout (max-width:650px){
 .xp-ux-modal-maintenance .xp-tire-screen{
  height:clamp(175px,26dvh,225px)!important;max-height:225px;
  margin:0 auto 6px!important
 }
 .xp-ux-modal-maintenance .xp-maint-info{
  grid-template-columns:minmax(0,1fr);gap:4px
 }
 .xp-ux-modal-maintenance .xp-maint-info .xp-extra-line{
  min-height:29px;padding:4px 8px!important
 }
 .xp-ux-modal-maintenance .xp-maint-info .xp-extra-line span{flex-basis:49%}
 .xp-ux-modal-maintenance .xp-maint-info .xp-extra-line b{
  flex-basis:51%;max-width:51%;font-size:11px
 }
}
/* Diagnostics: use the available modal height, never clip a sensor ID or note. */
.xp-ux-modal-extras .xp-extra-diagnostics-layout{width:min(880px,100%);max-width:100%}
.xp-ux-modal-extras .xp-extra-diagnostics-layout .xp-diagnostics-scroll{
 display:flex!important;flex:1 1 0!important;flex-direction:column;
 height:100%!important;max-height:none!important;min-height:85px!important;
 align-items:stretch;gap:5px
}
.xp-ux-modal-extras .xp-extra-diagnostics-layout .xp-diagnostics-scroll .xp-entity-diagnostic{
 box-sizing:border-box;flex:0 0 auto;
 display:flex;align-items:center;justify-content:space-between;
 gap:8px;min-width:0;width:100%;max-width:100%;min-height:39px;
 white-space:nowrap;line-height:1.2;padding:7px 11px!important;
 overflow:hidden
}
.xp-ux-modal-extras .xp-diagnostics-scroll .xp-entity-diagnostic>span{
 display:block;min-width:0;flex:1 1 auto;
 overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
 font-size:clamp(10px,1.1cqw,13px);direction:ltr;text-align:start
}
.xp-ux-modal-extras .xp-diagnostics-scroll .xp-entity-diagnostic>b{
 display:block;flex:0 0 auto;max-width:27%;
 overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
 line-height:1.2;font-size:12px
}
.xp-ux-modal-extras .xp-extra-diagnostics-layout .xp-ux-note{
 width:100%;max-width:100%;line-height:1.3;font-size:11px
}
/* Climate: no horizontal spill at mobile widths; seat and wheel controls are
   transparent over their OWN physical positions, with MDI color feedback only. */
.xp-ux-modal-climate .xp-climate-layout{
 box-sizing:border-box;min-width:0;max-width:100%;width:100%;
 gap:clamp(7px,1.5cqw,16px)!important
}
.xp-ux-modal-climate .xp-climate-layout>.xp-ux-climate-bottom{
 box-sizing:border-box;min-width:0;max-width:100%;width:100%;
 gap:8px!important
}
.xp-ux-modal-climate .xp-climate-primary-controls{gap:7px}
.xp-ux-modal-climate .xp-climate-temp-panel,
.xp-ux-modal-climate .xp-climate-fan-panel{
 box-sizing:border-box;min-width:0;max-width:100%;overflow:hidden
}
.xp-ux-modal-climate .xp-climate-thermometers{
 grid-template-columns:minmax(0,1fr) minmax(0,1.3fr);gap:5px
}
.xp-ux-modal-climate .xp-climate-target .xp-ux-temp-line{gap:4px;min-width:0}
.xp-ux-modal-climate .xp-climate-target .xp-ux-temp-line button{
 width:32px;height:34px;min-width:32px;flex:0 0 32px
}
.xp-ux-modal-climate .xp-climate-target .xp-ux-temp-line b{
 min-width:0;font-size:clamp(19px,2.2cqw,29px)
}
.xp-ux-modal-climate .xp-fan-bars{min-width:0;width:100%;gap:3px;overflow:hidden}
.xp-ux-modal-climate .xp-fan-bars i{min-width:0}
.xp-ux-modal-climate .xp-climate-fan-panel input{width:100%;max-width:100%;min-width:0}
.xp-ux-modal-climate .xp-ux-cabin-art .xp-ux-cycle{
 background:transparent!important;backdrop-filter:none!important;
 border:1px solid transparent!important;box-shadow:none!important;
 color:#f1f9ff;text-shadow:0 1px 5px #001629
}
.xp-ux-modal-climate .xp-ux-cycle.xp-ux-cycle-on{
 box-shadow:none!important;filter:drop-shadow(0 0 6px #91e8ff)
}
.xp-ux-modal-climate .xp-ux-cycle-heat.xp-ux-cycle-on ha-icon{color:#ff8b87}
.xp-ux-modal-climate .xp-ux-cycle-vent.xp-ux-cycle-on ha-icon{color:#77e6ff}
.xp-ux-modal-climate .xp-cabin-action-label{display:none!important}
.xp-ux-modal-climate .xp-ux-cabin-art .xp-ux-hotspot-zone{gap:2px}
@container xpeng-layout (max-width:600px){
 .xp-ux-modal-climate .xp-climate-layout{
  display:flex;flex-direction:column;align-items:stretch!important
 }
 .xp-ux-modal-climate .xp-climate-layout>.xp-ux-cabin-art.xp-ux-cabin-portrait{
  order:0;align-self:center
 }
 .xp-ux-modal-climate .xp-climate-layout>.xp-ux-climate-bottom{
  order:1;width:100%;max-width:100%
 }
 .xp-ux-modal-climate .xp-climate-primary{min-height:60px;padding:6px 4px}
 .xp-ux-modal-climate .xp-climate-inside b{font-size:clamp(19px,5.5cqw,25px)}
 .xp-ux-modal-climate .xp-climate-features{
  grid-template-columns:repeat(2,minmax(0,1fr))!important
 }
 .xp-ux-modal-climate .xp-climate-temp-panel,.xp-ux-modal-climate .xp-climate-fan-panel{padding:7px 9px}
 .xp-ux-modal-climate .xp-ux-cabin-art .xp-ux-cycle{
  width:42px;min-width:42px;
  height:44px;min-height:44px;padding:1px;gap:0
 }
}

/* True official MDI decile gauge: no improvised nested CSS-drawn battery. */
.xp-batt-glyph,.xp-home-navigation .xp-batt-glyph{
 display:grid!important;place-items:center!important;
 border:0!important;background:transparent!important;
 padding:0!important;width:72px!important;min-width:72px!important;height:92px!important;
 color:var(--xp-battery-color,#24f2bd)
}
.xp-batt-glyph:before{display:none!important}
.xp-batt-glyph .xp-battery-level-icon{
 display:block;width:76px!important;height:90px!important;
 --xp-icon-size:76px!important;--mdc-icon-size:76px!important;
 color:inherit;filter:drop-shadow(0 0 7px currentColor)
}
.xp-home-navigation .xp-batt-glyph{
 width:53px!important;min-width:53px!important;height:64px!important
}
.xp-home-navigation .xp-batt-glyph .xp-battery-level-icon{
 width:51px!important;height:62px!important;
 --xp-icon-size:51px!important;--mdc-icon-size:51px!important
}

/* Owner screenshot acceptance: preserve one sensor per centered row while
   allowing long actual entity IDs to be inspected (touch/keyboard), not clipped
   into permanent ellipses. The status column remains in view. */
.xp-ux-modal-extras .xp-diagnostics-scroll .xp-entity-diagnostic>span{
 overflow-x:auto;overflow-y:hidden;text-overflow:clip;
 scrollbar-width:none;white-space:nowrap;overscroll-behavior-x:contain;
 font-size:clamp(9px,1.05cqw,12px)
}
.xp-ux-modal-extras .xp-diagnostics-scroll .xp-entity-diagnostic>span::-webkit-scrollbar{display:none}
.xp-ux-modal-extras .xp-diagnostics-scroll .xp-entity-diagnostic>span:focus-visible{
 outline:2px solid #72c9ff;outline-offset:-2px;border-radius:3px
}
/* Stop the illustrated roof/wheels from stacking over maintenance data.
   Keep tyre labels within their own isolated graphic layer. */
.xp-ux-modal-maintenance .xp-tire-screen,
.xp-ux-modal-maintenance .xp-tire-stage{
 isolation:isolate;overflow:clip!important
}
.xp-ux-modal-maintenance .xp-maint-info{
 position:relative;z-index:2;margin-top:8px;align-self:stretch
}
/* Narrow Climate: reserve enough room for BOTH +/- buttons and setpoint,
   instead of hiding the increase button outside a clipped card. */
@container xpeng-layout (max-width:440px){
 .xp-ux-modal-climate .xp-climate-thermometers{
  grid-template-columns:minmax(0,1fr) minmax(0,1.4fr);gap:4px
 }
 .xp-ux-modal-climate .xp-climate-target .xp-ux-temp-line{
  display:flex;min-width:0;max-width:100%;justify-content:space-between;gap:2px
 }
 .xp-ux-modal-climate .xp-climate-target .xp-ux-temp-line button{
  box-sizing:border-box;flex:0 0 26px;min-width:26px;width:26px;height:32px
 }
 .xp-ux-modal-climate .xp-climate-target .xp-ux-temp-line b{
  font-size:clamp(17px,5cqw,23px);white-space:nowrap
 }
}
/* Leave breathing room beneath Home Assistant's own top navigation. */
@container xpeng-layout (max-width:850px){
 .xp-scene{height:clamp(600px,calc(100dvh - 140px),740px)}
}
@container xpeng-layout (max-width:520px){
 .xp-scene{height:clamp(570px,calc(100dvh - 144px),710px)}
}

/* DESIGN-ONLY PREVIEW | premium G6 visual pass, no telemetry, control or
   navigation logic changes. Preserve the original owner vehicle assets. */
.xp-scene{
 --xp-ui-cyan:#39d9f5;--xp-ui-line:#69baf17a;
 --xp-ui-glass:linear-gradient(145deg,#102e4ce9 0%,#06182fe9 100%);
}
.xp-ux-dock-seven{
 border:1px solid #68b5e277;
 background:linear-gradient(150deg,#071a31ee,#08243bcc);
 box-shadow:0 12px 32px #0008, inset 0 1px #ffffff12;
 backdrop-filter:blur(16px)
}
.xp-ux-dock-seven .xp-ux-dock-action{
 border:1px solid #5baee077;
 border-radius:16px;background:var(--xp-ui-glass);
 box-shadow:inset 0 1px #ffffff10,0 5px 15px #0005;
 transition:background-color .15s ease,border-color .15s ease,transform .15s ease
}
.xp-ux-dock-seven .xp-ux-dock-action:hover:not(:disabled),
.xp-ux-dock-seven .xp-ux-dock-action:focus-visible{
 border-color:#43e0ff;background:#113e5ce8;transform:translateY(-1px)
}
.xp-ux-modal{
 border:1px solid #77acd05e;
 background:linear-gradient(155deg,#07182bed,#061628f6 70%,#071b34f6);
 box-shadow:0 21px 58px #000b,inset 0 1px #ffffff0d;
}
.xp-ux-modal-head{
 border-bottom:1px solid #719cba35;
}
.xp-ux-modal-head h2{
 letter-spacing:.005em;font-weight:680;line-height:1.2
}
.xp-ux-modal-head button{
 border-color:#7dbce474;background:#123654db;
 transition:background-color .15s ease,border-color .15s ease
}
.xp-ux-modal-head button:hover,.xp-ux-modal-head button:focus-visible{
 background:#174f70;border-color:#60e0fb
}
/* Same function tiles, status bindings and actions; only visual chrome. */
.xp-ux-modal-extras .xp-extra-tile{
 border:1px solid #69b2dc7b!important;
 background:linear-gradient(155deg,#112f50f0,#081c36e9)!important;
 border-radius:18px;box-shadow:inset 0 1px #ffffff10,0 7px 17px #0004;
 transition:border-color .16s ease,transform .16s ease
}
.xp-ux-modal-extras .xp-extra-tile:hover,
.xp-ux-modal-extras .xp-extra-tile:focus-visible{
 border-color:#40e0fa!important;transform:translateY(-1px)
}
/* The original climate layout and photo remain. Refine surface treatments and
   color-code actual seat/steering icons, including off levels, without overlays. */
.xp-ux-modal-climate .xp-climate-primary,
.xp-ux-modal-climate .xp-climate-temp-panel,
.xp-ux-modal-climate .xp-climate-fan-panel,
.xp-ux-modal-climate .xp-climate-layout .xp-ux-climate-feature{
 border:1px solid #67aee277!important;
 border-radius:16px!important;
 background:linear-gradient(145deg,#10314fef,#091d36e8)!important;
 box-shadow:inset 0 1px #ffffff10,0 6px 16px #0004;
}
.xp-ux-modal-climate .xp-climate-primary ha-icon{color:#52dafa}
.xp-ux-modal-climate .xp-climate-thermometers small{color:#b8d4e9}
.xp-ux-modal-climate .xp-climate-inside b,
.xp-ux-modal-climate .xp-climate-target b{font-variant-numeric:tabular-nums}
.xp-ux-modal-climate .xp-ux-cabin-art .xp-ux-cycle-heat ha-icon{
 color:#ff9b63!important;filter:drop-shadow(0 0 3px #d16a314a)
}
.xp-ux-modal-climate .xp-ux-cabin-art .xp-ux-cycle-vent ha-icon{
 color:#68d8ff!important;filter:drop-shadow(0 0 3px #38b4e34a)
}
.xp-ux-modal-climate .xp-ux-cabin-art .xp-ux-wheel ha-icon{
 color:#ffc174!important
}
.xp-ux-modal-climate .xp-ux-cabin-art .xp-ux-cycle.xp-ux-cycle-on{
 filter:drop-shadow(0 0 7px currentColor)
}
.xp-ux-modal-climate .xp-climate-fan-panel .xp-fan-bars{
 border-radius:9px
}
/* Keep TPMS on its existing diagram and details below, never overlap. */
.xp-ux-modal-maintenance .xp-tire-reading,
.xp-ux-modal-maintenance .xp-maint-info .xp-extra-line{
 border:1px solid #67acd679;
 background:linear-gradient(140deg,#10314cf0,#071e38e8);
 box-shadow:inset 0 1px #ffffff0d;
 border-radius:13px
}
.xp-ux-modal-maintenance .xp-maintenance-page>h3{
 color:#e6f8ff;font-weight:700
}
/* On desktop the SOC gauge must be visually proportional to its status card,
   while small cards keep all existing mobile size and layout rules. */
@container xpeng-layout (min-width:851px){
 .xp-scene{
  height:clamp(560px,calc(100dvh - 152px),760px);
  max-height:calc(100dvh - 130px);
  min-height:0;aspect-ratio:auto
 }
 .xp-home-navigation .xp-overview-stat{
  width:clamp(275px,27cqw,430px);max-width:430px;
  left:5%;top:35%;
  padding:clamp(14px,1.5cqw,23px);
  border-radius:22px
 }
 .xp-home-navigation .xp-batt-glyph{
  width:88px!important;min-width:88px!important;height:116px!important
 }
 .xp-home-navigation .xp-batt-glyph .xp-battery-level-icon{
  width:88px!important;height:110px!important;
  --xp-icon-size:88px!important;--mdc-icon-size:88px!important
 }
 .xp-home-navigation .xp-batt-line{min-height:116px;gap:16px}
 .xp-home-navigation .xp-overview-stat .xp-soc{
  font-size:clamp(43px,4.4cqw,70px)
 }
 .xp-home-navigation .xp-overview-stat .xp-range-num{
  font-size:clamp(25px,2.5cqw,38px)
 }
 .xp-ux-modal-climate .xp-climate-layout{
  gap:clamp(12px,1.6cqw,25px)!important
 }
}
/* Retain the exact same full-function single-card layout on phone / Sections. */
@container xpeng-layout (max-width:850px){
 .xp-ux-dock-seven .xp-ux-dock-action{
  border-radius:12px
 }
 .xp-ux-modal-climate .xp-climate-primary,
 .xp-ux-modal-climate .xp-climate-temp-panel,
 .xp-ux-modal-climate .xp-climate-fan-panel{
  border-radius:13px!important
 }
}
@media(prefers-reduced-motion:reduce){
 .xp-ux-dock-seven .xp-ux-dock-action,
 .xp-ux-modal-extras .xp-extra-tile{transition:none!important;transform:none!important}
}

/* Black Edition G6 uses black/dark cabin finish as well as its black
   exterior paint. This is a visual tone fallback until approved Black Edition
   cabin artwork exists; it does not create or substitute manufacturer photos. */
.xp-scene.xp-black-edition .xp-ux-cabin-picture{
 filter:grayscale(1) brightness(.52) contrast(1.18)
}

/* Screen guides are present only inside existing destinations, never launcher
   tiles. They explain real integration controls without inventing limits. */
.xp-help-intro{
 display:flex;flex-direction:column;gap:7px;
 margin:4px 0 clamp(12px,1.5cqw,18px);
 border:1px solid #64b7df80;border-radius:16px;
 padding:clamp(12px,1.25cqw,19px);
 background:linear-gradient(135deg,#153f59d9,#092038e8);
 box-shadow:inset 0 1px #ffffff16
}
.xp-help-intro strong{font-size:clamp(15px,1.45cqw,19px);font-weight:750;color:#eafbff}
.xp-help-intro p{margin:0;line-height:1.48;font-size:clamp(12px,1.08cqw,14px);color:#d8e8f5}
.xp-help-intro small{font-size:clamp(11px,.95cqw,13px);line-height:1.42;color:#a6c7db}
.xp-help-spec{
 border-top:1px solid #78bee344;padding-top:8px;
 color:#9deeff;font-size:clamp(11px,1.03cqw,14px);
 line-height:1.55;font-variant-numeric:tabular-nums;overflow-wrap:anywhere
}
.xp-ux-modal-extras .xp-extra-details>.xp-help-intro{margin-top:0}
@container xpeng-layout (max-width:600px){
 .xp-help-intro{padding:11px 12px;border-radius:13px;gap:5px;margin-bottom:10px}
 .xp-help-intro p{font-size:12px}
 .xp-help-spec{font-size:11px}
}

/* Scroll in narrow Home Assistant Sections/iPhone cards rather than making the
   owner's cabin photo smaller. Desktop keeps its measured content-fit behavior. */
@container xpeng-layout (max-width:850px){
 .xp-scene .xp-ux-modal:has(.xp-help-intro):not(.xp-ux-modal-map):not(:has(.xp-extra-diagnostics-layout)){
  overflow-y:auto!important;overflow-x:hidden!important;
  overscroll-behavior:contain;touch-action:pan-y
 }
 .xp-ux-modal:has(.xp-help-intro):not(.xp-ux-modal-map):not(:has(.xp-extra-diagnostics-layout))>.xp-ux-modal-content{
  flex:0 0 auto!important;min-height:auto!important;overflow:visible!important
 }
 .xp-ux-modal:has(.xp-help-intro):not(.xp-ux-modal-map):not(:has(.xp-extra-diagnostics-layout)) .xp-ux-modal-content-inner{
  flex:0 0 auto!important;height:auto!important;min-height:0!important
 }
}
@container xpeng-layout (max-width:600px){
 .xp-ux-modal-climate .xp-climate-layout>.xp-ux-cabin-art.xp-ux-cabin-portrait{
  width:clamp(178px,53cqw,204px)!important;flex-shrink:0!important
 }
}

/* Charging limit/schedule dialogs are deliberately compact. With a function
   guide in their header, allow the actual controls to scroll at any card width. */
.xp-scene .xp-ux-modal.xp-charge-compact-modal:has(.xp-help-intro){
 overflow-y:auto!important;overflow-x:hidden!important;touch-action:pan-y
}
.xp-ux-modal.xp-charge-compact-modal:has(.xp-help-intro)>.xp-ux-modal-content{
 flex:0 0 auto!important;overflow:visible!important;min-height:auto!important
}
.xp-ux-modal.xp-charge-compact-modal:has(.xp-help-intro) .xp-ux-modal-content-inner{
 height:auto!important;min-height:0!important
}

/* Seven existing Custom Functions launch tiles must remain readable on 320px
   screens; allow the options launcher to scroll instead of clipping row seven. */
@container xpeng-layout (max-width:850px){
 .xp-scene .xp-ux-modal-extras:not(:has(.xp-extra-diagnostics-layout)){
  overflow-y:auto!important;overflow-x:hidden!important;touch-action:pan-y
 }
 .xp-ux-modal-extras:not(:has(.xp-extra-diagnostics-layout))>.xp-ux-modal-content{
  flex:0 0 auto!important;overflow:visible!important
 }
 .xp-ux-modal-extras:not(:has(.xp-extra-diagnostics-layout)) .xp-ux-modal-content-inner{
  height:auto!important
 }
}

/* ========================================================================
   XPENG G6 / V2 DESIGN SYSTEM — owner design-review branch
   All visuals live here. Never alter the real Xpengtk commands, state checks,
   navigation, photo URLs or the automatic charging scene.
   Surface language: midnight slate / mineral glass / soft cyan light.
   ======================================================================== */
.xp-scene{
 --xp-v2-ink:#eef7ff;--xp-v2-muted:#a8c2d2;
 --xp-v2-aqua:#69deef;--xp-v2-mint:#52e5b8;
 --xp-v2-stroke:rgba(151,202,228,.25);
 --xp-v2-stroke-strong:rgba(130,209,235,.53);
 --xp-v2-surface:linear-gradient(144deg,rgba(18,41,58,.95),rgba(6,18,34,.94));
 --xp-v2-soft:linear-gradient(155deg,rgba(18,48,66,.8),rgba(9,26,44,.88));
 --xp-v2-elev:0 14px 36px rgba(0,4,14,.34),inset 0 1px 0 rgba(227,248,255,.11);
 --xp-v2-radius:20px;
 color:var(--xp-v2-ink);font-variant-numeric:tabular-nums;
}
/* Brand/tool rail: one compact, consistent control surface. */
.xp-scene .xp-header{
 top:2.4%;left:3.1%;right:3.1%;
 min-height:60px;padding:9px clamp(12px,1.5cqw,22px);
 background:linear-gradient(105deg,rgba(7,20,35,.91),rgba(8,30,45,.82));
 border:1px solid var(--xp-v2-stroke);
 border-radius:19px;box-shadow:0 8px 24px rgba(0,0,0,.29);
 backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);
}
.xp-scene .xp-brand{
 font-weight:730;letter-spacing:.115em;
 text-shadow:0 1px 12px rgba(10,28,44,.9);
}
.xp-scene .xp-header .xp-meta-tools{gap:14px}
.xp-scene .xp-header .xp-wifi,
.xp-scene .xp-header .xp-more-trigger{
 border:1px solid var(--xp-v2-stroke-strong)!important;
 border-radius:13px!important;background:rgba(25,57,75,.68)!important;
 box-shadow:inset 0 1px 0 rgba(240,254,255,.12);
 transition:background .15s ease,border-color .15s ease;
}
.xp-scene .xp-header .xp-wifi:hover,
.xp-scene .xp-header .xp-more-trigger:hover{
 background:rgba(41,87,107,.9)!important;border-color:var(--xp-v2-aqua)!important;
}
/* Hero battery / range: establish a legible information hierarchy. */
.xp-home-navigation .xp-overview-stat,
.xp-charge-navigation .xp-overview-stat{
 padding:clamp(14px,1.7cqw,26px)!important;
 border:1px solid var(--xp-v2-stroke-strong)!important;
 border-radius:24px!important;
 background:linear-gradient(137deg,rgba(14,43,60,.94),rgba(4,21,38,.94))!important;
 box-shadow:var(--xp-v2-elev),0 0 28px rgba(20,155,182,.08)!important;
 backdrop-filter:blur(15px);
}
.xp-home-navigation .xp-batt-line,.xp-charge-navigation .xp-batt-line{
 align-items:center;gap:clamp(9px,1.4cqw,19px)
}
.xp-home-navigation .xp-overview-stat .xp-soc,
.xp-charge-navigation .xp-overview-stat .xp-soc{
 font-weight:780;letter-spacing:-.05em;
 text-shadow:0 2px 24px rgba(43,226,197,.18);
}
.xp-home-navigation .xp-overview-stat .xp-stat-label,
.xp-charge-navigation .xp-overview-stat .xp-stat-label{
 color:var(--xp-v2-muted)!important;font-weight:550;
 letter-spacing:.025em
}
.xp-home-navigation .xp-overview-range,
.xp-charge-navigation .xp-overview-range{
 margin-top:clamp(10px,1.4cqw,23px);
 padding-top:clamp(10px,1.25cqw,18px);
 border-top:1px solid rgba(116,190,214,.23)
}
.xp-scene .xp-overview-stat .xp-progress{
 height:9px;border:1px solid rgba(111,174,197,.26);
 background:#04192b!important;box-shadow:inset 0 2px 7px rgba(0,0,0,.5)
}
.xp-scene .xp-overview-stat .xp-progress div{
 background:linear-gradient(90deg,#34bfae,#61efd0)!important;
 box-shadow:0 0 14px rgba(76,244,197,.32)
}
.xp-scene .xp-status-panel{
 border:1px solid var(--xp-v2-stroke)!important;border-radius:22px!important;
 background:var(--xp-v2-surface)!important;
 box-shadow:var(--xp-v2-elev)!important;
 backdrop-filter:blur(16px)
}
.xp-scene .xp-status-panel .xp-info-row{
 border-bottom-color:rgba(155,205,235,.16)
}
.xp-scene .xp-info-icon{color:var(--xp-v2-aqua)}
.xp-scene .xp-charge-meta{
 border-top-color:rgba(131,209,225,.24)
}
/* Bottom dock — seven existing shortcuts, same bindings and order. */
.xp-scene .xp-ux-dock-seven{
 gap:clamp(5px,.8cqw,12px);
 border:1px solid rgba(139,204,231,.37)!important;
 border-radius:23px!important;
 background:linear-gradient(120deg,rgba(4,15,29,.96),rgba(10,32,48,.93))!important;
 box-shadow:0 15px 40px rgba(0,0,0,.4),inset 0 1px rgba(235,249,255,.11)!important;
 backdrop-filter:blur(22px)
}
.xp-scene .xp-ux-dock-seven .xp-ux-dock-action{
 border:1px solid rgba(132,181,208,.21)!important;
 border-radius:15px!important;
 background:linear-gradient(160deg,rgba(27,53,72,.84),rgba(8,26,44,.86))!important;
 box-shadow:inset 0 1px rgba(244,254,255,.06)!important;
 transition:transform .17s ease,border-color .17s ease,background-color .17s ease
}
.xp-scene .xp-ux-dock-seven .xp-ux-dock-action ha-icon{
 color:#e9f4ff;
 filter:drop-shadow(0 0 7px rgba(109,224,243,.14))
}
.xp-scene .xp-ux-dock-seven .xp-ux-dock-action small{
 color:#d2e4ef!important;font-weight:600!important;letter-spacing:.005em
}
.xp-scene .xp-ux-dock-seven .xp-ux-dock-action:disabled{
 opacity:.47!important;filter:saturate(.5);cursor:not-allowed
}
.xp-scene .xp-ux-dock-seven .xp-ux-dock-action:not(:disabled):is(:hover,:focus-visible){
 transform:translateY(-2px);border-color:rgba(109,230,245,.83)!important;
 background:linear-gradient(145deg,rgba(30,89,105,.9),rgba(12,46,69,.94))!important;
}
/* Functional modal architecture: legible header, consistent material surfaces. */
.xp-scene .xp-ux-modal{
 background:linear-gradient(154deg,rgba(5,19,33,.97),rgba(10,33,52,.97) 63%,rgba(5,20,36,.98))!important;
 border:1px solid rgba(143,199,226,.46)!important;
 border-radius:23px!important;
 box-shadow:0 24px 55px rgba(0,0,0,.52),inset 0 1px rgba(228,247,255,.11)!important;
 backdrop-filter:blur(20px)
}
.xp-scene .xp-ux-modal-head{
 padding-bottom:clamp(9px,1.15cqw,15px);
 border-bottom:1px solid rgba(142,201,223,.25);
 gap:clamp(9px,1.1cqw,16px)
}
.xp-scene .xp-ux-modal-head h2{
 font-weight:750;letter-spacing:-.023em;color:#f3fbff;
 text-shadow:0 1px 10px rgba(0,0,0,.28)
}
.xp-scene .xp-ux-modal-head button{
 background:linear-gradient(145deg,#1c4961,#0b2944)!important;
 border:1px solid rgba(147,219,239,.41)!important;border-radius:14px!important;
 box-shadow:inset 0 1px rgba(235,249,255,.1);
 color:var(--xp-v2-ink)
}
.xp-scene .xp-ux-modal-head button:is(:hover,:focus-visible){
 background:#256c82!important;border-color:#7ee7ee!important
}
/* Help panel lives in each feature, but feels integrated rather than bolted on. */
.xp-scene .xp-help-intro{
 gap:7px;border:1px solid rgba(131,202,228,.37)!important;
 border-left:3px solid var(--xp-v2-aqua)!important;
 border-radius:15px!important;padding:clamp(12px,1.3cqw,17px)!important;
 background:linear-gradient(108deg,rgba(25,62,78,.84),rgba(12,37,58,.77))!important;
 box-shadow:inset 0 1px rgba(251,255,255,.07)!important
}
.xp-scene .xp-help-intro strong{
 font-weight:770;color:#f0fcff;letter-spacing:.012em
}
.xp-scene .xp-help-intro p{color:#d5e7f0;line-height:1.52}
.xp-scene .xp-help-spec{
 border-top:1px solid rgba(128,203,226,.25)!important;
 color:#91edf3!important;font-weight:690
}
/* Large real controls are distinct from read-only measurements. */
.xp-scene .xp-extra-action,
.xp-scene .xp-ux-climate-feature,
.xp-scene .xp-climate-primary,
.xp-scene .xp-ux-charge-stop,
.xp-scene .xp-ux-charge-limit{
 border:1px solid rgba(137,202,226,.39)!important;
 background:linear-gradient(150deg,rgba(23,55,73,.9),rgba(9,30,49,.93))!important;
 border-radius:16px!important;box-shadow:inset 0 1px rgba(234,250,255,.1)!important;
}
.xp-scene .xp-extra-action:not(:disabled):is(:hover,:focus-visible),
.xp-scene .xp-ux-climate-feature:not(:disabled):is(:hover,:focus-visible),
.xp-scene .xp-climate-primary:not(:disabled):is(:hover,:focus-visible){
 border-color:rgba(99,225,243,.84)!important;
 background:linear-gradient(150deg,#19536b,#0c364f)!important
}
.xp-scene .xp-ux-selected{
 border-color:rgba(92,234,217,.88)!important;
 box-shadow:inset 0 1px rgba(234,250,255,.16),0 0 0 1px rgba(79,227,199,.25)!important
}
.xp-scene .xp-extra-action:disabled,
.xp-scene .xp-ux-climate-feature:disabled{opacity:.48!important}
/* Rebuilt Climate visual hierarchy: cabin stays on the original side and
   touch hotspots stay positioned on original owner photo. */
.xp-scene .xp-ux-modal-climate .xp-climate-layout{
 column-gap:clamp(12px,1.7cqw,24px)!important;
 row-gap:clamp(8px,1.2cqw,16px)!important
}
.xp-scene .xp-ux-modal-climate .xp-climate-primary{
 border-radius:17px!important;
 box-shadow:inset 0 1px rgba(238,251,255,.11),0 6px 18px rgba(0,0,0,.2)!important
}
.xp-scene .xp-ux-modal-climate .xp-climate-temp-panel,
.xp-scene .xp-ux-modal-climate .xp-climate-fan-panel,
.xp-scene .xp-ux-modal-climate .xp-ux-climate-feature{
 background:linear-gradient(138deg,rgba(23,57,75,.9),rgba(7,28,45,.91))!important;
 border:1px solid rgba(134,202,228,.38)!important;
 box-shadow:inset 0 1px rgba(255,255,255,.09)!important;
 border-radius:16px!important
}
.xp-scene .xp-ux-modal-climate .xp-climate-primary b{font-weight:740}
.xp-scene .xp-ux-modal-climate .xp-climate-thermometers b{
 letter-spacing:-.04em;font-weight:730
}
.xp-scene .xp-ux-modal-climate .xp-ux-temp-line button{
 border:1px solid rgba(136,214,235,.41)!important;
 background:linear-gradient(135deg,#1b4b61,#102f4d)!important;
 border-radius:11px!important;box-shadow:inset 0 1px rgba(241,251,255,.11)
}
.xp-scene .xp-ux-modal-climate .xp-ux-temp-line button:is(:hover,:focus-visible){
 border-color:#70e5f1!important;background:#25647b!important
}
.xp-scene .xp-ux-modal-climate .xp-fan-bars i{
 background:#09283e!important;border:1px solid rgba(156,210,232,.17)!important;
 border-radius:6px
}
.xp-scene .xp-ux-modal-climate .xp-fan-bars i.xp-fan-bar-on{
 background:linear-gradient(0deg,#2b92cd,#83e5ee)!important;
 box-shadow:0 0 8px rgba(87,204,235,.35)
}
.xp-scene .xp-ux-modal-climate .xp-ux-cabin-art.xp-ux-cabin-portrait{
 border-radius:19px;filter:drop-shadow(0 10px 14px rgba(0,0,0,.29))
}
.xp-scene .xp-ux-modal-climate .xp-ux-cabin-art .xp-ux-cycle-heat ha-icon{
 color:#ffac70!important;filter:drop-shadow(0 0 4px rgba(255,149,85,.55))
}
.xp-scene .xp-ux-modal-climate .xp-ux-cabin-art .xp-ux-cycle-vent ha-icon{
 color:#63dcff!important;filter:drop-shadow(0 0 4px rgba(70,202,242,.44))
}
.xp-scene .xp-ux-modal-climate .xp-ux-cabin-art .xp-ux-wheel ha-icon{
 color:#ffc47e!important
}
/* Tire screen: clean TPMS data around ORIGINAL top-view image, details below. */
.xp-scene .xp-ux-modal-maintenance .xp-maintenance-page>h3{
 color:#eaf6ff;letter-spacing:-.016em;font-weight:740;
 border-left:3px solid rgba(111,225,228,.8);padding-left:10px
}
.xp-scene .xp-ux-modal-maintenance .xp-tire-reading{
 background:linear-gradient(150deg,rgba(19,56,75,.91),rgba(8,30,50,.93))!important;
 border:1px solid rgba(119,188,221,.38)!important;
 border-radius:14px!important;box-shadow:inset 0 1px rgba(241,255,255,.08)!important
}
.xp-scene .xp-ux-modal-maintenance .xp-tire-reading strong{
 font-weight:750;letter-spacing:-.03em
}
.xp-scene .xp-ux-modal-maintenance .xp-maint-info .xp-extra-line{
 border:1px solid rgba(133,203,226,.3)!important;border-radius:12px!important;
 background:linear-gradient(140deg,rgba(20,48,66,.81),rgba(8,28,47,.9))!important;
 box-shadow:inset 0 1px rgba(237,255,255,.07)!important
}
/* Custom Functions: card collection reads like premium system controls, not
   bright decorative tiles. All seven original destinations stay intact. */
.xp-scene .xp-ux-modal-extras .xp-extra-grid{gap:clamp(8px,1.1cqw,15px)}
.xp-scene .xp-ux-modal-extras .xp-extra-tile{
 background:linear-gradient(142deg,rgba(26,63,82,.83),rgba(8,27,46,.95))!important;
 border:1px solid rgba(143,205,232,.34)!important;
 border-radius:20px!important;
 box-shadow:0 7px 20px rgba(0,3,10,.24),inset 0 1px rgba(247,255,255,.11)!important;
 transition:border-color .17s,transform .17s,box-shadow .17s;
}
.xp-scene .xp-ux-modal-extras .xp-extra-tile ha-icon{
 color:#83dfef!important;filter:drop-shadow(0 0 9px rgba(86,202,238,.2))
}
.xp-scene .xp-ux-modal-extras .xp-extra-tile b{
 color:#effaff;font-weight:735;letter-spacing:-.01em
}
.xp-scene .xp-ux-modal-extras .xp-extra-tile small{
 color:#b2ccdc;line-height:1.4
}
.xp-scene .xp-ux-modal-extras .xp-extra-tile:is(:hover,:focus-visible){
 border-color:#71e5ed!important;transform:translateY(-2px);
 box-shadow:0 11px 23px rgba(0,6,17,.32),inset 0 1px rgba(255,255,255,.17)!important
}
.xp-scene .xp-ux-modal-extras .xp-extra-heading strong{
 font-weight:780;letter-spacing:-.018em
}
.xp-scene .xp-ux-modal-extras .xp-extra-line,
.xp-scene .xp-charge-compact-modal .xp-extra-line{
 background:linear-gradient(120deg,rgba(17,48,66,.86),rgba(10,30,47,.9))!important;
 border:1px solid rgba(142,199,224,.31)!important;
 border-radius:13px!important
}
.xp-scene .xp-extra-line span{color:#b8d2e0}
.xp-scene .xp-extra-line b{color:#f2fcff}
.xp-scene input[type="range"]{accent-color:#66dce8}
/* Compact phone and Sections: retain current content geometry and touch zones;
   only adjust visual density and typographic contrast. */
@container xpeng-layout (max-width:850px){
 .xp-scene .xp-header .xp-meta-tools{gap:8px}
 .xp-scene .xp-header{
  top:1.2%;left:3%;right:3%;min-height:48px;
  padding:6px 8px;border-radius:15px
 }
 .xp-scene .xp-brand{letter-spacing:.025em;font-size:clamp(11px,3cqw,14px)}
 .xp-scene .xp-ux-modal{border-radius:17px!important}
 .xp-scene .xp-ux-modal-head{padding-bottom:9px}
 .xp-scene .xp-ux-dock-seven{gap:5px;border-radius:19px!important}
 .xp-scene .xp-ux-dock-seven .xp-ux-dock-action{border-radius:12px!important}
 .xp-scene .xp-ux-modal-extras .xp-extra-tile{border-radius:16px!important}
 .xp-scene .xp-help-intro{border-radius:13px!important;padding:11px!important}
 .xp-scene .xp-ux-modal-climate .xp-climate-layout{gap:8px!important}
}
@container xpeng-layout (max-width:390px){
 .xp-scene .xp-header{padding:5px 7px}
 .xp-scene .xp-ux-dock-seven .xp-ux-dock-action small{
  font-size:clamp(8px,2.45cqw,10px)!important
 }
 .xp-scene .xp-ux-modal-extras .xp-extra-tile{min-height:112px}
}
@media(prefers-reduced-motion:reduce){
 .xp-scene .xp-ux-dock-seven .xp-ux-dock-action,
 .xp-scene .xp-ux-modal-extras .xp-extra-tile{transition:none!important;transform:none!important}
}

/* On Sections/iPhone widths reserve the original car-photo clearance. Larger
   premium battery card proportions are desktop-only; no hero overlap. */
@container xpeng-layout (max-width:850px){
 .xp-home-navigation .xp-overview-stat,
 .xp-charge-navigation .xp-overview-stat{
  padding:5px 9px!important;border-radius:16px!important
 }
 .xp-home-navigation .xp-overview-range,
 .xp-charge-navigation .xp-overview-range{
  margin-top:6px!important;padding-top:6px!important
 }
}

/* =======================================================================
   G6 V2.1 — actual information-layout refresh, not just surface recoloring.
   Desktop HVAC now gives the original cabin photograph its own left stage
   and groups the existing live controls in the right-side instrument stack.
   Other pages keep all their current entities and buttons.
   ======================================================================= */
@container xpeng-layout (min-width:851px){
 .xp-ux-modal-climate .xp-climate-layout{
  display:grid!important;
  grid-template-columns:minmax(295px,.82fr) minmax(0,1.18fr)!important;
  align-items:center!important;
  column-gap:clamp(20px,3cqw,44px)!important;
  max-width:1220px!important;
 }
 .xp-ux-modal-climate .xp-climate-layout>.xp-ux-cabin-art.xp-ux-cabin-portrait{
  grid-column:1!important;grid-row:1!important;order:0!important;
  justify-self:center;align-self:center!important;
  width:min(326px,100%)!important;max-width:100%!important;
  margin:0 auto!important;
 }
 .xp-ux-modal-climate .xp-climate-layout>.xp-ux-climate-bottom{
  grid-column:2!important;grid-row:1!important;order:1!important;
  width:100%!important;max-width:650px!important;
  align-self:center;justify-self:stretch;min-width:0;
 }
 .xp-ux-modal-climate .xp-help-intro{
  display:grid!important;
  grid-template-columns:minmax(200px,.34fr) minmax(0,1fr);
  grid-template-rows:auto auto;
  column-gap:clamp(14px,2.4cqw,32px);row-gap:5px;
  align-items:start;
 }
 .xp-ux-modal-climate .xp-help-intro>strong{
  grid-column:1;grid-row:1;
 }
 .xp-ux-modal-climate .xp-help-intro>p{
  grid-column:2;grid-row:1;
 }
 .xp-ux-modal-climate .xp-help-intro>.xp-help-spec{
  grid-column:1;grid-row:2;
  border:0!important;padding-top:0!important;
  font-size:12px
 }
 .xp-ux-modal-climate .xp-help-intro>small{
  grid-column:2;grid-row:2;
 }
 .xp-ux-modal-extras .xp-extra-grid{
  grid-template-columns:repeat(3,minmax(0,1fr))!important;
  max-width:1080px;margin:0 auto;
 }
 .xp-ux-modal-extras .xp-extra-tile{
  display:grid!important;
  grid-template-columns:42px minmax(0,1fr)!important;
  grid-template-rows:auto auto;
  justify-items:start;text-align:left!important;
  align-content:center;column-gap:14px;row-gap:3px;
  min-height:120px;padding:15px 18px!important
 }
 .xp-ux-modal-extras .xp-extra-tile ha-icon{
  grid-column:1;grid-row:1/3;
  width:34px;height:34px;--mdc-icon-size:34px
 }
 .xp-ux-modal-extras .xp-extra-tile b{
  grid-column:2;grid-row:1;font-size:17px!important
 }
 .xp-ux-modal-extras .xp-extra-tile small{
  grid-column:2;grid-row:2;font-size:12px!important
 }
 .xp-ux-modal-maintenance .xp-tire-stage{
  border:1px solid rgba(133,204,228,.3);
  border-radius:20px;
  background:linear-gradient(130deg,rgba(19,55,69,.25),rgba(10,29,46,.16));
  box-shadow:inset 0 1px rgba(225,246,253,.06)
 }
 .xp-ux-modal-maintenance .xp-maint-info{
  border-top:1px solid rgba(129,201,220,.18);
  padding-top:8px
 }
}
/* Small phones keep the owner-provided cabin stage above climate controls.
   Extras become compact, centered 2-column tiles with all actions retained. */
@container xpeng-layout (max-width:850px){
 .xp-ux-modal-climate .xp-climate-layout>.xp-ux-cabin-art.xp-ux-cabin-portrait{
  grid-column:auto!important;grid-row:auto!important;order:0!important
 }
 .xp-ux-modal-climate .xp-climate-layout>.xp-ux-climate-bottom{
  grid-column:auto!important;grid-row:auto!important;order:1!important
 }
 .xp-ux-modal-extras .xp-extra-tile{
  display:flex!important;flex-direction:column!important;
  justify-content:center!important;align-items:center!important;
  text-align:center!important
 }
}

/* Official MDI SUV rear hatch: actual car silhouette + separate small
   up/down pictogram. Never obscure the vehicle's body or draw custom SVG. */
.xp-trunk-symbol{
 --xp-trunk-size:27px;
 display:inline-flex!important;
 align-items:center!important;justify-content:center!important;
 direction:ltr!important; /* car faces right: the rear hatch is on the LEFT */
 flex-direction:row-reverse!important; /* arrow sits by the actual rear */
 gap:0;flex:0 0 auto;
 width:calc(var(--xp-trunk-size) + 11px)!important;
 height:var(--xp-trunk-size)!important;
 position:relative;vertical-align:middle;
 color:inherit
}
.xp-trunk-symbol>.xp-mdi-icon{
 display:inline-flex!important;place-items:center;
 flex:0 0 var(--xp-trunk-size)!important;
 width:var(--xp-trunk-size)!important;
 height:var(--xp-trunk-size)!important;
 --mdc-icon-size:var(--xp-trunk-size)!important
}
.xp-trunk-symbol>.xp-trunk-arrow{
 position:static!important;inset:auto!important;
 display:inline-flex!important;place-items:center;
 flex:0 0 10px!important;
 width:10px!important;height:10px!important;
 min-width:0!important;min-height:0!important;
 margin-left:0!important;
 --mdc-icon-size:10px!important;
 --xp-icon-size:10px!important;
 border:0!important;border-radius:0!important;
 background:transparent!important;box-shadow:none!important;
 color:#5decc3!important;transform:none!important
}
.xp-trunk-symbol-lower>.xp-trunk-arrow{color:#ffc17b!important}
.xp-scene .xp-ux-dock-seven .xp-ux-dock-action .xp-trunk-symbol{
 align-self:center;margin:3px 0 0
}
@container xpeng-layout (max-width:520px){
 .xp-trunk-symbol>.xp-trunk-arrow{
  flex-basis:9px!important;
  width:9px!important;height:9px!important;
  --mdc-icon-size:9px!important;--xp-icon-size:9px!important
 }
}

/* Genuine MDI rear hatch icon, not a composite car/arrow illustration. */
.xp-scene .xp-ux-dock-seven .xp-ux-dock-action .xp-mdi-icon[icon="mdi:car-back"]{--mdc-icon-size:27px!important;color:#a7e5fb}

`;
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
    const b=ev.target.closest('button');if(!b)return;
     
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
        if(['honk_horn','flash_lights'].includes(action))this.xpSend('button','press',action);
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
         ' aria-label="'+xpEsc(label)+'" title="'+xpEsc(label)+'" '+(pending?'aria-busy="true" ':'')+(available?'':'disabled')+'>'+
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
 async xpMountMap(){
   if(this._xpPanel!=='map')return;
   const host=this.shadowRoot?.querySelector?.('[data-xp-map-host]');
   const gps=this.xpLive('device_tracker','location');
   if(!host||!gps)return;
   try{
     // Retain the actual HA map card instance and tiles across sensor updates.
     // Recreating Leaflet with innerHTML on each HA hass tick causes flashing.
     if(this._xpMapElement&&this._xpMapEntityId===gps.id){
       this._xpMapElement.hass=this._hass;
       if(!host.contains?.(this._xpMapElement))host.replaceChildren(this._xpMapElement);
       return;
     }
     const helper=await this.xpWarmMapHelpers();
     if(!helper){host.textContent=xpLocalizeMarkup('המפה המובנית אינה זמינה בכרטיס זה כרגע.',this._hass);return;}
     if(this._xpPanel!=='map'||!this.shadowRoot?.contains?.(host)||
        this.xpLive('device_tracker','location')?.id!==gps.id)return;
     const map=helper.createCardElement({type:'map',entities:[{entity:gps.id}],
       default_zoom:11,hours_to_show:0,theme_mode:'dark',aspect_ratio:'4:3'});
     map.hass=this._hass;
     this._xpMapElement=map;this._xpMapEntityId=gps.id;
     host.replaceChildren(map);
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
       this.xpClimatePrimaryControls()+this.xpTempControl()+this.xpFanControl()+
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
   const odometer=this.num('odometer','km');
   const maint=this.xpLive('sensor','maintenance');
   const ident=this.xpLive('sensor','vehicle_identity');
   const attrs=ident?.state?.attributes||{};
   const masked=typeof attrs.vin_masked==='string'&&attrs.vin_masked.trim()?attrs.vin_masked:'—';
   const line=(name,value)=>'<div class="xp-extra-line"><span>'+xpEsc(name)+'</span><b>'+xpEsc(value)+'</b></div>';
   const info=[
     line('קילומטראז׳',odometer),
     line('הטיפול הבא',maint?.state?.state||'—'),
     line('תאריך טיפול',maint?.state?.attributes?.next_date||'—'),
     line('ק״מ שנותרו לטיפול',maint?.state?.attributes?.km_remaining??'—'),
     line('מספר שלדה (מוסתר)',masked),
     line('דגם',attrs.vehicle_type_name||attrs.model_family||this.model()),
     line(attrs.model_year?'שנת דגם (מהאינטגרציה)':'שנת דגם (מהגדרות הכרטיס)',attrs.model_year||this.year()),
     line('יצרן',attrs.manufacturer||'XPENG'),
     line('גרסת XOS',this.xpLive('sensor','xos_version')?.state?.state||'—')
   ].join('');
   return '<div class="xp-maintenance-page"><h3>לחץ אוויר בארבעת הצמיגים</h3>'+
      this.tireScreen(false)+'<h3>תחזוקה ופרטי רכב</h3><div class="xp-maint-info">'+info+'</div>'+
      '<p class="xp-ux-note">הערכים מתעדכנים לפי Home Assistant. מספר השלדה המלא אינו חשוף באינטגרציה.</p></div>';
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
     return this.xpMaintenancePanel()+(out?'<div class="xp-maint-additional">'+out+'</div>':'');
   }
   if(section==='updates'){
     let out=this.xpExtraLine('גרסת XOS','sensor','xos_version');
     out+=this.xpExtraLine('עדכוני תוכנה','sensor','ota_upgrade');
     const auto=this.xpExtraLive('switch','auto_upgrade_switch');
     if(auto?.state.state==='on')out+=this.xpExtraAction('כבה עדכונים אוטומטיים','ota_off','switch','auto_upgrade_switch');
     else if(auto?.state.state==='off')out+=this.xpExtraAction('הפעל עדכונים אוטומטיים','ota_on','switch','auto_upgrade_switch');
     if(this.xpExtraLive('sensor','ota_upgrade'))out+='<button type="button" class="xp-extra-action" data-xp-extra-detail="ota">פרטי עדכון</button>';
     return out||'<p>אין נתוני גרסה או עדכונים זמינים.</p>';
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
     maintenance:['Maintenance and tire pressure','Four tire readings are paired with their physical wheel positions. Other values show odometer, next service and vehicle identity.','Recommended tire pressure must come from the actual vehicle placard; no universal minimum or maximum is assumed.'],
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
       +'<div class="xp-extra-details">'+this.xpExtraSectionGuide(section[0])+this.xpExtraSectionContent(section[0])+'</div>'
       +(section[0]==='diagnostics'?'':'<p class="xp-ux-note">המידע מגיע מ־Xpengtk. הפקודות פועלות לפי הרשאות Home Assistant והרכב בלבד.</p>')+'</div>';
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
      ['open_windows','close_windows','open_charge_port','close_charge_port','open_trunk','close_trunk'].includes(suffix))
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
    if(this._xpMapElement)this._xpMapElement.hass=hass;
    for(const [suffix,action] of [['honk_horn','honk_horn'],['flash_lights','flash_lights']]){
      const button=this.shadowRoot.querySelector('[data-xp-map-action="'+action+'"]');
      if(button)button.disabled=!this.xpLive('button',suffix);
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
   return `<header class="xp-header"><div class="xp-brand"><span>XPENG</span></div>
     <div class="xp-header-right"><div class="xp-meta-tools">
        ${this.xpUiEnabled()&&this._view!=='charging'&&!this._xpPanel?'<button type="button" class="xp-more-trigger" data-xp-more aria-label="אפשרויות נוספות" title="אפשרויות נוספות">'+xpIcon('settings',21)+'</button>':''}
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
  tireScreen(showBack=true){
    const a=this.appearance(),photo=Array.isArray(this._config.vehicles)&&this._config.vehicles.length
      ?this.vehicle()?.top_image:this.vehicle()?.top_image||this._config.top_image;
    const unit=this.tirePressureUnit();
    const wheel=(key,label)=>{const reading=this.tirePressureDisplay(key);
      return `<div class="xp-tire-reading" data-wheel="${key}" role="group" aria-label="${xpEsc(label)}">
        ${xpIcon('tire',20)}<div class="xp-tire-reading-body"><small>${xpEsc(label)}</small>
        <strong dir="ltr">${xpEsc(reading.value)} <span>${reading.value==='—'?'לא זמין':unit==='kpa'?'kPa':unit==='psi'?'PSI':'bar'}</span></strong></div>
      </div>`;};
    return `<section class="xp-tire-screen" role="region" aria-label="Tire pressure from above">
       ${showBack?`<div class="xp-tire-actions"><button type="button" data-tire-toggle aria-label="חזרה לתצוגת הרכב" title="חזרה לתצוגת הרכב">${xpIcon('back',22)}</button></div>`:''}
       <div class="xp-tire-stage"><div class="xp-tire-center">${this.topCarArt()}</div>
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
    <div class="xp-station" aria-hidden="true">${xpIcon('station',24)}</div>${this.carArt()}
    ${this.model()==='G6'&&this.xpChargingActive()?
      '<svg class="xp-charge-cable xp-charge-cable-live xp-cable-desktop" data-xp-cable="desktop" aria-hidden="true" viewBox="0 0 1400 788" preserveAspectRatio="none"><path class="xp-charge-cable-halo" d="M935 460 C950 499 960 555 998 589 C1038 623 1095 629 1145 632 S1235 635 1277 610 C1311 588 1317 535 1310 475"/><path class="xp-charge-cable-core" d="M935 460 C950 499 960 555 998 589 C1038 623 1095 629 1145 632 S1235 635 1277 610 C1311 588 1317 535 1310 475"/></svg>'+
      '<svg class="xp-charge-cable xp-charge-cable-live xp-cable-mobile" data-xp-cable="mobile" aria-hidden="true" viewBox="0 0 390 780" preserveAspectRatio="none"><path class="xp-charge-cable-halo" d="M171 489 C190 515 191 558 211 581 C236 609 270 612 301 603 C333 596 349 573 358 551 C362 541 359 529 358 516"/><path class="xp-charge-cable-core" d="M171 489 C190 515 191 558 211 581 C236 609 270 612 301 603 C333 596 349 573 358 551 C362 541 359 529 358 516"/></svg>':''}
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
  const onChargeHome=isCharging&&!this._xpPanel;
  const chargeLayout=isCharging&&this.xpUiEnabled();
  const showDock=this.xpUiEnabled()&&(onHome||onChargeHome);
  const oldModal=this.shadowRoot.querySelector?.('.xp-ux-modal');
  const oldPanel=oldModal?.className||'';
  const oldScroll=oldModal?.scrollTop||0;
  const oldDiagnostics=oldModal?.querySelector?.('.xp-diagnostics-scroll')?.scrollTop||0;
  const html=xpLocalizeMarkup(`<style>${XP_CSS}</style><ha-card><div class="xp-scene ${isCharging?'xp-charge':this._tireOpen?'xp-overview xp-tire-mode':'xp-overview'} ${this.xpUiEnabled()?'xp-has-controls':''} ${onHome&&this.xpUiEnabled()?'xp-home-navigation':''} ${chargeLayout?'xp-charge-navigation':''} ${xpIsEnglish(this._hass)?'xp-locale-en':''} ${this.paint()==='black_edition'?'xp-black-edition':''}">
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
