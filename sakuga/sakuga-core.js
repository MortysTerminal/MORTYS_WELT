// Sakuga VFX core: springs, the effects layer and the lettering, shared by every component.
// Each component file carries a copy of this between its core markers, so any one file works on its own. The first one loaded
// sets window.SakugaFX and the others use it.
// Based on Sakuga VFX (https://github.com/finktheartist/sakuga-vfx, MIT, see LICENSE in this folder).
// Adapted for Mortys Welt: dark palette in the brand colours, Inter, German sound words (placeholders until painted ones exist).
(() => {
'use strict';
if (window.SakugaFX) return;
const TAU = Math.PI * 2;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const rnd = (a = 1, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
const out = (t) => 1 - (1 - t) ** 3, inn = (t) => t * t * t, back = (t) => 1 + 2.70158 * (t - 1) ** 3 + 1.70158 * (t - 1) ** 2;

// A spring: the thing that makes a control overshoot and settle instead of stopping dead.
class Spring {
  constructor(x = 0, k = 300, d = 20) { this.x = x; this.v = 0; this.to = x; this.k = k; this.d = d; }
  step(dt) { if (!(dt > 0)) return this.x; for (let n = Math.ceil(dt / 0.008), h = dt / n; n--;) { this.v += (-this.k * (this.x - this.to) - this.d * this.v) * h; this.x += this.v * h; } return this.x; }
}

// ───────── the palette ─────────
// P is for the effects; the CSS variables below are for the controls.
const P = { fill: '#F0F0F0', shade: '#F5C07C', line: '#161616', accent: '#F09346', ink: '#161616', page: '#202020', sfx: ['#F5C07C', '#161616'] };
const VARS = '--sk-card:#2D2D2D;--sk-ink:#F0F0F0;--sk-dim:#B8B2AA;--sk-soft:#161616;--sk-pri:#F5C07C;--sk-pri-ink:#202020;--sk-acc:#F09346;--sk-track:#383838;--sk-knob:#F0F0F0;--sk-focus:#F5C07C;--sk-r:12px;--sk-bw:3px;--sk-sh:5px 6px 0 var(--sk-soft);--sk-btn-sh:var(--sk-sh);--sk-btn-line:var(--sk-ink);--sk-alt-sh:var(--sk-sh);--sk-alt-line:var(--sk-ink);--sk-tick:#F5C07C;--sk-fill:var(--sk-acc);--sk-on-pri:#202020;';
// :where() keeps these at no specificity, so a page's own :root { --sk-acc: ... } wins.
const pageCss = `:where(:root){${VARS}}
canvas.sakuga-fx{position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:2147483000}
@media print{canvas.sakuga-fx{display:none}}`;
document.head.append(Object.assign(document.createElement('style'), { textContent: pageCss }));

const reduce = matchMedia('(prefers-reduced-motion: reduce)');
let calm = reduce.matches; reduce.addEventListener?.('change', (e) => { calm = e.matches; });

// ───────── layers ─────────
// The front layer is one fixed canvas over the whole page. A component can also have a back layer: a canvas inside it, behind the control.
// Effects are placed in page coordinates, so they scroll with their control.
let g = null, dpr = 1;
const front = { c: null, g: null, live: [], dirty: false }, layers = [front];
function ensureFront() {
  if (front.c || !document.body) return;
  front.c = Object.assign(document.createElement('canvas'), { className: 'sakuga-fx' }); front.c.setAttribute('aria-hidden', 'true');
  document.body.append(front.c); front.g = front.c.getContext('2d'); size();
}
function size() { dpr = Math.min(2.5, devicePixelRatio || 1); if (front.c) { front.c.width = innerWidth * dpr; front.c.height = innerHeight * dpr; } }
addEventListener('resize', size);
function backLayer(canvas) { const L = { c: canvas, g: canvas.getContext('2d'), live: [], dirty: false }; layers.push(L); return L; }
const add = (life, draw, L) => { const p = { t: 0, life, draw }; if (!calm) { L = L || front; if (L === front) ensureFront(); L.live.push(p); start(); } return p; };
// an effect with no end: it draws every frame until its handle is marked dead. layer puts it on a component's back layer.
const persist = (draw, layer) => add(Infinity, draw, layer);
function tick(dt) {
  for (const L of layers) {
    if (!L.c || (!L.live.length && !L.dirty)) continue;
    let ox = scrollX, oy = scrollY;
    if (L !== front) {   // a back layer: keep its pixels matched to where it sits
      if (!L.c.isConnected) { L.live = []; L.dirty = false; continue; }
      const r = L.c.getBoundingClientRect(), w = Math.round(r.width * dpr), h = Math.round(r.height * dpr);
      if (L.c.width !== w) L.c.width = w; if (L.c.height !== h) L.c.height = h; ox += r.left; oy += r.top;
    }
    g = L.g; g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, L.c.width / dpr, L.c.height / dpr);
    g.translate(-ox, -oy); g.lineJoin = g.lineCap = 'round';
    L.live = L.live.filter((p) => !p.dead && (p.t += dt) < p.life);
    for (const p of L.live) { g.save(); p.draw(p.t / p.life, p.t, dt); g.restore(); }
    L.dirty = L.live.length > 0;
  }
}

// ───────── the clock ─────────
// One loop for every component. later() runs on this clock, not on setTimeout, so a film can step it a frame at a time.
let now = 0, last = 0, running = false;
const frames = new Set(), timers = [];
const later = (ms, f) => { timers.push({ at: now + ms / 1000, f }); start(); };
function advance(dt) {
  now += dt;
  const due = timers.filter((q) => q.at <= now).sort((a, b) => a.at - b.at); if (due.length) for (const q of due) timers.splice(timers.indexOf(q), 1);
  for (const q of due) q.f();
  for (const f of frames) f(dt);
  tick(dt);
}
function loop(ms) {
  if (!running) return;
  const dt = clamp((ms - last) / 1000, 0, 0.034); last = ms;   // a frame's timestamp can be earlier than the moment the loop started
  if (!api.paused) advance(dt);
  if (!frames.size && !timers.length && layers.every((L) => !L.live.length && !L.dirty)) { running = false; return; }
  requestAnimationFrame(loop);
}
function start() { if (running) return; running = true; last = performance.now(); requestAnimationFrame(loop); }

// ───────── the effects ─────────
// circles drawn as one shape: outline, shadow tone, then the light side slid up and to the left
function blob(cs, lw = 1.5, _, { lx = -1, arcs = false, deep = 1 } = {}) {
  const u = new Path2D(); for (const [x, y, r] of cs) if (r > 0.3) { u.moveTo(x + r, y); u.arc(x, y, r, 0, TAU); }
  g.save(); g.lineWidth = lw * 2; g.strokeStyle = P.line; g.stroke(u); g.restore();
  g.save(); g.clip(u); g.fillStyle = P.shade; g.fillRect(-1e4, -1e4, 2e4, 2e4); const r = cs[0] ? cs[0][2] : 8;
  g.save(); g.translate(lx * r * 0.2 * deep, -r * 0.26 * deep); g.fillStyle = P.fill; g.fill(u); g.restore();
  if (arcs) { g.strokeStyle = P.line; g.lineWidth = lw * 0.75; g.beginPath(); for (const [x, y, rr] of cs) if (rr > 3) { g.moveTo(x + Math.cos(-2.7) * rr, y + Math.sin(-2.7) * rr); g.arc(x, y, rr, -2.7, -0.5); } g.stroke(); }   // the cumulus lines inside the cloud
  g.restore();
}
function shape(path, lw = 1.5, off = 3, fill = P.fill) {
  g.save(); g.lineWidth = lw * 2; g.strokeStyle = P.line; g.stroke(path); g.restore();
  g.save(); g.clip(path); g.fillStyle = P.shade; g.fillRect(-1e4, -1e4, 2e4, 2e4); g.translate(-off * 0.7, -off); g.fillStyle = fill; g.fill(path); g.restore();
}
// a puff of smoke: lobes swell out with a little overshoot, roll, and shrink away
function puff(x, y, { n = 5, size = 13, vx = 0, vy = -18, life = 0.8, spread = 1 } = {}) {
  const lobes = Array.from({ length: n }, (_, i) => ({ a: (i / n) * TAU + rnd(0.6), d: rnd(0.25, 0.9) * size * spread, r: rnd(0.55, 1) * size, ph: rnd(TAU), sp: rnd(0.6, 1.3) }));
  lobes.unshift({ a: 0, d: 0, r: size, ph: 0, sp: 1 });
  add(life, (k, t) => {
    const grow = back(clamp(t / 0.22)), die = 1 - inn(clamp((k - 0.55) / 0.45)), px = x + vx * out(k) * life, py = y + vy * out(k) * life;
    blob(lobes.map((l) => [px + Math.cos(l.a + t * 0.9 * l.sp) * l.d * (0.5 + out(k) * 0.9), py + Math.sin(l.a + t * 0.9 * l.sp) * l.d * (0.5 + out(k) * 0.9) - out(k) * 5 * l.sp, l.r * grow * die * (1 + Math.sin(t * 9 + l.ph) * 0.05)]), 1.5, true, { lx: 0.5, arcs: size > 6.5, deep: 1.5 });
  });
}
// the impact: pink needles, a star in the shadow tone, and a white star on top; it leaves by its points thinning to nothing
function burst(x, y, { r = 44, spikes = 13, life = 0.34, layer } = {}) {
  const j = Array.from({ length: spikes * 2 }, (_, i) => (i % 2 ? rnd(0.34, 0.5) : rnd(0.75, 1.15))), rot = rnd(TAU), pins = Array.from({ length: 8 }, (_, i) => ({ a: i / 8 * TAU + rnd(0.5), l: rnd(1.25, 1.75), w: rnd(0.03, 0.055) }));
  const star = (R, turn, inner = 1) => { const p = new Path2D(); j.forEach((m, i) => { const a = rot + turn + (i / j.length) * TAU, rr = R * (i % 2 ? m * inner : m); p[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * rr, y + Math.sin(a) * rr); }); p.closePath(); return p; };
  add(life, (k) => {
    const R = r * out(clamp(k / 0.3)), hollow = 1 + inn(clamp((k - 0.35) / 0.65)) * 1.3, r0 = R * 0.6 * Math.min(1.9, hollow);
    g.save(); g.fillStyle = P.accent; g.beginPath(); for (const n of pins) { const l = R * n.l; if (l <= r0) continue; g.moveTo(x + Math.cos(n.a - n.w) * r0, y + Math.sin(n.a - n.w) * r0); g.lineTo(x + Math.cos(n.a) * l, y + Math.sin(n.a) * l); g.lineTo(x + Math.cos(n.a + n.w) * r0, y + Math.sin(n.a + n.w) * r0); } g.fill(); g.restore();
    const big = star(R * 1.16, 0.19, hollow); g.save(); g.fillStyle = P.shade; g.fill(big); g.strokeStyle = P.line; g.lineWidth = 1.2; g.stroke(big); g.restore();
    shape(star(R * 0.84, 0, hollow), 1.4, 3);
  }, layer);
}
// chips of crystal: long facets with one edge line, tumbling and falling
function shards(x, y, { n = 7, speed = 190, size = 5, life = 0.75, dir = -Math.PI / 2, arc = Math.PI, grav = 420 } = {}) {
  for (let i = 0; i < n; i++) {
    const a = dir + rnd(-arc, arc) / 2, v = speed * rnd(0.5, 1.15), s = size * rnd(0.6, 1.4), spin = rnd(-7, 7), pts = [[-1.4, 0.1], [-0.6, -0.7], [1.2, -0.45], [1.5, 0.15], [0.4, 0.75]].map(([px, py]) => [px * rnd(0.8, 1.2), py * rnd(0.8, 1.2)]);
    add(life * rnd(0.7, 1), (k, t) => {
      const px = x + Math.cos(a) * v * t, py = y + Math.sin(a) * v * t + grav * t * t, sc = s * (1 - inn(clamp((k - 0.6) / 0.4)));
      g.translate(px, py); g.rotate(spin * t + a); const p = new Path2D(); pts.forEach(([u, w], q) => p[q ? 'lineTo' : 'moveTo'](u * sc, w * sc)); p.closePath(); shape(p, 1.1, sc * 0.45, P.fill);
      if (sc > 2.5) { g.strokeStyle = P.line; g.lineWidth = 0.9; g.beginPath(); g.moveTo(pts[1][0] * sc, pts[1][1] * sc); g.lineTo(pts[4][0] * sc, pts[4][1] * sc); g.stroke(); }
    });
  }
}
function ring(x, y, { rx = 40, ry = 12, life = 0.5, w = 5 } = {}) {
  add(life, (k) => { const s = out(k), lw = w * (1 - k); g.beginPath(); g.ellipse(x, y, rx * (0.3 + s), ry * (0.3 + s), 0, 0, TAU); g.strokeStyle = P.line; g.lineWidth = lw + 2.4; g.stroke(); g.strokeStyle = P.fill; g.lineWidth = lw; if (lw > 0.3) g.stroke(); });
}
// a splash crown: tongues of water rise out of a line and fall back with foam on their tips, drops fly
function splash(x, y, { w = 34, h = 26, life = 0.7 } = {}) {
  const n = 7, ts = Array.from({ length: n }, (_, i) => ({ u: i / (n - 1) - 0.5, h: h * rnd(0.55, 1.1) * (1 - Math.abs(i / (n - 1) - 0.5) * 0.7), lean: rnd(-0.4, 0.4), d: rnd(0, 0.14) }));
  add(life, (k) => {
    const p = new Path2D(), tips = []; p.moveTo(x - w * 0.62, y);
    ts.forEach((s) => { const kk = clamp((k - s.d) / 0.8), up = Math.sin(kk * Math.PI) * s.h * (1 - kk * 0.25), bx = x + s.u * w, half = w / n * 0.62, tx = bx + (s.u * 1.6 + s.lean) * up * 0.5; tips.push([tx, y - up, up]); p.quadraticCurveTo(bx - half, y - up * 0.25, tx, y - up); p.quadraticCurveTo(bx + half * 0.5, y - up * 0.3, bx + half, y); });
    p.lineTo(x + w * 0.62, y); p.closePath();
    g.save(); g.lineWidth = 2.8; g.strokeStyle = P.line; g.stroke(p); g.restore(); g.fillStyle = P.shade; g.fill(p);
    g.save(); g.clip(p); g.fillStyle = P.fill; for (const [tx, ty, up] of tips) if (up > 4) { g.beginPath(); g.ellipse(tx, ty + up * 0.2, up * 0.2 + 1.4, up * 0.34, 0, 0, TAU); g.fill(); } g.restore();
  });
  for (let i = 0; i < 7; i++) { const a = -Math.PI / 2 + rnd(-1.1, 1.1), v = rnd(100, 210), r0 = rnd(2, 4);   // drops are teardrops, pointed the way they came from
    add(life * rnd(0.8, 1.15), (k, t) => { const px = x + Math.cos(a) * v * t, py = y - 6 + Math.sin(a) * v * t + 520 * t * t, r = r0 * (1 - inn(clamp((k - 0.6) / 0.4))), ang = Math.atan2(Math.sin(a) * v + 1040 * t, Math.cos(a) * v), d = new Path2D();
      g.translate(px, py); g.rotate(ang); d.moveTo(-r * 2.6, 0); d.quadraticCurveTo(-r * 0.6, -r * 1.05, r * 0.5, -r * 0.9); d.arc(r * 0.4, 0, r * 0.95, -1.4, 1.4); d.quadraticCurveTo(-r * 0.6, r * 1.05, -r * 2.6, 0); if (r > 0.5) shape(d, 1, r * 0.5); }); }
}
// a slash: a crescent whose head races ahead and whose tail catches up
function slash(x, y, { len = 110, ang = -0.5, life = 0.42, thick = 15, col } = {}) {
  const R = len * 0.9, cx = x - Math.cos(ang - Math.PI / 2) * R * 0.86, cy = y - Math.sin(ang - Math.PI / 2) * R * 0.86, a0 = ang - Math.PI / 2 - 0.62, sweep = 1.24, c = col || P.accent;
  add(life, (k) => {
    const head = out(clamp(k / 0.42)), tail = inn(clamp((k - 0.22) / 0.78)); if (head - tail < 0.01) return;
    const cres = (T) => { const p = new Path2D(), N = 26; for (let i = 0; i <= N; i++) { const u = lerp(tail, head, i / N), a = a0 + sweep * u; p[i ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * R, cy + Math.sin(a) * R); } for (let i = N; i >= 0; i--) { const q = i / N, u = lerp(tail, head, q), a = a0 + sweep * u, rr = R - T * Math.sin(q * Math.PI) ** 0.7; p.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } p.closePath(); return p; };
    g.save(); g.fillStyle = c; g.fill(cres(thick)); g.restore(); g.fillStyle = P.fill; g.fill(cres(thick * 0.42));
    g.strokeStyle = P.line; g.lineWidth = 1.3; g.stroke(cres(thick));
  });
}
// speed lines: strokes that shoot out one way and thin away
function lines(x, y, { n = 7, dir = Math.PI, len = 46, spread = 26, life = 0.3 } = {}) {
  for (let i = 0; i < n; i++) { const o = rnd(-spread, spread), l = len * rnd(0.5, 1.3), d = rnd(0, 0.25), w = rnd(1, 2.6); add(life, (k) => { const kk = clamp((k - d) / (1 - d)), a = out(kk), b = inn(kk), px = x - Math.sin(dir) * o, py = y + Math.cos(dir) * o; g.strokeStyle = P.line; g.lineWidth = w * (1 - b); g.beginPath(); g.moveTo(px + Math.cos(dir) * l * b * 1.4, py + Math.sin(dir) * l * b * 1.4); g.lineTo(px + Math.cos(dir) * l * (0.2 + a * 1.2), py + Math.sin(dir) * l * (0.2 + a * 1.2)); if (kk > 0) g.stroke(); }); }
}
// accent ticks: little wedges that point at something and fly off it
function ticks(x, y, { n = 3, r = 16, len = 9, dir = -0.9, life = 0.4, fan = 0.42 } = {}) {
  add(life, (k) => { const a = out(clamp(k / 0.5)), b = inn(clamp((k - 0.4) / 0.6)); g.save(); g.fillStyle = P.accent; g.beginPath();
    for (let i = 0; i < n; i++) { const an = dir + (i - (n - 1) / 2) * fan, r0 = r + len * b * 1.25, r1 = r + len * a * 1.25, hw = 0.07 + 2.2 / (r1 + 8); if (r1 - r0 < 0.6) continue; g.moveTo(x + Math.cos(an) * r0, y + Math.sin(an) * r0); g.lineTo(x + Math.cos(an - hw) * r1, y + Math.sin(an - hw) * r1); g.lineTo(x + Math.cos(an + hw) * r1, y + Math.sin(an + hw) * r1); g.closePath(); }
    g.fill(); g.restore(); });
}
// a smoke ring: a lumpy hoop that drifts off and shrinks
function donut(x, y, { r = 20, vx = 30, vy = -50, life = 1, tilt = -0.25 } = {}) {
  const ph = rnd(TAU);
  add(life, (k, t) => { const s = back(clamp(t / 0.22)) * (1 - inn(clamp((k - 0.6) / 0.4))), px = x + vx * out(k) * life, py = y + vy * out(k) * life, hole = 0.42 + 0.22 * k, p = new Path2D(); if (s < 0.03) return;
    for (const [m, bump] of [[1, 0.09], [hole, 0.05]]) for (let i = 0; i <= 48; i++) { const a = i / 48 * TAU, rr = r * s * m * (1 + bump * Math.sin(a * 9 + ph + t * 2)), ex = Math.cos(a) * rr, ey = Math.sin(a) * rr * 0.52; p[i ? 'lineTo' : 'moveTo'](px + ex * Math.cos(tilt) - ey * Math.sin(tilt), py + ex * Math.sin(tilt) + ey * Math.cos(tilt)); }
    g.save(); g.lineWidth = 3; g.strokeStyle = P.line; g.stroke(p); g.restore(); g.save(); g.clip(p, 'evenodd'); g.fillStyle = P.shade; g.fillRect(-1e4, -1e4, 2e4, 2e4); g.translate(r * 0.06, -r * 0.2); g.fillStyle = P.fill; g.fill(p, 'evenodd'); g.restore(); });
}
// wobble marks: the two little arcs beside something that has just stopped
function wob(x, y, { dir = 1, r = 16, life = 0.45 } = {}) {
  add(life, (k) => { g.strokeStyle = P.line; g.lineWidth = 2.2 * (1 - k); if (g.lineWidth < 0.2) return; g.beginPath(); for (const d of [0, 7]) { const rr = r + d + out(k) * 8, c = dir > 0 ? 0 : Math.PI; g.moveTo(x - dir * r + Math.cos(c - 0.45) * rr, y + Math.sin(c - 0.45) * rr); g.arc(x - dir * r, y, rr, c - 0.45, c + 0.45); } g.stroke(); });
}
// a glint: a four-pointed sparkle that opens and closes
function kira(x, y, { r = 9, life = 0.6, col } = {}) {
  add(life, (k, t) => { const s = r * Math.sin(k * Math.PI) ** 0.6, q = s * 0.16, p = new Path2D(); g.translate(x, y); g.rotate(Math.sin(t * 3) * 0.2); p.moveTo(0, -s); p.quadraticCurveTo(q, -q, s * 0.7, 0); p.quadraticCurveTo(q, q, 0, s); p.quadraticCurveTo(-q, q, -s * 0.7, 0); p.quadraticCurveTo(-q, -q, 0, -s);
    g.save(); g.fillStyle = col || P.fill; g.fill(p); g.restore(); g.strokeStyle = P.accent; g.lineWidth = 2; g.stroke(p); });
}

// ───────── the lettering ─────────
// Six sound-effect words, painted with GPT Image and traced into paths by tools/trace.py: [width, height, path].
// >>> words (written by tools/trace.py)
const WORDS = {"don":[520,183,"M282 177C282 165 282 163 285 156C289 149 290 143 290 142C289 136 289 124 291 117C291 112 292 107 292 105L292 101L304 100C311 99 319 98 322 98L328 97L327 102C327 104 327 111 327 118C326 129 324 140 323 142C322 142 322 149 322 157C321 181 320 182 292 182L282 183L282 177ZM343 172C343 171 342 166 341 161C341 156 339 147 339 140C338 132 338 126 337 124C333 118 332 114 331 107C331 103 331 99 330 98C330 96 331 96 338 96C347 95 360 93 362 92C364 92 364 93 364 98C364 102 364 108 365 112C366 117 367 121 366 121C365 123 368 122 370 119C371 117 372 115 372 110C372 104 375 94 376 94C377 94 377 93 377 93C377 91 379 91 392 89C404 87 409 87 409 88C409 89 408 91 407 94C406 97 404 102 403 104C402 106 401 109 401 109C400 110 396 119 396 121C396 122 395 124 394 126C393 129 392 131 391 132C391 135 391 135 390 141C389 146 384 157 379 162C378 164 375 167 375 168C374 170 373 171 370 172C368 172 366 173 365 173C365 174 359 174 354 175L343 175L343 172ZM407 168C407 168 405 168 402 168C399 167 398 167 398 164C398 161 398 159 399 159C400 158 400 157 400 156C400 156 401 153 402 150C405 145 405 143 405 132C405 124 405 119 406 117C407 113 409 111 410 110C411 109 412 104 412 98C412 86 412 86 421 86C425 85 431 85 435 84C445 83 444 82 445 89C446 96 445 98 443 104C441 109 441 119 443 123C444 126 444 137 442 138C441 139 441 140 441 140C442 140 441 143 440 146C439 149 438 153 438 155C438 162 437 165 433 165C431 166 427 166 425 167C420 168 407 169 407 168ZM36 162C28 160 18 160 13 160C8 160 4 159 4 159C4 159 3 158 2 158C0 157-1 148 1 146C2 146 2 145 2 144C2 141 7 135 10 135C12 135 19 134 26 133C34 132 40 131 40 132C41 132 44 133 48 133C51 134 57 135 61 136C71 139 76 137 79 130C80 127 80 126 86 126C90 125 98 124 105 123C120 122 121 122 119 127C118 132 117 134 108 143C97 154 86 159 70 162C57 164 56 164 36 162ZM160 147C158 147 152 146 146 146L135 146L139 140C150 120 153 118 168 116C173 115 182 114 188 113C195 113 202 112 204 111C214 110 235 108 242 107C250 106 251 107 250 111C250 113 250 115 251 115C253 117 252 143 250 144C248 145 222 147 220 146C218 145 218 144 219 142C220 136 220 130 218 129C214 127 200 126 191 127C179 129 180 128 177 140C175 147 174 148 168 148C165 148 161 147 160 147ZM13 127C15 124 15 123 14 118C12 110 14 108 22 108C24 108 30 107 36 107C62 103 73 102 78 101C82 101 88 100 92 100C105 98 112 101 116 113C118 118 118 119 106 120C100 121 92 122 88 122C84 123 81 123 80 123C80 123 79 121 79 119C80 115 77 111 74 111C73 111 71 111 69 111C54 109 54 109 53 112C53 114 51 117 49 120C46 122 44 125 44 126C43 127 34 129 17 131L11 131L13 127ZM466 129C459 125 456 115 461 111C471 102 480 97 485 100C489 102 494 114 493 119C492 126 474 133 466 129ZM159 113C160 113 160 110 160 107C161 92 165 90 189 88C195 87 201 87 202 86C204 86 204 86 203 88C202 89 201 93 200 97C199 100 198 104 197 105C195 106 214 106 217 104C218 104 218 92 216 91C215 90 215 89 215 87C215 86 216 85 227 84C237 82 246 82 249 82C251 82 252 88 252 96L251 102L241 104C236 104 226 106 218 107C211 107 200 109 194 109C187 110 177 111 172 112C167 113 162 113 161 114C159 114 159 114 159 113ZM16 104C16 103 17 101 19 100C23 94 25 89 24 84C24 78 25 74 29 70C35 61 38 54 38 46C39 40 39 37 41 36C42 34 44 32 45 31C47 28 48 28 56 29C61 29 68 29 71 29C74 29 77 29 78 30C78 30 81 31 85 32C89 32 93 33 96 34C98 34 104 36 108 36C120 38 125 41 131 47C139 57 138 62 128 75C125 79 122 83 122 84C122 85 115 91 112 93C110 94 107 95 105 95C102 95 96 96 90 96C80 98 59 100 47 102C44 102 37 103 32 104C21 105 15 105 16 104ZM293 97C292 96 293 89 294 87C295 87 295 84 295 81L296 76L310 74C317 73 330 71 339 70C357 68 356 68 356 69C356 72 356 75 357 76C360 79 365 89 363 89C363 89 360 89 356 90C353 90 347 91 344 91C340 92 335 92 333 93C330 93 329 93 329 91C328 88 326 88 327 91C327 94 327 94 320 94C311 95 297 97 295 98C294 98 293 98 293 97ZM472 94C472 93 472 92 473 91C474 90 474 87 475 84C475 78 474 79 485 78C490 77 496 77 497 76C499 76 500 76 500 76C500 78 497 86 495 89C493 92 493 93 486 94C476 95 472 95 472 94ZM172 84C173 82 174 81 175 81C176 80 185 65 185 63C185 63 187 59 189 55C192 51 195 46 195 44C199 37 202 35 208 36C213 37 225 36 238 33L242 33L242 38C243 40 244 45 245 49C247 55 247 57 246 63C246 67 245 72 245 74L245 78L231 80L217 82L217 78C219 72 219 65 218 65C217 65 215 67 214 70C208 83 209 83 181 86C178 86 174 86 173 87L170 87L172 84ZM381 86C381 86 382 83 384 80C385 78 386 75 386 74C386 74 387 71 388 69L390 64L398 63C403 63 413 61 422 60C431 59 441 58 445 57L452 57L452 61C452 64 446 78 444 79C443 80 438 80 433 81C427 82 421 82 418 83C414 83 414 83 414 81C415 79 415 79 413 81C411 84 410 84 399 85C392 86 386 86 384 87C382 87 381 87 381 86ZM89 82C95 79 98 72 95 67C93 61 90 60 80 59L70 59L70 62C69 63 69 66 68 68C68 71 67 75 65 78C64 80 62 83 62 83C61 85 85 84 89 82ZM474 74C473 71 475 64 478 58C480 53 480 53 484 53C487 52 493 52 500 51L511 49L509 53C508 55 507 58 506 58C506 59 505 60 505 61C505 62 504 65 503 68L501 72L493 74C479 76 474 76 474 74ZM296 70C295 68 298 56 299 55C303 53 309 52 322 51C337 51 346 50 348 49C352 45 355 48 356 59L356 65L353 65C352 65 346 66 340 66C334 67 324 69 316 69C309 70 302 71 300 72C298 72 297 72 296 70ZM396 53C398 50 399 46 399 46C399 43 406 41 422 40C432 40 443 38 449 36L452 35L452 44C452 54 452 53 441 54C435 55 416 57 403 59C391 61 392 61 396 53ZM480 49C480 48 481 45 482 42C483 39 485 33 486 27L487 18L503 18C518 19 522 19 519 21C519 21 518 23 517 25C515 27 514 29 514 29C513 29 512 34 512 40L511 46L506 47C503 47 498 48 495 48C492 48 488 48 485 49C482 50 481 49 480 49ZM207 30C207 30 206 29 205 29C200 29 195 24 195 20C195 13 208 2 216 2C223 2 224 4 223 11C222 14 222 16 222 17C221 18 221 20 220 21C220 23 219 24 219 25C219 25 218 27 217 28C214 30 207 32 207 30ZM237 27C236 27 233 25 231 23C222 14 232 0 247 0C253 1 259 3 261 6C262 9 263 19 261 22C259 27 246 30 237 27Z"],"kachi":[520,124,"M360 123L350 123L351 120C352 118 353 112 355 106C357 100 359 94 360 92C361 90 362 82 361 78C360 76 362 76 383 74C392 73 395 72 395 71C395 70 386 70 376 72C360 75 358 74 364 64C367 59 367 57 367 53L366 48L377 47C383 47 390 46 392 46C395 45 397 45 397 45C397 46 396 49 394 54C391 62 390 66 392 62C393 60 399 56 405 52C407 51 410 48 412 46C415 43 415 43 427 42C433 41 441 40 444 40L448 39L445 42C434 50 425 62 426 66C427 73 433 88 435 90C436 90 437 94 438 98C440 103 442 109 444 113C448 121 448 121 440 121C437 121 432 121 430 122C423 124 418 123 416 120C415 119 413 116 412 114C409 110 409 110 408 102C407 99 406 94 404 91L401 85L397 88C395 90 392 91 392 91C391 91 389 93 387 94C384 98 384 98 384 103C385 107 385 109 384 112C383 114 381 116 381 118C380 119 380 120 380 122C379 124 378 124 360 123ZM72 120C70 120 66 119 64 118C54 117 55 114 64 112C67 112 74 111 78 110C85 109 86 109 88 110C89 112 91 119 91 120C90 121 76 121 72 120ZM467 118C464 116 463 99 466 96C472 91 483 90 488 94C495 99 495 102 488 110C480 119 472 122 467 118ZM2 115C2 114 2 110 1 108C0 103 0 103 3 95C5 91 7 87 7 86C7 85 8 83 9 81L11 77L23 76C29 76 40 74 47 73C74 70 73 70 73 72C73 73 74 75 74 77C76 81 76 81 65 82C60 83 54 83 52 84C49 84 47 84 47 83C49 81 46 81 44 83C42 84 40 85 39 85C37 85 37 85 37 87C38 88 37 90 35 91C32 95 31 97 28 107C28 111 25 114 23 114C21 114 20 115 18 115C16 117 7 119 3 119C1 119 1 119 2 115ZM57 108C56 107 56 104 56 103C56 102 54 99 53 96C48 88 47 86 51 86C54 86 69 84 74 83C77 83 80 88 82 97C82 99 83 103 83 104C85 107 85 107 70 109C66 109 61 109 60 110C58 110 57 110 57 108ZM278 98C274 97 270 95 267 91L264 88L269 87C272 87 276 87 277 86C278 86 284 86 288 85C293 84 303 83 310 82C317 82 325 81 327 80L332 80L329 85C327 89 325 91 320 95C316 99 289 101 278 98ZM146 96C143 96 139 95 138 94C136 93 132 93 123 93L111 93L113 89C114 87 115 84 115 82C115 79 115 79 134 76C157 74 180 74 180 77C180 78 179 80 178 82C178 83 176 87 175 90L173 96L165 96C161 96 156 96 154 96C153 97 149 96 146 96ZM199 93C199 93 200 90 200 88C201 86 202 81 201 77C201 69 202 68 213 67C219 66 224 66 226 65C230 64 231 76 226 83C224 86 223 89 223 89C223 90 220 91 212 91C208 92 203 92 202 93C200 93 199 93 199 93ZM480 86L471 86L474 82C476 80 476 78 476 75C475 64 476 61 477 58C478 56 480 51 481 47C484 34 484 34 493 34C498 33 503 32 506 32C514 30 515 37 509 49C506 55 505 59 505 62C505 65 504 68 503 69C502 71 500 73 499 76C497 78 496 81 496 83C495 85 494 86 494 86C493 86 492 86 491 86C490 86 485 86 480 86ZM260 85C258 84 256 79 257 75C257 72 257 69 257 66C258 61 257 62 271 60C284 59 285 59 284 61C280 69 287 76 300 78C309 79 312 77 315 68L317 61L322 62C325 62 330 62 332 63C336 64 339 64 342 63C348 62 348 63 345 69C345 71 343 73 341 75C337 76 335 77 313 79C306 80 294 82 287 83C263 85 261 86 260 85ZM115 73C115 67 118 65 127 64C131 63 136 63 139 62L143 62L143 67C144 73 145 73 134 74C128 75 122 75 119 76L115 76L115 73ZM12 71C18 45 18 45 22 38C26 30 27 28 27 24C27 21 33 20 45 21C54 21 54 22 51 26C50 27 49 29 49 30C49 31 49 32 48 33C47 33 47 41 49 44C49 45 48 49 46 54C44 58 42 61 42 62C43 62 69 37 74 32C76 29 80 24 81 23L84 20L98 21C105 22 113 23 114 23L118 24L112 29C110 31 103 37 98 41C82 53 70 63 71 64C73 67 72 68 67 68C57 70 38 72 28 73C23 74 17 74 15 74L11 75L12 71ZM206 65C206 64 210 56 211 54C211 54 214 53 218 53C222 53 227 52 228 51C231 51 232 52 230 56C230 57 229 59 229 60C228 63 229 63 212 65C208 65 206 65 206 65ZM122 61C122 61 123 59 124 57C127 51 128 48 127 44C125 40 125 37 129 30C131 26 133 22 133 21C133 21 133 20 134 20C135 20 139 7 138 5C138 3 146 2 156 3C163 4 164 5 162 8C162 9 161 11 161 14C160 18 158 24 156 28C156 29 155 31 155 32C155 35 153 40 150 47C148 50 146 54 145 56C144 57 144 59 144 59C143 59 140 59 135 60C131 61 126 61 125 62C123 62 122 62 122 61ZM257 55C258 48 258 48 269 47C284 45 283 45 285 50C287 55 286 56 275 57C270 58 264 58 261 59L257 59L257 55ZM211 50C212 49 211 47 210 45C208 40 209 38 211 32C213 29 214 25 215 23C215 20 216 15 218 11L220 4L227 3C231 3 236 2 239 2C244 2 244 2 243 4C242 6 242 9 242 13C242 18 241 22 240 27C238 31 237 36 237 37C237 38 236 41 235 43C234 48 233 48 229 49C218 51 211 51 211 50ZM366 44C366 43 367 41 368 38L371 34L381 33C387 33 393 32 396 31C398 31 400 31 400 31C400 32 400 34 399 37C398 43 398 42 383 44C378 45 372 45 370 46C367 46 366 46 366 44ZM263 42C265 38 266 34 268 30C268 28 276 18 282 12C284 9 289 7 293 7C294 7 297 6 309 1C318-2 334 2 345 10C348 13 349 14 351 20C352 24 353 28 354 29C354 30 354 31 354 31C354 31 354 32 355 32C356 33 356 33 355 33C352 34 340 36 332 37L325 37L325 35C325 27 322 25 311 25C303 25 302 25 297 28C293 31 286 39 284 42C284 42 274 44 267 45L261 45L263 42ZM417 40C417 38 423 31 426 28C432 22 435 21 443 21C447 21 451 21 452 20C452 19 462 19 466 19C467 19 466 20 465 22C463 24 462 26 462 26C462 26 460 29 457 31C453 35 452 36 446 37C442 37 438 37 438 38C437 38 433 38 430 38C426 39 421 39 420 40C418 40 417 40 417 40ZM341 39C342 38 355 37 355 38C355 39 352 39 348 39C344 39 341 39 341 39ZM372 28C374 22 375 22 382 23C385 23 391 23 395 24C400 24 403 25 403 25C403 28 397 29 384 30C380 31 375 31 374 32C371 32 371 32 372 28ZM488 27C489 25 490 21 490 19L490 15L504 16C521 16 521 16 517 20C515 22 514 24 514 24C514 28 503 31 489 31L486 31L488 27Z"],"shu":[520,109,"M124 108C118 107 111 101 106 96C100 89 100 87 104 80C106 75 107 72 107 68C107 55 111 52 126 50C131 49 136 49 136 49C136 49 135 51 134 52C134 53 133 57 133 60C133 65 132 67 130 70C126 77 127 84 132 87C139 91 153 85 153 79C153 74 155 70 160 65C164 60 164 60 164 53C164 49 164 46 164 46C165 45 190 42 191 42C193 44 189 53 186 57C182 61 182 62 181 68C180 74 180 74 170 90C164 98 165 98 156 99C152 99 149 100 149 101C149 102 153 102 160 100L162 100L160 103C155 107 134 110 124 108ZM321 99C318 98 317 98 318 97C320 95 319 94 316 95C313 95 312 95 308 92C299 85 301 83 318 81C322 81 336 80 349 78C380 74 379 74 375 80C368 89 355 96 343 97C329 100 326 100 321 99ZM448 92C447 92 443 91 439 91L433 91L436 86C438 83 439 80 439 78C439 75 441 67 442 67C442 67 447 66 452 66L461 64L460 68C459 77 459 80 458 81C457 81 457 84 456 87C456 93 455 94 448 92ZM386 89C386 88 391 73 391 73C391 73 396 72 402 71C409 71 414 70 415 70C416 70 415 72 413 77C411 80 409 85 408 87L408 90L397 90C391 90 387 90 386 89ZM228 85C220 83 214 76 214 68C214 62 214 62 227 62C236 62 237 62 237 63C237 69 245 69 255 64C264 59 264 56 254 55C234 52 227 50 223 47C221 44 220 38 222 38C222 38 228 37 234 37C253 34 271 36 278 40C285 45 286 47 284 53C283 55 282 59 282 61C282 71 271 80 256 82C253 83 247 83 245 84C239 85 230 86 228 85ZM481 83C477 81 477 78 483 68C487 60 493 59 500 64C503 66 498 80 494 83C492 84 484 84 481 83ZM301 77C299 72 299 68 301 64C302 62 302 60 301 55L301 48L307 38C318 21 324 16 334 15C335 14 340 13 344 11C353 8 357 8 369 13C377 16 383 21 383 24C383 25 384 28 386 30C388 34 388 36 387 39L387 43L376 43C371 43 365 43 365 44C363 44 363 44 363 41C363 37 357 31 352 30C341 28 329 37 328 49C328 53 327 56 325 58C321 64 322 69 328 75C329 77 330 78 330 78C330 78 325 79 318 79C303 82 303 82 301 77ZM17 79C15 79 10 78 7 79L2 79L2 72C3 66 3 63 1 59C0 54 0 52 1 48C2 44 2 42 1 40C0 36 0 32 2 27C3 22 3 21 2 13C-1 1-1 1 13 2C19 2 24 3 24 3C26 4 25 12 24 18C22 22 22 23 23 28C25 33 25 34 23 40C22 44 21 48 22 49C22 50 22 50 23 47C23 46 26 41 29 37C31 33 34 28 34 27C35 26 37 21 39 18C40 14 42 10 42 10C42 9 43 7 44 5L46 2L57 2L67 1L67 7C67 11 67 15 68 17C69 20 69 22 67 28C66 32 65 36 65 42L66 49L68 46C70 44 71 40 71 36C71 34 77 23 79 22C80 21 82 15 82 12C82 10 84 8 86 5L91 1L101 0C111 0 112 0 110 3C109 3 109 6 108 9C107 12 106 16 104 18C102 21 100 25 99 27C99 30 96 35 94 38C92 41 89 45 88 47C86 52 85 53 80 53C78 53 77 54 77 54C77 55 78 55 81 55C86 54 86 55 83 58C82 59 79 65 76 70C71 80 71 79 57 79L47 78L48 74C48 73 48 69 47 66C46 62 46 61 48 56C50 52 50 51 49 46C49 43 49 39 49 37L49 34L47 37C46 39 45 42 44 44C43 46 42 49 40 51C37 55 34 61 34 61C35 61 34 63 33 65C32 67 30 71 30 74C28 81 27 81 17 79ZM349 75C349 75 351 73 353 70L357 66L369 66L381 65L380 68C379 72 380 72 367 74C361 74 354 75 352 75C350 76 349 76 349 75ZM391 70C391 67 393 63 396 60C398 58 398 56 399 49C400 43 400 40 402 36C408 27 409 25 409 21C409 12 413 10 426 12C432 12 432 13 428 24C427 28 426 33 425 37L425 44L428 43C430 43 435 43 440 43C450 43 450 43 451 32C452 29 453 23 455 20L457 14L467 15C473 15 478 15 478 16C480 17 477 27 473 34C469 40 469 42 468 50C467 61 466 62 454 63C448 64 444 64 444 63C444 63 441 62 438 62C435 62 429 61 425 60C416 59 415 59 416 64L416 68L405 69C399 70 394 70 393 71C392 71 391 71 391 70ZM489 57C482 56 482 56 486 52C489 47 489 47 489 38C489 34 489 30 491 28C491 25 492 21 492 18C493 13 493 11 495 8C499 2 500 2 509 1C518-1 521 0 519 3C518 4 518 6 518 11C518 16 518 18 515 24C513 27 511 33 510 35C510 38 508 42 507 45C505 48 504 52 504 54C504 58 501 59 489 57ZM116 46C116 44 117 40 119 36C121 32 122 28 122 24C123 21 123 18 123 17C123 16 129 17 132 18C133 19 137 20 141 20L148 20L144 27C141 32 140 34 140 39C140 45 139 46 127 47L116 49L116 46ZM168 39C170 36 172 31 174 26C175 23 175 23 180 23C183 23 187 24 190 24C192 25 195 25 196 26C200 26 200 26 195 34L191 40L181 41C165 43 165 43 168 39ZM219 34C216 29 222 21 232 16C235 14 239 11 241 9L244 6L257 5C272 5 275 5 279 9C284 13 287 22 284 25C284 25 280 26 275 28C267 30 267 30 266 28C266 25 258 20 255 20C249 20 242 25 242 30C242 33 241 34 236 34C232 35 227 35 225 35C221 36 220 36 219 34Z"],"pon":[520,108,"M485 107C480 105 480 101 483 94C487 86 489 85 495 83C503 81 508 85 506 93C504 102 493 110 485 107ZM286 98C285 91 285 90 287 86C288 83 290 79 290 74C291 69 291 66 294 63C298 58 298 57 299 49C299 43 300 41 302 35C304 32 306 28 306 27C306 26 307 25 310 25C313 24 319 23 326 23C340 21 371 17 374 17C377 17 383 25 383 29C383 30 382 34 380 37C379 40 377 45 377 49C375 57 373 59 366 63C362 65 358 67 356 69C352 73 348 74 335 74C329 74 323 75 322 75C319 76 315 84 314 92C312 102 311 103 300 105C285 107 286 107 286 98ZM20 99C19 99 15 99 10 99C1 99-2 98 1 97C1 96 2 93 2 90C3 81 4 81 8 75C11 71 11 70 11 65L12 60L20 59C25 59 42 57 59 55C76 53 90 51 91 51C93 50 92 51 89 54C88 55 86 58 85 60C83 66 80 69 74 69C73 69 69 70 66 72C57 76 56 76 35 71C32 71 30 75 29 84C28 95 23 103 20 99ZM136 97C133 96 127 96 118 95C111 95 105 95 105 95C104 95 104 94 104 93C105 92 105 88 105 85C106 78 109 70 112 68C115 66 117 62 116 55C116 52 116 49 117 48C117 48 124 47 131 46L145 44L145 48C145 52 143 56 139 61C135 65 135 65 135 71L136 76L140 77C142 77 149 77 156 78C162 79 167 79 168 79C169 79 170 79 170 80C170 81 166 94 164 96L163 99L151 99C143 99 138 98 136 97ZM218 89C215 87 212 86 211 86C202 82 196 56 201 45C206 37 207 36 226 34L232 34L229 37C226 40 225 42 225 50C224 53 224 57 223 60C223 66 224 68 230 71C235 74 241 74 245 69C246 68 249 64 251 62C259 52 263 38 258 33C256 31 256 31 261 31C263 30 268 29 272 29C275 28 279 28 279 28C282 29 282 36 281 42C274 68 274 68 269 72C266 73 264 75 264 75C264 76 263 76 263 76C262 76 259 78 256 81C243 91 230 93 218 89ZM394 88C388 88 383 88 383 88C383 87 384 84 386 80C388 76 389 72 389 70C387 59 387 59 389 56C394 50 395 46 394 42C392 38 393 35 396 29C398 25 399 22 399 18C399 14 400 13 402 13C410 12 413 12 413 11C413 10 410 10 406 11L399 11L400 8C403 3 405 2 414 1C438-1 460 2 465 10C471 21 471 23 462 40C453 56 449 60 437 61C432 61 426 62 422 62C419 63 416 63 416 63C415 63 415 64 415 65C415 66 413 68 412 71C407 76 406 81 407 85C408 88 408 89 406 89C405 89 400 88 394 88ZM484 76C484 75 485 73 486 70C487 68 488 64 488 63C487 53 490 25 492 23C493 22 493 20 493 18C493 14 493 14 496 14C498 14 502 13 505 12C514 10 520 10 519 12C515 23 515 23 517 34C517 36 517 39 515 42C514 44 513 48 513 51C513 54 512 59 510 62C509 65 508 68 508 70C508 74 507 75 503 76C498 77 484 77 484 76ZM11 57C11 56 19 44 20 43C21 42 44 40 45 40C45 40 44 43 43 45C41 50 40 51 42 51C43 50 46 51 50 51L56 53L36 55C26 56 16 57 14 58C12 58 11 58 11 57ZM344 49C353 44 355 40 353 34C352 30 349 29 338 29L329 28L329 37C329 43 329 46 328 48C327 50 326 52 326 52C326 54 339 52 344 49ZM70 46C71 43 72 40 72 39C72 37 73 36 84 35C96 34 96 33 97 39C99 46 97 47 86 49C81 50 75 50 72 51L68 51L70 46ZM122 39C123 36 125 33 125 32C126 30 129 30 147 27C153 27 153 27 149 36C146 41 146 42 143 42C141 42 138 42 136 43C133 43 128 44 125 44L118 45L122 39ZM441 39C446 35 447 33 444 27C440 20 439 20 432 21C424 21 424 21 420 34L418 42L428 42C437 41 438 41 441 39ZM19 36C20 34 22 29 24 26C28 19 29 17 29 11C29 4 30 4 41 5C46 6 55 7 60 7C85 9 99 17 97 28L96 32L84 33C73 34 72 34 69 32C67 31 62 30 59 29L52 28L50 32C49 35 48 37 47 37C47 38 27 40 23 40L19 40L19 36ZM211 29C216 19 214 19 256 15C258 14 261 14 264 14C268 13 269 13 273 15C275 17 281 25 280 25C279 26 256 28 251 28C246 27 244 27 240 29C237 31 216 34 209 34C209 34 209 32 211 29ZM127 27C127 26 128 23 130 20C131 16 133 12 133 10C134 6 133 6 148 8C159 10 159 9 156 14C154 16 153 19 153 21L153 25L140 26C131 27 127 27 127 27ZM307 22C305 21 306 17 308 13C310 8 310 8 316 7C323 6 360 6 360 7C360 7 362 8 364 8C370 9 377 15 373 15C372 15 360 16 345 18C330 20 316 21 314 22C312 22 309 22 308 22C308 23 307 23 307 22ZM222 16C222 15 226 14 230 13C234 12 239 10 241 9C246 7 250 6 258 9C265 11 264 12 254 12C249 13 244 14 242 14C236 15 221 16 222 16Z"],"zuza":[520,126,"M361 125L352 125L352 122C353 121 353 117 354 114C355 110 356 104 357 100C358 96 359 92 359 91C361 88 362 80 361 76C360 74 360 74 365 74C373 72 419 67 422 67C422 67 424 69 425 72C426 74 428 79 431 83C433 86 436 92 438 95C439 99 442 105 445 108C450 116 450 116 445 116C443 116 436 117 431 118C419 120 419 120 416 116C416 114 414 112 412 110C409 107 407 103 406 97C404 91 398 83 398 87C398 88 397 90 396 91C394 93 393 95 393 96C393 96 392 98 390 99C386 104 382 115 382 120L382 125L378 125C375 125 373 125 372 125C370 125 366 125 361 125ZM260 119C253 118 250 117 243 111C236 106 234 104 234 96L233 89L242 88C261 85 265 85 267 88C270 96 281 96 294 87C303 81 304 81 311 80C336 77 334 77 332 80C331 81 331 83 331 85C331 87 331 88 330 89C329 89 329 90 329 90C330 91 320 101 311 107C306 110 301 113 300 114C292 119 281 121 260 119ZM164 116C165 115 164 111 163 106C161 100 160 100 157 100C155 100 154 100 154 99C154 99 157 98 161 98C164 97 173 96 179 96L191 94L191 101C191 105 190 111 190 114L189 119L176 119L164 119L164 116ZM0 116C0 116 0 115 1 115C2 114 3 105 2 103C1 99 0 99 11 98C16 97 26 96 34 95C49 94 50 94 57 94C61 95 65 95 70 94C75 93 80 92 82 92L85 92L83 95C82 98 82 105 83 106C84 106 83 115 82 116C82 116 78 116 74 116C59 115 8 116 4 116C2 117 0 117 0 116ZM113 111C109 111 104 110 101 110L96 110L100 104C102 100 106 95 108 92C113 86 111 86 133 84C155 81 171 79 178 78C192 76 194 76 194 81C194 83 194 86 193 88L192 92L181 93C152 96 145 97 143 98C142 99 141 100 139 99C136 99 135 99 129 106C125 110 122 113 121 113C120 113 117 112 113 111ZM471 94C465 89 465 85 471 81C473 80 476 77 479 75C488 67 496 72 494 85C491 98 480 103 471 94ZM3 94C4 93 8 91 12 89C20 84 25 80 28 74C30 70 31 69 34 68C38 66 44 61 44 59C44 59 48 54 54 50C59 46 63 42 63 42C63 42 58 41 51 41C41 41 21 40 18 40C18 40 19 37 21 34C22 31 24 26 25 24C25 19 29 19 54 18C64 18 76 18 81 18C86 17 93 17 98 17L105 18L105 23C104 31 100 38 95 41C93 43 88 48 85 52C80 59 77 61 73 63C69 65 65 68 62 72C59 76 55 79 51 80C48 82 43 85 40 88C36 92 34 93 32 93C30 93 26 93 23 94C21 94 15 95 10 96L2 96L3 94ZM231 79L231 72L234 72C236 71 242 71 246 70C251 69 257 69 259 68L263 68L263 74C263 77 263 80 264 81C266 82 264 83 258 83C255 84 249 85 245 85C241 86 236 86 234 86L231 87L231 79ZM116 80C118 77 124 70 125 70C125 70 127 68 128 66C130 63 130 63 134 63C136 63 140 63 143 62C145 62 151 61 155 60L162 60L160 62C159 63 156 65 154 66C153 68 150 71 149 74L146 80L134 81C128 82 121 82 119 83L115 83L116 80ZM163 76C163 76 164 74 165 72C169 67 170 63 170 62C169 61 170 60 170 59C171 59 193 56 194 56C194 57 193 59 192 61C191 64 191 68 191 70L192 74L186 74C182 75 177 76 174 76C168 77 163 77 163 76ZM359 69C360 68 361 64 363 61L366 55L374 55C379 54 384 54 386 53L390 53L389 59C389 67 389 68 392 63C395 54 403 51 425 48L432 48L430 50C429 52 427 55 426 58C424 64 424 64 420 64C416 65 407 66 392 68C389 68 384 68 380 69C361 72 359 72 359 69ZM232 63C233 51 234 51 256 49L267 47L266 52C266 54 265 59 264 61L262 65L249 67C229 70 231 70 232 63ZM489 66C486 65 482 65 479 65C476 65 475 64 475 62C475 61 476 60 485 59C490 58 496 58 498 57C502 57 502 57 502 60C503 67 501 68 489 66ZM131 59C131 57 140 46 142 45C143 44 152 32 152 31C152 31 154 28 156 25L160 19L167 19C170 19 174 19 174 20C176 21 190 24 194 24C198 24 198 24 194 33C192 41 191 44 193 48C196 52 194 54 185 54C181 55 176 55 173 56L169 56L169 51C170 45 169 45 166 51C163 57 163 57 158 57C155 58 150 58 146 59C131 61 130 61 131 59ZM478 53C479 50 481 47 481 46C482 42 483 41 498 40C511 38 511 39 508 44C506 46 505 49 504 51C503 53 502 54 501 54C496 55 481 57 479 57L476 57L478 53ZM365 52C365 51 365 51 365 50C366 50 365 49 365 48C363 44 363 42 365 36C368 29 369 28 384 27L396 27L396 29C395 30 394 36 393 41C392 51 393 50 378 52C373 52 369 52 368 53C367 53 366 53 365 52ZM238 47C238 47 240 44 242 40C244 37 246 33 247 31C250 25 256 20 262 18C268 16 271 14 276 11C278 10 280 8 282 8C287 7 316 6 317 8C318 8 320 9 322 10C327 11 334 17 336 22C337 25 340 28 341 31C345 37 345 46 340 47C338 48 332 48 324 48L311 48L311 45C311 42 314 41 332 39C337 39 339 38 339 37C339 36 334 36 322 38C313 40 310 39 305 36C296 29 284 31 273 41C269 45 268 45 257 46C251 47 244 47 242 48C240 48 238 48 238 47ZM412 43C416 39 419 35 420 31C420 30 420 29 421 29C421 29 422 28 422 27C424 23 428 22 434 22C437 22 443 21 448 20C453 19 458 18 458 18C459 18 455 27 452 30C451 31 446 35 442 38L436 45L426 46C420 46 414 47 412 48L408 48L412 43ZM483 36C484 34 486 29 487 25C490 19 490 17 489 12C489 8 489 5 490 3L491 0L505 0C518 0 519 1 519 2C520 11 520 12 516 17C511 21 510 26 510 31L511 36L501 37C495 38 489 38 486 39L482 39L483 36Z"],"gogo":[520,136,"M312 135C309 135 309 131 312 118C313 111 314 97 313 95C312 94 312 92 313 90C314 88 314 83 314 79C314 76 315 71 316 69C317 67 317 63 317 55C317 49 317 44 318 42C322 33 322 33 327 32C329 32 336 30 341 29C346 27 354 26 357 26C361 26 367 25 370 25C383 23 390 25 398 33L402 36L402 49C403 64 402 68 396 74C393 76 390 79 388 82C384 87 384 91 391 101C393 105 395 109 395 110C396 111 397 114 397 116C398 119 399 122 399 122C399 122 387 124 378 124C368 125 367 125 367 123C367 122 366 119 364 116C362 113 360 108 360 105L358 99L351 99L343 98L343 103C343 106 343 109 342 109C342 110 341 114 341 118C340 128 339 131 337 131C336 131 334 132 333 133C329 134 317 136 312 135ZM20 104C7 98 2 91 2 79C2 75 2 70 1 68C0 65-1 65 16 63C20 62 26 62 27 62C29 61 29 61 29 65C28 68 27 70 27 70C26 70 26 72 26 73C26 80 37 86 47 86C52 86 57 82 58 76C59 71 59 72 50 72C45 72 45 72 45 70C46 69 46 67 47 66C47 59 48 59 65 57C83 56 93 56 89 59C88 60 88 62 88 68C88 78 87 80 77 88C65 98 60 100 50 103C37 106 27 107 20 104ZM497 101C497 100 494 100 489 100C474 101 474 101 472 90C471 86 470 80 469 79C468 78 468 75 468 73L468 69L463 69C456 68 457 68 456 73C450 99 450 99 441 99C435 99 420 96 420 95C420 94 421 91 423 87C425 84 427 78 428 76C429 73 430 70 430 69C431 69 432 65 434 60C435 55 437 50 438 48C439 46 440 41 441 37C442 33 445 27 447 23C449 19 450 15 450 13C450 12 451 11 452 11C453 11 454 11 456 10C457 10 476 8 490 6C492 6 495 5 495 5C496 4 505 6 509 8C510 9 514 13 516 16L520 22L520 30C518 48 513 56 502 61C493 64 492 65 496 73C498 77 498 79 498 88C499 93 499 99 499 100C500 102 499 103 497 101ZM260 100C250 99 249 98 249 86C249 82 248 77 247 74L245 70L239 69C231 68 228 70 228 79C228 84 226 88 224 92L222 98L213 98C208 99 203 99 201 100C198 100 198 100 199 97C200 96 200 91 200 87C201 81 201 79 203 75C206 71 206 69 206 62C206 55 206 53 208 48C211 40 212 39 219 39C223 38 229 38 233 37C242 36 242 36 239 41C236 47 236 47 247 47C263 48 266 47 266 38L266 33L271 33C274 32 280 31 285 31C290 30 294 30 294 30C296 32 286 51 283 51C282 51 280 54 278 57C276 60 274 63 274 63C274 63 273 68 274 74C274 83 275 85 277 89C279 91 280 94 280 95C281 101 281 100 275 101C272 101 265 100 260 100ZM157 97C149 97 147 94 147 88C148 86 147 82 146 78C145 75 144 71 145 69C145 67 145 67 141 67C139 67 137 67 136 66C134 66 132 70 131 79C130 91 128 95 122 95C119 95 114 94 111 94C107 93 104 92 103 92C99 92 103 78 110 71C113 67 113 68 113 59C114 51 113 51 125 50C135 49 138 48 148 49C153 49 155 49 159 47C162 46 167 45 174 44C180 43 186 43 188 42C193 42 193 43 188 49C185 55 182 57 172 61C166 63 166 62 170 69C172 74 172 77 172 86L173 98L167 98C163 98 159 97 157 97ZM367 73C371 71 374 63 374 58C373 57 373 55 373 54C373 53 372 52 371 50C368 47 364 47 356 50L350 52L347 59C346 62 345 68 345 71L344 76L354 75C360 75 365 74 367 73ZM1 60C1 59 2 56 3 55C4 54 5 52 5 50C6 48 7 48 23 46C29 45 34 45 35 44C36 44 36 45 34 47C32 49 31 52 30 54C29 57 29 59 28 59C28 59 4 62 1 62C1 62 0 61 1 60ZM50 55C50 54 51 54 53 54C55 54 56 54 56 55C56 56 55 56 53 56C51 56 50 56 50 55ZM90 48C88 47 83 47 78 47L70 46L69 43L69 40L76 40C80 39 86 39 88 38C93 38 93 38 94 41C98 48 96 50 90 48ZM482 47C487 43 491 38 493 35C495 30 492 27 484 26C481 25 478 24 477 24C477 23 475 23 473 23C468 23 468 24 468 34C468 39 468 41 466 44C465 47 464 48 465 48C468 49 479 48 482 47ZM119 43C121 39 122 36 122 35C122 35 122 34 123 34C124 34 141 32 144 32C148 31 147 33 144 41L142 46L134 46C130 47 124 47 121 48L116 48L119 43ZM8 43C8 35 26 20 39 17C42 16 47 15 51 13C61 9 75 12 84 18C91 24 93 27 93 31C93 35 94 35 78 37C69 38 68 38 64 35C56 32 50 33 42 38C41 40 39 41 38 41C36 42 11 45 9 45C8 45 8 44 8 43ZM164 42C164 42 165 40 166 39C167 36 167 31 165 30C164 29 172 28 185 26L191 26L191 29C192 31 192 34 192 36C193 39 194 39 179 41C173 42 168 42 166 43C165 43 164 43 164 42ZM213 34C214 31 216 24 217 23C217 23 219 22 248 19C281 15 291 14 292 14C294 14 296 18 295 23L295 27L288 28C272 31 266 31 266 28C265 24 262 24 253 25L246 25L245 29C244 33 244 33 239 33C237 34 232 35 228 35C224 35 220 36 217 36L213 37L213 34ZM124 29C124 28 125 24 127 21C130 16 130 13 130 10L130 5L136 6C139 6 144 7 146 7C149 8 157 8 164 8C174 9 177 9 180 11C186 14 188 14 152 18C139 19 137 20 137 21C137 22 139 22 142 22C176 18 185 17 185 16C186 16 189 18 190 20C191 21 191 22 189 23C187 24 160 27 153 27C150 27 148 27 147 28C147 28 144 29 140 29C136 30 131 30 129 31C124 31 124 31 124 29ZM219 16L220 12L230 11C243 10 262 7 272 6C283 5 284 5 288 8C292 12 292 11 278 13C273 14 263 15 256 15C242 17 219 20 218 20C217 20 218 18 219 16ZM220 7C221 1 221 2 239 1C257 1 277 2 275 3C275 3 268 4 260 5C234 8 226 9 223 9C220 10 220 10 220 7ZM450 6C449 0 450-1 469 3C480 5 479 5 464 7C452 9 450 8 450 6Z"]};
// <<< words
const shapes = {}, baked = new Map();
const word = (name) => shapes[name] || (WORDS[name] && (shapes[name] = { w: WORDS[name][0], h: WORDS[name][1], p: new Path2D(WORDS[name][2]) }));
// The outline and fill are painted once per word and colour, so a word on screen costs one drawImage a frame.
function bake(name, fc, oc, dots) {
  const key = name + fc + oc + dots; let c = baked.get(key); if (c) return c;
  const s = word(name), pad = 24, e = s.w * 0.035;
  c = document.createElement('canvas'); c.width = s.w + pad * 2; c.height = s.h + pad * 2;
  const x = c.getContext('2d'); x.translate(pad, pad); x.lineJoin = 'round';
  x.strokeStyle = x.fillStyle = oc; x.lineWidth = e * 2; x.stroke(s.p); x.fill(s.p);
  if (dots) {   // screentone letters: dots in the outline colour on white
    const t = document.createElement('canvas'); t.width = 22; t.height = 44; const y = t.getContext('2d'); y.fillStyle = P.page; y.fillRect(0, 0, 22, 44); y.fillStyle = oc; y.beginPath();
    for (const [px, py] of [[0, 0], [22, 0], [0, 44], [22, 44], [11, 22]]) { y.moveTo(px + 5.2, py); y.arc(px, py, 5.2, 0, TAU); } y.fill(); x.fillStyle = x.createPattern(t, 'repeat');
  } else x.fillStyle = fc;
  x.fill(s.p); baked.set(key, c); return c;
}
// A word lands a size too big and wobbles while it stays. col: fill colour. edge: outline colour. dots: screentone letters.
function sfx(name, x, y, { size = 64, rot = -0.14, life = 0.95, col, edge, dots } = {}) {
  if (!word(name)) return; const s = new Spring(0.2, 520, 17); s.to = 1; let lastT = 0;
  const c = bake(name, col || P.sfx[0], edge || P.sfx[1], !!dots), k0 = size / WORDS[name][0];
  add(life, (k, t) => {
    const sc = s.step(t - lastT) * (1 - inn(clamp((k - 0.86) / 0.14))) * k0; lastT = t;
    g.translate(x + Math.sin(t * 31) * 0.8, y + Math.cos(t * 27) * 0.8); g.rotate(rot + Math.sin(t * 6) * 0.03);
    g.drawImage(c, -c.width / 2 * sc, -c.height / 2 * sc, c.width * sc, c.height * sc);
  });
}
// two lettering styles: hollow (white with an ink edge) and dotted (screentone letters)
const hollow = () => ({ col: P.page, edge: P.shade }), dotted = () => ({ dots: true, edge: P.shade });

// ───────── for components ─────────
const at = (el, fx = 0.5, fy = 0.5) => { const b = el.getBoundingClientRect(); return { x: b.left + scrollX + b.width * fx, y: b.top + scrollY + b.height * fy, w: b.width, h: b.height }; };
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
// a press: squash flat while held, overshoot on release. Call step(dt) every frame.
function squashy(el, { low = 0.82, k = 520, d = 15, wide = 0.55 } = {}) {
  const s = new Spring(1, k, d), pop = new Spring(1, 300, 12), tilt = new Spring(0, 260, 10);
  el.addEventListener('pointerdown', () => { if (!el.disabled) s.to = low; });
  for (const e of ['pointerup', 'pointerleave', 'pointercancel', 'blur']) el.addEventListener(e, () => { s.to = 1; });
  return { s, pop, tilt, step(dt) { const y = s.step(dt), p = pop.step(dt), r = tilt.step(dt), still = Math.abs(y - 1) < 0.001 && Math.abs(s.v) < 0.01 && Math.abs(p - 1) < 0.001 && Math.abs(r) < 0.02;
    el.style.transform = still ? '' : `rotate(${r}deg) scale(${(1 + (1 - y) * wide) * p}, ${y * p})`; } };
}
const BASE_CSS = `:host{display:inline-block;position:relative;isolation:isolate;vertical-align:middle;color:var(--sk-ink);font:500 15px/1.4 "Inter",system-ui,-apple-system,"Segoe UI",sans-serif;-webkit-tap-highlight-color:transparent}
:host([hidden]){display:none}*{box-sizing:border-box}button,input{font:inherit;color:inherit;-webkit-tap-highlight-color:transparent}
:focus-visible{outline:3px solid var(--sk-focus);outline-offset:3px}.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
canvas.back{position:absolute;left:-160px;top:-160px;width:calc(100% + 320px);height:calc(100% + 320px);pointer-events:none;z-index:-1}`;
// The base for every component: a shadow root built on first connect, one frame callback on the shared clock while it is on the page.
class Base extends HTMLElement {
  constructor() { super(); this.root = this.attachShadow({ mode: 'open', delegatesFocus: !!this.constructor.delegates }); if (this.constructor.formAssociated) this.internals = this.attachInternals(); }
  connectedCallback() {
    // a component built from its <option>s waits until the parser has read them
    if (!this.ready && this.constructor.fromChildren && document.readyState === 'loading') { if (!this.waiting) { this.waiting = true; document.addEventListener('DOMContentLoaded', () => { this.waiting = false; if (this.isConnected) this.connectedCallback(); }, { once: true }); } return; }
    if (!this.ready) { this.ready = true; this.root.innerHTML = `<style>${BASE_CSS}${this.constructor.css || ''}</style>${this.render()}`; this.setup(); }
    this.tickFn ||= (dt) => this.frame(dt); frames.add(this.tickFn); start();
  }
  disconnectedCallback() { frames.delete(this.tickFn); }
  $(s) { return this.root.querySelector(s); }
  $$(s) { return [...this.root.querySelectorAll(s)]; }
  render() { return ''; } setup() {} frame() {}
  backLayer() { const c = document.createElement('canvas'); c.className = 'back'; c.setAttribute('aria-hidden', 'true'); this.root.prepend(c); return backLayer(c); }
  emit(type, detail) { this.dispatchEvent(new CustomEvent(type, { bubbles: true, composed: true, detail })); }
}
const define = (tag, cls) => { if (!customElements.get(tag)) customElements.define(tag, cls); };

const api = window.SakugaFX = {
  version: 1, paused: false,
  get P() { return P; }, get calm() { return calm; }, get now() { return now; },
  TAU, clamp, lerp, rnd, Spring,
  advance, later, persist, blob, shape, get g() { return g; },
  puff, burst, shards, ring, splash, slash, lines, ticks, donut, wob, kira, sfx, hollow, dotted,
  at, esc, squashy, Base, define,
};
})();
