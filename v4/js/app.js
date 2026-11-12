// Shell: loader, hero, chapter navigation, and the two 3D chapters (landmarks, design stretch).
import { C, V, LANDMARKS, WHY, TEAM, SOURCES } from './content.js';
import { $, $$, dock, card, tip, fmt, initCursor, wait, cursorMode, skipper, skipNow, skippable } from './ui.js';
import * as MA from './macro.js';

let MI = null;                         // micro module, loaded on demand
const state = { i: -1, busy: false };

async function micro() {
  if (!MI) { MI = await import('./micro.js'); await MI.initMicro(); }
  return MI;
}
function stage(which) {
  document.body.classList.toggle('is-micro', which === 'three');
  if (MI) which === 'three' ? MI.start() : MI.stop();
  if (which !== 'three') $$('#labels .l3').forEach((l) => l.classList.add('off'));
}

// ------------------------------------------------------------------ 07 landmarks
const chLandmarks = {
  id: 'landmarks', num: '07', title: 'Landmarks in 3D', short: 'Landmarks',
  desc: 'Koyikkal Palace, the bus stand, the market, the court, the interpretation centre and the skywalk concept as detailed models.',
  async enter() {
    dock('left', card(`<div class="kicker">Chapter 07</div><h2>Landmarks</h2>
      <p class="lede">Four buildings give the core its meaning: a royal house, an interchange, a market and a court — plus the team’s interpretation centre and one concept, a ring skywalk over Market junction. Each is modelled on the real ground of the stretch — drag to orbit, scroll to zoom.</p>
      <div class="list" id="ll">${LANDMARKS.map((l, i) => `<button class="row" data-k="${l.key}"><span class="n">${String(i + 1).padStart(2, '0')}</span>${l.name}<i class="sw" style="--c:${l.color};margin-left:auto"></i></button>`).join('')}</div>`));
    dock('right', ''); dock('bottom', '');
    const m = await micro(); if (state.cur !== this) return;
    MA.clearMarkers(); stage('three'); m.setMode('pr', false); m.highlight(null); m.contours(false); m.explodeMarket(false);
    m.labels(['lm', 'mk', 'sky']); m.setCam(m.CAMS.axo, 2000);
    const pick = (k) => {
      const l = LANDMARKS.find((x) => x.key === k);
      $$('#ll .row').forEach((r) => r.classList.toggle('on', r.dataset.k === k));
      m.setCam(m.CAMS[k], 2600); m.explodeMarket(false); m.icExplode(null, false, 600); m.labels(k === 'ic' ? ['lm', 'mk', 'sky', 'ic'] : ['lm', 'mk', 'sky']);
      if (k === 'ic') return icCard(m, l);
      dock('right', card(`<div class="kicker" style="color:${l.color}">${l.kicker}</div><h3>${l.name}</h3><p>${l.body}</p>
        <dl class="dl">${l.facts.map((f) => `<dt>${f[0]}</dt><dd>${f[1]}</dd>`).join('')}</dl>
        ${k === 'market' ? `<div class="pills"><button class="pill hot" id="xp">Explode the floors</button></div>` : ''}
        <span class="src">${l.src}</span>`, 'detail scroll'));
      if (k === 'market') $('#xp').onclick = (e) => { const on = e.currentTarget.classList.toggle('on'); m.explodeMarket(on); e.currentTarget.textContent = on ? 'Close the floors' : 'Explode the floors'; m.setCam({ ...m.CAMS.market, view: on ? 230 : 150, t: [205, on ? 135 : 118] }, 1600); };
    };
    $$('#ll .row').forEach((r) => r.onclick = () => pick(r.dataset.k));
    X_labelsClick(m, pick);
    await wait(2300); if (state.cur === this) pick('palace');
  },
  leave() { if (MI) { MI.explodeMarket(false); MI.icExplode(null, false, 300); MI.icColours('theme'); } },
};
// v4: interpretation centre panel — building list, explode, theme / SketchUp colours
function icCard(m, l) {
  const B = m.IC.meta.blds.filter((b) => b.name !== 'Site'), main = B.filter((b) => b.detail), rest = B.filter((b) => !b.detail);
  const row = (b, i) => `<button class="row" data-b="${b.name}"><span class="n">${String(i + 1).padStart(2, '0')}</span>${b.name}<em style="margin-left:auto;font-style:normal;opacity:.6">${b.parts.length} el.</em></button>`;
  dock('right', card(`<div class="kicker" style="color:${l.color}">${l.kicker}</div><h3>${l.name}</h3><p>${l.body}</p>
    <div class="pills"><button class="pill hot" id="icx">Explode all</button><button class="pill" id="icc">SketchUp colours</button></div>
    <div class="kicker" style="margin-top:14px">Detailed buildings</div><div class="list" id="icl">${main.map(row).join('')}
    <div class="kicker" style="margin-top:10px">Pavilions &amp; services</div>${rest.map((b, i) => row(b, i + main.length)).join('')}</div>
    <dl class="dl">${l.facts.map((f) => `<dt>${f[0]}</dt><dd>${f[1]}</dd>`).join('')}</dl>
    <span class="src">${l.src}</span>`, 'detail scroll'));
  let cur = null;
  $$('#icl .row').forEach((r) => r.onclick = () => {
    const name = r.dataset.b, again = cur === name; cur = again ? null : name;
    $$('#icl .row').forEach((x) => x.classList.toggle('on', x.dataset.b === cur)); $('#icx').classList.remove('on'); $('#icx').textContent = 'Explode all';
    m.labels(cur ? [] : ['lm', 'mk', 'sky', 'ic']);
    if (!cur) { m.icExplode(null, false); m.setCam(m.CAMS.ic, 1800); return; }
    const f = m.icFrame(name), B0 = m.IC.blds[name].B, lift = B0.nk * (B0.detail ? 4.2 : 1.9);
    m.setCam({ t: f.t, h: (B0.bb[5] - B0.bb[2]) / 2 + lift * .55, az: -36, el: 26, view: f.view * .8 + lift * 1.4 }, 1800); m.icExplode(name, true);
  });
  $('#icx').onclick = (e) => { const on = e.currentTarget.classList.toggle('on'); e.currentTarget.textContent = on ? 'Close all' : 'Explode all'; cur = null; $$('#icl .row').forEach((x) => x.classList.remove('on')); m.labels(['lm', 'mk', 'sky', 'ic']); m.icExplode(null, on, 1800); m.setCam({ ...m.CAMS.ic, view: on ? 250 : 210, el: on ? 30 : 38 }, 1800); };
  $('#icc').onclick = (e) => { const on = e.currentTarget.classList.toggle('on'); e.currentTarget.textContent = on ? 'Atlas colours' : 'SketchUp colours'; m.icColours(on ? 'orig' : 'theme'); };
}
function X_labelsClick(m, pick) {
  const map = { 'Koyikkal Palace': 'palace', 'KSRTC Bus Stand': 'bus', 'New market — proposal': 'market', 'Nedumangad Court': 'court', 'Skywalk ring — concept': 'sky', 'Interpretation Centre': 'ic' };
  m.X.labels.forEach((l) => { const k = map[l.el.textContent]; if (k) { l.el.dataset.cursor = 'View'; l.el.onclick = () => pick(k); } });
}

// ------------------------------------------------------------------ section drawings
const SEC = {
  ex: { title: 'Existing — undivided two-lane', total: 10, strips: [['sh', 1.5, 'verge'], ['ln', 3.5, 'lane'], ['ln', 3.5, 'lane'], ['sh', 1.5, 'verge']] },
  pr: { title: 'Redesigned — four-lane divided', total: 21, strips: [['fp', 2, 'footpath'], ['kb', .5, ''], ['ln', 3.5, 'lane'], ['ln', 3.5, 'lane'], ['md', 2, 'median'], ['ln', 3.5, 'lane'], ['ln', 3.5, 'lane'], ['kb', .5, ''], ['fp', 2, 'footpath']] },
  mk: { title: 'Redesigned — market street', total: 21, strips: [['fp', 2, 'footpath'], ['kb', .5, ''], ['by', 2, 'bay'], ['vg', 1.5, 'trees'], ['ln', 4, 'lane'], ['md', 1, ''], ['ln', 4, 'lane'], ['vg', 1.5, 'trees'], ['by', 2, 'bay'], ['kb', .5, ''], ['fp', 2, 'footpath']] },
};
function sectionSVG(key, W = 296) {
  const s = SEC[key], px = W / 21, x0 = (W - s.total * px) / 2 + 4, col = { fp: '#F6E2B8', kb: '#C9D6EE', ln: '#27365A', md: '#86D3AC', sh: '#D9CDB8', by: '#93A1BC', vg: '#86D3AC' };
  let x = x0, out = '', dims = '';
  s.strips.forEach(([k, w, lab], i) => {
    const ww = w * px, up = k === 'fp' || k === 'kb' ? 5 : k === 'md' || k === 'vg' ? 6 : 0;
    out += `<rect x="${x}" y="${62 - up}" width="${ww}" height="${8 + up}" fill="${col[k]}" stroke="${C.ink}" stroke-width=".6" style="animation:rise .6s ${i * 60}ms both"/>`;
    if (k === 'ln') out += `<rect x="${x + ww / 2 - 8}" y="50" width="16" height="9" rx="3" fill="${i % 2 ? C.blue2 : '#fff'}" stroke="${C.ink}" stroke-width=".7"/><circle cx="${x + ww / 2 - 4}" cy="60" r="2" fill="${C.ink}"/><circle cx="${x + ww / 2 + 4}" cy="60" r="2" fill="${C.ink}"/>`;
    if (k === 'fp') out += `<circle cx="${x + ww / 2}" cy="43" r="2.4" fill="${C.ink}"/><path d="M${x + ww / 2} 46v8m-3 -5h6m-3 5l-2.5 3m2.5 -3l2.5 3" stroke="${C.ink}" stroke-width="1.1" fill="none"/>`;
    if (k === 'md' && w >= 2 || k === 'vg') out += `<path d="M${x + ww / 2} 56V40" stroke="#7A5A3C" stroke-width="1.4"/><circle cx="${x + ww / 2}" cy="34" r="9" fill="${C.green}" opacity=".85"/>`;
    if (k === 'by') out += `<rect x="${x + 2}" y="52" width="${ww - 4}" height="8" rx="2" fill="#fff" stroke="${C.ink}" stroke-width=".7"/>`;
    dims += `<line x1="${x}" x2="${x}" y1="74" y2="80" stroke="${C.ink}" stroke-width=".6"/>${w >= 1.5 ? `<text x="${x + ww / 2}" y="89" text-anchor="middle" font-size="8" font-family="IBM Plex Mono" fill="${C.ink}">${w}</text>` : ''}`;
    x += ww;
  });
  dims += `<line x1="${x}" x2="${x}" y1="74" y2="80" stroke="${C.ink}" stroke-width=".6"/><line x1="${x0}" x2="${x}" y1="77" y2="77" stroke="${C.ink}" stroke-width=".6"/>`;
  return `<svg viewBox="0 0 ${W + 8} 112" width="100%"><line x1="0" x2="${W + 8}" y1="70" y2="70" stroke="${C.ink}" stroke-width=".6" stroke-dasharray="2 3"/>${out}${dims}
    <line x1="${x0}" x2="${x}" y1="100" y2="100" stroke="${C.hot}" stroke-width="1.2"/><line x1="${x0}" x2="${x0}" y1="96" y2="104" stroke="${C.hot}"/><line x1="${x}" x2="${x}" y1="96" y2="104" stroke="${C.hot}"/>
    <text x="${(x0 + x) / 2}" y="110" text-anchor="middle" font-size="9" font-weight="600" font-family="IBM Plex Mono" fill="${C.hot}">${s.total.toFixed(1)} m</text></svg>`;
}
function longSection(S) {
  const p = S.prof, W = 296, H = 96, L = p[p.length - 1][0], mn = Math.floor(Math.min(...p.map((q) => q[1])) / 2) * 2 - 2, mx = Math.ceil(Math.max(...p.map((q) => q[1])) / 2) * 2 + 2, X = (d) => 4 + d / L * W, Y = (z) => H - 8 - (z - mn) / (mx - mn) * (H - 22);
  const path = p.map((q, i) => (i ? 'L' : 'M') + X(q[0]).toFixed(1) + ' ' + Y(q[1]).toFixed(1)).join('');
  const hi = p.reduce((a, q) => (q[1] > a[1] ? q : a)), lo = p.reduce((a, q) => (q[1] < a[1] ? q : a));
  return `<svg viewBox="0 0 ${W + 8} ${H + 14}" width="100%"><path d="${path}L${X(L)} ${H}L4 ${H}Z" fill="${C.amber}" opacity=".3"/><path d="${path}" fill="none" stroke="${C.ink}" stroke-width="1.6"/>
    ${[60, 65, 70].map((z) => `<line x1="4" x2="${W + 4}" y1="${Y(z)}" y2="${Y(z)}" stroke="${C.ink}" stroke-width=".4" stroke-dasharray="2 3"/><text x="${W + 4}" y="${Y(z) - 2}" text-anchor="end" font-size="7.5" font-family="IBM Plex Mono" fill="${C.ink}">${z} m</text>`).join('')}
    <circle cx="${X(hi[0])}" cy="${Y(hi[1])}" r="3.5" fill="${C.hot}"/><text x="${X(hi[0])}" y="${Y(hi[1]) - 7}" text-anchor="middle" font-size="8.5" font-weight="600" font-family="IBM Plex Mono" fill="${C.hot}">${hi[1].toFixed(0)} m · crest</text>
    <circle cx="${X(lo[0])}" cy="${Y(lo[1])}" r="3.5" fill="${C.blue}"/><text x="${X(lo[0])}" y="${Y(lo[1]) + 14}" text-anchor="middle" font-size="8.5" font-weight="600" font-family="IBM Plex Mono" fill="${C.blue}">${lo[1].toFixed(0)} m · sag</text>
    <text x="4" y="${H + 11}" font-size="8" font-family="IBM Plex Mono" fill="${C.ink}">Market end</text><text x="${W + 4}" y="${H + 11}" text-anchor="end" font-size="8" font-family="IBM Plex Mono" fill="${C.ink}">SH 3 north · ${L} m</text></svg>`;
}

// ------------------------------------------------------------------ 08 design stretch
const STEPS = ['Why here', 'Existing', 'Expansion', 'Character', 'Heritage', 'Market', 'Terrain', 'Jury'];
const chStretch = {
  id: 'stretch', num: '08', title: 'The Design Stretch', short: 'Design Stretch', micro: true,
  desc: 'Macro to micro: why this 760 m frame, the road before and after, heritage and the new market.',
  enter() {
    dock('bottom', `<div class="steps">${STEPS.map((s, i) => `<button class="step" data-i="${i}" data-cursor="${s}"><b>${String(i + 1).padStart(2, '0')}</b><span>${s}</span></button>`).join('')}</div>`);
    $$('.step').forEach((b) => b.onclick = () => this.step(+b.dataset.i));
    this.s = -1; this.step(0);
  },
  async step(i) {
    const prev = this.s; this.s = i; clearInterval(this.auto);
    $$('.step').forEach((b, k) => b.classList.toggle('on', k === i));
    if (i === 0) return this.why();
    const m = await micro(); if (state.cur !== this || this.s !== i) return;
    const S = m.X.S, N = S.num;
    if (prev <= 0) {                               // cinematic hand-over: map settles top-down, model takes over and tilts
      dock('left', ''); dock('right', '');
      skippable(true); await MA.stretchApproach(); if (state.cur !== this || this.s !== i) { skippable(false); return; }
      m.setCam(m.CAMS.top, 0); m.setMode('ex', false); m.labels([]); stage('three'); MA.clearMarkers(); await wait(700); this.fast = skipper.on; skippable(false);
    }
    m.highlight(null); if (i !== 6) m.contours(false); if (i !== 5) m.explodeMarket(false);
    const L = (h) => dock('left', h), R = (h) => dock('right', h);
    if (i === 1) {
      m.setMode('ex', false); m.labels(['base', 'lm', 'dimex']); m.setCam(m.CAMS.axo, 2800);
      L(card(`<div class="kicker">08 · Existing condition</div><h2>One street doing everything</h2>
        <p class="lede">Today the spine is an undivided two-lane road. Through-traffic to the hills, buses turning into the stand, market loading, parked vehicles and people on foot all share the same strip of asphalt.</p>
        <div class="stats"><div class="stat"><b>${N.buildings}</b><span>buildings in the frame</span></div><div class="stat"><b>${N.built_pct}<small>%</small></b><span>ground coverage</span></div>
        <div class="stat"><b>${N.frame_m[0]}×${N.frame_m[1]}</b><span>metres</span></div><div class="stat"><b>${N.area_ha}<small>ha</small></b><span>study frame</span></div></div>
        <span class="src">Hover any building for its footprint and estimated height. Heights are derived, not surveyed.</span>`));
      R(card(`<div class="kicker">Section A–A · existing</div>${sectionSVG('ex')}<p class="small">Carriageway about 7 m with unpaved verges and no continuous footpath ${V()}. Drawn from OSM centrelines buffered to assumed widths — replace with your measured section.</p>`) +
        card(`<div class="kicker">Legend</div><div class="legend"><div class="lg"><i class="sq" style="--c:#AAB6CC"></i>Existing carriageway (assumed width)</div><div class="lg"><i class="sq" style="--c:#F4F7FD;outline:1px solid ${C.ink}"></i>Building, context</div><div class="lg"><i class="sq" style="--c:#F3C6D6"></i>Heritage building (CAD layer)</div><div class="lg"><i class="sq" style="--c:#BFE3D2"></i>Canopy, indicative</div><div class="lg"><i class="dash" style="--c:${C.hot}"></i>Stretch boundary</div></div>`));
    } else if (i === 2) {
      m.labels(['base', 'pr', 'dim']); m.setCam(m.CAMS.spine, 2600); m.setMode('cmp', true);
      L(card(`<div class="kicker">08 · Road expansion</div><h2>From 7 m to a 21 m reserve</h2>
        <p class="lede">The redesign in your CAD drawing replaces the shared strip with a divided four-lane section: two 7.0 m carriageways, a 2.0 m planted median, and a kerbed 2.0 m footpath on both sides.</p>
        <div class="seg-toggle" id="md"><button data-m="ex">Existing</button><button data-m="cmp" class="on hot">Redesigned</button></div>
        <div class="stats"><div class="stat"><b>${fmt(N.carriage_m2)}<small>m²</small></b><span>new carriageway</span></div><div class="stat"><b>${fmt(N.existing_main_m2)}<small>m²</small></b><span>existing main roads ${V()}</span></div>
        <div class="stat"><b>${fmt(N.foot_m2)}<small>m²</small></b><span>footpath + kerb</span></div><div class="stat"><b>${fmt(N.median_m2)}<small>m²</small></b><span>median & islands</span></div></div>
        <span class="src">Dashed red line = edge of the existing carriageway under the new one.</span>`));
      R(card(`<div class="kicker">Section A–A · bus-stand reach</div>${sectionSVG('pr')}<p class="small">Measured from road.dwg: 2.0 + 0.5 + 3.5 + 3.5 + 2.0 + 3.5 + 3.5 + 0.5 + 2.0 = 21.0 m.</p>`) +
        card(`<div class="kicker">Section B–B · market street</div>${sectionSVG('mk')}<p class="small">South of the roundabout the same 21 m is re-divided: one 4.0 m lane each way, lay-by bays and a tree verge. Strip uses are read from the drawing ${V()}.</p>`, 'tight'));
      $$('#md button').forEach((b) => b.onclick = () => { $$('#md button').forEach((x) => { x.classList.toggle('on', x === b); x.classList.toggle('hot', x === b && b.dataset.m !== 'ex'); }); m.setMode(b.dataset.m, b.dataset.m !== 'ex'); m.labels(['base', b.dataset.m === 'ex' ? 'dimex' : 'pr', b.dataset.m === 'ex' ? '' : 'dim']); });
    } else if (i === 3) {
      m.setMode('pr', false); m.labels(['base', 'pr']); m.highlight('front'); m.setCam(m.CAMS.round, 2600);
      L(card(`<div class="kicker">08 · Changing character</div><h2>Bazaar street to boulevard</h2>
        <p class="lede">Widening changes more than capacity. A median stops the diagonal crossing that market streets live on; in exchange the design gives marked crossings, a roundabout at the bus stand and a real footpath.</p>
        <div class="cmp"><span class="h a">Existing</span><span class="k"></span><span class="h">Redesigned</span>
        ${[['2 lanes, undivided ' + V(), 'Carriageway', '4 lanes, divided'], ['≈ 10 m ' + V(), 'Reserve', '21.0 m'], ['Broken, unkerbed ' + V(), 'Footpath', '2.0 m, both sides'], ['None', 'Median', '2.0 m, planted'], ['Open junction', 'Bus-stand node', 'Roundabout'], ['Unmarked ' + V(), 'Crossings', 'Signals + zebra at 3 junctions'], ['Kerbside ' + V(), 'Parking', '≈ ' + N.slots + '-bay court + bays']].map((r) => `<span class="a">${r[0]}</span><span class="k">${r[1]}</span><span class="b">${r[2]}</span>`).join('')}</div>`, 'scroll'));
      R(card(`<div class="kicker">Frontage affected</div><div class="stats"><div class="stat"><b style="color:${C.hot}">${N.frontage_cut}</b><span>footprints cross the new reserve</span></div><div class="stat"><b style="color:${C.amber}">${N.frontage_edge}</b><span>buildings front it (≤ 4 m)</span></div></div>
        <div class="legend"><div class="lg"><i class="sq" style="--c:#F7B9A6"></i>Crosses the new road line</div><div class="lg"><i class="sq" style="--c:#FCE3B3"></i>Fronts the widened road</div><div class="lg"><i class="sq" style="--c:#27365A"></i>Carriageway</div><div class="lg"><i class="sq" style="--c:#F6E2B8"></i>Footpath & kerb</div><div class="lg"><i class="sq" style="--c:#86D3AC"></i>Median, islands</div><div class="lg"><i class="sq" style="--c:${C.green}"></i>New street trees</div></div>
        <span class="src">Computed by overlaying the CAD road reserve on the CAD building footprints.</span>`) +
        card(`<div class="kicker">Junction control</div><div class="pills"><button class="pill on" data-j="round">Roundabout</button><button class="pill" data-j="signal">Market junction</button><button class="pill" data-j="north">Palace Road fork</button></div>
        <p class="small" style="margin-top:10px">Vehicles keep left on the lane lines of the new section, queue at red and give way at the roundabout. The ${N.signals} signal heads, stop lines and the zebra crossings at the three signalled junctions are this atlas’s proposal ${V('to design')}; road.dwg itself draws ${N.zebra_bars} zebra bars.</p>`, 'tight'));
      $$('.pill[data-j]').forEach((b) => b.onclick = () => { $$('.pill[data-j]').forEach((x) => x.classList.toggle('on', x === b)); m.setCam(m.CAMS[b.dataset.j], 2400); });
    } else if (i === 4) {
      m.setMode('pr', false); m.labels(['her', 'lm']); m.highlight('her'); m.setCam(m.CAMS.her, 2800);
      L(card(`<div class="kicker">08 · Heritage value</div><h2>What the widening must not erase</h2>
        <p class="lede">Your drawing flags ${N.heritage} heritage buildings on the spine, most of them at the northern fork where the palace road leaves the highway. Together with Koyikkal Palace they are the surviving evidence of the trade-era town.</p>
        <p>The redesign keeps every flagged footprint outside the new kerb line, but the street they belong to changes scale around them. The design question is the edge: setbacks, plinth continuity, shade and signage along these frontages.</p>
        <div class="pills"><button class="pill on" data-c="her">Northern cluster</button><button class="pill" data-c="palace">Koyikkal Palace</button><button class="pill" data-c="north">Fork junction</button></div>`));
      R(card(`<div class="kicker">Reading</div><div class="legend"><div class="lg"><i class="sq" style="--c:#F3C6D6"></i>Heritage building (CAD “Heritage Buildings” layer)</div><div class="lg"><i class="sq" style="--c:#D9745C"></i>Tiled roof, heritage</div><div class="lg"><i class="sq" style="--c:#D0603F"></i>Koyikkal Palace (17th c.)</div></div>
        <p class="small" style="margin-top:10px">Add for each: name, date, use, condition and listing status from your documentation ${V('to add')}.</p>`));
      $$('.pill[data-c]').forEach((b) => b.onclick = () => { $$('.pill[data-c]').forEach((x) => x.classList.toggle('on', x === b)); m.setCam(m.CAMS[b.dataset.c], 2400); });
    } else if (i === 5) {
      const l = LANDMARKS[2];
      m.setMode('pr', false); m.labels(['lm', 'mk', 'sky']); m.setCam(m.CAMS.market, 2800);
      L(card(`<div class="kicker">08 · New market proposal</div><h2>The chantha goes vertical</h2>
        <p class="lede">The market that made the town is to be rebuilt as a four-storey building over basement parking — 71,000 sq ft, 184 stalls and a food court, with solar, biogas and rainwater systems.</p>
        <p>For the stretch this is the southern anchor. A stacked market concentrates footfall at one door, so the street section, crossings and lay-bys in front of it carry the whole exchange between market and town.</p>
        <p>At Market junction a <b>ring skywalk</b> is proposed as a concept: one level deck over all the arms, docking into the frontages on the market-road and SH 3 sides, so the crowd the market generates never has to cross four lanes at grade.</p>
        <div class="pills"><button class="pill hot" id="xp2">Explode the floors</button><button class="pill" id="sk2">Skywalk ring</button></div>`));
      R(card(`<div class="kicker" style="color:${l.color}">Announced programme</div><dl class="dl">${l.facts.map((f) => `<dt>${f[0]}</dt><dd>${f[1]}</dd>`).join('')}</dl><span class="src">${l.src}</span>`, 'detail scroll'));
      $('#sk2').onclick = (e) => { const on = e.currentTarget.classList.toggle('on'); m.explodeMarket(false); m.setCam(on ? m.CAMS.sky : m.CAMS.market, 2400); const sk = LANDMARKS.find((x) => x.key === 'sky'); R(on ? card(`<div class="kicker" style="color:${sk.color}">${sk.kicker}</div><h3>${sk.name}</h3><p>${sk.body}</p><dl class="dl">${sk.facts.map((f) => `<dt>${f[0]}</dt><dd>${f[1]}</dd>`).join('')}</dl><span class="src">${sk.src}</span>`, 'detail scroll') : card(`<div class="kicker" style="color:${l.color}">Announced programme</div><dl class="dl">${l.facts.map((f) => `<dt>${f[0]}</dt><dd>${f[1]}</dd>`).join('')}</dl><span class="src">${l.src}</span>`, 'detail scroll')); };
      $('#xp2').onclick = (e) => { const on = e.currentTarget.classList.toggle('on'); m.explodeMarket(on); e.currentTarget.textContent = on ? 'Close the floors' : 'Explode the floors'; m.setCam({ ...m.CAMS.market, view: on ? 230 : 150, t: [205, on ? 135 : 118] }, 1600); };
    } else if (i === 6) {
      m.setMode('pr', false); m.labels(['base', 'topo']); m.contours(true); m.setCam(m.CAMS.terrain, 3000);
      L(card(`<div class="kicker">08 · Terrain</div><h2>A street over a saddle</h2>
        <p class="lede">The ground in the frame runs from ${N.elev[0]} m to ${N.elev[1]} m. The spine climbs from the market to a ${N.crest.toFixed(0)} m crest beside the bus stand, then falls to a ${N.sag.toFixed(0)} m sag at the northern fork — so stormwater leaves the roundabout in both directions.</p>
        <p>The model is true to scale vertically: roads, buildings, trees and vehicles all sit on a ground surface interpolated from the 2 m contours in your drawing. The court stands on the knoll west of the roundabout; a stream cuts the north-east corner and the roads bridge it.</p>
        <div class="stats"><div class="stat"><b>${N.grade_mean}<small>%</small></b><span>mean gradient, spine</span></div><div class="stat"><b style="color:${C.hot}">${N.grade_max}<small>%</small></b><span>steepest 20 m reach</span></div></div>
        <div class="pills"><button class="pill on" data-t="terrain">Whole frame</button><button class="pill" data-t="court">Court hill</button><button class="pill" data-t="north">North fork</button></div>`));
      R(card(`<div class="kicker">Long section · along the spine</div>${longSection(S)}<p class="small">Read from the heightfield along the redesigned centreline. Vertical scale exaggerated in this drawing only.</p>`) +
        card(`<div class="kicker">Elevation</div><div class="ramp" style="height:10px;border-radius:5px;background:linear-gradient(90deg,#B8D6FA,#E8F2FF,#FFFAE6,#FADB9E,#ED9966)"></div><div class="legend" style="margin-top:6px"><div class="lg" style="justify-content:space-between"><span>${N.elev[0]} m</span><span>${N.elev[1]} m</span></div><div class="lg"><i class="sq" style="--c:#6FB1F2"></i>Stream (OSM waterway)</div></div>
        <p class="small" style="margin-top:8px">Source: 2 m contours in road.dwg, fitted with a thin-plate spline on a 4 m grid. No open DEM is used here — SRTM / Copernicus are 30 m products, far coarser than your contours.</p>`, 'tight'));
      $$('.pill[data-t]').forEach((b) => b.onclick = () => { $$('.pill[data-t]').forEach((x) => x.classList.toggle('on', x === b)); m.setCam(b.dataset.t === 'north' ? { ...m.CAMS.north, el: 22 } : b.dataset.t === 'court' ? { ...m.CAMS.court, el: 18, view: 240 } : m.CAMS.terrain, 2400); });
    } else if (i === 7) {
      m.setMode('pr', false); m.labels(['base', 'lm', 'mk', 'pr', 'sky']); m.setCam({ ...m.CAMS.axo, az: 32 }, 3000);
      L(card(`<div class="kicker">08 · Before the jury</div><h2>Six questions to be ready for</h2>
        <div class="why">${[
          ['Why four lanes through the core if a ring road is proposed?', 'The Outer Ring Road is drawn to take through-traffic. Show the traffic split you expect, or the jury will read the 21 m section as over-design for a market street.'],
          ['What happens to the frontages?', `${N.frontage_edge} buildings front the widened reserve and ${N.frontage_cut} footprints cross it. State the acquisition line, the setbacks and what is rebuilt.`],
          ['Is 2 m of footpath enough beside a market?', 'IRC:103 asks for wider clear walking width on commercial and shopping frontages than on residential streets. Check the clause and justify 2.0 m, or widen at the market reach.'],
          ['Can people still cross?', 'A median ends informal crossing. Count the crossings per 100 m, give refuge widths, and show the desire lines between bus stand, market and palace.'],
          ['Does the roundabout work for buses?', 'Give the inscribed diameter and the swept path of a 12 m bus entering and leaving the stand at peak.'],
          ['Where does the water go?', 'The spine crests near the bus stand. Show drain direction, outfalls toward the valley streams and where the median planting takes runoff.'],
        ].map((q, k) => `<button class="${k ? '' : 'on'}"><b>${q[0]}</b><span>${q[1]}</span></button>`).join('')}</div>`, 'scroll'));
      R(card(`<div class="kicker">Open items in this atlas</div><p class="small">Everything tagged ${V()} is a drafted assumption: existing widths, crossing and parking condition, strip uses in section B–B, heritage attributes and the court’s elevations. Signals, the added crossings and the ring skywalk are concept proposals, not part of road.dwg. Replace or confirm them before presenting.</p>`));
      $$('.why button').forEach((b) => b.onclick = () => $$('.why button').forEach((x) => x.classList.toggle('on', x === b)));
    }
  },
  why() {
    stage('map');
    let k = 0;
    dock('left', card(`<div class="kicker">08 · Macro → micro</div><h2>Why this stretch</h2>
      <p class="lede">Out of 32 km² the study narrows to 28 hectares. Four arguments, each read off the macro maps:</p>
      <div class="why">${WHY.map((w) => `<button><b>${w.t}</b><span>${w.d}</span></button>`).join('')}</div>
      <div class="pills"><button class="pill hot on" id="go3d" data-cursor="Enter">Enter the stretch in 3D →</button></div>`, 'scroll'));
    dock('right', card(`<div class="kicker">The frame</div><div class="stats"><div class="stat"><b>372×759</b><span>metres</span></div><div class="stat"><b>28.2<small>ha</small></b><span>area</span></div><div class="stat"><b>398</b><span>buildings</span></div><div class="stat"><b>20.8<small>%</small></b><span>built cover · town 6.8 %</span></div></div>
      <div class="legend"><div class="lg"><i class="dash" style="--c:${C.hot}"></i>Design stretch boundary</div><div class="lg"><i style="--c:${C.hot}"></i>Highlighted argument</div></div>`));
    const set = (n) => { k = n; $$('.why button').forEach((b, j) => b.classList.toggle('on', j === n)); MA.whyScene(n); };
    $$('.why button').forEach((b, j) => b.onclick = () => { clearInterval(this.auto); set(j); });
    $('#go3d').onclick = () => this.step(1);
    set(0); this.auto = setInterval(() => set((k + 1) % WHY.length), 7500);
  },
  leave() { clearInterval(this.auto); if (MI) { MI.contours(false); MI.highlight(null); MI.explodeMarket(false); } },
};

// ------------------------------------------------------------------ navigation
const CH = [MA.chNetwork, MA.chHistory, MA.chAccess, MA.chWards, MA.chTopo, MA.chEco, chLandmarks, chStretch];
async function go(i) {
  if (i === state.i || i < 0 || i >= CH.length) return;
  const prev = CH[state.i]; state.i = i; const ch = CH[i]; state.cur = ch;
  document.body.classList.remove('is-hero');
  prev?.leave?.(); MA.clearHandlers(); MA.clearMarkers(); tip(null); cursorMode(null);
  dock('bottom', ''); dock('right', '');
  if (ch !== chLandmarks && !(ch === chStretch)) stage('map');
  if (ch === chStretch) stage('map');
  $('#crumb-num').textContent = ch.num; $('#crumb-title').textContent = ch.title;
  $$('.rail-item').forEach((b, k) => b.classList.toggle('on', k === i));
  history.replaceState(null, '', '#' + ch.id);
  ch.enter();
}
function hero() {
  CH[state.i]?.leave?.(); state.i = -1; state.cur = null; stage('map');
  MA.clearHandlers(); MA.clearMarkers(); dock('left', ''); dock('right', ''); dock('bottom', '');
  document.body.classList.add('is-hero'); MA.heroEnter(); history.replaceState(null, '', '#');
}
function buildShell() {
  $('#rail').innerHTML = `<button class="rail-nav" id="prev" data-cursor="Back">←</button>` + CH.map((c, i) => `<button class="rail-item ${c.micro ? 'micro' : ''}" data-i="${i}"><span class="n">${c.num}</span><span class="t">${c.short}</span></button>`).join('') + `<button class="rail-nav" id="next" data-cursor="Next">→</button>`;
  $$('.rail-item').forEach((b) => b.onclick = () => go(+b.dataset.i));
  $('#prev').onclick = () => (state.i <= 0 ? hero() : go(state.i - 1)); $('#next').onclick = () => go(Math.min(CH.length - 1, state.i + 1));
  addEventListener('keydown', (e) => { if (e.target.closest('input')) return; if (e.key === 'ArrowRight') $('#next').click(); if (e.key === 'ArrowLeft') $('#prev').click(); if (e.key === 'Escape') $$('.sheet').forEach((s) => s.hidden = true); });
  $('.brand').onclick = hero;
  $('#index').innerHTML = `<button class="sheet-close">Close ×</button><div class="sheet-in"><div class="kicker">Index</div><h2>Macro → Micro</h2><div class="idx">${CH.map((c, i) => `<button data-i="${i}"><span class="n">${c.num}</span><b>${c.title}</b><span>${c.desc}</span></button>`).join('')}</div></div>`;
  $('#credits').innerHTML = `<button class="sheet-close">Close ×</button><div class="sheet-in"><div class="kicker">Study &amp; drawing</div><h2>The team</h2>
    <div class="team">${TEAM.map((t) => `<div><b>${t}</b><span>B.Arch · urban study group</span></div>`).join('')}</div>
    <div class="cols"><div><h3>About this atlas</h3><p>A macro-to-micro study of Nedumangad municipality: network, history, access, wards, terrain and ecology at the scale of the town, then a 760 m design stretch between Koyikkal Palace, the KSRTC bus stand and the market — drawn in 3D from the team’s own CAD.</p><p class="small">Figures tagged <span class="vf">verify</span> are drafted assumptions awaiting the field survey. 3D models are interpretive massing.</p></div>
    <div><h3>Data &amp; sources</h3>${SOURCES.map((s) => `<p class="small" style="margin-bottom:6px">${s}</p>`).join('')}</div></div></div>`;
  $$('.sheet-close').forEach((b) => b.onclick = () => b.parentElement.hidden = true);
  $$('#index .idx button').forEach((b) => b.onclick = () => { $('#index').hidden = true; go(+b.dataset.i); });
  $('#btn-index').onclick = () => $('#index').hidden = false; $('#btn-credits').onclick = () => $('#credits').hidden = false;
  $('#begin').onclick = async () => { if (state.busy) return; state.busy = true; document.body.classList.remove('is-hero'); $$('.dock,#bottom,#rail').forEach((e) => e.style.opacity = 0); skippable(true); await MA.locate(); skippable(false); $$('.dock,#bottom,#rail').forEach((e) => e.style.opacity = ''); state.busy = false; go(0); };
  $('#skip-intro').onclick = () => { if (!state.busy) go(0); };
  $('#skip').onclick = () => skipNow();
  skipper.hooks.push(() => MA.M.map.stop());
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#skip').hidden) skipNow(); });
  // split hero title into letters that lean away from the cursor
  $$('[data-split]').forEach((l) => { l.innerHTML = [...l.textContent].map((c, i) => `<span class="ch" style="transition-delay:${i * 45}ms">${c}</span>`).join(''); });
  const chs = $$('.hero-title .ch');
  addEventListener('pointermove', (e) => { if (!document.body.classList.contains('is-hero')) return; chs.forEach((c) => { const r = c.getBoundingClientRect(), dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2), d = Math.hypot(dx, dy), f = Math.max(0, 1 - d / 320); c.style.setProperty('--dx', (-dx * f * .12).toFixed(1) + 'px'); c.style.setProperty('--dy', (-dy * f * .12).toFixed(1) + 'px'); c.style.transitionDelay = '0ms'; c.style.transitionDuration = '.5s'; }); }, { passive: true });
  // cards lean toward the cursor
  addEventListener('pointermove', (e) => { const c = e.target.closest?.('.card'); $$('.card').forEach((x) => { if (x !== c) x.style.transform = ''; }); if (!c || c.classList.contains('scroll')) return; const r = c.getBoundingClientRect(); c.style.transform = `perspective(900px) rotateY(${((e.clientX - r.left) / r.width - .5) * 2.4}deg) rotateX(${-((e.clientY - r.top) / r.height - .5) * 2.4}deg)`; }, { passive: true });
}

(async function boot() {
  initCursor(); buildShell();
  const bar = $('#loadbar'), msg = $('#loadmsg');
  try {
    await MA.loadData((p, name) => { bar.style.width = (p * 80) + '%'; msg.textContent = 'Reading ' + name.replace('_', ' ') + '…'; });
    msg.textContent = 'Drawing the town…'; await MA.initMap(); bar.style.width = '100%';
    const s = MA.M.d.stats; $('#hs-1').textContent = s.area_km2.toFixed(1); $('#hs-2').textContent = s.wards; $('#hs-3').textContent = fmt(s.buildings);
  } catch (err) { msg.textContent = 'Could not load the atlas data — serve this folder over http.'; console.error(err); return; }
  const id = location.hash.slice(1), k = CH.findIndex((c) => c.id === id);
  document.body.classList.add('is-ready');
  if (k >= 0) go(k); else hero();
  setTimeout(() => micro().catch((e) => console.warn('3D preload failed', e)), 2500);   // warm the 3D model in the background
  window.__atlas = { go, hero, state, MA, micro };
})();
