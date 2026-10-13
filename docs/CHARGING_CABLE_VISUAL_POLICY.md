# XPENG charging cable visual policy (2026-10-13)

The real vehicle artwork's cable connector and cable silhouette are **always black**; they must not be replaced with a bright green cable path. Removed the historic neon teal SVG cable drawing from frontend src/dist so it cannot conflict with the separate `charging.webp` vehicle overlay.

Charging status and battery metrics may use colored indicators. Animated energy flow, if subsequently designed, should be a distinct optional UI effect and never a recoloring of the car's raster cable or a false sensor state.

**Important:** This commit updates display behavior and tests only. The user-reviewed 16 regenerated charging WebP files are NOT part of this commit yet, and must be transferred and human-reviewed separately before any production merge. The G6 2026 artwork, approved scenic background and vehicle backend are untouched.
