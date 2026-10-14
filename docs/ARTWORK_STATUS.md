# XPENG Vehicle Artwork — Progress

> **Work in progress — not complete.** Counts reflect actual `available` entries in the checked-in artwork map. CI verifies that these entries match real WebP files. This is not a continuously running render process.

**64 / 339 image views · 18.9%**

`████░░░░░░░░░░░░░░░░`

**275 views remaining** across 15 models, 21 generation groups and 113 model/generation/paint combinations. **21 fully populated combinations**, 1 partially populated.

**Master views:** 4/21 generation-specific master trios complete; 50 base camera views still missing.

[Latest changes (PR #29)](https://github.com/matanmesika/xpeng-vehicle-card/pull/29) · [Workflow runs](https://github.com/matanmesika/xpeng-vehicle-card/actions) · [Missing master views](../data/master-view-queue.json) · [Machine-readable status](../data/artwork-status.json)

## Progress by model

| Model | Complete paints | Available views | Coverage | Missing views |
|:--|--:|--:|--:|--:|
| G3 | 0/3 | 0/9 | 0% | 9 |
| G3i | 0/4 | 0/12 | 0% | 12 |
| P5 | 0/3 | 0/9 | 0% | 9 |
| P7 | 0/5 | 0/15 | 0% | 15 |
| P7i | 0/7 | 1/21 | 4.8% | 20 |
| Next P7 | 0/16 | 0/48 | 0% | 48 |
| P7+ | 0/5 | 0/15 | 0% | 15 |
| G6 | 10/11 | 30/33 | 90.9% | 3 |
| G7 | 6/11 | 18/33 | 54.5% | 15 |
| G9 | 5/11 | 15/33 | 45.5% | 18 |
| G9L | 0/4 | 0/12 | 0% | 12 |
| X9 | 0/10 | 0/30 | 0% | 30 |
| MONA M03 | 0/12 | 0/36 | 0% | 36 |
| L03 | 0/6 | 0/18 | 0% | 18 |
| GX | 0/5 | 0/15 | 0% | 15 |

## Progress by generation

| Model | Year group | Master trio | Complete paints | Available views | Missing views |
|:--|:--|--:|--:|--:|--:|
| G3 | 2018-2021 | 0/3 | 0/3 | 0/9 | 9 |
| G3i | 2021-2023 | 0/3 | 0/4 | 0/12 | 12 |
| P5 | 2021-2024 | 0/3 | 0/3 | 0/9 | 9 |
| P7 | 2020-2022 | 0/3 | 0/5 | 0/15 | 15 |
| P7i | 2023-2025 | 1/3 | 0/7 | 1/21 | 20 |
| Next P7 | 2025 | 0/3 | 0/6 | 0/18 | 18 |
| Next P7 | 2026 | 0/3 | 0/10 | 0/30 | 30 |
| P7+ | 2024-2026 | 0/3 | 0/5 | 0/15 | 15 |
| G6 | 2023-2025 | 3/3 | 5/5 | 15/15 | 0 |
| G6 | 2026 | 3/3 | 5/6 | 15/18 | 3 |
| G7 | 2025 | 3/3 | 6/6 | 18/18 | 0 |
| G7 | 2026 | 0/3 | 0/5 | 0/15 | 15 |
| G9 | 2022-2024 | 0/3 | 0/5 | 0/15 | 15 |
| G9 | 2025-2026 | 3/3 | 5/6 | 15/18 | 3 |
| G9L | 2026 | 0/3 | 0/4 | 0/12 | 12 |
| X9 | 2024-2025 | 0/3 | 0/4 | 0/12 | 12 |
| X9 | 2026 | 0/3 | 0/6 | 0/18 | 18 |
| MONA M03 | 2024-2025 | 0/3 | 0/5 | 0/15 | 15 |
| MONA M03 | 2026 | 0/3 | 0/7 | 0/21 | 21 |
| L03 | 2026 | 0/3 | 0/6 | 0/18 | 18 |
| GX | 2026 | 0/3 | 0/5 | 0/15 | 15 |

## Counting rules and caveats

- A completed paint combination requires **three distinct files**: `front.webp`, `charging.webp` (rear three-quarter) and `top.webp` (true overhead). One available view does not count as a complete combination.
- Year-by-year paint availability is defined in `data/year-color-matrix.json`; the artwork asset is selected by model, body-generation group and exterior colour. Trim selection does not change artwork.
- **These renders are not official manufacturer photographs**. Some geometry, colours and wheels remain pending manufacturer-fidelity review. Technical alpha/WebP checks are not visual authenticity checks.
- This report is regenerated from `data/vehicle-catalog.json`, `data/vehicle-art-map.json` and `data/master-view-queue.json` whenever artwork is added by the repository workflow. The displayed counts reflect the **last committed status**, not a real-time background job.
