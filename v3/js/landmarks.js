// Procedural landmark models (metres, y up, entrance toward +z).
// Interpretive massing for presentation — not measured drawings.
import * as THREE from 'three';

const INK = 0x0A1F4D;
const mat = (c, o = {}) => new THREE.MeshLambertMaterial({ color: c, ...o });
const P = {
  lime: mat(0xFBFAF5), plinth: mat(0xC9A58A), tile: mat(0xD0603F, { side: THREE.DoubleSide }), tile2: mat(0xB9502F, { side: THREE.DoubleSide }),
  timber: mat(0x7A5A3C), stone: mat(0xE6EAF2), glass: mat(0x8FB4F2, { transparent: true, opacity: .42 }), slab: mat(0xFFFFFF),
  steel: mat(0x33456F), asphalt: mat(0x3A4868), blue: mat(0x1D4ED8), hot: mat(0xF0522B), amber: mat(0xF2A93B), green: mat(0x1FA37A),
  solar: mat(0x14306E), stall: mat(0xF6E2B8), palm: mat(0x2E9B6E, { flatShading: true }), trunk: mat(0x8A6A4A),
};
const edgeMat = new THREE.LineBasicMaterial({ color: INK, transparent: true, opacity: .7 });

function withEdges(mesh, thr = 25) { mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry, thr), edgeMat)); return mesh; }
function box(g, w, h, d, m, x = 0, y = 0, z = 0, edges = true) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); mesh.position.set(x, y + h / 2, z); if (edges) withEdges(mesh); g.add(mesh); return mesh;
}
function geo(g, positions, m, x = 0, y = 0, z = 0) {
  const b = new THREE.BufferGeometry(); b.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); b.computeVertexNormals();
  const mesh = withEdges(new THREE.Mesh(b, m), 12); mesh.position.set(x, y, z); g.add(mesh); return mesh;
}
const quad = (a, b, c, d) => [...a, ...b, ...c, ...a, ...c, ...d];
// hip roof on a w x d rectangle, ridge along the longer side
function hip(g, w, d, h, m, x, y, z) {
  const alongX = w >= d, r = Math.abs(w - d) / 2;
  const A = [-w / 2, 0, d / 2], B = [w / 2, 0, d / 2], C = [w / 2, 0, -d / 2], D = [-w / 2, 0, -d / 2];
  const E = alongX ? [-r, h, 0] : [0, h, r], F = alongX ? [r, h, 0] : [0, h, -r];
  const pos = alongX ? [...quad(A, B, F, E), ...B, ...C, ...F, ...quad(C, D, E, F), ...D, ...A, ...E] : [...A, ...B, ...E, ...quad(B, C, F, E), ...C, ...D, ...F, ...quad(D, A, E, F)];
  return geo(g, pos, m, x, y, z);
}
// gable roof (ridge along x)
function gable(g, w, d, h, m, x, y, z, rotY = 0) {
  const A = [-w / 2, 0, d / 2], B = [w / 2, 0, d / 2], C = [w / 2, 0, -d / 2], D = [-w / 2, 0, -d / 2], E = [-w / 2, h, 0], F = [w / 2, h, 0];
  const mesh = geo(g, [...quad(A, B, F, E), ...quad(C, D, E, F), ...B, ...C, ...F, ...D, ...A, ...E], m, x, y, z); mesh.rotation.y = rotY; return mesh;
}
// roof ring around a courtyard: outer eave -> ridge loop -> inner eave
function ringRoof(g, W, D, cw, cd, h, m, y, over = 1.3) {
  const o = [[-W / 2 - over, D / 2 + over], [W / 2 + over, D / 2 + over], [W / 2 + over, -D / 2 - over], [-W / 2 - over, -D / 2 - over]];
  const i = [[-cw / 2, cd / 2], [cw / 2, cd / 2], [cw / 2, -cd / 2], [-cw / 2, -cd / 2]];
  const r = o.map((p, k) => [(p[0] + i[k][0]) / 2, (p[1] + i[k][1]) / 2]);
  const pos = [];
  for (let k = 0; k < 4; k++) { const n = (k + 1) % 4;
    pos.push(...quad([o[k][0], 0, o[k][1]], [o[n][0], 0, o[n][1]], [r[n][0], h, r[n][1]], [r[k][0], h, r[k][1]]));
    pos.push(...quad([r[k][0], h, r[k][1]], [r[n][0], h, r[n][1]], [i[n][0], h * .35, i[n][1]], [i[k][0], h * .35, i[k][1]])); }
  return geo(g, pos, m, 0, y, 0);
}
function slats(g, w, h, n, x, y, z, rotY = 0) {
  const pts = []; for (let k = 0; k <= n; k++) { const xx = -w / 2 + w * k / n; pts.push(xx, 0, 0, xx, h, 0); }
  const b = new THREE.BufferGeometry(); b.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  const l = new THREE.LineSegments(b, new THREE.LineBasicMaterial({ color: INK, transparent: true, opacity: .55 })); l.position.set(x, y, z); l.rotation.y = rotY; g.add(l); return l;
}
export function palm(h = 8) {
  const g = new THREE.Group(), t = new THREE.Mesh(new THREE.CylinderGeometry(.16, .26, h, 5), P.trunk); t.position.y = h / 2; t.rotation.z = .05; g.add(t);
  for (let k = 0; k < 7; k++) { const f = new THREE.Mesh(new THREE.ConeGeometry(.5, 3.6, 4), P.palm); const a = k / 7 * Math.PI * 2; f.position.set(Math.cos(a) * 1.5, h - .2, Math.sin(a) * 1.5); f.rotation.set(Math.sin(a) * 1.25, 0, -Math.cos(a) * 1.25); f.castShadow = true; g.add(f); }
  t.castShadow = true; return g;
}

// ---------------------------------------------------------------- Koyikkal Palace
export function buildPalace() {
  const g = new THREE.Group(), W = 27, D = 21, cw = 9, cd = 6, wing = (W - cw) / 2, wingD = (D - cd) / 2;
  box(g, W + 5, .9, D + 5, P.plinth, 0, 0, 0);                               // laterite plinth
  box(g, 7, .3, 3, P.plinth, 0, 0, D / 2 + 4);                                // entry steps
  const y0 = .9, h1 = 3.3, h2 = 2.9;
  // ground storey — lime-washed walls around the nadumuttam
  box(g, W, h1, wingD, P.lime, 0, y0, D / 2 - wingD / 2); box(g, W, h1, wingD, P.lime, 0, y0, -D / 2 + wingD / 2);
  box(g, wing, h1, cd, P.lime, -W / 2 + wing / 2, y0, 0); box(g, wing, h1, cd, P.lime, W / 2 - wing / 2, y0, 0);
  // verandah skirt roof
  const sk = []; const o = [[-W / 2 - 2.6, D / 2 + 2.6], [W / 2 + 2.6, D / 2 + 2.6], [W / 2 + 2.6, -D / 2 - 2.6], [-W / 2 - 2.6, -D / 2 - 2.6]], i = [[-W / 2, D / 2], [W / 2, D / 2], [W / 2, -D / 2], [-W / 2, -D / 2]];
  for (let k = 0; k < 4; k++) { const n = (k + 1) % 4; sk.push(...quad([o[k][0], 0, o[k][1]], [o[n][0], 0, o[n][1]], [i[n][0], 1.1, i[n][1]], [i[k][0], 1.1, i[k][1]])); }
  geo(g, sk, P.tile2, 0, y0 + h1 - .9, 0);
  for (let k = 0; k < 4; k++) { const n = (k + 1) % 4, cnt = k % 2 ? 6 : 8; for (let j = 0; j <= cnt; j++) { const x = o[k][0] + (o[n][0] - o[k][0]) * j / cnt, z = o[k][1] + (o[n][1] - o[k][1]) * j / cnt; box(g, .28, h1 - .9, .28, P.timber, x * .97, y0, z * .97, false); } }
  // upper storey — timber screened gallery
  const y1 = y0 + h1;
  box(g, W - .6, h2, wingD - .4, P.timber, 0, y1, D / 2 - wingD / 2); box(g, W - .6, h2, wingD - .4, P.timber, 0, y1, -D / 2 + wingD / 2);
  box(g, wing - .4, h2, cd + .4, P.timber, -W / 2 + wing / 2, y1, 0); box(g, wing - .4, h2, cd + .4, P.timber, W / 2 - wing / 2, y1, 0);
  slats(g, W - .6, h2, 46, 0, y1, D / 2 - .18); slats(g, W - .6, h2, 46, 0, y1, -D / 2 + .18); slats(g, D - .6, h2, 36, W / 2 - .28, y1, 0, Math.PI / 2); slats(g, D - .6, h2, 36, -W / 2 + .28, y1, 0, Math.PI / 2);
  // main roof ring + gables (mukhappu) + finials
  const yr = y1 + h2; ringRoof(g, W, D, cw, cd, 4.4, P.tile, yr);
  gable(g, 4.6, 3.4, 2.1, P.tile2, 0, yr + 1.5, D / 2 + .2, 0).rotation.y = Math.PI / 2;
  gable(g, 4.6, 3.4, 2.1, P.tile2, 0, yr + 1.5, -D / 2 - .2, 0).rotation.y = Math.PI / 2;
  [[-1, 1], [1, 1], [1, -1], [-1, -1]].forEach(([sx, sz]) => { const f = new THREE.Mesh(new THREE.ConeGeometry(.22, 1.1, 6), P.timber); f.position.set(sx * (W / 2 + 1.3 + cw / 2) / 2, yr + 4.9, sz * (D / 2 + 1.3 + cd / 2) / 2); g.add(f); });
  // poomukham (entrance portico)
  box(g, 6.4, .5, 4.2, P.plinth, 0, .9, D / 2 + 3.4); [[-2.8, 1.7], [2.8, 1.7], [-2.8, -1.7], [2.8, -1.7]].forEach(([x, z]) => box(g, .32, 2.9, .32, P.timber, x, 1.4, D / 2 + 3.4 + z, false));
  hip(g, 7.8, 5.6, 2.2, P.tile, 0, 4.3, D / 2 + 3.4);
  // compound wall + padippura (gate house)
  const cwall = (w, d, x, z) => box(g, w, 1.5, d, P.lime, x, 0, z);
  cwall(46, .5, 0, -19); cwall(.5, 40, -23, 1); cwall(.5, 40, 23, 1); cwall(18, .5, -14, 21); cwall(18, .5, 14, 21);
  box(g, 5, 2.8, 3.2, P.lime, 0, 0, 21); gable(g, 6.4, 4.8, 1.9, P.tile, 0, 2.8, 21);
  return g;
}

// ---------------------------------------------------------------- KSRTC bus stand
export function buildBusStand(L = 78, Wd = 22) {
  const g = new THREE.Group(); L = Math.max(60, Math.min(L, 96)); Wd = Math.max(16, Math.min(Wd, 26));
  box(g, L + 14, .12, Wd + 34, P.asphalt, 0, 0, 9, false);                    // bus yard apron
  box(g, L, .45, Wd, P.stone, 0, .1, -6);                                      // platform
  const n = Math.round(L / 6.5);
  for (let k = 0; k <= n; k++) { const x = -L / 2 + L * k / n; box(g, .45, 5.6, .45, P.steel, x, .5, -6 + Wd / 2 - 1, false); box(g, .45, 5.6, .45, P.steel, x, .5, -6 - Wd / 2 + 1, false);
    const t = new THREE.Mesh(new THREE.BoxGeometry(.25, .5, Wd + 5), P.steel); t.position.set(x, 6.2, -5); g.add(t); }
  box(g, L + 3, .3, Wd + 7, P.glass, 0, 6.4, -5);                               // glazed canopy roof
  for (let k = 0; k <= n; k++) box(g, .5, .5, Wd + 7, P.slab, -L / 2 + L * k / n, 6.3, -5, false);
  box(g, L + 3, .9, .3, P.blue, 0, 5.9, -5 + (Wd + 7) / 2);                    // fascia band
  box(g, 15, 8.6, Wd - 3, P.lime, -L / 2 + 8.5, .5, -6); box(g, 15.2, 2.2, Wd - 2.8, P.glass, -L / 2 + 8.5, 5.2, -6, false);     // office block
  box(g, 15.6, .4, Wd - 2, P.slab, -L / 2 + 8.5, 9.1, -6);
  for (let k = 0; k < 6; k++) box(g, 2.6, .5, 1, P.stall, -L / 2 + 22 + k * 8.5, .55, -8, true);     // benches
  // sawtooth bays with buses
  const bays = Math.floor((L - 8) / 7.6);
  for (let k = 0; k < bays; k++) {
    const x = -L / 2 + 8 + k * 7.6, bay = new THREE.Group(); bay.position.set(x, .12, 12); bay.rotation.y = -.5;
    const ln = new THREE.Mesh(new THREE.BoxGeometry(.18, .02, 13), P.slab); ln.position.set(-1.9, .02, 0); bay.add(ln);
    if (k % 3 !== 1) { box(bay, 2.7, 2.7, 10.6, P.lime, 0, .5, 0); box(bay, 2.74, .7, 10.64, P.hot, 0, 1.1, 0, false); box(bay, 2.76, .8, 10.0, P.glass, 0, 2.05, 0, false); }
    g.add(bay);
  }
  return g;
}

// ---------------------------------------------------------------- New market (proposal)
export function buildMarket() {
  const g = new THREE.Group(), W = 46, D = 36, fh = 4.2, floors = [];
  // basement parking shown as a recessed outline + ramp
  box(g, W + 8, .2, D + 8, P.stone, 0, 0, 0);
  const ramp = geo(g, [...quad([-4, 0, 0], [4, 0, 0], [4, -2.4, -14], [-4, -2.4, -14])], P.asphalt, W / 2 - 6, .22, D / 2 + 14); void ramp;
  const mk = (k, label) => { const f = new THREE.Group(); f.userData = { k, label, y: .2 + k * fh }; f.position.y = f.userData.y; g.add(f); floors.push(f); return f; };
  const plate = (f, hole = true) => { box(f, W, .35, D, P.slab, 0, 0, 0); if (hole) box(f, 10.4, .37, 8.4, P.stone, 0, 0, 0, true); };
  const cols = (f) => { for (let x = -W / 2 + 1; x <= W / 2; x += 8.8) for (let z = -D / 2 + 1; z <= D / 2; z += 8.5) box(f, .6, fh - .35, .6, P.steel, x, .35, z, false); };
  // G — wet market: 48 fish + 24 meat stalls
  let f = mk(0, 'Ground · fish & meat · 72 stalls'); plate(f, false); cols(f);
  for (let r = 0; r < 4; r++) for (let c = 0; c < 9; c++) { const x = -W / 2 + 5 + c * 4.5, z = -D / 2 + 6 + r * 8; if (Math.abs(x) < 6 && Math.abs(z) < 5) continue; box(f, 3.2, 1, 2.2, r < 3 ? P.blue : P.hot, x, .35, z, true); }
  // 1 — produce hall: 112 stalls
  f = mk(1, 'First · produce, grocery, pottery · 112 stalls'); plate(f); cols(f);
  for (let r = 0; r < 6; r++) for (let c = 0; c < 12; c++) { const x = -W / 2 + 3.5 + c * 3.55, z = -D / 2 + 4 + r * 5.6; if (Math.abs(x) < 7 && Math.abs(z) < 6) continue; box(f, 2.3, .9, 1.7, (r + c) % 3 ? P.green : P.amber, x, .35, z, false); }
  // 2 — food court: 8 outlets, 120 seats
  f = mk(2, 'Second · food court · 8 outlets · 120 seats'); plate(f); cols(f);
  for (let c = 0; c < 8; c++) box(f, 4.2, 2.6, 3, P.hot, -W / 2 + 4.6 + c * 5.25, .35, -D / 2 + 3, true);
  for (let r = 0; r < 3; r++) for (let c = 0; c < 10; c++) { const x = -W / 2 + 4 + c * 4.2, z = -2 + r * 6; if (Math.abs(x) < 7 && Math.abs(z) < 6) continue; const t = new THREE.Mesh(new THREE.CylinderGeometry(.9, .9, .12, 10), P.stall); t.position.set(x, 1.1, z); f.add(t); }
  // 3 — upper floor
  f = mk(3, 'Third · shops & offices'); plate(f); cols(f);
  for (let c = 0; c < 9; c++) { box(f, 4.4, 2.8, 5, P.stone, -W / 2 + 4 + c * 4.75, .35, -D / 2 + 4, true); box(f, 4.4, 2.8, 5, P.stone, -W / 2 + 4 + c * 4.75, .35, D / 2 - 4, true); }
  // roof — 33 kW solar, lift cores
  f = mk(4, 'Roof · 33 kW solar · rainwater'); plate(f, false);
  for (let r = 0; r < 4; r++) for (let c = 0; c < 9; c++) { const p = box(f, 3.6, .12, 2.2, P.solar, -W / 2 + 6 + c * 4.2, 1, -D / 2 + 9 + r * 3.6, true); p.rotation.x = -.3; }
  box(f, 5, 3.2, 5, P.lime, W / 2 - 5, .35, D / 2 - 5); box(f, 5, 3.2, 5, P.lime, -W / 2 + 5, .35, D / 2 - 5);
  // skin: glazing + vertical fins per floor, attached to each floor so the model can explode
  floors.slice(1, 4).forEach((fl) => {
    [[W, D / 2 + .1, 0], [W, -D / 2 - .1, 0], [D, W / 2 + .1, 1], [D, -W / 2 - .1, 1]].forEach(([len, off, side]) => {
      const gl = new THREE.Mesh(new THREE.BoxGeometry(side ? .15 : len, fh - .5, side ? len : .15), P.glass); gl.position.set(side ? off : 0, fh / 2 + .15, side ? 0 : off); fl.add(gl);
      slats(fl, len, fh - .4, Math.round(len / 1.4), side ? off * 1.012 : 0, .35, side ? 0 : off * 1.012, side ? Math.PI / 2 : 0);
    });
  });
  // biogas plant + service yard
  const bio = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 3.2, 20), P.green); bio.position.set(-W / 2 - 9, 1.8, -D / 2 + 6); withEdges(bio, 30); g.add(bio);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(3, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), P.green); dome.position.set(-W / 2 - 9, 3.4, -D / 2 + 6); g.add(dome);
  g.userData.floors = floors;
  g.userData.explode = (t) => floors.forEach((fl) => { fl.position.y = fl.userData.y + fl.userData.k * 6.5 * t; });
  return g;
}

// ---------------------------------------------------------------- Court complex (two CAD footprints)
// Front range along the road: long two-storey arcaded verandah block under a tiled hip roof.
export function buildCourtBar(L = 80, D = 13) {
  const g = new THREE.Group(), W = L - 1, dd = D - 1, h = 3.8, n = Math.max(8, Math.round(W / 3.6));
  box(g, W + 1.6, .9, dd + 1.6, P.plinth, 0, 0, 0);
  for (let s = 0; s < 2; s++) {
    const y = .9 + s * h;
    box(g, W, h, dd - 3, P.lime, 0, y, -1.5);
    box(g, W, .3, 3.2, P.slab, 0, y + h - .3, dd / 2 - 1.5);
    for (let k = 0; k <= n; k++) box(g, .45, h - .3, .45, P.lime, -W / 2 + .3 + (W - .6) * k / n, y, dd / 2 - .2, true);
    for (let k = 0; k < n; k++) { const a = new THREE.Mesh(new THREE.TorusGeometry((W - .6) / n / 2 - .25, .1, 4, 10, Math.PI), P.lime); a.position.set(-W / 2 + .3 + (W - .6) * (k + .5) / n, y + h - 1.75, dd / 2 - .2); g.add(a); }
    for (let k = 0; k < n; k += 2) box(g, 1.3, 2.2, .1, P.timber, -W / 2 + 2 + (W - 4) * k / n, y + .4, dd / 2 - 3.02, false);
    if (s) slats(g, W, 1, n * 3, 0, y, dd / 2 - .15);
  }
  hip(g, W + 2.2, dd + 2.4, 3.8, P.tile, 0, .9 + 2 * h, 0);
  // entrance bay with pediment, mid-range
  box(g, 9, .35, 4.6, P.slab, 0, .9 + 2 * h - .35, dd / 2 + 2);
  [-3.8, -1.3, 1.3, 3.8].forEach((x) => { const c = new THREE.Mesh(new THREE.CylinderGeometry(.38, .46, 2 * h - .35, 12), P.lime); c.position.set(x, .9 + (2 * h - .35) / 2, dd / 2 + 3.9); withEdges(c, 40); g.add(c); });
  gable(g, 4.8, 9.6, 2.3, P.tile2, 0, .9 + 2 * h, dd / 2 + 2, Math.PI / 2);
  box(g, 7, .3, 2.4, P.plinth, 0, 0, dd / 2 + 5.4); box(g, 6, .6, 1.4, P.plinth, 0, 0, dd / 2 + 4.6);
  box(g, .12, 8, .12, P.steel, -8, .9, dd / 2 + 5, false); box(g, 1.9, 1.2, .06, P.hot, -7, 7.6, dd / 2 + 5, false);
  return g;
}
// Main block behind it: three storeys of court halls around a light court, deep verandahs, tiled ring roof.
export function buildCourtBlock(W = 44, D = 42) {
  const g = new THREE.Group(), w = W - 1, d = D - 1, h = 3.9, F = 3, cw = w * .34, cd = d * .34;
  box(g, w + 2, 1.1, d + 2, P.plinth, 0, 0, 0);
  for (let s = 0; s < F; s++) {
    const y = 1.1 + s * h;
    // four wings around the court
    box(g, w, h, (d - cd) / 2 - 2.6, P.lime, 0, y, -(d + cd) / 4 - 1.3 + .0); box(g, w, h, (d - cd) / 2 - 2.6, P.lime, 0, y, (d + cd) / 4 - 1.3);
    box(g, (w - cw) / 2 - 2.6, h, cd + 5.2, P.lime, -(w + cw) / 4, y, 0); box(g, (w - cw) / 2 - 2.6, h, cd + 5.2, P.lime, (w + cw) / 4, y, 0);
    box(g, w + .6, .32, d + .6, P.slab, 0, y + h - .32, 0);
    const nx = Math.round(w / 3.8), nz = Math.round(d / 3.8);
    for (let k = 0; k <= nx; k++) { const x = -w / 2 + .3 + (w - .6) * k / nx; box(g, .5, h - .32, .5, P.lime, x, y, d / 2, false); box(g, .5, h - .32, .5, P.lime, x, y, -d / 2, false); }
    for (let k = 1; k < nz; k++) { const z = -d / 2 + d * k / nz; box(g, .5, h - .32, .5, P.lime, w / 2, y, z, false); box(g, .5, h - .32, .5, P.lime, -w / 2, y, z, false); }
    slats(g, w, 1, nx * 3, 0, y, d / 2 + .28); slats(g, w, 1, nx * 3, 0, y, -d / 2 - .28);
    slats(g, d, 1, nz * 3, w / 2 + .28, y, 0, Math.PI / 2); slats(g, d, 1, nz * 3, -w / 2 - .28, y, 0, Math.PI / 2);
    for (let k = 0; k < nx; k += 2) box(g, 1.5, 2.3, .1, P.timber, -w / 2 + 3 + (w - 6) * k / nx, y + .4, d / 2 - 2.55, false);
  }
  const top = 1.1 + F * h;
  ringRoof(g, w, d, cw, cd, 4.4, P.tile, top, 1.5);
  // stair / lift towers at two rear corners, water tank
  box(g, 5, 4.4, 5, P.lime, -w / 2 + 3, top - .4, -d / 2 + 3); box(g, 5, 4.4, 5, P.lime, w / 2 - 3, top - .4, -d / 2 + 3);
  // entrance: double-height portico with pediment and steps
  box(g, 14, .4, 6.4, P.slab, 0, 1.1 + 2 * h - .4, d / 2 + 3.2);
  [-6, -3.6, -1.2, 1.2, 3.6, 6].forEach((x) => { const c = new THREE.Mesh(new THREE.CylinderGeometry(.46, .56, 2 * h - .4, 12), P.lime); c.position.set(x, 1.1 + (2 * h - .4) / 2, d / 2 + 5.8); withEdges(c, 40); g.add(c); });
  gable(g, 6.6, 14.8, 3, P.tile2, 0, 1.1 + 2 * h, d / 2 + 3.2, Math.PI / 2);
  [0, 1, 2].forEach((k) => box(g, 15 - k * .9, .36, 2.6 - k * .7, P.plinth, 0, k * .36, d / 2 + 7.6 - k * .35));
  box(g, .14, 10, .14, P.steel, -11, 1.1, d / 2 + 8, false); box(g, 2.2, 1.4, .06, P.hot, -9.85, 9.6, d / 2 + 8, false);
  box(g, 6, 1.6, .25, P.steel, 0, 1.1 + 2 * h + .3, d / 2 + 6.5, false);            // name board
  return g;
}
