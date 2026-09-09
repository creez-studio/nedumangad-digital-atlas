#!/usr/bin/env python3
"""Turn the raw Google Open Buildings export into a web-ready extrusion layer.

Adds two derived properties the atlas needs:
  h   - height in metres, inferred from footprint area (the source has none)
  era - growth epoch 0..4, so the history scenes can grow the town outward
        from the Koyikkal Palace / chantha nucleus.
"""
import json, math, hashlib, sys, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# Raw Google Open Buildings export; override with argv[1].
SRC = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "uploads", "Builindings.geojson")
DST = os.path.join(ROOT, "data", "buildings.geojson")

PALACE = (77.002896, 8.609251)   # Koyikkal Palace - the first nucleus
MARKET = (77.0028,   8.6033)     # Nedumangad chantha - the second nucleus
BUSSTAND = (77.00231, 8.60230)

def km(a, b):
    """Rough planar distance in km at this latitude."""
    dx = (a[0] - b[0]) * 110.32 * math.cos(math.radians(8.61))
    dy = (a[1] - b[1]) * 110.57
    return math.hypot(dx, dy)

def jitter(seed, lo, hi):
    """Deterministic pseudo-random in [lo,hi] so reloads look identical."""
    v = int(hashlib.md5(seed.encode()).hexdigest()[:8], 16) / 0xFFFFFFFF
    return lo + v * (hi - lo)

def storeys(area, core, seed):
    """Infer storey count. Kerala small-town: mostly 1-2, taller in the core."""
    if area < 25:    base = 1.0      # shed / outbuilding
    elif area < 55:  base = 1.25
    elif area < 100: base = 1.6
    elif area < 170: base = 2.0
    elif area < 300: base = 2.5
    elif area < 600: base = 3.1
    else:            base = 3.8
    base += core * 1.5                       # commercial core runs taller
    base *= jitter(seed, 0.82, 1.22)         # break up the uniform slab look
    return max(1.0, min(base, 7.0))

def main():
    with open(SRC) as fh:
        src = json.load(fh)
    feats_in = src["features"]
    out = []
    dists = []
    for f in feats_in:
        p = f["properties"]
        c = (p["longitude"], p["latitude"])
        dists.append(min(km(c, PALACE), km(c, MARKET), km(c, BUSSTAND)))

    # Era thresholds: quantiles of distance-to-nucleus, so each epoch adds a
    # believable ring of new building rather than a fixed metric radius.
    ds = sorted(dists)
    n = len(ds)
    q = [ds[int(n * f)] for f in (0.02, 0.07, 0.18, 0.42)]

    kept = 0
    for f, d in zip(feats_in, dists):
        p = f["properties"]
        area = p.get("area_in_me") or 0
        conf = p.get("confidence") or 0
        if area < 12 or conf < 0.65:      # drop noise / low-confidence slivers
            continue
        c = (p["longitude"], p["latitude"])
        seed = p.get("full_plus_") or f"{c[0]}{c[1]}"

        # core-ness: 1 at the chantha, falling off over ~1.2 km
        core = max(0.0, 1.0 - min(km(c, MARKET), km(c, PALACE)) / 1.2)

        st = storeys(area, core, seed)
        h = round(st * 3.15 + jitter(seed + "r", -0.3, 0.6), 1)   # ~3.15 m / storey

        era = 4
        for i, t in enumerate(q):
            if d <= t:
                era = i
                break
        # A few outliers seed early hamlets away from the core, and some
        # near-core plots stay empty until later - keeps the growth organic.
        r = jitter(seed + "e", 0, 1)
        if era < 4 and r > 0.93: era = min(4, era + 1)
        elif era > 0 and r < 0.05: era -= 1

        # geometry: round to 6dp (~11 cm) and flatten single-ring multipolygons
        g = f["geometry"]
        rings = []
        if g["type"] == "MultiPolygon":
            polys = g["coordinates"]
        else:
            polys = [g["coordinates"]]
        for poly in polys:
            rings.append([[[round(x, 6), round(y, 6)] for x, y in ring] for ring in poly])
        if len(rings) == 1:
            geom = {"type": "Polygon", "coordinates": rings[0]}
        else:
            geom = {"type": "MultiPolygon", "coordinates": rings}

        out.append({"type": "Feature",
                    "properties": {"h": h, "era": era},
                    "geometry": geom})
        kept += 1

    fc = {"type": "FeatureCollection", "features": out}
    os.makedirs(os.path.dirname(DST), exist_ok=True)
    with open(DST, "w") as fh:
        json.dump(fc, fh, separators=(",", ":"))

    size = os.path.getsize(DST)
    print(f"in  {len(feats_in)} features")
    print(f"out {kept} features  ({size/1024/1024:.2f} MB)")
    from collections import Counter
    print("era spread:", sorted(Counter(x['properties']['era'] for x in out).items()))
    hs = sorted(x['properties']['h'] for x in out)
    print(f"height  min {hs[0]}  p50 {hs[len(hs)//2]}  p95 {hs[int(len(hs)*.95)]}  max {hs[-1]}")

main()
