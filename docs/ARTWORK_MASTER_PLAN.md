# XPENG visual asset master-view build plan

The project covers **15 models and 21 distinct model/shape-generation groups**. Before creating every factory exterior colour, each shape needs a correct model-specific **three independent transparent views**: front, rear/charging, true top-down. Trim remains display-only; individual model-year controls color availability; generations with identical geometry can share these view masters.

- Complete neutral master sets currently present: **4**.
- Generation master sets still incomplete: **17**.
- Required missing base image views: **50**.
- Once a base 3-view master exists, `.github/workflows/generate-paint-previews.yml` produces additional **ordinary** paints within the same model/year group and adds AI provenance. Black Edition, matte/special, and two-tone finishes require manual art/design review.
- **This list is an image creation worklist, not finished images.** A visible photo's presence alone cannot establish official design fidelity. Never use infographic collages for front/rear/top slots.

## Recommended master generation order

- G3 / 2018-2021 / arctic_white: front, charging, top (needs whole master trio)
- G3i / 2021-2023 / arctic_white: front, charging, top (needs whole master trio)
- P5 / 2021-2024 / arctic_white: front, charging, top (needs whole master trio)
- P7 / 2020-2022 / arctic_white: front, charging, top (needs whole master trio)
- P7i / 2023-2025 / arctic_white: charging, top
- Next P7 / 2025 / new_moon_silver: front, charging, top (needs whole master trio)
- Next P7 / 2026 / nebula_white: front, charging, top (needs whole master trio)
- P7+ / 2024-2026 / arctic_white: front, charging, top (needs whole master trio)
- G6 / 2023-2025 / arctic_white: all three files present
- G6 / 2026 / arctic_white: all three files present
- G7 / 2025 / nebula_white: all three files present
- G7 / 2026 / nebula_white: front, charging, top (needs whole master trio)
- G9 / 2022-2024 / arctic_white: front, charging, top (needs whole master trio)
- G9 / 2025-2026 / arctic_white: all three files present
- G9L / 2026 / arctic_white: front, charging, top (needs whole master trio)
- X9 / 2024-2025 / arctic_white: front, charging, top (needs whole master trio)
- X9 / 2026 / arctic_white: front, charging, top (needs whole master trio)
- MONA M03 / 2024-2025 / nebula_white: front, charging, top (needs whole master trio)
- MONA M03 / 2026 / nebula_white: front, charging, top (needs whole master trio)
- L03 / 2026 / arctic_white: front, charging, top (needs whole master trio)
- GX / 2026 / everest_white: front, charging, top (needs whole master trio)

## Updating

Run `python tools/sync_master_view_queue.py` after adding photos and `python tools/sync_master_view_queue.py --check` in CI. Machine-readable file: `master-view-queue.json`. Project source and backdrop remain untouched.
