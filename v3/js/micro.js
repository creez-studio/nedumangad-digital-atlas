// Micro scale: the design stretch as an axonometric 3D model built from the team's CAD
// drawing (data/stretch.json, local metres). Three.js.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { C } from './content.js';
import { $, tip, tween, ease, mouse, cursorMode } from './ui.js';
import { buildPalace, buildBusStand, buildMarket, buildCourtBar, buildCourtBlock, palm } from './landmarks.js';

const CX = 280, CY = 462, BASE = 420, SKIRT = -7;
export const X = { ready: false, labels: [], mode: 'pr', hover: null, pick: [] };
const col = (c) => new THREE.Color(c);

// ------------------------------------------------------------------ terrain
// Heightfield interpolated from the 2 m contours in road.dwg (4 m grid, true vertical scale).
// z = ground (stream bed carved), zr = road datum (uncarved, so road decks bridge the stream).
let D = null;
function samp(A, x, y) {
  const fx = (x - D.x0) / D.dx, fy = (y - D.y0) / D.dx;
  const i = Math.max(0, Math.min(D.nx - 2, Math.floor(fx))), j = Math.max(0, Math.min(D.ny - 2, Math.floor(fy)));
  const u = Math.max(0, Math.min(1, fx - i)), v = Math.max(0, Math.min(1, fy - j)), k = j * D.nx + i;
  return A[k] * (1 - u) * (1 - v) + A[k + 1] * u * (1 - v) + A[k + D.nx] * (1 - u) * v + A[k + D.nx + 1] * u * v;
}
export const hG = (x, y) => samp(D.z, x, y), hR = (x, y) => samp(D.zr, x, y);
const v3 = (x, y, h = 0) => new THREE.Vector3(x - CX, h, -(y - CY));
const v3g = (x, y, h = 0) => v3(x, y, h + hG(x, y));

// Split every edge longer than L (decided per edge, so neighbours agree and no cracks open),
// then lift each vertex onto the heightfield.
function drape(g, fn, off = 0, smooth = true, L = 6) {
  if (g.index) g = g.toNonIndexed();
  const p = g.attributes.position.array, st = [], out = [], L2 = L * L;
  for (let i = 0; i < p.length; i += 9) st.push([p[i], p[i + 1], p[i + 2], p[i + 3], p[i + 4], p[i + 5], p[i + 6], p[i + 7], p[i + 8]]);
  const d2 = (t, a, b) => (t[a] - t[b]) ** 2 + (t[a + 1] - t[b + 1]) ** 2 + (t[a + 2] - t[b + 2]) ** 2;
  const mid = (t, a, b) => [(t[a] + t[b]) / 2, (t[a + 1] + t[b + 1]) / 2, (t[a + 2] + t[b + 2]) / 2];
  while (st.length) {
    const t = st.pop(), ab = d2(t, 0, 3) > L2, bc = d2(t, 3, 6) > L2, ca = d2(t, 6, 0) > L2, n = ab + bc + ca;
    if (!n) { for (let k = 0; k < 9; k++) out.push(t[k]); continue; }
    const a = [t[0], t[1], t[2]], b = [t[3], t[4], t[5]], c = [t[6], t[7], t[8]];
    const mab = ab && mid(t, 0, 3), mbc = bc && mid(t, 3, 6), mca = ca && mid(t, 6, 0), T = (...v) => st.push(v.flat());
    if (n === 3) { T(a, mab, mca); T(mab, b, mbc); T(mca, mbc, c); T(mab, mbc, mca); }
    else if (n === 1) { if (ab) { T(a, mab, c); T(mab, b, c); } else if (bc) { T(a, b, mbc); T(a, mbc, c); } else { T(a, b, mca); T(mca, b, c); } }
    else if (!ab) { T(c, mca, mbc); T(a, b, mbc); T(a, mbc, mca); }
    else if (!bc) { T(a, mab, mca); T(mab, b, c); T(mab, c, mca); }
    else { T(mab, b, mbc); T(a, mab, mbc); T(a, mbc, c); }
  }
  const pos = new Float32Array(out), nor = new Float32Array(out.length);
  for (let i = 0; i < pos.length; i += 3) {
    const x = pos[i] + CX, y = CY - pos[i + 2];
    pos[i + 1] += fn(x, y) + off;
    if (smooth) { const gx = (fn(x + 2, y) - fn(x - 2, y)) / 4, gy = (fn(x, y + 2) - fn(x, y - 2)) / 4, l = Math.hypot(gx, 1, gy); nor[i] = -gx / l; nor[i + 1] = 1 / l; nor[i + 2] = gy / l; }
  }
  const o = new THREE.BufferGeometry(); o.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  if (smooth) o.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); else o.computeVertexNormals();
  return o;
}
function shape(p) {
  const s = new THREE.Shape(p.o.map((q) => new THREE.Vector2(q[0] - CX, q[1] - CY)));
  (p.h || []).forEach((h) => s.holes.push(new THREE.Path(h.map((q) => new THREE.Vector2(q[0] - CX, q[1] - CY)))));
  return s;
}
// flat polygon layer draped on the terrain. opt: depth (kerb height), clip, z (draw order), fn (height function)
function flat(polys, color, y, opt = {}) {
  if (!polys || !polys.length) return new THREE.Group();
  let g = opt.depth ? new THREE.ExtrudeGeometry(polys.map(shape), { depth: opt.depth, bevelEnabled: false }) : new THREE.ShapeGeometry(polys.map(shape));
  g.rotateX(-Math.PI / 2);
  g = drape(g, opt.fn || hR, y, !opt.depth);
  const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color, transparent: opt.opacity != null, opacity: opt.opacity ?? 1, clippingPlanes: opt.clip ? [X.clip] : null, polygonOffset: !!opt.z, polygonOffsetFactor: -(opt.z || 0) * .35, polygonOffsetUnits: -(opt.z || 0) * 2 }));
  m.receiveShadow = true; m.renderOrder = opt.z || 0;
  return m;
}
function lines(list, color, y, opt = {}) {
  const pts = [], fn = opt.fn || hR;
  list.forEach((l) => { for (let i = 0; i < l.length - 1; i++) {
    const a = l[i], b = l[i + 1], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 5));
    for (let k = 0; k < n; k++) { const x0 = a[0] + (b[0] - a[0]) * k / n, y0 = a[1] + (b[1] - a[1]) * k / n, x1 = a[0] + (b[0] - a[0]) * (k + 1) / n, y1 = a[1] + (b[1] - a[1]) * (k + 1) / n;
      pts.push(x0 - CX, fn(x0, y0) + y, -(y0 - CY), x1 - CX, fn(x1, y1) + y, -(y1 - CY)); }
  } });
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  const mat = opt.dash ? new THREE.LineDashedMaterial({ color, dashSize: opt.dash, gapSize: opt.gap || opt.dash, transparent: true, opacity: opt.opacity ?? 1, clippingPlanes: opt.clip ? [X.clip] : null })
    : new THREE.LineBasicMaterial({ color, transparent: true, opacity: opt.opacity ?? 1, clippingPlanes: opt.clip ? [X.clip] : null });
  const ls = new THREE.LineSegments(g, mat); if (opt.dash) ls.computeLineDistances(); return ls;
}
const rings = (polys) => polys.flatMap((p) => [p.o.concat([p.o[0]]), ...(p.h || []).map((h) => h.concat([h[0]]))]);
// thin vertical wall along a polyline (bridge parapets)
function wall(list, color, y0, y1, fn = hR) {
  const pos = [];
  list.forEach((l) => { for (let i = 0; i < l.length - 1; i++) { const a = l[i], b = l[i + 1], ha = fn(a[0], a[1]), hb = fn(b[0], b[1]);
    pos.push(a[0] - CX, ha + y0, -(a[1] - CY), b[0] - CX, hb + y0, -(b[1] - CY), b[0] - CX, hb + y1, -(b[1] - CY), a[0] - CX, ha + y0, -(a[1] - CY), b[0] - CX, hb + y1, -(b[1] - CY), a[0] - CX, ha + y1, -(a[1] - CY)); } });
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide })); m.castShadow = true; return m;
}

// oriented bounding box of a footprint -> {cx, cy, w, d, a}
function obb(o) {
  let best = null;
  for (let i = 0; i < o.length; i++) {
    const a = o[i], b = o[(i + 1) % o.length], th = Math.atan2(b[1] - a[1], b[0] - a[0]), c = Math.cos(th), s = Math.sin(th);
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    o.forEach((p) => { const x = p[0] * c + p[1] * s, y = -p[0] * s + p[1] * c; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); });
    const area = (x1 - x0) * (y1 - y0);
    if (!best || area < best.area) { const mx = (x0 + x1) / 2, my = (y0 + y1) / 2; best = { area, w: x1 - x0, d: y1 - y0, a: th, cx: mx * c - my * s, cy: mx * s + my * c }; }
  }
  return best;
}
function polyArea(o) { let a = 0; for (let i = 0; i < o.length; i++) { const p = o[i], q = o[(i + 1) % o.length]; a += p[0] * q[1] - q[0] * p[1]; } return Math.abs(a / 2); }
// hip roof geometry over a w x d rectangle (local, centred, ridge along x)
export function hipRoof(w, d, h) {
  const r = Math.max(0, (w - d) / 2), g = new THREE.BufferGeometry();
  const A = [-w / 2, 0, d / 2], B = [w / 2, 0, d / 2], Cc = [w / 2, 0, -d / 2], D2 = [-w / 2, 0, -d / 2], E = [-r, h, 0], F = [r, h, 0];
  const tri = [A, B, F, A, F, E, B, Cc, F, Cc, D2, E, Cc, E, F, D2, A, E].flat();
  g.setAttribute('position', new THREE.Float32BufferAttribute(tri, 3)); g.computeVertexNormals(); return g;
}
// footprint -> lowest / highest ground under it
function seat(o) { let lo = 1e9, hi = -1e9; o.forEach((p) => { const h = hG(p[0], p[1]); lo = Math.min(lo, h); hi = Math.max(hi, h); }); return [lo, hi]; }

// ------------------------------------------------------------------ build
export async function initMicro() {
  const S = X.S = await (await fetch('data/stretch.json')).json();
  D = S.dem;
  const canvas = $('#three');
  const R = X.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  R.setPixelRatio(Math.min(devicePixelRatio, 2)); R.localClippingEnabled = true;
  R.shadowMap.enabled = true; R.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = X.scene = new THREE.Scene();
  const cam = X.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, -2000, 5000);
  const ctl = X.ctl = new OrbitControls(cam, canvas);
  ctl.enableDamping = true; ctl.dampingFactor = .08; ctl.maxPolarAngle = Math.PI * .47; ctl.minZoom = .5; ctl.maxZoom = 9; ctl.zoomSpeed = .9; ctl.screenSpacePanning = false;
  X.clip = new THREE.Plane(new THREE.Vector3(0, 0, 1), 500);

  scene.add(new THREE.HemisphereLight(0xffffff, 0xb9c9ea, 2.1));
  const sun = X.sun = new THREE.DirectionalLight(0xffffff, 2.2);
  sun.position.set(-320, 520, 260); sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096); sun.shadow.bias = -0.0006; sun.shadow.normalBias = .6; sun.shadow.radius = 3;
  Object.assign(sun.shadow.camera, { left: -470, right: 470, top: 470, bottom: -470, near: 10, far: 1700 }); sun.shadow.camera.updateProjectionMatrix(); scene.add(sun);

  // ---- ground: the site as a cut block of terrain standing on the table
  const table = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0xF4F7FD }));
  table.receiveShadow = true; table.position.y = SKIRT - .05; scene.add(table);
  const [fx0, fy0, fx1, fy1] = S.frame, gw = fx1 - fx0, gh = fy1 - fy0, sx = Math.round(gw / 4), sy = Math.round(gh / 4);
  const gg = new THREE.PlaneGeometry(gw, gh, sx, sy).rotateX(-Math.PI / 2); gg.translate((fx0 + fx1) / 2 - CX, 0, -((fy0 + fy1) / 2 - CY));
  const gp = gg.attributes.position, tint = new Float32Array(gp.count * 3), zr = [S.num.elev[0] - D.zmin, S.num.elev[1] - D.zmin];
  const stops = [[0, [0.72, 0.84, 0.98]], [.3, [0.91, 0.95, 1]], [.55, [1, 0.98, 0.9]], [.78, [0.98, 0.86, 0.62]], [1, [0.93, 0.6, 0.4]]];
  const ramp = (t) => { t = Math.max(0, Math.min(1, t)); for (let i = 0; i < stops.length - 1; i++) if (t <= stops[i + 1][0]) { const k = (t - stops[i][0]) / (stops[i + 1][0] - stops[i][0]); return stops[i][1].map((v, c) => v + (stops[i + 1][1][c] - v) * k); } return stops[4][1]; };
  for (let i = 0; i < gp.count; i++) { const h = hG(gp.getX(i) + CX, CY - gp.getZ(i)); gp.setY(i, h); tint.set(ramp((h - zr[0]) / (zr[1] - zr[0])), i * 3); }
  gg.computeVertexNormals();
  const site = new THREE.Mesh(gg, new THREE.MeshLambertMaterial({ color: 0xFFFFFF })); site.receiveShadow = true; scene.add(site);
  const tg = gg.clone(); tg.setAttribute('color', new THREE.BufferAttribute(tint, 3));
  X.tint = new THREE.Mesh(tg, new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: 0, polygonOffset: true, polygonOffsetFactor: -.2, polygonOffsetUnits: -1 })); X.tint.receiveShadow = true; X.tint.visible = false; scene.add(X.tint);
  // skirt: the cut faces of the block show the ground profile on all four sides
  const sk = [], top = [], edge = (x0, y0, x1, y1) => { const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 4), l = [];
    for (let k = 0; k < n; k++) { const ax = x0 + (x1 - x0) * k / n, ay = y0 + (y1 - y0) * k / n, bx = x0 + (x1 - x0) * (k + 1) / n, by = y0 + (y1 - y0) * (k + 1) / n, ha = hG(ax, ay), hb = hG(bx, by);
      sk.push(ax - CX, SKIRT, -(ay - CY), bx - CX, SKIRT, -(by - CY), bx - CX, hb, -(by - CY), ax - CX, SKIRT, -(ay - CY), bx - CX, hb, -(by - CY), ax - CX, ha, -(ay - CY)); l.push([ax, ay]); if (k === n - 1) l.push([bx, by]); }
    top.push(l); };
  edge(fx0, fy0, fx1, fy0); edge(fx1, fy0, fx1, fy1); edge(fx1, fy1, fx0, fy1); edge(fx0, fy1, fx0, fy0);
  const skg = new THREE.BufferGeometry(); skg.setAttribute('position', new THREE.Float32BufferAttribute(sk, 3)); skg.computeVertexNormals();
  scene.add(new THREE.Mesh(skg, new THREE.MeshLambertMaterial({ color: 0xDCE6F8, side: THREE.DoubleSide })));
  scene.add(lines(top, C.ink, .02, { fn: hG, opacity: .8 }));
  scene.add(lines([[[fx0, fy0], [fx1, fy0], [fx1, fy1], [fx0, fy1], [fx0, fy0]]], C.ink, SKIRT, { fn: () => 0, opacity: .5 }));
  scene.add(lines([[[fx0, fy0], [fx1, fy0], [fx1, fy1], [fx0, fy1], [fx0, fy0]]], C.hot, .35, { dash: 5, fn: hG }));
  const gridL = []; for (let x = Math.ceil(fx0 / 50) * 50; x < fx1; x += 50) gridL.push([[x, fy0], [x, fy1]]); for (let y = Math.ceil(fy0 / 50) * 50; y < fy1; y += 50) gridL.push([[fx0, y], [fx1, y]]);
  scene.add(lines(gridL, C.blue3, .06, { opacity: .45, fn: hG }));
  // 2 m contours lie on the ground all the time (faint); the terrain step strengthens them
  const cg = X.cont = new THREE.Group(), cramp = (e) => new THREE.Color().lerpColors(col(C.blue), col(C.hot), Math.min(1, Math.max(0, (e - S.num.elev[0]) / (S.num.elev[1] - S.num.elev[0]))));
  S.cont.forEach((c) => { const l = lines([c.p], cramp(c.e), .12, { opacity: c.e % 10 ? .22 : .4, fn: hG }); l.userData = { e: c.e, o: l.material.opacity }; cg.add(l); });
  scene.add(cg);
  // stream
  scene.add(flat(S.stream, 0x6FB1F2, .45, { fn: hG, z: 3 }));
  scene.add(lines(S.stream_line, 0xffffff, .55, { fn: hG, dash: 2, gap: 3, opacity: .9 }));

  // ---- existing condition (OSM centrelines buffered to assumed carriageway widths)
  const ex = X.ex = new THREE.Group();
  ex.add(flat(S.ex_surface, 0xAAB6CC, .07, { z: 1 }));
  ex.add(lines(S.ex.map((e) => e.p), 0xffffff, .16, { dash: 3 }));
  scene.add(ex);
  X.exEdge = lines(rings(S.ex_surface), C.hot, .6, { dash: 2.5 }); X.exEdge.visible = false; scene.add(X.exEdge);

  // ---- redesigned road (CAD)
  const pr = X.pr = new THREE.Group();
  pr.add(flat(S.ex_keep, 0xA9B5CB, .07, { clip: 1, z: 1 }));                    // existing lanes kept, run into the new kerb line
  pr.add(flat(S.internal, 0x93A1BC, .09, { clip: 1, z: 1 }));
  pr.add(flat(S.court_pad, 0xDDE6F6, .08, { clip: 1, z: 1 }));
  pr.add(flat(S.carriage, 0x27365A, .12, { clip: 1, z: 2 }));
  pr.add(flat(S.foot, 0xF6E2B8, .0, { clip: 1, depth: .3, z: 3 }));
  pr.add(flat(S.median, 0x86D3AC, .0, { clip: 1, depth: .38, z: 3 }));
  pr.add(lines(S.marks, 0xffffff, .2, { clip: 1, dash: 1.5 }));
  pr.add(lines(S.giveway, 0xffffff, .2, { clip: 1, dash: .6, gap: .5 }));
  pr.add(flat(S.zebra.concat(S.zebra_gen), 0xffffff, .17, { clip: 1, z: 4 }));
  pr.add(lines(S.court.slot, C.blue, .2, { clip: 1 })); pr.add(lines(S.court.road, C.ink2, .2, { clip: 1, opacity: .7 }));
  pr.add(lines(S.court.path, C.hot, .22, { clip: 1 })); pr.add(lines(S.court.land, C.green, .22, { clip: 1 }));
  scene.add(pr);
  // bridges over the stream: deck slab under the road surface + parapets
  scene.add(flat(S.bridges, 0xE6EAF2, -.9, { depth: .95, z: 1 }));
  scene.add(wall(S.parapets, 0xffffff, .1, 1.15));
  scene.add(lines(S.parapets, C.ink, 1.17, { opacity: .7 }));

  // ---- buildings: each sits on the lowest ground under its footprint, roof stays level
  const LM = { palace: [281, 806], bus: [357, 383], market: [205, 112] }, COURT = { 260: 'bar', 336: 'block' };
  const inR = (c, p, r) => Math.hypot(c[0] - p[0], c[1] - p[1]) < r;
  const bg = X.bg = new THREE.Group(), edgePos = [], floorPos = [], roofs = { n: [], h: [] };
  X.mat = {
    wall: new THREE.MeshLambertMaterial({ color: 0xF4F7FD }), her: new THREE.MeshLambertMaterial({ color: 0xF3C6D6 }),
    hov: new THREE.MeshLambertMaterial({ color: 0x5B8DEF }), cut: new THREE.MeshLambertMaterial({ color: 0xF7B9A6 }), edge: new THREE.MeshLambertMaterial({ color: 0xFCE3B3 }),
    ghost: new THREE.MeshLambertMaterial({ color: 0xF4F7FD, transparent: true, opacity: .25 }),
  };
  X.courtFoot = {};
  S.bld.forEach((b, i) => {
    b.ht = +Math.min(12.5, b.ht <= 4 ? b.ht : 4 + (b.ht - 4) * .68).toFixed(1);      // derived heights run tall for a 1–3 storey town: compress
    const c = b.o.reduce((a, p) => [a[0] + p[0] / b.o.length, a[1] + p[1] / b.o.length], [0, 0]);
    b.c = c; const [lo, hi] = seat(b.o); b.base = lo; b.top = hi + b.ht;
    if (COURT[i]) { b.skip = true; X.courtFoot[COURT[i]] = b; return; }
    if ((inR(c, LM.palace, 26) && b.a > 300) || (inR(c, LM.bus, 22) && b.a > 400)) { b.skip = true; if (inR(c, LM.bus, 22)) (X.busFoot = X.busFoot || []).push(...b.o); return; }
    const dep = b.top - lo, g = new THREE.ExtrudeGeometry(shape(b), { depth: dep, bevelEnabled: false }); g.rotateX(-Math.PI / 2); g.translate(0, lo, 0);
    const m = new THREE.Mesh(g, b.her ? X.mat.her : X.mat.wall); m.castShadow = m.receiveShadow = true; m.userData = { b, i, base: b.her ? X.mat.her : X.mat.wall };
    bg.add(m); X.pick.push(m);
    if (inR(c, LM.market, 36)) { (X.marketSite = X.marketSite || []).push(m); m.add(new THREE.LineSegments(new THREE.EdgesGeometry(g, 30), new THREE.LineBasicMaterial({ color: C.ink, transparent: true, opacity: .62 }))); return; }
    const ring = b.o.concat([b.o[0]]);
    for (let k = 0; k < ring.length - 1; k++) {
      const [x0, y0] = ring[k], [x1, y1] = ring[k + 1], g0 = hG(x0, y0), g1 = hG(x1, y1);
      edgePos.push(x0 - CX, g0, -(y0 - CY), x0 - CX, b.top, -(y0 - CY), x0 - CX, b.top, -(y0 - CY), x1 - CX, b.top, -(y1 - CY), x0 - CX, g0 + .03, -(y0 - CY), x1 - CX, g1 + .03, -(y1 - CY));
      for (let h = b.top - 3.3; h > hi + 1.2; h -= 3.3) floorPos.push(x0 - CX, h, -(y0 - CY), x1 - CX, h, -(y1 - CY));
    }
    // small and mid footprints get a tiled hip roof — the Kerala roofscape
    if (b.a < 420 && b.o.length <= 8) {
      const o = obb(b.o); if (polyArea(b.o) / o.area > .78) {
        const w = Math.max(o.w, o.d) + 1.2, d = Math.min(o.w, o.d) + 1.2, rg = hipRoof(w, d, d * .3);
        rg.rotateY(o.a + (o.w >= o.d ? 0 : Math.PI / 2)); rg.translate(o.cx - CX, b.top, -(o.cy - CY)); (b.her ? roofs.h : roofs.n).push(rg);
        m.userData.roofH = d * .3;
      }
    }
  });
  scene.add(bg);
  const mkLines = (pos, color, op) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); return new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color, transparent: true, opacity: op })); };
  scene.add(X.edges = mkLines(edgePos, C.ink, .62)); scene.add(X.floors = mkLines(floorPos, C.blue2, .38));
  const roofMesh = (list, color) => { if (!list.length) return; const m = new THREE.Mesh(mergeGeometries(list), new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide })); m.castShadow = true; scene.add(m);
    const e = new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry, 20), new THREE.LineBasicMaterial({ color: C.ink, transparent: true, opacity: .45 })); scene.add(e); return m; };
  roofMesh(roofs.n, 0xC9D8F2); roofMesh(roofs.h, 0xD9745C);

  // ---- trees (instanced)
  const T = S.trees, trunk = new THREE.CylinderGeometry(.22, .3, 1, 5), can1 = new THREE.IcosahedronGeometry(1, 0), can2 = new THREE.IcosahedronGeometry(1, 0);
  const mk = (geo, n) => { const m = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ flatShading: true }), n); m.castShadow = true; scene.add(m); return m; };
  const d = new THREE.Object3D(), sets = [0, 1].map((des) => { const list = T.filter((t) => t[3] === des); return { list, m: [mk(trunk, list.length), mk(can1, list.length), mk(can2, list.length)] }; });
  sets.forEach(({ list, m: [mt, m1, m2] }, des) => list.forEach((t, i) => {
    const r = t[2], h = r * 2.6, p = v3(t[0], t[1], des ? hR(t[0], t[1]) : hG(t[0], t[1]));
    d.position.set(p.x, p.y + h * .25, p.z); d.scale.set(r * .5, h * .5, r * .5); d.rotation.set(0, 0, 0); d.updateMatrix(); mt.setMatrixAt(i, d.matrix); mt.setColorAt(i, col(0x8A6A4A));
    d.position.set(p.x, p.y + h * .62, p.z); d.scale.set(r, r * .85, r); d.rotation.set(0, i, 0); d.updateMatrix(); m1.setMatrixAt(i, d.matrix); m1.setColorAt(i, col(des ? 0x1FA37A : 0xBFE3D2));
    d.position.set(p.x + r * .2, p.y + h * .95, p.z - r * .15); d.scale.set(r * .62, r * .6, r * .62); d.rotation.set(0, i * 2, 0); d.updateMatrix(); m2.setMatrixAt(i, d.matrix); m2.setColorAt(i, col(des ? 0x4CC79A : 0xD7EFE3));
  }));
  X.treeDes = sets[1].m;                                                           // designed street trees: only with the redesigned road


  // ---- landmarks: each model stands on a level plinth cut into the slope
  const lm = X.lm = {};
  const place = (key, g, x, y, rot, pw, pd) => {
    let hi = -1e9, lo = 1e9; for (let u = -1; u <= 1; u++) for (let v = -1; v <= 1; v++) { const px = x + (Math.cos(rot) * u * pw / 2 + Math.sin(rot) * v * pd / 2), py = y + (Math.sin(rot) * u * pw / 2 - Math.cos(rot) * v * pd / 2), h = hG(px, py); hi = Math.max(hi, h); lo = Math.min(lo, h); }
    const lvl = lo + (hi - lo) * .6; g.position.copy(v3(x, y, lvl)); g.rotation.y = rot;
    const pl = new THREE.Mesh(new THREE.BoxGeometry(pw + 3, lvl - lo + 1.2, pd + 3), new THREE.MeshLambertMaterial({ color: 0xE9EEF8 })); pl.position.y = -(lvl - lo + 1.2) / 2 + .02; g.add(pl);
    scene.add(g); lm[key] = g; g.userData.lvl = lvl; g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); return lvl; };
  X.lvl = {};
  X.lvl.palace = place('palace', buildPalace(), 282, 805, .06, 40, 34);
  const bo = X.busFoot ? obb(X.busFoot) : { cx: 357, cy: 383, w: 78, d: 22, a: -.35 }, bL = Math.max(bo.w, bo.d), bW = Math.min(bo.w, bo.d);
  X.lvl.bus = place('bus', buildBusStand(bL, bW), bo.cx, bo.cy, bo.a + (bo.w >= bo.d ? 0 : Math.PI / 2), Math.min(96, bL) + 12, bW + 30);
  X.lvl.market = place('market', buildMarket(), 205, 112, -.12, 54, 44);
  // court complex on the two footprints the team identified (buildings 261 and 337)
  const front = (o, to) => { let a = o.a + (o.w >= o.d ? 0 : Math.PI / 2); const fx = Math.sin(a), fy = -Math.cos(a); if (fx * (to[0] - o.cx) + fy * (to[1] - o.cy) < 0) a += Math.PI; return a; };
  const cb = obb(X.courtFoot.bar.o), ck = obb(X.courtFoot.block.o);
  X.lvl.court = place('court', buildCourtBlock(Math.max(ck.w, ck.d), Math.min(ck.w, ck.d)), ck.cx, ck.cy, front(ck, [cb.cx, cb.cy]), Math.max(ck.w, ck.d), Math.min(ck.w, ck.d));
  place('courtBar', buildCourtBar(Math.max(cb.w, cb.d), Math.min(cb.w, cb.d)), cb.cx, cb.cy, front(cb, [284, cb.cy]), Math.max(cb.w, cb.d), Math.min(cb.w, cb.d));
  X.courtAt = [(cb.cx + ck.cx) / 2, (cb.cy + ck.cy) / 2];
  [[262, 822], [300, 824], [303, 786], [259, 790], [240, 806]].forEach((p, i) => { const t = palm(7 + (i % 3)); t.position.copy(v3g(p[0], p[1])); scene.add(t); });

  // ---- concept: ring skywalk over Market junction
  buildSkywalk(S);
  // ---- traffic + signals
  buildTraffic(S);

  // ---- labels
  const L = (text, x, y, h, cls = '', group = 'base', onClick) => {
    const el = document.createElement('div'); el.className = 'l3 off ' + cls; el.textContent = text; el.style.setProperty('--stem', '26px');
    if (onClick) { el.dataset.cursor = 'Open'; el.onclick = onClick; }
    $('#labels').appendChild(el); X.labels.push({ el, p: v3(x, y, h + Math.max(hG(x, y), hR(x, y))), group }); return el;
  };
  L('Koyikkal Palace', 282, 805, 14, 'her', 'lm'); L('KSRTC Bus Stand', bo.cx, bo.cy, 11, 'hot', 'lm'); L('New market — proposal', 205, 112, 24, 'hot', 'mk'); L('Nedumangad Court', ck.cx, ck.cy, 20, '', 'lm');
  L('Skywalk ring — concept', S.sky.c[0], S.sky.c[1], X.skyH - hR(S.sky.c[0], S.sky.c[1]) + 4, 'hot', 'sky');
  L('Roundabout', 283, 356, 4, 'dim', 'pr'); L('Parking court · ≈170 bays', 425, 478, 3, 'dim', 'pr'); L('Market junction', 287, 150, 4, '', 'base'); L('Girls HS junction', 102, 385, 4, '', 'base');
  L('TOWN BRANCH ROAD', 284, 520, 1, 'road', 'base'); L('SH 3 · MANCHA ROAD', 178, 770, 1, 'road', 'base'); L('PULIPPARA – ANAD ROAD', 380, 705, 1, 'road', 'base'); L('SURYA ROAD', 410, 250, 1, 'road', 'base');
  S.bld.filter((b) => b.her && !b.skip).forEach((b, i) => L('Heritage ' + String(i + 1).padStart(2, '0'), b.c[0], b.c[1], b.top - hG(b.c[0], b.c[1]) + 3, 'her', 'her'));
  L('21.0 m reserve', 284, 600, 2, 'dim', 'dim'); L('≈ 7 m carriageway', 284, 600, 2, 'dim', 'dimex');
  // terrain call-outs
  const pf = S.prof, hiP = pf.reduce((a, q) => (q[1] > a[1] ? q : a)), loP = pf.reduce((a, q) => (q[1] < a[1] ? q : a));
  L(`Crest · ${hiP[1].toFixed(0)} m`, hiP[2], hiP[3], 6, 'hot', 'topo'); L(`Sag · ${loP[1].toFixed(0)} m`, loP[2], loP[3], 6, '', 'topo');
  L(`Steepest · ${S.num.grade_max} %`, S.num.grade_at[0], S.num.grade_at[1], 6, 'dim', 'topo');
  let pk = [0, 0, -1]; for (let j = 8; j < D.ny - 8; j++) for (let i = 8; i < D.nx - 8; i++) if (D.z[j * D.nx + i] > pk[2]) pk = [D.x0 + i * D.dx, D.y0 + j * D.dx, D.z[j * D.nx + i]];
  L(`Court hill · ${(pk[2] + D.zmin).toFixed(0)} m`, pk[0], pk[1], 22, 'hot', 'topo');
  if (S.stream.length) { const sp = S.stream_line[0][Math.floor(S.stream_line[0].length / 2)]; L('Stream', sp[0], sp[1], 3, 'dim', 'topo'); }

  // ---- interaction
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  canvas.addEventListener('pointermove', (e) => {
    ndc.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); ray.setFromCamera(ndc, cam);
    const hit = ray.intersectObjects(X.pick, false)[0];
    if (X.hover && (!hit || hit.object !== X.hover)) { X.hover.material = X.hover.userData.cur || X.hover.userData.base; X.hover = null; tip(null); cursorMode(null); }
    if (hit) {
      const m = hit.object, b = m.userData.b; if (X.hover !== m) { X.hover = m; m.material = X.mat.hov; }
      cursorMode('hover');
      tip(`<b>${b.her ? 'Heritage building (flagged in CAD)' : 'Building ' + String(m.userData.i + 1).padStart(3, '0')}</b><span>${b.a} m² footprint · ≈ ${Math.max(1, Math.round(b.ht / 3.3))} storey${b.ht > 5 ? 's' : ''} (est.) · ground ${(b.base + D.zmin).toFixed(0)} m${b.f === 2 ? ' · crosses new reserve' : b.f === 1 ? ' · fronts widened road' : ''}</span>`, e.clientX, e.clientY);
    }
  });
  canvas.addEventListener('pointerleave', () => { tip(null); });
  addEventListener('resize', resize); resize();
  setCam({ t: [CX, CY], az: 0, el: 89.9, view: 900 }, 0);
  X.ready = true; X.clock = new THREE.Clock();
  X.lmExplode = 0;
  return X;
}

// ------------------------------------------------------------------ skywalk ring (concept)
function buildSkywalk(S) {
  const k = S.sky, g = X.sky = new THREE.Group(), [cx, cy] = k.c, r = k.r, w = k.w;
  let top = -1e9; for (let a = 0; a < 6.283; a += .2) top = Math.max(top, hR(cx + Math.cos(a) * r, cy + Math.sin(a) * r));
  const H = X.skyH = top + 6.4, deckM = new THREE.MeshLambertMaterial({ color: 0xF6E2B8 }), railM = new THREE.MeshLambertMaterial({ color: 0x8FB4F2, transparent: true, opacity: .45, side: THREE.DoubleSide }),
    hotM = new THREE.MeshLambertMaterial({ color: C.hot }), steelM = new THREE.MeshLambertMaterial({ color: 0x33456F }), ink = new THREE.LineBasicMaterial({ color: C.ink, transparent: true, opacity: .75 });
  const add = (m) => { m.castShadow = true; m.receiveShadow = true; g.add(m); return m; };
  const ringShape = new THREE.Shape(); ringShape.absarc(0, 0, r + w / 2, 0, Math.PI * 2, false); const hole = new THREE.Path(); hole.absarc(0, 0, r - w / 2, 0, Math.PI * 2, true); ringShape.holes.push(hole);
  const deck = add(new THREE.Mesh(new THREE.ExtrudeGeometry(ringShape, { depth: .55, bevelEnabled: false, curveSegments: 72 }).rotateX(-Math.PI / 2), deckM)); deck.position.copy(v3(cx, cy, H - .55));
  deck.add(new THREE.LineSegments(new THREE.EdgesGeometry(deck.geometry, 40), ink));
  [r + w / 2, r - w / 2].forEach((rr) => { const rail = add(new THREE.Mesh(new THREE.CylinderGeometry(rr, rr, 1.15, 72, 1, true), railM)); rail.position.copy(v3(cx, cy, H + .58)); rail.castShadow = false;
    const hr = add(new THREE.Mesh(new THREE.TorusGeometry(rr, .07, 5, 72).rotateX(Math.PI / 2), steelM)); hr.position.copy(v3(cx, cy, H + 1.16)); });
  const fas = add(new THREE.Mesh(new THREE.CylinderGeometry(r + w / 2 + .04, r + w / 2 + .04, .5, 72, 1, true), hotM)); fas.position.copy(v3(cx, cy, H - .28));   // fascia band
  // columns only where the ring is over footpath or land, never in a carriageway
  k.cols.forEach(([x, y]) => { const b = hG(x, y), c = add(new THREE.Mesh(new THREE.CylinderGeometry(.45, .55, H - .55 - b, 10), steelM)); c.position.copy(v3(x, y, b + (H - .55 - b) / 2));
    const cap = add(new THREE.Mesh(new THREE.CylinderGeometry(1.3, .5, .9, 10), steelM)); cap.position.copy(v3(x, y, H - 1)); });
  // links into the frontages (and one long bridge toward the new market)
  k.links.forEach(([x0, y0, x1, y1, bi]) => {
    const len = Math.hypot(x1 - x0, y1 - y0), a = Math.atan2(y1 - y0, x1 - x0), mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
    const br = add(new THREE.Mesh(new THREE.BoxGeometry(len + 2, .5, 3), deckM)); br.position.copy(v3(mx, my, H - .3)); br.rotation.y = a; br.add(new THREE.LineSegments(new THREE.EdgesGeometry(br.geometry), ink));
    [-1.5, 1.5].forEach((o) => { const gl = new THREE.Mesh(new THREE.BoxGeometry(len + 2, 1.15, .06), railM); gl.position.set(0, .82, o); br.add(gl); });
    if (bi < 0) for (let s = .3; s < 1; s += .35) { const px = x0 + (x1 - x0) * s, py = y0 + (y1 - y0) * s, b = hG(px, py), c = add(new THREE.Mesh(new THREE.CylinderGeometry(.35, .45, H - .55 - b, 8), steelM)); c.position.copy(v3(px, py, b + (H - .55 - b) / 2)); }
    const door = add(new THREE.Mesh(new THREE.BoxGeometry(.5, 3, 3.4), hotM)); door.position.copy(v3(x1, y1, H + 1.5)); door.rotation.y = a;
  });
  // stair + lift towers on the footpath corners
  k.towers.forEach(([x, y, a]) => { const b = hG(x, y), t = add(new THREE.Mesh(new THREE.BoxGeometry(3.4, H + 3.2 - b, 3.4), new THREE.MeshLambertMaterial({ color: 0xF4F7FD }))); t.position.copy(v3(x, y, b + (H + 3.2 - b) / 2)); t.rotation.y = a; t.add(new THREE.LineSegments(new THREE.EdgesGeometry(t.geometry), ink));
    const gl = new THREE.Mesh(new THREE.BoxGeometry(3.5, H - b - 1, 1.6), railM); gl.position.y = -1; t.add(gl);
  });
  X.scene.add(g);
}

// ------------------------------------------------------------------ traffic
// Vehicles run on lane lines derived from the carriageway polygons (keep-left), follow the
// vehicle ahead, stop at red signals and give way at the roundabout.
const CYCLE = 34;
function sigState(j, ph, t) { const u = (t + j * 9) % CYCLE, a = ph ? 17 : 0; const v = (u - a + CYCLE) % CYCLE; return v < 12 ? 'g' : v < 14.5 ? 'a' : 'r'; }
function prepRoutes(list) {
  return list.map((r) => {
    const n = r.p.length, nor = r.p.map((p, k) => { const a = r.p[Math.max(0, k - 1)], b = r.p[Math.min(n - 1, k + 1)], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [-(b[1] - a[1]) / l, (b[0] - a[0]) / l]; });
    return { ...r, nor, len: r.s[n - 1] };
  });
}
function lanePos(r, s, lane, out) {
  s = Math.max(0, Math.min(r.len - .01, s)); let k = Math.min(r.p.length - 2, Math.floor(s / r.len * (r.p.length - 1)));
  while (k > 0 && r.s[k] > s) k--; while (k < r.p.length - 2 && r.s[k + 1] < s) k++;
  const f = (s - r.s[k]) / ((r.s[k + 1] - r.s[k]) || 1), o = r.o[k][lane] + (r.o[k + 1][lane] - r.o[k][lane]) * f;
  out[0] = r.p[k][0] + (r.p[k + 1][0] - r.p[k][0]) * f + (r.nor[k][0] + (r.nor[k + 1][0] - r.nor[k][0]) * f) * o;
  out[1] = r.p[k][1] + (r.p[k + 1][1] - r.p[k][1]) * f + (r.nor[k][1] + (r.nor[k + 1][1] - r.nor[k][1]) * f) * o;
  return out;
}
function buildTraffic(S) {
  const T = X.traffic = { pr: { routes: prepRoutes(S.routes), stops: S.stops }, ex: { routes: prepRoutes(S.routes_ex), stops: S.stops_ex }, cars: [], junc: S.junc, t: 0 };
  const paint = [0xffffff, 0x5B8DEF, 0xF2A93B, 0x33456F, 0xE9EEF8, 0x86D3AC];
  T.pr.routes.forEach((r, ri) => { const n = Math.max(3, Math.round(r.len / 42));
    for (let d = 1; d >= -1; d -= 2) for (let k = 0; k < n; k++) T.cars.push({ r: ri, d, lane: k % 2, s: (k + .5) / n * r.len, v: 0, L: r.len, bus: (k + ri) % 6 === 0 && k % 2 === 1, col: paint[(k * 3 + ri + (d > 0)) % paint.length], x: 0, y: 0, hx: 1, hy: 0, on: 1 }); });
  const N = T.cars.length, body = new THREE.BoxGeometry(4.2, 1.0, 1.85).translate(0, .75, 0), cab = new THREE.BoxGeometry(2.3, .75, 1.7).translate(-.25, 1.6, 0), mat = () => new THREE.MeshLambertMaterial();
  X.cars = new THREE.InstancedMesh(body, mat(), N); X.cabs = new THREE.InstancedMesh(cab, new THREE.MeshLambertMaterial({ color: 0x1B2A4E }), N); X.cars.castShadow = true;
  T.cars.forEach((c, i) => X.cars.setColorAt(i, col(c.bus ? C.hot : c.col)));
  X.scene.add(X.cars, X.cabs);
  // signal heads
  const sg = X.signals = new THREE.Group(), pole = new THREE.MeshLambertMaterial({ color: 0x33456F }), off = { r: 0x4a1410, a: 0x4a3a10, g: 0x103a22 }, onC = { r: 0xFF3B30, a: 0xFFC233, g: 0x2EE08A };
  T.lamps = S.signals.map((s) => {
    const b = hR(s.x, s.y), g = new THREE.Group(); g.position.copy(v3(s.x, s.y, b)); g.rotation.y = s.a;      // local +x = direction of travel it controls
    const p = new THREE.Mesh(new THREE.CylinderGeometry(.11, .14, 5.6, 6), pole); p.position.y = 2.8; p.castShadow = true; g.add(p);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(.14, .14, 3.4), pole); arm.position.set(0, 5.5, 1.7); g.add(arm);
    const mkHead = (z, y) => { const h = new THREE.Mesh(new THREE.BoxGeometry(.5, 1.7, .6), new THREE.MeshLambertMaterial({ color: 0x14203D })); h.position.set(0, y, z); h.castShadow = true; g.add(h);
      return ['r', 'a', 'g'].map((k, i) => { const l = new THREE.Mesh(new THREE.SphereGeometry(.24, 10, 8), new THREE.MeshBasicMaterial({ color: off[k] })); l.position.set(-.26, y + .52 - i * .52, z); g.add(l); return l; }); };
    const lamps = [mkHead(3.3, 5.5), mkHead(0, 3.4)];
    sg.add(g); return { s, lamps, off, onC };
  });
  // stop lines
  X.pr.add(lines(S.stops.filter((q) => S.junc[q.j].k === 'signal').map((q) => { const r = T.pr.routes[q.r], a = [0, 0], b = [0, 0]; lanePos(r, q.s, q.d > 0 ? 0 : 2, a); lanePos(r, q.s, q.d > 0 ? 1 : 3, b); const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, e = 1.9; return [[a[0] - dx / l * e, a[1] - dy / l * e], [b[0] + dx / l * e, b[1] + dy / l * e]]; }), 0xffffff, .21, { clip: 1 }));
  X.scene.add(sg);
}
const P2 = [0, 0], P3 = [0, 0];
function stepTraffic(dt) {
  const T = X.traffic, pr = X.mode !== 'ex', net = pr ? T.pr : T.ex, v0 = pr ? 9.5 : 4.2; T.t += dt;
  X.signals.visible = pr;
  if (pr) T.lamps.forEach((L) => { const st = sigState(L.s.j, L.s.ph, T.t); L.lamps.forEach((h) => h.forEach((l, i) => { const k = 'rag'[i]; l.material.color.setHex(st === k ? L.onC[k] : L.off[k]); })); });
  // who is inside which junction (for give-way / shared junctions)
  const inside = T.junc.map(() => new Set());
  T.cars.forEach((c) => { if (!c.on) return; T.junc.forEach((J, j) => { if (Math.hypot(c.x - J.c[0], c.y - J.c[1]) < J.r - 2) inside[j].add(c.r); }); });
  T.cars.forEach((c, i) => {
    const r = net.routes[c.r]; if (!r) { c.on = 0; return; }
    c.on = pr || i % 2 === 0 ? 1 : 0; if (!c.on) return;
    if (c.L !== r.len) { c.s *= r.len / c.L; c.L = r.len; }
    const lane = (c.d > 0 ? 0 : 2) + c.lane;
    let limit = 1e9;                                    // free distance ahead
    for (const q of net.stops) {
      if (q.r !== c.r || q.d !== c.d) continue;
      const ahead = (q.s - c.s) * c.d; if (ahead < -1 || ahead > 45) continue;
      const J = T.junc[q.j]; let hold;
      if (pr && J.k === 'signal') hold = sigState(q.j, q.ph, T.t) !== 'g';
      else hold = [...inside[q.j]].some((o) => o !== c.r);
      if (hold) limit = Math.min(limit, ahead);
    }
    for (const o of T.cars) {                           // follow the vehicle ahead, whatever route it is on
      if (o === c || !o.on) continue; const dx = o.x - c.x, dy = o.y - c.y, f = dx * c.hx + dy * c.hy;
      if (f <= 0 || f > 40) continue; const lat = Math.abs(-dx * c.hy + dy * c.hx);
      if (lat < 1.7 && o.hx * c.hx + o.hy * c.hy > .4) limit = Math.min(limit, f - (o.bus ? 9 : 6.5));
    }
    const want = Math.max(0, Math.min(v0 * (c.bus ? .82 : 1) * (1 + (i % 5) * .05), limit * 1.1));
    c.v += Math.max(-14 * dt, Math.min(4 * dt, want - c.v)); if (limit < .4) c.v = 0;
    c.s += c.d * c.v * dt;
    if (c.s > r.len || c.s < 0) { c.s = c.d > 0 ? 0 : r.len; c.v = v0 * .6; }
    lanePos(r, c.s, lane, P2); lanePos(r, c.s + c.d * 2.2, lane, P3);
    const hx = P3[0] - P2[0], hy = P3[1] - P2[1], hl = Math.hypot(hx, hy) || 1; c.x = P2[0]; c.y = P2[1]; c.hx = hx / hl; c.hy = hy / hl;
  });
  T.cars.forEach((c, i) => {
    if (!c.on) { tmp.scale.setScalar(.0001); tmp.position.set(0, -50, 0); }
    else { const h0 = hR(c.x - c.hx * 1.6, c.y - c.hy * 1.6), h1 = hR(c.x + c.hx * 1.6, c.y + c.hy * 1.6);
      tmp.position.set(c.x - CX, (h0 + h1) / 2 + .16, -(c.y - CY)); tmp.rotation.set(0, Math.atan2(c.hy, c.hx), Math.atan2(h1 - h0, 3.2), 'YZX');
      const edge = Math.min(c.s, net.routes[c.r].len - c.s), k = Math.min(1, edge / 6);          // slip in and out at the frame edge
      tmp.scale.set((c.bus ? 2.5 : 1) * k, (c.bus ? 1.75 : 1) * k, (c.bus ? 1.3 : 1) * k); }
    tmp.updateMatrix(); X.cars.setMatrixAt(i, tmp.matrix);
    if (c.bus) { tmp.scale.setScalar(.0001); tmp.updateMatrix(); }
    X.cabs.setMatrixAt(i, tmp.matrix);
  });
  X.cars.instanceMatrix.needsUpdate = true; X.cabs.instanceMatrix.needsUpdate = true;
}

function resize() {
  const a = innerWidth / innerHeight, c = X.cam; c.left = -BASE * a / 2; c.right = BASE * a / 2; c.top = BASE / 2; c.bottom = -BASE / 2; c.updateProjectionMatrix();
  X.renderer.setSize(innerWidth, innerHeight, false);
}

// camera: target (CAD x,y), azimuth°, elevation°, view = metres visible vertically
function camState() {
  const o = X.cam.position.clone().sub(X.ctl.target), r = o.length();
  return { t: [X.ctl.target.x + CX, CY - X.ctl.target.z], az: Math.atan2(o.x, o.z) * 180 / Math.PI, el: Math.asin(o.y / r) * 180 / Math.PI, view: BASE / X.cam.zoom };
}
function applyCam(s) {
  const t = v3g(s.t[0], s.t[1]), az = s.az * Math.PI / 180, el = s.el * Math.PI / 180, r = 1200;
  X.ctl.target.copy(t); X.cam.position.set(t.x + Math.sin(az) * Math.cos(el) * r, t.y + Math.sin(el) * r, t.z + Math.cos(az) * Math.cos(el) * r);
  X.cam.zoom = BASE / s.view; X.cam.updateProjectionMatrix(); X.cam.lookAt(t);
}
let camTw = null;
export function setCam(to, dur = 2400) {
  if (camTw) camTw.cancel();
  if (!dur) { applyCam(to); return Promise.resolve(); }
  const a = camState(); let daz = ((to.az - a.az + 540) % 360) - 180;
  X.ctl.enabled = false;
  camTw = tween(dur, (k) => applyCam({ t: [a.t[0] + (to.t[0] - a.t[0]) * k, a.t[1] + (to.t[1] - a.t[1]) * k], az: a.az + daz * k, el: a.el + (to.el - a.el) * k, view: Math.exp(Math.log(a.view) + (Math.log(to.view) - Math.log(a.view)) * k) }));
  return camTw.done.then((ok) => { if (ok) X.ctl.enabled = true; });
}

export function labels(groups) { X.labels.forEach((l) => l.el.classList.toggle('off', !groups.includes(l.group))); }

// existing <-> redesigned. reveal sweeps the new road in from the market end northwards.
let revTw = null;
export function setMode(mode, animate = true) {
  X.mode = mode; if (revTw) revTw.cancel();
  marketVisible(mode !== 'ex'); X.sky.visible = mode !== 'ex'; X.treeDes.forEach((m) => { m.visible = mode !== 'ex'; });
  if (mode === 'ex') { X.pr.visible = false; X.ex.visible = true; X.exEdge.visible = false; X.clip.constant = -500; }
  else {
    X.pr.visible = true; X.ex.visible = false; X.exEdge.visible = mode === 'cmp';
    if (animate) { X.ex.visible = true; revTw = tween(3200, (k) => { X.clip.constant = -400 + 800 * k; }, ease.io); revTw.done.then((ok) => { if (ok && X.mode !== 'ex') X.ex.visible = false; }); }
    else X.clip.constant = 500;
  }
}
export function marketVisible(on) { X.lm.market.visible = on; (X.marketSite || []).forEach((m) => { m.visible = !on; }); X.pick = X.bg.children.filter((m) => m.visible); }
export function highlight(kind) {
  X.pick.forEach((m) => {
    const b = m.userData.b; let mat = m.userData.base;
    if (kind === 'front') mat = b.f === 2 ? X.mat.cut : b.f === 1 ? X.mat.edge : X.mat.ghost;
    if (kind === 'her') mat = b.her ? X.mat.her : X.mat.ghost;
    m.userData.cur = mat; m.material = mat;
  });
  X.edges.material.opacity = kind ? .3 : .62; X.floors.material.opacity = kind ? .12 : .38;
}
let contTw = null;
// terrain reading: elevation tint fades onto the ground, contours strengthen, buildings turn to glass
export function contours(on) {
  if (contTw) contTw.cancel(); const from = X.tint.userData.k || 0, to = on ? 1 : 0; if (on) X.tint.visible = true;
  contTw = tween(1400, (k) => { const f = from + (to - from) * k; X.tint.userData.k = f; X.tint.material.opacity = f * .95; X.cont.children.forEach((l) => { l.material.opacity = l.userData.o + (1 - l.userData.o) * f; }); });
  contTw.done.then((ok) => { if (ok && !on) X.tint.visible = false; });
  [X.mat.wall, X.mat.her].forEach((m) => { m.transparent = on; m.opacity = on ? .3 : 1; m.needsUpdate = true; });
}
let exTw = null;
export function explodeMarket(on) {
  if (exTw) exTw.cancel(); const from = X.lmExplode, to = on ? 1 : 0;
  exTw = tween(1600, (k) => { X.lmExplode = from + (to - from) * k; X.lm.market.userData.explode(X.lmExplode); });
}

// ------------------------------------------------------------------ loop
const tmp = new THREE.Object3D(), pv = new THREE.Vector3(), tv = new THREE.Vector3();
export function start() {
  if (X.running) return; X.running = true;
  (function loop() {
    if (!X.running) return;
    requestAnimationFrame(loop);
    const dt = Math.min(.05, X.clock.getDelta());
    X.ctl.update();
    stepTraffic(dt);
    X.renderer.render(X.scene, X.cam);
    // project labels
    const w = innerWidth / 2, h = innerHeight / 2;
    X.labels.forEach((l) => { if (l.el.classList.contains('off')) return; pv.copy(l.p).project(X.cam); l.el.style.transform = `translate(${(pv.x * w + w).toFixed(1)}px,${(-pv.y * h + h).toFixed(1)}px) translate(-50%,-100%) translateY(-26px)`; });
  })();
}
export function stop() { X.running = false; }
export const CAMS = {
  top: { t: [CX, CY], az: 0, el: 89.9, view: 900 },
  axo: { t: [CX + 10, CY - 10], az: -38, el: 38, view: 640 },
  spine: { t: [284, 470], az: 52, el: 34, view: 330 },
  round: { t: [283, 356], az: -28, el: 44, view: 170 },
  section: { t: [284, 600], az: 8, el: 30, view: 150 },
  north: { t: [262, 665], az: 140, el: 36, view: 260 },
  her: { t: [290, 640], az: -55, el: 42, view: 230 },
  terrain: { t: [CX - 10, CY - 20], az: -62, el: 24, view: 600 },
  palace: { t: [282, 800], az: -34, el: 33, view: 92 },
  bus: { t: [352, 388], az: 38, el: 36, view: 150 },
  market: { t: [205, 118], az: -42, el: 30, view: 150 },
  court: { t: [236, 418], az: 62, el: 32, view: 170 },
  sky: { t: [287, 156], az: -24, el: 36, view: 130 },
  signal: { t: [287, 160], az: 30, el: 48, view: 110 }};
void mouse;
