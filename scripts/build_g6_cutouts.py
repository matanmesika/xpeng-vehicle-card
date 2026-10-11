"""Prepare transparent G6 studio previews so the backdrop never covers the dashboard scene.

A visual segmentation helper, NOT a model-year/trim verification pipeline.
All output remains marked as 'illustrative' in the Lovelace card.
"""
from pathlib import Path
import shutil
import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "dist" / "assets"
PAINTS = {
    "arctic_white": "arctic_white",
    "jet_black": "midnight_black",
    "silver_frost": "silver_frost",
    "space_grey": "graphite_gray",
    "stellar_purple": "stellar_purple",
}
TRIMS = ["core_rwd", "core_plus_rwd", "core_performance_awd", "unspecified"]
POLYGON = np.array([
    (35, 716), (40, 580), (83, 488), (298, 355), (371, 321),
    (435, 286), (525, 219), (673, 175), (904, 163), (1110, 148),
    (1213, 158), (1358, 231), (1445, 359), (1491, 475), (1494, 700),
    (1472, 768), (1440, 802), (1386, 839), (1321, 797),
    (1229, 766), (1011, 833), (894, 878), (792, 909),
    (722, 918), (643, 871), (565, 833), (343, 837),
    (281, 876), (185, 875), (146, 842), (69, 791),
], dtype=np.float32)


def segment(image_path: Path) -> Image.Image:
    rgb = np.asarray(Image.open(image_path).convert("RGB"))
    height, width = rgb.shape[:2]
    outline = POLYGON.copy()
    outline[:, 0] *= width / 1536
    outline[:, 1] *= height / 1024
    vertices = np.rint(outline).astype(np.int32)
    polygon = np.zeros((height, width), np.uint8)
    cv2.fillPoly(polygon, [vertices], 255)
    mask = np.full((height, width), cv2.GC_BGD, dtype=np.uint8)
    mask[polygon > 0] = cv2.GC_PR_FGD
    sure_foreground = cv2.erode(
        polygon, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (43, 43))
    )
    mask[sure_foreground > 0] = cv2.GC_FGD
    # The initial polygon is a generous model-specific tracing. GrabCut refines
    # roof and wheel edges against the dark studio background.
    background = np.zeros((1, 65), np.float64)
    foreground = np.zeros((1, 65), np.float64)
    cv2.grabCut(rgb[:, :, ::-1].copy(), mask, None, background, foreground, 5, cv2.GC_INIT_WITH_MASK)
    alpha = np.where((mask == cv2.GC_FGD) | (mask == cv2.GC_PR_FGD), 255, 0).astype(np.uint8)
    alpha = cv2.medianBlur(alpha, 5)
    alpha = cv2.GaussianBlur(alpha, (5, 5), 1.0)
    out = Image.fromarray(np.dstack((rgb, alpha)), mode="RGBA")
    return out


def main():
    for original, paint in PAINTS.items():
        path = SOURCE / f"g6-2026-{original}.webp"
        if not path.is_file():
            raise FileNotFoundError(path)
        output = segment(path)
        trims = TRIMS + (["black_edition"] if paint == "midnight_black" else [])
        for base in (ROOT / "assets", ROOT / "dist" / "assets"):
            for trim in trims:
                target = base / "vehicles" / "g6" / "2026" / trim / f"{paint}.webp"
                target.parent.mkdir(parents=True, exist_ok=True)
                output.save(target, format="WEBP", quality=89, method=6)
                if target.stat().st_size < 12000:
                    raise RuntimeError(f"Unexpectedly small cutout: {target}")
        print(f"Processed G6 studio photograph: {paint}")

if __name__ == "__main__":
    main()
