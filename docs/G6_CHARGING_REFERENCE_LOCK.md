# Charging design decision — user-approved existing interface

Latest owner correction, 2026-10-17: **do not create a new Charging screen**.

- Preserve the vehicle charge-view artwork selected by the existing card model/year/paint mappings, particularly its own `charging.webp`; do not replace it with `front.webp` as the earlier draft attempted.
- Preserve the original lake/mountain background, original charging card geometry and all telemetry placement.
- Add **only** compact shortcuts that access the existing authorized charge-limit control and existing charging schedule start/end readings.
- Charging schedule entities are read-only in the documented Xpengtk integration. No unsupported schedule-writing service must be invented.
- Charging status automatically selects the charging view and returns to the main screen when it stops or a cable disconnect is confirmed. No manual view-state switch.
- Do not add the four home controls on top of the charging hero. Never execute any vehicle action without an explicit user tap.
- The earlier 1536×864 owner reference is a visual reference, but the **latest explicit instruction to retain the current code's Charging screen supersedes the prior front-art requirement**.

All changes remain on draft PR #42 until screenshots and native Home Assistant functions are approved by the owner.
