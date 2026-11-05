#!/usr/bin/env python3
"""
Builds the Warded Atlas pack (the map pieces that come with the app) from a pack with an index.

    python3 scripts/build-pack.py OUT_DIR SOURCE [SOURCE ...]

SOURCE is a folder or ZIP holding Asset_Index.csv and the pictures it names (a pack split over two
ZIPs: pass both). OUT_DIR gets manifest.json, the list of pieces the app reads, and the pictures
as <piece id>/<rev>-<picture>-<full|thumb>.webp, ready for scripts/upload-pack.py to put on
Cloudflare R2 (src/packs/builtin.ts reads them from there).

It turns the index into pieces just as the app's own importer does (src/packs/parse.ts,
draftFromIndex): one piece per id, its pictures tagged with design, look, climate and condition.
Wall and fence tiles become one set each (wall-brick: its straight, corner, tee, cross, end, post,
doorway and broken tiles, each picture tagged with its part) and floor textures one piece each;
both go in the manifest's "extra" list, which app versions from before walls and textures don't
read (they'd offer them as ordinary pieces). Pictures are kept at most 1024 px across (WebP), with
128 px previews. Needs Pillow (pip install pillow).

To change the pack later: build again into a fresh OUT_DIR with REV raised (--rev 2) for pieces
whose pictures changed, so maps drawn with the old ones keep them until the GM swaps.
"""
import argparse
import csv
import io
import json
import os
import re
import sys
import zipfile
from concurrent.futures import ProcessPoolExecutor

from PIL import Image

FULL_PX = 1024
THUMB_PX = 128
LIGHT = re.compile(r"torch|brazier|fire|candle|lantern|lamp|campfire|bonfire|sconce|hearth|forge|glow", re.I)
TILES = "modular"
GROUND = "texture"


class Source:
    """The files in the folders and ZIPs given, by their path inside the pack's folder."""

    def __init__(self, paths):
        self.zips = []
        self.dirs = []
        self.index = None
        for p in paths:
            if p.lower().endswith(".zip"):
                z = zipfile.ZipFile(p)
                self.zips.append(z)
                for n in z.namelist():
                    if n.endswith("Asset_Index.csv"):
                        self.index = (z.read(n).decode("utf-8-sig"), n[: -len("Asset_Index.csv")])
            else:
                for root, _, files in os.walk(p):
                    if "Asset_Index.csv" in files:
                        with open(os.path.join(root, "Asset_Index.csv"), encoding="utf-8-sig") as f:
                            self.index = (f.read(), "")
                        self.dirs.append(root)
        if not self.index:
            sys.exit("No Asset_Index.csv in what was given.")
        self.root = self.index[1]
        self.names = {}
        for z in self.zips:
            for n in z.namelist():
                rel = n[len(self.root):] if n.startswith(self.root) else n
                self.names[rel] = (z.filename, n)

    def read(self, rel):
        if rel in self.names:
            zname, n = self.names[rel]
            return next(z for z in self.zips if z.filename == zname).read(n)
        for d in self.dirs:
            p = os.path.join(d, rel)
            if os.path.exists(p):
                with open(p, "rb") as f:
                    return f.read()
        return None

    def has(self, rel):
        return rel in self.names or any(os.path.exists(os.path.join(d, rel)) for d in self.dirs)


def human(x):
    t = re.sub(r"[_-]+", " ", re.sub(r"^(ct|wa)-", "", x)).strip()
    return t[0].upper() + t[1:] if t else "Pieces"


def group_name(path):
    parts = [p for p in path.split("/") if p]
    if not parts:
        return "Pieces"
    if len(parts) == 1:
        return human(parts[0])
    if re.match(r"^(battlemap|world|town|dungeon|birds_eye)$", parts[0], re.I):
        return human(parts[-1])
    return f"{human(parts[0])} · {human(parts[-1])}"


def scene_of(view, group):
    top = group.split("/")[0].lower()
    if view == "side" or top == "world":
        return "world"
    if view == "bird" or top in ("town", "birds_eye", "settlement"):
        return "city"
    return "battle"


def quarter(px, grid):
    return min(40, max(0.25, round(px / grid * 4) / 4))


def tidy(raw):
    s = re.sub(r"\s+", " ", re.sub(r"[_\-.]+", " ", raw)).strip()
    return s[0].upper() + s[1:].lower() if s else "Piece"


def encode(img, px, quality):
    k = min(1, px / max(img.size))
    if k < 1:
        img = img.resize((max(1, round(img.width * k)), max(1, round(img.height * k))), Image.LANCZOS)
    b = io.BytesIO()
    img.save(b, "WEBP", quality=quality, method=5)
    return b.getvalue(), img.size


def make(job):
    """One picture: its stored copy and preview, written to OUT_DIR."""
    src_paths, rel, out, piece_id, rev, i = job
    src = make.source if hasattr(make, "source") and make.source_paths == src_paths else None
    if src is None:
        make.source = src = Source(src_paths)
        make.source_paths = src_paths
    data = src.read(rel)
    img = Image.open(io.BytesIO(data)).convert("RGBA")
    full, (w, h) = encode(img, FULL_PX, 90)
    thumb, _ = encode(img, THUMB_PX, 85)
    d = os.path.join(out, piece_id)
    os.makedirs(d, exist_ok=True)
    with open(os.path.join(d, f"{rev}-{i}-full.webp"), "wb") as f:
        f.write(full)
    with open(os.path.join(d, f"{rev}-{i}-thumb.webp"), "wb") as f:
        f.write(thumb)
    return piece_id, i, w, h, len(full) + len(thumb)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("out")
    ap.add_argument("sources", nargs="+")
    ap.add_argument("--rev", type=int, default=1)
    ap.add_argument("--name", default="Warded Atlas pack")
    ap.add_argument("--version", type=int, default=2)
    args = ap.parse_args()
    src = Source(args.sources)
    rows = list(csv.DictReader(io.StringIO(src.index[0])))
    families = {}
    sets = {}
    grounds = {}
    for r in rows:
        view = r.get("view", "")
        if not r.get("id"):
            continue
        if view == TILES:
            # wall-brick-straight: the set wall-brick, its straight tile
            sets.setdefault(r["id"].rsplit("-", 1)[0], []).append(r)
        elif view == GROUND:
            grounds.setdefault(r["id"], []).append(r)
        else:
            families.setdefault(r["id"], []).append(r)
    pieces = []
    jobs = []
    missing = 0
    for fid, rs in families.items():
        variants = sorted({int(r.get("variant") or 1) for r in rs})[:8]
        kept = []
        for r in rs:
            v = int(r.get("variant") or 1)
            if v not in variants:
                continue
            if not src.has(r["file"]):
                missing += 1
                continue
            kept.append(r)
        if not kept:
            continue
        r0 = rs[0]
        view = r0.get("view", "")
        grid = int(r0.get("grid_px") or 256)
        plain = next((r for r in rs if r.get("state") == "intact" and r.get("mode") == "colour"), r0)
        label = r0.get("label") or tidy(fid)
        group = r0.get("group", "")
        states = list(dict.fromkeys((r.get("state") or "intact") for r in kept))
        versions = []
        for i, r in enumerate(kept):
            mode = r.get("mode")
            versions.append(
                {
                    "w": 0,
                    "h": 0,
                    "ext": "webp",
                    "bytes": 0,
                    "d": variants.index(int(r.get("variant") or 1)),
                    **({"mode": mode} if mode in ("colour", "ink") else {}),
                    **({"biome": r["biome"]} if r.get("biome") else {}),
                    "state": r.get("state") or "intact",
                }
            )
            jobs.append((tuple(args.sources), r["file"], args.out, fid, args.rev, i))
        piece = {
            "id": fid,
            "label": label,
            "group": group_name(group),
            "scene": scene_of(view, group),
            "view": "side" if view == "side" else "top",
            "cols": quarter(int(plain.get("width") or grid), grid),
            "rows": quarter(int(plain.get("height") or grid), grid),
            "versions": versions,
            "rev": args.rev,
        }
        if LIGHT.search(label) or LIGHT.search(group):
            piece["light"] = True
        if len(states) > 1:
            piece["states"] = states
        pieces.append(piece)
    pieces.sort(key=lambda p: (p["group"], p["label"]))

    # walls, fences and floor textures
    extra = []
    for sid, rs in list(sets.items()) + list(grounds.items()):
        tiles = sid in sets
        r0 = rs[0]
        kept = [r for r in rs if src.has(r["file"])]
        missing += len(rs) - len(kept)
        if not kept:
            continue
        # designs are counted for each part on its own (a set may have four broken tiles and one straight)
        part_of = lambda r: r["id"].rsplit("-", 1)[1] if tiles else ""
        designs = {}
        for r in kept:
            designs.setdefault(part_of(r), set()).add(int(r.get("variant") or 1))
        designs = {k: sorted(v)[:8] for k, v in designs.items()}
        versions = []
        for r in kept:
            v = int(r.get("variant") or 1)
            if v not in designs[part_of(r)]:
                continue
            mode = r.get("mode")
            i = len(versions)
            versions.append(
                {
                    "w": 0,
                    "h": 0,
                    "ext": "webp",
                    "bytes": 0,
                    "d": designs[part_of(r)].index(v),
                    **({"mode": mode} if mode in ("colour", "ink") else {}),
                    **({"biome": r["biome"]} if r.get("biome") else {}),
                    "state": r.get("state") or "intact",
                    **({"part": part_of(r)} if tiles else {}),
                }
            )
            jobs.append((tuple(args.sources), r["file"], args.out, sid, args.rev, i))
        grid = int(r0.get("grid_px") or 256)
        label = re.sub(r"\s+(straight|corner|tee|cross|end|post|doorway|broken)$", "", r0.get("label") or tidy(sid))
        use = GROUND if not tiles else ("fence" if "fence" in (r0.get("group") or "").lower() or sid.startswith("fence") else "wall")
        extra.append(
            {
                "id": sid,
                "label": label[0].upper() + label[1:],
                "group": {"wall": "Walls", "fence": "Fences"}.get(use, "Floors & ground"),
                "scene": "battle",
                "view": "top",
                "use": "ground" if use == GROUND else use,
                "cols": 1 if tiles else quarter(int(r0.get("width") or grid), grid),
                "rows": 1 if tiles else quarter(int(r0.get("height") or grid), grid),
                "versions": versions,
                "rev": args.rev,
            }
        )
    extra.sort(key=lambda p: (p["group"], p["label"]))
    by_id = {p["id"]: p for p in pieces + extra}
    os.makedirs(args.out, exist_ok=True)
    total = len(jobs)
    print(f"{len(pieces)} pieces, {len(extra)} wall, fence and floor sets, {total} pictures; missing files: {missing}", flush=True)
    done = 0
    size = 0
    with ProcessPoolExecutor() as pool:
        for piece_id, i, w, h, b in pool.map(make, jobs, chunksize=16):
            v = by_id[piece_id]["versions"][i]
            v["w"], v["h"], v["bytes"] = w, h, b
            size += b
            done += 1
            if done % 250 == 0 or done == total:
                print(f"  {done} of {total} pictures, {size / 1e6:.1f} MB", flush=True)
    manifest = {"format": "warded-atlas-pack", "id": "warded-atlas", "name": args.name, "version": args.version, "pieces": pieces, "extra": extra}
    with open(os.path.join(args.out, "manifest.json"), "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, separators=(",", ":"))
    print(f"Done: {args.out} ({size / 1e6:.1f} MB of pictures)")


if __name__ == "__main__":
    main()
