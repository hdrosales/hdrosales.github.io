/* Diego Rosales — site script
   1) theme toggle  2) mobile menu  3) skyrmion-crystal canvas
   4) copy buttons  5) photo gallery */

// ---------- 1. Light / dark toggle (remembered per visitor) ----------
(function () {
  const btn = document.querySelector('.theme-toggle');
  if (!btn) return;
  const root = document.documentElement;
  const isDark = () => root.dataset.theme
    ? root.dataset.theme === 'dark'
    : matchMedia('(prefers-color-scheme: dark)').matches;
  const label = () => btn.setAttribute('aria-label', isDark() ? 'Switch to light theme' : 'Switch to dark theme');
  label();
  btn.addEventListener('click', () => {
    const next = isDark() ? 'light' : 'dark';
    root.dataset.theme = next;
    try { localStorage.setItem('theme', next); } catch (e) {}
    label();
  });
})();

// ---------- 2. Mobile menu ----------
(function () {
  const btn = document.querySelector('.menu-btn');
  const links = document.querySelector('.nav-links');
  if (!btn || !links) return;
  btn.addEventListener('click', () => {
    const open = links.classList.toggle('open');
    btn.setAttribute('aria-expanded', open);
    btn.textContent = open ? 'Close' : 'Menu';
  });
})();

// ---------- 3. Skyrmion crystal (triple-Q spin texture) ----------
// m(r) ∝ Σ_i [ ẑ cos(Q_i·r + φ) + (ẑ × Q̂_i) sin(Q_i·r + φ) ] + B ẑ
// Colour: hue = in-plane angle; skyrmion cores stand out (bright on dark, deep on light).
(function () {
  const canvases = document.querySelectorAll('canvas[data-lattice]');
  if (!canvases.length) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const Q = [0, 1, 2].map(i => {
    const a = i * 2 * Math.PI / 3 + Math.PI / 2;
    return [Math.cos(a), Math.sin(a)];
  });
  function spin(x, y, t) {
    let mx = 0, my = 0, mz = 0;
    for (const [qx, qy] of Q) {
      const ph = qx * x + qy * y + t;
      const c = Math.cos(ph), s = Math.sin(ph);
      mz += c; mx += -qy * s; my += qx * s;
    }
    mz -= 0.9;
    const n = Math.hypot(mx, my, mz) || 1;
    return [mx / n, my / n, mz / n];
  }
  const darkTheme = () => getComputedStyle(document.documentElement).getPropertyValue('--lattice').trim() === 'dark';

  function setup(cv) {
    const ctx = cv.getContext('2d');
    const mode = cv.dataset.lattice; // "hero" | "strip"
    let w, h;
    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const r = cv.getBoundingClientRect();
      w = r.width; h = r.height;
      cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener('resize', resize);
    const spacing = mode === 'hero' ? 13 : 24;
    const k = (2 * Math.PI) / (mode === 'hero' ? 9 : 11) / spacing;

    function draw(t) {
      const dark = darkTheme();
      ctx.clearRect(0, 0, w, h);
      const rows = Math.ceil(h / (spacing * 0.866)) + 2;
      const cols = Math.ceil(w / spacing) + 2;
      const cx = w / 2, cy = h / 2;
      for (let j = -1; j < rows; j++) {
        for (let i = -1; i < cols; i++) {
          const x = i * spacing + (j % 2 ? spacing / 2 : 0);
          const y = j * spacing * 0.866;
          const [mx, my, mz] = spin((x - cx) * k, (y - cy) * k, t);
          const core = (1 - mz) / 2;           // 0 = up (background), 1 = down (core)
          const hue = (Math.atan2(my, mx) * 180 / Math.PI + 360) % 360;
          const light = dark ? 40 + 48 * core : 62 - 34 * core;
          const alpha = 0.35 + 0.65 * core;
          const len = spacing * 0.55 * Math.hypot(mx, my) + 2;
          const ang = Math.atan2(my, mx);
          const dx = Math.cos(ang) * len, dy = Math.sin(ang) * len;
          ctx.strokeStyle = ctx.fillStyle = `hsla(${hue}, 70%, ${light}%, ${alpha})`;
          ctx.lineWidth = mode === 'hero' ? 1.3 : 1.6;
          ctx.beginPath(); ctx.moveTo(x - dx / 2, y - dy / 2); ctx.lineTo(x + dx / 2, y + dy / 2); ctx.stroke();
          ctx.beginPath(); ctx.arc(x + dx / 2, y + dy / 2, mode === 'hero' ? 1.5 : 1.9, 0, Math.PI * 2); ctx.fill();
        }
      }
    }
    if (reduce) { draw(0.6); new MutationObserver(() => draw(0.6)).observe(document.documentElement, { attributes: true }); return; }
    let visible = true;
    new IntersectionObserver(e => { visible = e[0].isIntersecting; }).observe(cv);
    const t0 = performance.now();
    (function loop(now) {
      if (visible) draw(0.6 + (now - t0) / 4200);
      requestAnimationFrame(loop);
    })(t0);
  }
  canvases.forEach(setup);
})();

// ---------- 4. Copy buttons ----------
document.querySelectorAll('[data-copy]').forEach(btn => {
  btn.addEventListener('click', () => {
    const text = btn.dataset.copy;
    const done = () => { const o = btn.textContent; btn.textContent = 'Copied'; setTimeout(() => btn.textContent = o, 1400); };
    const fallback = () => {
      const code = btn.parentElement.querySelector('code');
      if (!code) return;
      const r = document.createRange(); r.selectNodeContents(code);
      const s = getSelection(); s.removeAllRanges(); s.addRange(r);
    };
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, fallback); else fallback();
  });
});

// ---------- 5. Photo gallery (data in assets/photos.js) ----------
(function () {
  const box = document.getElementById('gallery');
  if (!box || !window.PHOTOS) return;
  const esc = s => String(s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  box.innerHTML = window.PHOTOS.map(p => `
    <figure>
      <img src="${esc(p.src)}" alt="${esc(p.title)}" loading="lazy">
      <figcaption>${esc(p.title)}${p.place ? `<small>${esc(p.place)}</small>` : ''}</figcaption>
    </figure>`).join('');
})();
