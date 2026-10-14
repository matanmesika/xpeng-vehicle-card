# XPENG G6 — body generation to model-year mapping

The dashboard intentionally presents **four individual model years** but **two distinct vehicle shapes**:

| Selected year | Exterior shape | Artwork folder |
| --- | --- | --- |
| 2023 | Original G6 | `assets/vehicles/g6/2023-2025/` |
| 2024 | Original G6 | `assets/vehicles/g6/2023-2025/` |
| 2025 | Original G6 | `assets/vehicles/g6/2023-2025/` |
| 2026 | Redesigned G6 | `assets/vehicles/g6/2026/` |

Every available paint has three distinct image files (`front.webp`, `charging.webp`, `top.webp`) within its own generation/color folder. **No 2026 image is substituted for 2023–2025, or vice versa.** Year-specific paint choices are filtered by the catalogue. The selection menu keeps each year separately for configuration purposes; sharing a shape does not imply combining year choices.

Artwork remains illustrative where documented; image presence alone does not establish manufacturer geometry accuracy. The automated generation-parity regression is in `tests/vehicle-artwork-mapping.test.cjs`.
