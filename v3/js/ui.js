// Shell helpers: docks, tooltip, cursor, tweening.
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const docks = { left: $('#left'), right: $('#right'), bottom: $('#bottom') };
export function dock(side, html) {
  const el = docks[side];
  el.innerHTML = html || '';
  $$('.card', el).forEach((c, i) => c.style.setProperty('--i', i));
  return el;
}
export const card = (html, cls = '') => `<div class="card ${cls}">${html}</div>`;
export const fmt = (n, d = 0) => Number(n).toLocaleString('en-IN', { maximumFractionDigits: d, minimumFractionDigits: d });

// ---------- tooltip ----------
const tipEl = $('#tip');
export function tip(html, x, y) {
  if (!html) { tipEl.hidden = true; return; }
  tipEl.hidden = false; tipEl.innerHTML = html;
  const w = tipEl.offsetWidth, h = tipEl.offsetHeight;
  tipEl.style.left = Math.min(x, innerWidth - w - 30) + 'px';
  tipEl.style.top = Math.min(y, innerHeight - h - 30) + 'px';
}

// ---------- cursor ----------
const cur = $('#cursor'), ring = $('.c-ring', cur), dot = $('.c-dot', cur), lab = $('.c-label', cur);
export const mouse = { x: innerWidth / 2, y: innerHeight / 2, rx: innerWidth / 2, ry: innerHeight / 2, nx: 0, ny: 0 };
let forced = null;
export function cursorMode(mode, label) { forced = mode ? { mode, label } : null; }
export function initCursor() {
  if (!matchMedia('(hover:hover) and (pointer:fine)').matches) return;
  document.documentElement.classList.add('has-cursor');
  addEventListener('pointermove', (e) => {
    mouse.x = e.clientX; mouse.y = e.clientY;
    mouse.nx = e.clientX / innerWidth * 2 - 1; mouse.ny = e.clientY / innerHeight * 2 - 1;
    document.body.style.setProperty('--mx', e.clientX + 'px');
    document.body.style.setProperty('--my', e.clientY + 'px');
    const t = e.target.closest?.('[data-cursor],button,a,.row,.lg,input');
    const onStage = e.target.closest?.('#map,#three');
    cur.className = '';
    if (t) {
      const l = t.dataset.cursor;
      cur.classList.add(l ? 'label' : 'hover'); lab.textContent = l || '';
    } else if (forced) {
      cur.classList.add(forced.label ? 'label' : forced.mode); lab.textContent = forced.label || '';
    } else if (onStage) cur.classList.add('map');
  }, { passive: true });
  addEventListener('pointerdown', () => cur.classList.add('down'));
  addEventListener('pointerup', () => cur.classList.remove('down'));
  (function loop() {
    mouse.rx += (mouse.x - mouse.rx) * 0.18; mouse.ry += (mouse.y - mouse.ry) * 0.18;
    dot.style.transform = `translate(${mouse.x}px,${mouse.y}px) translate(-50%,-50%)`;
    ring.style.transform = `translate(${mouse.rx}px,${mouse.ry}px) translate(-50%,-50%)`;
    lab.style.transform = `translate(${mouse.rx}px,${mouse.ry}px) translate(-50%,-50%)`;
    requestAnimationFrame(loop);
  })();
  // magnetic buttons
  $$('[data-magnet]').forEach((b) => {
    b.addEventListener('pointermove', (e) => {
      const r = b.getBoundingClientRect();
      b.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * 0.25}px,${(e.clientY - r.top - r.height / 2) * 0.35}px)`;
    });
    b.addEventListener('pointerleave', () => { b.style.transform = ''; });
  });
}

// ---------- tween ----------
export const ease = { io: (t) => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2), out: (t) => 1 - Math.pow(1 - t, 3), lin: (t) => t };
const live = new Set();
export function tween(dur, fn, e = ease.io) {
  let cancelled = false; const t0 = performance.now();
  const h = { cancel() { cancelled = true; live.delete(h); }, done: null };
  h.done = new Promise((res) => {
    (function step(now) {
      if (cancelled) return res(false);
      const t = Math.min(1, (now - t0) / dur);
      fn(e(t), t);
      if (t < 1) requestAnimationFrame(step); else { live.delete(h); res(true); }
    })(t0);
  });
  live.add(h); return h;
}
// waits can be fast-forwarded: the Skip button resolves every pending wait at once
const pend = new Set();
export const skipper = { on: false, hooks: [] };
export const wait = (ms) => new Promise((r) => { if (skipper.on) return r(); const f = () => { clearTimeout(t); pend.delete(f); r(); }, t = setTimeout(f, ms); pend.add(f); });
export function skipNow() { skipper.on = true; [...pend].forEach((f) => f()); skipper.hooks.forEach((h) => h()); }
export function skippable(on) { skipper.on = false; const b = $('#skip'); if (b) b.hidden = !on; }
export const lerp = (a, b, t) => a + (b - a) * t;
export function countUp(el, to, dur = 1400, d = 0) {
  tween(dur, (k) => { el.textContent = fmt(to * k, d); }, ease.out);
}
