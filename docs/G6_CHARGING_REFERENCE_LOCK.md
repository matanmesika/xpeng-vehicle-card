# Charging design decision — user-approved existing interface

Latest owner correction, 2026-10-17: **do not create a new Charging screen**.

- Keep the original live-metrics card, approved lakeside background and scene geometry. The owner's reference requires a *front-facing* G6, so G6 charging uses its existing model/paint `front.webp` cutout with a decorative glowing charging cable. The previous rear cutout is not suitable as the charging hero.
- Preserve the original lake/mountain background, original charging card geometry and all telemetry placement.
- Add **only** compact shortcuts that access the existing authorized charge-limit control and existing charging schedule start/end readings.
- Charging schedule entities are read-only in the documented Xpengtk integration. No unsupported schedule-writing service must be invented.
- Charging status automatically selects the charging view and returns to the main screen when it stops or a cable disconnect is confirmed. No manual view-state switch.
- Do not add the four home controls on top of the charging hero. Never execute any vehicle action without an explicit user tap.
- The owner-approved 1536×864 reference is a visual target; current rendered cables, car crop and photo atmosphere remain subject to owner approval.  the **latest explicit instruction to retain the current code's Charging screen supersedes the prior front-art requirement**.

All changes remain on draft PR #42 until screenshots and native Home Assistant functions are approved by the owner.
