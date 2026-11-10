"""Slim the shared GeoJSON layers into compact v3/data files and derive
ecology statistics + an elevation grid from the contour survey.

Run from the repo root:  python3 tools/build_v3_macro.py
"""
import json, math, os
import numpy as np
from shapely.geometry import shape, mapping, Point, LineString
from shapely.ops import unary_union
from scipy.interpolate import griddata

SRC, OUT = 'data', 'v3/data'
os.makedirs(OUT, exist_ok=True)
LAT0 = 8.606
KX, KY = 111320 * math.cos(math.radians(LAT0)), 110574


def load(n):
    return json.load(open(f'{SRC}/{n}.geojson'))


def rnd(c, n=6):
    if isinstance(c[0], (int, float)):
        return [round(c[0], n), round(c[1], n)]
    return [rnd(x, n) for x in c]


def dump(name, obj):
    p = f'{OUT}/{name}'
    json.dump(obj, open(p, 'w'), separators=(',', ':'))
    print(f'{name:28s}{os.path.getsize(p) / 1024:9.0f} kB')


def fc(feats):
    return {'type': 'FeatureCollection', 'features': feats}


def feat(geom, props, n=6):
    return {'type': 'Feature', 'properties': props,
            'geometry': {'type': geom['type'], 'coordinates': rnd(geom['coordinates'], n)}}


def metres(g):
    """shapely geometry in lon/lat -> local metres."""
    from shapely.ops import transform
    return transform(lambda x, y, z=None: ((x - 77.0) * KX, (y - LAT0) * KY), g)


# ---------- admin ----------
for n, tol, keep in [('india', 0.02, []), ('south_india', 0.01, []), ('kerala', 0.004, []),
                     ('tvm_district', 0.001, []), ('taluk', 0.0004, []),
                     ('municipality_boundary', 0, [])]:
    d = load(n)
    out = []
    for f in d['features']:
        g = shape(f['geometry'])
        if tol:
            g = g.simplify(tol)
        out.append(feat(mapping(g), {}, 5))
    dump(n.replace('municipality_', '') + '.geojson', fc(out))

boundary = unary_union([shape(f['geometry']) for f in load('municipality_boundary')['features']])
bm = metres(boundary)

wards = []
for f in load('wards')['features']:
    g = shape(f['geometry']).simplify(0.00004)
    p = f['properties']
    wards.append(feat(mapping(g), {'name': (p.get('Ward_Name') or '').title(), 'no': p.get('Ward_No'),
                                   'ha': round(metres(g).area / 1e4, 1)}, 5))
dump('wards.geojson', fc(wards))


# ---------- roads ----------
def road_class(p):
    ref = str(p.get('ref') or '')
    if p.get('_proposed'):
        return 'prop'
    if 'NH' in ref:
        return 'nh'
    if 'SH' in ref:
        return 'sh'
    hw = p.get('highway')
    if 'MDR' in ref or hw in ('secondary', 'primary'):
        return 'mdr'
    if hw in ('tertiary', 'unclassified', 'road'):
        return 'mun'
    if hw in ('residential', 'living_street', 'service'):
        return 'loc'
    return None


RANK = {'prop': 5, 'nh': 5, 'sh': 4, 'mdr': 3, 'mun': 2, 'loc': 1}
roads, seen, length = [], set(), {}
for n in ('roads_002', 'roads_residential', 'roads_add01'):
    for f in load(n)['features']:
        p = f['properties']
        if p.get('highway') == 'proposed':
            p['_proposed'] = True
        k = p.get('full_id')
        if k in seen and n != 'roads_add01':
            continue
        seen.add(k)
        c = road_class(p)
        if not c or not f['geometry']:
            continue
        g = shape(f['geometry'])
        length[c] = length.get(c, 0) + metres(g).length
        props = {'c': c, 'r': RANK[c]}
        if p.get('name'):
            props['n'] = p['name']
        if p.get('ref'):
            props['ref'] = p['ref']
        roads.append(feat(f['geometry'], props, 6))
dump('roads.geojson', fc(roads))

# ---------- points ----------
notes = json.load(open(f'{SRC}/junction_notes.json'))
jn = []
for f in load('junctions')['features']:
    p = f['properties']
    nt = notes.get(str(p.get('osm_id')), {})
    jn.append(feat(f['geometry'], {'n': p.get('name'), 'ml': p.get('name:ml'), **nt}))
dump('junctions.geojson', fc(jn))
bs = []
for f in load('busstand')['features']:
    p = f['properties']
    bs.append(feat(f['geometry'], {'n': p.get('name'), 'k': 'stand' if p.get('amenity') == 'bus_station' else 'stop'}))
dump('busstops.geojson', fc(bs))
ch = [f for f in load('chantha_border')['features'] if f['properties'].get('Market ')]
dump('chantha.geojson', fc([feat(f['geometry'], {'n': 'Nedumangad Market'}) for f in ch]))

# ---------- water ----------
water, wlen = [], 0
for n, k in (('water_streams', 'stream'), ('water_river', 'river'), ('water_canal', 'canal')):
    for f in load(n)['features']:
        g = shape(f['geometry'])
        wlen += metres(g.intersection(boundary)).length
        water.append(feat(f['geometry'], {'k': k, 'n': f['properties'].get('name')}, 5))
dump('water.geojson', fc(water))

# ---------- contours + DEM ----------
cont = []
for f in load('contours_clipped')['features']:
    e = int(f['properties']['ELEV'])
    cont.append(feat(f['geometry'], {'e': e, 'i': 1 if e % 50 == 0 else 0}, 5))
dump('contours.geojson', fc(cont))

pts, val = [], []
for f in load('contours20')['features']:
    e = f['properties']['ELEV']
    g = f['geometry']
    lines = [g['coordinates']] if g['type'] == 'LineString' else g['coordinates']
    for l in lines:
        for c in l[::3]:
            pts.append((c[0], c[1]))
            val.append(e)
pts, val = np.array(pts), np.array(val)
x0, y0, x1, y1 = boundary.bounds
pad = 0.004
x0, y0, x1, y1 = x0 - pad, y0 - pad, x1 + pad, y1 + pad
NX, NY = 220, int(220 * (y1 - y0) * KY / ((x1 - x0) * KX))
gx, gy = np.meshgrid(np.linspace(x0, x1, NX), np.linspace(y0, y1, NY))
m = (pts[:, 0] > x0 - .01) & (pts[:, 0] < x1 + .01) & (pts[:, 1] > y0 - .01) & (pts[:, 1] < y1 + .01)
dem = griddata(pts[m], val[m], (gx, gy), method='linear')
near = griddata(pts[m], val[m], (gx, gy), method='nearest')
dem = np.where(np.isnan(dem), near, dem)
dump('dem.json', {'bbox': [round(v, 6) for v in (x0, y0, x1, y1)], 'nx': NX, 'ny': NY,
                  'z': [int(round(v)) for v in dem.flatten()]})

# ---------- vegetation (compact) ----------
veg = [[round(f['geometry']['coordinates'][0], 6), round(f['geometry']['coordinates'][1], 6),
        f['properties']['s'], f['properties']['t']] for f in load('vegetation')['features']]
dump('vegetation.json', veg)

# ---------- buildings ----------
b = load('buildings')
barea, n_in = 0, 0
bout = []
for f in b['features']:
    g = shape(f['geometry'])
    a = metres(g).area
    barea += a
    n_in += 1
    bout.append(feat(f['geometry'], {'h': f['properties']['h'], 'e': f['properties']['era']}, 6))
dump('buildings.geojson', fc(bout))

# ---------- routes ----------
routes = []
for fn in sorted(os.listdir(SRC)):
    if fn.split('_')[0] in ('corr', 'route', 'troute', 'mroute'):
        d = json.load(open(f'{SRC}/{fn}'))
        for f in d['features']:
            if f['geometry']:
                g = shape(f['geometry']).simplify(0.00005)
                routes.append(feat(mapping(g), {'id': fn.replace('.geojson', '')}, 5))
dump('routes.geojson', fc(routes))

# ---------- ecology statistics ----------
inside = np.array([boundary.contains(Point(x, y)) for x, y in zip(gx.flatten(), gy.flatten())])
zin = dem.flatten()[inside]
bands = [(0, 60), (60, 100), (100, 140), (140, 400)]
stats = {
    'area_km2': round(bm.area / 1e6, 2),
    'buildings': n_in,
    'built_ha': round(barea / 1e4, 1),
    'built_pct': round(barea / bm.area * 100, 1),
    'canopies': len(veg),
    'water_km': round(wlen / 1000, 1),
    'elev_min': int(zin.min()), 'elev_max': int(zin.max()), 'elev_mean': int(zin.mean()),
    'bands': [{'lo': lo, 'hi': hi, 'pct': round(float(((zin >= lo) & (zin < hi)).mean() * 100), 1)} for lo, hi in bands],
    'road_km': {k: round(v / 1000, 1) for k, v in length.items()},
    'wards': len(wards),
}
dump('stats.json', stats)
print(stats)

# =====================================================================
# v3.1 — river polygons with downstream-growing width, and road bridges
# =====================================================================
from shapely.geometry import LineString, Polygon, MultiPolygon
from shapely.ops import unary_union


def elev(lon, lat):
    i = int(round((lon - x0) / (x1 - x0) * (NX - 1))); j = int(round((lat - y0) / (y1 - y0) * (NY - 1)))
    return float(dem[min(NY - 1, max(0, j)), min(NX - 1, max(0, i))])


def chaikin(c, n=2):
    for _ in range(n):
        o = [c[0]]
        for a, b in zip(c[:-1], c[1:]):
            o += [(a[0] * .75 + b[0] * .25, a[1] * .75 + b[1] * .25), (a[0] * .25 + b[0] * .75, a[1] * .25 + b[1] * .75)]
        o.append(c[-1]); c = o
    return c


M2 = lambda c: ((c[0] - 77.0) * KX, (c[1] - LAT0) * KY)
LL = lambda p: [round(p[0] / KX + 77.0, 6), round(p[1] / KY + LAT0, 6)]
segs = []
for n_, k in (('water_streams', 'stream'), ('water_river', 'river'), ('water_canal', 'canal')):
    for f in load(n_)['features']:
        g = f['geometry']
        if not g: continue
        for l in ([g['coordinates']] if g['type'] == 'LineString' else g['coordinates']):
            if len(l) < 2: continue
            if elev(*l[0][:2]) < elev(*l[-1][:2]): l = l[::-1]              # run every reach downhill
            m_ = chaikin([M2(c) for c in l])
            segs.append({'k': k, 'p': m_, 'L': LineString(m_).length, 'z': elev(*l[0][:2]), 'n': f['properties'].get('name')})
# accumulate width downstream: a reach starts as wide as the widest reach that ends where it begins
W0 = {'stream': 2.2, 'river': 9.0, 'canal': 4.5}; WMAX = {'stream': 8.0, 'river': 20.0, 'canal': 5.5}; GROW = {'stream': 1 / 320, 'river': 1 / 500, 'canal': 0}
node = {}
key = lambda p: (round(p[0] / 6), round(p[1] / 6))
for s_ in sorted(segs, key=lambda s: -s['z']):
    w0 = max(W0[s_['k']], node.get(key(s_['p'][0]), 0))
    w1 = min(WMAX[s_['k']], w0 + s_['L'] * GROW[s_['k']]); w0 = min(w0, w1)
    s_['w'] = (w0, w1)
    ke = key(s_['p'][-1]); node[ke] = max(node.get(ke, 0), w1)
wpolys = {'stream': [], 'river': [], 'canal': []}
wline = []
for s_ in segs:
    p = s_['p']; cum = [0]
    for a, b in zip(p[:-1], p[1:]): cum.append(cum[-1] + math.hypot(b[0] - a[0], b[1] - a[1]))
    left, right = [], []
    for i, q in enumerate(p):
        a, b = p[max(0, i - 1)], p[min(len(p) - 1, i + 1)]
        tx, ty = b[0] - a[0], b[1] - a[1]; L_ = math.hypot(tx, ty) or 1
        w = (s_['w'][0] + (s_['w'][1] - s_['w'][0]) * cum[i] / (cum[-1] or 1)) / 2
        left.append((q[0] - ty / L_ * w, q[1] + tx / L_ * w)); right.append((q[0] + ty / L_ * w, q[1] - tx / L_ * w))
    poly = Polygon(left + right[::-1]).buffer(0)
    wpolys[s_['k']].append(poly.union(Point(p[-1]).buffer(s_['w'][1] / 2)).union(Point(p[0]).buffer(s_['w'][0] / 2)))
    wline.append({'type': 'Feature', 'properties': {'k': s_['k'], 'n': s_['n'], 'w': round((s_['w'][0] + s_['w'][1]) / 2, 1)},
                  'geometry': {'type': 'LineString', 'coordinates': [LL(q) for q in LineString(p).simplify(0.6).coords]}})
wfeat = []
for k, ps in wpolys.items():
    u = unary_union(ps).buffer(0.8, join_style=1).buffer(-0.8, join_style=1).simplify(0.25)
    for g in (u.geoms if hasattr(u, 'geoms') else [u]):
        if g.area < 4: continue
        wfeat.append({'type': 'Feature', 'properties': {'k': k}, 'geometry': {'type': 'Polygon', 'coordinates': [[LL(q) for q in r.coords] for r in [g.exterior] + list(g.interiors)]}})
dump('water_poly.geojson', fc(wfeat))
dump('water.geojson', fc(wline))
water_u = unary_union([p for ps in wpolys.values() for p in ps])

# bridges: every place a mapped road crosses a watercourse becomes a short raised deck with parapets
RW = {'sh': 10.0, 'mdr': 7.5, 'mun': 5.5, 'loc': 3.6, 'prop': 10.0}
br = []
for f in roads:
    c = f['properties']['c']
    if c == 'prop': continue
    g = f['geometry']
    for l in ([g['coordinates']] if g['type'] == 'LineString' else g['coordinates']):
        L_ = LineString([M2(q) for q in l])
        if not L_.intersects(water_u): continue
        x_ = L_.intersection(water_u.buffer(5))
        for part in (x_.geoms if hasattr(x_, 'geoms') else [x_]):
            if part.geom_type != 'LineString' or part.length < 4 or part.length > 90: continue
            w = RW[c]
            deck = part.buffer(w / 2 + .6, cap_style=2)
            para = deck.difference(part.buffer(w / 2, cap_style=2).buffer(0.01))
            piers = [part.interpolate(t, normalized=True).buffer(1.1, resolution=3) for t in ((0.03, 0.97) if part.length < 26 else (0.03, 0.5, 0.97))]
            enc_ = lambda P_, props: {'type': 'Feature', 'properties': props, 'geometry': {'type': 'Polygon', 'coordinates': [[LL(q) for q in P_.exterior.coords]]}}
            br.append(enc_(deck, {'t': 'deck', 'c': c}))
            for q_ in (para.geoms if hasattr(para, 'geoms') else [para]):
                if q_.geom_type == 'Polygon' and q_.area > 1: br.append(enc_(q_, {'t': 'rail', 'c': c}))
            for q_ in piers: br.append(enc_(q_, {'t': 'pier', 'c': c}))
n_br = sum(1 for b_ in br if b_['properties']['t'] == 'deck')
dump('bridges.geojson', fc(br))
stats['bridges'] = n_br
dump('stats.json', stats)
print('bridges', n_br, 'water polys', len(wfeat))
