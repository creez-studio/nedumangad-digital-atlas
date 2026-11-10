// Macro atlas: MapLibre scene, data, layer choreography and the macro chapters.
import { C, CENTER, TOWN, STRETCH, ROAD_CLASS, ERA, PERIODS, DESTS, DEST_COLOR, CORRIDORS, TOURIST, ECO, V } from './content.js';
import { $, $$, dock, card, tip, fmt, tween, ease, wait, mouse, cursorMode, countUp, skipper } from './ui.js';

const KX = 111320 * Math.cos(8.606 * Math.PI / 180), KY = 110574;
const EX = 1.6;                       // vertical exaggeration of macro massing
export const M = { map: null, d: {}, markers: [], f: [0, 0, 0, 0, 0], on: new Set(), tick: new Set(), handlers: [] };
const km = (a, b) => Math.hypot((a[0] - b[0]) * KX, (a[1] - b[1]) * KY) / 1000;

// ------------------------------------------------------------------ data
const FILES = ['boundary', 'taluk', 'tvm_district', 'kerala', 'india', 'wards', 'roads', 'junctions', 'busstops', 'chantha', 'water', 'water_poly', 'bridges', 'contours', 'routes', 'buildings'];
export async function loadData(progress) {
  let n = 0; const total = FILES.length + 3;
  const get = async (name, ext = 'geojson') => { const r = await (await fetch(`data/${name}.${ext}`)).json(); progress(++n / total, name); return r; };
  const [geo, dem, veg, stats] = await Promise.all([
    Promise.all(FILES.map((f) => get(f))), get('dem', 'json'), get('vegetation', 'json'), get('stats', 'json')]);
  FILES.forEach((f, i) => { M.d[f] = geo[i]; });
  Object.assign(M.d, { dem, veg, stats });
  buildIndexes();
}

function ring(g) { return g.type === 'MultiPolygon' ? g.coordinates[0][0] : g.coordinates[0]; }
function buildIndexes() {
  const d = M.d;
  d.boundaryRing = ring(d.boundary.features[0].geometry);
  // route end points (the end farthest from town) and lengths
  d.routeEnd = {};
  d.routes.features.forEach((f) => {
    const cs = f.geometry.type === 'LineString' ? f.geometry.coordinates : f.geometry.coordinates.flat();
    let best = cs[0];
    cs.forEach((c) => { if (km(c, TOWN) > km(best, TOWN)) best = c; });
    const prev = d.routeEnd[f.properties.id];
    if (!prev || km(best, TOWN) > km(prev, TOWN)) d.routeEnd[f.properties.id] = best;
  });
  // spatial hash for the ecology probe
  const cell = 0.002, key = (x, y) => Math.floor(x / cell) + ':' + Math.floor(y / cell);
  const grid = { cell, tree: new Map(), bld: new Map(), water: new Map() };
  const put = (m, x, y, v) => { const k = key(x, y); (m.get(k) || m.set(k, []).get(k)).push(v); };
  d.veg.forEach((t) => put(grid.tree, t[0], t[1], t));
  d.buildings.features.forEach((f) => { const c = f.geometry.coordinates[0][0]; put(grid.bld, c[0], c[1], c); });
  d.water.features.forEach((f) => {
    const ls = f.geometry.type === 'LineString' ? [f.geometry.coordinates] : f.geometry.coordinates;
    ls.forEach((l) => { for (let i = 0; i < l.length - 1; i++) { const a = l[i], b = l[i + 1], n = Math.max(1, Math.ceil(km(a, b) * 1000 / 25)); for (let j = 0; j <= n; j++) { const x = a[0] + (b[0] - a[0]) * j / n, y = a[1] + (b[1] - a[1]) * j / n; put(grid.water, x, y, [x, y, f.properties.k]); } } });
  });
  d.grid = grid;
}
export function near(kind, lon, lat, rM) {
  const g = M.d.grid, r = Math.ceil(rM / (g.cell * KY)), cx = Math.floor(lon / g.cell), cy = Math.floor(lat / g.cell), out = [];
  for (let i = -r; i <= r; i++) for (let j = -r; j <= r; j++) { const a = g[kind].get((cx + i) + ':' + (cy + j)); if (a) for (const p of a) { const dd = Math.hypot((p[0] - lon) * KX, (p[1] - lat) * KY); if (dd <= rM) out.push([dd, p]); } }
  return out;
}
export function elevAt(lon, lat) {
  const { bbox: [x0, y0, x1, y1], nx, ny, z } = M.d.dem;
  const fx = (lon - x0) / (x1 - x0) * (nx - 1), fy = (lat - y0) / (y1 - y0) * (ny - 1);
  if (fx < 0 || fy < 0 || fx > nx - 1 || fy > ny - 1) return null;
  const i = Math.min(nx - 2, Math.floor(fx)), j = Math.min(ny - 2, Math.floor(fy)), u = fx - i, v = fy - j;
  const a = z[j * nx + i], b = z[j * nx + i + 1], c = z[(j + 1) * nx + i], e = z[(j + 1) * nx + i + 1];
  return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + e * u * v;
}
function inBoundary(lon, lat) {
  const r = M.d.boundaryRing; let inside = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const xi = r[i][0], yi = r[i][1], xj = r[j][0], yj = r[j][1];
    if ((yi > lat) !== (yj > lat) && lon < (xj - xi) * (lat - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// ------------------------------------------------------------------ generated geometry
function poly(lon, lat, r, n, rot = 0) {
  const o = [];
  for (let i = 0; i <= n; i++) { const a = rot + i / n * Math.PI * 2; o.push([+(lon + Math.cos(a) * r / KX).toFixed(6), +(lat + Math.sin(a) * r / KY).toFixed(6)]); }
  return o;
}
// A tree = trunk + two stacked canopy tiers, drawn as extrusions. k = symbol scale.
function tree(lon, lat, s, k, extra) {
  const R = 4.2 * s * k, H = 9 * s * k, rot = (lon * 1e5) % 1;
  const f = (ringC, b, h, t) => ({ type: 'Feature', properties: { b, h, t, ...extra }, geometry: { type: 'Polygon', coordinates: [ringC] } });
  return [f(poly(lon, lat, R * .16, 5, rot), 0, H * .42, 0), f(poly(lon, lat, R, 7, rot), H * .34, H * .72, 1), f(poly(lon, lat, R * .62, 6, rot + .5), H * .72, H, 2)];
}
function buildTrees() {
  const feats = [], forest = [];
  M.d.veg.forEach((t) => feats.push(...tree(t[0], t[1], t[2], 2.2, {})));
  // the "long forest": canopy standing where the town will later be built, felled epoch by epoch
  let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  M.d.buildings.features.forEach((f, i) => {
    if (i % 3) return;
    const c = f.geometry.coordinates[0][0], e = f.properties.e;
    forest.push(...tree(c[0] + (rnd() - .5) * 2e-4, c[1] + (rnd() - .5) * 2e-4, .8 + rnd() * .7, 2.2, { e }));
  });
  return { veg: fc(feats), forest: fc(forest) };
}
const fc = (features) => ({ type: 'FeatureCollection', features });
function circle(c, rKm, n = 96) { return { type: 'Feature', properties: { r: rKm }, geometry: { type: 'LineString', coordinates: poly(c[0], c[1], rKm * 1000, n) } }; }

function tintCanvas(relief = false) {
  const { nx, ny, z, bbox } = M.d.dem, cv = document.createElement('canvas'); cv.width = nx; cv.height = ny;
  const ctx = cv.getContext('2d'), im = ctx.createImageData(nx, ny);
  const stops = relief ? [[40, [214, 226, 246]], [90, [240, 244, 252]], [215, [255, 255, 255]]] : [[40, [196, 219, 250]], [75, [236, 243, 253]], [105, [255, 252, 240]], [140, [248, 224, 170]], [175, [240, 178, 110]], [215, [226, 120, 70]]];
  const col = (e) => { for (let i = 0; i < stops.length - 1; i++) { const [a, ca] = stops[i], [b, cb] = stops[i + 1]; if (e <= b || i === stops.length - 2) { const t = Math.max(0, Math.min(1, (e - a) / (b - a))); return ca.map((v, k) => v + (cb[k] - v) * t); } } };
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const e = z[j * nx + i], ex = z[j * nx + Math.min(nx - 1, i + 1)] - z[j * nx + Math.max(0, i - 1)], ey = z[Math.min(ny - 1, j + 1) * nx + i] - z[Math.max(0, j - 1) * nx + i];
    const sh = relief ? Math.max(.86, Math.min(1.04, 1 + (-ex + ey) * 0.007)) : Math.max(.72, Math.min(1.12, 1 + (-ex + ey) * 0.012)), c = col(e), o = ((ny - 1 - j) * nx + i) * 4;
    im.data[o] = c[0] * sh; im.data[o + 1] = c[1] * sh; im.data[o + 2] = c[2] * sh; im.data[o + 3] = 255;
  }
  ctx.putImageData(im, 0, 0);
  const S = 5, out = document.createElement('canvas'); out.width = nx * S; out.height = ny * S;
  const o = out.getContext('2d'); o.imageSmoothingQuality = 'high'; o.drawImage(cv, 0, 0, out.width, out.height);
  o.globalCompositeOperation = 'destination-in'; o.filter = 'blur(3px)'; o.beginPath();
  M.d.boundaryRing.forEach((c, i) => { const x = (c[0] - bbox[0]) / (bbox[2] - bbox[0]) * out.width, y = (1 - (c[1] - bbox[1]) / (bbox[3] - bbox[1])) * out.height; i ? o.lineTo(x, y) : o.moveTo(x, y); });
  o.closePath(); o.fill();
  return { url: out.toDataURL(), coords: [[bbox[0], bbox[3]], [bbox[2], bbox[3]], [bbox[2], bbox[1]], [bbox[0], bbox[1]]] };
}

// ------------------------------------------------------------------ map
const T = (ms = 700) => ({ duration: ms, delay: 0 });
const L = {};        // layer id -> { prop: onValue }
function add(layer, group, before) {
  const type = layer.type, pp = layer.paint || (layer.paint = {});
  const props = { line: ['line-opacity'], fill: ['fill-opacity'], 'fill-extrusion': ['fill-extrusion-opacity'], circle: ['circle-opacity', 'circle-stroke-opacity'], symbol: ['text-opacity'], raster: ['raster-opacity'] }[type];
  L[layer.id] = { group, type, on: {} };
  props.forEach((p) => { L[layer.id].on[p] = pp[p] ?? 1; pp[p] = 0; pp[p + '-transition'] = T(); });
  layer.layout = { ...(layer.layout || {}), visibility: 'none' };
  M.map.addLayer(layer, before);
}
const timers = {};
export function show(group, on = true, k = 1) {
  const m = M.map;
  Object.entries(L).forEach(([id, l]) => {
    if (l.group !== group) return;
    clearTimeout(timers[id]);
    if (on) { m.setLayoutProperty(id, 'visibility', 'visible'); requestAnimationFrame(() => Object.entries(l.on).forEach(([p, v]) => m.setPaintProperty(id, p, typeof v === 'number' ? v * k : v))); }
    else { Object.keys(l.on).forEach((p) => m.setPaintProperty(id, p, 0)); timers[id] = setTimeout(() => m.setLayoutProperty(id, 'visibility', 'none'), 760); }
  });
  on ? M.on.add(group) : M.on.delete(group);
}
export function scene(groups, opts = {}) {
  const want = new Map(groups.map((g) => (Array.isArray(g) ? g : [g, 1])));
  new Set(Object.values(L).map((l) => l.group)).forEach((g) => { if (g.startsWith('bld')) return; want.has(g) ? show(g, true, want.get(g)) : (M.on.has(g) && show(g, false)); });
  buildings(opts.era ?? -1, opts.mode || 'plain', opts.bldOp ?? .92);
}
export function fly(cam, dur = 2600) {
  if (skipper.on) { M.map.jumpTo({ padding: PAD(), ...cam }); return Promise.resolve(); }
  return new Promise((res) => { M.map.once('moveend', res); M.map.flyTo({ padding: PAD(), ...cam, duration: dur, essential: true, curve: 1.3, easing: ease.io }); setTimeout(res, dur + 400); });
}
const PAD = () => (innerWidth > 1000 ? { left: 400, right: 350, top: 70, bottom: 110 } : { left: 0, right: 0, top: 200, bottom: 100 });
export function fit(bounds, opt = {}) { M.map.fitBounds(bounds, { padding: { top: 120, bottom: 160, left: 440, right: 400 }, duration: 2200, essential: true, ...opt }); }

// buildings: five epoch layers whose heights are grown / felled
let bldMode = '';
export function buildings(maxEra, mode = 'plain', op = .92) {
  const m = M.map;
  for (let k = 0; k < 5; k++) {
    const id = 'bld-' + k, want = k <= maxEra ? 1 : 0;
    if (mode !== bldMode) m.setPaintProperty(id, 'fill-extrusion-color', mode === 'era' ? ERA[k].c : '#DCE6F8');
    clearTimeout(timers[id]);
    if (want) { m.setLayoutProperty(id, 'visibility', 'visible'); m.setPaintProperty(id, 'fill-extrusion-opacity', op); }
    if (M.f[k] !== want) {
      const from = M.f[k]; M.f[k] = want; let last = 0;
      tween(want ? 1500 : 600, (e, t) => {
        if (t < 1 && performance.now() - last < 40) return; last = performance.now();
        const f = from + (want - from) * e;
        m.setPaintProperty(id, 'fill-extrusion-height', ['*', ['get', 'h'], f * EX]);
        if (t === 1 && !want) { m.setPaintProperty(id, 'fill-extrusion-opacity', 0); m.setLayoutProperty(id, 'visibility', 'none'); }
      }, ease.out);
    }
  }
  bldMode = mode;
}

export function marker(c, html, cls = '', onClick) {
  const el = document.createElement('div'); el.className = 'mk ' + cls; el.innerHTML = html;
  if (onClick) { el.style.cursor = 'pointer'; el.addEventListener('click', onClick); el.dataset.cursor = 'Open'; el.style.pointerEvents = 'auto'; }
  const mk = new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat(c).addTo(M.map);
  M.markers.push(mk); return mk;
}
export function clearMarkers() { M.markers.forEach((m) => m.remove()); M.markers = []; }
function on(ev, layer, fn) { if (typeof layer === 'function') { M.map.on(ev, layer); M.handlers.push([ev, null, layer]); } else { M.map.on(ev, layer, fn); M.handlers.push([ev, layer, fn]); } }
export function clearHandlers() { M.handlers.forEach(([e, l, f]) => (l ? M.map.off(e, l, f) : M.map.off(e, f))); M.handlers = []; M.tick.clear(); tip(null); cursorMode(null); $('#probe').hidden = true; }

export async function initMap() {
  const d = M.d;
  const map = M.map = new maplibregl.Map({
    container: 'map', center: [77.01, 8.61], zoom: 12.6, pitch: 62, bearing: -28, maxPitch: 78, antialias: true,
    attributionControl: false,
    style: { version: 8, glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
      sources: { carto: { type: 'raster', tileSize: 256, maxzoom: 19, attribution: '© OpenStreetMap contributors © CARTO',
        tiles: ['a', 'b', 'c'].map((s) => `https://${s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}@2x.png`) } },
      layers: [{ id: 'bg', type: 'background', paint: { 'background-color': C.paper } },
        { id: 'carto', type: 'raster', source: 'carto', paint: { 'raster-opacity': .5, 'raster-saturation': -1, 'raster-contrast': .08, 'raster-opacity-transition': T(900) } }] },
  });
  map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');
  window.__map = map;
  await new Promise((r) => map.on('load', r));
  const src = (id, data, o = {}) => map.addSource(id, { type: 'geojson', data, ...o });
  const world = [[-180, -85], [180, -85], [180, 85], [-180, 85], [-180, -85]];
  src('outside', { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [world, d.boundaryRing] } });
  ['boundary', 'taluk', 'tvm_district', 'kerala', 'india', 'chantha', 'contours', 'water', 'water_poly', 'bridges', 'routes'].forEach((k) => src(k, d[k]));
  src('wards', d.wards, { generateId: true }); src('roads', d.roads, { generateId: true });
  src('junctions', d.junctions, { generateId: true }); src('busstops', d.busstops);
  src('buildings', d.buildings);
  const tr = buildTrees(); src('veg', tr.veg); src('forest', tr.forest);
  const tint = tintCanvas(); map.addSource('tint', { type: 'image', url: tint.url, coordinates: tint.coords });
  const rel = tintCanvas(true); map.addSource('relief', { type: 'image', url: rel.url, coordinates: rel.coords });
  src('stretch', { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [[[STRETCH.w, STRETCH.s], [STRETCH.e, STRETCH.s], [STRETCH.e, STRETCH.n], [STRETCH.w, STRETCH.n], [STRETCH.w, STRETCH.s]]] } });
  src('rings', fc([])); src('focus', fc([]));

  // region
  add({ id: 'india-line', type: 'line', source: 'india', paint: { 'line-color': C.ink, 'line-width': 1, 'line-opacity': .55 } }, 'region');
  add({ id: 'kerala-fill', type: 'fill', source: 'kerala', paint: { 'fill-color': C.blue, 'fill-opacity': .13 } }, 'region');
  add({ id: 'kerala-line', type: 'line', source: 'kerala', paint: { 'line-color': C.blue, 'line-width': 1.6 } }, 'region');
  add({ id: 'district-fill', type: 'fill', source: 'tvm_district', paint: { 'fill-color': C.blue, 'fill-opacity': .12 } }, 'region');
  add({ id: 'district-line', type: 'line', source: 'tvm_district', paint: { 'line-color': C.ink, 'line-width': 1.6 } }, 'region');
  add({ id: 'taluk-line', type: 'line', source: 'taluk', paint: { 'line-color': C.ink, 'line-width': 1.4, 'line-dasharray': [3, 2], 'line-opacity': .8 } }, 'taluk');
  // municipality
  add({ id: 'outside', type: 'fill', source: 'outside', paint: { 'fill-color': C.paper, 'fill-opacity': .62 } }, 'base');
  add({ id: 'relief', type: 'raster', source: 'relief', paint: { 'raster-opacity': ['interpolate', ['linear'], ['zoom'], 12.5, .8, 15, .25], 'raster-fade-duration': 0 } }, 'base');
  add({ id: 'tint', type: 'raster', source: 'tint', paint: { 'raster-opacity': .92, 'raster-fade-duration': 0 } }, 'tint');
  add({ id: 'contours', type: 'line', source: 'contours', filter: ['==', ['get', 'i'], 0], paint: { 'line-color': '#8A5A2B', 'line-width': .8, 'line-opacity': .7 } }, 'contours');
  add({ id: 'contours-idx', type: 'line', source: 'contours', filter: ['==', ['get', 'i'], 1], paint: { 'line-color': '#6B3F18', 'line-width': 1.5, 'line-opacity': .9 } }, 'contours');
  add({ id: 'contour-lbl', type: 'symbol', source: 'contours', filter: ['==', ['get', 'i'], 1], layout: { 'symbol-placement': 'line', 'text-field': ['concat', ['to-string', ['get', 'e']], ' m'], 'text-font': ['Noto Sans Regular'], 'text-size': 10, 'symbol-spacing': 420 }, paint: { 'text-color': '#6B3F18', 'text-halo-color': '#fff', 'text-halo-width': 1.6 } }, 'contours');
  add({ id: 'wards-fill', type: 'fill', source: 'wards', paint: { 'fill-color': ['case', ['boolean', ['feature-state', 'hover'], false], C.hot, C.blue], 'fill-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], .35, ['interpolate', ['linear'], ['get', 'ha'], 30, .04, 160, .26]] } }, 'wards');
  add({ id: 'wards-line', type: 'line', source: 'wards', paint: { 'line-color': C.ink, 'line-width': .9, 'line-opacity': .7 } }, 'wards');
  add({ id: 'ward-lbl', type: 'symbol', source: 'wards', minzoom: 12.2, layout: { 'text-field': ['get', 'no'], 'text-font': ['Noto Sans Regular'], 'text-size': 11 }, paint: { 'text-color': C.ink, 'text-halo-color': '#fff', 'text-halo-width': 1.5 } }, 'wards');
  add({ id: 'chantha-fill', type: 'fill', source: 'chantha', paint: { 'fill-color': C.amber, 'fill-opacity': .4 } }, 'chantha');
  add({ id: 'chantha-line', type: 'line', source: 'chantha', paint: { 'line-color': C.amber, 'line-width': 2.5 } }, 'chantha');
  // watercourses: polygons whose width grows downstream (true metres), plus a centreline that keeps them legible when zoomed out
  const MW = (w, fl) => ['interpolate', ['exponential', 2], ['zoom'], 10, ['+', fl, ['*', w, 0.00662]], 20, ['+', fl, ['*', w, 6.776]]];
  add({ id: 'water', type: 'line', source: 'water', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': C.water, 'line-width': MW(['get', 'w'], ['match', ['get', 'k'], 'river', 2.4, 'canal', 1.3, .9]), 'line-opacity': ['interpolate', ['linear'], ['zoom'], 14.2, 1, 15.6, 0] } }, 'water');
  add({ id: 'water-bank', type: 'line', source: 'water_poly', minzoom: 13.4, layout: { 'line-join': 'round' }, paint: { 'line-color': '#2C6FD1', 'line-width': ['interpolate', ['linear'], ['zoom'], 13.4, 1.6, 17, 3.2], 'line-opacity': ['interpolate', ['linear'], ['zoom'], 13.4, 0, 14.6, .9] } }, 'water');
  add({ id: 'water-fill', type: 'fill', source: 'water_poly', minzoom: 13.4, paint: { 'fill-color': ['match', ['get', 'k'], 'river', '#5FA8F5', 'canal', '#8CC4F7', '#79B8F6'], 'fill-opacity': ['interpolate', ['linear'], ['zoom'], 13.4, 0, 14.6, 1], 'fill-antialias': true } }, 'water');
  add({ id: 'water-flow', type: 'line', source: 'water', paint: { 'line-color': '#fff', 'line-width': MW(['*', ['get', 'w'], .22], ['match', ['get', 'k'], 'river', 1.2, .7]), 'line-dasharray': [0, 4, 3], 'line-opacity': .9 } }, 'flow');
  // roads
  // road widths are the carriageway in metres (SH 10, MDR 7.5, municipal 5.5, local 3.6) plus a small floor so the hierarchy reads at town scale
  const RWm = ['match', ['get', 'c'], 'sh', 10, 'prop', 10, 'mdr', 7.5, 'mun', 5.5, 3.6], RFl = ['match', ['get', 'c'], 'sh', 2.9, 'prop', 2.9, 'mdr', 2.1, 'mun', 1.35, .7];
  const width = (k = 1, extra = 0) => ['interpolate', ['exponential', 2], ['zoom'], 10, ['+', extra, ['*', k, ['+', RFl, ['*', RWm, 0.00662]]]], 20, ['+', extra, ['*', k, ['+', RFl, ['*', RWm, 6.776]]]]];
  const col = ['match', ['get', 'c'], 'sh', C.ink, 'mdr', C.blue, 'mun', C.blue2, 'loc', '#9DB6EA', C.hot];
  const notProp = ['!=', ['get', 'c'], 'prop'];
  add({ id: 'roads-case', type: 'line', source: 'roads', filter: notProp, layout: { 'line-cap': 'round', 'line-join': 'round', 'line-sort-key': ['get', 'r'] }, paint: { 'line-color': '#fff', 'line-width': width(1, 2.2), 'line-opacity': .95 } }, 'roads');
  add({ id: 'roads', type: 'line', source: 'roads', filter: notProp, layout: { 'line-cap': 'round', 'line-join': 'round', 'line-sort-key': ['get', 'r'] }, paint: { 'line-color': col, 'line-width': width(1) } }, 'roads');
  add({ id: 'roads-hl', type: 'line', source: 'roads', filter: ['==', ['get', 'n'], '__'], layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': C.hot, 'line-width': width(1.25, 1.5) } }, 'roads');
  add({ id: 'trails', type: 'line', source: 'roads', filter: ['in', ['get', 'c'], ['literal', ['sh', 'mdr']]], layout: { 'line-cap': 'round' }, paint: { 'line-color': '#7A4E22', 'line-width': 1.6, 'line-dasharray': [.6, 2.2], 'line-opacity': .9 } }, 'trails');
  add({ id: 'roads-sh', type: 'line', source: 'roads', filter: ['==', ['get', 'c'], 'sh'], layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': C.ink, 'line-width': width(1.2, .6) } }, 'shonly');
  add({ id: 'orr', type: 'line', source: 'roads', filter: ['==', ['get', 'c'], 'prop'], paint: { 'line-color': C.hot, 'line-width': 3, 'line-dasharray': [2.2, 1.6] } }, 'orr');
  add({ id: 'routes-case', type: 'line', source: 'routes', filter: ['==', ['get', 'id'], '__'], layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#fff', 'line-width': 8, 'line-opacity': .9 } }, 'routes');
  add({ id: 'routes', type: 'line', source: 'routes', filter: ['==', ['get', 'id'], '__'], layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': C.hot, 'line-width': 4.2 } }, 'routes');
  add({ id: 'routes-flow', type: 'line', source: 'routes', filter: ['==', ['get', 'id'], '__'], paint: { 'line-color': '#fff', 'line-width': 1.6, 'line-dasharray': [0, 4, 3] } }, 'routes');
  add({ id: 'rings', type: 'line', source: 'rings', paint: { 'line-color': C.blue, 'line-width': 1.2, 'line-dasharray': [3, 3], 'line-opacity': .8 } }, 'rings');
  add({ id: 'focus', type: 'line', source: 'focus', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': C.hot, 'line-width': 5, 'line-opacity': .95 } }, 'focus');
  // stretch frame
  add({ id: 'stretch-fill', type: 'fill', source: 'stretch', paint: { 'fill-color': C.hot, 'fill-opacity': .1 } }, 'stretch');
  add({ id: 'stretch-line', type: 'line', source: 'stretch', paint: { 'line-color': C.hot, 'line-width': 2.4, 'line-dasharray': [2, 1.4] } }, 'stretch');
  // 3D
  add({ id: 'bridges', type: 'fill-extrusion', source: 'bridges', minzoom: 13.2, paint: { 'fill-extrusion-color': ['match', ['get', 't'], 'deck', '#33456F', 'rail', '#FFFFFF', '#B9C9EA'],
    'fill-extrusion-base': ['match', ['get', 't'], 'deck', 3.2 * EX, 'rail', 3.9 * EX, 0], 'fill-extrusion-height': ['match', ['get', 't'], 'deck', 3.9 * EX, 'rail', 4.9 * EX, 3.2 * EX], 'fill-extrusion-opacity': .96 } }, 'water');
  add({ id: 'forest', type: 'fill-extrusion', source: 'forest', paint: { 'fill-extrusion-color': ['match', ['get', 't'], 0, '#6B4A2B', 1, '#2E8B63', '#4FB286'], 'fill-extrusion-base': ['get', 'b'], 'fill-extrusion-height': ['get', 'h'], 'fill-extrusion-opacity': .95 } }, 'forest');
  add({ id: 'veg', type: 'fill-extrusion', source: 'veg', paint: { 'fill-extrusion-color': ['match', ['get', 't'], 0, '#6B4A2B', 1, '#1FA37A', '#5CC79F'], 'fill-extrusion-base': ['get', 'b'], 'fill-extrusion-height': ['get', 'h'], 'fill-extrusion-opacity': .95 } }, 'veg');
  for (let k = 0; k < 5; k++) {
    add({ id: 'bld-' + k, type: 'fill-extrusion', source: 'buildings', filter: ['==', ['get', 'e'], k], paint: { 'fill-extrusion-color': '#DCE6F8', 'fill-extrusion-height': 0, 'fill-extrusion-opacity': .92, 'fill-extrusion-vertical-gradient': true } }, 'bld' + k);
  }
  map.setLight({ anchor: 'viewport', position: [1.4, 215, 38], intensity: .42, color: '#ffffff' });
  // nodes
  add({ id: 'busstops', type: 'circle', source: 'busstops', paint: { 'circle-radius': ['match', ['get', 'k'], 'stand', 8, 3.2], 'circle-color': ['match', ['get', 'k'], 'stand', C.green, '#fff'], 'circle-stroke-color': C.green, 'circle-stroke-width': 1.6 } }, 'nodes');
  add({ id: 'junctions', type: 'circle', source: 'junctions', paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 11, 4, 15, 9], 'circle-color': ['case', ['boolean', ['feature-state', 'hover'], false], C.ink, C.hot], 'circle-stroke-color': '#fff', 'circle-stroke-width': 2.2 } }, 'nodes');
  add({ id: 'boundary-glow', type: 'line', source: 'boundary', paint: { 'line-color': C.blue, 'line-width': 9, 'line-blur': 7, 'line-opacity': .35 } }, 'base');
  add({ id: 'boundary-line', type: 'line', source: 'boundary', paint: { 'line-color': C.ink, 'line-width': 1.8 } }, 'base');

  // dash animation shared by "flow" layers
  const seq = [[0, 4, 3], [.5, 4, 2.5], [1, 4, 2], [1.5, 4, 1.5], [2, 4, 1], [2.5, 4, .5], [3, 4, 0], [0, .5, 3, 3.5], [0, 1, 3, 3], [0, 1.5, 3, 2.5], [0, 2, 3, 2], [0, 2.5, 3, 1.5], [0, 3, 3, 1], [0, 3.5, 3, .5]];
  let step = 0, lastT = 0;
  (function loop(t) {
    if (t - lastT > 70) { lastT = t; step = (step + 1) % seq.length;
      if (M.on.has('flow')) map.setPaintProperty('water-flow', 'line-dasharray', seq[step]);
      if (M.on.has('routes')) map.setPaintProperty('routes-flow', 'line-dasharray', seq[step]); }
    M.tick.forEach((fn) => fn(t));
    requestAnimationFrame(loop);
  })(0);
  buildKeymap();
  return map;
}

// ------------------------------------------------------------------ key map (location base map)
// District > taluk > municipality, with the live view position, north and a scale bar.
function buildKeymap() {
  const el = $('#keymap'), d = M.d, W = 156, H = 150;
  const rings = (fc2) => fc2.features.flatMap((f) => (f.geometry.type === 'MultiPolygon' ? f.geometry.coordinates.map((p) => p[0]) : [f.geometry.coordinates[0]]));
  const fitTo = (rs, x, y, w, h) => { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; rs.forEach((r) => r.forEach((c) => { x0 = Math.min(x0, c[0]); x1 = Math.max(x1, c[0]); y0 = Math.min(y0, c[1]); y1 = Math.max(y1, c[1]); }));
    const k = Math.min(w / ((x1 - x0) * KX), h / ((y1 - y0) * KY)), ox = x + (w - (x1 - x0) * KX * k) / 2, oy = y + (h - (y1 - y0) * KY * k) / 2;
    return (c) => [ox + (c[0] - x0) * KX * k, oy + (y1 - c[1]) * KY * k]; };
  const path = (rs, P) => rs.map((r) => r.map((c, i) => (i ? 'L' : 'M') + P(c).map((v) => v.toFixed(1)).join(' ')).join('') + 'Z').join('');
  const dist = rings(d.tvm_district), ker = rings(d.kerala), P = fitTo(dist, 34, 4, W - 38, H - 8), PK = fitTo(ker, 2, 4, 34, 84);
  el.innerHTML = `<div class="km-t"><span>Location</span><span id="km-z"></span></div>
    <svg viewBox="0 0 ${W} ${H}"><path d="${path(ker, PK)}" fill="#DCE6F8" stroke="${C.ink}" stroke-width=".5"/><path d="${path(dist, PK)}" fill="${C.blue}"/>
    <text x="3" y="100" font-size="6.5" font-family="IBM Plex Mono" fill="${C.ink}">Kerala</text>
    <path d="${path(dist, P)}" fill="#EEF3FC" stroke="${C.ink}" stroke-width=".8"/><path d="${path(rings(d.taluk), P)}" fill="${C.blue}" fill-opacity=".16" stroke="${C.blue}" stroke-width=".7" stroke-dasharray="2 1.5"/>
    <path d="${path([d.boundaryRing], P)}" fill="${C.hot}" stroke="${C.hot}" stroke-width=".6"/>
    <text x="${W - 2}" y="${H - 20}" text-anchor="end" font-size="6.5" font-family="IBM Plex Mono" fill="${C.ink}">Thiruvananthapuram dist.</text>
    <text x="${W - 2}" y="${H - 11}" text-anchor="end" font-size="6.5" font-family="IBM Plex Mono" fill="${C.blue}">Nedumangad taluk</text>
    <text x="${W - 2}" y="${H - 2}" text-anchor="end" font-size="6.5" font-weight="600" font-family="IBM Plex Mono" fill="${C.hot}">Municipality</text>
    <g id="km-v"><circle r="7" fill="none" stroke="${C.ink}" stroke-width="1.2"/><circle r="1.6" fill="${C.ink}"/></g></svg>
    <div class="km-s"><i id="km-bar"></i><span id="km-len"></span><span class="km-n" id="km-n">N ↑</span></div>`;
  el.hidden = false;
  const v = $('#km-v'), bar = $('#km-bar'), len = $('#km-len'), nn = $('#km-n'), zz = $('#km-z');
  const upd = () => { const c = M.map.getCenter(), q = P([c.lng, c.lat]); v.setAttribute('transform', `translate(${Math.max(4, Math.min(W - 4, q[0])).toFixed(1)},${Math.max(4, Math.min(H - 4, q[1])).toFixed(1)})`);
    const mpp = 40075016.7 * Math.cos(c.lat * Math.PI / 180) / (512 * Math.pow(2, M.map.getZoom())), nice = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000, 200000, 500000].filter((n) => n / mpp <= 70).pop() || 10;
    bar.style.width = (nice / mpp).toFixed(0) + 'px'; len.textContent = nice >= 1000 ? nice / 1000 + ' km' : nice + ' m';
    nn.style.transform = `rotate(${-M.map.getBearing()}deg)`; nn.style.display = 'inline-block'; zz.textContent = 'z ' + M.map.getZoom().toFixed(1); };
  M.map.on('move', upd); upd();
}

// ------------------------------------------------------------------ hero + locate
let drift = null;
export function heroEnter() {
  scene(['base', ['roads', .9], 'water', 'veg'], { era: 4, mode: 'plain' });
  M.map.setPaintProperty('carto', 'raster-opacity', .35);
  M.map.jumpTo({ center: TOWN, zoom: 14.9, pitch: 66, bearing: -30, padding: { left: innerWidth * .38, right: 0, top: 0, bottom: 0 } });
  let b = -30; const bx = { v: 0 }, py = { v: 0 };
  drift = () => { b += 0.022; bx.v += (mouse.nx * 9 - bx.v) * .04; py.v += (mouse.ny * 5 - py.v) * .04; M.map.jumpTo({ bearing: b + bx.v, pitch: 66 - py.v }); };
  M.tick.add(drift);
}
export async function locate() {
  M.tick.delete(drift);
  const loc = $('#locator'), k = $('#locator-k'), t = $('#locator-t');
  const say = async (kk, tt, ms) => { k.textContent = kk; t.textContent = tt; loc.classList.add('on'); await wait(ms); loc.classList.remove('on'); await wait(350); };
  scene(['region']); M.map.setPaintProperty('carto', 'raster-opacity', .7);
  M.map.jumpTo({ center: [79.5, 21], zoom: 3.5, pitch: 0, bearing: 0, padding: { left: 0, right: 0, top: 0, bottom: 0 } });
  const steps = [['India', 'South-west coast', { center: [76.6, 10.4], zoom: 6.3 }], ['State', 'Kerala', { center: [76.95, 8.62], zoom: 9.1 }], ['District', 'Thiruvananthapuram', { center: [77.04, 8.64], zoom: 10.7, pitch: 20 }], ['Taluk · Municipality', 'Nedumangad', { center: CENTER, zoom: 12.6, pitch: 46, bearing: -18 }]];
  await say('00 · Locate', 'India', 900);
  for (let i = 0; i < steps.length; i++) {
    const [a, b2, cam] = steps[i];
    if (i === 2) show('taluk'); if (i === 3) { show('base'); show('roads', true, .8); buildings(4, 'plain'); }
    const p = fly({ padding: { left: 0, right: 0, top: 0, bottom: 0 }, ...cam }, 2100); await wait(700); await say(a, b2, 1200); await p;
  }
  show('region', false); show('taluk', false);
}

// ------------------------------------------------------------------ 01 network
export const chNetwork = {
  id: 'network', num: '01', title: 'Network & Junctions', short: 'Network',
  desc: 'Road hierarchy, named junctions, bus stand and stops.',
  enter() {
    const s = M.d.stats, m = M.map;
    scene(['base', 'roads', 'nodes', ['water', .5]], { era: 4, mode: 'plain', bldOp: .55 });
    m.setPaintProperty('carto', 'raster-opacity', .45);
    fly({ center: CENTER, zoom: 12.9, pitch: 38, bearing: -12 });
    const total = s.road_km.sh + s.road_km.mdr + s.road_km.mun + s.road_km.loc;
    dock('left', card(`<div class="kicker">Chapter 01</div><h2>Network &amp; Junctions</h2>
      <p class="lede">A town built on a crossing. Two highway axes and a web of district roads pull in toward a single core — sixteen named junctions carry the load.</p>
      <div class="stats"><div class="stat"><b id="n-km">0</b><span>km of road mapped</span></div><div class="stat"><b>${M.d.junctions.features.length}</b><span>named junctions</span></div>
      <div class="stat"><b>${M.d.busstops.features.length - 1}</b><span>bus stops + 1 stand</span></div><div class="stat"><b>${fmt(s.road_km.prop, 1)}<small>km</small></b><span>ring road proposed</span></div></div>`) +
      card(`<div class="kicker">Hierarchy — click to isolate</div><div class="legend" id="rc">
      ${['sh', 'mdr', 'mun', 'loc'].map((k) => `<button class="lg" data-c="${k}"><i style="--c:${ROAD_CLASS[k].color}"></i>${ROAD_CLASS[k].name}<em>${fmt(s.road_km[k], 1)} km</em></button>`).join('')}
      <button class="lg off" data-c="prop"><i class="dash" style="--c:${C.hot}"></i>Proposed Outer Ring Road<em>toggle</em></button>
      <div class="lg"><i class="dot" style="--c:${C.hot}"></i>Junction<i class="dot" style="--c:${C.green};margin-left:14px"></i>Bus stop / stand</div></div>
      <span class="src">Lengths cover the mapped network, which extends beyond the municipal boundary.</span>`), '');
    countUp($('#n-km'), total, 1600, 1);
    dock('right', card(`<div class="kicker">Junction index</div><div class="list" id="jl">${M.d.junctions.features.map((f, i) => `<button class="row" data-i="${i}"><span class="n">${String(i + 1).padStart(2, '0')}</span>${f.properties.n}</button>`).join('')}</div>`, 'scroll'));
    const active = new Set(['sh', 'mdr', 'mun', 'loc']);
    $$('#rc button').forEach((b) => b.onclick = () => {
      const c = b.dataset.c;
      if (c === 'prop') { const o = b.classList.toggle('off'); show('orr', !o); if (!o) fly({ center: [77.0, 8.6], zoom: 11.3, pitch: 30, bearing: 0 }, 1800); return; }
      active.has(c) ? active.delete(c) : active.add(c); b.classList.toggle('off', !active.has(c));
      const f = ['in', ['get', 'c'], ['literal', [...active]]]; m.setFilter('roads', f); m.setFilter('roads-case', f);
    });
    const openJ = (i, flyTo) => {
      const f = M.d.junctions.features[i], p = f.properties;
      $$('#jl .row').forEach((r, k) => r.classList.toggle('on', k === i));
      if (flyTo) fly({ center: f.geometry.coordinates, zoom: 16.2, pitch: 58, bearing: (i * 37) % 80 - 40 }, 2000);
      const rows = [['Leads to', p.leads], ['Why it matters', p.importance], ['Control', p.control], ['Bus', p.bus]].filter((r) => r[1]);
      $('#jd')?.remove();
      $('#right').insertAdjacentHTML('afterbegin', `<div class="card detail" id="jd"><button class="close">×</button><div class="kicker">Junction ${String(i + 1).padStart(2, '0')}</div><h3>${p.n}</h3>${p.ml ? `<p class="small">${p.ml}</p>` : ''}
        <dl class="dl">${rows.length ? rows.map((r) => `<dt>${r[0]}</dt><dd>${r[1]}</dd>`).join('') : '<dt>Notes</dt><dd>No curated note yet — add from the field survey.</dd>'}</dl></div>`);
      $('#jd .close').onclick = () => { $('#jd').remove(); $$('#jl .row').forEach((r) => r.classList.remove('on')); };
    };
    $$('#jl .row').forEach((r) => r.onclick = () => openJ(+r.dataset.i, true));
    let hov = null;
    on('mousemove', 'junctions', (e) => { const f = e.features[0]; if (hov !== null) m.setFeatureState({ source: 'junctions', id: hov }, { hover: false }); hov = f.id; m.setFeatureState({ source: 'junctions', id: hov }, { hover: true }); cursorMode('label', 'Open'); tip(`<b>${f.properties.n}</b><span>Junction</span>`, e.originalEvent.clientX, e.originalEvent.clientY); });
    on('mouseleave', 'junctions', () => { if (hov !== null) m.setFeatureState({ source: 'junctions', id: hov }, { hover: false }); hov = null; cursorMode(null); tip(null); });
    on('click', 'junctions', (e) => openJ(e.features[0].id, true));
    on('mousemove', 'roads', (e) => { if (hov !== null) return; const p = e.features[0].properties; m.setFilter('roads-hl', ['==', ['get', 'n'], p.n || '__']); tip(`<b>${p.n || 'Unnamed road'}</b><span>${ROAD_CLASS[p.c].name}${p.ref ? ' · ' + p.ref : ''}</span>`, e.originalEvent.clientX, e.originalEvent.clientY); });
    on('mouseleave', 'roads', () => { m.setFilter('roads-hl', ['==', ['get', 'n'], '__']); tip(null); });
    on('mousemove', 'busstops', (e) => { const p = e.features[0].properties; tip(`<b>${p.n || 'Bus stop'}</b><span>${p.k === 'stand' ? 'KSRTC bus stand' : 'Bus stop'}</span>`, e.originalEvent.clientX, e.originalEvent.clientY); });
    on('mouseleave', 'busstops', () => tip(null));
  },
  leave() { const m = M.map; show('orr', false); const f = ['!=', ['get', 'c'], 'prop']; m.setFilter('roads', f); m.setFilter('roads-case', f); },
};

// ------------------------------------------------------------------ 02 history
let playing = null;
export const chHistory = {
  id: 'history', num: '02', title: 'Historical Evolution', short: 'History',
  desc: 'From the long forest to the four-lane future — the town grows out of the canopy.',
  enter() {
    this.i = -1;
    M.map.setPaintProperty('carto', 'raster-opacity', .15);
    dock('right', card(`<div class="kicker">Reading the model</div><div class="legend">
      ${ERA.map((e) => `<div class="lg"><i class="sq" style="--c:${e.c}"></i>${e.label}</div>`).join('')}
      <div class="lg"><i class="sq" style="--c:#2E8B63"></i>Forest canopy (felled as the town grows)</div>
      <div class="lg"><i class="dash" style="--c:#7A4E22"></i>Trail / cart track</div>
      <div class="lg"><i style="--c:${C.ink}"></i>Engineered road</div>
      <div class="lg"><i style="--c:${C.water}"></i>Stream</div></div>
      <span class="src">Growth epochs are modelled from distance to the palace and market nuclei — an interpretive reconstruction, not dated survey. Tree symbols are enlarged.</span>`));
    dock('bottom', `<div class="timeline"><div class="tl-head"><div class="tl-year" id="tl-y"></div><div class="tl-title" id="tl-t"></div>
      <button class="tl-play" id="tl-p" data-cursor="Play"><svg width="14" height="14" viewBox="0 0 14 14"><path d="M3 1l9 6-9 6z" fill="currentColor"/></svg></button></div>
      <div class="tl-track" style="--n:${PERIODS.length}"><i class="tl-fill" id="tl-f"></i>${PERIODS.map((p, i) => `<button class="tl-stop" data-i="${i}">${p.years}</button>`).join('')}</div></div>`);
    $$('.tl-stop').forEach((b) => b.onclick = () => { this.stop(); this.pick(+b.dataset.i); });
    $('#tl-p').onclick = () => (playing ? this.stop() : this.play());
    this.pick(0);
  },
  pick(i) {
    const p = PERIODS[i], m = M.map; this.i = i;
    const groups = ['base', 'water', 'forest', ['contours', .5]];
    if (p.roads === 'trail') groups.push('trails'); if (p.roads === 'sh') groups.push('trails', 'shonly'); if (p.roads === 'all') groups.push('roads');
    if (p.market) groups.push('chantha'); if (p.flows) groups.push('routes'); if (p.orr) groups.push('orr'); if (p.era >= 4) groups.push(['veg', 1]);
    scene(groups, { era: p.era, mode: 'era' });
    // fell the forest: canopy survives only where the built epoch has not arrived
    m.setFilter('forest', ['>', ['get', 'e'], p.era]);
    m.setFilter('routes', ['in', ['get', 'id'], ['literal', p.flows ? ['corr_ponmudi', 'corr_thenkasi', 'route_palayam'] : ['__']]]);
    m.setFilter('routes-case', m.getFilter('routes')); m.setFilter('routes-flow', m.getFilter('routes'));
    m.setPaintProperty('routes', 'line-color', '#7A4E22');
    clearMarkers();
    if (i >= 1) marker([77.002896, 8.609251], `<i class="stem"></i><i class="pin" style="--c:${C.rose}"></i><span class="tag">Koyikkal Palace · 1677</span>`, 'lift big');
    if (i >= 2) marker([77.0028, 8.6033], `<i class="stem"></i><i class="pin" style="--c:${C.amber}"></i><span class="tag">Chantha</span>`, 'lift big');
    if (i >= 5) marker([77.0035783, 8.6054656], `<i class="stem"></i><i class="pin" style="--c:${C.green}"></i><span class="tag">Bus stand</span>`, 'lift');
    fly(p.cam, 3000);
    $('#tl-y').textContent = p.years; $('#tl-t').textContent = p.title;
    $('#tl-f').style.width = (i / PERIODS.length * 100) + '%';
    $$('.tl-stop').forEach((b, k) => { b.classList.toggle('on', k === i); b.classList.toggle('past', k < i); });
    const built = M.d.buildings.features.reduce((a, f) => a + (f.properties.e <= p.era ? 1 : 0), 0);
    dock('left', card(`${p.img ? `<div class="figure"><img src="${p.img}" alt=""></div>` : ''}<div class="kicker">Chapter 02 · ${String(i + 1).padStart(2, '0')} / ${String(PERIODS.length).padStart(2, '0')}</div>
      <h2>${p.title}</h2><p class="lede">${p.note}</p>
      <p><b style="color:var(--hot)">What changes —</b> ${p.change}</p>
      <div class="stats"><div class="stat"><b>${fmt(built)}</b><span>footprints standing</span></div><div class="stat"><b>${Math.round(p.forest * 100)}<small>%</small></b><span>of core canopy left</span></div></div>
      ${p.img ? '<span class="src">Image: interpretive reconstruction.</span>' : ''}`, 'scroll'));
  },
  play() {
    const btn = $('#tl-p'); btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 14 14"><path d="M3 1h3v12H3zM8 1h3v12H8z" fill="currentColor"/></svg>';
    if (this.i >= PERIODS.length - 1) this.pick(0);
    playing = setInterval(() => { if (this.i >= PERIODS.length - 1) return this.stop(); this.pick(this.i + 1); }, 6500);
  },
  stop() { clearInterval(playing); playing = null; const b = $('#tl-p'); if (b) b.innerHTML = '<svg width="14" height="14" viewBox="0 0 14 14"><path d="M3 1l9 6-9 6z" fill="currentColor"/></svg>'; },
  leave() { this.stop(); M.map.setFilter('forest', null); M.map.setPaintProperty('routes', 'line-color', C.hot); },
};

// ------------------------------------------------------------------ 03 access
function routeFilter(ids) { const f = ['in', ['get', 'id'], ['literal', ids.length ? ids : ['__']]]; ['routes', 'routes-case', 'routes-flow'].forEach((l) => M.map.setFilter(l, f)); }
function routeBounds(ids) {
  const b = new maplibregl.LngLatBounds();
  M.d.routes.features.forEach((f) => { if (ids.includes(f.properties.id)) (f.geometry.type === 'LineString' ? f.geometry.coordinates : f.geometry.coordinates.flat()).forEach((c) => b.extend(c)); });
  return b;
}
export const chAccess = {
  id: 'access', num: '03', title: 'Access & Transport', short: 'Access',
  desc: 'Travel times to the airport, city markets and landmarks; walking and regional radii.',
  enter() {
    const m = M.map;
    scene(['base', ['roads', .55], 'routes', 'rings', 'nodes'], { era: 4, mode: 'plain', bldOp: .4 });
    m.setPaintProperty('carto', 'raster-opacity', .75);
    m.getSource('rings').setData(fc([5, 10, 20].map((r) => circle(TOWN, r))));
    routeFilter(DESTS.map((d) => 'route_' + d.id)); m.setPaintProperty('routes', 'line-color', C.blue2);
    fly({ center: [76.99, 8.54], zoom: 10.2, pitch: 0, bearing: 0 });
    clearMarkers();
    marker(TOWN, `<i class="pin" style="--c:${C.hot}"></i><span class="tag">Nedumangad</span>`, 'big');
    DESTS.forEach((d) => { const c = M.d.routeEnd['route_' + d.id]; if (c) marker(c, `<i class="pin" style="--c:${DEST_COLOR[d.cat]}"></i><span class="tag">${d.name}</span>`, '', () => pick(d.id)); });
    dock('left', card(`<div class="kicker">Chapter 03</div><h2>Access &amp; Transport</h2>
      <p class="lede">Eighteen kilometres from the capital, on the way to the hills. What the town can reach in half an hour decides what it trades, where it works and who passes through.</p>
      <div class="pills"><button class="pill on" data-r="region">5 · 10 · 20 km</button><button class="pill" data-r="walk">5 · 10 · 15 min walk</button></div>`) +
      card(`<div class="kicker">By road from the town core</div><div class="list" id="dl">${DESTS.map((d) => `<button class="row" data-id="${d.id}"><i class="sw" style="--c:${DEST_COLOR[d.cat]}"></i>${d.name}<em>${d.km} km · ${d.min} min</em></button>`).join('')}</div>
      <span class="src">Driving distance and time from the existing atlas (OpenRouteService), free-flow.</span>`, 'scroll'));
    dock('right', card(`<div class="kicker">Legend</div><div class="legend"><div class="lg"><i class="dot" style="--c:${C.ink}"></i>Transport hub</div><div class="lg"><i class="dot" style="--c:${C.amber}"></i>Market</div><div class="lg"><i class="dot" style="--c:${C.blue}"></i>Landmark / campus</div><div class="lg"><i class="dash" style="--c:${C.blue}"></i>Radius from town core</div></div>`));
    const pick = (id) => {
      const d = DESTS.find((x) => x.id === id);
      $$('#dl .row').forEach((r) => r.classList.toggle('on', r.dataset.id === id));
      routeFilter(['route_' + id]); m.setPaintProperty('routes', 'line-color', C.hot);
      fit(routeBounds(['route_' + id]));
      $('#ad')?.remove();
      $('#right').insertAdjacentHTML('afterbegin', `<div class="card detail" id="ad"><button class="close">×</button>${d.img ? `<img src="${d.img}" alt="">` : ''}<div class="kicker">By road · ${d.cat}</div><h3>${d.name}</h3><p>${d.about}</p>
        <div class="stats"><div class="stat"><b>${d.km}<small>km</small></b><span>distance</span></div><div class="stat"><b>${d.min}<small>min</small></b><span>drive time</span></div></div>
        <div class="bars"><div class="bar-row"><span>Avg. speed</span><div class="tr"><i style="--c:${C.hot}" data-w="${Math.min(100, d.km / d.min * 60 / 60 * 100)}"></i></div><b>${Math.round(d.km / d.min * 60)}</b></div></div></div>`);
      requestAnimationFrame(() => $$('#ad .tr i').forEach((i) => i.style.width = i.dataset.w + '%'));
      $('#ad .close').onclick = () => { $('#ad').remove(); routeFilter(DESTS.map((x) => 'route_' + x.id)); m.setPaintProperty('routes', 'line-color', C.blue2); $$('#dl .row').forEach((r) => r.classList.remove('on')); fly({ center: [76.99, 8.54], zoom: 10.2, pitch: 0, bearing: 0 }, 1800); };
    };
    $$('#dl .row').forEach((r) => r.onclick = () => pick(r.dataset.id));
    $$('.pill[data-r]').forEach((b) => b.onclick = () => {
      $$('.pill[data-r]').forEach((x) => x.classList.toggle('on', x === b));
      const walk = b.dataset.r === 'walk';
      m.getSource('rings').setData(fc((walk ? [.4, .8, 1.2] : [5, 10, 20]).map((r) => circle(TOWN, r))));
      fly(walk ? { center: TOWN, zoom: 14.6, pitch: 30, bearing: 0 } : { center: [76.99, 8.54], zoom: 10.2, pitch: 0, bearing: 0 }, 2000);
    });
  },
  leave() { M.map.setPaintProperty('routes', 'line-color', C.hot); },
};

// ------------------------------------------------------------------ 04 wards & region
export const chWards = {
  id: 'wards', num: '04', title: 'Wards, Routes & Region', short: 'Wards',
  desc: '42 wards, the bus corridors that cross them and the places within reach.',
  enter() {
    const m = M.map, self = this;
    m.setPaintProperty('carto', 'raster-opacity', .5);
    dock('left', card(`<div class="kicker">Chapter 04</div><h2>Wards, Routes &amp; Region</h2>
      <p class="lede">Forty-two wards share one centre. Three bus corridors stitch them to the capital and the Ghats, and a ring of hill destinations sits within an hour.</p>
      <div class="pills" id="wt"><button class="pill on" data-t="wards">Wards</button><button class="pill" data-t="corr">Bus corridors</button><button class="pill" data-t="tour">Places in reach</button></div>`) + `<div id="wbody" style="display:contents"></div>`);
    dock('right', '');
    $$('#wt .pill').forEach((b) => b.onclick = () => { $$('#wt .pill').forEach((x) => x.classList.toggle('on', x === b)); self.tab(b.dataset.t); });
    let hov = null;
    on('mousemove', 'wards-fill', (e) => { const f = e.features[0]; if (hov !== null) m.setFeatureState({ source: 'wards', id: hov }, { hover: false }); hov = f.id; m.setFeatureState({ source: 'wards', id: hov }, { hover: true }); tip(`<b>Ward ${f.properties.no} · ${f.properties.name}</b><span>${f.properties.ha} ha</span>`, e.originalEvent.clientX, e.originalEvent.clientY); });
    on('mouseleave', 'wards-fill', () => { if (hov !== null) m.setFeatureState({ source: 'wards', id: hov }, { hover: false }); hov = null; tip(null); });
    this.tab('wards');
  },
  tab(t) {
    const m = M.map, body = $('#wbody'); clearMarkers(); $('#right').innerHTML = '';
    const put = (html) => { body.innerHTML = html; $$('.card', body).forEach((c, i) => c.style.setProperty('--i', i + 1)); };
    if (t === 'wards') {
      scene(['base', 'wards', ['roads', .35]], { era: 4, bldOp: .3 }); fly({ center: CENTER, zoom: 12.5, pitch: 0, bearing: 0 }, 2000);
      const ws = M.d.wards.features.map((f) => f.properties).sort((a, b) => a.no - b.no), mx = Math.max(...ws.map((w) => w.ha));
      put(card(`<div class="kicker">Ward index — area</div><div class="bars">${ws.map((w) => `<div class="bar-row" style="grid-template-columns:128px 1fr 40px"><span>${String(w.no).padStart(2, '0')} ${w.name.slice(0, 13)}</span><div class="tr"><i data-w="${w.ha / mx * 100}"></i></div><b>${Math.round(w.ha)}</b></div>`).join('')}</div><span class="src">Hectares, from the 2024 ward delimitation. Darker fill on the map = larger ward.</span>`, 'scroll'));
      requestAnimationFrame(() => $$('.tr i', body).forEach((i) => i.style.width = i.dataset.w + '%'));
    } else if (t === 'corr') {
      scene(['base', ['wards', .5], ['roads', .3], 'routes', 'nodes'], { era: 4, bldOp: .3 });
      routeFilter(CORRIDORS.map((c) => c.id)); m.setPaintProperty('routes', 'line-color', ['match', ['get', 'id'], ...CORRIDORS.flatMap((c) => [c.id, c.color]), C.ink]);
      fit(routeBounds(CORRIDORS.map((c) => c.id)));
      put(CORRIDORS.map((c) => card(`<div class="kicker" style="color:${c.color}">${c.dir}</div><h3>${c.name}</h3><dl class="dl detail" style="display:grid;grid-template-columns:60px 1fr;gap:5px 10px;font-size:12.5px;margin:0"><dt class="small mono">VIA</dt><dd style="margin:0">${c.via}</dd><dt class="small mono">SERVES</dt><dd style="margin:0">${c.serves}</dd></dl>`, 'tight')).join('') + `<span class="src" style="padding:0 6px">Corridors are indicative alignments.</span>`);
    } else {
      scene(['base', ['roads', .3], 'routes'], { era: 4, bldOp: .3 });
      routeFilter(TOURIST.map((x) => 'troute_' + x.key)); m.setPaintProperty('routes', 'line-color', C.green);
      fly({ center: [77.08, 8.68], zoom: 10.6, pitch: 35, bearing: 20 }, 2200);
      const open = (x) => { $$('#tl2 .row').forEach((r) => r.classList.toggle('on', r.dataset.k === x.key)); fly({ center: x.c, zoom: x.key === 'koyikkal' ? 16 : 12.4, pitch: 50, bearing: 10 }, 2200);
        $('#right').innerHTML = `<div class="card detail"><img src="${x.img}" alt=""><div class="kicker">${x.d}</div><h3>${x.name}</h3><p>${x.note}</p></div>`; };
      TOURIST.forEach((x) => marker(x.c, `<i class="pin" style="--c:${C.green}"></i><span class="tag">${x.name}</span>`, '', () => open(x)));
      put(card(`<div class="kicker">Within an hour</div><div class="list" id="tl2">${TOURIST.map((x) => `<button class="row" data-k="${x.key}"><i class="sw" style="--c:${C.green}"></i>${x.name}<em>${x.d}</em></button>`).join('')}</div><span class="src">Locations approximate.</span>`, 'scroll'));
      $$('#tl2 .row').forEach((r) => r.onclick = () => open(TOURIST.find((x) => x.key === r.dataset.k)));
    }
  },
  leave() { M.map.setPaintProperty('routes', 'line-color', C.hot); },
};

// ------------------------------------------------------------------ 05 topography
export const chTopo = {
  id: 'topo', num: '05', title: 'Topography', short: 'Terrain',
  desc: 'Ridges, valleys and a section that follows your cursor.',
  enter() {
    const s = M.d.stats, m = M.map, bb = M.d.dem.bbox;
    scene(['base', 'tint', 'contours', ['water', .8]], { era: -1 });
    m.setPaintProperty('carto', 'raster-opacity', .2);
    fly({ center: CENTER, zoom: 12.7, pitch: 0, bearing: 0 });
    const cols = ['#C4DBFA', '#F3F5F2', '#F8E0AA', '#E9925A'];
    dock('left', card(`<div class="kicker">Chapter 05</div><h2>Topography</h2>
      <p class="lede">The municipality is a folded midland: valley floors near 40 m, a broad shoulder between 60 and 140 m where almost everything is built, and a few ridges above 200 m.</p>
      <div class="stats three"><div class="stat"><b>${s.elev_min}<small>m</small></b><span>lowest</span></div><div class="stat"><b>${s.elev_mean}<small>m</small></b><span>mean</span></div><div class="stat"><b>${s.elev_max}<small>m</small></b><span>highest</span></div></div>`) +
      card(`<div class="kicker">Share of land by elevation</div><div class="bars">${s.bands.map((b, i) => `<div class="bar-row"><span>${b.hi > 300 ? b.lo + ' m +' : b.lo ? b.lo + '–' + b.hi + ' m' : '< ' + b.hi + ' m'}</span><div class="tr"><i style="--c:${['#7FB0F0', '#B9CEF6', C.amber, C.hot][i]}" data-w="${b.pct}"></i></div><b>${b.pct}%</b></div>`).join('')}</div>
      <div class="legend"><div class="lg"><i style="--c:#6B3F18"></i>Index contour, 50 m</div><div class="lg"><i style="--c:#B99872;border-top-width:2px"></i>Intermediate, 10 m</div></div>
      <span class="src">Move the cursor over the map: the section below is cut west–east through it.</span>`));
    requestAnimationFrame(() => $$('#left .tr i').forEach((i) => i.style.width = i.dataset.w + '%'));
    void cols;
    dock('right', '');
    dock('bottom', `<div class="profile"><div class="cap"><span>West</span><span id="pf-r">Section through cursor · <b>— m</b></span><span>East</span></div><svg id="pf" viewBox="0 0 900 110" preserveAspectRatio="none"></svg></div>`);
    const svg = $('#pf'), N = 180;
    m.getSource('focus').setData(fc([])); show('focus');
    const draw = (lng, lat) => {
      let pts = [], mn = 1e9, mx = -1e9;
      for (let i = 0; i < N; i++) { const x = bb[0] + (bb[2] - bb[0]) * i / (N - 1), e = elevAt(x, lat); const inn = inBoundary(x, lat); pts.push([i / (N - 1) * 900, e, inn]); if (e != null) { mn = Math.min(mn, e); mx = Math.max(mx, e); } }
      mn = Math.min(mn, 40); mx = Math.max(mx, 200); const Y = (e) => 104 - (e - mn) / (mx - mn) * 96;
      const path = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + Y(p[1] ?? mn).toFixed(1)).join('');
      const inside = pts.filter((p) => p[2]); const x0 = inside.length ? inside[0][0] : 0, x1 = inside.length ? inside[inside.length - 1][0] : 0;
      const cx = (lng - bb[0]) / (bb[2] - bb[0]) * 900, ce = elevAt(lng, lat);
      svg.innerHTML = `<defs><linearGradient id="pg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.amber}" stop-opacity=".7"/><stop offset="1" stop-color="${C.blue3}" stop-opacity=".3"/></linearGradient></defs>
        <rect x="${x0}" y="0" width="${Math.max(0, x1 - x0)}" height="110" fill="${C.blue}" opacity=".06"/>
        <path d="${path}L900 110L0 110Z" fill="url(#pg)"/><path d="${path}" fill="none" stroke="${C.ink}" stroke-width="1.6" vector-effect="non-scaling-stroke"/>
        ${ce != null ? `<line x1="${cx}" x2="${cx}" y1="0" y2="110" stroke="${C.hot}" stroke-width="1" vector-effect="non-scaling-stroke"/><circle cx="${cx}" cy="${Y(ce)}" r="4" fill="${C.hot}"/>` : ''}`;
      $('#pf-r').innerHTML = `Section through cursor · <b>${ce != null ? Math.round(ce) + ' m' : '— m'}</b>`;
      m.getSource('focus').setData({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [[bb[0], lat], [bb[2], lat]] } });
    };
    m.setPaintProperty('focus', 'line-width', 1.5); m.setPaintProperty('focus', 'line-dasharray', [3, 2]);
    draw(CENTER[0], CENTER[1]);
    on('mousemove', (e) => draw(e.lngLat.lng, e.lngLat.lat));
  },
  leave() { show('focus', false); M.map.setPaintProperty('focus', 'line-width', 5); M.map.setPaintProperty('focus', 'line-dasharray', [1, 0]); },
};

// ------------------------------------------------------------------ 06 ecology
export const chEco = {
  id: 'eco', num: '06', title: 'Ecology', short: 'Ecology',
  desc: 'Water, canopy and landform — read through a lens that follows the cursor.',
  enter() {
    const s = M.d.stats, m = M.map, probe = $('#probe');
    scene(['base', ['tint', .55], ['contours', .35], 'water', 'flow', 'veg'], { era: 4, mode: 'plain', bldOp: .5 });
    m.setPaintProperty('carto', 'raster-opacity', .15);
    fly({ center: CENTER, zoom: 13.2, pitch: 52, bearing: -22 });
    dock('left', card(`<div class="kicker">Chapter 06</div><h2>Ecology</h2>
      <p class="lede">A foothill municipality that drains toward the capital. Its streams feed the Killiyar; its slopes carry the canopy; its valley floors hold the water. Move the lens to read any 300 m of ground.</p>
      <div class="stats"><div class="stat"><b id="e1">0</b><span>km of stream & river</span></div><div class="stat"><b>${s.built_pct}<small>%</small></b><span>ground under roofs</span></div>
      <div class="stat"><b id="e2">0</b><span>canopy clusters mapped</span></div><div class="stat"><b>${(s.water_km / s.area_km2).toFixed(1)}<small>km/km²</small></b><span>drainage density</span></div></div>`) +
      card(`<div class="kicker">Four readings — click to fly</div><div class="list" id="el">${ECO.map((e) => `<button class="row" data-k="${e.key}"><i class="sw" style="--c:${e.color}"></i>${e.title}<em>${e.kicker}</em></button>`).join('')}</div>`));
    countUp($('#e1'), s.water_km, 1500, 1); countUp($('#e2'), s.canopies, 1500);
    dock('right', card(`<div class="kicker">Layers</div><div class="legend" id="eg">
      <button class="lg" data-g="water"><i style="--c:${C.water}"></i>Streams, river, canal</button>
      <button class="lg" data-g="veg"><i class="sq" style="--c:${C.green}"></i>Canopy (3D, enlarged)</button>
      <button class="lg" data-g="tint"><i class="sq" style="--c:${C.amber}"></i>Elevation tint</button>
      <button class="lg" data-g="bld"><i class="sq" style="--c:#C9D8F2"></i>Buildings</button></div>
      <span class="src">Canopy clusters are derived from open ground clear of buildings, roads and water — a proxy for tree cover, not a tree census.</span>`));
    const st = { water: 1, veg: 1, tint: 1, bld: 1 };
    $$('#eg button').forEach((b) => b.onclick = () => { const g = b.dataset.g; st[g] = !st[g]; b.classList.toggle('off', !st[g]);
      if (g === 'bld') buildings(st[g] ? 4 : -1, 'plain', .5); else { show(g, st[g], g === 'tint' ? .55 : 1); if (g === 'water') show('flow', st[g]); } });
    $$('#el .row').forEach((r) => r.onclick = () => { const e = ECO.find((x) => x.key === r.dataset.k); $$('#el .row').forEach((x) => x.classList.toggle('on', x === r)); fly(e.cam, 2600);
      $('#ed')?.remove(); $('#right').insertAdjacentHTML('afterbegin', `<div class="card detail" id="ed"><button class="close">×</button><div class="kicker" style="color:${e.color}">${e.kicker}</div><h3>${e.title}</h3><p>${e.body}</p><span class="src">${e.src}</span></div>`);
      $('#ed .close').onclick = () => { $('#ed').remove(); r.classList.remove('on'); }; });
    probe.innerHTML = '<div class="lens"></div><div class="read"></div>';
    const R = 150;
    on('mousemove', (e) => {
      const { lng, lat } = e.lngLat, el = elevAt(lng, lat);
      if (el == null || !inBoundary(lng, lat)) { probe.hidden = true; return; }
      probe.hidden = false; probe.style.left = e.point.x + 'px'; probe.style.top = e.point.y + 'px';
      const p2 = m.project([lng + R / KX, lat]); probe.style.setProperty('--d', Math.max(60, Math.abs(p2.x - e.point.x) * 2) + 'px');
      const trees = near('tree', lng, lat, R).length, blds = near('bld', lng, lat, R).length, w = near('water', lng, lat, 600);
      const dw = w.length ? Math.round(Math.min(...w.map((x) => x[0]))) : null;
      const gx = (elevAt(lng + 60 / KX, lat) - elevAt(lng - 60 / KX, lat)) / 120, gy = (elevAt(lng, lat + 60 / KY) - elevAt(lng, lat - 60 / KY)) / 120;
      const slope = Math.atan(Math.hypot(gx, gy)) * 180 / Math.PI;
      const cls = dw != null && dw < 60 ? 'Riparian edge' : blds > 70 ? 'Built core' : el < 65 ? 'Valley floor' : slope > 9 ? 'Steep slope' : el > 135 ? 'Ridge crest' : blds > 45 ? 'Built shoulder' : 'Wooded shoulder';
      $('.read', probe).innerHTML = `<b>${cls}</b><div><span>Elevation</span>${Math.round(el)} m</div><div><span>Slope</span>${slope.toFixed(1)}°</div><div><span>Nearest water</span>${dw != null ? dw + ' m' : '> 600 m'}</div><div><span>Canopy clusters</span>${trees}</div><div><span>Buildings</span>${blds}</div>`;
    });
    on('mouseout', () => { probe.hidden = true; });
  },
  leave() {},
};

// ------------------------------------------------------------------ 08 (part 1) why this stretch — shown on the macro map
export function whyScene(step) {
  const m = M.map, sb = [[STRETCH.w, STRETCH.s], [STRETCH.e, STRETCH.n]];
  clearMarkers(); show('focus', false);
  const mk = () => { marker([77.002896, 8.609251], `<i class="stem"></i><i class="pin" style="--c:${C.rose}"></i><span class="tag">Koyikkal Palace</span>`, 'lift big');
    marker([77.0035783, 8.6054656], `<i class="stem"></i><i class="pin" style="--c:${C.blue}"></i><span class="tag">KSRTC bus stand</span>`, 'lift big');
    marker([77.0027942, 8.6033154], `<i class="stem"></i><i class="pin" style="--c:${C.amber}"></i><span class="tag">Market junction</span>`, 'lift big'); };
  if (step === 0) {
    scene(['base', 'roads', 'stretch', 'nodes'], { era: 4, bldOp: .35 });
    const roads = M.d.roads.features.filter((f) => ['sh', 'mdr', 'mun'].includes(f.properties.c) && (f.geometry.type === 'LineString' ? f.geometry.coordinates : f.geometry.coordinates.flat()).some((c) => c[0] > STRETCH.w && c[0] < STRETCH.e && c[1] > STRETCH.s && c[1] < STRETCH.n));
    m.getSource('focus').setData(fc(roads)); show('focus');
    fly({ center: STRETCH.c, zoom: 14.3, pitch: 35, bearing: -10 }, 2400);
  } else if (step === 1) {
    scene(['base', ['roads', .6], 'stretch', 'chantha'], { era: 4, bldOp: .5 }); mk();
    m.getSource('focus').setData({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [[77.002896, 8.609251], [77.00305, 8.6072], [77.00298, 8.6052], [77.0027942, 8.6033154]] } }); show('focus');
    fly({ center: STRETCH.c, zoom: 15.6, pitch: 58, bearing: 62 }, 2600);
  } else if (step === 2) {
    scene(['base', ['roads', .5], 'stretch'], { era: 4, mode: 'era', bldOp: .95 });
    fly({ center: STRETCH.c, zoom: 15.2, pitch: 62, bearing: -34 }, 2600);
  } else {
    scene(['base', 'roads', 'stretch', 'orr', 'chantha'], { era: 4, bldOp: .6 }); mk();
    const sp = M.d.roads.features.filter((f) => /Town Branch|Shorlacode|Mancha/.test(f.properties.n || ''));
    m.getSource('focus').setData(fc(sp)); show('focus');
    fly({ center: STRETCH.c, zoom: 14.9, pitch: 50, bearing: 18 }, 2600);
  }
  void sb;
}
export function stretchApproach() {
  // settle directly above the frame before the 3D model takes over
  clearMarkers(); show('focus', false);
  scene(['base', 'roads', 'stretch'], { era: 4, bldOp: .5 });
  return fly({ center: STRETCH.c, zoom: 16.15, pitch: 0, bearing: 0 }, 2200);
}
