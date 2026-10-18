# XPENG Vehicle Card — מדריך בעברית

כרטיס Home Assistant מסוג Lovelace, עם תמיכה בעברית ובאנגלית, שמסתגל אוטומטית לרוחב המחשב, האייפון או כרטיס צר ב־Sections. זהו **כרטיס תצוגה ושליטה (Frontend)**, ולא אינטגרציית Xpengtk עצמה.

**סטטוס:** מיפוי ממשק ה־G6, החיישנים ופקודות הרכב הנתמכות **הושלם ברמת הקוד**. גרסת הבטא האחרונה שפורסמה היא [v1.0.4-beta.9](https://github.com/matanmesika/xpeng-vehicle-card/releases/tag/v1.0.4-beta.9); הגרסה היציבה עדיין [v1.0.3](https://github.com/matanmesika/xpeng-vehicle-card/releases/tag/v1.0.3). השינויים בענף ההכנה לשחרור, כולל הסרת הכיתוב מעל צילום הפנים, טרם פורסמו כגרסה מתויגת.

## המסכים הרלוונטיים

| מסך | מחשב | טלפון |
|---|---|---|
| בית — שבע פעולות הרכב | ![בית מחשב](screenshots/home-desktop.png) | ![בית טלפון](screenshots/home-mobile.png) |
| טעינה אוטומטית, כולל תמונה נפרדת וכבל ירוק | ![טעינה מחשב](screenshots/charging-desktop.png) | ![טעינה טלפון](screenshots/charging-mobile.png) |
| מיזוג ומושבים — צילום הפנים ללא כיתוב מעליו | ![מיזוג מחשב](screenshots/climate-desktop.png) | ![מיזוג טלפון](screenshots/climate-mobile.png) |
| תחזוקה ולחץ בצמיגים | ![תחזוקה מחשב](screenshots/maintenance-desktop.png) | ![תחזוקה טלפון](screenshots/maintenance-mobile.png) |
| מיקום הרכב | ![מפה מחשב](screenshots/map-desktop.png) | ![מפה טלפון](screenshots/map-mobile.png) |

[בקרות טעינה](screenshots/charge-controls-mobile.png) · [אבחון חיישנים](screenshots/diagnostics-mobile.png) · [כל 12 צילומי המסכים](screenshots/README.md).

התמונות מצולמות בדפדפן Chromium מתוך הקוד האמיתי של הכרטיס אך עם **חיישנים מדומים**. המפה בתמונות אינה מכילה אריחי מפה חיים; יש לבדוק אותה בתוך Home Assistant אמיתי. פעולות כמו פתיחת חלונות ותא מטען הן לחצני פעולה ולא מסכי ניווט קבועים.

## התקנה

ב־HACS מוסיפים את `https://github.com/matanmesika/xpeng-vehicle-card` בתור **Dashboard**, מתקינים גרסה מתויגת ומרעננים את Home Assistant.

```yaml
type: custom:xpeng-vehicle-card
model: G6
year: "2026"
prefix: my_xpeng # יש להחליף לקידומת ישויות Xpengtk האמיתית
color: graphite_gray
interior: dark_gray
show_controls: true
enable_access_controls: false
grid_options:
  columns: full
  rows: auto
```

הצבע הפנימי ולחץ הצמיגים מוגדרים **רק בעורך הגדרות הכרטיס**. החלפה בין מסך רכב לטעינה אוטומטית נקבעת רק לפי מצב הטעינה האמיתי. שבע פעולות הרכב זהות בשני המצבים. אין כפתור מעבר יזום לטעינה.

## התאמת מסכים ושפה

מסכי המשנה מתאימים עצמם למידות הכרטיס כדי שלא יהיה צורך לגלול את הדשבורד; **רק רשימת החיישנים באבחון גוללת בתוך מסגרת קטנה**, כשהסיכום וההערות נשארים גלויים. ה־Wi-Fi ממורכז בתוך הכפתור, והחץ לחזרה מתאים לכיוון שפת הממשק (עברית RTL, אנגלית LTR). לא צריך דשבורד טלפון נפרד.

## השלמת G6 והשלב הבא

מיפוי **התפקוד והמסכים ל־G6 הושלם ברמת הקוד**, בכפוף לאישור בדיקה חיה. **עבודה על תמונות שאר הרכבים פתוחה**: יש לאפיין לכל משפחת דגמים את הדורות, הצבעים ומבטים קדמי / טעינה / על. נתוני הנכסים הנוכחיים מצביעים על **30 מתוך 33 מבטי G6**, כלומר חסרה עדיין שלישיית תמונות לשילוב צבע אחד משנת 2026; אסור להציג את כיסוי התמונות כאילו הושלם ב־100%.

[מצב כלל הדגמים](ARTWORK_STATUS.md) · [מיפוי צבעים ותמונות](ARTWORK_MAPPING.md) · [בדיקות לפני שחרור](G6_RELEASE_READINESS_HE.md) · [README המלא באנגלית](../README.md).

**עד השחרור המלא יש לבדוק** באייפון פיזי, ב־Home Assistant ובהרשאות Xpengtk אמיתיות: מפה, חיישנים, מעבר לטעינה, כפתורי רכב, מושבים והתאמת הצילומים. אין לבצע מיזוג ל־main או פרסום יציב ללא אישור מפורש.
