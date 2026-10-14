# XPENG G6 — generation and facelift mapping

The configuration editor groups model years that share the same exterior. **The selected
group determines all vehicle images**, while trims remain display-only.

| Editor selection | Body design | Artwork directory |
| --- | --- | --- |
| 2023–2025 · Original G6 | Original shape (three model years) | `assets/vehicles/g6/2023-2025/` |
| 2026 · Facelift | Redesigned G6 | `assets/vehicles/g6/2026/` |

The persisted `year` setting accepts existing legacy numeric years (2023, 2024, 2025,
2026) as well as generation IDs (`2023-2025`, `2026`) for backwards compatibility.
**No original-body artwork can substitute for facelift artwork or vice versa.**

Only where paint choices actually vary *within* a shared body group does the editor
also show an exact year selector. Currently P7i has an additional 2024-only paint
selection; its 2023–2025 generation remains grouped, with the exact-year selector
retained for paint accuracy.

## G6 2026 / Israel
The displayed trims reflect [XPENG Israel's configurator](https://heyxpeng.co.il/g6/configurator/):
Core RWD, Core+ RWD, Core Performance AWD; the Black Edition variant is additionally
listed in [the Israeli market comparison](https://www.carzone.co.il/XPENG/G6/compare).
Trim names are not combined with earlier generation's RWD/AWD nomenclature.
Variant availability can differ outside Israel.

Three individual image views `front.webp`, `charging.webp`, and `top.webp`
remain required per model, group and paint; absent artwork is never silently borrowed.
Actual dashboard screenshots from a mock Home Assistant state are described in
`docs/screenshots/README.md`, separate from independent vehicle layers.
