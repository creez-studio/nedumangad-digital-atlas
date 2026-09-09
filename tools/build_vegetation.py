#!/usr/bin/env python3
"""Scatter vegetation points across the open land of the municipality.

There is no landuse layer in the source data, so "vegetation" is derived as
the negative space: inside the municipal boundary, but clear of every building
footprint, road centreline and watercourse. Output feeds a symbol layer.

Each point carries:
  s - size multiplier, so the canopy does not read as a stamped grid
  t - variant 0/1, two canopy shapes
"""
import json, math, os, hashlib, random

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D = os.path.join(ROOT, "data")
DST = os.path.join(D, "vegetation.geojson")

LAT = 8.61
M_PER_DEG_LAT = 110574.0
M_PER_DEG_LON = 111320.0 * math.cos(math.radians(LAT))

SPACING_M = 46.0      # nominal grid pitch
CLEAR_BLD_M = 21.0    # keep clear of building footprints
CLEAR_ROAD_M = 15.0   # keep clear of carriageways
CLEAR_WATER_M = 12.0


def load(name):
    p = os.path.join(D, name)
    if not os.path.exists(p):
        return None
    with open(p) as fh:
        return json.load(fh)


def ring_of(geom):
    """Yield the exterior rings of a (Multi)Polygon."""
    if geom["type"] == "Polygon":
        yield geom["coordinates"][0]
    elif geom["type"] == "MultiPolygon":
        for poly in geom["coordinates"]:
            yield poly[0]


def point_in_ring(x, y, ring):
    inside = False
    n = len(ring)
    j = n - 1
    for i in range(n):
        xi, yi = ring[i][0], ring[i][1]
        xj, yj = ring[j][0], ring[j][1]
        if (yi > y) != (yj > y):
            xint = (xj - xi) * (y - yi) / (yj - yi) + xi
            if x < xint:
                inside = not inside
        j = i
    return inside


class Grid:
    """Uniform bucket grid for 'is anything within R metres of this point'."""

    def __init__(self, cell_m):
        self.cw = cell_m / M_PER_DEG_LON
        self.ch = cell_m / M_PER_DEG_LAT
        self.cells = {}

    def add(self, x, y):
        self.cells.setdefault((int(x / self.cw), int(y / self.ch)), []).append((x, y))

    def near(self, x, y, r_m):
        rx, ry = r_m / M_PER_DEG_LON, r_m / M_PER_DEG_LAT
        cx, cy = int(x / self.cw), int(y / self.ch)
        span_x = int(rx / self.cw) + 1
        span_y = int(ry / self.ch) + 1
        for gx in range(cx - span_x, cx + span_x + 1):
            for gy in range(cy - span_y, cy + span_y + 1):
                for (px, py) in self.cells.get((gx, gy), ()):
                    dx = (px - x) * M_PER_DEG_LON
                    dy = (py - y) * M_PER_DEG_LAT
                    if dx * dx + dy * dy <= r_m * r_m:
                        return True
        return False


def main():
    bnd = load("municipality_boundary.geojson")
    rings = [r for f in bnd["features"] for r in ring_of(f["geometry"])]

    # obstacles ---------------------------------------------------------
    g_bld = Grid(CLEAR_BLD_M)
    blds = load("buildings.geojson")
    if blds:
        for f in blds["features"]:
            g = f["geometry"]
            polys = g["coordinates"] if g["type"] == "MultiPolygon" else [g["coordinates"]]
            for poly in polys:
                r = poly[0]
                # footprint centroid is enough at this clearance radius
                g_bld.add(sum(p[0] for p in r) / len(r), sum(p[1] for p in r) / len(r))

    g_road = Grid(CLEAR_ROAD_M)
    for nm in ("roads_002.geojson", "roads_residential.geojson", "roads_add01.geojson"):
        rd = load(nm)
        if not rd:
            continue
        for f in rd["features"]:
            g = f["geometry"]
            lines = [g["coordinates"]] if g["type"] == "LineString" else g["coordinates"]
            for ln in lines:
                for p in ln:
                    g_road.add(p[0], p[1])

    g_wat = Grid(CLEAR_WATER_M)
    for nm in ("water_river.geojson", "water_streams.geojson", "water_canal.geojson"):
        w = load(nm)
        if not w:
            continue
        for f in w["features"]:
            g = f["geometry"]
            lines = [g["coordinates"]] if g["type"] == "LineString" else g["coordinates"]
            for ln in lines:
                for p in ln:
                    g_wat.add(p[0], p[1])

    # sample ------------------------------------------------------------
    xs = [p[0] for r in rings for p in r]
    ys = [p[1] for r in rings for p in r]
    x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
    step_x = SPACING_M / M_PER_DEG_LON
    step_y = SPACING_M / M_PER_DEG_LAT

    rnd = random.Random(20260909)
    out = []
    y = y0
    while y < y1:
        x = x0
        while x < x1:
            # jitter off the lattice so it never reads as a planted grid
            px = x + (rnd.random() - 0.5) * step_x * 0.85
            py = y + (rnd.random() - 0.5) * step_y * 0.85
            x += step_x
            if not any(point_in_ring(px, py, r) for r in rings):
                continue
            if g_bld.near(px, py, CLEAR_BLD_M):
                continue
            if g_road.near(px, py, CLEAR_ROAD_M):
                continue
            if g_wat.near(px, py, CLEAR_WATER_M):
                continue
            if rnd.random() > 0.82:      # thin it out; canopy, not wallpaper
                continue
            seed = hashlib.md5(f"{px:.5f}{py:.5f}".encode()).hexdigest()
            out.append({
                "type": "Feature",
                "properties": {"s": round(0.72 + (int(seed[:4], 16) / 0xFFFF) * 0.62, 2),
                               "t": int(seed[4], 16) % 2},
                "geometry": {"type": "Point", "coordinates": [round(px, 6), round(py, 6)]},
            })
        y += step_y

    fc = {"type": "FeatureCollection", "features": out}
    with open(DST, "w") as fh:
        json.dump(fc, fh, separators=(",", ":"))
    print(f"vegetation points: {len(out)}  ({os.path.getsize(DST)/1024:.0f} KB)")


main()
