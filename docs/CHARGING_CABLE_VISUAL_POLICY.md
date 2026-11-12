# XPENG charging cable visual policy (updated 2026-11-11)

Owner decision (2026-11-11) replaces the 2026-10-13 policy.

## G6 2026 (graphite charging artwork)

- The scene shows **one continuous cable**. It runs from the station holster handle, down to the station foot, along the floor, and up into the plug's rubber boot.
- The drawn cable exactly covers the cable pictured in `g6/2026/graphite_gray/charging.webp`. The traced centre-line is `XP_G6_PHOTO_CABLE`. The photo cable and the drawn cable are never doubled.
- Geometry is computed at runtime from the real on-screen boxes of the car artwork and the station photo. It stays attached at every card width (phone and desktop) and never uses fixed-viewBox coordinates.
- The cable starts flush with the plug boot. A mask guarantees that no cap, highlight or glow is drawn over the plug.
- **While actually charging**, the whole cable is coloured end to end, with energy pulses travelling **station → car**. Charging means the charging entity reports charging **and** the reported power is not 0 kW.
- When the car is plugged in but not charging (idle, complete, scheduled, or 0 kW), the charging scene is not shown. If the cable is ever drawn in that state, it is plain black with no flow.
- `prefers-reduced-motion` stops the pulses.

## Other models and artwork

Other models and artwork keep their existing overlays until they get a traced cable centre-line.
