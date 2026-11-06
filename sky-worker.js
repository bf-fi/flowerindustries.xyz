// Sky noise for sky.js: the cellular star fields and the FBM fog tile, pure maths on typed arrays.
// sky.js runs this as a Web Worker when it can and as a classic script on the main thread when it cannot,
// so there is one copy of the generation code and both paths produce the same bytes.
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
function vnoise(x, y, period, seed) { // tileable value noise
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const sx = xf * xf * (3 - 2 * xf), sy = yf * yf * (3 - 2 * yf);
  const h = (a, b) => hash2(((a % period) + period) % period, ((b % period) + period) % period, seed);
  const a = h(xi, yi), b = h(xi + 1, yi), c = h(xi, yi + 1), d = h(xi + 1, yi + 1);
  return (a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy;
}
// cfg = { layers: [{ seed, freq, ... }], grid, offset, rampCut, rampTop, linear, fog } — the values live in sky.js.
// Returns { layers: [{ fine, samples, rolls }], fog }: fine = star intensity per texel, samples = the lit texels,
// rolls = hash2(x, y, 99) per sample (the white-centre lottery, rolled here so the main thread needs no hash2),
// fog = pre-baked RGBA pixels.
function generateSky(cfg) {
  const GRID = cfg.grid, OFFSET = cfg.offset, RAMP_CUT = cfg.rampCut, RAMP_TOP = cfg.rampTop;
  const NOISE_LINEAR = cfg.linear, SUB = NOISE_LINEAR ? 2 : 1, SG = GRID * SUB, FOG = cfg.fog;
  const layers = cfg.layers.map(L => {
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
    const fine = new Float32Array(SG * SG), lit = [];
    if (NOISE_LINEAR) {
      const n = (xx, yy) => noise[(((yy % GRID) + GRID) % GRID) * GRID + (((xx % GRID) + GRID) % GRID)];
      for (let y = 0; y < SG; y++) for (let x = 0; x < SG; x++) {
        const fx = (x + 0.5) / SUB - 0.5, fy = (y + 0.5) / SUB - 0.5;
        const x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
        const v = (n(x0, y0) * (1 - tx) + n(x0 + 1, y0) * tx) * (1 - ty) + (n(x0, y0 + 1) * (1 - tx) + n(x0 + 1, y0 + 1) * tx) * ty;
        if (v > 0.002) { fine[y * SG + x] = v; lit.push(y * SG + x); }
      }
    } else {
      for (let i = 0; i < noise.length; i++) if (noise[i] > 0) { fine[i] = noise[i]; lit.push(i); }
    }
    const samples = Uint32Array.from(lit), rolls = new Float64Array(samples.length);
    for (let n = 0; n < samples.length; n++) { const sx = samples[n] % SG; rolls[n] = hash2(sx, (samples[n] - sx) / SG, 99); }
    return { fine, samples, rolls };
  });

  const fog = new Uint8ClampedArray(FOG * FOG * 4);   // clamped array so the gradient maths rounds exactly as writing into ImageData did
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
    const f = Math.min(1, Math.max(0, n * 2 - 1)) * 0.25;
    const g = Math.min(1, f / 0.2267);
    fog[i * 4] = G0[0] + (G1[0] - G0[0]) * g; fog[i * 4 + 1] = G0[1] + (G1[1] - G0[1]) * g; fog[i * 4 + 2] = G0[2] + (G1[2] - G0[2]) * g;
    fog[i * 4 + 3] = Math.round(f * 255);
  }
  return { layers, fog };
}
if (typeof importScripts === 'function') onmessage = e => {   // running as a worker: build once, hand the buffers over without copying
  const sky = generateSky(e.data), buffers = [sky.fog.buffer];
  for (const l of sky.layers) buffers.push(l.fine.buffer, l.samples.buffer, l.rolls.buffer);
  postMessage(sky, buffers);
};
