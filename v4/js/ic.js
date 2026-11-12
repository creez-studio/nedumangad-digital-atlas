// Interpretation Centre: the team's SketchUp model (exported per element) placed in the design stretch.
// data/ic.json holds buildings → parts → material chunks; data/ic.bin holds the triangles (Int16, cm around O).
// Each part sits on an explode level (k): plinth → floors → walls → upper floor → roof structure → roof.
import * as THREE from 'three';
import { C } from './content.js';
import { tip, tween, ease, cursorMode } from './ui.js';
import { palm } from './landmarks.js';

export const IC = { ready: false, parts: [], blds: {}, mode: 'theme', explode: {} };

export function inPoly(p, poly) {
  let r = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < a[0] + (p[1] - a[1]) * (b[0] - a[0]) / (b[1] - a[1])) r = !r;
  }
  return r;
}

// fetch the model and regrade the stretch DEM inside the site to the design's own ground levels
export async function loadIC(D) {
  const [meta, buf] = await Promise.all([fetch('data/ic.json').then((r) => r.json()), fetch('data/ic.bin').then((r) => r.arrayBuffer())]);
  IC.meta = meta; IC.q = new Int16Array(buf); IC.hull = meta.hull;
  meta.ground.forEach(([k, h]) => { D.z[k] = h; D.zr[k] = h; });
  return IC;
}

const hex = (c) => new THREE.Color(c);
export function buildIC(scene, CX, CY) {
  const M = IC.meta, q = IC.q, O = M.O, root = IC.root = new THREE.Group();
  const lam = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  const glass = new THREE.MeshLambertMaterial({ color: 0x8FB4F2, transparent: true, opacity: .42, side: THREE.DoubleSide, depthWrite: false });
  const ink = new THREE.LineBasicMaterial({ color: C.ink, transparent: true, opacity: .42 });
  IC.hov = new THREE.MeshLambertMaterial({ color: 0x5B8DEF, side: THREE.DoubleSide });
  IC.lam = lam;
  const tc = {}; Object.entries(M.theme).forEach(([k, v]) => { tc[k] = hex(v); });

  M.blds.forEach((B) => {
    const bg = new THREE.Group(); bg.userData.B = B; root.add(bg);
    IC.blds[B.name] = { B, g: bg, parts: [] };
    const step = B.name === 'Site' ? 0 : B.detail ? 4.2 : 1.9;
    B.parts.forEach((P) => {
      const pg = new THREE.Group(); pg.userData = { k: P.k, step }; bg.add(pg);
      const op = [], col = [], orig = [], gl = [];
      P.ch.forEach(([cat, oc, s, n]) => {
        const dst = cat === 'glass' ? gl : op, t = tc[cat] || tc.wall, o = hex(oc);
        for (let i = s * 9, e = (s + n) * 9; i < e; i += 3) {
          dst.push(q[i] / 100 + O[0] - CX, q[i + 2] / 100 + O[2], -(q[i + 1] / 100 + O[1] - CY));
          if (dst === op) { col.push(t.r, t.g, t.b); orig.push(o.r, o.g, o.b); }
        }
      });
      if (op.length) {
        const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(op, 3));
        const ca = new THREE.Float32BufferAttribute(col, 3); g.setAttribute('color', ca); g.computeVertexNormals();
        g.userData = { theme: new Float32Array(col), orig: new Float32Array(orig) };
        const m = new THREE.Mesh(g, lam); m.castShadow = B.name !== 'Site'; m.receiveShadow = true;
        m.userData = { B, P }; pg.add(m); IC.parts.push(m);
        // the atlas line work: ink edges on built form (skipped on dense seating / foliage / ground)
        if (B.name !== 'Site' && op.length / 9 < 9000 && !/seat|court/i.test(P.e)) pg.add(new THREE.LineSegments(new THREE.EdgesGeometry(g, 32), ink));
        if (B.name === 'Site' && /Compound wall/i.test(P.e)) pg.add(new THREE.LineSegments(new THREE.EdgesGeometry(g, 40), ink));
      }
      if (gl.length) {
        const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(gl, 3)); g.computeVertexNormals();
        const m = new THREE.Mesh(g, glass); m.renderOrder = 5; m.userData = { B, P }; pg.add(m);
      }
      IC.blds[B.name].parts.push(pg);
    });
  });

  // trees from the model, drawn in the atlas tree style
  const can = new THREE.IcosahedronGeometry(1, 0), trunk = new THREE.CylinderGeometry(.22, .3, 1, 5);
  const leaf = new THREE.MeshLambertMaterial({ color: 0x1FA37A, flatShading: true }), leaf2 = new THREE.MeshLambertMaterial({ color: 0x4CC79A, flatShading: true }), bark = new THREE.MeshLambertMaterial({ color: 0x8A6A4A });
  const tg = IC.trees = new THREE.Group(); root.add(tg);
  M.trees.forEach(([x, y, z, r, h, sp], i) => {
    const p = new THREE.Vector3(x - CX, z, -(y - CY));
    if (/Coconut/i.test(sp)) { const t = palm(Math.max(6, Math.min(14, h))); t.position.copy(p); tg.add(t); return; }
    r = Math.max(1.4, Math.min(6, r)); h = Math.max(3, Math.min(16, h));
    const t = new THREE.Mesh(trunk, bark); t.position.set(p.x, p.y + h * .25, p.z); t.scale.set(r * .45, h * .5, r * .45); tg.add(t);
    const a = new THREE.Mesh(can, /Frangipani/i.test(sp) ? leaf2 : leaf); a.position.set(p.x, p.y + h * .65, p.z); a.scale.set(r, r * .8, r); a.rotation.y = i; a.castShadow = true; tg.add(a);
  });
  scene.add(root);
  IC.ready = true;
  return IC;
}

// hover: name the building and the element under the pointer
export function bindHover(canvas, cam) {
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(); let cur = null;
  canvas.addEventListener('pointermove', (e) => {
    if (!IC.root || !IC.root.visible) return;
    ndc.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); ray.setFromCamera(ndc, cam);
    const hit = ray.intersectObjects(IC.parts, false).find((h) => h.object.userData.B.name !== 'Site');
    if (cur && (!hit || hit.object !== cur)) { cur.material = IC.ghost && cur.userData.B.name !== IC.ghost ? ghostM : IC.lam; cur = null; }
    if (!hit) return;
    const m = hit.object, { B, P } = m.userData; if (cur !== m) { cur = m; m.material = IC.hov; }
    cursorMode('hover');
    tip(`<b>${B.name}</b><span>${P.e} · Interpretation Centre (team SketchUp model)</span>`, e.clientX, e.clientY);
  });
}

// explode one building (name) or all (null); t: 0 closed → 1 open
let exTw = null;
export function explode(name, on, dur = 1400) {
  if (exTw) exTw.cancel();
  const list = name ? [IC.blds[name]] : Object.values(IC.blds);
  const from = list.map((b) => IC.explode[b.B.name] || 0);
  Object.values(IC.blds).forEach((b) => { if (!list.includes(b) && IC.explode[b.B.name]) { IC.explode[b.B.name] = 0; b.parts.forEach((pg) => { pg.position.y = 0; }); } });
  ghost(name && on ? name : null);
  exTw = tween(dur, (k) => list.forEach((b, i) => {
    const f = from[i] + ((on ? 1 : 0) - from[i]) * k; IC.explode[b.B.name] = f;
    b.parts.forEach((pg) => { pg.position.y = pg.userData.k * pg.userData.step * f; });
  }), ease.io);
  return exTw.done;
}

// while one building is open, the rest of the centre turns to glass so the stack reads clearly
let ghostM = null;
function ghost(keep) {
  ghostM = ghostM || new THREE.MeshLambertMaterial({ color: 0xF4F7FD, transparent: true, opacity: .22, depthWrite: false, side: THREE.DoubleSide });
  IC.parts.forEach((m) => { const n = m.userData.B.name; if (n === 'Site' || m.material === IC.hov) return; m.material = keep && n !== keep ? ghostM : IC.lam; });
  IC.ghost = keep;
}

// colour: atlas theme (white massing, tile roofs) or the SketchUp materials
export function setColours(mode) {
  IC.mode = mode;
  IC.parts.forEach((m) => { const g = m.geometry, a = g.attributes.color; a.array.set(mode === 'orig' ? g.userData.orig : g.userData.theme); a.needsUpdate = true; });
}

// camera framing for a building: [cx, cy] in CAD metres + a view height
export function frame(name) {
  const bb = IC.blds[name].B.bb, w = Math.max(bb[3] - bb[0], bb[4] - bb[1]);
  return { t: [(bb[0] + bb[3]) / 2, (bb[1] + bb[4]) / 2], view: Math.max(46, w * 2.1) };
}
