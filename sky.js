// Twinkle Sky: web port of Legal Beagll's twinkle_sky.tscn (stars → moon → fog).
// Fixed behind the whole page. Stars follow twinkle_stars_spec.md; colours follow the
// rendered reference (additive indigo crosses, occasional lavender centre).
const SKY_ASSETS = new URL('assets/sky/', (document.currentScript && document.currentScript.src) || location.href).href; // resolves from the script, so it works at any page depth (e.g. 404)
function initSky() {
  const canvas = document.querySelector('.page-sky');
  if (!canvas) return;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ASSETS = SKY_ASSETS;

  // ------------------------------------------------------------ stars (three parallax layers)
  // Star count scales with freq squared: near keeps its full share, far and mid are at a quarter of theirs.
  // speed = sideways drift, parallax = how much the layer moves with page scroll, scale = texel size on screen.
  const LAYERS = [
    { name: 'far',  seed: 6941572, freq: 0.04, speed: 0.25, parallax: 0.10, scale: 1.25, bright: 2, phase: 0.0 },
    { name: 'mid',  seed: 2211987, freq: 0.04, speed: 0.55, parallax: 0.25, scale: 1.5,  bright: 3, phase: 1.7 },
    { name: 'near', seed: 9830214, freq: 0.01, speed: 0.40, parallax: 0.25, scale: 1.3,  bright: 5, phase: 3.3 },
  ];
  const GRID = 512, OFFSET = [1.36125, 3.40313], RAMP_CUT = 0.01, RAMP_TOP = 0.9667;
  const STAR_SMOOTHING = false;   // true = linear screen scaling (soft), false = nearest (crisp pixels)
  const SPEED = 1.2;          // overall star speed (1 = as in the game)
  const BASE_DRIFT = 0.008;      // texels per ms at speed 1
  const INDIGO = [22, 4, 72];
  const LAVENDER = [238, 234, 250];   // near-white centre on the strongest stars

  function hash2(x, y, seed) {
    let h = (x * 374761393 + y * 668265263 + seed * 1442695041) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }
  function cellular(x, y, seed) {
    const cx = Math.floor(x), cy = Math.floor(y); let best = 1e9;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
      const gx = cx + i, gy = cy + j;
      const dx = gx + hash2(gx, gy, seed) - x, dy = gy + hash2(gx, gy, seed + 7919) - y;
      const d = dx * dx + dy * dy; if (d < best) best = d;
    }
    return Math.sqrt(best);
  }
  // NOISE_LINEAR: true = read the noise the way Godot's linear filter does (each star bleeds into its
  // neighbours as faint fractional samples that stack additively); false = one crisp stamp per texel.
  const NOISE_LINEAR = false;
  const SUB = NOISE_LINEAR ? 2 : 1, SG = GRID * SUB;
  const GRAD_A = [15, 0, 53], GRAD_B = [255, 255, 255], GRADIENT_BIAS = -0.2;
  function makeLayer(L) {
    const noise = new Float32Array(GRID * GRID);
    let min = Infinity, max = -Infinity;
    for (let y = 0; y < GRID; y++) for (let x = 0; x < GRID; x++) {
      const v = cellular((x + OFFSET[0]) * L.freq, (y + OFFSET[1]) * L.freq, L.seed);
      noise[y * GRID + x] = v; if (v < min) min = v; if (v > max) max = v;
    }
    const range = max - min || 1;
    for (let i = 0; i < noise.length; i++) {
      const d = (noise[i] - min) / range;
      if (d >= RAMP_CUT) { noise[i] = 0; continue; }
      const t = d / RAMP_CUT; noise[i] = RAMP_TOP * (1 - (0.5 * t + 1.5 * t * t - t * t * t));
    }
    const fine = new Float32Array(SG * SG), samples = [];
    if (NOISE_LINEAR) {
      const n = (xx, yy) => noise[(((yy % GRID) + GRID) % GRID) * GRID + (((xx % GRID) + GRID) % GRID)];
      for (let y = 0; y < SG; y++) for (let x = 0; x < SG; x++) {
        const fx = (x + 0.5) / SUB - 0.5, fy = (y + 0.5) / SUB - 0.5;
        const x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
        const v = (n(x0, y0) * (1 - tx) + n(x0 + 1, y0) * tx) * (1 - ty) + (n(x0, y0 + 1) * (1 - tx) + n(x0 + 1, y0 + 1) * tx) * ty;
        if (v > 0.002) { fine[y * SG + x] = v; samples.push(y * SG + x); }
      }
    } else {
      for (let i = 0; i < noise.length; i++) if (noise[i] > 0) { fine[i] = noise[i]; samples.push(i); }
    }
    const canvas = document.createElement('canvas'); canvas.width = SG; canvas.height = SG;
    const ctx = canvas.getContext('2d');
    const img = ctx.createImageData(SG, SG);
    return { ...L, fine, samples, canvas, ctx, img, lastKey: '' };
  }
  function stampLayer(Lr, p) {
    const px = Lr.img.data, G = SG;
    px.fill(0);
    function add(ix, iy, c, f) {
      const i = (((iy + G) % G) * G + ((ix + G) % G)) * 4;
      px[i] = Math.min(255, px[i] + c[0] * f); px[i + 1] = Math.min(255, px[i + 1] + c[1] * f); px[i + 2] = Math.min(255, px[i + 2] + c[2] * f); px[i + 3] = 255;
    }
    for (let n = 0; n < Lr.samples.length; n++) {
      const idx = Lr.samples[n], sx = idx % G, sy = (idx - sx) / G;
      const I = Math.min(1, Math.max(0, Lr.fine[idx] * p.intensity_scale));
      if (I <= 0) continue;
      const core = Math.floor(I * p.max_star_size + 0.5), half = Math.floor(core / 2), even = core % 2 === 0;
      let col, gain;
      if (NOISE_LINEAR) {   // true gradient colour; stacking comes from the fractional neighbours
        const g = Math.min(1, Math.max(0, I + GRADIENT_BIAS));
        col = [GRAD_A[0] + (GRAD_B[0] - GRAD_A[0]) * g, GRAD_A[1] + (GRAD_B[1] - GRAD_A[1]) * g, GRAD_A[2] + (GRAD_B[2] - GRAD_A[2]) * g];
        gain = Lr.bright / 3;
      } else {              // crisp mode: fake the stacking with a per-layer multiplier
        col = INDIGO; gain = I > 0.5 ? Lr.bright : Lr.bright - 1;
      }
      const H = half * SUB, f = p.bloom_strength * gain;
      for (let dy = -H; dy <= H; dy++) for (let dx = -H; dx <= H; dx++) add(sx + dx, sy + dy, col, gain);
      const cols = even ? [0, 1] : [0], reach = (half + p.bloom_radius) * SUB;
      for (const c of cols) for (let d = H + 1; d <= reach; d++) {
        const k = NOISE_LINEAR ? f : (d === H + 1 ? gain : gain - 1) * p.bloom_strength;
        add(sx + c, sy + d, col, k); add(sx + c, sy - d, col, k); add(sx + d, sy + c, col, k); add(sx - d, sy + c, col, k);
      }
      // White centres: the bigger the star, the likelier (3x3 cores ~45%, 1x1 cores ~4%, nearer layers a touch more).
      const r = hash2(sx, sy, 99);
      const chance = (I >= 0.5 ? 1.0 : 0.5) * (0.85 + 0.15 * Lr.bright / 4);
      if (r < chance) {
        add(sx, sy, LAVENDER, 1);
        if (half > 0) { add(sx + 1, sy, LAVENDER, 0.45); add(sx - 1, sy, LAVENDER, 0.45); add(sx, sy + 1, LAVENDER, 0.45); add(sx, sy - 1, LAVENDER, 0.45); }
      } else if (!NOISE_LINEAR && r < chance + 0.08) { add(sx, sy, INDIGO, 2); add(sx, sy, [150, 140, 200], 0.7); }
    }
    Lr.ctx.putImageData(Lr.img, 0, 0);
  }
  const layers = LAYERS.map(makeLayer);

  function keyed(keys, t) {
    for (let i = 0; i < keys.length - 1; i++) { const [t0, v0] = keys[i], [t1, v1] = keys[i + 1];
      if (t >= t0 && t <= t1) { const u = (t - t0) / (t1 - t0), s = u * u * (3 - 2 * u); return v0 + (v1 - v0) * s; } }
    return keys[keys.length - 1][1];
  }
  const idle = { max_star_size: [[0, 3], [2.833, 2.8], [5, 3]], bloom_strength: [[0, 1], [1.9, 0.5], [5, 1]], bloom_radius: [[0, 2], [2.433, 5], [5, 2]], intensity_scale: [[0, 1.1], [2.867, 1.0], [5, 1.1]] };
  const baseParams = { max_star_size: 3, bloom_strength: 1, bloom_radius: 2, intensity_scale: 1.1 };
  function paramsAt(ms, phase) { const t = (ms * SPEED / 4000 + phase) % 5; return { max_star_size: keyed(idle.max_star_size, t), bloom_strength: keyed(idle.bloom_strength, t), bloom_radius: Math.round(keyed(idle.bloom_radius, t)), intensity_scale: keyed(idle.intensity_scale, t) }; }

  // ------------------------------------------------------------ fog (tileable FBM value noise, pre-baked RGBA)
  const FOG = 256;
  const fogLayer = document.createElement('canvas'); fogLayer.width = FOG; fogLayer.height = FOG;
  {
    function vnoise(x, y, period, seed) { // tileable value noise
      const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
      const sx = xf * xf * (3 - 2 * xf), sy = yf * yf * (3 - 2 * yf);
      const h = (a, b) => hash2(((a % period) + period) % period, ((b % period) + period) % period, seed);
      const a = h(xi, yi), b = h(xi + 1, yi), c = h(xi, yi + 1), d = h(xi + 1, yi + 1);
      return (a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy;
    }
    const data = fogLayer.getContext('2d').createImageData(FOG, FOG), fp = data.data;
    const vals = new Float32Array(FOG * FOG); let mn = Infinity, mx = -Infinity;
    for (let y = 0; y < FOG; y++) for (let x = 0; x < FOG; x++) {
      let v = 0, amp = 1, freq = 4, norm = 0;
      for (let o = 0; o < 5; o++) { v += vnoise(x / FOG * freq, y / FOG * freq, freq, 31 + o) * amp; norm += amp; amp *= 0.5; freq *= 2; }
      v /= norm; vals[y * FOG + x] = v; if (v < mn) mn = v; if (v > mx) mx = v;
    }
    // ramp 0 → 0.7307: 0.987 → 1, then fog = clamp(n*2-1) * 0.25, colour from the blue→purple gradient over 0..0.25
    const G0 = [53, 44, 154], G1 = [109, 49, 142];
    for (let i = 0; i < vals.length; i++) {
      const n0 = (vals[i] - mn) / (mx - mn);
      const n = n0 < 0.7307 ? n0 / 0.7307 * 0.98667 : 0.98667 + (n0 - 0.7307) / (1 - 0.7307) * 0.01333;
      const fog = Math.min(1, Math.max(0, n * 2 - 1)) * 0.25;
      const g = Math.min(1, fog / 0.2267);
      fp[i * 4] = G0[0] + (G1[0] - G0[0]) * g; fp[i * 4 + 1] = G0[1] + (G1[1] - G0[1]) * g; fp[i * 4 + 2] = G0[2] + (G1[2] - G0[2]) * g;
      fp[i * 4 + 3] = Math.round(fog * 255);
    }
    fogLayer.getContext('2d').putImageData(data, 0, 0);
  }

  // ------------------------------------------------------------ moon + trees (placement.json, 1920x1080 stage)
  const placement = [
    { img: 'moon.png', flip: false, left: 1625, top: 52, width: 240, height: 240 },
    // tree silhouettes removed from the page background by request; the trees now live in the footer strip
  ];
  const images = {};
  for (const l of placement) if (!images[l.img]) { const im = new Image(); im.src = ASSETS + l.img; images[l.img] = im; }

  // ------------------------------------------------------------ draw
  const ctx = canvas.getContext('2d');
  let dpr = 1;
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(window.innerWidth * dpr); canvas.height = Math.round(window.innerHeight * dpr);
  }
  resize(); window.addEventListener('resize', resize);

  let lastKey = '';
  const start = performance.now();
  function frame(now) {
    const W = canvas.width, H = canvas.height;
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    ctx.imageSmoothingEnabled = STAR_SMOOTHING;   // linear screen scaling softens the crosses, like Godot's linear filter
    ctx.imageSmoothingQuality = 'high';
    ctx.globalCompositeOperation = 'lighter';
    for (const Lr of layers) {
      const p = reduceMotion ? baseParams : paramsAt(now - start, Lr.phase);
      const key = [p.max_star_size.toFixed(2), p.bloom_strength.toFixed(2), p.bloom_radius, p.intensity_scale.toFixed(3)].join('|');
      if (key !== Lr.lastKey) { stampLayer(Lr, p); Lr.lastKey = key; }
      const tile = GRID * Lr.scale * dpr;
      const drift = reduceMotion ? 0 : (now - start) * BASE_DRIFT * SPEED * Lr.speed;
      const texel = Lr.scale * dpr;
      const offX = ((-(drift) * texel) % tile + tile) % tile;
      const offY = ((-(window.scrollY * Lr.parallax) * texel) % tile + tile) % tile;
      for (let y = offY - tile; y < H; y += tile) for (let x = offX - tile; x < W; x += tile) ctx.drawImage(Lr.canvas, Math.round(x), Math.round(y), tile, tile);
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.imageSmoothingEnabled = false;   // moon stays crisp

    // moon: stage scaled to the viewport width, pinned to the top, parallax slower than the page
    const s = W / 1920;
    const stageW = 1920 * s;
    const ox = (W - stageW) / 2, oy = -window.scrollY * 0.08 * dpr;
    for (const l of placement) {
      const im = images[l.img]; if (!im.complete || !im.naturalWidth) continue;
      const x = ox + l.left * s, y = oy + l.top * s, w = l.width * s, h = l.height * s;
      if (l.flip) { ctx.save(); ctx.translate(x + w, y); ctx.scale(-1, 1); ctx.drawImage(im, 0, 0, w, h); ctx.restore(); }
      else ctx.drawImage(im, x, y, w, h);
    }

    // fog on top: one tile across the viewport, drifting left and up
    ctx.imageSmoothingEnabled = true;
    const t = reduceMotion ? 0 : (now - start) / 1000;
    const fx = ((-(0.02 * t) % 1) + 1) % 1 * W, fy = ((-(0.01 * t) % 1) + 1) % 1 * H;
    for (let j = -1; j <= 0; j++) for (let i = -1; i <= 0; i++) ctx.drawImage(fogLayer, fx + i * W, fy + j * H, W, H);

    if (!reduceMotion) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  requestAnimationFrame(() => canvas.classList.add('is-ready'));
  if (reduceMotion) { window.addEventListener('scroll', () => frame(performance.now()), { passive: true }); Object.values(images).forEach(im => im.addEventListener('load', () => frame(performance.now()))); }
}
// Build the sky after the page has painted so it never delays the first view.
if ('requestIdleCallback' in window) requestIdleCallback(initSky, { timeout: 800 }); else setTimeout(initSky, 60);
