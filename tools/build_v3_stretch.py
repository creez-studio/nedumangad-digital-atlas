"""Turn the redesigned-road CAD drawing (road.dwg -> tools/cad/road_flat.json,
flattened per layer with LibreDWG + ezdxf) into v3/data/stretch.json:
local-metre geometry for the 3D design-stretch chapter.

CAD is true metres, north up. It is tied to the stretch boundary by a pure
translation fitted against the OSM road centrelines (mean residual 2.5 m):
    X = (lon - LON0) * KX + OX ,  Y = (lat - LAT0) * KY + OY
"""
import json, math, random, os
from shapely.geometry import LineString, Polygon, Point, box, MultiPolygon, shape
from shapely.ops import unary_union, polygonize
from shapely import STRtree

random.seed(7)
LON0, LAT0, OX, OY = 77.001044431842374, 8.60279271564723, 70.0, 100.0
KX, KY = 111320 * math.cos(math.radians(8.606)), 110574
T = lambda c: ((c[0] - LON0) * KX + OX, (c[1] - LAT0) * KY + OY)
FRAME = box(94, 83, 466, 842)
d = json.load(open('tools/cad/road_flat.json'))
G = d['g']


def lines(layer, col=None, notcol=None):
    out = []
    for o in G:
        if o['l'] != layer or len(o['p']) < 2:
            continue
        if col is not None and o.get('col') != col:
            continue
        if notcol is not None and o.get('col') == notcol:
            continue
        p = o['p'] + ([o['p'][0]] if o['c'] else [])
        out.append(LineString(p))
    return out


def ext(l, e=0.3):
    c = list(l.coords)
    (x0, y0), (x1, y1) = c[0], c[1]
    L = math.hypot(x1 - x0, y1 - y0) or 1
    c[0] = (x0 - (x1 - x0) / L * e, y0 - (y1 - y0) / L * e)
    (x0, y0), (x1, y1) = c[-1], c[-2]
    L = math.hypot(x1 - x0, y1 - y0) or 1
    c[-1] = (x0 - (x1 - x0) / L * e, y0 - (y1 - y0) / L * e)
    return LineString(c)


def polys(g, min_area=1.0):
    if g.is_empty:
        return []
    gs = g.geoms if hasattr(g, 'geoms') else [g]
    return [p for p in gs if p.geom_type == 'Polygon' and p.area >= min_area]


def enc(p, n=2):
    """Polygon -> {o: outer, h: holes}"""
    p = p.simplify(0.08)
    r = lambda ring: [[round(x, n), round(y, n)] for x, y in list(ring.coords)[:-1]]
    o = {'o': r(p.exterior)}
    if p.interiors:
        o['h'] = [r(i) for i in p.interiors if Polygon(i).area > 0.5]
    return o


def encl(l, n=2):
    return [[round(x, n), round(y, n)] for x, y in l.simplify(0.05).coords]


# ---------------- proposed road ----------------
kerbs = lines('S Levels', notcol=7)
marks = lines('S Levels', col=7)
ku = unary_union(kerbs)
# morphological closing: everything between kerb lines < 11 m apart is road reserve
row = ku.buffer(5.6, resolution=6).buffer(-5.45, resolution=6).intersection(FRAME)
row = unary_union(polys(row, 30))
# junction centres lie further than the closing radius from any kerb: fill those small holes
row = unary_union([Polygon(p.exterior, [i for i in p.interiors if Polygon(i).area > 450]) for p in polys(row, 30)])
faces = [f for f in polygonize(unary_union([ext(l) for l in kerbs])) if f.area > 0.05]
strips = [f for f in faces if 2 * f.area / f.length < 2.7 and f.area < 1500 and f.intersects(FRAME)]
rb = row.boundary
foot, med = [], []
for f in strips:
    w = 2 * f.area / f.length
    c = f.representative_point()
    (foot if c.distance(rb) < 3.2 else med).append(f)
# closed traffic islands / roundabout centre
for f in faces:
    w = 2 * f.area / f.length
    if 2.7 <= w < 9 and f.area < 420 and f.within(row.buffer(1)) and f.representative_point().distance(rb) > 5:
        med.append(f)
med_u = unary_union(med).buffer(0.02).intersection(FRAME)
# main (widened) reserve = the parts of the reserve wider than ~15 m
main = row.buffer(-7.4, resolution=6).buffer(7.7, resolution=6).intersection(row)
main = unary_union(polys(main, 200))
# kerb + footpath: a continuous 2.5 m band along both edges of the main reserve
# (CAD section: 2.0 m footpath + 0.5 m kerb), plus the closed strips found above
band = main.difference(row.buffer(-2.5, resolution=6))
foot_u = unary_union([band] + foot).buffer(0.02).intersection(FRAME).difference(med_u)
carriage = main.difference(foot_u).difference(med_u)
minor = row.difference(main.buffer(0.3))

# minor / internal redesigned lanes (drawn as single red outlines)
il = lines('internal roads')
internal = unary_union(il).buffer(3.2).buffer(-3.05).intersection(FRAME).difference(row.buffer(0.2))
internal = unary_union([internal, minor])
zebra = [Polygon(o['p']) for o in G if o['l'] == 'TPX_VEGETATION_GREEN_SPACES' and o['t'] == 'LWPOLYLINE'
         and o['c'] and len(o['p']) >= 4]
zebra = [z for z in zebra if z.is_valid and 0.3 < z.area < 12 and z.within(FRAME)]

# ---------------- parking court ----------------
slots = [Polygon(o['p']) for o in G if o['l'] == 'parking slot' and o['t'] == 'LWPOLYLINE' and len(o['p']) >= 4]
slots = [s for s in slots if s.is_valid and 6 < s.area < 40]
p_lines = [l for lay in ('parking slot', 'parking road', 'path', 'landscape') for l in lines(lay)]
court = unary_union(p_lines).convex_hull if p_lines else None
p_road = lines('parking road')
p_path = lines('path')
court_lines = {k: [encl(l) for l in lines(lay)] for k, lay in (('slot', 'parking slot'), ('road', 'parking road'), ('path', 'path'), ('land', 'landscape'))}
court_pad = unary_union(lines('parking slot') + lines('parking road')).buffer(4.5).buffer(-4.2)
n_slots = sum(1 for o in G if o['l'] == 'parking slot' and o['t'] == 'LWPOLYLINE' and o['c'] and len(o['p']) == 5)
land = [f for f in polygonize(unary_union([ext(l, .2) for l in lines('landscape')])) if f.area > 2]

# ---------------- buildings ----------------
bl = lines('PDF_Geometry')
bfaces = [f for f in polygonize(unary_union([ext(l, 0.15) for l in bl])) if 12 < f.area < 6000]
bfaces = [f for f in bfaces if f.within(FRAME.buffer(-1))]
# heritage outlines
hl = lines('Heritage Buildings') + lines('hi BUILDINGS')
her = [f for f in polygonize(unary_union([ext(l, .2) for l in hl])) if f.area > 5]
her_u = unary_union(her) if her else Polygon()
# heights from the macro building model (Google Open Buildings derived)
gb = json.load(open('data/buildings.geojson'))
gpol, gh = [], []
for f in gb['features']:
    g = f['geometry']
    ring = g['coordinates'][0] if g['type'] == 'Polygon' else g['coordinates'][0][0]
    x, y = T(ring[0])
    if 60 < x < 500 and 60 < y < 880:
        gpol.append(Polygon([T(c) for c in ring]).buffer(0))
        gh.append(f['properties']['h'])
tree = STRtree(gpol)
blds = []
for f in bfaces:
    c = f.centroid
    i = tree.nearest(c)
    if gpol[i].distance(c) < 8:
        h = gh[i]
    else:
        h = 3.4 + min(9, f.area / 110) + random.random() * 1.2
    if f.area > 900:
        h = max(h, 9.5)
    is_her = (not her_u.is_empty) and f.intersection(her_u).area > 0.3 * f.area
    blds.append({**enc(f), 'ht': round(h, 1), 'a': round(f.area), 'her': int(is_her)})

for f in her:  # heritage outlines with no base-map footprint underneath
    if not any(Polygon(b['o']).intersection(f).area > 0.3 * f.area for b in blds):
        blds.append({**enc(f), 'ht': 5.5, 'a': round(f.area), 'her': 1})
for b in blds:  # frontage flag: 2 = footprint crosses the widened reserve, 1 = within 4 m of it
    P = Polygon(b['o'])
    b['f'] = 2 if P.intersection(main).area > 2 else (1 if P.distance(main) < 4 else 0)
bu = unary_union([Polygon(b['o']) for b in blds])

# ---------------- existing roads (OSM centrelines) ----------------
W = {'primary': 7.5, 'secondary': 7.0, 'tertiary': 5.5, 'unclassified': 4.5, 'residential': 3.75, 'service': 3.5}
ex, ex_polys = [], []
rd = json.load(open('data/roads_002.geojson'))
for f in rd['features']:
    p, g = f['properties'], f['geometry']
    hw = p.get('highway')
    if hw not in W or not g:
        continue
    ls = [g['coordinates']] if g['type'] == 'LineString' else g['coordinates']
    for l in ls:
        L = LineString([T(c) for c in l]).intersection(FRAME)
        for part in (L.geoms if hasattr(L, 'geoms') else [L]):
            if part.is_empty or part.geom_type != 'LineString' or part.length < 4:
                continue
            ex.append({'p': encl(part), 'c': hw, 'w': W[hw], 'n': p.get('name') or ''})
            ex_polys.append(part.buffer(W[hw] / 2, cap_style=2, join_style=1))
ex_u = unary_union(ex_polys).intersection(FRAME)

# ---------------- trees ----------------
trees = []
for i in d['i']:
    if i['n'].startswith('Plant') and FRAME.contains(Point(i['x'], i['y'])):
        trees.append([round(i['x'], 1), round(i['y'], 1), 2.2, 1])       # designed street trees
for o in G:
    if o['l'] == 'TPX_VEGETATION_GREEN_SPACES' and o['t'] == 'CIRCLE':
        c = Polygon(o['p']).centroid
        if FRAME.contains(c):
            trees.append([round(c.x, 1), round(c.y, 1), 2.6, 1])
# median planting every 14 m on long median strips
for m in polys(med_u, 25):
    if 2 * m.area / m.length < 2.6:
        ring = m.exterior
        cl = m.buffer(-0.6)
        for p in polys(cl, 1):
            L = p.exterior
            n = int(L.length / 2 / 14)
            for k in range(n):
                q = L.interpolate(k * 14 + 5)
                trees.append([round(q.x, 1), round(q.y, 1), 1.6, 1])
# indicative backyard canopy in the open ground of each block (context, not surveyed)
keep = row.buffer(6).union(bu.buffer(2.5)).union(internal.buffer(3))
if court is not None:
    keep = keep.union(court.buffer(4))
n = 0
while n < 420:
    x, y = random.uniform(96, 466), random.uniform(86, 841)
    q = Point(x, y)
    if keep.contains(q):
        continue
    trees.append([round(x, 1), round(y, 1), round(random.uniform(2.4, 4.6), 1), 0])
    n += 1

# vehicles drawn in the CAD as blocks
cars = [[round(i['x'], 1), round(i['y'], 1), round(i['r'], 1), i['n']] for i in d['i']
        if not i['n'].startswith('Plant') and FRAME.contains(Point(i['x'], i['y']))]

# ---------------- contours (2 m) ----------------
cont = []
for o in G:
    if o['l'].isdigit() and 40 <= int(o['l']) <= 120 and len(o['p']) > 1:
        # the contour sheet sits beside the plan in the drawing: shift it back onto it
        L = LineString([(x - 522.29, y - 4.51) for x, y in o['p']]).intersection(FRAME)
        for part in (L.geoms if hasattr(L, 'geoms') else [L]):
            if part.geom_type == 'LineString' and part.length > 8:
                cont.append({'e': int(o['l']), 'p': encl(part.simplify(0.4), 1)})

# ---------------- spine profile + numbers ----------------
import numpy as np
from scipy.interpolate import griddata
cp, cv = [], []
for c in cont:
    for x, y in c['p']:
        cp.append((x, y)); cv.append(c['e'])
spine = None
for f in rd['features']:
    pass
# spine = longest N-S chain: take the median strip centre points sorted by Y between the two junctions
sp = [(280.0, 110), (300.0, 160), (305.0, 250), (291.0, 330), (283.0, 356), (284.0, 420), (283.5, 480), (280.0, 560), (272.0, 620), (262.0, 665), (246.0, 700), (222.0, 740), (190.0, 775), (150.0, 805), (100.0, 830)]
SL = LineString(sp)
prof = []
for s in np.arange(0, SL.length, 10):
    q = SL.interpolate(s)
    z = griddata(np.array(cp), np.array(cv), [(q.x, q.y)], method='linear')[0]
    if z != z:
        z = griddata(np.array(cp), np.array(cv), [(q.x, q.y)], method='nearest')[0]
    prof.append([round(float(s)), round(float(z), 1), round(q.x, 1), round(q.y, 1)])

ex_main = unary_union([LineString(e['p']).buffer(e['w'] / 2) for e in ex if e['c'] in ('primary', 'secondary', 'tertiary')])
numbers = {
    'frame_m': [round(FRAME.bounds[2] - FRAME.bounds[0]), round(FRAME.bounds[3] - FRAME.bounds[1])],
    'area_ha': round(FRAME.area / 1e4, 1),
    'buildings': len(blds), 'heritage': sum(b['her'] for b in blds),
    'built_pct': round(bu.area / FRAME.area * 100, 1),
    'row_m2': round(main.area), 'carriage_m2': round(carriage.area),
    'foot_m2': round(foot_u.area), 'median_m2': round(med_u.area),
    'existing_main_m2': round(ex_main.intersection(FRAME).area),
    'zebra_bars': len(zebra), 'slots': n_slots,
    'street_trees': sum(1 for t in trees if t[3] == 1),
    'elev': [min(c['e'] for c in cont), max(c['e'] for c in cont)],
    'spine_m': round(SL.length),
    'frontage_cut': sum(1 for b in blds if b['f'] == 2), 'frontage_edge': sum(1 for b in blds if b['f'] >= 1),
}


# =====================================================================
# v3.1 — terrain model, stream, lanes, signals, crossings, road joints
# =====================================================================
from scipy.interpolate import RBFInterpolator
from scipy.ndimage import gaussian_filter
from shapely.prepared import prep
from shapely import affinity

# ---------------- stream (macro water lines inside the frame) ----------------
wl = []
for nme in ('water_streams', 'water_river', 'water_canal'):
    for f in json.load(open('data/%s.geojson' % nme))['features']:
        g = f['geometry']
        if not g: continue
        for l in ([g['coordinates']] if g['type'] == 'LineString' else g['coordinates']):
            L = LineString([T(c) for c in l]).intersection(FRAME.buffer(30))
            for part in (L.geoms if hasattr(L, 'geoms') else [L]):
                if part.geom_type == 'LineString' and part.length > 10:
                    wl.append(part)
def chaikin(c, n=2):
    for _ in range(n):
        o = [c[0]]
        for a, b in zip(c[:-1], c[1:]):
            o += [(a[0] * .75 + b[0] * .25, a[1] * .75 + b[1] * .25), (a[0] * .25 + b[0] * .75, a[1] * .25 + b[1] * .75)]
        o.append(c[-1]); c = o
    return c
wl = [LineString(chaikin(list(l.coords))) for l in wl]
stream_u = unary_union([l.buffer(2.2, cap_style=1) for l in wl]).intersection(FRAME) if wl else Polygon()
stream_line = unary_union(wl) if wl else LineString()

# ---------------- heightfield from the 2 m contours ----------------
DX = 4.0
gx0, gy0, gx1, gy1 = 94 - 24, 83 - 24, 466 + 24, 842 + 24
nx, ny = int((gx1 - gx0) / DX) + 1, int((gy1 - gy0) / DX) + 1
pts, vals = [], []
for o in G:
    if o['l'].isdigit() and 40 <= int(o['l']) <= 120 and len(o['p']) > 1:
        L = LineString([(x - 522.29, y - 4.51) for x, y in o['p']])
        if not L.intersects(FRAME.buffer(120)): continue
        L = L.intersection(FRAME.buffer(120))
        for part in (L.geoms if hasattr(L, 'geoms') else [L]):
            if part.geom_type != 'LineString': continue
            for s in np.arange(0, part.length, 5.0):
                q = part.interpolate(s); pts.append((q.x, q.y)); vals.append(int(o['l']))
pts, vals = np.array(pts), np.array(vals, float)
rbf = RBFInterpolator(pts, vals, neighbors=64, smoothing=2.0, kernel='thin_plate_spline')
XX, YY = np.meshgrid(gx0 + np.arange(nx) * DX, gy0 + np.arange(ny) * DX)
Z = rbf(np.c_[XX.ravel(), YY.ravel()]).reshape(ny, nx)
Z = np.clip(Z, vals.min() - 3, vals.max() + 3)
Z = gaussian_filter(Z, 1.0)
ZR = Z.copy()                                   # road datum: uncarved
if not stream_line.is_empty:                    # carve the stream bed so bridges read as bridges
    for j in range(ny):
        for i in range(nx):
            dd = stream_line.distance(Point(gx0 + i * DX, gy0 + j * DX))
            if dd < 16: Z[j, i] -= 3.0 * math.exp(-(dd / 6.0) ** 2)
def zat(x, y, A=ZR):
    fx, fy = (x - gx0) / DX, (y - gy0) / DX
    i, j = int(min(nx - 2, max(0, fx))), int(min(ny - 2, max(0, fy))); u, v = min(1, max(0, fx - i)), min(1, max(0, fy - j))
    return A[j, i] * (1 - u) * (1 - v) + A[j, i + 1] * u * (1 - v) + A[j + 1, i] * (1 - u) * v + A[j + 1, i + 1] * u * v
ZMIN = float(np.floor(Z.min()))
dem = {'x0': gx0, 'y0': gy0, 'dx': DX, 'nx': nx, 'ny': ny, 'zmin': ZMIN,
       'z': [round(float(v) - ZMIN, 2) for v in Z.ravel()], 'zr': [round(float(v) - ZMIN, 2) for v in ZR.ravel()]}
# spine profile from the heightfield
prof = []
for s in np.arange(0, SL.length, 10):
    q = SL.interpolate(s); prof.append([round(float(s)), round(float(zat(q.x, q.y)), 1), round(q.x, 1), round(q.y, 1)])
grades = [abs(prof[k + 2][1] - prof[k][1]) / 20 * 100 for k in range(len(prof) - 2)]
numbers['elev'] = [round(float(ZR[6:-6, 6:-6].min())), round(float(ZR[6:-6, 6:-6].max()))]
numbers['grade_max'] = round(max(grades), 1); numbers['grade_mean'] = round(sum(grades) / len(grades), 1)
kmax = grades.index(max(grades)); numbers['grade_at'] = [prof[kmax + 1][2], prof[kmax + 1][3]]
numbers['crest'] = max(prof, key=lambda p: p[1])[1]; numbers['sag'] = min(prof, key=lambda p: p[1])[1]

# ---------------- road joints: keep the existing lanes that meet the new roads ----------------
pr_all = unary_union([carriage, foot_u, med_u, internal]).buffer(0)
keep_polys, mouth_polys = [], []
for e in ex:
    L = LineString(e['p'])
    K = L.difference(pr_all.buffer(5))
    for part in (K.geoms if hasattr(K, 'geoms') else [K]):
        if part.is_empty or part.geom_type != 'LineString' or part.length < 14: continue
        E = L.intersection(part.buffer(9))          # run the lane on into the new kerb line
        P2 = E.buffer(e['w'] / 2, cap_style=2, join_style=1)
        keep_polys.append(P2)
ex_keep_all = unary_union(keep_polys).intersection(FRAME) if keep_polys else Polygon()
mouth = ex_keep_all.intersection(foot_u).buffer(0)            # dropped kerb where a kept lane meets the footpath
mouth = unary_union([p for p in polys(mouth, 3) if p.buffer(0.4).intersects(carriage)]) if not mouth.is_empty else Polygon()
foot_u = foot_u.difference(mouth.buffer(0.05))
ex_keep = ex_keep_all.difference(pr_all.buffer(0.02)).union(mouth).buffer(0.6, join_style=1).buffer(-0.6, join_style=1).difference(unary_union([carriage, med_u, internal]))
# give-way lines where a side road (internal or kept lane) meets the main carriageway
side = unary_union([internal, ex_keep]).buffer(0.7)
gl = carriage.boundary.intersection(side)
giveway = [encl(l) for l in (gl.geoms if hasattr(gl, 'geoms') else [gl]) if l.geom_type == 'LineString' and 2.5 < l.length < 14]

# stream crossings -> bridge decks
all_roads = unary_union([carriage, foot_u, med_u, internal, ex_keep])
bridges = []
if not stream_u.is_empty:
    for p in polys(all_roads.intersection(stream_line.buffer(7.5)), 8):
        bridges.append(p)
stream_open = stream_u

# ---------------- routes, lanes, signals ----------------
CARR = carriage.buffer(0.01)
ISL = med_u.buffer(0.6)
carr_p = CARR
def resample(c, step=3.0):
    L = LineString(c); n = max(2, int(L.length / step))
    return [L.interpolate(k * L.length / n) for k in range(n + 1)]
def build_route(name, guide, raw=False, carr_p=None, island=None):
    carr_p = carr_p or CARR; island = island or ISL
    P = resample(chaikin(guide, 3))
    off, span = [], []
    for k, q in enumerate(P):
        a, b = P[max(0, k - 1)], P[min(len(P) - 1, k + 1)]
        tx, ty = b.x - a.x, b.y - a.y; L = math.hypot(tx, ty) or 1; tx, ty = tx / L, ty / L
        nxv, nyv = -ty, tx                          # left normal
        R = 22
        cut = LineString([(q.x - nxv * R, q.y - nyv * R), (q.x + nxv * R, q.y + nyv * R)]).intersection(carr_p)
        iv = []
        for part in (cut.geoms if hasattr(cut, 'geoms') else [cut]):
            if part.geom_type == 'LineString' and part.length > 1.2:
                o = sorted(((x - q.x) * nxv + (y - q.y) * nyv) for x, y in part.coords)
                iv.append([o[0], o[-1]])
        iv.sort()
        if not iv: off.append(None); span.append(None); continue
        # seed = interval nearest the guide, then grow across medians / islands
        seed = min(range(len(iv)), key=lambda i: 0 if iv[i][0] <= 0 <= iv[i][1] else min(abs(iv[i][0]), abs(iv[i][1])))
        if not (iv[seed][0] - 10 <= 0 <= iv[seed][1] + 10): off.append(None); span.append(None); continue
        lo = hi = seed
        def is_med(g0, g1):
            m = (g0 + g1) / 2; return island.contains(Point(q.x + nxv * m, q.y + nyv * m))
        while lo > 0 and is_med(iv[lo - 1][1], iv[lo][0]): lo -= 1
        while hi < len(iv) - 1 and is_med(iv[hi][1], iv[hi + 1][0]): hi += 1
        use = iv[lo:hi + 1]; A, B = use[0][0], use[-1][1]
        if B - A > 44 or B - A < 5: off.append(None); span.append(None); continue
        if len(use) >= 2:
            gi = max(range(len(use) - 1), key=lambda i: use[i + 1][0] - use[i][1])       # the median gap
            Rt, Lt = [use[0][0], use[gi][1]], [use[gi + 1][0], use[-1][1]]
        else:
            m = (A + B) / 2; Rt, Lt = [A, m], [m, B]
        def lanes(i0, i1, keep_hi):                # two lanes if the carriageway takes them
            w = i1 - i0
            if w >= 6.2: return (i0 + w * .27, i0 + w * .73)
            return ((i0 + i1) / 2,) * 2
        l_in, l_out = lanes(*Lt, True)             # left of travel = forward traffic; inner lane is nearer the median
        r_out, r_in = lanes(*Rt, False)
        off.append([l_in, l_out, r_in, r_out]); span.append([A, B])
    if raw: return P, span
    # fill gaps (open junction areas) by interpolation, then smooth
    idx = [k for k, o in enumerate(off) if o]
    if len(idx) < 4: return None
    arr = np.array([[np.interp(k, idx, [off[i][c] for i in idx]) for c in range(4)] for k in range(len(P))])
    ker = np.ones(7) / 7
    for c in range(4):
        pad = np.r_[[arr[0, c]] * 3, arr[:, c], [arr[-1, c]] * 3]; arr[:, c] = np.convolve(pad, ker, 'valid')
    sp2 = [span[k] or [float(np.interp(k, idx, [span[i][0] for i in idx])), float(np.interp(k, idx, [span[i][1] for i in idx]))] for k in range(len(P))]
    return {'n': name, 'p': [[round(q.x, 2), round(q.y, 2)] for q in P], 'o': [[round(float(v), 2) for v in r] for r in arr], 'sp': [[round(v, 2) for v in s2] for s2 in sp2]}

def chain(*names_pts):
    return [tuple(p) for p in names_pts]
ROUTES = [
    ('Shorlacode Rd → Town Branch Rd → SH 3', [(94, 152), (150, 152), (210, 153), (255, 155), (280, 157), (293, 168), (297, 185), (298, 205), (298, 250), (291, 320), (283.5, 356), (284, 420), (283.5, 480), (280, 560), (272, 620), (262, 665), (246, 700), (222, 740), (190, 775), (150, 805), (97, 829)]),
    ('Mancha Rd ↔ Shorlacode Rd', [(466, 165), (430, 163), (408, 158), (392, 145), (370, 133), (340, 128), (310, 130), (292, 142), (275, 152), (255, 155), (210, 153), (150, 152), (94, 152)]),
    ('Girls HS Rd → roundabout → Surya Rd', [(94, 376), (150, 370), (200, 363), (250, 357), (283.5, 356), (320, 352), (360, 345), (395, 335), (410, 310), (412, 270), (404, 230), (400, 195), (404, 172), (425, 163), (466, 165)]),
    ('Pulippara – Anad Rd', [(466, 716), (420, 706), (370, 700), (330, 690), (300, 672), (280, 648), (274, 620), (280, 560)]),
]
def refine(name, g, **kw):
    r = build_route(name, g, raw=True, **kw)
    if not r: return None
    P, sp = r
    idx = [k for k, v in enumerate(sp) if v and v[1] - v[0] < 30]
    if len(idx) < 4: return build_route(name, g, **kw)
    mid = np.array([np.interp(k, idx, [(sp[i][0] + sp[i][1]) / 2 for i in idx]) for k in range(len(P))])
    mid = np.convolve(np.r_[[mid[0]] * 4, mid, [mid[-1]] * 4], np.ones(9) / 9, 'valid')
    g2 = []
    for k, q in enumerate(P):
        a, b = P[max(0, k - 1)], P[min(len(P) - 1, k + 1)]
        tx, ty = b.x - a.x, b.y - a.y; L = math.hypot(tx, ty) or 1
        g2.append((q.x - ty / L * mid[k], q.y + tx / L * mid[k]))
    return build_route(name, g2[::2] + [g2[-1]], **kw)
routes = [r for r in (refine(n, g) for n, g in ROUTES) if r]
JUNC = [
    {'n': 'Market junction', 'c': [287, 156], 'r': 23, 'k': 'signal', 'ph': [[0], [1]]},
    {'n': 'Surya Road junction', 'c': [402, 166], 'r': 19, 'k': 'signal', 'ph': [[1], [2]]},
    {'n': 'Palace Road fork', 'c': [268, 650], 'r': 22, 'k': 'signal', 'ph': [[0], [3]]},
    {'n': 'Bus-stand roundabout', 'c': [283.5, 356], 'r': 19, 'k': 'yield', 'ph': [[0], [2]]},
]
def make_stops(routes, gen):
    signals, stops, zebra_gen = [], [], []
    def cum(p):
        s = [0]
        for a, b in zip(p[:-1], p[1:]): s.append(s[-1] + math.hypot(b[0] - a[0], b[1] - a[1]))
        return s
    for ri, r in enumerate(routes):
        r['s'] = [round(v, 1) for v in cum(r['p'])]
        for ji, J in enumerate(JUNC):
            ph = next((k for k, g in enumerate(J['ph']) if ri in g), None)
            if ph is None: continue
            inside = [math.hypot(p[0] - J['c'][0], p[1] - J['c'][1]) < J['r'] for p in r['p']]
            if not any(inside): continue
            k0, k1 = inside.index(True), len(inside) - 1 - inside[::-1].index(True)
            for k, d_ in ((k0, 1), (k1, -1)):          # forward cars enter at k0, backward cars at k1
                if k <= 2 or k >= len(r['p']) - 3: continue
                ks = k - d_ * 2                         # stop line 6 m outside the junction circle
                q, a, b = r['p'][ks], r['p'][ks - 1], r['p'][ks + 1]
                tx, ty = b[0] - a[0], b[1] - a[1]; L = math.hypot(tx, ty); tx, ty = tx / L, ty / L; nxv, nyv = -ty, tx
                A, B = r['sp'][ks]
                stops.append({'r': ri, 'd': d_, 's': r['s'][ks], 'j': ji, 'ph': ph})
                if J['k'] != 'signal' or not gen: continue
                edge = (B + 1.3) if d_ > 0 else (A - 1.3)       # pole on the kerb to the driver's left
                signals.append({'x': round(q[0] + nxv * edge, 1), 'y': round(q[1] + nyv * edge, 1), 'a': round(math.atan2(ty * d_, tx * d_), 3), 'j': ji, 'ph': ph})
                # zebra between stop line and junction: bars along the direction of travel
                kz = k - d_ * 1; qz = r['p'][kz]; made = 0
                o = A + .6
                while o < B - .4:
                    cx_, cy_ = qz[0] + nxv * o, qz[1] + nyv * o
                    bar = Polygon([(cx_ - tx * 1.6 - nxv * .25, cy_ - ty * 1.6 - nyv * .25), (cx_ + tx * 1.6 - nxv * .25, cy_ + ty * 1.6 - nyv * .25), (cx_ + tx * 1.6 + nxv * .25, cy_ + ty * 1.6 + nyv * .25), (cx_ - tx * 1.6 + nxv * .25, cy_ - ty * 1.6 + nyv * .25)])
                    if carr_p.contains(bar.buffer(-0.05)) and not any(bar.distance(z) < 3 for z in zebra): zebra_gen.append(bar); made += 1
                    o += 1.0

    return signals, stops, zebra_gen
signals, stops, zebra_gen = make_stops(routes, True)
# de-duplicate overlapping generated crossings (two routes sharing an approach)
zg = []
for b in zebra_gen:
    if not any(b.intersects(o) for o in zg): zg.append(b)
zebra_gen = zg
EXP = ex_u.buffer(0.01)
routes_ex = [r for r in (refine(n, g, carr_p=EXP, island=Polygon()) for n, g in ROUTES) if r]
_, stops_ex, _ = make_stops(routes_ex, False)
for r in routes + routes_ex: del r['sp']

# ---------------- bridge parapets ----------------
parapets = []
rb_all = all_roads.boundary
for bp in bridges:
    e = bp.boundary.intersection(rb_all.buffer(0.15))
    for l in (e.geoms if hasattr(e, 'geoms') else [e]):
        if l.geom_type == 'LineString' and l.length > 4: parapets.append(encl(l))

# ---------------- concept: ring skywalk over Market junction ----------------
SC, SR = Point(286, 162), 22.0
road_j = unary_union([carriage, med_u, internal]).buffer(1.2)
ang = []
for k in range(72):
    a_ = k * 5 * math.pi / 180; q = Point(SC.x + SR * math.cos(a_), SC.y + SR * math.sin(a_))
    ang.append((k * 5, q, not road_j.contains(q)))
cols_ = [[round(q.x, 1), round(q.y, 1)] for a_, q, land_ in ang if land_ and a_ % 15 == 0]
runs, cur = [], []
for a_, q, land_ in ang + ang[:1]:
    if land_: cur.append(a_)
    elif cur: runs.append(cur); cur = []
if cur: runs.append(cur)
if len(runs) > 1 and runs[0][0] == 0 and runs[-1][-1] in (355, 0): runs[0] = [x - 360 for x in runs.pop()] + runs[0]
bpol = [Polygon(b['o']) for b in blds]
links, towers = [], []
for run in runs:
    if len(run) < 3: continue
    m = math.radians((run[0] + run[-1]) / 2)
    rp = Point(SC.x + (SR + 1.5) * math.cos(m), SC.y + (SR + 1.5) * math.sin(m))
    towers.append([round(SC.x + (SR + 4.5) * math.cos(m), 1), round(SC.y + (SR + 4.5) * math.sin(m), 1), round(m, 3)])
    best = None
    for bi, bp in enumerate(bpol):
        c = bp.centroid; da = abs((math.atan2(c.y - SC.y, c.x - SC.x) - m + math.pi) % (2 * math.pi) - math.pi)
        dist = bp.distance(rp)
        if da < math.radians(40) and bp.area > 80 and dist < 45 and SC.distance(c) > SR + 6 and (best is None or dist < best[0]): best = (dist, bi)
    if best:
        from shapely.ops import nearest_points
        n1, n2 = nearest_points(rp, bpol[best[1]])
        seg = LineString([rp, n2])
        if not seg.buffer(1.5).intersects(unary_union([bp for bi, bp in enumerate(bpol) if bi != best[1]])):
            inn = bpol[best[1]].centroid; L_ = n2.distance(inn) or 1
            links.append([round(rp.x, 1), round(rp.y, 1), round(n2.x + (inn.x - n2.x) / L_ * 1.5, 1), round(n2.y + (inn.y - n2.y) / L_ * 1.5, 1), best[1]])
# long link to the new market (model at 205,112; its site footprints are cleared in the proposal)
others = unary_union([bp for bp in bpol if bp.centroid.distance(Point(205, 112)) >= 36])
best = None
for deg in range(150, 271, 5):                       # try ring points on the market side and landings on the market's east / north faces
    a_ = math.radians(deg); rp = Point(SC.x + (SR + 1.5) * math.cos(a_), SC.y + (SR + 1.5) * math.sin(a_))
    for tx_, ty_ in [(229, 100 + k * 5) for k in range(7)] + [(188 + k * 6, 131) for k in range(7)]:
        seg = LineString([rp, (tx_, ty_)])
        if seg.buffer(1.8).intersects(others): continue
        if best is None or seg.length < best[0]: best = (seg.length, rp, tx_, ty_)
print('market link:', best and (round(best[0]), best[2], best[3]))
if best: links.append([round(best[1].x, 1), round(best[1].y, 1), best[2], best[3], -1])
ann = SC.buffer(SR + 2.2).difference(SC.buffer(SR - 2.2))
print('buildings under ring:', [(i + 1, b['ht']) for i, b in enumerate(blds) if Polygon(b['o']).intersects(ann)])
sky = {'c': [SC.x, SC.y], 'r': SR, 'w': 3.6, 'cols': cols_, 'links': links, 'towers': towers}
numbers['sky_len'] = round(2 * math.pi * SR); numbers['sky_links'] = len(links)
numbers['signals'] = len(signals); numbers['zebra_gen'] = len(zebra_gen)

out = {
    'geo': {'lon0': LON0, 'lat0': LAT0, 'kx': KX, 'ky': KY, 'ox': OX, 'oy': OY},
    'frame': [round(v, 1) for v in FRAME.bounds],
    'carriage': [enc(p) for p in polys(carriage, 4)],
    'foot': [enc(p) for p in polys(foot_u, 0.6)],
    'ex_keep': [enc(p) for p in polys(ex_keep, 3)], 'giveway': giveway,
    'stream': [enc(p) for p in polys(stream_open, 2)], 'stream_line': [encl(l) for l in wl], 'bridges': [enc(p) for p in bridges],
    'dem': dem, 'routes': routes, 'routes_ex': routes_ex, 'stops_ex': stops_ex, 'parapets': parapets, 'sky': sky, 'junc': JUNC, 'signals': signals, 'stops': stops,
    'zebra_gen': [enc(z) for z in zebra_gen],
    'median': [enc(p) for p in polys(med_u, 0.6)],
    'internal': [enc(p) for p in polys(internal, 6)],
    'marks': [encl(l) for l in marks if l.intersects(FRAME)],
    'zebra': [enc(z) for z in zebra],
    'slots': [enc(s) for s in slots],
    'p_road': [encl(l) for l in p_road], 'p_path': [encl(l) for l in p_path],
    'land': [enc(l) for l in land],
    'court': court_lines, 'court_pad': [enc(p) for p in polys(court_pad, 20)],
    'bld': blds,
    'ex': ex, 'ex_surface': [enc(p) for p in polys(ex_u, 4)],
    'trees': trees, 'cars': cars, 'cont': cont, 'prof': prof, 'num': numbers,
}
os.makedirs('v3/data', exist_ok=True)
json.dump(out, open('v3/data/stretch.json', 'w'), separators=(',', ':'))
print(os.path.getsize('v3/data/stretch.json') // 1024, 'kB')
print(numbers)
print({k: len(v) for k, v in out.items() if isinstance(v, list)})
