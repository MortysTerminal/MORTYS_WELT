// Mortys Welt: anime reactions for the controls that are already on a page.
// Load sakuga-core.js first, then this file. Mark an element with data-sakuga="<kind>":
//   hit    main buttons: squash on press, impact on click (ring, splinters, clouds, BÄM!)
//   tap    quiet buttons: small squash and three wedges
//   pop    links and link buttons: ring, splinters and PLOPP!
//   check  checkboxes: slash, splinters and ZACK! when ticked, a small puff when unticked
//   type   text inputs: dust where the caret is on every keystroke
//   progress  an element with role="progressbar": wedges as it fills, a burst when it is full
// Pages can also call MWSakuga.hit(el), .success(el), .fail(el) and .big(el) from their own code.
// The controls keep their own logic: this only adds drawn effects and a press that uses the CSS
// `scale` and `translate` properties, so a page's own `transform` keeps working.
// Reduced motion: the core draws nothing and the press stays still; every state change still happens.
(() => {
  'use strict';
  const fx = window.SakugaFX;
  if (!fx || window.MWSakuga) return;
  const { Spring, at, rnd, later, puff, ring, shards, ticks, wob, lines, donut, slash, kira, sfx, dotted } = fx;

  // ───────── the press: a spring on scale (and one on translate for a shake) ─────────
  const moving = new Set();
  let last = 0, raf = 0;
  function loop(t) {
    const dt = Math.min(0.05, (t - (last || t)) / 1000); last = t;
    for (const m of moving) {
      const y = m.y.step(dt), p = m.pop.step(dt), sh = m.sh.step(dt);
      const still = Math.abs(y - 1) < 0.002 && Math.abs(m.y.v) < 0.02 && Math.abs(p - 1) < 0.002 && Math.abs(m.pop.v) < 0.02 && Math.abs(sh) < 0.2 && Math.abs(m.sh.v) < 0.5;
      if (still) { m.el.style.scale = ''; m.el.style.translate = ''; moving.delete(m); continue; }
      m.el.style.scale = `${((1 + (1 - y) * m.wide) * p).toFixed(4)} ${(y * p).toFixed(4)}`;
      m.el.style.translate = Math.abs(sh) < 0.2 ? '' : `${sh.toFixed(2)}px 0`;
    }
    if (moving.size) raf = requestAnimationFrame(loop); else { raf = 0; last = 0; }
  }
  const springs = new WeakMap();
  function press(el, wide = 0.5) {
    let m = springs.get(el);
    if (!m) { m = { el, wide, y: new Spring(1, 520, 15), pop: new Spring(1, 300, 12), sh: new Spring(0, 900, 14) }; springs.set(el, m); }
    if (!fx.calm) { moving.add(m); if (!raf) raf = requestAnimationFrame(loop); }
    return m;
  }

  // ───────── the reactions ─────────
  const wordSize = (c, k = 0.9) => Math.max(96, Math.min(170, c.w * k));

  function hit(el) {
    const c = at(el), m = press(el, 0.4);
    m.y.x = Math.min(m.y.x, 0.62); m.pop.x = 1.16; m.y.to = 1;
    ring(c.x, c.y, { rx: c.w * 0.62 + 10, ry: c.h * 0.85 + 6, life: 0.42, w: 6 });
    shards(c.x, c.y, { n: 10, speed: 250, size: 8, life: 0.9, arc: 6.28, grav: 300 });
    for (const [dx, dy] of [[-1, -0.5], [1, -1], [-1, 0.9], [1, 1]]) puff(c.x + dx * (c.w / 2 + 6), c.y + dy * c.h * 0.45, { size: rnd(11, 15), n: 5, vx: dx * 44, vy: dy * 28 - 6, life: rnd(0.7, 1) });
    sfx('don', c.x + 8, c.y - c.h / 2 - 44, { size: wordSize(c), rot: -0.12, life: 1 });
    ticks(c.x - c.w / 2 - 18, c.y - c.h / 2 - 8, { dir: -2.4, n: 2, r: 4, len: 18, life: 0.45 });
    ticks(c.x + c.w / 2 + 18, c.y - c.h / 2 - 4, { dir: -0.7, n: 2, r: 4, len: 18, life: 0.45 });
    later(200, () => { m.y.x = Math.max(m.y.x, 1.14); press(el); wob(c.x - c.w / 2 - 8, c.y, { dir: -1 }); wob(c.x + c.w / 2 + 8, c.y, { dir: 1 });
      donut(c.x + 6, c.y - c.h / 2 - 14, { r: 22, vx: 22, vy: -52, life: 1.1 }); later(90, () => donut(c.x + 40, c.y - c.h / 2 - 20, { r: 13, vx: 34, vy: -40, life: 0.95 })); });
  }
  function tap(el) {
    const c = at(el, 1, 0), m = press(el, 0.3);
    m.y.x = Math.min(m.y.x, 0.8); m.y.v += 4; m.y.to = 1;
    ticks(c.x - 6, c.y - 2, { dir: -1.05, n: 3, r: 5, len: 15, fan: 0.36, life: 0.45 });
  }
  function pop(el) {
    const c = at(el), m = press(el, 0.35);
    m.y.x = Math.min(m.y.x, 0.72); m.pop.x = 1.08; m.y.to = 1;
    ring(c.x, c.y, { rx: c.w * 0.55 + 8, ry: c.h * 0.8 + 4, life: 0.36, w: 4 });
    shards(c.x + c.w / 2 - 10, c.y, { n: 6, speed: 200, size: 6, life: 0.7, dir: -0.4, arc: 2.6, grav: 320 });
    puff(c.x - c.w / 2, c.y + 4, { size: 9, n: 4, vx: -30, life: 0.6 }); puff(c.x + c.w / 2, c.y - 4, { size: 9, n: 4, vx: 30, life: 0.6 });
    sfx('pon', c.x + c.w * 0.28, c.y - c.h / 2 - 30, { size: 96, rot: -0.1, life: 0.8 });
  }
  function check(inp) {
    const box = inp, c = at(box);
    if (!inp.checked) { puff(c.x, c.y, { size: 7, n: 3, life: 0.4 }); return; }
    const m = press(box, 0.3); m.y.x = 0.7; m.pop.x = 1.18; m.y.to = 1;
    slash(c.x + 8, c.y + 2, { len: 130, ang: -0.42, thick: 12, life: 0.5 }); slash(c.x - 6, c.y + 10, { len: 96, ang: 2.72, thick: 7, life: 0.55 });
    lines(c.x - 30, c.y + 22, { n: 5, dir: 2.75, len: 52, spread: 12 });
    shards(c.x, c.y, { n: 6, speed: 180, size: 6, arc: 6.28, grav: 260 }); later(360, () => kira(c.x + 20, c.y - 18, { r: 9 }));
    sfx('zuza', c.x + 46, c.y - 46, { size: 104, rot: -0.12, ...dotted() });
  }
  // where the caret is in a text input, in page coordinates
  const measure = document.createElement('canvas').getContext('2d');
  function caret(inp) {
    const cs = getComputedStyle(inp), b = inp.getBoundingClientRect();
    measure.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    const pos = inp.selectionStart ?? inp.value.length, text = inp.type === 'password' ? '•'.repeat(pos) : inp.value.slice(0, pos);
    const ls = parseFloat(cs.letterSpacing) || 0, full = inp.type === 'password' ? '•'.repeat(inp.value.length) : inp.value;
    const textW = measure.measureText(text).width + pos * ls, fullW = measure.measureText(full).width + full.length * ls;
    const left = b.left + parseFloat(cs.paddingLeft) + parseFloat(cs.borderLeftWidth);
    const inner = b.width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - parseFloat(cs.borderLeftWidth) - parseFloat(cs.borderRightWidth);
    let shift = 0;   // centred or right-aligned text starts further in while it fits
    if (fullW < inner) { if (cs.textAlign === 'center') shift = (inner - fullW) / 2; else if (cs.textAlign === 'right' || cs.textAlign === 'end') shift = inner - fullW; }
    const x = left + shift + textW - inp.scrollLeft;
    return { x: Math.max(b.left + 8, Math.min(b.right - 8, x)) + scrollX, y: b.bottom - 6 + scrollY };
  }
  function type(inp, e) {
    const p = caret(inp);
    if (e && e.inputType && e.inputType.startsWith('delete')) { lines(p.x + 4, p.y - 8, { n: 2, dir: 0, len: 14, spread: 6, life: 0.25 }); return; }
    puff(p.x, p.y, { size: rnd(4, 6), n: 2, vx: rnd(-14, 14), vy: -12, life: 0.45, spread: 0.6 });
  }
  function success(el, word = 'pon') {
    const c = at(el, 1, 0), m = press(el, 0.3); m.pop.x = 1.06;
    kira(c.x - 10, c.y + 4, { r: 14, life: 0.9 }); ticks(c.x + 4, c.y - 6, { dir: -0.8, n: 3, r: 6, len: 13 });
    if (word) sfx(word, c.x - 20, c.y - 34, { size: 92, rot: -0.12, life: 0.85 });
  }
  function fail(el) {
    const c = at(el), m = press(el); m.sh.x = 0; m.sh.v = 420;
    wob(c.x - c.w / 2 - 8, c.y, { dir: -1, r: 12 }); wob(c.x + c.w / 2 + 8, c.y, { dir: 1, r: 12 });
  }
  function big(el) {
    const c = at(el);
    ring(c.x, c.y, { rx: c.w * 0.7, ry: c.h * 0.7, life: 0.6, w: 8 });
    shards(c.x, c.y, { n: 16, speed: 320, size: 9, life: 1.1, arc: 6.28, grav: 260 });
    for (let i = 0; i < 6; i++) { const a = i / 6 * 6.28; puff(c.x + Math.cos(a) * c.w * 0.4, c.y + Math.sin(a) * c.h * 0.4, { size: 14, n: 5, vx: Math.cos(a) * 50, vy: Math.sin(a) * 40, life: 1 }); }
    sfx('don', c.x, c.y - Math.min(c.h / 2, 120) - 30, { size: 180, rot: -0.12, life: 1.2 });
    later(260, () => kira(c.x + c.w * 0.3, c.y - c.h * 0.3, { r: 16, life: 1 }));
  }
  function progress(el) {
    let before = +el.getAttribute('aria-valuenow') || 0;
    new MutationObserver(() => {
      const now = +el.getAttribute('aria-valuenow') || 0, max = +el.getAttribute('aria-valuemax') || 100, min = +el.getAttribute('aria-valuemin') || 0;
      const f = Math.max(0, Math.min(1, (now - min) / ((max - min) || 1))), c = at(el, f, 0.5);
      if (now > before) {
        if (now >= max) { later(320, () => { const d = at(el); ring(d.x + d.w / 2 - 10, d.y, { rx: 60, ry: 26, life: 0.5, w: 6 }); shards(d.x + d.w / 2 - 10, d.y, { n: 12, speed: 260, size: 8, arc: 6.28, grav: 280 }); sfx('don', d.x + d.w / 2 - 70, d.y - 54, { size: 150, life: 1.1 }); later(300, () => kira(d.x + d.w / 2 - 20, d.y - 14, { r: 14 })); }); }
        else later(300, () => { ticks(c.x, c.y - 8, { dir: -Math.PI / 2, n: 3, r: 4, len: 12, fan: 0.5 }); puff(c.x, c.y + 4, { size: 6, n: 3, vx: 16, life: 0.5 }); });
      }
      before = now;
    }).observe(el, { attributes: true, attributeFilter: ['aria-valuenow'] });
  }

  // ───────── wiring: one set of listeners for the whole page, so controls added later work too ─────────
  const kind = (el) => el && el.closest && el.closest('[data-sakuga]');
  const off = (el) => el.disabled || el.getAttribute('aria-disabled') === 'true';
  const held = new Map();   // pointerId -> pressed element, so a release anywhere lets it go
  document.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    const el = kind(e.target); if (!el || off(el)) return;
    const k = el.dataset.sakuga; if (!['hit', 'tap', 'pop'].includes(k)) return;
    const m = press(el, k === 'hit' ? 0.4 : 0.3); m.y.to = k === 'hit' ? 0.7 : 0.84; held.set(e.pointerId, el);
    if (k === 'hit') { const c = at(el); ticks(c.x, c.y - c.h / 2 - 6, { dir: -Math.PI / 2, n: 3, r: 4, len: 12, fan: 0.5 }); }
  }, true);
  const let_go = (el) => { const m = el && springs.get(el); if (m) { m.y.to = 1; press(el); } };
  // pointerup or cancel anywhere releases what that pointer pressed, even if the element moved away (only-fans dodges)
  const release = (e) => { let_go(held.get(e.pointerId)); held.delete(e.pointerId); };
  for (const t of ['pointerup', 'pointercancel']) addEventListener(t, release, true);
  // pointerleave does not bubble, but a capturing listener on the document still sees it for every element
  document.addEventListener('pointerleave', (e) => { const el = kind(e.target); if (el && e.target === el) let_go(el); }, true);
  const releaseAll = () => { held.forEach(let_go); held.clear(); };
  addEventListener('blur', releaseAll); document.addEventListener('visibilitychange', releaseAll);
  // A link that opens a new tab waits a moment, so the reaction can be seen before the tab takes over.
  // 450 ms stays well inside the time browsers still count the click as the user's (about one second),
  // so the popup blocker lets the tab through. Modified clicks and reduced motion open at once, as usual.
  const DELAY = 450;
  const pending = new WeakSet();
  function holdLink(e, el) {
    if (el.tagName !== 'A' || el.target !== '_blank' || !el.href || fx.calm) return false;
    if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey || e.defaultPrevented) return false;
    e.preventDefault();
    if (pending.has(el)) return true;   // a double click opens the tab only once
    pending.add(el);
    setTimeout(() => {
      pending.delete(el);
      const a = document.createElement('a');   // same target and rel as the original link
      a.href = el.href; a.target = '_blank'; a.rel = el.rel || 'noopener noreferrer';
      a.click();
    }, DELAY);
    return true;
  }
  document.addEventListener('click', (e) => {
    const el = kind(e.target); if (!el || off(el)) return;
    const k = el.dataset.sakuga;
    if (k === 'pop' && pending.has(el)) { if (el.tagName === 'A') e.preventDefault(); return; }
    if (k === 'hit') hit(el); else if (k === 'tap') tap(el); else if (k === 'pop') pop(el);
    holdLink(e, el);
  }, true);
  document.addEventListener('change', (e) => { const el = e.target; if (el.matches && el.matches('input[type=checkbox][data-sakuga=check]')) check(el); }, true);
  document.addEventListener('input', (e) => { const el = e.target; if (el.matches && el.matches('input[data-sakuga=type], textarea[data-sakuga=type]')) type(el, e); }, true);
  const scan = (root = document) => root.querySelectorAll('[data-sakuga=progress]').forEach((el) => { if (!el.__mwsk) { el.__mwsk = 1; progress(el); } });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => scan()); else scan();

  window.MWSakuga = { hit, tap, pop, check, success, fail, big, scan };
})();
