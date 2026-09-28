"""Cut Iris's animation frames out of the reference sheets into src/assets/iris/.

    python scripts/build-sprites.py

Sheet 1 already has an alpha channel. Sheet 2 is on a grey gradient and is matted here.
For each frame: remove the drawn pill (cool-tinted, flood-filled from its own pixels so warm fur
stops it), drop detached marks (hearts, motion lines, labels), normalise scale using the pill
width, and record where the pill-top baseline sits so every frame lines up on the real pill.

Clean per-pose transparent PNGs can replace the sheets later: add entries with "file" instead
of "sheet"/"box" and rerun; the extension reads the output images and src/core/iris-frames.js.
"""
import json
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "art" / "source"
OUT = ROOT / "src" / "assets" / "iris"
SHEETS = {1: SRC / "iris-sheet-1.webp", 2: SRC / "iris-sheet-2.webp"}

# name, sheet, crop box, grounded (feet on the pill) — boxes are in sheet pixels.
FRAMES = [
    ("sit", 1, (15, 60, 250, 420), True),
    ("sit-blink", 1, (250, 60, 485, 420), True),
    ("walk-1", 1, (480, 90, 760, 420), True),
    ("walk-2", 1, (765, 90, 1020, 420), True),
    ("walk-3", 1, (1025, 90, 1275, 420), True),
    ("walk-4", 1, (1280, 90, 1530, 420), True),
    ("teeter", 1, (10, 510, 340, 890), False),
    ("fall", 1, (360, 520, 670, 870), False),
    ("jump", 1, (690, 540, 1100, 890), False),
    ("sleep", 1, (1150, 600, 1510, 880), True),
    ("sit-happy", 2, (30, 30, 300, 400), True),
    ("sit-worried", 2, (320, 40, 580, 400), True),
    ("sit-stressed", 2, (600, 40, 870, 400), True),
    ("dazed", 2, (880, 40, 1170, 400), False),
    ("crouch", 2, (1190, 30, 1520, 400), True),
    ("groom", 2, (30, 510, 300, 880), True),
    ("mew", 2, (320, 510, 580, 880), True),
    ("purr", 2, (600, 510, 870, 880), True),
    ("stretch", 2, (870, 500, 1170, 880), True),
    ("sleep-2", 2, (1180, 540, 1520, 880), True),
]

# Frames drawn without a pill under them; separate pills (walk, jump) are dropped as detached shapes.
NO_PILL = {"fall", "dazed"}

SIT_DISPLAY_H = 66   # on-screen height of the sitting pose, CSS px
STORE_X = 2          # stored at 2x for sharp rendering on high-DPI screens


def flood(mask, seeds):
    """Pixels of `mask` 4-connected to any seed."""
    h, w = mask.shape
    out = np.zeros_like(mask)
    q = deque()
    for y, x in seeds:
        if mask[y, x] and not out[y, x]:
            out[y, x] = True
            q.append((y, x))
    while q:
        y, x = q.popleft()
        for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
            if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not out[ny, nx]:
                out[ny, nx] = True
                q.append((ny, nx))
    return out


def main_components(mask, keep_ratio=0.08):
    """The largest component plus any others at least `keep_ratio` of its size (drops hearts, lines, labels)."""
    h, w = mask.shape
    seen = np.zeros_like(mask)
    comps = []
    for y in range(0, h, 2):
        for x in range(0, w, 2):
            if mask[y, x] and not seen[y, x]:
                comp = flood(mask & ~seen, [(y, x)])
                seen |= comp
                comps.append((int(comp.sum()), comp))
    if not comps:
        return mask
    biggest = max(n for n, _ in comps)
    out = np.zeros_like(mask)
    for n, comp in comps:
        if n >= keep_ratio * biggest:
            out |= comp
    return out


def dilate(mask, r):
    img = Image.fromarray((mask * 255).astype(np.uint8))
    return np.array(img.filter(ImageFilter.MaxFilter(2 * r + 1))) > 127


def erode(mask, r):
    img = Image.fromarray((mask * 255).astype(np.uint8))
    return np.array(img.filter(ImageFilter.MinFilter(2 * r + 1))) > 127


def fill_holes(mask):
    h, w = mask.shape
    border = [(y, x) for y in (0, h - 1) for x in range(w)] + [(y, x) for x in (0, w - 1) for y in range(h)]
    outside = flood(~mask, border)
    return mask | ~outside


def matte_grey(rgb):
    """Alpha for a white cat on a smooth grey gradient: fit the background, then unmix."""
    f = rgb.astype(np.float32)
    lum = f @ np.array([0.299, 0.587, 0.114], np.float32)
    h, w = lum.shape
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    xn, yn = xx / w, yy / h
    basis = np.stack([np.ones_like(xn), xn, yn, xn * xn, xn * yn, yn * yn], -1).reshape(-1, 6)
    bgmask = (lum < 190).reshape(-1)
    bg = np.zeros_like(f)
    for c in range(3):
        coef, *_ = np.linalg.lstsq(basis[bgmask], f.reshape(-1, 3)[bgmask, c], rcond=None)
        bg[..., c] = (basis @ coef).reshape(h, w)
    bg_lum = bg @ np.array([0.299, 0.587, 0.114], np.float32)
    fg_lum = 224.0
    raw = np.clip((lum - bg_lum) / np.maximum(fg_lum - bg_lum, 1), 0, 1)
    solid = fill_holes(main_components(raw > 0.45))
    interior = erode(solid, 2)
    alpha = np.where(interior, 1.0, np.clip((raw - 0.15) / 0.85, 0, 1))
    alpha[~dilate(solid, 3)] = 0
    a = np.maximum(alpha, 1e-3)[..., None]
    fg = np.clip((f - (1 - a) * bg) / a, 0, 255)
    fg = np.where(alpha[..., None] > 0.02, fg, f)
    return fg.astype(np.uint8), alpha


def cut(name, sheet_img, box, sheet_no, has_pill):
    crop = sheet_img.crop(box)
    if sheet_no == 1:
        arr = np.array(crop.convert("RGBA"))
        rgb, alpha = arr[..., :3], arr[..., 3].astype(np.float32) / 255
    else:
        rgb, alpha = matte_grey(np.array(crop.convert("RGB")))

    r, g, b = (rgb[..., i].astype(np.int16) for i in range(3))
    opaque = alpha > 0.35
    h, w = alpha.shape
    # The pill is cool-tinted (blue >= red); fur is warm. Its top is the first lower row that is mostly
    # cool pixels. Below that row, grow the pill from clearly-cool pixels through anything not warm, so
    # fur and the gold tag stop it — and nothing above it (like a blue eye) can be touched.
    pill = np.zeros_like(opaque)
    if has_pill:
        cool = opaque & ((b - r) >= 1)
        counts = cool.sum(1)
        top = next((y for y in range(int(h * 0.45), h) if counts[y] >= 0.1 * w), None)
        if top is not None:
            band = np.zeros_like(opaque)
            band[max(0, top - 2):] = True
            not_warm = opaque & ((r - b) < 6) & band
            seeds = list(zip(*np.nonzero(cool & band & ((b - r) >= 3))))
            pill = flood(not_warm, seeds) if seeds else pill
            pill = pill if pill.sum() > 400 else np.zeros_like(opaque)

    cat_mask = opaque & ~pill
    cat_core = main_components(erode(cat_mask, 1))
    keep = dilate(cat_core, 5) & ~dilate(pill, 1)
    alpha = np.where(keep, alpha, 0)

    ys, xs = np.nonzero(alpha > 0.03)
    cx0, cx1, cy0, cy1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    info = {"cat": (int(cx0), int(cy0), int(cx1), int(cy1))}
    if pill.any():
        py, px = np.nonzero(pill)
        info["pill"] = (int(px.min()), int(py.min()), int(px.max()) + 1, int(py.max()) + 1)
    rgba = np.dstack([rgb, (alpha * 255).astype(np.uint8)])
    return Image.fromarray(rgba, "RGBA"), info


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    sheets = {k: Image.open(v) for k, v in SHEETS.items()}
    cuts = {}
    for name, sheet_no, box, grounded in FRAMES:
        img, info = cut(name, sheets[sheet_no], box, sheet_no, name not in NO_PILL)
        cuts[name] = (img, info, sheet_no, grounded)
        print(f"{name:13s} cat={info['cat']} pill={info.get('pill')}")

    # Same prop, same size in every frame: use pill width to put both sheets on one scale.
    pill_w = {}
    for name, (img, info, sheet_no, grounded) in cuts.items():
        if "pill" in info and grounded:
            p = info["pill"]
            pill_w.setdefault(sheet_no, []).append(p[2] - p[0])
    ref = float(np.median(pill_w[1]))
    rel = {s: ref / float(np.median(v)) for s, v in pill_w.items()}
    sit = cuts["sit"][1]["cat"]
    k = (SIT_DISPLAY_H * STORE_X) / (sit[3] - sit[1])

    manifest = {"scale": STORE_X, "frames": {}}
    for name, (img, info, sheet_no, grounded) in cuts.items():
        s = k * rel.get(sheet_no, 1.0)
        x0, y0, x1, y1 = info["cat"]
        if grounded and "pill" in info:
            p = info["pill"]
            anchor_x, baseline = (p[0] + p[2]) / 2, p[1]
        else:
            anchor_x, baseline = (x0 + x1) / 2, y1
        frame = img.crop((x0, y0, x1, y1))
        W, H = max(1, round((x1 - x0) * s)), max(1, round((y1 - y0) * s))
        frame = frame.resize((W, H), Image.LANCZOS)
        frame.save(OUT / f"{name}.webp", "WEBP", quality=92, method=6)
        manifest["frames"][name] = {
            "w": round(W / STORE_X, 1),
            "h": round(H / STORE_X, 1),
            # anchor: where the pill-top centre sits, measured from the image's left / bottom edge
            "ax": round((anchor_x - x0) * s / STORE_X, 1),
            "ay": round((y1 - baseline) * s / STORE_X, 1),
        }
    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    # Same data as a content-script module, so the extension needn't fetch the JSON at runtime.
    js = ROOT / "src" / "core" / "iris-frames.js"
    js.write_text(
        "// Generated by scripts/build-sprites.py - do not edit by hand.\n"
        "(() => {\n  const AM = globalThis.AIMeter;\n"
        f"  AM.IRIS_FRAMES = {json.dumps(manifest['frames'])};\n"
        "})();\n", encoding="utf-8")
    print("wrote", len(manifest["frames"]), "frames to", OUT)


if __name__ == "__main__":
    main()
