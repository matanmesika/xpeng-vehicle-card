# XPENG G6 genuine/free vehicle image sourcing — October 12, 2026

The **UI-only HACS v1.0.0-alpha.6** was released with *all original vehicle/background binaries unchanged*. This separate branch researches **real XPENG G6 photos** for a future release. Never silently replace the user's approved dashboard or present AI imagery as a real manufacturer photo.

## Best free leads (actual links)

| Screen | Verified source | What is verified | What is NOT verified |
| --- | --- | --- | --- |
| Vehicle status, white front 3/4 | [XPENG Israel G6 configurator PNG](https://heyxpeng.co.il/wp-content/uploads/2025/11/g6-core-rwd-18-white.png) | Public manufacturer-hosted PNG, filename says **G6 Core RWD, 18-inch wheels, white**, and configurator has real colour options | This is **not the selected highest trim**, PNG alpha data has not been inspected locally, and free download is not a redistribution license |
| Front/rear studio imagery | [Official XPENG G6 media library](https://xpeng-newsroom.pr.co/de-DE/assets/236408/) | Press library indexes **192** G6 images, including titled Exterior Front 3/4, Exterior Rear 3/4 and Front View | These are mostly JPEG photos; official GitHub redistribution permission unconfirmed, and high-trim/color of any individual photo needs review |
| Genuine front/3/4 car photo | [Wikimedia Commons — G6 2025 IAA DSC 2057](https://commons.wikimedia.org/wiki/File:XPeng_G6_(2025)_IAA_2025_DSC_2057.jpg) | Real, large **4999×3341** 2025 facelift photograph by **Alexander-93**, **CC BY-SA 4.0** | A cutout hasn't been prepared; photographed vehicle/paint/trim may differ from requested G6 |
| Genuine rear/3/4 car photo | [Wikimedia Commons — G6 2025 IAA DSC 1802](https://commons.wikimedia.org/wiki/File:XPeng_G6_(2025)_IAA_2025_DSC_1802.jpg) | Real **5128×2969** silver G6 facelift photo by **Alexander-93**, **CC BY-SA 4.0** | Not transparent, not matching a white hero, and exact trim unknown |
| Genuine Performance Black Edition | [Wikimedia Commons — 2025 G6 AWD Performance Black Edition](https://commons.wikimedia.org/wiki/File:2025_Xpeng_G6_AWD_Performance_Black_Edition.jpg) | Real **4608×3456** black car photo by **Chanokchon**, **CC BY-SA 4.0**; trim stated in original file description | Does not provide matching white/silver/purple views or a transparent top view |
| More genuine photos | [Wikimedia G6 facelift 2025 gallery](https://commons.wikimedia.org/wiki/Category:XPeng_G6_(2025)) | Different real front/rear photographs under individual licences | Not a matched transparent three-angle asset set |

## The specific 3-view target

1. **Status:** a foreground-only G6 facelift in front 3/4, proper manufacturer shape and user-selected paint.
2. **Charging:** the **same model+colour** in rear 3/4, on the unchanged approved nighttime background. It should not just mirror the front image.
3. **Tires:** a **genuine, model-accurate top-down/orthographic G6**. Do **not** substitute a convincing-looking but non-authentic AI car or label a generic car illustration as genuine. Until a real top view exists, alpha.6's clearly disclosed illustration remains a temporary placeholder.

Selection remains **model+exterior paint only** (each model always displays its available highest-trim visual across all model years and informational trim choices). Follow the owner's preference to prioritize **G6** before working on other models.

## Licensing / packaging

- **Official manufacturer assets:** hosted on public web does **not** imply a public right to re-distribute them as stand-alone files in a HACS/GitHub repository. Verify with XPENG/media contact or the applicable asset license before inclusion. Remote hotlinking is not a stable solution.
- **Commons genuine photos:** CC BY-SA 4.0 permits copying/adaptation with visible credit to photographer, source URL, license URL, a notice explaining background removal/re-colouring (if performed), and the same or a compatible license for derived artwork. Verify each photo individually.
- High-quality background removal of an authentic photo may be acceptable (preserving real vehicle geometry). Keep transparent output and original source provenance separately. **Do not recolour to an unverified manufacturer shade** if colour fidelity is essential.
- Source photos and preview references are **not** part of the production HACS zip yet. The main dashboard layout, backdrop, network/info, sensor mapping and TPMS logic are already shipping separately.
- Once actual image files are available and reviewed, add the **three angle + colour** assets to the bundled package with tests for alpha, consistent placement and model/year independence. Require owner visual sign-off before publishing.

## Immediate practical gap

The best verified free, redistributable candidates are actual G6 photographs licensed through Wikimedia Commons, but **there is still no verified transparent genuine G6 overhead photograph, and no validated matching white front/rear/highest-trim transparent pack**. Do not merge a claim of photo-completeness until these exist.


## BREAKTHROUGH: direct original official G6 facelift isolated PNGs (2026-10-12)

The [official XPENG G6 product page (Luxembourg)](https://www.xpeng.com/lu/model/g6) links to **six separate real manufacturer-provided PNG cutouts of the updated G6**. Unlike invented generative images, these are **the actual manufacturer's vehicle renders**. They use a consistent **SIDE view**, *not front/rear/top*, across five exterior paints and Black Edition.

| Exterior | Official original PNG URL | View | Licensing |
|---|---|---|---|
| arctic_white | [Original PNG](https://s-cdn.xpeng.com/commoncms/prod/2025-07-10/b3ba3f1c56884076aae0e020be843b0f.png) | Side, isolated render | Manufacturer copyright; redistribution unverified |
| graphite_gray | [Original PNG](https://s-cdn.xpeng.com/commoncms/prod/2025-07-10/127bde799d2e4d338d47d7d28ac1a42a.png) | Side, isolated render | Manufacturer copyright; redistribution unverified |
| midnight_black | [Original PNG](https://s-cdn.xpeng.com/commoncms/prod/2025-07-10/294a086e7a7a494b92aa88745aa55ba5.png) | Side, isolated render | Manufacturer copyright; redistribution unverified |
| silver_frost | [Original PNG](https://s-cdn.xpeng.com/commoncms/prod/2025-07-10/696791d488ce4b25900a04492e02de78.png) | Side, isolated render | Manufacturer copyright; redistribution unverified |
| stellar_purple | [Original PNG](https://s-cdn.xpeng.com/commoncms/prod/2025-07-10/01b64c33a42c4873be425252ac21006b.png) | Side, isolated render | Manufacturer copyright; redistribution unverified |
| black_edition | [Original PNG](https://s-cdn.xpeng.com/commoncms/prod/2025-07-10/37d6e2e9b811457d9a2b299b97afdc86.png) | Side, isolated render | Manufacturer copyright; redistribution unverified |

These links were opened as original PNG images; the image viewer shows the surrounding area black, consistent with alpha transparency, but **pixel alpha bytes were not available to inspect** in the constrained network environment. Before packaging, use Pillow to verify image mode RGBA and whether alpha min/max includes both transparent and opaque pixels.

### More relevant original front-angle G6 PNGs

- **G6 Core Performance AWD — purple front 3/4**: [official isolated PNG](https://heyxpeng.co.il/wp-content/uploads/2025/11/xpeng-g6-specs-core-awd-img.png) from [XPENG Israel G6 overview](https://heyxpeng.co.il/g6/). This is the most promising **high-trim front** source; its shape and wheels match the *Core Performance* preview. Manufacturer copyright — not yet authorized for HACS redistribution.
- **G6 Core RWD — white front 3/4 with 18-inch wheels**: [official isolated PNG](https://heyxpeng.co.il/wp-content/uploads/2025/11/g6-core-rwd-18-white.png) from [Israel configurator](https://heyxpeng.co.il/g6/configurator/). It is **not** a Core Performance/highest-trim image.
- [Official XPENG G6 newsroom](https://xpeng-newsroom.pr.co/de-DE/assets/236408/) has original front/rear photographic assets, usually JPEG with backgrounds. Model/trim/license requires verification.

### Why a perfect free 3-view set is NOT yet found

An [IMAGIN.studio 2026 G6 overhead model render](https://cdn.imagin.studio/getImage?angle=33&billingTag=&bodySize=5&customer=gbxlcr-vehicle-management-ltd&fileType=webp&make=XPENG&modelFamily=G6&modelRange=G6+ESTATE&modelVariant=SUV&modelYear=2026&powerTrain=Electric&trim=Standard+Range&zoomLevel=30) demonstrates that accurate overhead assets can exist. [Angle 33 is orthographic overhead](https://docs.imagin.studio/guides/getting-images/ii.-image-customization-and-styling/selecting-angles). But [IMAGIN.studio explicitly requires a purchased license, and prohibits standalone redistribution/modified image download without permission](https://licensing.imaginstudio.com/), so **it fails the user's no-cost requirement**; do not copy/hotlink using another website's customer key.

The official XPENG cutouts are free to view and may be saved for personal inspection, but free public viewing is **not a license to bundle** their PNG bytes in an open source HACS release. The photo replacement remains separate from released UI alpha.6.

### Status to pursue next

1. Find a genuine manufacturer-supplied **white and other-paint Core Performance front 3/4**, preferably same perspective across all paints.
2. Find a matched manufacturer **rear 3/4** separated image.
3. Find a genuine **directly overhead** version suitable for the four TPMS readings. A true overhead image is a must; don't pretend a side image or AI-made model is original.
4. Secure reproduction and redistribution rights, or find suitably free CC-licensed real photos and professionally remove backgrounds (with author credit and CC BY-SA compliant asset license).
5. Keep approved scene and all UI unchanged.
