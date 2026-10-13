# XPENG full artwork coverage — 2026-10-13

This is a truthful **catalogue and image-slot matrix**, not a claim that all 339 pictures exist.

The model catalogue contains **15 models**, **21 model-year groups**, and **113 exterior paint combinations**. Each combination has exactly three distinct **slot names**: `front.webp`, `charging.webp`, and `top.webp`. Currently **43 actual WebP images** are present (**14 fully occupied combinations**); **296 individual image views** are pending. AI renders are not official manufacturer photography.

| Model | Year groups | Paint combinations | Existing WebP | Missing WebP |
|---|---|---:|---:|---:|
| G3 | 2018-2021 | 3 | 0 | 9 |
| G3i | 2021-2023 | 4 | 0 | 12 |
| P5 | 2021-2024 | 3 | 0 | 9 |
| P7 | 2020-2022 | 5 | 0 | 15 |
| P7i | 2023-2025 | 5 | 0 | 15 |
| Next P7 | 2025, 2026 | 16 | 0 | 48 |
| P7+ | 2024-2026 | 5 | 0 | 15 |
| G6 | 2023-2025, 2026 | 11 | 30 | 3 |
| G7 | 2025, 2026 | 11 | 3 | 30 |
| G9 | 2022-2024, 2025-2026 | 11 | 9 | 24 |
| G9L | 2026 | 4 | 0 | 12 |
| X9 | 2024-2025, 2026 | 10 | 0 | 30 |
| MONA M03 | 2024-2025, 2026 | 12 | 0 | 36 |
| L03 | 2026 | 6 | 0 | 18 |
| GX | 2026 | 5 | 0 | 15 |

## Exact selection rule

`model -> year group -> exterior colour -> {front, charging, top}`. A trim is informational and only its **offered labels** are limited by year; its selected value cannot affect photos, exterior or interior colours, or sensor data. A manual image override belongs only to the configured generation and should be cleared when model, year or paint changes.

**No borrowing** between year groups, models or colours. No silently relabelled front-view as charging/top. Missing slot => clearly labelled illustrative fallback. Verified presence on disk != verified authenticity.

## Market and verification caveats

- `G7`: 2025 and 2026 Chinese-market palettes are separated (see `docs/ARTWORK_MAPPING.md`).
- `Next P7`: 2025 six-colour Chinese launch palette; 2026 Chinese online-configurator additional special/edition colours are listed by the **exterior paint key only**, not by trim selection. Source: https://www.xiaopeng.com/news/company_news/5489.html and https://www.xiaopeng.com/p7n/configuration.html .
- `MONA M03`: original Chinese five-colour launch palette applies as baseline for 2024–2025, subject to historical year-specific market verification. 2026 catalogue includes seven exterior colours, including Roland Purple and Avocado Green. Sources: https://bbs.xiaopeng.com/article/2764153 and https://www.xiaopeng.com/m03_2026.html .
- `G9`: currently selected international-market colours align to XPENG's global catalogue: https://www.xpeng.com/model/g9 . China's 2026 palette differs and must not be silently mixed into global listings: https://www.xiaopeng.com/g9_2026.html .
- Other groups marked `catalog_pending` or `historic_market_dependent` are **provisional**. An available colour in one country cannot be asserted globally.
- HEX swatches are design approximations, not manufacturer-certified paint codes.

## Adding assets

Put an approved transparent WebP in `assets/vehicles/<slug>/<year-group>/<paint>/{front,charging,top}.webp`. Run `python tools/sync_vehicle_artwork.py`; validate `python tools/sync_vehicle_artwork.py --check` plus `node --test tests/vehicle-artwork-mapping.test.cjs`. The actual `assets/` files must be present for the mapped entry to become `available`. Code under `src/` and `dist/` must stay identical. The approved background is never changed.

Use `artwork-backlog.csv` as a sortable build queue and `tools/export_vehicle_artwork_backlog.py` to rebuild it.

## G9 image batch 1

For the G9 2025–2026 year-group, Arctic White, Graphite Gray and Midnight Black each have separate `front.webp`, `charging.webp` (rear three-quarter) and `top.webp` (overhead) AI-generated transparent WebP files. Manufacturer accuracy still requires visual review. Remaining G9 colours and the earlier generation remain pending.

## Year-specific colours
All 42 individual model years have explicit paint lists and source confidence in [year-color-matrix.json](../year-color-matrix.json). P7i 2024 adds Starry Dusk Purple and Star Blue, without implying they were available in 2023 or 2025. Model/year/paint select the artwork; selected trim remains text only. Paint lists inherited from grouped market catalogues require additional historical or regional verification.


### P7i Arctic White front preview

The `front.webp` WebP for P7i 2023–2025 Arctic White is now uploaded as a clearly labelled AI **illustrative preview**. It has verified transparency. `charging.webp` and `top.webp` are still missing and must not be inferred from front.
