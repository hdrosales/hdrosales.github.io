/* ============================================================
   Skyrmion racetrack — particle model based on the Thiele equation
     G ẑ × v + α D v = F
   F = driving force (current) + skyrmion–skyrmion repulsion
       + edge repulsion + pinning sites + thermal noise.
   Each skyrmion is drawn as a spin texture on a square grid.
   ============================================================ */
(function () {
  const cv = document.getElementById('sim');
  if (!cv) return;
  const ctx = cv.getContext('2d');
  const $ = id => document.getElementById(id);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---- parameters (units: lattice spacings, seconds) ----
  const LX = 64;                    // track length (periodic)
  let LY = 28;                      // track width (set from aspect ratio)
  const R = 1.9;                    // skyrmion radius
  const WALL = 1.0;                 // wall width of the profile
  const G = 1.0, D = 1.4;           // gyrocoupling and dissipation (normalized)
  const P = {
    j: +$('j').value, alpha: +$('alpha').value, T: +$('temp').value,
    type: 'neel', tool: 'sk', running: !reduce
  };

  let sk = [], pins = [];
  function reset() {
    sk = []; pins = [];
    for (let i = 0; i < 6; i++) sk.push({ x: 6 + i * 10, y: LY / 2 + (i % 2 ? 3 : -3) });
    pins.push({ x: 22, y: LY * 0.3 }, { x: 40, y: LY * 0.7 }, { x: 52, y: LY * 0.45 });
  }

  // ---- sizing ----
  let W = 0, H = 0, s = 1;
  function resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const r = cv.getBoundingClientRect();
    W = r.width; H = r.height;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    s = W / LX;
    const newLY = H / s;
    if (sk.length) { const f = newLY / LY; sk.forEach(k => k.y *= f); pins.forEach(p => p.y *= f); }
    LY = newLY;
  }

  const wrap = dx => dx - LX * Math.round(dx / LX);  // minimum image in x

  // ---- dynamics ----
  function forces() {
    const F = sk.map(() => [0, 0]);
    const drive = 6 * P.j;
    sk.forEach((a, i) => {
      F[i][0] += drive;
      // edges
      F[i][1] += 60 * Math.exp(-(a.y - R * 1.6) / 1.0) - 60 * Math.exp(-(LY - R * 1.6 - a.y) / 1.0);
      // pinning sites (attractive Gaussian wells)
      for (const p of pins) {
        const dx = wrap(a.x - p.x), dy = a.y - p.y, r2 = dx * dx + dy * dy;
        const f = -14 * Math.exp(-r2 / 6) / 3;
        F[i][0] += f * dx; F[i][1] += f * dy;
      }
      // skyrmion–skyrmion repulsion
      for (let k = i + 1; k < sk.length; k++) {
        const b = sk[k];
        const dx = wrap(a.x - b.x), dy = a.y - b.y, d = Math.hypot(dx, dy) || 1e-3;
        if (d > 12) continue;
        const f = 30 * Math.exp(-(d - 2 * R) / 1.3) / d;
        F[i][0] += f * dx; F[i][1] += f * dy;
        F[k][0] -= f * dx; F[k][1] -= f * dy;
      }
      // thermal kicks
      if (P.T > 0) { F[i][0] += P.T * 12 * (Math.random() - .5); F[i][1] += P.T * 12 * (Math.random() - .5); }
    });
    return F;
  }
  let meanVx = 0;
  function step(dt) {
    const F = forces();
    const aD = P.alpha * D, den = aD * aD + G * G;
    let sum = 0;
    sk.forEach((a, i) => {
      const [fx, fy] = F[i];
      let vx = (aD * fx + G * fy) / den;
      let vy = (-G * fx + aD * fy) / den;
      const v = Math.hypot(vx, vy), vmax = 40;
      if (v > vmax) { vx *= vmax / v; vy *= vmax / v; }
      a.x = (a.x + vx * dt + LX) % LX;
      a.y = Math.min(LY - 0.5, Math.max(0.5, a.y + vy * dt));
      sum += vx;
    });
    const inst = sk.length ? sum / sk.length : 0;
    meanVx += (inst - meanVx) * 0.05;
  }

  // ---- rendering ----
  let dark = false, bg = '#EEF1F8', line = '#DDE2EE', accent = '#3B5BDB';
  function readTheme() {
    const cs = getComputedStyle(document.documentElement);
    dark = cs.getPropertyValue('--lattice').trim() === 'dark';
    bg = cs.getPropertyValue('--surface-2').trim();
    line = cs.getPropertyValue('--line').trim();
    accent = cs.getPropertyValue('--accent-2').trim();
  }
  readTheme();
  new MutationObserver(readTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', readTheme);

  function theta(r) { return 2 * Math.atan(Math.sinh(R / WALL) / Math.sinh(Math.max(r, 1e-3) / WALL)); }

  function draw() {
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    // pinning sites
    for (const p of pins) {
      ctx.beginPath(); ctx.arc(p.x * s, p.y * s, 2.2 * s, 0, 7);
      ctx.fillStyle = accent + '22'; ctx.fill();
      ctx.setLineDash([4, 4]); ctx.strokeStyle = accent; ctx.lineWidth = 1.2; ctx.stroke(); ctx.setLineDash([]);
    }
    // core glow
    for (const a of sk) {
      const g = ctx.createRadialGradient(a.x * s, a.y * s, 0, a.x * s, a.y * s, R * 1.3 * s);
      g.addColorStop(0, dark ? 'rgba(255,255,255,.16)' : 'rgba(20,26,46,.14)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(a.x * s, a.y * s, R * 1.3 * s, 0, 7); ctx.fill();
    }
    // spin field
    const step = W < 520 ? 1.4 : 1;
    const nx = Math.ceil(LX / step), ny = Math.ceil(LY / step);
    for (let j = 0; j <= ny; j++) {
      for (let i = 0; i < nx; i++) {
        const x = (i + 0.5) * step, y = (j + 0.25) * step;
        if (y > LY) continue;
        let best = 1e9, bx = 0, by = 0;
        for (const a of sk) {
          const dx = wrap(x - a.x), dy = y - a.y, d2 = dx * dx + dy * dy;
          if (d2 < best) { best = d2; bx = dx; by = dy; }
        }
        const r = Math.sqrt(best);
        const th = sk.length ? theta(r) : 0;
        let ph = Math.atan2(by, bx) + (P.type === 'bloch' ? Math.PI / 2 : 0);
        const inPlane = Math.sin(th), core = (1 - Math.cos(th)) / 2;
        const px = x * s, py = y * s;
        if (r > R * 2.6 || (inPlane < 0.08 && core < 0.5)) {       // background spins point up: small dot
          ctx.fillStyle = line; ctx.beginPath(); ctx.arc(px, py, 1.1, 0, 7); ctx.fill(); continue;
        }
        const hue = ((ph * 180 / Math.PI) + 360) % 360;
        const light = dark ? 45 + 40 * core : 58 - 30 * core;
        ctx.strokeStyle = ctx.fillStyle = `hsl(${hue}, 72%, ${light}%)`;
        const len = step * s * 0.8 * inPlane;
        const dx = Math.cos(ph) * len / 2, dy = Math.sin(ph) * len / 2;
        ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.moveTo(px - dx, py - dy); ctx.lineTo(px + dx, py + dy); ctx.stroke();
        ctx.beginPath(); ctx.arc(px + dx, py + dy, core > 0.9 ? 2 : 1.5, 0, 7); ctx.fill();
      }
    }
    // track edges
    ctx.strokeStyle = line; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, 1); ctx.lineTo(W, 1); ctx.moveTo(0, H - 1); ctx.lineTo(W, H - 1); ctx.stroke();
    // readouts
    const hall = Math.atan(G / (P.alpha * D)) * 180 / Math.PI;
    $('r-n').textContent = `N = ${sk.length}`;
    $('r-hall').textContent = `Hall angle ≈ ${hall.toFixed(0)}°`;
    $('r-v').textContent = `⟨vₓ⟩ = ${meanVx.toFixed(1)}`;
  }

  // ---- loop ----
  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (P.running) for (let k = 0; k < 4; k++) step(dt / 4);
    draw();
    requestAnimationFrame(loop);
  }

  // ---- controls ----
  function bindRange(id, key, fmt) {
    const el = $(id), out = $(id + '-out');
    const upd = () => { P[key] = +el.value; out.textContent = fmt(P[key]); };
    el.addEventListener('input', upd); upd();
  }
  bindRange('j', 'j', v => v.toFixed(2));
  bindRange('alpha', 'alpha', v => v.toFixed(2));
  bindRange('temp', 'T', v => v.toFixed(2));

  document.querySelectorAll('[data-tool]').forEach(b => b.addEventListener('click', () => {
    P.tool = b.dataset.tool;
    document.querySelectorAll('[data-tool]').forEach(x => x.setAttribute('aria-pressed', x === b));
  }));
  document.querySelectorAll('[data-type]').forEach(b => b.addEventListener('click', () => {
    P.type = b.dataset.type;
    document.querySelectorAll('[data-type]').forEach(x => x.setAttribute('aria-pressed', x === b));
  }));
  const playBtn = $('play');
  const syncPlay = () => { playBtn.textContent = P.running ? 'Pause' : 'Play'; };
  playBtn.addEventListener('click', () => { P.running = !P.running; syncPlay(); });
  syncPlay();
  $('reset').addEventListener('click', () => { reset(); meanVx = 0; });
  $('clear').addEventListener('click', () => { sk = []; pins = []; });

  cv.addEventListener('pointerdown', e => {
    const r = cv.getBoundingClientRect();
    const x = (e.clientX - r.left) / s, y = (e.clientY - r.top) / s;
    if (P.tool === 'sk') { if (sk.length < 40) sk.push({ x, y }); }
    else if (P.tool === 'pin') pins.push({ x, y });
    else {
      const near = (arr, rad) => arr.findIndex(a => Math.hypot(wrap(a.x - x), a.y - y) < rad);
      let i = near(sk, R * 1.3);
      if (i >= 0) sk.splice(i, 1); else if ((i = near(pins, 2.5)) >= 0) pins.splice(i, 1);
    }
  });

  resize(); reset();
  window.addEventListener('resize', resize);
  requestAnimationFrame(loop);
})();
